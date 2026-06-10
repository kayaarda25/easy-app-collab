import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { listNotifications } from "@/lib/flatch.functions";

export function NotificationsBell() {
  const fetchN = useServerFn(listNotifications);
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchN(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const unread = q.data?.unread ?? 0;
  return (
    <Link
      to="/notifications"
      aria-label="Notifications"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-muted"
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}