import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile, getMyProperties } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { Compass, Sparkles } from "lucide-react";
import { HomeFeed } from "@/components/HomeFeed";
import { NotificationsBell } from "@/components/NotificationsBell";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — flatch." }] }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchProps = useServerFn(getMyProperties);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const properties = useQuery({ queryKey: ["my-properties"], queryFn: () => fetchProps() });

  useEffect(() => {
    if (profile.data && !profile.data.onboarded) {
      navigate({ to: "/onboarding" });
    }
  }, [profile.data, navigate]);

  return (
    <PageShell>
      <header className="px-6 pt-8 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {profile.data?.display_name ?? "Traveler"}
            </h1>
          </div>
          <NotificationsBell />
        </div>
      </header>

      <section className="px-6">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-glow p-6 text-primary-foreground shadow-[var(--shadow-elegant)]">
          <Sparkles className="h-6 w-6 opacity-90" />
          <h2 className="mt-3 text-xl font-bold">Ready to swap?</h2>
          <p className="mt-1 text-sm opacity-90">Find your next home exchange in seconds.</p>
          <Link
            to="/swipe"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary"
          >
            <Compass className="h-4 w-4" />
            Start discovering
          </Link>
        </div>
      </section>

      <div className="mt-8">
        <HomeFeed city={(properties.data ?? [])[0]?.city ?? null} />
      </div>
    </PageShell>
  );
}