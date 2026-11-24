# P6 XML lezen: resources, tarieven en toewijzingen

P6 kent drie soorten resource. `resourceTypeFromP6` maakt van `Material` MATERIAL, van `Nonlabor` EQUIPMENT en van
elke andere waarde LABOR. Nonlabor wordt altijd EQUIPMENT: een geaccepteerd verlies, want een onderaannemer komt er
ook als Nonlabor in (`resourceTypeToP6`) en het bestand zegt niet welke van de twee het was. De MCP-tool die een
planning importeert, meldt het (`fileTools.ts`).

## Gevolgen

- `MaxUnitsPerTime`, `PlannedUnitsPerTime` en `RemainingUnitsPerTime` neemt de lezer ongewijzigd over, als fractie
  (1 is 100 %), zoals de writer ze schrijft (`p6xmlWriter.ts`); dat P6 deze velden zo bedoelt, komt uit het
  weggehaalde commentaar en is niet nagegaan. Een `MaxUnitsPerTime` van 0 of minder wordt 1.
- Een resource krijgt `costPerHour` uit `PricePerUnit` van een `<ResourceRate>` met zijn `ResourceObjectId`. Bij meer
  rijen wint de rij met de vroegste `EffectiveDate` (een lege datum gaat voor elke datum), omdat OPS één vlak tarief
  per resource kent. Dat `PricePerUnit` een uurtarief is, komt uit het weggehaalde commentaar en is niet nagegaan.
- Het tempo van een toewijzing: het begrote tempo is `PlannedUnitsPerTime` als dat boven 0 is, anders
  `RemainingUnitsPerTime` als dat boven 0 is, anders 1. De terugval op het resttempo volgt de XER-lezer
  (`plannedAssignmentRate`), die ook een resttempo van 0 neemt (review #361 punt 2). Materiaal houdt het begrote tempo; anders kiest `importedAssignmentRate` tussen rest- en begroot tempo
  (eigenaarsbesluit 2026-10-15).
- `PlannedUnits`, `ActualUnits` en `RemainingUnits` staan in uren en worden minuten. Welke werkvelden de lezer bewaart,
  beslist `importedWorkFields`, tegen de duur van de taak maal het tempo, met de uren per dag van de kalender van de
  taak.
- De curve van een toewijzing komt uit de `<ResourceCurve>` van `ResourceCurveObjectId`: 21 waarden (`Value0` tot en
  met `Value100`, in stappen van 5), na `normalizeCurveValues`. Een vlakke curve is geen curve. Anders zijn de waarden
  de exacte data (`curveValues`) en is `curve` een exacte match met een tabel van OPS (`matchCurveValues`), anders de
  naam van P6 (`P6_NAME_TO_CURVE`), anders geen vorm; `UNIFORM` wordt niet opgeslagen. Zonder bruikbare curve uit de
  catalogus geldt een `<PlannedCurve>` zonder `:` als curvenaam, de vorm van oudere eigen exports.
- De spreiding: `<ActualCurve>` (verricht, vanaf `ActualStartDate`) en `<RemainingCurve>` (resterend, vanaf
  `RemainingStartDate`); als die samen geen periode geven, een `<PlannedCurve>` met `:` als resterend werk vanaf
  `PlannedStartDate`. Een ontbrekend anker is de start van de taak (`axisOffsetMinutes` op de taakkalender). Alleen een
  activiteit krijgt een contour, en alleen bij meer dan één periode en werk in minstens één ervan
  (`p6SpreadToContourPeriods`, `attachContours`; regel `contour`). Dat MPXJ deze drie velden met deze ankers leest,
  komt uit het weggehaalde commentaar en is niet nagegaan.
