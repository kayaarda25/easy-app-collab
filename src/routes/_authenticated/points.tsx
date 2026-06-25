import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyPointsBalance, getMyPointsHistory } from "@/lib/points.functions";
import { PageShell } from "@/components/BottomNav";
import { ArrowLeft, Coins, Gift, Hourglass, Info, TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/points")({
  head: () => ({ meta: [{ title: "flatch.points — flatch." }] }),
  component: PointsPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">Failed to load: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

function reasonLabel(r: string): { label: string; positive: boolean } {
  const map: Record<string, { label: string; positive: boolean }> = {
    earned_stay: { label: "Earned from stay", positive: true },
    premium_bonus: { label: "Premium bonus", positive: true },
    redeemed_stay: { label: "Spent on stay", positive: false },
    hold: { label: "Reserved for booking", positive: false },
    hold_release: { label: "Reservation released", positive: true },
    refund: { label: "Refund", positive: true },
    expired: { label: "Expired", positive: false },
    admin_adjust: { label: "Adjustment", positive: true },
  };
  return map[r] ?? { label: r, positive: true };
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function PointsPage() {
  const router = useRouter();
  const balanceFn = useServerFn(getMyPointsBalance);
  const historyFn = useServerFn(getMyPointsHistory);
  const balance = useQuery({ queryKey: ["points-balance"], queryFn: () => balanceFn() });
  const history = useQuery({ queryKey: ["points-history"], queryFn: () => historyFn() });

  const b = balance.data;
  const plan = b?.effectivePlan ?? "basic";
  const isBasic = plan === "basic";

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <button onClick={() => router.history.back()} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="rounded-3xl bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-orange-500/20 p-6 ring-1 ring-amber-500/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">
                Your balance
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <Coins className="h-8 w-8 text-amber-600" />
                <span className="text-5xl font-bold tracking-tight">{b?.available ?? 0}</span>
                <span className="text-lg font-medium text-muted-foreground">flatch.points</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                1 point = 1 night. Plan: <span className="font-semibold capitalize">{plan}</span>
              </p>
            </div>
          </div>

          {b?.nextExpiringAt && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1.5 text-xs">
              <Hourglass className="h-3.5 w-3.5 text-amber-600" />
              {b.nextExpiringAmount} pts expire on {fmtDate(b.nextExpiringAt)}
            </div>
          )}
        </div>

        {isBasic && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-border bg-secondary/40 p-4 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Upgrade to start collecting</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                flatch.points let you swap homes asynchronously — you don't need to swap at the same time.
                Available on Standard & Premium plans.
              </p>
              <Link to="/paywall" className="mt-2 inline-block rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                See plans
              </Link>
            </div>
          </div>
        )}

        {plan === "premium" && !b?.bonusClaimed && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold">Premium bonus available</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Host 7 nights successfully and receive an extra +7 flatch.points — once per account.
              </p>
            </div>
          </div>
        )}

        <h2 className="mt-8 mb-3 text-lg font-bold">History</h2>
        <div className="rounded-2xl border border-border bg-card">
          {history.isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {history.data && history.data.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No transactions yet.</div>
          )}
          <ul className="divide-y divide-border">
            {(history.data ?? []).map((h) => {
              const meta = reasonLabel(h.reason as string);
              const isPositive = h.delta > 0;
              const dimmed = h.status !== "active";
              return (
                <li key={h.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${dimmed ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(h.created_at)}
                      {h.status !== "active" && <span className="ml-1.5 capitalize">· {h.status}</span>}
                      {h.expires_at && h.status === "active" && (
                        <span className="ml-1.5">· expires {fmtDate(h.expires_at)}</span>
                      )}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-bold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                    {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {isPositive ? "+" : ""}
                    {h.delta}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </PageShell>
  );
}