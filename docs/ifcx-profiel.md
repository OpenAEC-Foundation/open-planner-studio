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
  `urn:openaec:planner` in de URL-namespace van RFC 4122. Werkplan en werkschema hebben zo'n veld niet: heeft hun
  GlobalId geen 128-bitsvorm, dan weigert de writer met `unsupported` en de sleutel `ifcGlobalIds.wp` of
  `ifcGlobalIds.ws`.
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

Vormen: *tekst*, *datum* (een bestaande dag, `YYYY-MM-DD`), *moment* (een bestaand moment in lokale tijd zonder zone,
`YYYY-MM-DD[THH:MM[:SS[.sss]]]` met uren 00–23 en minuten en seconden 00–59, of leeg),
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

`openaec::ops::calendar`: `id`, `globalId`, `libraryPlace` (geheel getal vanaf 0, alleen op de projectkalender: haar
plaats in de kalenderbibliotheek), `workDays` (lijst van gehele getallen 1–7, maandag is 1, verplicht),
`workStartHour`, `workEndHour`, `hoursPerDay` (getallen, verplicht), `simpleBreakStartMinute`,
`simpleBreakDurationMinutes`, `workTime` (`{ byWeekday: { "1": [{ start, end }], …, "7": [ … ] } }`, minuten vanaf
middernacht), `workingExceptions` (lijst van `{ name, startDate, endDate, bands }`), `generation`
(`{ ruleSetId, region, breakChoice, generatedFromYear, generatedToYear }`, waarmee de feestdagen zijn gemaakt).

De app houdt de projectkalender twee keer bij: als `calendar` en als entry met hetzelfde id in de kalenderbibliotheek
(`syncProjectCalendar`). IFCX schrijft haar één keer; `libraryPlace` zegt waar de entry in de bibliotheek staat, en de
lezer zet daar dezelfde kalender terug. Heeft de entry een andere inhoud dan de projectkalender, dan weigert de writer
met `inconsistent`.

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
| `maxUnits` | getal ≥ 0 | capaciteit per werkdag (1 is 100 %); ontbreekt bij 1 |
| `costPerHour` | getal ≥ 0 | tarief per uur |
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
| `unitsPerDay` | getal ≥ 0, verplicht | inzet per werkdag (1 is 100 %); bij een P6-toewijzing met restwerk het resterende tempo |
| `plannedUnitsPerDay` | getal ≥ 0 | het begrote tempo, als het afwijkt (P6) |
| `scheduleContour` | keuze `UNIFORM`, `FRONT_LOADED`, `BACK_LOADED`, `BELL`, `EARLY_PEAK`, `LATE_PEAK`, `DOUBLE_PEAK`, `TURTLE` | de verdeelcurve (`ScheduleContour` van `IfcResourceTime`); ontbreekt als de app geen curve vastlegde |
| `scheduleWork`, `actualWork`, `remainingWork` | ISO 8601-duur `PT<minuten>M` | begroot, verricht en resterend werk (`IfcResourceTime`) |
| `costAmount` | getal ≥ 0 | het begrote bedrag van een kostentoewijzing |

`openaec::ops::assignment`: `id`, `plannedWorkMinutes`, `actualWorkMinutes`, `remainingWorkMinutes` (alleen als de
minuten niet als ISO-duur te schrijven zijn: in e-notatie; werk is nooit negatief), `curveValues` (getallen van 0 tot en met 100, de precieze curve),
`workWindowStart` en `workWindowFinish` (momenten, het tijdvenster van de toewijzing).

### Baseline

`openaec::planning::baseline`:

| Veld | Vorm | Betekenis |
|---|---|---|
| `name` | tekst, verplicht | naam |
| `creationDate` | moment in ISO 8601, met of zonder tijdzone | het moment van vastleggen |
| `finish` | datum | de datum van het projecteinde in de baseline |
| `tasks` | lijst, verplicht | de rijen, in de volgorde van het document |

Een rij: `task` (UUID als tekst, het pad van de taak, ook als die taak verwijderd is; ontbreekt als de rij geen taak
noemt), `start` en `finish` (momenten of leeg), `duration` (werkdagen, getal ≥ 0, verplicht), `isMilestone` (ontbreekt bij nee),
`milestoneKind`, `sourceTaskId` en `sourceTaskCode` (de taak in het bronproject van een P6-baseline).

`openaec::ops::baseline`: `id`, `globalId`, `sourceProjectId`, `projectEnd` (een dag of moment in ISO 8601, of leeg; alleen als het meer is dan een datum),
`projectDuration` (werkdagen, ontbreekt bij 0), `active` (ja, bij de actieve baseline), `comparedSlot` (1 of 2, de
plaats in de vergelijking), `taskIds` (lijst van `{ task, id, globalId }` voor de rijen van een verwijderde taak:
`id` als het interne id afwijkt van het pad, `globalId` als de GlobalId geen 128-bitsvorm heeft).

De lezer bouwt een baseline en haar rijen op met de velden in de volgorde van het type (`id`, `sourceProjectId`,
`name`, `createdAt`, `tasks`, `projectEnd`, `projectDuration`; een rij `taskId`, `sourceTaskId`, `sourceTaskCode`,
`start`, `finish`, `duration`, `isMilestone`, `milestoneKind`), zoals de app ze maakt. De zelfcontrole let niet op
de volgorde van velden in een object, dus een baseline met een andere volgorde wordt gewoon opgeslagen.

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

**Het venster.** `start` en `endExclusive` staan er samen of geen van beide, `endExclusive` ligt na `start`, en bij
een mijlpaal is het venster precies één dag. Anders weigert de lezer met `invalid`.

**Leesregel.** De precieze tijden in `openaec::ops::task.time` gelden alleen als hun projectie gelijk is aan `start` en
`endExclusive`. De lezer vergelijkt beide met één projectie van de taak zoals ze in het bestand staat. Wijkt een van de
twee af, dan heeft een ander programma de datum veranderd en wint de gedeelde datum: een afwijkende start zet de
geplande, vroege en late start op 00:00 van die datum, een afwijkend einde het geplande, vroege en late einde op 00:00
van `endExclusive` (bij een mijlpaal op de start). De taak wordt handmatig gepland en telt mee in
`ifcxSharedDatesApplied`. Twee dingen blijven een feit: de start van een taak met een werkelijke start en het einde
van een voltooide taak. Wijkt alleen zo'n datum af, dan verandert er niets en telt de taak niet mee (knownbug 2221).
Voor een eigen bestand dat niemand veranderde, verandert openen dus geen datum.

## Volgorde onder een ouder

De taken staan in de volgorde van de takenlijst. De kinderen van een ouder komen in de lezer in de volgorde van hun
entries, behalve kinderen met een `place`: die komen op die plaats, en de andere vullen de open plaatsen in de volgorde
van hun entries; een `place` buiten de lijst komt achteraan. De writer geeft alleen een `place` aan de kinderen buiten
een langste reeks die in de takenlijst en onder de ouder in dezelfde volgorde staat (`childOrder.ts`). Een boom waarin
`childIds` en `parentId` elkaar tegenspreken, weigert de writer met `inconsistent` (knownbug 2222); een kring in de
ouders weigeren writer en lezer.

## Wat de writer weigert

`writeIfcx` schrijft niets en gooit een `IfcxWriteRefusedError`:

- met code `unsupported` en de veldnamen in `fields`, als het document iets heeft wat dit profiel nog niet draagt:
  codes, eigen velden, gebruikte taaktypes, de bibliotheek, het P6-bronarchief, de modus "datums zoals opgeslagen",
  letterlijke kalenders, een openstaande omzetting naar het minutenmodel, en elk veld van project, kalender, taak,
  relatie, resource, toewijzing, baseline of baselinerij dat geen veldgroep draagt (`unsupportedContent.ts`), en een
  werkplan of werkschema zonder GlobalId van 128 bits;
- met code `inconsistent` en de veldnamen in `fields`, als het document zichzelf tegenspreekt (`consistency.ts`): twee
  taken, relaties of bibliotheekkalenders met hetzelfde id (`task.id`, `sequence.id`, `calendar.id`), een ouder die niet
  bestaat of een kring in de ouders (`task.parentId`), kinderen die niet kloppen met de taken die de ouder noemen, ook
  een kind dat niet bestaat (`task.childIds`), een relatie van of naar een taak die niet bestaat
  (`sequence.predecessorId`, `sequence.successorId`), of een bibliotheekentry van de projectkalender met een andere
  inhoud (`resourceCalendars`). Resources, toewijzingen, baselines en verwijderde baselinetaken staan in dezelfde
  lijst van soorten (`IDENTITY_KINDS` in `identity.ts`): twee resources, toewijzingen of baselines met hetzelfde id
  (`resource.id`, `assignment.id`, `baseline.id`), een GlobalId die een ander object al heeft (`resource.globalId`,
  enzovoort), een ploeg of resourcekalender die niet bestaat (`resource.parentId`, `resource.calendarId`) en een
  toewijzing aan een taak of van een resource die niet bestaat (`assignment.taskId`, `assignment.resourceId`). Een
  baselinerij verwijst met tekst en mag een verwijderde taak noemen: die taak is daar een eigen soort
  (`baselineTask`), zonder verwijzing, maar met een GlobalId die uniek moet zijn. Twee regels in
  `CONSISTENCY_RULES` (uitgewerkt in `resourceConsistency.ts`): `baselinekeuze`, een actieve baseline die niet bestaat
  (`activeBaselineId`) of een vergelijking die de app zelf zou wissen, met een baseline die niet bestaat, de actieve
  of twee keer dezelfde (`comparedBaselineIds`); en `kosten`, wat de app voor kosten afdwingt
  (`clearCostResourceFields`, `normalizeAssignmentForResource`): een kostenresource met een tarief, kalender, ploeg,
  eenheid, stappen of een capaciteit anders dan 1, een kostentoewijzing met werkvelden, een inzet anders dan 1 of een
  ongeldig bedrag, en een bedrag op een toewijzing van een werkresource. De lezer toetst dezelfde lijst op zijn
  resultaat. STEP laat de meeste van die gevallen bij schrijven of lezen stil vallen;
- met code `self-check`, als de eigen controle na het schrijven een verschil vindt; `fields` noemt de paden van de
  eerste verschillen (zie *Zelfcontrole*).

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
- `invalid`: een kop zonder `dataVersion`, `author` of `timestamp`, een bestand zonder `imports` of `schemas`, een
  eigen schema dat afwijkt van het profiel of ontbreekt voor een attribuut dat in het bestand staat, een bekend veld
  met een ongeldige waarde of vorm (ook een dag of kloktijd die niet bestaat), een verplicht veld dat ontbreekt, een
  verwijzing naar een pad van de verkeerde soort, twee objecten van één soort met hetzelfde interne id, een kring in
  de ouders, een gedeeld venster dat niet klopt, een `libraryPlace` die niet klopt, of niet precies één werkschema.
  Voor resources en baselines ook: een kostenresource die geen `IfcConstructionMaterialResource` is, een
  kostenresource of toewijzing die de kostenregels van de app breekt (zie hierboven), een baselinerij
  die naar een object wijst dat geen taak is, een eigen id in `taskIds` voor een taak die bestaat of twee keer voor één
  pad, een verwijderde baselinetaak met het id van een taak die bestaat of met twee paden, twee actieve baselines, twee
  baselines op één vergelijkingsplaats, of de actieve baseline in de vergelijking.

De lezer eist dus in de kop `id`, `ifcxVersion`, `dataVersion`, `author` en `timestamp` (alle tekst), `imports` als
lege lijst en `schemas` als object. Elk schema in `schemas` moet een eigen attribuutnaam hebben (anders `foreign`, of
`newer-profile` voor een onbekende `openaec::ops::`-naam) en precies de definitie van het profiel.

`classifyIfcx` gebruikt dezelfde regel: `own` als de lezer het bestand leest, `foreign` bij `foreign`, `not-ifcx` bij
`not-ifcx`, en `unreadable` bij de andere codes. De lezer leest met `JSON.parse` (keuze T1); een dubbele sleutel ziet
hij niet (knownbug 2220).

## Controle van de schema's

`schemaCheck.ts` is de ene plek voor twee controles die de lezer gebruikt: elke attribuutwaarde tegen de veldtabel
(een onbekend veld, een verkeerd type, een getal dat geen geheel getal is en `null` gelden als fout), en elke definitie
in `schemas` tegen die van het profiel. `ifcxSchemaProblems` geeft dezelfde controles als lijst, voor proeven en
gereedschap. De controle met de echte validator van IFC5-development en met ifcx-explorer draait in een eigen workflow
(F3-6).

## Zelfcontrole

Na het schrijven leest `writeIfcx` zijn eigen uitvoer terug en legt het teruggelezen model rechtstreeks naast de invoer
(`selfCheck.ts`, besluit van de technisch beslisser over keuze T4). De vergelijking is algemeen: elk veld van de invoer
en van het teruggelezen model telt mee, op elk niveau, met de volgorde van lijsten. Een veld dat niemand in een
veldgroep zette, geeft dus een verschil en een weigering. Alleen de regels in `SELF_CHECK_RULES` normaliseren of laten
iets weg, elk met een reden in de lijst zelf:

| Regel | Wat | Waarom |
|---|---|---|
| `leeg-is-afwezig` | overal | een lege lijst, een leeg object, `null` en een niet gezet veld betekenen hetzelfde; de voorcontrole volgt dezelfde regel |
| `schrijfroute` | `writeMode` | de keuze van de schrijfroute is geen planningsgegeven |
| `leesmeta` | `timeModel`, `recordedFields`, `recordedTimesOrigin` en de andere meldingen van een lezer | wat een lezer bij openen meegeeft; de STEP-writer leest het niet |
| `bronidentiteit` | `ifcSource` | de bron van een STEP-document met een vreemd deel; de codec schrijft alleen de planning |
| `archiefopslag` | `xerSourceArchiveStorage` | heeft zonder bronarchief geen effect |
| `nee-is-afwezig` | `minuteModelPending`, `importPristine` | onwaar betekent hetzelfde als niet gezet; waar weigert de voorcontrole |
| `globalids` | `ifcGlobalIds` | de invoer telt met de GlobalIds die de STEP-writer zou geven, zonder die van verdwenen objecten |
| `gebruikte-taaktypes` | `customTaskTypes` | alleen gebruikte taaktypes worden opgeslagen, zoals in STEP |
| `geen-vergelijking` | `comparedBaselineIds` | `[null, null]` betekent: geen vergelijking |

Elke regel heeft in `check-ifcx-kern.ts` een geval dat zonder die regel een verschil geeft, en de proef eist dat de
lijst en die gevallen dezelfde regels noemen. De STEP-pariteit (`planningCanon` gelijk en dezelfde STEP-uitvoer) staat
alleen nog in de proeven. Waar de controle draait (Ctrl+S en Opslaan als, niet Automatisch opslaan, in de Worker), kiest
de app (F3-4).

## Uitbreiden (F3-2 en F3-3)

Een nieuw gebied krijgt een eigen bestand in `src/services/ifc/ifcx/fields/` met zijn velden (sleutel, vorm, schrijven
en lezen samen) en de domeinvelden die het draagt (`carries`), en één regel in de lijst van groepen in
`fieldGroups.ts`. Het schema in het bestand, de controle van de lezer, de voorcontrole van de writer en de zelfcontrole
volgen daar vanzelf uit; voor de zelfcontrole hoeft een nieuwe groep niets te doen. Heeft een veld een andere maar
gelijkwaardige vorm na het teruglezen, of is het afgeleide metadata, dan komt er een regel in `SELF_CHECK_RULES` met een
reden, en een geval in `SELF_CHECK_WITNESSES` in de proef. Een nieuw soort object vraagt ook een node in de writer en
in `NODE_SHAPES` van `ifcxReader.ts`; resources, toewijzingen en baselines hebben hun eigen writer en lezer
(`ifcxResourceWriter.ts`, `ifcxResourceReader.ts`). De proeven zijn `tests/planning/check-ifcx-kern.ts` en
`check-ifcx-resources.ts`; de voorbeeldbestanden in
`tests/fixtures/ifcx/eigen/` maak je opnieuw met `OPS_IFCX_FIXTURES_WRITE=1 bash tests/planning/run.sh check-ifcx-kern.ts`.
