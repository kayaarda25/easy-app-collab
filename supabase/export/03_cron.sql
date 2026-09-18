-- flatch: Taegliche Automatik-Aufgaben
-- Auf dem NEUEN Supabase-Projekt ausfuehren, NACHDEM die App auf das neue Projekt zeigt.
-- WICHTIG: <NEUER_PUBLISHABLE_KEY> unten durch den oeffentlichen Schluessel des neuen Projekts ersetzen.

create extension if not exists pg_cron with schema cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'flatch-points-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://app.flatch.ch/api/public/hooks/flatch-points-daily',
    headers := '{"Content-Type":"application/json","apikey":"<NEUER_PUBLISHABLE_KEY>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'flatch-checkin-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://app.flatch.ch/api/public/hooks/checkin-reminders',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
