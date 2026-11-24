# MSPDI lezen: resources en toewijzingen

MSPDI zegt van een werkresource niet of het arbeid, materieel, een ploeg of een onderaannemer is. `readMSPDI` maakt
van `<Type>` 0 MATERIAL en van elke andere waarde LABOR: een geaccepteerd verlies, want zonder een andere aanwijzing
is er niets om uit te kiezen. Een kostenresource wordt zo ook LABOR, omdat `ResourceType` geen kostensoort kent
(knownbug 441). De `.mpp`-lezer doet hetzelfde (`readResourcesUnsafe`).

## Gevolgen

- De afleiding van het werk van een toewijzing (duur × inzet, `taskWorkMinutes`) rekent met dezelfde uren per dag als
  de writer `<Work>` schreef: de werktijd per dag als de projectkop `OPS_DayMeasureDurations` definieert, anders de
  opgeslagen uren per dag van de taakkalender (`effHpdByTaskId`, ADR 0251). `importedWorkFields` bewaart `<Work>`,
  `<ActualWork>` en `<RemainingWork>` alleen als ze iets zeggen wat die afleiding niet al zegt. Met een andere dag zou
  een dagtaak van 5 d op een kalender met 8 u per dag en blokken van 10 u haar werk als vastgelegd werk terugkrijgen.
  Niet getoetst in een rondgang van een toewijzing.
- `<TimephasedData>` met `Type` 1 (rest) of 2 (verricht werk) wordt een contour op de taakas
  (`absoluteItemsToContourPeriods`, regel `contour`). Alleen data die iets zegt, wordt een contour: er moet werk in
  zitten, en er moet meer dan één periode zijn of `WorkContour` 8 (`MSPDI_WORKCONTOUR_CONTOURED`). `WorkContour` 8
  zonder bruikbare `<TimephasedData>` geeft geen contour. `attachContours` zet de contouren en de werkonderbrekingen
  die daaruit volgen op de taken (`splitGapsFromContours`, ADR 0004).
