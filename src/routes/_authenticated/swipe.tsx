import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { getSwipeFeed, recordSwipe } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { Search, Heart, X, Sparkles, Users, BedDouble, Bath } from "lucide-react";
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

function SwipePage() {
  const { city, country } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const feedFn = useServerFn(getSwipeFeed);
  const swipeFn = useServerFn(recordSwipe);
  const [index, setIndex] = useState(0);

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

  const current = feed.data?.[index];

  return (
    <PageShell>
      <header className="flex items-center justify-between px-6 pt-6">
        <button onClick={() => navigate({ to: "/search" })} className="rounded-full bg-secondary p-2">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-medium text-muted-foreground">
          {city ? `in ${city}` : "All homes"}
        </p>
        <div className="w-9" />
      </header>

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