import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SYSTEM_PROMPT = `Du bist der freundliche KI-Support-Assistent von flatch. — der Home-Swap App.
Antworte KURZ (max 3–4 Sätze), auf Deutsch (oder in der Sprache des Users), höflich und hilfsbereit.

Du beantwortest **allgemeine Fragen** zu:
- Wie funktioniert flatch. / Home Swaps
- Profil / Verifizierung / Einstellungen
- flatch.points
- Abo / Premium
- Matching, Swipen, Chat
- Technische Basisfragen

**WICHTIG — Eskalation an einen menschlichen Mitarbeiter:**
Wenn es um eine **konkrete persönliche Buchung** geht (Streit mit Gastgeber/Gast, Zahlungsproblem, Schaden, Notfall, Buchungsänderung, Rückerstattung, konkrete rechtliche Frage, Beschwerde), antworte kurz und schließe mit:

[ESCALATE]

auf einer eigenen Zeile am Ende. Der User erhält dann einen Button, um mit einem echten Mitarbeiter verbunden zu werden.`;

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("id, subject, status, last_message_at, created_at")
      .eq("user_id", context.userId)
      .order("last_message_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ticket_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ticket, error } = await context.supabase
      .from("support_tickets")
      .select("id, user_id, subject, status, assigned_to, last_message_at, created_at")
      .eq("id", data.ticket_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("Ticket not found");
    const { data: messages, error: mErr } = await context.supabase
      .from("support_messages")
      .select("id, sender_role, sender_id, body, created_at")
      .eq("ticket_id", data.ticket_id)
      .order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);
    return { ticket, messages: messages ?? [] };
  });

export const sendUserMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      ticket_id: z.string().uuid().optional(),
      body: z.string().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let ticketId = data.ticket_id;
    let status = "ai";

    // Create ticket if needed
    if (!ticketId) {
      const subject = data.body.slice(0, 60);
      const { data: t, error } = await context.supabase
        .from("support_tickets")
        .insert({ user_id: context.userId, subject, status: "ai" })
        .select("id, status")
        .single();
      if (error) throw new Error(error.message);
      ticketId = t.id;
      status = t.status;
    } else {
      const { data: t } = await context.supabase
        .from("support_tickets").select("status").eq("id", ticketId).maybeSingle();
      status = t?.status ?? "ai";
    }

    // Insert user message
    const { error: insErr } = await context.supabase.from("support_messages").insert({
      ticket_id: ticketId, sender_role: "user", sender_id: context.userId, body: data.body,
    });
    if (insErr) throw new Error(insErr.message);

    // If ticket is with a human agent, don't call AI
    if (status !== "ai") {
      return { ticket_id: ticketId, ai_reply: null, escalated: false, status };
    }

    // Fetch history for context
    const { data: history } = await context.supabase
      .from("support_messages")
      .select("sender_role, body")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .limit(20);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history ?? []).map((m) => ({
        role: m.sender_role === "user" ? "user" : "assistant",
        content: m.body,
      })),
    ];

    let aiReply = "";
    let escalated = false;
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
        body: JSON.stringify({ model: "google/gemini-3.5-flash", messages }),
      });
      if (!res.ok) throw new Error(`AI ${res.status}`);
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      aiReply = (json.choices?.[0]?.message?.content ?? "").trim();
      if (/\[ESCALATE\]/i.test(aiReply)) {
        escalated = true;
        aiReply = aiReply.replace(/\[ESCALATE\]/gi, "").trim();
      }
    } catch {
      aiReply = "Entschuldigung, ich habe gerade Probleme zu antworten. Möchtest du direkt mit einem Mitarbeiter sprechen?";
      escalated = true;
    }

    if (aiReply) {
      await context.supabase.from("support_messages").insert({
        ticket_id: ticketId, sender_role: "ai", body: aiReply,
      });
    }

    return { ticket_id: ticketId, ai_reply: aiReply, escalated, status };
  });

export const escalateToHuman = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ticket_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: t } = await context.supabase
      .from("support_tickets").select("user_id").eq("id", data.ticket_id).maybeSingle();
    if (!t || t.user_id !== context.userId) throw new Error("Not allowed");

    const { error } = await context.supabase
      .from("support_tickets")
      .update({ status: "pending" })
      .eq("id", data.ticket_id);
    if (error) throw new Error(error.message);

    await context.supabase.from("support_messages").insert({
      ticket_id: data.ticket_id, sender_role: "system",
      body: "Anfrage an einen Mitarbeiter weitergeleitet. Wir melden uns so schnell wie möglich.",
    });

    return { ok: true };
  });

// ---------- Admin/Agent ----------

export const listAllTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_any_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("id, user_id, subject, status, assigned_to, last_message_at, created_at")
      .in("status", ["pending", "active"])
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    if (!data?.length) return [];
    const userIds = Array.from(new Set(data.map((t) => t.user_id)));
    const { data: profiles } = await context.supabase
      .from("profiles").select("id, display_name, avatar_url").in("id", userIds);
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return data.map((t) => ({ ...t, user: pmap.get(t.user_id) ?? null }));
  });

export const agentReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ticket_id: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_any_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    await context.supabase
      .from("support_tickets")
      .update({ status: "active", assigned_to: context.userId })
      .eq("id", data.ticket_id);

    const { error } = await context.supabase.from("support_messages").insert({
      ticket_id: data.ticket_id, sender_role: "agent", sender_id: context.userId, body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closeTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ticket_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_any_admin", { _user_id: context.userId });
    const { data: t } = await context.supabase
      .from("support_tickets").select("user_id").eq("id", data.ticket_id).maybeSingle();
    if (!t) throw new Error("Not found");
    if (!isAdmin && t.user_id !== context.userId) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("support_tickets").update({ status: "closed" }).eq("id", data.ticket_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });