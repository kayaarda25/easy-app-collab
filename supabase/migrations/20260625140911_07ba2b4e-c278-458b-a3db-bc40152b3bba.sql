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
