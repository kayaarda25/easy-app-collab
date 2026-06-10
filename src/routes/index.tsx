import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Home as HomeIcon, MessageCircle, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "flatch. — Swap your home, see the world" },
      { name: "description", content: "Trade your home with verified travelers instead of booking hotels. Premium home swapping made simple." },
      { property: "og:title", content: "flatch. — Swap your home, see the world" },
      { property: "og:description", content: "Premium home swapping platform with verified members." },
    ],
  }),
  component: Welcome,
});

const slides = [
  {
    icon: HomeIcon,
    title: "Liste dein Zuhause",
    body: "Fotos, Daten, Ausstattung — in wenigen Minuten online. Du entscheidest, wann es verfügbar ist.",
    gradient: "from-primary to-primary-glow",
  },
  {
    icon: Sparkles,
    title: "Swipe & Match",
    body: "Entdecke Wohnungen weltweit. Wenn ihr euch beide liked, ist es ein Match.",
    gradient: "from-primary-glow to-primary",
  },
  {
    icon: MessageCircle,
    title: "Chatte & tausche",
    body: "Plant Termine, klärt Details und tauscht eure Zuhause — alles sicher in der App.",
    gradient: "from-primary to-primary-glow",
  },
];

function Welcome() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);

  const next = () => {
    if (index < slides.length - 1) setIndex(index + 1);
    else navigate({ to: "/auth", search: { mode: "signup" } });
  };
  const prev = () => index > 0 && setIndex(index - 1);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
    startX.current = null;
  };

  const slide = slides[index];
  const Icon = slide.icon;
  const isLast = index === slides.length - 1;

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground font-bold text-sm">
            f
          </div>
          <span className="text-base font-bold tracking-tight">flatch.</span>
        </div>
        {!isLast && (
          <button
            onClick={() => navigate({ to: "/auth", search: { mode: "signup" } })}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
        )}
      </div>

      {/* Slide content */}
      <div
        className="flex flex-1 flex-col items-center justify-center px-8 text-center"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          key={index}
          className={`flex h-40 w-40 items-center justify-center rounded-[2.5rem] bg-gradient-to-br ${slide.gradient} text-primary-foreground shadow-[var(--shadow-elegant)] animate-[scale-in_0.35s_ease-out]`}
        >
          <Icon className="h-16 w-16" strokeWidth={1.8} />
        </div>
        <h1
          key={`t-${index}`}
          className="mt-10 text-3xl font-bold tracking-tight animate-[fade-in_0.4s_ease-out]"
        >
          {slide.title}
        </h1>
        <p
          key={`b-${index}`}
          className="mt-4 max-w-xs text-base text-muted-foreground animate-[fade-in_0.5s_ease-out]"
        >
          {slide.body}
        </p>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 pb-6">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-primary" : "w-2 bg-border"
            }`}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          onClick={next}
          className="group flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition active:scale-[0.98]"
        >
          {isLast ? "Loslegen" : "Weiter"}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Schon dabei?{" "}
          <Link to="/auth" search={{ mode: "login" }} className="font-semibold text-primary">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
