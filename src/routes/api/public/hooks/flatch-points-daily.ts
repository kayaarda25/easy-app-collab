import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily cron hook for flatch.points maintenance:
 *  - Award points for async stays where checkout date has passed
 *  - Expire points past their expires_at
 *  - Send 90/30/7 day expiry reminders
 *
 * Called by pg_cron via apikey-authenticated POST. See README.
 */
export const Route = createFileRoute("/api/public/hooks/flatch-points-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [awarded, expired] = await Promise.all([
          supabaseAdmin.rpc("flatch_points_process_completed_stays"),
          supabaseAdmin.rpc("flatch_points_expire_due"),
        ]);
        await supabaseAdmin.rpc("flatch_points_notify_expiring");
        return Response.json({
          ok: true,
          stays_awarded: awarded.data ?? 0,
          points_expired: expired.data ?? 0,
          at: new Date().toISOString(),
        });
      },
    },
  },
});