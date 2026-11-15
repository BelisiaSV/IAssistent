# /staff — inhoud van de AI-staf

Alle voetbalinhoud van IAssistent staat hier, nooit in de code.
De code in `packages/staff-engine` leest deze bestanden in.

## Structuur

```
staff/
  _gedeeld/                 afspraken die voor alle rollen gelden
  <rol-id>/                 één map per rol (Engelse kebab-case id)
    rol.md                  wie de rol is (vast sjabloon, zie hieronder)
    instructies.md          hoe de rol werkt, stap voor stap
    output-schema.json      JSON Schema van wat de rol teruggeeft
    referentie/             achtergrondkennis (methodiek, periodisering, ...)
    voorbeelden/            voorbeeldinput en -output
    tests/                  testgevallen voor de rol
    taken/<taak-id>/        extra taak (instructies.md, output-schema.json, voorbeelden/);
                            elke rol heeft `taken/gesprek` voor de Staff Room
```

## Rollen

| id               | naam            |
|------------------|-----------------|
| coordinator      | AI Staff Coordinator |
| assistant-coach  | Assistent Coach |
| tactical-coach   | Tactical Coach  |
| physical-coach   | Physical Coach  |
| video-analyst    | Video Analist   |
| player-development | Player Development |
| team-manager     | Team Manager    |

## Regels

- Alles in het Nederlands geschreven (de AI-output is Nederlands).
- `rol.md` begint met frontmatter (`id`, `naam`, `versie`, `status`) en volgt
  de vaste secties van het sjabloon. `id` moet gelijk zijn aan de mapnaam.
- `status`: `placeholder` (nog leeg), `concept` (in opbouw), `actief` (mag gebruikt worden).
- Controleer na elke wijziging: `pnpm staff:validate`.
- Nieuwe rol? Gebruik de skill `nieuwe-rol`. Rol aanpassen? Skill `rol-bijwerken`.
