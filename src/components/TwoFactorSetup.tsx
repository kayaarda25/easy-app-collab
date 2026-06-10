import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";

type Factor = { id: string; friendly_name?: string | null; status: string; factor_type: string };

export function TwoFactorSetup() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) toast.error(error.message);
    setFactors((data?.totp as Factor[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const verifiedFactor = factors.find((f) => f.status === "verified");

  const startEnroll = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${Date.now()}` });
    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? "Failed to start 2FA setup");
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verify = async () => {
    if (!enrolling) return;
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (chErr || !ch) { setBusy(false); return toast.error(chErr?.message ?? "Challenge failed"); }
    const { error } = await supabase.auth.mfa.verify({ factorId: enrolling.factorId, challengeId: ch.id, code });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Two-factor authentication enabled");
    setEnrolling(null);
    setCode("");
    refresh();
  };

  const cancelEnroll = async () => {
    if (!enrolling) return;
    await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    setEnrolling(null);
    setCode("");
    refresh();
  };

  const disable = async (factorId: string) => {
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Two-factor authentication disabled");
    refresh();
  };

  if (loading) return <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  if (enrolling) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm font-semibold">Scan this code with your authenticator app</p>
        <div className="flex justify-center rounded-xl bg-white p-3">
          <img src={enrolling.qr} alt="2FA QR code" className="h-44 w-44" />
        </div>
        <p className="text-center text-xs text-muted-foreground break-all">Or enter manually: <span className="font-mono">{enrolling.secret}</span></p>
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className="input text-center tracking-widest" />
        <div className="flex gap-2">
          <button onClick={cancelEnroll} disabled={busy} className="flex-1 rounded-full border border-border py-2 text-sm font-semibold">Cancel</button>
          <button onClick={verify} disabled={busy || code.length !== 6} className="flex-1 rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy && <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />}Verify</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {verifiedFactor ? (
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold">2FA is enabled</p>
            <p className="text-xs text-muted-foreground">Your account is protected with an authenticator app.</p>
          </div>
          <button onClick={() => disable(verifiedFactor.id)} disabled={busy} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold">Disable</button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <ShieldOff className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Two-factor authentication</p>
            <p className="text-xs text-muted-foreground">Add an extra layer of security using an authenticator app.</p>
          </div>
          <button onClick={startEnroll} disabled={busy} className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Enable</button>
        </div>
      )}
    </div>
  );
}