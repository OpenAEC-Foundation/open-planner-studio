# Een veld toevoegen dat een opslaan/laden overleeft

IFC 4.3 is het **native bestandsformaat** van Open Planner Studio, geen exportformaat. Opslaan =
`writeIFC`, laden = `readIFC`. Er is geen apart JSON-projectformaat waar de rest in past. Dat betekent
één harde regel:

> **Domeindata die niet door de IFC-laag round-trippt, is bij de volgende keer openen weg.**

Die regel staat al in `CLAUDE.md`. Wat er niet stond is *hoe* — welke bestanden je aanraakt, in welke
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
mijlpaal-soort, leveling, notities, kleur — gebruiken we een eigen property set met het
`OPS_`-voorvoegsel.

Die acht staan in **`ifcPsets.ts`**, in `PER_TASK_PSETS`, en ook hier draagt één descriptor beide
kanten:

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
`OPS_CustomFields`, `OPS_ActivityCodes`, `OPS_Baselines`, `OPS_SchedulingOptions`, …). Die laatste
hebben een afwijkende vorm — per resource, per kalender, of één blob op het schedule — en delen
alleen de naam. Schrijf een nieuwe naam dus in `PSET`, nooit als losse string in de writer.

Twee dingen om te weten:

- **De volgorde in de lijst is bindend.** De writer schrijft de psets in array-volgorde; dat is wat de
  byte-identieke STEP-uitvoer bewaakt. De reader dispatcht op naam en is volgorde-ongevoelig.
- **De gouden regel:** `write` geeft `null` of een lege lijst terug wanneer er niets te schrijven valt,
  en dán wordt er ook niets geschreven. Een taak zonder deadline levert geen leeg `OPS_Deadline`-pset
  op. Dat houdt bestaande bestanden bit-gelijk en voorkomt dat elk project met lege psets volloopt.

### 3. Eén autoritatief JSON-blob

Voor structuren die niet in losse properties passen — baselines, `schedulingOptions`, de
custom-field- en activity-code-definities, de bedrijfsbibliotheek — schrijven we één
`IFCPROPERTYSINGLEVALUE` met JSON erin, op het `IfcWorkSchedule` of het `IfcProject`.

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
- **De vergelijkingstabellen zijn `satisfies CanonSpec<X>`** — dat is `Record<keyof X, …>`, dus élk
  veld moet ook een expliciete cel krijgen in de vergelijking.

Die tweede is er bijgekomen omdat de eerste alléén niet genoeg bleek (bevinding K10a): een nieuw veld
kreeg wel een fixture-waarde, maar stond in geen enkele hand-opgesomde vergelijkingstabel en
round-tripte dus stil nul bytes — met een groene suite.

De test doet daarnaast twee dingen die makkelijk te vergeten zijn:

- **Idempotentie.** Een tweede round-trip (write→read→write→read) moet identiek zijn aan de eerste.
  Een normalisatie die per ronde iets verschuift, valt hier om.
- **Ids worden op natuurlijke sleutels vergeleken** (wbsCode, naam), niet letterlijk — taak-,
  resource-, relatie- en kalender-ids worden bij het inlezen opnieuw gegenereerd. Alle
  kruisverwijzingen worden vóór de vergelijking naar die sleutels herschreven.

## Als een veld bewust níét round-trippt

Dat mag, maar dan expliciet: zet het in `KNOWN_GAPS` met een classificatie en een reden.

Het mechanisme is scherper dan een lijst met uitzonderingen. Elke gap-assertie bewijst dat het verlies
er **nog steeds** is. Dicht iemand later de writer of de reader, dan **faalt** die assertie — en dat is
de bedoeling: het herinnert eraan de gap uit de lijst te halen in plaats van hem eeuwig te laten staan
als een halve waarheid.

Bestaande gaps zijn bijvoorbeeld `resource.availability` (een `@deprecated` migratie-alleen veld dat
de writer bewust overslaat) en de uur-modus-velden `durationMinutes`/`remainingMinutes`, die in deze
dag-modus-fixture niet van toepassing zijn en hun eigen dekking hebben in
`tests/planning/check-adapters-hours.ts`.

## Wat dit niet dekt

- **De CSV-, MS Project- en P6-adapters.** Dat zijn import/export-adapters, geen opslagformaat; ze
  hebben hun eigen tests en hun eigen (kleinere) contract.
- **App-globale data.** Extensies, de resourcebibliotheek-pool en de instellingen zijn geen
  projectdata. Uitzondering: de herkomststempels van de bibliotheek round-trippen wél door het
  project-IFC, via hetzelfde `OPS_`-pset-patroon (zie `docs/library.md`).
- **De vraag of andere programma's ons bestand kunnen lezen.** De round-trip-test bewijst dat *wij*
  onze eigen data terugkrijgen. Interop met Synchro, BlenderBIM of Navisworks is nooit getest — dat
  staat als open onzekerheid in `docs/onderhoudbaarheid/README.md` §6.

## Waar het echt staat

| onderwerp | bestand |
|---|---|
| native slots (write + read per slot) | `src/services/ifc/ifcTaskSlots.ts` |
| per-taak-psets (write + apply per descriptor) | `src/services/ifc/ifcPsets.ts` |
| schrijven | `src/services/ifc/ifcWriter.ts` |
| lezen | `src/services/ifc/ifcReader.ts` |
| de poort, de fixture, de canon-tabellen en `KNOWN_GAPS` | `tests/planning/check-ifc-roundtrip.ts` |
| welke velden een save meeschrijft | `src/state/ifcSaveInput.ts` |
| wat een "document" ís (breder dan IFC) | `src/state/documentContract.ts` |
