import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/BottomNav";
import { Search as SearchIcon, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — flatch." }] }),
  component: SearchPage,
});

const SUGGESTIONS = ["Paris", "Lisbon", "Tokyo", "New York", "Barcelona", "Bali", "Cape Town", "Mexico City"];

function SearchPage() {
  const navigate = useNavigate();
  const [city, setCity] = useState("");

  const go = (c?: string) => {
    navigate({ to: "/swipe", search: { city: c ?? city } });
  };

  return (
    <PageShell>
      <header className="px-6 pt-8 pb-2">
        <h1 className="text-3xl font-bold tracking-tight">Where to?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Discover homes worldwide.</p>
      </header>

      <div className="px-6 mt-4">
        <form onSubmit={(e) => { e.preventDefault(); go(); }} className="relative">
          <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Search a city or country"
            className="w-full rounded-full border border-border bg-card py-3.5 pl-12 pr-4 text-sm shadow-[var(--shadow-card)] focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </form>
      </div>

      <section className="mt-8 px-6">
        <h2 className="text-sm font-semibold text-muted-foreground">Popular destinations</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => go(s)}
              className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
            >
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{s}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-8 px-6">
        <button
          onClick={() => go("")}
          className="w-full rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground"
        >
          Browse all homes
        </button>
      </div>
    </PageShell>
  );
}