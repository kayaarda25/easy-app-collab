
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
