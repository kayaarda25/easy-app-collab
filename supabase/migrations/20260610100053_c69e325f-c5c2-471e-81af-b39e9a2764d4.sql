
CREATE TYPE public.recommendation_category AS ENUM ('destination','bar','restaurant','sightseeing','other');

CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.recommendation_category NOT NULL,
  title text NOT NULL,
  description text,
  city text,
  country text,
  image_url text,
  link_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recommendations are viewable by authenticated users"
  ON public.recommendations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own recommendations"
  ON public.recommendations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recommendations"
  ON public.recommendations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recommendations"
  ON public.recommendations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_recommendations_updated_at
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_recommendations_created_at ON public.recommendations (created_at DESC);
CREATE INDEX idx_recommendations_category ON public.recommendations (category);
