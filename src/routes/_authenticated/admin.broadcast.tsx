import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminBroadcast, adminListBroadcasts, getMyAdminRoles } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { ArrowLeft, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/broadcast")({
  head: () => ({ meta: [{ title: "Admin · Broadcast — flatch." }] }),
  component: AdminBroadcast,
});

function AdminBroadcast() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRoles = useServerFn(getMyAdminRoles);
  const fetchList = useServerFn(adminListBroadcasts);
  const sendFn = useServerFn(adminBroadcast);
  const me = useQuery({ queryKey: ["my-admin-roles"], queryFn: () => fetchRoles() });
  const list = useQuery({
    queryKey: ["admin-broadcasts"],
    queryFn: () => fetchList(),
    enabled: me.data?.isAdmin === true,
  });

  const [audience, setAudience] = useState<"all" | "premium" | "standard" | "basic">("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");

  const send = useMutation({
    mutationFn: () => sendFn({ data: { audience, title, body: body || undefined, link: link || undefined } }),
    onSuccess: (r) => {
      toast.success(`Gesendet an ${r.recipients} Nutzer`);
      setTitle(""); setBody(""); setLink("");
      qc.invalidateQueries({ queryKey: ["admin-broadcasts"] });
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
        <Megaphone className="h-5 w-5" />
        <h1 className="text-lg font-bold">Broadcast</h1>
      </header>

      <section className="space-y-3 px-4 py-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Empfänger</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value as any)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="all">Alle Nutzer</option>
            <option value="premium">Nur Premium</option>
            <option value="standard">Nur Standard</option>
            <option value="basic">Nur Basic</option>
          </select>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Nachricht (optional)" rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link (z. B. /home)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button
          disabled={!title || send.isPending}
          onClick={() => send.mutate()}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {send.isPending ? "Sende…" : "Senden"}
        </button>
      </section>

      <section className="border-t border-border">
        <h2 className="px-4 pb-2 pt-4 text-xs font-semibold uppercase text-muted-foreground">Letzte Broadcasts</h2>
        <div className="divide-y divide-border">
          {(list.data ?? []).map((b: any) => (
            <div key={b.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{b.title}</p>
                <p className="text-[10px] text-muted-foreground">{b.recipients_count} · {b.audience}</p>
              </div>
              {b.body && <p className="text-xs text-muted-foreground">{b.body}</p>}
              <p className="mt-1 text-[10px] text-muted-foreground">{new Date(b.created_at).toLocaleString()}</p>
            </div>
          ))}
          {list.data && list.data.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Noch nichts gesendet.</div>
          )}
        </div>
      </section>
    </PageShell>
  );
}