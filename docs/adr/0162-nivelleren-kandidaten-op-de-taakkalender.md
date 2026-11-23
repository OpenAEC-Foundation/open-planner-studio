# Nivelleren: kandidaten op de taakkalender, vraag per kandidaat en vertraging in minuten

Een vertraging van de nivelleerder moet in de solver precies uitkomen op het moment dat de nivelleerder toetste.
Daarom liggen de kandidaten, de vraag en de meting van de vertraging op dezelfde as: de kalender van de taak, via
dezelfde `createTaskEngineCache` als de resourcebelasting. De eerste kandidaat is de vroegste start volgens de
relaties, op een werkmoment gezet (`nextWorkInstant`: een blokeinde wordt het volgende blokbegin, en dat telt niet
als vertraging). Kandidaat k slaat k hele werkdagen over (`candidateAxis`); de vertraging in minuten
(`delayMinutes`) is de som van de werkminuten van die dagen, zodat een korte vrijdag minder telt. De solver telt die
minuten op en zet een blokeinde op het volgende blokbegin (`shiftByLevelingDelay` en `snapSuccessorEarlyStart`,
ADR 0017). Bij kalendertijd is elke kalenderdag een kandidaat en telt een dag 1440 minuten. Het contract staat in
`docs/superpowers/specs/2026-10-20-alleen-uren-design.md`, §3.11. Een scan op de projectkalender naast een meting op
de taakkalender gaf zonder enige capaciteitsdruk een vertraging (`check-leveler-splits.ts`, geval 5 en 6).

## Gevolgen

- Voor elke kandidaat bepaalt de gedeelde plaatsing van het histogram (`taskLoadPlacement` en
  `assignmentLoadOnPlacement`) de werkdagen en de vraag per dag (`computeDemand`). `findSlot` toetst die uitkomst en
  `bookDemandAt` boekt dezelfde, zodat toets en boeking niet uit elkaar lopen. Een vaste vraag die alleen met de
  dagenlijst meeschuift, is fout zodra de verdeling van de startplek afhangt; het voorbeeld staat in §3.11 van de
  spec.
- Een taak waarvan de plaatsing haar berekende spanne volgt (`placementFollowsSpan`) krijgt die spanne uit de eigen
  basis, niet uit de mogelijk verouderde `task.time` (`spanView`).
- De contour van een toewijzing wordt gekoppeld met alle toewijzingen van de taak, ook die op niet gekozen
  resources, behalve kostentoewijzingen (`contourSiblings`): de keuze van resources in het venster mag de betekenis
  van een oude contour niet veranderen.
- `candidateAxis` bouwt elke kandidaat vanaf de vorige, met alleen de nieuw overgeslagen werkdag. Elke kandidaat
  opnieuw vanaf de eerste wandelen was kwadratisch per taak (`check-leveler-candidate-axis.ts`; de resterende kosten
  over een rij concurrerende taken staan in knownbug 370).
- Een kandidaat met een lege dagenset telt niet als passend: daar valt niets te boeken, en een korte kalendertijdtaak
  kan helemaal in een weekend vallen (`check-leveler-splits.ts`, geval 10).
- `delays` draagt de vertraging daarnaast in hele werkdagen; *Nivellering toepassen* schrijft allebei
  (`writeLevelingResult`, ADR 0017). De takken voor een kalender zonder werkblokken zijn niet meer bereikbaar
  (knownbug 507).
