import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyMatches } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { MessageCircle } from "lucide-react";

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
          (q.data ?? []).map((m) => (
            <Link key={m.id} to="/chat/$matchId" params={{ matchId: m.id }} className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-secondary">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-accent">
                {m.other_user?.avatar_url && <img src={m.other_user.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{m.other_user?.display_name ?? "User"}</p>
                <p className="truncate text-xs text-muted-foreground">{m.their_property?.title}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </PageShell>
  );
}