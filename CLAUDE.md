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
- Een **persoonlijk team** heeft één ingelogde hoofdcoach (`head_coach_id`). Hij kan een menselijke
  **T2 tijdelijke leestoegang** geven (verplichte einddatum).
- Een **club** (clubomgeving, zie fase "Clubomgeving") koopt een pakket met licenties en modules. De
  platformadmin maakt de club aan; mensen komen erin met een persoonlijke activatiecode. Clubteams
  hebben een staf (`team_staff`: meerdere hoofd- en assistent-trainers, coördinatoren). De trainer
  behoudt zijn persoonlijke account en omgeving.
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
                          staffkamer.json + staffkamer-systeem.md + staffkamer-gebruiker.md (groepschat),
                          taakroutering.json (welke rol een taak van de coach krijgt),
                          clubdna.json (vragenlijst Club DNA van een club),
                          kwaliteit.json + kwaliteit-systeem.md + kwaliteit-gebruiker.md (Training Quality Engine)
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
  `can_read_team(team_id)` (hoofdcoach, actieve T2, staf van een clubteam, owner/admin/technisch
  directeur van de club — óók voor gearchiveerde teams),
  `can_write_team(team_id)` (alleen de hoofdcoach — `is_team_head_coach`: bij een persoonlijk team
  `head_coach_id`, bij een clubteam een hoofdcoach in `team_staff` die nog clublid is — en alleen als
  het team niet gearchiveerd is), `has_club_role(club, rollen)`, `is_club_member`, `club_has_module`,
  `is_club_owner`, `can_read_coach_profile`, `is_feature_enabled`.
- **Nieuwe teamgebonden data** (trainingen, oefenstof, weekplanningen, …) krijgt een `team_id`
  en gebruikt `can_read_team` voor lezen en `can_write_team` voor schrijven. Zo blijft
  oefenstof van een gearchiveerd team leesbaar.
- **Valkuil `insert ... returning`**: de SELECT-policy wordt ook op de nieuwe rij gecontroleerd.
  Een helper die de rij opnieuw opzoekt (bv. `can_read_team(id)` op de eigen tabel) ziet een rij
  uit hetzelfde statement niet → "new row violates row-level security policy". Laat de
  SELECT-policy daarom eerst de eigen kolommen van de rij controleren (bv. `head_coach_id = auth.uid()`)
  en test elke insert die de app doet mét `returning` in pgTAP.
- `teams.head_coach_id` is onveranderlijk (trigger). `teams.club_id` ook, behalve één keer van null naar
  een club via een goedgekeurde koppeling (`decide_club_team_link`); een clubteam verlaat zijn club nooit.
- In de app: of iemand een team mag bewerken komt van `is_team_head_coach`/`can_write_team`, niet van
  `head_coach_id === user.id` (dat klopt enkel voor persoonlijke teams).
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
  **Admin-omgeving:** een platformadmin ziet in de zijbalk enkel de adminpagina's (`ADMIN_NAV` in
  `lib/navigation.ts`: Clubs, Competitie, Oefenstofbank, Spelersimport, Prijsplannen, Accounts), geen teamkiezer,
  teammenu's of clubs; `/teams` en `/admin` sturen hem naar `/admin/clubs`, de staf-kolom verschijnt niet op `/admin`.
  Adminpagina's zijn compact: één regel per club, team, plan of account met knoppen (`components/admin/rows.tsx`:
  `AdminHeader`, `Rows`, `Row`, `Badge`, `rowButton`); nieuw maken met een + en formulieren in een venster
  (`components/admin/modal.tsx`, `<dialog>`).
- **Teamdashboard en navigatie** — links een donkere **zijbalk** (`components/sidebar.tsx`; op mobiel
  een menu) met de **teamkiezer** (`components/team-switcher.tsx`, opent een ander team op hetzelfde
  onderdeel) en enkel de **8 menu's van de hoofdcoach** (`NAV_ITEMS` in `lib/navigation.ts`): Dashboard,
  Mijn team (Spelers, Selecties, Instellingen, Visie), Planning (Microcyclus, Periodisering, Belasting),
  Staff Room, Taken, Wedstrijdanalyse (Volgende wedstrijd, Tegenstanders, Competitie, Presentatie, Evaluaties), Oefenbibliotheek
  (Oefeningen, Standaardsituaties) en Rapportage (Testen, Seizoensverloop, Belasting per week). De
  onderdelen van een menu staan als **tabbladen** bovenaan de pagina (`components/section-tabs.tsx`), elk
  met het mannetje van de rol die het verzorgt (`member`). Elke rol heeft een eigen mannetje
  (`components/staff/role-avatar.tsx`, kleur per rol). `/teams/[id]/staff` verwijst naar de Staff Room.
  Belasting verwijst naar de weekpagina (`/load`, met `?menu=load`, zodat het juiste menu actief blijft;
  `WEEK_PAGE_MENUS` in `lib/navigation.ts`); Periodisering is een eigen pagina. **Volgende wedstrijd**
  (`/teams/[id]/match?datum=`) is een eigen pagina over de tegenstander (`loadNextMatch` in `lib/next-match/load.ts`,
  bovenop `loadPresentation`): logo, datum, thuis/uit, adres en trainer, klassement (plaats, punten, W-G-V, doelpunten),
  vorm van de laatste vijf met logo's, seizoensverloop als grafiek (`teamSeason` in `lib/presentation/stats.ts`,
  `SeasonChart`) en hun laatst ingevulde opstelling in hun formatie (`components/next-match/opponent-pitch.tsx`). De
  wedstrijdvoorbereiding van de staf staat er enkel als link (weekpagina `?menu=match#match`).
  **Microcyclus** (`/teams/[id]/microcycle?week=`) toont de week van vandaag (of een andere week, vorige/volgende):
  het goedgekeurde weekdocument zoals de spelers het zien (`WeekPoster`) en per dag met de oefenstof
  (`WeekDocumentView`, `findWeekDocument` in `lib/weeks/document.ts`); zonder weekdocument verwijst ze naar de
  Staff Room. De weekpagina (`/weeks/[weekStart]`: weekinput, staf, belasting, evaluatie) blijft bereikbaar via
  "Weekinput, belasting en evaluatie". Elk team heeft een **leeftijdscategorie** (`teams.age_category`:
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
  Ze lopen achter de schermen: de pagina Taken toont ze niet meer (enkel de taken van de coach); de taak zelf
  blijft bereikbaar via de Staff Room (`/teams/[id]/tasks/[taskId]`: werkverdeling, voorstel, bijdragen, eerdere versies).
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
  voorbeeldweek zich aan de trainings- en wedstrijddagen en de kern aan (`fitMeetingWeek`). Met **"Zet in de
  Microcyclus"** (`applyMeetingToWeek`) wordt het weekplan de goedgekeurde versie van het weekdocument van die
  week: een run met `provider` `staffkamer` en `meeting_id`, één stap `ac` met de uitvoer van de Assistent Coach
  (`weekDocumentFromMeeting` in `lib/staff-room/week-from-meeting.ts`, gevalideerd tegen zijn schema); zonder
  weekinput maakt hij die week aan met de trainingen en wedstrijden van het plan. Telt niet voor de daglimiet. Daglimiet echte AI-beurten `staff_meeting_daily_limit()` = 80.
  Bovenaan de **lichtstroom** (`components/staff/flow-bar.tsx`: rollen als kaartjes, oplichtende lijnen
  naar wie spreekt, CSS `flow-dot`/`glow-pulse` in `globals.css`), midden de chat
  (`components/staff/meeting-feed.tsx`), links "Raadpleeg je staf" (gesprek met één rol), rechts eerdere
  opdrachten en taken op één regel (uitklapbaar). Goedgekeurde overzichten gaan mee in de teamcontext
  (`goedgekeurde_stafvergaderingen`). In de chat toont het overzicht enkel de samenvatting en de bijdragen per rol
  (`OverviewCard` zonder `withWeekPlan`); "Stafoverleg – weekplanning en oefenstof" opent het volledige weekplan in een
  nieuw tabblad (`/teams/[id]/staff-room/[meetingId]`): opdracht, overzicht, weekplan en alle oefeningen van de
  week met hun beeld en een link naar de oefening.
- **Taken van de coach** — bovenaan Taken staat "Mijn taken" (`coach_tasks`: titel, klaar, rol en tijdstip van de
  vraag; lezen `can_read_team`, schrijven `can_write_team`). Afvinken, verwijderen of **"Vraag aan de staf"**: de taak
  gaat via `sendMessage` als vraag naar de gekozen rol (`askCoachTask` in `lib/staff-room/coach-task-actions.ts`;
  "Bekijk het antwoord" opent het gesprek). De voorgestelde rol komt uit `staff/_gedeeld/taakroutering.json`
  (woorden per rol, standaardrol; `routeTask` in de staff-engine).
- **Namen nooit naar de AI** — teksten van de hoofdcoach (vraag en eerdere berichten in een gesprek, opdracht en
  feedback in de staffkamer, titel/opdracht/feedback van een taak) gaan door `nameFilter`
  (`lib/staff-room/privacy.ts`, `withoutNames` in `lib/proposals/names.ts`): spelersnamen worden `#rugnummer`
  ("een speler" zonder nummer). De app toont de tekst zoals hij geschreven werd.
- **Kaarten en schorsingen** — `player_cards` (geel/rood per speler per wedstrijd, ingevuld bij de
  wedstrijdevaluatie in de weekpagina, `match-cards.tsx`; ook getoond bij Evaluaties) en de regels per team
  (`teams.yellow_card_limit`, `yellow_card_ban`, `red_card_ban`; Instellingen → Schorsingen).
  `suspensions()` in `lib/players/cards.ts` telt per seizoen (vanaf `competition_start_date`) en laat elke
  schorsing uitzitten met de gespeelde wedstrijden erna. De kern in de teamcontext krijgt `gele_kaarten` en
  `geschorst_wedstrijden`, zodat de Team Manager schorsingen meldt.
- **Competitie (Voetbal Vlaanderen)** — de platformadmin laadt wekelijks de exports van voetbalvlaanderen.be op
  (`/admin/competition`): uitslagen + kalender (`vvlresdown`), klassementen (`vvlcltdown`, `PER` 0 = seizoen,
  1..n = periode) en scheidsrechters (`vvldesdown`). De bestanden bevatten alle reeksen van alle clubs; ze worden
  in de browser gelezen (`lib/competition/parse.ts`, UTF-8 of Windows-1252) en enkel de **gekoppelde reeksen**
  gaan naar de server. Koppeling per team: `teams.federation_team` (ploegnaam zoals in de export, bv.
  "Belisia Bilzen SV A") + `teams.federation_divisions` (bv. `{1, BVVD}`); enkel admins wijzigen ze
  (`admin_set_team_competition`, trigger). Data per reeks in `competition_matches` (uniek op reeks, datum, thuis,
  uit) en `competition_standings`; lezen via `can_read_division` (wie een gekoppeld team mag lezen).
  `admin_import_competition` vervangt de wedstrijden/klassementen van de reeks, zet de scheidsrechters, en
  **vult aan** zonder te overschrijven: komende wedstrijden in de weekinput (nieuwe week met de vaste
  trainingsdagen, geen training op de wedstrijddag) en scores in `match_reports`. Pagina **Competitie**
  (`/teams/[id]/competition`, Wedstrijdanalyse): volgende wedstrijd met scheidsrechters en vorm/plaats van de
  tegenstander, kalender en uitslagen (statuscodes zoals PP = uitgesteld), klassement per periode. De staf krijgt
  `competitie` in de teamcontext zonder namen van andere ploegen (eigen plaats, punten, vorm; plaats en vorm van
  de volgende tegenstander).
- **Wedstrijdpresentatie (Video Analist)** — Wedstrijdanalyse → **Presentatie** (`/teams/[id]/presentation?datum=`):
  de 6 dia's van het Canva-sjabloon van de club (16:9, 1440 × 810, `components/presentation/slides.tsx`):
  matchday-omslag, tegenstander in cijfers (plaats, W-G-V, punten uit de laatste vijf, laatste vijf met logo's van
  die tegenstanders; `opponentStats` in `lib/presentation/stats.ts`, uit de competitie), opstelling van de
  tegenstander (`opponent_lineups`, naast de balk "Opponent analysis" met hun logo) en de eigen opstelling uit
  Selecties, beide als lineup-grafiek (`LineupPitch`: stadion, veld in perspectief met het doel boven, truitjes met
  rugnummer en naam; eigen truitjes in de teamkleuren, die van de tegenstander in `opponents.shirt_color` +
  `shirt_trim_color`, in te stellen op de pagina; de doelman draait de kleuren om), en het **principe** van de
  Tactical Coach (`principe { titel, uitleg, tekening }` in zijn weekplan). De hoofdcoach kan titel en uitleg op de
  pagina herschrijven (`week_plans.principle_override` `{ titel, uitleg }`, `savePrinciple`; de tekening blijft die van
  de Tactical Coach; "Terug naar het voorstel" zet null).
  Download per dia of alles als PNG (`html-to-image`), of afdrukken als PDF. Data in `loadPresentation`
  (`lib/presentation/load.ts`); namen enkel in de app. Logo's per tegenstander (`opponents.logo_path`, ook voor
  ploegen die het team zelf niet speelt: de fiche wordt aangemaakt) in de privébucket `team-media`
  (`<team_id>/…`). Dia's blijven licht in het donkere thema (`slide-light`).
- **Oefenstofbank (centraal)** — oefeningen van het platform, beheerd door de platformadmin, naast de
  persoonlijke bibliotheek van een coach (`exercises`). Tabel `bank_exercises` (nummer zoals `OEF-007` = sleutel,
  titel, type, spelfase, doelgroep, tags, principes; de oefening zelf als `content` met de Nederlandse sleutels
  van de bron; `media_kind`/`media_key` van de tekening of video, het bestand volgt later; `status` `review` of
  `approved`; `version`). Coaches lezen enkel goedgekeurde oefeningen, de admin alles; schrijven enkel via
  `admin_import_bank_exercises(jsonb)` (zelfde nummer = bijwerken als de inhoud wijzigde, status blijft; nieuw =
  `review`; niets verwijderd; max. 500) en `admin_set_bank_exercise_status`. Admin → **Oefenstofbank**
  (`/admin/exercise-bank`): backup (JSON) opladen, controle in de browser (`parseBank` in
  `lib/exercise-bank/import.ts`, ongeldige of dubbele nummers overgeslagen, open vraagtekens zoals "regels: ?"
  gemarkeerd), importeren, nakijken en goedkeuren.
  **Gebruik door de staf:** de staf krijgt `oefenstofbank` (type `BankExercise` in de staff-engine): de
  goedgekeurde oefeningen die het best passen bij de vraag (`rankBank` in `lib/exercise-bank/staff.ts`: woorden
  in titel, type/spelfase/tags/principes en doelen; max. 15; `bankForStaff` in `lib/exercise-bank/load.ts`).
  De vraag is het bericht (gesprek), de opdracht + feedback (staffkamer), titel + opdracht (taak) of de
  weeknotitie + feedback (weekruns, placeholder `{{oefenstofbank}}` in `opdracht-gebruiker.md`). Volgorde voor
  een onderdeel: eigen oefenstof (`oefening_id`), dan de oefenstofbank (`bank_nummer`, bv. OEF-007; de
  belasting bepaalt de staf zelf), dan een eigen voorstel. `bank_nummer` staat in het onderdeel-schema van de
  Assistent Coach en van het staffkamer-weekplan; het weekdocument, de trainingsbladen en het weekplan tonen
  "Oefenstofbank OEF-007" met een link. In testmodus vullen de kernonderdelen zich met bankoefeningen.
  **Voor trainers:** Oefenbibliotheek → **Oefenstofbank** (`/exercises/bank`, zoeken en filteren op type en
  spelfase; `/exercises/bank/[nummer]`): "Overnemen naar mijn oefenstof" maakt een eigen oefening
  (`bankToExercise` in `lib/exercise-bank/copy.ts`, `exercises.bank_number`, één keer per coach) die de coach
  daarna aanpast (fase, spelers, standaardbelasting); een video gaat mee (storage-copy naar `exercise-videos`).
  **Media:** de bestanden staan in de privé bucket `bank-media` (`<media_key>.<ext>`, max. 25 MB, PNG/JPG/WEBP/GIF/
  MP4/WEBM/MOV), `bank_exercises.media_path`. De admin laadt ze op bij Admin → Oefenstofbank → "Tekeningen en
  video's" (meerdere tegelijk; bestandsnaam = code uit de backup; signed upload URL, `admin_set_bank_media` koppelt
  alle oefeningen met die code; een import met een nieuwe code wist de koppeling). Lezen: de admin alles, een coach
  enkel het bestand van een goedgekeurde oefening. Getoond bij de oefening (admin, `/exercises/bank`), in het
  weekdocument en de trainingsbladen (`WeekExercises.bank` in `lib/exercises/week.ts`). De staf krijgt `beeld`
  ("tekening"/"video"/null) per bankoefening; de Tactical Coach tekent bankoefeningen met een beeld niet.
  **Correcties:** de admin past een oefening aan via "Bewerken" (`/admin/exercise-bank/[nummer]/edit`, alle tekstvelden;
  gecontroleerd met `parseBank`; `admin_update_bank_exercise`, nieuwe versie, status en beeld blijven). De laatste
  import staat in `source_title`/`source_content`: een import vergelijkt daarmee, zodat een correctie in de app blijft
  tot de oefening in de bron zelf wijzigt (label "Aangepast in de app").
  **Zip-import, zones en filters:** de admin laadt de export op als zip (backup + tekeningen en video's, in elke map;
  `readBankZip` in `lib/exercise-bank/zip.ts`, jszip in de browser) of als .json; na de import worden de bestanden
  meteen opgeladen en gekoppeld op hun code (`uploadBankMediaFile`): een beeld wordt gevonden via `media_bestand`
  in de backup (bv. `media/OEF-007.mp4`) of via een bestandsnaam gelijk aan de code (`bankMediaFiles`); zonder code
  (`diagram`) wordt de bestandsnaam de code. Elke oefening heeft **zones** (`content.zones`,
  1–18: 1–3 aan het eigen doel tot 16–18 aan het doel van de tegenstander, links-midden-rechts; `bankZones` in
  `lib/exercise-bank/zones.ts`), getoond als `ZoneMap` en bij "Bewerken" aanklikbaar (`ZonePicker`). De admin vervangt
  of verwijdert het beeld van één oefening (`admin_set_bank_exercise_media`, pad `<nummer>-<tijd>.<ext>`). Coach en admin
  zoeken met dezelfde filters (`BankFilterForm`, `filterBank` in `lib/exercise-bank/filters.ts`: tekst in titel, doelen,
  tags en bron; fase, type, belasting, principe, zone). De staf krijgt de zones mee (`BankExercise.zones`).
- **Clubomgeving, deel 1: datamodel en rechten** (nog zonder schermen) — migratie `club_environment`.
  De **platformadmin** maakt een club (`admin_create_club`) en zet het abonnement
  (`club_subscriptions`: plan, `license_seats`, `max_teams` (null = onbeperkt), `modules`, `starts_on`/`ends_on`;
  `admin_set_club_subscription`, modules standaard die van het plan, `plans.modules`). Modulecodes:
  `club_module_codes()` = `CLUB_MODULES` in `packages/db` (dna, exercises, planning, evaluations, knowledge,
  reports); dashboard, structuur en licenties zijn de kern. Een club is actief zolang het abonnement loopt
  (`club_is_active`). **Rollen** in `club_members` (enum `club_role`: owner, admin, technical_director,
  team_coordinator, coach, assistant_coach; beëindigde rijen blijven als historiek). **Licenties**
  (`club_licenses`, één actieve per persoon per club) enkel voor owner, technisch directeur, coach en
  assistent-coach (`club_role_uses_license`). **Activatiecodes** (`club_activation_codes`): 12 tekens
  (`XXXX-XXXX-XXXX`), enkel de sha256-hash bewaard (kolom niet leesbaar), eenmalig, optioneel vervaldatum,
  team en teamrol; een open code reserveert een licentieplaats (`club_seats_used`). Aanmaken
  `create_club_activation_code` (platformadmin en owner alles, admin alles behalve owner/admin), intrekken
  `revoke_club_activation_code`, een verloren open code vervangen door een nieuwe met dezelfde rol, team en notitie
  `reissue_club_activation_code` (knop "Nieuwe code"); de code verschijnt bij het maken met "Kopieer" en "Kopieer uitnodiging" = tekst met link
  `/clubs/join?code=…` (`CodeReveal`), en een open code kan later opnieuw bekeken worden met het oogje in de tabel
  (`RevealCode`, `reveal_club_activation_code`: zelfde rechten als intrekken, gelogd als `code.revealed`; de code staat
  in `club_activation_code_secrets`, zonder grants of policies, en verdwijnt zodra ze gebruikt of ingetrokken is), inwisselen `redeem_club_activation_code` (geeft `{ok, club_id}` of
  `{ok:false, error}`: invalid, expired, club_inactive, already_member, no_seats, too_many_attempts = 10
  foute codes per uur). **Licentie intrekken** (`revoke_club_license`) beëindigt alle rollen en teamplaatsen
  van die persoon in de club; niets wordt verwijderd, de club leest de historiek van haar teams. Rollen zonder
  licentie: `end_club_role`. **Clubteams**: `create_club_team` (owner/admin, telt tegen `max_teams`),
  staf `assign_team_staff`/`end_team_staff`. **Eigen team koppelen**: `request_club_team_link` (hoofdcoach
  van een actief persoonlijk team die coach is in de club), `decide_club_team_link` (owner/admin; het team
  wordt definitief een clubteam, de aanvrager hoofdcoach in de staf, T2-toegang vervalt),
  `cancel_club_team_link`. Alles wat telt staat in `club_audit_log` (leesbaar voor owner/admin). Alle tabellen
  zijn read-only voor gebruikers; schrijven enkel via deze functies. Clubs maken kan niet meer door
  gebruikers; `clubs.license_seats` en de oude rol `club_owner` in `memberships` zijn vervangen.
- **Clubomgeving, deel 2: admin** (migratie `club_admin`) — **Admin → Clubs** (`/admin/clubs`). Bij het opladen
  van de kalender (Admin → Competitie) bewaart de browser de **clublijst** uit de export (`federationClubs` in
  `lib/clubs/federation.ts`: stamnummer, clubnaam uit de ploegnamen, ploegen met reeksen; `admin_save_federation_clubs`
  → `federation_clubs`, enkel leesbaar via `admin_federation_clubs()`). Een club maak je uit die lijst
  (`admin_create_club(naam, stamnummer)`; `clubs.federation_number` uniek, plus kleuren, adres en contact,
  `admin_update_club`). Per club (`/admin/clubs/[clubId]`): **pakket en licenties** (`admin_set_club_subscription`;
  geen module aangevinkt = die van het plan), **Excel van de club** (sjabloon `/admin/clubs/[clubId]/template`,
  `clubTemplate` in `lib/clubs/template.ts`: bladen Club, Teams (eigen teams + ploegen uit de export), Staf, met
  keuzelijsten; controleren met `parseClubImport` in `lib/clubs/import.ts`, voorbeeld met fouten per rij en
  controle van licenties, max. teams en actief pakket; `admin_import_club`: club bijwerken, teams op naam
  bijwerken of aanmaken, competitiekoppeling zetten, en **per staflid een activatiecode** met de naam als notitie;
  de codes zie je één keer, download als CSV), **activatiecodes** (één code maken, lijst met laatste 4 tekens,
  intrekken), **leden en licenties** (`admin_club_members`, licentie intrekken), **teams** (`admin_club_teams`,
  team toevoegen via `create_club_team`, dat nu ook de platformadmin mag en de clubkleuren overneemt) en
  **historiek** (`club_audit_log`). De platformadmin leest zelf geen teamdata (spelers, weken) van clubs.
- **Clubomgeving, deel 3: schermen van de club** (migratie `club_screens`: `club_people()` voor owner/admin/TD/
  coördinator, `club_pending_links()` voor owner/admin met team- en aanvragernaam, `club_seats_used()` enkel voor leden
  en de platformadmin). **Club koppelen** (`/clubs/join?code=`, link in de zijbalk): iedereen die ingelogd is wisselt
  een code in (`redeemCode` in `lib/clubs/actions.ts`, foutmeldingen per `error` van de database) en komt in de club.
  De zijbalk toont onder de teams **Mijn clubs** (`loadMyClubs` in `lib/clubs/load.ts`) en "Club koppelen"; de
  teamkiezer markeert clubteams ("Club"); op teampagina's toont `EnvironmentBar` (`components/environment-bar.tsx`)
  of je in je **persoonlijke omgeving** of in de **clubomgeving** werkt (enkel voor wie een clubteam heeft).
  Clubpagina's `/clubs/[clubId]` (`getClubContext`: 404 voor wie geen lid is; rollen, abonnement, `canManage` =
  owner/admin, `seesAll` = owner/admin/TD, `seesPeople` = alle rollen behalve coach/assistent): **Dashboard**
  (`loadClubDashboard` in `lib/clubs/dashboard.ts`: licenties, actieve teams, trainers, modules; per team staf,
  goedgekeurde weekplanning deze week, laatste wedstrijdevaluatie, sessies van 28 dagen; aandachtspunten: geen
  hoofdtrainer, geen weekplanning, wachtende koppelingen; recent), **Structuur** (teams per leeftijdscategorie met
  staf; owner/admin: staf toevoegen/weghalen, team toevoegen, koppelaanvragen goedkeuren of weigeren; mensen van de
  club) en **Licenties en codes** (owner/admin: codes maken — een admin enkel TD, coördinator, coach en assistent —
  en intrekken, licenties intrekken, rollen zonder licentie beëindigen, historiek). Alles wat schrijft gaat via de
  databasefuncties, die de rol zelf controleren. Gedeelde bouwstenen voor admin en club: `components/clubs/forms.tsx`
  (`CodeForm`, `TeamForm`, `StaffForm`, `ConfirmButton`, `CopyButton`; actie als prop) en `components/clubs/tables.tsx`
  (`CodesTable`, `PeopleTable`, `HistoryList`); de code maken zelf in `createCodeFromForm` (`lib/clubs/code.ts`).
  **Eigen team koppelen**: Instellingen van een persoonlijk team → Club (`ClubLink`): kies een club waar je coach bent
  en je ploeg in de competitie (`club_federation_teams`: de ploegen van de club in de export, voor leden;
  `club_team_links.federation_team`), en vraag aan, of trek de aanvraag in; bij een clubteam staat welke club.
  **Competitie meteen klaar** (migratie `club_competition_sync`): de competitie-import bewaart naast de gekoppelde
  reeksen ook alle reeksen van de ploegen van de clubs op het platform; bij goedkeuring krijgt het team de gekozen
  ploeg en haar reeksen (trigger op `club_team_links`, vlag `iassistent.federation_link`), en elke nieuwe koppeling
  (admin, club-Excel of aanvraag) zet de bewaarde wedstrijden meteen in de weekinput en de scores in de
  wedstrijdevaluaties (`sync_team_competition`, trigger op `teams`; ook gebruikt door `admin_import_competition`).
- **Club DNA** (clubmodule `dna`, migratie `club_dna`) — de voetbalidentiteit van een club. Vragenlijst in
  `staff/_gedeeld/clubdna.json` (zelfde vraagtypes als het visieprofiel, plus `leeftijdsdoelen` per
  leeftijdscategorie; `parseClubDnaQuestionnaire`, `validateClubDna`, `readClubDna` en `clubDnaContext` in
  `packages/staff-engine/src/shared/club-dna.ts`). Opslag in `club_dna` per versie (`draft`/`published`/`archived`,
  hoogstens één concept en één gepubliceerde versie per club; `content` = `{ versie, samenvatting, antwoorden,
  niveaus ("verplicht"|"aanbevolen" per vraag), leeftijdsdoelen ("<categorie>.<vraag>") }`). Lezen: elk lid de
  gepubliceerde versie; owner, admin en technisch directeur ook het concept en de historiek. Schrijven enkel via
  `save_club_dna_draft` (owner/admin/TD), `publish_club_dna` (owner/TD = goedkeuring; vorige versie wordt `archived`)
  en `discard_club_dna_draft`, enkel zolang de club de module heeft. Pagina's `/clubs/[clubId]/dna` (gepubliceerde
  versie met niveau per principe, doelen per categorie, versies) en `/dna/edit` (`DnaForm`; vraagvelden gedeeld met het
  visieprofiel in `components/questionnaire/question-input.tsx`). **AI:** bij een clubteam krijgt de staf `visie.club`
  (`clubDnaForTeam` in `lib/clubs/dna.ts`: verplicht, aanbevolen en de doelen van de eigen leeftijdscategorie), apart
  van de visie van de trainer, in elke run, gesprek, taak en staffkamer. Hoe de staf ermee omgaat (verplicht = kader,
  aanbevolen tenzij de trainer anders wil, tegenstrijdigheden melden, nooit stilzwijgend overschrijven) staat in
  `staff/_gedeeld/visie-hoofdcoach.md`.
- **Gedeelde oefenstof van de club** (clubmodule `exercises`, migratie `club_exercises`) — drie lagen: de centrale
  oefenstofbank (`bank_exercises`, enkel de platformadmin wijzigt), de cluboefenstof (`club_exercises`) en de
  persoonlijke oefenstof (`exercises`). Een cluboefening heeft de vorm van een bankoefening (titel, type, fase,
  doelgroep, tags, principes, `content` met de Nederlandse sleutels van de bank, zones) plus `age_categories` en
  `level`, een nummer `CLUB-<n>` per club, een herkomst (`origin`: `club`, `bank_variant` met `base_bank_number`,
  `coach_share` met `source_exercise_id`), `status` (`proposed` → `approved` of `archived`) en `recommended`.
  `club_bank_picks`: bankoefeningen die de club als favoriet kiest, eventueel aanbevolen. Lezen: elk lid de goedgekeurde
  oefeningen en de keuzes, een auteur zijn eigen voorstellen, owner/admin/TD alles. Schrijven enkel via
  `save_club_exercise` (elk lid stelt voor; owner/admin/TD maken meteen goedgekeurde oefeningen en wijzigen alles; een
  auteur wijzigt zijn voorstel; delen enkel van een eigen oefening), `set_club_exercise_status`,
  `set_club_exercise_recommended` en `set_club_bank_pick` (owner/admin/TD), en enkel met de module. Pagina's
  `/clubs/[clubId]/exercises` (goedgekeurd, voorstellen, archief; filters van de bank + leeftijd, niveau, enkel
  aanbevolen: `filterClubExercises` in `lib/clubs/exercises.ts`; de keuzes uit de bank), `/new` (`?bank=OEF-007` =
  clubvariant), `/[exerciseId]` (goedkeuren, aanbevelen, archiveren, "Overnemen naar mijn oefenstof" met
  `bankToExercise` en `bank_number` = `CLUB-<n>`) en `/[exerciseId]/edit`. Het formulier is dat van de bankcorrectie
  (`ContentFields` in `components/exercise-bank/content-fields.tsx`, `recordFromForm`/`formValues` in
  `lib/exercise-bank/form.ts`, gecontroleerd met `parseBank`). Op een bankoefening (`/exercises/bank/[nummer]`) staat
  per club "Kies als clubfavoriet", "Beveel aan" en "Maak een clubvariant"; `/exercises/bank/CLUB-3` opent de
  cluboefening. Bij een eigen oefening staat "Deel met <club>" (`shareExerciseWithClub`, wordt een voorstel).
  **AI:** de staf van een clubteam krijgt `cluboefenstof` (`clubExercisesForStaff` in `lib/clubs/exercises-staff.ts`:
  goedgekeurd, aanbevolen eerst, max. 15; placeholder `{{cluboefenstof}}` in `opdracht-gebruiker.md`, ook in de
  teamcontext) en de bankoefeningen die de club aanbeveelt bovenaan `oefenstofbank` met `club_aanbevolen`
  (`bankForStaff(…, clubRecommended)`). Volgorde voor een onderdeel: eigen oefenstof, cluboefenstof, oefenstofbank;
  een cluboefening gaat als `CLUB-3` in `bank_nummer` (weekdocument en trainingsbladen tonen "Cluboefenstof CLUB-3").
- **Training Quality Engine** (migratie `training_quality`) — elk weekvoorstel (run `week`) wordt nagekeken voordat de
  hoofdcoach beslist. Criteria, schaal en oordelen in `staff/_gedeeld/kwaliteit.json` (rol die controleert: `rol`,
  standaard de AI Staff Coordinator), de opdracht in `kwaliteit-systeem.md`/`kwaliteit-gebruiker.md` en de taak
  `coordinator/taken/kwaliteitscontrole` (schema `{ samenvatting, criteria[{code, score, toelichting}], sterke_punten,
  verbeterpunten[{criterium, punt}] }`). `runQualityCheck` in de staff-engine controleert dat elk criterium precies één
  score heeft en berekent gemiddelde en oordeel (`qualityVerdict`). De app (`checkRunQuality` in `lib/quality/server.ts`)
  geeft visie met Club DNA, weekinput, kern zonder namen en het werk van Physical Coach, Tactical Coach en Assistent
  Coach (niet de tekeningen) mee; automatisch wanneer de laatste stap van een weekrun klaar is (in `advanceRun`, vóór de
  run `ready` wordt), en opnieuw met "Opnieuw controleren" op de weekpagina (`checkQualityAction`). Opslag in
  `training_quality_reviews` (per run, ook mislukte controles; lezen `can_read_team`, schrijven `can_write_team`, nooit
  wijzigen of verwijderen; daglimiet echte AI `staff_quality_daily_limit()` = 20, `staff_quality_remaining_today()`).
  Getoond als `QualityReview` boven het weekdocument en als `QualityBadge` per team in het clubdashboard (goedgekeurde
  versie van deze week, verbeterpunten als tooltip; het laagste oordeel komt bij de aandachtspunten).
- Nog niet gebouwd: verdere Video Analist (evaluaties, video's), volledige stafmeeting; UI voor T2-toegang,
  de overige clubmodules (clubplanning, evaluaties, kennis, rapportage), visie delen;
  oefeningen handmatig wijzigen; videodienst.
