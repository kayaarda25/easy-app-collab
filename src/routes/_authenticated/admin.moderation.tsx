import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminListReports, adminResolveReport, getMyAdminRoles } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { ArrowLeft, ShieldAlert, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/moderation")({
  head: () => ({ meta: [{ title: "Admin · Moderation — flatch." }] }),
  component: AdminModeration;
});

function AdminModeration() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRoles = useServerFn(getMyAdminRoles);
  const fetchList = useServerFn(adminListReports);
  const resolveFn = useServerFn(adminResolveReport);
  const [status, setStatus] = useState<"open" | "resolved" | "dismissed" | "all">("open");

  const me = useQuery({ queryKey: ["my-admin-roles"], queryFn: () => fetchRoles() });
  const list = useQuery({
    queryKey: ["admin-reports", status],
    queryFn: () => fetchList({ data: { status } }),
    enabled: me.data?.isAdmin === true,
  });

  const act = useMutation({
    mutationFn: (v: { report_id: string; action: "resolve" | "dismiss" | "delete_content" }) =>
      resolveFn({ data: v }),
    onSuccess: () => {
      toast.success("Erledigt");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });

  if (me.data && !me.data.isAdmin) return <PageShell><div className="px-6 pt-8">Admins only</div></PageShell>;

  return (
    <PageShell>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate({ to: "/admin" })} className="rounded-full p-1.5 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <ShieldAlert className="h-5 w-5" />
        <h1 className="text-lg font-bold">Moderation</h1>
      </header>

      <div className="flex gap-2 border-b border-border px-4 py-2 text-xs">
        {(["open", "resolved", "dismissed", "all"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 ${status === s ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="divide-y divide-border">
        {(list.data ?? []).map((r: any) => (
          <div key={r.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{r.target_type} · {r.reason}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.status === "open" ? "bg-yellow-500/20" : r.status === "resolved" ? "bg-green-500/20" : "bg-secondary"}`}>{r.status}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Ziel: {r.target_id?.slice(0, 12)}… · von {r.reporter?.display_name ?? "—"}</p>
            {r.details && <p className="mt-1 text-xs">{r.details}</p>}
            {r.status === "open" && (
              <div className="mt-2 flex gap-2">
                <button onClick={() => act.mutate({ report_id: r.id, action: "resolve" })} className="flex items-center gap-1 rounded-full bg-green-600/20 px-3 py-1 text-[11px] text-green-500"><Check className="h-3 w-3" />Resolve</button>
                <button onClick={() => act.mutate({ report_id: r.id, action: "delete_content" })} className="flex items-center gap-1 rounded-full bg-red-600/20 px-3 py-1 text-[11px] text-red-500"><Trash2 className="h-3 w-3" />Löschen</button>
                <button onClick={() => act.mutate({ report_id: r.id, action: "dismiss" })} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[11px]"><X className="h-3 w-3" />Ablehnen</button>
              </div>
            )}
          </div>
        ))}
        {list.data && list.data.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Keine Meldungen.</div>
        )}
      </div>
    </PageShell>
  );
}