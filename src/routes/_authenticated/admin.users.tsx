import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminListUsers, adminSetTrustedHost, adminSetUserRole, getMyAdminRoles } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { ArrowLeft, Search as SearchIcon, ShieldCheck, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ADMIN_ROLES = ["admin", "super_admin", "support", "operations", "finance"] as const;
type Role = (typeof ADMIN_ROLES)[number];

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Admin · Users — flatch." }] }),
  component: AdminUsers,
});

function AdminUsers() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRoles = useServerFn(getMyAdminRoles);
  const fetchList = useServerFn(adminListUsers);
  const setRoleFn = useServerFn(adminSetUserRole);
  const setTrustedFn = useServerFn(adminSetTrustedHost);

  const me = useQuery({ queryKey: ["my-admin-roles"], queryFn: () => fetchRoles() });
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["admin-users", q],
    queryFn: () => fetchList({ data: { q: q || undefined } }),
    enabled: me.data?.isAdmin === true,
  });

  const toggleRole = useMutation({
    mutationFn: (v: { user_id: string; role: Role; action: "add" | "remove" }) => setRoleFn({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const toggleTrusted = useMutation({
    mutationFn: (v: { user_id: string; trusted: boolean }) => setTrustedFn({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (!me.data?.isAdmin) {
    return (
      <PageShell>
        <div className="px-6 pt-8 text-sm text-muted-foreground">Checking access…</div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate({ to: "/admin" })} className="rounded-full p-1.5 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Users</h1>
      </header>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-full bg-secondary px-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or city…"
            className="flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </div>
      </div>
      <div className="space-y-3 px-4 pb-12">
        {list.isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        ) : (list.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No users.</p>
        ) : (
          (list.data ?? []).map((u: any) => (
            <article key={u.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                  {u.avatar_url && <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{u.display_name ?? "Unnamed"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[u.city, u.country].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                {u.trusted_host ? (
                  <Badge variant="secondary" className="gap-1 bg-emerald-500/15 text-emerald-700"><ShieldCheck className="h-3 w-3" /> trusted</Badge>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {u.subscription?.plan && u.subscription.plan !== "basic" && (
                  <Badge variant="secondary" className="text-[10px] capitalize">{u.subscription.plan}</Badge>
                )}
                {u.email_verified_at && <Badge variant="secondary" className="text-[10px]">email ✓</Badge>}
                {u.phone_verified_at && <Badge variant="secondary" className="text-[10px]">phone ✓</Badge>}
                {u.identity_verified_at && <Badge variant="secondary" className="text-[10px]">id ✓</Badge>}
                {(u.roles ?? []).map((r: string) => (
                  <Badge key={r} variant="secondary" className="bg-primary/10 text-primary text-[10px]">{r}</Badge>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ADMIN_ROLES.map((r) => {
                  const has = (u.roles ?? []).includes(r);
                  return (
                    <button
                      key={r}
                      disabled={!me.data?.isSuper}
                      onClick={() => toggleRole.mutate({ user_id: u.id, role: r, action: has ? "remove" : "add" })}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition disabled:opacity-50 ${
                        has ? "bg-primary text-primary-foreground" : "bg-secondary"
                      }`}
                    >
                      {has ? "− " : "+ "}
                      {r}
                    </button>
                  );
                })}
                <button
                  onClick={() => toggleTrusted.mutate({ user_id: u.id, trusted: !u.trusted_host })}
                  className="ml-auto inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold"
                >
                  {u.trusted_host ? <ShieldOff className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                  {u.trusted_host ? "Untrust" : "Mark trusted"}
                </button>
              </div>
              {!me.data?.isSuper && (
                <p className="mt-2 text-[10px] text-muted-foreground">Role changes require super_admin.</p>
              )}
            </article>
          ))
        )}
      </div>
    </PageShell>
  );
}