
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text,
  status text NOT NULL DEFAULT 'ai' CHECK (status IN ('ai','pending','active','closed')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_any_admin(auth.uid()));
CREATE POLICY "Users insert own tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_any_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_any_admin(auth.uid()));

CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX support_tickets_user_idx ON public.support_tickets(user_id, last_message_at DESC);
CREATE INDEX support_tickets_status_idx ON public.support_tickets(status, last_message_at DESC);

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user','ai','agent','system')),
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read messages of accessible tickets" ON public.support_messages FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
      AND (t.user_id = auth.uid() OR public.is_any_admin(auth.uid())))
  );
CREATE POLICY "Insert user messages" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'user'
    AND sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Agents insert agent messages" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'agent'
    AND sender_id = auth.uid()
    AND public.is_any_admin(auth.uid())
  );

CREATE INDEX support_messages_ticket_idx ON public.support_messages(ticket_id, created_at);

-- Bump ticket last_message_at when a message arrives
CREATE OR REPLACE FUNCTION public.support_bump_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.support_tickets SET last_message_at = now(), updated_at = now() WHERE id = NEW.ticket_id;
  RETURN NEW;
END $$;
CREATE TRIGGER support_messages_bump AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_bump_ticket();
