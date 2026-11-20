# Toewijzingen in IFC: de relatie is de bron, de metadata volgt per resource in volgorde

De koppeling tussen taak en resource staat in het bestand op één plek: `IFCRELASSIGNSTOPROCESS`. Er is geen tweede
opslag. De lezer bouwt elke toewijzing uit die relaties en projecteert ze daarna terug op `task.resourceIds`
(`reconstructResourceIds`), in de volgorde waarin ze voor het eerst voorkomen en zonder dubbelen. Dezelfde resource
twee keer in `RelatedObjects` is twee toewijzingen (zie "Bekende afwijking" in `docs/ifc-round-trip.md`). De
metadata per toewijzing (`OPS_Assignments` met tempo en curve, `OPS_Timephased` met venster, curvewaarden, werk en
bedrag) is per taak gesleuteld als `<resource-GlobalId>#<index>`, met de index over alle toewijzingen van de taak in
de volgorde van de writer. De lezer zet de records per resource op index in een wachtrij en geeft elke herhaling van
die resource in de relatie het volgende record uit die rij. De index zelf bewaart hij niet.

## Gevolgen

- `OPS_Assignments` schrijft voor elke toewijzing een record, dus daar loopt de wachtrij per resource gelijk met de
  relatie.
- `OPS_Timephased` slaat een toewijzing zonder venster, curvewaarden, werk, begroot tempo of bedrag over. Heeft een
  eerdere toewijzing van dezelfde resource op die taak geen record en een latere wel, dan krijgt na heropenen de
  eerdere het record van de latere (`knownbugs.md` 1961).
- Een propertynaam die op `#<getal>` eindigt, is de nieuwe vorm: `#` komt niet voor in een IFC-GlobalId. Een kale
  GlobalId als propertynaam is de vorm van oudere `OPS_Assignments`: hooguit één meta per resource op een taak (de
  laatste wint). `OPS_Timephased` kent geen oude vorm.
- Ontbreekt de meta, dan geldt tempo 1 en geen curve. `'UNIFORM'` leest terug als geen curve, omdat de writer een
  toewijzing zonder curve als `'UNIFORM'` schrijft; zo komen beide gelijk terug.
- Werkgetallen, begroot tempo en bedrag uit de JSON tellen alleen als ze eindig en niet negatief zijn; anders vallen
  ze weg, nooit `NaN` in de state.
- Na het lezen worden kostenresources (#815) en hun toewijzingen schoongemaakt met `clearCostResourceFields` en
  `normalizeAssignmentForResource` uit `src/types/resource.ts`, want een bestand van een andere schrijver kan ze toch
  werkvelden geven.
- Toets: `check-ifc-roundtrip.ts` (een resource die twee keer op dezelfde taak staat, met de metadata op de eerste).
