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

- **Kop**: `id` is `urn:openaec:planner:` met de UUID van de GlobalId van het project. `ifcxVersion` is `ifcx_alpha`,
  `dataVersion` heeft de vorm `MAJOR.MINOR.PATCH`. `author` is de auteur van het project, of `Open Planner Studio` als
  die leeg is. `timestamp` is het moment van schrijven (ISO 8601, UTC). De kop heeft een waardedomein zoals elk
  attribuut (`HEADER_VALUE` in `ownAttributes.ts`); writer en lezer toetsen hem met dezelfde functie.
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
  van `ifcObjectSeed` (`defaultGlobalId` in `stepGlobalIds.ts`). Zo houdt IFC → IFCX → IFC dezelfde GlobalIds. Delen
  twee objecten een GlobalId, dan geeft de STEP-writer het tweede een nieuwe; de IFCX-writer weigert (zie hieronder).
  Een baseline heeft de GlobalId van haar werkschema in STEP (sleutel `baseline_ws_<id>`, afgeleid van
  `<project-id>/baseline_ws_<id>`). Een toewijzing heeft in STEP geen eigen GlobalId; zij krijgt er een met de
  sleutel `ifcx_assignment_<id>`, afgeleid van `<project-id>/ifcx_assignment_<id>`. Een verwijderde taak in een
  baseline houdt de GlobalId die STEP haar in `TaskGuids` zou geven (sleutel `task:<id>`). De lezer vult
  `ifcGlobalIds` terug voor elk object: project, werkplan, werkschema, kalenders, taken, relaties, resources,
  toewijzingen, baselines en verwijderde baselinetaken.
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

**Identiteit is één regel voor alle soorten** (`IDENTITY_KINDS` in `identity.ts`, een gewone lijst met de soorten die
er nu zijn: project, werkplan, werkschema, kalender, taak, relatie, resource, toewijzing, baseline en verwijderde
baselinetaak). Voor elke soort geldt:

- het interne id is uniek binnen de soort;
- de GlobalId is uniek over alle objecten samen, project, werkplan en werkschema inbegrepen;
- een verwijzing naar een ander object (`parentId`, `childIds`, `predecessorId`, `successorId`, de ploeg en kalender
  van een resource, de taak en resource van een toewijzing) heeft een doel. Een baselinerij verwijst met tekst en mag
  een verwijderde taak noemen; zo'n taak is een eigen soort (`baselineTask`) zonder verwijzing, maar haar GlobalId telt
  mee voor de uniekheid. De lezer onderscheidt haar zo: het pad van de rij is geen object in het bestand (wijst het
  naar een object dat geen taak is, dan weigert hij);
- een GlobalId zonder 128-bitsvorm hoort bij precies één pad: de UUID v5 hierboven. Een pad dat daar niet bij hoort,
  weigert de lezer met `invalid` en veld `globalId`.

De writer toetst dit op zijn invoer en weigert een botsing met `inconsistent` en het veld `<soort>.id`,
`<soort>.globalId` of `<soort>.<verwijzing>`; hij rekent nooit een vervangende GlobalId uit. De lezer toetst hetzelfde
op het model dat hij las en weigert met `invalid` en hetzelfde veld.

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

Elk veld heeft in de veldtabel (`fieldTable.ts` en `fields/`) een volledig waardedomein, en lezer en writer toetsen
elke waarde met dezelfde functie (`checkValue`). Een tekst- of datumveld zonder vorm is een compileerfout. De vormen:

| Vorm | Domein | Velden |
|---|---|---|
| *tekst* | elke tekst | namen, omschrijvingen, `author`, `company`, `region` |
| *niet-lege tekst* | tekst van minstens één teken | `id`, `projectId`, `calendarId`, `ruleSetId` |
| *datum* | een bestaande dag `YYYY-MM-DD` | `start`, `finish`, `endExclusive`, vrije en werkdagen van een kalender |
| *moment* | een bestaand moment in lokale tijd zonder zone, `YYYY-MM-DD[THH:MM[:SS[.sss]]]`, uren 00–23, minuten en seconden 00–59, of leeg | de momenten in `openaec::ops::task.time` |
| *projectmoment* | een bestaande dag of een bestaand moment in ISO 8601, met of zonder zone, tot 9 decimalen, of leeg | `startDate`, `endDate`, `createdAt`, `modifiedAt`, `statusDate` |
| *ISO-moment* | als *projectmoment*, niet leeg | `timestamp` in de kop |
| *GlobalId zonder 128-bitsvorm* | niet leeg, en geen geldige 22-tekens-GlobalId | `globalId` |
| *versie* | `MAJOR.MINOR.PATCH` | `formatVersion`, `dataVersion` |
| *lagduur* | `P<dagen>D` of `PT<minuten>M`, met een minteken voor een lead | `timeLag` |
| *getal* | een eindig getal; `completion` alleen 0–1 | |
| *geheel getal* | een veilig geheel getal; `place` en `libraryPlace` vanaf 0, `workDays` 1–7 | |
| *ja/nee*, *keuze*, *pad* | `true`/`false`; een van de genoemde waarden; een UUID | |

Een veld zonder "verplicht" mag ontbreken; `null` is nooit een geldige waarde. Een leeg tekstveld dat in het domein
verplicht is (zoals een lege omschrijving) schrijft de app niet; de lezer maakt er weer een lege tekst van.

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
  (1 juni 07:00–16:00 geeft 1 juni tot 2 juni; een einde op 3 juni 00:00 geeft 3 juni). Een einde zonder tijd, alleen
  een datum, telt tot het eind van die dag, zoals `finishInstant`: een einde op 2 juni geeft `endExclusive` 3 juni;
- een mijlpaal, of een taak waarvan het einde niet na de start ligt, krijgt `endExclusive` = startdatum plus één dag.

**Het venster.** `start` en `endExclusive` staan er samen of geen van beide, `endExclusive` ligt na `start`, en bij
een mijlpaal is het venster precies één dag (regel `gedeeld-venster`). Anders weigert de lezer met `invalid`.

**Leesregel.** De precieze tijden in `openaec::ops::task.time` gelden alleen als hun projectie gelijk is aan `start` en
`endExclusive`. De lezer vergelijkt beide met één projectie van de taak zoals ze in het bestand staat. Wijkt een van de
twee af, dan heeft een ander programma de datum veranderd en wint de gedeelde datum: een afwijkende start zet de
geplande, vroege en late start op 00:00 van die datum, een afwijkend einde het geplande, vroege en late einde op 00:00
van `endExclusive` (bij een mijlpaal op de start). De taak wordt handmatig gepland en telt mee in
`ifcxSharedDatesApplied`. Twee dingen blijven een feit: de start van een taak met een werkelijke start en het einde
van een voltooide taak. Wijkt alleen zo'n datum af, dan verandert er niets en telt de taak niet mee (knownbug 2221).
Voor een eigen bestand dat niemand veranderde, verandert openen dus geen datum.

**Het venster dat telt** (regel `venster`): de start is de werkelijke start als die vaststaat, anders `start`; het einde
is het werkelijke einde van een voltooide taak, anders `endExclusive`. Dat venster eindigt niet vóór zijn start.
Verplaatst een ander programma het venster van een gestarte taak naar vóór haar werkelijke start, dan weigert de lezer
met `invalid` en veld `task.time`. Een taak die in de app zelf vóór haar werkelijke start eindigt (een werkelijke start
ingevuld, nog niet opnieuw berekend), schrijft de writer gewoon: haar venster begint op de werkelijke start.

## Volgorde onder een ouder

De taken staan in de volgorde van de takenlijst. De kinderen van een ouder komen in de lezer in de volgorde van hun
entries, behalve kinderen met een `place`: die komen op die plaats, en de andere vullen de open plaatsen in de volgorde
van hun entries; een `place` buiten de lijst komt achteraan. De writer geeft alleen een `place` aan de kinderen buiten
een langste reeks die in de takenlijst en onder de ouder in dezelfde volgorde staat (`childOrder.ts`). Een boom waarin
`childIds` en `parentId` elkaar tegenspreken, weigert de writer met `inconsistent` (knownbug 2222); een kring in de
ouders weigeren writer en lezer.

## Regels over meer velden

Wat meer dan één veld raakt, staat in één lijst: `CONSISTENCY_RULES` in `consistency.ts`. De writer past elke regel
toe op zijn invoer, de lezer op het model dat hij las, na de leesregel; een regel over één attribuut (`onAttribute`)
toetsen beide op de attribuutwaarde. Elke regel heeft een reden in de lijst zelf.

| Regel | Wat | Veld bij weigering |
|---|---|---|
| `identiteit` | zie *Paden en identiteit* | `<soort>.id`, `<soort>.globalId`, `<soort>.<verwijzing>` |
| `boom` | de kinderen van een taak zijn precies de taken die haar als ouder noemen; geen kring in de ouders | `task.childIds`, `task.parentId` |
| `venster` | het venster dat telt eindigt niet vóór zijn start (zie *Datums*) | `task.time` |
| `lag-eindig` | `lagDays`, `lagMinutes` en `lagPercent` zijn eindige getallen (ook `timeLagRatio` × 100) | `sequence.lag` |
| `projectkalender-in-bibliotheek` | de bibliotheekentry van de projectkalender is dezelfde kalender | `resourceCalendars` |
| `een-lagvorm` | een relatie heeft `timeLag` of `timeLagRatio`, niet allebei | `timeLagRatio` |
| `gedeeld-venster` | zie *Datums* | `start`, `endExclusive` |
| `baselinekeuze` | de actieve baseline bestaat; de vergelijking noemt alleen baselines die bestaan, niet de actieve en niet twee keer dezelfde | `activeBaselineId`, `comparedBaselineIds` |
| `kosten` | een kostenresource heeft geen tarief, kalender, ploeg, eenheid of stappen en capaciteit 1; een kostentoewijzing heeft geen werk en inzet 1; een bedrag staat alleen op een kostentoewijzing (`resourceConsistency.ts`) | `resource.<veld>`, `assignment.<veld>` |

## Wat de writer weigert

`writeIfcx` schrijft niets en gooit een `IfcxWriteRefusedError`:

- met code `unsupported` en de veldnamen in `fields`, als het document iets heeft wat dit profiel nog niet draagt:
  codes, eigen velden, gebruikte taaktypes, de bibliotheek, het P6-bronarchief, de modus "datums zoals opgeslagen",
  letterlijke kalenders, een openstaande omzetting naar het minutenmodel, en elk veld van project, kalender, taak,
  relatie, resource, toewijzing, baseline of baselinerij dat geen veldgroep draagt (`unsupportedContent.ts`), en een
  werkplan of werkschema zonder GlobalId van 128 bits;
- met code `inconsistent` en de veldnamen in `fields`, als het document een regel uit *Regels over meer velden*
  breekt: twee objecten van één soort met hetzelfde id, twee objecten met dezelfde GlobalId, een verwijzing zonder doel,
  een boom die niet klopt, een venster dat eindigt vóór zijn start, een oneindige lag, een bibliotheekentry van de
  projectkalender met een andere inhoud, een baselinekeuze die de app zelf zou wissen, of een kostenresource of
  -toewijzing die de kostenregels van de app breekt. STEP laat de meeste van die gevallen bij schrijven of lezen stil
  vallen;
- met code `invalid` en het attribuut en veld in `fields` (zoals `openaec::ops::document.startDate` of
  `openaec::planning::activity.completion`), als een waarde buiten haar domein valt. De writer toetst elke waarde die
  hij zou schrijven, en de kop, met dezelfde functie als de lezer, vóór het schrijven. Een ongeldig moment van
  schrijven geeft `header.timestamp`; een planning die de writer niet in de velden kan zetten (zoals `workTime` zonder
  `byWeekday`) geeft `planning`;
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
- `invalid`: een kopveld buiten zijn domein (`place.field` is dan `header.<veld>`), een bestand zonder `imports` of
  `schemas`, een eigen schema dat afwijkt van het profiel of ontbreekt voor een attribuut dat in het bestand staat, een
  bekend veld met een waarde buiten zijn domein (ook een dag of kloktijd die niet bestaat, en een getal als `1e999`),
  een verplicht veld dat ontbreekt, een verwijzing naar een pad van de verkeerde soort, een pad dat niet bij de
  GlobalId van het object hoort, een gebroken regel uit *Regels over meer velden* (`place.field` noemt het veld van de
  regel), een `libraryPlace` die niet klopt, of niet precies één werkschema. Voor resources en baselines ook: een
  kostenresource die geen `IfcConstructionMaterialResource` is, een baselinerij die naar een object wijst dat geen taak
  is, een eigen id in `taskIds` voor een taak die bestaat of twee keer voor één pad, een verwijderde baselinetaak met
  het id van een taak die bestaat of met twee paden, twee actieve baselines, twee baselines op één vergelijkingsplaats,
  of de actieve baseline in de vergelijking.

De lezer eist dus in de kop `id`, `ifcxVersion`, `dataVersion`, `author` en `timestamp` in hun domein, `imports` als
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
veldgroep zette, geeft dus een verschil en een weigering, ook als het leeg is (`null`, `[]` of `{}`), bovenin en
dieper in een object. Alleen een ontbrekend veld en `undefined` zijn hetzelfde. Verder normaliseren of laten alleen de
regels in `SELF_CHECK_RULES` iets weg, elk voor genoemde paden en met een reden in de lijst zelf:

| Regel | Wat | Waarom |
|---|---|---|
| `schrijfroute` | `writeMode` | de keuze van de schrijfroute is geen planningsgegeven |
| `leesmeta` | `timeModel`, `recordedFields`, `recordedTimesOrigin`, `ifcxSharedDatesApplied` en de andere meldingen van een lezer | wat een lezer bij openen meegeeft; de STEP-writer leest het niet |
| `bronidentiteit` | `ifcSource` | de bron van een STEP-document met een vreemd deel; de codec schrijft alleen de planning |
| `archiefopslag` | `xerSourceArchiveStorage` | heeft zonder bronarchief geen effect |
| `nee-is-afwezig` | `minuteModelPending`, `importPristine` | onwaar betekent hetzelfde als niet gezet; waar weigert de voorcontrole |
| `globalids` | `ifcGlobalIds` | de invoer telt met de GlobalIds die de STEP-writer zou geven, zonder die van verdwenen objecten |
| `gebruikte-taaktypes` | `customTaskTypes` | alleen gebruikte taaktypes worden opgeslagen, zoals in STEP |
| `geen-vergelijking` | `comparedBaselineIds` | precies `[null, null]` betekent: geen vergelijking |
| `lijsten-van-de-lezer` | `activityCodeTypes`, `customFieldDefs`, `baselines`, `resources`, `assignments`, `resourceCalendars`, `activeBaselineId`, `task.resourceIds` | de lezer geeft deze lijsten altijd, ook leeg, en `activeBaselineId` als `null`; ontbreken ze in de invoer, dan betekent dat hetzelfde; met inhoud weigert de voorcontrole ze |
| `lege-velden-die-deze-versie-niet-draagt` | de bekende domeinvelden die geen veldgroep draagt, met naam in de regel | leeg betekent zo'n veld niets; met inhoud weigert de voorcontrole het; een onbekend veld valt er niet onder |

Leeg is dus alleen gelijk aan afwezig voor de paden in de laatste vier regels hierboven, en voor `minuteModelPending`
en `importPristine` als ze onwaar zijn. Welke domeinvelden bekend zijn, volgt uit de typen (`domainKeys.ts`): een veld
dat in het type bijkomt of wegvalt, is een compileerfout tot het in de lijst staat.

Elke regel heeft in `check-ifcx-kern.ts` een geval dat zonder die regel een verschil geeft, en de proef eist dat de
lijst en die gevallen dezelfde regels noemen. Voor de regels die leeg gelijkstellen aan afwezig is er ook een
tegenproef: met inhoud weigert de writer. Het teruglezen in de zelfcontrole toetst de waarden niet nog eens: de writer
toetste precies die waarden vlak ervoor met dezelfde functie als de lezer. De STEP-pariteit (`planningCanon` gelijk en dezelfde STEP-uitvoer) staat
alleen nog in de proeven. Waar de controle draait (Ctrl+S en Opslaan als, niet Automatisch opslaan, in de Worker), kiest
de app (F3-4).

## Uitbreiden (F3-2 en F3-3)

Een nieuw gebied krijgt een eigen bestand in `src/services/ifc/ifcx/fields/` met zijn velden (sleutel, vorm, schrijven
en lezen samen) en de domeinvelden die het draagt (`carries`), en één regel in de lijst van groepen in
`fieldGroups.ts`. Het schema in het bestand, de controle van de lezer, de voorcontrole van de writer en de zelfcontrole
volgen daar vanzelf uit; voor de zelfcontrole hoeft een nieuwe groep niets te doen. Elk veld krijgt een vorm uit
`fieldTable.ts` (een tekst- of datumveld zonder vorm compileert niet); een nieuwe vorm krijgt tegenvoorbeelden in
`FORM_COUNTEREXAMPLES` in de proef, en elk veld moet in een van de proefplanningen (`maximalPlan`, `variantPlan`)
staan (voor resources, toewijzingen en baselines: het voorbeeldbestand `resources-alle-velden.ifcx`); anders faalt de tabelproef, die elk veld met elk tegenvoorbeeld door lezer en writer haalt. Een nieuwe soort
object komt als regel in `IDENTITY_KINDS` (met zijn verwijzingen) en in `IDENTITY_LISTS` in de proef. Een regel over
meer velden komt in `CONSISTENCY_RULES` en krijgt een geval in `RULE_CASES`. Heeft een veld een andere maar
gelijkwaardige vorm na het teruglezen, of is het afgeleide metadata, dan komt er een regel in `SELF_CHECK_RULES` met een
reden, en een geval in `SELF_CHECK_WITNESSES` in de proef. Een nieuw soort object vraagt ook een node in de writer en
in `NODE_SHAPES` van `ifcxReader.ts`; resources, toewijzingen en baselines hebben hun eigen writer en lezer
(`ifcxResourceWriter.ts`, `ifcxResourceReader.ts`). De proeven zijn `tests/planning/check-ifcx-kern.ts` en
`check-ifcx-resources.ts`; de voorbeeldbestanden in
`tests/fixtures/ifcx/eigen/` maak je opnieuw met `OPS_IFCX_FIXTURES_WRITE=1 bash tests/planning/run.sh check-ifcx-kern.ts`.
