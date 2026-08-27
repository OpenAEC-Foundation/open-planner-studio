# Datums zoals opgeslagen — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wanneer het openen van een IFC-bestand andere datums oplevert dan er in dat bestand staan, kan de gebruiker met één klik de opgeslagen datums bekijken; de app maakt de hele tijd zichtbaar dat er niet herberekend is en keert terug naar normaal gedrag zodra er bewerkt of berekend wordt.

**Architecture:** Het laadpad blijft onvoorwaardelijk herberekenen — die bestaande solve *is* de detectie. Vóór de solve leggen we vast wat het bestand zei, ná de solve tellen we de verschillen. Bij verschil verschijnt een blijvende strook onder het lint. Klikt de gebruiker, dan zetten we de opgeslagen waarden terug in `task.time` en reconstrueren we `cpmResult` uit het bestand in plaats van te solven. De hele UI leest datums al als `earlyStart || scheduleStart`, dus renderer en tabel wijzigen niet.

**Tech Stack:** TypeScript strict, React 19, Zustand + Immer, esbuild-gebundelde `node:`-testbatterijen (geen vitest/jest), react-i18next (14 locales).

**Spec:** [`docs/superpowers/specs/2026-08-17-datums-zoals-opgeslagen-design.md`](../specs/2026-08-17-datums-zoals-opgeslagen-design.md)

**Twee bewuste afwijkingen van de spec-naamgeving**, omdat de implementatie ze scherper maakt:
- De spec noemt één veld `recordedTimes` plus een los aantal. Dit plan gebruikt **één** documentveld `recordedDates` met de vorm `{ times, shifted, total }`, zodat de teller in de melding niet als derde contractveld hoeft.
- De spec noemt de module `cpmResultFromRecorded.ts`. Dit plan bundelt alle pure logica in **`src/engine/scheduler/recordedDates.ts`** (vastleggen, tellen, reconstrueren) — één samenhangende verantwoordelijkheid, één testdoel.

---

## Bestandsoverzicht

| bestand | wat |
|---|---|
| `src/services/ifc/ifcTaskSlots.ts` | **wijzig** — `RECORDED_SLOT_KEYS` exporteren |
| `src/services/ifc/ifcReader.ts` | **wijzig** — aanwezigheid per taak vastleggen, meegeven in `readIFC` |
| `src/services/importTypes.ts` | **wijzig** — optioneel `recordedFields` op `ImportResult` |
| `src/engine/scheduler/recordedDates.ts` | **nieuw** — types + `captureRecordedDates` + `countShiftedTasks` + `cpmResultFromRecorded` |
| `src/engine/scheduler/projectDuration.ts` | **nieuw** (tijdens de bouw toegevoegd) — `projectDurationOf`, gedeeld met de solver |
| `src/engine/scheduler/scheduleAnalysis.ts` | **wijzig** (tijdens de bouw toegevoegd) — projectduur-staart geëxtraheerd; gedragsbehoudend geverifieerd |
| `src/state/documentContract.ts` | **wijzig** — twee contractvelden + `payloadFromImport`-allowlist |
| `src/state/slices/scheduleSlice.ts` | **wijzig** — velden, `showRecordedDates`, F5-uitgang |
| `src/state/transaction.ts` | **wijzig** — modus uitzetten in `finishMutation` |
| `src/state/slices/fileSlice.ts` | **wijzig** — detectie rond de bestaande `runCPM()` |
| `src/hooks/useExitRecordedDates.ts` | **nieuw** — herrekenen ná het verlaten |
| `src/components/layout/RecordedDatesNotice.tsx` | **nieuw** — de strook, twee standen |
| `src/App.tsx` | **wijzig** — strook + hook monteren |
| `src/i18n/locales/*/common.json` | **wijzig** — 14 locales |
| `public/docs/{nl,en}/datums-zoals-opgeslagen.md` + `manifest.json` | **nieuw** — gids |
| `tests/planning/check-recorded-dates.ts` | **nieuw** — de batterij |
| `tests/planning/check-document-contract.ts` | **wijzig** — drie handmatige plekken |
| `tests/planning/check-ifc-roundtrip.ts` | **wijzig** — de `$`-slot-regressie |
| `tests/planning/run.sh` | **wijzig** — batterij registreren |

**Twee valkuilen die door het hele plan heen gelden:**
1. `ImportResult` is óók `WriteIFCInput` (`ifcWriter.ts:128`) en wordt uitgebreid door `GeneratedProject` (`generateProject.ts:90`). Nieuwe velden **moeten optioneel** zijn.
2. `payloadFromImport` (`documentContract.ts:333`) is een **allowlist, geen spread**. Een nieuw `ImportResult`-veld komt daar niet vanzelf doorheen.

---

## Task 1: Aanwezigheid van rekenslots vastleggen in de IFC-lezer

**Waarom:** `parseDateFromIFC` maakt van een `$`-slot de datum van vandaag. Zonder deze stap is "het bestand gaf een early-datum" niet te onderscheiden van "de lezer vulde vandaag in", en zou de functie externe exports op vandaag zetten.

**Files:**
- Modify: `src/services/ifc/ifcTaskSlots.ts` (na `TASKTIME_SLOT`, rond regel 221)
- Modify: `src/services/ifc/ifcReader.ts` (`extractTasks` rond 631-700, `readIFC` return rond 145-152)
- Modify: `src/services/importTypes.ts` (optionele-veldenblok, rond regel 60)
- Test: `tests/planning/check-ifc-roundtrip.ts`

- [ ] **Step 1: Exporteer de lijst rekenslots**

In `src/services/ifc/ifcTaskSlots.ts`, direct ná de `export const TASKTIME_SLOT = indexMap(IFC_TASKTIME_SLOTS);`-regel:

```ts
/**
 * De IfcTaskTime-slots die een REKENRESULTAAT dragen in plaats van gebruikersinvoer.
 *
 * Gebruikt door de "datums zoals opgeslagen"-functie: alleen voor deze slots is het relevant of het
 * bestand ze daadwerkelijk vulde. `scheduleStart`/`scheduleFinish` staan er bewust NIET in — die zijn
 * invoer (het anker waarop de forward pass snapt) en worden apart behandeld.
 */
export const RECORDED_SLOT_KEYS = [
  'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'freeFloat', 'totalFloat', 'isCritical',
] as const;

export type RecordedSlotKey = typeof RECORDED_SLOT_KEYS[number];
```

- [ ] **Step 2: Voeg het optionele veld toe aan `ImportResult`**

In `src/services/importTypes.ts`, in het "Optionele velden"-blok (ná `libraryPool`):

```ts
  /** OPTIONEEL — per taak-id welke IfcTaskTime-REKENSLOTS het bestand daadwerkelijk vulde
   *  (`RECORDED_SLOT_KEYS`). Alleen `readIFC` levert dit; CSV/MSPDI/P6/extensie-import kennen geen
   *  IfcTaskTime-slots en laten het weg. Nodig omdat `parseDateFromIFC` een `$`-slot als "vandaag"
   *  inleest — na het parsen is een leeg slot niet meer van een echte datum te onderscheiden. */
  recordedFields?: Record<string, string[]>;
```

- [ ] **Step 3: Leg de aanwezigheid vast in `extractTasks`**

In `src/services/ifc/ifcReader.ts`. Breid de bestaande import uit `./ifcTaskSlots` uit met `RECORDED_SLOT_KEYS` en `TASKTIME_SLOT` (`TASKTIME_SLOT` wordt al geïmporteerd voor `applyHourModeIFC`; voeg alleen `RECORDED_SLOT_KEYS` toe).

Voeg direct vóór `function extractTasks(` toe:

```ts
/**
 * Welke rekenslots vulde dit IfcTaskTime écht? `$`, leeg en afwezig tellen NIET mee.
 *
 * Bewust hier en niet in de slot-`read`-descriptors: `read` krijgt de rauwe arg al binnen, maar zijn
 * contract (`read?(t, arg, p)`) zou voor alle twintig slots moeten wijzigen om deze ene uitkomst
 * naar buiten te krijgen. De arg-index staat via `TASKTIME_SLOT` toch al ter beschikking.
 */
function recordedSlotsOf(e: StepEntity): string[] {
  const out: string[] = [];
  for (const key of RECORDED_SLOT_KEYS) {
    const arg = e.args[TASKTIME_SLOT[key]];
    if (arg && arg !== '$') out.push(key);
  }
  return out;
}
```

Breid het return-type van `extractTasks` uit:

```ts
): { tasks: Task[]; taskStepIdMap: Map<string, string>; taskTimeEntities: Map<string, StepEntity>; recordedFields: Record<string, string[]> } {
```

Declareer naast `taskTimeEntities`:

```ts
  // Aanwezigheidsregistratie voor "datums zoals opgeslagen": per taak-id de rekenslots die het
  // bestand echt vulde. Een taak ZONDER IfcTaskTime krijgt een lege lijst (niet: ontbrekend) —
  // "geen enkel slot gevuld" is een uitspraak, "onbekend" niet.
  const recordedFields: Record<string, string[]> = {};
```

Vul hem in de bestaande `if (taskTimeRef)`-tak, naast `taskTimeEntities.set(id, ttEntity)`:

```ts
      if (ttEntity) {
        taskTimeEntities.set(id, ttEntity);
        recordedFields[id] = recordedSlotsOf(ttEntity);
      } else {
        recordedFields[id] = [];
      }
    } else {
      time = createDefaultTaskTime(formatDate(new Date()), 5);
      recordedFields[id] = [];
    }
```

En de return:

```ts
  return { tasks, taskStepIdMap, taskTimeEntities, recordedFields };
```

- [ ] **Step 4: Geef het door in `readIFC`**

Pas de destructurering aan (rond regel 118):

```ts
  const { tasks, taskStepIdMap, taskTimeEntities, recordedFields } = extractTasks(entities, entityMap, baselineTaskStepIds);
```

En voeg het toe aan het return-object:

```ts
    libraryPool: libraryPoolOut.value,
    recordedFields,
  };
```

- [ ] **Step 5: Schrijf de falende regressietest**

In `tests/planning/check-ifc-roundtrip.ts`, aan het eind vóór het uitslagblok. Dit is de scherpste test van de hele functie — hij pint de `$`-val vast:

```ts
// ── (9r) Aanwezigheidsregistratie: `$`-rekenslots tellen NIET als opgeslagen datum ────────────
// parseDateFromIFC maakt van `$` de datum van VANDAAG. Zonder aanwezigheidsregistratie zou een
// extern geëxporteerd bestand (alleen ScheduleStart/ScheduleFinish gevuld) er uitzien alsof het
// early-datums draagt, en zou "datums zoals opgeslagen" het hele project op vandaag zetten.
const TT_LEEG = [
  'ISO-10303-21;', 'HEADER;',
  "FILE_NAME('X.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
  'ENDSEC;', 'DATA;',
  "#1=IFCPROJECT('g1',$,'Extern',$,$,$,$,$,$);",
  // IfcTaskTime met alleen ScheduleStart (5) en ScheduleFinish (6); alle rekenslots (7-13) op `$`.
  "#9=IFCTASKTIME('T',.PREDICTED.,$,.WORKTIME.,$,'2026-03-02','2026-03-06',$,$,$,$,$,$,$,$,$,$,$,$,$);",
  "#2=IFCTASK('g2',$,'Extern A',$,$,'1.1',$,$,#9,.F.,$,$,.CONSTRUCTION.);",
  'ENDSEC;', 'END-ISO-10303-21;',
].join('\n');
const rtLeeg = readIFC(TT_LEEG);
const leegId = rtLeeg.tasks[0].id;
eq('9r geen rekenslot als aanwezig gemeld', rtLeeg.recordedFields?.[leegId], []);
assert(rtLeeg.tasks[0].time.scheduleStart === '2026-03-02',
  `9r scheduleStart moet gewoon gelezen worden — kreeg ${rtLeeg.tasks[0].time.scheduleStart}`);

// Tegenproef: mét gevulde rekenslots worden ze WEL gemeld.
const TT_VOL = TT_LEEG.replace(
  "'2026-03-02','2026-03-06',$,$,$,$,$,$,$",
  "'2026-03-02','2026-03-06','2026-03-02','2026-03-06','2026-03-04','2026-03-10',$,'P2D',.T.",
);
const rtVol = readIFC(TT_VOL);
eq('9r gevulde rekenslots wél gemeld',
  rtVol.recordedFields?.[rtVol.tasks[0].id],
  ['earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'totalFloat', 'isCritical']);
```

- [ ] **Step 6: Draai de test en zie hem falen**

```bash
bash tests/planning/run.sh 2>&1 | tail -30
```

Verwacht: `XX` op de 9r-regels (`recordedFields` bestaat nog niet ⇒ `undefined` ≠ `[]`) als je stap 1-4 nog niet deed; deed je die wel, dan meteen groen. Vertrouw op de **exitcode**, niet op de tail:

```bash
bash tests/planning/run.sh >/dev/null 2>&1; echo "exit=$?"
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

Verwacht: exit 0. Faalt het op `recordedFields` in `WriteIFCInput`-callers, dan is het veld niet optioneel gemaakt — zie stap 2.

- [ ] **Step 8: Commit**

```bash
git add src/services/ifc/ifcTaskSlots.ts src/services/ifc/ifcReader.ts src/services/importTypes.ts tests/planning/check-ifc-roundtrip.ts
git commit -m "feat(ifc): leg vast welke rekenslots een bestand echt vulde

parseDateFromIFC maakt van een \$-slot de datum van vandaag, dus na het
parsen is een leeg EarlyStart-slot niet meer te onderscheiden van een echte
datum. Voor 'datums zoals opgeslagen' is dat onderscheid essentieel."
```

---

## Task 2: De pure recorded-dates-laag

**Waarom:** vastleggen, vergelijken en reconstrueren zijn pure functies. Ze horen buiten de store, zodat ze headless en zonder Immer-draft te testen zijn.

**Files:**
- Create: `src/engine/scheduler/recordedDates.ts`
- Create: `tests/planning/check-recorded-dates.ts`
- Modify: `tests/planning/run.sh`

- [ ] **Step 1: Registreer de nieuwe batterij in `run.sh`**

`run.sh` heeft **geen glob** voor `check-*.ts` — elke batterij staat er met de hand in. Voeg binnen het `if [ "$RUN_HOLIDAYS" -eq 1 ]; then … fi`-blok toe, naast de buren:

```bash
  # Datums zoals opgeslagen (issue #63): aanwezigheidsregistratie, detectie, reconstructie,
  # betreden/verlaten en de undo-keten. Draait mee in de tijdzone-matrix — de reconstructie
  # rekent met datums, dus TZ-onafhankelijkheid moet bewezen worden.
  RECDATES="$DIR/.check-recorded-dates.mjs"
  if bundle_check "$DIR/check-recorded-dates.ts" "$RECDATES"; then node "$RECDATES" || STATUS=1; fi
```

De `if bundle_check …; then node … || STATUS=1; fi`-vorm is verplicht: een functie die 1 teruggeeft binnen een `if`-conditie triggert `set -e` niet, dus een kapotte check breekt de rest van de suite niet af.

- [ ] **Step 2: Schrijf de falende test**

Maak `tests/planning/check-recorded-dates.ts`:

```ts
/**
 * Batterij voor "datums zoals opgeslagen" (issue #63).
 *
 * De functie bestaat omdat een via P6 → IFC geïmporteerde planning datums draagt maar vaak geen
 * sluitende logica: herberekening verschuift de datums en de bron is dan onzichtbaar. Deze batterij
 * bewaakt de drie plekken waar dat mis kan gaan:
 *  - de tweelagenkeuze (early* alleen als het bestand ze gaf, anders schedule*),
 *  - de reconstructie van cpmResult zonder solve (wat wél en wat NIET beweerd mag worden),
 *  - betreden/verlaten en de undo-keten.
 *
 * TZ-gevoelig: draait in run.sh vijf keer onder verschillende tijdzones. Gebruik daarom uitsluitend
 * vaste ISO-datums, nooit `new Date()` zonder anker.
 */
import {
  captureRecordedDates,
  countShiftedTasks,
  cpmResultFromRecorded,
  type RecordedDatesInfo,
} from '@/engine/scheduler/recordedDates';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;
const J = (v: unknown) => JSON.stringify(v);
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (J(got) !== J(want)) diffs.push(`${label}: verwacht ${J(want)}, kreeg ${J(got)}`);
};
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

/** Minimale bladtaak; alleen de velden die deze batterij leest. */
const mk = (id: string, o: Partial<Task['time']> = {}): Task => ({
  id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 5, parentId: null, childIds: [], resourceIds: [],
  time: {
    durationType: 'WORKTIME', scheduleDuration: 5,
    scheduleStart: '2026-03-02', scheduleFinish: '2026-03-06',
    earlyStart: '2026-03-02', earlyFinish: '2026-03-06',
    lateStart: '2026-03-02', lateFinish: '2026-03-06',
    freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    ...o,
  },
} as Task);

// ── (1) Tweelagenkeuze ───────────────────────────────────────────────────────
// Bestand gaf GEEN rekenslots ⇒ schedule* is "zoals opgeslagen", niet de door de lezer
// ingevulde earlyStart-van-vandaag.
const geen = captureRecordedDates([mk('a', { earlyStart: '2099-01-01', earlyFinish: '2099-01-05' })], { a: [] });
eq('1a zonder rekenslots valt terug op scheduleStart', geen.times['a'].start, '2026-03-02');
eq('1b zonder rekenslots valt terug op scheduleFinish', geen.times['a'].finish, '2026-03-06');
eq('1c zonder rekenslots geen speling beweerd', geen.times['a'].totalFloat, undefined);
eq('1d zonder rekenslots geen kritiek beweerd', geen.times['a'].isCritical, undefined);

// Bestand gaf ze WEL ⇒ early* wint.
const wel = captureRecordedDates(
  [mk('a', { earlyStart: '2026-04-01', earlyFinish: '2026-04-08', totalFloat: 3, isCritical: true })],
  { a: ['earlyStart', 'earlyFinish', 'totalFloat', 'isCritical'] },
);
eq('1e met rekenslots wint earlyStart', wel.times['a'].start, '2026-04-01');
eq('1f met rekenslots wint earlyFinish', wel.times['a'].finish, '2026-04-08');
eq('1g met rekenslots komt speling mee', wel.times['a'].totalFloat, 3);
eq('1h met rekenslots komt kritiek mee', wel.times['a'].isCritical, true);

// Geen aanwezigheidsdata (niet-IFC-import) ⇒ helemaal niets vastleggen.
eq('1i zonder recordedFields geen enkele taak', Object.keys(captureRecordedDates([mk('a')], undefined).times), []);

// ── (2) Verschiltelling ──────────────────────────────────────────────────────
const basis = captureRecordedDates([mk('a'), mk('b')], { a: [], b: [] });
eq('2a identiek ⇒ 0 verschoven', countShiftedTasks([mk('a'), mk('b')], basis.times), 0);
eq('2b één verschoven ⇒ 1',
  countShiftedTasks([mk('a', { earlyStart: '2026-05-01' }), mk('b')], basis.times), 1);
eq('2c onbekende taak telt niet mee', countShiftedTasks([mk('c')], basis.times), 0);

// ── (3) Reconstructie ────────────────────────────────────────────────────────
const cal = createDefaultCalendar();
const volInfo = captureRecordedDates(
  [mk('a', { earlyStart: '2026-03-02', earlyFinish: '2026-03-06', totalFloat: 0, isCritical: true }),
   mk('b', { earlyStart: '2026-03-09', earlyFinish: '2026-03-13', totalFloat: 4, isCritical: false })],
  { a: ['earlyStart', 'earlyFinish', 'totalFloat', 'isCritical'],
    b: ['earlyStart', 'earlyFinish', 'totalFloat', 'isCritical'] },
);
const rec = cpmResultFromRecorded(volInfo, [mk('a'), mk('b')], cal);
eq('3a projecteinde = laatste opgeslagen finish', rec.projectEnd, '2026-03-13');
eq('3b kritiek pad uit isCritical', rec.criticalPath, ['a']);
eq('3c criticalPaths[0] === criticalPath', rec.criticalPaths[0], rec.criticalPath);
eq('3d speling uit het bestand', rec.tasks.get('b')?.totalFloat, 4);
truthy('3e geen foutveld', rec.error === undefined);

// Wat NIET in IFC staat, wordt niet verzonnen.
for (const [label, got] of [
  ['drivingSequenceIds', rec.drivingSequenceIds],
  ['truncatedLeadSequenceIds', rec.truncatedLeadSequenceIds],
  ['violatedConstraintTaskIds', rec.violatedConstraintTaskIds],
  ['outOfSequenceSequenceIds', rec.outOfSequenceSequenceIds],
  ['nearCriticalTaskIds', rec.nearCriticalTaskIds],
  ['hammockNoFinishDriverTaskIds', rec.hammockNoFinishDriverTaskIds],
] as const) {
  eq(`3f ${label} blijft leeg`, got, []);
}
eq('3g sequenceFreeFloat blijft leeg', rec.sequenceFreeFloat, {});
eq('3h floatPathByTask blijft leeg', rec.floatPathByTask, {});

// Zonder isCritical in het bestand: géén kritiek pad beweren.
const zonderKritiek = cpmResultFromRecorded(
  captureRecordedDates([mk('a')], { a: [] }), [mk('a')], cal,
);
eq('3i zonder isCritical geen kritiek pad', zonderKritiek.criticalPath, []);
eq('3j zonder isCritical ook criticalPaths leeg', zonderKritiek.criticalPaths, [[]]);

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  recorded-dates: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  recorded-dates: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
```

- [ ] **Step 3: Draai de test en zie hem falen**

```bash
bash tests/planning/run.sh >/dev/null 2>&1; echo "exit=$?"
```

Verwacht: `exit=1`, met in de uitvoer `XX  bundelen mislukt: check-recorded-dates.ts` — de module bestaat nog niet.

- [ ] **Step 4: Schrijf de module**

Maak `src/engine/scheduler/recordedDates.ts`:

```ts
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { CPMResult, CPMTaskResult } from './CPMSolver';
import { CalendarEngine } from './CalendarEngine';

/**
 * "Datums zoals opgeslagen" (issue #63) — de pure laag.
 *
 * Een via P6 → IFC geïmporteerde planning draagt datums maar vaak geen sluitende logica. Openen
 * herberekent onvoorwaardelijk (dat blijft zo — die solve ís de detectie), waarna de bron onzichtbaar
 * is. Deze module legt vast wat het bestand zei, telt de verschillen, en reconstrueert een `CPMResult`
 * uit die vastlegging in plaats van te solven.
 *
 * KERNREGEL: nooit iets beweren wat het bestand niet zegt. `parseDateFromIFC` maakt van een `$`-slot
 * de datum van vandaag, dus de aanwezigheidsregistratie uit de lezer (`ImportResult.recordedFields`)
 * is de enige betrouwbare bron voor "dit stond er echt".
 */

/** Wat het bestand per taak vastlegde. Alles behalve start/finish is optioneel: ontbreekt het in het
 *  bestand, dan blijft het hier `undefined` in plaats van een verzonnen nul. */
export interface RecordedTime {
  start: string;
  finish: string;
  lateStart?: string;
  lateFinish?: string;
  totalFloat?: number;
  freeFloat?: number;
  isCritical?: boolean;
}

export interface RecordedDatesInfo {
  /** Per taak-id wat het bestand vastlegde. */
  times: Record<string, RecordedTime>;
  /** Aantal taken waarvan de herberekening de datums verschoof — de teller in de melding. */
  shifted: number;
  /** Aantal taken met vastgelegde datums — de noemer in de melding. */
  total: number;
}

/**
 * Leg vast wat het bestand zei. ROEP DIT AAN VÓÓR `runCPM`: de store deelt de taak-objecten met het
 * parse-resultaat, dus na de solve zijn de oorspronkelijke waarden overschreven.
 *
 * De tweelagenkeuze uit de spec (§1): `early*` telt alleen mee wanneer `recordedFields` het slot
 * meldt; anders is `schedule*` "zoals opgeslagen" — dat is het geval van issue #63, waar de exporteur
 * alleen ScheduleStart/ScheduleFinish vult.
 *
 * `shifted` blijft hier 0; die vult de aanroeper ná de solve met `countShiftedTasks`.
 */
export function captureRecordedDates(
  tasks: Task[],
  recordedFields: Record<string, string[]> | undefined,
): RecordedDatesInfo {
  const times: Record<string, RecordedTime> = {};
  if (!recordedFields) return { times, shifted: 0, total: 0 };

  for (const task of tasks) {
    const present = recordedFields[task.id];
    if (!present) continue; // taak niet uit dit bestand (of niet-IFC-import) — niets te zeggen
    const has = new Set(present);
    const t = task.time;
    times[task.id] = {
      start: has.has('earlyStart') ? t.earlyStart : t.scheduleStart,
      finish: has.has('earlyFinish') ? t.earlyFinish : t.scheduleFinish,
      lateStart: has.has('lateStart') ? t.lateStart : undefined,
      lateFinish: has.has('lateFinish') ? t.lateFinish : undefined,
      totalFloat: has.has('totalFloat') ? t.totalFloat : undefined,
      freeFloat: has.has('freeFloat') ? t.freeFloat : undefined,
      isCritical: has.has('isCritical') ? t.isCritical : undefined,
    };
  }
  return { times, shifted: 0, total: Object.keys(times).length };
}

/** Hoeveel taken kregen door de solve andere datums dan het bestand vastlegde? Roep dit ÁÁN ná
 *  `runCPM`, met dezelfde `times` die vóór de solve is vastgelegd. */
export function countShiftedTasks(tasks: Task[], times: Record<string, RecordedTime>): number {
  let n = 0;
  for (const task of tasks) {
    const rec = times[task.id];
    if (!rec) continue;
    if (task.time.earlyStart !== rec.start || task.time.earlyFinish !== rec.finish) n++;
  }
  return n;
}

/**
 * Bouw een `CPMResult` uit de vastlegging, zonder te solven.
 *
 * Gevuld: per-taak-resultaten, projecteinde, projectduur, gemiste deadlines, en — alléén wanneer het
 * bestand `IsCritical` gaf — het kritieke pad.
 *
 * BEWUST LEEG, want het staat niet in IFC en kan dus nooit eerlijk gevuld worden: driving-relaties
 * (de solver-docstring zegt expliciet dat die niet gepersisteerd worden), relatie-speling, afgekapte
 * leads, geschonden constraints, out-of-sequence, near-critical, float-paths, hammock-waarschuwingen.
 *
 * `totalFloat`/`freeFloat` zijn in `CPMTaskResult` verplichte getallen; ontbreken ze in het bestand,
 * dan wordt het 0. Dat is het enige punt waar deze module een getal noemt dat het bestand niet gaf —
 * de blijvende modus-strook is daar het tegengif (zie de spec, §4).
 */
export function cpmResultFromRecorded(
  info: RecordedDatesInfo,
  tasks: Task[],
  calendar: WorkCalendar,
): CPMResult {
  const out = new Map<string, CPMTaskResult>();
  const criticalPath: string[] = [];
  const missedDeadlineTaskIds: string[] = [];
  let projectEnd = '';
  let projectStart = '';

  const ordered = tasks
    .filter((t) => info.times[t.id])
    .sort((a, b) => info.times[a.id].start.localeCompare(info.times[b.id].start));

  for (const task of ordered) {
    const rec = info.times[task.id];
    out.set(task.id, {
      earlyStart: rec.start,
      earlyFinish: rec.finish,
      // Geen late-datum in het bestand ⇒ gelijk aan de vroege: geen afgeleide bewering.
      lateStart: rec.lateStart ?? rec.start,
      lateFinish: rec.lateFinish ?? rec.finish,
      totalFloat: rec.totalFloat ?? 0,
      freeFloat: rec.freeFloat ?? 0,
      isCritical: rec.isCritical ?? false,
    });
    if (rec.isCritical) criticalPath.push(task.id);
    if (task.deadline && rec.finish > task.deadline) missedDeadlineTaskIds.push(task.id);
    if (!projectStart || rec.start < projectStart) projectStart = rec.start;
    if (rec.finish > projectEnd) projectEnd = rec.finish;
  }

  // Werkdagen tellen is geen solve — de kalender kan de span gewoon uitrekenen.
  let projectDuration = 0;
  if (projectStart && projectEnd) {
    // CalendarEngine neemt precies één kalender (zie zijn constructor) — de projectkalender.
    const engine = new CalendarEngine(calendar);
    projectDuration = engine.workDaysBetween(new Date(projectStart), new Date(projectEnd));
  }

  return {
    tasks: out,
    criticalPath,
    criticalPaths: [criticalPath],
    drivingSequenceIds: [],
    sequenceFreeFloat: {},
    truncatedLeadSequenceIds: [],
    violatedConstraintTaskIds: [],
    missedDeadlineTaskIds,
    outOfSequenceSequenceIds: [],
    nearCriticalTaskIds: [],
    floatPathByTask: {},
    hammockNoFinishDriverTaskIds: [],
    projectEnd,
    projectDuration,
  };
}
```

- [ ] **Step 5: Draai de test en zie hem slagen**

```bash
bash tests/planning/run.sh >/dev/null 2>&1; echo "exit=$?"
```

Verwacht: `exit=0`. Controleer ook expliciet de nieuwe batterij:

```bash
bash tests/planning/run.sh 2>&1 | grep "recorded-dates"
```

Verwacht: `OK  recorded-dates: alle checks groen (NN)`.

Let op de tijdzone-matrix: `run.sh` draait deze bundel vijf keer onder verschillende `TZ`. Blok (3) rekent met `new Date(projectStart)` in de module — komt daar een afwijking uit in een niet-UTC-zone, dan is dat een echte bug in de reconstructie en geen testartefact.

- [ ] **Step 6: Commit**

```bash
git add src/engine/scheduler/recordedDates.ts tests/planning/check-recorded-dates.ts tests/planning/run.sh
git commit -m "feat(scheduler): pure laag voor datums zoals opgeslagen

Vastleggen (met de tweelagenkeuze early*/schedule*), verschillen tellen, en
een CPMResult reconstrueren zonder te solven. Wat niet in IFC staat wordt
bewust leeg gelaten in plaats van verzonnen."
```

---

## Task 3: Twee documentvelden

**Waarom:** modus en vastlegging moeten een documentwissel, een undo en een crash overleven volgens dezelfde regels als de rest van de projectdata. Het contract dwingt dat compile-time af.

**Files:**
- Modify: `src/state/documentContract.ts` (`DocumentPayload` rond 53-58, `DOCUMENT_FIELDS` rond 188-192, `payloadFromImport` rond 333)
- Modify: `src/state/slices/scheduleSlice.ts` (interface + initiële waarden)
- Modify: `tests/planning/check-document-contract.ts` (drie handmatige plekken)

- [ ] **Step 1: Voeg de velden toe aan de slice**

In `src/state/slices/scheduleSlice.ts`, in `interface ScheduleSlice` naast `scheduleStale`:

```ts
  /** "Datums zoals opgeslagen" (issue #63) — wat het geopende bestand vastlegde, plus de teller
   *  voor de melding. Niet-null ⇒ herberekening verschoof datums en de strook biedt de modus aan.
   *  Bestaat alleen tussen het laden en de eerste bewerking/berekening. */
  recordedDates: RecordedDatesInfo | null;
  /** Staat de modus aan: toont de app de opgeslagen datums in plaats van de herberekende? */
  datesAsRecorded: boolean;
```

Met bovenaan:

```ts
import type { RecordedDatesInfo } from '@/engine/scheduler/recordedDates';
```

En in de creator-body naast `scheduleStale: false`:

```ts
  recordedDates: null,
  datesAsRecorded: false,
```

- [ ] **Step 2: Voeg ze toe aan `DocumentPayload`**

In `src/state/documentContract.ts`, naast `scheduleStale`:

```ts
  recordedDates: RecordedDatesInfo | null;
  datesAsRecorded: boolean;
```

Met de import erbij:

```ts
import type { RecordedDatesInfo } from '@/engine/scheduler/recordedDates';
```

- [ ] **Step 3: Voeg de descriptors toe**

In `DOCUMENT_FIELDS`, direct ná de `scheduleStale`-entry:

```ts
  // "Datums zoals opgeslagen" (issue #63). `snapshot: 'ref'` net als cpmResult/scheduleStale: beide
  // worden altijd als geheel vervangen, nooit in-place gemuteerd. Dat is precies wat Ctrl+Z nodig
  // heeft — samen met `tasks` ('clone') draait één undo de datums én de modus terug.
  // De invariant uit snapshot.ts geldt: élke mutator van deze velden pusht een snapshot
  // (`showRecordedDates` doet dat, en de F5-uitgang in `runCPM` ook).
  field({ key: 'recordedDates', get: (s) => s.recordedDates, set: (s, v) => { s.recordedDates = v; }, fresh: () => null, snapshot: 'ref', fromPayload: (p) => p.recordedDates ?? null }),
  field({ key: 'datesAsRecorded', get: (s) => s.datesAsRecorded, set: (s, v) => { s.datesAsRecorded = v; }, fresh: () => false, snapshot: 'ref', fromPayload: (p) => p.datesAsRecorded ?? false }),
```

- [ ] **Step 4: Laat ze NIET door `payloadFromImport`**

`payloadFromImport` is een allowlist. Beide velden horen bij een verse load op hun `fresh`-waarde te starten (`null`/`false`) — dat gebeurt vanzelf via `...freshPayload()`. **Voeg hier dus niets toe.** De detectie in Task 5 zet `recordedDates` pas ná de solve.

Bevestig dat `freshPayload()` bovenaan `payloadFromImport` gespreid wordt:

```bash
grep -n -A 3 "export function payloadFromImport" src/state/documentContract.ts
```

Verwacht: de eerste regel van het return-object is `...freshPayload(),`.

- [ ] **Step 5: Werk de drie handmatige plekken in de contracttest bij**

`check-document-contract.ts` loopt in blok (a2) al key-gedreven over `DOCUMENT_FIELDS`, maar drie plekken zijn handgeschreven.

**(i)** In blok (a), bij de doc1-opbouw, ná `S().runCPM();`:

```ts
// recordedDates + datesAsRecorded (issue #63) — direct gezet; de detectie loopt via een echte
// bestandsload en hoort niet in deze contracttest thuis.
useAppStore.setState((s) => {
  s.recordedDates = { times: { x: { start: '2026-03-02', finish: '2026-03-06' } }, shifted: 1, total: 1 };
  s.datesAsRecorded = true;
});
```

**(ii)** In blok (a1), de lek-lijst uitbreiden:

```ts
for (const key of ['tasks', 'resources', 'assignments', 'activityCodeTypes', 'customFieldDefs',
  'selectedTaskIds', 'collapsedTaskIds', 'baselines', 'cpmResult', 'filePath', 'calendars',
  'recordedDates', 'datesAsRecorded'] as const) {
```

**(iii)** In blok (b), beide A/B-tabellen. Zonder deze regels zet `setSnapshotFields` de velden stil op `undefined` en test blok (b) niets — er is geen volledigheidscheck op deze tabellen:

```ts
// in valuesA:
  recordedDates: { times: { a: { start: '2026-01-01', finish: '2026-01-05' } }, shifted: 1, total: 1 },
  datesAsRecorded: true,
// in valuesB:
  recordedDates: null,
  datesAsRecorded: false,
```

- [ ] **Step 6: Draai typecheck en de suite**

```bash
npm run typecheck && bash tests/planning/run.sh >/dev/null 2>&1; echo "exit=$?"
```

Verwacht: `exit=0`. Faalt `_assertAllFieldsCovered` of `_assertNoUnclassifiedState`, dan mist een veld zijn descriptor of zijn `DocumentPayload`-vermelding.

- [ ] **Step 7: Commit**

```bash
git add src/state/documentContract.ts src/state/slices/scheduleSlice.ts tests/planning/check-document-contract.ts
git commit -m "feat(state): recordedDates en datesAsRecorded in het documentcontract

snapshot: 'ref' net als cpmResult/scheduleStale — samen met tasks ('clone')
draait één Ctrl+Z de datums en de modus in één stap terug."
```

---

## Task 4: Detectie bij het laden

**Waarom:** dit is het hart van de functie, en het kost niets: de bestaande recompute na het laden levert de vergelijking.

**Files:**
- Modify: `src/state/slices/fileSlice.ts` (`applyLoadedProject`, rond 147-190)
- Test: `tests/planning/check-recorded-dates.ts`

- [ ] **Step 1: Schrijf de falende test**

Voeg toe aan `tests/planning/check-recorded-dates.ts`, vóór het uitslagblok. Deze test gaat door de échte store en de échte IFC-keten:

```ts
// ── (4) Detectie bij het laden ───────────────────────────────────────────────
import { useAppStore } from '@/state/appStore';
import { readIFC } from '@/services/ifc/ifcReader';

const S = () => useAppStore.getState();

// Bestand met vastgelegde datums die NIET uit de logica volgen: b staat vast op 2026-03-16 terwijl
// de FS-relatie hem direct ná a (finish 2026-03-06) zou plaatsen.
const EXTERN = [
  'ISO-10303-21;', 'HEADER;',
  "FILE_NAME('X.ifc','2031-01-01T07:00:00',('A'),('B'),'x','y','');",
  'ENDSEC;', 'DATA;',
  "#1=IFCPROJECT('g1',$,'Extern',$,$,$,$,$,$);",
  "#8=IFCTASKTIME('T',.PREDICTED.,$,.WORKTIME.,$,'2026-03-02','2026-03-06','2026-03-02','2026-03-06',$,$,$,$,$,$,$,$,$,$,$);",
  "#9=IFCTASKTIME('T',.PREDICTED.,$,.WORKTIME.,$,'2026-03-16','2026-03-20','2026-03-16','2026-03-20',$,$,$,$,$,$,$,$,$,$,$);",
  "#2=IFCTASK('g2',$,'A',$,$,'1.1',$,$,#8,.F.,$,$,.CONSTRUCTION.);",
  "#3=IFCTASK('g3',$,'B',$,$,'1.2',$,$,#9,.F.,$,$,.CONSTRUCTION.);",
  "#4=IFCRELSEQUENCE('g4',$,$,$,#2,#3,$,.FINISH_START.);",
  'ENDSEC;', 'END-ISO-10303-21;',
].join('\n');

S().newProject();
S().applyLoadedProject(readIFC(EXTERN), { filePath: null, recompute: true });
truthy('4a afwijking gedetecteerd', S().recordedDates !== null);
eq('4b teller telt de verschoven taak', S().recordedDates?.shifted, 1);
eq('4c noemer telt alle vastgelegde taken', S().recordedDates?.total, 2);
eq('4d modus staat nog uit', S().datesAsRecorded, false);

// Een bestand dat de app zelf schreef is intern consistent ⇒ geen aanbod.
import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
S().newProject();
const eigenA = S().addTask({ name: 'A' });
const eigenB = S().addTask({ name: 'B' });
S().addSequence({ predecessorId: eigenA, successorId: eigenB, type: 'FINISH_START', lagDays: 0 });
S().runCPM();
const eigen = writeIFC(buildWriteIFCInput(S()));
S().newProject();
S().applyLoadedProject(readIFC(eigen), { filePath: null, recompute: true });
eq('4e eigen bestand levert geen aanbod', S().recordedDates, null);
```

- [ ] **Step 2: Draai de test en zie hem falen**

```bash
bash tests/planning/run.sh 2>&1 | grep -A 5 "recorded-dates"
```

Verwacht: `XX  recorded-dates: …` met `4a … verwacht waar, kreeg onwaar`.

- [ ] **Step 3: Bouw de detectie in**

In `src/state/slices/fileSlice.ts`, bovenaan bij de imports:

```ts
import { captureRecordedDates, countShiftedTasks } from '@/engine/scheduler/recordedDates';
```

Vervang in `applyLoadedProject` het blok rond de bestaande recompute. De vastlegging moet **binnen** de `set()` gebeuren, ná `hydratePayload`: `s.tasks` deelt de objecten met `parsed.tasks`, dus `runCPM` overschrijft ze in-place.

```ts
      // "Datums zoals opgeslagen" (issue #63): leg VÓÓR de solve vast wat het bestand zei. Dat moet
      // hier, binnen de set(): `s.tasks` deelt zijn objecten met `parsed.tasks`, dus `runCPM`
      // overschrijft de gelezen waarden straks in-place.
      let recorded: ReturnType<typeof captureRecordedDates> | null = null;
      set((s) => {
        // … bestaande body, ongewijzigd, tot en met het hourDataNotice-blok …
        if (opts.recompute) recorded = captureRecordedDates(s.tasks, parsed.recordedFields);
      });
      // Na een IFC-load meteen doorrekenen (CLAUDE.md "after an IFC load"), consistent met de
      // IFCPanel-plakroute — anders blijven statusbalk/histogram leeg tot de gebruiker F5 drukt (A5).
      if (opts.recompute) get().runCPM();
      // …en pas dán vergelijken. Nul verschil ⇒ niets in de state, de gebruiker merkt niets.
      if (recorded && recorded.total > 0) {
        const shifted = countShiftedTasks(get().tasks, recorded.times);
        if (shifted > 0) set((s) => { s.recordedDates = { ...recorded!, shifted }; });
      }
      if (opts.fit) get().requestFitToProject(); // Issue #16: canvas op het HELE project passen.
```

- [ ] **Step 4: Draai de test en zie hem slagen**

```bash
bash tests/planning/run.sh >/dev/null 2>&1; echo "exit=$?"
```

Verwacht: `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add src/state/slices/fileSlice.ts tests/planning/check-recorded-dates.ts
git commit -m "feat(bestanden): detecteer of herberekening de opgeslagen datums verschuift

Gratis: de bestaande recompute na het laden levert de vergelijking. Nul
verschil betekent nul zichtbaar gedrag, dus eigen bestanden vallen vanzelf
buiten de functie."
```

---

## Task 5: De modus betreden

**Files:**
- Modify: `src/state/slices/scheduleSlice.ts`
- Test: `tests/planning/check-recorded-dates.ts`

- [ ] **Step 1: Schrijf de falende test**

Voeg toe aan `check-recorded-dates.ts`, ná blok (4):

```ts
// ── (5) Betreden ─────────────────────────────────────────────────────────────
S().newProject();
S().applyLoadedProject(readIFC(EXTERN), { filePath: null, recompute: true });
const undoVoor = S().undoStack.length;
S().showRecordedDates();

eq('5a modus staat aan', S().datesAsRecorded, true);
eq('5b tweede taak toont de opgeslagen datum', S().tasks[1].time.earlyStart, '2026-03-16');
eq('5c schema niet als verouderd gemarkeerd', S().scheduleStale, false);
eq('5d openen+bekijken maakt niet vies', S().isDirty, false);
truthy('5e cpmResult gereconstrueerd', S().cpmResult !== null);
eq('5f projecteinde uit het bestand', S().cpmResult?.projectEnd, '2026-03-20');
eq('5g driving-relaties blijven leeg', S().cpmResult?.drivingSequenceIds, []);
eq('5h betreden pusht één undo-stap', S().undoStack.length, undoVoor + 1);
eq('5i analyse-velden gewist', S().tasks[1].time.interferingFloat, undefined);
```

- [ ] **Step 2: Draai de test en zie hem falen**

```bash
bash tests/planning/run.sh 2>&1 | grep -A 5 "recorded-dates"
```

Verwacht: `XX` — `showRecordedDates` bestaat niet.

- [ ] **Step 3: Implementeer de actie**

In `src/state/slices/scheduleSlice.ts`, in `interface ScheduleSlice`:

```ts
  /** Zet de app in "datums zoals opgeslagen": herstel wat het bestand vastlegde en reconstrueer
   *  `cpmResult` daaruit, zonder te solven. Pusht een undo-snapshot (contract-invariant: élke
   *  mutator van `datesAsRecorded` doet dat), maar zet bewust géén `isDirty` — de state komt hiermee
   *  dichter bij het bestand te liggen, niet verder. No-op zonder `recordedDates`. */
  showRecordedDates: () => void;
```

En in de creator-body, ná `runCPM`:

```ts
  showRecordedDates: () => {
    set((s) => {
      const info = s.recordedDates;
      if (!info || s.datesAsRecorded) return; // no-op ⇒ géén snapshot (transaction.ts-patroon)
      beginUndoable(s);

      for (const task of s.tasks) {
        const rec = info.times[task.id];
        if (!rec) continue;
        task.time.earlyStart = rec.start;
        task.time.earlyFinish = rec.finish;
        task.time.lateStart = rec.lateStart ?? rec.start;
        task.time.lateFinish = rec.lateFinish ?? rec.finish;
        task.time.totalFloat = rec.totalFloat ?? 0;
        task.time.freeFloat = rec.freeFloat ?? 0;
        task.time.isCritical = rec.isCritical ?? false;
        // De analyse-afleidingen komen uit de zojuist weggegooide solve en zouden een planning
        // beschrijven die niet meer op het scherm staat. `applyCpmResult` hanteert dezelfde regel
        // voor uitgezette opties: afwezig ⇒ het veld wordt gewist.
        task.time.interferingFloat = undefined;
        task.time.isNearCritical = undefined;
        task.time.floatPath = undefined;
      }

      s.cpmResult = cpmResultFromRecorded(info, s.tasks, s.calendar);
      s.resourceLoadResult = computeResourceLoad(
        s.resources, s.assignments, s.tasks, s.calendar, s.calendars,
      );
      s.datesAsRecorded = true;
      // De weergave is consistent met wat er getoond wordt — niet verouderd.
      s.scheduleStale = false;
      // BEWUST GEEN finishMutation: er is niets gewijzigd t.o.v. het bestand.
    });
    get().recomputeViewRows();
  },
```

Met de import erbij:

```ts
import { cpmResultFromRecorded } from '@/engine/scheduler/recordedDates';
```

- [ ] **Step 4: Draai de test en zie hem slagen**

```bash
bash tests/planning/run.sh >/dev/null 2>&1; echo "exit=$?"
```

Verwacht: `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add src/state/slices/scheduleSlice.ts tests/planning/check-recorded-dates.ts
git commit -m "feat(planning): showRecordedDates — toon de datums zoals opgeslagen

Herstelt de vastgelegde waarden, reconstrueert cpmResult zonder solve, en
wist de analyse-afleidingen die bij de weggegooide solve hoorden."
```

---

## Task 6: De modus verlaten

**Waarom:** zonder een gegarandeerde uitgang ontstaat de mengvorm van half-opgeslagen, half-bewerkte datums die het documentcontract expliciet afwijst.

**Files:**
- Modify: `src/state/transaction.ts` (`finishMutation`, regel 171-174)
- Modify: `src/state/slices/scheduleSlice.ts` (`runCPM`)
- Create: `src/hooks/useExitRecordedDates.ts`
- Test: `tests/planning/check-recorded-dates.ts`

- [ ] **Step 1: Schrijf de falende test**

```ts
// ── (6) Verlaten ─────────────────────────────────────────────────────────────
// Route A — bewerken.
S().newProject();
S().applyLoadedProject(readIFC(EXTERN), { filePath: null, recompute: true });
S().showRecordedDates();
S().updateTask(S().tasks[0].id, { name: 'A hernoemd' });
eq('6a bewerken verlaat de modus', S().datesAsRecorded, false);
eq('6b vastlegging opgeruimd', S().recordedDates, null);

// Ctrl+Z brengt modus én datums terug.
S().undo();
eq('6c undo herstelt de modus', S().datesAsRecorded, true);
eq('6d undo herstelt de opgeslagen datum', S().tasks[1].time.earlyStart, '2026-03-16');
truthy('6e undo herstelt de vastlegging', S().recordedDates !== null);

// Route B — F5.
S().newProject();
S().applyLoadedProject(readIFC(EXTERN), { filePath: null, recompute: true });
S().showRecordedDates();
const undoVoorF5 = S().undoStack.length;
S().runCPM();
eq('6f F5 verlaat de modus', S().datesAsRecorded, false);
eq('6g F5 pusht één undo-stap in de modus', S().undoStack.length, undoVoorF5 + 1);
S().undo();
eq('6h undo na F5 herstelt de modus', S().datesAsRecorded, true);
eq('6i undo na F5 herstelt de datum', S().tasks[1].time.earlyStart, '2026-03-16');

// Buiten de modus blijft runCPM snapshot-vrij — de invariant waar staleGuard/batchTool op leunen.
S().newProject();
S().addTask({ name: 'X' });
const undoNormaal = S().undoStack.length;
S().runCPM();
eq('6j runCPM buiten de modus pusht geen snapshot', S().undoStack.length, undoNormaal);
```

- [ ] **Step 2: Draai de test en zie hem falen**

```bash
bash tests/planning/run.sh 2>&1 | grep -A 5 "recorded-dates"
```

Verwacht: `XX` op 6a.

- [ ] **Step 3: Route A — `finishMutation`**

In `src/state/transaction.ts`, vervang `finishMutation`:

```ts
export function finishMutation(s: AppState, opts?: { stale?: boolean }): void {
  s.isDirty = true;
  if (opts?.stale) s.scheduleStale = true;
  // "Datums zoals opgeslagen" (issue #63): élke datum-rakende bewerking verlaat de modus. De
  // snapshot is op dit punt al door `beginUndoable` gepusht MÉT de modus aan, dus Ctrl+Z herstelt
  // modus, datums en cpmResult in één stap. Zonder dit zou een half-opgeslagen/half-bewerkte
  // planning ontstaan zonder dat iets aangeeft welke datum welke is — precies wat het
  // documentcontract afwijst (zie de kop van documentContract.ts over recovery).
  if (opts?.stale && s.datesAsRecorded) {
    s.datesAsRecorded = false;
    s.recordedDates = null;
  }
}
```

- [ ] **Step 4: Route B — de F5-uitgang in `runCPM`**

In `src/state/slices/scheduleSlice.ts`, bovenaan de `set()` van `runCPM`, vóór `s.scheduleStale = false;`:

```ts
      // "Datums zoals opgeslagen" (issue #63): dit is de ENIGE situatie waarin `runCPM` een undo-
      // snapshot pusht. Buiten de modus blijft het gedrag byte-identiek en blijft de invariant
      // intact waar `staleGuard.ts` en `batchTool.ts` op leunen ("runCPM zet géén isDirty en pusht
      // géén undo-snapshot"). Binnen de modus is doorrekenen wél een datawijziging — de opgeslagen
      // datums worden overschreven — en die hoort ongedaan te kunnen.
      if (s.datesAsRecorded) {
        beginUndoable(s);
        s.datesAsRecorded = false;
        s.recordedDates = null;
      }
```

Werk ook de docstrings bij die de invariant benoemen: `src/services/mcp/staleGuard.ts` (regel 6-8) en `src/services/mcp/tools/batchTool.ts` (regel 256) — één zin dat de modus-uitgang de uitzondering is.

- [ ] **Step 5: Herrekenen ná route A**

Maak `src/hooks/useExitRecordedDates.ts`:

```ts
import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';

/**
 * Rekent één keer door zodra "datums zoals opgeslagen" via een BEWERKING is verlaten (issue #63).
 *
 * `finishMutation` zet de modus uit en `scheduleStale` aan, maar rekent zelf niet — dat mag het ook
 * niet, want het draait binnen een Immer-producer. Zonder deze hook zou de gebruiker met "Automatisch
 * berekenen" uit (de default) achterblijven met half-opgeslagen, half-bewerkte datums.
 *
 * Bewust los van `useAutoCalcCPM`: die respecteert de instelling, deze negeert hem juist — het
 * verlaten van de modus moet áltijd doorrekenen, anders bestaat de mengvorm alsnog.
 *
 * De F5-route heeft dit niet nodig: die roept `runCPM` al aan.
 */
export function useExitRecordedDates(): void {
  useEffect(() => {
    let wasInMode = useAppStore.getState().datesAsRecorded;
    return useAppStore.subscribe(() => {
      const s = useAppStore.getState();
      const left = wasInMode && !s.datesAsRecorded;
      wasInMode = s.datesAsRecorded;
      if (left && s.scheduleStale) s.runCPM();
    });
  }, []);
}
```

- [ ] **Step 6: Draai de test en zie hem slagen**

```bash
bash tests/planning/run.sh >/dev/null 2>&1; echo "exit=$?"
```

Verwacht: `exit=0`. De hook draait niet in de headless batterij (geen React); check 6a-6e testen de store-kant, die is compleet zonder hook.

- [ ] **Step 7: Draai óók de MCP-suite**

De F5-uitgang raakt `staleGuard`:

```bash
npm run test:mcp >/dev/null 2>&1; echo "exit=$?"
```

Verwacht: `exit=0`.

- [ ] **Step 8: Commit**

```bash
git add src/state/transaction.ts src/state/slices/scheduleSlice.ts src/hooks/useExitRecordedDates.ts src/services/mcp/staleGuard.ts src/services/mcp/tools/batchTool.ts tests/planning/check-recorded-dates.ts
git commit -m "feat(planning): verlaat datums-zoals-opgeslagen bij bewerken of F5

Bewerken via finishMutation (één regel, alle 26 callsites erven het), F5 via
een snapshot-uitzondering in runCPM die alleen binnen de modus vuurt. Ctrl+Z
herstelt modus, datums en cpmResult in één stap."
```

---

## Task 7: De strook

**Files:**
- Create: `src/components/layout/RecordedDatesNotice.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Schrijf het component**

Maak `src/components/layout/RecordedDatesNotice.tsx`, naar het model van `DependencyModeNotice`:

```tsx
import { useTranslation } from 'react-i18next';
import { X, CalendarClock } from 'lucide-react';
import { useAppStore } from '@/state/appStore';

/**
 * Modus-strook voor "datums zoals opgeslagen" (issue #63), met twee standen:
 *
 *  1. AANBOD — het geopende bestand legde datums vast die de herberekening verschoof. Wegklikbaar:
 *     wie niets wil, werkt normaal verder.
 *  2. ACTIEF — de app toont de opgeslagen datums. GÉÉN kruisje: een modus mag niet wegklikbaar zijn
 *     zonder hem te verlaten, dezelfde regel als `DependencyModeNotice`.
 *
 * Bewust een blijvende strook en geen toast: een `info`-toast verdwijnt na 5 s, en een aanbod dat
 * verdwijnt terwijl iemand naar een net geopend plan van 300 taken kijkt, is een aanbod dat niemand
 * ziet. Een modus die onzichtbaar wordt terwijl hij aan staat is bovendien precies de val waarin een
 * planning er correct uitziet en het niet is.
 */
export function RecordedDatesNotice() {
  const { t } = useTranslation('common');
  const info = useAppStore((s) => s.recordedDates);
  const active = useAppStore((s) => s.datesAsRecorded);
  const showRecordedDates = useAppStore((s) => s.showRecordedDates);
  const runCPM = useAppStore((s) => s.runCPM);
  const dismiss = useAppStore((s) => s.dismissRecordedDates);

  if (!info && !active) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-xs border-b border-border"
      style={{ background: 'var(--theme-accent-soft, rgba(217,119,6,0.12))', color: 'var(--theme-text)' }}
      role="status"
      data-ops-recorded-dates-notice
      data-ops-recorded-dates-active={active ? 'true' : 'false'}
    >
      <CalendarClock size={14} className="shrink-0 text-accent" />
      <span className="flex-1">
        {active
          ? t('recordedDates.active')
          : t('recordedDates.offer', { count: info!.shifted, total: info!.total })}
      </span>
      {active ? (
        <button onClick={runCPM} className="btn btn--sm btn--primary" data-ops-recorded-dates-recalc>
          {t('recordedDates.recalculate')}
        </button>
      ) : (
        <>
          <button onClick={showRecordedDates} className="btn btn--sm btn--primary" data-ops-recorded-dates-show>
            {t('recordedDates.show')}
          </button>
          <button
            onClick={dismiss}
            className="p-1 hover:bg-surface-hover rounded-[8px] text-text-secondary"
            title={t('close')}
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Voeg `dismissRecordedDates` toe**

In `src/state/slices/scheduleSlice.ts`, interface:

```ts
  /** Aanbod afslaan: de strook verdwijnt en de gebruiker werkt normaal verder met de herberekende
   *  planning. Géén undo-snapshot — er verandert niets aan de projectdata. */
  dismissRecordedDates: () => void;
```

Body:

```ts
  dismissRecordedDates: () => {
    set((s) => { s.recordedDates = null; });
  },
```

- [ ] **Step 3: Monteer strook en hook in `App.tsx`**

Bij de imports:

```tsx
import { RecordedDatesNotice } from '@/components/layout/RecordedDatesNotice';
import { useExitRecordedDates } from '@/hooks/useExitRecordedDates';
```

Bij de andere hook-aanroepen (naast `useAutoCalcCPM()`, rond regel 129-130):

```tsx
  useExitRecordedDates();
```

En direct ná `<DependencyModeNotice />` (rond regel 229):

```tsx
      {/* "Datums zoals opgeslagen"-strook (issue #63): biedt de opgeslagen datums aan wanneer de
          herberekening ze verschoof, en blijft daarna zichtbaar zolang de modus aan staat. Staat
          hier, boven de Backstage-vertakking, dus zichtbaar in élke weergave. */}
      <RecordedDatesNotice />
```

- [ ] **Step 4: Typecheck en lint**

```bash
npm run typecheck && npm run lint
```

Verwacht: exit 0 op beide.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/RecordedDatesNotice.tsx src/state/slices/scheduleSlice.ts src/App.tsx
git commit -m "feat(ui): blijvende strook voor datums zoals opgeslagen

Twee standen uit dezelfde state: het aanbod (wegklikbaar) en de actieve modus
(niet wegklikbaar zonder hem te verlaten). Boven de Backstage-vertakking
gemonteerd, dus zichtbaar in elke weergave."
```

---

## Task 8: i18n voor veertien locales

**Files:**
- Modify: `src/i18n/locales/*/common.json` (14 stuks)

- [ ] **Step 1: Voeg de sleutels toe aan `nl`**

In `src/i18n/locales/nl/common.json`:

```json
  "recordedDates": {
    "offer_one": "Herberekening verschoof {{count}} van de {{total}} taken ten opzichte van de datums in het bestand.",
    "offer_other": "Herberekening verschoof {{count}} van de {{total}} taken ten opzichte van de datums in het bestand.",
    "show": "Opgeslagen datums tonen",
    "active": "Je ziet de datums zoals ze in het bestand staan. Er is niet herberekend.",
    "recalculate": "Herberekenen"
  },
```

- [ ] **Step 2: Voeg ze toe aan `en`**

```json
  "recordedDates": {
    "offer_one": "Recalculation moved {{count}} of the {{total}} tasks compared to the dates in the file.",
    "offer_other": "Recalculation moved {{count}} of the {{total}} tasks compared to the dates in the file.",
    "show": "Show recorded dates",
    "active": "You are seeing the dates as recorded in the file. No recalculation has been done.",
    "recalculate": "Recalculate"
  },
```

- [ ] **Step 3: Laat de poort de rest opsommen**

```bash
npm run verify:i18n
```

De gate rekent met **CLDR-pluralcategorieën** en noemt per locale exact welke sleutel ontbreekt. Verwacht bijvoorbeeld: `zh`/`ja`/`ko` hebben géén `offer_one` nodig (alleen `offer_other`), `pl` heeft `offer_few` en `offer_many` nodig, `es`/`fr`/`it`/`pt` hebben `offer_many` nodig, en `ar` heeft `offer_zero`/`offer_two`/`offer_few`/`offer_many`. Vertaal precies wat de gate opsomt — niet meer, niet minder.

Voor `es`/`fr`/`it`/`pt` is `_many` (alleen 1.000.000, 2.000.000, …) in dit project gelijk aan `_other`, omdat `{{count}}` altijd in cijfers wordt weergegeven.

- [ ] **Step 4: Herhaal tot de gate groen is**

```bash
npm run verify:i18n >/dev/null 2>&1; echo "exit=$?"
```

Verwacht: `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales
git commit -m "i18n(recorded-dates): strookteksten in alle veertien locales"
```

---

## Task 9: Gids

**Files:**
- Create: `public/docs/nl/datums-zoals-opgeslagen.md`
- Create: `public/docs/en/datums-zoals-opgeslagen.md`
- Modify: `public/docs/manifest.json`

- [ ] **Step 1: Schrijf het Nederlandse artikel**

`public/docs/nl/datums-zoals-opgeslagen.md`. Houd je aan de **beperkte** Markdown-subset van `miniMarkdown.tsx`: koppen `#`/`##`/`###`, paragrafen, enkelvoudige lijsten, `**vet**`/`*cursief*`/`` `code` ``, codeblokken, afbeeldingen, en uitsluitend `docs://`- en `examples://`-links. Geen tabellen, geen blockquotes, geen h4, geen rauwe HTML.

```markdown
# Datums zoals opgeslagen

Wanneer je een planning opent die uit een ander programma komt — bijvoorbeeld uit Primavera P6, via IFC — staan daar twee dingen in: de taken met hun datums, en de logica die zegt welke taak op welke volgt.

Open Planner Studio rekent die planning bij het openen door. Dat is normaal gedrag en meestal precies wat je wilt. Maar geëxporteerde bestanden hebben vaak onvolledige logica: er ontbreken verbanden. De app rekent dan met wat hij heeft en komt op andere datums uit dan er in het bestand stonden.

## Wat je ziet

Wijken de berekende datums af van de opgeslagen datums, dan verschijnt er een balk boven je planning die vertelt hoeveel taken er verschoven zijn, met de knop **Opgeslagen datums tonen**.

Klik je daarop, dan zet de app de datums terug zoals ze in het bestand staan. De balk blijft daarna staan zolang je die weergave gebruikt, zodat je nooit per ongeluk denkt dat je naar een doorgerekende planning kijkt.

Komen de datums wél overeen, dan zie je niets. Dat is de normale situatie bij bestanden die je zelf in Open Planner Studio hebt opgeslagen.

## Wat er niet wordt getoond

In deze weergave laat de app alleen zien wat het bestand daadwerkelijk vastlegt. Sommige informatie wordt normaal berekend en staat niet in het bestand:

- welke relaties bepalend zijn voor de planning
- overschreden randvoorwaarden
- taken die uit hun logische volgorde lopen

Die blijven leeg. Ze verschijnen zodra je herberekent.

## Terug naar normaal

De weergave verdwijnt zodra je iets bewerkt of op F5 drukt. De app rekent dan weer gewoon door. Met Ctrl+Z kom je terug bij de opgeslagen datums.

Ben je eenmaal verder gewerkt, dan is de enige manier om de opgeslagen datums terug te zien het bestand opnieuw openen.

## Opslaan

Sla je op terwijl je de opgeslagen datums bekijkt, dan komen die datums ook in het bestand terecht. Zo overschrijf je nooit per ongeluk de planning van iemand anders met een herberekende versie.
```

- [ ] **Step 2: Schrijf het Engelse artikel**

`public/docs/en/datums-zoals-opgeslagen.md` — dezelfde structuur en dezelfde kopregels, in het Engels. Titel: `# Dates as recorded`.

- [ ] **Step 3: Voeg de manifest-entry toe**

In `public/docs/manifest.json`, in de laag `gidsen`, met titels in de talen die je hebt (minimaal `nl` en `en` — die twee eist de gate hard):

```json
    {
      "id": "datums-zoals-opgeslagen",
      "title": {
        "nl": "Datums zoals opgeslagen",
        "en": "Dates as recorded"
      },
      "layer": "gidsen"
    }
```

Let op: het veld heet `title` (enkelvoud) en de entry hoort in de `articles`-array. De twaalf overige talen mogen ontbreken — `verify:docs` eist alleen `nl` en `en` hard.

- [ ] **Step 4: Draai de docs-poort**

```bash
npm run verify:docs >/dev/null 2>&1; echo "exit=$?"
```

Verwacht: `exit=0`. Faalt hij op de parser-subset, dan staat er markdown in die `miniMarkdown` niet kent — meestal een tabel of een blockquote.

- [ ] **Step 5: Commit**

```bash
git add public/docs
git commit -m "docs(gids): datums zoals opgeslagen (nl + en)"
```

---

## Task 10: Poort en handmatige verificatie

- [ ] **Step 1: Draai de volledige poort**

```bash
npm run verify >/dev/null 2>&1; echo "exit=$?"
```

Verwacht: `exit=0`. **Vertrouw op de exitcode, nooit op de tail** — de suite print "alles groen" ook bij exit 1 wanneer het bundelen faalt.

Faalt er iets, draai dan de deelpoort om te zien wát:

```bash
npm run typecheck; npm run lint; npm run test:planning; npm run test:mcp; npm run verify:i18n; npm run verify:docs; npm run verify:cycles
```

- [ ] **Step 2: Start de dev-server**

```bash
npm run dev
```

Lees de **toegewezen poort** uit de uitvoer — die verschilt per worktree, neem geen 3007 aan.

- [ ] **Step 3: Verifieer met een extern bestand**

Bouw een IFC met vastgelegde datums die niet uit de logica volgen (dezelfde vorm als de `EXTERN`-fixture uit Task 4), open die in de browserbuild, en controleer:

1. De strook verschijnt met het juiste aantal.
2. **Opgeslagen datums tonen** verschuift de balken zichtbaar naar de datums uit het bestand.
3. De strook blijft staan, óók na een wissel naar de tabelweergave, het rapport en Backstage.
4. De statusbalk toont projecteinde en duur; kritieke-pad-telling alleen wanneer het bestand `IsCritical` gaf.
5. Een taak hernoemen verlaat de modus en de balken springen terug.
6. Ctrl+Z brengt modus én balken terug.
7. F5 in de modus verlaat hem; Ctrl+Z brengt hem terug.

- [ ] **Step 4: Verifieer dat eigen bestanden niets tonen**

Open een van de gebundelde voorbeelden via Backstage → Voorbeelden. Verwacht: **geen** strook.

- [ ] **Step 5: Werk CLAUDE.md bij**

De architectuurparagraaf over scheduling zegt dat `runCPM` na een IFC-load draait. Dat blijft waar; voeg één zin toe dat de uitkomst sinds issue #63 bewust kan worden teruggedraaid naar de opgeslagen datums, en dat `runCPM` daarom in díé ene situatie wél een undo-snapshot pusht.

`docs/TODO.md` hoeft niet — dit stond er niet in.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: datums zoals opgeslagen in de architectuurbeschrijving"
```

---

## Zelfreview van dit plan

**Spec-dekking.** §0 → Task 1. §1 (tweelagenkeuze) → Task 2 stap 4 (`captureRecordedDates`) + test 1a-1i. §2 (detectie) → Task 4. §3 (contractvelden) → Task 3. §4 (reconstructie) → Task 2 + tests 3a-3j. §5 (strook) → Task 7. §6 (betreden) → Task 5. §7 (verlaten, drie routes) → Task 6; route C (documentwissel) vergt geen code — de velden zitten in het contract en worden door Task 3 stap 5 (blok a2) getest. "Enige aanvaarde beperking" → geen code. Tests-tabel → verspreid over Task 1-6. Docs & i18n → Task 8-9.

**Twee spec-punten die bewust géén taak kregen:** het herstellen van `OPS_Analysis` (uitdrukkelijk niet-doel) en de crashherstel-afbakening (bestaand gedrag; `restoreDocuments` draait `runCPM`, wat de modus via de Task 6-uitgang uitzet — geen wijziging nodig).

**Typeconsistentie.** `RecordedTime`/`RecordedDatesInfo` gedefinieerd in Task 2, gebruikt in Task 3 (contract), 4 (detectie), 5 (betreden). `captureRecordedDates(tasks, recordedFields)` en `countShiftedTasks(tasks, times)` — signatures identiek in Task 2 en Task 4. `recordedFields: Record<string, string[]>` — identiek in Task 1 stap 2 en Task 2 stap 4. Storeveldnamen `recordedDates`/`datesAsRecorded` — identiek in Task 3, 4, 5, 6, 7.

**Nagelopen tijdens de zelfreview, dus geen aannames meer:** de `CalendarEngine`-constructor neemt één kalender (niet twee), en de manifest-entry gebruikt `title` (enkelvoud) binnen de `articles`-array. Beide zijn hierboven al gecorrigeerd.
