CREATE TABLE public.recommendation_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recommendation_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.recommendation_likes TO authenticated;
GRANT ALL ON public.recommendation_likes TO service_role;
ALTER TABLE public.recommendation_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select" ON public.recommendation_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_insert_own" ON public.recommendation_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own" ON public.recommendation_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.recommendation_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendation_comments TO authenticated;
GRANT ALL ON public.recommendation_comments TO service_role;
ALTER TABLE public.recommendation_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON public.recommendation_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert_own" ON public.recommendation_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_own" ON public.recommendation_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete_own_or_author" ON public.recommendation_comments FOR DELETE TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.recommendations r WHERE r.id = recommendation_id AND r.user_id = auth.uid())
);
CREATE TRIGGER trg_rec_comments_updated BEFORE UPDATE ON public.recommendation_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_rec_comments_rec ON public.recommendation_comments(recommendation_id, created_at);
CREATE INDEX idx_rec_likes_rec ON public.recommendation_likes(recommendation_id);