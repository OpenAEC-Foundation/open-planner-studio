# Welke taken en kalenders de IFC-lezer als planning neemt

Een IFC-bestand van een ander pakket kan meer bevatten dan de planning: taken onder een baselineschema
(`IfcWorkSchedule` met PredefinedType `.BASELINE.`) en kalenders die niemand gebruikt. OPS zelf hangt geen taken
onder een baselineschema; zijn baselines staan als JSON in `OPS_Baselines`. Taken onder een baselineschema zijn
momentopnames en worden niet als live taken ingelezen, maar alleen als er ook een gewoon werkschema is met minstens
één taak eronder. Anders is het baselineschema de enige planning in het bestand en zijn die taken de planning: een
leeg gewoon werkschema gaf anders een leeg project.

## Gevolgen

- Een taak hangt onder een schema via `IFCRELNESTS` (het schema als RelatingObject) of `IFCRELASSIGNSTOCONTROL`
  (het schema als control). De hele boom onder het baselineschema gaat mee, transitief via `IFCRELNESTS`, zoals
  Bonsai een werkschema opbouwt met één wortel per schema; anders bleven de kinderen als losse dubbele taken over.
  Een taak die ook onder het gewone schema hangt, is live en blijft.
- De plek van PredefinedType hangt af van de indeling van het werkschema (`workControlSlots`, zie
  `docs/ifc-round-trip.md`).
- Op de bytes-route (`IfcReadOptions.planningTaskStepIds`) beslist `selectPlanning` welke taken de planning zijn en
  vervalt deze regel; zie ADR 0049.
- De projectkalender is de eerste `IFCWORKCALENDAR` in het bestand, zoals `writeIFC` hem schrijft, en heet altijd
  `cal-default`. Geen bibliotheekkalender kan dat id krijgen, ook niet via een afgeleid id.
- Bibliotheekkalenders zijn alle andere kalenders: eerst die een resource of taak gebruikt via
  `IFCRELASSIGNSTOCONTROL`, daarna de ongebruikte, in bestandsvolgorde en elk één keer. Een toegevoegde kalender
  zonder toewijzing (het gewone patroon "eerst toevoegen, dan toewijzen") ging anders stil verloren, met zijn
  `LibraryOrigin`. De writer schrijft per bibliotheekkalender een relatie voor resources en een voor taken.
- Toetsen: `check-ifc-legacy-arity.ts` §7 (baselineschema's), `tests/library/check-ifc-hostile.ts` A2
  (ongebruikte bibliotheekkalender).
