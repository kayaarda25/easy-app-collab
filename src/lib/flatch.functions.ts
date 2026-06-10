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
  display_name: z.string().trim().min(1).max(80).optional(),
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
  house_rules: z.string().trim().max(2000).optional().nullable(),
  check_in_instructions: z.string().trim().max(2000).optional().nullable(),
  check_out_instructions: z.string().trim().max(2000).optional().nullable(),
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
      .select("id, title, description, city, country, street, house_number, zip_code, latitude, longitude, property_type, bedrooms, beds, bathrooms, max_guests, amenities, owner_id, verified_at, property_images(url, position)")
      .eq("is_active", true);
    if (error) throw error;
    const rows = data ?? [];
    // Backfill missing coordinates via Google geocoding (best-effort)
    const missing = rows.filter(
      (r: any) => r.latitude == null || r.longitude == null,
    );
    if (missing.length > 0) {
      await Promise.all(
        missing.map(async (r: any) => {
          const coords = await geocodeAddress(r);
          if (!coords) return;
          r.latitude = coords.lat;
          r.longitude = coords.lng;
          await supabaseAdmin
            .from("properties")
            .update({ latitude: coords.lat, longitude: coords.lng })
            .eq("id", r.id);
        }),
      );
    }
    // Compute owner average review rating across all rows' owners
    const ownerIds = Array.from(new Set(rows.map((r: any) => r.owner_id).filter(Boolean)));
    const ratings: Record<string, { avg: number; count: number }> = {};
    if (ownerIds.length > 0) {
      const { data: revs } = await supabase
        .from("reviews")
        .select("reviewee_id, rating")
        .in("reviewee_id", ownerIds);
      for (const r of revs ?? []) {
        const k = (r as any).reviewee_id as string;
        const cur = ratings[k] ?? { avg: 0, count: 0 };
        const nextCount = cur.count + 1;
        const nextAvg = (cur.avg * cur.count + (r as any).rating) / nextCount;
        ratings[k] = { avg: nextAvg, count: nextCount };
      }
    }
    return rows.map((r: any) => ({
      ...r,
      owner_rating: ratings[r.owner_id]?.avg ?? null,
      owner_review_count: ratings[r.owner_id]?.count ?? 0,
    }));
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

    // Insert via admin client — mutual-like check above already validated the match.
    // RLS on `matches` has no INSERT policy (user-scoped client cannot insert).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: matchRow, error: matchErr } = await supabaseAdmin
      .from("matches")
      .upsert(
        { user_a, user_b, property_a, property_b },
        { onConflict: "property_a,property_b", ignoreDuplicates: false },
      )
      .select()
      .single();
    if (matchErr) throw matchErr;

    // Best-effort match notification emails (don't block on failure)
    try {
      const { sendEmail, getUserEmail, emails } = await import("./email.server");
      const [{ data: meProfile }, { data: themProfile }] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", userId).single(),
        supabase.from("profiles").select("display_name").eq("id", target.owner_id).single(),
      ]);
      const [myEmail, theirEmail] = await Promise.all([
        getUserEmail(userId),
        getUserEmail(target.owner_id),
      ]);
      const myName = meProfile?.display_name ?? "Someone";
      const themName = themProfile?.display_name ?? "Someone";
      if (theirEmail) {
        const t = emails.match(myName);
        await sendEmail({ to: theirEmail, subject: t.subject, html: t.html });
      }
      if (myEmail) {
        const t = emails.match(themName);
        await sendEmail({ to: myEmail, subject: t.subject, html: t.html });
      }
    } catch (e) {
      console.warn("[email] match notification failed", e);
    }

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
    const matchIds = data.map((m) => m.id);

    const [{ data: profiles }, { data: props }, { data: msgs }, { data: reads }, { data: proposals }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_url").in("id", otherUserIds),
      supabase.from("properties").select("id, title, city, country, property_images(url, position)").in("id", propIds),
      supabase.from("messages").select("match_id, body, kind, sender_id, created_at").in("match_id", matchIds).order("created_at", { ascending: false }),
      supabase.from("match_reads").select("match_id, last_read_at").eq("user_id", userId).in("match_id", matchIds),
      supabase.from("swap_proposals").select("match_id, status, created_at").in("match_id", matchIds).order("created_at", { ascending: false }),
    ]);

    const lastByMatch = new Map<string, any>();
    const allByMatch = new Map<string, any[]>();
    for (const m of msgs ?? []) {
      if (!lastByMatch.has(m.match_id)) lastByMatch.set(m.match_id, m);
      const arr = allByMatch.get(m.match_id) ?? [];
      arr.push(m);
      allByMatch.set(m.match_id, arr);
    }
    const readMap = new Map<string, string>();
    for (const r of reads ?? []) readMap.set(r.match_id, r.last_read_at);
    const latestProposalByMatch = new Map<string, any>();
    for (const p of proposals ?? []) {
      if (!latestProposalByMatch.has(p.match_id)) latestProposalByMatch.set(p.match_id, p);
    }

    return data.map((m) => {
      const otherId = m.user_a === userId ? m.user_b : m.user_a;
      const myProp = m.user_a === userId ? m.property_a : m.property_b;
      const theirProp = m.user_a === userId ? m.property_b : m.property_a;
      const lastRead = readMap.get(m.id);
      const matchMsgs = allByMatch.get(m.id) ?? [];
      const unread_count = matchMsgs.filter(
        (x) => x.sender_id !== userId && (!lastRead || new Date(x.created_at) > new Date(lastRead)),
      ).length;
      const lp = latestProposalByMatch.get(m.id);
      return {
        ...m,
        other_user: profiles?.find((p) => p.id === otherId) ?? null,
        my_property: props?.find((p) => p.id === myProp) ?? null,
        their_property: props?.find((p) => p.id === theirProp) ?? null,
        last_message: lastByMatch.get(m.id) ?? null,
        unread_count,
        ready_to_switch: !!lp && (lp.status === "accepted" || lp.status === "confirmed"),
        proposal_status: lp?.status ?? null,
      };
    });
  });

export const markMatchRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("match_reads")
      .upsert(
        { match_id: data.match_id, user_id: userId, last_read_at: new Date().toISOString() },
        { onConflict: "match_id,user_id" },
      );
    if (error) throw error;
    return { ok: true };
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

    // Email the other party about the new proposal
    try {
      const { sendEmail, getUserEmail, emails } = await import("./email.server");
      const { data: match } = await supabase
        .from("matches")
        .select("user_a, user_b")
        .eq("id", row.match_id)
        .single();
      if (match) {
        const recipientId = match.user_a === userId ? match.user_b : match.user_a;
        const [recipientEmail, { data: prof }] = await Promise.all([
          getUserEmail(recipientId),
          supabase.from("profiles").select("display_name").eq("id", userId).single(),
        ]);
        if (recipientEmail) {
          const t = emails.proposalNew(
            prof?.display_name ?? "Someone",
            row.start_date,
            row.end_date,
            row.match_id,
          );
          await sendEmail({ to: recipientEmail, subject: t.subject, html: t.html });
        }
      }
    } catch (e) {
      console.warn("[email] proposal email failed", e);
    }

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
    const { data: updated, error } = await supabase
      .from("swap_proposals")
      .update({ status: data.status })
      .eq("id", data.proposal_id)
      .select("match_id, start_date, end_date")
      .single();
    if (error) throw error;

    // Email both participants about the status change
    try {
      const { sendEmail, getUserEmail, emails } = await import("./email.server");
      const { data: match } = await supabase
        .from("matches")
        .select("user_a, user_b")
        .eq("id", updated.match_id)
        .single();
      if (match) {
        const ids = [match.user_a, match.user_b];
        const recipientEmails = (await Promise.all(ids.map(getUserEmail))).filter(
          (x): x is string => !!x,
        );
        if (recipientEmails.length) {
          const t = emails.proposalStatus(
            data.status,
            updated.start_date,
            updated.end_date,
            updated.match_id,
          );
          await sendEmail({ to: recipientEmails, subject: t.subject, html: t.html });
        }
      }
    } catch (e) {
      console.warn("[email] proposal status email failed", e);
    }

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
  .inputValidator((input: unknown) =>
    availabilityInput
      .extend({
        status: z
          .enum(["available", "blocked", "reserved", "pending_swap", "confirmed_swap"])
          .optional(),
        note: z.string().trim().max(500).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("availabilities").insert(data);
    if (error) throw error;
    return { ok: true };
  });

export const updateAvailabilityStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["available", "blocked", "reserved", "pending_swap", "confirmed_swap"]),
        note: z.string().trim().max(500).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("availabilities")
      .update({ status: data.status, note: data.note ?? null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("availabilities").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listAvailabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ property_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("availabilities")
      .select("*")
      .eq("property_id", data.property_id)
      .order("start_date", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

// ---- PROPERTY UPDATE (owner) ----
export const updateProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            title: z.string().trim().min(3).max(100).optional(),
            description: z.string().trim().max(2000).optional().nullable(),
            house_rules: z.string().trim().max(2000).optional().nullable(),
            check_in_instructions: z.string().trim().max(2000).optional().nullable(),
            check_out_instructions: z.string().trim().max(2000).optional().nullable(),
            is_active: z.boolean().optional(),
            // Owners may move between draft <-> pending
            status: z.enum(["draft", "pending"]).optional(),
          })
          .strict(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("properties")
      .update(data.patch)
      .eq("id", data.id)
      .eq("owner_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// ---- ADMIN PROPERTY REVIEW ----
export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "super_admin"]);
    if (error) throw error;
    return (data ?? []).length > 0;
  });

export const listPropertiesForReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z
          .enum(["pending", "approved", "rejected", "flagged", "draft", "all"])
          .default("pending"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "super_admin"]);
    if (!roles || roles.length === 0) throw new Error("Forbidden");
    let q = supabase
      .from("properties")
      .select("*, property_images(url, position)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    const ownerIds = Array.from(new Set((rows ?? []).map((r: any) => r.owner_id)));
    const { data: profs } = ownerIds.length
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", ownerIds)
      : { data: [] as any[] };
    const byId: Record<string, any> = {};
    for (const p of profs ?? []) byId[(p as any).id] = p;
    return (rows ?? []).map((r: any) => ({ ...r, owner: byId[r.owner_id] ?? null }));
  });

export const reviewProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        property_id: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "flagged", "pending"]),
        notes: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "super_admin"]);
    if (!roles || roles.length === 0) throw new Error("Forbidden");
    const { error } = await supabase
      .from("properties")
      .update({
        status: data.decision,
        review_notes: data.notes ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.property_id);
    if (error) throw error;
    return { ok: true };
  });

// ---- RECOMMENDATIONS ----
const recommendationCategories = ["destination", "bar", "restaurant", "sightseeing", "other"] as const;
const recommendationInput = z.object({
  category: z.enum(recommendationCategories),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  image_url: z.string().url().max(500).optional().nullable(),
  link_url: z.string().url().max(500).optional().nullable(),
  video_url: z.string().url().max(500).optional().nullable(),
});

export const listRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: recs, error } = await supabase
      .from("recommendations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const list = recs ?? [];
    const userIds = Array.from(new Set(list.map((r: any) => r.user_id)));
    let profilesById: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);
      for (const p of profs ?? []) {
        profilesById[(p as any).id] = {
          display_name: (p as any).display_name,
          avatar_url: (p as any).avatar_url,
        };
      }
    }
    return list.map((r: any) => ({ ...r, author: profilesById[r.user_id] ?? null }));
  });

export const createRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => recommendationInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("recommendations")
      .insert({ ...data, user_id: userId })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("recommendations").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---- REVIEWS ----
const reviewInput = z.object({
  proposal_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().nullable(),
  private_feedback: z.string().trim().max(1000).optional().nullable(),
});

export const getReviewableProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const { data: matches, error: mErr } = await supabase
      .from("matches")
      .select("id, user_a, user_b, property_a, property_b")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);
    if (mErr) throw mErr;
    const matchIds = (matches ?? []).map((m: any) => m.id);
    if (matchIds.length === 0) return [];
    const { data: props, error: pErr } = await supabase
      .from("swap_proposals")
      .select("id, match_id, start_date, end_date, status")
      .in("match_id", matchIds)
      .in("status", ["accepted", "confirmed"])
      .lt("end_date", today)
      .order("end_date", { ascending: false });
    if (pErr) throw pErr;
    const propIds = (props ?? []).map((p: any) => p.id);
    const { data: myReviews } = propIds.length
      ? await supabase
          .from("reviews")
          .select("proposal_id")
          .eq("reviewer_id", userId)
          .in("proposal_id", propIds)
      : { data: [] as any[] };
    const reviewed = new Set((myReviews ?? []).map((r: any) => r.proposal_id));
    const otherIds = Array.from(
      new Set(
        (matches ?? []).map((m: any) => (m.user_a === userId ? m.user_b : m.user_a)),
      ),
    );
    const { data: profs } = otherIds.length
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", otherIds)
      : { data: [] as any[] };
    const profById: Record<string, any> = {};
    for (const p of profs ?? []) profById[(p as any).id] = p;
    const matchById: Record<string, any> = {};
    for (const m of matches ?? []) matchById[(m as any).id] = m;
    return (props ?? []).map((p: any) => {
      const m = matchById[p.match_id];
      const otherId = m.user_a === userId ? m.user_b : m.user_a;
      return {
        ...p,
        already_reviewed: reviewed.has(p.id),
        other_user: profById[otherId] ?? { id: otherId },
        reviewee_id: otherId,
      };
    });
  });

export const createReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Look up reviewee from match
    const { data: prop, error: pErr } = await supabase
      .from("swap_proposals")
      .select("match_id, end_date, status, matches!inner(user_a, user_b)")
      .eq("id", data.proposal_id)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!prop) throw new Error("Proposal not found");
    const m: any = (prop as any).matches;
    const reviewee_id = m.user_a === userId ? m.user_b : m.user_a;
    const { data: row, error } = await supabase
      .from("reviews")
      .insert({
        proposal_id: data.proposal_id,
        reviewer_id: userId,
        reviewee_id,
        rating: data.rating,
        comment: data.comment ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (data.private_feedback && data.private_feedback.length > 0) {
      const { error: fErr } = await supabase
        .from("review_private_feedback")
        .insert({ review_id: row.id, content: data.private_feedback });
      if (fErr) throw fErr;
    }
    return { ok: true, id: row.id };
  });

export const getReviewsForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: reviews, error } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer_id")
      .eq("reviewee_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const ids = Array.from(new Set((reviews ?? []).map((r: any) => r.reviewer_id)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids)
      : { data: [] as any[] };
    const byId: Record<string, any> = {};
    for (const p of profs ?? []) byId[(p as any).id] = p;
    const list = (reviews ?? []).map((r: any) => ({ ...r, reviewer: byId[r.reviewer_id] ?? null }));
    const avg =
      list.length === 0 ? 0 : list.reduce((s: number, r: any) => s + r.rating, 0) / list.length;
    return { reviews: list, average: avg, count: list.length };
  });

export const getMyPrivateFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: reviews, error } = await supabase
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer_id, review_private_feedback(content)")
      .eq("reviewee_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ids = Array.from(new Set((reviews ?? []).map((r: any) => r.reviewer_id)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids)
      : { data: [] as any[] };
    const byId: Record<string, any> = {};
    for (const p of profs ?? []) byId[(p as any).id] = p;
    return (reviews ?? [])
      .map((r: any) => ({
        ...r,
        private_feedback: r.review_private_feedback?.[0]?.content ?? r.review_private_feedback?.content ?? null,
        reviewer: byId[r.reviewer_id] ?? null,
      }))
      .filter((r: any) => !!r.private_feedback);
  });

// ---- NOTIFICATIONS ----
export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, meta, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const unread = (data ?? []).filter((n: any) => !n.read_at).length;
    return { items: data ?? [], unread };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// ============================================================
// ADMIN DASHBOARD
// ============================================================

const ADMIN_ROLES = ["admin", "super_admin", "support", "operations", "finance"] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

async function getAdminRoles(userId: string): Promise<AdminRole[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as { role: string }[])
    .map((r) => r.role as AdminRole)
    .filter((r) => (ADMIN_ROLES as readonly string[]).includes(r));
}

async function requireAdmin(userId: string, allowed?: AdminRole[]): Promise<AdminRole[]> {
  const roles = await getAdminRoles(userId);
  if (roles.length === 0) throw new Error("Forbidden");
  if (allowed && !roles.some((r) => allowed.includes(r) || r === "super_admin" || r === "admin")) {
    throw new Error("Forbidden");
  }
  return roles;
}

export const getMyAdminRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await getAdminRoles(context.userId);
    return { roles, isAdmin: roles.length > 0, isSuper: roles.includes("super_admin") };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [users, properties, propsPending, propsFlagged, matches, proposals, swapsConfirmed, subsActive, reviews, newUsers7d] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("properties").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("properties").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("properties").select("id", { count: "exact", head: true }).eq("status", "flagged"),
      supabaseAdmin.from("matches").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("swap_proposals").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("swap_proposals").select("id", { count: "exact", head: true }).in("status", ["accepted", "confirmed"]),
      supabaseAdmin.from("subscriptions").select("id", { count: "exact", head: true }).neq("plan", "basic"),
      supabaseAdmin.from("reviews").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
    ]);
    return {
      users: users.count ?? 0,
      newUsers7d: newUsers7d.count ?? 0,
      properties: properties.count ?? 0,
      propertiesPending: propsPending.count ?? 0,
      propertiesFlagged: propsFlagged.count ?? 0,
      matches: matches.count ?? 0,
      proposals: proposals.count ?? 0,
      swapsConfirmed: swapsConfirmed.count ?? 0,
      subsActive: subsActive.count ?? 0,
      reviews: reviews.count ?? 0,
    };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ q: z.string().trim().max(120).optional(), limit: z.number().int().min(1).max(200).default(50) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    let q = supabaseAdmin
      .from("profiles")
      .select("id, display_name, city, country, avatar_url, trusted_host, email_verified_at, phone_verified_at, identity_verified_at, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.q) q = q.or(`display_name.ilike.%${data.q}%,city.ilike.%${data.q}%,country.ilike.%${data.q}%`);
    const { data: profiles, error } = await q;
    if (error) throw error;
    const ids = (profiles ?? []).map((p) => p.id);
    const [{ data: roles }, { data: subs }] = await Promise.all([
      ids.length ? supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids) : { data: [] as any[] },
      ids.length ? supabaseAdmin.from("subscriptions").select("user_id, plan, status").in("user_id", ids) : { data: [] as any[] },
    ]);
    const rolesById: Record<string, string[]> = {};
    for (const r of roles ?? []) {
      rolesById[(r as any).user_id] = [...(rolesById[(r as any).user_id] ?? []), (r as any).role];
    }
    const subById: Record<string, any> = {};
    for (const s of subs ?? []) subById[(s as any).user_id] = s;
    return (profiles ?? []).map((p: any) => ({
      ...p,
      roles: rolesById[p.id] ?? [],
      subscription: subById[p.id] ?? null,
    }));
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(ADMIN_ROLES),
        action: z.enum(["add", "remove"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await getAdminRoles(context.userId);
    if (!roles.includes("super_admin")) throw new Error("Only super_admin can manage roles");
    if (data.action === "add") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.role });
      if (error && !String(error.message).includes("duplicate")) throw error;
    } else {
      // Prevent removing the last super_admin
      if (data.role === "super_admin") {
        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("role", "super_admin");
        if ((count ?? 0) <= 1) throw new Error("Cannot remove the last super_admin");
      }
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
      if (error) throw error;
    }
    return { ok: true };
  });

export const adminSetTrustedHost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), trusted: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId, ["support", "operations"]);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ trusted_host: data.trusted })
      .eq("id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

export const adminListMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { data: matches, error } = await supabaseAdmin
      .from("matches")
      .select("id, user_a, user_b, property_a, property_b, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw error;
    const userIds = Array.from(new Set((matches ?? []).flatMap((m: any) => [m.user_a, m.user_b])));
    const propIds = Array.from(new Set((matches ?? []).flatMap((m: any) => [m.property_a, m.property_b]).filter(Boolean)));
    const [{ data: profs }, { data: props }] = await Promise.all([
      userIds.length ? supabaseAdmin.from("profiles").select("id, display_name, avatar_url").in("id", userIds) : { data: [] as any[] },
      propIds.length ? supabaseAdmin.from("properties").select("id, title, city, country").in("id", propIds) : { data: [] as any[] },
    ]);
    const profById: Record<string, any> = {};
    for (const p of profs ?? []) profById[(p as any).id] = p;
    const propById: Record<string, any> = {};
    for (const p of props ?? []) propById[(p as any).id] = p;
    return (matches ?? []).map((m: any) => ({
      ...m,
      user_a_profile: profById[m.user_a] ?? null,
      user_b_profile: profById[m.user_b] ?? null,
      property_a_info: propById[m.property_a] ?? null,
      property_b_info: propById[m.property_b] ?? null,
    }));
  });

export const adminListBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum(["pending", "accepted", "rejected", "cancelled", "confirmed", "all"]).default("all"),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    let q = supabaseAdmin
      .from("swap_proposals")
      .select("id, match_id, proposer_id, start_date, end_date, guests, status, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.proposer_id)));
    const { data: profs } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
      : { data: [] as any[] };
    const byId: Record<string, any> = {};
    for (const p of profs ?? []) byId[(p as any).id] = p;
    return (rows ?? []).map((r: any) => ({ ...r, proposer: byId[r.proposer_id] ?? null }));
  });

export const adminUpdateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        proposal_id: z.string().uuid(),
        status: z.enum(["pending", "accepted", "rejected", "cancelled", "confirmed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId, ["operations", "support"]);
    const { error } = await supabaseAdmin
      .from("swap_proposals")
      .update({ status: data.status })
      .eq("id", data.proposal_id);
    if (error) throw error;
    return { ok: true };
  });

export const adminListVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url, city, country, email_verified_at, phone_verified_at, identity_verified_at, trusted_host, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const adminListSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId, ["finance"]);
    const { data: subs, error } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, plan, status, store, entitlement, expires_at, will_renew, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const ids = (subs ?? []).map((s: any) => s.user_id);
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, display_name, avatar_url").in("id", ids)
      : { data: [] as any[] };
    const byId: Record<string, any> = {};
    for (const p of profs ?? []) byId[(p as any).id] = p;
    return (subs ?? []).map((s: any) => ({ ...s, profile: byId[s.user_id] ?? null }));
  });