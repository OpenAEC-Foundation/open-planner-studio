# Toewijzingen in IFC: de relatie is de bron, de metadata volgt per resource in volgorde

De koppeling tussen taak en resource staat in het bestand op één plek: `IFCRELASSIGNSTOPROCESS`. Er is geen tweede
opslag. De lezer bouwt elke toewijzing uit die relaties en projecteert ze daarna terug op `task.resourceIds`
(`reconstructResourceIds`), in de volgorde waarin ze voor het eerst voorkomen en zonder dubbelen. Dezelfde resource
twee keer in `RelatedObjects` is twee toewijzingen (zie "Bekende afwijking" in `docs/ifc-round-trip.md`). De
metadata per toewijzing (`OPS_Assignments` met tempo en curve, `OPS_Timephased` met venster, curvewaarden, werk en
bedrag) is per taak gesleuteld als `<resource-GlobalId>#<volgnummer>`. Per resource vormt ze een wachtrij op
volgnummer, en elke herhaling van die resource in de relatie neemt de volgende uit de rij. Dat werkt omdat writer en
relatie dezelfde bron hebben (de lijst toewijzingen) en per resource dus gelijk oplopen.

## Gevolgen

- Een propertynaam die op `#<getal>` eindigt, is de nieuwe vorm: `#` komt niet voor in een IFC-GlobalId. Een kale
  GlobalId als propertynaam is de vorm van oudere bestanden: hooguit één meta per resource op een taak (de laatste
  wint), meer valt daaruit niet te herstellen. `OPS_Timephased` heeft altijd volgnummers gebruikt en kent geen oude
  vorm.
- Het volgnummer is de volgorde, niet de volgorde van de properties in de pset.
- Ontbreekt de meta, dan geldt tempo 1 en geen curve. `'UNIFORM'` leest terug als geen curve, omdat de writer een
  toewijzing zonder curve als `'UNIFORM'` schrijft; zo komen beide gelijk terug.
- Werkgetallen, begroot tempo en bedrag uit de JSON tellen alleen als ze eindig en niet negatief zijn; anders vallen
  ze weg, nooit `NaN` in de state.
- Na het lezen worden kostenresources (#815) en hun toewijzingen schoongemaakt met dezelfde regels als in de app
  (`clearCostResourceFields`, `normalizeAssignmentForResource`), want een bestand van een andere schrijver kan ze
  toch werkvelden geven.
- Toets: `check-ifc-roundtrip.ts` (een resource die twee keer op dezelfde taak staat).
