
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.swap_proposals(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, reviewer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Validation trigger: reviewer must be a swap participant, reviewee must be the OTHER party, and end_date must be in the past with status accepted/confirmed.
CREATE OR REPLACE FUNCTION public.validate_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  p record;
BEGIN
  SELECT sp.*, mt.user_a, mt.user_b
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_review
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_review();

CREATE TRIGGER trg_reviews_updated
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Reviews are viewable by authenticated users"
  ON public.reviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "Reviewer can insert own review"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Reviewer can update own review"
  ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Reviewer can delete own review"
  ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = reviewer_id);

CREATE INDEX idx_reviews_reviewee ON public.reviews (reviewee_id, created_at DESC);
CREATE INDEX idx_reviews_proposal ON public.reviews (proposal_id);

-- Private feedback table — only the reviewee can read.
CREATE TABLE public.review_private_feedback (
  review_id uuid PRIMARY KEY REFERENCES public.reviews(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_private_feedback TO authenticated;
GRANT ALL ON public.review_private_feedback TO service_role;

ALTER TABLE public.review_private_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviewee can read private feedback"
  ON public.review_private_feedback FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.id = review_id AND r.reviewee_id = auth.uid()
  ));

CREATE POLICY "Reviewer manages private feedback"
  ON public.review_private_feedback FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.id = review_id AND r.reviewer_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.id = review_id AND r.reviewer_id = auth.uid()
  ));

CREATE TRIGGER trg_review_private_feedback_updated
  BEFORE UPDATE ON public.review_private_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
