import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { updateMyProfile } from "@/lib/flatch.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — flatch." }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const update = useServerFn(updateMyProfile);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);

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
      setAvatarUrl(signed.signedUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await update({
        data: {
          display_name: displayName,
          city: city || null,
          country: country || null,
          bio: bio || null,
          avatar_url: avatarUrl,
          onboarded: true,
        },
      });
      toast.success("Profile saved");
      navigate({ to: "/property/new" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-md">
        <p className="text-sm text-primary font-semibold">Step 1 of 2</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Tell us about yourself</h1>
        <p className="mt-2 text-sm text-muted-foreground">This helps other members get to know you.</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="flex flex-col items-center gap-2 pb-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="group relative h-24 w-24 overflow-hidden rounded-full border-2 border-dashed border-border bg-secondary"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera className="m-auto h-7 w-7 text-muted-foreground" />
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            <p className="text-xs text-muted-foreground">
              {avatarUrl ? "Tap to change" : "Add a profile photo (optional)"}
            </p>
          </div>

          <Field label="Your name" required>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={80} className="input" placeholder="Anna Schmidt" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City"><input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className="input" placeholder="Berlin" /></Field>
            <Field label="Country"><input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={80} className="input" placeholder="Germany" /></Field>
          </div>
          <Field label="Short bio">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={4} className="input resize-none" placeholder="A traveler who loves hosting." />
          </Field>

          <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Continue
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}