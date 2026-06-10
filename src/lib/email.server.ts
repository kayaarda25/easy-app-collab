// Server-only Resend email sender (via Lovable connector gateway).
// Do NOT import from client/browser code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = process.env.RESEND_FROM || "flatch. <onboarding@resend.dev>";

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    console.warn("[email] missing LOVABLE_API_KEY or RESEND_API_KEY");
    return { ok: false, error: "not_configured" as const };
  }
  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email] resend failed", res.status, body);
      return { ok: false, error: `status_${res.status}` as const };
    }
    return { ok: true as const };
  } catch (err) {
    console.error("[email] resend exception", err);
    return { ok: false, error: "exception" as const };
  }
}

export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return null;
    return data.user.email;
  } catch {
    return null;
  }
}

function layout(title: string, body: string, cta?: { label: string; url: string }) {
  const btn = cta
    ? `<p style="margin:24px 0"><a href="${cta.url}" style="background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;display:inline-block">${cta.label}</a></p>`
    : "";
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fafafa;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #eee">
    <h1 style="font-size:22px;margin:0 0 12px">flatch.</h1>
    <h2 style="font-size:18px;margin:0 0 12px;color:#111">${title}</h2>
    <div style="font-size:14px;color:#444;line-height:1.5">${body}</div>
    ${btn}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
    <p style="font-size:11px;color:#999;margin:0">You received this email because you have a flatch. account.</p>
  </div></body></html>`;
}

const APP_URL = process.env.APP_URL || "https://easy-app-collab.lovable.app";

export const emails = {
  match: (otherName: string) =>
    ({
      subject: "🎉 You have a new match on flatch.",
      html: layout(
        "It's a match!",
        `<p>You and <strong>${otherName}</strong> both liked each other's homes. Say hi and propose a swap.</p>`,
        { label: "Open matches", url: `${APP_URL}/matches` },
      ),
    }),
  proposalNew: (proposerName: string, start: string, end: string, matchId: string) =>
    ({
      subject: "New swap proposal on flatch.",
      html: layout(
        "New swap proposal",
        `<p><strong>${proposerName}</strong> sent you a swap proposal for <strong>${start}</strong> → <strong>${end}</strong>.</p>`,
        { label: "View proposal", url: `${APP_URL}/chat/${matchId}` },
      ),
    }),
  proposalStatus: (status: string, start: string, end: string, matchId: string) => {
    const titleMap: Record<string, string> = {
      accepted: "Swap accepted ✅",
      rejected: "Swap declined",
      cancelled: "Swap cancelled",
      confirmed: "Booking confirmed 🎉",
    };
    return {
      subject: `${titleMap[status] ?? "Swap update"} — flatch.`,
      html: layout(
        titleMap[status] ?? "Swap update",
        `<p>Your swap for <strong>${start}</strong> → <strong>${end}</strong> is now <strong>${status}</strong>.</p>`,
        { label: "Open chat", url: `${APP_URL}/chat/${matchId}` },
      ),
    };
  },
};