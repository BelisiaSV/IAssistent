---
name: nieuwe-rol
description: Maak een nieuwe rol aan in de AI-staf van IAssistent (/staff/<rol-id>) vanuit het rolsjabloon. Gebruik wanneer de gebruiker een nieuwe stafrol wil toevoegen (bv. keeperstrainer, mentale coach).
---

# Nieuwe rol toevoegen aan /staff

Rolinhoud is **inhoud, geen code**. Je maakt alleen bestanden in `/staff`; je schrijft geen
voetbalinhoud in TypeScript.

## Vraag eerst (als het niet gegeven is)

1. De **naam** zoals de coach hem ziet (Nederlands, bv. "Keeperstrainer").
2. Het **rol-id**: Engelse kebab-case, gelijk aan de mapnaam (bv. `goalkeeper-coach`).
3. Het **doel** van de rol in één zin, en met welke bestaande rollen hij afstemt.

## Stappen

1. Controleer dat `staff/<rol-id>/` nog niet bestaat.
2. Maak de structuur:
   ```
   staff/<rol-id>/
     rol.md               kopie van staff/_gedeeld/rol-sjabloon.md
     instructies.md
     output-schema.json
     referentie/.gitkeep
     voorbeelden/.gitkeep
     tests/.gitkeep
   ```
3. In `rol.md`: vul de frontmatter in (`id` = mapnaam, `naam`, `versie: 0.0.0`,
   `status: placeholder`) en vervang de titel. Behoud **alle `##`-secties** van het sjabloon.
   Vul alleen inhoud in die de gebruiker aanlevert; verzin geen voetbalinhoud.
4. `instructies.md`: kop `# Instructies — <naam>` met secties `## Werkwijze` en
   `## Controle voor oplevering`.
5. `output-schema.json`: geldig JSON Schema (draft 2020-12), minimaal:
   ```json
   {
     "$schema": "https://json-schema.org/draft/2020-12/schema",
     "$id": "https://iassistent.app/staff/<rol-id>/output-schema.json",
     "title": "<naam> — output",
     "type": "object",
     "properties": {},
     "additionalProperties": true
   }
   ```
6. Voeg de rol toe aan de tabel in `staff/README.md`.
7. Pas de verwachte rollijst aan in de test "repository /staff" in
   `packages/staff-engine/test/load.test.ts`.
8. Valideer en test:
   ```bash
   pnpm staff:validate
   pnpm --filter @iassistent/staff-engine test
   ```
9. Commit op een `feature/*`-branch: `feat(staff): add <rol-id> role`.

## Niet doen

- Geen code aanpassen in `packages/staff-engine/src` om de rol te laten werken: de engine
  ontdekt rollen automatisch op basis van de mappen.
- Geen sectienamen hardcoden; die komen uit `rol-sjabloon.md`.
