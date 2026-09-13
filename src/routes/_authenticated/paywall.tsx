import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Crown, ArrowLeft, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/BottomNav";
import { PLAN_INFO, type PlanId } from "@/lib/subscription";
import { getMyEntitlement } from "@/lib/subscription.functions";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { isNativeApp, purchasePlan, restorePurchases } from "@/lib/revenuecat";

export const Route = createFileRoute("/_authenticated/paywall")({
  head: () => ({ meta: [{ title: "Plans — flatch." }] }),
  component: PaywallPage,
});

function PaywallPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const fetchEnt = useServerFn(getMyEntitlement);
  const ent = useQuery({ queryKey: ["entitlement"], queryFn: () => fetchEnt() });

  const [isNative, setIsNative] = useState(false);
  const [busy, setBusy] = useState<PlanId | "restore" | null>(null);
  useEffect(() => {
    setIsNative(isNativeApp());
  }, []);

  const handlePurchase = async (planId: PlanId) => {
    if (planId === "basic") return;
    if (!isNative) {
      toast.info(t("Subscriptions are available in the iOS & Android app"), {
        description: t("Download flatch. from the App Store or Google Play to upgrade."),
      });
      return;
    }
    setBusy(planId);
    try {
      const result = await purchasePlan(planId as "standard" | "premium");
      if (result === "success") {
        toast.success(t("Willkommen im Upgrade!"), {
          description: t("Dein Abo wird aktiviert – das kann einen Moment dauern."),
        });
        setTimeout(() => ent.refetch(), 4000);
      } else if (result === "cancelled") {
        toast.info(t("Kauf abgebrochen"));
      } else if (result === "unavailable") {
        toast.error(t("Abo derzeit nicht verfügbar"), {
          description: t("Bitte versuche es später erneut."),
        });
      } else {
        toast.error(t("Kauf fehlgeschlagen"), { description: t("Bitte versuche es erneut.") });
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    setBusy("restore");
    try {
      const result = await restorePurchases();
      if (result === "restored") {
        toast.success(t("Käufe wiederhergestellt"));
        setTimeout(() => ent.refetch(), 4000);
      } else if (result === "nothing") {
        toast.info(t("Keine aktiven Käufe gefunden"));
      } else {
        toast.error(t("Wiederherstellung fehlgeschlagen"));
      }
    } finally {
      setBusy(null);
    }
  };

  const manageSubscription = () => {
    const ua = navigator.userAgent;
    const url = /iPhone|iPad|iPod/i.test(ua)
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions";
    window.open(url, "_blank");
  };

  const currentPlan = ent.data?.effectivePlan ?? "basic";
  const plans: PlanId[] = ["basic", "standard", "premium"];

  return (
    <PageShell>
      <header className="flex items-center gap-3 px-6 pt-8">
        <button onClick={() => navigate({ to: "/profile" })} className="rounded-full p-2 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">{t("Choose your plan")}</h1>
      </header>

      <p className="px-6 pt-2 text-sm text-muted-foreground">
        {t("Upgrade for more homes, more swipes, and member perks.")}
      </p>

      <div className="space-y-4 px-6 pt-6 pb-6">
        {plans.map((id) => {
          const info = PLAN_INFO[id];
          const isCurrent = currentPlan === id;
          const isPremium = id === "premium";
          return (
            <div
              key={id}
              className={`relative rounded-3xl border p-5 ${
                isPremium ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              {isPremium && (
                <div className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                  <Crown className="h-3 w-3" /> {t("Most popular")}
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-bold">{info.name}</h2>
                <span className="text-lg font-semibold">{info.price}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{info.tagline}</p>
              <ul className="mt-4 space-y-2">
                {info.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <button
                disabled={isCurrent || id === "basic" || busy !== null}
                onClick={() => handlePurchase(id)}
                className={`mt-5 w-full rounded-full py-3 text-sm font-semibold transition ${
                  isCurrent
                    ? "bg-secondary text-muted-foreground"
                    : id === "basic"
                      ? "bg-secondary text-muted-foreground"
                      : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
                }`}
              >
                {busy === id
                  ? t("Wird verarbeitet…")
                  : isCurrent
                    ? t("Current plan")
                    : id === "basic"
                      ? t("Free")
                      : `${t("Upgrade to")} ${info.name}`}
              </button>
            </div>
          );
        })}

        {isNative && (
          <button
            onClick={handleRestore}
            disabled={busy !== null}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-semibold disabled:opacity-60"
          >
            {busy === "restore" ? t("Wird geprüft…") : t("Käufe wiederherstellen")}
          </button>
        )}

        {ent.data && ent.data.plan !== "basic" && (
          <button
            onClick={manageSubscription}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-semibold"
          >
            {t("Manage subscription")} <ExternalLink className="h-4 w-4" />
          </button>
        )}

        <p className="px-2 pt-2 text-center text-[11px] text-muted-foreground">
          {t("Purchases are processed via the App Store / Google Play. Subscriptions auto-renew until cancelled in your store account.")}
        </p>
      </div>
    </PageShell>
  );
}