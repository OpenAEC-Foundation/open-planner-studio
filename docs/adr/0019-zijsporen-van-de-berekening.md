# Een zijspoor beschrijft de beslissing en neemt er niet aan deel

De solver kan naast het resultaat drie zijsporen vullen: `dateDriverByTaskId` (wat de vroege datums van een bladtaak
bepaalde, voor de uitleg na F5, alleen met `traceDateDrivers`), `plannedFloorTraceByTaskId` (de geplande startvloer
van P6, conventie A16) en `backwardFloatTrace` (de bronnen van late datums en speling op de B3-vensterroute). Ze
worden nooit opgeslagen, niet in de taak en niet in IFC, en geen rekenstap leest ze. Een zijspoor aanzetten
verandert geen enkele datum; `check-shift-explanation.ts` houdt vast dat de rest van het resultaat gelijk blijft.

## Gevolgen

- `backwardFloatTrace` staat aan precies als conventie B3 (`p6CompletedDataDateWindow`) aan staat, omdat het spoor
  die route beschrijft. B3 staat in elk ingebouwd profiel uit; de enige lezer
  (`check-xer-completed-late.ts`) zet B3 als afwijking aan en houdt vast dat het spoor anders afwezig is.
- De geplande-startvloer wordt alleen gespoord voor een P6-activiteit met een expliciet doelvenster, en alleen als
  één relatie of de projectstart de grens is. Bij meerdere gelijke relaties is er geen unieke bron; dan blijft het
  spoor weg in plaats van een willekeurige relatie te noemen.
- Een datumbepaler is een van vaste soorten (relatie met alle voorgangers bij gelijkspel, constraint, eigen start,
  geplande start, projectstart, statusdatum, nivellering, voortgang, handmatig, hammock, overig). `other` betekent
  dat de uitleg niets zegt: een externe koppeling, een timephased venster, een FF-eindgrens. Een externe koppeling
  werkt op dezelfde plek als een constraint maar is er geen; heeft de taak er een, dan is de bepaler `other`.
- De vaste bepalers zijn gedeelde constante objecten, omdat de voorwaartse pass ook in de nivelleerder draait,
  zonder spoor, en daar niets mag alloceren.
