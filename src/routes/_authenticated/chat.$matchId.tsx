import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  getMessages,
  sendMessage,
  getMyMatches,
  createSwapProposal,
  getProposals,
  updateProposalStatus,
  markMatchRead,
} from "@/lib/flatch.functions";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Calendar, Check, X, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/$matchId")({
  head: () => ({ meta: [{ title: "Chat — flatch." }] }),
  component: ChatPage,
});

function ChatPage() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const msgsFn = useServerFn(getMessages);
  const sendFn = useServerFn(sendMessage);
  const matchesFn = useServerFn(getMyMatches);
  const proposalsFn = useServerFn(getProposals);
  const createProposalFn = useServerFn(createSwapProposal);
  const updateProposalFn = useServerFn(updateProposalStatus);
  const markReadFn = useServerFn(markMatchRead);

  const matches = useQuery({ queryKey: ["matches"], queryFn: () => matchesFn() });
  const match = matches.data?.find((m) => m.id === matchId);

  const messages = useQuery({
    queryKey: ["messages", matchId],
    queryFn: () => msgsFn({ data: { match_id: matchId } }),
  });

  const proposals = useQuery({
    queryKey: ["proposals", matchId],
    queryFn: () => proposalsFn({ data: { match_id: matchId } }),
  });

  const send = useMutation({
    mutationFn: (body: string) => sendFn({ data: { match_id: matchId, body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", matchId] }),
  });

  const [text, setText] = useState("");
  const [showProposal, setShowProposal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`messages:${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", matchId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

  // Mark as read when messages arrive / viewed
  useEffect(() => {
    if (!messages.data) return;
    markReadFn({ data: { match_id: matchId } })
      .then(() => qc.invalidateQueries({ queryKey: ["matches"] }))
      .catch(() => {});
  }, [matchId, messages.data?.length, markReadFn, qc]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    send.mutate(text.trim());
    setText("");
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate({ to: "/matches" })} className="rounded-full p-1.5 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-accent">
          {match?.other_user?.avatar_url && <img src={match.other_user.avatar_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{match?.other_user?.display_name ?? "User"}</p>
            {(match as any)?.ready_to_switch && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Ready to switch
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{match?.their_property?.title}</p>
        </div>
        <button onClick={() => setShowProposal(true)} className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          Propose swap
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {(proposals.data ?? []).map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            onUpdate={async (status) => {
              await updateProposalFn({ data: { proposal_id: p.id, status } });
              qc.invalidateQueries({ queryKey: ["proposals", matchId] });
              toast.success(`Proposal ${status}`);
            }}
          />
        ))}

        <div className="space-y-2">
          {(messages.data ?? []).map((m) => {
            if ((m as any).kind === "system") {
              return (
                <div key={m.id} className="my-2 flex justify-center">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    <Info className="h-3 w-3" />
                    {m.body}
                  </div>
                </div>
              );
            }
            const isMine = m.sender_id !== match?.other_user?.id;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                  {m.body}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border bg-background px-4 py-3 pb-[env(safe-area-inset-bottom)]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message..."
          maxLength={2000}
          className="flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        <button type="submit" disabled={!text.trim()} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </form>

      {showProposal && (
        <ProposalModal
          onClose={() => setShowProposal(false)}
          onSubmit={async (vars) => {
            await createProposalFn({ data: { match_id: matchId, ...vars } });
            qc.invalidateQueries({ queryKey: ["proposals", matchId] });
            toast.success("Proposal sent");
            setShowProposal(false);
          }}
        />
      )}
    </div>
  );
}

function ProposalCard({ proposal, onUpdate }: { proposal: any; onUpdate: (s: "accepted" | "rejected" | "cancelled" | "confirmed") => void }) {
  return (
    <div className="mb-3 rounded-2xl border border-primary/20 bg-accent/50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
        <Calendar className="h-4 w-4" /> Swap proposal
      </div>
      <p className="mt-2 text-sm">
        <span className="font-medium">{proposal.start_date}</span> → <span className="font-medium">{proposal.end_date}</span>
        {" "}· {proposal.guests} guests
      </p>
      {proposal.message && <p className="mt-1 text-sm text-muted-foreground">{proposal.message}</p>}
      <p className="mt-2 text-xs text-muted-foreground">Status: <span className="font-semibold capitalize">{proposal.status}</span></p>
      {proposal.status === "pending" && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => onUpdate("accepted")} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            <Check className="h-3.5 w-3.5" /> Accept
          </button>
          <button onClick={() => onUpdate("rejected")} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
            <X className="h-3.5 w-3.5" /> Decline
          </button>
        </div>
      )}
    </div>
  );
}

function ProposalModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (v: { start_date: string; end_date: string; guests: number; message?: string }) => Promise<void> }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [guests, setGuests] = useState(2);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl">
        <h2 className="text-xl font-bold">Propose a swap</h2>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs text-muted-foreground">Start</span><input type="date" required value={start} onChange={(e) => setStart(e.target.value)} className="input mt-1" /></label>
            <label className="block"><span className="text-xs text-muted-foreground">End</span><input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} className="input mt-1" /></label>
          </div>
          <label className="block"><span className="text-xs text-muted-foreground">Guests</span><input type="number" min={1} max={40} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="input mt-1" /></label>
          <label className="block"><span className="text-xs text-muted-foreground">Message (optional)</span><textarea rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} className="input mt-1 resize-none" /></label>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-3 text-sm font-semibold">Cancel</button>
          <button
            disabled={busy || !start || !end}
            onClick={async () => {
              setBusy(true);
              try { await onSubmit({ start_date: start, end_date: end, guests, message: message || undefined }); }
              finally { setBusy(false); }
            }}
            className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >Send</button>
        </div>
      </div>
    </div>
  );
}