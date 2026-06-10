import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyMatches } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { MessageCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [{ title: "Inbox — flatch." }] }),
  component: InboxPage,
});

function InboxPage() {
  const fn = useServerFn(getMyMatches);
  const q = useQuery({ queryKey: ["matches"], queryFn: () => fn() });

  return (
    <PageShell>
      <header className="px-6 pt-8 pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
      </header>
      <div className="space-y-2 px-4">
        {(q.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No conversations yet.</p>
          </div>
        ) : (
          (q.data ?? []).map((m: any) => {
            const last = m.last_message;
            const preview = last
              ? last.kind === "system"
                ? last.body
                : last.body
              : "Say hi 👋";
            const unread = m.unread_count ?? 0;
            return (
              <Link
                key={m.id}
                to="/chat/$matchId"
                params={{ matchId: m.id }}
                className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-secondary"
              >
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-accent">
                  {m.other_user?.avatar_url && (
                    <img src={m.other_user.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`truncate text-sm ${unread > 0 ? "font-bold" : "font-semibold"}`}>
                      {m.other_user?.display_name ?? "User"}
                    </p>
                    {m.ready_to_switch && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Ready to switch
                      </span>
                    )}
                  </div>
                  <p
                    className={`truncate text-xs ${
                      unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                    } ${last?.kind === "system" ? "italic" : ""}`}
                  >
                    {preview}
                  </p>
                </div>
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })
        )}
      </div>
    </PageShell>
  );
}