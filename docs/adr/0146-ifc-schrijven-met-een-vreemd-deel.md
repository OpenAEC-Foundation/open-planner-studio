# De IFC-writer met een vreemd deel: vaste ids en de vorm van de bron

Bij een bestand met een gebouwmodel of andere vreemde gegevens (#804, ontwerp
`docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md`) schrijft de writer alleen de
planningsstukken opnieuw; `foreign/mergeWriter.ts` zet ze tussen de bronstukken. De writer krijgt daarvoor een plan
(`WriterMergeIds`) en levert dan alleen zijn entiteitregels (`writeIfcMergeLines`), zonder kop en staart. Zonder plan
nummert hij vanaf `#1` en is de uitvoer gelijk aan die zonder deze route. Twee besluiten dragen dit. De domeinstukken
van de bron houden hun `#id`, zodat verwijzingen van het model ernaar blijven kloppen. En een waarde die OPS zelf in
een oudere vorm schreef en die de planner niet wijzigde, blijft in die vorm staan (besluit Trias); alleen als de
planner het veld zelf wijzigde, geldt de huidige writer. Anders weigerde de merge eigen bestanden van oudere
OPS-versies, of veranderde hij waarden die niemand aanraakte.

## Gevolgen

- `keep` geeft per sleutel van de writer (`task_<id>`, `_calendar`, …) het bron-`#id`. Nieuwe stukken krijgen ids
  vanaf `firstId` (het hoogste id van de niet-P-stukken plus één), en slaan de ids in `reserved` over.
- Een eigen `.BASELINE.`-kop houdt zijn id via zijn GlobalId (`baselineHeads`), omdat de lezer die koppen geen
  domein-id geeft. Zonder dat schoof de reeks bij elke volgende opslag.
- Is het `IfcProject` van de bron niet P, dan schrijft de writer geen eigen project, eenheden en context; `_project`
  wijst naar het bron-project (`projectSourceId`), en de projectgegevens staan in `OPS_ProjectSettings` (ADR 0142).
- De bronvormen, elk alleen voor een veld dat de planner niet wijzigde:
  - `sourceTaskTimes` (berekend in `sourceTaskTimes` van `mergeWriter.ts`), per slot van `IfcTaskTime`: de duur en de
    rest elk apart als de bron daar een dagduur `P…D` had, ook een hele; de werkelijke duur en de vrije en totale
    speling elk apart alleen als die dagduur een breuk had (`P0Y0M0.5D`, of zeventien cijfers zoals
    `P0Y0M2.3333333333333335D`). Een urentaak doet voor duur, rest en werkelijke duur niet mee. De writer schrijft zo'n
    slot exact (`ifcDurationExact`) en zonder record. Een dagtaak met de duur in de bronvorm maakt haar kalender
    daardoor niet letterlijk (`minuteModelWriteView`).
  - `sourceDayLagIds`: een lag die de bron als gebroken dag in de oude vorm had (`IFCDURATION('P0.30000000000000004D')`)
    schrijft de writer exact zo, zonder record in `DayMeasureLags`.
  - `sourceBandCalendarIds`: een kalender die de bron als scalaire kalender met uitgeschreven blokken had, zonder
    `LiteralTimes` (de vorm van OPS vóór het minutenmodel bij een urentaak), krijgt die blokken weer, zonder dat de
    kalender letterlijk wordt.
  - `sourceBaselineHeadGuids`: OPS tot en met v2026.9.x hashte een baselinekop zonder zout. De kop krijgt dat GlobalId
    terug, en houdt zo via `baselineHeads` ook zijn id.
- Eén schrijfklok voor de hele merge (`writtenAt`), zodat de uitvoercontrole dezelfde klok kan meegeven.
- `WRITER_ENTITY_TYPES` is de gesloten lijst W van het ontwerp: de entiteittypen die deze writer schrijft. De indeling
  (`foreign/classify.ts`) volgt de eigen afsluiting alleen langs deze typen. Een nieuw type in de writer hoort ook in
  de lijst. Behalve de typen uit `RESOURCE_TYPE_TO_IFC` staat ook `IFCCONSTRUCTIONPRODUCTRESOURCE` erin: de writer
  schrijft dat type niet, maar de lezer maakt er een resource van.
- Toetsen: `check-ifc-foreign-classify.ts` (elk type in de uitvoer staat in de lijst), `check-ifc-foreign-oude-eigen.ts`
  (de bronvormen), `check-ifc-foreign-hulp-identiteit.ts` en `check-ifc-foreign-preserve.ts`.
