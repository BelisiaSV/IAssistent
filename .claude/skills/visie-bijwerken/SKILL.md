---
name: visie-bijwerken
description: Pas de vragenlijst van het visieprofiel van de coach aan (staff/_gedeeld/visieprofiel.json) — thema's of vragen toevoegen, wijzigen of verwijderen — en valideer het resultaat. Gebruik wanneer de gebruiker het visieprofiel wil uitdiepen of herwerken.
---

# Visieprofiel bijwerken

De vragenlijst is **inhoud**: ze staat in `staff/_gedeeld/visieprofiel.json`. De pagina
`/profile/vision` bouwt het formulier daar automatisch uit op. Je schrijft geen vragen in code.

## Structuur

```json
{
  "versie": "0.2.0",
  "themas": [
    {
      "id": "balbezit",              // kleine letters, cijfers, _
      "titel": "Balbezit",
      "uitleg": "optioneel",
      "vragen": [
        { "id": "opbouw", "vraag": "Hoe bouw je op?", "type": "schaal",
          "min": 1, "max": 5, "label_min": "Snel en lang", "label_max": "Verzorgd" }
      ]
    }
  ]
}
```

Types:
- `kort_antwoord` (optioneel `max_lengte`, max. 200) en `tekst` (optioneel `max_lengte`, max. 2000)
- `keuze` en `meerkeuze` met `opties` (minstens 2, uniek)
- `schaal` met `min`, `max` en optioneel `label_min` / `label_max`
- `formatie` (opties komen uit `formaties.json`), optioneel `"meerdere": true`

## Regels

1. Antwoorden worden bewaard onder `<thema-id>.<vraag-id>`. **Wijzig geen bestaande id's**
   zonder dat de gebruiker akkoord is: bestaande antwoorden van coaches gaan dan verloren bij
   de volgende keer opslaan. Tekst van een vraag aanpassen mag wel.
2. Opties van een `keuze`/`meerkeuze` hernoemen maakt bestaande antwoorden ongeldig; meld dat
   en vraag bevestiging.
3. Verhoog `versie` (semver): patch = tekst, minor = nieuwe vragen/thema's, major = id's of
   opties gewijzigd/verwijderd.
4. Schrijf in het Nederlands. Verzin geen visie: vraag de gebruiker welke vragen hij wil.

## Valideren

```bash
pnpm staff:validate
pnpm --filter @iassistent/staff-engine test
pnpm --filter @iassistent/web build   # ongeldige inhoud laat de build falen
```

Commit op een `feature/*`-branch: `content(vision): <wat er veranderde>`.
