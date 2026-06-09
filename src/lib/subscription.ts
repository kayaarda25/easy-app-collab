export type PlanId = "basic" | "standard" | "premium";
export type SubStatus = "free" | "trialing" | "active" | "cancelled" | "expired" | "payment_failed";

export const PLAN_LIMITS: Record<PlanId, {
  maxProperties: number;
  dailySwipes: number;
  canFavorite: boolean;
  advancedFilters: boolean;
  pointsAccess: boolean;
  serviceFeeDiscount: number; // 0..1
  support: "standard" | "premium";
}> = {
  basic:    { maxProperties: 1,  dailySwipes: 10,  canFavorite: false, advancedFilters: false, pointsAccess: false, serviceFeeDiscount: 0,    support: "standard" },
  standard: { maxProperties: 3,  dailySwipes: 100, canFavorite: true,  advancedFilters: true,  pointsAccess: true,  serviceFeeDiscount: 0.10, support: "standard" },
  premium:  { maxProperties: 10, dailySwipes: 1000, canFavorite: true, advancedFilters: true,  pointsAccess: true,  serviceFeeDiscount: 0.25, support: "premium"  },
};

export const PLAN_INFO: Record<PlanId, { name: string; price: string; tagline: string; perks: string[] }> = {
  basic: {
    name: "Basic",
    price: "Free",
    tagline: "Get started for free",
    perks: ["1 home", "10 swipes per day", "Basic search", "Standard support"],
  },
  standard: {
    name: "Standard",
    price: "€9.99 / month",
    tagline: "More homes, more matches",
    perks: ["Up to 3 homes", "100 swipes per day", "Save favorites", "10% off service fees", "flatch.points access"],
  },
  premium: {
    name: "Premium",
    price: "€19.99 / month",
    tagline: "Unlimited swapping",
    perks: ["Up to 10 homes", "Unlimited swipes", "Advanced filters", "25% off service fees", "Premium support", "Early access to new cities"],
  },
};

export function isPremiumActive(plan: PlanId | null | undefined, status: SubStatus | null | undefined): boolean {
  if (!plan || !status) return false;
  if (plan === "basic") return false;
  return status === "active" || status === "trialing";
}