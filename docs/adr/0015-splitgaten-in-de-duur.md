# Splitgaten tellen als extra werktijd in elke duuroptelling

Een gesplitste taak draagt haar gaten (`splitGaps`) op de cumulatieve werkminuten-as. Elke optelling of aftrek van
een duur telt die gaten mee als extra werktijd, via `splitTotalSpanMinutes` en `splitTotalSpanDays`: de vroege
finish (`addDurationChecked`), de late start (`subDuration`), en de omrekening tussen start en finish
(`startFromFinish`, `finishFromStart`) die de FF/SF-relaties, de constraints en de harde pinnen gebruiken. Ontbreekt
één van die vier, dan horen LS en EF niet meer bij elkaar en krijgt elke gesplitste taak spookspeling, of geeft een
gesplitste FF-voorganger een start die haar eigen duur negeert.

## Gevolgen

- Kalendertijd kent geen gaten: een ELAPSEDTIME-taak telt haar duur zonder splitgaten.
- Een lopende taak telt alleen het restwerkvenster `[al afgewerkt, totale duur)`; een gat vóór het afgewerkte deel
  zit al in de historie. De lengte op de as is het verschil van twee wandelingen (totaal en al afgewerkt). Een
  kale werkhoeveelheid tegen een gat vergelijken telt bij twee of meer gaten een gepasseerd gat dubbel. Vastgelegd in
  `cases-advanced-cpm.json` (`z7-split-*`).
- Het resume-moment en de splitgaten staan op verschillende assen: resume is het kalenderanker van het restwerk, de
  gaten staan op de werkas. Het venster wordt los van de keuze van het hervattingspunt berekend.
- Bij vijandige invoer (restduur groter dan de totale duur) klemt alleen de gatentak het afgewerkte deel op 0
  (`z7-split-h-hostile-remaining-boven-totalspan`). Een taak zonder gaten met zo'n restduur loopt ongeklemd door:
  de restduur in het algemeen klemmen zou het voortgangsgedrag van elke taak veranderen.
- Een duur in dagen die in een profiel zonder dagenmaat als urenmaat telt, wordt `scheduleDuration` maal werktijd per
  dag maal 60, afgerond op hele minuten (een moment ligt op een hele minuut).
