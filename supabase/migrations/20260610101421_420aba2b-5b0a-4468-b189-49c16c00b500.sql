
-- Allow system messages and event metadata
ALTER TABLE public.messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS meta jsonb;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_kind_check CHECK (kind IN ('user','system'));

-- Per-user last-read marker for unread counts
CREATE TABLE IF NOT EXISTS public.match_reads (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_reads TO authenticated;
GRANT ALL ON public.match_reads TO service_role;

ALTER TABLE public.match_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own match reads" ON public.match_reads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Upsert own match read" ON public.match_reads
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.matches m
                WHERE m.id = match_reads.match_id
                  AND (m.user_a = auth.uid() OR m.user_b = auth.uid()))
  );
CREATE POLICY "Update own match read" ON public.match_reads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System message helpers ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_system_message(_match_id uuid, _body text, _meta jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.messages (match_id, sender_id, body, kind, meta)
  VALUES (_match_id, NULL, _body, 'system', _meta);
END;
$$;

-- Trigger: on new match
CREATE OR REPLACE FUNCTION public.on_match_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.post_system_message(
    NEW.id,
    'You matched! Say hi and propose a swap.',
    jsonb_build_object('event','match_created')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_match_created ON public.matches;
CREATE TRIGGER trg_on_match_created
AFTER INSERT ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.on_match_created();

-- Trigger: on proposal created
CREATE OR REPLACE FUNCTION public.on_proposal_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.post_system_message(
    NEW.match_id,
    'Swap proposal sent: ' || to_char(NEW.start_date, 'Mon DD') || ' → ' || to_char(NEW.end_date, 'Mon DD') || ' · ' || NEW.guests || ' guests',
    jsonb_build_object('event','proposal_created','proposal_id',NEW.id,'status',NEW.status)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_proposal_created ON public.swap_proposals;
CREATE TRIGGER trg_on_proposal_created
AFTER INSERT ON public.swap_proposals
FOR EACH ROW EXECUTE FUNCTION public.on_proposal_created();

-- Trigger: on proposal status change
CREATE OR REPLACE FUNCTION public.on_proposal_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    msg := CASE NEW.status
      WHEN 'accepted'  THEN 'Swap accepted — ready to switch!'
      WHEN 'rejected'  THEN 'Swap proposal declined.'
      WHEN 'cancelled' THEN 'Swap proposal cancelled.'
      WHEN 'confirmed' THEN 'Swap confirmed. Have a great stay!'
      ELSE 'Swap status changed to ' || NEW.status
    END;
    PERFORM public.post_system_message(
      NEW.match_id, msg,
      jsonb_build_object('event','proposal_status','proposal_id',NEW.id,'status',NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_proposal_status_changed ON public.swap_proposals;
CREATE TRIGGER trg_on_proposal_status_changed
AFTER UPDATE OF status ON public.swap_proposals
FOR EACH ROW EXECUTE FUNCTION public.on_proposal_status_changed();
