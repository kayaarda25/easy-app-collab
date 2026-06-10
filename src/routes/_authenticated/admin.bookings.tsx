import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminListBookings, adminUpdateBookingStatus, getMyAdminRoles } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const TABS = ["all", "pending", "accepted", "confirmed", "rejected", "cancelled"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  head: () => ({ meta: [{ title: "Admin · Bookings — flatch." }] }),
  component: AdminBookings,
});

function AdminBookings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRoles = useServerFn(getMyAdminRoles);
  const fetchList = useServerFn(adminListBookings);
  const updateFn = useServerFn(adminUpdateBookingStatus);

  const me = useQuery({ queryKey: ["my-admin-roles"], queryFn: () => fetchRoles() });
  const [tab, setTab] = useState<Tab>("all");
  const list = useQuery({
    queryKey: ["admin-bookings", tab],
    queryFn: () => fetchList({ data: { status: tab } }),
    enabled: me.data?.isAdmin === true,
  });

  const update = useMutation({
    mutationFn: (v: { proposal_id: string; status: "pending" | "accepted" | "confirmed" | "rejected" | "cancelled" }) => updateFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-bookings"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
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
        <h1 className="text-lg font-bold">Bookings</h1>
      </header>
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-3 px-4 pb-12">
        {list.isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        ) : (list.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          (list.data ?? []).map((p: any) => (
            <article key={p.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {new Date(p.start_date).toLocaleDateString()} – {new Date(p.end_date).toLocaleDateString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    by {p.proposer?.display_name ?? p.proposer_id.slice(0, 8)} · {p.guests} guests
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize">{p.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(["pending","accepted","confirmed","rejected","cancelled"] as const).map((s) => (
                  <button
                    key={s}
                    disabled={p.status === s}
                    onClick={() => update.mutate({ proposal_id: p.id, status: s })}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition disabled:opacity-40 ${p.status === s ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                  >
                    → {s}
                  </button>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </PageShell>
  );
}