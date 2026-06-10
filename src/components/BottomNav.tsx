import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Heart, Home as HomeIcon, MessageCircle, Search, User } from "lucide-react";
import { useRef } from "react";

const items = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/swipe", label: "Swipe", icon: Search },
  { to: "/matches", label: "Matches", icon: Heart },
  { to: "/inbox", label: "Inbox", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
] as const;

const NAV_ORDER = items.map((i) => i.to);

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground transition data-[status=active]:text-primary"
            activeProps={{ className: "text-primary" }}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startTime = useRef<number>(0);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    startTime.current = Date.now();
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null || startY.current == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    const dt = Date.now() - startTime.current;
    startX.current = null;
    startY.current = null;
    // Edge swipe only: ignore swipes that start in the middle (avoid carousels, sliders, swipe cards)
    const w = window.innerWidth;
    const fromLeftEdge = t.clientX - dx < 40;
    const fromRightEdge = t.clientX - dx > w - 40;
    if (!fromLeftEdge && !fromRightEdge) return;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || dt > 600) return;

    const idx = NAV_ORDER.findIndex((p) => pathname === p || pathname.startsWith(p + "/"));
    if (idx < 0) return;
    if (dx < 0 && fromRightEdge && idx < NAV_ORDER.length - 1) {
      navigate({ to: NAV_ORDER[idx + 1] });
    } else if (dx > 0 && fromLeftEdge && idx > 0) {
      navigate({ to: NAV_ORDER[idx - 1] });
    }
  };

  return (
    <div
      className="min-h-screen bg-background pb-20"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="mx-auto max-w-md">{children}</div>
      <BottomNav />
    </div>
  );
}