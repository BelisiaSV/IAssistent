# _gedeeld

Afspraken die voor álle rollen gelden. Elke rol krijgt deze bestanden mee.

- `afspraken.md` — taal, toon, hoe we de hoofdcoach aanspreken, wat altijd/nooit mag.
- `visie-hoofdcoach.md` — hoe rollen omgaan met het visieprofiel van de coach.
- `stafmeeting.md` — hoe rollen onderling afstemmen (wordt uitgewerkt in een latere fase).
- `woordenlijst.md` — vaste begrippen zodat alle rollen dezelfde taal spreken.
- `rol-sjabloon.md` — sjabloon voor elke `rol.md`. De `##`-secties hier zijn verplicht in
  elke rol; `pnpm staff:validate` controleert dat.
- `posities.json` — de posities (code, naam, linie) die spelers en formaties gebruiken.
- `formaties.json` — formaties met hun posten op het veld (x/y in procent) voor de wedstrijdselectie.
- `visieprofiel.json` — de vragenlijst van het visieprofiel van de hoofdcoach (skill `visie-bijwerken`).
- `wedstrijddagen.json` — labels MD-4 … MD … MD+4 met uitleg; de volgorde bepaalt de voorrang.
- `opdracht-systeem.md` en `opdracht-gebruiker.md` — sjablonen waarmee de staff-engine de opdracht
  aan een AI-rol opbouwt. `{{…}}` zijn invulvelden; de engine controleert dat ze bestaan.
- `periodisering.json` — weektypes (belasting %, km) en cycli van 4, 6 en 8 weken vanaf de eerste competitiewedstrijd.
- `testen.json` — fysieke testen (VAMEVAL/MAS) met eenheid, grenzen en interval.
