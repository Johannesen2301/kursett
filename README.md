# Kursett — Lag 0 (Grunnmuren)

React + Vite + Supabase. Innlogging, registrering, beskyttede ruter og app-skallet i den blå identiteten.

## Kom i gang

### 1. Installer avhengigheter
```bash
npm install
```

### 2. Sett opp Supabase
1. Gå til [supabase.com](https://supabase.com) og opprett et prosjekt (eller bruk et eksisterende).
2. I prosjektet: **Settings → API**. Kopier **Project URL** og **anon public**-nøkkelen.
3. Kopier miljøfila og fyll inn verdiene:
   ```bash
   cp .env.example .env.local
   ```
   Åpne `.env.local` og lim inn:
   ```
   VITE_SUPABASE_URL=https://ditt-prosjekt.supabase.co
   VITE_SUPABASE_ANON_KEY=din-anon-nokkel
   ```

> **Om nøkler:** anon-nøkkelen er trygg i frontend — den beskyttes av Row Level
> Security i Supabase. Dette er *ikke* det samme som en hemmelig API-nøkkel
> (f.eks. Anthropic), som aldri skal ligge i frontend. Legg alltid `.env.local`
> i `.gitignore` (det er allerede gjort).

### 3. (Valgfritt) Skru på e-postbekreftelse
I Supabase under **Authentication → Providers → Email** kan du velge om nye
brukere må bekrefte e-posten. For rask testing kan du slå den av.

### 4. Kjør lokalt
```bash
npm run dev
```
Åpne adressen som vises (som regel http://localhost:5173).

## Deploy til Netlify
1. Push prosjektet til GitHub, eller dra mappen inn i Netlify.
2. Build-kommando: `npm run build` · Publish-mappe: `dist`
3. Legg inn miljøvariablene (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) under
   **Site settings → Environment variables**.
4. `public/_redirects` sørger allerede for at ruter fungerer ved refresh.

## Hva som er bygget (Lag 0)
- ✅ React + Vite-prosjekt
- ✅ Supabase-klient + miljøvariabler
- ✅ Registrering + innlogging + utlogging
- ✅ Beskyttede ruter (kun innlogget tilgang)
- ✅ App-skall med sidebar-navigasjon (blå identitet)
- ✅ Klar for Netlify-deploy

**Neste:** Lag 1 — Nordnet-import, porteføljebånd og nøkkeltall.
