import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).default("signup"),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — flatch." },
      { name: "description", content: "Sign in or create your flatch. account." },
    ],
  }),
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  const checkMfaAfterLogin = async () => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.find((f) => f.status === "verified");
      if (factor) {
        const { data: ch, error } = await supabase.auth.mfa.challenge({ factorId: factor.id });
        if (error || !ch) {
          toast.error(error?.message ?? "MFA challenge failed");
          return false;
        }
        setMfaChallenge({ factorId: factor.id, challengeId: ch.id });
        return true;
      }
    }
    return false;
  };

  const submitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge) return;
    setLoading(true);
    const { error } = await supabase.auth.mfa.verify({ ...mfaChallenge, code: mfaCode });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/home" });
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/home" },
        });
        if (error) throw error;
        toast.success("Check your email to verify your account before signing in.");
        setIsSignup(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (await checkMfaAfterLogin()) return;
        navigate({ to: "/home" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/home",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/home" });
  };

  const handleApple = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin + "/home",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Apple sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/home" });
  };

  const handleReset = async () => {
    if (!email) {
      toast.error("Enter your email first");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-accent/40 via-background to-background px-6 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2">
          <Logo size={40} withWordmark wordmarkClassName="text-xl" />
        </Link>

        {mfaChallenge ? (
          <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <h1 className="text-2xl font-bold tracking-tight">Two-factor code</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
            <form onSubmit={submitMfa} className="mt-6 space-y-3">
              <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoFocus placeholder="123456" className="w-full rounded-xl border border-input bg-background px-4 py-3 text-center text-lg tracking-widest focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30" />
              <button type="submit" disabled={loading || mfaCode.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Verify
              </button>
            </form>
          </div>
        ) : (
        <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h1 className="text-2xl font-bold tracking-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup ? "Start swapping homes worldwide." : "Sign in to continue."}
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-3 text-sm font-semibold transition hover:bg-secondary disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <button
            onClick={handleApple}
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            <AppleIcon />
            Continue with Apple
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            <input
              type="password"
              placeholder="Password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignup ? "Create account" : "Log in"}
            </button>
          </form>

          {!isSignup && (
            <button
              onClick={handleReset}
              className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot your password?
            </button>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? "Already have an account?" : "New to flatch.?"}{" "}
            <button
              onClick={() => setIsSignup(!isSignup)}
              className="font-semibold text-primary hover:underline"
            >
              {isSignup ? "Log in" : "Sign up"}
            </button>
          </p>
        </div>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M17.05 12.04c-.03-2.86 2.34-4.23 2.44-4.3-1.33-1.94-3.4-2.21-4.14-2.24-1.76-.18-3.43 1.04-4.32 1.04-.9 0-2.27-1.02-3.74-.99-1.92.03-3.7 1.12-4.69 2.84-2 3.47-.51 8.6 1.44 11.42.95 1.38 2.08 2.93 3.55 2.88 1.43-.06 1.97-.92 3.7-.92 1.72 0 2.21.92 3.73.89 1.54-.03 2.51-1.4 3.44-2.79 1.09-1.6 1.54-3.15 1.56-3.23-.04-.02-2.99-1.15-3.02-4.56zM14.2 3.61c.78-.96 1.31-2.28 1.17-3.61-1.13.05-2.5.76-3.31 1.71-.72.84-1.36 2.2-1.19 3.49 1.27.1 2.55-.64 3.33-1.59z"/>
    </svg>
  );
}