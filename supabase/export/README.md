# Umzug auf ein eigenes Supabase-Projekt

Diese Dateien bilden den kompletten Aufbau der aktuellen Datenbank ab. Damit lässt sich
ein eigenes Supabase-Projekt aufsetzen, auf das Cursor vollen Zugriff hat.

## Reihenfolge

1. **Projekt anlegen** auf supabase.com (Region: Frankfurt).
2. **`01_schema.sql`** im SQL Editor ausführen – Tabellen, Typen, Rechte, Regeln,
   Funktionen und Auslöser.
3. **`02_storage.sql`** ausführen – die vier Dateiablagen plus Zugriffsregeln.
4. **Anmeldung einrichten**: E-Mail-Login aktivieren, Google und Apple neu hinterlegen
   (Rückruf-Adresse: `https://<neues-projekt>.supabase.co/auth/v1/callback`).
5. **Daten kopieren** (optional, siehe unten).
6. **App umstellen**: Projekt-URL, öffentlicher Schlüssel und Service-Schlüssel eintragen.
7. **`03_cron.sql`** ausführen – erst wenn die App auf das neue Projekt zeigt.

## Daten aus der bisherigen Datenbank kopieren

Der bisherige Zugang ist von aussen gesperrt. Die Inhalte werden daher tabellenweise
übertragen; Reihenfolge wegen der Verknüpfungen:

```
auth.users
profiles, subscriptions, user_roles
properties, property_images, availabilities
swipes, matches, match_reads, messages
swap_proposals, booking_guests, reviews, review_private_feedback
recommendations, recommendation_likes, recommendation_comments
flatch_points_ledger, flatch_premium_bonus_claims
notifications, support_tickets, support_messages
content_reports, admin_audit_log, admin_broadcasts
```

Hinweis: Auslöser auf `auth.users` legen Profil und Abo automatisch an. Beim Import
zuerst die Nutzer einspielen, danach vorhandene Profile aktualisieren statt neu einfügen.

## Was in der App gesetzt werden muss

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Weitere Geheimnisse im neuen Projekt neu hinterlegen:
  `RESEND_API_KEY`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_BROWSER_KEY`,
  `REVENUECAT_WEBHOOK_AUTH_HEADER`, `LOVABLE_API_KEY`

## Backend-Funktionen

`supabase/functions/` (support-send, support-escalate, translate-text) müssen im neuen
Projekt erneut bereitgestellt werden.
