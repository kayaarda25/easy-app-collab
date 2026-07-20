import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminAdjustPoints, adminListUsers, adminUserPointsSummary, getMyAdminRoles } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { ArrowLeft, Coins, Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/points")({
  head: () => ({ meta: [{ title: "Admin · flatch.points — flatch." }] }),
  component: AdminPoints,
});

function AdminPoints() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRoles = useServerFn(getMyAdminRoles);
  const fetchUsers = useServerFn(adminListUsers);
  const fetchSummary = useServerFn(adminUserPointsSummary);
  const adjustFn = useServerFn(adminAdjustPoints);

  const me = useQuery({ queryKey: ["my-admin-roles"], queryFn: () => fetchRoles() });
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");

  const users = useQuery({
    queryKey: ["admin-users-points", q],
    queryFn: () => fetchUsers({ data: { q } }),
    enabled: me.data?.isAdmin === true,
  });
  const summary = useQuery({
    queryKey: ["admin-points-summary", selected],
    queryFn: () => fetchSummary({ data: { user_id: selected! } }),
    enabled: !!selected,
  });

  const adjust = useMutation({
    mutationFn: () => adjustFn({ data: { user_id: selected!, delta: parseInt(delta, 10), note } }),
    onSuccess: () => {
      toast.success("Gutschrift/Abzug gebucht");
      setDelta(""); setNote("");
      qc.invalidateQueries({ queryKey: ["admin-points-summary"] });
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
        <Coins className="h-5 w-5" />
        <h1 className="text-lg font-bold">flatch.points</h1>
      </header>

      <div className="border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="User suchen…" className="w-full bg-transparent text-sm outline-none" />
        </div>
      </div>

      {!selected && (
        <div className="divide-y divide-border">
          {(users.data ?? []).slice(0, 30).map((u: any) => (
            <button key={u.id} onClick={() => setSelected(u.id)} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-secondary/40">
              <div className="h-9 w-9 rounded-full bg-secondary" />
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold">{u.display_name ?? "—"}</p>
                <p className="text-[11px] text-muted-foreground">{u.city ?? u.id.slice(0, 8)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="p-4">
          <button onClick={() => setSelected(null)} className="mb-3 text-xs text-primary">← andere Person</button>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Aktueller Saldo</p>
            <p className="text-3xl font-bold">{summary.data?.available ?? "…"} <span className="text-sm text-muted-foreground">P</span></p>
          </div>

          <div className="mt-4 space-y-2">
            <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="Delta (+ oder -)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Grund / Notiz" rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <button
              disabled={!delta || !note || adjust.isPending}
              onClick={() => adjust.mutate()}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {adjust.isPending ? "Buche…" : "Buchen"}
            </button>
          </div>

          <h3 className="mt-6 mb-2 text-xs font-semibold uppercase text-muted-foreground">Verlauf</h3>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {(summary.data?.ledger ?? []).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-xs font-semibold">{l.reason}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleString()} · {l.status}</p>
                </div>
                <p className={`text-sm font-bold ${l.delta > 0 ? "text-green-500" : "text-red-500"}`}>{l.delta > 0 ? "+" : ""}{l.delta}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}