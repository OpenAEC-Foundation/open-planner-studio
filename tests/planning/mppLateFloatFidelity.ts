// Late-datum- en spelingsmeting tegen MS Projects EIGEN opgeslagen waarden (meetopdracht
// 2026-09-11) — de zuster van `mppFidelity.ts`, voor de vier assen die de bestaande meetlat NIET
// meet: late start, late finish, totale speling en vrije speling.
//
// ALLEEN METEN, GEEN POORT. Deze module wordt uitsluitend door `report-mpp-late-float.ts`
// aangeroepen (rapportmodus, niet in `run.sh`), pint niets in `mpp-fidelity-baseline.json` en
// raakt de `GOAL_ZERO_DEVIATIONS`-poort in `check-mpp-fidelity.ts` niet. Wat gemeten wordt is
// een FEIT over de huidige motor, geen eis — de rapportage in
// `docs/planning-test-bevindingen-mpp-late-float.md` beschrijft de uitkomst en de klassen.
//
// DEZELFDE KETEN ALS DE BESTAANDE MEETLAT. De "onze"-kant komt uit `solveMppBytes`
// (`mppFidelity.ts`: `readMPP` + `solveProject`, exact wat `scheduleSlice.runCPM` draait); de
// "MSP"-kant uit `scanGroundTruthTasks` (`mppGroundTruth.ts`, de onafhankelijke TBkndTask-lus),
// die sinds deze meting óók `LATE_START`/`LATE_FINISH` (veld 39/40) en de drie opgeslagen
// spelingen `START_SLACK`/`FINISH_SLACK`/`FREE_SLACK` (438/439/21) leest — zie de constanten-
// toelichting daar voor de MPXJ-regelnummers en de eenheid.
//
// EENHEDEN — hoe de twee kanten op één as komen (dezelfde afspraak als de XER-etappe: "onze float
// in minuten === round(bron-float × 60)", via de taak-effectieve kalender):
//   • MSP: de ruwe int is tienden van een minuut (`MPPUtility.getDuration` r. 504) ⇒
//     `mspMinutes = round(raw / 10)`. Bij een niet-elapsed eenheid zijn dat WERKminuten (MPXJ's
//     `getAdjustedDuration` deelt voor DAYS door `minutesPerDay × 10`, dus raw/10 = dagen ×
//     minutesPerDay); bij een elapsed eenheid kalenderminuten — zulke taken dragen de vlag
//     `elapsedEenheid` in de diagnose.
//   • Wij: `Task.time.totalFloat`/`freeFloat` zijn WERKDAGEN (fractioneel in uur-modus).
//     `CPMSolver.signedFloat` (r. ~900) rekent in uur-modus `workMinutesBetween / (hoursPerDay × 60)`
//     op de taak-effectieve `CalendarEngine`; de inverse is dus `round(float × hoursPerDay × 60)`
//     met exact diezelfde engine — `effectiveEngineFor` hieronder spiegelt `CPMSolver.calendarFor`
//     (`resolveCalendar` + `calendarWithEffectiveWorkTime` bij uur-taken) i.p.v. een eigen
//     hoursPerDay te raden. In dag-modus is `float` een geheel aantal werkdagen; dezelfde formule
//     geeft dan `dagen × hoursPerDay × 60`.
//   • Totale speling: MSP slaat GEEN `TOTAL_SLACK` op in MPP14 (veld-id 22 komt in geen enkele
//     data-gedreven veldkaart van het zichtbare corpus voor — `totalSlackFieldPresent` rapporteert
//     dat mee). MPXJ berekent 'm (`cpm/MicrosoftSlackCalculator.java`, `calculateTotalSlack`):
//     `actualStart ≠ null ⇒ finishSlack`, anders `min(startSlack, finishSlack)` (bij de
//     standaardinstelling SMALLEST_SLACK — MPXJ leest die instelling NIET uit een MPP-bestand,
//     `ProjectPropertiesReader.java` kent alleen `CRITICAL_SLACK_LIMIT`). Deze module past
//     dezelfde regel toe; de as "totale speling" is dus een AFGELEIDE grondwaarheid uit twee
//     opgeslagen velden, geen letterlijk opgeslagen getal — het rapport benoemt dat expliciet.
//   • Late datums: letterlijk opgeslagen (veld 39/40), vergeleken met `classify` uit
//     `mppFidelity.ts` (exact / zelfde dag / andere dag).
//
// BEKENDE BEPERKINGEN VAN DE MEETKERN (reviewbevindingen Opus, 2026-09-11):
//   • Geen terugval-offsets: `DEFAULT_TASK_FIELDS` (`fieldMap14.ts`) kent voor veld 39/40/21/438/
//     439/22 GEEN default en `buildFieldMap` vervangt defaults door de data-gedreven kaart. Een
//     bestand zónder `TASK_FIELD_MAP` telt dus `missing` op alle vier de assen (zichtbaar in de
//     `ontbrekend`-kolom; corpusbreed 0).
//   • Elapsed-omrekening op de vrije-speling-as: onze `freeFloat` is alleen kalenderdag-getekend
//     voor een ELAPSEDTIME-taak ZONDER opvolgers (`signedFloat` → `signedElapsedSpan`); mét
//     opvolgers komt hij uit `sequenceFreeFloat` (`scheduleAnalysis.ts`), dat niet durationType-
//     bewust is (werkminuten). Zo'n taak zou hier stil ~factor 3 als `diff` tellen. In het
//     zichtbare corpus: 0 elapsed-taken met opvolger — gemeten, geen garantie.
//   • Samenvattingstaken: onze tf/ff is `min()` over kinderen die in eenheid en kalender kunnen
//     verschillen, en wordt hier met de hoursPerDay van de samenvatting zelf teruggerekend.
//   • Deze module staat bewust buiten `run.sh`; verandert de semantiek van `signedFloat`/
//     `sequenceFreeFloat`, dan meet dit rapport stil anders — het is een meetinstrument, geen poort.
//
// POPULATIES (disjunct, in deze prioriteit): `manual` (TASK_MODE-bit uit de grondwaarheid),
// `completed` (onze `completion ≥ 1` of `actualFinish`), `summary` (kinderen), `other`. Voltooide
// en handmatig geplande taken worden apart geteld omdat ons gedrag daar bewust afwijkt
// (`scheduleAnalysis.ts`: manual ⇒ tf=ff=0 — plan-veeglijst Z9b "per constructie kritiek").
import { solveMppBytes, classify, type SolvedMpp } from './mppFidelity';
import { scanGroundTruthTasks, type RawTask } from './mppGroundTruth';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { calendarWithEffectiveWorkTime } from '@/utils/effectiveWorkTime';
import { parseInstant } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

export const AXES = ['lateStart', 'lateFinish', 'totalFloat', 'freeFloat'] as const;
export type Axis = (typeof AXES)[number];
export const POPULATIONS = ['manual', 'completed', 'summary', 'other'] as const;
export type Population = (typeof POPULATIONS)[number];
/** `boundary` (alleen datum-assen) = twee verschillende instanten met NUL werkminuten ertussen op
 *  de taak-effectieve kalender — de werktijdgrens-vorm. Reviewbevinding (Opus, 2026-09-11): MS
 *  Project slaat de late finish van een FS-voorganger op als het BEGIN van de volgende werkdag
 *  (`task-links-project2010-mpp14.mpp` #9: veld 40 = 2014-10-20T08:00), terwijl onze motor én MS
 *  Projects eigen MSPDI-export van hetzelfde project (`…-mspdi.xml`, UID 9: LateFinish
 *  2014-10-17T17:00) het einde van de vorige werkdag geven. Dat is een representatieverschil, geen
 *  planningsverschil — een eigen bucket, bewust geen `exact` (de instant verschilt wél) en geen
 *  `diff` (de planning niet). `sameday` = zelfde dag, ander tijdstip; voor de spelingsassen is de
 *  analoge bucket `subday` = verschil kleiner dan één werkdag van de taak-effectieve kalender. */
export type AxisClass = 'exact' | 'boundary' | 'sameday' | 'subday' | 'diff' | 'missing';

/** Diagnoseklassen — niet-exclusieve vlaggen per taak. De zes uit de opdracht (manual,
 *  levelingDelay, voltooid, constraint, deadline, kalender) plus drie die de meting nodig had om
 *  de rest te kunnen benoemen: `inUitvoering` (actualStart/voortgang < 100%: MPXJ's totale-
 *  spelingsregel wisselt daar van formule), `samenvatting` (onze rollup vs MSP's eigen
 *  samenvattingswaarden), `elapsedEenheid` (MSP-speling in kalenderminuten), `timephased`
 *  (`Task.timephasedFinishFloor`/`timephasedDurationWalks`: de finish volgt de resource-inzet, niet
 *  start+duur — de late zijde kan dan een andere duur terugrekenen) en `split` (`Task.splitGaps`).
 *  `geen` als geen enkele vlag past — de onverklaarde restgroep. */
export const DIAG_FLAGS = [
  'manual', 'levelingDelay', 'voltooid', 'inUitvoering', 'constraint', 'deadline', 'kalender',
  'samenvatting', 'elapsedEenheid', 'timephased', 'split', 'geen',
] as const;
export type DiagFlag = (typeof DIAG_FLAGS)[number];

export interface AxisCell {
  /** Onze waarde (ISO-instant voor datums, minuten voor spelingen), of `null` als afwezig. */
  ours: string | number | null;
  /** MSP-waarde in dezelfde vorm, of `null` als het bestand het veld niet draagt. */
  msp: string | number | null;
  cls: AxisClass;
  /** Alleen spelingsassen: `ours − msp` in minuten (bij twee aanwezige waarden). */
  deltaMinutes?: number;
}

export interface LateFloatTaskRow {
  /** MS Projects eigen taak-ID (kolomvolgorde) — géén naam: de rapportage mag corpusinhoud niet
   *  lekken (zelfde regel als `check-mpp-fidelity.ts`'s `tagFor`). */
  mspId: number;
  population: Population;
  flags: DiagFlag[];
  /** Eenheid van de drie opgeslagen MSP-spelingen (ACTUAL_DURATION_UNITS, id 181). */
  slackUnit: string;
  /** Welke MicrosoftSlackCalculator-tak de MSP-totale speling opleverde. */
  totalRule: 'finishSlack(actualStart)' | 'min(start,finish)' | 'n/a';
  /** hoursPerDay van de taak-effectieve engine — de omrekenfactor van onze werkdagen. */
  hoursPerDay: number;
  /** Onze vroege datums (context voor de detailregel; start/finish zelf meet `check-mpp-fidelity`). */
  earlyStart: string;
  earlyFinish: string;
  cells: Record<Axis, AxisCell>;
}

export type AxisCounts = Record<AxisClass, number>;
export type CountMatrix = Record<Axis, Record<Population, AxisCounts>>;

export interface LateFloatFileRow {
  status: 'ok' | 'rejected' | 'error';
  errCode?: string;
  errMsg?: string;
  tasks: number;
  /** Taken waarvan de veldkaart veld-id 22 (TOTAL_SLACK) in blok 0 droeg — verwacht 0. */
  totalSlackStoredTasks: number;
  counts: CountMatrix;
  rows: LateFloatTaskRow[];
}

export function emptyCounts(): AxisCounts {
  return { exact: 0, boundary: 0, sameday: 0, subday: 0, diff: 0, missing: 0 };
}
export function emptyMatrix(): CountMatrix {
  const m = {} as CountMatrix;
  for (const a of AXES) {
    m[a] = {} as Record<Population, AxisCounts>;
    for (const p of POPULATIONS) m[a][p] = emptyCounts();
  }
  return m;
}
export function addMatrix(into: CountMatrix, from: CountMatrix): void {
  for (const a of AXES) for (const p of POPULATIONS) for (const c of Object.keys(from[a][p]) as AxisClass[]) into[a][p][c] += from[a][p][c];
}

const iso = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 16) : null);

function failRow(status: 'rejected' | 'error', errMsg: string, errCode?: string): LateFloatFileRow {
  return { status, ...(errCode ? { errCode } : {}), errMsg, tasks: 0, totalSlackStoredTasks: 0, counts: emptyMatrix(), rows: [] };
}

/** Spiegelt `CPMSolver.calendarFor`/`engineForCal` (CPMSolver.ts r. ~327–344): de engine waarin de
 *  solver de float van déze taak uitdrukte. Geen cache nodig — de meting is eenmalig per bestand. */
function effectiveEngineFor(task: Task, registry: WorkCalendar[], projectCal: WorkCalendar): CalendarEngine {
  const cal = resolveCalendar(task.calendarId, registry, projectCal);
  const hourBands = taskDurationUnit(task) === 'hours';
  const engineCalendar = hourBands ? calendarWithEffectiveWorkTime(cal) : cal;
  return new CalendarEngine(engineCalendar ?? cal);
}

/** MSP-totale speling volgens `MicrosoftSlackCalculator.calculateTotalSlack` (SMALLEST_SLACK).
 *  Bewuste afwijking van de Java-bron (reviewbevinding): de tak `duration == null ⇒ null` (r. ~159)
 *  ontbreekt hier — de grondwaarheid leest de duur niet als nullable; in MPP14 heeft elke taak een
 *  SCHEDULED_DURATION-veld (corpusbreed 0 verschillen t.o.v. MPXJ's `getTotalSlack`). */
export function deriveMspTotalSlackRaw(raw: RawTask): { value: number | null; rule: LateFloatTaskRow['totalRule'] } {
  if (raw.actualStart) return { value: raw.finishSlackRaw, rule: 'finishSlack(actualStart)' };
  if (raw.startSlackRaw === null || raw.finishSlackRaw === null) return { value: null, rule: 'n/a' };
  return { value: Math.min(raw.startSlackRaw, raw.finishSlackRaw), rule: 'min(start,finish)' };
}

/** Bij een ELAPSED-eenheid staat MSP's speling in kalenderminuten (24 u/dag) terwijl onze
 *  `signedElapsedSpan` (duration.ts) kalenderdagen levert die `floatCell` hieronder — net als bij
 *  elke andere taak — met `hoursPerDay × 60` naar de werkminuut-as brengt. Zet MSP's kalender-
 *  minuten daarom op diezelfde as: `raw/10 × (hoursPerDay × 60) / 1440`. Corpusmeting (2026-09-11,
 *  `mpp14duration.mpp` #6–#9): zonder deze omrekening 4 schijnafwijkingen (14400 vs 43199 =
 *  dezelfde 30 dagen), mét: exact. */
function mspSlackMinutes(mspRaw: number | null, elapsed: boolean, hoursPerDay: number): number | null {
  if (mspRaw === null) return null;
  const minutes = mspRaw / 10;
  return Math.round(elapsed ? (minutes * hoursPerDay * 60) / 1440 : minutes);
}

function floatCell(oursDays: number | undefined, mspRaw: number | null, hoursPerDay: number, elapsed: boolean): AxisCell {
  // Reviewbevinding (Opus, 2026-09-11): een taakkalender zonder banden geeft `hoursPerDay` 0 ⇒ beide
  // kanten 0 ⇒ spookexactheid. Komt in het zichtbare corpus niet voor; expliciet `missing`.
  if (!(hoursPerDay > 0)) return { ours: null, msp: null, cls: 'missing' };
  const msp = mspSlackMinutes(mspRaw, elapsed, hoursPerDay);
  const ours = oursDays === undefined || !Number.isFinite(oursDays) ? null : Math.round(oursDays * hoursPerDay * 60);
  if (ours === null || msp === null) return { ours, msp, cls: 'missing' };
  const delta = ours - msp;
  const cls: AxisClass = delta === 0 ? 'exact' : Math.abs(delta) < hoursPerDay * 60 ? 'subday' : 'diff';
  return { ours, msp, cls, deltaMinutes: delta };
}

function dateCell(ours: string | undefined, msp: Date | null, eng: CalendarEngine): AxisCell {
  const truth = iso(msp);
  let cls: AxisClass = classify(ours, truth);
  if ((cls === 'sameday' || cls === 'diff') && ours && msp) {
    // Grensvorm (zie `AxisClass`): nul werkminuten tussen de twee instanten, in beide richtingen.
    const a = parseInstant(ours);
    const lo = a < msp ? a : msp;
    const hi = a < msp ? msp : a;
    if (eng.workMinutesBetween(lo, hi) === 0) cls = 'boundary';
  }
  return { ours: ours ?? null, msp: truth, cls };
}

function populationOf(task: Task, raw: RawTask): Population {
  if (raw.isManual) return 'manual';
  if ((task.time.completion ?? 0) >= 1 || task.time.actualFinish) return 'completed';
  if (task.childIds.length > 0) return 'summary';
  return 'other';
}

function flagsOf(task: Task, raw: RawTask, projectCalendarId: string): DiagFlag[] {
  const f: DiagFlag[] = [];
  if (raw.isManual) f.push('manual');
  if ((task.levelingDelayMinutes ?? 0) !== 0 || (task.levelingDelay ?? 0) !== 0) f.push('levelingDelay');
  const completed = (task.time.completion ?? 0) >= 1 || !!task.time.actualFinish;
  if (completed) f.push('voltooid');
  else if (task.time.actualStart || (task.time.completion ?? 0) > 0) f.push('inUitvoering');
  if (task.constraint && task.constraint.type !== 'ASAP') f.push('constraint');
  if (task.deadline) f.push('deadline');
  if (task.calendarId && task.calendarId !== projectCalendarId) f.push('kalender');
  if (task.childIds.length > 0) f.push('samenvatting');
  if (raw.durUnit.startsWith('elapsed')) f.push('elapsedEenheid');
  if (task.timephasedFinishFloor !== undefined || (task.timephasedDurationWalks?.length ?? 0) > 0) f.push('timephased');
  if ((task.splitGaps?.length ?? 0) > 0) f.push('split');
  if (f.length === 0) f.push('geen');
  return f;
}

/**
 * De meting: `readMPP` + `solveProject` (via `solveMppBytes`) tegen de grondwaarheid, vier assen.
 * Status-/uitlijningsconventies identiek aan `measureFidelity` (`mppFidelity.ts`): `mppCode` ⇒
 * 'rejected' (overgeslagen), andere throw ⇒ 'error'; lengte- én naamuitlijning op MSP-ID
 * (foutmelding zonder taaknamen — alleen positie/id/naamlengte, reviewbevinding H2 aldaar).
 */
export function measureLateFloat(bytes: Uint8Array): LateFloatFileRow {
  let solved: SolvedMpp;
  try {
    solved = solveMppBytes(bytes);
  } catch (e: unknown) {
    const err = e as { mppCode?: string; message?: unknown };
    if (err && typeof err.mppCode === 'string') return failRow('rejected', String(err.message ?? e).slice(0, 200), err.mppCode);
    return failRow('error', String((e as Error)?.message ?? e).slice(0, 300));
  }
  if (solved.cpmError) return failRow('error', `CPM-fout: ${solved.cpmError}`);

  let raws: RawTask[];
  try {
    ({ raws } = scanGroundTruthTasks(bytes));
  } catch (e: unknown) {
    return failRow('error', `scanGroundTruthTasks: ${String((e as Error)?.message ?? e)}`);
  }
  const { tasks, calendars, projectCalendar } = solved;
  if (raws.length !== tasks.length) {
    return failRow('error', `grondwaarheid-uitlijning mislukt: ${raws.length} raw vs ${tasks.length} taken`);
  }
  for (let i = 0; i < raws.length; i++) {
    if (raws[i].name !== tasks[i].name) {
      return failRow('error', `grondwaarheid-uitlijning mislukt op positie ${i}: raw naamlengte ${raws[i].name.length} (MSP-id ${raws[i].id}) ≠ readMPP-naamlengte ${tasks[i].name.length}`);
    }
  }

  const counts = emptyMatrix();
  const rows: LateFloatTaskRow[] = [];
  let totalSlackStoredTasks = 0;
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const raw = raws[i];
    if (raw.totalSlackFieldPresent) totalSlackStoredTasks++;
    const eng = effectiveEngineFor(task, calendars, projectCalendar);
    const hoursPerDay = eng.hoursPerDay;
    const total = deriveMspTotalSlackRaw(raw);
    const elapsed = raw.durUnit.startsWith('elapsed');
    const cells: Record<Axis, AxisCell> = {
      lateStart: dateCell(task.time.lateStart, raw.lateStart, eng),
      lateFinish: dateCell(task.time.lateFinish, raw.lateFinish, eng),
      totalFloat: floatCell(task.time.totalFloat, total.value, hoursPerDay, elapsed),
      freeFloat: floatCell(task.time.freeFloat, raw.freeSlackRaw, hoursPerDay, elapsed),
    };
    const population = populationOf(task, raw);
    for (const a of AXES) counts[a][population][cells[a].cls]++;
    rows.push({
      mspId: raw.id,
      population,
      flags: flagsOf(task, raw, projectCalendar.id),
      slackUnit: raw.durUnit,
      totalRule: total.rule,
      hoursPerDay,
      earlyStart: task.time.earlyStart,
      earlyFinish: task.time.earlyFinish,
      cells,
    });
  }
  return { status: 'ok', tasks: tasks.length, totalSlackStoredTasks, counts, rows };
}
