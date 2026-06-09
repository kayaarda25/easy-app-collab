import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_LIMITS, type PlanId, type SubStatus } from "./subscription";

export type Entitlement = {
  plan: PlanId;
  status: SubStatus;
  expires_at: string | null;
  will_renew: boolean;
  store: string;
  limits: typeof PLAN_LIMITS[PlanId];
  effectivePlan: PlanId; // basic if cancelled/expired
};

export const getMyEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Entitlement> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("subscriptions")
      .select("plan, status, expires_at, will_renew, store")
      .eq("user_id", userId)
      .maybeSingle();

    const plan = (data?.plan ?? "basic") as PlanId;
    const status = (data?.status ?? "free") as SubStatus;
    const active = status === "active" || status === "trialing";
    const effectivePlan: PlanId = active ? plan : "basic";

    return {
      plan,
      status,
      expires_at: data?.expires_at ?? null,
      will_renew: data?.will_renew ?? false,
      store: data?.store ?? "none",
      limits: PLAN_LIMITS[effectivePlan],
      effectivePlan,
    };
  });

/** Server-side helper: read entitlement inside other server fns */
export async function readEntitlement(
  supabase: any,
  userId: string,
): Promise<{ effectivePlan: PlanId; limits: typeof PLAN_LIMITS[PlanId] }> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();
  const plan = (data?.plan ?? "basic") as PlanId;
  const status = (data?.status ?? "free") as SubStatus;
  const active = status === "active" || status === "trialing";
  const effectivePlan: PlanId = active ? plan : "basic";
  return { effectivePlan, limits: PLAN_LIMITS[effectivePlan] };
}