import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { getSwipeFeed, recordSwipe } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { Search, Heart, X, Sparkles, Users, BedDouble, Bath, SlidersHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const search = z.object({
  city: z.string().optional(),
  country: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/swipe")({
  head: () => ({ meta: [{ title: "Discover — flatch." }] }),
  validateSearch: search,
  component: SwipePage,
});

type SwipeFilters = {
  minBedrooms: number;
  minGuests: number;
  wifi: boolean;
  pets: boolean;
  workspace: boolean;
  propertyType: string;
};

const DEFAULT_SWIPE_FILTERS: SwipeFilters = {
  minBedrooms: 0,
  minGuests: 0,
  wifi: false,
  pets: false,
  workspace: false,
  propertyType: "",
};

const AMENITY_RE = {
  wifi: /wi[\s-]?fi|internet|wlan/i,
  pets: /pet/i,
  workspace: /workspace|work\s?space|desk|office/i,
};
const matchesAmenity = (a: string[] | null | undefined, re: RegExp) =>
  (a ?? []).some((x) => re.test(x));

function SwipePage() {
  const { city, country } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const feedFn = useServerFn(getSwipeFeed);
  const swipeFn = useServerFn(recordSwipe);
  const [index, setIndex] = useState(0);
  const [filters, setFilters] = useState<SwipeFilters>(DEFAULT_SWIPE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const feed = useQuery({
    queryKey: ["feed", city ?? "", country ?? ""],
    queryFn: () => feedFn({ data: { city, country } }),
  });

  const swipe = useMutation({
    mutationFn: (vars: { property_id: string; direction: "like" | "pass" }) =>
      swipeFn({ data: vars }),
    onSuccess: (result) => {
      if (result.matched) {
        toast.success("It's a match! 🎉", { duration: 4000 });
        qc.invalidateQueries({ queryKey: ["matches"] });
      }
      setIndex((i) => i + 1);
    },
  });

  const filtered = useMemo(() => {
    const list = (feed.data ?? []) as any[];
    return list.filter((p) => {
      if (filters.minBedrooms && (p.bedrooms ?? 0) < filters.minBedrooms) return false;
      if (filters.minGuests && (p.max_guests ?? 0) < filters.minGuests) return false;
      if (filters.wifi && !matchesAmenity(p.amenities, AMENITY_RE.wifi)) return false;
      if (filters.pets && !matchesAmenity(p.amenities, AMENITY_RE.pets)) return false;
      if (filters.workspace && !matchesAmenity(p.amenities, AMENITY_RE.workspace)) return false;
      if (filters.propertyType && p.property_type !== filters.propertyType) return false;
      return true;
    });
  }, [feed.data, filters]);

  const activeCount =
    (filters.minBedrooms ? 1 : 0) +
    (filters.minGuests ? 1 : 0) +
    (filters.wifi ? 1 : 0) +
    (filters.pets ? 1 : 0) +
    (filters.workspace ? 1 : 0) +
    (filters.propertyType ? 1 : 0);

  const current = filtered[index];

  return (
    <PageShell>
      <header className="flex items-center justify-between px-6 pt-6">
        <h1 className="text-xl font-bold tracking-tight">Discover</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition hover:bg-secondary/80"
            aria-label="Filters"
          >
            <SlidersHorizontal className="h-5 w-5" />
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </button>
          <Link
            to="/search"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition hover:bg-secondary/80"
          >
            <Search className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <div className="px-6 pt-2">
        <p className="text-sm text-muted-foreground">
          {city ? `Showing homes in ${city}` : "All homes worldwide"}
          {activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      <div className="px-6 pt-4">
        {feed.isLoading ? (
          <div className="h-[480px] animate-pulse rounded-3xl bg-muted" />
        ) : !current ? (
          <EmptyState />
        ) : (
          <SwipeCard
            property={current}
            onLike={() => swipe.mutate({ property_id: current.id, direction: "like" })}
            onPass={() => swipe.mutate({ property_id: current.id, direction: "pass" })}
            busy={swipe.isPending}
          />
        )}
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border bg-card">
          <DialogHeader className="text-left">
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>Refine the homes in your swipe feed.</DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Bedrooms (min)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setFilters((f) => ({ ...f, minBedrooms: n })); setIndex(0); }}
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
                    onClick={() => { setFilters((f) => ({ ...f, minGuests: n })); setIndex(0); }}
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
              <p className="text-xs font-medium text-muted-foreground">Property type</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["", "apartment", "house", "loft", "studio", "villa"].map((t) => (
                  <button
                    key={t || "any"}
                    type="button"
                    onClick={() => { setFilters((f) => ({ ...f, propertyType: t })); setIndex(0); }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
                      filters.propertyType === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary/40"
                    }`}
                  >
                    {t || "Any"}
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
                  ["workspace", "Workspace"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setFilters((f) => ({ ...f, [key]: !f[key] })); setIndex(0); }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      filters[key]
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => { setFilters(DEFAULT_SWIPE_FILTERS); setIndex(0); }}
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground"
              >
                Show {filtered.length} home{filtered.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function SwipeCard({
  property,
  onLike,
  onPass,
  busy,
}: {
  property: any;
  onLike: () => void;
  onPass: () => void;
  busy: boolean;
}) {
  const cover = property.property_images?.sort((a: any, b: any) => a.position - b.position)?.[0]?.url;
  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl bg-muted shadow-[var(--shadow-card)]">
        <div className="aspect-[3/4] w-full bg-gradient-to-br from-accent to-primary/20">
          {cover && <img src={cover} alt={property.title} className="h-full w-full object-cover" loading="eager" />}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5 text-white">
          <h2 className="text-2xl font-bold leading-tight">{property.title}</h2>
          <p className="mt-0.5 text-sm opacity-90">{property.city}, {property.country}</p>
          <div className="mt-3 flex items-center gap-3 text-xs opacity-90">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {property.max_guests}</span>
            <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {property.beds}</span>
            <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {property.bathrooms}</span>
          </div>
        </div>
      </div>

      {property.description && (
        <p className="mt-4 line-clamp-3 px-1 text-sm text-muted-foreground">{property.description}</p>
      )}

      <div className="mt-6 flex items-center justify-center gap-6">
        <button
          onClick={onPass}
          disabled={busy}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-card shadow-[var(--shadow-card)] transition hover:scale-105 disabled:opacity-50"
        >
          <X className="h-7 w-7 text-muted-foreground" />
        </button>
        <button
          onClick={onLike}
          disabled={busy}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow shadow-[var(--shadow-elegant)] transition hover:scale-105 disabled:opacity-50"
        >
          <Heart className="h-9 w-9 text-white" fill="white" />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mt-4 text-xl font-bold">No more homes</h2>
      <p className="mt-1 text-sm text-muted-foreground">Check back later or try another location.</p>
      <Link to="/search" className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
        New search
      </Link>
    </div>
  );
}