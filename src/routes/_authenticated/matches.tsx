import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyMatches } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { Heart, MessageCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({ meta: [{ title: "Matches — flatch." }] }),
  component: MatchesPage,
});

function MatchesPage() {
  const fn = useServerFn(getMyMatches);
  const q = useQuery({ queryKey: ["matches"], queryFn: () => fn() });

  return (
    <PageShell>
      <header className="px-6 pt-8 pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Matches</h1>
        <p className="mt-1 text-sm text-muted-foreground">People who want to swap with you.</p>
      </header>

      <div className="space-y-3 px-6">
        {q.isLoading ? (
          [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)
        ) : (q.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border py-12 text-center">
            <Heart className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No matches yet.</p>
            <Link to="/search" className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
              Start swiping
            </Link>
          </div>
        ) : (
          (q.data ?? []).map((m: any) => {
            const cover = m.their_property?.property_images?.[0]?.url;
            const unread = m.unread_count ?? 0;
            return (
              <Link key={m.id} to="/chat/$matchId" params={{ matchId: m.id }} className="flex gap-3 rounded-2xl border border-border bg-card p-3 transition hover:shadow-[var(--shadow-card)]">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                  {cover && <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{m.their_property?.title ?? "Their home"}</p>
                    {m.ready_to_switch && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Ready to switch
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.their_property?.city}, {m.their_property?.country}</p>
                  <p className="mt-1 text-xs text-primary">with {m.other_user?.display_name ?? "User"}</p>
                  {m.last_message && (
                    <p className={`mt-1 truncate text-xs ${m.last_message.kind === "system" ? "italic text-muted-foreground" : "text-muted-foreground"}`}>
                      {m.last_message.body}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 self-center">
                  {unread > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : (
                    <MessageCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </PageShell>
  );
}