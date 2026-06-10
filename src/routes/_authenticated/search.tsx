import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/BottomNav";
import { Search as SearchIcon, MapPin, Lock, Crown, X, Bed, Bath, Users, Home } from "lucide-react";
import { getMyEntitlement } from "@/lib/subscription.functions";
import { getAllPropertyLocations } from "@/lib/flatch.functions";
import { PropertiesMap } from "@/components/PropertiesMap";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — flatch." }] }),
  component: SearchPage,
});

const SUGGESTIONS = ["Paris", "Lisbon", "Tokyo", "New York", "Barcelona", "Bali", "Cape Town", "Mexico City"];

type PropertyLocation = {
  id: string;
  title: string;
  description?: string | null;
  city: string;
  country: string;
  street?: string | null;
  house_number?: string | null;
  zip_code?: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  property_type?: string | null;
  bedrooms?: number | null;
  beds?: number | null;
  bathrooms?: number | null;
  max_guests?: number | null;
  amenities?: string[] | null;
  property_images?: { url: string; position: number }[];
};

function SearchPage() {
  const navigate = useNavigate();
  const [city, setCity] = useState("");
  const [selected, setSelected] = useState<PropertyLocation | null>(null);
  const fetchEnt = useServerFn(getMyEntitlement);
  const fetchLocations = useServerFn(getAllPropertyLocations);
  const ent = useQuery({ queryKey: ["entitlement"], queryFn: () => fetchEnt() });
  const locations = useQuery({
    queryKey: ["property-locations"],
    queryFn: () => fetchLocations(),
  });
  const isPremium = ent.data?.effectivePlan === "premium";

  const go = (c?: string) => {
    navigate({ to: "/swipe", search: { city: c ?? city } });
  };

  const points = (locations.data ?? []) as PropertyLocation[];

  const openDetail = (p: PropertyLocation) => setSelected(p);

  return (
    <PageShell>
      <header className="px-6 pt-8 pb-2">
        <h1 className="text-3xl font-bold tracking-tight">Where to?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Discover homes worldwide.</p>
      </header>

      <div className="px-6 mt-4">
        {isPremium ? (
          <form onSubmit={(e) => { e.preventDefault(); go(); }} className="relative">
            <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Search a city or country"
              className="w-full rounded-full border border-border bg-card py-3.5 pl-12 pr-4 text-sm shadow-[var(--shadow-card)] focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </form>
        ) : (
          <Link
            to="/paywall"
            className="relative flex w-full items-center gap-3 rounded-full border border-border bg-card py-3.5 pl-12 pr-4 text-sm shadow-[var(--shadow-card)]"
          >
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <span className="text-muted-foreground">Search is a Premium feature</span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-primary-glow px-2.5 py-1 text-xs font-semibold text-primary-foreground">
              <Crown className="h-3 w-3" /> Premium
            </span>
          </Link>
        )}
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

      <section className="mt-10 px-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">All homes on flatch.</h2>
          <span className="text-xs text-muted-foreground">
            {points.length} listed
          </span>
        </div>
        <div className="mt-3">
          <PropertiesMap
            points={points}
            style={{ height: 320 }}
            onSelect={openDetail}
          />
          {points.length > 0 && (
            <ul className="mt-3 space-y-2">
              {points.slice(0, 8).map((p) => {
                const addr = [
                  [p.street, p.house_number].filter(Boolean).join(" "),
                  [p.zip_code, p.city].filter(Boolean).join(" "),
                  p.country,
                ].filter(Boolean).join(", ");
                return (
                  <li
                    key={p.id}
                    onClick={() => openDetail(p)}
                    className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm cursor-pointer transition hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{addr || `${p.city}, ${p.country}`}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <div className="mt-8 px-6 pb-8">
        <button
          onClick={() => go("")}
          className="w-full rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground"
        >
          Browse all homes
        </button>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="relative h-48 w-full bg-muted">
              {selected.property_images && selected.property_images.length > 0 ? (
                <img
                  src={selected.property_images[0].url}
                  alt={selected.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Home className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}
              <button
                onClick={() => setSelected(null)}
                className="absolute right-3 top-3 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 pb-5 pt-3">
              <DialogHeader className="text-left">
                <DialogTitle className="text-lg font-semibold leading-tight">{selected.title}</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  {[
                    [selected.street, selected.house_number].filter(Boolean).join(" "),
                    [selected.zip_code, selected.city].filter(Boolean).join(" "),
                    selected.country,
                  ].filter(Boolean).join(", ") || `${selected.city}, ${selected.country}`}
                </DialogDescription>
              </DialogHeader>

              {selected.description && (
                <p className="mt-3 text-sm text-foreground/80 line-clamp-3">{selected.description}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {selected.bedrooms != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    <Bed className="h-3.5 w-3.5" /> {selected.bedrooms} {selected.bedrooms === 1 ? "Bedroom" : "Bedrooms"}
                  </span>
                )}
                {selected.beds != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    <Bed className="h-3.5 w-3.5" /> {selected.beds} {selected.beds === 1 ? "Bed" : "Beds"}
                  </span>
                )}
                {selected.bathrooms != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    <Bath className="h-3.5 w-3.5" /> {selected.bathrooms} {selected.bathrooms === 1 ? "Bath" : "Baths"}
                  </span>
                )}
                {selected.max_guests != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    <Users className="h-3.5 w-3.5" /> {selected.max_guests} {selected.max_guests === 1 ? "Guest" : "Guests"}
                  </span>
                )}
                {selected.property_type && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Home className="h-3.5 w-3.5" /> {selected.property_type}
                  </span>
                )}
              </div>

              {selected.amenities && selected.amenities.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground">Amenities</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selected.amenities.slice(0, 10).map((a) => (
                      <span key={a} className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        {a}
                      </span>
                    ))}
                    {selected.amenities.length > 10 && (
                      <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        +{selected.amenities.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setSelected(null);
                  navigate({ to: "/swipe", search: { city: selected.city } });
                }}
                className="mt-5 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
              >
                View in Swipe Feed
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </PageShell>
  );
}
