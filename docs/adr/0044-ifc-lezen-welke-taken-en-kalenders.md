# Welke taken en kalenders de IFC-lezer als planning neemt

Een IFC-bestand van een ander pakket kan meer bevatten dan de planning: taken onder een baselineschema
(`IfcWorkSchedule` met PredefinedType `.BASELINE.`) en kalenders die niemand gebruikt. OPS zelf hangt geen taken
onder een baselineschema; zijn baselines staan als JSON in `OPS_Baselines`. Taken onder een baselineschema zijn
momentopnames en worden niet als live taken ingelezen, maar alleen als er ook een gewoon werkschema is waaronder
minstens één object hangt. Anders is het baselineschema de enige planning in het bestand en zijn die taken de
planning: een leeg gewoon werkschema gaf anders een leeg project. De lezer kijkt daarbij naar de koppelingen, niet
naar het type van wat eronder hangt.

## Gevolgen

- Onder een schema hangt elk STEP-id dat een `IFCRELNESTS` met het schema als RelatingObject of een
  `IFCRELASSIGNSTOCONTROL` met het schema als control noemt, en daaronder transitief alles wat een `IFCRELNESTS`
  onder zo'n id nest. Zo gaat de hele boom onder het baselineschema mee, zoals Bonsai een werkschema opbouwt met één
  wortel per schema; anders bleven de kinderen als losse dubbele taken over. Wat ook in de boom onder een gewoon
  schema staat, blijft. Van wat overblijft onder het baselineschema leest de lezer de `IFCTASK`'s niet als taak.
- De plek van PredefinedType hangt af van de indeling van het werkschema (`workControlSlots`, zie
  `docs/ifc-round-trip.md`).
- Op de bytes-route (`IfcReadOptions.planningTaskStepIds`) beslist `selectPlanning` welke taken de planning zijn en
  vervalt deze regel; zie ADR 0049.
- De projectkalender is de eerste `IFCWORKCALENDAR` in het bestand, zoals `writeIFC` hem schrijft, en heet altijd
  `cal-default`. Geen bibliotheekkalender kan dat id krijgen, ook niet via een afgeleid id.
- Bibliotheekkalenders zijn alle andere kalenders: eerst die als control in een `IFCRELASSIGNSTOCONTROL` staan, in
  de volgorde van die relaties, daarna de rest in bestandsvolgorde, elk één keer. Wijst zo'n relatie naar een
  resource of taak, dan krijgt die de kalender. Zonder de tweede ronde ging een toegevoegde kalender zonder
  toewijzing (het gewone patroon "eerst toevoegen, dan toewijzen") stil verloren, met zijn `LibraryOrigin`. De writer schrijft per bibliotheekkalender een relatie voor de resources en een voor de taken die
  hem gebruiken, elk alleen als die er zijn.
- Toetsen: `check-ifc-legacy-arity.ts` §7 (baselineschema's), `tests/library/check-ifc-hostile.ts` A2
  (ongebruikte bibliotheekkalender).
