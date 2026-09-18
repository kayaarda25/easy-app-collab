# Umzug auf eine eigene Datenbank (voller Zugriff für Cursor)

Ziel: Die App läuft künftig auf einem Supabase-Projekt, das dir gehört. Damit hast du Datenbank-Passwort, Service-Key und Direktverbindung – Cursor kann alles lesen und schreiben.

Wichtig vorab: Die aktuelle, in Lovable verwaltete Datenbank gibt ihre Zugangsdaten grundsätzlich nicht heraus. Deshalb ist ein eigenes Projekt der einzige Weg zu echtem Fremdzugriff.

## Was du tun musst (ohne dich geht es nicht)

1. Konto auf supabase.com anlegen und ein neues Projekt erstellen (Region: Frankfurt/Zürich-nah).
2. Mir folgende Werte über das sichere Geheimnis-Formular geben:
   - Projekt-URL und öffentlicher Schlüssel (publishable/anon)
   - Service-Schlüssel (geheim)
   - Datenbank-Passwort bzw. Verbindungsstring (für die Übertragung der Daten)
3. Im neuen Projekt E-Mail-Login aktivieren und Google/Apple-Anmeldung neu einrichten (Zugangsdaten wandern nicht automatisch mit).

## Was ich übernehme

1. **Struktur übertragen**: Alle vorhandenen Änderungsdateien (rund 30 Stück) der Reihe nach im neuen Projekt anwenden – Tabellen, Rechte, Regeln, Funktionen, Auslöser.
2. **Nachziehen, was nur live existiert**: Ich vergleiche den tatsächlichen aktuellen Stand der bestehenden Datenbank mit den Dateien und schreibe fehlende Teile als zusätzliche Änderungsdatei nach, damit nichts fehlt.
3. **Ablagen anlegen**: Die vier Dateiablagen (Profilbilder, Chat-Anhänge, Objektfotos, Empfehlungs-Medien) samt Zugriffsregeln neu erstellen.
4. **Daten kopieren**: Bestehende Inhalte (Nutzerkonten, Profile, Objekte, Chats, Punkte usw.) vom alten ins neue Projekt übertragen, Reihenfolge beachtend. Dateien in den Ablagen werden ebenfalls kopiert.
5. **App umstellen**: Die Verbindungsdaten der App auf das neue Projekt zeigen lassen und alle Geheimnisse (Resend, Google Maps, RevenueCat-Webhook, KI-Schlüssel) dort neu hinterlegen.
6. **Automatische Tagesaufgaben** (Punkte-Verfall, Check-in-Erinnerungen) im neuen Projekt neu einplanen.
7. **Durchtesten**: Anmelden, Objekt anlegen, Swipen/Match, Chat, Admin-Bereich, Abo-Anzeige.

## Technische Details

- `.env` / `VITE_SUPABASE_*` und die servergenutzten `SUPABASE_*`-Werte zeigen künftig auf das neue Projekt. Da einige Dateien unter `src/integrations/supabase/` generiert sind, erfolgt die Umstellung über die Umgebungswerte, nicht durch Bearbeiten dieser Dateien.
- Migrationen aus `supabase/migrations/` werden chronologisch eingespielt; danach ein Abgleich gegen den Live-Stand (Funktionen wie `record_swipe`, `flatch_points_*`, `has_role`, Trigger auf `auth.users`) und eine Ergänzungsmigration.
- Datenkopie per `pg_dump`/`pg_restore` auf Datenebene inkl. `auth.users` (Passwort-Hashes bleiben erhalten, niemand muss sich neu registrieren).
- `supabase/functions/` (support-send, support-escalate, translate-text) werden im neuen Projekt neu bereitgestellt.
- Die Webhook-Adresse für RevenueCat bleibt unverändert, da sie in der App liegt.

## Risiken und Hinweise

- Kosten: Ein eigenes Supabase-Projekt hat ein kostenloses Kontingent, wächst aber mit Nutzung in einen bezahlten Tarif.
- Kurze Umschaltphase: Zwischen Datenkopie und Umstellung sollten keine neuen Inhalte entstehen, sonst gehen sie verloren. Am besten zu einer ruhigen Tageszeit.
- Google- und Apple-Anmeldung müssen mit der neuen Rückruf-Adresse beim jeweiligen Anbieter nachgetragen werden, sonst schlägt der Login fehl.
- Die Lovable-eigene Datenbank bleibt als Sicherung bestehen, bis alles läuft.

## Reihenfolge

1. Du legst das Projekt an und gibst mir die Zugangsdaten.
2. Ich baue Struktur und Ablagen auf.
3. Ich kopiere die Daten.
4. Ich stelle die App um und teste.
5. Du verbindest Cursor direkt mit dem neuen Projekt.
