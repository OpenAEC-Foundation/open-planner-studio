# Het IFCX-profiel van Open Planner Studio

Dit document beschrijft hoe Open Planner Studio een planning in IFCX schrijft en leest: de kop, de paden, de
attributen met hun velden, de vorm en betekenis van elk veld, de projectie naar de gedeelde attributen, de betekenis
van lag, de regels R0, R1, R3, R4, R5 en R6 (R2 ging op in R4), de route waarlangs schrijver en lezer lopen (*De route
onder R6*), en de versieregel. Het ontwerp staat in
`docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md` (§5 en §6); de code staat in
`src/services/ifc/ifcx/`. De velden, de betekenis van lag en de proeven zijn eigen keuzes van deze repo (ontwerp §11,
besluit 12).

## Status: concept

Het profiel is een **concept** tot de featureflag `ifcx` eraf gaat. Tot dan kan een attribuutnaam nog van schema
veranderen; vanaf het moment dat de flag eraf gaat of een ander programma het profiel gebruikt, krijgt elke wijziging
een nieuwe naam (ontwerp §5.3). Wat een planner met de flag aan in die tijd als IFCX opslaat, kan een latere versie
van de app weigeren.

Deze versie (fase 3, F3-1, F3-2 en F3-3) draagt project, werkplan, werkschema, kalenders, taken, relaties, resources,
toewijzingen en baselines, met de velden die STEP daarvan bewaart (*De overige velden*). Wat IFCX nog niet draagt en STEP
wel bewaart, weigert de writer (zie *Wat de writer weigert*).

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
  een taak onder twee ouders, en weigert met `inconsistent` en de namen erbij." Code: `assertIdentity` in
  `ownFile.ts` (met `identityProblems` uit `identity.ts`), op de invoer van de aanroeper vóór de STEP-rondgang, en in
  de projectie, dus ook in de lezer (zie *De route onder R6*).
- **R1 (schrijven):** "de planning die IFCX opslaat is letterlijk wat STEP zou teruggeven. De writer neemt een kopie
  van zijn invoer, haalt die door de STEP-writer en de STEP-lezer van de app (dezelfde code en dezelfde opties als
  Ctrl+S en heropenen, in het schema van het project), en schrijft die uitkomst. De zelfcontrole blijft: teruglezen en
  rechtstreeks vergelijken met die uitkomst." Hoe de schrijver dat doet, staat op één plek: *De route onder R6*.
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

**Fixronde 7: R5.** Zeven rondes naast elkaar laten zien waar het na R4 nog schuurt: er waren in de kern meer planningen
in omloop dan één. De rauwe eerste lezing, de planning na de laadgrens, wat de schrijver in zijn zelfcontrole terugleest,
en wat STEP na een tweede opslag teruggeeft. R4 vergelijkt tegen de ene, de schrijver toetste zichzelf tegen een andere,
en de keuze voor `recordedFields` in ronde 6 nam een derde als maat. Elke blokkade van ronde 6 en 7 is een plek waar twee
partijen een andere planning als "de" planning namen. Regel R5, letterlijk: "De kern kent één canonieke planning: de
planning zoals de app haar na het laden heeft. De schrijver schrijft die, de lezer geeft die terug, en R4 vergelijkt
daartegen. Niets in de kern leest of controleert langs een andere." Besluit van de technisch eigenaar, letterlijk: "R5
(één canonieke planning: zoals de app haar na het laden heeft; schrijver, lezer en R4 gebruiken alleen die), met de proef
in twee richtingen: ja." Zie *R5: één canonieke planning*.

**Fixronde 8: R6.** De rondes naast elkaar. In ronde 6 bleek de STEP-rondgang op haar eigen uitkomst geen vast punt (de
D7-mijlpaal, een oude planning die een `TimeModel` krijgt); dat loste de laadgrens op. In ronde 7 schreef de schrijver
iets wat de eigen lezer weigerde; daar kwam R5 voor. In ronde 7b bleef een pauze buiten de werkdag bij een tweede
rondgang niet zoals ze was; daar kwam een weigering voor. In ronde 8 gaf de afgeleide restduur van een gestarte dagtaak
bij een tweede rondgang een letterlijke kalender, en werd een kalender met 9½ nominale uren 9 uur met werktijden. Wat ze
gemeen hebben: de kern paste de STEP-rondgang meer dan eens toe (twee keer in de schrijver, één keer in de lezer voor
R4) en nam aan dat een tweede rondgang niets meer verandert. Op main is dat niet waar: STEP verandert bij een tweede
opslag zelf nog dingen. Besluit van de technisch eigenaar (25 november), letterlijk: "ja op R6 en ja op punt 3."

- **R6:** "de STEP-rondgang hoort alleen bij het schrijven en gebeurt daar precies één keer, op de invoer; het bestand
  draagt de eerste STEP-lezing na de laadgrens zonder verlies; de lezer geeft precies die terug, zonder rondgang en
  zonder normalisatie; R4 vergelijkt het bestand byte voor byte met de projectie van de gelezen planning."
- **Punt 3:** "de pauzeweigering vervalt; IFCX volgt STEP, ook bij de tweede opslag. Het stille verlies blijft een fout
  van main in 2352."
- **Aanvulling op R6 (F3-2, besluit van de technisch eigenaar, 25 november), letterlijk:** "Het toewijzings-id is de enige
  waarde die de STEP-lezing niet uit het bestand haalt. De IFCX-schrijver leidt het af zoals STEP een toewijzing herkent:
  taak, resource-GlobalId en plaats. Het profiel benoemt dat. Een eigen proef legt vast dat alles behalve dit id gelijk
  is aan de STEP-lezing, en dat twee opslagen van dezelfde planning byte-gelijk zijn." Zie *Toewijzing*; de proef is
  "aanvulling op R6" in `check-ifcx-kern.ts`.
- Bij omzetten tussen IFC en IFCX (F3-5) blijft de schemakeuze behouden. De open vraag over een STEP-kop hoort
  alleen bij het STEP-bestand. Zie *Werkplan* voor het lezen van oudere IFCX-bestanden met die markering.

R4 en de tweede richting van R5 gelden daarmee voor de projectie, niet meer voor de hele schrijver. Voor de hele
schrijver kunnen ze niet gelden zolang IFCX gelijk moet zijn aan STEP: IFCX doet bij een tweede opslag precies wat STEP
bij een tweede opslag doet. Zie *De route onder R6* en *Wat een tweede opslag verandert*.

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
  taken (in de volgorde van de takenlijst), relaties, resources, toewijzingen en baselines (elk in de volgorde van de
  planning). Elke entry staat op één regel.

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
- Verwijzingen tussen objecten zijn paden: `parent` (van een taak en van een resource), `calendar` (van een taak, een
  resource en het werkplan), `literalCalendars`, `predecessor`, `successor`, `workplan`, `task` en `resource` (van een
  toewijzing), `task` in een baselinerij, `activeBaseline` en `comparedBaselines`. De gedeelde kant draagt dezelfde paden
  als projectie (`parent`, `calendar`, `relatingProcess`, `relatedProcess`, `relatedResource`).

**R0, één regel voor alle soorten** (`IDENTITY_KINDS` en `identityProblems` in `identity.ts`): het interne id is uniek
binnen de soort, en binnen de kalenderbibliotheek; de GlobalId is uniek over alle objecten samen, project, werkplan en werkschema inbegrepen; een relatie
heeft een voorganger en een opvolger die bestaan, en een toewijzing een taak en een resource die bestaan; en een taak
staat in de kinderlijst van hoogstens één ouder. De soorten zijn project, werkplan, werkschema, kalender, taak, relatie,
resource, toewijzing en baseline. De writer weigert een botsing met `inconsistent`, met het veld (`<soort>.id`,
`<soort>.globalId`, `sequence.predecessorId`, `sequence.successorId`, `assignment.taskId`, `assignment.resourceId` of
`task.childIds`) en een melding met de namen: het dubbele id, de GlobalId met beide eigenaren, de relatie of toewijzing
met het ontbrekende doel, of het kind met beide ouders. STEP laat zo'n toewijzing stil vallen; IFCX mag haar weigeren
(de uitzondering op de maat). Hij rekent nooit een vervangende
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
STEP), `wbsAutoNumber` (ja/nee), `defaultTaskDurationUnit` (keuze `days`, `hours`),
`statusDate`, de baselines van het document (`activeBaseline`: pad van de actieve baseline; `comparedBaselines`:
`{ "1": pad, "2": pad }`, de twee vergelijkingsplaatsen, elke plaats alleen als ze bezet is; `removedTasks`: lijst van
`{ id, globalId }`, de GlobalId die STEP teruggeeft voor een taak die niet meer bestaat en waar een baselinerij naar
wijst, `baselineOrphanGuids` in het model), en de laadgegevens van R1 volledig: `timeModel` (het tijdmodel dat STEP teruggeeft, nu `MINUTES-1`; het
ontbreekt bij een oude planning met een openstaande omzetting naar het minutenmodel, zoals STEP het dan ook weglaat),
`minuteModelPending` (ja, als de laadgrens de omzetting naar het minutenmodel openzet: bij een oude planning zonder
`MINUTES-1`, of als ze een taak onder vast werk naar de urenmaat zet; sinds fixronde 8, want de lezer haalt de vlag
niet meer uit de laadgrens), `importPristine` (ja, als STEP de planning als ongewijzigd sinds een import teruggeeft) en `literalCalendars` (lijst
van paden: de kalenders waarvan STEP de tijden letterlijk schreef, in de volgorde van STEP). Er is één verwijzing naar
de projectkalender; `project.calendarId` is het id van die kalender.

De open schemavraag hoort bij een STEP-bestand. Oudere IFCX-bestanden kunnen in het documentschema de optionele
tekstsleutel `ifcSchemaUnconfirmed` hebben, ook als het werkplan geen waarde voor die sleutel bevat. De lezer toetst
zo'n bestand aan de oude definitie en schrijfwijze, inclusief de positie en waarde van een aanwezige markering.
In de geopende planning vervalt de vraag. Bij de volgende opslag gebruikt de schrijver het huidige documentschema.

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
`START`, `FINISH`), `mandatory`, `isSummary`, `manuallyScheduled` (ja/nee), `calendar` (pad), en `unrecorded` (een lijst met keuzes uit de
negen tijdslots van `ALL_RECORDED_SLOT_KEYS`, in die volgorde, alleen als ze er zijn: de slots met een waarde die het
bestand niet als ingevuld noemt), en `timephasedContours` (lijst van `{ resourceUid, resourceId, periods }`;
`resourceUid` ontbreekt als het `null` is, `resourceId` is de tekst die STEP teruggeeft, `periods` is een lijst van
`{ afterMinutes, minutes, workMinutes, kind }` met `kind` `actual` of `remaining`). `resourceIds` staat er niet: de lezer
leidt het af uit de toewijzingen met dezelfde functie als de STEP-lezer (`reconstructResourceIds`). Welke tijdvelden ingevuld zijn (`recordedFields`), volgt uit de velden met een waarde,
min `unrecorded` (zie *Wat de STEP-lezer naast het model teruggeeft*).

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

### Resource

`openaec::ops::resource`: `id`, `name` (verplicht), `type` (keuze `LABOR`, `EQUIPMENT`, `MATERIAL`, `SUBCONTRACTOR`,
`CREW`, `COST`, verplicht), `description`, `maxUnits` (getal; ontbreekt bij 1), `costPerHour` (getal), `calendar` (pad),
`availabilitySteps` (lijst van `{ from, maxUnits }`, `from` tekst), `unitOfMeasure`, `parent` (pad: de ploeg), `color`
(tekst), `libraryOrigin` (`{ companyId, libraryItemId, poolVersion, syncedHash }`, `syncedHash` mag ontbreken). Elk getal
is een eindig getal zonder eigen grens: een negatief uurtarief, een capaciteit van 0,5 en een tarief van een kostenresource
staan er zoals STEP ze bewaart. Een kostenresource heeft na de STEP-rondgang geen tarief, kalender, stappen, eenheid of
ploeg en capaciteit 1 (`clearCostResourceFields`); zo staat ze er ook.

`openaec::planning::resource` (projectie): `name`, `description`, `resourceClass` (de IFC-klasse die STEP schrijft:
`IfcLaborResource`, `IfcConstructionEquipmentResource`, `IfcConstructionMaterialResource`, `IfcSubContractResource`,
`IfcCrewResource`; een kostenresource is zoals in STEP een `IfcConstructionMaterialResource`). Ploeg, capaciteit en
capaciteitsstappen staan alleen in het app-deel; of ze een gedeeld woord krijgen (een algemene `parent` voor de
resourcehiërarchie, de capaciteit die andere planners kunnen lezen), is een keuze voor het profiel vóór de flag eraf gaat
(VERVOLG van de review van #1189 ronde 1).

### Toewijzing

`openaec::ops::assignment`: `id`, `task` en `resource` (paden, verplicht), `unitsPerDay` (getal; ontbreekt bij 1),
`plannedUnitsPerDay`, `curve` (keuze uit de acht curves), `curveValues` (lijst van getallen), `workWindowStart` en
`workWindowFinish` (tekst), `plannedWorkMinutes`, `actualWorkMinutes`, `remainingWorkMinutes` en `costAmount` (getallen).
Elk veld staat er alleen als de STEP-lezing het teruggeeft; een negatieve inzet en een curve met een waarde boven 100
staan er zoals STEP ze bewaart. Een exacte curve die niet aan het contourcontract voldoet (`normalizeCurveValues`: 21
punten), laat STEP vallen, en IFCX dus ook.

`openaec::planning::assignment` (projectie): `relatingProcess` (pad van de taak), `relatedResource` (pad van de resource),
`scheduleUsage` (`unitsPerDay`), `scheduleContour` (`curve`).

**Het id van een toewijzing** (de aanvulling op R6). STEP bewaart geen id per toewijzing: het schrijft per taak één
`IfcRelAssignsToProcess` en herkent een toewijzing in de metadata van de taak aan `<GlobalId van de resource>#<plaats>`
(`assignmentKeyName` in `assignmentKeys.ts`; de plaats telt alle toewijzingen van de taak die STEP schrijft, in hun
volgorde). De STEP-lezer geeft haar een willekeurig nieuw id (`generateId('asgn')`); dat is de enige waarde die de lezing
niet uit het bestand haalt. De schrijver geeft haar na de STEP-rondgang het id
`asgn-<id van de taak>/<GlobalId van de resource>#<plaats>`, met dezelfde naam en dezelfde telling als STEP
(`withStepAssignmentIds` in `ifcxWriter.ts`), zodat twee opslagen van dezelfde planning byte-gelijk zijn. Het pad volgt
uit dat id. Verandert de resource of de volgorde van de toewijzingen van een taak, dan verandert het id, zoals in STEP de
naam in de metadata. De proeven houden dit id uitdrukkelijk buiten de vergelijking met de STEP-lezing
(`withoutAssignmentIds` in `tests/planning/ifcxProof.ts`) en toetsen het apart.

### Baseline

`openaec::ops::baseline`: `id`, `sourceProjectId`, `name`, `createdAt`, `tasks`, `projectEnd` (tekst), `projectDuration`
(getal), alle verplicht behalve `id` en `sourceProjectId`. `tasks` is een lijst van rijen `{ task | removedTask,
sourceTaskId, sourceTaskCode, start, finish, duration, isMilestone, milestoneKind }`: `task` is het pad van een taak die
bestaat, `removedTask` het id van een taak die niet meer bestaat (de GlobalId daarvan staat in
`openaec::ops::document.removedTasks`); `isMilestone` ontbreekt bij onwaar. Datums en tekst staan er zoals STEP ze in
`OPS_Baselines` bewaart.

`openaec::planning::baseline` (projectie): `name`, `start` (de datum van de vroegste start van de rijen) en `finish` (de
datum van `projectEnd`), zoals STEP het baselineschema schrijft.

## De overige velden (F3-3)

Deze velden staan alleen in de precieze kant (`openaec::ops::`). IFC 4.3 heeft er in de gedeelde attributen geen
woorden voor, dus er is geen projectie. Elk gebied heeft een eigen veldbestand in `src/services/ifc/ifcx/fields/`, dat
met één regel in de lijst van de kern staat. De writer schrijft een veld als de planning het heeft, ook een lege
tekst, `false` of een lege lijst, en laat het weg als het ontbreekt; zo komt het onderscheid tussen afwezig en leeg
terug zoals STEP het teruggeeft. In een object of een element van een lijst staan alleen de leden die het profiel
noemt, en alleen als ze er zijn. Een tekst heeft de vorm *tekst*, ook waar STEP een datum of id als tekst bewaart
(`IFCTEXT` of JSON in een pset); een datum die STEP als datum leest, heeft de vorm *moment*.

`openaec::ops::document`, de projectinstellingen en de herkomst (`projectSettingsFields.ts`): `progressMode` (keuze
`RETAINED_LOGIC`, `PROGRESS_OVERRIDE`), `defaultWorkRule` (keuze uit de vier werkregels), `companyId`, `companyName`,
`p6ProjectCode`, `dependentProjectsFolder` (tekst), `anchorsFromOpenDocuments` (ja/nee), en `recordedSourceFormat`
(keuze `xer`, `p6xml`, `mspdi`, `mpp`, `ifc`: het bronformaat van "datums zoals opgeslagen", dat STEP in
`OPS_ImportProvenance` bewaart).

`openaec::ops::document`, de rekenopties en het rekenprofiel (`schedulingFields.ts`): `schedulingOptions`, een object
met de projectopties (`lagCalendar`, `criticalDefinition` met `mode`, `threshold`, `thresholdHours`, `totalFloatMode`,
`makeOpenEndedCritical`, `useExpectedFinishDates`, `useProjectEndDateForFloat`, `nearCriticalThreshold`, `floatPaths`
met `enabled`, `method`, `maxPaths`, `p6CompletedLateFromRemainingWindow`, `startToStartLagFrom`, `leveling` met
`preserveScheduledDates`, `levelAllResources`, `priority` en `resources`), en `schedulingProfile` (`baseId` keuze `p6`,
`msproject`, `ops`, `id`, `name`, `overrides` met een ja/nee per conventie). Een nieuwe projectoptie of conventie in
`src/types/project.ts` zonder lid hier is een compileerfout.

`openaec::ops::document`, de structuur (`structureFields.ts`): `activityCodeTypes` (lijst van `{ id, name, values }`,
een waarde `{ id, code, description, color }`), `customFieldDefs` (lijst van `{ id, name, type }`, `type` keuze `text`,
`number`, `integer`, `cost`, `date`, `boolean`) en `customTaskTypes` (lijst van `{ id, name, color }`). Een lege lijst
schrijft de writer niet; de lezer geeft dan een lege lijst terug, zoals de laadgrens.

`openaec::ops::task`, de structuur per taak (`structureFields.ts`): `customTaskTypeId` (tekst), `activityCodes` (lijst
van `{ type, value }`: het id van de codesoort en van de waarde) en `customFields` (lijst van `{ field, text }`,
`{ field, number }` of `{ field, boolean }`, naar het soort van de waarde). Zij verwijzen met het interne id, zoals STEP
ze bewaart; codes, eigen velden en werksoorten zijn geen objecten met een pad. STEP schrijft voor codes en eigen velden ook
een `IfcSimplePropertyTemplate` met een GlobalId, maar bij herlezen komt die GlobalId niet als identiteit van de definitie
terug (niet in `ifcGlobalIds`): de lijsten komen uit het JSON-pset `OPS_StructureMeta`, de waarden per taak koppelt de
lezer via de definities aan de interne id's, en de gebruikte werksoorten komen uit `OPS_TaskTypes`. De templates leest
STEP alleen als terugval zonder dat pset, met nieuwe id's. Een identiteitspad (een soort in `IDENTITY_KINDS`) zou dus
identiteit toevoegen die de STEP-lezing niet heeft.

`openaec::ops::task`, rekenen (`taskScheduleFields.ts`): `constraint` (`{ type, date, hard }`, `type` keuze `ASAP`,
`ALAP`, `SNET`, `SNLT`, `FNET`, `FNLT`, `MSO`, `MFO`, `date` een moment), `constraint2` (`{ type, date }`: STEP bewaart
bij de tweede constraint geen harde vlag), `deadline` (moment), `isHammock`, `workRule` (keuze uit de vier
werkregels), `levelingDelay` en `levelingDelayMinutes` (gehele getallen), `levelingDelayElapsed`, `splitGaps` (lijst
van `{ afterMinutes, gapMinutes, source }`, `source` keuze `leveling`, `user`), `timephasedFinishFloor` en
`timephasedStartAnchor` (tekst), `timephasedDurationWalks` (lijst van `{ anchor, resourceCalendarId, workMinutes }`).

`openaec::ops::task`, weergave en koppelingen (`taskNoteFields.ts`): `notes` (lijst van `{ id, text, done }`), `color`
(tekst), `externalLinks` (lijst van `{ id, direction, relType, lagDays, lagMinutes, anchorDate, sourceRef,
sourceMissing, sourceVersion, anchorReadAt }`, met `sourceRef` als `{ projectId, projectName, taskId, taskName,
filePath, siteFileId }`).

`openaec::ops::task`, MS Project en P6 (`taskSourceFields.ts`): `mspTaskType` (keuze `FIXED_UNITS`, `FIXED_DURATION`,
`FIXED_WORK`), `effortDriven`, `p6DurationType`, `p6ActivityType`, `p6CompletePctType` (keuzes uit de P6-waarden),
`p6ProjectId`, `p6TaskId`, `p6ExpectedFinish` (tekst), `p6ExplicitTargetWindow` en `p6SuspendResume` (ja/nee).

`openaec::ops::calendar` (`calendarSourceFields.ts`): `p6Source` (keuze `XER`), `p6NonWorkPenaltyDates` (lijst van
dagen), `p6NonWorkPenaltyDatesState` (keuze `ABSENT`, `VALID_EMPTY`, `VALID_VALUES`, `REJECTED`) en `libraryOrigin`
(`{ companyId, libraryItemId, poolVersion, syncedHash }`).

`openaec::ops::sequence` (`sequenceSourceFields.ts`): `p6StartAtPredecessorFinishBoundary` (ja/nee).

Wat STEP laat vallen, laat IFCX ook vallen, omdat de planning van het bestand de STEP-lezing is: een werksoort die
geen taak gebruikt, een code of eigen veld zonder definitie, `time.progressBeforeRecalculation`. Een lid dat STEP in
een JSON-pset doorgeeft maar dat het profiel niet noemt (een notitie of koppeling met een extra lid), draagt IFCX niet;
de zelfcontrole weigert dan met het veld (knownbug 2363).

**De typepoort.** `IFCX_PLACE_OF_SAVE_KEY` in `saveKeyPlaces.ts` geeft elk veld van `IFC_SAVE_KEYS` een plek: de
sleutels van de schrijverinvoer die het in IFCX draagt (`calendars` als `resourceCalendars`, `recordedDates` en
`datesAsRecorded` als de ingevulde tijdvelden en `recordedSourceFormat`), of een benoemde uitzondering: het
P6-bronarchief (`xerImportMetadata`, `xerSourceArchive`, `xerSourceProjectId`) en wat de STEP-schrijver niet krijgt
(`foreignSourceMark`, `ifcSource`). Binnen `project` is `ifcSchemaUnconfirmed` de benoemde STEP-uitzondering.
De ingestelde waarde `project.ifcSchema` gaat wel mee. Een nieuw veld in `IFC_SAVE_KEYS` zonder plek is een compileerfout;
`check-ifcx-velden.ts` toetst dat elke plek gedragen wordt.

**De volledigheidspoort.** `tests/planning/check-ifcx-velden.ts` toetst elk voorbeeld in `public/examples`, de elf eigen
bestanden van oudere releases in `tests/planning/fixtures/oude-tags/` en de maximaal gevulde fixture van
`check-ifc-roundtrip.ts` (`tests/planning/ifcRoundtripFixture.ts`), op twee routes: rechtstreeks met de lezing van STEP,
en geopend in de app (`openOpenedFile` met de flag `ifcx`, dus met de laadgrens, de minutenomzetting en de activering) met
de opslaginvoer van Ctrl+S (`buildWriteIFCInput`). Elk bestand slaat volledig op als IFCX, met resources, toewijzingen
en baselines (sinds F3-2), zonder dat de proef iets weghaalt; het opent als de eerste STEP-lezing na de laadgrens, het
bestand is de projectie van wat de lezer teruggeeft, en een tweede opslag doet wat STEP doet. Een weigering is een fout. De vergelijking is die van de kernproef (`tests/planning/ifcxProof.ts`).
Daarnaast een gewone bewerking in de app, op `v2026.9.0-urentaak-10-villa-wassenaar.ifc` en
`showcase-rijwoningen-de-akkers.ifc`: een code en een eigen veld toevoegen en op een taak invullen, en vast werk als
werkregel kiezen. Uit dezelfde opslaginvoer schrijft de proef STEP en IFCX, opent beide in de app, slaat elk opnieuw op
vanuit de geopende toestand en opent weer; beide keren geven de twee bestanden in de app dezelfde opslaginvoer, met de
bewerking erin. Daar staat de GlobalId die de IFCX-schrijver aanvult (*De route onder R6*, stap 2; bij een baseline) aan
de kant van STEP er ook in (`withFilledGlobalIds` in `ifcxProof.ts`), en het toewijzings-id buiten de vergelijking.
`stepToIfcxDifferences` haalt alleen de open schemavraag uit de verwachte STEP-planning. Een vraag in de gelezen
IFCX-planning, verlies van het gekozen schema en elk ander veldverschil laten de proef falen.

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

## De route onder R6

Er is één STEP-rondgang, en die zit in de schrijver. De lezer doet geen rondgang en gaat niet door de laadgrens. Een
proef eist dat (`R6: precies één plek …` in `check-ifcx-kern.ts`): `writeIFC`, `readIFC`, `payloadFromImport` en
`buildWriteIFCInput` komen in `src/services/ifc/ifcx/` elk precies één keer voor, in `ifcxWriter.ts`, en de lezer
bereikt die module niet, ook niet via een andere module van de kern.

**Schrijven** (`writeIfcx` in `ifcxWriter.ts`):

1. R0 op de invoer van de aanroeper (`assertIdentity`: `inconsistent`, met de namen).
2. De planning van het bestand (`filePlanning`). Eerst de ene STEP-rondgang op de invoer: `writeIFC`, daarna `readIFC`,
   met de aanmaak- en wijzigingsdatum van de invoer als terugval (`projectTimestampFallback`, dezelfde optie als de
   verliescontrole van de app; zonder die optie zou de STEP-lezer voor een lege datum het moment van lezen invullen).
   Weigert of breekt STEP af, dan weigert IFCX met `invalid`, `planning` en de reden van STEP. Een GlobalId die STEP
   leeg teruggeeft, krijgt de afgeleide GlobalId die de volgende STEP-opslag ook zou schrijven (een lege GlobalId telt
   overal als afwezig, ook in R0). De ingevulde tijdvelden zijn wat de STEP-lezing bewaart, min de slots die de invoer
   zelf als afwezig noemt. Daarna de laadgrens van de app (`payloadFromImport`, dan `buildWriteIFCInput`): de planning
   houdt de feiten van de lezing die de app bij openen gebruikt (de ingevulde velden, `timeModel`, de herkomst), neemt
   de gegevens na de laadgrens (de taken, de kalenders en `minuteModelPending` als die aan staat), en laat de hint
   `milestonesAtDayEnd` vallen: na de laadgrens zijn alle datums momenten, en daarop heeft de hint geen invloed meer.
   De open schemavraag uit de STEP-lezing vervalt. De toewijzingen krijgen hun afgeleide id (de aanvulling op R6,
   zie *Toewijzing*). Dit is de canonieke planning van R5.
3. `unsupportedContent` op die planning: wat STEP bewaart en IFCX nog niet draagt, weigert de writer met `unsupported`
   en de veldnamen.
4. De projectie: `ownFileFor` in `ownFile.ts` (R0, `composeIfcxDocument` en de waardetoets met dezelfde functie als de
   lezer), dan `serializeIfcx`.
5. De zelfcontrole: `readIfcx` op de eigen bytes geeft precies de planning van stap 2 terug (zie *Zelfcontrole*).

**Lezen** (`readIfcx` in `ifcxReader.ts`): de vormtoets, de omgekeerde projectie en R4 (zie *R4*). De lezer geeft de
planning terug zoals ze in het bestand staat.

**De eigenschap, in twee delen**, voor elke planning x in de proeven:

1. `readIfcx(writeIfcx(x))` is diep gelijk aan de eerste STEP-lezing van x na de laadgrens, met het afgeleide
   toewijzings-id en zonder de open schemavraag van STEP. De proef maakt die
   verwachting zelf, met de functies van de app (`writeIFC`, `readIFC`, `payloadFromImport`, `buildWriteIFCInput`) en
   niet met een functie van de kern; zo ziet ze het als de kern en STEP uiteenlopen.
2. Het bestand is byte voor byte de projectie van wat de lezer teruggeeft, met `header.timestamp` uit het bestand.

Een tweede opslag (`writeIfcx(readIfcx(b))`) gaat weer door de ene rondgang en geeft wat STEP bij een tweede opslag
geeft: `readIfcx(writeIfcx(readIfcx(writeIfcx(x))))` is diep gelijk aan de tweede STEP-lezing na de laadgrens, door de
proef zelf gemaakt. Waar STEP dan iets verandert, verandert IFCX hetzelfde (*Wat een tweede opslag verandert*). Diep
gelijk is gelijk op elk niveau, met de volgorde van lijsten; een ontbrekend veld en `undefined` zijn hetzelfde, en `-0`
en `0` ook.

## R1: schrijven is de STEP-rondgang

De maat: de planning die IFCX opslaat, is wat STEP zou teruggeven, na de laadgrens van de app. De uitvoering staat in
*De route onder R6*.

Het document van de aanroeper verandert niet; een proef vergelijkt het na de aanroep diep met een kopie van ervoor.
Wat STEP niet bewaart, bewaart IFCX dus niet: onbekende velden en onbekende leden van werkblokken, een enkele pauze
naast werkblokken, werkblokken op een dag die geen werkdag is, `interferingFloat`, `isNearCritical` en `floatPath`
(die schrijft STEP bewust niet meer), de kalender van een taak die niet bestaat, en `project.calendarId` als het niet
de projectkalender is. Wat STEP bij heropenen invult of rechtzet, staat er precies zo in: lege vroege en late datums,
de uurmaat uit de minuten, de voortgang en status uit de werkelijke datums, een dag die niet bestaat (30 februari wordt
2 maart), een oneindige lag (wordt 0), en de nieuwe id's van relaties, bibliotheekkalenders en resources
(`seq-ifc-<GlobalId>`, `rescal-ifc-<GlobalId>`, `res-ifc-<GlobalId>`). Wat STEP van resources, toewijzingen en baselines
laat vallen, laat IFCX ook vallen: een toewijzing aan een resource die niet bestaat (R0 weigert die al op de invoer), een
ploeg of kalender van een resource die niet bestaat, een vergelijkingsplaats met een baseline die niet bestaat, en de
velden die een kostenresource of kostentoewijzing niet draagt (`normalizeAssignmentForResource`). Een actieve baseline
die niet bestaat, wordt zoals in STEP de laatste baseline.

## R5: één canonieke planning

De canonieke planning is de planning zoals de app haar heeft na het openen van de STEP-versie: de planning van stap 2
van *De route onder R6*. De schrijver schrijft haar projectie, en de lezer geeft haar terug. Sinds fixronde 8 geldt R5
voor de projectie: de lezer geeft de planning terug waarvan het bestand de projectie is. `writeIfcx(readIfcx(b))` geeft
de bytes van b alleen waar STEP bij een tweede opslag niets verandert.

**Waarom via de laadgrens.** De STEP-rondgang op haar eigen uitkomst is niet altijd een vast punt: de D7-mijlpaal
verliest `AtDayEnd` en een oude planning krijgt een `TimeModel`, omdat de STEP-writer de planning na de laadgrens
verwacht. Daarom draagt het bestand de planning van na de laadgrens. Een stop of hervatting zonder tijd, een lege
geplande datum of een tijd buiten de werkdag staat in het bestand zoals de app haar na het laden heeft
(`time.stop: "2027-06-01"` wordt `2027-06-01T16:00`).

**Tot waar het vaste punt geldt.** De canonieke planning is de planning na de laadgrens, zonder doorrekenen. De Openen-route
van de app rekent daarna door (`prepareLoadedPayload` met `recompute: true`); dan kan een datum verschuiven, zoals de
vroege finish van een taak die om 00:00 eindigt (`2027-06-03T00:00` wordt `2027-06-02T16:00`). De lezer past de laadgrens
zelf niet meer toe. Bij een bestand van de schrijver verandert de laadgrens van de app de gelezen planning niet (getoetst
voor de bestanden en de datumvormen van de kernproef). Bij een bestand dat de schrijver nooit maakt, kan ze wel iets
veranderen, zoals bij STEP: een werkplan zonder `timeModel` en zonder `minuteModelPending` krijgt `minuteModelPending`.
Of en wanneer de IFCX-openroute doorrekent, is voor F3-4 (knownbug 2351).

## Wat een tweede opslag verandert

IFCX volgt STEP, ook bij de tweede opslag (punt 3 van fixronde 8). Waar STEP op main bij een tweede opslag na openen
iets verandert, verandert IFCX hetzelfde. Dat zijn fouten van main (knownbug 2352); de proef legt het gedrag van main
vast, op een bibliotheekkalender en op de projectkalender, vóór en na de omzetting naar het minutenmodel:

- **Een eenvoudige pauze die niet helemaal binnen de werktijd ligt.** Bij een werkdag van 07:00 tot 16:00: een pauze
  vóór de werktijd (vanaf 00:01, 30 minuten), over het begin heen (vanaf 06:40, 30 minuten), over het einde heen (vanaf
  15:40, 60 minuten) of na de werktijd (vanaf 16:40, 30 minuten). De eerste opslag houdt de pauze, de tweede laat haar
  vallen. Een pauze met een begin of een duur met een fractie (720,25 of 30,5 minuten): de eerste opslag houdt alleen
  het andere deel, de tweede laat de pauze vallen.
- **Een pauze precies op het begin van de werktijd** (vanaf 07:00, 30 minuten). Na de omzetting naar het minutenmodel
  houdt de tweede opslag de pauze, maar verandert ze de werktijden van de kalender. Vóór de omzetting verandert de tweede
  opslag niets: de laadnormalisatie van een oude planning zet de kalender bij de eerste opslag al recht.
- **Een pauze helemaal binnen de werktijd**, ook tot het einde ervan, en een pauze met alleen een begin of alleen een
  duur: die blijft bij elke opslag zoals ze is.
- **Een gestarte dagtaak zonder vastgelegde restduur** (het geval van ronde 8): de eerste STEP-lezing leidt de restduur
  af uit duur en voortgang (0,75 dag bij 25 %) en kiest geen letterlijke kalender. Bij de tweede opslag ziet de
  STEP-writer de gebroken dag en schrijft hij de projectkalender letterlijk (`literalCalendars`). Zo bij 8, 8½, 9 en 9½
  nominale uren, vóór en na de omzetting.
- **Een kalender met 9½ nominale uren op een werkdag van 07:00 tot 16:00**, in een planning na de omzetting: de tweede
  opslag maakt er 9 uur van en geeft de kalender werktijden. Vóór de omzetting blijft het 9½ uur.

## R4: het bestand is de projectie van de gelezen planning

R4 geldt sinds fixronde 8 voor de projectie (R6): het bestand is byte voor byte de projectie van de planning die de
lezer eruit leest. `readIfcx` doet, in deze volgorde:

0. **De bytegrens**: begint het bestand met een UTF-8-BOM, dan weigert de lezer met `invalid` en `place.offset` 0. De
   eigen schrijver schrijft geen BOM, en de UTF-8-decoder zou haar anders weghalen vóór de vergelijking van de bytes.
1. **De vormtoets** (blijft, want zonder haar kan de lezer niet veilig lezen): JSON en UTF-8, de kop en zijn domein,
   `imports` leeg, de schema's, de padvorm van elk pad (de decoder geeft de gelezen GlobalId direct aan het object),
   geen `children` of `inherits`, één bijdrage per attribuut per pad, de profielversie (`newer-profile`), de vorm van
   elk veld volgens regel A, de soort van elk object, precies één werkplan en één werkschema, en de soort van elke
   verwijzing.
2. **Het model** uit de precieze kant, met de afleiding die het bestand niet draagt (de dagwaarden van een uurtaak, de
   status, de ingevulde tijdvelden).
3. **R4**: de lezer geeft het gelezen model aan dezelfde projectie als `writeIfcx` (`ownFileFor` in `ownFile.ts`: R0,
   de projectie en de waardetoets) en vergelijkt dat bestand met het gelezen bestand, tot op de byte. Er is geen
   STEP-rondgang en geen laadgrens.
4. Bij een verschil weigert hij met `invalid` en het eerste verschil: het object en het veld in `place` en in de
   melding, met wat het bestand had en wat de eigen schrijver schrijft. Hij repareert niets. Weigert de schrijver de
   gelezen planning zelf, dan noemt de melding de namen zoals bij schrijven, en `place` het pad, het attribuut en het
   veld waar de schrijver weigert.
5. Is er geen verschil, dan geeft hij het gelezen model terug, zoals het in het bestand staat.

**De vergelijking tot op de byte.** De lezer serialiseert het eigen document zoals `writeIfcx` het doet
(`serializeIfcx` in `projection.ts`), met alleen `header.timestamp` uit het bestand, en vergelijkt die tekst met het
bestand. Daarmee opent geen enkele andere schrijfwijze: geen ander getal dat na `JSON.parse` hetzelfde is
(`1.0000000000000001` voor een voortgang van 1, `10e-1` voor 1), geen dubbele sleutel, geen andere witruimte en geen
andere volgorde van sleutels. Een getal rond een harde grens (een voortgang van 0 tot 1, een geheel getal) heeft dus
precies één schrijfwijze: die van `JSON.stringify` op de waarde die de schrijver schrijft. Dat is een verscherping:
tot fixronde 7 vielen witruimte en de volgorde van sleutels buiten de vergelijking. Fase 3 opent alleen eigen
bestanden, dus dat mag (besluit van de technisch eigenaar, fixronde 7). Zit het verschil alleen in de schrijfwijze (de
drie rondes hieronder vinden geen verschil in waarden), dan weigert de lezer met een eigen plaats: `place.offset`, het
teken waar het bestand van de eigen schrijfwijze afwijkt, en `place.path` als die regel een object is.

**Het eerste verschil** zoekt de lezer in drie rondes over het hele bestand: eerst een veld of object dat het bestand
draagt en dat de schrijver voor deze planning helemaal niet schrijft, dan een veld met een andere waarde, en dan wat
het bestand mist. In elke ronde komen de kop, de schema's en de objecten in volgorde, en per object de precieze kant
vóór de gedeelde. Zo wijst de melding naar wat het bestand zelf zegt, en niet naar een gevolg.

**Eerst één snelle doorgang.** Vóór die drie rondes kijkt de lezer in één doorgang of het bestand precies het eigen
bestand is: de vier kopvelden, de schema's en de data als JSON, met dezelfde sleutels, even lange lijsten en elke
waarde gelijk (`===`, `sameFile` in `ifcxReader.ts`), en de bytes gelijk. Pas als die doorgang een verschil ziet,
volgen de waardetoets van de schrijver op de attributen en de drie rondes. De doorgang vergelijkt dezelfde paren als
de rondes en is strenger, dus ziet zij geen verschil, dan vinden de rondes er ook geen. Is het bestand precies het
eigen bestand, dan geeft de waardetoets van de schrijver op elke waarde dezelfde uitkomst als de waardetoets van de
lezer op het bestand, en die slaagde al. Gelijke bytes alleen zijn daarvoor niet genoeg: een lid met `undefined` in
het eigen document verdwijnt bij het serialiseren, terwijl de waardetoets van de schrijver het zou weigeren. Daarom
blijft de strikte vergelijking naast de bytes. De kop toetst de schrijver altijd.

**Wat buiten de vergelijking valt**, met de reden:

- `header.timestamp`: het moment van schrijven, geen planningsgegeven; elke schrijfactie geeft een ander.

Een leesmoment komt er niet in: de lezer gaat niet door STEP en vult niets in.

Alles daarbuiten is een verschil, ook de schrijfwijze.

**Wat een schrijver van een ander programma moet doen.** Een bestand opent alleen als het precies de projectie is van
de planning die erin staat, tot op de byte. Een
ander programma moet dus dezelfde paden, dezelfde precieze en gedeelde velden met dezelfde waarden (de standaardwaarden
weggelaten, de afgeleide waarden niet geschreven), dezelfde schema's, dezelfde volgorde en dezelfde opmaak schrijven; in
de praktijk: via deze kern. Voor de oudere documentdefinitie met `ifcSchemaUnconfirmed` vergelijkt de lezer met de exacte
oude projectie, ook als de vraag ontbreekt. Bestanden van anderen horen bij
fase 4.

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

**Punt 8 en ronde 6 onder R6.** Tot fixronde 8 vergeleek R4 met wat de schrijver na een STEP-rondgang zou schrijven;
nu met de projectie van de gelezen planning. Een bestand dat precies de projectie is van een planning die de schrijver
zelf nooit maakt, opent daarom: lege vroege en late datums (punt 8), een tweede duur in minuten naast een dagduur,
`remainingMinutes` naast een restduur in dagen, of een werkelijk einde met 50 % voortgang (ronde 6). Ook bijvoorbeeld een
duur van 0,25 minuut, een werkplan zonder `timeModel` en zonder `minuteModelPending`, een kalender vanaf 07:15 met taken
om 07:00, en een onderbreking op een taak die niet gestart is. De vormtoets houdt alleen elke waarde binnen haar domein
(knownbug 2353).
De lezer geeft die planning terug zoals ze in het bestand staat; een tweede opslag gaat door de ene STEP-rondgang en geeft
wat STEP ervan maakt (de datums ingevuld, de voortgang 1, de duur van 0,25 minuut weg, het `timeModel` terug). In elke
andere schrijfwijze opent zo'n bestand niet, en de melding noemt het object en het teken. Het project
op het lege tekstpad opent niet (`header.id`).

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

## Wat verviel in fixronde 7

- `documentFor` en `savedAfterOpening`: een tweede route langs de projectie en een tweede naam voor de laadgrens. Er
  is één functie die canoniek maakt (`canonicalPlanning`) en één die het eigen bestand maakt (`ownFileFor`).
- De zelfcontrole van de schrijver met `readIfcxText(text, false)`: de schrijver toetst zich nu met de publieke lezer.
- De keuze van ronde 6 voor `recordedFields` (de velden met een waarde); zie *`recordedFields` en R4* hieronder.
- De vergelijking die witruimte en de volgorde van sleutels negeerde; R4 vergelijkt nu de bytes.

## Wat verviel in fixronde 8

- De pauzeweigering (`unstableBreak` in `ifcxWriter.ts`) en haar melding: IFCX volgt STEP (punt 3).
- De tweede en de derde STEP-rondgang: `ownFileFor` doet geen rondgang meer, en de lezer gaat niet meer door de
  rondgang en de laadgrens. Weg zijn `canonicalPlanning` en `canonicalFor` in `ownFile.ts` en de module
  `stepRoundtrip.ts`; de rondgang en de laadgrens staan alleen nog in `filePlanning`.
- De modelvergelijking in de lezer (het model dat de schrijver zou opslaan naast het gelezen model): R4 vergelijkt de
  bytes met de projectie.
- Het veld `openaec::ops::task.atDayEnd`: de planning van het bestand is die van na de laadgrens, en daarin is de hint
  verbruikt.
- Nieuw is `openaec::ops::document.minuteModelPending`, omdat de lezer de vlag niet meer uit de laadgrens haalt.

## Wat de STEP-lezer naast het model teruggeeft

R1 volledig vraagt een indeling van elk veld dat de STEP-lezer teruggeeft. Die staat op één plek: `MODEL_KEYS` in
`nodes.ts` noemt elke sleutel van `WriteIFCInput` (een ontbrekende of extra sleutel is een compileerfout), en elke
sleutel is óf van een node (`modelKeys` in de registratie), óf van het pad (`ifcGlobalIds`), óf verbruikt door de
laadgrens (`LOAD_BOUNDARY_MODEL_KEYS`: `milestonesAtDayEnd`, sinds fixronde 8), óf nog niet gedragen
(`STEP_WRITER_INPUT_NOT_CARRIED`, dat de writer met `unsupported` weigert zodra het iets draagt). Een proef eist dat elk
veld dat de STEP-lezer voor de voorbeelden en de proefplanningen teruggeeft, in die indeling staat. Er is geen lijst
van uitzonderingen meer: de zelfcontrole vergelijkt elk veld.

De velden die tot fixronde 4 buiten de vergelijking bleven:

| Veld | Nu | Waarom |
|---|---|---|
| `timeModel` | `openaec::ops::document.timeModel` | de laadgrens zet zonder `MINUTES-1` een omzetting naar het minutenmodel open |
| `milestonesAtDayEnd` | verbruikt door de laadgrens (sinds fixronde 8; daarvoor `openaec::ops::task.atDayEnd`) | de laadgrens zet een mijlpaal zonder soort aan het eind van de dag (16:00); daarna is het een moment, en dat draagt het bestand |
| `ifcLiteralCalendarIds` | `openaec::ops::document.literalCalendars` | een volgende opslag houdt die kalenders letterlijk |
| `recordedFields` | de velden met een waarde, min `openaec::ops::task.unrecorded` (sinds fixronde 7) | zie hieronder |
| `recordedTimesOrigin` | vast `ifc-own`: een IFCX-bestand is altijd een eigen bestand | de laadgrens kiest daarmee tussen verse import en heropening |
| `importPristine` | `openaec::ops::document.importPristine` | "datums zoals opgeslagen" gaat bij een ongewijzigde import vanzelf aan |
| `minuteModelPending` | `openaec::ops::document.minuteModelPending` (sinds fixronde 8) | de laadgrens zet de vlag, ook bij een planning mét `TimeModel` als ze een taak onder vast werk naar de urenmaat zet; de lezer gaat niet door de laadgrens, dus het bestand draagt haar |
| `recordedSourceFormat` | `openaec::ops::document.recordedSourceFormat` (sinds F3-3) | de laadgrens kiest met de herkomst of "datums zoals opgeslagen" aangaat |
| `recordedTimes`, `xerOrigin`, `xerArchiveIssue` | nog niet gedragen, weigert de writer | volgen uit het XER-archief; zonder die inhoud geeft STEP ze niet terug |
| `baselineOrphanGuids` | `openaec::ops::document.removedTasks` (sinds F3-2) | de GlobalId van een taak die niet meer bestaat en waar een baselinerij naar wijst; STEP geeft haar terug uit `TaskGuids` |
| `xerMissingPlannedStarts`, `p6xmlReport`, `msProjectReport`, `sourceScheduleNotes`, `suggestedProfileId`, `ifcLegacySchemaLoss` | nog niet gedragen, weigert de writer | meldingen van andere lezers over hun bronbestand; de STEP-lezer geeft ze voor een eigen bestand niet terug, dus ze zijn er nooit |

**`recordedFields` en R4.** De maat is de toestand van de app direct na openen, met de geschiedenis erbij (besluit
van de technisch eigenaar, fixronde 7, letterlijk: "De maat is de toestand van de app direct na openen, met de
geschiedenis erbij; IFCX draagt uitdrukkelijk welke tijdslots afwezig zijn."). Dezelfde planning één keer uit een
STEP-bestand en één keer uit een IFCX-bestand geopend geeft dus dezelfde ingevulde velden, en na Ongedaan maken van de
minutenomzetting ook dezelfde tabel, dezelfde exportselectie en dezelfde achtergehouden velden in de opslaginvoer.

Waar de afwezigheid verdween: de eerste STEP-lezing noemt een slot dat het bestand leeg liet (`$`) niet als ingevuld en
vult het in (een vroege of late datum met de geplande datum, een speling met 0, kritiek met onwaar). De laadgrens
(`payloadFromImport`, `buildWriteIFCInput`) draagt `recordedFields` niet door; de app gebruikt ze bij openen apart
(`captureRecordedDates` voor de geschiedenis van de minutenomzetting, `applyRecordedDatesOnLoad` voor "datums zoals
opgeslagen"). Een opslag na openen schrijft daarom alle slots, en de lezing daarna noemt ze alle; alleen in de modus
"datums zoals opgeslagen", ook in de toestand die Ongedaan maken van de minutenomzetting terugzet, houdt de opslaginvoer
de afwezige rekenslots achter. Een afwezige geplande start of geplande finish kan STEP niet achterhouden; een leeg
gepland einde leest STEP als de dag van het lezen.

Sinds fixronde 7 draagt IFCX de afwezigheid uitdrukkelijk: `openaec::ops::task.unrecorded` noemt de slots met een
waarde die het bestand niet als ingevuld noemt, in de volgorde van `ALL_RECORDED_SLOT_KEYS`, en ontbreekt als er geen
zijn. De ingevulde velden van de schrijver zijn wat de STEP-lezing van zijn invoer bewaart, en een slot dat de invoer
zelf als afwezig noemt (een lezing met `recordedFields`), blijft afwezig. Zo schrijft ook een tweede opslag de
afwezigheid opnieuw. De opslagroute van de app (`buildWriteIFCInput`
op de toestand na openen) draagt haar niet, net als bij STEP; dat is een punt voor F3-4.

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
- `unsupported`: de planning van het bestand heeft iets wat dit profiel nog niet draagt: de bibliotheek, het
  P6-bronarchief, en elk veld van project, kalender, taak, relatie, resource, toewijzing, baseline of baselinerij dat geen
  veldgroep draagt (`unsupportedContent.ts`), met de veldnamen in `fields`;
- `self-check`: de eigen uitvoer leest niet terug, of geeft een andere planning dan de planning van het bestand
  (`fields` noemt de paden van de eerste verschillen).

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
- `invalid`: een UTF-8-BOM aan het begin (`place.offset` 0), een kopveld buiten zijn domein (`header.<veld>`), een bestand zonder `imports`, `schemas` of profielversie,
  een eigen schema dat afwijkt van het profiel of ontbreekt, een bekend veld met een waarde buiten zijn domein (ook
  een dag of kloktijd die niet bestaat, en een getal als `1e999`), een verplicht veld dat ontbreekt, een verwijzing
  naar een pad van de verkeerde soort, niet precies één werkschema, of een verschil met de projectie van de gelezen planning (R4, ook
  R0).

`classifyIfcx` gebruikt dezelfde regel: `own` als de lezer het bestand leest, `foreign` bij `foreign`, `not-ifcx` bij
`not-ifcx`, en `unreadable` bij de andere codes. De lezer leest met `JSON.parse` (keuze T1). Een dubbele sleutel of een
getal dat `JSON.parse` afrondt, ziet `JSON.parse` niet, maar R4 wel: het eigen bestand heeft één schrijfwijze, en de
lezer vergelijkt de bytes (sinds fixronde 7; daarvoor knownbug 2220).

## Controle van de schema's

`schemaCheck.ts` is de ene plek voor twee controles: elke attribuutwaarde tegen de veldtabel (een onbekend veld, een
verkeerd type, een getal dat geen geheel getal is en `null` gelden als fout), en elke definitie in `schemas` tegen die
van het profiel. `ifcxSchemaProblems` geeft dezelfde controles als lijst, voor proeven en gereedschap. De controle met
de echte validator van IFC5-development en met ifcx-explorer draait in een eigen workflow (F3-6).

## Zelfcontrole

Na het schrijven leest `writeIfcx` zijn eigen uitvoer terug met de publieke lezer (`readIfcx`, met R4), en legt wat die
teruggeeft rechtstreeks naast de planning die hij projecteerde, die van stap 2 van *De route onder R6*
(`selfCheck.ts`). De zelfcontrole blijft in de opslag zolang F3-2 en F3-3 niet af zijn (besluit van de technisch
eigenaar, fixronde 7b). Weigert de lezer, of is er een verschil, dan
weigert de schrijver met `self-check`. De vergelijking is algemeen: elk veld telt mee, op elk niveau, met de volgorde
van lijsten; alleen een ontbrekend veld en `undefined` zijn hetzelfde, en `-0` en `0`. Er zijn geen uitzonderingen.

Een proef haalt elk precies veld één voor één uit de veldtabel en eist dat `writeIfcx` dan weigert: in de
zelfcontrole, of in de waardetoets als het veld verplicht is. Zo faalt de zelfcontrole op een veld dat STEP bewaart en
IFCX niet draagt (besluit 3 van Trias: wat STEP zelf ook laat vallen, is geen fout).

## Metingen

De grens (besluit van de technisch eigenaar, 24 november, letterlijk): "De verhouding (hoogstens vier keer opslaan als
IFC, op dezelfde machine in dezelfde run) is de harde grens; de absolute CPU-tijd wordt alleen gemeld." En: "Leg voor
openen dezelfde verhouding vast (hoogstens vier keer openen als IFC), zodat ook dat niet ongemerkt groeit." Sinds
fixronde 7b (besluit van de technisch eigenaar, letterlijk): "De grens van vier op openen blijft hard. Opslaan als IFCX
wordt in deze PR gemeten en in de CI-log gemeld, niet afgedwongen." Hoogstens vier keer IFC en hoogstens 4 s bij
10.000 taken voor opslaan is een harde voorwaarde vóór "IFCX standaard aan" (knownbug 2350).
`check-ifcx-meting.ts` meet beide verhoudingen bij 10.000 taken, met dezelfde planning in hetzelfde proces: opslaan
als IFCX (`writeIfcx`, met rondgang en zelfcontrole) tegenover `writeIFC`, gemeld met de uitsplitsing per stap
(`IFCX-stap opslaan, …`: de planning van het bestand met de ene STEP-rondgang en de laadgrens, de projectie met de
waardetoets, serialiseren, de zelfcontrole, de vergelijking), en openen
als IFCX (`readIfcx` op de bytes) tegenover openen als IFC (de bytes decoderen en `readIFC`), met de grens. De absolute CPU-tijd staat alleen in de uitvoer; die hoort
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
| fixronde 6 (`9894f6236`, R4 met main) | 609 ms | 2.045 ms | 3,36 | 502 ms | 2.138 ms | 4,26 |
| fixronde 6 (`23814bad4`, snelle doorgang) | 675 ms | 2.045 ms | 3,03 | 667 ms | 2.125 ms | 3,18 |

Met R4 kost openen weer ongeveer een STEP-rondgang: de lezer zet de gelezen planning door dezelfde schrijffunctie als
opslaan. Het verwachte niveau was rond 3,5 keer openen als IFC (besluit van de technisch eigenaar). De snelle doorgang
van R4 haalt de drie rondes en de waardetoets van de schrijver uit het gewone geval: op aia09-mp50 ging openen daarmee
van 3,35 naar 2,8 tot 2,9 keer openen als IFC (een melding; de CI-meting staat in #1183). De STEP-rondgang zelf kost
ongeveer twee keer openen als IFC.

De noemer verschilt per runner: openen als IFC kostte in de CI 502 tot 667 ms, openen als IFCX 2.125 tot 2.232 ms. Met de
noemer van `9894f6236` zou 2.125 ms ongeveer 4,23 zijn; één groene run zegt dus nog niets over de herhaalbaarheid op een
andere runner (knownbug 2350). De meetregels staan in de log van het planningsdeel dat de proef draait (in run 45510345490
was dat `verify (planning 1-5)`).

**Met R5 (fixronde 7)** doet opslaan drie STEP-rondgangen: één om een lezing van de invoer te maken, één voor het eigen
bestand van de canonieke planning, en één in de zelfcontrole met de publieke lezer. Op aia09-mp50 (een melding) kost
opslaan als IFCX daarmee 8,4 tot 9,0 keer opslaan als IFC en openen 3,1 tot 3,6 keer openen als IFC; in de CI (`27ea25c32`)
opslaan 8,14 en openen 3,36. Een schrijver die een invoer die niet canoniek is canoniek maakt, heeft er minstens twee
nodig, en twee STEP-rondgangen kosten al ruim vier keer opslaan als IFC. Daarom meldt de proef opslaan en dwingt ze het
niet af; het snelheidswerk is een eigen stap na deze PR (knownbug 2350).

**Met F3-3** (een melding, op aia09-mp50 met een belasting rond 3 à 4, één run per head, CPU-tijd, mediaan van vijf):
vóór F3-3 (`cbc340f1a`) opslaan 4,78 (1.104 tegen 5.283 ms) en openen 0,80 (1.375 tegen 1.100 ms); met F3-3 opslaan 4,33
(1.185 tegen 5.129 ms) en openen 0,99 (1.257 tegen 1.243 ms). Met de velden van F3-3 gevuld op elke taak (constraint,
deadline, notitie, code, eigen velden, kleur, werkregel en P6-id, plus rekenopties) opslaan 3,14 (3.634 tegen 11.413 ms)
en openen 0,34 (4.518 tegen 1.555 ms): STEP zelf wordt met de extra psets trager. Die laatste planning staat niet in
`check-ifcx-meting.ts`.

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
  elk precies veld weghaalt, lopen over alle geregistreerde attributen en falen bij een veld zonder proefgegevens. F3-2
  zette in `maximalPlan` een kostenresource met een bedrag, een werkresource in een ploeg met kalender, stappen en
  contour, drie baselines (actief en twee vergelijkingen) en een rij naar een verwijderde taak; `kernOf` houdt de
  resources, toewijzingen en baselines van de voorbeelden. Voor F3-3: een geval per nieuwe betekenis.
- **Een veld op een bestaand object** (sinds F3-3) komt in het veldbestand van zijn gebied in `fields/`, dat met één
  regel in de lijst van de kern staat (`TASK_FIELDS`, `DOCUMENT_FIELDS`, `CALENDAR_FIELDS`, `SEQUENCE_FIELDS`, met de
  sleutels in de bijbehorende `*_KEYS_CARRIED`). De veldproef zoekt elk lid van een object in het eerste element van
  een lijst, en de mutatieproef in de eerste drie objecten van een soort: daar zet `maximalPlan` de proefwaarden
  (`withOtherFields` in `check-ifcx-kern.ts`). Een nieuwe sleutel in `IFC_SAVE_KEYS` krijgt een plek in
  `IFCX_PLACE_OF_SAVE_KEY` (*De typepoort*).

Geen eigen normalisatie, geen tabel van dubbele voorstellingen en geen uitzondering in de zelfcontrole: de precieze
kant draagt wat STEP teruggeeft, en wat bij openen hoort, doet de laadgrens. Een nieuw attribuut hoeft aan de leeskant
geen eigen toets: de projectie is de toets (R4). De eigenschapsproef van R4 loopt over elk geregistreerd veld en
faalt bij een veld of vorm zonder uitgevoerde mutatie, en bij een vorm zonder geldige proefwaarde (`FORM_SAMPLES`).

De proef is `tests/planning/check-ifcx-kern.ts`; de voorbeeldbestanden in `tests/fixtures/ifcx/eigen/` maak je opnieuw
met `OPS_IFCX_FIXTURES_WRITE=1 bash tests/planning/run.sh check-ifcx-kern.ts` (de BOM-proef leest het voorbeeldbestand
vóór het opnieuw geschreven is; draai daarna nog één keer zonder de variabele). De meting is
`tests/planning/check-ifcx-meting.ts`; met `OPS_IFCX_MEASURE=1` geeft ze ook de tabel per stuk.
