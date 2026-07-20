import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, X, Send, Headset, Loader2, Sparkles, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyTickets,
  getTicket,
  sendUserMessage,
  escalateToHuman,
} from "@/lib/support.functions";

export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [suggestEscalate, setSuggestEscalate] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const listFn = useServerFn(listMyTickets);
  const getFn = useServerFn(getTicket);
  const sendFn = useServerFn(sendUserMessage);
  const escalateFn = useServerFn(escalateToHuman);

  const tickets = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => listFn(),
    enabled: open,
  });

  // Auto-select most recent open ticket
  useEffect(() => {
    if (!open || ticketId || !tickets.data) return;
    const active = tickets.data.find((t) => t.status !== "closed");
    if (active) setTicketId(active.id);
  }, [open, ticketId, tickets.data]);

  const ticket = useQuery({
    queryKey: ["support-ticket", ticketId],
    queryFn: () => getFn({ data: { ticket_id: ticketId! } }),
    enabled: !!ticketId && open,
  });

  // Realtime for agent replies
  useEffect(() => {
    if (!ticketId) return;
    const ch = supabase
      .channel(`support:${ticketId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticketId}` },
        () => qc.invalidateQueries({ queryKey: ["support-ticket", ticketId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ticketId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket.data?.messages.length]);

  const send = useMutation({
    mutationFn: async (body: string) =>
      sendFn({ data: { ticket_id: ticketId ?? undefined, body } }),
    onSuccess: (res) => {
      if (res.ticket_id !== ticketId) setTicketId(res.ticket_id);
      setSuggestEscalate(res.escalated);
      qc.invalidateQueries({ queryKey: ["support-ticket", res.ticket_id] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  const escalate = useMutation({
    mutationFn: async () => escalateFn({ data: { ticket_id: ticketId! } }),
    onSuccess: () => {
      setSuggestEscalate(false);
      qc.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  const submit = () => {
    const t = input.trim();
    if (!t || send.isPending) return;
    setInput("");
    send.mutate(t);
  };

  const status = ticket.data?.ticket.status;
  const messages = ticket.data?.messages ?? [];

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Hilfe & Support"
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-105 active:scale-95"
        >
          <HelpCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:rounded-2xl"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {status && status !== "ai" ? <Headset className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {status === "active" ? "Live Support" : status === "pending" ? "Mitarbeiter wird verbunden" : "flatch. Hilfe"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {status === "active" || status === "pending" ? "Ein Mitarbeiter antwortet dir" : "KI-Assistent · antwortet sofort"}
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-secondary">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {!ticketId && !tickets.isLoading && (
                <div className="rounded-2xl bg-secondary/50 p-4 text-sm">
                  <p className="font-medium">Hallo! 👋 Wie kann ich dir helfen?</p>
                  <p className="mt-1 text-muted-foreground">
                    Ich beantworte allgemeine Fragen zu flatch. Wenn es um deine konkrete Buchung geht, verbinde ich dich mit einem Mitarbeiter.
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} role={m.sender_role} body={m.body} />
              ))}
              {send.isPending && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> KI schreibt…
                </div>
              )}
              {suggestEscalate && status === "ai" && (
                <button
                  onClick={() => escalate.mutate()}
                  disabled={escalate.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/15"
                >
                  <Headset className="h-4 w-4" />
                  {escalate.isPending ? "Verbinde…" : "Mit Mitarbeiter verbinden"}
                </button>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
                  }}
                  rows={1}
                  placeholder={status === "active" ? "Nachricht an Support…" : "Frage stellen…"}
                  className="flex-1 resize-none rounded-2xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={submit}
                  disabled={!input.trim() || send.isPending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {status !== "ai" && status && (
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Ticket #{ticketId?.slice(0, 8)} · Status: {status}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ role, body }: { role: string; body: string }) {
  if (role === "system") {
    return (
      <div className="mx-auto max-w-[85%] rounded-full bg-secondary px-3 py-1 text-center text-[11px] text-muted-foreground">
        {body}
      </div>
    );
  }
  const isUser = role === "user";
  const isAgent = role === "agent";
  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isAgent ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary"}`}>
          {isAgent ? <Headset className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
        </div>
      )}
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
          <UserIcon className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : isAgent
            ? "rounded-bl-sm bg-emerald-500/10 text-foreground"
            : "rounded-bl-sm bg-secondary text-foreground"
        }`}
      >
        {body}
      </div>
    </div>
  );
}