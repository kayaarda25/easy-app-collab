import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, getMyProperties, updateMyProfile } from "@/lib/flatch.functions";
import { getMyEntitlement } from "@/lib/subscription.functions";
import { PLAN_INFO } from "@/lib/subscription";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/BottomNav";
import { LogOut, Plus, Settings, Pencil, Crown, ChevronRight, Camera, Loader2, Shield } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { VerificationBadges, VerificationChecklist } from "@/components/VerificationBadges";
import { ReviewsSection } from "@/components/Reviews";
import { isAdmin } from "@/lib/flatch.functions";

function PropertyStatusPill({ status }: { status?: string }) {
  if (!status || status === "approved") return null;
  const color: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700",
    rejected: "bg-destructive/15 text-destructive",
    flagged: "bg-rose-500/15 text-rose-700",
    draft: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize ${color[status] ?? "bg-muted"}`}>
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
  const fetchEnt = useServerFn(getMyEntitlement);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const props = useQuery({ queryKey: ["my-properties"], queryFn: () => fetchProps() });
  const ent = useQuery({ queryKey: ["entitlement"], queryFn: () => fetchEnt() });
  const checkAdmin = useServerFn(isAdmin);
  const admin = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin() });

  const verificationSource = {
    email_verified_at: profile.data?.email_verified_at,
    phone_verified_at: profile.data?.phone_verified_at,
    identity_verified_at: profile.data?.identity_verified_at,
    trusted_host: profile.data?.trusted_host,
    plan: ent.data?.effectivePlan,
    hasVerifiedProperty: (props.data ?? []).some((p) => p.verified_at),
  };

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  };

  return (
    <PageShell>
      <header className="flex items-center justify-between px-6 pt-8">
        <h1 className="text-3xl font-bold">Profile</h1>
        <button onClick={signOut} className="rounded-full p-2 hover:bg-secondary">
          <LogOut className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>

      <section className="px-6 pt-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="group relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary/20 to-accent"
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
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold">{profile.data?.display_name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{profile.data?.city}{profile.data?.city && profile.data?.country && ", "}{profile.data?.country}</p>
          </div>
          <button onClick={startEdit} className="rounded-full bg-secondary p-2">
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="input" placeholder="Name" />
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} className="input resize-none" placeholder="Bio" />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 rounded-full border border-border py-2 text-sm font-semibold">Cancel</button>
              <button onClick={save} className="flex-1 rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground">Save</button>
            </div>
          </div>
        ) : (
          profile.data?.bio && <p className="mt-4 text-sm text-muted-foreground">{profile.data.bio}</p>
        )}

        <VerificationBadges source={verificationSource} className="mt-4" />
      </section>

      {profile.data?.id && <ReviewsSection userId={profile.data.id} />}

      <section className="mt-8 px-6">
        <h2 className="text-lg font-semibold">Trust & verification</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          <VerificationChecklist source={verificationSource} />
        </div>
      </section>

      <section className="mt-8 px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My homes</h2>
          <button
            onClick={() => navigate({ to: "/property/new" })}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {(props.data ?? []).map((p) => (
            <div key={p.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                {p.property_images?.[0]?.url && <img src={p.property_images[0].url} alt="" className="h-full w-full object-cover" loading="lazy" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <PropertyStatusPill status={(p as any).status} />
                </div>
                <p className="text-xs text-muted-foreground">{p.city}, {p.country}</p>
                {(p as any).status === "rejected" && (p as any).review_notes && (
                  <p className="mt-1 text-[11px] text-destructive">Reviewer: {(p as any).review_notes}</p>
                )}
              </div>
            </div>
          ))}
          {(props.data ?? []).length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-border py-8 text-center text-sm text-muted-foreground">No homes yet</p>
          )}
        </div>
      </section>

      <section className="mt-8 px-6 pb-6">
        <h2 className="text-lg font-semibold">Settings</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          {admin.data === true && (
            <button
              onClick={() => navigate({ to: "/admin/properties" })}
              className="flex w-full items-center gap-3 border-b border-border p-4 text-left hover:bg-secondary/50"
            >
              <Shield className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Admin · Property review</p>
                <p className="text-xs text-muted-foreground">Approve, reject or flag listings</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <button
            onClick={() => navigate({ to: "/paywall" })}
            className="flex w-full items-center gap-3 border-b border-border p-4 text-left hover:bg-secondary/50"
          >
            <Crown className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{PLAN_INFO[ent.data?.effectivePlan ?? "basic"].name} plan</p>
              <p className="text-xs text-muted-foreground">
                {ent.data?.effectivePlan === "basic" ? "Upgrade for more homes & swipes" : `Status: ${ent.data?.status}`}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="border-b border-border">
            <TwoFactorSetup />
          </div>
          <div className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <Settings className="h-4 w-4" /> Notifications, language, payments — coming soon
          </div>
        </div>
      </section>
    </PageShell>
  );
}