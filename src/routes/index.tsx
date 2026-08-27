import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import onboardingHome from "@/assets/onboarding-home.jpg";
import onboardingTravel from "@/assets/onboarding-travel.jpg";
import onboardingChat from "@/assets/onboarding-chat.jpg";
import heroImg from "@/assets/web-hero.jpg";
import arriveImg from "@/assets/web-arrive.jpg";
import cityImg from "@/assets/web-city.jpg";
import keysImg from "@/assets/web-keys.jpg";
import { Logo } from "@/components/Logo";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "flatch. — Tausche dein Zuhause, entdecke die Welt" },
      {
        name: "description",
        content:
          "flatch. ist die Home-Swap-App für verifizierte Mitglieder. Wohnung gegen Wohnung, ohne Hotelpreise. Bald im App Store und bei Google Play.",
      },
      { property: "og:title", content: "flatch. — Tausche dein Zuhause, entdecke die Welt" },
      {
        property: "og:description",
        content: "Home Swapping für verifizierte Mitglieder. Bald im App Store und bei Google Play.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

function getIsAppHost() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const preview = params.get("preview");
  if (preview === "web") return false;
  if (preview === "app") return true;
  const host = window.location.host;
  return host === "app.flatch.ch" || host.startsWith("app.") || host === "localhost:8080" || host === "localhost:3000";
}

function IndexPage() {
  const [isAppHost, setIsAppHost] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsAppHost(getIsAppHost());
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d0c0b]">
        <Logo size={40} withWordmark wordmarkClassName="text-[#f3ede4]" />
      </div>
    );
  }

  return isAppHost ? <AppWelcome /> : <LandingPage />;
}

/* -------------------------------------------------------------------------- */
/*                                APP WELCOME                                 */
/* -------------------------------------------------------------------------- */

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

function AppWelcome() {
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

/* -------------------------------------------------------------------------- */
/*                                LANDING PAGE                                */
/* -------------------------------------------------------------------------- */

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "-8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

const steps = [
  {
    n: "01",
    title: "Zuhause zeigen",
    body: "Fotos, Daten, Ausstattung. In wenigen Minuten steht dein Inserat — du bestimmst, wann und für wen es offen ist.",
  },
  {
    n: "02",
    title: "Match finden",
    body: "Swipe durch geprüfte Wohnungen weltweit. Gefällt es beiden, entsteht ein Match und ein privater Chat.",
  },
  {
    n: "03",
    title: "Schlüssel tauschen",
    body: "Termine, Hausregeln, Gäste und Check-in klärt ihr in der App. Danach: leben wie zuhause, nur woanders.",
  },
];

const cities = [
  "Lissabon",
  "Barcelona",
  "Kopenhagen",
  "Zürich",
  "Mailand",
  "Paris",
  "Wien",
  "Amsterdam",
  "Stockholm",
  "Porto",
  "Berlin",
  "Athen",
];

const faqs = [
  {
    q: "Was kostet ein Tausch?",
    a: "Nichts pro Nacht. Ihr tauscht Wohnung gegen Wohnung. flatch. finanziert sich über eine schlanke Mitgliedschaft — keine Provision, keine Servicegebühr auf den Aufenthalt.",
  },
  {
    q: "Und wenn ich nicht gleichzeitig reisen kann?",
    a: "Dafür gibt es flatch.points. Du nimmst jemanden bei dir auf, sammelst Punkte und löst sie später bei einem anderen Mitglied ein — auch ohne Gegentausch.",
  },
  {
    q: "Wie sicher ist das?",
    a: "Jedes Profil durchläuft eine Verifizierung: E-Mail, Telefon, amtlicher Ausweis und Adresse. Dazu gegenseitige Bewertungen nach jedem Aufenthalt und Support, der bei Bedarf live übernimmt.",
  },
  {
    q: "Wann kommt die App?",
    a: "Die iOS- und Android-Version stehen kurz vor dem Release. Trag dich in die Warteliste ein — du bekommst den Link zum Download am Tag eins.",
  },
];

function StoreBadge({ store }: { store: "apple" | "google" }) {
  return (
    <span className="inline-flex items-center gap-3 rounded-2xl border border-[#3a352f] bg-[#141210] px-5 py-3 text-left transition-colors hover:border-[#6b6157]">
      {store === "apple" ? (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-[#f3ede4]" aria-hidden="true">
          <path d="M16.365 1.43c0 1.14-.42 2.2-1.12 3.02-.85 1-2.23 1.77-3.38 1.68a3.6 3.6 0 0 1-.03-.42c0-1.1.5-2.26 1.24-3.06.79-.87 2.15-1.53 3.24-1.58.03.12.05.24.05.36zM20.9 17.13c-.55 1.27-.82 1.84-1.53 2.97-.99 1.57-2.39 3.53-4.12 3.54-1.54.02-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.01-3.05-1.78-4.04-3.35C.36 15.9-.07 10.72 1.63 8c1.2-1.94 3.1-3.07 4.89-3.07 1.82 0 2.96 1 4.47 1 1.46 0 2.35-1 4.46-1 1.6 0 3.29.87 4.5 2.37-3.95 2.17-3.31 7.81.95 9.83z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-[#f3ede4]" aria-hidden="true">
          <path d="M3.6 1.84a1 1 0 0 0-.6.92v18.48a1 1 0 0 0 .6.92l10.1-10.16L3.6 1.84zm11.5 8.5 2.9-2.92-9.9-5.6a1 1 0 0 0-.3-.11l7.3 8.63zm0 3.32-7.3 8.63c.1-.02.2-.06.3-.11l9.9-5.6-2.9-2.92zm1.42-1.42 3.3-1.87c.78-.44.78-1.5 0-1.94l-3.3-1.87-2.6 2.84 2.6 2.84z" />
        </svg>
      )}
      <span className="leading-tight">
        <span className="block text-[10px] uppercase tracking-[0.18em] text-[#8d8378]">Demnächst</span>
        <span className="block text-sm font-medium text-[#f3ede4]">
          {store === "apple" ? "App Store" : "Google Play"}
        </span>
      </span>
    </span>
  );
}

function LandingPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen bg-[#0d0c0b] font-[var(--web-sans)] text-[#e9e3da] antialiased">
      <style>{`
        :root { --web-sans: 'Work Sans', ui-sans-serif, system-ui, sans-serif; --web-serif: 'Instrument Serif', Georgia, serif; }
        @keyframes web-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .web-serif { font-family: var(--web-serif); font-weight: 400; }
      `}</style>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#0d0c0b]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo size={28} withWordmark wordmarkClassName="text-[#f3ede4] text-base" />
          <nav className="hidden items-center gap-8 text-sm text-[#a89e93] md:flex">
            <a href="#idee" className="transition-colors hover:text-[#f3ede4]">Idee</a>
            <a href="#ablauf" className="transition-colors hover:text-[#f3ede4]">Ablauf</a>
            <a href="#points" className="transition-colors hover:text-[#f3ede4]">Points</a>
            <a href="#fragen" className="transition-colors hover:text-[#f3ede4]">Fragen</a>
          </nav>
          <a
            href="https://app.flatch.ch"
            className="rounded-full bg-[#f3ede4] px-5 py-2 text-sm font-medium text-[#0d0c0b] transition-transform hover:scale-[1.03] active:scale-95"
          >
            App öffnen
          </a>
        </div>
      </header>

      <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden">
        <img
          src={heroImg}
          alt="Sonnendurchflutete Altbauwohnung mit Blick über die Dächer"
          width={1920}
          height={1280}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0c0b] via-[#0d0c0b]/55 to-[#0d0c0b]/70" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-32">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#c8bcab]">
              Home Swapping · Verifizierte Mitglieder
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="web-serif mt-6 max-w-4xl text-[clamp(2.75rem,8vw,6rem)] leading-[0.95] tracking-[-0.02em] text-[#f7f2ea]">
              Deine Wohnung ist dein <em className="italic">Reisebudget.</em>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-[#c5bbaf] sm:text-lg">
              flatch. bringt Menschen zusammen, die ihr Zuhause tauschen statt Hotels zu buchen.
              Echte Wohnungen, geprüfte Profile, keine Übernachtungspreise.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <StoreBadge store="apple" />
              <StoreBadge store="google" />
            </div>
          </Reveal>
        </div>
      </section>

      <div className="border-y border-white/5 bg-[#100e0d] py-5">
        <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <div className="flex shrink-0 animate-[web-marquee_38s_linear_infinite] gap-10 pr-10">
            {[...cities, ...cities].map((c, i) => (
              <span
                key={i}
                className="web-serif whitespace-nowrap text-xl text-[#6f665c]"
              >
                {c} <span className="px-3 text-[#3a352f]">✦</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <section id="idee" className="mx-auto max-w-6xl px-6 py-28 sm:py-36">
        <div className="grid gap-14 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.32em] text-[#7d7368]">Die Idee</p>
              <h2 className="web-serif mt-5 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] text-[#f3ede4]">
                Reisen kostet ein Vermögen. Wohnraum steht leer.
              </h2>
            </Reveal>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <Reveal delay={120}>
              <p className="text-lg leading-relaxed text-[#b6ac9f]">
                Jedes Jahr stehen Millionen Wohnungen wochenlang leer, während ihre Bewohner
                anderswo für ein Hotelzimmer bezahlen. flatch. schliesst diese Lücke: Du öffnest
                dein Zuhause, jemand anderes öffnet seines.
              </p>
              <p className="mt-5 text-lg leading-relaxed text-[#b6ac9f]">
                Kein Vermieten, kein Gästebett-Business. Ein Tausch unter Menschen, die sich
                gegenseitig verifiziert und bewertet haben.
              </p>
              <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
                {[
                  ["0 €", "pro Nacht"],
                  ["4-fach", "verifiziert"],
                  ["24/7", "Support"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="web-serif text-3xl text-[#f3ede4]">{k}</dt>
                    <dd className="mt-1 text-xs uppercase tracking-[0.18em] text-[#7d7368]">{v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="ablauf" className="border-t border-white/5 bg-[#100e0d] py-28 sm:py-36">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#7d7368]">So läuft es</p>
            <h2 className="web-serif mt-5 max-w-2xl text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] text-[#f3ede4]">
              Drei Schritte, kein Papierkram.
            </h2>
          </Reveal>

          <div className="mt-16 grid gap-12 md:grid-cols-12 md:gap-10">
            <div className="md:col-span-5">
              <Reveal delay={100}>
                <img
                  src={arriveImg}
                  alt="Paar kommt mit Gepäck in einer getauschten Wohnung an"
                  width={1280}
                  height={1600}
                  loading="lazy"
                  className="h-[480px] w-full rounded-3xl object-cover md:h-[620px]"
                />
              </Reveal>
            </div>
            <div className="md:col-span-6 md:col-start-7 md:self-center">
              {steps.map((s, i) => (
                <Reveal key={s.n} delay={140 + i * 90}>
                  <div className="border-b border-white/10 py-8 first:pt-0">
                    <div className="flex items-baseline gap-5">
                      <span className="web-serif text-sm text-[#8a7f6f]">{s.n}</span>
                      <h3 className="web-serif text-2xl text-[#f3ede4] sm:text-3xl">{s.title}</h3>
                    </div>
                    <p className="mt-3 pl-10 text-[15px] leading-relaxed text-[#a99f93]">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="points" className="mx-auto max-w-6xl px-6 py-28 sm:py-36">
        <div className="grid items-center gap-14 md:grid-cols-2">
          <Reveal>
            <img
              src={keysImg}
              alt="Messingschlüssel auf hellem Stein"
              width={1280}
              height={912}
              loading="lazy"
              className="aspect-[4/3] w-full rounded-3xl object-cover"
            />
          </Reveal>
          <Reveal delay={120}>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#7d7368]">flatch.points</p>
            <h2 className="web-serif mt-5 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] text-[#f3ede4]">
              Tauschen, auch wenn es zeitlich nicht passt.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[#b6ac9f]">
              Nimm jemanden bei dir auf und sammle Punkte. Löse sie ein, wann und wo du willst —
              bei einem ganz anderen Mitglied, in einer ganz anderen Stadt.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "Punkte pro Nacht, transparent gutgeschrieben",
                "Kein gleichzeitiger Gegentausch nötig",
                "Guthaben und Reservierungen live in der App",
              ].map((li) => (
                <li key={li} className="flex gap-3 text-[15px] text-[#a99f93]">
                  <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#c2a878]" />
                  {li}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-white/5">
        <img
          src={cityImg}
          alt="Mittelmeerstadt in der Abenddämmerung"
          width={1280}
          height={912}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#0d0c0b]/75" />
        <div className="relative mx-auto max-w-3xl px-6 py-28 text-center sm:py-36">
          <Reveal>
            <h2 className="web-serif text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] text-[#f7f2ea]">
              Vertrauen ist keine Funktion. Es ist die Grundlage.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-[#c2b8ac] sm:text-lg">
              Ausweis, Adresse, Telefon und E-Mail werden geprüft, bevor ein Profil sichtbar wird.
              Nach jedem Aufenthalt bewerten sich beide Seiten — Gast und Zuhause getrennt.
            </p>
          </Reveal>
        </div>
      </section>

      <section id="fragen" className="mx-auto max-w-4xl px-6 py-28 sm:py-36">
        <Reveal>
          <h2 className="web-serif text-[clamp(2rem,4.5vw,3rem)] leading-[1.05] text-[#f3ede4]">
            Häufige Fragen
          </h2>
        </Reveal>
        <div className="mt-12">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 70}>
              <details className="group border-b border-white/10 py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg text-[#efe8de] [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="text-2xl font-light text-[#7d7368] transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#a99f93]">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="warteliste" className="border-t border-white/5 bg-[#100e0d] py-28 sm:py-36">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#7d7368]">Bald verfügbar</p>
            <h2 className="web-serif mt-5 text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] text-[#f7f2ea]">
              Sei dabei, wenn die App startet.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-[#a99f93]">
              iOS und Android stehen kurz vor dem Release. Wir schicken dir den Download-Link,
              sobald flatch. live ist — sonst nichts.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!email) return;
                setSent(true);
                window.location.href = `mailto:info@flatch.ch?subject=${encodeURIComponent(
                  "Warteliste flatch.",
                )}&body=${encodeURIComponent(`Bitte auf die Warteliste setzen: ${email}`)}`;
              }}
              className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@email.ch"
                className="w-full rounded-full border border-white/12 bg-[#181513] px-6 py-4 text-sm text-[#f3ede4] outline-none transition-colors placeholder:text-[#6f665c] focus:border-[#c2a878]"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-[#f3ede4] px-7 py-4 text-sm font-medium text-[#0d0c0b] transition-transform hover:scale-[1.03] active:scale-95"
              >
                {sent ? "Danke!" : "Eintragen"}
              </button>
            </form>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <StoreBadge store="apple" />
              <StoreBadge store="google" />
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <Logo size={24} withWordmark wordmarkClassName="text-[#c5bbaf] text-sm" />
          <div className="flex items-center gap-6 text-sm text-[#7d7368]">
            <a href="mailto:info@flatch.ch" className="transition-colors hover:text-[#f3ede4]">
              info@flatch.ch
            </a>
            <a href="https://app.flatch.ch" className="transition-colors hover:text-[#f3ede4]">
              App öffnen
            </a>
          </div>
          <p className="text-xs text-[#5f574e]">© {new Date().getFullYear()} flatch.</p>
        </div>
      </footer>
    </div>
  );
}
