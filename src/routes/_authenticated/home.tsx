import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile, getMyProperties, getMyMatches } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { Compass, Heart, Plus, Sparkles } from "lucide-react";
import { Recommendations } from "@/components/Recommendations";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — flatch." }] }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchProps = useServerFn(getMyProperties);
  const fetchMatches = useServerFn(getMyMatches);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const properties = useQuery({ queryKey: ["my-properties"], queryFn: () => fetchProps() });
  const matches = useQuery({ queryKey: ["matches"], queryFn: () => fetchMatches() });

  useEffect(() => {
    if (profile.data && !profile.data.onboarded) {
      navigate({ to: "/onboarding" });
    }
  }, [profile.data, navigate]);

  return (
    <PageShell>
      <header className="px-6 pt-8 pb-4">
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {profile.data?.display_name ?? "Traveler"}
        </h1>
      </header>

      <section className="px-6">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-glow p-6 text-primary-foreground shadow-[var(--shadow-elegant)]">
          <Sparkles className="h-6 w-6 opacity-90" />
          <h2 className="mt-3 text-xl font-bold">Ready to swap?</h2>
          <p className="mt-1 text-sm opacity-90">Find your next home exchange in seconds.</p>
          <Link
            to="/search"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary"
          >
            <Compass className="h-4 w-4" />
            Start discovering
          </Link>
        </div>
      </section>

      <section className="mt-8 px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Your homes</h3>
          <Link
            to="/property/new"
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Link>
        </div>
        {properties.isLoading ? (
          <div className="mt-3 h-24 animate-pulse rounded-2xl bg-muted" />
        ) : (properties.data ?? []).length === 0 ? (
          <Link
            to="/property/new"
            className="mt-3 flex h-28 items-center justify-center rounded-2xl border-2 border-dashed border-border text-sm text-muted-foreground"
          >
            + List your first home
          </Link>
        ) : (
          <div className="mt-3 space-y-3">
            {(properties.data ?? []).map((p) => (
              <div key={p.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                  {p.property_images?.[0]?.url && (
                    <img src={p.property_images[0].url} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.city}, {p.country}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Recommendations currentUserId={profile.data?.id} />

      <section className="mt-8 px-6">
        <h3 className="text-lg font-semibold">Recent matches</h3>
        {(matches.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No matches yet — start swiping!</p>
        ) : (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {(matches.data ?? []).slice(0, 5).map((m) => (
              <Link key={m.id} to="/chat/$matchId" params={{ matchId: m.id }} className="flex w-24 flex-shrink-0 flex-col items-center">
                <div className="h-16 w-16 overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-accent">
                  {m.other_user?.avatar_url && (
                    <img src={m.other_user.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                <p className="mt-1 truncate text-xs">{m.other_user?.display_name ?? "User"}</p>
              </Link>
            ))}
            <Link to="/matches" className="flex w-24 flex-shrink-0 flex-col items-center justify-center text-xs text-primary">
              <Heart className="h-5 w-5" /> See all
            </Link>
          </div>
        )}
      </section>
    </PageShell>
  );
}