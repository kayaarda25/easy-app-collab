
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
