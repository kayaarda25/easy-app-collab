import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/BottomNav";
import { ArrowLeft, Headset, Send, CheckCircle2, Loader2, Sparkles, User as UserIcon } from "lucide-react";
import { listAllTickets, getTicket, agentReply, closeTicket } from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({ meta: [{ title: "Support — Admin" }] }),
  component: SupportAdmin,
});

function SupportAdmin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listAllTickets);
  const getFn = useServerFn(getTicket);
  const replyFn = useServerFn(agentReply);
  const closeFn = useServerFn(closeTicket);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const tickets = useQuery({ queryKey: ["admin-support-tickets"], queryFn: () => listFn() });
  const ticket = useQuery({
    queryKey: ["admin-support-ticket", activeId],
    queryFn: () => getFn({ data: { ticket_id: activeId! } }),
    enabled: !!activeId,
  });

  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`admin-support:${activeId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${activeId}` },
        () => qc.invalidateQueries({ queryKey: ["admin-support-ticket", activeId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, qc]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [ticket.data?.messages.length]);

  const reply = useMutation({
    mutationFn: (body: string) => replyFn({ data: { ticket_id: activeId!, body } }),
    onSuccess: () => {
      setInput("");
      qc.invalidateQueries({ queryKey: ["admin-support-ticket", activeId] });
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
  });

  const close = useMutation({
    mutationFn: () => closeFn({ data: { ticket_id: activeId! } }),
    onSuccess: () => {
      setActiveId(null);
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
  });

  return (
    <PageShell>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={() => navigate({ to: "/admin" })} className="rounded-full p-1.5 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Support</h1>
          <p className="text-[11px] text-muted-foreground">
            {tickets.data?.length ?? 0} offene Tickets
          </p>
        </div>
        <Headset className="h-5 w-5 text-primary" />
      </header>

      {!activeId ? (
        <div className="divide-y divide-border">
          {tickets.isLoading && <p className="p-6 text-sm text-muted-foreground">Lädt…</p>}
          {tickets.data?.length === 0 && (
            <div className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-2 text-sm text-muted-foreground">Keine offenen Support-Tickets.</p>
            </div>
          )}
          {tickets.data?.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50"
            >
              <div className="h-10 w-10 overflow-hidden rounded-full bg-secondary">
                {t.user?.avatar_url && <img src={t.user.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{t.user?.display_name ?? "User"}</p>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    t.status === "pending" ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"
                  }`}>
                    {t.status}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{t.subject}</p>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {new Date(t.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex h-[calc(100vh-8rem)] flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <button onClick={() => setActiveId(null)} className="text-xs text-muted-foreground hover:text-foreground">
              ← Zurück
            </button>
            <button
              onClick={() => close.mutate()}
              disabled={close.isPending}
              className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold hover:bg-secondary/70"
            >
              Ticket schließen
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {ticket.data?.messages.map((m) => {
              if (m.sender_role === "system") {
                return (
                  <div key={m.id} className="mx-auto max-w-[85%] rounded-full bg-secondary px-3 py-1 text-center text-[11px] text-muted-foreground">
                    {m.body}
                  </div>
                );
              }
              const isUser = m.sender_role === "user";
              const isAgent = m.sender_role === "agent";
              return (
                <div key={m.id} className={`flex gap-2 ${isAgent ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    isAgent ? "bg-emerald-500/15 text-emerald-600" : isUser ? "bg-secondary" : "bg-primary/10 text-primary"
                  }`}>
                    {isAgent ? <Headset className="h-3.5 w-3.5" /> : isUser ? <UserIcon className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    isAgent ? "rounded-br-sm bg-emerald-500/15" : isUser ? "rounded-bl-sm bg-secondary" : "rounded-bl-sm bg-primary/10"
                  }`}>
                    {m.body}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (input.trim()) reply.mutate(input.trim()); } }}
                rows={1}
                placeholder="Antwort als Mitarbeiter…"
                className="flex-1 resize-none rounded-2xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={() => input.trim() && reply.mutate(input.trim())}
                disabled={!input.trim() || reply.isPending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              >
                {reply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}