# MSPDI lezen: resources en toewijzingen

MSPDI zegt van een werkresource niet of het arbeid, materieel, een ploeg of een onderaannemer is. `readMSPDI` maakt
van `<Type>` 0 MATERIAL en van elke andere waarde LABOR: een geaccepteerd verlies, want zonder een andere aanwijzing
is er niets om uit te kiezen. Een kostenresource wordt zo ook LABOR, omdat `ResourceType` geen kostensoort kent
(knownbug 441). De `.mpp`-lezer doet hetzelfde (`readResourcesUnsafe`).

## Gevolgen

- De afleiding waarmee `importedWorkFields` het werk van een toewijzing vergelijkt, rekent met dezelfde uren per dag
  als de writer `<Work>` schreef (`effHpdByTaskId`, dezelfde keuze als in ADR 0251). Met een andere dag zou de lezer
  het werk als afwijkend vastleggen, en groeide het niet meer mee met de duur. `check-urenperdag-heropenen.ts` §8: een
  dagtaak van 5 dagen bij 8 opgeslagen uren per dag en blokken van 10,5 uur komt terug zonder vastgelegd werk, en na
  10 dagen schrijft de tweede export 105 uur. Welke werkvelden de lezer bewaart, beslist `importedWorkFields`.
- `<TimephasedData>` met `Type` 1 (rest) of 2 (verricht werk) wordt een contour op de taakas
  (`absoluteItemsToContourPeriods`, regel `contour`), alleen als er werk in zit en de data meer zegt dan één vlakke
  periode: meer dan één periode, of `WorkContour` 8 (`MSPDI_WORKCONTOUR_CONTOURED`). `attachContours` zet de contouren
  en de werkonderbrekingen die daaruit volgen op de taken (`splitGapsFromContours`, ADR 0004).
