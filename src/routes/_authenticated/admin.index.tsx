import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminStats, getMyAdminRoles } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { ArrowLeft, Building2, Users, Heart, Calendar, ShieldCheck, CreditCard, BarChart3, Shield, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — flatch." }] }),
  component: AdminHub,
});

function AdminHub() {
  const navigate = useNavigate();
  const fetchRoles = useServerFn(getMyAdminRoles);
  const fetchStats = useServerFn(getAdminStats);

  const roles = useQuery({ queryKey: ["my-admin-roles"], queryFn: () => fetchRoles() });
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats(),
    enabled: roles.data?.isAdmin === true,
  });

  if (roles.isLoading) {
    return (
      <PageShell>
        <div className="px-6 pt-8 text-sm text-muted-foreground">Checking access…</div>
      </PageShell>
    );
  }
  if (!roles.data?.isAdmin) {
    return (
      <PageShell>
        <div className="px-6 pt-12 text-center">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-3 text-xl font-bold">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have access to this page.</p>
          <button onClick={() => navigate({ to: "/home" })} className="mt-4 rounded-full bg-secondary px-4 py-2 text-sm font-semibold">
            Back home
          </button>
        </div>
      </PageShell>
    );
  }

  const s = stats.data;
  const tiles = [
    { label: "Users", value: s?.users, sub: s ? `+${s.newUsers7d} last 7d` : "", icon: Users, to: "/admin/users" as const },
    { label: "Properties", value: s?.properties, sub: s ? `${s.propertiesPending} pending · ${s.propertiesFlagged} flagged` : "", icon: Building2, to: "/admin/properties" as const },
    { label: "Matches", value: s?.matches, sub: "", icon: Heart, to: "/admin/matches" as const },
    { label: "Bookings", value: s?.proposals, sub: s ? `${s.swapsConfirmed} confirmed` : "", icon: Calendar, to: "/admin/bookings" as const },
    { label: "Truvi", value: "—", sub: "Verification & trust", icon: ShieldCheck, to: "/admin/truvi" as const },
    { label: "Subscriptions", value: s?.subsActive, sub: "Active paid plans", icon: CreditCard, to: "/admin/subscriptions" as const },
  ];

  return (
    <PageShell>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate({ to: "/settings" })} className="rounded-full p-1.5 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Admin</h1>
          <p className="text-[11px] text-muted-foreground">
            Roles: {roles.data.roles.length === 0 ? "—" : roles.data.roles.join(" · ")}
          </p>
        </div>
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
      </header>

      <section className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <button
              key={t.label}
              onClick={() => navigate({ to: t.to })}
              className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary"
            >
              <t.icon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{t.value ?? "—"}</p>
                <p className="text-xs font-semibold">{t.label}</p>
                {t.sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{t.sub}</p>}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="px-4 pb-12">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Engagement</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Stat icon={Star} label="Reviews" value={s?.reviews ?? "—"} />
        </div>
      </section>
    </PageShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="flex-1 text-sm">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}