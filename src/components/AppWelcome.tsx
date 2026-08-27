import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useRef, useState } from "react";
import onboardingHome from "@/assets/onboarding-home.jpg";
import onboardingTravel from "@/assets/onboarding-travel.jpg";
import onboardingChat from "@/assets/onboarding-chat.jpg";
import { Logo } from "@/components/Logo";
import { useT } from "@/lib/i18n";

const slides = [
  {
    image: onboardingHome,
    title: "Liste dein Zuhause",
    body: "Fotos, Daten, Ausstattung — in wenigen Minuten online. Du entscheidest, wann es verfügbar ist.",
  },
  {
    image: onboardingTravel,
    title: "Swipe & Match",
    body: "Entdecke Wohnungen weltweit. Wenn ihr euch beide liked, ist es ein Match.",
  },
  {
    image: onboardingChat,
    title: "Chatte & tausche",
    body: "Plant Termine, klärt Details und tauscht eure Zuhause — alles sicher in der App.",
  },
];

export function AppWelcome() {
  const { t } = useT();
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
  const isLast = index === slides.length - 1;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <div className="absolute inset-0">
        {slides.map((s, i) => (
          <img
            key={i}
            src={s.image}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center justify-between px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
          <Logo size={32} withWordmark wordmarkClassName="text-base text-white" />
          {!isLast && (
            <button
              onClick={() => navigate({ to: "/auth", search: { mode: "signup" } })}
              className="text-sm font-medium text-white/70 hover:text-white"
            >
              {t("Skip")}
            </button>
          )}
        </div>

        <div className="flex-1" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />

        <div className="px-6 pb-6">
          <h1
            key={`t-${index}`}
            className="text-3xl font-bold tracking-tight text-white animate-[fade-in_0.4s_ease-out]"
          >
            {t(slide.title)}
          </h1>
          <p
            key={`b-${index}`}
            className="mt-3 max-w-sm text-base text-white/80 animate-[fade-in_0.5s_ease-out]"
          >
            {t(slide.body)}
          </p>

          <div className="flex gap-2 mt-6">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            onClick={next}
            className="group flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-base font-semibold text-black shadow-lg transition active:scale-[0.98]"
          >
            {isLast ? t("Loslegen") : t("Weiter")}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
          <p className="mt-4 text-center text-sm text-white/70">
            {t("Schon dabei?")}{" "}
            <Link to="/auth" search={{ mode: "login" }} className="font-semibold text-white">
              {t("Anmelden")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AppWelcome;
