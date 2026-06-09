
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
