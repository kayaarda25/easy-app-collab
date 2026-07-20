// Edge Function: support-escalate
// Mirrors escalateToHuman from src/lib/support.functions.ts
// Body: { ticket_id: string }
// Auth: Bearer <user access token>
// Returns: { ok: true }

import { corsHeaders, json, getAdminClient, getUserFromRequest } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userId = auth.user.id;

    const { ticket_id } = await req.json();
    if (!ticket_id || typeof ticket_id !== "string") {
      return json({ error: "Invalid 'ticket_id'" }, 400);
    }

    const admin = getAdminClient();
    const { data: t } = await admin
      .from("support_tickets").select("user_id").eq("id", ticket_id).maybeSingle();
    if (!t || t.user_id !== userId) return json({ error: "Not allowed" }, 403);

    const { error } = await admin
      .from("support_tickets")
      .update({ status: "pending" })
      .eq("id", ticket_id);
    if (error) return json({ error: error.message }, 500);

    await admin.from("support_messages").insert({
      ticket_id, sender_role: "system",
      body: "Anfrage an einen Mitarbeiter weitergeleitet. Wir melden uns so schnell wie möglich.",
    });

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});