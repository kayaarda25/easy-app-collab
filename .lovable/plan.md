
# flatch. – Phase 1 MVP Plan

Mobile-first Web-App + PWA mit Airbnb-ähnlichem Premium-Design. Phase 1 deckt den kompletten Kern-Loop ab: Registrieren → Profil → Property → Suchen/Swipen → Match → Chat → Tauschvorschlag. Payments, Truvi, Reviews und Admin folgen in späteren Phasen.

## Was wir bauen

**Authentifizierung & Profile**
- E-Mail/Passwort + Google Sign-In via Lovable Cloud
- Onboarding-Flow: Registrieren → Email bestätigen → Profil anlegen (Name, Foto, Bio, Sprachen, Geburtsdatum)
- Passwort-Reset Flow mit `/reset-password` Seite

**Property Management**
- Property erstellen: Titel, Beschreibung, Typ (Haus/Wohnung), Räume, Schlafplätze, Annehmlichkeiten
- Adresse mit Stadt/Land (genaue Adresse erst nach Match-Bestätigung sichtbar)
- Bildupload (mehrere Fotos) in Lovable Cloud Storage
- Verfügbarkeitskalender: Zeiträume markieren wann Tausch möglich

**Discovery & Matching**
- Such-Screen mit Destination, Datums-Range, Personenanzahl
- Swipe-Interface (links = pass, rechts = like) im Tinder-Stil mit Property-Karten
- Match wird erstellt wenn beide Seiten liken
- Matches-Übersicht

**Chat & Swap Proposal**
- Realtime 1-zu-1 Chat zwischen Matches (Lovable Cloud Realtime)
- "Tauschvorschlag erstellen"-Button im Chat: Zeitraum, Property-Auswahl
- Status-Tracking: pending → accepted → confirmed

**Design**
- Airbnb-ähnlich: viel Weißraum, große Bilder, runde Buttons, warmes Rot (#FF385C-ähnlich) als Akzent
- Mobile-first, Bottom-Tab-Navigation (Home, Search, Matches, Chat, Profile)
- Smooth Animations, hochwertige Typography (Inter/SF Pro Stil)
- Responsive – läuft auch auf Desktop sauber

**PWA**
- Manifest + Icons → installierbar auf iOS/Android Home-Screen
- Theme color, App-Name "flatch."
- Bereit für späteren Capacitor-Wrap

## Architektur

```text
src/routes/
  index.tsx                    → Landing/Welcome
  auth.tsx                     → Login/Signup
  reset-password.tsx           → Passwort-Reset
  _authenticated/
    route.tsx                  → Auth-Gate (integration-managed)
    home.tsx                   → Dashboard
    search.tsx                 → Such-Screen
    swipe.tsx                  → Swipe-Interface
    matches.tsx                → Match-Liste
    chat.$matchId.tsx          → Chat-Detail
    property.new.tsx           → Property erstellen
    property.$id.tsx           → Property bearbeiten
    profile.tsx                → Eigenes Profil
    onboarding.tsx             → Erstes Setup
```

Backend: Lovable Cloud (PostgreSQL + Auth + Storage + Realtime).

## Technische Details

**Datenbank-Tabellen (Phase 1):**
- `profiles` – verknüpft mit `auth.users`, Bio, Avatar, Sprachen
- `properties` – Owner, Titel, Beschreibung, Stadt, Land, exakte Adresse (privat), Räume, Schlafplätze
- `property_images` – Foto-URLs, Reihenfolge
- `availabilities` – Property, Start/End-Datum, Status
- `swipes` – User, Property, Direction (like/pass)
- `matches` – beide User-IDs, beide Property-IDs, erstellt-at
- `messages` – Match, Sender, Text, Erstellungs-Zeit (Realtime)
- `swap_proposals` – Match, vorgeschlagene Daten, Status

**Sicherheit:** RLS auf allen Tabellen. User-Rollen in separater `user_roles` Tabelle. Adresse-Felder erst sichtbar wenn Swap bestätigt.

**Routing:** TanStack Start mit File-based Routes, `_authenticated`-Layout für geschützte Bereiche.

**State:** TanStack Query für Server-State, lokaler State mit React useState/useReducer.

## Was NICHT in Phase 1 ist

- Stripe/Apple/Google Payments + Subscriptions (Basic/Standard/Premium)
- Truvi Screening & Protection
- Booking-Confirmation Flow mit Bezahlung
- Reviews & Ratings
- Claims Management
- Admin Dashboard
- Email-Versand via Resend (außer Auth-Mails von Lovable Cloud)
- SMS-Verifikation via Twilio
- Push Notifications via FCM
- Google Places API für Adresssuche (erstmal manuelles Eingabefeld)
- iOS/Android Capacitor-Build und App-Store-Einreichung

Diese Punkte machen wir in **Phase 2+** sobald Phase 1 stabil läuft und du echte Test-User hast.

## Was du als Nächstes brauchst (außerhalb Lovable)

Für den späteren App-Store-Release:
- Apple Developer Account ($99/Jahr)
- Google Play Developer Account ($25 einmalig)
- Mac mit Xcode (für iOS-Build)
- Capacitor-Setup (machen wir wenn Phase 1 fertig ist)

Sobald du den Plan bestätigst, aktiviere ich Lovable Cloud und baue Phase 1.
