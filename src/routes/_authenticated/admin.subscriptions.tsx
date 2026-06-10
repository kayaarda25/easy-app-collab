import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminListSubscriptions, getMyAdminRoles } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { ArrowLeft, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  head: () => ({ meta: [{ title: "Admin · Subscriptions — flatch." }] }),
  component: AdminSubs,
});

function AdminSubs() {
  const navigate = useNavigate();
  const fetchRoles = useServerFn(getMyAdminRoles);
  const fetchList = useServerFn(adminListSubscriptions);
  const me = useQuery({ queryKey: ["my-admin-roles"], queryFn: () => fetchRoles() });
  const list = useQuery({
    queryKey: ["admin-subs"],
    queryFn: () => fetchList(),
    enabled: me.data?.isAdmin === true,
    retry: false,
  });

  if (!me.data?.isAdmin) {
    return <PageShell><div className="px-6 pt-8 text-sm text-muted-foreground">Checking access…</div></PageShell>;
  }

  return (
    <PageShell>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate({ to: "/admin" })} className="rounded-full p-1.5 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Subscriptions</h1>
      </header>
      <div className="space-y-3 px-4 py-4 pb-12">
        {list.isError ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            <Lock className="mx-auto mb-2 h-5 w-5" />
            Finance role required.
          </div>
        ) : list.isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        ) : (list.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No subscriptions.</p>
        ) : (
          (list.data ?? []).map((s: any) => (
            <article key={s.user_id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                {s.profile?.avatar_url && <img src={s.profile.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.profile?.display_name ?? s.user_id.slice(0, 8)}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {s.store} · {s.entitlement ?? "—"}
                  {s.expires_at && ` · until ${new Date(s.expires_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="secondary" className="capitalize">{s.plan}</Badge>
                <Badge variant="secondary" className="text-[10px] capitalize">{s.status}</Badge>
              </div>
            </article>
          ))
        )}
      </div>
    </PageShell>
  );
}