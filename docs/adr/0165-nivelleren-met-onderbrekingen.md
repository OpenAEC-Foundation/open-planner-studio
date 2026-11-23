# Nivelleren met onderbrekingen

Met *Onderbrekingen toestaan* (`allowSplits`, in MS Project *Leveling can create splits in remaining work*) mag de
nivelleerder pauzedagen in een taak zetten. Dat is een terugval: `findSlot` probeert eerst een aaneengesloten
venster en zoekt pas daarna een onderbroken plaatsing (`scatterSlot`). Welke taak ervoor in aanmerking komt, staat in
`splitEligible` en in de voorwaarde bij de aanroep van `scatterSlot` in `findSlot`. Een taak met de urenmaat hoort
erbij (eigenaarsbesluit 2026-08-31, `check-leveler-splitmode.ts`, geval 3b). Een taak die de planner zelf heeft
onderbroken (een gat met `source: 'user'`), schuift alleen als geheel: de nivelleerder knipt die indeling niet verder
op (issue #146, `check-leveler-splitmode.ts`, geval 5). Een importsplit (een gat zonder `source`) is brondata van
een ander programma en houdt dat niet tegen (`check-leveler-splitmode.ts`, geval 4).

## Gevolgen

- `scatterSlot` werkt van links naar rechts vanaf de eerste kandidaat, zonder zoektocht over andere startstanden;
  hoe hij pauzes invoegt en bestaande gaten meeneemt, staat in `scatterSlot`.
- Het venster bindt hier het einde (`finishWindowLimit`), niet de start, omdat pauzes vooral het einde verschuiven en
  het plafond over de einddatum gaat.
- De nieuwe gaten staan op de werkkopie vóór de boeking en vóór de proefsolve, en de vraagcache van die taak wordt
  gewist; anders boekte de nivelleerder de vraag zonder pauzes en rekende het voorstel met een spanne zonder gaten.
  `LevelingResult.gaps` draagt de hele te schrijven `splitGaps`, met de bestaande importsplits erbij.
- `dayFits` raakt `poolBlockedOnly` niet, omdat die vlag de aaneengesloten scan beschrijft (ADR 0163).
