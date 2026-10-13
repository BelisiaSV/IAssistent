---
name: release
description: Breng wijzigingen van develop (staging) naar main (productie) voor IAssistent, inclusief checks, Supabase-migraties en Vercel. Gebruik wanneer de gebruiker een release of productie-deploy wil doen.
---

# Release: develop → main

`develop` = testomgeving (Supabase-staging), `main` = productie (Supabase-productie).
Een release raakt productie: **vraag bij elke stap die productie wijzigt expliciet bevestiging.**

## 1. Klaarzetten

```bash
git fetch origin
git checkout develop && git pull origin develop
```

Draai alle checks; alles moet groen zijn:
```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test && pnpm staff:validate && pnpm test:db && pnpm build
```

## 2. Overzicht maken

- Commits sinds de vorige release: `git log --oneline origin/main..origin/develop`
- Nieuwe migraties: `git diff --name-only origin/main..origin/develop -- supabase/migrations`
- Nieuwe feature flags (in `packages/db/src/index.ts`) en nieuwe env-variabelen.
Schrijf een korte release-notitie in het Nederlands (wat is nieuw voor de coach).

## 3. Migraties op staging (moet al gebeurd zijn bij merge naar develop)

```bash
supabase link --project-ref <staging-ref>
supabase db push --dry-run   # toont wat er zou gebeuren
supabase db push
```
Test de belangrijkste flows op de staging-URL (aanmelden, team aanmaken, …).

## 4. Pull request develop → main

Open een PR van `develop` naar `main` met de release-notitie, de lijst migraties en
eventuele nieuwe env-variabelen. Wacht op groene CI en akkoord van de gebruiker.

## 5. Productie (na expliciet akkoord)

1. Migraties eerst, vóór de nieuwe code live gaat (migraties moeten achterwaarts compatibel zijn):
   ```bash
   supabase link --project-ref <productie-ref>
   supabase db push --dry-run
   supabase db push
   ```
   **Nooit** `supabase db reset` of de seed op productie.
2. Nieuwe env-variabelen in Vercel (Production) zetten.
3. Merge de PR; Vercel deployt `main` naar productie.
4. Tag de release: `git tag -a vX.Y.Z -m "<samenvatting>" && git push origin vX.Y.Z`.
5. Rooktest op productie: aanmelden, teamoverzicht laden.

## Terugdraaien

- Code: in Vercel de vorige productie-deploy promoten.
- Database: schrijf een nieuwe migratie die het terugdraait (migraties nooit wijzigen of verwijderen).
