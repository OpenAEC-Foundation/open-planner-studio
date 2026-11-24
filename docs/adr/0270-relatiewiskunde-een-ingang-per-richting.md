# De relatiewiskunde staat in één module, met een ingang per richting

`relationMath.ts` rekent de grens uit die één relatie (FS, SS, FF of SF) oplegt; `CPMSolver.ts` roept het aan.
`forwardConstraint` geeft de vroegste start die de relatie de opvolger toestaat, `backwardConstraint` de laatste
finish die ze de voorganger toestaat. Het zijn ondergrenzen en bovengrenzen per relatie, geen gelijkheden: in
`forwardPass` begint de vroege start op de projectstart en neemt ze het maximum over de voorgangers. De
kalenderprimitieven die de module gebruikt (`RelationDeps`) zijn methoden van `CPMSolver`, die de solver injecteert
(`relDeps`). Ze delen daar hun lag- en snapregels met de rest van de solver; door ze te injecteren bestaan ze één
keer en blijft de module zonder eigen kopie. Elke taak loopt over hetzelfde pad op de tijdas in minuten, ook een taak
in de dagenmaat (ADR 0274).

## Gevolgen

- De mijlpaalgrensvlaggen komen uit één functie, `relationBoundaryFlags`; beide richtingen krijgen dezelfde uitkomst
  aangereikt (ADR 0271).
- Achterwaarts is per relatietype de spiegel van voorwaarts, maar dat is een afspraak tussen twee losse
  `switch`-takken (`forwardHour` en `backwardHour`), geen eigenschap die de code afdwingt. Wie de ene tak wijzigt, kijkt
  naar de andere. De gevallen in `cases-hours-relations.json` verwachten zowel vroege als late datums.
- Een lag in werktijd telt in de kalender die `lagEngine` kiest uit de projectoptie `lagCalendar`; zonder keuze is
  dat de kalender van de voorganger (gids `ref-rekenopties-en-conventies.md`, *Lag-kalender*). Een lag met `lagUnit`
  `ELAPSEDTIME` telt in klokminuten, zonder lagkalender (ADR 0273).
- De SF-finishvloer is een eigen functie naast `forwardConstraint` (ADR 0031 en ADR 0275).
