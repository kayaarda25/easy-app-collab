import { createFileRoute } from "@tanstack/react-router";

// Triggered daily by pg_cron at 09:00 UTC.
// Creates in-app notifications (and, when email infra is configured, sends emails)
// for:
//  - check-in tomorrow (24h reminder)
//  - check-out today
export const Route = createFileRoute("/api/public/hooks/checkin-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const today = new Date();
        const yyyy = today.getUTCFullYear();
        const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(today.getUTCDate()).padStart(2, "0");
        const todayStr = `${yyyy}-${mm}-${dd}`;
        const t = new Date(today);
        t.setUTCDate(t.getUTCDate() + 1);
        const tomorrowStr = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;

        // Find relevant proposals
        const { data: proposals, error } = await supabaseAdmin
          .from("swap_proposals")
          .select("id, match_id, start_date, end_date, status, matches!inner(id, user_a, user_b)")
          .in("status", ["accepted", "confirmed"])
          .or(`start_date.eq.${tomorrowStr},end_date.eq.${todayStr}`);
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        let created = 0;
        for (const p of proposals ?? []) {
          const m: any = (p as any).matches;
          if (!m) continue;
          const recipients: string[] = [m.user_a, m.user_b].filter(Boolean);

          let type = "";
          let title = "";
          let body = "";
          if (p.start_date === tomorrowStr) {
            type = "checkin_reminder";
            title = "Check-in tomorrow";
            body = `Your home swap starts on ${p.start_date}. Get ready!`;
          } else if (p.end_date === todayStr) {
            type = "checkout_reminder";
            title = "Check-out today";
            body = `Your home swap ends today. Don't forget check-out steps.`;
          } else {
            continue;
          }

          for (const uid of recipients) {
            // Idempotency: skip if same type+proposal already created today
            const { data: existing } = await supabaseAdmin
              .from("notifications")
              .select("id")
              .eq("user_id", uid)
              .eq("type", type)
              .contains("meta", { proposal_id: p.id })
              .gte("created_at", `${todayStr}T00:00:00Z`)
              .limit(1);
            if (existing && existing.length > 0) continue;

            const { error: insErr } = await supabaseAdmin.from("notifications").insert({
              user_id: uid,
              type,
              title,
              body,
              link: `/chat/${p.match_id}`,
              meta: { proposal_id: p.id, match_id: p.match_id },
            });
            if (!insErr) created++;
          }
        }

        return Response.json({ ok: true, processed: proposals?.length ?? 0, created });
      },
    },
  },
});