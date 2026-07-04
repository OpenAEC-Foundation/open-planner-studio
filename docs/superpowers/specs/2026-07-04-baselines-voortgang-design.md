# Ontwerp: Fase 2.6 — Baselines & voortgang

*Status: **ontwerp, architect-review verwerkt (2026-07-04)** — kernbeslissingen vastliggend; de
review corrigeerde §2.1/§5.1/§6.2 (baseline snapshot de **early**-datums, niet schedule), voegde het
solver-vangnet voor rauwe completion toe (§3.2/§4.2 tak 2b), §4.5 (float/kritiek bij voortgang), de
`activeBaselineId`-undo-guard (§10.1) en besliste de open punten (gemarkeerd **BESLIST**). Resterende
*"invulling"*-markeringen zijn implementatiedetails zonder architectuurimpact.*
*Datum: 2026-07-04 · Bron: [docs/TODO.md](../../TODO.md) §2.6, PLAN.md §G/§F,
research-rapport 2.6 (`/home/nozzit/.claude/jobs/fd7f4482/tmp/research-2.6-baselines.md`) +
codebase-verificatie (firsthand, alle regelnummers hieronder gecontroleerd tegen de echte broncode
op deze branch) · Conventie & diepgang: zie
[2026-07-03-resources-design.md](2026-07-03-resources-design.md)*

Dit document is bedoeld om zelfstandig te implementeren zonder het bronrapport te lezen: elke
beslissing citeert het exacte bestand/regel waar hij op aansluit. De vastliggende beslissingen zijn
door de architect genomen en niet heropend.

---

## 1. Doel & scope

Fase 2.6 maakt het al bestaande maar grotendeels **dode** voortgangs-skelet levend en voegt baselines
toe. Concreet: een P6-stijl statusdatum (data date) die de CPM-forward-pass stuurt, echte
actual-start/-finish-registratie met afgedwongen invarianten, een Retained-Logic/Progress-Override
keuze, onbeperkte benoemde baselines met precies één actieve voor overlay/variance, een
baseline-onderbalk en een voortgangslijn in de Gantt, en een variance-rapport als derde rapporttype.
IFC/MSPDI/P6-round-trip voor dit alles, met de golden rule bewaard.

### In scope

- **Datamodel**: `Baseline`/`BaselineTask` (nieuw `src/types/baseline.ts`); `Project.statusDate` +
  `Project.progressMode` (nieuw); hergebruik van de dode `TaskTime.actualStart/actualFinish/
  actualDuration/remainingTime`-velden (`task.ts:60-63`).
- **CPM met voortgang**: `CPMOptions { dataDate, progressMode }` op de `CPMSolver`-constructor;
  actual-pinning + data-date-vloer in de forward pass; out-of-sequence-detectie
  (`CPMResult.outOfSequenceSequenceIds`).
- **Store**: nieuw `baselineSlice` (CRUD + `activeBaselineId`); voortgangs-acties op `taskSlice`;
  `setStatusDate`/`setProgressMode` op `projectSlice`. Snapshot/DocumentPayload/history/recovery-wiring.
- **Rendering**: statusdatumlijn, baseline-overlay-onderbalk, voortgangslijn — alle drie in
  `GanttRenderer.ts`, met view-/UI-toggles.
- **Variance-rapport** als derde `reportType` in `ReportPanel.tsx` (patroon `MilestoneReport`).
- **IFC 4.3**: actuals in de bestaande-maar-ongebruikte `IfcTaskTime`-slots 14-18; `statusDate`/
  `progressMode` in het bestaande `OPS_ProjectSettings`-pset; baselines dubbelspoor
  (`OPS_Baselines`-JSON autoritair + `.BASELINE.`-`IfcWorkSchedule`-headers voor interop).
- **Adapters**: MSPDI volwaardig (Baseline0 + StatusDate + actuals); P6-XML best-effort
  (actuals + data date; baselines gedocumenteerd verlies); CSV bewust zonder baselines (wel actuals-kolommen).
- **Testharnas**: `cases-progress.json` + `cases-baselines.json`, met de drie handberekende scenario's (§3).

### Expliciet buiten scope (met fase-verwijzing)

- **Kosten/werk/Earned Value** — geen `BaselineCost`/`BaselineWork`, geen EV-metrieken (SPI/CPI/BCWP).
  Fase 3.5 (PLAN.md G8-G11); dit is de reden dat `Baseline` géén kosten/werk bevat.
- **Meerdere voortgangslijnen / meerdere statuslijnen** (PLAN.md F15) — 2.6 tekent **één** lijn op de
  statusdatum. Latere uitbreiding.
- **Physical vs. duration-% als aparte dimensies** — `completion` blijft één veld (duration/physical
  %); een aparte work-% vergt resources/uren → fase 3.5.
- **Geavanceerde per-relatie out-of-sequence-override** (per FS/SS handmatig retained/override kiezen)
  — 2.6 detecteert + waarschuwt en volgt de projectbrede `progressMode`. Later.
- **Resource-niveau-voortgang** (per-assignment actuals) — 2.6 registreert voortgang op taakniveau.
- **Harde, logica-brekende actual-pins** — actuals verschuiven balken via de forward pass; ze breken
  de netwerklogica niet af (consistent met de P6-soft-lijn van fase 2.3, `task.ts:17-26`).

### Backwards-compat is de eerste invariant

**Geen `statusDate` gezet ⇒ het gedrag is byte-voor-byte gelijk aan vandaag.** De forward pass negeert
dan actuals volledig (`dataDate === undefined` ⇒ elke nieuwe tak is een no-op), de renderer tekent geen
statusdatumlijn/voortgangslijn, en de IFC-writer schrijft geen enkele nieuwe entiteit. Dit is niet
alleen een feature-toggle maar het regressie-vangnet voor de ~200+ bestaande CPM-testcases en de IFC
golden rule.

---

## 2. Datamodel (exacte TS-types)

### 2.1 `src/types/baseline.ts` (NIEUW)

Beslissing (vastliggend): **P6-model** — een baseline is een benoemde, gedateerde snapshot-object met
een eigen taak-array, keyed op `Task.id`. NIET MSP's per-veld-slots op de taak.

```ts
import type { MilestoneKind } from './task';

/** Eén taak zoals hij in de baseline vastligt. Keyed op de stabiele Task.id (tevens de basis van
 *  de IFC-GUID via ifcGuid(task.id)) zodat matching over hernoemingen heen werkt. */
export interface BaselineTask {
  taskId: string;
  start: string;           // ISO 8601 — snapshot van task.time.earlyStart t.t.v. opslaan (fallback: scheduleStart)
  finish: string;          // ISO 8601 — snapshot van task.time.earlyFinish (fallback: scheduleFinish)
  duration: number;        // werkdagen (task.time.scheduleDuration)
  isMilestone: boolean;
  milestoneKind?: MilestoneKind;
}

/** Een P6-stijl baseline: onbeperkt aantal; precies één is "actief" (activeBaselineId in de slice). */
export interface Baseline {
  id: string;
  name: string;
  createdAt: string;       // ISO datetime — de snapshot-datum (ook getoond in het rapport)
  tasks: BaselineTask[];   // keyed op taskId
  projectEnd: string;      // ISO — projecteinde t.t.v. de snapshot (voor de variance-samenvatting)
  projectDuration: number; // werkdagen
}
```

**Snapshot-bron (review-correctie, BLOKKEREND opgelost).** `saveBaseline` legt per **leaf-taak**
(dezelfde leaf-filter als `runCPM`, `scheduleSlice.ts:58`) **`task.time.earlyStart/earlyFinish`** vast
(fallback `scheduleStart/scheduleFinish` als er nog geen CPM-run is geweest), plus `scheduleDuration` +
`isMilestone`/`milestoneKind`. Rationale: de variance (§7.2) en de overlay (§6.2) vergelijken tegen de
CPM-early-datums — de balk zoals getekend. Een snapshot van `scheduleStart` (planner-invoer, die door
CPM-druk vrijwel altijd afwijkt van de werkelijke balkpositie) zou op dag één fantoom-variance tonen
zonder dat er iets gewijzigd is. Baseline = "waar de balken stonden toen ik vastlegde", dus de
early-datums. Zie ook §11.2: bij `scheduleStale` waarschuwt de dialoog eerst te herberekenen, anders
bevriest de snapshot verouderde datums.
**BESLIST**: samenvattingstaken worden **niet** in de baseline opgenomen —
hun datums zijn afgeleide rollups (`runCPM` `updateSummary`, `scheduleSlice.ts:90-125`), dus een baseline
van de leaves reconstrueert de summary-variance impliciet; het rapport rolt zo nodig zelf op.

**Match-semantiek** (vastliggend):
- Taak in huidig, niet in baseline ⇒ **"nieuw"** (geen overlay-balk, variance n.v.t.).
- Taak in baseline, niet meer in huidig ⇒ **"vervallen"**: de `BaselineTask`-entry blíjft bestaan
  (baselines worden nooit gemuteerd na opslaan) en toont als "vervallen" in het rapport, **niet** in de
  Gantt-overlay (geen huidige rij om onder te tekenen).

### 2.2 `src/types/project.ts` — statusdatum + progressMode (uitbreiding)

Huidige `Project` (`project.ts:1-20`) heeft geen statusdatum. Twee optionele velden erbij:

```ts
export type ProgressMode = 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';

export interface Project {
  // ... bestaande velden (id, name, …, wbsAutoNumber?) ...
  /** P6 "data date": de grens verleden/toekomst (dag-granulair). undefined = geen statusdatum ⇒
   *  gedrag exact als vóór 2.6. Gezet ⇒ remaining werk kan niet vóór deze dag starten (§3/§4). */
  statusDate?: string;    // ISO date (dag-granulair)
  /** Voortgangs-scheduling-modus (P6). undefined ⇒ RETAINED_LOGIC (de default). Documentinstelling,
   *  geen app-instelling (§11.4). */
  progressMode?: ProgressMode;
}
```

Beide zijn optioneel ⇒ geen migratie nodig; geladen bestanden zonder de velden gedragen zich als "geen
statusdatum, retained logic" (= huidig gedrag).

### 2.3 `src/types/task.ts` — de dode voortgangsvelden activeren

Geen typewijziging: `TaskTime.actualStart/actualFinish/actualDuration/remainingTime` (`task.ts:60-63`)
bestaan al maar worden nergens gelezen/geschreven. 2.6 maakt ze levend. `completion` (`task.ts:64`) blijft
de bron (0-1). De invarianten (§3.2) worden afgedwongen in de store-acties (§10.2), niet in het type.

`remainingTime` = **afgeleide** resterende duur in werkdagen (`scheduleDuration × (1 − completion)`,
op hele werkdagen); geen apart bewerkbaar veld in 2.6. Het wordt door de progress-acties gezet en door de
CPM-solver gelezen.

---

## 3. Statusdatum + voortgang-semantiek (met handberekende scenario's)

### 3.1 Statusdatum (P6-data-date-semantiek)

`project.statusDate` is de scheidslijn verleden/toekomst. Vastliggende semantiek:
- **Voltooide** taken (`completion === 1`, `actualFinish` gezet) liggen volledig vóór de statusdatum en
  worden op hun actuals vastgeklonken.
- **Gestarte-niet-voltooide** taken (`actualStart` gezet, `0 < completion < 1`): de balk toont vanaf
  `actualStart`; het **resterende** werk start op `max(dataDate, …)` (§4).
- **Niet-gestarte** taken (`completion === 0`, geen `actualStart`): gewone forward pass, maar met de
  statusdatum als **ondergrens** op de early start — remaining werk kan nooit in het verleden.
- Geen statusdatum ⇒ **geen** van deze regels doet iets (backwards-compat).

De statusdatum wordt op een werkdag gesnapt (`nextWorkDay`, `CalendarEngine.ts:95`) vóór gebruik als
vloer, exact zoals constraint-datums (`applyForwardConstraint`, `CPMSolver.ts:337-350`).

### 3.2 Voortgang-invarianten (afgedwongen in de store-acties, §10.2)

Duration-based (vastliggend). Bij elke `setTaskProgress`/`setActualStart`/`setActualFinish`:
- `actualFinish` gezet ⇒ `completion = 1` én `actualStart` gezet (default `actualStart = actualFinish`
  als die nog leeg was) én `status = 'COMPLETED'`.
- `completion === 1` ⇒ `actualFinish` gezet (default = statusdatum, of vandaag als geen statusdatum).
- `actualStart` gezet zonder `actualFinish` ⇒ `completion` mag `0..1` (exclusief 1); `status = 'STARTED'`;
  bij `completion === 0` wordt het naar een kleine ondergrens getild is **niet** afgedwongen — P6 laat een
  net-gestarte taak met 0% toe, maar `status` wordt dan wél `STARTED` (er is een actualStart).
- `setTaskProgress(x)` met `x > 0` terwijl er nog geen `actualStart` is ⇒ de actie zet **automatisch**
  `actualStart = task.time.earlyStart ?? scheduleStart` (MSP-conventie: % invullen impliceert "gestart").
  Zo kan `completion > 0` zonder `actualStart` via het store-pad niet ontstaan — de gebruiker hoeft de
  bestaande slider (`TaskPropertiesPanel.tsx:335-347`) niet eerst met een datepicker te combineren.
- Geen `actualStart` (en dus, via de vorige regel, `completion = 0`) ⇒ `status = 'NOT_STARTED'`.
  Let op: legacy/externe bestanden (IFC/CSV/MSPDI-import zet velden rauw) kúnnen `completion > 0` zonder
  actuals bevatten — daarvoor heeft de solver een vangnet met identieke semantiek (§4.2, tak 2b).
- `remainingTime = round(scheduleDuration × (1 − completion))` — afgeleid, altijd herberekend.
- `actualStart ≤ statusDate` en `actualFinish ≤ statusDate` (actuals liggen nooit in de toekomst); een
  ingevoerde actual ná de statusdatum wordt **geweigerd + toast** (niet stil geklemd — BESLIST).

`status` (`Task.status`, `task.ts:73`) wordt zo eindelijk consistent gezet vanuit de progress-acties (nu
wordt het alleen bij import afgeleid, research §1).

### 3.3 Drie handberekende scenario's

Alle scenario's: **Mari-t/m-vrijdag-werkkalender, geen feestdagen** (weekdagen geverifieerd met `date`).
Conventie: `earlyFinish = addWorkDays(earlyStart, duration)` telt de startdag als dag 1
(`CalendarEngine.ts:65`), dus een 5-daagse taak vanaf ma 6 jul eindigt op vr 10 jul (inclusieve laatste
werkdag). FS(0)-opvolger start op de eerstvolgende werkdag ná de voorganger-finish
(`nextWorkDayAfter`). "remaining-start" = de dag waarop het resterende werk begint.

Datumraster: ma 6, di 7, wo 8, do 9, vr 10 · ma 13, di 14, wo 15, do 16, vr 17 · ma 20 jul 2026.

---

**Scenario A — drie voortgangsstaten + data-date-vloer, retained logic.**
Netwerk: `A → B → C` (alle FS(0)), elk `scheduleDuration = 5`. Plus een losse taak `D` (geen relaties,
`scheduleStart = ma 6`, `scheduleDuration = 3`). `statusDate = wo 8 jul`, `progressMode = RETAINED_LOGIC`.
Plan zonder voortgang: A 6-10, B 13-17, C 20-24, D 6-10.

| Taak | completion | actualStart | actualFinish | remaining | Berekening | earlyStart–earlyFinish |
|---|---|---|---|---|---|---|
| A | 1.0 | ma 6 | di 7 | 0 | voltooid ⇒ gepind op actuals | **ma 6 – di 7** |
| B | 0.4 | wo 8 | — | 3 | start=actualStart wo 8; remaining-start = max(dataDate wo 8, FS na A-EF di 7 ⇒ wo 8) = wo 8; EF = addWorkDays(wo 8, 3) | **wo 8 – vr 10** |
| C | 0.0 | — | — | 5 | niet gestart; ES = max(dataDate wo 8, FS na B-EF vr 10 ⇒ ma 13) = ma 13; EF = addWorkDays(ma 13, 5) | **ma 13 – vr 17** |
| D | 0.0 | — | — | 3 | niet gestart; ES = max(nextWorkDay(scheduleStart ma 6), **dataDate wo 8**) = wo 8; EF = addWorkDays(wo 8, 3) | **wo 8 – vr 10** |

Projecteinde: vr 17 (was vr 24 in het plan) — 5 werkdagen ingelopen doordat A/B sneller liepen. D toont
de **data-date-vloer**: hoewel D volgens plan op ma 6 zou starten, kan niet-gestart werk niet in het
verleden ⇒ ma 6 wordt naar wo 8 getild.

---

**Scenario B — out-of-sequence, retained vs. override verschillen.**
Netwerk: `A → B` (FS(0)), A `dur 5` (plan 6-10), B `dur 5` (plan 13-17). `statusDate = wo 8 jul`.
Voortgang: A `completion 0.2, actualStart ma 6, remaining 4`, **geen** actualFinish. B `completion 0.4,
actualStart ma 6, remaining 3` — B is **vóór A's finish begonnen** ⇒ out-of-sequence.

*Detectie*: FS A→B met `B.actualStart` gezet terwijl `A.actualFinish` ontbreekt ⇒ relatie in
`CPMResult.outOfSequenceSequenceIds`, gerapporteerd als waarschuwing (§4.4). Blokkeert niet.

A (in progress, geen preds): start = actualStart ma 6; remaining-start = max(dataDate wo 8) = wo 8;
EF = addWorkDays(wo 8, 4) = **ma 13**.

B (in progress, out-of-sequence) — hier verschillen de modi:

| progressMode | remaining-start van B | earlyFinish B | Projecteinde |
|---|---|---|---|
| **RETAINED_LOGIC** | max(dataDate wo 8, FS na A-EF ma 13 ⇒ **di 14**) = di 14 | addWorkDays(di 14, 3) = **do 16** | do 16 |
| **PROGRESS_OVERRIDE** | max(dataDate wo 8) — relatie naar reeds-gestart werk genegeerd = **wo 8** | addWorkDays(wo 8, 3) = **vr 10** | max(A-EF ma 13, vr 10) = ma 13 |

Retained houdt B's rest achter A (conservatief, langste einde do 16); override laat B's rest gewoon
doorlopen vanaf de statusdatum (ma 13). Dit is het verplichte scenario waar de twee modi hetzelfde
out-of-sequence-geval verschillend plaatsen.

---

**Scenario C — voltooide-pin + merge over twee voorgangers + data-date-vloer.**
Netwerk: `A → C`, `B → C` (beide FS(0)). A `dur 4`, B `dur 6`, C `dur 3`. `statusDate = do 9 jul`,
retained. Plan start ma 6.
- A: `completion 1, actualStart ma 6, actualFinish do 9` ⇒ gepind **ma 6 – do 9**.
- B: `completion 0.5, actualStart ma 6, remaining 3` ⇒ start ma 6; remaining-start = max(do 9) = do 9;
  EF = addWorkDays(do 9, 3) = **ma 13**.
- C: niet gestart; ES = max(dataDate do 9, FS na A-EF do 9 ⇒ vr 10, FS na B-EF ma 13 ⇒ **di 14**) = di 14;
  EF = addWorkDays(di 14, 3) = **do 16**. Projecteinde do 16.

Toont: harde pin van de voltooide A, remaining-vloer op B, en de max-merge over beide voorgangers +
dataDate voor C.

---

## 4. CPM-wijzigingen (waar in de solver, welke functies)

### 4.1 Nieuwe opties-parameter

`src/engine/scheduler/CPMSolver.ts` — de constructor (`CPMSolver.ts:71`) krijgt een vierde, optionele
parameter (patroon: `ResourceLeveler` neemt al een options-object):

```ts
export interface CPMOptions {
  dataDate?: string;                                    // ISO date; undefined ⇒ geen statusdatum-gedrag
  progressMode?: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE'; // default RETAINED_LOGIC
}

constructor(tasks: Task[], sequences: Sequence[], calendar: CalendarEngine, options: CPMOptions = {}) { … }
```

`runCPM` (`scheduleSlice.ts:53-142`) geeft ze door:
`new CPMSolver(leafTasks, s.sequences, calEngine, { dataDate: s.project.statusDate, progressMode: s.project.progressMode })`
(`scheduleSlice.ts:59`). Bij `dataDate === undefined` zijn alle nieuwe takken hieronder no-ops.

`CPMResult` (`CPMSolver.ts:6-30`) krijgt één veld erbij, naast de bestaande
`violatedConstraintTaskIds`/`truncatedLeadSequenceIds`:

```ts
/** Relaties waarvan de opvolger progress/actuals heeft die de voorganger-logica tegenspreekt
 *  (out-of-sequence). Waarschuwing, geen fout — zie §4.4. */
outOfSequenceSequenceIds: string[];
```

(Zetten op `[]` in élk return-pad, inclusief de cycle- en no-workday-guards, `CPMSolver.ts:93-104` en
`:110`.)

### 4.2 Forward pass — actual-pinning + data-date-vloer

De wijziging zit in `forwardPass` (`CPMSolver.ts:239-315`), op **exact het punt** waar vandaag de
`levelingDelay`-shift wordt geïnjecteerd (`:304-306`) — ná `applyForwardConstraint` + `nextWorkDay`, vóór
de `earlyFinish`-berekening (`:308-309`). Een nieuwe private helper `applyProgress(task, earlyStart)`
vervangt/omhult de `earlyStart` en retourneert `{ es, ef }`:

```ts
// Pseudocode van de nieuwe tak, ná regel 306 (levelingDelay) en vóór regel 308:
const dataDate = this.options.dataDate ? this.calendar.nextWorkDay(parseDate(this.options.dataDate)) : null;
const t = task.time;

if (dataDate && t.actualFinish && t.completion >= 1) {
  // (1) VOLTOOID: volledig gepind op actuals — geen forward-drift, geen druk voorbij actualFinish.
  const es = this.calendar.nextWorkDay(parseDate(t.actualStart ?? t.actualFinish));
  let ef = this.calendar.prevWorkDay(parseDate(t.actualFinish));
  if (ef < es) ef = es;   // weekend-randgeval, zie noot hieronder
  results.set(taskId, { es, ef }); continue;
}
if (dataDate && (t.actualStart || t.completion > 0) && t.completion < 1) {
  // (2) IN PROGRESS — twee instroompaden met identieke plaatsing:
  //  (2a) actualStart gezet (normale store-route): start = actualStart.
  //  (2b) VANGNET voor rauwe data (legacy/externe import: completion>0 zonder actuals):
  //       impliciete actualStart = de gewone forward-pass-earlyStart (vóór de vloer) —
  //       exact dezelfde semantiek als de store-invariant §3.2 die actualStart op de
  //       earlyStart zet. Store-pad en raw-load-pad plaatsen dus identiek.
  const actualES = t.actualStart
    ? this.calendar.nextWorkDay(parseDate(t.actualStart))
    : earlyStart;                                           // (2b) impliciete actualStart
  const remaining = Math.max(0, t.remainingTime ?? Math.round(t.scheduleDuration * (1 - t.completion)));
  let remStart = dataDate;                                  // ondergrens: statusdatum
  if (this.options.progressMode !== 'PROGRESS_OVERRIDE') {
    // RETAINED_LOGIC: remaining respecteert óók de voorganger-druk (earlyStart is die druk al).
    if (earlyStart > remStart) remStart = earlyStart;
  }
  const ef = this.calendar.addWorkDays(remStart, remaining);
  results.set(taskId, { es: actualES, ef }); continue;      // display-start = actualES
}
if (dataDate && t.completion === 0) {
  // (3) NIET GESTART: gewone earlyStart, maar met de statusdatum als ondergrens.
  if (earlyStart < dataDate) earlyStart = dataDate;
}
// geen dataDate, of geen progress: val terug op het bestaande gedrag (earlyFinish hieronder).
```

**Werkdag-snap van actuals (randgevallen).** `nextWorkDay`/`prevWorkDay` beelden een werkdag op
zichzelf af (identiteit — de `while (!isWorkDay)`-lus doet dan niets, `CalendarEngine.ts:95-103`/
`:123-131`); alleen niet-werkdagen verschuiven. Kruisen kán daardoor wél in één geval: een 1-daagse
taak met `actualStart` én `actualFinish` in hetzelfde weekend (za/zo) geeft `es = nextWorkDay(za) = ma`
en `ef = prevWorkDay(zo) = vr` ⇒ `ef < es`. Daarom de klem `if (ef < es) ef = es` in tak (1). De
UI-invarianten (§3.2) maken dit via het store-pad al onmogelijk (actuals worden dag-gesnapt ingevoerd);
de klem dekt rauwe imports.

**Milestones.** Voor een milestone met een actual landen `actualStart` en `actualFinish` op dezelfde
datum (§11.3, BESLIST), beide gesnapt via **`nextWorkDay`** (niet `prevWorkDay` — anders kan bij een
weekend-datum `ef < es` ontstaan). De pin (tak 1) plaatst de milestone dan op die ene werkdag-grens,
conform het dag-granulaire boundary-model van fase 2.4 (`task.ts:36-42`): een START-milestone ankert op
het dagbegin, een FINISH-milestone op het dageinde van diezelfde dag.

Kernpunten:
- De **data-date-vloer** voor tak (3) hergebruikt exact het `applyForwardConstraint`-patroon
  (`CPMSolver.ts:337-350`): een `Math.max`-ondergrens tegen de logica-early-start. Voor
  niet-gestarte taken zonder voorganger (tak `preds.length === 0`, `:257-260`) én met voorganger
  (`:261-295`) werkt dezelfde ondergrens, dus de injectie staat ná beide takken (net als de
  `levelingDelay`-hook vandaag, `:304`).
- Voor **in-progress** taken is `earlyStart` op regel 304 al de retained-logic voorganger-druk (de
  gewone forward-pass-uitkomst); tak (2) neemt die over als `remStart`-kandidaat in RETAINED_LOGIC en
  negeert hem in PROGRESS_OVERRIDE.
- Tak (1)/(2) zetten `results` en `continue`-en, zodat de generieke `earlyFinish`-regel (`:308-309`)
  wordt overgeslagen voor gepinde/in-progress taken.

**Backward pass**: ongewijzigd. De verschoven early-datums lopen gewoon door
`backwardPass`/`computeResults` (`CPMSolver.ts:517`/`:631`), dus float wordt eerlijk herrekend op de
progress-datums (zelfde principe als de "geen phantom float"-fix van fase 2.5).

### 4.3 De opvolger-druk voor gestarte taken

Voor een gepinde/in-progress voorganger levert `results.get(predId)` nu de **actual/remaining** finish
(`ef` uit tak 1/2). De bestaande `getForwardConstraint` (aangeroepen op `:273`) leest `predResult` —
dus opvolgers zien automatisch de juiste (verschoven) finish. Geen wijziging nodig in
`getForwardConstraint` zelf; het leest `predResult` dat wij nu correct vullen.

### 4.4 Out-of-sequence-detectie

Nieuwe private `detectOutOfSequence(): string[]`, aangeroepen in `solve()` ná de forward pass. Per
relatie (`this.sequences`), met `pred`/`succ` uit `this.tasks`:
- **FS**: `succ.actualStart` gezet én (`!pred.actualFinish` óf `parseDate(succ.actualStart) < prefEF`)
  waarbij `prefEF` = pred-actualFinish of pred-EF.
- **SS**: `succ.actualStart < pred.actualStart`.
- **FF/SF**: analoog op de finish-zijde (`succ.actualFinish` t.o.v. pred-finish).

Verzamelt `seq.id` in `outOfSequenceSequenceIds`. Gerapporteerd als waarschuwing — net als
`violatedConstraintTaskIds` vandaag in de statusbalk + een Gantt-indicator (§6.4). Het *gedrag* volgt uit
de gekozen `progressMode` (§4.2 tak 2); detectie corrigeert niet, ze meldt alleen.

### 4.5 Float- en kritiek-semantiek voor taken met voortgang

De backward pass blijft ongewijzigd, maar `computeResults` (`CPMSolver.ts:631`) krijgt twee expliciete
regels voor taken met voortgang (bij actieve `dataDate`):

- **totalFloat op de finish-zijde**: voor in-progress en voltooide taken wordt de float berekend als
  `signedWorkDays(EF, LF)` (LF−EF), **niet** LS−ES. De ES van zo'n taak is een actual in het verleden —
  start-zijde-float is dan betekenisloos (de start kan niet meer schuiven). Voor niet-gestarte taken
  blijft de bestaande berekening gelden.
- **Voltooide taken zijn per definitie niet kritiek** (P6-conventie): `completion === 1` ⇒
  `isCritical = false`, ongeacht de berekende float, en de UI toont voor voltooide taken geen
  float-indicator (de float-band in `drawTaskBar`, `GanttRenderer.ts:454-459`, slaat voltooide taken
  over). Hun **opvolgers** kunnen uiteraard wél kritiek zijn — de kritieke-padmarkering begint bij het
  eerste niet-voltooide werk.

Testdekking: zie §12.1 (voltooide taak op het pad ⇒ niet-kritiek, opvolgers wel).

---

## 5. Baselines (model + CRUD + actief)

### 5.1 `baselineSlice` (NIEUW: `src/state/slices/baselineSlice.ts`)

```ts
export interface BaselineSlice {
  baselines: Baseline[];
  activeBaselineId: string | null;
  /** Snapshot huidige plan → nieuwe Baseline; retourneert het nieuwe id; zet direct als actief.
   *  Pure metadata: pusht ÉÉN undo-snapshot, roept NOOIT runCPM aan. */
  saveBaseline: (name: string) => string;
  deleteBaseline: (id: string) => void;   // als het de actieve was: activeBaselineId → null (of de nieuwste)
  renameBaseline: (id: string, name: string) => void;
  setActiveBaseline: (id: string | null) => void;  // overlay/variance lezen dit; geen runCPM
}
```

Compositie in `appStore.ts` (patroon `AppState`-union + `...createBaselineSlice(...a)`, research §2):
`baselineSlice` toevoegen aan de type-union en de spread.

`saveBaseline(name)` (patroon `applyLeveling`, `scheduleSlice.ts:159-173`, maar **zonder** de
`runCPM()`-staart):

```ts
saveBaseline: (name) => {
  const id = crypto.randomUUID();
  set((s) => {
    s.undoStack.push(createSnapshot(s)); s.redoStack = [];
    const leaves = s.tasks.filter(t => t.childIds.length === 0);
    s.baselines.push({
      id, name, createdAt: new Date().toISOString(),
      // CPM-early-datums = de balk zoals getekend (§2.1); fallback op schedule-datums
      // voor het geval er nog nooit een runCPM is geweest.
      tasks: leaves.map(t => ({ taskId: t.id,
        start: t.time.earlyStart || t.time.scheduleStart,
        finish: t.time.earlyFinish || t.time.scheduleFinish,
        duration: t.time.scheduleDuration,
        isMilestone: t.isMilestone, milestoneKind: t.milestoneKind })),
      projectEnd: s.cpmResult?.projectEnd ?? '', projectDuration: s.cpmResult?.projectDuration ?? 0,
    });
    s.activeBaselineId = id; s.isDirty = true;
  });
  return id;
},
```

### 5.2 Refresh-policy (vastliggend)

- **Baseline-CRUD raakt de scheduling nooit** — `saveBaseline`/`deleteBaseline`/`renameBaseline`/
  `setActiveBaseline` zijn pure metadata en roepen **nooit** `runCPM` aan en zetten **nooit**
  `scheduleStale`. Overlay/variance **lezen** alleen (`activeBaselineId` → `baselines.find`).
- **Voortgangs-/actual-mutaties** zijn datum-beïnvloedend **zodra er een statusdatum actief is** ⇒ ze
  zetten `scheduleStale = true` (bestaand F5-regime) alleen als `s.project.statusDate` gezet is; zonder
  statusdatum updaten ze wél `completion`/`status` (voor de progress-fill-rendering) maar zetten géén
  `scheduleStale` (geen CPM-impact). Zie §10.2.

---

## 6. Rendering (welke functies in GanttRenderer)

Alle wijzigingen in `src/engine/renderer/GanttRenderer.ts`. Nieuwe `GanttRenderOptions`-velden
(`GanttRenderer.ts:8-44`, naast `violatedConstraintTaskIds` etc.), doorgegeven vanuit
`src/components/canvas/GanttCanvas.tsx`:

```ts
statusDate?: string;                                   // project.statusDate
showStatusDateLine?: boolean;                          // UI-toggle (default true als statusDate gezet)
showProgressLine?: boolean;                            // UI-toggle
baselineOverlay?: Map<string, { start: string; finish: string; isMilestone: boolean }>;  // uit actieve baseline
showBaselineOverlay?: boolean;                         // UI-toggle
```

### 6.1 Statusdatumlijn — `drawStatusDateLine()` (nieuw)

Kopie van `drawTodayLine` (`GanttRenderer.ts:262-277`) met `this.opts.statusDate` i.p.v. `new Date()` en
een eigen kleur. Nieuwe kleur in `getThemeColors()` (`GanttRenderer.ts:47-83`, naast `today` op `:70` en
`baseline` op `:66`): `statusDate: '#7C3AED'` (paars, *invulling* — duidelijk onderscheidbaar van de
`today`-accentkleur). Aangeroepen in `render()` (`:203-218`) direct **ná** `drawTodayLine()` (`:213`),
zodat beide lijnen zichtbaar zijn (statusdatum bovenop). Alleen tekenen als `statusDate` gezet én
`showStatusDateLine`. De bestaande vandaag-lijn blijft ongewijzigd bestaan.

### 6.2 Baseline-overlay — smalle onderbalk in `drawTaskBar`/`drawSummaryBar`

In `drawTaskBar` (`GanttRenderer.ts:426-481`) en `drawSummaryBar` (`:483-522`), na het tekenen van de
hoofdbalk: als `showBaselineOverlay` én `baselineOverlay.has(task.id)`, teken een dunne balk in
`this.colors.baseline` (`:66`, nu eindelijk gebruikt) op `dateToX(baseline.start) .. dateToX(baseline.finish)+zoom`,
**onder** de hoofdbalk. `baseline.start/finish` zijn de gesnapshotte **early**-datums (§2.1) — dezelfde
soort datums als waarop `drawTaskBar` de hoofdbalk tekent (`earlyStart/earlyFinish`, `:428-429`), dus een
ongewijzigd plan toont hoofd- en baselinebalk exact boven elkaar (geen fantoom-offset). Positie: de hoofdbalk gebruikt `height` binnen de rij; de onderbalk krijgt
`baseHeight = height * 0.28` en `baseY = y + height + 1` (net onder de hoofdbalk, binnen de rijhoogte —
de rij heeft ruimte want `drawTaskBar` tekent op `height ≈ rowHeight*0.5`, research §4). Alleen als de
actieve baseline een entry voor die taak heeft (vervallen/nieuwe taken: geen balk). Milestones: een
kleine ruit/marker i.p.v. balk (hergebruik `drawMilestone`, `:524-568`, in baseline-kleur).

### 6.3 Voortgangslijn — `drawProgressLine()` (nieuw, aparte laag)

Nieuwe methode, aangeroepen in `render()` **ná** `drawTaskBars()` (`:215`) zodat de lijn bovenop de
balken ligt. MSP-conventie: één verticale lijn op de statusdatum die per zichtbare taakrij naar de
voortgangspositie van die rij uitstulpt (zigzag).

Per zichtbare taakrij `i` (iteratie over `this.flatTasks`, maar let op: sinds de collapse-fix bevat
`flatTasks` ook hidden-gemarkeerde rijen — **sla hidden rijen over met exact hetzelfde filter als
`drawTaskBars`**, anders stulpt de lijn uit naar rijen die niet getekend worden en verspringt de
zigzag t.o.v. de zichtbare rijen):
- `statusX = dateToX(statusDate)`.
- `progressX` = de x-positie tot waar de taak "af" is: lineaire projectie van `completion` over de
  huidige balk — `progressDate = interpolate(earlyStart, earlyFinish, completion)`, dan `dateToX`.
  Voltooide taak (completion 1): `progressX = dateToX(earlyFinish)+zoom`. Niet-gestart (0): `progressX`
  = de balk-start.
- Teken een polyline die per rij van `(statusX, rowTop_i)` naar `(progressX, rowMid_i)` naar
  `(statusX, rowBottom_i)` gaat — links uitstulpend = achter op schema, rechts = voor. On-track
  (`progressX === statusX`) ⇒ recht stuk. Kleur = `this.colors.statusDate` met dunnere lijn
  (`lineWidth 1.5`), of een eigen `progressLine`-kleur (*invulling*: hergebruik `statusDate`-kleur voor
  visuele samenhang met de lijn waar hij op staat).
- Alleen tekenen als `statusDate` gezet én `showProgressLine`. Rijen zonder zinvolle voortgang (summary
  zonder rollup-completion) volgen de statusdatumlijn recht.

*Invulling, te bevestigen bij review*: alleen leaf-rijen stulpen uit; groepsbanden (grouping-rijen) en
samenvattingsrijen tekenen recht op de statusdatum.

---

## 7. Variance-rapport (rapporttype 3)

Patroon: exacte kopie van `MilestoneReport.tsx` (component + `useVarianceRows` data-hook +
`useVarianceReportPrint` print-hook).

### 7.1 `ReportPanel.tsx`-integratie

- `reportType`-union (`ReportPanel.tsx:20`): `'gantt' | 'milestones'` → `… | 'variance'`.
- `<Select>` (`:153-161`): een derde `<option value="variance">`.
- Summary-blok (`:163-189`): een derde tak (naast gantt `:167-177` en milestones `:178-187`) die de
  projecteinde-delta toont ("Projecteinde: 24-07 baseline → 17-07 huidig, 5 werkdagen eerder").
- Print-switch (`:299`): een derde tak `printVarianceReport`.
- Preview (`:326-333`): `else` → `<VarianceReport />` (naast `<MilestoneReport />` op `:331`).
- Uitgeschakeld/lege-staat: als `activeBaselineId === null` toont het rapport "Geen actieve baseline —
  sla een baseline op of kies er een als actief".

### 7.2 `src/components/panels/VarianceReport.tsx` (NIEUW)

```ts
export interface VarianceRow {
  taskId: string; wbs: string; name: string;
  baselineStart?: string; baselineFinish?: string;   // undefined bij "nieuw"
  currentStart?: string;  currentFinish?: string;     // undefined bij "vervallen"
  deltaStart?: number; deltaFinish?: number;          // werkdagen, signed (+later, −eerder)
  status: 'onSchedule' | 'late' | 'early' | 'new' | 'dropped';
}
export function useVarianceRows(): VarianceRow[] { … }               // memoized op tasks/cpmResult/baselines/activeBaselineId
export function VarianceReport(): JSX.Element { … }                   // default component (tabel)
export function useVarianceReportPrint(projectName: string): () => void { … }
```

`useVarianceRows` (patroon `useMilestoneRows`, `MilestoneReport.tsx:25-51`):
- Actieve baseline = `baselines.find(b => b.id === activeBaselineId)`; geen ⇒ `[]`.
- Bouw een `Map<taskId, BaselineTask>` uit `baseline.tasks` en een set van huidige leaf-`taskId`s.
- Voor elke huidige leaf-taak: `currentStart/Finish` = `task.time.earlyStart/earlyFinish` (CPM-datums —
  de variance meet plan-vs-realiteit-na-CPM); baseline-entry aanwezig ⇒ `deltaStart =
  signedWorkDays(baselineStart, currentStart)`, idem finish; geen entry ⇒ `status = 'new'`.
- Voor elke baseline-`taskId` **niet** in de huidige set ⇒ een `'dropped'`-rij (baselinedatums gevuld,
  currentdatums leeg).
- `status`: `deltaFinish > 0` → `'late'`, `< 0` → `'early'`, `=== 0` → `'onSchedule'`.

`signedWorkDays`: hergebruik dezelfde werkdag-telling als de solver. De solver-methode is privé
(`CPMSolver.ts:317-322`); *invulling*: exporteer een vrije helper `signedWorkDaysBetween(cal, a, b)` uit
`CalendarEngine`-omgeving (of instantieer `new CalendarEngine(project.calendar)` in de hook, zoals
`scheduleSlice.ts:56` doet) zodat de deltas op **werkdagen** kloppen, niet kalenderdagen.

Kolommen (tabel + print): WBS, Taak, Baseline start, Baseline einde, Huidige start, Huidig einde,
Δ start (wd), Δ einde (wd), Status. Statuskleuren via een `STATUS_COLOR`-record (patroon
`MilestoneReport.tsx:53-57`). Samenvattingsregel onderaan: `projectEnd`-delta =
`signedWorkDays(baseline.projectEnd, cpmResult.projectEnd)`.

---

## 8. IFC-mapping (incl. golden rule + legacy)

### 8.1 Actuals → `IfcTaskTime`-slots 14-18 (spec-conform!)

`writeTask` (`ifcWriter.ts:446-466`) schrijft nu de `IfcTaskTime`-slots 14-18 hardcoded als `$`
(geverifieerd: research §1 + writer L448-449). Attribuutvolgorde (**1-based** IFC-attribuutnummering,
zoals gebruikelijk in de EXPRS-spec; de implementatie mapt op naam/positie in de argumentenlijst):
14 `StatusTime`, 15 `ActualDuration`, 16 `ActualStart`, 17 `ActualFinish`,
18 `RemainingTime`, 19 `Completion`. Deze zijn **spec-conform** in IFC 4.3 — de velden die nu weggegooid
worden.

Wijziging in de `IFCTASKTIME(...)`-string:
- slot 16 = `ifcDateTime(actualStart)` als `actualStart` gezet, anders `$`.
- slot 17 = `ifcDateTime(actualFinish)` als gezet, anders `$`.
- slot 15 = `ifcDuration(actualDuration)` als gezet, anders `$`.
- slot 18 = `ifcDuration(remainingTime)` als gezet, anders `$`.
- slot 14 = `ifcDateTime(statusDate)` als de taak actuals heeft (StatusTime = peildatum), anders `$`.
- slot 19 (`completion`) ongewijzigd.

**Golden rule**: een taak zonder enige actual houdt slots 14-18 op `$` ⇒ byte-identieke round-trip van
bestaande bestanden. `ifcDuration` bestaat al (`ifcWriter.ts:41-43`, `'P0Y0M${days}D'`).

**Reader**: `parseTaskTime` (`ifcReader.ts:277-292`) leest nu alleen slot 19 (`completion`, L290). Uitbreiden:
slots 16/17 → `actualStart`/`actualFinish`; 15 → `actualDuration`; 18 → `remainingTime` (via de bestaande
`ifcDuration`-parse-helper). `$` ⇒ `undefined` (legacy-bestanden ongewijzigd).

### 8.2 statusDate + progressMode → `OPS_ProjectSettings` (hergebruik!)

Het `OPS_ProjectSettings`-pset bestaat al (`writeStructure`, `ifcWriter.ts:237-243`, schrijft nu
`wbsAutoNumber`). Twee properties erbij, alleen wanneer gezet (golden rule):
- `StatusDate` (`IFCDATE` of `IFCTEXT` met de ISO-datum) — alleen als `project.statusDate` gezet.
- `ProgressMode` (`IFCLABEL`) — alleen als `project.progressMode` gezet én `!== 'RETAINED_LOGIC'`.

Er is **geen** kanoniek IFC-veld voor de data date op het schema (research §6: `IfcWorkTime`/data-date
zit niet standaard op `IfcWorkControl`), dus de pset is de juiste plek. Reader: het `OPS_ProjectSettings`-
lees-pad bestaat al (`ifcReader.ts:451`) — twee properties toevoegen → `project.statusDate`/`progressMode`.

### 8.3 Baselines → dubbelspoor (gekozen variant, onderbouwd)

**Beoordeling van de twee varianten uit de opdracht:**
- *Baseline-tijden via gedupliceerde taakstructuur* (per baseline een volledige `IfcTask`-kopie +
  `IfcRelAssignsToControl` onder een `.BASELINE.`-`IfcWorkSchedule`): volledig spec-conform en zichtbaar
  voor externe tools, **maar** taken × baselines gedupliceerd (forse bestandsgroei) en de reader moet
  baseline-taken onderscheiden van live-taken om ze niet als echte taken in te laden. Zwaar op zowel de
  golden rule (meer entiteiten, meer risico op non-neutrale round-trip) als de leesbaarheid.
- *Baseline-tijden in een `OPS_Baselines`-pset*: compact, verliesloos, één plek, sluit exact aan op het
  al bestaande `OPS_StructureMeta`-dubbelspoor (`ifcWriter.ts:248-253` JSON autoritair).

**Gekozen (dubbelspoor, JSON autoritair):**
1. **`OPS_Baselines`-pset op de `IfcWorkSchedule`** (het bestaande "Bouwplanning v1.0"-schema,
   `ifcWriter.ts:126-127`) — één `IFCPROPERTYSINGLEVALUE('Baselines', $, IFCTEXT("<JSON>"), $)` met
   `JSON.stringify(baselines)` + een `ActiveBaselineId`-property. **Autoritair en verliesloos** — dit is
   de bron die de reader gebruikt. Nieuwe `writeBaselineMeta`-functie, exact het `writeLevelingMeta`-
   patroon (`ifcWriter.ts:386-396`): pset + `IFCRELDEFINESBYPROPERTIES`, alleen geschreven wanneer
   `baselines.length > 0`.
2. **Per baseline één `.BASELINE.`-`IfcWorkSchedule`-header** (Name/Purpose = `baseline.name`,
   `CreationDate = baseline.createdAt`, PredefinedType `.BASELINE.`) aangehaakt aan het bestaande
   `IfcWorkPlan` via de bestaande `IFCRELAGGREGATES`-set (`ifcWriter.ts:129-130`) — **zonder** IfcTask-
   duplicatie. Puur een interop-signaal "deze baselines bestaan" voor externe IFC-tools; de datums leven
   in de JSON. Dit vermijdt de bestandsgroei van de duplicatie-variant en houdt de golden rule triviaal.

**Golden rule**: geen baselines ⇒ geen `OPS_Baselines`-pset én geen extra `IfcWorkSchedule` ⇒ bestaande
bestanden round-trippen byte-identiek.

**Reader**: nieuwe `extractBaselines` leest het `OPS_Baselines`-JSON (autoritair, patroon
`OPS_StructureMeta`-lezen `ifcReader.ts:395`) → `baselines[]` + `activeBaselineId`. De `.BASELINE.`-
schedule-headers worden **genegeerd** bij het inladen (ze hebben geen genestte taken, dus `extractTasks`,
`ifcReader.ts:212-275`, pikt ze sowieso niet op als live-taken — wel expliciet skippen op PredefinedType
`.BASELINE.` om robuust te zijn tegen externe tools die er wél taken onder hangen).

### 8.4 Legacy-lezer

Oude bestanden zonder actuals/statusDate/baselines laden **ongewijzigd**: slots 14-18 = `$` ⇒
`undefined`; geen `OPS_ProjectSettings.StatusDate` ⇒ `statusDate` undefined; geen `OPS_Baselines` ⇒
`baselines = []`, `activeBaselineId = null`. Alle drie de defaults reproduceren "geen statusdatum,
retained logic, geen baselines" = huidig gedrag.

---

## 9. Adapters + verliesmatrix

Bestanden & huidige signaturen (geverifieerd): `mspdiWriter.ts` (`writeMSPDI`, `<Task>`-bouw L200-235),
`mspdiReader.ts` (L184-215), `p6xmlWriter.ts` (`<Activity>`-bouw L219-244), `p6xmlReader.ts` (L258-299),
`csvWriter.ts` (kolommen L64-68), `csvReader.ts` (L145-253). `completion` round-trippt al overal;
`actualStart/actualFinish/statusDate/baselines` bestaan in **geen** adapter (grep leeg, research §8 +
firsthand-verificatie).

### 9.1 MSPDI (volwaardig)

- **Baselines**: export `<Baseline><Number>0</Number><Start><Finish><Duration></Baseline>` per taak uit de
  **actieve** baseline (Baseline Number 0 = actieve baseline). Onbeperkte OPS-baselines → alleen de
  actieve gaat naar slot 0 (de overige verliezen we bewust; extra slots 1-10 zijn een latere uitbreiding,
  gedocumenteerd verlies). Import: `<Baseline><Number>0>` → de actieve baseline.
- **Statusdatum**: `<Project><StatusDate>` (writer: naast de bestaande project-header; reader: →
  `project.statusDate`).
- **Actuals**: `<Task>` (L200-235) krijgt `<ActualStart>`, `<ActualFinish>`, `<RemainingDuration>`
  (via de bestaande `durationToISO8601`-helper, `mspdiWriter.ts:35-39`) — alleen wanneer gezet.
  `<PercentComplete>` bestaat al (writer L211, reader L215). Import leest ze terug in de task-actuals +
  past de invarianten toe (§3.2, via de store-actie na import).

### 9.2 P6-XML (best-effort)

- **Actuals**: `<Activity>` (L219-244) krijgt `<ActualStartDate>`, `<ActualFinishDate>`,
  `<RemainingDuration>`. `<PhysicalPercentComplete>` bestaat al (L236-238). Import: reader (L258-299) leest
  de actuals; `status` wordt al uit `%`/p6Status afgeleid (L270-271).
- **Data date**: `<Project><DataDate>` → `project.statusDate` v.v.
- **Baselines**: **gedocumenteerd verlies.** PMXML-baselines zitten in een apart `<BaselineProject>`-blok
  met een versie-afhankelijke koppeling (research §7 — de minst voorspelbare mapping). 2.6 exporteert
  P6-baselines **niet**; ze blijven behouden via IFC (`OPS_Baselines`) en MSPDI (Baseline0). Reader
  negeert eventuele baseline-projecten. Bij implementatie tegen een echt P6-export valideren (MPXJ
  `PrimaveraPMFileReader` als referentie) vóór eventuele latere uitbreiding.

### 9.3 CSV (bewust zonder baselines)

Kolommen (`csvWriter.ts:64-68`) blijven; `Completion (%)` round-trippt al (L75/L204). Toevoegen (append,
achter `Completion`): **`Actual Start`** en **`Actual Finish`** (ISO). Reader `mapColumnIndex`
(`csvReader.ts:145-160`) krijgt aliassen voor beide; leeg ⇒ `undefined`. **Geen** baselines,
**geen** statusdatum in CSV (bewust — CSV is de platte uitwisseling).

### 9.4 Verliesmatrix

| Concept | IFC 4.3 | MSPDI | P6-XML | CSV |
|---|---|---|---|---|
| `completion` | Slot 19 (native) | `PercentComplete` (native) | `PhysicalPercentComplete` (native) | `Completion (%)` (native) |
| `actualStart`/`actualFinish` | Slots 16/17 (spec-conform) | `ActualStart`/`ActualFinish` (native) | `ActualStartDate`/`ActualFinishDate` (native) | nieuwe kolommen (native) |
| `actualDuration`/`remainingTime` | Slots 15/18 (spec-conform) | `RemainingDuration` (remaining; actualDuration afgeleid) | `RemainingDuration` (native) | **verlies** (niet geëxporteerd) |
| geïmporteerde remaining ≠ afgeleide remaining | **verlies** — zie noot | **verlies** — zie noot | **verlies** — zie noot | n.v.t. |
| `statusDate` | `OPS_ProjectSettings.StatusDate` | `<StatusDate>` (native) | `<DataDate>` (native) | **verlies** (bewust) |
| `progressMode` | `OPS_ProjectSettings.ProgressMode` | **verlies** (geen MSP-equivalent) | **verlies** (P6 heeft het als schedule-optie, niet in XML round-getript) | **verlies** |
| Baselines (actieve) | `OPS_Baselines` JSON (verliesloos) + `.BASELINE.`-headers | Baseline Number 0 (alleen actieve) | **verlies** (best-effort, niet geëxporteerd) | **verlies** (bewust) |
| Baselines (meerdere) | `OPS_Baselines` JSON (alle, verliesloos) | **verlies** (alleen slot 0 gevuld) | **verlies** | **verlies** |

Alleen IFC is verliesloos voor het volledige 2.6-model; MSPDI is de rijkste interop (actuals + statusdate
+ één baseline); P6 en CSV zijn bewust beperkt.

**Noot — geïmporteerde remaining (BESLIST):** `remainingTime` is in 2.6 **altijd afgeleid** uit
`completion` (§2.3/§3.2). Een geïmporteerde `RemainingDuration` (MSPDI/P6/IFC-slot 18) die afwijkt van
`scheduleDuration × (1 − %)` wordt bij het inlezen **genormaliseerd naar de afgeleide waarde** —
gedocumenteerd verlies, geen verborgen state die pas bij de eerstvolgende slider-aanraking omslaat.
Ontkoppelde remaining (P6 physical-%) is expliciet buiten scope (§14).

---

## 10. Store / undo / multi-doc / recovery

### 10.1 Snapshot & document-plumbing

`Snapshot` (`snapshot.ts:13-28`) + `createSnapshot` (`:32-45`): twee velden erbij, in het
JSON-gekloonde blok (`:34-40`, want `Baseline[]` is plain data):
```ts
baselines: Baseline[];          // deep-clone via JSON (naast tasks/…/customFieldDefs)
activeBaselineId: string | null; // scalar (clone by value)
```
`statusDate`/`progressMode` zitten op `project` — dat zit **niet** in `Snapshot` (geverifieerd: Snapshot
bevat geen `project`). Zie 10.3 voor de undo-consequentie.

`DocumentPayload` (`documentSlice.ts:32-55`) + de vier functies + `RecoveryDocInput`:
- `DocumentPayload`: `baselines`, `activeBaselineId` erbij. `statusDate`/`progressMode` rijden mee in het
  bestaande `project`-veld — **geen** extra payload-plumbing nodig.
- `capturePayload` (`:108-130`): `baselines: s.baselines`, `activeBaselineId: s.activeBaselineId`.
- `hydratePayload` (`:133-153`): `s.baselines = p.baselines ?? []`, `s.activeBaselineId =
  p.activeBaselineId ?? null` (met de `?? default`-guards zoals `:140-142`).
- `freshPayload` (`:156-178`): `baselines: []`, `activeBaselineId: null`.
- `payloadFromInput` (`:181-203`): `baselines: d.baselines ?? []`, `activeBaselineId: d.activeBaselineId ?? null`.
- `RecoveryDocInput` (`:74-87`): `baselines?`, `activeBaselineId?` optioneel toevoegen.

`historySlice` `undo`/`redo` (`historySlice.ts:15-53`): restore met guards, patroon `:25-27`:
`s.baselines = snap.baselines ?? s.baselines`, maar voor `activeBaselineId` **niet** `??` gebruiken:
`null` is een legitieme waarde ("geen actieve baseline") die een undo moet kunnen terugzetten, en
`snap.activeBaselineId ?? s.activeBaselineId` zou die `null` wegslikken. Correcte guard:
`s.activeBaselineId = snap.activeBaselineId !== undefined ? snap.activeBaselineId : s.activeBaselineId`
(alleen `undefined` = "pre-2.6-snapshot zonder het veld" laat de huidige waarde staan). In
`hydratePayload` is `?? null` daarentegen wél juist: daar is het een default-pad voor oude payloads
zonder het veld, en `null` ís precies die default.

### 10.2 Mutatie-acties & undo-discipline

- **`taskSlice`** (nieuwe acties, elk pusht **exact één** undo-snapshot via `createSnapshot`, patroon
  `applyLeveling` `scheduleSlice.ts:159-173`):
  - `setTaskProgress(taskId, completion)` — klemt `0..1`, herberekent `remainingTime`, dwingt de §3.2-
    invarianten af (zet zo nodig `actualFinish`/`status`).
  - `setActualStart(taskId, date | undefined)` / `setActualFinish(taskId, date | undefined)` — idem +
    de actuals-≤-statusdatum-check.
  - **scheduleStale**: deze drie zetten `s.scheduleStale = true` **alleen als** `s.project.statusDate`
    gezet is (dan zijn ze datum-beïnvloedend). Zonder statusdatum: `isDirty = true`, géén `scheduleStale`
    (geen CPM-impact; de progress-fill rendert direct).
- **`projectSlice`** — `setStatusDate(date | undefined)` en `setProgressMode(mode)`: patroon
  **`setCalendar`** (`projectSlice.ts:99-104`): `Object.assign(s.project, {...})`, `s.isDirty = true`,
  `s.scheduleStale = true`. **Geen** undo-snapshot (zie 10.3).
- **`baselineSlice`** — CRUD pusht één undo-snapshot (5.1), zet **nooit** `scheduleStale`, roept **nooit**
  `runCPM`.

### 10.3 Undo van statusDate/progressMode — expliciete keuze (afwijking)

`Project` zit **niet** in `Snapshot`, dus project-metadata is vandaag niet undoable (`setProject`/
`setCalendar` pushen geen snapshot; `setCalendar` gebruikt alleen `isDirty`+`scheduleStale`,
`projectSlice.ts:99-104`). **Keuze: `setStatusDate`/`setProgressMode` volgen exact het
`setCalendar`-precedent** — `isDirty` + `scheduleStale`, géén undo-snapshot. Consistent met hoe de
projectkalender (óók datum-beïnvloedend) vandaag al werkt: undo van "statusdatum gezet" gaat via de
statusdatum-datepicker leegmaken + F5, net als undo van een kalenderwijziging. Het alternatief — heel
`project` in `Snapshot` opnemen — zou álle metadata-edits (naam, datums) undoable maken en is een
gedragswijziging buiten de 2.6-scope; afgewezen. **Taak-progress en baselines zijn wél undoable** (ze
zitten op `tasks` resp. in `Snapshot`). Dit is een bewuste asymmetrie, hier gedocumenteerd.

### 10.4 Multi-doc & recovery

`baselines`/`activeBaselineId` swappen per document mee via `capturePayload`/`hydratePayload` (10.1),
net als `resourceLoadResult` in 2.5. `statusDate`/`progressMode` swappen mee in het `project`-veld.
`openFile`/`openExampleFromString` draaien na de load `runCPM` (bestaand, 2.5-precedent) — dus de CPM
rekent meteen met de geladen statusdatum. Recovery-IFC-snapshot dekt alles zodra
`RecoveryDocInput.baselines?` bestaat (research §2).

---

## 11. UI

### 11.1 Plaatsing — lint

De huidige tab-strip is `['start','planning','resources','relations','beeld','instellingen','table',
'ifc','report']` (`Ribbon.tsx:720`) — **er is geen 'project'-tab**. Keuze (afwijking van de opdracht-
suggestie "Project-tabblad", beargumenteerd): baseline- en statusdatum-bediening horen bij de
**scheduling-domein-tab `planning`** (naast CPM/leveling), niet op een nieuwe tab. De weergave-toggles
horen op `beeld` (bij de andere view-toggles). Nieuwe lint-groepen:

Op **`planning`** (nieuwe groep **[Baselines & voortgang]**):
- `RibbonButton` "Baseline opslaan…" → opent de baseline-dialoog (11.2) met focus op naam.
- `RibbonButton` "Baselines beheren…" → dezelfde dialoog, lijstweergave.
- Statusdatum-**datepicker** (inline in het lint, patroon zoals andere lint-inputs) → `setStatusDate`.
  Leegmaak-knopje → `setStatusDate(undefined)`.
- `progressMode`-**keuze** (segmented/dropdown: "Retained Logic" / "Progress Override") → `setProgressMode`.

Op **`beeld`** (bij de bestaande view-toggles):
- Toggle "Baseline-overlay" → `ui.showBaselineOverlay`.
- Toggle "Voortgangslijn" → `ui.showProgressLine`.
- Toggle "Statusdatumlijn" → `ui.showStatusDateLine`.

### 11.2 Baseline-dialoog (`src/components/dialogs/BaselineDialog.tsx`, NIEUW)

Patroon `LevelingDialog.tsx` (open/dicht via een `ui.showBaselineDialog`-vlag, research §6). Inhoud:
- **Lijst** van baselines: naam (inline bewerkbaar → `renameBaseline`), datum (`createdAt`),
  **actief-radio** (→ `setActiveBaseline`), verwijder-knop (→ `deleteBaseline`).
- **"Nieuwe baseline opslaan"**: naam-invoer (default "Baseline {n} — {datum}") + knop → `saveBaseline`.
- **Stale-guard**: als `s.scheduleStale` waar is toont de dialoog een hint "Planning is verouderd —
  herbereken eerst (F5)" boven de opslaan-knop; anders zou de snapshot verouderde early-datums
  bevriezen (§2.1). Hint, geen harde blokkade (de gebruiker kan bewust doorzetten).
- Geen bereken/preview-stap nodig (baseline opslaan is deterministisch, geen scheduling-impact).

### 11.3 Voortgang invoeren — `TaskPropertiesPanel.tsx`

De completion-slider bestaat al (`TaskPropertiesPanel.tsx:335-347`, `updateTime('completion', …/100)`).
Uitbreiden: **direct ná de slider** (na L347, vóór de cpmResult-divider L349) twee datepickers in
hetzelfde `<Field><Input type="date"/></Field>`-patroon als het start-date-veld (`:280-286`):
- "Werkelijke start" → nieuwe actie `setActualStart(task.id, v)` (niet `updateTime` — de actie dwingt de
  invarianten af, §10.2).
- "Werkelijke einde" → `setActualFinish(task.id, v)`.
De slider bindt aan `setTaskProgress` i.p.v. het kale `updateTime` zodat de invarianten meelopen. Toon
`remainingTime` (afgeleid) read-only ernaast. Milestones (`isMilestone`) — **BESLIST**: één
"Werkelijke datum"-picker; de actie zet `actualStart = actualFinish = nextWorkDay(datum)` (beide via
`nextWorkDay` gesnapt, niet `prevWorkDay` — anders zou een weekend-datum `es > ef` kunnen opleveren) en
`completion = 1`. Zie §4.2 voor hoe de pin op die ene datum landt conform het 2.4-boundary-model.

### 11.4 De 3-surfaces-regel (progressMode)

De MEMORY-regel "elke instelling in 3 surfaces (tandwiel, Instellingen-tab, backstage)" geldt voor
**app-instellingen** (thema/locale/zoom-default). **`progressMode` en `statusDate` zijn
document-instellingen** (per project, in het bestand opgeslagen op `Project`), net als `wbsAutoNumber`
— die staan óók niet in de drie app-settings-surfaces. Ze horen dus in het lint (11.1), **niet** in
`SettingsPanelContent`. Zelfde argument als de 2.5-view-state (`showHistogram`, resources-doc §6.5).
De view-toggles (`showBaselineOverlay`/`showProgressLine`/`showStatusDateLine`) zijn UI-state, persisted
via `settingsStore` zoals `showHistogram`, ook buiten de 3-surfaces-regel.

---

## 12. Testplan

`tests/planning/harness.ts` — het `Case`-schema (research §9) uitbreiden:
```ts
interface Case {
  // ... bestaand ...
  statusDate?: string;                       // project.statusDate
  scheduleOptions?: { progressMode?: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE' };
  // per taak (uitbreiding van het tasks[]-element):
  //   completion?: number; actualStart?: string; actualFinish?: string; remaining?: number;
  expect: {
    // ... bestaand (es/ef/ls/lf/tf/ff/crit, projectEnd, …) ...
    outOfSequenceSet?: string[];             // relatie-ids
  };
}
```
`buildAndSolve` (research §9): na taak-aanmaak `setStatusDate`/`setProgressMode` op de store, per taak
met progress de nieuwe `setTaskProgress`/`setActualStart`/`setActualFinish` aanroepen, dan `runCPM`.
Assertie-helper `outOfSequenceSet` vergelijkt `cpmResult.outOfSequenceSequenceIds` als verzameling
(patroon `violatedConstraintsSet`).

### 12.1 `cases-progress.json` (CPM met voortgang, handberekend)

- **Scenario A** (§3.3): drie voortgangsstaten + data-date-vloer op de losse taak D; retained. Assert
  es/ef per taak + projectEnd vr 17.
- **Scenario B** (§3.3): out-of-sequence, **twee cases** met identieke input maar
  `progressMode: RETAINED_LOGIC` (projectEnd do 16, `outOfSequenceSet: [A→B]`) resp. `PROGRESS_OVERRIDE`
  (projectEnd ma 13). Bewijst de modus-divergentie.
- **Scenario C** (§3.3): voltooide-pin + merge + dataDate. Assert es/ef + projectEnd do 16.
- **Data-date-vloer geïsoleerd**: één niet-gestarte taak, `scheduleStart` in het verleden, statusdatum
  in de toekomst → es op de statusdatum.
- **Voltooide taak pint volledig**: taak met actualStart/actualFinish vóór de statusdatum, opvolger start
  ná de actualFinish (niet ná een verschoven CPM-datum).
- **Geen statusdatum = no-op**: dezelfde taken mét completion/actuals maar zónder statusdatum → es/ef
  exact gelijk aan de baseline-CPM zonder voortgang (regressiebewijs voor backwards-compat).
- **Out-of-sequence-detectie per relatietype**: FS/SS/FF/SF elk één case met een out-of-sequence-opvolger
  → juiste relatie in `outOfSequenceSet`.
- **Rauwe completion zonder actuals (solver-vangnet §4.2 tak 2b)**: taak met `completion 0.5`, géén
  actualStart/actualFinish, statusdatum gezet → geplaatst als in-progress met impliciete actualStart =
  de gewone forward-pass-earlyStart; remaining vanaf max(dataDate, druk volgens mode). Bewijst dat het
  raw-load-pad (import) identiek plaatst aan het store-pad.
- **Voltooide taak niet kritiek (§4.5)**: keten A(voltooid, actuals) → B → C zonder float → A heeft
  `crit: false` ondanks positie op het pad; B en C wél `crit: true`. Plus finish-zijde-float-assert op
  een in-progress taak (tf = LF−EF, niet LS−ES).

### 12.2 `cases-baselines.json` (variance)

Deze suite test de variance-berekening headless (de `useVarianceRows`-logica in een pure vorm, of via een
kleine `computeVariance`-helper die de hook deelt): baseline opslaan, taken muteren, variance-rijen
assert-en op status (`onSchedule`/`late`/`early`/`new`/`dropped`) + `deltaStart`/`deltaFinish`
(werkdagen) + projectEnd-delta. Cases: taak later (late), taak eerder (early), nieuwe taak na baseline
(new), verwijderde taak (dropped), ongewijzigd (onSchedule).

**Regressie**: alle bestaande CPM-cases (~200+, research §9) blijven ongewijzigd groen — de nieuwe
forward-pass-takken zijn no-ops zonder statusdatum (§4.2), exact zoals `levelingDelay===undefined` dat in
2.5 was.

---

## 13. i18n-sleutels (EN + NL)

Geen nieuwe namespace (2.5-precedent) — bestaande `menu`/`common`/`task`/`report`
(`src/i18n/config.ts:126`). NL is de bronwaarde; overige 12 talen in een latere stap.

**`menu`** (lint):
```
ribbon.baselines                 EN "Baselines & progress"      NL "Baselines & voortgang"
ribbon.saveBaseline              EN "Save baseline…"            NL "Baseline opslaan…"
ribbon.manageBaselines           EN "Manage baselines…"         NL "Baselines beheren…"
ribbon.statusDate                EN "Status date"               NL "Statusdatum"
ribbon.progressMode              EN "Progress mode"             NL "Voortgangsmodus"
ribbon.progressMode.retained     EN "Retained Logic"            NL "Retained Logic"
ribbon.progressMode.override     EN "Progress Override"         NL "Progress Override"
ribbon.toggleBaselineOverlay     EN "Baseline overlay"          NL "Baseline-overlay"
ribbon.toggleProgressLine        EN "Progress line"             NL "Voortgangslijn"
ribbon.toggleStatusDateLine      EN "Status date line"          NL "Statusdatumlijn"
```

**`common`** (`baseline.*`-prefix, dialoog):
```
baseline.dialog.title            EN "Baselines"                 NL "Baselines"
baseline.dialog.name             EN "Name"                      NL "Naam"
baseline.dialog.created          EN "Created"                   NL "Aangemaakt"
baseline.dialog.active           EN "Active"                    NL "Actief"
baseline.dialog.delete           EN "Delete"                    NL "Verwijderen"
baseline.dialog.saveNew          EN "Save new baseline"         NL "Nieuwe baseline opslaan"
baseline.dialog.defaultName      EN "Baseline {n} — {date}"     NL "Baseline {n} — {date}"
baseline.dialog.noBaselines      EN "No baselines yet"          NL "Nog geen baselines"
progress.actualsAfterStatusDate  EN "Actuals cannot be after the status date"  NL "Actuals kunnen niet ná de statusdatum liggen"
```

**`task`** (properties-panel):
```
properties.progress.actualStart  EN "Actual start"             NL "Werkelijke start"
properties.progress.actualFinish EN "Actual finish"            NL "Werkelijke einde"
properties.progress.remaining    EN "Remaining (work days)"    NL "Resterend (werkdagen)"
```

**`report`** (variance-rapport):
```
report.type.variance             EN "Variance"                 NL "Variance"
report.variance.baselineStart    EN "Baseline start"           NL "Baseline start"
report.variance.baselineFinish   EN "Baseline finish"          NL "Baseline einde"
report.variance.currentStart     EN "Current start"            NL "Huidige start"
report.variance.currentFinish    EN "Current finish"           NL "Huidig einde"
report.variance.deltaStart       EN "Δ start (wd)"             NL "Δ start (wd)"
report.variance.deltaFinish      EN "Δ finish (wd)"            NL "Δ einde (wd)"
report.variance.status           EN "Status"                   NL "Status"
report.variance.status.onSchedule EN "On schedule"             NL "Op schema"
report.variance.status.late      EN "Later"                    NL "Later"
report.variance.status.early     EN "Earlier"                  NL "Eerder"
report.variance.status.new       EN "New"                      NL "Nieuw"
report.variance.status.dropped   EN "Dropped"                  NL "Vervallen"
report.variance.noBaseline       EN "No active baseline"       NL "Geen actieve baseline"
report.variance.projectEndDelta  EN "Project end: {delta} work days"  NL "Projecteinde: {delta} werkdagen"
```

---

## 14. Expliciet out-of-scope (met fase-verwijzing)

Herhaald voor de reviewer, met verwijzing:
1. **Kosten/werk/Earned Value** (`BaselineCost`/`BaselineWork`, SPI/CPI/BCWP) — **fase 3.5**
   (PLAN.md G8-G11). Reden dat `Baseline` alleen datums bevat.
2. **Meerdere voortgangslijnen / meerdere statuslijnen** — **later** (PLAN.md F15). 2.6 = één lijn.
3. **Physical vs. duration-% als aparte velden / work-%** — **fase 3.5** (vergt resources/uren).
4. **Per-relatie out-of-sequence-override** (handmatig per relatie retained/override) — **later**.
   2.6 detecteert + waarschuwt + volgt de projectbrede `progressMode`.
5. **Resource-niveau-voortgang** (per-assignment actuals) — **later**. 2.6 = taakniveau.
6. **P6-baseline-round-trip** — **best-effort/later** (research §7, PMXML-structuur onzeker).
7. **Undo van statusDate/progressMode** — bewust niet (setCalendar-precedent, §10.3).
8. **Extra MSPDI-baselineslots 1-10** — 2.6 exporteert alleen slot 0 (actieve baseline).
9. **Handmatig bewerkbare / ontkoppelde `remainingTime`** (P6 physical-%-ontkoppeling) — **fase 3.5**.
   In 2.6 is remaining altijd afgeleid; geïmporteerde afwijkende remaining is gedocumenteerd verlies
   (§9.4-noot, BESLIST).

---

## 15. Openstaande risico's

1. **Data-date-vloer op in-progress taken bij override.** In PROGRESS_OVERRIDE negeert de remaining-start
   de voorganger-druk volledig; bij een lange keten out-of-sequence-taken kan dit een optimistisch
   projecteinde geven dat de gebruiker als "te mooi" ervaart. Mitigatie: de out-of-sequence-waarschuwing
   is altijd zichtbaar; de modus-keuze is expliciet en per document. Gedocumenteerd, geen extra
   maatregel.
2. **`remainingTime` afgeleid vs. handmatig — BESLIST.** 2.6 leidt `remainingTime` altijd af uit
   `completion`; P6 laat % en remaining ontkoppelen bij physical-%. Voor OPS 2.6 bewust gekoppeld
   (duration-based). Een geïmporteerde `RemainingDuration` die niet strookt met `%` wordt bij het
   inlezen genormaliseerd naar de afgeleide waarde — gedocumenteerd verlies (§9.4-noot), géén
   verborgen "respecteer-tot-slider-aanraking"-state. Ontkoppeling is fase 3.5 (§14 punt 9).
3. **StatusTime per taak (IfcTaskTime slot 14).** We schrijven de project-statusdatum in elke taak-
   `StatusTime` met actuals; strikt genomen is StatusTime per-taak-peildatum. Voor OPS is er één
   projectbrede statusdatum, dus dit is consistent — maar een extern bestand met per-taak-afwijkende
   StatusTimes wordt bij inlezen genegeerd (we lezen alleen de project-statusdatum uit
   `OPS_ProjectSettings`). Gedocumenteerd verlies bij externe bestanden.
4. **Baseline-overlay bij summary-rijen.** De overlay tekent leaf-baselines; summary-rijen krijgen geen
   baseline-onderbalk (baselines bevatten alleen leaves, §2.1). Als een gebruiker een summary-variance
   visueel verwacht, ziet hij die alleen in het rapport, niet in de Gantt. Bewuste vereenvoudiging.
5. **Voortgangslijn-projectie bij niet-lineaire voortgang.** De `progressX`-projectie neemt lineaire
   voortgang over de balk aan; bij physical-% dat niet-lineair loopt, is de uitstulping indicatief, niet
   exact. MSP heeft dezelfde beperking. Gedocumenteerd.
6. **P6/MSPDI actuals-invarianten na import.** Na import moeten de §3.2-invarianten worden toegepast
   (via de store-actie), anders kan een geïmporteerd bestand een inconsistente combinatie
   (actualFinish zonder completion=1) bevatten. De import-pipeline moet expliciet door
   `setTaskProgress`/`setActualStart/Finish` heen, niet rauw de velden zetten — aandachtspunt bij
   implementatie van de reader→store-brug. Waar dat (nog) niet kan, dekt het solver-vangnet
   (§4.2 tak 2b) de plaatsing.
