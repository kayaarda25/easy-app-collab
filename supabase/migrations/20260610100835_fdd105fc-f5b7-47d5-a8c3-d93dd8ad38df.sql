
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
