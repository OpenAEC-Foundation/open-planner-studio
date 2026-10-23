# Een veld toevoegen dat een opslaan/laden overleeft

IFC 4.3 is het **native bestandsformaat** van Open Planner Studio, geen exportformaat. Opslaan =
`writeIFC`, laden = `readIFC`. Er is geen apart JSON-projectformaat waar de rest in past. Dat betekent
één harde regel:

> **Domeindata die niet door de IFC-laag round-trippt, is bij de volgende keer openen weg.**

Die regel staat al in `AGENTS.md`. Wat er niet stond is *hoe* — welke bestanden je aanraakt, in welke
volgorde, en waar de compiler je tegenhoudt als je iets vergeet. Dit bestand is die route.

**Dit is een toelichting, geen vervanging.** De afdwinging is mechanisch en zit in de code en de
testsuite; die zijn leidend. Loopt dit document ooit achter, dan heeft de code gelijk. Waar je moet
kijken staat hieronder telkens erbij.

---

## De vorm van het probleem

Een veld toevoegen aan `Task` is één regel. Datzelfde veld door een save/load-cyclus krijgen raakt
vier plekken, en drie ervan geven géén compileerfout als je ze overslaat:

| plek | wat er misgaat als je hem vergeet |
|---|---|
| de **writer** | het veld staat niet in het bestand |
| de **reader** | het veld staat er wel in, maar komt niet terug |
| de **fixture** in de round-trip-test | de test dekt het veld niet; alles blijft groen |
| de **canon-tabel** in diezelfde test | de test dekt het veld nog steeds niet; alles blijft nóg steeds groen |

De laatste twee zijn de gemene. Daarom zijn ze allebei compile-afgedwongen — zie *De poort* onderaan.

---

## Waar data landt: drie routes

`src/services/ifc/` kent drie manieren om een waarde in het bestand te krijgen. Welke je kiest is
zelden een vrije keuze: het hangt ervan af of IFC er zelf een plek voor heeft.

### 1. Een native IFC-slot

Als IFC een veld kent (`IfcTaskTime.ScheduleStart`, `IfcTask.Name`, …) hoort de waarde dáár, niet in
een eigen pset. Een ander programma dat het bestand opent, leest het dan gewoon.

Deze slots staan in **`ifcTaskSlots.ts`** als geordende descriptorlijsten (`IFC_TASKTIME_SLOTS`,
`IFC_TASK_SLOTS`). De array-positie ís de STEP-argumentindex: de writer itereert de lijst en plakt de
waarden aan elkaar, de reader leest via de afgeleide naam→index-map. Eén descriptor draagt dus beide
richtingen:

```ts
{ key: 'scheduleStart', write: (w) => …, read: (t, arg, p) => { … } }
```

Ontbreekt `read`, dan wordt het slot bij het lezen bewust genegeerd (bijvoorbeeld `Name`, dat we uit
de taak zelf afleiden). Dat is een keuze die je opschrijft, geen omissie.

### 2. Een `OPS_`-pset per taak

Voor domeindata waar IFC geen slot voor heeft — constraints en deadlines, externe links, hammock,
mijlpaal-soort, leveling, notities, kleur, werkonderbrekingen, werkregel en meer — gebruiken we een
eigen property set met het `OPS_`-voorvoegsel.

Die descriptors staan in **`ifcPsets.ts`**, in de array `PER_TASK_PSETS` (tel ze daar, niet hier), en
ook hier draagt één descriptor beide kanten:

```ts
{
  name: PSET.TaskAppearance,          // uit de gedeelde namenkaart, geen losse string
  psetSeed: 'pset_appear_', relSeed: 'rel_appear_',
  write(task) { /* → PropSpec[] of null */ },
  apply(task, props) { /* ← terug op de taak */ },
}
```

`PSET` bovenin datzelfde bestand is de enige plek waar `OPS_`-namen staan — óók die van de psets die
géén descriptor hebben (`OPS_ProjectSettings`, `OPS_Resource`, `OPS_Assignments`, `OPS_Calendar`,
`OPS_CustomFields`, `OPS_ActivityCodes`, `OPS_Baselines`, `OPS_SchedulingOptions`,
`OPS_ImportProvenance`, …). Die laatste
hebben een afwijkende vorm — per resource, per kalender, of één blob op het schedule — en delen
alleen de naam. Schrijf een nieuwe naam dus in `PSET`, nooit als losse string in de writer.

Twee dingen om te weten:

- **De volgorde in de lijst is bindend.** De writer schrijft de psets in array-volgorde; dat is wat de
  byte-identieke STEP-uitvoer bewaakt. De reader dispatcht op naam en is volgorde-ongevoelig.
- **De gouden regel:** `write` geeft `null` of een lege lijst terug wanneer er niets te schrijven valt,
  en dán wordt er ook niets geschreven. Een taak zonder constraint en zonder deadline levert geen
  leeg `OPS_Constraints`-pset op (de deadline is daar een property van, geen eigen pset). Dat houdt bestaande bestanden bit-gelijk en voorkomt dat elk project met lege psets volloopt.

**Voorbeeld op het project: de P6 Project-ID.** `Project.p6ProjectCode` is de P6 Project-ID uit een
P6 XML-import (`<Project><Id>`), los van de naam bewaard (eigenaarsbesluit 2026-10-13). Hij staat als
`P6ProjectCode` in `OPS_ProjectSettings` op het `IfcProject`, naast `CompanyId`/`CompanyName`, en
alleen wanneer gezet. De gewone poort dekt hem (fixture en `KEEP`-cel in `check-ifc-roundtrip.ts`); de
eigen toetsen (openen, hernoemen, export, crashherstel, XER) staan in
`tests/planning/check-p6xml-project-code.ts`. Een XER-document bewaart zijn code hier niet: die komt uit
het meegereisde bronarchief (`xerProjectCode`). Weergave en P6 XML-writer lezen beide via
`documentProjectCode`.

### 3. Eén autoritatief JSON-blob

Voor structuren die niet in losse properties passen — baselines, `schedulingOptions`, de
custom-field- en activity-code-definities, de bedrijfsbibliotheek — schrijven we één
`IFCPROPERTYSINGLEVALUE` met JSON erin, op het `IfcWorkSchedule` of het `IfcProject`.

`OPS_SchedulingProfile` (rekenprofielen) staat naast `OPS_SchedulingOptions` op het `IfcWorkSchedule`:
één JSON `{ id, baseId, conventions, overrides, name? }` met alle conventies opgelost plus de letterlijke afwijkingen (zodat P6 → OPS → opslaan → P6 het origineel teruggeeft); alleen geschreven als het
profiel ≠ het standaardprofiel (OPS zonder afwijkingen), zodat bestaande bestanden byte-identiek
blijven. De lezer geeft hem voorrang op het (gemigreerde) `OPS_SchedulingOptions`-blok
(`profileAfterRead` in `schedulingOptionsRead.ts`, migratie in `schedulingProfileMigration.ts`). Een nieuwe
conventie heeft hier geen extra werk nodig (zie `docs/recepten/conventie.md`).

Verliesloos en simpel, maar het is **ondoorzichtig voor andere programma's**. Gebruik deze route
alleen als 1 en 2 niet kunnen, en niet omdat het sneller opschiet.

---

## De volgorde waarin je werkt

1. **Voeg het veld toe** aan het domeintype in `src/types/`.
2. **Kies een route** (hierboven) en schrijf de descriptor — write én read/apply in dezelfde
   descriptor. Kies je route 3, schrijf dan op waarom 1 en 2 niet konden.
3. **Vul de fixture** in `tests/planning/check-ifc-roundtrip.ts` met een *onderscheidende* waarde.
   Niet de default: een fixture die toevallig de default draagt, kan een writer die niets schrijft
   niet van een writer die het goed doet onderscheiden.
4. **Zet het veld in de canon-tabel** van datzelfde bestand: meedoen in de vergelijking, of
   gemotiveerd overslaan.
5. **Draai `npm run verify`.** Ontbreekt er iets, dan valt het daar om — zie hieronder.

## De poort

`tests/planning/check-ifc-roundtrip.ts` is de bewaking, en hij is bewust **zelf-uitbreidend**: een
nieuw domeinveld dwingt twee expliciete keuzes af, allebei op de compiler.

- **De fixtures zijn `satisfies Required<…>`.** Een nieuw veld op `Task`, `Resource`, `Sequence`,
  `WorkCalendar`, `Project` of `TaskTime` moet een waarde krijgen, anders compileert de test niet.
  (`WorkCalendar` via een typegetuige: geen echte kalender draagt tegelijk een pauzepatroon en
  `workTime`. `workTime` zelf loopt wél door de vergelijking, via de uurkalender `hourCal`.)
- **De vergelijkingstabellen zijn `satisfies CanonSpec<X>`** — dat is `Record<keyof X, …>`, dus élk
  veld moet ook een expliciete cel krijgen in de vergelijking.

Die tweede is er bijgekomen omdat de eerste alléén niet genoeg bleek (bevinding K10a): een nieuw veld
kreeg wel een fixture-waarde, maar stond in geen enkele hand-opgesomde vergelijkingstabel en
round-tripte dus stil nul bytes — met een groene suite.

De test doet daarnaast twee dingen die makkelijk te vergeten zijn:

- **Idempotentie.** Een tweede round-trip (write→read→write→read) moet identiek zijn aan de eerste.
  Een normalisatie die per ronde iets verschuift, valt hier om.
- **Ids worden op natuurlijke sleutels vergeleken** (wbsCode, naam), niet letterlijk — bij het
  eerste inlezen krijgen resources, relaties en kalenders een id afgeleid uit hun GlobalId, dus
  anders dan in het schrijvende document (daarna blijft het gelijk; `check-ifc-globalid`). Alle
  kruisverwijzingen worden vóór de vergelijking naar die sleutels herschreven.

## Als een veld bewust níét round-trippt

Dat mag, maar dan expliciet. `KNOWN_GAPS` is daarbij geen constante die je aanvult, maar de naam van
een werkwijze in `tests/planning/check-ifc-roundtrip.ts`, in drie delen:

1. **Een `skip`-cel in de canon-tabel** van het type — `{ skip: '<classificatie + reden>' }`; de reden
   is verplicht. Zo doet het veld niet mee in de round-trip-vergelijking.
2. **Een assertie in blok (3)** (`// (3) KNOWN_GAPS — getest-als-bekend`) die bewijst dat het verlies er
   echt is: de fixture draagt een waarde, het ingelezen resultaat niet.
3. **Een regel in het `KNOWN_GAPS`-commentaar** bovenaan het bestand, met de classificatie: (a) echt
   verlies, (b) bewuste normalisatie.

Het mechanisme is scherper dan een lijst met uitzonderingen. Elke gap-assertie bewijst dat het verlies
er **nog steeds** is. Dicht iemand later de writer of de reader, dan **faalt** die assertie — en dat is
de bedoeling: het herinnert eraan de `skip`-cel weer een echte vergelijking te maken en de assertie te
schrappen, in plaats van de gap eeuwig te laten staan als een halve waarheid.

Actuele gaps zijn bijvoorbeeld de afgeleide analysevelden `time.interferingFloat`/`isNearCritical`/
`floatPath` (a): de writer schrijft ze bewust niet meer in `OPS_Analysis`, omdat `runCPM` ze bij elk
laadpad opnieuw berekent (`emitPerTaskPsets` in `ifcWriter.ts`). `OPS_Analysis` draagt alleen nog de
exacte speling (`ExactFloat`, zie "Dagenmaat met een breuk, lagmaat en speling"). En `resource.availability`
(b), een `@deprecated` migratie-alleen veld dat de writer bewust overslaat. De uur-modus-velden
`durationMinutes`/`remainingMinutes` en de spelingminuten `totalFloatMinutes`/`freeFloatMinutes` zijn géén
gap: ze doen gewoon mee in de vergelijking.

## Kalenders: werkblokken per weekdag

Een uurkalender (`workTime`) kan per weekdag andere blokken hebben, bijvoorbeeld een korte vrijdag
(ma–do 07:00–15:00, vr 07:00–11:00). Tot bevinding B7 schreef de writer alleen de blokken van de
eerste werkdag, en zette de reader die op elke werkdag. Zo staat het nu in het bestand:

- **Eén `IfcWorkTime` per groep.** Weekdagen met dezelfde blokken vormen een groep. Elke groep krijgt
  een eigen `IfcWorkTime` in `WorkingTimes`, met een eigen `IfcRecurrencePattern(.WEEKLY.)`
  (WeekdayComponent + TimePeriods). Groepen overlappen niet. Dat is het model van IFC 4.3 zelf
  (`IfcWorkCalendar`, figuur 1: ma–do 8:00–12:00 + 13:00–17:00, vr 8:00–14:00). De groepering staat in
  `weekBandGroups` (`ifcWriter.ts`).
- **Eén groep blijft byte-identiek.** Een uniforme week, een kalender zonder blokken en een scalaire
  kalender met urentaak (die schrijft zijn afgeleide blokken, op elke werkdag dezelfde) geven
  hetzelfde bestand als vóór B7.
- **Geen terugvalweek.** Main schreef tussen #340 en #344 bij meer groepen eerst een extra week met
  StartDate = FinishDate = `1900-01-01`, voor oudere OPS-versies. Die week zat in geen release en is
  weer weg (besluit orkestrator 2026-10-13, fixronde 1 van PR #344). IfcWorkCalendar heeft nu 9
  attributen, en oudere versies lezen `WorkingTimes` dan toch niet (zie "Oudere OPS-versies", alinea
  Schemageldigheid). Een bestand met zo'n week leest deze reader goed (zie "De reader" hieronder).
- **De scalar staat altijd in `OPS_Calendar`.** Bij meer groepen schrijft de writer `WorkStartHour` en
  `WorkEndHour` altijd. Zonder die eigenschappen zou een oudere reader ze afleiden uit de eerste
  `IfcWorkTime`, en deze reader uit de eerste werkdag met blokken.
- **De reader** (`buildCalendarFromEntity`). Een `IfcWorkTime` met een StartDate of FinishDate doet niet
  mee in de week. Datumgebonden werktijden (een zomer- en een winterweek, een losse werkzaterdag) leest
  OPS dus (nog) niet; als gewone week zouden ze in elke week gelden. De terugvalweek van main valt hier
  ook onder.
  OPS schreef vóór B7 nooit een datum in `WorkingTimes` (feestdagen en werkende uitzonderingen staan in
  `ExceptionTimes`), dus oude OPS-bestanden lezen ongewijzigd. Hebben ALLE werktijden een datum (bijv.
  één week 08–16 van 2026-01-01 t/m 2027-12-31), dan neemt de reader het eerste patroon met een datum,
  zoals vóór B7; anders kreeg zo'n kalender de standaardweek. Twee of meer weekpatronen: elke dag
  krijgt de tijdvakken van zijn eigen patroon; staat een dag in meer patronen, dan de vereniging;
  `workDays` is de vereniging van alle patronen. De scalaire werkdag is de eerste werkdag met blokken
  (zondag eerst, `firstBlockedDay`), afgeleid met `workDayFromBlocks` — dezelfde regel als de MSPDI- en
  `.mpp`-lezer. Eén patroon: het oude pad, ongewijzigd.

De bewaking staat in `tests/planning/check-ifc-werktijd-per-dag.ts` (round-trip per geval, de vorm van
het bestand, byte-identiek aan main, de lezer in beide indelingen van `IfcWorkCalendar`, werktijden met
een datum, hernummerde STEP-id's en een weggevallen `OPS_Calendar`) en in de uurkalender `hourCal` in de fixture van
`check-ifc-roundtrip.ts`.

**Externe bestanden.** De reader kiest de plekken in `IfcWorkCalendar` op zijn argumenten
(`workCalendarSlots` in `ifcWorkControlSlots.ts`): 9 = het schema (Identification op 5, `WorkingTimes` op
6), 8 = de oude OPS-vorm zonder Identification, en 9 met een lijst op Identification = zo'n oud bestand na
IfcOpenShell `MergeProjects`. Een kalender uit een bestand dat het schema volgt, bereikt de leestak
hierboven dus. Gemeten op het corpus: de 9 kalenders van bSI, xbim, IfcOpenShell en ifcwebserver
(allemaal ma–vr 08:00–16:00) komen binnen als ma–vr 08:00–16:00; met de reader van vóór #292 kwamen ze
binnen als een uurkalender zonder blokken met 07:00–16:00. Verder getoetst met bestanden van de eigen
writer (`check-ifc-arity`, `check-ifc-legacy-arity`, ook na `MergeProjects`). Interop met andere
programma's is daarmee nog niet getest.

## Uren per dag bij een blokkenkalender

`hoursPerDay` is de omrekening tussen dagen en uren (P6 `day_hr_cnt`). Bij een uurkalender mag hij afwijken
van de klokuren van de blokken: "Late ploeg" 14:00–24:00 met `day_hr_cnt` 8 heeft `hoursPerDay` 8. De
writer schrijft `HoursPerDay` in `OPS_Calendar` als hij afwijkt van wat de reader zonder die eigenschap
afleidt: einde − begin bij een dagkalender, de modale dagsom van de geschreven blokken bij een
uurkalender. Een uurkalender zonder enig blok krijgt hem altijd (er is geen dagsom); dat is onschadelijk.
Bij een uurkalender staat hij altijd naast `IsHourCalendar = .T.`; de reader laat hem dan winnen ná
`promoteHourCalendar`. De herkenning van oude scalaire kalenders kijkt alleen naar ongemarkeerde
kalenders en ziet hem dus nooit. Oude bestanden dragen hem bij een uurkalender nooit en lezen zoals
vroeger (de klokuren). v2026.9.0 leest de blokken van een nieuw bestand al niet en houdt dan
`HoursPerDay` in plaats van 8. Toetsen: `check-ifc-urenperdag-blokken.ts`, `check-ifc-urenperdag-corpus.ts`
(met `OPS_XER_CORPUS`) en §10 van `check-ifc-calendar-identity.ts`.

Een dagkalender met werktijd 00:00–24:00 schrijft één periode '00:00:00'–'24:00:00'. De reader ziet die
periode zelf als afwijkend (een hele dag, `canonicalizeBands`) en promoveerde de kalender zonder markering
naar een uurkalender met 24 uur per dag; de bewaarde `HoursPerDay` verloor het van de promotie. Daarom
krijgt zo'n dagkalender `IsHourCalendar = .F.` (`scalarPeriodReadsAsHour` in `ifcWriter.ts`), net als een
dagkalender met gematerialiseerde blokken. Dezelfde toets geldt voor een periode over middernacht. Andere
dagkalenders krijgen geen markering. Een bestand van vóór deze regel leest nog als uurkalender. Toets:
`check-ifc-dagkalender-hele-dag.ts`.

Het verborgen dagengetal van een urentaak volgt `hoursPerDay` niet (eigenaarsbesluit 2026-10-15, optie 2:
"een dag is de echte werktijd"). `scheduleDuration` is daar werkminuten ÷ de werktijd per dag van de
taakkalender, bij een uurkalender de modale dagsom van de blokken (`hourTaskScheduleDuration` in
`src/utils/taskDuration.ts`). Dat geldt in elke lezer (XER, IFC, P6 XML, MSPDI, `.mpp`), in raster, paneel en
MCP, en na een kalenderwissel (`settleCalendarChange`). Een taak van 1870 u op Late-ploegblokken van 10 u is
dus 187 d, vóór en na opslaan en heropenen; de bewaarde `HoursPerDay` 8 gaat alleen mee naar de export.
Geschreven uren veranderen niet: IFC, P6 XML en MSPDI schrijven een urentaak in minuten. Toets:
`check-dag-is-werktijd.ts` en `tests/mcp/cases-dag-is-werktijd.ts`.

Een wissel van werkdagen of blokken (de dagknoppen, *Ma–vr* en *Werktijden* in het kalendervenster, MCP
`planner_update_calendar` met `workDays` of `workTime` zonder `hoursPerDay`) laat een afwijkende `hoursPerDay` staan. Alleen een waarde die gelijk was aan de modale
dagsom van de blokken vóór de wijziging volgt de nieuwe blokken (`hoursPerDayFollowsBlocks` en
`hoursPerDayForBlocks` in `src/services/subdayIo.ts`; de vergelijking is strikt, net als de writer). Het
venster bepaalt dat één keer per sessie, op de stand bij het openen (na een preset opnieuw). Alle wissels in
één sessie tellen dus samen als één wissel, net als één MCP-call. Zonder die regel werd Late ploeg na *Za*
aan stil 10, en schreef de writer dan geen `HoursPerDay` meer. Toetsen: `check-urenperdag-dagwissel.ts` en
`tests/mcp/cases-urenperdag-dagwissel.ts`.

## Dagenmaat met een breuk, lagmaat en speling

Bron: `docs/superpowers/specs/2026-10-20-alleen-uren-design.md` §3.3, §3.4, §3.10 en §5.4 (T5, T21). Code:
`src/services/ifc/dayMeasureIo.ts`, met de writer- en lezerkant in `ifcWriter.ts` en `ifcReader.ts`
(`applyTaskTimeRecords`, `extractSequences`).

Een hoeveelheid in dagen met een breuk gaat nooit als gebroken `P…D` naar het bestand. OPS v2026.9.0 leest
in `P0.5D` alleen de cijfers vóór de `D`, dus 5 dagen. Hele dagen blijven `P{n}D`, zoals voorheen. Een breuk
gaat als `PT…` in minuten, met een record `[dagen, geschreven minuten]` ernaast. Er is geen nieuwe pset.

**Duur, rest en werkelijke duur.** Een taak in de dagenmaat (ook kalendertijd in dagen) met een breuk in de
duur of de rest schrijft duur én rest als `PT…`. De minuten zijn dagen × de werktijd per dag van de
taakkalender (`effHoursPerDay`), bij kalendertijd dagen × 1440. De records staan als JSON in de eigenschap
`DayMeasureDurations` van `OPS_WorkRule`, met de sleutels `ScheduleDuration`, `RemainingTime` en
`ActualDuration`. Een gebroken werkelijke duur gaat op dezelfde manier. De duur gaat ook als `PT…` als
alleen de rest een breuk heeft. Reden: v2026.9.0 leest dan een urentaak met dezelfde lengte. Een `PT`-rest
naast een `P{n}D`-duur leest die versie als `ceil(uren ÷ 8)` hele dagen, en op een korte kalender gaat er
dan een deel van een dag verloren. Zo'n taak maakt haar kalender letterlijk (`LiteralTimes`, met
`IsHourCalendar = .F.`; `minuteModelWriteView`), net als een urentaak. Een scalaire kalender blijft na
heropenen scalair.

**Urenmaat met een breuk in minuten (T14).** De werkdriehoek schrijft de urenmaat zonder afronding: 1920 min
werk bij inzet 7 geeft een duur van 274,2857… min. Het `PT…`-slot draagt hele minuten (`PT4H34M0S`). De
exacte minuten van duur en rest staan als record `[exacte minuten, geschreven minuten]` in de eigenschap
`ExactMinutes` van `OPS_WorkRule`, met de sleutels `ScheduleDuration` en `RemainingTime`. Hele minuten
krijgen geen record. Zonder record kwam 274 min terug naast 1920 min werk, en sprak de driehoek zichzelf
tegen. v2026.9.0 leest de hele minuten van het slot.

**Lag (T21).** De vorm hangt af van de maat van de lag:

- urenmaat: `PT…`;
- hele dagen: `P{n}D`;
- dagen met een breuk: `PT…` (dagen × de werktijd per dag van de lagkalender), plus een record;
- kalendertijd in hele dagen: `P{n}D` met `ELAPSEDTIME`;
- kalendertijd met een breuk: `PT…` (dagen × 1440) met `ELAPSEDTIME`, plus een record;
- procent: `IFCRATIOMEASURE`.

De lagkalender volgt `schedulingOptions.lagCalendar` (voorganger, opvolger, projectkalender of 24 uur),
zoals de motor en de MSPDI-writer. De werktijd per dag is die van de motor (`CalendarEngine.hoursPerDay`:
bij een blokkenkalender de modale dagsom van de blokken). De writer houdt de maat in elk rekenprofiel; onder
P6 telt de motor een lag in dagen als uren, en `PT…` draagt precies die minuten. Alle lagrecords staan in één eigenschap `DayMeasureLags` in `OPS_Sequences` op het
`IfcWorkSchedule`, met de GlobalId van de relatie als sleutel: `{"<GlobalId>":[0.5,240]}`.

**Speling (T5).** `TotalFloat` en `FreeFloat` in `IfcTaskTime` dragen hele dagen (afgerond,
`wholeFloatDays`). De exacte dagen en de minuten (`totalFloatMinutes`, `freeFloatMinutes`) staan in de
eigenschap `ExactFloat` van `OPS_Analysis`. Die eigenschap komt er alleen als de taak spelingminuten draagt
of als de speling een breuk heeft. De lezer neemt de minuten als ze er zijn en leidt ze nergens zelf af.

**De leesregel.** Een record telt alleen als het standaardveld nog precies de geschreven minuten draagt (op
de hele minuut); bij de speling: als het slot nog de afgeronde dagen van het record draagt. Wijzigde een
ander programma de lengte, dan geldt het standaardveld. Een lag `PT4H0M0S` die `PT6H0M0S` werd, leest als
360 min in de urenmaat (bij kalendertijd in kalenderminuten), zoals in v2026.9.0. Een duur wordt een
urentaak; een rest of werkelijke duur van een dagtaak wordt minuten ÷ minuten per dag; een speling blijft
het slot, zonder minuten. Corrupte JSON of een ongeldig record werkt als een bestand zonder record.

**v2026.9.0** leest een nieuw bestand zonder dagen te verliezen of op te blazen: lag 0,5 d ⇒ 240 min
urenmaat, 1,5 ed ⇒ 2160 kalenderminuten, duur 2,5 d ⇒ urentaak van 1200 min, speling 2,5 d ⇒ 3 d. Een
werkelijke duur kent die versie alleen in hele dagen: 0,5 d ⇒ 1 d. De datums van alle taken zijn gelijk aan
die van de nieuwe lezer.

**Een eindveld zonder tijd op een letterlijke kalender.** Op een letterlijke kalender gaat elke taakdatum
zoals hij is het bestand in. Een planningseinde zonder tijd (`scheduleFinish`, `earlyFinish`, `lateFinish`,
`actualFinish`, en het eigen begin van een FINISH-mijlpaal) krijgt eerst het moment van de laadgrens: het
einde van zijn werkdag (`minuteModelWriteView`, D1–D7). Anders ging het als `…T07:00:00` of `…T00:00:00`
en las het terug als het begin van die dag. In de app passeert een gelezen bestand eerst de laadgrens; dit raakt
de ruwe route `readIFC → writeIFC`. Een beperking, deadline, extern anker, stop/hervat en een kale start
blijven zoals ze zijn.

Toetsen: `check-ifc-dagenmaat.ts` (met `OPS_MINUTE_MODEL_OLD_READER` ook de lezer van v2026.9.0),
`check-minute-model-compat.ts` (de bestanden D0 en D1), blok (18a) van `check-ifc-roundtrip.ts`, 2e van
`check-ifc-legacy-arity.ts` (de ruwe route) en §7 van `check-ifc-projectdatum-tijd.ts`.

## Lopend op 100 %: `IfcTask.Status`

Een P6-taak `TK_Active` op 100 % komt uit de XER-lezer als status STARTED, `completion` 1 en zonder werkelijk
einde. `normalizeImportedProgress` maakt elke taak op 100 % zonder werkelijk einde "Voltooid", met het
werkelijke einde op de statusdatum. Daarom schrijft de writer `IfcTask.Status` = `'STARTED'`, alleen bij zo'n
taak (`isRunningAtFullCompletion` in `ifcTaskSlots.ts`). Elke andere taak houdt `$`, ook een fase: haar
voortgang is een rollup die STARTED op 1 kan geven (taken klaar plus een niet-gestarte mijlpaal, of ≥ 99,95 %
afgerond), en de solve rekent hem na het openen opnieuw uit. De lezer geeft de taken
met precies die tekst als smalle set aan `normalizeImportedProgress`; die houdt ze lopend, zonder afgeleid
werkelijk einde en met de restduur uit het bestand. Een werkelijk einde wint altijd, onder 100 % verandert
niets, en een andere Status-tekst negeert de lezer. Oude bestanden (`$`) lezen zoals voorheen. Een oudere
app-versie negeert Status en maakt zo'n taak bij openen "Voltooid". De motor plant de vastgelegde restduur
van zo'n taak nog niet in (`knownbugs.md` 114). Toets: `check-ifc-lopend-100.ts` en de twee IFC-corpuschecks
(A3040 in torture).

## Wat dit niet dekt

- **De CSV-, MS Project- en P6-adapters.** Dat zijn import/export-adapters, geen opslagformaat; ze
  hebben hun eigen tests en hun eigen (kleinere) contract.
- **App-globale data.** Extensies, de resourcebibliotheek-pool en de instellingen zijn geen
  projectdata. Uitzondering: de herkomststempels van de bibliotheek round-trippen wél door het
  project-IFC, via hetzelfde `OPS_`-pset-patroon (zie `docs/library.md`).
- **De vraag of andere programma's ons bestand kunnen lezen.** De round-trip-test bewijst dat *wij*
  onze eigen data terugkrijgen. Interop met Synchro, BlenderBIM of Navisworks is nooit getest — dat
  staat als open onzekerheid in `docs/onderhoudbaarheid/README.md` §6. Wél getoetst: of het bestand
  schemageldig is (zie hieronder). Dat is een voorwaarde voor interop, geen bewijs ervan.

## Schemageldigheid

Een round-trip-test ziet niet of het bestand geldige IFC is. Schrijft OPS een attribuut op de
verkeerde plek, en leest OPS het van diezelfde verkeerde plek terug, dan blijft de round-trip groen.

**De geschiedenis** (alleen hier; code en toetsen verwijzen naar deze alinea). OPS t/m v2026.9.0, en
main tot PR #336 en PR #344 (oktober 2026), schreef geen geldige IFC: `python -m ifcopenshell.validate`
gaf op elk publiek voorbeeld 34 tot 80 schemafouten. De grootste oorzaken:

- IfcWorkPlan en IfcWorkSchedule met 15 in plaats van 14 attributen (één `$` te veel vóór StartTime);
- IfcWorkCalendar met 8 in plaats van 9 (zonder `Identification`);
- de vijf resource-entiteiten met 9 in plaats van 11 (het type op de plek van BaseCosts);
- REAL-waarden zonder decimale punt (`IFCREAL(5)`);
- de kop `IFC4X3`; IfcOpenShell valideert die tegen een ouder, apart 4.3-schema.

Daarnaast kleinere vormfouten: een tijd zonder seconden, een negatieve duur als `P0Y0M-2D`, een lege
lijst `()`, een verplichte naam als `$`, `IfcTaskTime.Completion` `0.00` (het schema eist > 0). PR #336
(issue #292) herstelde de aantallen en maakte de kop een keuze per project; PR #344 de rest en de
poort hieronder.

Nu geeft de validatie 0 fouten, met en zonder `--rules`, voor elk nieuw project (zie "Bestaande
GlobalIds" voor de uitzondering).

**Schema.** De kop is het schema van het project (`Project.ifcSchema`, issue #292): standaard
`IFC4X3_ADD2` (IFC 4.3.2.0, ISO 16739-1:2024), in *Projectinstellingen* ook IFC 4.3 of IFC4. De writer schrijft in
de drie dezelfde inhoud. De schema's verschillen wel in de toegestane enum-waarden: `INSPECTION` in
IfcTaskTypeEnum bestaat bijvoorbeeld alleen in IFC 4.3. De poort toetst daarom elk bestand tegen het
schema in zijn kop, en schrijft het rijke project in alle drie.

**De poort** is `tests/planning/check-ifc-schema.ts` (de toets per bestand staat in `ifcSchemaCheck.ts`).
Hij draait zonder Python, dus ook in CI. Hij toetst elke regel tegen een tabel uit het EXPRESS-schema:
het aantal attributen, `$` alleen op een OPTIONAL plek, de enum op de enum-plek, REAL met punt, INTEGER
zonder, de vorm van GlobalId (22 tekens uit het IFC-alfabet, eerste teken `0`–`3`), van IfcDateTime (met
seconden), IfcDate, IfcTime en IfcDuration, een verwijzing die bestaat en naar een toegestaan
entiteittype wijst, een getypte waarde die de select toestaat, geen lege lijst `()` waar het schema
minstens één element vraagt, een SET zonder dubbele elementen, en een paar WHERE-regels (zoals
"USERDEFINED vraagt een ObjectType"). De bronnen:

- de publieke en alle andere voorbeelden;
- een rijk project in elk van de drie schema's (alle resourcetypen, ploegen, baselines,
  ook een zonder taken, werkende uitzonderingen, bibliotheekkalenders, alle eigen-veldtypen, een
  negatieve speling); dit is de enige rijke fixture, ook voor `check-ifc-arity`;
- een leeg project, kalenderrandgevallen en een XER-import met bronarchief (`OPS_XerSourceArchive`),
  zie `tests/planning/ifcSchemaFixture.ts`;
- in `check-ifc-roundtrip.ts` (19) de round-trip-fixture (splits, contouren, timephased werk,
  P6-voortgang).

Een entiteit die de writer gebruikt maar niet in de tabel van elk schema staat, is rood. Een entiteit uit
de tabel die in geen getoetst bestand voorkomt, ook.

**De tabel** (`tests/planning/ifcSchemaTable.ts`) wordt gegenereerd door `scripts/ifc-schema-table.py`
uit de schema's `IFC4X3_ADD2`, `IFC4X3` en `IFC4` die IfcOpenShell meelevert: één tabel per schema.
`check-ifc-arity` leest de argumentaantallen uit dezelfde tabel. Schrijft de writer een nieuwe entiteit,
zet die dan in `OPS_ENTITIES` in het script en genereer de tabel opnieuw:

    source <venv met ifcopenshell>/bin/activate
    python -I scripts/ifc-schema-table.py > tests/planning/ifcSchemaTable.ts

**Besluit: alles in één keer.** De writer schrijft IfcWorkCalendar altijd met de 9 attributen van het
schema. Een OPS-versie t/m v2026.9.0 leest zo'n kalender verkeerd (zie "Oudere OPS-versies"). Dat
verlies is aanvaard. Bron: PR #336, alinea "Besluit: voorwaartse compatibiliteit": "Eigenaar (Nozzit),
2026-10-13: **alles in één keer**. Geen overgangsrelease waarin de reader eerst beide indelingen leert."
De releasetekst moet daarvoor waarschuwen. De lezer leest wel beide indelingen, dus deze versie opent
oude bestanden zonder verlies.

**De lezer** leest elke indeling. `ifcWorkControlSlots.ts` kiest de plekken op de argumenten van de
regel:

- IfcWorkPlan/IfcWorkSchedule: 14 = het schema; 15 met de enumeratie achteraan = de oude OPS-indeling;
  14 met tekst op PredefinedType = zo'n oud bestand na IfcOpenShell `MergeProjects`; 15 met de
  enumeratie op 13 = IFC2X3. Alleen een stringliteral telt als tijd; in IFC2X3 staan daar verwijzingen.
- IfcWorkCalendar: 9 = het schema; 8 = de oude OPS-indeling; 9 met een lijst op Identification = zo'n
  oud bestand na `MergeProjects`.
- Resources leest de lezer alleen op GlobalId, Name en Description; daar maakt de indeling niets uit.

`check-ifc-schema-reader.ts` bewijst dat een bestand in de oude OPS-indeling gelijk leest aan hetzelfde
bestand in het schema, `check-ifc-legacy-arity.ts` doet dat met een echt bestand van de oude writer (ook
na `MergeProjects`), en `check-ifc-werktijd-per-dag.ts` §5 toetst de kalenderlezer in beide indelingen.

**Projectstart uit een ander pakket.** Zonder `OPS_ProjectSettings` komt de projectstart uit
IfcWorkPlan.StartTime. Valt die later dan de vroegste ingelezen taakstart, dan geldt die taakstart
(`readIFC`). Gemeten op het corpus, met de lezers van main vóór #336 (59794aa55), main ná #336
(fa796cdad) en deze branch:

- bSI, xbim, IfcOpenShell en ifcwebserver, `construction-scheduling-task` (9 bestanden, 72 taken):
  StartTime is 2010-09-23 (de aanmaakdag), de taken beginnen op 2010-09-20. Main ná #336 nam
  2010-09-23 als projectstart; 63 van de 72 taken begonnen daardoor drie dagen later. Nu: projectstart
  2010-09-20 en de ingelezen taakdatums gelijk aan 59794aa55 (72 van 72). Na doorrekenen (`solveProject`)
  zijn alle 72 anders dan bij 59794aa55. Die las de kalender als uurkalender zonder blokken en zette elke
  taak op 2010-09-20 00:00, zonder duur. Nu volgen de taken de kalender van het bestand (ma–vr
  08:00–16:00), bijvoorbeeld Wall #1 op 21 september 08:00–16:00.
- De twee kubusbestanden van BlenderBIM (StartTime vóór de eerste taak): projectstart 2022-09-12 en
  2022-09-14 uit StartTime (59794aa55: 2022-10-01, en als einde de tekst `.NOTDEFINE`). De 9 taken zijn
  na doorrekenen gelijk.

**Planomvang tegenover projectinvoer.** `IfcWorkPlan.StartTime`/`FinishTime` en de gelijknamige
slots van het live `IfcWorkSchedule` delen de vroegste getoonde taakstart en het laatste getoonde
taakeinde (`shownStart`/`shownFinish` uit `taskDates`, inclusief samenvattingen). Die helpers bepalen
wanneer een werkelijke datum vaststaat en wanneer early of invoer geldt; de writer rekent niet opnieuw.
Vóór de getoonde datumkeuze én min/max gebruikt een tijdelijke taakkopie dezelfde formatter als
`IfcTaskTime`: een kale datum wordt bij een urentaak `00:00`, bij een dagtaak het bestaande
`07:00`-anker. De headers nemen die
STEP-waarden rechtstreeks over. Ook de vergelijking van werkelijke en berekende fase-starts ziet
dan genormaliseerde tijden, zodat de eerste save en herhaalde rondgangen dezelfde tijden dragen.
Zonder taakdatum valt elke as terug op de projectinvoer. Zonder enige start krijgt het verplichte
`StartTime` het schrijfmoment; een ontbrekend `FinishTime` blijft `$`. De expliciete projectinvoer
blijft altijd apart in `OPS_ProjectSettings.ProjectStartDate`/`ProjectEndDate`, ook leeg.
Regressie voor knownbug 109: `check-ifc-projectdatum-tijd.ts` §7 (elk projectschema, drie rondgangen,
broninvoer blijft staan) en `check-recorded-dates.ts` §7D (twee rondgangen in de opgeslagen-datummodus).

**Projectstart en -einde met tijd.** Na een XER-import hebben projectstart en -einde een tijd, zoals
`2012-12-17T07:00`. De writer schrijft `ProjectStartDate`/`ProjectEndDate` dan als IFCDATETIME met
seconden, net als `StatusDate`. Zonder tijd blijft het IFCDATE. De lezer neemt de tijd alleen uit
IFCDATETIME over. Een oud bestand met IFCDATE leest dus als voorheen, ook als er een tijd in staat.
De lezer van v2026.9.0 leest van beide alleen de datum. Vóór deze wijziging viel de tijd weg. De P6-
en MSPDI-export schreven dan 08:00 (Roads: 07:00 werd 08:00). De motor leest van de projectstart
alleen de datum, maar van het projecteinde de tijd, als `useProjectEndDateForFloat` aan staat.
Getoetst in `check-ifc-projectdatum-tijd.ts`, op het corpus in `check-ifc-projectdatum-corpus.ts`.

**Datums in een property.** Eén regel voor `StatusDate`, `ProjectStartDate`/`-EndDate`, `ConstraintDate`,
`ConstraintDate2`, `Deadline` en een eigen veld van het type datum (`ifcDateValue` en `readIfcDate` in
`ifcPsets.ts`). Tot 2026-10 schreef de writer een constraintdatum met tijd als IFCDATE, een schemafout.
Op main 8db05a95c ging het om 47 waarden in 22 van de 88 corpusdocumenten, waarvan 4 in Roads.
IfcOpenShell ziet dat niet, de schemapoort wel.

De writer typt nu alleen de twee vormen van de store, en alleen met een datum die bestaat:

- `YYYY-MM-DD` wordt IFCDATE;
- `YYYY-MM-DDTHH:mm` wordt IFCDATETIME met seconden `:00`;
- elke andere waarde wordt letterlijk IFCTEXT: `2026-03-02T7:00`, een spatie, seconden, een zone
  (`+02:00`, uit een extensie of MCP), een datum die niet bestaat (`2026-13-45`), of leeg.

De lezer zet IFCDATETIME om naar `YYYY-MM-DDTHH:mm`. Voor de getypte waarden van de writer is dat precies
de waarde uit de store. Een zone of een onmogelijke datum als IFCDATETIME zou wel veranderen: een SNET op
`10:00+02:00` startte na heropenen om 10:00 in plaats van 08:00, en `2026-13-45` werd 2027-02-14. Al het
andere leest de lezer per veld zoals eerst, ook IFCDATE met een tijd erin:

- `StatusDate` houdt de kloktijd;
- de projectdatums nemen de datum;
- de andere velden lezen de tekst letterlijk.

Zo staat elke waarde ongewijzigd in het bestand. Constraint, deadline en een eigen veld krijgen hem
ongewijzigd terug. `StatusDate` en de projectdatums lezen hem zoals altijd; een projectdatum met seconden
houdt dus alleen de datum. Een oud bestand leest exact gelijk. Gemeten op alle 88 corpusdocumenten,
opgeslagen met main en gelezen met beide lezers. De lezer van v2026.9.0 leest een constraintdatum uit
IFCDATETIME met seconden (`2013-04-27T00:00:00`), en rekent Roads daarmee gelijk door. Getoetst in
`check-ifc-datumvorm.ts`.

**Bestaande GlobalIds.** "0 fouten" geldt voor een nieuw project. Een bestand dat OPS inleest, houdt
bij opslaan zijn GlobalIds, ook als die ongeldig zijn (besluit eigenaar 2026-09-28,
`check-ifc-globalid.ts`): externe koppelingen naar die id's mogen niet breken. Oude OPS-versies
schreven GlobalIds met een eerste teken buiten `0`–`3`. Zo'n bestand blijft daardoor na opnieuw
opslaan ongeldig. Gemeten op vijf eigen OPS-bestanden, ingelezen en teruggeschreven met deze branch: 6,
12, 20 en 44 fouten, alle op GlobalId; één bestand had al geldige GlobalIds (0 fouten). De reviewer van
#344 mat 6 tot 123 fouten. Het gedrag is bewust niet veranderd. Nieuwe GlobalIds uitgeven voor
ongeldige bewaarde id's is een apart, later besluit.

**Oudere OPS-versies en een nieuw bestand.** Gemeten met de lezer en de writer van de uitgebrachte tag
v2026.9.0 zelf, in Node (niet in de desktopapp). Oud = hetzelfde project in de oude indeling: de 32
voorbeelden van main 59794aa55, en vier extra gevallen geschreven met de writer van 59794aa55 (het
rijke project, en villa Wassenaar met een zesdaagse week 08–17 met werkende uitzondering, een
urenkalender met pauze, en een korte vrijdag met werkende uitzondering). Nieuw = de writer van deze
branch. Controle: de lezer van deze branch leest oud en nieuw gelijk (kalenders en 2219 taken na
doorrekenen).

- **Oorzaak.** v2026.9.0 leest `WorkingTimes` op plek 5 (nu Identification), `ExceptionTimes` op plek 6
  (nu de werkweken) en de ploeg op plek 7 (nu de uitzonderingen). Een werkweek zonder datum wordt bij
  haar een feestdag op de dag van inlezen.
- **Openen.** In alle 32 voorbeelden: alle 614 feestdagen weg, een extra feestdag "Standard work week"
  op de dag van openen (34 kalenders), werkweek en werkuren terug naar de standaard ma–vr 07–16 (onder
  meer 7 zesdaagse weken), 1451 van 1818 taken anders na doorrekenen. In de vier extra gevallen: 91 van
  91 feestdagen weg, 4 werkende uitzonderingen en 2 ploegen weg, werkuren terug naar 07–16 (ook 08–17,
  de urenkalender met pauze en de korte vrijdag), 347 van 401 taken anders.
- **Gelijk** blijven: projectstart en -einde, het aantal taken, relaties, resources en toewijzingen, en
  de ingelezen taakdatums.
- **Opslaan in v2026.9.0** maakt het verlies blijvend. Alle 36 bestanden geopend en opgeslagen met
  v2026.9.0, daarna gelezen met deze branch: 705 van 705 feestdagen weg, de extra feestdag op de dag
  van openen staat nu als echte feestdag in het bestand (42 feestdagen in 41 kalenders), 4 werkende
  uitzonderingen en 2 ploegen weg, 2027 van 2219 taken anders na doorrekenen. De kop is daarna weer
  `IFC4X3`.
- **De omgekeerde richting** werkt: deze versie leest oude bestanden zoals main
  (`check-ifc-legacy-arity`, `check-ifc-schema-reader`).

**Lokaal valideren met IfcOpenShell.** `OPS_IFC_SCHEMA_DUMP=/tmp/map bash tests/planning/run.sh
check-ifc-schema.ts` schrijft het rijke project, het lege project, de
kalenderrandgevallen en de XER-import naar die map. Daarna
`python -m ifcopenshell.validate --rules <bestand>`; `--rules` toetst ook alle WHERE-regels.

**Bekende afwijking.** `IfcRelAssignsToProcess.RelatedObjects` is een SET. Staat dezelfde resource
twee keer op één taak, dan herhaalt OPS hem daar; de lezer telt elke herhaling als eigen toewijzing.
IfcOpenShell meldt dit niet. Een andere codering raakt de lezer en oudere OPS-versies; dat vraagt een
eigen besluit.

## Waar het echt staat

| onderwerp | bestand |
|---|---|
| native slots (write + read per slot) | `src/services/ifc/ifcTaskSlots.ts` |
| per-taak-psets (write + apply per descriptor) | `src/services/ifc/ifcPsets.ts` |
| schrijven | `src/services/ifc/ifcWriter.ts` |
| lezen | `src/services/ifc/ifcReader.ts` |
| plekken per indeling (schema, oud, MergeProjects, IFC2X3) | `src/services/ifc/ifcWorkControlSlots.ts` |
| schemageldigheid: de poort, de toets per bestand, de tabel, de bronnen | `tests/planning/check-ifc-schema.ts`, `ifcSchemaCheck.ts`, `ifcSchemaTable.ts`, `ifcSchemaFixture.ts` |
| de poort, de fixture, de canon-tabellen en de `KNOWN_GAPS`-asserties (blok 3) | `tests/planning/check-ifc-roundtrip.ts` |
| werkblokken per weekdag (B7): groepen, geen terugvalweek, byte-identiek aan main, de lezer in beide indelingen | `tests/planning/check-ifc-werktijd-per-dag.ts` |
| welke velden een save meeschrijft | `src/state/ifcSaveInput.ts` |
| wat een "document" ís (breder dan IFC) | `src/state/documentContract.ts` |
