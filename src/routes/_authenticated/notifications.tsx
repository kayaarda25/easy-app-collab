import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { Bell, Heart, MessageCircle, Star, CalendarCheck, Send, Trash2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — flatch." }] }),
  component: NotificationsPage,
});

function iconFor(type: string) {
  switch (type) {
    case "match": return Heart;
    case "message": return MessageCircle;
    case "review": return Star;
    case "proposal_new": return Send;
    case "proposal_status": return CalendarCheck;
    case "checkin_reminder":
    case "checkout_reminder": return CalendarCheck;
    default: return Bell;
  }
}

function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotificationsPage() {
  const qc = useQueryClient();
  const fetchN = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const del = useServerFn(deleteNotification);

  const q = useQuery({ queryKey: ["notifications"], queryFn: () => fetchN() });

  const mRead = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const mAll = useMutation({
    mutationFn: () => markAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = q.data?.items ?? [];
  const unread = q.data?.unread ?? 0;

  return (
    <PageShell>
      <header className="flex items-center justify-between px-6 pt-8 pb-4">
        <Link to="/home" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Notifications</h1>
        <Button
          size="sm"
          variant="ghost"
          disabled={unread === 0 || mAll.isPending}
          onClick={() => mAll.mutate()}
        >
          Mark all read
        </Button>
      </header>

      {q.isLoading ? (
        <div className="px-6 py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">You're all caught up.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((n: any) => {
            const Icon = iconFor(n.type);
            const unreadDot = !n.read_at;
            const content = (
              <div className="flex items-start gap-3 px-6 py-4">
                <div className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${unreadDot ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`truncate text-sm ${unreadDot ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                    {unreadDot && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">{relTime(n.created_at)}</p>
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); mDel.mutate(n.id); }}
                  aria-label="Delete"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link
                    to={n.link}
                    onClick={() => unreadDot && mRead.mutate(n.id)}
                    className="block hover:bg-muted/40"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    onClick={() => unreadDot && mRead.mutate(n.id)}
                    className="block w-full text-left hover:bg-muted/40"
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}