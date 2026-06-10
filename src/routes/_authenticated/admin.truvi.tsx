import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminListVerifications, adminSetTrustedHost, getMyAdminRoles } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { ArrowLeft, Mail, Phone, Fingerprint, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/truvi")({
  head: () => ({ meta: [{ title: "Admin · Truvi — flatch." }] }),
  component: AdminTruvi,
});

function AdminTruvi() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRoles = useServerFn(getMyAdminRoles);
  const fetchList = useServerFn(adminListVerifications);
  const setTrustedFn = useServerFn(adminSetTrustedHost);

  const me = useQuery({ queryKey: ["my-admin-roles"], queryFn: () => fetchRoles() });
  const list = useQuery({
    queryKey: ["admin-truvi"],
    queryFn: () => fetchList(),
    enabled: me.data?.isAdmin === true,
  });

  const toggle = useMutation({
    mutationFn: (v: { user_id: string; trusted: boolean }) => setTrustedFn({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-truvi"] }); },
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
        <h1 className="text-lg font-bold">Truvi — Verification</h1>
      </header>
      <div className="space-y-3 px-4 py-4 pb-12">
        {list.isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        ) : (list.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          (list.data ?? []).map((u: any) => (
            <article key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                {u.avatar_url && <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{u.display_name ?? "Unnamed"}</p>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                  <Chip ok={!!u.email_verified_at} icon={Mail} label="email" />
                  <Chip ok={!!u.phone_verified_at} icon={Phone} label="phone" />
                  <Chip ok={!!u.identity_verified_at} icon={Fingerprint} label="identity" />
                  {u.trusted_host && <Chip ok icon={ShieldCheck} label="trusted host" />}
                </div>
              </div>
              <button
                onClick={() => toggle.mutate({ user_id: u.id, trusted: !u.trusted_host })}
                className={`rounded-full px-3 py-1 text-[10px] font-semibold ${u.trusted_host ? "bg-secondary" : "bg-primary text-primary-foreground"}`}
              >
                {u.trusted_host ? "Untrust" : "Trust"}
              </button>
            </article>
          ))
        )}
      </div>
    </PageShell>
  );
}

function Chip({ ok, icon: Icon, label }: { ok: boolean; icon: any; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${ok ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}