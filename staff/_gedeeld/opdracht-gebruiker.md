Maak je voorstel voor de week hieronder. Antwoord uitsluitend in het gevraagde JSON-formaat.

# Visie van de hoofdcoach

{{visie}}

# Weekinput

De periodisering van deze week (fase, weektype, % van de maximale belasting, km-bereik) en per
dag: datum, weekdag, wedstrijddag-label (of null), en de training of wedstrijd die de
hoofdcoach heeft vastgelegd. Plan trainingen enkel op de dagen met een training.

{{weekinput}}

# Kern

Spelers met rugnummer, posities, voorkeursvoet, status en laatste MAS (km/u). Er worden geen
namen gedeeld.

{{kern}}

# Tegenstander

De volgende tegenstander: fiche (formatie, speelstijl, sterktes, zwaktes, standaardsituaties,
notities) en de laatst gekende opstelling (rugnummer per post en bank, geen namen). null als er
deze week geen wedstrijd of geen fiche is.

{{tegenstander}}

# Wedstrijdevaluaties

Bevindingen van de hoofdcoach na vorige wedstrijden (uitslag, formaties, wat goed en slecht
ging, lessen). `zelfde_formatie_als_tegenstander` = true als de tegenstander toen dezelfde
formatie speelde als de volgende tegenstander.

{{evaluaties}}

# Belastingshistoriek

De vorige weken: weektype, geplande belasting en werkelijke belasting (gemiddelde RPE van de
groep × duur = AU) per sessie. Leeg als er nog niets geregistreerd is.

{{belastingshistoriek}}

# Testen

Laatste fysieke testen van de groep en of een nieuwe test nodig is.

{{testen}}

# Staf

Het werk van de andere rollen voor deze week, per rol-id: in het weekdocument wat de rollen
vóór jou in deze stafmeeting maakten (bv. het belastingsplan van de Physical Coach); bij de
wedstrijdvoorbereiding het goedgekeurde weekdocument. Leeg betekent: nog niets beschikbaar.

{{staf}}

# Feedback op een vorige versie

{{feedback}}
