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
- **Supabase** (Postgres, Auth, Storage) in de **EU-regio**. Doel: twee projecten, **staging**
  (testdata) en **productie**. **Voorlopig is er één project** (met seed-testdata) tot de tool
  klaar is voor echte coaches; het productieproject en een eigen SMTP komen later.
- **Claude API** voor de AI-staf — **alleen server-side**, nooit in client components en
  nooit met een `NEXT_PUBLIC_`-key. Officiële SDK `@anthropic-ai/sdk` in `packages/staff-engine`
  (`anthropicProvider`), standaardmodel `claude-opus-5-5`, structured outputs volgens de
  `output-schema.json` van de rol, `fallbacks: "default"`.
- **Testmodus (standaard):** zolang `STAFF_AI_PROVIDER=anthropic` en `ANTHROPIC_API_KEY` niet
  gezet zijn, maakt de `exampleProvider` voorstellen uit `staff/<rol>/voorbeelden/` — geen AI,
  geen kosten. Echte AI-runs: max. 5 per coach per dag (`staff_daily_limit()` in de database).
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
  _gedeeld/               gedeelde afspraken, rol-sjabloon.md, posities.json, formaties.json,
                          visieprofiel.json, wedstrijddagen.json (MD-labels), periodisering.json
                          (weektypes + cycli 4/6/8 weken), testen.json (VAMEVAL/MAS),
                          opdracht-systeem.md + opdracht-gebruiker.md (opdrachtsjablonen AI)
  assistant-coach/  tactical-coach/  physical-coach/  video-analyst/
    rol.md  instructies.md  output-schema.json  referentie/  voorbeelden/  tests/
    taken/<taak-id>/      extra taak van een rol (eigen instructies.md, output-schema.json,
                          voorbeelden/), bv. tactical-coach/taken/oefenstof
supabase/
  migrations/             schema, RLS, storage-policies (enige bron van waarheid)
  seed.sql                fictieve testcoach + testteam (alleen lokaal/staging)
  tests/database/         pgTAP-tests (RLS en bedrijfsregels)
  tests/support/          stub om tests zonder Docker te draaien
scripts/test-db.sh        draait migraties + seed + pgTAP op een tijdelijke Postgres
.claude/skills/           nieuwe-rol, rol-bijwerken, visie-bijwerken, feature-flag, release
```

## Harde regel: geen voetbalinhoud in code

**Er staat nooit voetbalinhoud hardcoded in de code.** Alles wat een rol weet, zegt of
voorstelt, staat in `/staff` (markdown/JSON) of in de database (bv. de visie van de coach).

- Níét in code: oefeningen, trainingsvormen, belastingsnormen, periodiseringsmodellen,
  tactische principes, prompts/rolbeschrijvingen, voorbeeldoutput, posities met uitleg, …
- Wél in code: structuur (bestands- en mapnamen van `/staff`, JSON-schema-validatie),
  datamodellen, UI-teksten van het platform zelf (`messages.ts`).
- Twijfel? Zet het in `/staff` en laat de engine het inlezen.
- De web-app leest `/staff` via een bundel: `pnpm run staff:bundle` (automatisch bij dev, build,
  typecheck en test in `apps/web`) valideert alles met de staff-engine en schrijft
  `apps/web/src/generated/staff.json` (niet in git). Ongeldige inhoud laat de build falen.
  De database bewaart enkel codes (positie, formatie), nooit de inhoud zelf.
- De opdracht aan een AI-rol wordt opgebouwd uit de sjablonen in `_gedeeld` (`{{invulvelden}}`)
  + `rol.md`, `instructies.md`, `referentie/`, `voorbeelden/`. Ook de tekst van de opdracht is
  inhoud: nooit prompttekst in code.
- **Privacy:** de AI krijgt spelers enkel als rugnummer + posities + voet + status, nooit namen.
  De app zet de namen er pas bij het tonen weer bij.
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
- **Valkuil `insert ... returning`**: de SELECT-policy wordt ook op de nieuwe rij gecontroleerd.
  Een helper die de rij opnieuw opzoekt (bv. `can_read_team(id)` op de eigen tabel) ziet een rij
  uit hetzelfde statement niet → "new row violates row-level security policy". Laat de
  SELECT-policy daarom eerst de eigen kolommen van de rij controleren (bv. `head_coach_id = auth.uid()`)
  en test elke insert die de app doet mét `returning` in pgTAP.
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
  Zolang er één Supabase-project is, voer je een nieuwe migratie daarop uit zodra ze op
  `develop` staat (SQL Editor of `supabase db push`).
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
- **Fase 2a** — spelersbeheer (kern, status, posities, voorkeursvoet, seizoenen bij de club,
  uit de kern halen), wedstrijdselecties (formatie op het veld, basis en bank) en het
  visieprofiel (`/profile/vision`, vragenlijst uit `staff/_gedeeld/visieprofiel.json`, opgeslagen
  in `coach_profiles.vision` als `{ versie, antwoorden: { "<thema>.<vraag>": ... } }`).
- **Fase 3a** — Assistent Coach: weekinput per team (`week_plans`, standaard trainingsschema op
  `teams.training_schedule`), MD-labels, voorstel aanvragen/aanpassen/goedkeuren
  (`staff_proposals`, alle versies bewaard), afdrukken en kopiëren als tekst. Feature flag
  `staff.assistant_coach`. Draait in testmodus tot de AI wordt aangezet.
- **Fase 3b** — Physical Coach: belastingsplan per week (weektype uit de periodisering vanaf de
  eerste competitiewedstrijd, `teams.competition_start_date` + `teams.periodization_weeks`),
  werkelijke belasting per sessie (`session_loads`: gemiddelde RPE van de groep × minuten = AU),
  tabblad Testen (`fitness_tests`, VAMEVAL/MAS, afstanden per speler voor MAS-lopen),
  grafiek gepland/werkelijk. Volgorde: eerst Physical Coach; zijn **goedgekeurde** plan gaat via
  `staf` mee naar de Assistent Coach (rolvolgorde in `apps/web/src/lib/roles.ts`). Feature flag
  `staff.physical_coach`.
- **Fase 3c** — Tactical Coach, drie taken: **tactisch weekplan** (taak `default`: tegenstander,
  lessen, speelplan, standaardsituaties met tekening, tactische accenten per trainingsdag),
  **oefenstof uittekenen** (taak `oefenstof`: een tekening per onderdeel van de weekplanning) en
  **wedstrijdvoorbereiding** (taak `wedstrijdvoorbereiding`: opstelling, standaardsituaties voor
  de kleedkamer, scenario's, wedstrijdbespreking). Vaste structuur in
  `referentie/wedstrijdvoorbereiding.md`. Tekeningen zijn JSON (`$defs.tekening`), de app tekent
  ze als SVG. Tabblad Tegenstanders (`opponents`, gekoppeld op naam aan de wedstrijd in de
  weekinput; `opponent_lineups` met rugnummer + naam per post en bank, `source` `coach` of later
  `video`), wedstrijdevaluaties (`match_reports`, ook "zelfde formatie als de volgende
  tegenstander"), "Zet in Selecties" (`lineups.source = 'tactical-coach'`). Namen van
  tegenstanders gaan nooit naar de AI. Feature flag `staff.tactical_coach`.
- **Fase 3d — stafmeeting** — de hoofdcoach vraagt één keer; een **run** (`staff_runs`, `kind`
  `week` of `match`) groepeert de voorstellen (`staff_proposals.run_id` + `step`). Volgorde in
  `RUN_STEPS` (`apps/web/src/lib/roles.ts`): weekdocument = Physical Coach + Tactical Coach
  (weekplan) samen → Assistent Coach → Tactical Coach tekent de oefenstof; elke stap krijgt het
  werk van de eerdere stappen van dezelfde run als `staf`. Elke stap draait in een eigen request
  (`advanceRun`, de pagina vraagt de volgende stappen aan zolang de run bezig is; stappen worden
  geclaimd met een voorwaardelijke update). De coach keurt een run als geheel goed; aanpassen kan
  voor de hele staf of voor één stap (die stap en wat erop verder bouwt werken opnieuw, de rest
  wordt gekopieerd via `based_on`). De wedstrijdvoorbereiding (run `match`) kan pas na het
  goedgekeurde weekdocument en vanaf de dag van de laatste training. Weekdocument en
  wedstrijdvoorbereiding zijn afdrukbaar. De daglimiet (`staff_daily_limit()`) telt runs.
- **Teaminstellingen** (`/teams/[id]/settings`) — vaste trainingsdagen (`teams.training_schedule`,
  elke nieuwe week neemt ze over; optioneel ook toepassen op open weken zonder weekdocument) en
  seizoensplanning: voorbereiding (`preparation_start_date` + `preparation_weeks`) en competitie
  (`competition_start_date` + `periodization_weeks`), elk met een eigen cyclus van 4/6/8 weken
  (`weekPeriodization(weekStart, SeasonPlan, catalog)` in de staff-engine). Afwijkende weken pas je
  enkel in de weekinput aan.
- Nog niet gebouwd: Video Analist, volledige stafmeeting; UI voor T2-toegang,
  clubbeheer, visie delen; CSV-import; oefeningen handmatig wijzigen; videodienst.
