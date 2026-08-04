import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile, getMyProperties, getReviewableProposals } from "@/lib/flatch.functions";
import { PageShell } from "@/components/BottomNav";
import { Compass, Sparkles, Star } from "lucide-react";
import { HomeFeed } from "@/components/HomeFeed";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Logo } from "@/components/Logo";
import { useEffect } from "react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — flatch." }] }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { t } = useT();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchProps = useServerFn(getMyProperties);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const properties = useQuery({ queryKey: ["my-properties"], queryFn: () => fetchProps() });
  const reviewableFn = useServerFn(getReviewableProposals);
  const reviewable = useQuery({ queryKey: ["reviewable"], queryFn: () => reviewableFn() });
  const pendingReviews = (reviewable.data ?? []).filter(
    (p: any) => !p.already_reviewed || (p.stayed_at && !p.property_reviewed),
  ).length;

  useEffect(() => {
    if (profile.data && !profile.data.onboarded) {
      navigate({ to: "/onboarding" });
    }
  }, [profile.data, navigate]);

  return (
    <PageShell>
      <header className="px-6 pt-8 pb-4">
        <Logo size={28} className="mb-3" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{t("home.welcome")}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {profile.data?.display_name ?? t("home.traveler")}
            </h1>
          </div>
          <NotificationsBell />
        </div>
      </header>

      {pendingReviews > 0 && (
        <section className="px-6">
          <Link
            to="/reviews"
            className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-semibold">
                {pendingReviews} {t(pendingReviews === 1 ? "pending review" : "pending reviews")}
              </span>
            </div>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{t("Review now")} →</span>
          </Link>
        </section>
      )}

      <div className="mt-8">
        <HomeFeed city={(properties.data ?? [])[0]?.city ?? null} />
      </div>
    </PageShell>
  );
}