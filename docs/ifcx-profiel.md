# Het IFCX-profiel van Open Planner Studio

Dit document beschrijft hoe Open Planner Studio een planning in IFCX schrijft en leest: de kop, de paden, de
attributen met hun velden, de vorm en betekenis van elk veld, de projectie naar de gedeelde attributen, de betekenis
van lag, de regels R0, R1, R3 en R4 (R2 ging op in R4), en de versieregel. Het ontwerp staat in
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

## De maat en de regels

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
- **R2 (lezen, sinds fixronde 6 opgegaan in R4):** "de gedeelde gegevens in het bestand zijn precies de projectie van de precieze. De lezer leest de
  precieze kant, rekent met de projectie van de writer uit wat er gedeeld had moeten staan, en vergelijkt dat met het
  bestand. Elk verschil is `invalid`." Code: `assertProjection` in `ifcxReader.ts`, met `composeIfcxDocument` uit
  `projection.ts`, dezelfde functie als de writer. Sinds fixronde 6 is dat de vergelijking van R4.

In fixronde 5 vond de review drie plekken waar informatie niet één-op-één werd gedragen: de zelfcontrole liet een deel
van wat STEP teruggeeft buiten de vergelijking (een eindmijlpaal schoof bij heropenen van 16:00 naar 07:00), de
precieze kant droeg de lag twee keer (acht dagen naast 25 %), en twee verschillende GlobalIds konden hetzelfde pad
krijgen. De technisch eigenaar keurde drie aanscherpingen goed (24 november), letterlijk:

- **R1 volledig:** ""Wat STEP zou teruggeven" is alles wat de STEP-lezer teruggeeft en wat de laadgrens of een
  volgende opslag gebruikt: het model én wat de lezer daarnaast doorgeeft (`AtDayEnd`, `ifcLiteralCalendarIds`, de
  toestand van het minutenmodel, en wat je verder vindt). De precieze kant draagt het, de zelfcontrole vergelijkt
  het." En: "READ_METADATA mag alleen het leesmoment zelf bevatten, met reden." Zie *Wat de STEP-lezer naast het
  model teruggeeft*.
- **De publieke lezer geeft het gecontroleerde precieze model terug.** "De STEP-rondgang bij openen (jouw punt 8) gaat
  eruit." Zie *R2: lezen toetst de projectie*, punt 8.
- **R3 (nieuw):** "de precieze kant draagt elk feit één keer, in de vorm waarin STEP het bewaart; identiteit en pad zijn
  één-op-één." Met "Eén lag met eenheid in de precieze kant; de gedeelde kant is daar de projectie van" en "Een padvorm
  waarin een oude tekst-GlobalId en een echte IFC-GlobalId nooit hetzelfde pad geven, door de vorm zelf en niet door
  een andere hash-namespace. Schrijver en lezer gebruiken dezelfde ene functie, heen en terug." Zie *R3: elk feit één
  keer* en *Paden en identiteit*.

**Fixronde 6: R4.** Zes reviewrondes naast elkaar laten één patroon zien. De schrijfkant is sinds R1 dicht: de
schrijver schrijft alleen wat een STEP-rondgang ervan maakt. Alle blokkades van ronde 4, 5 en 6 zaten aan de leeskant:
de lezer aanvaardde bestanden die de eigen schrijver nooit schrijft, en hij toetste ze veld voor veld en met losse
regels (R0, R2, R3). Elke ronde vond de review een combinatie van op zich geldige velden die STEP anders zou maken
(ronde 6: een dagtaak met een tweede duur in minuten, een project op het lege tekstpad, een werkelijk einde met 50 %
voortgang). Besluit van de technisch eigenaar, letterlijk: "Ja op R4: de lezer aanvaardt een bestand alleen als de
eigen schrijver het voor de gelezen planning precies zo zou schrijven, als toets die weigert met het eerste verschil
(object en veld), nooit als reparatie. R0, R2 en R3 mogen opgaan in R4 waar R4 ze dekt; de vormtoets vóór het lezen
blijft. Het past bij "de kern opent uitsluitend het eigen profiel"." Zie *R4: het bestand is een vast punt van de eigen
schrijver*.

## Het bestand

```json
{
  "header": { "id": "urn:openaec:planner:<pad van het project>", "ifcxVersion": "ifcx_alpha", "dataVersion": "1.0.0",
              "author": "…", "timestamp": "2026-11-24T08:00:00.000Z" },
  "imports": [],
  "schemas": { "openaec::planning::activity": { "value": { "dataType": "Object", "objectRestrictions": { … } } }, … },
  "data": [ { "path": "<pad>", "attributes": { "openaec::planning::activity": { … }, "openaec::ops::task": { … } } }, … ]
}
```

- **Kop**: `id` is `urn:openaec:planner:` met het pad van de GlobalId van het project (zie *Paden en identiteit*). `ifcxVersion` is `ifcx_alpha`,
  `dataVersion` heeft de vorm `MAJOR.MINOR.PATCH`. `author` is de projectie van de auteur van het project, of
  `Open Planner Studio` als die leeg is. `timestamp` is het moment van schrijven (ISO 8601, UTC). De kop heeft een
  waardedomein zoals elk attribuut (`HEADER_VALUE` in `ownAttributes.ts`); writer en lezer toetsen hem met dezelfde
  functie.
- **`imports`** is altijd leeg. De app schrijft geen `bsi::ifc::class`, geen `children` en geen `inherits`.
- **`schemas`** bevat voor elk attribuut dat in het bestand voorkomt de definitie. Die komt uit dezelfde tabel als het
  schrijven en lezen (de registratie per node in `nodes.ts`).
- **`data`**: één entry per object, in deze volgorde: werkplan, werkschema, projectkalender, de andere kalenders,
  taken (in de volgorde van de takenlijst), relaties. Elke entry staat op één regel.

## Twee kanten: precies en gedeeld

Elk object heeft een precies attribuut in `openaec::ops::` en een gedeeld attribuut in `openaec::planning::`.

- **De precieze kant draagt elk feit, één keer** (R3). De lezer leest alleen `openaec::ops::`. Een veld staat er niet
  als het de standaardwaarde heeft: een lege tekst, prioriteit 500, geen mijlpaal, `WORKTIME`, voortgang 0, geen lag,
  het id dat uit het pad volgt (`cal-default` voor de projectkalender, het pad uit de kop voor het project), de plaats
  onder de ouder die uit de volgorde van de entries volgt, en de ingevulde velden die uit de waarden volgen.
- **De gedeelde kant is alleen de projectie** voor andere programma's: het gedeelde attribuut en de kopauteur rekent
  de writer uit de precieze gegevens uit (`composeIfcxDocument` in `projection.ts`). De lezer leest er niets uit, maar
  rekent dezelfde projectie na en weigert elk verschil (R2).

De status van een taak staat er niet: hij volgt uit de voortgang en de werkelijke datums, zoals de STEP-lezer hem ook
teruggeeft.

## Paden en identiteit

Het pad van een object volgt uit zijn GlobalId, met één functie heen en terug (`pathOfGlobalId` en `globalIdOfPath` in
`identityPath.ts`). De GlobalId is die van de STEP-uitkomst (R1), dus wat STEP bij heropenen teruggeeft.

- Een **compacte IFC-GlobalId** (22 tekens uit het IFC-alfabet, eerste teken `0`–`3`: precies 128 bits) krijgt als pad
  de UUID van die 128 bits, in kleine letters met streepjes.
- **Elke andere tekst** (een oude `ifcGuid`, een GlobalId van een ander programma) krijgt als pad `t-` gevolgd door
  vier kleine hexcijfers per UTF-16-teken: `oud-1` wordt `t-006f00750064002d0031`.
- De lezer kent alleen deze twee vormen. Een `t-`-pad dat een compacte GlobalId uitspelt, is geen pad: die GlobalId
  heeft haar UUID als enige pad. Een UUID met hoofdletters is ook geen pad.

**Waarom dat één-op-één is.** Binnen de eerste vorm is de afbeelding een omzetting van dezelfde 128 bits, heen en
terug. Binnen de tweede vorm geeft elk teken vier vaste cijfers, dus verschillende teksten geven verschillende paden en
het pad geeft de tekst terug. Tussen de twee vormen botst niets: een pad begint met `t-` of heeft de vorm van een UUID,
nooit allebei. En elke GlobalId heeft precies één vorm, omdat de tweede vorm geen compacte GlobalId aanneemt. De
oude afbeelding (een UUID v5 van de tekst) gaf een tekst en de compacte GlobalId van diezelfde UUID hetzelfde pad; een
andere namespace verschuift die botsing alleen. Een proef toetst de afbeelding zelf op ruim 7.500 GlobalIds, waaronder
ruim 1.500 paren die onder de oude afbeelding botsten.

- Het interne id van een object staat in het veld `id` van zijn `openaec::ops::`-attribuut als het afwijkt van het
  pad.
- Verwijzingen tussen objecten zijn paden: `parent`, `calendar` (van een taak en van het werkplan), `literalCalendars`,
  `predecessor`, `successor` en `workplan`. De gedeelde kant draagt dezelfde paden als projectie (`parent`,
  `calendar`, `relatingProcess`, `relatedProcess`).

**R0, één regel voor alle soorten** (`IDENTITY_KINDS` en `identityProblems` in `identity.ts`): het interne id is uniek
binnen de soort, en binnen de kalenderbibliotheek; de GlobalId is uniek over alle objecten samen, project, werkplan en werkschema inbegrepen; een relatie
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
| *versie* | `MAJOR.MINOR.PATCH` | `formatVersion`, `dataVersion` |
| *lagduur* | `P<dagen>D` of `PT<minuten>M`, met een minteken voor een lead | `timeLag` |
| *getal* | een eindig getal; `completion` alleen 0–1 | |
| *geheel getal* | een veilig geheel getal; `place` vanaf 0, `workDays` 1–7 | |
| *ja/nee*, *keuze*, *pad* | `true`/`false`; een van de genoemde waarden; een pad in een van de twee vormen van *Paden en identiteit* | |

Een veld zonder "verplicht" mag ontbreken; `null` is nooit een geldige waarde.

### Werkplan

`openaec::ops::document`: `formatVersion` (verplicht, nu `1.0.0`), `name` (verplicht), `description`, `calendar` (pad,
verplicht: de projectkalender), `projectId`, `startDate` en `endDate` (de projectdatums zoals ingevoerd), `createdAt`,
`modifiedAt`, `author`, `company`, `ifcSchema` (keuze `IFC4X3_ADD2`, `IFC4X3`, `IFC4`: het schema voor een opslag als
STEP), `ifcSchemaUnconfirmed`, `wbsAutoNumber` (ja/nee), `defaultTaskDurationUnit` (keuze `days`, `hours`),
`statusDate`, en de laadgegevens van R1 volledig: `timeModel` (het tijdmodel dat STEP teruggeeft, nu `MINUTES-1`; het
ontbreekt bij een oude planning met een openstaande omzetting naar het minutenmodel, zoals STEP het dan ook weglaat),
`importPristine` (ja, als STEP de planning als ongewijzigd sinds een import teruggeeft) en `literalCalendars` (lijst
van paden: de kalenders waarvan STEP de tijden letterlijk schreef, in de volgorde van STEP). Er is één verwijzing naar
de projectkalender; `project.calendarId` is het id van die kalender.

`openaec::planning::workplan` (projectie): `name`, `description`, `start` en `finish` (de datum van de projectdatums),
`calendar` (pad).

### Werkschema

`openaec::planning::schedule`: `workplan` (pad, verplicht): het werkplan waar het schema bij hoort. Er is precies één.

### Kalender

`openaec::ops::calendar`: `id`, `name` (verplicht), `description`, `shift` (keuze `FIRST`, `SECOND`,
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
de app zet de entry bij openen terug (`promoteProjectCalendarToLibrary`). R0 toetst eerst de ids binnen de
bibliotheek (twee rijen met hetzelfde id weigert de writer met `inconsistent`, `calendar.id` en het id), en behandelt
daarna de cache en de ene bibliotheekrij met hetzelfde id als één kalender.

### Taak

`openaec::ops::task`: `id`, `name` (verplicht), `description`, `wbsCode`, `taskType` (keuze `IfcTaskTypeEnum` zonder
`NOTDEFINED`, verplicht), `isMilestone`, `priority`, `parent` (pad), `place` (geheel getal vanaf 0), `durationType`
(keuze `WORKTIME`, `ELAPSEDTIME`), `completion` (getal 0–1), `time` (verplicht, hieronder), `milestoneKind` (keuze
`START`, `FINISH`), `mandatory`, `isSummary`, `manuallyScheduled` (ja/nee), `calendar` (pad), en de laadgegevens van
R1 volledig: `atDayEnd` (ja: STEP geeft de taak terug als mijlpaal aan het eind van de dag, `OPS_Milestone.AtDayEnd`;
de laadgrens zet zo'n mijlpaal zonder soort op 16:00 in plaats van 07:00). Welke tijdvelden ingevuld zijn
(`recordedFields`), volgt uit de velden met een waarde (zie *Wat de STEP-lezer naast het model teruggeeft*).

`time` draagt de precieze tijden: `durationUnit` (keuze `days`, `hours`), `scheduleDuration` (werkdagen; bij een uurtaak
met minuten op een kalender met werktijd ontbreekt het, want STEP leidt het dan uit de minuten af en de lezer doet
dat ook), `durationMinutes`, de momenten `scheduleStart`, `scheduleFinish`, `resume`, `stop`, `earlyStart`, `earlyFinish`,
`lateStart`, `lateFinish`, `actualStart`, `actualFinish`, de spelingen `freeFloat` en `totalFloat` (werkdagen) met
`freeFloatMinutes` en `totalFloatMinutes`, `isCritical`, `actualDuration`, `remainingTime` (werkdagen; ontbreekt bij een uurtaak met
`remainingMinutes`, om dezelfde reden) en `remainingMinutes`. Verplicht zijn `durationUnit`, `scheduleStart`,
`scheduleFinish`, de vroege en late momenten, `freeFloat`, `totalFloat` en `isCritical`; `scheduleDuration` ook, behalve
bij de afgeleide uurtaak (R4 weigert het daar).

`openaec::planning::activity` (projectie): `name`, `description`, `identification` (WBS-code), `parent`,
`predefinedType`, `isMilestone`, `priority`, `calendar`, `durationType`, `completion`, `start` en `endExclusive` (zie
*Datums*).

### Relatie

`openaec::ops::sequence`: `id`, `predecessor` en `successor` (paden, verplicht), `type` (keuze `FINISH_START`,
`START_START`, `FINISH_FINISH`, `START_FINISH`, verplicht), `lagUnit` (keuze `WORKTIME`, `ELAPSEDTIME`), `lag`
(`{ amount, unit }`, `unit` is `DAYS`, `MINUTES` of `PERCENT`; ontbreekt bij een lag van 0 dagen).

`openaec::planning::sequence` (projectie): `relatingProcess`, `relatedProcess`, `sequenceType` (`IfcSequenceEnum`),
`timeLag` of `timeLagRatio` (zie *Lag*), `lagDurationType`.

## Lag

Een lag schuift de opvolger op ten opzichte van de voorganger; negatief is een lead. STEP heeft er één slot voor en
kiest: een percentage gaat voor, anders minuten, anders dagen. De precieze kant draagt die ene waarde met haar eenheid
(`lag`), en de lezer zet haar terug zoals de STEP-lezer: bij `PERCENT` en `MINUTES` is `lagDays` 0. Een tweede lagveld
naast `lag` bestaat niet; zo'n veld weigert de lezer als onbekend (`newer-profile`, met veld en object). De projectie:

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

Stap 1 tot en met 4 zijn één functie, `ownFileFor` in `ownFile.ts`. Na stap 2 zet die functie de planning zoals ze na
heropenen is: een GlobalId die STEP leeg teruggeeft, krijgt de afgeleide GlobalId die de volgende STEP-opslag ook zou
schrijven (een lege GlobalId telt overal als afwezig, ook in R0), en de ingevulde tijdvelden zijn de velden met een
waarde. De lezer roept dezelfde functie aan (R4).

5. de zelfcontrole: één keer teruglezen (zonder R2) en rechtstreeks vergelijken met de hele STEP-uitkomst, het model
   en alles wat de STEP-lezer ernaast teruggeeft (R1 volledig).

Het document van de aanroeper verandert niet; een proef vergelijkt het na de aanroep diep met een kopie van ervoor.
Wat STEP niet bewaart, bewaart IFCX dus niet: onbekende velden en onbekende leden van werkblokken, een enkele pauze
naast werkblokken, werkblokken op een dag die geen werkdag is, `interferingFloat`, `isNearCritical` en `floatPath`
(die schrijft STEP bewust niet meer), de kalender van een taak die niet bestaat, en `project.calendarId` als het niet
de projectkalender is. Wat STEP bij heropenen invult of rechtzet, staat er precies zo in: lege vroege en late datums,
de uurmaat uit de minuten, de voortgang en status uit de werkelijke datums, een dag die niet bestaat (30 februari wordt
2 maart), een oneindige lag (wordt 0), en de nieuwe id's van relaties en bibliotheekkalenders (`seq-ifc-<GlobalId>`,
`rescal-ifc-<GlobalId>`).

## R4: het bestand is een vast punt van de eigen schrijver

`readIfcx` doet, in deze volgorde:

1. **De vormtoets** (blijft, want zonder haar kan de lezer niet veilig lezen): JSON en UTF-8, de kop en zijn domein,
   `imports` leeg, de schema's, de padvorm van elk pad (de decoder geeft de gelezen GlobalId direct aan het object),
   geen `children` of `inherits`, één bijdrage per attribuut per pad, de profielversie (`newer-profile`), de vorm van
   elk veld volgens regel A, de soort van elk object, precies één werkplan en één werkschema, en de soort van elke
   verwijzing.
2. **Het model** uit de precieze kant, met de afleiding die het bestand niet draagt (de dagwaarden van een uurtaak, de
   status, de ingevulde tijdvelden).
3. **R4**: de lezer zet het gelezen model door de laadgrens en de opslaginvoer van de app (`savedAfterOpening`:
   `payloadFromImport`, daarna `buildWriteIFCInput`), en geeft dat aan dezelfde functie als `writeIfcx`
   (`ownFileFor` in `ownFile.ts`: R0, de STEP-rondgang, de planning na heropenen, de weigering van wat de kern nog niet
   draagt, de projectie en de waardetoets). Daarna vergelijkt hij het resultaat met het bestand: de kop (`id`,
   `ifcxVersion`, `dataVersion`, `author`), de schema's, en elk object in volgorde, elk attribuut, gedeeld en precies,
   elk veld, ook wat het bestand méér of minder heeft. Ten slotte vergelijkt hij het model dat de schrijver zou opslaan
   met het gelezen model.
4. Bij een verschil weigert hij met `invalid` en het eerste verschil: het object en het veld in `place` en in de
   melding, met wat het bestand had en wat de eigen schrijver schrijft. Hij repareert niets. Weigert de schrijver de
   gelezen planning zelf (R0), dan noemt de melding de namen zoals bij schrijven.
5. Is er geen verschil, dan geeft hij het gelezen model terug. Het is dan gelijk aan wat de schrijver opslaat.

**Het eerste verschil** zoekt de lezer in drie rondes over het hele bestand: eerst een veld of object dat het bestand
draagt en dat de schrijver voor deze planning helemaal niet schrijft, dan een veld met een andere waarde, en dan wat
het bestand mist. In elke ronde komen de kop, de schema's en de objecten in volgorde, en per object de precieze kant
vóór de gedeelde. Zo wijst de melding naar wat het bestand zelf zegt, en niet naar een gevolg. Een dagtaak met
`remainingMinutes` naast een restduur in dagen laat STEP bijvoorbeeld de hele kalender letterlijk schrijven, maar de
melding noemt `time.remainingMinutes` van de taak.

**Eerst één snelle doorgang.** Vóór die drie rondes kijkt de lezer in één doorgang of het bestand precies het eigen
bestand is (`sameFile` in `ifcxReader.ts`): de vier kopvelden, en de schema's en de data als JSON, met dezelfde
sleutels, even lange lijsten en elke waarde gelijk (`===`). Pas als die doorgang een verschil ziet, volgen de
waardetoets van de schrijver op de attributen en de drie rondes. De doorgang vergelijkt dezelfde paren als de rondes en
is strenger, dus ziet zij geen verschil, dan vinden de rondes er ook geen. Is het bestand precies het eigen bestand, dan
geeft de waardetoets van de schrijver op elke waarde dezelfde uitkomst als de waardetoets van de lezer op het bestand,
en die slaagde al. De kop toetst de schrijver altijd. Oordeel en melding zijn daardoor dezelfde als zonder snelle
doorgang: voor de 48 bestanden en 2089 mutaties van de kernproef byte voor byte vastgelegd tegen de head ervóór.

**Waarom via de laadgrens.** De STEP-rondgang op haar eigen uitkomst is niet altijd een vast punt: de D7-mijlpaal
verliest `AtDayEnd` en een oude planning krijgt een `TimeModel`, omdat de STEP-writer de planning na de laadgrens
verwacht. Met de route van de app (openen, dan opslaan) is ze dat wel, voor alle voorbeelden en gevallen van de
kernproef. R4 toetst dus precies wat een planner doet: openen en weer opslaan geeft hetzelfde bestand.

**Wat buiten de vergelijking valt**, met de reden:

- `header.timestamp`: het moment van schrijven, geen planningsgegeven; elke schrijfactie geeft een ander.
- De opmaak van de JSON: witruimte en de volgorde van sleutels binnen een object (JSON kent die volgorde geen betekenis
  toe). De volgorde van lijsten en van de objecten in `data` telt wel.
- Het leesmoment: dat komt niet in de vergelijking, want de STEP-rondgang krijgt de aanmaak- en wijzigingsdatum van het
  bestand als terugval.

Alles daarbuiten is een verschil.

**Wat een schrijver van een ander programma moet doen.** Het profiel eist een vast punt: een bestand opent alleen als
de schrijver van Open Planner Studio voor de planning die erin staat precies dat bestand schrijft. Een ander programma
moet dus dezelfde paden, dezelfde precieze en gedeelde velden met dezelfde waarden (de standaardwaarden weggelaten, de
afgeleide waarden niet geschreven), dezelfde schema's en dezelfde volgorde schrijven; in de praktijk: via deze kern. Een
bestand dat een ander programma wijzigde, opent niet. Bestanden van anderen horen bij fase 4.

**Welke losse toetsen aan de leeskant opgingen in R4**, en welke bleven:

| Toets | Nu | Reden |
|---|---|---|
| `assertProjection` (R2) | weg | R4 vergelijkt de gedeelde én de precieze kant met wat de schrijver schrijft |
| `identityProblems` bij lezen (R0) | weg als eigen aanroep | `ownFileFor` doet R0 op de gelezen planning; de melding noemt de namen zoals bij schrijven |
| de vormtoets per veld (regel A) | blijft | nodig om veilig te lezen, en ze geeft `newer-profile` voor een onbekend veld |
| de padvorm, één bijdrage per attribuut, de soort van een object en van een verwijzing, één werkplan en één werkschema | blijft | nodig om het model te kunnen bouwen |
| de profielversie | blijft | geeft `newer-profile` vóór de vormtoets |
| de schema's | blijft | geeft `foreign` of `newer-profile` voor een onbekend schema; R4 vergelijkt de schema's daarnaast in hun geheel |
| één feit, één veld (R3) | weg als toets | een tweede veld voor een feit schrijft de schrijver niet, dus R4 weigert het |
| de afleiding voor uurtaken | blijft, als modelopbouw | het bestand draagt de afgeleide dagwaarde niet; R4 weigert een bestand dat haar wel draagt |

**Punt 8.** Een bestand met lege vroege en late datums schrijft de eigen schrijver niet: hij schrijft de STEP-uitkomst,
waarin ze ingevuld zijn. Sinds fixronde 6 opent zo'n bestand daarom niet; de melding noemt de taak en
`time.earlyStart`.

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

## Wat verviel in fixronde 5

- De STEP-rondgang aan het eind van `readIfcxText`; de lezer geeft het precieze model terug.
- `READ_METADATA`, `SELF_CHECK_RULES` en beide regels (`leesmeta`, `nee-is-afwezig`); de zelfcontrole vergelijkt alles.
- De velden `globalId`, `workplanGlobalId` en `scheduleGlobalId`, de UUID v5 en haar namespace (`globalIdUuid.ts`);
  het pad draagt de GlobalId.
- `lagDays`, `lagMinutes` en `lagPercent` in `openaec::ops::sequence`; er is één `lag`.
- `fieldGroups.ts`, `lagFromShared`, `momentOfSharedDate` en de lege leesfuncties van de gedeelde velden: de gedeelde
  kant heeft alleen vorm en schrijver (`SharedField`), de precieze vorm, schrijver en lezer (`IfcxField`).

## Wat verviel in fixronde 6

- `assertProjection` en de aanroep van `identityProblems` in de lezer; R4 doet het.
- Het veld `recorded` van `openaec::ops::task` (zie hieronder).
- `DocumentReadTarget.formatVersion`, de tweede keuze van de lageenheid (de gedeelde lag volgt nu uit de ene precieze)
  en de tweede decodering van elk pad.

## Wat de STEP-lezer naast het model teruggeeft

R1 volledig vraagt een indeling van elk veld dat de STEP-lezer teruggeeft. Die staat op één plek: `MODEL_KEYS` in
`nodes.ts` noemt elke sleutel van `WriteIFCInput` (een ontbrekende of extra sleutel is een compileerfout), en elke
sleutel is óf van een node (`modelKeys` in de registratie), óf van het pad (`ifcGlobalIds`), óf nog niet gedragen
(`STEP_WRITER_INPUT_NOT_CARRIED`, dat de writer met `unsupported` weigert zodra het iets draagt). Een proef eist dat elk
veld dat de STEP-lezer voor de voorbeelden en de proefplanningen teruggeeft, in die indeling staat. Er is geen lijst
van uitzonderingen meer: de zelfcontrole vergelijkt elk veld.

De velden die tot fixronde 4 buiten de vergelijking bleven:

| Veld | Nu | Waarom |
|---|---|---|
| `timeModel` | `openaec::ops::document.timeModel` | de laadgrens zet zonder `MINUTES-1` een omzetting naar het minutenmodel open |
| `milestonesAtDayEnd` | `openaec::ops::task.atDayEnd` | de laadgrens zet een mijlpaal zonder soort aan het eind van de dag (16:00) |
| `ifcLiteralCalendarIds` | `openaec::ops::document.literalCalendars` | een volgende opslag houdt die kalenders letterlijk |
| `recordedFields` | de velden met een waarde (sinds fixronde 6; in fixronde 5 `openaec::ops::task.recorded`) | zie hieronder |
| `recordedTimesOrigin` | vast `ifc-own`: een IFCX-bestand is altijd een eigen bestand | de laadgrens kiest daarmee tussen verse import en heropening |
| `importPristine` | `openaec::ops::document.importPristine` | "datums zoals opgeslagen" gaat bij een ongewijzigde import vanzelf aan |
| `minuteModelPending` | via `timeModel` (STEP laat `TimeModel` weg, IFCX ook) | alleen invoer van de writer; de STEP-lezer geeft het niet terug |
| `recordedTimes`, `xerOrigin`, `xerArchiveIssue`, `baselineOrphanGuids` | nog niet gedragen, weigert de writer | volgen uit het XER-archief en de baselines (F3-2 en F3-3); zonder die inhoud geeft STEP ze niet terug |
| `xerMissingPlannedStarts`, `p6xmlReport`, `msProjectReport`, `sourceScheduleNotes`, `suggestedProfileId`, `ifcLegacySchemaLoss` | nog niet gedragen, weigert de writer | meldingen van andere lezers over hun bronbestand; de STEP-lezer geeft ze voor een eigen bestand niet terug, dus ze zijn er nooit |

**`recordedFields` en R4.** De eerste STEP-lezing kan voor een taak minder ingevulde velden noemen dan er waarden zijn:
STEP vult lege vroege en late datums bij het lezen in, en noemt ze dan niet als ingevuld. Dat overleeft openen en
opnieuw opslaan niet: de opslaginvoer van de app draagt `recordedFields` niet, dus de volgende STEP-opslag schrijft
alle waarden en de lezing daarna noemt ze alle. Met `recorded` in het bestand was een eigen bestand daarom geen vast
punt, en R4 zou het weigeren. Sinds fixronde 6 draagt IFCX de ingevulde velden zoals STEP ze na één keer opnieuw
opslaan teruggeeft: de velden met een waarde. Bij openen heeft het verschil voor een eigen bestand geen gevolg zolang
`recordedSourceFormat` niet gedragen wordt ("datums zoals opgeslagen" gaat dan niet aan).

Het leesmoment zelf (de aanmaak- en wijzigingsdatum die de STEP-lezer invult als het bestand ze leeg laat) staat niet
in die lijst: de STEP-rondgang krijgt de datums van de invoer als terugval (`projectTimestampFallback`), dus het is
geen veld van de uitkomst.

## R3: elk feit één keer

De precieze kant draagt elk feit één keer, in de vorm waarin STEP het bewaart. De plekken waar de STEP-writer uit twee
domeinvelden kiest wat hij in één slot schrijft:

| Feit | Domeinvelden | STEP-slot | Precies veld |
|---|---|---|---|
| lag | `lagDays`, `lagMinutes`, `lagPercent` | `IfcLagTime.LagValue` (verhouding, of duur in minuten of dagen) | `lag` `{ amount, unit }` |
| duur van een uurtaak | `durationMinutes`, `scheduleDuration` | `ScheduleDuration` in minuten | `time.durationMinutes`; `scheduleDuration` leidt de lezer af zoals STEP (`hourTaskScheduleDuration`) |
| restduur van een uurtaak | `remainingMinutes`, `remainingTime` | `RemainingTime` in minuten | `time.remainingMinutes`; `remainingTime` leidt de lezer af zoals STEP (`hourRemainingDays`) |

De spelingen (`totalFloat` met `totalFloatMinutes`, `freeFloat` met `freeFloatMinutes`) staan er niet in: STEP bewaart
daar beide waarden (het slot in minuten en een eigen record met de dagen), dus het zijn twee feiten.

Een proef pint R3 met één lus: voor geschreven bestanden verandert ze elk precies veld één voor één in een andere
geldige waarde, laat het weg of voegt het toe, en eist dat de lezer een model teruggeeft waarvan de projectie precies
het veranderde bestand is en dat van het oude model verschilt, of weigert met het veld en het object in de melding.

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
  `openaec::planning::`-attribuut, een pad dat geen identiteitspad is (zie *Paden en identiteit*), twee bijdragen van één attribuut op één pad, een pad
  waarvan de attributen samen geen planningsobject vormen, of niet precies één eigen werkplan;
- `invalid`: een kopveld buiten zijn domein (`header.<veld>`), een bestand zonder `imports`, `schemas` of profielversie,
  een eigen schema dat afwijkt van het profiel of ontbreekt, een bekend veld met een waarde buiten zijn domein (ook
  een dag of kloktijd die niet bestaat, en een getal als `1e999`), een verplicht veld dat ontbreekt, een verwijzing
  naar een pad van de verkeerde soort, niet precies één werkschema, of een verschil met wat de eigen schrijver voor de
  gelezen planning schrijft (R4, ook R0).

`classifyIfcx` gebruikt dezelfde regel: `own` als de lezer het bestand leest, `foreign` bij `foreign`, `not-ifcx` bij
`not-ifcx`, en `unreadable` bij de andere codes. De lezer leest met `JSON.parse` (keuze T1); een dubbele sleutel ziet
hij niet (knownbug 2220).

## Controle van de schema's

`schemaCheck.ts` is de ene plek voor twee controles: elke attribuutwaarde tegen de veldtabel (een onbekend veld, een
verkeerd type, een getal dat geen geheel getal is en `null` gelden als fout), en elke definitie in `schemas` tegen die
van het profiel. `ifcxSchemaProblems` geeft dezelfde controles als lijst, voor proeven en gereedschap. De controle met
de echte validator van IFC5-development en met ifcx-explorer draait in een eigen workflow (F3-6).

## Zelfcontrole

Na het schrijven leest `writeIfcx` zijn eigen uitvoer één keer terug (zonder R4, want de uitvoer is de STEP-uitkomst
zelf) en legt het teruggelezen model rechtstreeks naast
de hele STEP-uitkomst (`selfCheck.ts`). De vergelijking is algemeen: elk veld telt mee, op elk niveau, met de volgorde
van lijsten; alleen een ontbrekend veld en `undefined` zijn hetzelfde. Er zijn geen uitzonderingen.

Een proef haalt elk precies veld één voor één uit de veldtabel en eist dat `writeIfcx` dan weigert: in de
zelfcontrole, of in de waardetoets als het veld verplicht is. Zo faalt de zelfcontrole op een veld dat STEP bewaart en
IFCX niet draagt (besluit 3 van Trias: wat STEP zelf ook laat vallen, is geen fout).

## Metingen

De grens (besluit van de technisch eigenaar, 24 november, letterlijk): "De verhouding (hoogstens vier keer opslaan als
IFC, op dezelfde machine in dezelfde run) is de harde grens; de absolute CPU-tijd wordt alleen gemeld." En: "Leg voor
openen dezelfde verhouding vast (hoogstens vier keer openen als IFC), zodat ook dat niet ongemerkt groeit."
`check-ifcx-meting.ts` toetst beide verhoudingen bij 10.000 taken, met dezelfde planning in hetzelfde proces: opslaan
als IFCX (`writeIfcx`, met rondgang en zelfcontrole) tegenover `writeIFC`, en openen als IFCX (`readIfcx` op de bytes)
tegenover openen als IFC (de bytes decoderen en `readIFC`). De absolute CPU-tijd staat alleen in de uitvoer; die hoort
bij de meting op Windows en macOS vóór "IFCX standaard aan". Met `OPS_IFCX_MEASURE=1` geeft de meting ook de tabel per
stuk.

Sinds fixronde 6 wisselt de volgorde STEP–IFCX en IFCX–STEP per ronde, draait de proef in de alleenloop van de
planningspool (zoals de andere poorten met `OPS_RELAX_PERF=0`), en staan beide verhoudingen als eigen regel
`IFCX-verhouding opslaan: …` en `IFCX-verhouding openen: …` in de uitvoer. De CI is de poort; een run op aia09-mp50 is
een melding, geen bewijs (besluit van de technisch eigenaar). Het IFCX-deel sneller maken is een voorwaarde vóór "IFCX
standaard aan" (knownbug 2350).

CPU-tijd in één proces (`process.cpuUsage`), mediaan van vijf, 10.000 taken, in de CI:

| Head | Opslaan als IFC | Opslaan als IFCX | Verhouding | Openen als IFC | Openen als IFCX | Verhouding |
|---|---|---|---|---|---|---|
| vóór fixronde 5 (`b7acccdd6`) | 1.345 ms | 3.154 ms | 2,34 | niet gemeten | | |
| fixronde 5 (`847669d4c`, lezer zonder rondgang) | 898 ms | 2.946 ms | 3,28 | 856 ms | 954 ms | 1,11 |
| fixronde 6 (`e732f3324`, R4) | 720 ms | 2.243 ms | 3,12 | 600 ms | 2.232 ms | 3,72 |

Met R4 kost openen weer ongeveer een STEP-rondgang: de lezer zet de gelezen planning door dezelfde schrijffunctie als
opslaan. Het verwachte niveau was rond 3,5 keer openen als IFC (besluit van de technisch eigenaar).

## Uitbreiden (F3-2 en F3-3)

Elke node heeft één registratie in `NODES` (`nodes.ts`): zijn attributen met hun velden, de sleutels van het model die
hij draagt (`modelKeys`) en de domeinvelden per object (`objectKeys`). Daaruit volgen het schema en de waardetoets
(`OWN_ATTRIBUTE_VALUES`), de vorm van een node bij lezen (`NODE_SHAPES`), en wat de writer nog weigert
(`STEP_WRITER_INPUT_NOT_CARRIED` en de velden per object in `unsupportedContent.ts`). Een uitbreiding doet:

- **Velden met een vorm.** Elk nieuw feit krijgt één veld in een precies attribuut (`fields/`: sleutel, vorm, schrijven
  en lezen samen), in de vorm waarin STEP het bewaart, weggelaten bij de standaardwaarde (R3). Waar de STEP-writer uit
  twee domeinvelden kiest, is dat één precies veld. Waar er een gedeelde woordenschat is, komt er een veld in het
  gedeelde attribuut dat alleen schrijft (`SharedField`).
- **De registratie.** Een nieuwe node (resource, toewijzing, baseline) of een nieuw attribuut komt in `NODES`, met de
  sleutels die het overneemt in `modelKeys` (zo verdwijnen ze uit de weigering) en de domeinvelden in `objectKeys`.
  Een nieuwe soort object komt daarnaast als regel in `IDENTITY_KINDS` met zijn verwijzingen, en de modelopbouw in
  `projection.ts` en `ifcxReader.ts`.
- **De proef.** `NOT_CARRIED_YET` in `check-ifcx-kern.ts` gaat mee omlaag. Een planning met de nieuwe gegevens komt in
  `STEP_CASES` (de R1-lus) en in `maximalPlan` of `variantPlan`: de veldproef, de R2-lus, de R3-lus en de proef die
  elk precies veld weghaalt, lopen over alle geregistreerde attributen en falen bij een veld zonder proefgegevens. Voor
  F3-2: een kostenresource met een toewijzing. Voor F3-3: een geval per nieuwe betekenis.

Geen eigen normalisatie, geen tabel van dubbele voorstellingen en geen uitzondering in de zelfcontrole: de precieze
kant draagt wat STEP teruggeeft, en wat bij openen hoort, doet de laadgrens. Een nieuw attribuut hoeft aan de leeskant
geen eigen toets: de schrijffunctie is de toets (R4). De eigenschapsproef van R4 loopt over elk geregistreerd veld en
faalt bij een veld of vorm zonder uitgevoerde mutatie, en bij een vorm zonder geldige proefwaarde (`FORM_SAMPLES`).

De proef is `tests/planning/check-ifcx-kern.ts`; de voorbeeldbestanden in `tests/fixtures/ifcx/eigen/` maak je opnieuw
met `OPS_IFCX_FIXTURES_WRITE=1 bash tests/planning/run.sh check-ifcx-kern.ts`. De meting is
`tests/planning/check-ifcx-meting.ts`; met `OPS_IFCX_MEASURE=1` geeft ze ook de tabel per stuk.
