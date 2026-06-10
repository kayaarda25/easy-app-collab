
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  meta jsonb,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON public.notifications (user_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Helper: create notification (SECURITY DEFINER, internal use)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid, _type text, _title text, _body text DEFAULT NULL,
  _link text DEFAULT NULL, _meta jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, meta)
  VALUES (_user_id, _type, _title, _body, _link, _meta)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid,text,text,text,text,jsonb) FROM PUBLIC, authenticated, anon;

-- Trigger: notify on new match
CREATE OR REPLACE FUNCTION public.notify_on_match_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.user_a, 'match', 'New match!', 'You have a new home swap match.', '/matches', jsonb_build_object('match_id', NEW.id));
  PERFORM public.create_notification(NEW.user_b, 'match', 'New match!', 'You have a new home swap match.', '/matches', jsonb_build_object('match_id', NEW.id));
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_match_created
  AFTER INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_match_created();

-- Trigger: notify on proposal created / status change
CREATE OR REPLACE FUNCTION public.notify_on_proposal_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m record;
  recipient uuid;
  title text;
  body text;
BEGIN
  SELECT user_a, user_b INTO m FROM public.matches WHERE id = NEW.match_id;
  IF m IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    -- notify the other participant
    recipient := CASE WHEN NEW.proposer_id = m.user_a THEN m.user_b ELSE m.user_a END;
    PERFORM public.create_notification(recipient, 'proposal_new',
      'New swap proposal',
      to_char(NEW.start_date, 'Mon DD') || ' → ' || to_char(NEW.end_date, 'Mon DD'),
      '/chat/' || NEW.match_id::text,
      jsonb_build_object('match_id', NEW.match_id, 'proposal_id', NEW.id));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    -- notify both
    title := CASE NEW.status
      WHEN 'accepted'  THEN 'Swap accepted'
      WHEN 'rejected'  THEN 'Swap declined'
      WHEN 'cancelled' THEN 'Swap cancelled'
      WHEN 'confirmed' THEN 'Swap confirmed'
      ELSE 'Swap status: ' || NEW.status
    END;
    body := to_char(NEW.start_date, 'Mon DD') || ' → ' || to_char(NEW.end_date, 'Mon DD');
    PERFORM public.create_notification(m.user_a, 'proposal_status', title, body, '/chat/' || NEW.match_id::text, jsonb_build_object('proposal_id', NEW.id, 'status', NEW.status));
    PERFORM public.create_notification(m.user_b, 'proposal_status', title, body, '/chat/' || NEW.match_id::text, jsonb_build_object('proposal_id', NEW.id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_proposal_ins
  AFTER INSERT ON public.swap_proposals
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_proposal_event();
CREATE TRIGGER trg_notify_proposal_upd
  AFTER UPDATE ON public.swap_proposals
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_proposal_event();

-- Trigger: notify on new chat message (only user messages, not system)
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m record;
  recipient uuid;
  sender_name text;
BEGIN
  IF NEW.kind = 'system' OR NEW.sender_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_a, user_b INTO m FROM public.matches WHERE id = NEW.match_id;
  IF m IS NULL THEN RETURN NEW; END IF;
  recipient := CASE WHEN NEW.sender_id = m.user_a THEN m.user_b ELSE m.user_a END;
  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  PERFORM public.create_notification(recipient, 'message',
    COALESCE(sender_name, 'New message'),
    LEFT(NEW.body, 120),
    '/chat/' || NEW.match_id::text,
    jsonb_build_object('match_id', NEW.match_id));
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- Trigger: notify reviewee on new review
CREATE OR REPLACE FUNCTION public.notify_on_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.reviewee_id, 'review',
    'You received a review',
    NEW.rating || ' ★ from your recent swap',
    '/profile',
    jsonb_build_object('review_id', NEW.id));
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_review();
