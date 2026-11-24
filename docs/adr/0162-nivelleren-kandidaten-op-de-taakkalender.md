# Nivelleren: kandidaten op de taakkalender, vraag per kandidaat en vertraging in minuten

De vertraging die de nivelleerder schrijft, hoort in de solver uit te komen op het moment dat de nivelleerder toetste.
Daarom liggen de kandidaten, de vraag en de meting van de vertraging op één as: de kalender van de taak, via
`createTaskEngineCache`, zoals bij de resourcebelasting. Een scan op de projectkalender naast een meting op de
taakkalender gaf zonder enige capaciteitsdruk een vertraging (`check-leveler-splits.ts`, geval 5 en 6). Hoe de
kandidaten en hun minuten lopen, staat in `nextCandidateFor` en `candidateAxis`; het contract staat in
`docs/superpowers/specs/2026-10-20-alleen-uren-design.md`, §3.11. De vertraging gaat ook als minuten naar de solver
(`delayMinutes`, ADR 0017), omdat een overgeslagen korte werkdag minder werktijd is dan een volle.

Wanneer de statusdatum de vroegste start opschuift, zoekt de nivelleerder vanaf die latere start. Bij een gevonden
verschuiving meet hij de te schrijven vertraging vanaf het startanker vóór de statusdatumvloer. Daarmee bereikt de
solver de getoetste kandidaat via dezelfde rekenregel die ook bestaande IFC-vertragingen toepast (#1161).

## Gevolgen

- Voor elke kandidaat bepaalt de gedeelde plaatsing van het histogram (`taskLoadPlacement` en
  `assignmentLoadOnPlacement`) de werkdagen en de vraag per dag (`computeDemand`); `findSlot` toetst en `bookDemandAt`
  boekt allebei via `demandAt`. Een vaste vraag die alleen met de dagenlijst meeschuift, is fout zodra de verdeling
  van de startplek afhangt; het voorbeeld staat in §3.11 van de spec.
- Een taak waarvan de plaatsing haar berekende spanne volgt (`placementFollowsSpan`), krijgt die spanne uit de eigen
  basis (`spanView`), omdat `task.time` verouderd kan zijn.
- De contour van een toewijzing wordt gekoppeld met alle toewijzingen van de taak, ook die op niet gekozen
  resources, behalve kostentoewijzingen (`contourSiblings`): de keuze van resources in het venster mag de betekenis
  van een oude contour niet veranderen.
- `candidateAxis` bouwt elke kandidaat vanaf de vorige. Elke kandidaat opnieuw vanaf de eerste wandelen was
  kwadratisch per taak (`check-leveler-candidate-axis.ts`; de resterende kosten over een rij concurrerende taken
  staan in knownbug 370).
- Een kandidaat met een lege dagenset telt niet als passend, omdat er dan niets te boeken valt; een korte
  kalendertijdtaak kan helemaal in een weekend vallen (`check-leveler-splits.ts`, geval 10).
- `delays` draagt de vertraging daarnaast in hele dagen (bij kalendertijd kalenderdagen); *Nivellering toepassen*
  schrijft allebei (`writeLevelingResult`, ADR 0017). De takken voor een kalender zonder werkblokken zijn niet meer
  bereikbaar (knownbug 507).
