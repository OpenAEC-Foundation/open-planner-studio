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

Deze versie (fase 3, F3-1) draagt project, werkplan, werkschema, kalenders, taken en relaties. Resources,
toewijzingen en baselines komen in F3-2, de overige velden in F3-3. Wat de kern nog niet draagt, weigert de writer
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
  taken (in de volgorde van de takenlijst), relaties. Elke entry staat op één regel.

## Paden en identiteit

- Het pad van een object is de UUID van zijn GlobalId: dezelfde 128 bits, in kleine letters met streepjes en zonder
  voorloop-`/`. De GlobalId is die van de STEP-writer: een bewaarde GlobalId (`ifcGlobalIds`), anders `ifcGuid128`
  van `ifcObjectSeed` (`defaultGlobalId` in `stepGlobalIds.ts`). Zo houdt IFC → IFCX → IFC dezelfde GlobalIds. Delen
  twee objecten een GlobalId, dan geeft de STEP-writer het tweede een nieuwe; de IFCX-writer weigert (zie hieronder). De lezer vult `ifcGlobalIds` terug voor elk object: project, werkplan, werkschema, kalenders,
  taken en relaties.
- Een GlobalId zonder geldige 128-bitsvorm (22 tekens, eerste teken `0`–`3`; de oude `ifcGuid` geeft dat niet altijd)
  krijgt als pad een UUID v5 van de GlobalId, en de GlobalId zelf staat in het veld `globalId` van het
  `openaec::ops::`-attribuut van dat object. De namespace is `fd4e93a2-de83-56ee-929c-defaa450b626`, de UUID v5 van
  `urn:openaec:planner` in de URL-namespace van RFC 4122. Werkplan en werkschema hebben zo'n veld niet: heeft hun
  GlobalId geen 128-bitsvorm, dan weigert de writer met `unsupported` en de sleutel `ifcGlobalIds.wp` of
  `ifcGlobalIds.ws`.
- Het interne id van een object staat in het veld `id` van zijn `openaec::ops::`-attribuut als het afwijkt van het
  pad. Voor de projectkalender is de afleiding `cal-default`, voor het project de UUID uit de kop.
- Verwijzingen tussen objecten (`parent`, `calendar`, `relatingProcess`, `relatedProcess`, `workplan`) zijn paden.

**Identiteit is één regel voor alle soorten** (`IDENTITY_KINDS` in `identity.ts`, een gewone lijst met de soorten die
er nu zijn: project, werkplan, werkschema, kalender, taak, relatie). Voor elke soort geldt:

- het interne id is uniek binnen de soort;
- de GlobalId is uniek over alle objecten samen, project, werkplan en werkschema inbegrepen;
- een verwijzing naar een ander object (`parentId`, `childIds`, `predecessorId`, `successorId`) heeft een doel. De
  boom schrijft IFCX zoals STEP hem schrijft (zie *Volgorde onder een ouder*), dus voor `parentId` en `childIds` geldt
  dit na die stap altijd;
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
| `openaec::ops::task.place` | de volgorde van de entries (zie *Volgorde onder een ouder*) |
| `openaec::ops::sequence.lagDays`, `lagMinutes`, `lagPercent` | uit `timeLag` of `timeLagRatio` (zie *Lag*) |
| `openaec::ops::document.startDate`, `endDate` | de datum in `start` en `finish` van het werkplan |
| `openaec::ops::document.calendarId` | het id van de projectkalender |

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
lezer zet daar dezelfde kalender terug. Heeft de entry een andere inhoud dan de projectkalender, dan schrijft IFCX de
projectkalender, zoals STEP: de STEP-writer laat de entry weg en de app zet bij de volgende opslag de projectkalender
terug in de bibliotheek. `generation.ruleSetId` is een van de landen in `HOLIDAY_COUNTRIES`, de twee jaren liggen
tussen 1000 en 9999, zoals de app ze toetst.

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

`openaec::ops::task`: `id`, `globalId`, `place` (geheel getal vanaf 0), `time` (verplicht, hieronder),
`milestoneKind` (keuze `START`, `FINISH`), `mandatory`, `isSummary`, `manuallyScheduled` (ja/nee), `calendarId`
(alleen als de eigen kalender niet als pad te schrijven is). De status van een taak staat er niet in: na de normalisatie
bij openen (zie *Zoals de STEP-lezer*) volgt ze altijd uit de voortgang en de werkelijke datums.

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

Gedeelde datums en precieze tijden zijn twee voorstellingen van één feit. Wat de lezer doet als ze verschillen, staat
in de rij `taakvenster` van *Dubbele voorstellingen*. Voor een eigen bestand dat niemand veranderde, verandert openen
geen datum.

## Volgorde onder een ouder

De taken staan in de volgorde van de takenlijst. De kinderen van een ouder komen in de lezer in de volgorde van hun
entries, behalve kinderen met een `place`: die komen op die plaats, en de andere vullen de open plaatsen in de volgorde
van hun entries; een `place` buiten de lijst komt achteraan. De writer geeft alleen een `place` aan de kinderen buiten
een langste reeks die in de takenlijst en onder de ouder in dezelfde volgorde staat (`childOrder.ts`).

De boom komt, zoals in STEP, uit de kinderlijsten van de verzameltaken (`copyAsStepWritesIt` in `openNormalize.ts`,
naar `writeWBSNesting` en `extractNesting`): een kind dat niet bestaat valt weg, de ouder van een taak is de
verzameltaak die haar in de lijst heeft, en een taak die in geen lijst staat heeft geen ouder. Een kring in de ouders
bewaart STEP, en IFCX ook. Een taak in de lijst van twee ouders bewaart STEP onder beide; IFCX draagt één ouder en
weigert dan met `self-check` (knownbug 2222).

## De maat

Besluit van Trias, 24 november 2026, letterlijk: "Voor dezelfde planning is IFCX niet slechter dan IFC (STEP) op main.
BLOKKEERT is: IFCX verliest of verandert iets wat STEP bewaart; IFCX weigert wat STEP opslaat; of twee voorstellingen
van één feit in het bestand spreken elkaar tegen en de lezer kiest stil. Een waarde die STEP op main ook aanneemt en
hetzelfde behandelt, is geen blokkade." Het waardedomein per vorm (regel A) blijft streng.

De proef die deze maat pint, is één lus in `check-ifcx-kern.ts` (`STEP_CASES`): voor elke planning in de lijst geeft
heen en terug door IFCX dezelfde planning (`planningCanon`, na de opslagroute van de app en zonder leesmeta) als heen
en terug door STEP, of beide weigeren. Elke planning gaat drie routes: STEP, `writeIfcx` en een bestand zonder de
normalisatie van de writer, door de IFCX-lezer. De lus meldt ook waar STEP zelf iets verandert. Een paar gevallen
weigert IFCX bewust: een waarde buiten het domein (regel A), een botsend id of een botsende GlobalId en een relatie
zonder doel (regel C), en een taak onder twee ouders (2222).

## Zoals de STEP-lezer

De regels van de planning komen uit de app, niet uit de codec. Na het ontleden roept de STEP-lezer (`readIFC` in
`ifcReader.ts`) deze functies aan die de planning bijwerken, in deze volgorde:

1. `canonicalizeBands` (`subdayIo.ts`) op de werkblokken van elke kalender en van elke werkende uitzondering, bij het
   lezen van de kalender: een niet-oplopend einde krijgt er een dag bij en de blokken komen op volgorde;
2. `reconstructResourceIds` (`importNormalize.ts`): de resources van een taak uit de toewijzingen;
3. `reconcileP6SuspendResume` (`p6SuspendResume.ts`) op elke taak;
4. `resolveMissingScheduleDates` (`importDates.ts`) voor taken zonder geplande start of einde;
5. `normalizeImportedProgress` (`importNormalize.ts`) op de bladtaken, met de statusdatum en de taken die volgens het
   bestand op 100 % nog lopen (`isRunningAtFullCompletion`, dezelfde functie die de STEP-writer gebruikt);
6. `deriveSummaryStatus` (`importNormalize.ts`): de status van een verzameltaak uit haar voortgang. Dat stond als losse
   lus in `ifcReader.ts` en is nu een eigen functie die beide lezers aanroepen.

`normalizeAsOnOpen` in `openNormalize.ts` roept precies die functies aan, in die volgorde; de IFCX-lezer doet dat aan
het eind van het lezen. Twee stappen van de STEP-lezer volgen IFCX niet, omdat ze aan het STEP-formaat hangen: de
aanvulling van lege vroege en late datums uit de geplande (`fillEmptyComputedDateSlots`, alleen voor taken met een
STEP-tijdentiteit) en de verschuiving van de projectstart naar de vroegste taakstart als het bestand geen eigen
projectstart vastlegt (losse code; IFCX legt de projectstart altijd vast).

De writer normaliseert een kopie van zijn invoer op dezelfde manier vóór het schrijven, nooit het document in de app
(`normalizedCopy`): eerst de boom en de bibliotheek zoals de STEP-writer ze schrijft (`copyAsStepWritesIt`), dan
`normalizeAsOnOpen`. Die kopie is wat de zelfcontrole met het teruggelezen model vergelijkt. Een proef laat zien dat het
object dat de aanroeper aan `writeIfcx` gaf, na de aanroep diep gelijk is aan een kopie van ervoor.

## Dubbele voorstellingen

Waar het bestand één feit twee keer draagt, staat dat in één tabel: `DOUBLE_REPRESENTATIONS` in
`doubleRepresentations.ts`. Per rij de twee voorstellingen, de omrekening en wie voorgaat. De lezer loopt de rijen af
en doet voor elke rij hetzelfde: beide voorstellingen elk in hun eigen domein toetsen, de voorrang toepassen, en
weigeren met `invalid` als ze elkaar tegenspreken waar de rij dat niet toelaat.

| Rij | Gedeeld | Precies | Omrekening | Voorrang |
|---|---|---|---|---|
| `taakvenster` | `activity.start`, `activity.endExclusive` | `ops::task.time` | de projectie van *Datums* | de gedeelde datum gaat voor: een afwijkende start zet de geplande, vroege en late start op 00:00 van die datum, een afwijkend einde het geplande, vroege en late einde op 00:00 van `endExclusive` (bij een mijlpaal op de start); de taak wordt handmatig gepland en telt mee in `ifcxSharedDatesApplied`. Een werkelijke start en het einde van een voltooide taak zijn een feit: spreekt de gedeelde datum dat tegen, dan `invalid` (`start` of `endExclusive`). Het venster zelf: `start` en `endExclusive` samen of geen van beide, het einde na de start, een mijlpaal precies één dag |
| `taakkalender` | `activity.calendar` | `ops::task.calendarId` | het pad wijst de kalender aan | ze sluiten elkaar uit: allebei is `invalid` (`calendarId`) |
| `lag` | `sequence.timeLag`, `sequence.timeLagRatio` | `ops::sequence.lagDays`, `lagMinutes`, `lagPercent` | zie *Lag* | één gedeelde vorm, ook omgerekend eindig (anders `invalid`, ook als er een precieze waarde naast staat); de precieze waarde gaat voor |
| `projectdatums` | `workplan.start`, `workplan.finish` | `ops::document.startDate`, `endDate` | de datum van het precieze moment | de gedeelde datum gaat voor als de datum van het precieze moment afwijkt; het project telt dan mee in `ifcxSharedDatesApplied` |
| `auteur` | `header.author` | `ops::document.author` | de kop draagt de auteur, of `Open Planner Studio` als die leeg is | de precieze waarde gaat voor; de writer schrijft haar alleen als ze afwijkt van de kop |

`ifcxSharedDatesApplied` telt dus de taken en het project waarvan een ander programma een gedeelde datum veranderde.
Een proef zoekt de paren zelf: voor elk gedeeld veld en elk precies veld kijkt ze welke domeinwaarden de writer leest.
Lezen ze dezelfde waarde, dan moet er een rij zijn, of een reden in de proef dat het niet één feit is (nu één: `parent`
en `place`, de ouder en de plaats onder die ouder).

## Regels over meer velden

`CONSISTENCY_RULES` in `consistency.ts` houdt alleen nog wat over het bestandsformaat zelf gaat: de regel
`identiteit` (zie *Paden en identiteit*). De writer past haar toe op zijn genormaliseerde invoer, de lezer op het model
dat hij las. Bij elke regel die er stond, is de vraag gesteld: neemt STEP op main deze combinatie aan en bewaart hij
haar? Dit verviel:

| Regel | Waarom weg |
|---|---|
| `venster` | strenger dan de app: een gestarte taak die vóór F5 eindigt vóór haar werkelijke start, slaat STEP op; IFCX nu ook. Wat het bestand zelf tegenspreekt, staat in de rij `taakvenster` |
| `boom` | STEP bewaart een boom waarin kinderlijst en ouder elkaar tegenspreken (hij volgt de kinderlijst) en een kring; IFCX schrijft de boom nu zoals STEP |
| `projectkalender-in-bibliotheek` | STEP schrijft de projectkalender en laat de entry weg; IFCX doet nu hetzelfde |
| `lag-eindig`, `een-lagvorm` | opgegaan in de rij `lag`; een oneindige precieze lag is een waarde buiten het domein (regel A) |
| `gedeeld-venster` | opgegaan in de rij `taakvenster` |

## Wat de writer weigert

`writeIfcx` schrijft niets en gooit een `IfcxWriteRefusedError`:

- met code `unsupported` en de veldnamen in `fields`, als het document iets heeft wat dit profiel nog niet draagt:
  resources, toewijzingen, baselines, codes, eigen velden, gebruikte taaktypes, de bibliotheek, het P6-bronarchief, de
  modus "datums zoals opgeslagen", letterlijke kalenders, een openstaande omzetting naar het minutenmodel, en elk veld
  van project, kalender, taak of relatie dat geen veldgroep draagt (`unsupportedContent.ts`), en een werkplan of
  werkschema zonder GlobalId van 128 bits;
- met code `inconsistent` en de veldnamen in `fields`, als de genormaliseerde invoer de regel `identiteit` breekt:
  twee objecten van één soort met hetzelfde id, twee objecten met dezelfde GlobalId, of een relatie naar een taak die
  niet bestaat;
- met code `invalid` en het attribuut en veld in `fields` (zoals `openaec::ops::document.startDate` of
  `openaec::planning::activity.completion`), als een waarde buiten haar domein valt. De writer toetst elke waarde die
  hij zou schrijven, en de kop, met dezelfde functie als de lezer, vóór het schrijven. Een ongeldig moment van
  schrijven geeft `header.timestamp`; een planning die de writer niet in de velden kan zetten (zoals `workTime` zonder
  `byWeekday`) geeft `planning`;
- met code `self-check`, als de eigen controle na het schrijven een verschil vindt, of als de eigen uitvoer niet
  terugleest; bij een verschil noemt `fields` de paden van de eerste verschillen (zie *Zelfcontrole*).

Sessiegegevens weigert de writer niet: wat STEP niet opslaat (`task.time.progressBeforeRecalculation`), slaat IFCX ook
niet op (regel `sessiegegevens` van de zelfcontrole; de voorcontrole volgt dezelfde lijst).

**Twee foutcodes voor een fout in de waarden.** Bij schrijven betekent `invalid`: een waarde of de vorm van één
attribuut valt buiten het profiel, zoals de writer haar zou schrijven (ook een planning die de writer niet in de velden
kan zetten). `inconsistent` betekent: een combinatie in de planning breekt de regel `identiteit`. Bij lezen is er één
code, `invalid`, voor alles wat een profielregel breekt: een waarde, een rij van *Dubbele voorstellingen* en de regel
`identiteit`.

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
  GlobalId van het object hoort, een tegenspraak in een rij van *Dubbele voorstellingen* (`place` noemt pad,
  attribuut en veld), een gebroken regel `identiteit` (`place.field` noemt het veld van de regel), een `libraryPlace`
  die niet klopt, of niet precies één werkschema.

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

Na het schrijven leest `writeIfcx` zijn eigen uitvoer terug en legt het teruggelezen model rechtstreeks naast de
genormaliseerde invoer (`selfCheck.ts`, besluit van de technisch beslisser over keuze T4; zie *Zoals de STEP-lezer*). De vergelijking is algemeen: elk veld van de invoer
en van het teruggelezen model telt mee, op elk niveau, met de volgorde van lijsten. Een veld dat niemand in een
veldgroep zette, geeft dus een verschil en een weigering, ook als het leeg is (`null`, `[]` of `{}`), bovenin en
dieper in een object. Alleen een ontbrekend veld en `undefined` zijn hetzelfde. Verder normaliseren of laten alleen de
regels in `SELF_CHECK_RULES` iets weg, elk voor genoemde paden en met een reden in de lijst zelf:

| Regel | Wat | Waarom |
|---|---|---|
| `sessiegegevens` | `task.time.progressBeforeRecalculation` | het type noemt het veld sessiegegevens zonder IFC-opslag; de STEP-writer schrijft het niet en de STEP-lezer geeft het niet terug; de voorcontrole weigert het niet |
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

Leeg is dus alleen gelijk aan afwezig voor de paden in `geen-vergelijking`, `lijsten-van-de-lezer` en
`lege-velden-die-deze-versie-niet-draagt`, en voor `minuteModelPending` en `importPristine` als ze onwaar zijn.

**Wat de compileercontroles bewijzen, en wat niet.** `allKeysOf<T>()` in `domainKeys.ts` eist voor zes typen
(`WriteIFCInput`, `Project`, `WorkCalendar`, `Task`, `TaskTime`, `Sequence`) dat de lijst precies alle sleutels noemt,
ook de optionele: een sleutel die in het type bijkomt of wegvalt, is een compileerfout tot de lijst klopt. Dat geldt
alleen voor die zes typen, niet voor geneste typen zoals `Holiday` of `WorkingException`, en alleen zolang het type
concrete sleutels heeft (een stringindex of een cast omzeilt het). De lege uitzonderingen volgen uit "bekend min
gedragen"; een nieuw optioneel veld dat in de lijst komt en leeg is, valt dus zonder verdere wijziging onder
`lege-velden-die-deze-versie-niet-draagt`. In de veldtabel eist het type `IfcxValue` een vorm bij elk tekst- en
datumveld, maar het verbindt de vorm niet met het domeinveld: een datumveld kan `TEXT` of `REAL` krijgen en
compileren. Dat de vorm past, staat alleen in de veldtabel zelf en in de review.

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
volgen daar vanzelf uit. Wat een nieuw gebied verder doet, en welke proef het afdwingt:

- **De maat.** Planningen met de nieuwe gegevens komen in de lus `STEP_CASES`; heen en terug door IFCX geeft dezelfde
  planning als door STEP. Roept de STEP-lezer voor die gegevens na het ontleden een functie aan die de planning
  bijwerkt (bij resources `normalizeCostResources`), dan komt die in `normalizeAsOnOpen`, op dezelfde plek in de
  volgorde; geen eigen regel in `CONSISTENCY_RULES`.
- **Vorm.** Elk veld krijgt een vorm uit `fieldTable.ts`. Een nieuwe vorm krijgt tegenvoorbeelden in
  `FORM_COUNTEREXAMPLES`, en elk veld moet in `maximalPlan` of `variantPlan` staan; de tabelproef haalt elk veld met elk
  tegenvoorbeeld door lezer en writer en eist per geval een van drie uitkomsten: de writer weigert om precies dat
  veld, de ongetoetste lezer maakt er geen planning van, of de planning draagt de waarde niet.
- **Twee voorstellingen.** Schrijft een gedeeld veld en een precies veld dezelfde domeinwaarde, dan komt er een rij in
  `DOUBLE_REPRESENTATIONS` met een geval in `REPRESENTATION_CASES`, of een reden in `NOT_ONE_FACT`; de proef vindt zo'n
  paar zelf.
- **Identiteit.** Een nieuwe soort object komt als regel in `IDENTITY_KINDS` (met zijn verwijzingen) en in
  `IDENTITY_LISTS` in de proef, en vraagt een node in `ifcxWriter.ts` en `ifcxReader.ts` (`NODE_SHAPES`).
- **Zelfcontrole.** Heeft een veld na het teruglezen een andere maar gelijkwaardige vorm, of is het sessie- of
  leesmetadata, dan komt er een regel in `SELF_CHECK_RULES` met een reden en een geval in `SELF_CHECK_WITNESSES`.

De proef is `tests/planning/check-ifcx-kern.ts`; de voorbeeldbestanden in `tests/fixtures/ifcx/eigen/` maak je opnieuw
met `OPS_IFCX_FIXTURES_WRITE=1 bash tests/planning/run.sh check-ifcx-kern.ts`.
