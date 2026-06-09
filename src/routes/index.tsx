import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Home, MessageCircle, Sparkles } from "lucide-react";

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

function Welcome() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/40" />
        <div className="relative mx-auto max-w-md px-6 pt-16 pb-12 md:max-w-3xl md:pt-24">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground font-bold text-lg">
              f
            </div>
            <span className="text-xl font-bold tracking-tight">flatch.</span>
          </div>

          <h1 className="mt-12 text-4xl font-bold tracking-tight md:text-6xl">
            Swap your home,<br />
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              see the world.
            </span>
          </h1>
          <p className="mt-5 text-base text-muted-foreground md:text-lg">
            Premium home exchange with verified members. Skip the hotel — live like a local.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition hover:bg-primary/90"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="inline-flex items-center justify-center rounded-full border border-border bg-background px-6 py-3.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
              Log in
            </Link>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="mx-auto max-w-md px-6 py-12 md:max-w-3xl">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Home, title: "List your home", body: "Photos, dates, amenities. Done in minutes." },
            { icon: Sparkles, title: "Swipe & match", body: "Discover homes worldwide. Match when you both like." },
            { icon: MessageCircle, title: "Chat & swap", body: "Plan dates, agree, swap. All in one place." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} flatch. — Made for travelers.
      </footer>
    </div>
  );
}
