---
name: rol-bijwerken
description: Werk de inhoud van een bestaande rol in /staff bij (rol.md, instructies.md, output-schema.json, referentie, voorbeelden, tests) en valideer het resultaat. Gebruik wanneer de gebruiker de werking, kennis of output van een AI-stafrol wil aanpassen.
---

# Rol bijwerken

Je wijzigt **alleen bestanden in `/staff/<rol-id>/`** (en eventueel `/staff/_gedeeld/`).
Voetbalinhoud hoort nooit in code.

## Stappen

1. Bepaal de rol (`assistant-coach`, `tactical-coach`, `physical-coach`, `video-analyst`, …)
   en lees eerst `rol.md`, `instructies.md`, `output-schema.json` en `staff/_gedeeld/*`.
2. Bepaal waar de wijziging thuishoort:
   - wie de rol is, grenzen, afstemming → `rol.md` (binnen de bestaande `##`-secties)
   - hoe de rol werkt → `instructies.md`
   - structuur van de output → `output-schema.json`
   - achtergrondkennis → `referentie/`
   - voorbeeldinput/-output → `voorbeelden/`
   - verwachte gedragingen → `tests/`
   - geldt het voor álle rollen → `staff/_gedeeld/`
3. Schrijf in het **Nederlands**. Verzin geen inhoud: vraag de gebruiker bij twijfel.
4. Wijzigt `output-schema.json`?
   - Houd het een geldig JSON Schema (draft 2020-12).
   - Werk `voorbeelden/` bij zodat ze nog aan het schema voldoen.
   - Breaking change (veld verwijderd/hernoemd/verplicht gemaakt)? Verhoog de major-versie.
5. Verhoog `versie` in de frontmatter van `rol.md` (semver):
   patch = tekstuele verduidelijking, minor = nieuwe inhoud/velden, major = breaking schema.
   Zet `status` op `concept` zodra er echte inhoud staat; `actief` alleen als de gebruiker dat zegt.
6. Valideer:
   ```bash
   pnpm staff:validate
   pnpm --filter @iassistent/staff-engine test
   ```
7. Commit op een `feature/*`-branch: `content(staff): <rol-id> — <wat er veranderde>`.

## Niet doen

- De `##`-secties uit `rol-sjabloon.md` niet verwijderen of hernoemen in één rol. Moet het
  sjabloon zelf veranderen, pas dan `staff/_gedeeld/rol-sjabloon.md` én alle rollen aan.
- Geen inhoud kopiëren naar TypeScript (ook niet "tijdelijk").
