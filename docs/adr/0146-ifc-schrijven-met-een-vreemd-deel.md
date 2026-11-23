# De IFC-writer met een vreemd deel: vaste ids en de vorm van de bron

Bij een gewijzigde planning in een bestand met een gebouwmodel of andere vreemde gegevens (#804, ontwerp
`docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md`) schrijft de writer de eigen
planningsstukken opnieuw (een ongewijzigde planning geeft de bytes van de bron terug); `foreign/mergeWriter.ts` zet ze tussen de bronstukken. De writer krijgt daarvoor een plan
(`WriterMergeIds`) en levert dan alleen zijn entiteitregels (`writeIfcMergeLines`), zonder kop en staart. Zonder plan
nummert hij vanaf `#1`. Twee besluiten dragen dit. De domeinstukken van de bron houden hun `#id`, zodat verwijzingen
van het model ernaar blijven kloppen. En een waarde die OPS zelf in een oudere vorm schreef, blijft in die vorm staan
als de planner het veld niet wijzigde (besluit Trias, 10 november 2026), onder de voorwaarden hieronder. "Niet
gewijzigd" betekent: gelijk aan wat de app na het openen liet zien (`IfcSource.opened`), niet gelijk aan de lezing van
de bron. Wat alleen het openen veranderde (de omzetting naar het minutenmodel, de herberekening), zet
`sourceFormWhereUnchanged` (`foreign/sourceForm.ts`) terug naar de lezing van de bron voordat de writer schrijft; welke
velden dat zijn en welke toets eraan voorafgaat, bepaalt die functie, en `check-ifc-foreign-oude-eigen.ts` houdt het vast.
Zonder deze regel weigerde de merge eigen bestanden van oudere OPS-versies, of veranderde hij waarden die niemand
aanraakte.

## Gevolgen

- Een kalender die bij deze opslag voor het eerst letterlijk wordt (`minuteModelWriteView`, bijvoorbeeld
  doordat de planner een taakduur een breuk gaf of een datum na doorrekenen op geen daganker meer valt), schrijft de
  writer met tijdstippen. Dan krijgen alle taakdatums op die kalender, en de baselines met een taak op die kalender (is het de
  projectkalender, dan alle baselines), de vorm van de huidige writer (`literalLeaves` in `sourceForm.ts`), ook de datums die de planner niet wijzigde; de dagvorm van de bron zou anders terug lezen. De merge
  bouwt zijn uitvoer daarvoor opnieuw tot de set van zulke kalenders niet meer verandert, en de herleestoets gaat na dat
  herlezen geeft wat de planner zag.
- `keep` geeft per sleutel van de writer (`task_<id>`, `_calendar`, …) het bron-`#id`. Nieuwe stukken krijgen ids
  vanaf `firstId` (het hoogste id van de niet-P-stukken plus één), en slaan de ids in `reserved` over.
- Een eigen `.BASELINE.`-kop houdt zijn id via zijn GlobalId (`baselineHeads`), omdat de lezer die koppen geen
  domein-id geeft. Zonder dat schoof de reeks bij elke volgende opslag.
- Is het `IfcProject` van de bron niet P, dan schrijft de writer geen eigen project, eenheden en context; `_project`
  wijst naar het bron-project (`projectSourceId`), en de projectgegevens staan in `OPS_ProjectSettings` (ADR 0142).
- De bronvormen die de merge aan de writer meegeeft, voor velden die na het terugzetten nog gelijk zijn aan de lezing van
  de bron:
  - `sourceTaskTimes` (berekend in `sourceTaskTimes` van `mergeWriter.ts`), per slot van `IfcTaskTime`: de duur en de
    rest elk apart als de bron daar een dagduur `P…D` had, ook een hele; de werkelijke duur en de vrije en totale
    speling elk apart als die dagduur een breuk had (`P0Y0M0.5D`, of zeventien cijfers zoals
    `P0Y0M2.3333333333333335D`). Een urentaak doet voor duur, rest en werkelijke duur niet mee. De writer schrijft zo'n
    slot exact (`ifcDurationExact`) en zonder record. Een dagtaak met de duur in de bronvorm maakt haar kalender om die
    duur niet letterlijk; een datum die niet op een anker past, doet dat nog wel.
  - `sourceDayLagIds`: een lag die de bron als gebroken dag in de oude vorm had (`IFCDURATION('P0.30000000000000004D')`)
    schrijft de writer exact zo, zonder record in `DayMeasureLags`.
  - `sourceBandCalendarIds`: een scalaire kalender die de bron met één werkweek van meer blokken had (een vorm die
    oudere OPS-versies bij een urentaak schreven), krijgt die blokken weer. Een urentaak op die kalender maakt
    hem dan niet letterlijk.
  - `sourceBaselineHeadGuids`: OPS tot en met v2026.9.x hashte een baselinekop zonder zout. De kop krijgt dat GlobalId
    terug, en houdt zo via `baselineHeads` ook zijn id.
- Eén schrijfklok voor de hele merge (`writtenAt`), zodat de uitvoercontrole dezelfde klok kan meegeven.
- `WRITER_ENTITY_TYPES` is de gesloten lijst W van het ontwerp: de entiteittypen die deze writer schrijft. De indeling
  (`foreign/classify.ts`) volgt de eigen afsluiting langs deze typen. Een nieuw type in de writer hoort ook in
  de lijst. Behalve de typen uit `RESOURCE_TYPE_TO_IFC` staat ook `IFCCONSTRUCTIONPRODUCTRESOURCE` erin: de writer
  schrijft dat type niet, maar de lezer maakt er een resource van.
- Toetsen: `check-ifc-foreign-oude-eigen.ts` (de bronvormen en de route met een gewijzigde duur, op historische eigen
  bestanden), `check-ifc-foreign-classify.ts` (elk type in de uitvoer staat in de lijst),
  `check-ifc-foreign-hulp-identiteit.ts` en `check-ifc-foreign-preserve.ts`.
