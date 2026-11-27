# DCMA-beoordeling: de kritiek-padtest zonder pin op de eindtaak, en ongeldige datums

De kritiek-padtest (`criticalPathTest` in `src/engine/reports/dcmaAssessment.ts`) haalt een verplichte (`hard`) pin
op de eindtaak weg, in de run die de kandidaat kiest en in de run met de vertraging. Zo'n pin houdt de eindtaak op
haar datum met speling 0 en drijft de negatieve speling stroomopwaarts; het pamflet rekent dat als geslaagd. Zonder
pin toetst de test alleen of de logica de vertraging doorgeeft, en de uitkomst is dezelfde. Met de pin erop kan een
harde MFO op het einde van een latere werkdag alle activiteiten positieve speling geven, en dan is er geen kritieke
kandidaat. Een zachte MSO of MFO op de eindtaak blijft staan.

## Gevolgen

- Ongeldige datums (`invalidDateReasons`, punt 9, ook gebruikt door de planningsgezondheid): een werkelijke datum
  "ná" de statusdatum toetst met de precisie van het raster (`isTaskActualPastStatusDate`), een prognose "vóór" de
  statusdatum op dagniveau. De statusdatum is de eerste dag van het restwerk (de vloer van de solver), dus een
  prognose op die dag is geldig.
- Lange duur (punt 8) toetst de huidige duur in minuten (`taskDurationMinutes`), niet met `durationDays`: dat getal
  rondt af op een tiende dag.
