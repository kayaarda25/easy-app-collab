import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/BottomNav";
import { Search as SearchIcon, MapPin, Lock, Crown, X, Bed, Bath, Users, Home, SlidersHorizontal, Star, ShieldCheck } from "lucide-react";
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
  beforeLoad: async () => {
    const { redirect, isRedirect } = await import("@tanstack/react-router");
    const { getMyEntitlement } = await import("@/lib/subscription.functions");
    try {
      const ent = await getMyEntitlement();
      if (ent?.effectivePlan !== "premium") {
        throw redirect({ to: "/paywall" });
      }
    } catch (e: any) {
      if (isRedirect(e)) throw e;
      throw redirect({ to: "/paywall" });
    }
  },
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
  verified_at?: string | null;
  owner_rating?: number | null;
  owner_review_count?: number | null;
  property_images?: { url: string; position: number }[];
};

type Filters = {
  minBedrooms: number;
  minGuests: number;
  wifi: boolean;
  pets: boolean;
  smoking: boolean;
  workspace: boolean;
  minRating: number;
  verifiedOnly: boolean;
};

const DEFAULT_FILTERS: Filters = {
  minBedrooms: 0,
  minGuests: 0,
  wifi: false,
  pets: false,
  smoking: false,
  workspace: false,
  minRating: 0,
  verifiedOnly: false,
};

const hasAmenity = (amenities: string[] | null | undefined, pattern: RegExp) =>
  (amenities ?? []).some((a) => pattern.test(a));

const AMENITY_PATTERNS = {
  wifi: /wi[\s-]?fi|internet|wlan/i,
  pets: /pet/i,
  smoking: /smok/i,
  workspace: /workspace|work\s?space|desk|office/i,
};

function SearchPage() {
  const navigate = useNavigate();
  const [city, setCity] = useState("");
  const [selected, setSelected] = useState<PropertyLocation | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  const allPoints = (locations.data ?? []) as PropertyLocation[];

  const points = useMemo(() => {
    return allPoints.filter((p) => {
      if (filters.minBedrooms && (p.bedrooms ?? 0) < filters.minBedrooms) return false;
      if (filters.minGuests && (p.max_guests ?? 0) < filters.minGuests) return false;
      if (filters.wifi && !hasAmenity(p.amenities, AMENITY_PATTERNS.wifi)) return false;
      if (filters.pets && !hasAmenity(p.amenities, AMENITY_PATTERNS.pets)) return false;
      if (filters.smoking && !hasAmenity(p.amenities, AMENITY_PATTERNS.smoking)) return false;
      if (filters.workspace && !hasAmenity(p.amenities, AMENITY_PATTERNS.workspace)) return false;
      if (filters.minRating > 0 && (p.owner_rating ?? 0) < filters.minRating) return false;
      if (filters.verifiedOnly && !p.verified_at) return false;
      return true;
    });
  }, [allPoints, filters]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.minBedrooms) n++;
    if (filters.minGuests) n++;
    if (filters.wifi) n++;
    if (filters.pets) n++;
    if (filters.smoking) n++;
    if (filters.workspace) n++;
    if (filters.minRating > 0) n++;
    if (filters.verifiedOnly) n++;
    return n;
  }, [filters]);

  const openDetail = (p: PropertyLocation) => setSelected(p);

  return (
    <PageShell>
      <header className="px-6 pt-8 pb-2">
        <h1 className="text-3xl font-bold tracking-tight">Where to?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Discover homes worldwide.</p>
      </header>

      <div className="px-6 mt-4">
        {isPremium ? (
          <div className="flex items-center gap-2">
            <form onSubmit={(e) => { e.preventDefault(); go(); }} className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Search a city or country"
                className="w-full rounded-full border border-border bg-card py-3.5 pl-12 pr-4 text-sm shadow-[var(--shadow-card)] focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </form>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="relative flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-[var(--shadow-card)] transition hover:border-primary/40"
              aria-label="Filters"
            >
              <SlidersHorizontal className="h-5 w-5" />
              {activeCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </button>
          </div>
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
            {points.length} of {allPoints.length} listed
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

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {selected.verified_at && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
                {selected.owner_rating != null && (selected.owner_review_count ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium">
                    <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
                    {selected.owner_rating.toFixed(1)}
                    <span className="text-muted-foreground">({selected.owner_review_count})</span>
                  </span>
                )}
              </div>

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

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border bg-card">
          <DialogHeader className="text-left">
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>Refine the homes you see on the map.</DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Bedrooms (min)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, minBedrooms: n }))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      filters.minBedrooms === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary/40"
                    }`}
                  >
                    {n === 0 ? "Any" : `${n}+`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">Max guests (min)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 1, 2, 4, 6, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, minGuests: n }))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      filters.minGuests === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary/40"
                    }`}
                  >
                    {n === 0 ? "Any" : `${n}+`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">Amenities</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([
                  ["wifi", "Wi-Fi"],
                  ["pets", "Pets allowed"],
                  ["smoking", "Smoking allowed"],
                  ["workspace", "Workspace"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                      filters[key]
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground hover:border-primary/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">Min host rating</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 3, 3.5, 4, 4.5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, minRating: n }))}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      filters.minRating === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary/40"
                    }`}
                  >
                    {n === 0 ? "Any" : (<><Star className="h-3 w-3 fill-current" /> {n}+</>)}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Verified listings only
              </span>
              <input
                type="checkbox"
                checked={filters.verifiedOnly}
                onChange={(e) => setFilters((f) => ({ ...f, verifiedOnly: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
            </label>
          </div>

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Show {points.length} homes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
