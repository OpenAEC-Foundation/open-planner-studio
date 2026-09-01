# Issue #27 — Etappe 2: spreadsheet-round-trip voor voortgangsdata (implementatieplan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een uitvoerder krijgt een blad, vult er voortgang in, stuurt het terug — en de planner leest
dat blad in **zonder zijn document te verliezen**. Concreet: (1) de CSV-export draagt een stabiele
taak-id-kolom zodat een rondgestuurd blad terugkoppelbaar is, (2) er komt een importpad dat
**bijwerkt in plaats van vervangt** en uitsluitend de drie voortgangsvelden raakt, (3) er staat een
**verplichte preview** tussen bestand en document — inclusief de mogelijkheid om rijen waarvan de
identiteit verloren of betwijfeld is **met de hand aan een taak te koppelen** — en pas na expliciete
bevestiging één transactionele apply met één undo-stap.

Etappe 1 (het status-update-grid: `actualStart`/`actualFinish`/`actualDuration` als bewaakte kolommen,
invarianten in `src/engine/taskMutationRules.ts`, planner in `src/engine/taskGrid/taskEditPlan.ts`)
staat op main en is de bouwsteen waar dit plan op leunt.

---

## Eigenaarsbesluiten 2026-09-01 (niet heropenen)

| # | besluit | waar het in dit plan landt |
|---|---|---|
| **E1** | De stabiele id-kolom gaat in de **gewone** CSV-export; er komt **geen** apart sjabloonformaat. | *A1*, T4 |
| **E2** | **Drie** instappunten: Backstage → Importeren, de **Planning**-ribbontab en de **Tabel**-ribbontab. Alle drie openen dezelfde flow. | *A10*, T8 |
| **E3** | **Handmatig koppelen is een harde eis.** Verloren of betwijfelde id's moeten zichtbaar zijn én in de previewdialoog koppelbaar; een taak hoort bij maximaal één rij. De pure kern draagt dit (plan herbouwbaar uit een set overrides), headless testbaar. | *A11*, T1/T2/T3/T5 + T7 |
| **E4** | **Handmatig koppelwerk mag nooit verloren gaan.** Een documentwissel is **onmogelijk** zolang de dialoog openstaat — niet: state over een wissel heen bewaren. `resetDocumentScopedUI` blijft als vangnet dat in de praktijk nooit mag afgaan. | *A12*, T6, T10 |
| **E5** | **Datums worden altijd juist gelezen; stil raden is verboden.** Ruime formaatherkenning, dag/maand-volgorde **per bestand** met bewijs, en bij twijfel een expliciete vraag aan de gebruiker vóór de preview. De preview toont datums voluit. | *A5*, T1/T4/T6/T10/T12 |
| **E6** | **De voltooiingskolom is altijd een percentage.** `100` = 100 %, `1` = 1 %, `45,5` = 45,5 %; buiten 0–100 ⇒ weigering. De fractie-interpretatie vervalt volledig in deze lezer. | *A5*, T4, T12 |

Eerdere bindende besluiten die overeind blijven: de preview is **verplicht** (geen sneltoets eromheen),
weigeringen zijn **nooit stil**, matching is **intern id primair met WBS als terugval** plus een
expliciet rapport van alles wat niet matchte.

De DD/MM-"waakhond-waarschuwing" uit de vorige ronde is **vervallen** — *A5* vervangt hem.

---

**Architecture:** Drie strikt gescheiden lagen.

1. **`src/services/progressImport/` (nieuw, puur).** Geen store-import, geen I/O, geen React. Bevat
   het contract (`types.ts`), de bestandsformaat-**specifieke** lezer (`parseProgressCsv.ts`) en de
   bestandsformaat-**agnostische** kern (`sheetValues.ts`, `matchRows.ts`, `buildPlan.ts`).
2. **`src/state/slices/taskSlice.ts`.** Twee acties: `previewProgressImport` (leest, muteert niets) en
   `applyProgressImport` (herberekent hetzelfde plan tegen de live taken en schrijft het in één
   `set()` met één undo-stap).
3. **`src/components/dialogs/ProgressImportDialog.tsx` (nieuw).** Naar het model van
   `PoolImportDialog`: kies bestand → (indien nodig) datumvolgorde-vraag → preview met koppelkiezer →
   expliciete bevestigknop → resultaatweergave. Plus de drie instappunten uit E2.

**Tech Stack:** TypeScript strict, geen nieuwe dependencies. Tests als `check-*.ts`-batterijen onder
`tests/planning/` (geregistreerd in `tests/planning/run.sh`) plus één Playwright-spec onder
`tests/browser/`. De poort is `npm run verify` — oordeel **UITSLUITEND op de exitcode**. Machinebreed
draait er maximaal **één** `verify` tegelijk.

---

## Scope

**In dit plan (etappe 2):**

- Een stabiele id-kolom `OPS Task ID` in de gewone CSV-export (E1).
- Een strikte, ruim herkennende voortgangslezer met datumvolgorde-detectie (E5) en
  percentage-semantiek (E6).
- De pure match/merge-kern: id-matching met WBS-terugval, **handmatige overrides** (E3),
  no-op-detectie, per-rij-weigeringen.
- De preview-/bevestigdialoog met per-rij oud → nieuw, een "betwijfeld"-strook, een taakkiezer, een
  datumvolgorde-vraag wanneer nodig, en een resultaatweergave ná apply.
- Eén transactionele apply = één undo-stap, atomair.
- De documentwissel-blokkade (E4) inclusief de twee sneltoetsgaten die daarvoor dicht moeten.
- Drie instappunten (E2), i18n (14 locales, `common` + `menu`), in-app gids `nl` + `en`.

**NIET in dit plan:**

| onderwerp | reden |
|---|---|
| **XLSX** | Aparte eigenaarsbeslissing, aparte etappe. Zie *A9*. |
| Een apart "status-update view"-scherm | De kolompresets van etappe 1 dekken dat al. |
| Wijzigingen aan `loadState` / `fileSlice.openFile` / `READ_FORMATS` | Dit is géén documentimport. |
| Een apart "sjabloonformaat" voor de CSV | E1. |
| Actuals **wissen** via een leeg blad | Q1 — default: leeg = "geen wijziging". |
| Nieuwe `NotificationMessageKey`-entries | *A7*. |
| MCP-tool voor voortgangsimport | `planner_batch` + `update_tasks` dekken het AI-pad al. |
| Handmatige koppelingen **bewaren** tussen sessies | Q4. |
| Een **"alles bevestigen"-massaknop** voor betwijfelde WBS-koppelingen | Niet gevraagd door de eigenaar. Een knop die in één klik tientallen zwakke matches accepteert is precies het stille-goedkeuring-risico dat dit plan probeert te vermijden. Zie Q5 als mogelijk vervolg. |

---

## Context voor wie hier koud instapt

Alles hieronder is **geverifieerd tegen de code op 2026-09-01** (branch `t3code/8ed9f377`,
HEAD `ad14470a`). Regelnummers zijn indicatief; de ankers zijn functie-in-bestand.

### Wat er vandaag met CSV gebeurt

- **`writeCSV`** (`src/services/csv/csvWriter.ts`) schrijft `BOM + CRLF`, delimiter `;`, 15 kolommen:
  `WBS, Name, Duration (days), Start, Finish, Predecessors, Task Type, OPS Custom Task Type ID,
  Status, Completion (%), Actual Start, Actual Finish, Critical, Total Float, Description`.
  Er is **geen** id-kolom. `Completion (%)` = `Math.round(task.time.completion * 100)` — hele
  procenten, dus de export verliest precisie (BEVESTIGD; oorzaak van de no-op-regel in *A6*).
  `Actual Start`/`Actual Finish` worden **rauw** geschreven, dus in uur-modus kan daar een datetime
  staan. `Start`/`Finish` dragen de geplande datums (`earlyStart || scheduleStart` resp.
  `earlyFinish || scheduleFinish`) — dat maakt ze bruikbaar als **ijkpunt** voor *A5*.
- **`readCSV`** (`src/services/csv/csvReader.ts`) mapt kolommen op **koptekst** via `mapColumnIndex`,
  nooit op index; onbekende koppen worden genegeerd. Iedere rij krijgt een verse `generateId('task')`.
  Datums lopen via `csvDateOrToday` (`src/services/importDates.ts`), die bij onherkenbare invoer stil
  **vandaag** teruggeeft (BEVESTIGD) en `DD-MM-YYYY`/`DD/MM/YYYY` hard als dag-eerst leest, zónder
  geldigheidscontrole (`2026-13-45` glipt door de ISO-tak). Voor een vervang-import een verdedigbare
  conventie; voor een update-import onacceptabel — zie *A5*.
- **Kolomvolgorde is geen contract.** In fase 2.6 zijn `Actual Start`/`Actual Finish` **midden** in de
  lijst ingevoegd, wat alle daarop volgende indices verschoof. De enige testassertie op de kop is
  `header.includes('OPS Custom Task Type ID')` in `check-adapters-hours.ts` (~r887).

### De bestaande invariantenlagen (er zijn er vier, allemaal echt)

| laag | functie | gebruikt door |
|---|---|---|
| `src/engine/taskMutationRules.ts` | `applyProgressInvariants(task, statusDate)`, `isActualPastStatusDate(…)` | alle lagen hieronder |
| `src/engine/taskGrid/taskEditPlan.ts` | `planTaskCellEdits(task, edits, environment)`; privé `applyProgressEdits` met codes `actualAfterStatusDate`, `actualFinishBeforeStart`, `conflictingProgressInputs` | het taakgrid (etappe 1) |
| `src/state/mcpValidation.ts` | `progress.applyProgressUpdate(…)` — zacht per item | de MCP-tools |
| `src/services/importNormalize.ts` | `normalizeImportedProgress(tasks, statusDate?)` op **rauw ingelezen** taken | CSV-/MSPDI-**vervang**-import |

Twee dingen die je moet weten voordat je kiest (beide BEVESTIGD):

- `progress.applyProgressUpdate` weigert **elke** voortgangsmutatie zonder `statusDate` (stap 8). Het
  grid van etappe 1 kent die eis niet. Andere productbelofte, dus niet de gekozen motor — zie *A3*.
- `normalizeImportedProgress` werkt op een hele takenlijst ineens en kent geen per-rij-uitkomst.
  Ongeschikt als weigeringsbron; hij blijft ongemoeid in het vervang-pad.

### De plannerses omgeving

`TaskEditPlanEnvironment` wordt vandaag **inline** opgebouwd, precies één keer, in
`src/state/gridTransaction.ts` (~r454). De kalender is **per taak** (`effectiveCalendarOf`), dus de
omgeving is per taak. Er is geen herbruikbare fabriek — die maken we in T3.

### Ribbon: hoe de twee tabs zijn opgebouwd (nodig voor E2)

- Een knop is een `RibbonButtonSpec`; kopieer `moveProjectButton` (~r325). Een groep is
  `RibbonGroupSpec { id, labelKey, items: RibbonItemSpec[] }` en **mag een knop en een component
  mengen**.
- **`planningTab`** (~r335) definieert zijn `schedule`-groep **inline** — niet de gedeelde
  `scheduleGroup`. Zijn laatste groep is `baselines` met component `BaselinesProgressGroupContent`
  (statusdatum + voortgangsmodus), dat **alleen daar** gebruikt wordt.
- **`tableTab`** (~r770) is opgebouwd uit **gedeelde constanten** die het met `startTab` deelt. Een
  knop in `scheduleGroup` verschijnt dus óók op Start — zie *A10*.

### Documentwissel-routes (nodig voor E4) — geverifieerd, één route dicht, twee open

| route | status | bewijs |
|---|---|---|
| **Documentchrome** (`DocumentTabBar`, `ProjectRail`, `SwitcherPill`, `ProjectOverview`) | **DICHT** | De gedeelde `Dialog` rendert `fixed inset-0 … bg-black/60 z-50` over de volle viewport en vangt elke klik. De chrome staat in de normale flow; het hoogste stapelniveau daar is `.ops-rail { z-index: 25 }`. Het enige element boven de dialoog is `.ops-flyout { z-index: 60 }` — maar dat is een hover-flyout met `pointer-events: none`, en de hover-bron zelf ligt onder de backdrop. `ProjectOverview` staat bovendien al in `hasBlockingDialogOpen`. |
| **Backstage → Recent / Voorbeelden** (openen in een nieuw document) | **DICHT** | Backstage is géén overlay: `App.tsx` rendert hem in de body wanneer `activeRibbonTab === 'file'`. Hij ligt dus onder dezelfde `z-50`-backdrop. |
| **MCP-bridge** (`planner_switch_document`, `planner_new_document`, `planner_duplicate_document`, `planner_import_schedule`) | **DICHT** | Alle vier lopen via `guardBridgeFlags` → `preBackupGuards` (`src/services/mcp/tools/runtime.ts` r185-198), dat `hasBlockingDialogOpen(ui)` toetst en `DIALOG_OPEN` teruggeeft. `runReadTool`/`runMutateTool` doen hetzelfde. Er bestaat geen `close_document`-tool. **Let op:** `BLOCKING_UI_FLAGS` (runtime.ts r110) is een parallel, met de hand onderhouden lijst die alleen de fout *benoemt*; onze vlag moet daar ook in, anders zegt de fout "een dialoog". |
| **Extensies** | **DICHT** | Geen enkele treffer op `switchDocument`/`newDocument`/`closeDocument` in `src/extensions/`. |
| **Ctrl/⌘ 1–9** (`documentSwitchShortcuts`, shortcutRegistry ~r98) | **OPEN — moet dicht** | Die entries hebben **geen `when`**, en `useKeyboardShortcuts` kent géén globale blokkeer-guard (elke entry regelt het zelf). Ctrl+1 wisselt vandaag dus gewoon van document terwijl er een dialoog openstaat. |
| **Ctrl+O** (`file.open`, shortcutRegistry ~r141) | **OPEN — moet dicht** | Ook geen `when`. En `openFile` opent in een **nieuw** document tenzij het actieve tabblad pristine is (`isActivePristine`, `fileSlice`) — dat is een documentwissel. Extra valkuil: in **productiebuilds** vangt de browser-sneltoets-voorpoort in `useKeyboardShortcuts.ts` (~r84) Ctrl+O **vóór** het register af en roept `openFile` direct aan; een `when` op de registry-entry helpt daar dus niet. Die voorpoort heeft al het juiste precedent voor Ctrl+N: `&& !isAnyDialogOpen()`. |

`isAnyDialogOpen()` (`src/hooks/useDialogKeys.ts`) is `true` zodra er een `Dialog` gemonteerd is — de
stapelregistratie zit in `useDialogKeys`, dat `Dialog` onvoorwaardelijk aanroept. Onze dialoog gebruikt
de gedeelde `Dialog`, dus die poort werkt automatisch.

### Meldingen, dialogen, i18n, datumweergave

- `notify(NotifyInput)` in `uiSlice.ts`; `NotificationMessageKey` in `src/state/slices/types.ts`
  (~r164). **Wij voegen daar niets aan toe** (*A7*).
- `hasBlockingDialogOpen` (~r70) somt de blokkerende dialogen met de hand op. **`showPoolImportDialog`
  staat daar vandaag NIET in** (BEVESTIGD) — een gat, geen precedent.
- `resetDocumentScopedUI` (`documentSlice.ts` ~r68) sluit documentgebonden dialogen bij een wissel.
- Ontbrekende `taskGrid.validation.*`-sleutels vallen in het grid terug op een **hard-coded
  Nederlandse** tekst (`FullTaskGrid.tsx` ~r682); `actualAfterStatusDate`, `actualFinishBeforeStart` en
  `conflictingProgressInputs` hébben geen vertaling (BEVESTIGD). De preview mag daar niet op leunen.
- Herbruikbare keuzelijst: `src/components/common/Select.tsx` (`SelectOption { value, label,
  disabled? }`) — inclusief per-optie `disabled`, precies wat de koppelkiezer nodig heeft.
- Datumweergave: `formatDisplayDate(date, locale)` (`src/utils/dateUtils.ts` ~r138) geeft
  `Intl.DateTimeFormat` met `day: 'numeric', month: 'short', year: 'numeric'` in UTC — "12 jun 2026"
  vs "6 dec 2026" is daarmee ondubbelzinnig. **Geen nieuwe formatter bouwen.**

### Bestandskeuze

`openFileDialog(filters, opts)` (`src/services/fileAccess/index.ts`) levert `{ name, content, bytes?,
ref }` of `null`. `PoolImportDialog.pick()` gebruikt precies dat en raakt `fileSlice`/`loadState` niet
aan — ons voorbeeld. In de browser kiest `openFileDialogWeb` de File System Access-picker wanneer
`'showOpenFilePicker' in window`, anders `openViaInput` (een **niet aan de DOM gehangen**
`<input type="file">`). Dat detail bepaalt hoe de Playwright-case werkt — zie T10.

---

## Architectuurbesluiten

### A1 — De id-kolom heet `OPS Task ID` en staat vooraan, in **elke** CSV-export (E1)

- **Naam:** `OPS Task ID`, naar het precedent `OPS Custom Task Type ID`. De `OPS `-prefix zegt tegen
  een invuller: *dit is van de applicatie, niet van jou*.
- **Positie:** **eerste kolom**, vóór `WBS`. Het blad wordt door mensen ingevuld; de sleutel hoort
  links, waar hij zichtbaar blijft. Index-stabiliteit is géén bestaand contract en beide OPS-lezers
  mappen op koptekst.
- **Altijd meeschrijven, geen apart sjabloonformaat (E1).** Elke gewone CSV-export ís een geldig
  voortgangsblad.
- **`readCSV` blijft de kolom negeren.** Het vervang-pad mint bewust verse id's. `mapColumnIndex` kent
  de kop niet, dus dit is een no-op door constructie — in T4 vastgepind zodat niemand hem later
  "voor de volledigheid" toevoegt.
- **Wat de id waard is.** `task.id` round-tript door IFC via pset `OPS_TaskIdentity`/`InternalTaskId`,
  dus een blad blijft geldig over opslaan/heropenen heen. Het overleeft géén her-import via
  CSV/MPP/MSPDI — daarvoor zijn de WBS-terugval en het handmatig koppelen (*A11*).

### A2 — De kern is puur en bestandsformaat-agnostisch

`src/services/progressImport/`:

| bestand | rol |
|---|---|
| `types.ts` | contract: `ProgressSheet`, `RawProgressRow`, `RawDateCell`, `ProgressRow`, `ProgressOverrides`, `DateOrder`, `DateOrderDetection`, `ProgressImportPlan`, `PROGRESS_IMPORT_LIMITS`. Geen logica. |
| `parseProgressCsv.ts` | **De enige module die van CSV weet.** `parseProgressCsv(text, limits) → ProgressSheet` — levert **rauwe strings**, past nog geen datumvolgorde toe. |
| `sheetValues.ts` | agnostisch: `parseSheetDate(raw, order)`, `parseSheetPercent(raw)`, `detectDateOrder(cells, tasks)`, `finalizeProgressRows(sheet, order)`. |
| `matchRows.ts` | `matchProgressRows(rows, tasks, overrides) → ProgressMatchResult`. |
| `buildPlan.ts` | `buildProgressImportPlan(rows, tasks, deps, overrides) → ProgressImportPlan`. |

Geen van deze modules importeert uit `src/state/` of `src/components/`. `buildPlan.ts` en
`sheetValues.ts` mogen wél uit `src/engine/` en `src/utils/` importeren (precedent:
`src/services/library/occupancy.ts` → `engine/scheduler`).

### A3 — Apply draait op `planTaskCellEdits`

**Gekozen: `planTaskCellEdits`.** Redenen: (1) zelfde semantiek als etappe 1 — een blad invullen en
dezelfde cellen in het status-update-grid typen moeten hetzelfde doen; (2) puur, dus de preview toont
de **echte** einduitkomst inclusief afgeleide `status`/`remainingTime`; (3) zijn foutcodes zijn precies
de weigeringen die de preview moet tonen; (4) `applyProgressUpdate` weigert alles zonder statusdatum
en de store-setters geven alleen `boolean` terug en kosten N undo-stappen.

**Twee regels die `planTaskCellEdits` zelf niet kent** en dus in `buildPlan.ts` horen:

- **Verzameltaken worden geweigerd** (`childIds.length > 0` ⇒ `refused`/`summaryTask`).
  `applyProgressEdits` bewaakt dat níét (BEVESTIGD; alleen `mcpValidation` doet het). Zie Q2.
- **Alleen daadwerkelijk veranderende velden worden een `CellEditIntent`** (*A6*) — dat voorkomt óók
  dat een ongewijzigde `actualStart` alsnog `actualAfterStatusDate` triggert nadat de statusdatum naar
  voren is gezet.

**Waar de omgeving vandaan komt.** T3 licht de inline `TaskEditPlanEnvironment`-opbouw uit
`gridTransaction.ts` en exporteert hem daar als
`buildTaskEditPlanEnvironment(state: AppState, task: Task)`. Bewust **in `gridTransaction.ts`**: de
bouwer heeft `isHourCalendar` (`@/services/subdayIo`) en `effectiveCalendarOf`/`effHoursPerDay`
(`@/utils/taskDuration`) nodig, en `src/engine/` importeert vrijwel niets uit `src/services/`.

### A4 — Apply is één `set()` met het bestaande muteer-ritueel, géén `withTransaction`

```ts
applyProgressImport: (rows, overrides) => {
  let plan!: ProgressImportPlan;
  set((s) => {
    plan = buildProgressImportPlan(rows, s.tasks, depsFrom(s), overrides); // 1. LIVE herberekenen
    if (plan.appliedCount === 0) return;                                   // 2. niets ⇒ geen snapshot
    runtime.beginUndoable(s);                                              // 3. één undo-stap
    for (const row of plan.rows) {
      if (row.outcome !== 'apply') continue;
      const index = s.tasks.findIndex(t => t.id === row.taskId);
      if (index >= 0) s.tasks[index] = row.plannedTask!;                    // 4. vooraf geplande taken
    }
    runtime.finishMutation(s, { stale: true });                            // 5. verouderd tot F5
  });
  get().recomputeViewRows();
  return plan;
},
```

- **Atomair:** het hele plan wordt gebouwd vóór er iets geschreven wordt.
- **Precies één undo-stap** voor het hele blad.
- **Nul toepassingen ⇒ nul undo-stappen**, zoals `setActualStart` bij een weigering.
- **`stale: true`** via `finishMutation`; nooit `s.scheduleStale` direct.

### A5 — Datums en percentages: ruim herkennen, streng valideren, nooit raden (E5 + E6)

`csvDateOrToday` wordt **niet** gebruikt. `sheetValues.ts` bevat de hele waarde-laag.

#### A5.1 Wat de datumparser herkent

`parseSheetDate(raw, order: DateOrder)`:

| invoer | uitkomst |
|---|---|
| `''` / witruimte | `absent` — **geen wijziging**, geen fout (Q1) |
| `YYYY-MM-DD` | `date`, mits bestaande kalenderdatum (round-trip: terugformatteren geeft dezelfde string; `2026-02-30`/`2026-13-01` ⇒ `unreadable`) |
| `YYYY-MM-DDTHH:mm[:ss]` **en** `YYYY-MM-DD HH:mm[:ss]` | `date`, **datetime behouden**, genormaliseerd naar `T`-vorm |
| `d-m-yyyy`, `d/m/yyyy`, `d.m.yyyy` — **zonder voorloopnullen** (`9-6-2026`), gemengd (`09-6-2026`) | `date` volgens `order`, met dezelfde geldigheidscontrole |
| dezelfde vormen **met tijd**, gescheiden door spatie of `T`: `9-6-2026 8:30`, `9.6.2026 08:30:00` | `date` met tijd |
| al het overige (tekst, `12-6`, jaar < 1000, onbestaande datum) | `unreadable` |

Waarom zo ruim: **Excel herschrijft bij opslaan álle datumcellen** — ook onaangeraakte — naar zijn
locale-formaat, meestal zonder voorloopnullen en met de locale-scheider. "Blad door Excel heen" is het
gangbaarste pad en moet gewoon werken. Streng blijven we op echte onzin.

`unreadable` ⇒ rij-outcome `refused`, reden `unreadableDate`, zichtbaar in de preview; de rest van het
blad gaat door. `csvDateOrToday` en `readCSV` blijven **onaangeraakt**.

#### A5.2 Dag/maand-volgorde per BESTAND, met bewijs

Excel is consequent binnen één bestand, dus de volgorde is een **bestandseigenschap**, geen
celeigenschap.

```ts
export type DateOrder = 'dmy' | 'mdy';
export type DateOrderDetection =
  | { order: DateOrder; evidence: 'noAmbiguity' | 'outOfRange' | 'calibration' }
  | { order: 'ambiguous'; sample: string; sampleAlternatives: [string, string] };
export function detectDateOrder(
  cells: readonly RawDateCell[],
  tasks: readonly Task[],
): DateOrderDetection;
```

`RawDateCell` draagt `{ rowNumber, field: 'actualStart' | 'actualFinish' | 'start' | 'finish', raw,
taskId? }`. De velden `start`/`finish` komen uit de kolommen `Start`/`Finish` en dienen **uitsluitend**
als ijkpunt — ze worden **nooit** geschreven (*A5.4*).

Beslisregels, in deze volgorde:

1. **Geen dubbelzinnigheid.** Verzamel alle niet-lege, niet-ISO cellen die als numeriek drietal
   `(a, b, jaar)` parsen. Is er geen enkele ⇒ `{ order: 'dmy', evidence: 'noAmbiguity' }` (de waarde
   doet er niet toe; er is geen niet-ISO datum om te interpreteren).
2. **Bereikregel (`> 12` beslist).** Een cel met `a > 12` kan alleen dag-eerst zijn ⇒ stemt `dmy`; een
   cel met `b > 12` alleen maand-eerst ⇒ stemt `mdy`. Een cel met **beide** > 12 is onder geen enkele
   orde geldig en stemt niet (hij wordt later `unreadable`).
   - Alleen `dmy`-stemmen ⇒ `{ order: 'dmy', evidence: 'outOfRange' }`; idem voor `mdy`.
   - **Stemmen voor beide ordes** ⇒ het bestand is intern tegenstrijdig; geen enkele orde verklaart
     het. Dan **niet** doorgaan naar stap 3 maar meteen `ambiguous` — de gebruiker kiest, en de cellen
     die onder die keuze onmogelijk zijn worden gewoon `unreadableDate`. Nooit stil half goed lezen.
3. **IJkpuntregel (kalibratie).** Alleen voor rijen met een **id-match** (WBS is te zwak bewijs om een
   bestandsbrede beslissing op te baseren). Neem hun `start`/`finish`-cellen die dubbelzinnig zijn
   (beide componenten ≤ 12) én die onder de twee ordes een **verschillende** datum opleveren
   (`12-12-2026` telt dus niet mee). Vergelijk beide interpretaties met de geplande datum van de taak
   in het document — `time.earlyStart || time.scheduleStart` voor `start`,
   `time.earlyFinish || time.scheduleFinish` voor `finish` — op **datumdeel**. Tel `dmyHits` en
   `mdyHits`.
   - Winnaar wint wanneer `winnerHits >= MIN_CALIBRATION_HITS (= 3)` **en**
     `winnerHits >= CALIBRATION_RATIO (= 3) * loserHits` ⇒ `{ order, evidence: 'calibration' }`.
   - Anders ⇒ `ambiguous`.
   Waarom deze drempels: één of twee treffers kunnen toeval zijn (in een dichte planning landt een
   verwisselde datum makkelijk op een andere bestaande taakdatum), en een factor 3 zegt "de ene lezing
   verklaart het bestand, de andere niet". Beide constanten worden geëxporteerd zodat de test ze bij
   naam noemt en een mutatie zichtbaar wordt.
4. **`ambiguous` ⇒ de dialoog vraagt het** (*A5.3*). `sample` is de eerste dubbelzinnige rauwe cel in
   bestandsvolgorde; `sampleAlternatives` zijn de twee volledig geformatteerde lezingen daarvan
   (`formatDisplayDate`), zodat de vraag concreet is en niet abstract.

#### A5.3 De vraag aan de gebruiker

Bij `ambiguous` toont de dialoog **vóór de preview** een extra toestand met precies twee knoppen,
geformuleerd met de echte voorbeelddatum uit het bestand:

> `12-6-2026` — is dat **12 juni 2026** of **6 december 2026**?

Eén keuze geldt voor het **hele bestand**. Er is **geen** stille default en geen "onthoud dit". De
keuze gaat als `order`-parameter naar `finalizeProgressRows(sheet, order)` en daarmee naar het plan.
Verandert de gebruiker later van gedachten, dan is er in de previewtoestand een terugknop naar de
vraag (de rijen worden dan opnieuw gefinaliseerd; de overrides blijven staan, want die hangen aan
rijnummers).

#### A5.4 `Start`/`Finish` zijn detectiedata, geen schrijfdata

De kolommen `Start`/`Finish` komen **alleen** in `ProgressSheet.detectionCells` terecht, niet in
`ProgressRow`. Zo bestaat er geen veld dat per ongeluk in een `CellEditIntent` kan belanden. Dat is
een structurele garantie, geen afspraak — en T4 pint hem met een test die bewijst dat een blad met
gewijzigde `Start`-kolom niets aan de planning verandert.

#### A5.5 De preview toont datums voluit

Elke datum in preview én resultaat wordt gerenderd met `formatDisplayDate(parseDate(iso),
i18n.language)` ("12 jun 2026"); staat er een tijddeel in, dan komt dat erachter. Zo is een
dag/maand-verwisseling ook ná de detectie nog met het blote oog te zien. **Nooit** de rauwe ISO-string
tonen als enige weergave.

#### A5.6 Percentages zijn altijd percentages (E6)

De kolom heet "Completion (%)"; wat de invuller typt ís een percentage.
`parseSheetPercent(raw)` accepteert `^\s*-?\d+(?:[.,]\d+)?\s*%?\s*$` (decimaalkomma **en** -punt,
`%`-teken optioneel) en deelt **altijd** door 100:

- `100` ⇒ `1.0` · `45` ⇒ `0.45` · `45,5` ⇒ `0.455` · `1` ⇒ `0.01` · `0,5` ⇒ `0.005` · `100%` ⇒ `1.0`
- buiten `[0, 100]` (bv. `150`, `-1`) ⇒ `unreadable` ⇒ `refused`/`unreadableNumber`
- geen match (tekst, leeg met tekens) ⇒ `unreadable`

De fractie-interpretatie ("waarde in [0,1] is een fractie") **vervalt volledig** in deze lezer; de
`readCSV`-vervangimport houdt zijn eigen, oude conventie.

### A6 — No-op-detectie met tolerantie (blijft nodig, ook onder E6)

De export rondt `Completion (%)` af op hele procenten en kan een datetime tot datum degraderen. Zonder
tolerantie zou een **ongewijzigd** teruggestuurd blad honderden "wijzigingen" tonen:

- **completion:** verschil `< 0.005` (een half procent) ⇒ geen edit. `PERCENT_EPSILON = 0.005`,
  geëxporteerd zodat de test hem bij naam noemt. (E6 verandert hier niets aan: `33` blijft `0.33`
  terwijl het document `0.333` kan dragen.)
- **datums:** een binnenkomende **datum-only** waarde gelijk aan het datumdeel (`slice(0, 10)`) van de
  huidige waarde ⇒ geen edit. Een blad mag een datetime nooit stil degraderen tot middernacht.
- Alle velden no-op ⇒ outcome `noop`, samengevouwen onder "ongewijzigd (N)".

### A7 — De dialoog draagt zijn eigen resultaat; nul nieuwe notificatiesleutels

Fouten (bestand onleesbaar, geen bruikbare kolommen, te groot) tonen we **in de dialoog**, zoals
`PoolImportDialog` zijn `companyLibrary.importNotAPool` toont. Ná apply schakelt de dialoog naar een
resultaatweergave. Geen uitbreiding van `NotificationMessageKey`, geen `notify()`, geen `alert()`. Het
meldingenkanaal is er voor gebeurtenissen **buiten** een gefocust oppervlak.

Nieuwe dialoogteksten: één groep `progressImport.*` in namespace `common`; de ribbon-labels in `menu`.
**Geen `{{count}}`-interpolatie** — dat maakt van elke sleutel een CLDR-pluralfamilie in veertien
locales. Gebruik `{{applied}}`, `{{refused}}`, `{{total}}`, `{{sample}}`, `{{optionA}}`, `{{optionB}}`.

### A8 — Drift: apply herberekent, de preview is advies

1. De dialoog bewaart **het sheet, de gekozen datumvolgorde en de overrides**, niet het plan.
2. `applyProgressImport` bouwt het plan **opnieuw** binnen dezelfde `set()`, tegen de live taken.
3. De dialoog is documentgebonden; een documentwissel is bovendien onmogelijk (*A12*).
4. `previewProgressImport` en `applyProgressImport` roepen **letterlijk dezelfde**
   `buildProgressImportPlan` aan.

### A9 — Wat XLSX later moet doen (en niets meer)

De enige formaat-bewuste module is `parseProgressCsv.ts`. Een latere XLSX-etappe levert
`parseProgressXlsx(bytes, limits) → ProgressSheet` — hetzelfde returntype — en registreert een tweede
extensie in de bestandsfilter. `sheetValues.ts`, `matchRows.ts`, `buildPlan.ts`, de overrides, de
store-acties, de dialoog en alle kern-tests blijven ongewijzigd. XLSX draagt bovendien **getypeerde**
datumcellen, dus zo'n lezer kan de volgorde-vraag helemaal overslaan door ISO-strings af te geven —
`detectDateOrder` geeft dan `noAmbiguity` en de vraagtoestand verschijnt niet. **Regel voor de
implementer:** komt er ook maar één `csv`-woord, één delimiter of één `\r\n` voorbij de grens van
`parseProgressCsv.ts`, dan is de naad kapot.

### A10 — Drie instappunten, één flow (E2)

Eén gedeelde `RibbonButtonSpec` en één Backstage-kaart; alle drie doen
`setUI({ showProgressImportDialog: true })`.

```ts
/** E2: "Voortgang bijwerken uit een blad" — hetzelfde spec op Planning én Tabel (één bron, twee
 *  callsites; zelfde patroon als openResourcePanelButton/calcButton). */
const progressImportButton: RibbonButtonSpec = {
  kind: 'button', id: 'progressImport', icon: <ClipboardCheck size={20} />,
  labelKey: 'menu:ribbon.progressImport',
  use: () => {
    const setUI = useAppStore(s => s.setUI);
    const hasTasks = useAppStore(s => s.tasks.length > 0);
    return { onClick: () => setUI({ showProgressImportDialog: true }), disabled: !hasTasks };
  },
};
```

| instappunt | plek | hoe |
|---|---|---|
| Backstage → Importeren | `ImportSection` (`Backstage.tsx` ~r489) | een eigen kaart **bovenaan**, boven de extensie-importerlijst; die lijst en zijn `loadState`-gedrag blijven ongewijzigd. De kaart doet `setUI({ activeRibbonTab: 'start', showProgressImportDialog: true })` — Backstage sluit, zoals `ExportSection` dat na een export ook doet, zodat het resultaat tegen de planning zichtbaar is |
| Planning-tab | `planningTab`, groep `baselines` (~r407) | `items: [{ kind: 'component', … BaselinesProgressGroupContent }, progressImportButton]` |
| Tabel-tab | `tableTab` (~r770) | een **eigen, tabel-only groep** achteraan: `{ id: 'tableProgress', labelKey: 'menu:ribbon.progressGroup', items: [progressImportButton] }` |

**Waarom de Tabel-tab een eigen groep krijgt:** `tableTab` deelt zijn groepen met `startTab`, dus een
knop in `scheduleGroup` zou óók op Start verschijnen — buiten E2. Dit is een bewuste afwijking van het
"alleen gedeelde constanten"-commentaar boven `tableTab`; **werk dat commentaar bij**, anders liegt het.

`disabled` bij een leeg document: een voortgangsblad zonder taken kan niets koppelen — dezelfde lijn
als `moveProjectButton`.

### A11 — Handmatig koppelen: overrides als eerste-klas invoer van de kern (E3)

```ts
export type ProgressOverrides = ReadonlyMap<number, string>;   // rowNumber → task.id
```

De dialoog houdt deze kaart in React-state; hij wordt niet opgeslagen en niet in de store gezet (Q4).

**Resolutievolgorde in `matchProgressRows` (bindend):**

1. **Overrides eerst**, in rijvolgorde. Een override naar een bestaande taak claimt die taak en levert
   `match: 'manual'`. Handmatige intentie is autoritair en wint dus van een automatische id- of
   WBS-treffer van een **andere** rij.
2. Een override naar een **niet-bestaande** taak wordt **genegeerd** (de rij valt terug op automatische
   matching) en het rijnummer komt in `plan.ignoredOverrideRows`. Nooit stil.
3. Twee overrides naar dezelfde taak: de **eerste in rijvolgorde** wint, de tweede wordt
   `refused`/`duplicateRow`. De UI voorkomt dit vooraf (geclaimde taken staan `disabled`), maar de kern
   mag daar niet op vertrouwen.
4. Daarna de automatische matching op de resterende taken: exact `task.id` ⇒ `'id'`; anders een
   **unieke** `wbsCode` ⇒ `'wbs'`; meerdere dragers ⇒ `ambiguousWbs`; niets ⇒ `unmatched`; al geclaimd
   ⇒ `duplicateRow`.

**"Betwijfeld" is een afgeleide, geen aparte toestand.** `needsConfirmation === (match === 'wbs')`.
Bevestigen en corrigeren zijn dus hetzelfde mechanisme: bevestigen = een override naar dezelfde taak
(waarna `match` `'manual'` wordt), corrigeren = een override naar een andere taak. Eén codepad.

**Herbouw, niet bijwerken.** Elke wijziging in de overrides leidt tot een **volledige** herberekening
via dezelfde `buildProgressImportPlan`.

**Apply draagt de overrides mee.** `applyProgressImport(rows, overrides)`; zonder dat argument gaan de
handmatige koppelingen bij het bevestigen verloren. Dit is de meest waarschijnlijke implementatiefout
in dit plan en wordt daarom expliciet getest (T5).

### A12 — Een documentwissel is onmogelijk zolang de dialoog openstaat (E4)

Handmatig koppelwerk hangt aan taak-id's van één document en leeft alleen in de dialoog. In plaats van
dat werk over een wissel heen te bewaren, maken we de wissel onmogelijk. `showProgressImportDialog`
gaat in `hasBlockingDialogOpen`, en daarmee zijn — geverifieerd, zie *Context* — de documentchrome,
Backstage en de hele MCP-bridge al dicht. **Twee routes moeten alsnog gedicht worden:**

1. `documentSwitchShortcuts` (Ctrl/⌘ 1–9, `shortcutRegistry.ts` ~r98) krijgt
   `when: () => !hasBlockingDialogOpen()`.
2. `file.open` (Ctrl+O, ~r141) krijgt dezelfde `when`, **én** de productie-voorpoort in
   `useKeyboardShortcuts.ts` (~r84) krijgt `&& !isAnyDialogOpen()` op zijn Ctrl+O-tak — precies zoals
   die tak dat voor Ctrl+N al doet. Zonder die tweede helft is Ctrl+O in een productiebuild nog steeds
   open, want de voorpoort draait vóór het register.

Beide fixes veranderen het gedrag **ook voor de bestaande blokkerende dialogen** (vandaag wisselt
Ctrl+1 met een TaskDialog open gewoon van document, waarna `resetDocumentScopedUI` die dialoog sluit).
Dat is een bewuste, gewenste opschoning: een modale dialoog hoort modaal te zijn. Noem het expliciet
in het commitbericht.

**`resetDocumentScopedUI` blijft** — `showProgressImportDialog` wordt daar gesloten. Maar dat is
uitsluitend een **vangnet dat in de praktijk nooit mag afgaan**. Gaat het wél af, dan is er een
wisselroute die we gemist hebben; dat is een bug, geen normaal gedrag.

**Als je tijdens de implementatie een wisselroute vindt die je niet dicht krijgt** — bijvoorbeeld een
nieuwe MCP-tool, een extensie-API of een platformweg die de backdrop omzeilt — **meld dat aan de
orkestrator** in plaats van stil terug te vallen op "dan sluiten we de dialoog maar".

---

## Het contract (bindend — T1 schrijft dit letterlijk)

```ts
// src/services/progressImport/types.ts

/** Eén cel die ALLEEN voor datumvolgorde-detectie wordt gelezen (A5.2/A5.4). `start`/`finish` komen
 *  uit de kolommen Start/Finish en worden NOOIT naar een taak geschreven. */
export interface RawDateCell {
  rowNumber: number;
  field: 'actualStart' | 'actualFinish' | 'start' | 'finish';
  raw: string;
  /** Alleen gezet bij een harde id-treffer — de ijkpuntregel gebruikt niets zwakkers. */
  taskId?: string;
}

/** Eén rij zoals de bestandslezer hem oplevert: sleutels al genormaliseerd, waarden nog RAUW
 *  (de datumvolgorde is op dat moment nog niet bekend). */
export interface RawProgressRow {
  /** 1-gebaseerd rijnummer in het bronbestand, inclusief de kopregel. Sleutel van de overrides. */
  rowNumber: number;
  taskId?: string;
  wbsCode?: string;
  /** Naam uit het blad — UITSLUITEND om de preview leesbaar te maken; nooit geschreven. */
  name?: string;
  rawCompletion?: string;
  rawActualStart?: string;
  rawActualFinish?: string;
}

export type ProgressFileIssue =
  | 'tooLarge' | 'tooManyRows' | 'noKeyColumn' | 'noProgressColumns' | 'unreadable';

/** Wat een bestandslezer (CSV nu, XLSX later) oplevert. */
export interface ProgressSheet {
  fileIssue?: ProgressFileIssue;
  rawRows: readonly RawProgressRow[];
  /** Uitsluitend detectiemateriaal (A5.4). */
  detectionCells: readonly RawDateCell[];
}

export type DateOrder = 'dmy' | 'mdy';
export type DateOrderDetection =
  | { order: DateOrder; evidence: 'noAmbiguity' | 'outOfRange' | 'calibration' }
  | { order: 'ambiguous'; sample: string; sampleAlternatives: [string, string] };

/** Eén gefinaliseerde rij: waarden geparsed onder de vastgestelde datumvolgorde. */
export interface ProgressRow {
  rowNumber: number;
  taskId?: string;
  wbsCode?: string;
  name?: string;
  completion?: { kind: 'value'; value: number } | { kind: 'unreadable'; raw: string };
  actualStart?: { kind: 'value'; iso: string } | { kind: 'unreadable'; raw: string };
  actualFinish?: { kind: 'value'; iso: string } | { kind: 'unreadable'; raw: string };
}

/** Handmatige koppelingen (E3/A11): rijnummer → task.id. Leeft in de dialoog, niet in de store. */
export type ProgressOverrides = ReadonlyMap<number, string>;

export type ProgressMatchKind = 'id' | 'wbs' | 'manual';

export type ProgressRowReason =
  | 'unmatched' | 'ambiguousWbs' | 'duplicateRow' | 'summaryTask'
  | 'unreadableDate' | 'unreadableNumber' | 'noProgressColumns'
  | 'actualAfterStatusDate' | 'actualFinishBeforeStart' | 'conflictingProgressInputs'
  | 'rejected';          // overige plannerfout; `plannerCode` draagt de originele code

export interface ProgressFieldChange {
  field: 'completion' | 'actualStart' | 'actualFinish';
  before: string | number | undefined;
  after: string | number | undefined;
}

export interface ProgressPlanRow {
  rowNumber: number;
  outcome: 'apply' | 'noop' | 'refused';
  reason?: ProgressRowReason;
  plannerCode?: string;
  match?: ProgressMatchKind;
  /** Waar ⇔ `match === 'wbs'`: gematcht op de zwakkere terugvalsleutel (A11). */
  needsConfirmation?: boolean;
  taskId?: string;
  /** WBS + naam van de GEMATCHTE taak (niet uit het blad). */
  taskLabel?: string;
  changes: readonly ProgressFieldChange[];
  /** Alleen bij `apply`: de volledig gecanonicaliseerde taak zoals hij geschreven wordt. */
  plannedTask?: Task;
}

export interface ProgressImportPlan {
  rows: readonly ProgressPlanRow[];
  appliedCount: number;
  noopCount: number;
  refusedCount: number;
  /** Rijen die op koppeling wachten: `unmatched` of `ambiguousWbs`. */
  needsLinkCount: number;
  /** Rijen met `needsConfirmation` (WBS-terugval, nog niet bevestigd). */
  needsConfirmationCount: number;
  /** Overrides die naar een niet meer bestaande taak wezen (A11 regel 2) — nooit stil. */
  ignoredOverrideRows: readonly number[];
  /** Taken zonder enige rij die ze claimde (informatief, niet fout). */
  untouchedTaskCount: number;
}

/** Harde grenzen op ONGEVALIDEERDE bestandsinvoer (hardening — zie de checklist). */
export const PROGRESS_IMPORT_LIMITS = {
  maxBytes: 16 * 1024 * 1024,
  maxRows: 50_000,
  maxCellChars: 4096,
  maxIdChars: 256,      // spiegelt isValidPersistedIfcId in ifcReader.ts
  maxWbsChars: 128,
} as const;

/** Kalibratiedrempels (A5.2 regel 3) — geëxporteerd zodat de test ze bij naam noemt. */
export const MIN_CALIBRATION_HITS = 3;
export const CALIBRATION_RATIO = 3;
/** No-op-tolerantie op completion (A6). */
export const PERCENT_EPSILON = 0.005;
```

---

## Taken

### Taak T1 — Het contract (blokkeert alle banen)

Klein, eerst, daarna **bevroren**. Het bevat bewust ook het override-model (E3) en het
sheet/detectie-model (E5), zodat de banen tegen een vaste vorm kunnen bouwen.

**Files:**
- Create: `src/services/progressImport/types.ts` (letterlijk het blok hierboven)
- Create: `src/services/progressImport/index.ts` (barrel: re-export van types; groeit in T2–T4)

- [ ] **Step 1:** Schrijf `types.ts` exact zoals hierboven, met `import type { Task } from '@/types/task';`.
- [ ] **Step 2:** `npm run typecheck` — groen.

**Acceptatie:** `npm run typecheck` groen. Mutatiebewijs volgt in T2/T3/T4.

---

### Taak T2 — `matchProgressRows`: overrides → id → WBS

**Files:**
- Create: `src/services/progressImport/matchRows.ts`
- Create: `tests/planning/check-progress-import.ts` (deel 1; T3/T5 vullen aan)

**Contract:**

```ts
export interface ProgressRowMatch {
  rowNumber: number;
  taskId?: string;
  match?: ProgressMatchKind;
  reason?: Extract<ProgressRowReason, 'unmatched' | 'ambiguousWbs' | 'duplicateRow'>;
}
export interface ProgressMatchResult {
  matches: readonly ProgressRowMatch[];
  ignoredOverrideRows: readonly number[];
}
export function matchProgressRows(
  rows: readonly ProgressRow[],
  tasks: readonly Task[],
  overrides?: ProgressOverrides,
): ProgressMatchResult;
```

Implementeer exact de resolutievolgorde uit *A11*. Indexeer `tasks` één keer in een `Map` (id) en een
`Map<string, string[]>` (wbs) — geen `find()` per rij (50.000 rijen mogelijk).

- [ ] **Step 1: Schrijf de falende test.** Sectie *"Deel 1 — matching"*. Helperstijl (`eq`/`ok`,
  exitcode) letterlijk uit `tests/planning/check-task-slice.ts`:

```ts
eq('id wint van WBS',                m.matches[0].match, 'id');
eq('…en levert taak A',              m.matches[0].taskId, A.id);
eq('onbekend id valt terug op WBS',  m.matches[1].match, 'wbs');
eq('dubbele WBS ⇒ ambiguousWbs',     m.matches[2].reason, 'ambiguousWbs');
eq('niets bruikbaars ⇒ unmatched',   m.matches[3].reason, 'unmatched');
eq('tweede claim ⇒ duplicateRow',    m.matches[5].reason, 'duplicateRow');
eq('…en de EERSTE rij houdt de taak', m.matches[4].taskId, A.id);
eq('override koppelt een losse rij',  o.matches[3].match, 'manual');
eq('…aan de gekozen taak',            o.matches[3].taskId, C.id);
eq('override wint van een id-treffer van een ANDERE rij', o2.matches[0].reason, 'duplicateRow');
eq('…want de override claimde de taak eerst',              o2.matches[1].match, 'manual');
eq('override naar dezelfde taak = bevestiging',            o3.matches[1].match, 'manual');
eq('twee overrides op één taak: tweede geweigerd',         o4.matches[2].reason, 'duplicateRow');
eq('override naar een verdwenen taak wordt genegeerd',     o5.matches[0].match, 'wbs');
ok('…en gerapporteerd',              o5.ignoredOverrideRows.includes(2));
```

  Draai standalone (registratie in `run.sh` doet T11):

```bash
node_modules/.bin/esbuild tests/planning/check-progress-import.ts --bundle --platform=node \
  --format=esm --alias:@=src --define:import.meta.env.DEV=false --define:import.meta.env.PROD=true \
  --define:import.meta.env.MODE='"production"' --define:__OPS_DEV_INSTANCE__='"test"' \
  --outfile=tests/planning/.progress-import.mjs && node tests/planning/.progress-import.mjs; echo "exit: $?"
```

  Verwacht: **rood**.

- [ ] **Step 2: Implementeer** `matchRows.ts`.
- [ ] **Step 3:** Groen; `git status --short` — geen `.mjs`-artefact stagen.

**Acceptatie (mutatie-bewijsbaar):**
- WBS-terugval ook bij dubbele WBS laten matchen ⇒ `dubbele WBS ⇒ ambiguousWbs` rood.
- Volgorde omdraaien (WBS vóór id) ⇒ `id wint van WBS` rood.
- Overrides **ná** de automatische matching resolven ⇒ `override wint van een id-treffer van een
  ANDERE rij` rood.
- Een override naar een verdwenen taak hard laten weigeren ⇒
  `override naar een verdwenen taak wordt genegeerd` rood.

---

### Taak T3 — `buildProgressImportPlan`: het preview-plan

**Files:**
- Create: `src/services/progressImport/buildPlan.ts`
- Modify: `src/state/gridTransaction.ts` (de inline omgeving-opbouw ~r454 wordt de geëxporteerde
  `buildTaskEditPlanEnvironment(state, task)`; het bestaande callsite roept hem aan)
- Modify: `src/services/progressImport/index.ts`
- Modify: `tests/planning/check-progress-import.ts` (delen 2 en 3)

**Contract:**

```ts
export interface ProgressPlanDeps {
  /** Injecteerbare naad: in productie `planTaskCellEdits`, in de test een stub. */
  planEdits: (task: Task, edits: readonly CellEditIntent[]) => GridResult<PlannedTaskEdit, readonly CellValidationError[]>;
}
export function buildProgressImportPlan(
  rows: readonly ProgressRow[],
  tasks: readonly Task[],
  deps: ProgressPlanDeps,
  overrides?: ProgressOverrides,
): ProgressImportPlan;
```

Stappen per rij (elke `⇒ refused` stopt de rij, nooit het blad):

1. Matchuitkomst zonder `taskId` ⇒ `refused` met die reden; tel mee in `needsLinkCount` bij
   `unmatched` of `ambiguousWbs`.
2. Rij zonder enige voortgangswaarde ⇒ `refused`/`noProgressColumns`.
3. Een `unreadable`-veld ⇒ `refused`/`unreadableDate` resp. `unreadableNumber`.
4. `task.childIds.length > 0` ⇒ `refused`/`summaryTask`.
5. No-op-filter (*A6*) ⇒ overgebleven velden worden `CellEditIntent`s
   (`{ kind: 'cell-edit', taskId, columnId: 'task.time.completion' | 'task.time.actualStart' |
   'task.time.actualFinish', route: 'task-progress', value }`). Nul over ⇒ `noop`.
6. `deps.planEdits(task, edits)`; `ok: false` ⇒ `refused` met `plannerCode = errors[0].code` en de
   bijbehorende reden.
7. `ok: true` ⇒ `apply` met `plannedTask` en de `changes`-lijst (before uit de **huidige** taak, after
   uit de **geplande** taak).
8. `needsConfirmation = (match === 'wbs')` op elke rij die een taak trof, ongeacht de outcome.

- [ ] **Step 1: Schrijf de falende test**, sectie *"Deel 2 — planvorming (stub-planner)"*:

```ts
eq('ongewijzigd blad ⇒ nul wijzigingen',      plan.appliedCount, 0);
eq('…en alles telt als noop',                 plan.noopCount, rows.length);
eq('afgeronde procenten zijn geen wijziging', planRounded.appliedCount, 0);   // doc 33%, blad "33"
eq('een echte procentwijziging telt wél',     planChanged.appliedCount, 1);   // doc 33%, blad "40"
eq('datum-only degradeert een datetime niet', planDt.rows[0].outcome, 'noop');
eq('verzameltaak wordt geweigerd',            planSum.rows[0].reason, 'summaryTask');
eq('onleesbare datum wordt geweigerd',        planBad.rows[0].reason, 'unreadableDate');
eq('…en NOOIT stilzwijgend vandaag',          planBad.rows[0].changes.length, 0);
ok('één geweigerde rij stopt het blad niet',  planMixed.appliedCount === 2 && planMixed.refusedCount === 1);
eq('rij zonder voortgangskolommen',           planEmpty.rows[0].reason, 'noProgressColumns');
eq('WBS-match is betwijfeld',                 planWbs.rows[0].needsConfirmation, true);
eq('…en telt in de teller',                   planWbs.needsConfirmationCount, 1);
eq('bevestigen haalt de twijfel weg',         planOk.rows[0].needsConfirmation, undefined);
eq('losse rijen worden geteld',               planLoose.needsLinkCount, 2);
eq('een gekoppelde rij draait gewoon mee',    planLinked.appliedCount, 1);
eq('…met dezelfde changes als een id-match',  JSON.stringify(planLinked.rows[0].changes), JSON.stringify(planById.rows[0].changes));
```

  Sectie *"Deel 3 — planvorming met de ECHTE planner"* (document via de store, omgeving via
  `buildTaskEditPlanEnvironment`, `planTaskCellEdits` als `planEdits`):

```ts
eq('actual ná de statusdatum wordt geweigerd', plan.rows[0].reason, 'actualAfterStatusDate');
eq('invarianten leiden actualStart af',        plan.rows[1].changes.some(c => c.field === 'actualStart'), true);
eq('…en de geplande status is COMPLETED',      plan.rows[1].plannedTask!.status, 'COMPLETED');
eq('finish vóór start wordt geweigerd',        plan.rows[2].reason, 'actualFinishBeforeStart');
```

  Verwacht: **rood**.

- [ ] **Step 2: Implementeer** `buildPlan.ts` + de export van `buildTaskEditPlanEnvironment`. De
  extractie is een **pure refactor**: het bestaande objectliteral wordt de body van de functie, het
  callsite geeft `taskForCalendar` mee. Draai daarna `bash tests/planning/run.sh` volledig — de
  bestaande `check-grid-transaction.ts` moet ongewijzigd groen blijven; dát is het bewijs dat de
  refactor gedragsneutraal is.
- [ ] **Step 3:** Groen; `npm run verify:cycles` groen.

**Acceptatie (mutatie-bewijsbaar):**
- `PERCENT_EPSILON` op `0` ⇒ `afgeronde procenten zijn geen wijziging` rood.
- Datum-only altijd schrijven ⇒ `datum-only degradeert een datetime niet` rood.
- Per-rij-weigering vervangen door een vroege return over het blad ⇒
  `één geweigerde rij stopt het blad niet` rood.
- `summaryTask`-controle weglaten ⇒ `verzameltaak wordt geweigerd` rood.
- `needsConfirmation` ook op `'manual'` zetten ⇒ `bevestigen haalt de twijfel weg` rood.
- Een handmatig gekoppelde rij anders behandelen dan een id-match ⇒
  `…met dezelfde changes als een id-match` rood.

---

### Taak T4 — De bestandskant: id-kolom, ruime waardeparser en datumvolgorde-detectie (E5/E6)

De grootste taak van baan B. Drie brokken: de writer-kolom, `parseProgressCsv` (rauw), en
`sheetValues` (waarden + detectie + finalisatie).

**Files:**
- Modify: `src/services/csv/csvWriter.ts` (`writeCSV`: kop + rij)
- Create: `src/services/progressImport/parseProgressCsv.ts`
- Create: `src/services/progressImport/sheetValues.ts`
- Create: `tests/planning/check-progress-import-csv.ts`

**Writer.** `'OPS Task ID'` als **eerste** kopelement en `escapeCSV(task.id)` als eerste rijelement.
Verder niets — geen nieuw exportformaat, geen wijziging aan `EXPORT_FORMATS`.

**`parseProgressCsv(text, limits = PROGRESS_IMPORT_LIMITS) → ProgressSheet`:**

- `text.length > limits.maxBytes` ⇒ `fileIssue: 'tooLarge'` (vóór het parsen).
- BOM strippen, delimiter detecteren (`;` vs `,`, zelfde heuristiek als `csvReader.detectDelimiter`),
  splitsen op `\r?\n`, lege regels overslaan.
- Hergebruik de **vorm** van `parseCSVLine` (quotes, verdubbelde quotes). Kopieer die functie bewust
  naar deze module in plaats van hem uit `csvReader.ts` te exporteren: de vervang-lezer mag niet
  meebewegen met wat deze lezer later nodig heeft. Zet er een commentaarregel bij die dat zegt.
- Kolomherkenning op koptekst (lowercased/trimmed):
  `taskId: ['ops task id', 'ops taskid', 'task id']`, `wbs: ['wbs', 'wbs code', 'wbscode']`,
  `name: ['name', 'task name', 'naam', 'taak']`,
  `completion: ['completion', 'completion (%)', '% complete', 'percent', 'voltooiing']`,
  `actualStart: ['actual start', 'actualstart', 'werkelijke start']`,
  `actualFinish: ['actual finish', 'actualfinish', 'werkelijke einde', 'werkelijk einde']`,
  **detectie-only:** `start: ['start', 'start date', 'begin', 'startdatum']`,
  `finish: ['finish', 'finish date', 'end', 'end date', 'eind', 'einddatum']`.
- Alle drie de voortgangskolommen ontbreken ⇒ `fileIssue: 'noProgressColumns'`.
- Beide sleutelkolommen ontbreken ⇒ `fileIssue: 'noKeyColumn'`.
- Meer dan `limits.maxRows` datarijen ⇒ `fileIssue: 'tooManyRows'` (weiger, knip niet stil af).
- Elke cel getrimd en begrensd (`maxCellChars`; id op `maxIdChars`, wbs op `maxWbsChars`) —
  **overschrijding is een weigering, geen afkapping**. Een id met een stuurteken
  (`code <= 31 || code === 127`) telt als afwezig; spiegelt `isValidPersistedIfcId`.
- `detectionCells` krijgt de vier datumvelden per rij (`actualStart`, `actualFinish`, `start`,
  `finish`), met `taskId` **alleen** wanneer de rij een niet-lege `OPS Task ID` droeg.
- `rawRows` bevat **uitsluitend** sleutels, naam en de drie rauwe voortgangswaarden — geen
  `start`/`finish` (*A5.4*).

**`sheetValues.ts`:** `parseSheetDate(raw, order)`, `parseSheetPercent(raw)` (*A5.1*/*A5.6*),
`detectDateOrder(cells, tasks)` (*A5.2*) en
`finalizeProgressRows(sheet: ProgressSheet, order: DateOrder): readonly ProgressRow[]`.

- [ ] **Step 1: Schrijf de falende test** `tests/planning/check-progress-import-csv.ts`:

```ts
// ── Writer ────────────────────────────────────────────────────────────────────
ok('kop draagt de id-kolom',        header.includes('OPS Task ID'));
eq('…als eerste kolom',             header.split(';')[0].replace(/^﻿/, ''), 'OPS Task ID');
eq('…en de rij draagt het echte id', firstRow.split(';')[0], task.id);
ok('de bestaande kolommen staan er nog', header.includes('OPS Custom Task Type ID') && header.includes('Actual Start'));
ok('vervang-import mint een eigen id', readCSV(writeCSV(...)).tasks[0].id !== task.id);
// ── Datumformaten (A5.1) ──────────────────────────────────────────────────────
eq('leeg veld ⇒ afwezig, geen fout',   d(''), undefined);
eq('ISO',                              iso(d('2026-06-09')), '2026-06-09');
eq('ISO met T-tijd blijft datetime',   iso(d('2026-06-09T08:30')), '2026-06-09T08:30');
eq('ISO met SPATIE-tijd ook',          iso(d('2026-06-09 08:30')), '2026-06-09T08:30');
eq('zonder voorloopnullen',            iso(d('9-6-2026', 'dmy')), '2026-06-09');
eq('punt als scheidingsteken',         iso(d('9.6.2026', 'dmy')), '2026-06-09');
eq('slash als scheidingsteken',        iso(d('9/6/2026', 'dmy')), '2026-06-09');
eq('spatie-datetime zonder nullen',    iso(d('9-6-2026 8:30', 'dmy')), '2026-06-09T08:30');
eq('…met seconden',                    iso(d('9-6-2026 8:30:15', 'dmy')), '2026-06-09T08:30:15');
eq('mdy leest dezelfde cel anders',    iso(d('9-6-2026', 'mdy')), '2026-09-06');
eq('2026-02-30 bestaat niet',          d('2026-02-30')!.kind, 'unreadable');
eq('31-2-2026 bestaat niet',           d('31-2-2026', 'dmy')!.kind, 'unreadable');
eq('tekst is onleesbaar',              d('volgende week')!.kind, 'unreadable');
eq('…en NIET vandaag',                 (d('volgende week') as {raw:string}).raw, 'volgende week');
// ── Datumvolgorde-detectie (A5.2) ─────────────────────────────────────────────
eq('alleen ISO ⇒ geen dubbelzinnigheid', det(isoOnly).evidence, 'noAmbiguity');
eq('een component > 12 beslist dmy',     det(has25).order, 'dmy');
eq('…en andersom mdy',                   det(hasMonth25).order, 'mdy');
eq('tegenstrijdig bestand ⇒ ambiguous',  det(contradictory).order, 'ambiguous');
eq('ijkpunt met 3 treffers beslist',     det(calib3, tasks).order, 'dmy');
eq('…met bewijssoort calibration',       det(calib3, tasks).evidence, 'calibration');
eq('2 treffers is te weinig',            det(calib2, tasks).order, 'ambiguous');
eq('gelijkspel beslist niet',            det(calibTie, tasks).order, 'ambiguous');
eq('WBS-rijen tellen niet als ijkpunt',  det(calibWbsOnly, tasks).order, 'ambiguous');
ok('ambiguous draagt een echt voorbeeld', det(calib2, tasks).sample === '12-6-2026');
// ── Start/Finish zijn detectie-only (A5.4) ────────────────────────────────────
eq('Start/Finish komen niet in de rijen', Object.keys(sheet.rawRows[0]).some(k => /start|finish/i.test(k) && !/actual/i.test(k)), false);
eq('een gewijzigde Start-kolom verandert niets', planWithChangedStart.appliedCount, 0);
// ── Percentages (E6/A5.6) ─────────────────────────────────────────────────────
eq('100 ⇒ 1.0',    pct('100'), 1);
eq('45 ⇒ 0.45',    pct('45'), 0.45);
eq('45,5 ⇒ 0.455', pct('45,5'), 0.455);
eq('45.5 ⇒ 0.455', pct('45.5'), 0.455);
eq('1 ⇒ 0.01',     pct('1'), 0.01);
eq('0,5 ⇒ 0.005',  pct('0,5'), 0.005);
eq('100% ⇒ 1.0',   pct('100%'), 1);
eq('150 ⇒ onleesbaar', p('150')!.kind, 'unreadable');
eq('-1 ⇒ onleesbaar',  p('-1')!.kind, 'unreadable');
eq('tekst ⇒ onleesbaar', p('bijna klaar')!.kind, 'unreadable');
// ── Bestandsgrenzen ───────────────────────────────────────────────────────────
eq('blad zonder sleutelkolom',        parseProgressCsv(noKey).fileIssue, 'noKeyColumn');
eq('blad zonder voortgangskolommen',  parseProgressCsv(noProgress).fileIssue, 'noProgressColumns');
eq('te veel rijen wordt geweigerd',   parseProgressCsv(big, tinyLimits).fileIssue, 'tooManyRows');
eq('te lang id wordt geweigerd',      rows9[0].taskId, undefined);
eq('id met stuurteken telt niet',     rows10[0].taskId, undefined);
ok('quotes en delimiters in namen overleven', rows11[0].name === 'Fase 1; deel "A"');
eq('rowNumber telt de kopregel mee',  sheet.rawRows[0].rowNumber, 2);
```

  Verwacht: **rood**.

- [ ] **Step 2: Implementeer** writer-kolom, `parseProgressCsv.ts` en `sheetValues.ts`.
- [ ] **Step 3:** Groen; daarna `bash tests/planning/run.sh` (exitcode!) — `check-adapters-hours.ts` en
  `check-custom-task-types.ts` raken de CSV-kop.

**Acceptatie (mutatie-bewijsbaar):**
- Id-kolom achteraan zetten ⇒ `…als eerste kolom` rood.
- `'ops task id'` aan `mapColumnIndex` toevoegen én `readCSV` het id laten adopteren ⇒
  `vervang-import mint een eigen id` rood.
- `parseSheetDate` vervangen door `csvDateOrToday` ⇒ `tekst is onleesbaar` en `…en NIET vandaag` rood.
- Voorloopnullen verplicht stellen ⇒ `zonder voorloopnullen` rood.
- `MIN_CALIBRATION_HITS` op `1` zetten ⇒ `2 treffers is te weinig` rood.
- `CALIBRATION_RATIO` op `1` zetten ⇒ `gelijkspel beslist niet` rood.
- Bij een tegenstrijdig bestand tóch een orde kiezen ⇒ `tegenstrijdig bestand ⇒ ambiguous` rood.
- WBS-matches als ijkpunt toelaten ⇒ `WBS-rijen tellen niet als ijkpunt` rood.
- `Start`/`Finish` in `rawRows` opnemen ⇒ `Start/Finish komen niet in de rijen` rood.
- De fractie-interpretatie terugzetten ⇒ `1 ⇒ 0.01` rood.
- Een te lang id afkappen i.p.v. weigeren ⇒ `te lang id wordt geweigerd` rood.

---

### Taak T5 — De store-acties: preview en apply, mét overrides

**Files:**
- Modify: `src/state/slices/taskSlice.ts` (interface + twee acties)
- Modify: `tests/planning/check-progress-import.ts` (deel 4)

```ts
/** Bouwt het voortgangsplan tegen de HUIDIGE taken. Muteert niets — de dialoog toont dit als preview
 *  en herbouwt het bij elke wijziging in de handmatige koppelingen (A11).
 *  Precedent voor een lezende actie: `isLocalPoolNewer` (librarySlice). */
previewProgressImport: (rows: readonly ProgressRow[], overrides?: ProgressOverrides) => ProgressImportPlan;
/** Herberekent hetzelfde plan tegen de live taken en past het in ÉÉN undo-stap toe (A4/A8). */
applyProgressImport: (rows: readonly ProgressRow[], overrides?: ProgressOverrides) => ProgressImportPlan;
```

Beide bouwen hun `ProgressPlanDeps` met
`planEdits: (task, edits) => planTaskCellEdits(task, edits, buildTaskEditPlanEnvironment(state, task))`.
`detectDateOrder` is **géén** store-actie: hij heeft alleen `tasks` nodig en wordt puur vanuit de
dialoog aangeroepen.

- [ ] **Step 1: Schrijf de falende test**, sectie *"Deel 4 — store"*:

```ts
eq('preview muteert niets',               after.time.completion, before.time.completion);
eq('preview telt de wijzigingen',         preview.appliedCount, 2);
eq('apply schrijft de geplande taak',     t.time.completion, 0.4);
eq('apply zet status via de invarianten', t.status, 'STARTED');
ok('apply markeert de planning verouderd', s.scheduleStale === true);
undo();
eq('één Ctrl+Z herstelt het hele blad',   t2.time.completion, before.time.completion);
eq('…en niet slechts één rij',            t3.time.completion, beforeOther.time.completion);
eq('een blad zonder wijzigingen pusht geen undo-stap', historyLenAfter, historyLenBefore);
ok('geweigerde rij raakt zijn taak niet aan', untouched.time.actualStart === undefined);
eq('apply herberekent tegen de live taken', applied.refusedCount, 1);
eq('preview met override koppelt de rij',   previewLinked.appliedCount, 1);
eq('apply MET overrides schrijft die rij',  linkedTask.time.completion, 0.6);
eq('apply ZONDER overrides schrijft hem niet', unlinkedTask.time.completion, 0);
```

  Verwacht: **rood**.

- [ ] **Step 2: Implementeer** beide acties volgens *A4*.
- [ ] **Step 3:** Groen; `npm run verify:store-boundaries` groen.

**Acceptatie (mutatie-bewijsbaar):**
- Het `overrides`-argument laten vallen in apply ⇒ `apply MET overrides schrijft die rij` rood.
- Het preview-plan hergebruiken i.p.v. herberekenen ⇒ `apply herberekent tegen de live taken` rood.
- `beginUndoable` ook bij `appliedCount === 0` ⇒ `een blad zonder wijzigingen pusht geen undo-stap` rood.
- Per rij een eigen `set()` ⇒ `één Ctrl+Z herstelt het hele blad` rood.
- `s.scheduleStale = true` direct zetten ⇒ de broncode-check in `check-recorded-dates.ts` wordt rood.

---

### Taak T6 — De dialoog + de documentwissel-blokkade (E4/E5)

**Files:**
- Create: `src/components/dialogs/ProgressImportDialog.tsx`
- Modify: `src/App.tsx` (lazy mount naast `PoolImportDialog`)
- Modify: `src/state/slices/types.ts` (`UIState.showProgressImportDialog: boolean`)
- Modify: `src/state/slices/uiSlice.ts` (initiële waarde `false`)
- Modify: `src/hooks/keyboard/shortcutRegistry.ts` (`hasBlockingDialogOpen` + de twee `when`-guards
  uit *A12*)
- Modify: `src/hooks/keyboard/useKeyboardShortcuts.ts` (`!isAnyDialogOpen()` op de Ctrl+O-tak van de
  productie-voorpoort, *A12*)
- Modify: `src/services/mcp/tools/runtime.ts` (`BLOCKING_UI_FLAGS` — alleen voor de foutnaam)
- Modify: `src/state/slices/documentSlice.ts` (`resetDocumentScopedUI`, als vangnet)

**Vorm** — volg `PoolImportDialog.tsx`: gedeelde `Dialog`,
`panelProps={{ 'data-ops-progress-import-dialog': true }}`, kop met sluitkruis, scrollbare body,
voetbalk met *Annuleren* + primaire knop.

**Vier toestanden, strikt na elkaar:**

1. **Kiezen.** Eén knop → `openFileDialog([{ name: 'Spreadsheet', extensions: ['csv'] }])`. `null`
   ⇒ niets. Daarna `parseProgressCsv(res.content)`; `fileIssue` ⇒ toon
   `progressImport.fileIssue.<issue>` en blijf hier.
2. **Datumvolgorde (alleen wanneer nodig, E5).** `detectDateOrder(sheet.detectionCells, tasks)`.
   Levert dat een `order`, dan **direct door naar 3**. Levert het `ambiguous`, dan deze toestand:
   de vraag met de echte `sample` en de twee volledig geformatteerde `sampleAlternatives` als twee
   knoppen. Geen stille default, geen "onthoud dit".
3. **Preview (verplicht).** `rows = finalizeProgressRows(sheet, order)` →
   `previewProgressImport(rows, overrides)`. Toon:
   - de tellers (toegepast / ongewijzigd / wacht op koppeling / geweigerd);
   - de rijen die iets doen of weigeren (`noop` samengevouwen), per rij: rijnummer, `taskLabel`, de
     `changes` als `veld: oud → nieuw` met **voluit geformatteerde datums** (*A5.5*), en bij een
     weigering `progressImport.reason.<reason>`;
   - `ignoredOverrideRows` als aparte melding;
   - een terugknop naar toestand 2 wanneer de volgorde gevraagd is (overrides blijven staan — die
     hangen aan rijnummers);
   - bevestigknop **disabled** zolang `appliedCount === 0`.
4. **Resultaat.** `applyProgressImport(rows, overrides)` → verse tellers + geweigerde rijen, één knop
   *Sluiten*. **Geen** sneltoets, geen automatische apply — de preview is niet overslaanbaar.

**Overig:**
- Sluiten wist sheet, plan, order én overrides.
- `showProgressImportDialog` in `hasBlockingDialogOpen`, in `BLOCKING_UI_FLAGS` (runtime.ts) en in
  `resetDocumentScopedUI`.
- Alle teksten via `t()` uit `common`, groep `progressImport.*`. Geen `{{count}}`.

- [ ] **Step 1:** UI-vlag + mount + de vier registraties (`hasBlockingDialogOpen`,
  `BLOCKING_UI_FLAGS`, `resetDocumentScopedUI`, en de twee `when`-guards + de voorpoort uit *A12*).
- [ ] **Step 2:** De dialoog (toestanden 1–4, nog zonder koppelkiezer).
- [ ] **Step 3:** `npm run lint` (hookregels!) + `npm run typecheck` groen; `npm run test:mcp` groen
  (de `BLOCKING_UI_FLAGS`-wijziging raakt de MCP-suite).

**Acceptatie:** de Playwright-cases in T10. Mutatie-bewijsbaar daar: meteen toepassen zonder
bevestiging ⇒ `annuleren laat het document ongemoeid` rood; de `when` op Ctrl/⌘ 1–9 weglaten ⇒
`wisselen is onmogelijk zolang de dialoog openstaat` rood.

---

### Taak T7 — De koppelkiezer: verloren en betwijfelde rijen met de hand koppelen (E3)

**Files:**
- Modify: `src/components/dialogs/ProgressImportDialog.tsx`
- Create: `src/components/dialogs/ProgressImportLinkPicker.tsx`

**Gedrag:**

- De dialoog houdt `const [overrides, setOverrides] = useState<Map<number, string>>(new Map())` en
  geeft die bij **elke** render mee aan `previewProgressImport`. Elke wijziging is een **volledige**
  herberekening (*A11*).
- **Sectie "Wacht op koppeling"** — rijen met reden `unmatched` of `ambiguousWbs`. Per rij: rijnummer,
  wat het blad zei (`wbsCode`/`name`/de waarden die het wil zetten) en een `ProgressImportLinkPicker`.
  Kiezen ⇒ override ⇒ de rij verhuist bij de volgende render naar de gewone lijst als `apply` (of als
  weigering met een échte reden, bv. `summaryTask` — ook dat moet zichtbaar zijn).
- **Sectie "Koppeling betwijfeld"** — rijen met `needsConfirmation`. Per rij de gevonden taak plus
  *Bevestigen* (override naar diezelfde taak) en *Wijzigen* (opent de kiezer). Eén mechanisme.
  **Geen massaknop** — zie *Scope* en Q5.
- **Terugdraaien:** naast een gekoppelde rij een *Koppeling wissen*-knop.
- Een rij ontkoppeld laten mag: hij blijft in de weigeringslijst en telt niet mee in `appliedCount`.

**`ProgressImportLinkPicker`:**

- Props `{ tasks, takenTaskIds, value, onChange }`.
- Een tekstveld dat filtert op WBS **en** naam (case-insensitive substring) plus de gedeelde `Select`
  (`SelectOption { value, label, disabled }`), `label` = `` `${wbsCode} — ${name}` ``.
- **Reeds geclaimde taken zijn `disabled`** — de UI-helft van *A11* regel 3; de kern weigert een
  dubbele koppeling alsnog, dus dit is comfort, geen garantie.
- **Begrens de lijst**: maximaal 200 opties, anders de hint "verfijn je zoekterm". Een `Select` met
  20.000 opties bevriest de dialoog — en het aantal taken is gebruikersinvoer.
- Verzameltaken worden **wel** getoond; de kern weigert de rij daarna met `summaryTask`. Beter dan ze
  verstoppen: de gebruiker ziet waaróm het niet kan.

- [ ] **Step 1:** `ProgressImportLinkPicker` + de twee secties.
- [ ] **Step 2:** `npm run lint` + `npm run typecheck` groen.
- [ ] **Step 3:** De koppel-cases in T10 groen.

**Acceptatie:** T10-cases `een losse rij handmatig koppelen laat hem meedraaien` en `een al gekoppelde
taak is niet nog eens kiesbaar`. Mutatie-bewijsbaar: de overrides niet meegeven aan
`previewProgressImport` ⇒ de eerste case rood; `takenTaskIds` weglaten ⇒ de tweede rood.

---

### Taak T8 — Drie instappunten (E2)

**Files:**
- Modify: `src/components/layout/Ribbon/ribbonConfig.tsx` (`progressImportButton`, `planningTab`,
  `tableTab` + het commentaar boven `tableTab`)
- Modify: `src/components/backstage/Backstage.tsx` (`ImportSection`)

Voer *A10* uit. `ribbonWidgets.tsx` wordt **niet** aangeraakt.

- [ ] **Step 1:** De knopconstante + de twee tab-aansluitingen; werk het commentaar boven `tableTab`
  bij.
- [ ] **Step 2:** De Backstage-kaart (sluit Backstage mee).
- [ ] **Step 3:** `npm run typecheck` + `npm run lint` groen; controleer dat de knop **niet** op de
  Start-tab staat.

**Acceptatie:** T10 opent de dialoog met echte muisklikken via de Backstage-kaart én de Tabel-tabknop.
Mutatie-bewijsbaar: de knop in `scheduleGroup` hangen ⇒ `de knop staat niet op de Start-tab` rood.

---

### Taak T9 — i18n, veertien locales

**Files:**
- Modify: `src/i18n/locales/{nl,en,fr,de,es,zh,it,pt,pl,tr,ar,ja,ko,fa}/common.json`
- Modify: dezelfde veertien `menu.json`

`common.json` — groep `progressImport` met minimaal: `title`, `chooseFile`, `intro`, `summaryApplied`,
`summaryNoop`, `summaryNeedsLink`, `summaryRefused`, `sectionNeedsLink`, `sectionDoubtful`,
`confirmLink`, `changeLink`, `clearLink`, `pickerPlaceholder`, `pickerFilter`, `pickerTooMany`,
`pickerTaken`, `overrideDropped`, **`dateOrderTitle`**, **`dateOrderQuestion`** (met `{{sample}}`),
**`dateOrderOptionA`/`dateOrderOptionB`** (met `{{date}}`), **`dateOrderBack`**, `confirm`, `close`,
`resultTitle`, `fileIssue.{tooLarge,tooManyRows,noKeyColumn,noProgressColumns,unreadable}`,
`reason.{unmatched,ambiguousWbs,duplicateRow,summaryTask,unreadableDate,unreadableNumber,noProgressColumns,actualAfterStatusDate,actualFinishBeforeStart,conflictingProgressInputs,rejected}`,
`field.{completion,actualStart,actualFinish}`, `empty`.

`menu.json` — `ribbon.progressImport` (knop) en `ribbon.progressGroup` (tabel-only groepstitel), plus
het label van de Backstage-kaart (de bestaande importlabels staan in `menu`).

`nl` is de bron; `en` met de hand. De twaalf overige krijgen een volledige set (anders faalt
`verify:i18n`) — vertaald waar mogelijk, anders de Engelse tekst. **Geen `{{count}}`.**

- [ ] **Step 1:** `nl` + `en`.
- [ ] **Step 2:** De overige twaalf, beide namespaces.
- [ ] **Step 3:** `npm run verify:i18n` — exitcode 0.

**Acceptatie (mutatie-bewijsbaar):** één sleutel uit één niet-`nl`-locale verwijderen ⇒
`npm run verify:i18n` rood.

---

### Taak T10 — De browsercases: de flow als echte gebruikershandeling

**Files:**
- Create: `tests/browser/progress-import.spec.ts`

**Het bestandskiezer-probleem, en de route eromheen.** `openFileDialogWeb` kiest de File System
Access-picker zodra `'showOpenFilePicker' in window`; die is niet automatiseerbaar. Gebruik daarom
`page.addInitScript(() => { delete (window as any).showOpenFilePicker; })` — dan valt de backend terug
op `openViaInput`, een echte `<input type="file">`, en drijft de test hem met
`page.waitForEvent('filechooser')` + `chooser.setFiles({ name, mimeType, buffer })`. Dat is een
**omgevingsfixture** (we simuleren Firefox/Safari, een ondersteunde configuratie), geen vervanging van
de gebruikershandeling.

> **Als de `filechooser`-interceptie niet werkt** — `openViaInput` hangt zijn input **niet** aan de DOM
> (`input.click()` op een los element), en dat is de enige onzekerheid in deze opzet — dan is de
> terugval: zet het sheet via `window.__OPS__` als deterministische fixture in de dialoog en assert de
> rest (previewinhoud, datumvraag, koppelen, bevestigen, annuleren, undo) met echte klikken.
> Documenteer **in de spec zelf** welke route gekozen is en waarom. Verzin geen derde route.

**Cases:**

```ts
test('preview toont wijzigingen en weigeringen, annuleren laat het document ongemoeid', …);
test('bevestigen past het blad toe en één Ctrl+Z draait het hele blad terug', …);
test('een losse rij handmatig koppelen laat hem meedraaien', …);              // T7
test('een al gekoppelde taak is niet nog eens kiesbaar', …);                  // T7
test('een bestand met alleen dubbelzinnige datums vraagt de volgorde', …);    // T6/E5
test('de keuze werkt door in de preview', …);                                 // T6/E5
test('de Tabel-tabknop opent dezelfde dialoog', …);                            // T8
test('de knop staat niet op de Start-tab', …);                                 // T8
test('wisselen is onmogelijk zolang de dialoog openstaat', …);                 // T6/E4
```

**De E5-cases** gebruiken een blad waarin élke datum twee componenten ≤ 12 heeft en waarvan de
`Start`-kolom geen kalibratie oplevert (bv. taken zonder id-kolom). Assert: de vraagtoestand verschijnt
met de echte voorbeelddatum uit het bestand; klik op de tweede optie; assert dat de preview de
**andere** datum toont en dat `applyProgressImport` die datum schrijft.

**De E4-case** (vervangt de eerdere "documentwissel sluit de dialoog"): open twee documenten, open de
dialoog in document 1, koppel één rij met de hand, en probeer dan te wisselen langs **twee** routes:
(1) een echte muisklik op het tabblad van document 2 — moet door de backdrop worden opgevangen; (2)
`Control+2` — moet door de `when`-guard worden geweigerd. Assert daarna: `activeDocumentId` ongewijzigd,
de dialoog nog open, en de gekoppelde rij nog steeds gekoppeld (de preview toont hem nog als `apply`).

Seed het document deterministisch via `window.__OPS__.store.getState()` en assert **storestate**, geen
canvaspixels. De klikken en toetsaanslagen zijn echte events.

- [ ] **Step 1:** Spec schrijven, `npm run test:browser` — rood tot T6/T7/T8 er staan.
- [ ] **Step 2:** Groen.

---

### Taak T11 — Integratie en poorten

**Files:**
- Modify: `tests/planning/run.sh` (twee registraties)
- Modify: `docs/TODO.md` (regel bijwerken indien aanwezig)

- [ ] **Step 1:** Registreer beide checks, naar het model van het `TSCHECK`-blok (~r248):

```bash
  # Issue #27 etappe 2: de voortgangsimport — matching (overrides → id → WBS-terugval), handmatige
  # koppelingen, no-op-tolerantie, per-rij-weigeringen en de undo-kosten van één blad (= één stap).
  PICHECK="$DIR/.progress-import.mjs"
  if bundle_check "$DIR/check-progress-import.ts" "$PICHECK"; then node "$PICHECK" || STATUS=1; fi
  # …plus de bestandskant: id-kolom, ruime datumherkenning, dag/maand-detectie en percentages.
  PICSVCHECK="$DIR/.progress-import-csv.mjs"
  if bundle_check "$DIR/check-progress-import-csv.ts" "$PICSVCHECK"; then node "$PICSVCHECK" || STATUS=1; fi
```

- [ ] **Step 2:** `bash tests/planning/run.sh; echo "exit: $?"` — oordeel op de **exitcode**.
- [ ] **Step 3:** `npm run verify` (machinebreed één tegelijk!). Exitcode 0 is de enige groene uitkomst.

---

### Taak T12 — Documentatie

**Files:**
- Create: `public/docs/nl/gids-voortgang-importeren.md`
- Create: `public/docs/en/gids-voortgang-importeren.md`
- Modify: `public/docs/manifest.json` (id `gids-voortgang-importeren`, `layer: "gidsen"`, 14 titels)

Inhoud (binnen de `miniMarkdown`-subset: `#`/`##`/`###`, alinea's, enkelvoudige lijsten, `**vet**`,
`` `code` ``, codeblokken, alleen `docs://`/`examples://`-links — **geen tabellen**):

1. **Zet eerst een peildatum** (statusdatum, Planning-tab): zonder peildatum kan de app niet beoordelen
   of een gemelde werkelijke datum in de toekomst ligt, en die controle is juist de bescherming tegen
   typefouten in een teruggestuurd blad.
2. Het blad exporteren (Backstage → Exporteren → CSV) en wat de kolom `OPS Task ID` doet.
3. Waar je de functie vindt: Backstage → Importeren, Planning-tab, Tabel-tab (E2).
4. Welke drie kolommen worden ingelezen; dat `Start`/`Finish` **alleen** worden gebruikt om te
   controleren hoe de datums geschreven zijn en nooit worden overgenomen.
5. **Voltooiing is altijd een percentage** (E6): `100` is honderd procent, `1` is één procent, `45,5`
   mag met komma of punt, het `%`-teken is optioneel, en boven de 100 of onder de 0 wordt de rij
   geweigerd.
6. **Datums** (E5): welke schrijfwijzen werken (`2026-06-09`, `9-6-2026`, `9/6/2026`, `9.6.2026`, met
   of zonder tijd), dat de app de dag/maand-volgorde zelf vaststelt voor het hele bestand, en dat hij
   het **vraagt** als hij het niet zeker weet — inclusief hoe je die vraag beantwoordt en hoe je er in
   de preview op terugkomt.
7. Wat een leeg veld betekent (**geen wijziging**, niet "wissen").
8. Hoe de matching werkt, wanneer de WBS-terugval intreedt, en hoe je een rij **met de hand koppelt**
   of een betwijfelde koppeling bevestigt (E3).
9. **Nieuwe rijen in het blad worden geen nieuwe taken.** Een rij die aan geen enkele taak te koppelen
   is blijft wachten op een koppeling of wordt geweigerd; taken toevoegen doe je in de app.
10. Welke rijen geweigerd worden en waarom (peildatum, finish vóór start, verzameltaken).
11. Dat de preview verplicht is, dat je tijdens de import **niet van document kunt wisselen** (E4), en
    dat één Ctrl+Z het hele blad terugdraait.
12. Dat de planning na afloop opnieuw berekend moet worden (F5).

- [ ] **Step 1:** Beide artikelen + manifest-entry.
- [ ] **Step 2:** `npm run verify:docs` — exitcode 0.

---

## Parallelliseringsschema

`T1` eerst en alleen (het contract). Daarna drie banen met **strikt disjuncte bestandslijsten**:

| baan | taken | exclusieve bestanden |
|---|---|---|
| **A — kern & store** | T2, T3, T5 | `src/services/progressImport/{matchRows,buildPlan,index}.ts`, `src/state/gridTransaction.ts`, `src/state/slices/taskSlice.ts`, `tests/planning/check-progress-import.ts` |
| **B — bestandskant** | T4 | `src/services/csv/csvWriter.ts`, `src/services/progressImport/{parseProgressCsv,sheetValues}.ts`, `tests/planning/check-progress-import-csv.ts` |
| **C — UI & teksten** | T6, T7, T8, T9, T12 | `src/components/dialogs/ProgressImport*.tsx`, `src/App.tsx`, `src/state/slices/{types,uiSlice,documentSlice}.ts`, `src/hooks/keyboard/{shortcutRegistry,useKeyboardShortcuts}.ts`, `src/services/mcp/tools/runtime.ts`, `src/components/backstage/Backstage.tsx`, `src/components/layout/Ribbon/ribbonConfig.tsx`, `src/i18n/locales/*/{common,menu}.json`, `public/docs/**` |

**Overlappen die bewust zijn opgelost:**

- `src/services/progressImport/index.ts` staat bij **A**. Baan B importeert rechtstreeks uit zijn eigen
  modules; A vult de barrel aan het eind aan.
- `src/services/progressImport/types.ts` is ná T1 **bevroren**. Blijkt er een veld te missen, dan meldt
  de baan dat aan de orkestrator in plaats van het bestand zelf te wijzigen.
- Baan A's `buildPlan.ts` gebruikt géén functie uit baan B: de kern krijgt al gefinaliseerde
  `ProgressRow[]`. Dat is precies waarom het contract in T1 staat.
- `tests/planning/run.sh` raakt **niemand** tijdens de banen — dat doet T11. Elke baan draait zijn check
  standalone met het esbuild-commando uit T2.
- `ribbonWidgets.tsx` wordt **niet** aangeraakt.
- Baan C schrijft tegen de **gepinde signaturen** van T4 (`parseProgressCsv`, `detectDateOrder`,
  `finalizeProgressRows`) en T5 (`previewProgressImport`/`applyProgressImport`, beide met `overrides`).
  Zolang die niet wijzigen kan C blind vooruit; typecheck-groen voor C komt pas ná de merge van A en B.

**Volgorde:** T1 → {A, B, C parallel} → T10 (browsercases; heeft C nodig) → T11 (poort). T12 mag met C
mee of los. Binnen baan C is T7 afhankelijk van T6; T8 en T9 zijn los.

---

## Hardening-checklist (élke implementer-prompt krijgt dit blok mee)

- **Geen allocaties of lussen die op ongevalideerde bestandswaarden zijn gemaat.** Rij-aantallen,
  celgroottes en bestandsgrootte worden vooraf tegen `PROGRESS_IMPORT_LIMITS` getoetst; overschrijding
  is een weigering, nooit een stille afkapping. Dat geldt óók voor de koppelkiezer (max. 200 opties) en
  voor `detectDateOrder` (dat over hooguit `maxRows × 4` cellen loopt en niets accumuleert per cel).
- **Strings begrensd.** Ieder veld uit een bestand wordt getrimd, op lengte gecontroleerd en op
  stuurtekens gecontroleerd vóór het in state of in een `Map`-sleutel belandt.
- **Geen module-level muteerbare singletons.** Geen cache, geen "laatst gekozen datumvolgorde", geen
  teller buiten een functie. De kern is puur; de dialoog houdt zijn eigen React-state (sheet, order,
  overrides).
- **Elke `try`/`catch`-wrapper krijgt een eigen rode-pad-fixture.** Een `catch` zonder test is een
  verborgen stille weigering.
- **Fixtures worden nooit naar de implementatie toe geschreven.** Schrijf de verwachte waarde uit het
  domein op (wat Excel/MS Project/de gebruiker zou zien), niet wat de code toevallig teruggeeft.
- **Testcommentaren claimen alleen wat mutatie-bewezen is.**
- **Vlak vóór `git commit`: eerst `git status --short`, en stage alleen je eigen bestanden.** Geen
  `git add -A`, geen `tests/planning/.*.mjs`-artefacten, geen `dist/`, geen andermans baan.
- **Poorten oordelen op de exitcode.** `bash tests/planning/run.sh` print "alles groen" óók bij exit 1.
  `echo "exit: $?"` is verplicht.
- **Meldingen blijven in-app.** Geen `alert()`, geen `confirm()`, geen native dialoog behalve de
  bestandskiezer.
- **Nooit `s.scheduleStale` of `s.isDirty` direct zetten** — altijd via `finishMutation`/`markScheduleStale`.
- **Nooit een datum raden.** Onherkenbaar is `unreadable`; onbeslisbaar is een vraag aan de gebruiker.
  Er is in dit hele pad geen enkele plek waar "vandaag" of een stille volgorde-default hoort.

---

## Tests & poorten (samenvatting)

| poort | wat hij hier bewaakt |
|---|---|
| `tests/planning/check-progress-import.ts` | matching (overrides → id → WBS), handmatige koppelingen en bevestigingen, no-op-tolerantie, weigeringen, atomiciteit, één undo-stap, nul-toepassing-zonder-snapshot, drift-herberekening |
| `tests/planning/check-progress-import-csv.ts` | id-kolom (naam + positie), `readCSV` negeert hem, ruime datumherkenning, de dag/maand-detectieregels (>12, kalibratie, tegenstrijdig, ambiguous), `Start`/`Finish` als detectie-only, percentage-semantiek (E6), bestandsgrenzen, quoting |
| bestaande `check-grid-transaction.ts` | bewijst dat de `buildTaskEditPlanEnvironment`-extractie gedragsneutraal is |
| bestaande `check-recorded-dates.ts` | broncode-poort: `scheduleStale` alleen via `markScheduleStale` |
| bestaande `tests/mcp/` | de `BLOCKING_UI_FLAGS`-uitbreiding blijft consistent met `hasBlockingDialogOpen` |
| `tests/browser/progress-import.spec.ts` | de hele flow als echte gebruikershandeling: drie instappunten, koppelkiezer, datumvraag, en de documentwissel-blokkade (E4) |
| `npm run verify:i18n` | veertien locales compleet, twee namespaces |
| `npm run verify:docs` | gids `nl` + `en` + manifest |
| `npm run verify:cycles` | de nieuwe importrichting maakt geen kring |
| `npm run verify` | **de** eindpoort — exitcode, machinebreed één tegelijk |

---

## Openstaande eigenaarsvragen (met de default die dit plan kiest)

E1–E6 zijn beslist en staan hier niet meer.

| # | vraag | default in dit plan |
|---|---|---|
| **Q1** | Betekent een **leeg** veld in een teruggestuurd blad "geen wijziging" of "wis deze actual"? | **Geen wijziging.** Een blad komt vaak deels ingevuld terug; "leeg = wissen" maakt van elke onvolledige inzending een gegevensverlies. Omdraaien kost één extra outcome (`cleared`) in `buildPlan.ts` en één regel in de gids. |
| **Q2** | Mag een blad voortgang op een **verzameltaak** zetten? | **Nee**, geweigerd met `summaryTask` — spiegelt `mcpValidation`. Het grid van etappe 1 bewaakt dit vandaag níét; dat is daar een openstaand gat, geen precedent. |
| **Q3** | Automatisch herberekenen ná een geslaagde import? | **Nee** — `scheduleStale` wordt gezet en de bestaande signalering vraagt om F5. Met **Automatisch berekenen** aan gebeurt het toch al. |
| **Q4** | Handmatige koppelingen **bewaren** voor een volgend blad van dezelfde partij? | **Nee in deze etappe.** Een gepersisteerde koppeltabel is een eigen datamodel met een eigen IFC-round-trip-vraag. Zou een etappe 3 zijn bovenop dezelfde `ProgressOverrides`-vorm. |
| **Q5** | Een **"alles bevestigen"**-knop voor betwijfelde WBS-koppelingen? | **Buiten scope** (niet gevraagd). Bij een blad met tientallen WBS-terugvallen is het per-rij bevestigen bewerkelijk; als de eigenaar dat later wil, is het één knop die de overrides in bulk vult — de kern hoeft er niet voor te veranderen. |
