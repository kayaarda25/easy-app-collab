
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reviews_property_idx ON public.reviews(property_id);

-- One review per (reviewer, proposal, property-scope). Uses coalesce so
-- separate person-review and property-review rows coexist for one proposal.
CREATE UNIQUE INDEX IF NOT EXISTS reviews_reviewer_proposal_scope_uidx
  ON public.reviews (reviewer_id, proposal_id, COALESCE(property_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE OR REPLACE FUNCTION public.validate_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p record;
BEGIN
  SELECT sp.*, mt.user_a, mt.user_b, mt.property_a, mt.property_b
    INTO p
    FROM public.swap_proposals sp
    JOIN public.matches mt ON mt.id = sp.match_id
   WHERE sp.id = NEW.proposal_id;

  IF p IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  IF p.status NOT IN ('accepted','confirmed') THEN
    RAISE EXCEPTION 'Can only review accepted swaps';
  END IF;

  IF p.end_date >= CURRENT_DATE THEN
    RAISE EXCEPTION 'Reviews are only allowed after check-out';
  END IF;

  IF NEW.reviewer_id NOT IN (p.user_a, p.user_b) THEN
    RAISE EXCEPTION 'Reviewer is not a participant of this swap';
  END IF;

  IF NEW.reviewee_id NOT IN (p.user_a, p.user_b)
     OR NEW.reviewee_id = NEW.reviewer_id THEN
    RAISE EXCEPTION 'Invalid reviewee for this swap';
  END IF;

  IF NEW.property_id IS NOT NULL
     AND NEW.property_id <> COALESCE(p.property_a, '00000000-0000-0000-0000-000000000000'::uuid)
     AND NEW.property_id <> COALESCE(p.property_b, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'Property is not part of this swap';
  END IF;

  RETURN NEW;
END;
$function$;
