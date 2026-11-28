# P6 XML lezen: resources, tarieven en toewijzingen

`resourceTypeFromP6` maakt van `Material` MATERIAL, van `Nonlabor` EQUIPMENT en van elke andere waarde LABOR. Nonlabor
wordt altijd EQUIPMENT: een geaccepteerd verlies, want de eigen writer schrijft ook een onderaannemer als Nonlabor
(`resourceTypeToP6`) en het bestand zegt niet welke van de twee het was. De MCP-tool die een planning importeert, meldt
het (`fileTools.ts`).

## Gevolgen

- `MaxUnitsPerTime` neemt de lezer zonder omrekening over als `maxUnits`, zoals de writer het schrijft
  (`p6xmlWriter.ts`); een waarde van 0 of minder, of geen waarde, wordt 1.
- Een resource krijgt `costPerHour` uit `PricePerUnit` van een `<ResourceRate>` met zijn `ResourceObjectId`. Bij meer
  rijen wint de rij met de vroegste `EffectiveDate` (een lege datum gaat voor elke datum), omdat OPS één vlak tarief
  per resource kent. De lezer neemt `PricePerUnit` als uurtarief; MPXJ doet dat ook
  (`XmlContextReader`).
- Het tempo van een toewijzing, in deze volgorde. Het begrote tempo is `PlannedUnitsPerTime` als dat boven 0 is, anders
  `RemainingUnitsPerTime` als dat boven 0 is, anders 1; de terugval op het resttempo volgt de XER-lezer
  (`plannedAssignmentRate`, die ook een resttempo van 0 neemt; review #361 punt 2). Materiaal krijgt het begrote tempo
  als `unitsPerDay`. Voor een andere resource kiest `importedAssignmentRate` (eigenaarsbesluit 2026-10-15): het
  resttempo als `unitsPerDay`, met het begrote als `plannedUnitsPerDay`, alleen bij restwerk boven 0 en een resttempo
  boven 0 dat meer dan `RATE_REL_EPS` maal het grootste van de twee tempo's afwijkt van het begrote; anders het begrote
  tempo. De lezer rekent die
  tempo's niet om.
- De lezer neemt `PlannedUnits`, `ActualUnits` en `RemainingUnits` als uren en rekent ze `× 60` om naar minuten, voor
  elke soort resource, ook materiaal (knownbug 2303). Welke werkvelden hij daarmee bewaart, beslist
  `importedWorkFields`, tegen de duur van de taak maal `unitsPerDay`, met de uren per dag van de kalender van de taak.
  De XER-lezer geeft materiaal geen werkvelden (`xerResourceAssignments.ts`).
- De curve van een toewijzing komt uit de `<ResourceCurve>` van `ResourceCurveObjectId`: 21 waarden (`Value0` tot en
  met `Value100`, in stappen van 5), na `normalizeCurveValues`. Een vlakke curve is geen curve. Anders zijn de waarden
  de exacte data (`curveValues`) en is `curve` een exacte match met een tabel van OPS (`matchCurveValues`), anders de
  naam van P6 (`P6_NAME_TO_CURVE`), anders geen vorm; `UNIFORM` wordt niet opgeslagen. Zonder bruikbare curve uit de
  catalogus geldt een `<PlannedCurve>` zonder `:` als curvenaam, de vorm van oudere eigen exports.
- De spreiding: `<ActualCurve>` (verricht, vanaf `ActualStartDate`) en `<RemainingCurve>` (resterend, vanaf
  `RemainingStartDate`); als die samen geen periode geven, een `<PlannedCurve>` met `:` als resterend werk vanaf
  `PlannedStartDate`. Een ontbrekend anker is de start van de taak (`axisOffsetMinutes` op de taakkalender). Alleen een
  activiteit krijgt een contour, en alleen bij meer dan één periode en werk in minstens één ervan
  (`p6SpreadToContourPeriods`, `attachContours`; regel `contour`). MPXJ leest deze drie velden met dezelfde ankers
  (`XmlProjectReader`, `TimephasedHelper.read`).
