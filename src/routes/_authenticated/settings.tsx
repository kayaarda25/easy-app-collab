import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, isAdmin } from "@/lib/flatch.functions";
import { getMyEntitlement } from "@/lib/subscription.functions";
import { PLAN_INFO } from "@/lib/subscription";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/BottomNav";
import {
  Bell,
  ChevronRight,
  Crown,
  Globe,
  LogOut,
  Shield,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { VerificationChecklist } from "@/components/VerificationBadges";
import { SUPPORTED_LANGUAGES, useLanguage } from "@/lib/language";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — flatch." }] }),
  component: SettingsPage,
});

function Row({
  icon: Icon,
  title,
  subtitle,
  onClick,
  destructive,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border p-4 text-left last:border-b-0 hover:bg-secondary/50"
    >
      <Icon className={`h-5 w-5 ${destructive ? "text-destructive" : "text-primary"}`} />
      <div className="flex-1">
        <p className={`text-sm font-semibold ${destructive ? "text-destructive" : ""}`}>{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchEnt = useServerFn(getMyEntitlement);
  const checkAdmin = useServerFn(isAdmin);
  const [lang, setLang] = useLanguage();
  const { t } = useT();

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const ent = useQuery({ queryKey: ["entitlement"], queryFn: () => fetchEnt() });
  const admin = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin() });

  const verificationSource = {
    email_verified_at: profile.data?.email_verified_at,
    phone_verified_at: profile.data?.phone_verified_at,
    identity_verified_at: profile.data?.identity_verified_at,
    trusted_host: profile.data?.trusted_host,
    plan: ent.data?.effectivePlan,
    hasVerifiedProperty: false,
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  };

  return (
    <PageShell>
      <header className="px-6 pt-8 pb-2">
        <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
      </header>

      <section className="mt-4 px-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("settings.account")}
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Row
            icon={UserIcon}
            title={t("settings.editProfile")}
            subtitle={t("settings.editProfileSub")}
            onClick={() => navigate({ to: "/profile" })}
          />
          <Row
            icon={Crown}
            title={`${PLAN_INFO[ent.data?.effectivePlan ?? "basic"].name} ${t("settings.plan")}`}
            subtitle={
              ent.data?.effectivePlan === "basic"
                ? t("settings.upgrade")
                : `${t("settings.status")}: ${t(ent.data?.status ?? "active")}`
            }
            onClick={() => navigate({ to: "/paywall" })}
          />
          <Row
            icon={Bell}
            title={t("settings.notifications")}
            subtitle={t("settings.notificationsSub")}
            onClick={() => navigate({ to: "/notifications" })}
          />
        </div>
      </section>

      <section className="mt-6 px-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("settings.security")}
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border last:border-b-0">
            <TwoFactorSetup />
          </div>
        </div>
      </section>

      <section className="mt-6 px-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("settings.trust")}
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <VerificationChecklist source={verificationSource} />
        </div>
      </section>

      {admin.data === true && (
        <section className="mt-6 px-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("settings.admin")}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Row
              icon={Shield}
              title={t("settings.adminDash")}
              subtitle={t("settings.adminDashSub")}
              onClick={() => navigate({ to: "/admin" })}
            />
          </div>
        </section>
      )}

      <section className="mt-6 px-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("settings.preferences")}
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-3 p-4">
            <Globe className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{t("settings.language")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.languageSub")}</p>
            </div>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as typeof lang)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 border-t border-border p-4 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> {t("settings.privacy")}
          </div>
        </div>
      </section>

      <section className="mt-6 px-6 pb-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 p-4 text-left hover:bg-secondary/50"
          >
            <LogOut className="h-5 w-5 text-destructive" />
            <span className="text-sm font-semibold text-destructive">{t("settings.signOut")}</span>
          </button>
        </div>
      </section>
    </PageShell>
  );
}