import { createFileRoute } from "@tanstack/react-router";

/**
 * RevenueCat → Lovable Cloud webhook
 *
 * Configure in RevenueCat dashboard → Project settings → Integrations → Webhooks:
 *   URL:    https://<your-domain>/api/public/webhooks/revenuecat
 *   Auth:   set "Authorization" header to a shared secret you also save as
 *           REVENUECAT_WEBHOOK_AUTH_HEADER in Lovable Cloud secrets.
 *
 * Events handled: INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, CANCELLATION,
 * EXPIRATION, BILLING_ISSUE, SUBSCRIBER_ALIAS, NON_RENEWING_PURCHASE, TRANSFER, UNCANCELLATION.
 */

type PlanId = "basic" | "standard" | "premium";
type SubStatus = "free" | "trialing" | "active" | "cancelled" | "expired" | "payment_failed";

// Map RevenueCat entitlement identifiers → flatch plans.
// Set these identifiers in RevenueCat → Entitlements.
const ENTITLEMENT_TO_PLAN: Record<string, PlanId> = {
  premium: "premium",
  standard: "standard",
};

function planFromEvent(ev: any): { plan: PlanId; entitlement: string | null } {
  const ids: string[] = ev?.entitlement_ids ?? (ev?.entitlement_id ? [ev.entitlement_id] : []);
  for (const id of ids) {
    if (ENTITLEMENT_TO_PLAN[id]) return { plan: ENTITLEMENT_TO_PLAN[id], entitlement: id };
  }
  return { plan: "basic", entitlement: null };
}

function statusFromEvent(type: string): SubStatus {
  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
      return "active";
    case "TRIAL_STARTED":
      return "trialing";
    case "CANCELLATION":
      return "cancelled";
    case "EXPIRATION":
      return "expired";
    case "BILLING_ISSUE":
      return "payment_failed";
    default:
      return "active";
  }
}

function storeFromEvent(store: string | undefined): "app_store" | "play_store" | "none" {
  if (store === "APP_STORE" || store === "MAC_APP_STORE") return "app_store";
  if (store === "PLAY_STORE") return "play_store";
  return "none";
}

export const Route = createFileRoute("/api/public/webhooks/revenuecat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;
        const provided = request.headers.get("authorization");
        if (!expected) {
          return new Response("Webhook secret not configured", { status: 500 });
        }
        if (provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const ev = body?.event;
        if (!ev || typeof ev !== "object") {
          return new Response("Missing event", { status: 400 });
        }

        const userId: string | undefined = ev.app_user_id;
        if (!userId) return new Response("Missing app_user_id", { status: 400 });

        const { plan, entitlement } = planFromEvent(ev);
        const status = statusFromEvent(ev.type);
        const store = storeFromEvent(ev.store);
        const expiresAt = ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null;
        const originalAt = ev.original_purchase_at_ms ? new Date(ev.original_purchase_at_ms).toISOString() : null;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              plan: status === "active" || status === "trialing" ? plan : "basic",
              status,
              store,
              entitlement,
              product_id: ev.product_id ?? null,
              period_type: ev.period_type ?? null,
              revenuecat_customer_id: ev.original_app_user_id ?? userId,
              original_purchase_at: originalAt,
              expires_at: expiresAt,
              will_renew: status === "active" || status === "trialing",
              raw_event: ev,
            },
            { onConflict: "user_id" },
          );
        if (error) {
          console.error("RevenueCat webhook upsert failed", error);
          return new Response("DB error", { status: 500 });
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});