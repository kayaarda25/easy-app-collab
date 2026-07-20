import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const guestSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  id_number: z.string().trim().min(3).max(60),
  id_type: z.enum(["passport", "id_card", "drivers_license", "other"]).default("passport"),
  note: z.string().trim().max(300).optional().nullable(),
});

export const listBookingGuests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { proposal_id: string }) => z.object({ proposal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("booking_guests")
      .select("*")
      .eq("proposal_id", data.proposal_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const addBookingGuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ proposal_id: z.string().uuid() }).and(guestSchema).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { proposal_id, ...guest } = data;
    const { data: row, error } = await context.supabase
      .from("booking_guests")
      .insert({ proposal_id, added_by: context.userId, ...guest })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateBookingGuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).and(guestSchema.partial()).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("booking_guests")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteBookingGuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("booking_guests").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });