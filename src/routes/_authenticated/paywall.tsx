import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, Crown, ArrowLeft, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/BottomNav";
import { PLAN_INFO, type PlanId } from "@/lib/subscription";
import { getMyEntitlement } from "@/lib/subscription.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/paywall")({
  head: () => ({ meta: [{ title: "Plans — flatch." }] }),
  component: PaywallPage,
});

function PaywallPage() {
  const navigate = useNavigate();
  const fetchEnt = useServerFn(getMyEntitlement);
  const ent = useQuery({ queryKey: ["entitlement"], queryFn: () => fetchEnt() });

  const isNative = typeof window !== "undefined" && /Capacitor/i.test((window as any).Capacitor?.platform ?? "");

  const handlePurchase = (planId: PlanId) => {
    if (!isNative) {
      toast.info("Subscriptions are available in the iOS & Android app", {
        description: "Download flatch. from the App Store or Google Play to upgrade.",
      });
      return;
    }
    toast.info(`Starting ${planId} purchase via App Store…`);
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
        <h1 className="text-2xl font-bold">Choose your plan</h1>
      </header>

      <p className="px-6 pt-2 text-sm text-muted-foreground">
        Upgrade for more homes, more swipes, and member perks.
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
                  <Crown className="h-3 w-3" /> Most popular
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
                disabled={isCurrent || id === "basic"}
                onClick={() => handlePurchase(id)}
                className={`mt-5 w-full rounded-full py-3 text-sm font-semibold transition ${
                  isCurrent
                    ? "bg-secondary text-muted-foreground"
                    : id === "basic"
                      ? "bg-secondary text-muted-foreground"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {isCurrent ? "Current plan" : id === "basic" ? "Free" : `Upgrade to ${info.name}`}
              </button>
            </div>
          );
        })}

        {ent.data && ent.data.plan !== "basic" && (
          <button
            onClick={manageSubscription}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-semibold"
          >
            Manage subscription <ExternalLink className="h-4 w-4" />
          </button>
        )}

        <p className="px-2 pt-2 text-center text-[11px] text-muted-foreground">
          Purchases are processed via the App Store / Google Play. Subscriptions auto-renew until cancelled in your store account.
        </p>
      </div>
    </PageShell>
  );
}