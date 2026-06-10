import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Heart, Home as HomeIcon, MessageCircle, Search, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState<"in-right" | "in-left" | null>(null);
  const dragging = useRef(false);
  const edge = useRef<"left" | "right" | null>(null);

  // Play slide-in when pathname changes via swipe
  useEffect(() => {
    if (!animating) return;
    const t = setTimeout(() => setAnimating(null), 320);
    return () => clearTimeout(t);
  }, [animating, pathname]);

  const currentIdx = NAV_ORDER.findIndex(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const w = window.innerWidth;
    if (t.clientX < 28) edge.current = "left";
    else if (t.clientX > w - 28) edge.current = "right";
    else { edge.current = null; return; }
    startX.current = t.clientX;
    startY.current = t.clientY;
    startTime.current = Date.now();
    dragging.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || startX.current == null || startY.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (Math.abs(dx) < Math.abs(dy)) return;
    // Only drag in the valid direction for this edge
    if (edge.current === "left" && dx < 0) return;
    if (edge.current === "right" && dx > 0) return;
    // Block when no neighbor exists
    if (edge.current === "left" && currentIdx <= 0) return;
    if (edge.current === "right" && currentIdx >= NAV_ORDER.length - 1) return;
    setDragX(dx);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!dragging.current || startX.current == null || startY.current == null) {
      dragging.current = false;
      setDragX(0);
      return;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    const dt = Date.now() - startTime.current;
    startX.current = null;
    startY.current = null;
    dragging.current = false;
    const w = window.innerWidth;
    const past = Math.abs(dx) > w * 0.3 || (Math.abs(dx) > 60 && dt < 250 && Math.abs(dx) > Math.abs(dy) * 1.5);
    const goNext = edge.current === "right" && dx < 0 && currentIdx < NAV_ORDER.length - 1;
    const goPrev = edge.current === "left" && dx > 0 && currentIdx > 0;
    if (past && (goNext || goPrev)) {
      setAnimating(goNext ? "in-right" : "in-left");
      navigate({ to: NAV_ORDER[goNext ? currentIdx + 1 : currentIdx - 1] });
    }
    edge.current = null;
    setDragX(0);
  };

  return (
    <div
      className="min-h-screen bg-background pb-20"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className={`mx-auto max-w-md ${
          animating === "in-right" ? "animate-[slide-in-right_0.3s_ease-out]" : ""
        } ${animating === "in-left" ? "animate-[slide-in-left_0.3s_ease-out]" : ""}`}
        style={{
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: dragging.current ? "none" : "transform 0.25s ease-out",
          willChange: dragX ? "transform" : undefined,
        }}
      >
        {children}
      </div>
      <BottomNav />
    </div>
  );
}