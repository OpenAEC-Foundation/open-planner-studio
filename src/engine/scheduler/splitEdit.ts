// splitEdit.ts — het ENE bewerkmodel voor gebruikerssplits (issue #146). Gantt, eigenschappenpaneel
// en MCP rekenen nooit zelf op `afterMinutes`/`gapMinutes`: de H1-as (elk gat telt mee in de
// aspositie van het volgende, zie `splitWalk.ts`) wordt hier één keer vertaald naar STUKKEN — een
// afwisselende lijst werk/pauze/werk in werkminuten — en weer terug. Puur: geen store, geen kalender.
//
// NIET-WÉLGEVORMDE lijsten (overlap, gat voorbij het werktotaal, ongesorteerd, niet-eindig) kan dit
// model niet dragen zonder data te vernietigen; `toSplitPieces` geeft dan `null` en de aanroeper
// behandelt de taak als alleen-lezen. Er wordt NOOIT stil genormaliseerd.
import type { Task, TaskSplitGap } from '@/types/task';
import { formatDate, formatInstant, parseDate, parseInstant } from '@/utils/dateUtils';
import {
  durationMinutesOf, splitTotalSpanDays, splitTotalSpanMinutes, taskDurationUnit,
  type DurationCalendar,
} from './duration';
import type { CalendarEngine } from './CalendarEngine';

export type SplitPiece =
  | { kind: 'work'; minutes: number }
  | { kind: 'gap'; minutes: number; source?: 'leveling' | 'user' };

const EPS = 1e-6;

export function isWellFormedSplit(gaps: readonly TaskSplitGap[] | undefined, totalWorkMinutes: number): boolean {
  if (!gaps || gaps.length === 0) return true;
  if (!(totalWorkMinutes > 0)) return false;
  let axis = 0;
  let work = 0;
  for (const g of gaps) {
    if (!Number.isFinite(g.afterMinutes) || !Number.isFinite(g.gapMinutes) || !(g.gapMinutes > 0)) return false;
    const segment = g.afterMinutes - axis;
    if (!(segment > EPS)) return false;                 // overlap, ongesorteerd of gat op positie 0
    work += segment;
    if (!(work < totalWorkMinutes - EPS)) return false; // gat op of voorbij het werktotaal
    axis = g.afterMinutes + g.gapMinutes;
  }
  return true;
}

export function toSplitPieces(gaps: readonly TaskSplitGap[] | undefined, totalWorkMinutes: number): SplitPiece[] | null {
  if (!isWellFormedSplit(gaps, totalWorkMinutes)) return null;
  const pieces: SplitPiece[] = [];
  let axis = 0;
  let work = 0;
  for (const g of gaps ?? []) {
    const segment = g.afterMinutes - axis;
    pieces.push({ kind: 'work', minutes: segment });
    pieces.push(g.source ? { kind: 'gap', minutes: g.gapMinutes, source: g.source } : { kind: 'gap', minutes: g.gapMinutes });
    work += segment;
    axis = g.afterMinutes + g.gapMinutes;
  }
  pieces.push({ kind: 'work', minutes: totalWorkMinutes - work });
  return pieces;
}

/** `original` (optioneel): de gatenlijst waaruit `pieces` kwam. Een ongewijzigd gat wordt dan met
 *  zijn OORSPRONKELIJKE getallen teruggegeven — `(a − b) + b` is in floats niet altijd `a`, en
 *  alleen-kijken mag een bestand nooit wijzigen. */
export function fromSplitPieces(pieces: readonly SplitPiece[], original?: readonly TaskSplitGap[]): { gaps: TaskSplitGap[]; totalWorkMinutes: number } {
  const gaps: TaskSplitGap[] = [];
  let axis = 0;
  let work = 0;
  for (const p of pieces) {
    if (p.kind === 'work') { axis += p.minutes; work += p.minutes; continue; }
    const o = original?.[gaps.length];
    const same = o && Math.abs(o.afterMinutes - axis) < EPS && Math.abs(o.gapMinutes - p.minutes) < EPS && o.source === p.source;
    if (same) { gaps.push({ ...o }); axis = o.afterMinutes + o.gapMinutes; continue; }
    gaps.push(p.source ? { afterMinutes: axis, gapMinutes: p.minutes, source: p.source } : { afterMinutes: axis, gapMinutes: p.minutes });
    axis += p.minutes;
  }
  return { gaps, totalWorkMinutes: work };
}

export type SplitEditRefusal = 'position-out-of-range' | 'position-on-gap' | 'before-completed-work' | 'work-too-short' | 'index-out-of-range';
export type SplitEditResult = { ok: true; pieces: SplitPiece[] } | { ok: false; reason: SplitEditRefusal };

const snap = (minutes: number, unit: number): number => (unit > 0 ? Math.round(minutes / unit) * unit : minutes);
const totalWork = (pieces: readonly SplitPiece[]): number => pieces.reduce((s, p) => (p.kind === 'work' ? s + p.minutes : s), 0);

/** Werk- en pauze-indexen tellen los van elkaar (werkstuk 0,1,2… / pauze 0,1,2…). */
function arrayIndexOf(pieces: readonly SplitPiece[], kind: SplitPiece['kind'], n: number): number {
  let seen = -1;
  for (let i = 0; i < pieces.length; i++) if (pieces[i].kind === kind && ++seen === n) return i;
  return -1;
}

/** Splits op `workOffsetMinutes` (WERK-as, zonder pauzes). `minOffsetMinutes` = reeds voltooid werk. */
export function splitAt(pieces: readonly SplitPiece[], workOffsetMinutes: number, gapMinutes: number, unitMinutes: number, minOffsetMinutes = 0): SplitEditResult {
  const at = snap(workOffsetMinutes, unitMinutes);
  if (!(at > EPS) || !(at < totalWork(pieces) - EPS)) return { ok: false, reason: 'position-out-of-range' };
  if (at < minOffsetMinutes - EPS) return { ok: false, reason: 'before-completed-work' };
  const gap = Math.max(unitMinutes, snap(gapMinutes, unitMinutes));
  let before = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.kind !== 'work') continue;
    const left = at - before;
    const right = p.minutes - left;
    if (left > EPS && right > EPS) {
      if (left < unitMinutes - EPS || right < unitMinutes - EPS) return { ok: false, reason: 'work-too-short' };
      return { ok: true, pieces: [...pieces.slice(0, i), { kind: 'work', minutes: left },
        { kind: 'gap', minutes: gap, source: 'user' }, { kind: 'work', minutes: right }, ...pieces.slice(i + 1)] };
    }
    // De positie valt precies op de rand van dit werkstuk: dat is een BESTAANDE pauze (of de
    // taakrand, die de bereikcontrole hierboven al ving) — nooit stil naar een buur verschuiven.
    if (Math.abs(left) <= EPS || Math.abs(right) <= EPS) return { ok: false, reason: 'position-on-gap' };
    before += p.minutes;
  }
  return { ok: false, reason: 'position-out-of-range' };
}

export function removeGap(pieces: readonly SplitPiece[], gapIndex: number): SplitEditResult {
  const i = arrayIndexOf(pieces, 'gap', gapIndex);
  if (i < 0) return { ok: false, reason: 'index-out-of-range' };
  const merged: SplitPiece = { kind: 'work', minutes: pieces[i - 1].minutes + pieces[i + 1].minutes };
  return { ok: true, pieces: [...pieces.slice(0, i - 1), merged, ...pieces.slice(i + 2)] };
}

export function setGapLength(pieces: readonly SplitPiece[], gapIndex: number, minutes: number, unitMinutes: number): SplitEditResult {
  const i = arrayIndexOf(pieces, 'gap', gapIndex);
  if (i < 0) return { ok: false, reason: 'index-out-of-range' };
  const next = snap(minutes, unitMinutes);
  if (!(next > EPS)) return removeGap(pieces, gapIndex);
  return { ok: true, pieces: pieces.map((p, k) => (k === i ? { kind: 'gap', minutes: next, source: 'user' } : p)) };
}

export function setWorkLength(pieces: readonly SplitPiece[], workIndex: number, minutes: number, unitMinutes: number): SplitEditResult {
  const i = arrayIndexOf(pieces, 'work', workIndex);
  if (i < 0) return { ok: false, reason: 'index-out-of-range' };
  const next = Math.max(unitMinutes, snap(minutes, unitMinutes));
  return { ok: true, pieces: pieces.map((p, k) => (k === i ? { kind: 'work', minutes: next } : p)) };
}

export function removeAllGaps(pieces: readonly SplitPiece[]): SplitPiece[] {
  return [{ kind: 'work', minutes: totalWork(pieces) }];
}

/** Adoptieregel (spec §2): na een gebruikersbewerking zijn nivelleergaten van de gebruiker. */
export function adoptLevelingGaps(pieces: readonly SplitPiece[]): SplitPiece[] {
  return pieces.map(p => (p.kind === 'gap' && p.source === 'leveling' ? { ...p, source: 'user' as const } : p));
}

export type SplitRefusal = 'milestone' | 'summary' | 'hammock' | 'elapsed' | 'manual' | 'too-short' | 'not-editable';

/** `DurationCalendar` is structureel (`isHourMode`/`hoursPerDay`) — geen cast, gewoon het contract
 *  invullen. `durationMinutesOf` leest alleen `hoursPerDay`, maar `isHourMode` eerlijk afleiden
 *  kost niets en houdt het object bruikbaar als hier ooit een span-helper bijkomt. */
const durCal = (task: Task, hoursPerDay: number): DurationCalendar =>
  ({ isHourMode: taskDurationUnit(task) === 'hours', hoursPerDay });

export function splitUnitMinutes(task: Task, hoursPerDay: number, hourSnapMinutes = 60): number {
  return taskDurationUnit(task) === 'hours' ? hourSnapMinutes : hoursPerDay * 60;
}

/** `null` = splitsbaar; anders de reden (UI: verbodscursor/gekleurd blok, MCP: weigertekst). */
export function canSplitTask(task: Task, hoursPerDay: number, isSummary: boolean): SplitRefusal | null {
  if (task.isMilestone) return 'milestone';
  if (isSummary) return 'summary';
  if (task.isHammock) return 'hammock';
  if (task.time.durationType === 'ELAPSEDTIME') return 'elapsed';
  if (task.manuallyScheduled) return 'manual';
  const work = durationMinutesOf(task, durCal(task, hoursPerDay));
  if (!isWellFormedSplit(task.splitGaps, work)) return 'not-editable';
  if (work < 2 * splitUnitMinutes(task, hoursPerDay) - EPS) return 'too-short';
  return null;
}

/** Ergonomiegrens (geen rekeneis): werk dat al verricht is, op de werk-as. */
export function completedWorkMinutes(task: Task, hoursPerDay: number): number {
  const total = durationMinutesOf(task, durCal(task, hoursPerDay));
  const remaining = taskDurationUnit(task) === 'hours' ? task.time.remainingMinutes
    : task.time.remainingTime !== undefined ? task.time.remainingTime * hoursPerDay * 60 : undefined;
  if (remaining !== undefined && Number.isFinite(remaining)) return Math.min(total, Math.max(0, total - remaining));
  return Math.min(total, Math.max(0, (task.time.completion || 0) * total));
}

/**
 * De VOORLOPIGE `scheduleFinish` na een splitbewerking: taakstart ⊕ de volledige spanne (werk én
 * pauzes), gerekend met dezelfde `splitTotalSpan*`-wandeling als de solver. Spec §2 stap 7 — de
 * balk moet meteen meegroeien; de échte datums komen bij de eerstvolgende `runCPM`, net als bij
 * elke andere duurwijziging.
 *
 * De SCHRIJFWIJZE volgt die van de bestaande `scheduleStart`: een dag-taak op een dag-kalender
 * blijft `YYYY-MM-DD`, een taak die in instants is opgeslagen blijft dat. Voor een dag-taak op een
 * kalender MÉT banden zet de solver de finish op het LAATSTE band-eind van de laatste werkdag
 * (`addDurationChecked`s `dayLastBandEnd`); dat wordt hier gespiegeld via `effectiveBandsOn`, zodat
 * de voorlopige waarde niet een halve dag van de echte afwijkt.
 */
export function splitScheduleFinish(task: Task, eng: CalendarEngine): string {
  const startStr = task.time.scheduleStart;
  const hasTime = startStr.includes('T');
  const start = hasTime ? parseInstant(startStr) : parseDate(startStr);
  if (Number.isNaN(start.getTime())) return task.time.scheduleFinish; // corrupte invoer: niets verzinnen
  if (eng.isHourMode && taskDurationUnit(task) === 'hours') {
    const minutes = splitTotalSpanMinutes(task.splitGaps, durationMinutesOf(task, eng));
    return formatInstant(eng.addWorkMinutes(start, minutes), 'hour');
  }
  const totalDays = splitTotalSpanDays(task, eng);
  const lastDay = eng.addWorkDays(hasTime ? parseDate(formatDate(start)) : start, totalDays);
  if (!hasTime) return formatDate(lastDay);
  const bands = eng.effectiveBandsOn(lastDay);
  const finish = new Date(lastDay.getTime());
  if (bands.length > 0) finish.setUTCMinutes(bands[bands.length - 1].end);
  return formatInstant(finish, 'hour');
}

/** Na een duurkrimp buiten `setTaskSplits` om: gebruikersgaten die op of voorbij het nieuwe
 *  werktotaal liggen vervallen (anders wordt de lijst niet-wélgevormd en dus alleen-lezen).
 *  Importgaten (geen `source`) en nivelleergaten blijven van hun eigen levenscyclus. */
export function clipUserGapsToWork(gaps: readonly TaskSplitGap[] | undefined, totalWorkMinutes: number): TaskSplitGap[] | undefined {
  if (!gaps || gaps.length === 0) return gaps ? [...gaps] : gaps;
  let axis = 0; let work = 0;
  const kept: TaskSplitGap[] = [];
  for (const g of gaps) {
    work += Math.max(0, g.afterMinutes - axis);
    axis = Math.max(axis, g.afterMinutes + g.gapMinutes);
    if (g.source === 'user' && !(work < totalWorkMinutes - EPS)) continue;
    kept.push({ ...g });
  }
  return kept;
}
