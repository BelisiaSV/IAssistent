---
name: feature-flag
description: Introduceer een nieuwe feature flag in IAssistent of zet een bestaande flag aan/uit voor een coach of club (staging of productie). Gebruik bij het afschermen van een nieuwe feature of bij het openzetten ervan voor bepaalde coaches/clubs.
---

# Feature flags

Flags staan in de tabel `public.feature_flags`, per **coach** (`coach_id`) of per **club**
(`club_id`). Een coach-flag gaat voor op een club-flag. Gebruikers kunnen flags niet zelf
zetten (geen RLS-schrijfrechten); dat gebeurt met de SQL-editor of service role.

## A. Nieuwe flag in de code

1. Kies een key: kleine letters, segmenten gescheiden door `.`, `-` of `_`
   (bv. `staff.meeting`, `video.analysis`). Regex: `^[a-z0-9]+([._-][a-z0-9]+)*$`.
2. Voeg hem toe aan `FEATURE_FLAGS` in `packages/db/src/index.ts`:
   ```ts
   export const FEATURE_FLAGS = {
     staffMeeting: "staff.meeting",
   } as const satisfies Record<string, string>;
   ```
3. Controleer **server-side** (server component, server action of route handler):
   ```ts
   import { FEATURE_FLAGS } from "@iassistent/db";
   import { isFeatureEnabled } from "@/lib/feature-flags";

   if (!(await isFeatureEnabled(FEATURE_FLAGS.staffMeeting))) notFound();
   ```
   Nooit enkel client-side verbergen: de server moet het ook afdwingen.
4. Zonder rij in de tabel staat een flag **uit**. Documenteer de flag kort in de PR.

## B. Flag aan- of uitzetten

Altijd eerst op **staging**, pas daarna op **productie** en alleen na bevestiging van de gebruiker.
Voer uit in de Supabase SQL-editor van het juiste project (of via `psql` met de juiste URL).

Coach opzoeken en flag zetten:
```sql
insert into public.feature_flags (key, enabled, coach_id, description)
select 'staff.meeting', true, id, 'Pilot stafmeeting'
from public.coaches where email = 'coach@voorbeeld.be'
on conflict (key, coach_id) where coach_id is not null
do update set enabled = excluded.enabled, description = excluded.description;
```

Voor een club:
```sql
insert into public.feature_flags (key, enabled, club_id, description)
select 'staff.meeting', true, id, 'Pilot stafmeeting'
from public.clubs where name = 'KFC Voorbeeld'
on conflict (key, club_id) where club_id is not null
do update set enabled = excluded.enabled, description = excluded.description;
```

Controleren:
```sql
select f.key, f.enabled, c.email, cl.name as club
from public.feature_flags f
left join public.coaches c on c.id = f.coach_id
left join public.clubs cl on cl.id = f.club_id
order by f.key;
```

## Niet doen

- Flags niet via een migratie zetten voor specifieke coaches (data verschilt per omgeving).
- Geen flags in `localStorage`, env-variabelen of hardcoded e-mailadressen in code.
