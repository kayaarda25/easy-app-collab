import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PointsBalance = {
  available: number;
  effectivePlan: "basic" | "standard" | "premium";
  nextExpiringAmount: number | null;
  nextExpiringAt: string | null;
  bonusClaimed: boolean;
};

export const getMyPointsBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PointsBalance> => {
    const { supabase, userId } = context;
    const [{ data: avail }, { data: plan }, { data: next }, { data: claim }] =
      await Promise.all([
        supabase.rpc("flatch_points_available", { _user_id: userId }),
        supabase.rpc("flatch_effective_plan", { _user_id: userId }),
        supabase
          .from("flatch_points_ledger")
          .select("delta, expires_at")
          .eq("user_id", userId)
          .eq("status", "active")
          .gt("delta", 0)
          .not("expires_at", "is", null)
          .order("expires_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("flatch_premium_bonus_claims")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
    return {
      available: (avail as number | null) ?? 0,
      effectivePlan: ((plan as string | null) ?? "basic") as PointsBalance["effectivePlan"],
      nextExpiringAmount: next?.delta ?? null,
      nextExpiringAt: next?.expires_at ?? null,
      bonusClaimed: !!claim,
    };
  });

export const getMyPointsHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("flatch_points_ledger")
      .select("id, delta, reason, status, expires_at, expired_at, created_at, proposal_id, meta")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

const asyncProposalInput = z.object({
  match_id: z.string().uuid(),
  property_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string(),
  guests: z.number().int().min(1).max(40),
  message: z.string().trim().max(500).optional(),
});

function nightsBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00Z").getTime();
  const e = new Date(end + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((e - s) / 86400000));
}

/** Create an asynchronous (points-based) proposal and reserve points. */
export const createAsyncProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => asyncProposalInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Plan gate: only standard or premium can spend points
    const { data: planRaw } = await supabase.rpc("flatch_effective_plan", { _user_id: userId });
    const plan = (planRaw as string | null) ?? "basic";
    if (plan === "basic") {
      throw new Error("PLAN_LIMIT:Upgrade to Standard or Premium to book with flatch.points.");
    }

    // Resolve host (owner of selected property) and verify it's part of the match
    const { data: prop, error: propErr } = await supabase
      .from("properties")
      .select("id, owner_id, is_active")
      .eq("id", data.property_id)
      .maybeSingle();
    if (propErr || !prop || !prop.is_active) throw new Error("Property unavailable.");
    if (prop.owner_id === userId) throw new Error("Cannot book your own home.");

    const { data: match } = await supabase
      .from("matches")
      .select("user_a, user_b")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!match || (match.user_a !== userId && match.user_b !== userId)) {
      throw new Error("Match not found.");
    }
    if (prop.owner_id !== match.user_a && prop.owner_id !== match.user_b) {
      throw new Error("Selected home is not part of this match.");
    }

    const nights = nightsBetween(data.start_date, data.end_date);

    // Check balance via RPC (RLS-safe, security definer)
    const { data: availRaw } = await supabase.rpc("flatch_points_available", { _user_id: userId });
    const available = (availRaw as number | null) ?? 0;
    if (available < nights) {
      throw new Error(
        `INSUFFICIENT_POINTS:You have ${available} flatch.points but need ${nights} for this stay.`,
      );
    }

    // Insert proposal first
    const { data: row, error } = await supabase
      .from("swap_proposals")
      .insert({
        match_id: data.match_id,
        proposer_id: userId,
        host_user_id: prop.owner_id,
        property_id: prop.id,
        kind: "async",
        start_date: data.start_date,
        end_date: data.end_date,
        guests: data.guests,
        message: data.message,
        points_amount: nights,
      })
      .select()
      .single();
    if (error) throw error;

    // Reserve points (server-side RPC; security definer enforces balance & inserts ledger row)
    const { error: holdErr } = await supabase.rpc("flatch_points_hold", {
      _user_id: userId,
      _amount: nights,
      _proposal_id: row.id,
    });
    if (holdErr) {
      // rollback proposal
      await supabase.from("swap_proposals").delete().eq("id", row.id);
      throw new Error(holdErr.message);
    }

    return row;
  });

/** Properties of the other participant in a match — for selecting a target home in async booking. */
export const getMatchHomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ match_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: match } = await supabase
      .from("matches")
      .select("user_a, user_b")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!match) return [];
    const otherId = match.user_a === userId ? match.user_b : match.user_a;
    const { data: rows } = await supabase
      .from("properties")
      .select("id, title, city, country, max_guests, property_images(url, position)")
      .eq("owner_id", otherId)
      .eq("is_active", true);
    return rows ?? [];
  });