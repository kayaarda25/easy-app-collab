import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { readEntitlement } from "./subscription.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---- GEOCODING (Google Maps gateway) ----
async function geocodeAddress(parts: {
  street?: string | null;
  house_number?: string | null;
  zip_code?: string | null;
  city?: string | null;
  country?: string | null;
}): Promise<{ lat: number; lng: number } | null> {
  const address = [
    [parts.street, parts.house_number].filter(Boolean).join(" "),
    [parts.zip_code, parts.city].filter(Boolean).join(" "),
    parts.country,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (!address) return null;
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !gmapsKey) return null;
  try {
    const res = await fetch(
      `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(address)}`,
      {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": gmapsKey,
        },
      },
    );
    if (!res.ok) return null;
    const json: any = await res.json();
    const loc = json?.results?.[0]?.geometry?.location;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;
    return { lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
}

// ---- PROFILE ----
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  avatar_url: z.string().url().max(500).optional().nullable(),
  birth_date: z.string().optional().nullable(),
  onboarded: z.boolean().optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });

// ---- PROPERTIES ----
const propertySchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  property_type: z.enum(["house", "apartment", "villa", "cabin", "loft", "other"]),
  bedrooms: z.number().int().min(0).max(20),
  beds: z.number().int().min(1).max(40),
  bathrooms: z.number().min(0).max(20),
  max_guests: z.number().int().min(1).max(40),
  amenities: z.array(z.string().trim().min(1).max(40)).max(40),
  city: z.string().trim().min(1).max(80),
  country: z.string().trim().min(1).max(80),
  street: z.string().trim().max(200).optional().nullable(),
  house_number: z.string().trim().max(20).optional().nullable(),
  zip_code: z.string().trim().max(20).optional().nullable(),
});

export const createProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => propertySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { limits, effectivePlan } = await readEntitlement(supabase, userId);
    const { count } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);
    if ((count ?? 0) >= limits.maxProperties) {
      throw new Error(
        `PLAN_LIMIT:Your ${effectivePlan} plan allows up to ${limits.maxProperties} home${limits.maxProperties === 1 ? "" : "s"}. Upgrade to add more.`,
      );
    }
    const { data: row, error } = await supabase
      .from("properties")
      .insert({ ...data, owner_id: userId })
      .select()
      .single();
    if (error) throw error;
    // Geocode address (best-effort, non-blocking failure)
    const coords = await geocodeAddress(data);
    if (coords && row?.id) {
      await supabase
        .from("properties")
        .update({ latitude: coords.lat, longitude: coords.lng })
        .eq("id", row.id);
      (row as any).latitude = coords.lat;
      (row as any).longitude = coords.lng;
    }
    return row;
  });

export const getMyProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("properties")
      .select("*, property_images(url, position)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

// Public-ish: all active properties for map display (auth required).
export const getAllPropertyLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("properties")
      .select("id, title, city, country, street, house_number, zip_code, latitude, longitude, property_type, property_images(url, position)")
      .eq("is_active", true);
    if (error) throw error;
    return data ?? [];
  });

// ---- SEARCH / SWIPE FEED ----
const searchSchema = z.object({
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
});

export const getSwipeFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // get IDs the user already swiped
    const { data: swiped } = await supabase
      .from("swipes")
      .select("property_id")
      .eq("user_id", userId);
    const excludeIds = (swiped ?? []).map((s) => s.property_id);

    let q = supabase
      .from("properties")
      .select("id, title, description, city, country, property_type, bedrooms, beds, bathrooms, max_guests, amenities, owner_id, property_images(url, position)")
      .eq("is_active", true)
      .neq("owner_id", userId)
      .limit(20);

    if (data.city) q = q.ilike("city", `%${data.city}%`);
    if (data.country) q = q.ilike("country", `%${data.country}%`);
    if (excludeIds.length) q = q.not("id", "in", `(${excludeIds.join(",")})`);

    const { data: properties, error } = await q;
    if (error) throw error;
    return properties ?? [];
  });

// ---- SWIPE & MATCH ----
const swipeInput = z.object({
  property_id: z.string().uuid(),
  direction: z.enum(["like", "pass"]),
});

export const recordSwipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => swipeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Enforce daily swipe limit (counts likes + passes today)
    const { limits, effectivePlan } = await readEntitlement(supabase, userId);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("swipes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since.toISOString());
    if ((todayCount ?? 0) >= limits.dailySwipes) {
      throw new Error(
        `PLAN_LIMIT:You've reached your daily swipe limit (${limits.dailySwipes}) on the ${effectivePlan} plan. Upgrade for more.`,
      );
    }

    const { error: swipeErr } = await supabase
      .from("swipes")
      .upsert({ user_id: userId, property_id: data.property_id, direction: data.direction });
    if (swipeErr) throw swipeErr;

    if (data.direction !== "like") return { matched: false as const };

    // Get the property + owner
    const { data: target } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", data.property_id)
      .single();
    if (!target) return { matched: false as const };

    // Did the target's owner ever "like" any of *my* properties?
    const { data: myProps } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", userId);
    const myPropIds = (myProps ?? []).map((p) => p.id);
    if (myPropIds.length === 0) return { matched: false as const };

    const { data: theirLikes } = await supabase
      .from("swipes")
      .select("property_id")
      .eq("user_id", target.owner_id)
      .eq("direction", "like")
      .in("property_id", myPropIds);

    if (!theirLikes || theirLikes.length === 0) return { matched: false as const };

    const myMatchedProp = theirLikes[0].property_id;

    // Insert match (smaller user_id first to keep ordering stable)
    const [user_a, user_b, property_a, property_b] =
      userId < target.owner_id
        ? [userId, target.owner_id, myMatchedProp, target.id]
        : [target.owner_id, userId, target.id, myMatchedProp];

    const { data: matchRow, error: matchErr } = await supabase
      .from("matches")
      .upsert(
        { user_a, user_b, property_a, property_b },
        { onConflict: "property_a,property_b", ignoreDuplicates: false },
      )
      .select()
      .single();
    if (matchErr) throw matchErr;
    return { matched: true as const, match: matchRow };
  });

// ---- MATCHES ----
export const getMyMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const otherUserIds = data.map((m) => (m.user_a === userId ? m.user_b : m.user_a));
    const propIds = data.flatMap((m) => [m.property_a, m.property_b]);

    const [{ data: profiles }, { data: props }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_url").in("id", otherUserIds),
      supabase.from("properties").select("id, title, city, country, property_images(url, position)").in("id", propIds),
    ]);

    return data.map((m) => {
      const otherId = m.user_a === userId ? m.user_b : m.user_a;
      const myProp = m.user_a === userId ? m.property_a : m.property_b;
      const theirProp = m.user_a === userId ? m.property_b : m.property_a;
      return {
        ...m,
        other_user: profiles?.find((p) => p.id === otherId) ?? null,
        my_property: props?.find((p) => p.id === myProp) ?? null,
        their_property: props?.find((p) => p.id === theirProp) ?? null,
      };
    });
  });

// ---- MESSAGES ----
export const getMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ match_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("*")
      .eq("match_id", data.match_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return msgs ?? [];
  });

const sendMessageInput = z.object({
  match_id: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendMessageInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("messages").insert({
      match_id: data.match_id,
      sender_id: userId,
      body: data.body,
    });
    if (error) throw error;
    return { ok: true };
  });

// ---- SWAP PROPOSALS ----
const proposalInput = z.object({
  match_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string(),
  guests: z.number().int().min(1).max(40),
  message: z.string().trim().max(500).optional(),
});

export const createSwapProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => proposalInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("swap_proposals")
      .insert({ ...data, proposer_id: userId })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const getProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ match_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("swap_proposals")
      .select("*")
      .eq("match_id", data.match_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

const proposalStatusInput = z.object({
  proposal_id: z.string().uuid(),
  status: z.enum(["accepted", "rejected", "cancelled", "confirmed"]),
});

export const updateProposalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => proposalStatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("swap_proposals")
      .update({ status: data.status })
      .eq("id", data.proposal_id);
    if (error) throw error;
    return { ok: true };
  });

// ---- AVAILABILITIES ----
const availabilityInput = z.object({
  property_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string(),
});

export const addAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => availabilityInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("availabilities").insert(data);
    if (error) throw error;
    return { ok: true };
  });