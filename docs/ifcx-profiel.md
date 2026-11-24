# Het IFCX-profiel van Open Planner Studio

Dit document beschrijft hoe Open Planner Studio een planning in IFCX schrijft en leest: de kop, de paden, de
attributen met hun velden, de vorm en betekenis van elk veld, de projectie naar de gedeelde attributen, de betekenis
van lag, de drie regels R0, R1 en R2, en de versieregel. Het ontwerp staat in
`docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md` (§5 en §6); de code staat in
`src/services/ifc/ifcx/`. De velden, de betekenis van lag en de proeven zijn eigen keuzes van deze repo (ontwerp §11,
besluit 12).

## Status: concept

Het profiel is een **concept** tot de featureflag `ifcx` eraf gaat. Tot dan kan een attribuutnaam nog van schema
veranderen; vanaf het moment dat de flag eraf gaat of een ander programma het profiel gebruikt, krijgt elke wijziging
een nieuwe naam (ontwerp §5.3). Wat een planner met de flag aan in die tijd als IFCX opslaat, kan een latere versie
van de app weigeren.

Deze versie (fase 3, F3-1) draagt project, werkplan, werkschema, kalenders, taken en relaties. Resources,
toewijzingen en baselines komen in F3-2, de overige velden in F3-3. Wat de kern nog niet draagt en STEP wel bewaart,
weigert de writer (zie *Wat de writer weigert*).

**De profielversie.** Verandert later de projectie van de writer (wat de writer voor een planning in het bestand zet,
gedeeld of precies), dan gaat de profielversie (`formatVersion`) omhoog, en moet de lezer voor een bestand met de oude
versie de oude projectie kunnen narekenen; anders weigert R2 elk oud bestand. Deze regel komt in F3-4 in de
`AGENTS.md` van het project (besluit van Trias, 24 november 2026).

## De maat en de drie regels

Besluit van Trias, 24 november 2026, letterlijk: "Voor dezelfde planning is IFCX niet slechter dan IFC (STEP) op main.
BLOKKEERT is: IFCX verliest of verandert iets wat STEP bewaart; IFCX weigert wat STEP opslaat; of twee voorstellingen
van één feit in het bestand spreken elkaar tegen en de lezer kiest stil. Een waarde die STEP op main ook aanneemt en
hetzelfde behandelt, is geen blokkade." "Uitzondering: waar STEP op main een dubbele identiteit of een verwijzing
zonder doel stil verandert om te kunnen opslaan, mag IFCX weigeren", op voorwaarde dat "de weigering noemt welk id,
welke GlobalId of welke relatie het is, zodat de planner het zelf kan rechtzetten. Stil hernoemen blijft verboden." Een
taak onder twee ouders valt "onder dezelfde uitzondering, met dezelfde voorwaarde voor de melding". Het waardedomein
per vorm (regel A) blijft streng.

Na vier reviewrondes met 23 blokkades (6, 5, 6 en 6) zag Trias twee wortels. Bij lezen droeg het bestand veel feiten
twee keer (gedeeld en precies) en moest de lezer bij elk verschil kiezen wie voorgaat; elke voorrangsregel was een
plek voor een stille keuze. Bij schrijven werd "wat de planning na opslaan en heropenen is" nagebouwd met losse
functies, terwijl het antwoord al bestaat: wat de STEP-writer en de STEP-lezer van de app samen opleveren. Daarom
gelden sinds fixronde 4 drie regels (besluit van Trias, 24 november: "akkoord met R0, R1 en R2"), letterlijk:

- **R0 (identiteit):** "de writer toetst eerst de invoer op dubbele id's, dubbele GlobalIds, relaties zonder doel en
  een taak onder twee ouders, en weigert met `inconsistent` en de namen erbij." Code: `identityProblems` in
  `identity.ts`, aangeroepen vooraan in `writeIfcx` (`ifcxWriter.ts`) op de invoer van de aanroeper.
- **R1 (schrijven):** "de planning die IFCX opslaat is letterlijk wat STEP zou teruggeven. De writer neemt een kopie
  van zijn invoer, haalt die door de STEP-writer en de STEP-lezer van de app (dezelfde code en dezelfde opties als
  Ctrl+S en heropenen, in het schema van het project), en schrijft die uitkomst. De zelfcontrole blijft: teruglezen en
  rechtstreeks vergelijken met die uitkomst." Code: `stepRoundtrip` in `stepRoundtrip.ts` (`writeIFC`, daarna
  `readIFC`), aangeroepen in `writeIfcx`.
- **R2 (lezen):** "de gedeelde gegevens in het bestand zijn precies de projectie van de precieze. De lezer leest de
  precieze kant, rekent met de projectie van de writer uit wat er gedeeld had moeten staan, en vergelijkt dat met het
  bestand. Elk verschil is `invalid`." Code: `assertProjection` in `ifcxReader.ts`, met `composeIfcxDocument` uit
  `projection.ts`, dezelfde functie als de writer.

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
  `dataVersion` heeft de vorm `MAJOR.MINOR.PATCH`. `author` is de projectie van de auteur van het project, of
  `Open Planner Studio` als die leeg is. `timestamp` is het moment van schrijven (ISO 8601, UTC). De kop heeft een
  waardedomein zoals elk attribuut (`HEADER_VALUE` in `ownAttributes.ts`); writer en lezer toetsen hem met dezelfde
  functie.
- **`imports`** is altijd leeg. De app schrijft geen `bsi::ifc::class`, geen `children` en geen `inherits`.
- **`schemas`** bevat voor elk attribuut dat in het bestand voorkomt de definitie. Die komt uit dezelfde tabel als het
  schrijven en lezen (`fieldGroups.ts`, `ownAttributes.ts`).
- **`data`**: één entry per object, in deze volgorde: werkplan, werkschema, projectkalender, de andere kalenders,
  taken (in de volgorde van de takenlijst), relaties. Elke entry staat op één regel.

## Twee kanten: precies en gedeeld

Elk object heeft een precies attribuut in `openaec::ops::` en een gedeeld attribuut in `openaec::planning::`.

- **De precieze kant draagt elk feit.** De lezer leest alleen `openaec::ops::`. Een veld staat er niet als het de
  standaardwaarde heeft: een lege tekst, prioriteit 500, geen mijlpaal, `WORKTIME`, voortgang 0, een lag van 0 dagen,
  het id dat uit het pad volgt (`cal-default` voor de projectkalender, de UUID uit de kop voor het project), en de
  plaats onder de ouder die uit de volgorde van de entries volgt.
- **De gedeelde kant is alleen de projectie** voor andere programma's: het gedeelde attribuut en de kopauteur rekent
  de writer uit de precieze gegevens uit (`composeIfcxDocument` in `projection.ts`). De lezer leest er niets uit, maar
  rekent dezelfde projectie na en weigert elk verschil (R2).

De status van een taak staat er niet: hij volgt uit de voortgang en de werkelijke datums, zoals de STEP-lezer hem ook
teruggeeft.

## Paden en identiteit

- Het pad van een object is de UUID van zijn GlobalId: dezelfde 128 bits, in kleine letters met streepjes en zonder
  voorloop-`/`. De GlobalId is die van de STEP-uitkomst (R1), dus wat STEP bij heropenen teruggeeft.
- Een GlobalId zonder geldige 128-bitsvorm (22 tekens, eerste teken `0`–`3`; de oude `ifcGuid` geeft dat niet altijd)
  krijgt als pad een UUID v5 van de GlobalId, en de GlobalId zelf staat in het veld `globalId` van het
  `openaec::ops::`-attribuut van dat object. Voor werkplan en werkschema zijn dat de velden `workplanGlobalId` en
  `scheduleGlobalId` van `openaec::ops::document`. De namespace is `fd4e93a2-de83-56ee-929c-defaa450b626`, de UUID v5
  van `urn:openaec:planner` in de URL-namespace van RFC 4122. Een pad dat niet bij zo'n GlobalId hoort, weigert de
  lezer met `invalid` en veld `globalId`.
- Het interne id van een object staat in het veld `id` van zijn `openaec::ops::`-attribuut als het afwijkt van het
  pad.
- Verwijzingen tussen objecten zijn paden: `parent`, `calendar` (van een taak en van het werkplan), `predecessor`,
  `successor` en `workplan`. De gedeelde kant draagt dezelfde paden als projectie (`parent`, `calendar`,
  `relatingProcess`, `relatedProcess`).

**R0, één regel voor alle soorten** (`IDENTITY_KINDS` en `identityProblems` in `identity.ts`): het interne id is uniek
binnen de soort; de GlobalId is uniek over alle objecten samen, project, werkplan en werkschema inbegrepen; een relatie
heeft een voorganger en een opvolger die bestaan; en een taak staat in de kinderlijst van hoogstens één ouder. De writer
weigert een botsing met `inconsistent`, met het veld (`<soort>.id`, `<soort>.globalId`, `sequence.predecessorId`,
`sequence.successorId` of `task.childIds`) en een melding met de namen: het dubbele id, de GlobalId met beide
eigenaren, de relatie met het ontbrekende doel, of het kind met beide ouders. Hij rekent nooit een vervangende
GlobalId uit. De lezer toetst hetzelfde op het model dat hij las en weigert met `invalid`.

De boom zelf (een kind dat niet bestaat, een ouder die het kind niet in zijn lijst heeft) valt niet onder R0: de
STEP-rondgang maakt de boom uit de kinderlijsten, zoals STEP hem bewaart.

## Attributen

Elk veld heeft in de veldtabel (`fieldTable.ts` en `fields/`) een volledig waardedomein, en lezer en writer toetsen
elke waarde met dezelfde functie (`checkValue`). Een tekst- of datumveld zonder vorm is een compileerfout. De vormen:

| Vorm | Domein | Velden |
|---|---|---|
| *tekst* | elke tekst | namen, omschrijvingen, `author`, `company`, `region` |
| *niet-lege tekst* | tekst van minstens één teken | `id`, `projectId`, `ruleSetId` |
| *datum* | een bestaande dag `YYYY-MM-DD` | `start`, `finish`, `endExclusive`, vrije en werkdagen van een kalender |
| *moment* | een bestaand moment in lokale tijd zonder zone, `YYYY-MM-DD[THH:MM[:SS[.sss]]]`, uren 00–23, minuten en seconden 00–59, of leeg | de momenten in `openaec::ops::task.time` |
| *projectmoment* | een bestaande dag of een bestaand moment in ISO 8601, met of zonder zone, tot 9 decimalen, of leeg | `startDate`, `endDate`, `createdAt`, `modifiedAt`, `statusDate` |
| *ISO-moment* | als *projectmoment*, niet leeg | `timestamp` in de kop |
| *GlobalId zonder 128-bitsvorm* | niet leeg, en geen geldige 22-tekens-GlobalId | `globalId`, `workplanGlobalId`, `scheduleGlobalId` |
| *versie* | `MAJOR.MINOR.PATCH` | `formatVersion`, `dataVersion` |
| *lagduur* | `P<dagen>D` of `PT<minuten>M`, met een minteken voor een lead | `timeLag` |
| *getal* | een eindig getal; `completion` alleen 0–1 | |
| *geheel getal* | een veilig geheel getal; `place` vanaf 0, `workDays` 1–7 | |
| *ja/nee*, *keuze*, *pad* | `true`/`false`; een van de genoemde waarden; een UUID | |

Een veld zonder "verplicht" mag ontbreken; `null` is nooit een geldige waarde.

### Werkplan

`openaec::ops::document`: `formatVersion` (verplicht, nu `1.0.0`), `name` (verplicht), `description`, `calendar` (pad,
verplicht: de projectkalender), `projectId`, `globalId`, `workplanGlobalId`, `scheduleGlobalId`, `startDate` en
`endDate` (de projectdatums zoals ingevoerd), `createdAt`, `modifiedAt`, `author`, `company`, `ifcSchema` (keuze
`IFC4X3_ADD2`, `IFC4X3`, `IFC4`: het schema voor een opslag als STEP), `ifcSchemaUnconfirmed`, `wbsAutoNumber`
(ja/nee), `defaultTaskDurationUnit` (keuze `days`, `hours`), `statusDate`. Er is één verwijzing naar de
projectkalender; `project.calendarId` is het id van die kalender.

`openaec::planning::workplan` (projectie): `name`, `description`, `start` en `finish` (de datum van de projectdatums),
`calendar` (pad).

### Werkschema

`openaec::planning::schedule`: `workplan` (pad, verplicht): het werkplan waar het schema bij hoort. Er is precies één.

### Kalender

`openaec::ops::calendar`: `id`, `globalId`, `name` (verplicht), `description`, `shift` (keuze `FIRST`, `SECOND`,
`THIRD`, `USERDEFINED`), `holidays` (lijst van `{ name, start, end }`; `end` ontbreekt bij een vrije periode zonder
einddatum), `workDays` (lijst van gehele getallen 1–7, maandag is 1, verplicht), `workStartHour`, `workEndHour`,
`hoursPerDay` (getallen, verplicht), `simpleBreakStartMinute`, `simpleBreakDurationMinutes`, `workTime`
(`{ byWeekday: { "1": [{ start, end }], …, "7": [ … ] } }`, minuten vanaf middernacht), `workingExceptions` (lijst
van `{ name, startDate, endDate, bands }`), `generation` (`{ ruleSetId, region, breakChoice, generatedFromYear,
generatedToYear }`, waarmee de feestdagen zijn gemaakt; `ruleSetId` is een van de landen in `HOLIDAY_COUNTRIES`, de
twee jaren liggen tussen 1000 en 9999).

`openaec::planning::calendar` (projectie): `name`, `description`, `predefinedType` (`FIRSTSHIFT`, `SECONDSHIFT`,
`THIRDSHIFT`, `USERDEFINED`, `IfcWorkCalendarTypeEnum`), `exceptionTimes` (de vrije dagen).

De app houdt de projectkalender twee keer bij: als `calendar` en als entry met hetzelfde id in de kalenderbibliotheek
(`syncProjectCalendar`). De STEP-rondgang geeft de bibliotheek terug zonder die entry, en zo schrijft IFCX haar ook;
de app zet de entry bij openen terug (`promoteProjectCalendarToLibrary`).

### Taak

`openaec::ops::task`: `id`, `globalId`, `name` (verplicht), `description`, `wbsCode`, `taskType` (keuze
`IfcTaskTypeEnum` zonder `NOTDEFINED`, verplicht), `isMilestone`, `priority`, `parent` (pad), `place` (geheel getal
vanaf 0), `durationType` (keuze `WORKTIME`, `ELAPSEDTIME`), `completion` (getal 0–1), `time` (verplicht, hieronder),
`milestoneKind` (keuze `START`, `FINISH`), `mandatory`, `isSummary`, `manuallyScheduled` (ja/nee), `calendar` (pad).

`time` draagt de precieze tijden: `durationUnit` (keuze `days`, `hours`), `scheduleDuration` (werkdagen),
`durationMinutes`, de momenten `scheduleStart`, `scheduleFinish`, `resume`, `stop`, `earlyStart`, `earlyFinish`,
`lateStart`, `lateFinish`, `actualStart`, `actualFinish`, de spelingen `freeFloat` en `totalFloat` (werkdagen) met
`freeFloatMinutes` en `totalFloatMinutes`, `isCritical`, `actualDuration`, `remainingTime` (werkdagen) en
`remainingMinutes`. Verplicht zijn `durationUnit`, `scheduleDuration`, `scheduleStart`, `scheduleFinish`, de vroege
en late momenten, `freeFloat`, `totalFloat` en `isCritical`.

`openaec::planning::activity` (projectie): `name`, `description`, `identification` (WBS-code), `parent`,
`predefinedType`, `isMilestone`, `priority`, `calendar`, `durationType`, `completion`, `start` en `endExclusive` (zie
*Datums*).

### Relatie

`openaec::ops::sequence`: `id`, `globalId`, `predecessor` en `successor` (paden, verplicht), `type` (keuze
`FINISH_START`, `START_START`, `FINISH_FINISH`, `START_FINISH`, verplicht), `lagUnit` (keuze `WORKTIME`,
`ELAPSEDTIME`), `lagDays` (ontbreekt bij 0), `lagMinutes`, `lagPercent`.

`openaec::planning::sequence` (projectie): `relatingProcess`, `relatedProcess`, `sequenceType` (`IfcSequenceEnum`),
`timeLag` of `timeLagRatio` (zie *Lag*), `lagDurationType`.

## Lag

Een lag schuift de opvolger op ten opzichte van de voorganger; negatief is een lead. De precieze kant draagt de lag
zoals de STEP-rondgang haar teruggeeft. STEP houdt er één: een percentage gaat voor (dan is `lagDays` 0), anders
minuten, anders dagen. De projectie:

- **Procent** (`timeLagRatio` = `lagPercent` / 100): een deel van de duur van de voorganger, bij elke berekening
  opnieuw uit de actuele duur bepaald en afgerond op hele dagen (dagtaken) of hele minuten (uurtaken), zoals MS Project.
- **Minuten** (`timeLag` = `PT<n>M`): een vaste lag in minuten. Bij `WORKTIME` zijn het werkminuten in de lagkalender
  van het project (projectoptie `lagCalendar`), bij `ELAPSEDTIME` gewone minuten.
- **Dagen** (`timeLag` = `P<n>D`): een vaste lag in werkdagen van de lagkalender, met een breuk als dat zo is
  ingevoerd. Bij `ELAPSEDTIME` zijn het kalenderdagen van 24 uur.

Is het getal niet als ISO-duur te schrijven (een getal in e-notatie), dan ontbreekt `timeLag`.

## Datums

De gedeelde datums zijn een projectie van de precieze tijden (ontwerp §5.3), met de getoonde start en het getoonde
einde van de taak (`shownStart` en `shownFinish` in `src/utils/taskDates.ts`):

- `start` is de datum van het startmoment;
- `endExclusive` is de datum van het eindmoment als dat precies 00:00 is, anders die datum plus één dag
  (1 juni 07:00–16:00 geeft 1 juni tot 2 juni; een einde op 3 juni 00:00 geeft 3 juni). Een einde zonder tijd, alleen
  een datum, telt tot het eind van die dag, zoals `finishInstant`: een einde op 2 juni geeft `endExclusive` 3 juni;
- een mijlpaal, of een taak waarvan het einde niet na de start ligt, krijgt `endExclusive` = startdatum plus één dag.

Een gedeelde datum die niet de projectie van de precieze tijden is, opent niet (R2).

## Volgorde onder een ouder

De taken staan in de volgorde van de takenlijst. De kinderen van een ouder komen in de lezer in de volgorde van hun
entries, behalve kinderen met een `place`: die komen op die plaats, en de andere vullen de open plaatsen in de volgorde
van hun entries. De writer geeft alleen een `place` aan de kinderen buiten een langste reeks die in de takenlijst en
onder de ouder in dezelfde volgorde staat (`childOrder.ts`). Een `place` die de writer zo niet zou schrijven (twee
kinderen op dezelfde plaats, een plaats buiten de lijst, een plaats op een taak zonder ouder) opent niet (R2).

## R1: schrijven is de STEP-rondgang

`writeIfcx` doet, in deze volgorde:

1. R0 op de invoer van de aanroeper (`inconsistent`);
2. `stepRoundtrip`: `writeIFC` op de invoer, dan `readIFC` op die tekst, met de aanmaak- en wijzigingsdatum van de
   invoer als terugval (`projectTimestampFallback`, dezelfde optie als de verliescontrole van de app; zonder die optie
   zou de STEP-lezer voor een lege datum het moment van lezen invullen). Weigert of breekt STEP af, dan weigert IFCX
   met `invalid`, `planning` en de reden van STEP;
3. `unsupportedContent` op de STEP-uitkomst: wat STEP bewaart en IFCX nog niet draagt, weigert de writer met
   `unsupported` en de veldnamen;
4. de projectie van de uitkomst (`composeIfcxDocument`) en de waardetoets met dezelfde functie als de lezer;
5. de zelfcontrole: één keer teruglezen (zonder R2) en rechtstreeks vergelijken met de STEP-uitkomst.

Het document van de aanroeper verandert niet; een proef vergelijkt het na de aanroep diep met een kopie van ervoor.
Wat STEP niet bewaart, bewaart IFCX dus niet: onbekende velden en onbekende leden van werkblokken, een enkele pauze
naast werkblokken, werkblokken op een dag die geen werkdag is, `interferingFloat`, `isNearCritical` en `floatPath`
(die schrijft STEP bewust niet meer), de kalender van een taak die niet bestaat, en `project.calendarId` als het niet
de projectkalender is. Wat STEP bij heropenen invult of rechtzet, staat er precies zo in: lege vroege en late datums,
de uurmaat uit de minuten, de voortgang en status uit de werkelijke datums, een dag die niet bestaat (30 februari wordt
2 maart), een oneindige lag (wordt 0), en de nieuwe id's van relaties en bibliotheekkalenders (`seq-ifc-<GlobalId>`,
`rescal-ifc-<GlobalId>`).

## R2: lezen toetst de projectie

De lezer ontleedt het bestand (kop, schema's, de vorm van elk veld volgens regel A, de soort van elke verwijzing),
bouwt het model uit de precieze kant en toetst R0. Daarna rekent hij met `composeIfcxDocument` uit wat de writer voor
dit model zou schrijven, en vergelijkt dat met het bestand (`assertProjection`):

- per pad elk attribuut en elk veld, gedeeld én precies, structureel (de volgorde van sleutels telt niet, die van
  lijsten wel);
- in de kop `id`, `dataVersion` en `author`; niet `timestamp`, dat per schrijfactie verschilt;
- een pad dat het bestand meer of minder heeft dan de projectie.

Het eerste verschil geeft `invalid` met pad, attribuut en veld in `place`, en een melding met het object (`taak <id>
(<naam>)`, `kalender <id>`, `relatie <id>`, het werkplan of het werkschema) en beide waarden. Attributen van een ander
dan Open Planner Studio staan er niet in, want die weigert de lezer al eerder met `foreign`.

Waarom alles en niet alleen de gedeelde kant: dan is er geen lijst van paren nodig, en weigert de lezer ook een bestand
waarin dezelfde informatie op twee precieze plekken verschilt, of een lijst tegenover een verwijzing, of de plaats in
de boom tegenover de volgorde. Elke afwijking van wat de writer zou schrijven, waar ook, is een verschil. Een proef
verandert elk gedeeld veld van een geschreven bestand één voor één (een andere waarde, weglaten, een element erbij) en
eist dat de lezer elk veranderd bestand weigert met `invalid`, met het veld en het pad van het object.

**Ronde 4, punt 8.** Een bestand dat R2 doorstaat, is wat de writer voor het gelezen model zou schrijven, maar dat model
hoeft geen uitkomst van de STEP-rondgang te zijn: een bestand met lege vroege datums, gedeeld en precies gelijk, doorstaat
R2. De lezer haalt het gelezen model daarom ook door de STEP-rondgang en geeft die uitkomst terug (`stepRoundtrip` aan
het eind van `readIfcxText`). Zo is wat `readIfcx` teruggeeft altijd wat STEP voor die planning teruggeeft. Weigeren als
de rondgang iets verandert, sluit ook, maar dan opent een eigen bestand niet meer zodra de STEP-rondgang ergens niet
herhaalbaar is; teruggeven doet wat STEP met een STEP-bestand van dezelfde planning doet. Zie *Metingen* voor wat het
bij openen kost.

## Wat verviel in fixronde 4

- **§5.3 van het ontwerp gaat voorlopig uit**: "de gedeelde waarde wint als haar projectie afwijkt". Een IFCX-bestand
  waarin de gedeelde gegevens niet de projectie van de precieze zijn, opent niet, met een melding die zegt welk veld en
  welk object. Het overnemen van wijzigingen door een ander programma wordt een eigen, later stuk.
- De tabel `DOUBLE_REPRESENTATIONS` met haar voorrangsregels, en `ifcxSharedDatesApplied`.
- De lijst van functies van de STEP-lezer die IFCX naboots (`normalizeAsOnOpen`, `copyAsStepWritesIt`); de
  STEP-rondgang vervangt ze.
- `CONSISTENCY_RULES` met haar twee doorgeeflagen; R0 is één aanroep van `identityProblems`.
- Negen uitzonderingen van de zelfcontrole en de compileerlijsten in `domainKeys.ts`; zie *Zelfcontrole*.
- De velden `libraryPlace`, `openaec::ops::document.calendarId`, `openaec::ops::task.calendarId` en de status van een
  taak: de STEP-rondgang geeft geen planning waarin ze iets dragen.

## Wat de writer weigert

`writeIfcx` schrijft niets en gooit een `IfcxWriteRefusedError`:

- `inconsistent`: R0, met de namen (zie *Paden en identiteit*);
- `invalid`: STEP weigert of breekt af (`planning`, met de reden van STEP), of een waarde in de projectie valt buiten
  haar domein (attribuut en veld in `fields`, het precieze veld eerst); ook een ongeldig moment van schrijven
  (`header.timestamp`);
- `unsupported`: de STEP-uitkomst heeft iets wat dit profiel nog niet draagt: resources, toewijzingen, baselines, codes,
  eigen velden, gebruikte taaktypes, de bibliotheek, het P6-bronarchief, en elk veld van project, kalender, taak of
  relatie dat geen veldgroep draagt (`unsupportedContent.ts`), met de veldnamen in `fields`;
- `self-check`: de eigen uitvoer leest niet terug, of geeft een andere planning dan de STEP-uitkomst (`fields` noemt de
  paden van de eerste verschillen).

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
- `invalid`: een kopveld buiten zijn domein (`header.<veld>`), een bestand zonder `imports`, `schemas` of profielversie,
  een eigen schema dat afwijkt van het profiel of ontbreekt, een bekend veld met een waarde buiten zijn domein (ook
  een dag of kloktijd die niet bestaat, en een getal als `1e999`), een verplicht veld dat ontbreekt, een verwijzing
  naar een pad van de verkeerde soort, een pad dat niet bij de GlobalId van het object hoort, R0, een verschil met de
  projectie (R2), of niet precies één werkschema.

`classifyIfcx` gebruikt dezelfde regel: `own` als de lezer het bestand leest, `foreign` bij `foreign`, `not-ifcx` bij
`not-ifcx`, en `unreadable` bij de andere codes. De lezer leest met `JSON.parse` (keuze T1); een dubbele sleutel ziet
hij niet (knownbug 2220).

## Controle van de schema's

`schemaCheck.ts` is de ene plek voor twee controles: elke attribuutwaarde tegen de veldtabel (een onbekend veld, een
verkeerd type, een getal dat geen geheel getal is en `null` gelden als fout), en elke definitie in `schemas` tegen die
van het profiel. `ifcxSchemaProblems` geeft dezelfde controles als lijst, voor proeven en gereedschap. De controle met
de echte validator van IFC5-development en met ifcx-explorer draait in een eigen workflow (F3-6).

## Zelfcontrole

Na het schrijven leest `writeIfcx` zijn eigen uitvoer één keer terug en legt het teruggelezen model rechtstreeks naast
de STEP-uitkomst (`selfCheck.ts`). De vergelijking is algemeen: elk veld telt mee, op elk niveau, met de volgorde van
lijsten; alleen een ontbrekend veld en `undefined` zijn hetzelfde. Twee regels laten iets weg:

| Regel | Wat | Waarom |
|---|---|---|
| `leesmeta` | `timeModel`, `recordedFields`, `recordedTimesOrigin`, `ifcLiteralCalendarIds` en de andere meldingen van een lezer | wat een lezer bij openen meegeeft over het bestand dat hij las, geen planningsgegeven |
| `nee-is-afwezig` | `minuteModelPending`, `importPristine` | de STEP-lezer zet ze op onwaar, de IFCX-lezer laat ze weg; dat betekent hetzelfde |

Elke regel heeft in `check-ifcx-kern.ts` een geval dat zonder die regel een verschil geeft. Een proef haalt elk precies
veld één voor één uit de veldtabel en eist dat `writeIfcx` dan weigert: in de zelfcontrole, of in de waardetoets als
het veld verplicht is. Zo faalt de zelfcontrole op een veld dat STEP bewaart en IFCX niet draagt (besluit 3 van Trias:
wat STEP zelf ook laat vallen, is geen fout).

## Metingen

CPU-tijd in één proces (`process.cpuUsage`), mediaan van vijf, op aia09-mp50 (AMD Ryzen 7 3700U), 24 november 2026,
belasting rond 3, met de planning van de meting van stap 1 (`check-ifcx-meting.ts`):

| Taken | Opslaan als IFC | `writeIfcx` (rondgang en zelfcontrole) | Verhouding | `readIfcx` (openen) |
|---|---|---|---|---|
| 1.000 | 151 ms | 415 ms | 2,75 | 214 ms |
| 5.000 | 760 ms | 2.087 ms | 2,75 | 1.367 ms |
| 10.000 | 1.686 ms | 4.548 ms | 2,70 | 2.922 ms |

Bij 10.000 taken: STEP-writer 1.686, STEP-lezer 1.261, IFCX-writer zonder rondgang 524, teruglezen 601, vergelijking
283 ms. De grens van de technisch eigenaar (24 november): `writeIfcx` hoogstens vier keer opslaan als IFC en hoogstens
4 s CPU-tijd bij 10.000 taken. `check-ifcx-meting.ts` toetst beide in de planningssuite. Dezelfde STEP-writer mat om
09:10 op dezelfde planning 1.061 ms; de verhouding hangt niet van de machine af, de absolute tijd wel.

## Uitbreiden (F3-2 en F3-3)

Onder R1 en R2 is uitbreiden drie dingen:

- **Velden met een vorm.** Elk nieuw feit krijgt een veld in een precies attribuut (`fields/`, sleutel, vorm,
  schrijven en lezen samen), weggelaten bij de standaardwaarde, en waar er een gedeelde woordenschat is een veld in
  het gedeelde attribuut dat alleen schrijft. De domeinvelden die een groep draagt, staan in `carries`
  (`fieldGroups.ts`); daaruit volgen het schema, de waardetoets, `unsupportedContent` en R2.
- **Een soort in de identiteitslijst.** Een nieuwe soort object (resource, toewijzing, baseline) komt als regel in
  `IDENTITY_KINDS` met zijn verwijzingen, en als node in `projection.ts` en `ifcxReader.ts` (`NODE_SHAPES`).
- **Een planning met de gegevens in de proef.** In `STEP_CASES` (de R1-lus: heen en terug gelijk aan de
  STEP-rondgang) en in `maximalPlan` of `variantPlan`, zodat de veldproef, de R2-lus en de proef die elk precies veld
  weghaalt het nieuwe veld zien. Voor F3-2: een kostenresource met een toewijzing. Voor F3-3: een geval per nieuwe
  betekenis.

Geen eigen normalisatie, geen tabel van dubbele voorstellingen en geen nieuwe uitzondering in de zelfcontrole: wat STEP
bij openen doet, komt uit de rondgang.

De proef is `tests/planning/check-ifcx-kern.ts`; de voorbeeldbestanden in `tests/fixtures/ifcx/eigen/` maak je opnieuw
met `OPS_IFCX_FIXTURES_WRITE=1 bash tests/planning/run.sh check-ifcx-kern.ts`. De meting is
`tests/planning/check-ifcx-meting.ts`; met `OPS_IFCX_MEASURE=1` geeft ze ook de tabel per stuk.
