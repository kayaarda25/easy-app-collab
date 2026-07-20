import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminListAuditLog, getMyAdminRoles } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { ArrowLeft, ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Admin · Audit — flatch." }] }),
  component: AdminAudit,
});

function AdminAudit() {
  const navigate = useNavigate();
  const fetchRoles = useServerFn(getMyAdminRoles);
  const fetchList = useServerFn(adminListAuditLog);
  const me = useQuery({ queryKey: ["my-admin-roles"], queryFn: () => fetchRoles() });
  const list = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => fetchList(),
    enabled: me.data?.isAdmin === true,
  });

  if (me.data && !me.data.isAdmin) {
    return <PageShell><div className="px-6 pt-8 text-sm">Admins only</div></PageShell>;
  }

  return (
    <PageShell>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate({ to: "/admin" })} className="rounded-full p-1.5 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <ScrollText className="h-5 w-5" />
        <h1 className="text-lg font-bold">Audit Log</h1>
      </header>
      <div className="divide-y divide-border">
        {(list.data ?? []).map((row: any) => (
          <div key={row.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{row.action}</p>
              <p className="text-[10px] text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              by {row.actor?.display_name ?? row.actor_id.slice(0, 8)}
              {row.target_type && ` · ${row.target_type}:${row.target_id?.slice(0, 8)}`}
            </p>
            {row.meta && (
              <pre className="mt-1 overflow-x-auto rounded bg-secondary/40 p-2 text-[10px]">{JSON.stringify(row.meta, null, 2)}</pre>
            )}
          </div>
        ))}
        {list.data && list.data.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Noch keine Einträge.</div>
        )}
      </div>
    </PageShell>
  );
}