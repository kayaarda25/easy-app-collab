
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
