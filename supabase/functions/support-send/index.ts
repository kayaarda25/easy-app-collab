// Edge Function: support-send
// Mirrors sendUserMessage from src/lib/support.functions.ts
// Body: { ticket_id?: string, body: string }
// Auth: Bearer <user access token>
// Returns: { ticket_id, ai_reply, escalated, status }

import { corsHeaders, json, getAdminClient, getUserFromRequest } from "../_shared/auth.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userId = auth.user.id;

    const { ticket_id, body } = await req.json();
    if (!body || typeof body !== "string" || body.length > 2000) {
      return json({ error: "Invalid 'body'" }, 400);
    }

    const admin = getAdminClient();
    let ticketId: string | undefined = ticket_id;
    let status = "ai";

    if (!ticketId) {
      const subject = body.slice(0, 60);
      const { data: t, error } = await admin
        .from("support_tickets")
        .insert({ user_id: userId, subject, status: "ai" })
        .select("id, status")
        .single();
      if (error) return json({ error: error.message }, 500);
      ticketId = t.id;
      status = t.status;
    } else {
      const { data: t } = await admin
        .from("support_tickets").select("status, user_id").eq("id", ticketId).maybeSingle();
      if (!t || t.user_id !== userId) return json({ error: "Not allowed" }, 403);
      status = t.status ?? "ai";
    }

    const { error: insErr } = await admin.from("support_messages").insert({
      ticket_id: ticketId, sender_role: "user", sender_id: userId, body,
    });
    if (insErr) return json({ error: insErr.message }, 500);

    if (status !== "ai") {
      return json({ ticket_id: ticketId, ai_reply: null, escalated: false, status });
    }

    const { data: history } = await admin
      .from("support_messages")
      .select("sender_role, body")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .limit(20);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "Missing LOVABLE_API_KEY" }, 500);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history ?? []).map((m: { sender_role: string; body: string }) => ({
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
      const j = await res.json();
      aiReply = (j?.choices?.[0]?.message?.content ?? "").trim();
      if (/\[ESCALATE\]/i.test(aiReply)) {
        escalated = true;
        aiReply = aiReply.replace(/\[ESCALATE\]/gi, "").trim();
      }
    } catch {
      aiReply = "Entschuldigung, ich habe gerade Probleme zu antworten. Möchtest du direkt mit einem Mitarbeiter sprechen?";
      escalated = true;
    }

    if (aiReply) {
      await admin.from("support_messages").insert({
        ticket_id: ticketId, sender_role: "ai", body: aiReply,
      });
    }

    return json({ ticket_id: ticketId, ai_reply: aiReply, escalated, status });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});