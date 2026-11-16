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
                          opdracht-systeem.md + opdracht-gebruiker.md (opdrachtsjablonen AI),
                          gesprek-systeem.md + gesprek-gebruiker.md (gesprek met een rol),
                          samenwerking-systeem.md + samenwerking-gebruiker.md (gezamenlijke taak),
                          staffkamer.json + staffkamer-systeem.md + staffkamer-gebruiker.md (groepschat)
  coordinator/  assistant-coach/  tactical-coach/  physical-coach/  video-analyst/
  player-development/  team-manager/
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
  De hoofdcoach kan versies verwijderen (`staff_runs.deleted_at`, soft delete: blijft meetellen
  voor de daglimiet, nooit de goedgekeurde of een lopende versie, definitief; trigger
  `before_staff_run_update`). De app toont verwijderde runs en hun voorstellen nergens.
- **Teaminstellingen** (`/teams/[id]/settings`) — vaste trainingsdagen (`teams.training_schedule`,
  elke nieuwe week neemt ze over; optioneel ook toepassen op open weken zonder weekdocument) en
  seizoensplanning: voorbereiding (`preparation_start_date` + `preparation_weeks`) en competitie
  (`competition_start_date` + `periodization_weeks`), elk met een eigen cyclus van 4/6/8 weken
  (`weekPeriodization(weekStart, SeasonPlan, catalog)` in de staff-engine). Afwijkende weken pas je
  enkel in de weekinput aan.
- **Oefenstof** (`/exercises`) — persoonlijke bibliotheek van de coach (`exercises`, RLS op
  `coach_id`, zoals het visieprofiel): naam, fase, labels, spelers, duur, organisatie, verloop,
  coachingspunten, variaties, een **animatie** (JSON, `apps/web/src/lib/animation/schema.ts`) en een
  **video** (privé bucket `exercise-videos`, pad `<coach_id>/<exercise_id>/<bestand>`, max. 50 MB,
  rechtstreeks vanuit de browser opgeladen via een signed upload URL). De animatiespeler
  (`components/proposals/animated-drawing.tsx`) tekent in perspectief (`lib/animation/projection.ts`)
  met 3D-schijfjes; stijl, kleuren en logo op de schijfjes per team in `teams.animation_settings`
  (Instellingen → Weergave van animaties, `lib/animation/team-theme.ts`). Video's omzetten naar een
  animatie gebeurt nog buiten de app (importeren als .json); automatisch omzetten komt in de
  videodienst.
- **Oefenstof in de weekplanning** — elke oefening heeft een standaardbelasting (`sets`, `work_min`,
  `rest_min`, `intensity`, `rpe`) en `use_in_planning`. De staf krijgt de bibliotheek als
  `bibliotheek` in de context (`lib/exercises/library.ts`, max. 80, geen video's). De Assistent
  Coach kiest eerst uit de bibliotheek (`onderdelen[].oefening_id`, elke oefening hoogstens één keer
  per week) en schaalt de reeksen met de
  `reeksen_factor` van het weektype (`periodisering.json`) en de wedstrijddag
  (`wedstrijddagen.json`); de Tactical Coach tekent die onderdelen niet. Het weekdocument toont de
  eigen animatie en een link naar de oefening (`lib/exercises/week.ts`).
- **Stilstaande fases in de oefenstof** — een oefening is `kind` `exercise` of `set_piece`. Een
  standaardsituatie heeft een type (`set_piece_type`, code uit het Tactical Coach-schema), een
  teken (`signal`) en rollen met vereisten (`roles`, `[{ rol, vereiste }]`), zonder spelers. De
  Tactical Coach kiest eerst uit de eigen standaardsituaties (`standaardsituaties[].standaardsituatie_id`)
  en vult de rollen elke week in; hoogstens één nieuw voorstel (id null), dat de coach met
  "Bewaar in oefenstof" in zijn bibliotheek zet. De Assistent Coach gebruikt enkel oefeningen en
  traint de standaardsituaties van het weekplan in een eigen onderdeel op de laatste training vóór
  de wedstrijd (`onderdelen[].standaardsituaties` = titels); dat onderdeel wordt niet getekend.
- **Afdrukken en delen** — naast het weekdocument (`print`): een **weekoverzicht voor spelers**
  (`print/overview`, liggend A4 op één pagina in de teamkleuren, download als PNG via
  `html-to-image`; data uit `weekOverview()` in `lib/proposals/overview.ts`) en **trainingsbladen
  per dag** (`print/days`, staand A4, onderdelen en de standaardsituaties van die dag in een raster
  van 2 × 2). Gedeelde loader `loadWeekDocument` (`lib/weeks/document.ts`). Video's verschijnen op
  papier als stilstaand beeld (`components/proposals/video-still.tsx`).
- **Admin en Excel-import van spelers** — platformadmins staan in `platform_admins` (enkel via SQL
  te zetten; geen policies, niemand leest de tabel via de API). `is_platform_admin()`, `admin_teams()`,
  `admin_team_players(team)` en `admin_import_players(team, jsonb)` zijn `security definer` en
  controleren eerst de admin. Pagina `/admin/players` (link "Admin" enkel voor admins): sjabloon
  downloaden (leeg of met de huidige kern, `lib/players/template.ts`, exceljs, keuzelijsten), bestand
  controleren (voorbeeld met fouten per rij, `parseImportRows` in `lib/players/import.ts`) en
  importeren: zelfde rugnummer = bijwerken, anders nieuw, niemand verwijderd, max. 200 rijen.
- **Teamdashboard en navigatie** — links een donkere **zijbalk** (`components/sidebar.tsx`; op mobiel
  een menu) met de **teamkiezer** (`components/team-switcher.tsx`, opent een ander team op hetzelfde
  onderdeel) en enkel de **8 menu's van de hoofdcoach** (`NAV_ITEMS` in `lib/navigation.ts`): Dashboard,
  Mijn team (Spelers, Selecties, Instellingen, Visie), Planning (Microcyclus, Periodisering, Belasting),
  Staff Room, Taken, Wedstrijdanalyse (Volgende wedstrijd, Tegenstanders, Evaluaties), Oefenbibliotheek
  (Oefeningen, Standaardsituaties) en Rapportage (Testen, Seizoensverloop, Belasting per week). De
  onderdelen van een menu staan als **tabbladen** bovenaan de pagina (`components/section-tabs.tsx`), elk
  met het mannetje van de rol die het verzorgt (`member`). Elke rol heeft een eigen mannetje
  (`components/staff/role-avatar.tsx`, kleur per rol). `/teams/[id]/staff` verwijst naar de Staff Room.
  Belasting en Volgende wedstrijd verwijzen naar de weekpagina (`/load`, `/match`); Periodisering is een
  eigen pagina. Elk team heeft een **leeftijdscategorie** (`teams.age_category`:
  u15, u16, u17, u19, beloften, b-elftal, senioren; `lib/teams/age-categories.ts`).
  Teamonderdelen openen voor het huidige team of
  het laatst gebruikte (localStorage). Op grote schermen is de zijbalk **inklapbaar** tot enkel de iconen
  (`components/app-shell.tsx`, cookie `iassistent-sidebar` zodat de server meteen de juiste breedte toont). Een team opent op zijn **dashboard** (`/teams/[id]`,
  `components/dashboard/team-dashboard.tsx`): één scherm in donkere stijl, zonder teambanner. Bovenaan
  identiteit (logo en naam), volgende wedstrijd (uit de weekinput, met adres =
  `teams.home_address` bij thuis of `opponents.address` bij uit en trainer `opponents.coach_name`, die nooit
  naar de AI gaat), vorm (laatste 5 uit `match_reports`, punten sinds `competition_start_date`) en
  microcyclus (weektype uit de periodisering, trainingen en minuten). Daaronder de **kern op het veld** in de
  standaardformatie (`teams.default_formation`, Instellingen → Team; spelers per post via `depthChart` in
  `lib/teams/depth-chart.ts`: hoofdpositie, dan andere posities, dan dezelfde linie; klik op een speler om
  status en terugkeerdatum te wijzigen) met vandaag, de volgende dagen en de duur per dag (`dayPlans` in
  `lib/teams/microcycle.ts`, MD-labels uit `wedstrijddagen.json`), de laatste selectie en de beschikbaarheid.
  Gedeelde bouwstenen voor die stijl in `components/card.tsx` (`Card`, `CardHeader`, `EmptyState`,
  `ButtonLink`, `StatTile`); Spelers (kaarten per linie, `players/player-card.tsx`) en Selecties
  (kaarten met `components/mini-pitch.tsx`) volgen ze al.
- **Prijsplannen** — `plans` (naam, code, voor wie, prijs in cent of null = offerte op maat, per maand
  of jaar, optionele jaarprijs, max. hoofdtrainers/teams, kenmerken als JSON-lijst, aanbevolen, actief,
  volgorde). Iedereen leest de actieve plannen, enkel platformadmins beheren ze (RLS met
  `is_platform_admin()`). Het plan van een account staat op `coaches.plan_id`; een coach kan het niet zelf
  wijzigen (enkel `full_name` is te updaten), admins zetten het via `admin_set_account_plan()` en lezen
  de accounts met `admin_accounts()`. Admin: tabbladen Spelersimport, Prijsplannen (`/admin/plans`,
  bewerken en nieuw plan) en Accounts (`/admin/accounts`, plan koppelen, ook aan je eigen account om te
  testen). Klant: **Mijn abonnement** (`/account`, via het account onderaan de zijbalk). Nog geen
  online betaling en nog geen beperkingen per plan.
- **Donker thema** — alle pagina's in het werkvlak zijn donker, zoals het dashboard: `AppShell` zet de
  klasse `app-dark` op `<main>` (niet op het dashboard, dat een eigen donkere stijl heeft, en niet op de
  afdrukpagina's `/print`, die licht blijven voor papier). `app-dark` in `globals.css` draait de slate-schaal
  om, maakt `bg-white` een donker paneel en geeft de statuskleuren (groen, rood, amber, …) donkere tinten.
  Schrijf nieuwe pagina's gewoon met de lichte klassen (`bg-white`, `text-slate-600`, …); kies voor iets dat
  bewust donker moet blijven `bg-slate-800/900` (blijft donker) en vermijd vaste lichte hex-kleuren.
- **Staff Room en gesprek met een rol (testmodus)** — elke rol (ook de **AI Staff Coordinator**,
  `staff/coordinator`) heeft de taak `gesprek` (`taken/gesprek/`: instructies, schema `{ antwoord,
  taakvoorstel }`, voorbeelden). `runConversation` in de staff-engine bouwt de opdracht uit
  `gesprek-systeem.md`/`gesprek-gebruiker.md` en werkt ook voor placeholder-rollen; in testmodus wisselen
  de voorbeelden af. Elke rol heeft per team een **eigen gesprekshistoriek** (`staff_messages`: `role`,
  `author` coach/role, `content`, `task_proposal`, `provider`; lezen `can_read_team`, schrijven
  `can_write_team`, nooit wijzigen of verwijderen; daglimiet echte AI `staff_chat_daily_limit()` = 30).
  De rol krijgt de **goedgekeurde teamcontext** (`lib/staff-room/context.ts`: team, visie, kern zonder
  namen, deze week, goedgekeurde voorstellen, oefenstof) en de laatste 20 berichten. Server actions in
  `lib/staff-room/actions.ts` (`loadThread`, `sendMessage`); het gesprek zelf in
  `components/staff/chat-thread.tsx`, als paneel `RoleChatPanel` (`components/staff/staff-dock.tsx`).
  Op elke pagina staat rechts de **staf als kolom van mannetjes** (`components/staff/staff-dock.tsx`);
  een klik opent het gesprek in een paneel over de pagina. Nieuwe pagina's: Evaluaties (`/evaluations`),
  Seizoensverloop (`/reports`) en Belasting per week (`/reports/load`).
- **Gezamenlijke taken** — een rol stelt in een gesprek een taak voor (`taakvoorstel`); de hoofdcoach
  bevestigt ze ("Bevestig taak", `confirmTask`) en er ontstaat een `staff_tasks`-rij (één per voorstel,
  `source_message_id` uniek; `owner_role` = de rol die ze voorstelde). De stappen (`staff_task_steps`,
  per `version`): eerst een **bijdrage** van elke betrokken rol, dan het **eindvoorstel** van de eigenaar
  (`plannedSteps` in `lib/staff-room/tasks.ts`), elk met de taak `samenwerking` van de rol
  (`runCollaboration`, schema `{ samenvatting, inhoud, aandachtspunten }`, voorbeelden `bijdrage.json` en
  `eindvoorstel.json`). Elke stap draait in een eigen request (`advanceTask`, geclaimd met een
  voorwaardelijke update; `useTaskRunner` op de pagina vraagt de volgende stap zolang de taak loopt).
  Status `running` → `ready` (ter goedkeuring) → `approved`, of `failed` (opnieuw proberen). Aanpassen met
  feedback maakt een nieuwe versie waarin alle rollen opnieuw werken met de vorige versie en de feedback.
  RLS: lezen `can_read_team`, schrijven `can_write_team`, nooit verwijderen; daglimiet echte AI-stappen
  `staff_task_daily_limit()` = 20. Goedgekeurde taken gaan mee in de teamcontext (`goedgekeurde_taken`).
  Pagina's: **Taken** (`/teams/[id]/tasks`: lopend, voorgesteld, goedgekeurd) en de taak
  (`/teams/[id]/tasks/[taskId]`: werkverdeling, voorstel, bijdragen, eerdere versies).
- **Staffkamer (groepschat)** — de **Staff Room** (`/teams/[id]/staff-room?opdracht=&rol=`) is één groepschat:
  de hoofdcoach typt één opdracht (`staff_meetings`), de rollen spreken om beurten in de volgorde van
  `staff/_gedeeld/staffkamer.json` (soorten `opening`, `bijdrage`, `reactie`, `overzicht`; `meetingTurns`)
  en reageren op elkaar (`aan`); de laatste beurt maakt het **gezamenlijke overzicht** (`{ titel,
  samenvatting, onderdelen[{titel, inhoud, rol}], aandachtspunten }`). Elke rol heeft de taak `staffkamer`
  (`runMeetingTurn`, voorbeelden per soort, bv. `reactie.json`). Beurten in `staff_meeting_turns` (per
  `version`), één per request (`advanceMeeting`, geclaimd; `useMeetingRunner` laat een rol minstens
  1,3 s "typen"). Goedkeuren, of gewoon terugschrijven in de chat (`adjustMeeting`,
  `staff_meetings.feedbacks`, nieuwe versie waarin de staf verder praat met de feedback); "Nieuwe opdracht"
  sluit de bespreking en start een nieuwe. Gaat de opdracht over de week, dan bevat het overzicht een
  **`weekplan`**: beschikbaarheid (niet beschikbaar met reden, terugkeer en aanpassing), **elke dag** van
  maandag tot zondag met blokken (opwarming, kern, afsluiting), oefeningen (`oefening_id`), duur, reeksen,
  werk, rust, intensiteit en RPE, en een spelersplanning per dag (`components/staff/week-plan-view.tsx`,
  tabbladen "Voor de coach" en "Voor de spelers"; namen bij de rugnummers enkel in de app). De week is de
  huidige (op zondag de volgende); zonder weekinput gelden de vaste trainingsdagen. In testmodus past de
  voorbeeldweek zich aan de trainings- en wedstrijddagen en de kern aan (`fitMeetingWeek`). Daglimiet echte AI-beurten `staff_meeting_daily_limit()` = 80.
  Bovenaan de **lichtstroom** (`components/staff/flow-bar.tsx`: rollen als kaartjes, oplichtende lijnen
  naar wie spreekt, CSS `flow-dot`/`glow-pulse` in `globals.css`), midden de chat
  (`components/staff/meeting-feed.tsx`), links "Raadpleeg je staf" (gesprek met één rol), rechts eerdere
  opdrachten en taken op één regel (uitklapbaar). Goedgekeurde overzichten gaan mee in de teamcontext
  (`goedgekeurde_stafvergaderingen`).
- **Kaarten en schorsingen** — `player_cards` (geel/rood per speler per wedstrijd, ingevuld bij de
  wedstrijdevaluatie in de weekpagina, `match-cards.tsx`; ook getoond bij Evaluaties) en de regels per team
  (`teams.yellow_card_limit`, `yellow_card_ban`, `red_card_ban`; Instellingen → Schorsingen).
  `suspensions()` in `lib/players/cards.ts` telt per seizoen (vanaf `competition_start_date`) en laat elke
  schorsing uitzitten met de gespeelde wedstrijden erna. De kern in de teamcontext krijgt `gele_kaarten` en
  `geschorst_wedstrijden`, zodat de Team Manager schorsingen meldt.
- Nog niet gebouwd: Video Analist, volledige stafmeeting; UI voor T2-toegang,
  clubbeheer, visie delen; oefeningen handmatig wijzigen; videodienst.
