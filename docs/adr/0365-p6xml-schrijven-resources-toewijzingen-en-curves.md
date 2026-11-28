# P6 XML schrijven: resources, tarieven, toewijzingen en curves

`writeP6XMLWithReport` schrijft resources, tarieven en curves op het hoogste niveau en de toewijzingen binnen het
project. De lezer neemt ze terug zoals in ADR 0269; de keuzes hieronder zijn de spiegel daarvan.

## Gevolgen

- `resourceTypeToP6` (ook in `xerWriter.ts`): LABOR en CREW worden `Labor`, MATERIAL `Material`, EQUIPMENT en
  SUBCONTRACTOR `Nonlabor`. Een kostenresource gaat niet mee (issue #815, ADR 0367); `Material` is voor COST alleen de
  waarde die de typetabel compleet maakt. De lezer maakt van `Nonlabor` altijd EQUIPMENT (ADR 0269); de exportmelding
  telt CREW en SUBCONTRACTOR (`p6XmlExportNotice.ts`).
- `MaxUnitsPerTime` is `maxUnits` zonder omrekening, als fractie waarin 1 een volle eenheid is. MPXJ schrijft hier ook een
  fractie en geen uren per dag (eenheden gedeeld door 100, `XmlContextWriter.writeResource`).
- Het uurtarief gaat niet op `<Resource>` maar als `<ResourceRate>` met `PricePerUnit` en `ResourceObjectId`: één rij
  per resource met een `costPerHour`, met `EffectiveDate` de projectstart, omdat OPS één vlak tarief kent. De lezer
  neemt bij meer rijen de vroegste (ADR 0269). MPXJ schrijft het tarief ook als `<ResourceRate>` met
  `PricePerUnit` (`XmlContextWriter.writeResourceRates`).
- Een toewijzing gaat alleen mee als haar taak en haar resource in het bestand staan; een toewijzing op een
  samenvattingstaak: knownbug 2339. `ActualUnits`, `PlannedUnits` en `RemainingUnits` zijn het werk in uren (minuten
  gedeeld door 60), alleen als het veld gezet is, voor elke soort resource, ook materiaal; wat die velden bij
  materiaal in P6 betekenen, staat open in knownbug 2303.
- `PlannedUnitsPerTime` is het begrote tempo: `plannedUnitsPerDay` als een P6-import het resttempo als inzet koos,
  anders de inzet (`unitsPerDay`), en nooit het resttempo (eigenaarsbesluit 2026-10-15). `RemainingUnitsPerTime`
  staat er alleen naast een apart begroot tempo, en is dan de inzet. Hoe de lezer kiest: `importedAssignmentRate`
  (ADR 0269).
- Een curve gaat als `<ResourceCurve>` met 21 waarden (`Value0` tot en met `Value100`), met
  `ResourceCurveObjectId` op de toewijzing (`curveObjIdFor`). Er komt één `<ResourceCurve>` per verschillende
  waardenlijst die een toewijzing gebruikt: `curveValues`, anders de OPS-tabel van `curve` (`CONTOUR_SHAPE_VALUES`);
  een vlakke lijst geeft geen curve, en `UNIFORM` zonder `curveValues` ook niet. `<Name>` is de naam uit
  `P6_CURVE_TO_NAME`, anders `Curve <nummer>`;
  dezelfde namen gebruikt de XER-writer. `<PlannedCurve>` is een spreiding (`contourIo.ts`), geen curvenaam. MPXJ
  schrijft een curve zo, met `<Name>` en de waarden `Value0` tot en met `Value100` (`XmlContextWriter.writeResourceCurves`).
- Ook bij `DOUBLE_PEAK` en de andere vormen zijn de waarden die van de OPS-tabel en alleen de naam die van P6. De
  lezer zoekt eerst op waarden en pas daarna op naam (ADR 0269), zodat OPS zijn eigen vorm terugkrijgt.
- De inkomende tabel `P6_NAME_TO_CURVE` (voor de P6 XML- en de XER-lezer) is geen omkering van `P6_CURVE_TO_NAME`:
  hij kent `Linear` als `UNIFORM`, terwijl de writer `UNIFORM` als geen curve schrijft.
- Een toewijzing met een gekoppelde contour (`timephasedContours`, via `matchContoursToAssignments`) krijgt een
  spreiding van `contourPeriodsToP6Spread`, alleen met minstens één periode met een eindige positie (`afterMinutes`) en een eindige lengte (`minutes`) boven 0,
  en met een startanker: `<ActualCurve>` met de verrichte periodes, `<RemainingCurve>` met de resterende en
  `<PlannedCurve>` met alle periodes. Elke spreiding staat er met haar ankerveld (`ActualStartDate`,
  `RemainingStartDate`, `PlannedStartDate`, bij de geplande ook `PlannedFinishDate`), en alle drie de ankers zijn de
  rekenstart van de taak (`computedStart`), zoals de activiteit (ADR 0364), ook voor de verrichte periodes. Zonder
  rekenstart schrijft de writer geen spreiding. De lezer maakt er pas weer een contour van bij meer dan één periode en
  werk in minstens één ervan (ADR 0269). MPXJ leest een spreiding zonder anker niet
  (`TimephasedHelper.read`).
