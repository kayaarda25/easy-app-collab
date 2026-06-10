import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminListMatches, getMyAdminRoles } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/matches")({
  head: () => ({ meta: [{ title: "Admin · Matches — flatch." }] }),
  component: AdminMatches,
});

function AdminMatches() {
  const navigate = useNavigate();
  const fetchRoles = useServerFn(getMyAdminRoles);
  const fetchList = useServerFn(adminListMatches);
  const me = useQuery({ queryKey: ["my-admin-roles"], queryFn: () => fetchRoles() });
  const list = useQuery({
    queryKey: ["admin-matches"],
    queryFn: () => fetchList({ data: {} }),
    enabled: me.data?.isAdmin === true,
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
        <h1 className="text-lg font-bold">Matches</h1>
      </header>
      <div className="space-y-3 px-4 py-4 pb-12">
        {list.isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        ) : (list.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No matches.</p>
        ) : (
          (list.data ?? []).map((m: any) => (
            <article key={m.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold">{m.user_a_profile?.display_name ?? m.user_a.slice(0, 6)}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-semibold">{m.user_b_profile?.display_name ?? m.user_b.slice(0, 6)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div className="rounded-lg bg-secondary p-2">
                  <p className="font-semibold text-foreground">{m.property_a_info?.title ?? "—"}</p>
                  <p>{[m.property_a_info?.city, m.property_a_info?.country].filter(Boolean).join(", ")}</p>
                </div>
                <div className="rounded-lg bg-secondary p-2">
                  <p className="font-semibold text-foreground">{m.property_b_info?.title ?? "—"}</p>
                  <p>{[m.property_b_info?.city, m.property_b_info?.country].filter(Boolean).join(", ")}</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {new Date(m.created_at).toLocaleString()}
              </p>
            </article>
          ))
        )}
      </div>
    </PageShell>
  );
}