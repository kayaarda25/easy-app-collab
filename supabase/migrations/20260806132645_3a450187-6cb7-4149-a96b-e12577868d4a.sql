ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_proposal_id_reviewer_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_proposal_reviewer_property_key
  ON public.reviews (proposal_id, reviewer_id, property_id) NULLS NOT DISTINCT;