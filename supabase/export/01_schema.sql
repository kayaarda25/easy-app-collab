-- flatch: Vollstaendiges Schema (aus allen Migrationen zusammengefuehrt)
-- Reihenfolge = chronologisch. Auf dem NEUEN Supabase-Projekt im SQL Editor ausfuehren.

-- ============================================================
-- 20260609114208_29d3294c-7db8-4a40-80df-c8aeff3d8c2e.sql
-- ============================================================

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE public.property_type AS ENUM ('house', 'apartment', 'villa', 'cabin', 'loft', 'other');
CREATE TYPE public.swipe_direction AS ENUM ('like', 'pass');
CREATE TYPE public.proposal_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'confirmed');

-- ============ updated_at helper ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  languages TEXT[] DEFAULT ARRAY[]::TEXT[],
  birth_date DATE,
  city TEXT,
  country TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ PROPERTIES ============
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  property_type property_type NOT NULL DEFAULT 'apartment',
  bedrooms INT NOT NULL DEFAULT 1,
  beds INT NOT NULL DEFAULT 1,
  bathrooms NUMERIC(3,1) NOT NULL DEFAULT 1,
  max_guests INT NOT NULL DEFAULT 2,
  amenities TEXT[] DEFAULT ARRAY[]::TEXT[],
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  address TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
-- Anyone signed in can view active properties (address hidden via view/code)
CREATE POLICY "View active properties" ON public.properties FOR SELECT TO authenticated USING (is_active = true OR auth.uid() = owner_id);
CREATE POLICY "Owner inserts property" ON public.properties FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates property" ON public.properties FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner deletes property" ON public.properties FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_properties_city ON public.properties(city);
CREATE INDEX idx_properties_owner ON public.properties(owner_id);

-- ============ PROPERTY IMAGES ============
CREATE TABLE public.property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_images TO authenticated;
GRANT ALL ON public.property_images TO service_role;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View property images" ON public.property_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner manages images" ON public.property_images FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));
CREATE INDEX idx_images_property ON public.property_images(property_id);

-- ============ AVAILABILITIES ============
CREATE TABLE public.availabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availabilities TO authenticated;
GRANT ALL ON public.availabilities TO service_role;
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View availabilities" ON public.availabilities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner manages availabilities" ON public.availabilities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));

-- ============ SWIPES ============
CREATE TABLE public.swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  direction swipe_direction NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.swipes TO authenticated;
GRANT ALL ON public.swipes TO service_role;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own swipes" ON public.swipes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own swipes" ON public.swipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_swipes_user ON public.swipes(user_id);
CREATE INDEX idx_swipes_property ON public.swipes(property_id);

-- ============ MATCHES ============
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_a UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  property_b UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_a, property_b)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own matches" ON public.matches FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE INDEX idx_matches_users ON public.matches(user_a, user_b);

-- ============ MESSAGES ============
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View messages in own matches" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));
CREATE POLICY "Send messages in own matches" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));
CREATE INDEX idx_messages_match ON public.messages(match_id, created_at);

-- Enable realtime on messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============ SWAP PROPOSALS ============
CREATE TABLE public.swap_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  guests INT NOT NULL DEFAULT 2,
  message TEXT,
  status proposal_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.swap_proposals TO authenticated;
GRANT ALL ON public.swap_proposals TO service_role;
ALTER TABLE public.swap_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View proposals in own matches" ON public.swap_proposals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));
CREATE POLICY "Create proposals in own matches" ON public.swap_proposals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = proposer_id AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));
CREATE POLICY "Participants update proposal status" ON public.swap_proposals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));
CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON public.swap_proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 20260609114252_d4b20d8b-3613-43c2-a173-2d7ec6ebb890.sql
-- ============================================================

-- Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
-- has_role used by RLS policies as authenticated; keep that grant
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- Storage policies: users can manage files in folders named after their user ID
-- property-images bucket
CREATE POLICY "Authenticated read property images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'property-images');

CREATE POLICY "Users upload own property images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'property-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own property images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'property-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own property images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'property-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- avatars bucket
CREATE POLICY "Authenticated read avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 20260609115514_5535ce80-f2b0-4cc4-bf1f-76be7b76afcd.sql
-- ============================================================
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS house_number text;

-- Migrate existing address data (best-effort: split on first space)
UPDATE public.properties
SET street = CASE 
  WHEN position(' ' in address) > 0 THEN substring(address from 1 for position(' ' in address) - 1)
  ELSE address
END,
house_number = CASE
  WHEN position(' ' in address) > 0 THEN substring(address from position(' ' in address) + 1)
  ELSE NULL
END
WHERE address IS NOT NULL AND street IS NULL;

ALTER TABLE public.properties DROP COLUMN IF EXISTS address;
-- ============================================================
-- 20260609115729_8ed36542-3a3b-4306-bc45-9297b5438322.sql
-- ============================================================
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS zip_code text;
-- ============================================================
-- 20260609121005_5cc6cc94-d73f-49fb-b40b-192a5d780dfe.sql
-- ============================================================

-- Plan enum
CREATE TYPE public.subscription_plan AS ENUM ('basic', 'standard', 'premium');
CREATE TYPE public.subscription_status AS ENUM ('free', 'trialing', 'active', 'cancelled', 'expired', 'payment_failed');
CREATE TYPE public.subscription_store AS ENUM ('app_store', 'play_store', 'none');

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'basic',
  status public.subscription_status NOT NULL DEFAULT 'free',
  store public.subscription_store NOT NULL DEFAULT 'none',
  entitlement text,
  product_id text,
  period_type text,
  revenuecat_customer_id text,
  original_purchase_at timestamptz,
  expires_at timestamptz,
  will_renew boolean NOT NULL DEFAULT false,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
ON public.subscriptions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create free subscription row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'basic', 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_subscription
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Backfill existing users
INSERT INTO public.subscriptions (user_id, plan, status)
SELECT id, 'basic', 'free' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 20260609121022_8699e572-8fe8-47ef-b11f-809a2d9cc058.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 20260609121036_e630b6c5-1705-41ba-95c4-e2363f567cb4.sql
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
-- ============================================================
-- 20260610094003_26d4bec4-1fba-44f4-8504-710462a9465f.sql
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS trusted_host boolean NOT NULL DEFAULT false;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Backfill existing users from auth.users confirmation timestamps
UPDATE public.profiles p
SET email_verified_at = u.email_confirmed_at,
    phone_verified_at = u.phone_confirmed_at
FROM auth.users u
WHERE u.id = p.id
  AND (p.email_verified_at IS DISTINCT FROM u.email_confirmed_at
       OR p.phone_verified_at IS DISTINCT FROM u.phone_confirmed_at);

-- Keep email/phone verification in sync when auth confirms them
CREATE OR REPLACE FUNCTION public.sync_profile_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email_verified_at = NEW.email_confirmed_at,
      phone_verified_at = NEW.phone_confirmed_at
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
CREATE TRIGGER on_auth_user_verified
AFTER UPDATE OF email_confirmed_at, phone_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_verification();

-- ============================================================
-- 20260610094021_726a1547-15d9-464d-9005-4e3f1c395699.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.sync_profile_verification() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 20260610100053_c69e325f-c5c2-471e-81af-b39e9a2764d4.sql
-- ============================================================

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

-- ============================================================
-- 20260610100356_b8599290-eec9-4f57-b274-5c972e82b751.sql
-- ============================================================

ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS video_url text;

CREATE POLICY "Users can upload recommendation media to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recommendation-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read recommendation media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recommendation-media');

CREATE POLICY "Users can delete own recommendation media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'recommendation-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 20260610100600_2cac1b14-f17c-4101-a7e3-ecd3c511d845.sql
-- ============================================================

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

-- ============================================================
-- 20260610100613_1ebfe38f-36ad-4a40-9303-b775a287389c.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.validate_review() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 20260610100835_fdd105fc-f5b7-47d5-a8c3-d93dd8ad38df.sql
-- ============================================================

-- Property status workflow
CREATE TYPE public.property_status AS ENUM ('draft','pending','approved','rejected','flagged');

ALTER TABLE public.properties
  ADD COLUMN status public.property_status NOT NULL DEFAULT 'pending',
  ADD COLUMN house_rules text,
  ADD COLUMN check_in_instructions text,
  ADD COLUMN check_out_instructions text,
  ADD COLUMN review_notes text,
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at timestamptz;

-- Existing rows are grandfathered as approved
UPDATE public.properties SET status = 'approved';

CREATE INDEX idx_properties_status ON public.properties (status);

-- Rebuild SELECT policy: approved + active OR owner OR admin
DROP POLICY IF EXISTS "View active properties" ON public.properties;
CREATE POLICY "View visible properties" ON public.properties
  FOR SELECT TO authenticated
  USING (
    (is_active = true AND status = 'approved')
    OR auth.uid() = owner_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Owners can update their own listing (existing policy keeps that),
-- but we explicitly let admins update too.
CREATE POLICY "Admins update any property" ON public.properties
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Prevent owners from self-approving: any owner UPDATE that changes status
-- away from draft/pending is rejected unless an admin runs it.
CREATE OR REPLACE FUNCTION public.guard_property_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
      -- Owners may only move between draft and pending
      IF NOT (NEW.status IN ('draft','pending') AND OLD.status IN ('draft','pending','rejected','flagged')) THEN
        RAISE EXCEPTION 'Only admins can change property status to %', NEW.status;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_property_status() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_guard_property_status
  BEFORE UPDATE OF status ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.guard_property_status();

-- Availability status
CREATE TYPE public.availability_status AS ENUM ('available','blocked','reserved','pending_swap','confirmed_swap');

ALTER TABLE public.availabilities
  ADD COLUMN status public.availability_status NOT NULL DEFAULT 'available',
  ADD COLUMN note text;

CREATE INDEX idx_availabilities_status ON public.availabilities (status);

-- ============================================================
-- 20260610101421_420aba2b-5b0a-4468-b189-49c16c00b500.sql
-- ============================================================

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

-- ============================================================
-- 20260610101437_fdbfd6a8-d913-479c-9d2d-4ad1c6aadc2b.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.post_system_message(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_match_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_proposal_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_proposal_status_changed() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 20260610101747_7f22b42d-a35b-4355-90e8-29eed288bbd9.sql
-- ============================================================

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

-- ============================================================
-- 20260610101759_d03fe9d0-23a9-478a-a1e0-42fc706dceb9.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.notify_on_match_created() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_proposal_event() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_message() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_review() FROM PUBLIC, authenticated, anon;

-- ============================================================
-- 20260610102452_61b75632-b447-4611-9172-f4be166a1d89.sql
-- ============================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operations';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';

-- ============================================================
-- 20260610102508_a6edcef9-2cd9-4735-ad50-d3fcc5e90280.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_any_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin','super_admin','support','operations','finance')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.guard_property_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'support')
      OR public.has_role(auth.uid(), 'operations')
    ) THEN
      IF NOT (NEW.status IN ('draft','pending') AND OLD.status IN ('draft','pending','rejected','flagged')) THEN
        RAISE EXCEPTION 'Only admins can change property status to %', NEW.status;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 20260610102523_2da1de7f-0fc6-497e-864e-18518355054e.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.is_any_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_any_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;

-- ============================================================
-- 20260610102957_0e7551e3-5973-422f-b636-e04a5213880b.sql
-- ============================================================
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_any_admin(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, anon, service_role;
-- ============================================================
-- 20260610113822_216c8379-59bd-49d9-91ce-e9c321a11018.sql
-- ============================================================
CREATE POLICY "Users upload own chat attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users read own chat attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
-- ============================================================
-- 20260625140911_07ba2b4e-c278-458b-a3db-bc40152b3bba.sql
-- ============================================================
-- ============================================================
-- flatch.points-System
-- ============================================================

-- Ledger reason enum
DO $$ BEGIN
  CREATE TYPE public.flatch_points_reason AS ENUM (
    'earned_stay',
    'premium_bonus',
    'redeemed_stay',
    'hold',
    'hold_release',
    'refund',
    'expired',
    'admin_adjust'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.flatch_points_status AS ENUM ('active', 'released', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Proposal kind enum
DO $$ BEGIN
  CREATE TYPE public.proposal_kind AS ENUM ('direct', 'async');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- Extend swap_proposals ------------------------------------------------
ALTER TABLE public.swap_proposals
  ADD COLUMN IF NOT EXISTS kind public.proposal_kind NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS points_amount integer,
  ADD COLUMN IF NOT EXISTS host_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS points_awarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS points_hold_id uuid;

-- ---- Ledger table ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flatch_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason public.flatch_points_reason NOT NULL,
  status public.flatch_points_status NOT NULL DEFAULT 'active',
  proposal_id uuid REFERENCES public.swap_proposals(id) ON DELETE SET NULL,
  expires_at timestamptz,
  expired_at timestamptz,
  related_id uuid, -- e.g. hold -> release link
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_90 boolean NOT NULL DEFAULT false,
  notified_30 boolean NOT NULL DEFAULT false,
  notified_7  boolean NOT NULL DEFAULT false
);

GRANT SELECT ON public.flatch_points_ledger TO authenticated;
GRANT ALL ON public.flatch_points_ledger TO service_role;

ALTER TABLE public.flatch_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ledger"
  ON public.flatch_points_ledger FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS flatch_ledger_user_idx
  ON public.flatch_points_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS flatch_ledger_expiring_idx
  ON public.flatch_points_ledger (expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS flatch_ledger_proposal_idx
  ON public.flatch_points_ledger (proposal_id);

-- ---- Premium bonus claims --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flatch_premium_bonus_claims (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  proposal_id uuid REFERENCES public.swap_proposals(id) ON DELETE SET NULL,
  nights_at_claim integer NOT NULL
);

GRANT SELECT ON public.flatch_premium_bonus_claims TO authenticated;
GRANT ALL ON public.flatch_premium_bonus_claims TO service_role;

ALTER TABLE public.flatch_premium_bonus_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bonus claim"
  ON public.flatch_premium_bonus_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ---- Helper: current plan -------------------------------------------------
CREATE OR REPLACE FUNCTION public.flatch_effective_plan(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN s.status IN ('active','trialing') THEN s.plan::text
    ELSE 'basic'
  END
  FROM public.subscriptions s WHERE s.user_id = _user_id
  UNION ALL SELECT 'basic'
  LIMIT 1
$$;

-- ---- Balance --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.flatch_points_available(_user_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(delta), 0)::int
  FROM public.flatch_points_ledger
  WHERE user_id = _user_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
$$;

GRANT EXECUTE ON FUNCTION public.flatch_points_available(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flatch_effective_plan(uuid) TO authenticated;

-- ---- Earn helper: insert a credit with proper expiry by plan --------------
CREATE OR REPLACE FUNCTION public.flatch_points_credit(
  _user_id uuid, _amount int, _reason public.flatch_points_reason,
  _proposal_id uuid, _meta jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _plan text;
  _expires timestamptz;
  _id uuid;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  _plan := public.flatch_effective_plan(_user_id);
  -- Standard expires after 12 months, Premium never expires (while premium active)
  IF _plan = 'standard' THEN
    _expires := now() + interval '12 months';
  ELSE
    _expires := NULL;
  END IF;
  INSERT INTO public.flatch_points_ledger (user_id, delta, reason, proposal_id, expires_at, meta)
  VALUES (_user_id, _amount, _reason, _proposal_id, _expires, _meta)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- ---- Award stay (after successful checkout) -------------------------------
-- For async proposals only: host (host_user_id) receives nights as points.
-- Also checks Premium-Bonus eligibility (one-time +7).
CREATE OR REPLACE FUNCTION public.flatch_points_award_stay(_proposal_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p record;
  nights int;
  host_plan text;
  already_claimed boolean;
  total_hosted_nights int;
BEGIN
  SELECT * INTO p FROM public.swap_proposals WHERE id = _proposal_id FOR UPDATE;
  IF p IS NULL THEN RETURN; END IF;
  IF p.points_awarded_at IS NOT NULL THEN RETURN; END IF; -- already awarded
  IF p.status <> 'confirmed' AND p.status <> 'accepted' THEN RETURN; END IF;
  IF p.end_date >= CURRENT_DATE THEN RETURN; END IF; -- not finished yet

  nights := GREATEST(1, (p.end_date - p.start_date));

  -- Only async proposals generate points (direct swaps do not move points)
  IF p.kind = 'async' AND p.host_user_id IS NOT NULL THEN
    -- Convert hold of guest to definitive debit:
    -- The "hold" entry is already negative; mark hold as confirmed by leaving as-is
    -- (it stays active so balance reflects the spend permanently).

    -- Credit the host
    PERFORM public.flatch_points_credit(p.host_user_id, nights, 'earned_stay', p.id, NULL);
    host_plan := public.flatch_effective_plan(p.host_user_id);

    -- Premium-Bonus check: premium + >=7 hosted async nights total, never claimed before
    IF host_plan = 'premium' THEN
      SELECT EXISTS (SELECT 1 FROM public.flatch_premium_bonus_claims WHERE user_id = p.host_user_id)
        INTO already_claimed;
      IF NOT already_claimed THEN
        SELECT COALESCE(SUM(GREATEST(1, (sp.end_date - sp.start_date))), 0)
          INTO total_hosted_nights
          FROM public.swap_proposals sp
         WHERE sp.host_user_id = p.host_user_id
           AND sp.kind = 'async'
           AND sp.points_awarded_at IS NOT NULL;
        -- include current one (just awarded above sets points_awarded_at after)
        total_hosted_nights := total_hosted_nights + nights;
        IF total_hosted_nights >= 7 THEN
          PERFORM public.flatch_points_credit(p.host_user_id, 7, 'premium_bonus', p.id,
            jsonb_build_object('reason','premium_bonus_one_time'));
          INSERT INTO public.flatch_premium_bonus_claims (user_id, proposal_id, nights_at_claim)
          VALUES (p.host_user_id, p.id, total_hosted_nights)
          ON CONFLICT (user_id) DO NOTHING;
          PERFORM public.create_notification(p.host_user_id, 'flatch_points',
            'Premium-Bonus: +7 flatch.points',
            'Du hast deinen einmaligen Premium-Bonus erhalten.',
            '/profile',
            jsonb_build_object('reason','premium_bonus'));
        END IF;
      END IF;
    END IF;

    PERFORM public.create_notification(p.host_user_id, 'flatch_points',
      'Du hast ' || nights || ' flatch.points erhalten',
      'Dein abgeschlossener Aufenthalt wurde gutgeschrieben.',
      '/profile',
      jsonb_build_object('proposal_id', p.id, 'nights', nights));
  END IF;

  UPDATE public.swap_proposals
     SET points_awarded_at = now(),
         status = 'confirmed'
   WHERE id = _proposal_id;
END $$;

-- ---- Hold (reserve) points when creating an async proposal -----------------
CREATE OR REPLACE FUNCTION public.flatch_points_hold(
  _user_id uuid, _amount int, _proposal_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid; _avail int;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  _avail := public.flatch_points_available(_user_id);
  IF _avail < _amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_POINTS:You have % flatch.points but need %.', _avail, _amount;
  END IF;
  INSERT INTO public.flatch_points_ledger (user_id, delta, reason, proposal_id, meta)
  VALUES (_user_id, -_amount, 'hold', _proposal_id, jsonb_build_object('kind','hold'))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- ---- Release a hold (proposal rejected/cancelled before checkout) ----------
CREATE OR REPLACE FUNCTION public.flatch_points_release_hold(_proposal_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE h record;
BEGIN
  FOR h IN
    SELECT * FROM public.flatch_points_ledger
     WHERE proposal_id = _proposal_id
       AND reason = 'hold'
       AND status = 'active'
       AND delta < 0
  LOOP
    -- Mark hold as released and add an offsetting positive entry
    UPDATE public.flatch_points_ledger SET status = 'released' WHERE id = h.id;
    INSERT INTO public.flatch_points_ledger (user_id, delta, reason, proposal_id, related_id, meta)
    VALUES (h.user_id, -h.delta, 'hold_release', _proposal_id, h.id,
            jsonb_build_object('released_hold', h.id));
  END LOOP;
END $$;

-- ---- Trigger: when async proposal is rejected/cancelled, release hold ------
CREATE OR REPLACE FUNCTION public.on_async_proposal_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'async' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('rejected','cancelled') THEN
      PERFORM public.flatch_points_release_hold(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_async_proposal_status ON public.swap_proposals;
CREATE TRIGGER trg_async_proposal_status
  AFTER UPDATE OF status ON public.swap_proposals
  FOR EACH ROW EXECUTE FUNCTION public.on_async_proposal_status();

-- ---- Expire points & send reminders (called by cron) ----------------------
CREATE OR REPLACE FUNCTION public.flatch_points_expire_due()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; cnt int := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.flatch_points_ledger
     WHERE status = 'active'
       AND delta > 0
       AND expires_at IS NOT NULL
       AND expires_at <= now()
  LOOP
    UPDATE public.flatch_points_ledger SET status='expired', expired_at=now() WHERE id=r.id;
    INSERT INTO public.flatch_points_ledger (user_id, delta, reason, related_id, meta)
    VALUES (r.user_id, -r.delta, 'expired', r.id,
            jsonb_build_object('source_id', r.id));
    PERFORM public.create_notification(r.user_id, 'flatch_points',
      r.delta || ' flatch.points sind abgelaufen',
      'Plane deinen nächsten Swap, um neue Punkte zu sammeln.',
      '/profile', jsonb_build_object('expired_id', r.id));
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END $$;

CREATE OR REPLACE FUNCTION public.flatch_points_notify_expiring()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
BEGIN
  -- 90 days
  FOR r IN SELECT * FROM public.flatch_points_ledger
     WHERE status='active' AND delta>0 AND expires_at IS NOT NULL
       AND NOT notified_90
       AND expires_at <= now() + interval '90 days'
       AND expires_at > now() + interval '30 days'
  LOOP
    PERFORM public.create_notification(r.user_id, 'flatch_points',
      'Du hast ' || r.delta || ' flatch.points, die in 90 Tagen ablaufen',
      'Plane jetzt deinen nächsten Swap.', '/profile',
      jsonb_build_object('ledger_id', r.id, 'window','90d'));
    UPDATE public.flatch_points_ledger SET notified_90 = true WHERE id = r.id;
  END LOOP;
  -- 30 days
  FOR r IN SELECT * FROM public.flatch_points_ledger
     WHERE status='active' AND delta>0 AND expires_at IS NOT NULL
       AND NOT notified_30
       AND expires_at <= now() + interval '30 days'
       AND expires_at > now() + interval '7 days'
  LOOP
    PERFORM public.create_notification(r.user_id, 'flatch_points',
      'Du hast ' || r.delta || ' flatch.points, die in 30 Tagen ablaufen',
      'Plane jetzt deinen nächsten Swap und nutze deine Punkte rechtzeitig.', '/profile',
      jsonb_build_object('ledger_id', r.id, 'window','30d'));
    UPDATE public.flatch_points_ledger SET notified_30 = true WHERE id = r.id;
  END LOOP;
  -- 7 days
  FOR r IN SELECT * FROM public.flatch_points_ledger
     WHERE status='active' AND delta>0 AND expires_at IS NOT NULL
       AND NOT notified_7
       AND expires_at <= now() + interval '7 days'
       AND expires_at > now()
  LOOP
    PERFORM public.create_notification(r.user_id, 'flatch_points',
      'Letzte Chance: ' || r.delta || ' flatch.points laufen in 7 Tagen ab',
      'Plane jetzt deinen Swap.', '/profile',
      jsonb_build_object('ledger_id', r.id, 'window','7d'));
    UPDATE public.flatch_points_ledger SET notified_7 = true WHERE id = r.id;
  END LOOP;
END $$;

-- ---- Process completed stays (called by cron daily) ------------------------
CREATE OR REPLACE FUNCTION public.flatch_points_process_completed_stays()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; cnt int := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.swap_proposals
     WHERE kind = 'async'
       AND status IN ('accepted','confirmed')
       AND end_date < CURRENT_DATE
       AND points_awarded_at IS NULL
  LOOP
    PERFORM public.flatch_points_award_stay(r.id);
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END $$;

-- ---- Premium plan: when user upgrades to premium, clear expiry on existing points
CREATE OR REPLACE FUNCTION public.flatch_points_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (NEW.plan = 'premium' AND NEW.status IN ('active','trialing'))
     AND (OLD.plan IS DISTINCT FROM NEW.plan OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.flatch_points_ledger
       SET expires_at = NULL, notified_7=false, notified_30=false, notified_90=false
     WHERE user_id = NEW.user_id AND status='active' AND delta > 0 AND expires_at IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_flatch_plan_change ON public.subscriptions;
CREATE TRIGGER trg_flatch_plan_change
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.flatch_points_on_plan_change();

-- ============================================================
-- 20260720121951_ab2ecf23-7d7f-4c1c-8ed1-c0d71ee7fa96.sql
-- ============================================================

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

-- ============================================================
-- 20260720122248_ba57fd42-61e8-4d4a-98d7-b84e0c954422.sql
-- ============================================================

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

-- ============================================================
-- 20260720122904_0bd50468-703f-4058-bd6e-2dcf56a405f2.sql
-- ============================================================

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

-- ============================================================
-- 20260720124018_fee46c9c-8ca1-4eb7-87a8-3e4302fa5950.sql
-- ============================================================

-- Audit log
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX admin_audit_log_actor_idx ON public.admin_audit_log (actor_id);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_any_admin(auth.uid()));

-- Broadcasts
CREATE TABLE public.admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  title text NOT NULL,
  body text,
  link text,
  recipients_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_broadcasts TO authenticated;
GRANT ALL ON public.admin_broadcasts TO service_role;
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read broadcasts" ON public.admin_broadcasts FOR SELECT TO authenticated
  USING (public.is_any_admin(auth.uid()));

-- Content reports
CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_reports_status_idx ON public.content_reports (status, created_at DESC);
GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users create reports" ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "users read own reports" ON public.content_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.is_any_admin(auth.uid()));
CREATE POLICY "admins update reports" ON public.content_reports FOR UPDATE TO authenticated
  USING (public.is_any_admin(auth.uid())) WITH CHECK (public.is_any_admin(auth.uid()));

CREATE TRIGGER content_reports_updated_at BEFORE UPDATE ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: adjust flatch points (admin)
CREATE OR REPLACE FUNCTION public.flatch_points_admin_adjust(
  _user_id uuid, _delta int, _note text, _actor uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.flatch_points_ledger (user_id, delta, reason, meta)
  VALUES (_user_id, _delta, 'admin_adjust', jsonb_build_object('actor', _actor, 'note', _note))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- ============================================================
-- 20260806131339_598faff3-1668-4025-8a43-0f7f39169e80.sql
-- ============================================================
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
-- ============================================================
-- 20260806131940_e6946082-94cf-4774-a90d-3418ce3dcb54.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_swipe(_property_id uuid, _direction text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _dir swipe_direction;
  _owner uuid;
  _my_prop uuid;
  _match_id uuid;
  _a uuid; _b uuid; _pa uuid; _pb uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _direction NOT IN ('like','pass') THEN
    RAISE EXCEPTION 'Invalid direction: %', _direction;
  END IF;
  _dir := _direction::swipe_direction;

  SELECT owner_id INTO _owner FROM public.properties WHERE id = _property_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  DELETE FROM public.swipes WHERE user_id = _uid AND property_id = _property_id;
  INSERT INTO public.swipes (user_id, property_id, direction)
  VALUES (_uid, _property_id, _dir);

  IF _dir <> 'like' OR _owner = _uid THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  -- Did the property owner already like one of my properties?
  SELECT s.property_id INTO _my_prop
  FROM public.swipes s
  JOIN public.properties p ON p.id = s.property_id
  WHERE s.user_id = _owner
    AND s.direction = 'like'
    AND p.owner_id = _uid
  ORDER BY s.created_at ASC
  LIMIT 1;

  IF _my_prop IS NULL THEN
    RETURN jsonb_build_object('matched', false);
  END IF;

  IF _uid < _owner THEN
    _a := _uid; _b := _owner; _pa := _my_prop; _pb := _property_id;
  ELSE
    _a := _owner; _b := _uid; _pa := _property_id; _pb := _my_prop;
  END IF;

  SELECT id INTO _match_id FROM public.matches
   WHERE property_a = _pa AND property_b = _pb;

  IF _match_id IS NULL THEN
    INSERT INTO public.matches (user_a, user_b, property_a, property_b)
    VALUES (_a, _b, _pa, _pb)
    RETURNING id INTO _match_id;
  END IF;

  RETURN jsonb_build_object('matched', true, 'match_id', _match_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_swipe(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_swipe(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_swipe(uuid, text) TO service_role;
-- ============================================================
-- 20260806132645_3a450187-6cb7-4149-a96b-e12577868d4a.sql
-- ============================================================
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_proposal_id_reviewer_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_proposal_reviewer_property_key
  ON public.reviews (proposal_id, reviewer_id, property_id) NULLS NOT DISTINCT;
