import { supabase } from "@/integrations/supabase/client";

/**
 * RevenueCat client integration (native iOS/Android via Capacitor).
 *
 * Setup:
 * 1. RevenueCat Dashboard → Project → Apps → iOS/Android App anlegen.
 * 2. Die PUBLIC SDK Keys hier eintragen (sind publishable, dürfen im Code stehen):
 */
const RC_API_KEYS = {
  ios: "appl_XXXXXXXXXXXXXXXXXXXXXXXX", // TODO: RevenueCat iOS public SDK key
  android: "goog_XXXXXXXXXXXXXXXXXXXXXXXX", // TODO: RevenueCat Android public SDK key
};

/** Plan-IDs müssen im Produkt- oder Package-Identifier vorkommen (z.B. "flatch_premium_monthly"). */
export type PaidPlanId = "standard" | "premium";

let configured = false;

export function isNativeApp(): boolean {
  const cap = (window as any).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
  return /Capacitor/i.test(cap.platform ?? "");
}

function nativePlatform(): "ios" | "android" {
  const cap = (window as any).Capacitor;
  const p = typeof cap?.getPlatform === "function" ? cap.getPlatform() : cap?.platform;
  return /android/i.test(String(p)) ? "android" : "ios";
}

export function revenueCatReady(): boolean {
  const key = nativePlatform() === "android" ? RC_API_KEYS.android : RC_API_KEYS.ios;
  return !key.includes("XXXX");
}

export async function configureRevenueCat(): Promise<boolean> {
  if (!isNativeApp() || !revenueCatReady()) return false;
  if (configured) return true;
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return false;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const apiKey = nativePlatform() === "android" ? RC_API_KEYS.android : RC_API_KEYS.ios;
    await Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
    return true;
  } catch (e) {
    console.warn("RevenueCat configure failed", e);
    return false;
  }
}

function isCancellation(e: any): boolean {
  return e?.userCancelled === true || e?.code === "1" || /cancelled/i.test(String(e?.message ?? ""));
}

async function findPackage(planId: PaidPlanId) {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const offerings = await Purchases.getOfferings();
  const offering = offerings.current;
  if (!offering) return null;
  const needle = planId.toLowerCase();
  return (
    offering.availablePackages.find(
      (p) =>
        p.identifier.toLowerCase().includes(needle) ||
        p.product.identifier.toLowerCase().includes(needle),
    ) ?? null
  );
}

export type PurchaseResult = "success" | "cancelled" | "unavailable" | "error";

export async function purchasePlan(planId: PaidPlanId): Promise<PurchaseResult> {
  if (!(await configureRevenueCat())) return "unavailable";
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const pkg = await findPackage(planId);
    if (!pkg) {
      console.warn(`No RevenueCat package found for plan "${planId}"`);
      return "unavailable";
    }
    await Purchases.purchasePackage({ aPackage: pkg });
    // Entitlement wird serverseitig via Webhook bestätigt (subscriptions-Tabelle).
    return "success";
  } catch (e: any) {
    if (isCancellation(e)) return "cancelled";
    console.error("RevenueCat purchase failed", e);
    return "error";
  }
}

export async function restorePurchases(): Promise<"restored" | "nothing" | "error"> {
  if (!(await configureRevenueCat())) return "error";
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.restorePurchases();
    const active = Object.keys(customerInfo.entitlements.active ?? {});
    return active.length > 0 ? "restored" : "nothing";
  } catch (e) {
    console.error("RevenueCat restore failed", e);
    return "error";
  }
}
