# CLAUDE.md — IAssistent

Lees dit volledig voor je iets bouwt.

## Product

IAssistent (werknaam) is een webplatform dat een **hoofdcoach van seniors in het provinciale
voetbal (België)** een AI-staf geeft: **Assistent Coach, Tactical Coach, Physical Coach en
Video Analist**.

- De coach geeft per week input: weekplanning (vast of variabel), selectie, blessures,
  volgende tegenstander.
- De rollen stemmen onderling af in een **stafmeeting** en geven voorstellen terug:
  weekplanning, uitgewerkte trainingen, belasting per oefening (duur, reeksen, intensiteit,
  periodisering) en wedstrijdvoorbereiding.
- **De hoofdcoach beslist**: hij keurt alles goed of past het aan. Alle rollen volgen zijn visie.

### Gebruikers en white label

- Alleen **coaches en clubowners** loggen in. Elke ingelogde gebruiker heeft een rij in `coaches`.
  Spelers zijn data binnen een team en loggen nooit in.
- Het **account en het visieprofiel horen bij de coach**. **Branding** (clubnaam, logo,
  kleuren) hoort bij een **team**.
- **Transfer**: de coach archiveert zijn team en maakt een nieuw team met nieuwe branding.
  Een gearchiveerd team blijft leesbaar voor de coach (inclusief alle oefenstof die toen
  gemaakt is), maar is read-only. Teams worden nooit verwijderd door gebruikers.
- Eén ingelogde **hoofdcoach per team**. Hij kan een menselijke **T2 tijdelijke leestoegang**
  geven (verplichte einddatum).
- Optioneel: een **club** koopt licenties (`clubs.license_seats` = max. aantal actieve teams)
  en maakt teams aan voor coaches. De **clubowner ziet de teams en spelers** van de club.
- Het **visieprofiel is persoonlijk**. Delen gebeurt alleen met expliciete toestemming van de
  coach (`coach_profile_shares`, met een coach of met een club).
- Strikte scheiding van data per coach/club via **Row Level Security**.

## Stack

- **Next.js** (App Router, TypeScript) in `apps/web`, gehost op **Vercel**.
- **Supabase** (Postgres, Auth, Storage) in de **EU-regio**. Twee projecten: **staging**
  (testdata) en **productie**.
- **Claude API** voor de AI-staf — **alleen server-side**, nooit in client components en
  nooit met een `NEXT_PUBLIC_`-key. (Nog niet gebouwd in fase 1.)
- pnpm workspaces, Node 22, TypeScript 6 (TS 7 wordt nog niet ondersteund door typescript-eslint).

## Taal

- **Code, identifiers, bestandsnamen in code, database, commits: Engels.**
- **Alle UI-teksten en AI-output: Nederlands.** UI-teksten staan centraal in
  `apps/web/src/lib/messages.ts`, niet inline in componenten.
- Inhoud in `/staff` is Nederlands (bestandsnamen zoals `rol.md` en `instructies.md` horen bij
  de inhoud). Rol-id's zijn Engelse kebab-case (`tactical-coach`).

## Mappenstructuur

```
apps/web/                 Next.js-app (UI, server actions, auth)
  src/app/(auth)/         login, registratie
  src/app/(app)/          ingelogde pagina's (teams)
  src/app/auth/           callback (magic link / bevestiging), afmelden
  src/lib/                supabase-clients, auth, messages, validatie, feature flags
  src/proxy.ts            sessie verversen + routes afschermen (Next 16 "proxy")
packages/staff-engine/    laadt en valideert /staff (geen voetbalinhoud, nog geen AI)
packages/db/              databasetypes + gedeelde constants (bucket, feature flag keys)
services/video/           aparte videodienst — later
staff/                    ALLE rolinhoud (markdown + JSON)
  _gedeeld/               gedeelde afspraken + rol-sjabloon.md
  assistant-coach/  tactical-coach/  physical-coach/  video-analyst/
    rol.md  instructies.md  output-schema.json  referentie/  voorbeelden/  tests/
supabase/
  migrations/             schema, RLS, storage-policies (enige bron van waarheid)
  seed.sql                fictieve testcoach + testteam (alleen lokaal/staging)
  tests/database/         pgTAP-tests (RLS en bedrijfsregels)
  tests/support/          stub om tests zonder Docker te draaien
scripts/test-db.sh        draait migraties + seed + pgTAP op een tijdelijke Postgres
.claude/skills/           nieuwe-rol, rol-bijwerken, feature-flag, release
```

## Harde regel: geen voetbalinhoud in code

**Er staat nooit voetbalinhoud hardcoded in de code.** Alles wat een rol weet, zegt of
voorstelt, staat in `/staff` (markdown/JSON) of in de database (bv. de visie van de coach).

- Níét in code: oefeningen, trainingsvormen, belastingsnormen, periodiseringsmodellen,
  tactische principes, prompts/rolbeschrijvingen, voorbeeldoutput, posities met uitleg, …
- Wél in code: structuur (bestands- en mapnamen van `/staff`, JSON-schema-validatie),
  datamodellen, UI-teksten van het platform zelf (`messages.ts`).
- Twijfel? Zet het in `/staff` en laat de engine het inlezen.
- De staff-engine leest `/staff` in en valideert het: `pnpm staff:validate`. De verplichte
  secties van `rol.md` komen uit `staff/_gedeeld/rol-sjabloon.md`, niet uit de code.

## Database en toegang

- Elke tabel heeft RLS aan. Nieuwe tabellen: RLS aan + policies + pgTAP-tests in dezelfde PR.
- Toegang loopt via `security definer`-helpers in de migratie:
  `can_read_team(team_id)` (hoofdcoach, actieve T2, clubowner — óók voor gearchiveerde teams),
  `can_write_team(team_id)` (alleen hoofdcoach en alleen als het team niet gearchiveerd is),
  `is_club_owner`, `can_read_coach_profile`, `is_feature_enabled`.
- **Nieuwe teamgebonden data** (trainingen, oefenstof, weekplanningen, …) krijgt een `team_id`
  en gebruikt `can_read_team` voor lezen en `can_write_team` voor schrijven. Zo blijft
  oefenstof van een gearchiveerd team leesbaar.
- `teams.head_coach_id` en `teams.club_id` zijn onveranderlijk (trigger).
- `anon` heeft geen toegang tot `public`. Nieuwe functies: `revoke execute ... from anon, public`.
- Migraties: nieuwe file in `supabase/migrations/` (`YYYYMMDDHHMMSS_beschrijving.sql`),
  nooit een bestaande migratie wijzigen die al op staging/productie staat.
- Na een migratie: `packages/db/src/database.types.ts` bijwerken (zie `packages/db/README.md`).
- Storage: privé bucket `team-logos`, pad `<team_id>/logo.<ext>`, getoond via signed URLs.
  Logo's: PNG/JPG/WEBP, max. 2 MB, type gecontroleerd op de bytes (geen SVG).

## Feature flags

Per coach of per club in `feature_flags`; een coach-flag gaat voor op een club-flag.
Server-side controleren met `isFeatureEnabled(key)` (`apps/web/src/lib/feature-flags.ts`).
Keys staan in `FEATURE_FLAGS` in `packages/db`. Gebruikers kunnen flags niet zelf zetten.
Gebruik de skill `feature-flag`.

## Branches en omgevingen

- `main` = productie (Vercel production + Supabase-productie).
- `develop` = testomgeving (Vercel preview/staging + Supabase-staging).
- `feature/<korte-naam>` per feature, vertakt van `develop`, PR naar `develop`.
- Release: PR `develop` → `main` (skill `release`). Migraties eerst op staging, dan productie.
- Nooit rechtstreeks op `main` pushen. Nooit de seed op productie draaien.

## Lokaal ontwikkelen

```bash
pnpm install
cp .env.example apps/web/.env.local     # vul Supabase-URL en publishable key in
supabase start && supabase db reset     # lokale Supabase (Docker) + migraties + seed
pnpm dev                                # http://localhost:3000
```

Testaccount (seed): `coach@iassistent.test` / `Testcoach123!`.

## Testen

Draai vóór elke commit/PR:

```bash
pnpm typecheck          # TypeScript in alle packages
pnpm lint               # ESLint (web) + tsc (packages)
pnpm test               # Vitest: staff-engine + web (validatie, helpers)
pnpm staff:validate     # structuur van /staff
pnpm test:db            # migraties + seed + pgTAP-RLS-tests op tijdelijke Postgres (geen Docker nodig;
                        #   vereist Postgres 16 + pgTAP + pg_prove lokaal)
pnpm build              # productiebuild van de web-app
```

Met Docker kan het ook tegen een echte lokale Supabase: `supabase db reset && supabase test db`.

Regels:
- Elke RLS-wijziging krijgt pgTAP-tests (wie mag wel, wie mag níét).
- Elke rol in `/staff` blijft valideren (`pnpm staff:validate`).
- Rapporteer eerlijk wat niet getest kon worden.

## Fase-status

- **Fase 1 (fundering)** — structuur, schema + RLS, login, team aanmaken, staff-engine die
  `/staff` inleest. **Geen AI-rollen en geen stafmeeting.**
- Nog niet gebouwd: UI voor T2-toegang, clubbeheer, spelersbeheer en visieprofiel; AI-calls;
  stafmeeting; videodienst.
