import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPublicProfile } from "@/lib/flatch.functions";
import { ArrowLeft, BadgeCheck, MapPin, Star, Home as HomeIcon, Languages } from "lucide-react";

export const Route = createFileRoute("/_authenticated/u/$userId")({
  head: () => ({ meta: [{ title: "Profile — flatch." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getPublicProfile);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: () => fetchProfile({ data: { user_id: userId } }),
  });

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (error || !data?.profile) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">Profile not available.</p>
      </div>
    );
  }

  const p = data.profile;
  const verified = !!(p.email_verified_at || p.identity_verified_at);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate({ to: ".." as any })} className="rounded-full p-1.5 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Profile</h1>
      </header>

      <div className="mx-auto max-w-md px-5 py-6">
        <div className="flex flex-col items-center text-center">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-accent">
            {p.avatar_url && <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <h2 className="text-xl font-bold">{p.display_name ?? "Traveler"}</h2>
            {verified && <BadgeCheck className="h-5 w-5 text-primary" />}
          </div>
          {(p.city || p.country) && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {[p.city, p.country].filter(Boolean).join(", ")}
            </p>
          )}
          {data.rating_avg !== null && (
            <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold">
              <Star className="h-4 w-4 fill-current text-yellow-500" />
              {data.rating_avg.toFixed(1)}
              <span className="font-normal text-muted-foreground">({data.rating_count})</span>
            </p>
          )}
        </div>

        {p.bio && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">About</h3>
            <p className="mt-2 whitespace-pre-line text-sm">{p.bio}</p>
          </section>
        )}

        {p.languages && p.languages.length > 0 && (
          <section className="mt-4 rounded-2xl border border-border bg-card p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Languages className="h-3.5 w-3.5" /> Languages
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.languages.map((l: string) => (
                <span key={l} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">{l}</span>
              ))}
            </div>
          </section>
        )}

        {data.properties.length > 0 && (
          <section className="mt-4">
            <h3 className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <HomeIcon className="h-3.5 w-3.5" /> Homes
            </h3>
            <div className="space-y-3">
              {data.properties.map((prop: any) => {
                const img = (prop.property_images ?? []).sort((a: any, b: any) => a.position - b.position)[0]?.url;
                return (
                  <div key={prop.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                    {img && <img src={img} alt={prop.title} className="aspect-[16/10] w-full object-cover" />}
                    <div className="p-3">
                      <p className="font-semibold">{prop.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[prop.city, prop.country].filter(Boolean).join(", ")} · {prop.bedrooms} bd · {prop.max_guests} guests
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {data.reviews.length > 0 && (
          <section className="mt-4">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reviews</h3>
            <div className="space-y-3">
              {data.reviews.map((r: any, i: number) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    <Star className="h-4 w-4 fill-current text-yellow-500" /> {r.rating}
                  </div>
                  {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}