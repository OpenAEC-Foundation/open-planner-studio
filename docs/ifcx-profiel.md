# Het IFCX-profiel van Open Planner Studio

Dit document beschrijft hoe Open Planner Studio een planning in IFCX schrijft en leest: de kop, de paden, de
attributen met hun velden, de vorm en betekenis van elk veld, de projectie van datums, de betekenis van lag en de
versieregel. Het ontwerp staat in `docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md`
(§5 en §6); de code staat in `src/services/ifc/ifcx/`. De velden, de betekenis van lag en de proeven zijn eigen
keuzes van deze repo (ontwerp §11, besluit 12).

## Status: concept

Het profiel is een **concept** tot de featureflag `ifcx` eraf gaat. Tot dan kan een attribuutnaam nog van schema
veranderen; vanaf het moment dat de flag eraf gaat of een ander programma het profiel gebruikt, krijgt elke wijziging
een nieuwe naam (ontwerp §5.3). Wat een planner met de flag aan in die tijd als IFCX opslaat, kan een latere versie
van de app weigeren.

Deze versie (fase 3, F3-1 en F3-2) draagt project, werkplan, werkschema, kalenders, taken, relaties, resources,
toewijzingen en baselines. De overige velden komen in F3-3. Wat het profiel nog niet draagt, weigert de writer
(zie *Wat de writer weigert*).

## Het bestand

```json
{
  "header": { "id": "urn:openaec:planner:<project-uuid>", "ifcxVersion": "ifcx_alpha", "dataVersion": "1.0.0",
              "author": "…", "timestamp": "2026-11-24T08:00:00.000Z" },
  "imports": [],
  "schemas": { "openaec::planning::activity": { "value": { "dataType": "Object", "objectRestrictions": { … } } }, … },
  "data": [ { "path": "<uuid>", "attributes": { "openaec::planning::activity": { … }, "openaec::ops::task": { … } } }, … ]
}
```

- **Kop**: `id` is `urn:openaec:planner:` met de UUID van de GlobalId van het project. `author` is de auteur van het
  project, of `Open Planner Studio` als die leeg is. `timestamp` is het moment van schrijven (ISO 8601, UTC).
- **`imports`** is altijd leeg. De app schrijft geen `bsi::ifc::class`, geen `children` en geen `inherits`.
- **`schemas`** bevat voor elk attribuut dat in het bestand voorkomt de definitie. Die komt uit dezelfde tabel als het
  schrijven en lezen (`fieldGroups.ts`, `ownAttributes.ts`): een veld heeft één beschrijving met schema, controle,
  schrijven en lezen samen.
- **`data`**: één entry per object, in deze volgorde: werkplan, werkschema, projectkalender, de andere kalenders,
  taken (in de volgorde van de takenlijst), relaties, resources, toewijzingen, baselines. Elke lijst houdt de volgorde
  van het document. Elke entry staat op één regel.

## Paden en identiteit

- Het pad van een object is de UUID van zijn GlobalId: dezelfde 128 bits, in kleine letters met streepjes en zonder
  voorloop-`/`. De GlobalId is die van de STEP-writer: een bewaarde GlobalId (`ifcGlobalIds`), anders `ifcGuid128`
  van `ifcObjectSeed` (`stepGlobalIds.ts`, met dezelfde regel bij een botsing en in dezelfde volgorde als
  `ifcWriter.ts`: project, projectkalender, werkplan, werkschema, baselines, taken, relaties, resources, de andere
  kalenders, de taken in baselines). Zo houdt IFC → IFCX → IFC dezelfde GlobalIds. Een baseline heeft de GlobalId
  van haar werkschema in STEP (sleutel `baseline_ws_<id>`, afgeleid van `<project-id>/baseline_ws_<id>`). Een
  toewijzing heeft in STEP geen eigen GlobalId; zij krijgt er een uit `<project-id>/ifcx_assignment_<id>`, als
  laatste uitgegeven. De lezer vult `ifcGlobalIds` terug voor project, kalenders, taken, relaties en resources, en
  voor werkplan, werkschema, baselines en verwijderde baselinetaken alleen als hun GlobalId afwijkt van wat de writer
  zou afleiden.
- Een GlobalId zonder geldige 128-bitsvorm (22 tekens, eerste teken `0`–`3`; de oude `ifcGuid` geeft dat niet altijd)
  krijgt als pad een UUID v5 van de GlobalId, en de GlobalId zelf staat in het veld `globalId` van het
  `openaec::ops::`-attribuut van dat object. De namespace is `fd4e93a2-de83-56ee-929c-defaa450b626`, de UUID v5 van
  `urn:openaec:planner` in de URL-namespace van RFC 4122.
- Het interne id van een object staat in het veld `id` van zijn `openaec::ops::`-attribuut als het afwijkt van het
  pad. Voor de projectkalender is de afleiding `cal-default`, voor het project de UUID uit de kop.
- Verwijzingen tussen objecten (`parent`, `calendar`, `relatingProcess`, `relatedProcess`, `workplan`, `crew`,
  `relatedResource`) zijn paden naar een object dat bestaat. Een baseline verwijst met gewone tekst naar haar taken
  (`task` in een rij), ook naar een taak die verwijderd is (ontwerp §5.2).

## Eén regel voor `openaec::ops::`

Een veld in `openaec::ops::` staat er alleen als het afwijkt van wat de lezer zonder dat veld zou afleiden. Lezer en
writer gebruiken daarvoor dezelfde afleiding (ontwerp §5.2):

| Veld | Afleiding als het ontbreekt |
|---|---|
| `id` (alle objecten), `projectId` | het pad; projectkalender `cal-default`; project de UUID uit de kop |
| `openaec::ops::task.status` | `COMPLETED` met een werkelijk einde, `STARTED` met een werkelijke start of voortgang boven 0, anders `NOT_STARTED` |
| `openaec::ops::task.place` | de volgorde van de entries (zie *Volgorde onder een ouder*) |
| `openaec::ops::sequence.lagDays`, `lagMinutes`, `lagPercent` | uit `timeLag` of `timeLagRatio` (zie *Lag*) |
| `openaec::ops::document.startDate`, `endDate` | de datum in `start` en `finish` van het werkplan |
| `openaec::ops::document.author` | `author` uit de kop |
| `openaec::ops::document.calendarId` | het id van de projectkalender |
| `openaec::ops::task.resourceIds` | de resources van de toewijzingen van de taak, in volgorde, zonder dubbele (`resourceIdsByTask`) |
| `openaec::ops::resource.type` | het soort uit `subtype`; alleen een kostenresource heeft hier `COST` |
| `openaec::ops::assignment.plannedWorkMinutes`, `actualWorkMinutes`, `remainingWorkMinutes` | de minuten in `scheduleWork`, `actualWork`, `remainingWork` |
| `openaec::ops::baseline.projectEnd` | de datum in `finish` van de baseline |
| `openaec::ops::baseline.taskIds` | het id van de taak op het pad van een rij, of het pad zelf als die taak er niet meer is |
| `openaec::ops::baseline.active`, `comparedSlot` | geen actieve baseline en geen vergelijking |

## Attributen

Vormen: *tekst*, *datum* (`YYYY-MM-DD`), *moment* (lokale tijd zonder zone, `YYYY-MM-DD[THH:MM[:SS[.sss]]]`, of leeg),
*getal*, *geheel getal*, *ja/nee*, *keuze*, *pad*. Een veld zonder "verplicht" mag ontbreken. Een leeg tekstveld dat in
het domein verplicht is (zoals een lege omschrijving) schrijft de app niet; de lezer maakt er weer een lege tekst van.

### Werkplan

`openaec::planning::workplan`:

| Veld | Vorm | Betekenis |
|---|---|---|
| `name` | tekst, verplicht | naam van het project |
| `description` | tekst | omschrijving |
| `start` | datum | de datum van de projectstart |
| `finish` | datum | de datum van het projecteinde |
| `calendar` | pad | de projectkalender; ontbreekt het, dan de eerste kalender in het bestand |

`openaec::ops::document`: `formatVersion` (tekst `MAJOR.MINOR.PATCH`, verplicht, nu `1.0.0`), `projectId`, `globalId`,
`startDate` en `endDate` (de projectdatums zoals ingevoerd, als ze meer zijn dan een datum), `calendarId`,
`createdAt`, `modifiedAt`, `author`, `company`, `ifcSchema` (keuze `IFC4X3_ADD2`, `IFC4X3`, `IFC4`: het schema voor een
opslag als STEP), `ifcSchemaUnconfirmed`, `wbsAutoNumber` (ja/nee), `defaultTaskDurationUnit` (keuze `days`, `hours`),
`statusDate`. Alle tekst tenzij anders genoemd.

### Werkschema

`openaec::planning::schedule`: `workplan` (pad, verplicht): het werkplan waar het schema bij hoort. Er is precies één.

### Kalender

`openaec::planning::calendar`:

| Veld | Vorm | Betekenis |
|---|---|---|
| `name` | tekst, verplicht | naam |
| `description` | tekst | omschrijving |
| `predefinedType` | keuze `FIRSTSHIFT`, `SECONDSHIFT`, `THIRDSHIFT`, `USERDEFINED` | de ploeg (`IfcWorkCalendarTypeEnum`) |
| `exceptionTimes` | lijst van `{ name, start, end }`, datums | vrije dagen; `end` is de laatste vrije dag en ontbreekt als de app geen einddatum heeft (één dag) |

`openaec::ops::calendar`: `id`, `globalId`, `workDays` (lijst van gehele getallen 1–7, maandag is 1, verplicht),
`workStartHour`, `workEndHour`, `hoursPerDay` (getallen, verplicht), `simpleBreakStartMinute`,
`simpleBreakDurationMinutes`, `workTime` (`{ byWeekday: { "1": [{ start, end }], …, "7": [ … ] } }`, minuten vanaf
middernacht), `workingExceptions` (lijst van `{ name, startDate, endDate, bands }`), `generation`
(`{ ruleSetId, region, breakChoice, generatedFromYear, generatedToYear }`, waarmee de feestdagen zijn gemaakt).

### Taak

`openaec::planning::activity`:

| Veld | Vorm | Betekenis |
|---|---|---|
| `name` | tekst, verplicht | naam |
| `description` | tekst | omschrijving |
| `identification` | tekst | WBS-code |
| `parent` | pad | de bovenliggende taak; ontbreekt bij een taak op het hoogste niveau |
| `predefinedType` | keuze (`IfcTaskTypeEnum` zonder `NOTDEFINED`), verplicht | soort werk |
| `isMilestone` | ja/nee | mijlpaal; ontbreekt bij nee |
| `priority` | geheel getal | prioriteit; ontbreekt bij 500 |
| `calendar` | pad | de eigen kalender van de taak |
| `durationType` | keuze `WORKTIME`, `ELAPSEDTIME` | `IfcTaskDurationEnum`; ontbreekt bij `WORKTIME` |
| `completion` | getal 0–1 | voortgang; ontbreekt bij 0 |
| `start` | datum | projectie van de getoonde start |
| `endExclusive` | datum | projectie van het getoonde einde, de eerste dag ná de taak |

`openaec::ops::task`: `id`, `globalId`, `place` (geheel getal vanaf 0), `time` (verplicht, hieronder), `status`
(keuze `NOT_STARTED`, `STARTED`, `COMPLETED`), `milestoneKind` (keuze `START`, `FINISH`), `mandatory`, `isSummary`,
`manuallyScheduled` (ja/nee), `calendarId` (alleen als de eigen kalender niet als pad te schrijven is),
`resourceIds` (lijst van ids, alleen als hij afwijkt van de toewijzingen), `timephasedContours` (lijst van
`{ resourceUid, resourceId, periods: [{ afterMinutes, minutes, workMinutes, kind }] }`, de ruwe werkverdeling per
toewijzing; `resourceUid` ontbreekt als het domein `null` heeft, `kind` is `actual` of `remaining`; `resourceId` is
tekst, want de contour mag een resource noemen die er niet meer is).

`time` draagt de precieze tijden zoals de app ze heeft: `durationUnit` (keuze `days`, `hours`), `scheduleDuration`
(werkdagen), `durationMinutes`, de momenten `scheduleStart`, `scheduleFinish`, `resume`, `stop`, `earlyStart`,
`earlyFinish`, `lateStart`, `lateFinish`, `actualStart`, `actualFinish`, de spelingen `freeFloat` en `totalFloat`
(werkdagen) met `freeFloatMinutes` en `totalFloatMinutes`, `isCritical`, `interferingFloat`, `isNearCritical`,
`floatPath`, `actualDuration`, `remainingTime` (werkdagen) en `remainingMinutes`. Verplicht zijn `durationUnit`,
`scheduleDuration`, `scheduleStart`, `scheduleFinish`, de vroege en late momenten, `freeFloat`, `totalFloat` en
`isCritical`.

### Relatie

`openaec::planning::sequence`:

| Veld | Vorm | Betekenis |
|---|---|---|
| `relatingProcess` | pad, verplicht | de voorganger |
| `relatedProcess` | pad, verplicht | de opvolger |
| `sequenceType` | keuze `FINISH_START`, `START_START`, `FINISH_FINISH`, `START_FINISH`, verplicht | `IfcSequenceEnum` |
| `timeLag` | ISO 8601-duur `P<dagen>D` of `PT<minuten>M`, met een minteken voor een lead | de lag |
| `timeLagRatio` | getal | de lag als deel van de duur van de voorganger (0,5 is 50 %) |
| `lagDurationType` | keuze `WORKTIME`, `ELAPSEDTIME` | of de lag in werktijd of kalendertijd telt; ontbreekt als de app geen eenheid vastlegde |

`openaec::ops::sequence`: `id`, `globalId`, `lagDays`, `lagMinutes`, `lagPercent`.

### Resource

`openaec::planning::resource`:

| Veld | Vorm | Betekenis |
|---|---|---|
| `name` | tekst, verplicht | naam |
| `description` | tekst | omschrijving |
| `subtype` | keuze `IfcLaborResource`, `IfcConstructionEquipmentResource`, `IfcConstructionMaterialResource`, `IfcSubContractResource`, `IfcCrewResource`, verplicht | de IFC-klasse; een kostenresource is `IfcConstructionMaterialResource`, zoals in STEP |
| `crew` | pad | de ploeg (een andere resource) waar de resource bij hoort |
| `calendar` | pad | de kalender van de resource; ontbreekt als zij de projectkalender volgt zonder eigen keuze |
| `maxUnits` | getal | capaciteit per werkdag (1 is 100 %); ontbreekt bij 1 |
| `costPerHour` | getal | tarief per uur |
| `unitOfMeasure` | tekst | eenheid van materiaal |

`openaec::ops::resource`: `id`, `globalId`, `type` (keuze `COST`, alleen bij een kostenresource), `availability` (het
oude veld voor capaciteit), `availabilitySteps` (lijst van `{ from, maxUnits }`, `from` een datum, in de volgorde van
het document), `color`, `libraryOrigin` (`{ companyId, libraryItemId, poolVersion, syncedHash }`).

### Toewijzing

`openaec::planning::assignment`:

| Veld | Vorm | Betekenis |
|---|---|---|
| `relatingProcess` | pad, verplicht | de taak |
| `relatedResource` | pad, verplicht | de resource |
| `unitsPerDay` | getal, verplicht | inzet per werkdag (1 is 100 %); bij een P6-toewijzing met restwerk het resterende tempo |
| `plannedUnitsPerDay` | getal | het begrote tempo, als het afwijkt (P6) |
| `scheduleContour` | keuze `UNIFORM`, `FRONT_LOADED`, `BACK_LOADED`, `BELL`, `EARLY_PEAK`, `LATE_PEAK`, `DOUBLE_PEAK`, `TURTLE` | de verdeelcurve (`ScheduleContour` van `IfcResourceTime`); ontbreekt als de app geen curve vastlegde |
| `scheduleWork`, `actualWork`, `remainingWork` | ISO 8601-duur `PT<minuten>M` | begroot, verricht en resterend werk (`IfcResourceTime`) |
| `costAmount` | getal | het begrote bedrag van een kostentoewijzing |

`openaec::ops::assignment`: `id`, `plannedWorkMinutes`, `actualWorkMinutes`, `remainingWorkMinutes` (alleen als de
minuten niet als ISO-duur te schrijven zijn: negatief of in e-notatie), `curveValues` (21 getallen, de precieze curve),
`workWindowStart` en `workWindowFinish` (momenten, het tijdvenster van de toewijzing).

### Baseline

`openaec::planning::baseline`:

| Veld | Vorm | Betekenis |
|---|---|---|
| `name` | tekst, verplicht | naam |
| `creationDate` | tekst | het moment van vastleggen |
| `finish` | datum | de datum van het projecteinde in de baseline |
| `tasks` | lijst, verplicht | de rijen, in de volgorde van het document |

Een rij: `task` (UUID als tekst, het pad van de taak, ook als die taak verwijderd is; ontbreekt als de rij geen taak
noemt), `start` en `finish` (momenten of leeg), `duration` (werkdagen, verplicht), `isMilestone` (ontbreekt bij nee),
`milestoneKind`, `sourceTaskId` en `sourceTaskCode` (de taak in het bronproject van een P6-baseline).

`openaec::ops::baseline`: `id`, `globalId`, `sourceProjectId`, `projectEnd` (als het meer is dan een datum),
`projectDuration` (werkdagen, ontbreekt bij 0), `active` (ja, bij de actieve baseline), `comparedSlot` (1 of 2, de
plaats in de vergelijking), `taskIds` (lijst van `{ task, id, globalId }` voor de rijen van een verwijderde taak:
`id` als het interne id afwijkt van het pad, `globalId` als de GlobalId geen 128-bitsvorm heeft).

De lezer bouwt een baseline en haar rijen op met de velden in de volgorde van het type (`id`, `sourceProjectId`,
`name`, `createdAt`, `tasks`, `projectEnd`, `projectDuration`; een rij `taskId`, `sourceTaskId`, `sourceTaskCode`,
`start`, `finish`, `duration`, `isMilestone`, `milestoneKind`), zoals de app ze maakt. Grens: knownbug 2225.

## Lag

Een lag schuift de opvolger op ten opzichte van de voorganger; negatief is een lead. Er is er één van drie:

- **Procent** (`timeLagRatio`): een deel van de duur van de voorganger, bij elke berekening opnieuw uit de actuele duur
  bepaald en afgerond op hele dagen (dagtaken) of hele minuten (uurtaken), zoals MS Project. `lagPercent` in
  `openaec::ops::` staat er alleen als `timeLagRatio × 100` het getal niet precies teruggeeft.
- **Minuten** (`timeLag` = `PT<n>M`): een vaste lag in minuten. Bij `WORKTIME` zijn het werkminuten in de lagkalender
  van het project (projectoptie `lagCalendar`), bij `ELAPSEDTIME` gewone minuten.
- **Dagen** (`timeLag` = `P<n>D`): een vaste lag in werkdagen van de lagkalender, met een breuk als dat zo is
  ingevoerd. Bij `ELAPSEDTIME` zijn het kalenderdagen van 24 uur.

Is het getal niet als ISO-duur te schrijven (een getal in e-notatie), dan ontbreekt `timeLag` en staat de waarde in
`openaec::ops::sequence`.

## Datums

De gedeelde datums zijn een projectie van de precieze tijden (ontwerp §5.3), met de getoonde start en het getoonde
einde van de taak (`shownStart` en `shownFinish` in `src/utils/taskDates.ts`):

- `start` is de datum van het startmoment;
- `endExclusive` is de datum van het eindmoment als dat precies 00:00 is, anders die datum plus één dag
  (1 juni 07:00–16:00 geeft 1 juni tot 2 juni; een einde op 3 juni 00:00 geeft 3 juni);
- een mijlpaal, of een taak waarvan het einde niet na de start ligt, krijgt `endExclusive` = startdatum plus één dag.

**Leesregel.** De precieze tijden in `openaec::ops::task.time` gelden alleen als hun projectie gelijk is aan `start` en
`endExclusive`. Wijkt een van de twee af, dan heeft een ander programma de datum veranderd en wint de gedeelde datum:
de lezer zet de geplande, vroege en late start op 00:00 van de gedeelde start als die afwijkt, en het geplande, vroege
en late einde op 00:00 van `endExclusive` als dat afwijkt (bij een mijlpaal op de start). Hij maakt de taak handmatig
gepland en telt haar in `ifcxSharedDatesApplied`. Voor een eigen bestand dat niemand veranderde, verandert openen
dus geen datum. Grens: knownbug 2221.

## Volgorde onder een ouder

De taken staan in de volgorde van de takenlijst. De kinderen van een ouder komen in de lezer in de volgorde van hun
entries, behalve kinderen met een `place`: die komen op die plaats, en de andere vullen de open plaatsen in de volgorde
van hun entries; een `place` buiten de lijst komt achteraan. De writer geeft alleen een `place` aan de kinderen buiten
een langste reeks die in de takenlijst en onder de ouder in dezelfde volgorde staat (`childOrder.ts`). Een boom waarin
`childIds` en `parentId` elkaar tegenspreken, gaat zo niet over: knownbug 2222.

## Wat de writer weigert

`writeIfcx` schrijft niets en gooit een `IfcxWriteRefusedError`:

- met code `unsupported` en de veldnamen in `fields`, als het document iets heeft wat dit profiel nog niet draagt:
  codes, eigen velden, gebruikte taaktypes, de bibliotheek, het P6-bronarchief, de modus "datums zoals opgeslagen",
  letterlijke kalenders, een openstaande omzetting naar het minutenmodel, en elk veld van project, kalender, taak,
  relatie, resource, toewijzing, baseline of baselinerij dat geen veldgroep draagt (`unsupportedContent.ts`). Ook een
  taak onder een ouder die niet bestaat, een relatie naar een taak die niet bestaat, een toewijzing aan een taak of van
  een resource die niet bestaat, een ploeg of resourcekalender die niet bestaat, twee resources, toewijzingen of
  baselines met hetzelfde id, een actieve baseline die niet bestaat, en een vergelijking die de app zelf zou wissen
  (een baseline die niet bestaat, de actieve, of twee keer dezelfde). STEP laat de meeste van die gevallen stil
  vallen; IFCX weigert ze vooraf (`ifcxResourceWriter.ts`);
- met code `self-check`, als de herlezing van de uitvoer niet lukt of een andere `planningCanon` geeft
  (`src/services/ifc/foreign/planningCanon.ts`): de eigen controle na elke opslag (keuze T4).

## Wat de lezer weigert

`readIfcx` gooit een `IfcxReadError` met een vaste `code`, en waar het kan `place` met pad, attribuut en veld:

- `not-ifcx`: geen UTF-8, geen JSON, of geen IFCX-kop met `ifcxVersion` en `data`;
- `version`: een andere `ifcxVersion` dan `ifcx_alpha`;
- `newer-profile`: een hogere hoofdversie in `formatVersion`, een onbekend `openaec::ops::`-attribuut, of een onbekend
  veld in een `openaec::ops::`-attribuut;
- `foreign`: niet helemaal van Open Planner Studio (keuze T2): een kop zonder `urn:openaec:planner:`, een onbekend
  kop- of entryveld, `imports`, `children` of `inherits`, een attribuut van een ander, een onbekend veld in een
  `openaec::planning::`-attribuut, een pad dat geen UUID is, twee bijdragen van één attribuut op één pad, een pad
  waarvan de attributen samen geen planningsobject vormen, of niet precies één eigen werkplan;
- `invalid`: een bekend veld met een ongeldige waarde of vorm, een verplicht veld dat ontbreekt, een verwijzing naar
  een pad van de verkeerde soort, niet precies één werkschema, twee resources, toewijzingen of baselines met hetzelfde
  id, een kostenresource die geen `IfcConstructionMaterialResource` is, een baselinerij die naar een object wijst dat
  geen taak is, een eigen id in `taskIds` voor een taak die bestaat, een verwijderde baselinetaak met het id van een
  taak die bestaat, twee actieve baselines, twee baselines op één vergelijkingsplaats, of de actieve baseline in de
  vergelijking.

`classifyIfcx` gebruikt dezelfde regel: `own` als de lezer het bestand leest, `foreign` bij `foreign`, `not-ifcx` bij
`not-ifcx`, en `unreadable` bij de andere codes. De lezer leest met `JSON.parse` (keuze T1); een dubbele sleutel ziet
hij niet (knownbug 2220).

## Controle van de schema's

`ifcxSchemaProblems` (`schemaCheck.ts`) toetst een bestand tegen de schema's die erin staan, op dezelfde manier als de
validator van IFC5-development maar strenger: een onbekend veld, een getal dat geen geheel getal is en `null` gelden als
fout, en de eigen schema's moeten gelijk zijn aan die van het profiel. De controle met de echte validator van
IFC5-development en met ifcx-explorer draait in een eigen workflow (F3-6).

## Uitbreiden (F3-2 en F3-3)

Een nieuw gebied krijgt een eigen bestand in `src/services/ifc/ifcx/fields/` met zijn velden (sleutel, vorm, schrijven
en lezen samen) en de domeinvelden die het draagt (`carries`), en één regel in de lijst van groepen in
`fieldGroups.ts`. Het schema in het bestand, de controle van de lezer en de voorcontrole van de writer volgen daar
vanzelf uit. Een nieuw soort object vraagt ook een node in de writer en in `NODE_SHAPES` van `ifcxReader.ts`; resources,
toewijzingen en baselines hebben hun eigen writer en lezer (`ifcxResourceWriter.ts`, `ifcxResourceReader.ts`). De proeven zijn `tests/planning/check-ifcx-kern.ts` en `check-ifcx-resources.ts`; de voorbeeldbestanden in
`tests/fixtures/ifcx/eigen/` maak je opnieuw met `OPS_IFCX_FIXTURES_WRITE=1 bash tests/planning/run.sh check-ifcx-kern.ts`.
