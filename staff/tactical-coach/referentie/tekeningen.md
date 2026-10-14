# Tekeningen

> Concept v0.1.

Een tekening beschrijft een veld en wat erop staat. De app tekent ze.

- **veld**: `volledig` (heel terrein), `half` (helft met doel boven) of `zone` (een vrij vak). Geef
  de afmetingen in meter (breedte × lengte). Voor standaardsituaties: `half` van 68 × 30 m (de
  laatste 30 meter), zodat de spelers in en rond de zestien niet op elkaar staan.
- **coördinaten**: x en y in procent van het getekende veld; x = 0 links, x = 100 rechts;
  y = 0 boven (doel waarop we aanvallen bij `half`), y = 100 onder.
- **elementen**: `speler` (team `eigen` of `tegenstander`, label = rugnummer of letter),
  `doelman`, `kegel`, `bal`, `doel`, `minidoel`, `paal`. Neutrale spelers: team `neutraal`.
- **pijlen**: `pass` (stippellijn), `loop` (volle lijn), `dribbel` (golflijn), `schot`.
- **zones**: rechthoeken voor vakken of speelzones, met een kort label.
- **uitleg**: de stappen in volgorde, kort.

Houd tekeningen eenvoudig: alleen wat nodig is om de afspraak of oefening te begrijpen.
