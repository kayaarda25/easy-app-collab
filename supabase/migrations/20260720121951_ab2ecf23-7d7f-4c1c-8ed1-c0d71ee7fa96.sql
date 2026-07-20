
CREATE TABLE public.booking_guests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.swap_proposals(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birthdate DATE NOT NULL,
  id_number TEXT NOT NULL,
  id_type TEXT NOT NULL DEFAULT 'passport',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX booking_guests_proposal_idx ON public.booking_guests(proposal_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_guests TO authenticated;
GRANT ALL ON public.booking_guests TO service_role;

ALTER TABLE public.booking_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view guests"
  ON public.booking_guests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.swap_proposals sp
      JOIN public.matches m ON m.id = sp.match_id
      WHERE sp.id = booking_guests.proposal_id
        AND (auth.uid() = m.user_a OR auth.uid() = m.user_b)
    )
    OR public.is_any_admin(auth.uid())
  );

CREATE POLICY "Participants can insert guests"
  ON public.booking_guests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = added_by
    AND EXISTS (
      SELECT 1 FROM public.swap_proposals sp
      JOIN public.matches m ON m.id = sp.match_id
      WHERE sp.id = booking_guests.proposal_id
        AND (auth.uid() = m.user_a OR auth.uid() = m.user_b)
    )
  );

CREATE POLICY "Participants can update guests"
  ON public.booking_guests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.swap_proposals sp
      JOIN public.matches m ON m.id = sp.match_id
      WHERE sp.id = booking_guests.proposal_id
        AND (auth.uid() = m.user_a OR auth.uid() = m.user_b)
    )
  );

CREATE POLICY "Participants can delete guests"
  ON public.booking_guests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.swap_proposals sp
      JOIN public.matches m ON m.id = sp.match_id
      WHERE sp.id = booking_guests.proposal_id
        AND (auth.uid() = m.user_a OR auth.uid() = m.user_b)
    )
  );

CREATE TRIGGER update_booking_guests_updated_at
  BEFORE UPDATE ON public.booking_guests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
