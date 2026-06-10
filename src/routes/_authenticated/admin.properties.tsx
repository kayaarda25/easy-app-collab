import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { isAdmin, listPropertiesForReview, reviewProperty } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Flag, X, Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/properties")({
  head: () => ({ meta: [{ title: "Admin · Properties — flatch." }] }),
  component: AdminPropertiesPage,
});

const TABS = ["pending", "flagged", "approved", "rejected", "all"] as const;
type Tab = (typeof TABS)[number];

function AdminPropertiesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const checkAdmin = useServerFn(isAdmin);
  const fetchList = useServerFn(listPropertiesForReview);
  const reviewFn = useServerFn(reviewProperty);

  const admin = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin() });
  const [tab, setTab] = useState<Tab>("pending");
  const list = useQuery({
    queryKey: ["admin-properties", tab],
    queryFn: () => fetchList({ data: { status: tab } }),
    enabled: admin.data === true,
  });

  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const decide = useMutation({
    mutationFn: (vars: { id: string; decision: "approved" | "rejected" | "flagged" | "pending"; notes?: string }) =>
      reviewFn({ data: { property_id: vars.id, decision: vars.decision, notes: vars.notes || null } }),
    onSuccess: (_d, vars) => {
      toast.success(`Marked as ${vars.decision}`);
      qc.invalidateQueries({ queryKey: ["admin-properties"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (admin.isLoading) {
    return (
      <PageShell>
        <div className="px-6 pt-8 text-sm text-muted-foreground">Checking access...</div>
      </PageShell>
    );
  }
  if (admin.data !== true) {
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

  return (
    <PageShell>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate({ to: "/profile" })} className="rounded-full p-1.5 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Property review</h1>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-4 pb-12">
        {list.isLoading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        ) : (list.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          (list.data ?? []).map((p: any) => (
            <article key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex gap-3 p-3">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                  {p.property_images?.[0]?.url && (
                    <img src={p.property_images[0].url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.city}, {p.country}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    by {p.owner?.display_name ?? p.owner_id.slice(0, 8)}
                  </p>
                </div>
              </div>
              {p.description && (
                <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{p.description}</p>
              )}
              {(p.house_rules || p.check_in_instructions || p.check_out_instructions) && (
                <div className="border-t border-border px-3 py-2 text-xs">
                  {p.house_rules && <p><span className="font-semibold">Rules:</span> {p.house_rules}</p>}
                  {p.check_in_instructions && <p><span className="font-semibold">Check-in:</span> {p.check_in_instructions}</p>}
                  {p.check_out_instructions && <p><span className="font-semibold">Check-out:</span> {p.check_out_instructions}</p>}
                </div>
              )}
              {p.review_notes && (
                <p className="border-t border-border bg-muted/40 px-3 py-2 text-xs">
                  <span className="font-semibold">Previous notes:</span> {p.review_notes}
                </p>
              )}
              <div className="border-t border-border p-3 space-y-2">
                <Textarea
                  rows={2}
                  placeholder="Review notes (optional, visible to owner)"
                  value={notesById[p.id] ?? ""}
                  onChange={(e) => setNotesById((s) => ({ ...s, [p.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => decide.mutate({ id: p.id, decision: "approved", notes: notesById[p.id] })}>
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: p.id, decision: "rejected", notes: notesById[p.id] })}>
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: p.id, decision: "flagged", notes: notesById[p.id] })}>
                    <Flag className="h-3.5 w-3.5" /> Flag
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </PageShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700",
    approved: "bg-emerald-500/15 text-emerald-700",
    rejected: "bg-destructive/15 text-destructive",
    flagged: "bg-rose-500/15 text-rose-700",
    draft: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="secondary" className={`px-1.5 py-0 text-[10px] capitalize ${color[status] ?? ""}`}>
      {status}
    </Badge>
  );
}