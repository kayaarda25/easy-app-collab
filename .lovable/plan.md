## Ziel
Das hochgeladene Logo (`flatch_icon_beige.pdf`) wird zum offiziellen Logo der App und ersetzt alle bisherigen „flatch."-Textmarken sowie die generischen Icon-Platzhalter.

## Was ich tun werde

### 1. Logo aus PDF in PNGs konvertieren
- PDF rendern via ImageMagick in mehreren Auflösungen
- Hochgeladene PNGs zu Lovable CDN-Assets hochladen (`lovable-assets create`)
- Versionen: `512×512` (App Icon), `192×192` (PWA), `180×180` (Apple Touch), `32×32` (Favicon), plus eine transparente Variante für inline Wordmark-Ersatz

### 2. Favicon / PWA Icons ersetzen
- `public/icon-192.png` und `public/icon-512.png` durch neues Logo ersetzen
- `public/manifest.webmanifest` Icons-Pfade aktualisieren (bleiben gleich, nur Inhalt neu)
- Favicon-Link in `src/routes/__root.tsx` hinzufügen (aktuell nur `apple-touch-icon` + manifest)

### 3. Wiederverwendbare `<Logo />` Komponente
- Neue Datei `src/components/Logo.tsx` mit Props `size` und `variant` (icon-only oder icon+wordmark)
- Nutzt das neue Asset

### 4. Überall einsetzen
Ersetze die aktuell als reiner Text gerenderten „flatch."-Wortmarken durch `<Logo />` in:
- `src/routes/index.tsx` (Onboarding Topbar)
- `src/routes/auth.tsx` (Login/Signup Header)
- `src/routes/_authenticated/home.tsx`, `swipe.tsx`, `matches.tsx`, `inbox.tsx`, `profile.tsx`, `settings.tsx`, `notifications.tsx`, `paywall.tsx`, `onboarding.tsx`, `property.new.tsx`, `search.tsx`, `u.$userId.tsx`, `chat.$matchId.tsx`
- `src/routes/_authenticated/admin.*.tsx` (alle Admin-Seiten)
- `src/routes/reset-password.tsx`
- Komponenten: `NotificationsBell.tsx`, `HomeFeed.tsx`, `Reviews.tsx`, `Recommendations.tsx`

Wo „flatch." nur als Erwähnung im Fließtext steht (z.B. „Willkommen bei flatch."), bleibt es als Text — Logo ersetzt nur Header/Branding-Stellen.

### 5. Email-Logo
- `src/lib/email.server.ts`: Logo-URL (CDN) in Email-Templates einsetzen

### 6. Verifikation
- Build laufen lassen
- Preview-Screenshot der Startseite zur Kontrolle

## Was ich NICHT tue
- Keine Farbänderungen am Theme (Logo ist beige — falls Background/Theme angepasst werden soll, frag ich danach separat)
- Keine neuen Brand-Guidelines / Typografie-Änderungen
- Keine Splash-Screens für iOS (separate Größen — kann ich nachschieben falls gewünscht)

## Frage vor Start
Soll ich beim PWA Icon das Logo **mit Hintergrundfarbe** (z.B. dunkler Hintergrund passend zum Beige) oder **transparent** verwenden? iOS rundet transparente Icons mit weißem Hintergrund — sieht oft schlechter aus als ein gefüllter Hintergrund.
