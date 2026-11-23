# Statusdatum en voortgangslijn in de Gantt

De Gantt toont de statusdatum zoals de rekenkern hem gebruikt (besluit orkestrator 2026-10-19). `statusDateX` zet
de lijn op het tijdstip als de projectkalender in uurmodus rekent (`isHourModeCalendar`, dezelfde regel als de
solver) en anders op het begin van de dag. De gestippelde statusdatumlijn en de voortgangslijn sluiten elkaar uit:
staat de voortgangslijn aan (standaard aan), dan tekent `drawStatusDateLine` niets, want de voortgangslijn tekent
zelf een lijn op dezelfde x in dezelfde kleur. Twee lijnen op elkaar gaven een stippel-door-massief beeld.

## Gevolgen

- Het label (`drawStatusDateBadge`) is een horizontaal vlakje in de kopstrook, op de onderste band, rechts van de
  lijn en links als het rechts buiten het canvas valt. Op de eerste taakrij zou het balken afdekken en met de rijen
  meeschuiven. Zonder label is de markering niet te onderscheiden van de vandaaglijn, die dezelfde accentkleur en
  hetzelfde streepjespatroon heeft. De tekst is de datum in de Datumnotatie, met de tijd in de Tijdnotatie als de
  kern die tijd gebruikt (besluit eigenaar 2026-10-17, `check-statusdatum-tijd`). Een rand van 1 px in de
  paneelkleur scheidt het vlakje van de even gekleurde lijn ernaast. Staan lijn en voortgangslijn allebei uit,
  dan is er geen label.
- De voortgangslijn tekent per zichtbare rij een eigen subpad. Zo begint het streepjespatroon per rij opnieuw en
  loopt een uitstulping vanaf het voortgangspunt naar de lijn, zodat er een streepje op de punt staat. Er is geen
  hoekverbinding: een `miter`-hoek stak bij een spitse uitstulping tot ongeveer 10 px voorbij de voortgangsgrens.
- Een uitstulping kan er zijn bij een bladtaak die geen nulduurmijlpaal is; een mijlpaal met duur tekent als balk en
  kan dus uitstulpen. Rijen van een samenvatting, een band of een nulduurmijlpaal volgen de lijn recht. Een taak stulpt niet
  uit als hij helemaal klaar is en uiterlijk op de statusdatum eindigt, of als hij geen voortgang heeft en op of na
  de statusdatum begint.
- In dagmodus vergelijkt de voortgangslijn per UTC-dag (`utcDayStart`), in uurmodus op het tijdstip van balk en
  statusdatum. Met alleen de dag liep een taak van 08:00 tot 12:00 zonder voortgang bij statusdatum 17:00 dezelfde
  dag op schema.
- Voortgangslijn, statusdatumlijn en label worden ná de tijdschaalkop getekend en liggen dus boven alle andere
  lagen.
