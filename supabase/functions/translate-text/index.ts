// Edge Function: translate-text
// Mirrors src/lib/translate.functions.ts for the mobile app.
// Body: { text: string, target_lang: string }
// Returns: { translated: string }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { text, target_lang } = await req.json();
    if (!text || typeof text !== "string" || text.length > 4000) {
      return new Response(JSON.stringify({ error: "Invalid 'text'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!target_lang || typeof target_lang !== "string") {
      return new Response(JSON.stringify({ error: "Invalid 'target_lang'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You are a translation engine. Translate the user's message into the target language. Reply with ONLY the translated text, no quotes, no explanation. Preserve emojis, punctuation and line breaks.",
          },
          { role: "user", content: `Target language: ${target_lang}\n\nText:\n${text}` },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Translation failed (${res.status}): ${body.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await res.json();
    const translated = (json?.choices?.[0]?.message?.content ?? "").trim();
    return new Response(JSON.stringify({ translated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});