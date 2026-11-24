# Verwijzingen naar id's van het schrijvende document vindt de IFC-lezer terug via de GlobalId

Bij het eerste openen krijgen resources, kalenders en relaties een id uit hun GlobalId (zie *GlobalIds* in
`.claude/rules/tauri-ifc.md`), dus een ander id dan in het document dat het bestand schreef. JSON in de psets
verwijst nog naar de oude id's: contouren en nivellering naar een resource-id, baselines naar een taak-id,
kalenderwandelingen naar een kalender. De lezer vertaalt elke verwijzing via de GlobalId die de writer voor dat
object uitgaf, nooit via een naam: kalendernamen zijn niet uniek, en twee gelijknamige kalenders zouden stil naar
dezelfde, verkeerde kalender wijzen.

## Gevolgen

- Een resource-id (`mappedResourceId`) is hetzelfde id als dat al bestaat; anders volgt het uit de GlobalId die de
  writer uit dat id afleidde, eerst `ifcGuid128(ifcObjectSeed('res', id))`, dan de oude `ifcGuid(id)`.
- Wat niet terug te vinden is, blijft letterlijk staan bij contouren (de koppeling valt terug op de regel van ADR
  0002) en bij nivellering (data, geen rekeninvoer).
- Een kalenderwandeling (`OPS_TimephasedDurationWalks`) draagt `resourceCalendarGuid`, de GlobalId van de
  `IFCWORKCALENDAR`. Is die niet bekend (kalender weg, of een extern bestand), dan valt die ene wandeling weg in
  plaats van een GlobalId als kalender-id door te geven: liever geen afgeleide sturing dan een onbetrouwbare. De
  vertaling kan pas na het lezen van de kalenderbibliotheek. `workMinutes` is optioneel en telt alleen als getal.
- Een baselinerij vindt haar taak via de `TaskGuids`-map die de writer meeschrijft; bij oudere bestanden zonder map
  via `ifcGuid(taskId)`. Een rij zonder levende taak houdt haar oude id en toont als vervallen in de vergelijking
  (en zie `baselineOrphanGuids` in `.claude/rules/tauri-ifc.md`). Een actieve baseline die niet in de gelezen set
  staat, wordt de nieuwste, of geen. De vergelijkingsset houdt alleen bekende, niet-actieve, unieke id's.
- Een contour wordt pas na `extractStructure` vertaald, want daar landen de contouren op de taken.
