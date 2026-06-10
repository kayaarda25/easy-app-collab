import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyProfile,
  getMyProperties,
  updateMyProfile,
  listRecommendations,
  getReviewsForUser,
} from "@/lib/flatch.functions";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/BottomNav";
import {
  Camera,
  Grid3x3,
  Home as HomeIcon,
  Loader2,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  Star,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { VerificationBadges } from "@/components/VerificationBadges";

function PropertyStatusPill({ status }: { status?: string }) {
  if (!status || status === "approved") return null;
  const color: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700",
    rejected: "bg-destructive/15 text-destructive",
    flagged: "bg-rose-500/15 text-rose-700",
    draft: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold capitalize ${color[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
}

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — flatch." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchProps = useServerFn(getMyProperties);
  const updateFn = useServerFn(updateMyProfile);
  const fetchRecos = useServerFn(listRecommendations);
  const fetchReviews = useServerFn(getReviewsForUser);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const props = useQuery({ queryKey: ["my-properties"], queryFn: () => fetchProps() });
  const recos = useQuery({ queryKey: ["recommendations"], queryFn: () => fetchRecos() });
  const reviews = useQuery({
    queryKey: ["reviews", profile.data?.id],
    queryFn: () => fetchReviews({ data: { userId: profile.data!.id } }),
    enabled: !!profile.data?.id,
  });

  const verificationSource = {
    email_verified_at: profile.data?.email_verified_at,
    phone_verified_at: profile.data?.phone_verified_at,
    identity_verified_at: profile.data?.identity_verified_at,
    trusted_host: profile.data?.trusted_host,
    plan: undefined,
    hasVerifiedProperty: (props.data ?? []).some((p) => p.verified_at),
  };

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [tab, setTab] = useState<"posts" | "homes">("posts");
  const fileRef = useRef<HTMLInputElement>(null);

  const myRecos = useMemo(
    () => (recos.data ?? []).filter((r: any) => r.user_id === profile.data?.id),
    [recos.data, profile.data?.id],
  );

  const startEdit = () => {
    setName(profile.data?.display_name ?? "");
    setBio(profile.data?.bio ?? "");
    setEditing(true);
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${u.user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr || !signed) throw sErr ?? new Error("Failed to sign URL");
      await updateFn({ data: { avatar_url: signed.signedUrl } });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const save = async () => {
    await updateFn({ data: { display_name: name, bio } });
    qc.invalidateQueries({ queryKey: ["profile"] });
    setEditing(false);
    toast.success("Profile updated");
  };

  return (
    <PageShell>
      <header className="flex items-center justify-between px-6 pt-8 pb-2">
        <h1 className="truncate text-xl font-bold">
          {profile.data?.display_name ?? "Profile"}
        </h1>
        <button
          onClick={() => navigate({ to: "/settings" })}
          className="rounded-full p-2 hover:bg-secondary"
          aria-label="Settings"
        >
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>

      {/* Insta-style profile head: avatar + counters */}
      <section className="px-6 pt-4">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="group relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary/30 to-accent ring-2 ring-primary/40"
          >
            {profile.data?.avatar_url ? (
              <img src={profile.data.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera className="m-auto h-7 w-7 text-muted-foreground" />
            )}
            {uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {!uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-6 w-6 text-white" />
              </div>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />

          <div className="flex flex-1 items-center justify-around text-center">
            <Stat label="Posts" value={myRecos.length} />
            <Stat label="Homes" value={(props.data ?? []).length} />
            <Stat label="Reviews" value={reviews.data?.count ?? 0} />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-base font-semibold">{profile.data?.display_name ?? "—"}</p>
          {(profile.data?.city || profile.data?.country) && (
            <p className="text-sm text-muted-foreground">
              {profile.data?.city}
              {profile.data?.city && profile.data?.country && ", "}
              {profile.data?.country}
            </p>
          )}
          {editing ? (
            <div className="mt-3 space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="input" placeholder="Name" />
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} className="input resize-none" placeholder="Bio" />
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="flex-1 rounded-full border border-border py-2 text-sm font-semibold">Cancel</button>
                <button onClick={save} className="flex-1 rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground">Save</button>
              </div>
            </div>
          ) : (
            profile.data?.bio && <p className="mt-1.5 whitespace-pre-line text-sm">{profile.data.bio}</p>
          )}

          <VerificationBadges source={verificationSource} className="mt-3" />

          <div className="mt-4 flex gap-2">
            <button
              onClick={startEdit}
              className="flex-1 rounded-lg bg-secondary py-1.5 text-sm font-semibold"
            >
              <Pencil className="mr-1 inline h-3.5 w-3.5" /> Edit profile
            </button>
            <button
              onClick={() => navigate({ to: "/property/new" })}
              className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-semibold"
              aria-label="Add home"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="mt-6 grid grid-cols-2 border-y border-border">
        <button
          onClick={() => setTab("posts")}
          className={`flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider transition ${
            tab === "posts" ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground"
          }`}
        >
          <Grid3x3 className="h-4 w-4" /> Posts
        </button>
        <button
          onClick={() => setTab("homes")}
          className={`flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider transition ${
            tab === "homes" ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground"
          }`}
        >
          <HomeIcon className="h-4 w-4" /> Homes
        </button>
      </div>

      {/* Grid */}
      {tab === "posts" ? (
        myRecos.length === 0 ? (
          <EmptyState
            icon={Grid3x3}
            title="No posts yet"
            subtitle="Share your favorite spots from the Home tab"
          />
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {myRecos.map((r: any) => (
              <div key={r.id} className="relative aspect-square overflow-hidden bg-muted">
                {r.video_url ? (
                  <video src={r.video_url} className="h-full w-full object-cover" muted playsInline preload="metadata" poster={r.image_url ?? undefined} />
                ) : r.image_url ? (
                  <img src={r.image_url} alt={r.title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/30 p-2 text-center text-xs font-semibold">
                    {r.title}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (props.data ?? []).length === 0 ? (
        <EmptyState
          icon={HomeIcon}
          title="No homes yet"
          subtitle="Add your first home to start swapping"
          action={{ label: "Add home", onClick: () => navigate({ to: "/property/new" }) }}
        />
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {(props.data ?? []).map((p: any) => (
            <div key={p.id} className="relative aspect-square overflow-hidden bg-muted">
              {p.property_images?.[0]?.url ? (
                <img src={p.property_images[0].url} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/30 p-2 text-center text-xs font-semibold">
                  {p.title}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                <p className="truncate text-[10px] font-semibold text-white">{p.city}</p>
                <PropertyStatusPill status={p.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {reviews.data && reviews.data.count > 0 && (
        <section className="mt-8 flex items-center justify-center gap-1.5 px-6 pb-6 text-sm text-muted-foreground">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-semibold text-foreground">{reviews.data.average.toFixed(1)}</span>
          <span>· {reviews.data.count} reviews</span>
        </section>
      )}
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-bold leading-tight">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="rounded-full border-2 border-foreground/80 p-4">
        <Icon className="h-8 w-8" />
      </div>
      <p className="mt-4 text-lg font-semibold">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}