import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { updateMyProfile } from "@/lib/flatch.functions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — flatch." }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const update = useServerFn(updateMyProfile);
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);

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