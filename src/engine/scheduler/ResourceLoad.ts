import { contourSiblings, costResourceIds, resourceHasLoad, type Resource, type ResourceAssignment, type ResourceCurve } from '@/types/resource';
import { exceedsCapacity } from '@/engine/scheduler/capacityTolerance';
import { groupBy } from '@/utils/collections';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import type { Task, TaskTimephasedContour } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { CPMResult } from './CPMSolver';
import { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';
import { enumerateTaskWorkDays } from './splitWalk';
import { createTaskEngineCache } from './taskEngineCache';
import {
  assignmentPlacementLoad, assignmentPlacementWork, taskWorkPlacement, workPlacement, type PlacementDay,
  type PlacementOptions, type PlacementResult,
} from './workPlacement';
import { isPinnedComplete } from './duration';
import {
  CONTOUR_SHAPE_VALUES, CURVE_TO_SHAPE, matchContoursToAssignments, periodsToWorkDaySlots,
  slotWeightsFromValues,
} from '@/engine/contour/contourEngine';
import { parseDate, formatDate, addCalendarDays, addCalendarMonths, getMonthStart, getWeekStart } from '@/utils/dateUtils';
import { calendarForEngine } from '@/utils/effectiveWorkTime';

const CURVE_POINTS: Partial<Record<ResourceCurve, [number, number][]>> = {
  UNIFORM: [[0, 1.0], [1, 1.0]],
  FRONT_LOADED: [[0, 1.0], [1, 0.2]],
  BACK_LOADED: [[0, 0.2], [1, 1.0]],
  BELL: [[0, 0.2], [0.5, 1.0], [1, 0.2]],
  EARLY_PEAK: [[0, 0.2], [1 / 3, 1.0], [1, 0.2]],
  LATE_PEAK: [[0, 0.2], [2 / 3, 1.0], [1, 0.2]],
};

export function distributeUnits(unitsPerDay: number, durationDays: number, curve: ResourceCurve = 'UNIFORM'): number[] {
  const total = unitsPerDay * durationDays;
  if (durationDays <= 1) return durationDays > 0 ? [total] : [];

  const points = CURVE_POINTS[curve];
  let weights: number[];
  if (points) {
    const raw: number[] = [];
    for (let i = 0; i < durationDays; i++) {
      const t = i / (durationDays - 1);
      raw.push(interpolate(points, t));
    }
    const sumRaw = raw.reduce((a, b) => a + b, 0);
    weights = raw.map(r => r / sumRaw);
  } else {
    weights = slotWeightsFromValues(CONTOUR_SHAPE_VALUES[CURVE_TO_SHAPE[curve]], durationDays);
  }

  return largestRemainderRound(weights.map(w => w * total), total, unitsPerDay);
}

function interpolate(points: [number, number][], t: number): number {
  for (let i = 0; i < points.length - 1; i++) {
    const [t0, w0] = points[i];
    const [t1, w1] = points[i + 1];
    if (t >= t0 && t <= t1) {
      const frac = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return w0 + frac * (w1 - w0);
    }
  }
  return points[points.length - 1][1];
}

function largestRemainderRound(values: number[], targetSum: number, unitsPerDay: number): number[] {
  const scale = Math.abs(unitsPerDay - Math.round(unitsPerDay)) < 1e-9 ? 1 : 100;
  const floors = values.map(v => Math.floor(v * scale));
  let remainder = Math.round(targetSum * scale) - floors.reduce((a, b) => a + b, 0);
  const fracIdx = values
    .map((v, i) => ({ i, frac: v * scale - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < fracIdx.length && remainder > 0; k++, remainder--) {
    result[fracIdx[k].i] += 1;
  }
  return result.map(v => v / scale);
}

export function assignmentDayUnits(
  task: Task,
  assignment: ResourceAssignment,
  mpd: number,
  contour?: TaskTimephasedContour | null,
  siblings?: readonly ResourceAssignment[],
): number[] {
  const durationDays = task.time.scheduleDuration;
  const resolved = contour === undefined
    ? matchContoursToAssignments(task.timephasedContours, siblings ?? [assignment]).get(assignment.id) ?? null
    : contour;
  if (resolved && resolved.periods.length > 0) {
    const slotMinutes = Math.max(1, mpd);
    const slotWork = periodsToWorkDaySlots(resolved.periods, task.splitGaps, slotMinutes, 0);
    if (slotWork.length > 0) return slotWork.map((w) => w / slotMinutes);
  }
  const storedWork = assignment.remainingWorkMinutes !== undefined && Number.isFinite(assignment.remainingWorkMinutes) && durationDays > 0;
  const storedTotalUnits = (): number => {
    const slotMinutes = Math.max(1, mpd);
    const doneUnits = assignment.actualWorkMinutes !== undefined
      ? Math.max(0, assignment.actualWorkMinutes) / slotMinutes
      : Math.max(0, durationDays - remainingDaysOf(task, slotMinutes)) * assignment.unitsPerDay;
    return Math.max(0, assignment.remainingWorkMinutes!) / slotMinutes + doneUnits;
  };
  if (assignment.curveValues && durationDays > 0) {
    const weights = slotWeightsFromValues(assignment.curveValues, durationDays);
    const total = storedWork ? storedTotalUnits() : assignment.unitsPerDay * durationDays;
    return weights.map((w) => w * total);
  }
  if (storedWork) {
    const totalUnits = storedTotalUnits();
    const weights = slotWeightsFromValues(CONTOUR_SHAPE_VALUES[CURVE_TO_SHAPE[assignment.curve ?? 'UNIFORM']], durationDays);
    return weights.map((w) => w * totalUnits);
  }
  return distributeUnits(assignment.unitsPerDay, durationDays, assignment.curve ?? 'UNIFORM');
}

function remainingDaysOf(task: Task, slotMinutes: number): number {
  const t = task.time;
  if (t.durationUnit === 'hours' && typeof t.durationMinutes === 'number' && Number.isFinite(t.durationMinutes)) {
    const rem = t.remainingMinutes ?? Math.round(t.durationMinutes * (1 - (t.completion ?? 0)));
    return Math.max(0, rem) / slotMinutes;
  }
  return Math.max(0, t.remainingTime ?? Math.round(t.scheduleDuration * (1 - (t.completion ?? 0))));
}

export function contourLookup(
  assignments: readonly ResourceAssignment[],
): (task: Task, assignment: ResourceAssignment) => TaskTimephasedContour | null {
  const byTask = groupBy(assignments, a => a.taskId);
  const cache = new Map<string, Map<string, TaskTimephasedContour>>();
  return (task, assignment) => {
    if (!task.timephasedContours || task.timephasedContours.length === 0) return null;
    let m = cache.get(task.id);
    if (!m) {
      m = matchContoursToAssignments(task.timephasedContours, byTask.get(task.id) ?? [assignment]);
      cache.set(task.id, m);
    }
    return m.get(assignment.id) ?? null;
  };
}

export function taskWorkDayIsos(task: Task, taskEngine: CalendarEngine, durationDays: number): string[] {
  return task.time.durationType === 'ELAPSEDTIME' || isPinnedComplete(task.time)
    ? enumerateWorkDays(taskEngine, task.time.earlyStart, task.time.earlyFinish)
    : enumerateTaskWorkDays(task.splitGaps, taskEngine, task.time.earlyStart, durationDays);
}

export type LoadOptions = PlacementOptions;

export function taskLoadPlacement(
  task: Task,
  engine: CalendarEngine,
  options: LoadOptions,
  start?: Date,
): PlacementResult | null {
  if (!engine.isHourMode) return null;
  const placement = taskWorkPlacement(task, engine, options, start);
  return placement ? workPlacement(engine, placement) : { days: [], finish: start ?? new Date(NaN) };
}

export function assignmentLoadOnPlacement(
  task: Task,
  assignment: ResourceAssignment,
  days: readonly PlacementDay[],
  engine: CalendarEngine,
  contour: TaskTimephasedContour | null,
): number[] {
  const mpd = engine.hoursPerDay * 60;
  return assignmentPlacementLoad(assignment, days, mpd, contour, () => assignmentDayUnits(task, assignment, mpd, null));
}

export function dayslotLoad(
  task: Task,
  assignment: ResourceAssignment,
  engine: CalendarEngine,
  contour: TaskTimephasedContour | null,
): { isos: string[]; units: number[] } {
  const units = assignmentDayUnits(task, assignment, engine.hoursPerDay * 60, contour);
  const isos = taskWorkDayIsos(task, engine, Math.max(task.time.scheduleDuration, units.length));
  const n = Math.min(units.length, isos.length);
  return { isos: isos.slice(0, n), units: units.slice(0, n) };
}

function assignmentDaily(
  task: Task,
  assignment: ResourceAssignment,
  engine: CalendarEngine,
  contour: TaskTimephasedContour | null,
  placed: PlacementResult | null,
): { isos: string[]; units: number[] } {
  if (placed === null) return dayslotLoad(task, assignment, engine, contour);
  return {
    isos: placed.days.map(d => d.iso),
    units: assignmentLoadOnPlacement(task, assignment, placed.days, engine, contour),
  };
}

export interface DailyLoad {
  [isoDate: string]: number;
}

export type OverallocationReason = 'non-working-day' | 'over-capacity';

export interface ResourceLoadResult {
  load: Record<string, DailyLoad>;
  capacity: Record<string, DailyLoad>;
  overallocatedDays: Record<string, string[]>;
  overallocatedReasons: Record<string, Record<string, OverallocationReason>>;
  hours: Record<string, number>;
}

function taskPlacementCache(
  engineForTask: (task: Task) => CalendarEngine,
  options: LoadOptions,
): (task: Task) => PlacementResult | null {
  const cache = new Map<string, PlacementResult | null>();
  return (task) => {
    if (cache.has(task.id)) return cache.get(task.id)!;
    const placed = taskLoadPlacement(task, engineForTask(task), options);
    cache.set(task.id, placed);
    return placed;
  };
}

export function computeResourceLoad(
  resources: Resource[],
  assignments: ResourceAssignment[],
  tasks: Task[],
  projectCalendar: WorkCalendar,
  resourceCalendars: WorkCalendar[],
  options: LoadOptions,
  onAssignmentLoad?: (assignment: ResourceAssignment, daily: { isos: readonly string[]; units: readonly number[] }) => void,
): ResourceLoadResult {
  const load: Record<string, DailyLoad> = {};
  const capacity: Record<string, DailyLoad> = {};
  const overallocatedDays: Record<string, string[]> = {};
  const overallocatedReasons: Record<string, Record<string, OverallocationReason>> = {};
  const hours: Record<string, number> = {};
  const nonWorkingDaysByResource: Record<string, Set<string>> = {};

  const taskById = new Map(tasks.map(t => [t.id, t]));
  const { forTask: engineForTask } = createTaskEngineCache(resourceCalendars, projectCalendar);

  const costIds = costResourceIds(resources);
  const validAssignments = assignments.filter(a => {
    if (costIds.has(a.resourceId)) return false;
    const task = taskById.get(a.taskId);
    return !!task && isLeafTask(task) && !task.isMilestone;
  });

  const contourOf = contourLookup(validAssignments);
  const placedOf = taskPlacementCache(engineForTask, options);
  for (const a of validAssignments) {
    const task = taskById.get(a.taskId)!;
    const taskEngine = engineForTask(task);
    const contour = contourOf(task, a);
    const placed = placedOf(task);
    const daily = assignmentDaily(task, a, taskEngine, contour, placed);
    const { isos: workDayIsos, units: days } = daily;
    if (days.length === 0) continue;
    onAssignmentLoad?.(a, daily);

    if (!load[a.resourceId]) load[a.resourceId] = {};
    const bucket = load[a.resourceId];
    let units = 0;
    for (let i = 0; i < days.length && i < workDayIsos.length; i++) {
      const iso = workDayIsos[i];
      bucket[iso] = (bucket[iso] ?? 0) + days[i];
      units += days[i];
    }
    const work = placed ? assignmentPlacementWork(days, placed.days, contour, taskEngine.hoursPerDay * 60) : units;
    hours[a.resourceId] = (hours[a.resourceId] ?? 0) + work * taskEngine.hoursPerDay;
  }

  for (const resource of resources) {
    const bucket = load[resource.id];
    if (!bucket) continue;

    const engine = new CalendarEngine(calendarForEngine(
      resolveCalendar(resource.calendarId, resourceCalendars, projectCalendar),
    ));

    capacity[resource.id] = {};
    const nonWorkingDays = new Set<string>();
    nonWorkingDaysByResource[resource.id] = nonWorkingDays;
    for (const iso of Object.keys(bucket)) {
      const date = parseDate(iso);
      const workDay = engine.isWorkDay(date);
      capacity[resource.id][iso] = workDay ? maxUnitsOn(resource, iso) : 0;
      if (!workDay) nonWorkingDays.add(iso);
    }
  }

  for (const resId of Object.keys(load)) {
    const bucket = load[resId];
    const cap = capacity[resId] ?? {};
    const nonWorkingDays = nonWorkingDaysByResource[resId];
    const flagged: string[] = [];
    const reasons: Record<string, OverallocationReason> = {};
    for (const iso of Object.keys(bucket)) {
      if (exceedsCapacity(bucket[iso], cap[iso] ?? 0)) {
        flagged.push(iso);
        reasons[iso] = nonWorkingDays?.has(iso) ? 'non-working-day' : 'over-capacity';
      }
    }
    if (flagged.length > 0) {
      overallocatedDays[resId] = flagged.sort();
      overallocatedReasons[resId] = reasons;
    }
  }

  return { load, capacity, overallocatedDays, overallocatedReasons, hours };
}

export function computeReliableResourceLoad(
  cpmResult: CPMResult | null,
  resources: Resource[],
  assignments: ResourceAssignment[],
  tasks: Task[],
  projectCalendar: WorkCalendar,
  resourceCalendars: WorkCalendar[],
  options: LoadOptions,
): ResourceLoadResult | null {
  return cpmResult?.error
    ? null
    : computeResourceLoad(resources, assignments, tasks, projectCalendar, resourceCalendars, options);
}

export function maxUnitsOn(resource: Resource, iso: string): number {
  const steps = resource.availabilitySteps;
  if (!steps || steps.length === 0) return resource.maxUnits;
  let best: (typeof steps)[number] | undefined;
  for (const step of steps) {
    if (!(step.from <= iso)) continue;
    if (!best || step.from.localeCompare(best.from) >= 0) best = step;
  }
  return best ? best.maxUnits : resource.maxUnits;
}

export interface HistogramCause {
  assignmentId: string;
  taskId: string;
  contribution: number;
}

export interface HistogramBucket {
  start: string;
  end: string;
  load: number;
  peakDayLoad: number;
  capacity: number;
  overallocatedDays: string[];
  causes?: HistogramCause[];
}

export interface HistogramReport {
  resources: Array<{ resourceId: string; buckets: HistogramBucket[] }>;
}

export interface HistogramInput {
  tasks: Task[];
  sequences: Sequence[];
  assignments: ResourceAssignment[];
  resources: Resource[];
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
  cpmResult: CPMResult | null;
  resourceIds?: string[];
  from?: string;
  to?: string;
  bucket: 'dag' | 'week' | 'maand';
  schedulingOptions: LoadOptions;
}

export function computeHistogramReport(input: HistogramInput): HistogramReport {
  const { tasks, assignments, resources, calendar, calendars, resourceIds, from, to, bucket } = input;

  const taskById = new Map(tasks.map(t => [t.id, t]));
  const { forTask: engineForTask } = createTaskEngineCache(calendars, calendar);

  interface AssignDaily {
    assignmentId: string;
    taskId: string;
    resourceId: string;
    daily: Map<string, number>;
  }
  const perAssignment: AssignDaily[] = [];
  const costIds = costResourceIds(resources);
  const contourOf = contourLookup(contourSiblings(assignments, costIds));
  const placedOf = taskPlacementCache(engineForTask, input.schedulingOptions);
  let firstLoadDay: string | undefined;
  let lastLoadDay: string | undefined;
  for (const a of assignments) {
    if (costIds.has(a.resourceId)) continue;
    const task = taskById.get(a.taskId);
    if (!task || task.isMilestone || isSummaryTask(task)) continue;
    const taskEngine = engineForTask(task);
    const { isos: workDayIsos, units: dist } = assignmentDaily(task, a, taskEngine, contourOf(task, a), placedOf(task));
    if (dist.length === 0) continue;
    const daily = new Map<string, number>();
    for (let i = 0; i < dist.length && i < workDayIsos.length; i++) {
      const iso = workDayIsos[i];
      daily.set(iso, (daily.get(iso) ?? 0) + dist[i]);
      if (dist[i] > 0) {
        if (!firstLoadDay || iso < firstLoadDay) firstLoadDay = iso;
        if (!lastLoadDay || iso > lastLoadDay) lastLoadDay = iso;
      }
    }
    perAssignment.push({ assignmentId: a.id, taskId: a.taskId, resourceId: a.resourceId, daily });
  }

  const loadByResource = new Map<string, Map<string, number>>();
  for (const pa of perAssignment) {
    let m = loadByResource.get(pa.resourceId);
    if (!m) { m = new Map(); loadByResource.set(pa.resourceId, m); }
    for (const [iso, u] of pa.daily) m.set(iso, (m.get(iso) ?? 0) + u);
  }

  const windows = histogramWindows(tasks, from, to, bucket,
    firstLoadDay && lastLoadDay ? { first: firstLoadDay, last: lastLoadDay } : undefined);

  const idSet = resourceIds && resourceIds.length > 0 ? new Set(resourceIds) : null;
  const reported = (idSet ? resources.filter(r => idSet.has(r.id)) : resources).filter(resourceHasLoad);

  const report: HistogramReport = { resources: [] };
  for (const resource of reported) {
    const dailyLoad = loadByResource.get(resource.id) ?? new Map<string, number>();
    const engine = new CalendarEngine(calendarForEngine(
      resolveCalendar(resource.calendarId, calendars, calendar),
    ));

    const overDays = new Set<string>();
    for (const [iso, l] of dailyLoad) {
      const cap = engine.isWorkDay(parseDate(iso)) ? maxUnitsOn(resource, iso) : 0;
      if (exceedsCapacity(l, cap)) overDays.add(iso);
    }
    const resAssignments = perAssignment.filter(pa => pa.resourceId === resource.id);

    const winLoad = new Array<number>(windows.length).fill(0);
    const winPeak = new Array<number>(windows.length).fill(0);
    for (const [iso, l] of dailyLoad) {
      const wi = windowIndexOf(windows, iso);
      if (wi < 0) continue;
      winLoad[wi] += l;
      if (l > winPeak[wi]) winPeak[wi] = l;
    }
    const winOver: string[][] = windows.map(() => []);
    for (const iso of overDays) {
      const wi = windowIndexOf(windows, iso);
      if (wi >= 0) winOver[wi].push(iso);
    }

    const buckets: HistogramBucket[] = [];
    for (let wi = 0; wi < windows.length; wi++) {
      const w = windows[wi];
      const load = winLoad[wi];
      const peak = winPeak[wi];
      let capacity = 0;
      for (const iso of enumerateWorkDays(engine, w.start, w.end)) capacity += maxUnitsOn(resource, iso);

      const overInWin = winOver[wi].sort();
      const b: HistogramBucket = {
        start: w.start,
        end: w.end,
        load,
        peakDayLoad: peak,
        capacity,
        overallocatedDays: overInWin,
      };
      if (overInWin.length > 0) {
        const causes: HistogramCause[] = [];
        for (const pa of resAssignments) {
          let contribution = 0;
          for (const iso of overInWin) contribution += pa.daily.get(iso) ?? 0;
          if (contribution > 0) causes.push({ assignmentId: pa.assignmentId, taskId: pa.taskId, contribution });
        }
        if (causes.length > 0) b.causes = causes;
      }
      buckets.push(b);
    }
    report.resources.push({ resourceId: resource.id, buckets });
  }

  return report;
}

export function histogramWindows(
  tasks: readonly Task[],
  from: string | undefined,
  to: string | undefined,
  bucket: HistogramInput['bucket'],
  loadSpan?: { first: string; last: string },
): Array<{ start: string; end: string }> {
  let fromIso = from;
  let toIso = to;
  if (!fromIso || !toIso) {
    let minS: string | undefined;
    let maxF: string | undefined;
    for (const t of tasks) {
      const es = t.time.earlyStart;
      const ef = t.time.earlyFinish;
      if (es && (!minS || es < minS)) minS = es;
      if (ef && (!maxF || ef > maxF)) maxF = ef;
    }
    fromIso = fromIso ?? minS;
    toIso = toIso ?? maxF;
    if (loadSpan && !from && (!fromIso || loadSpan.first < fromIso.slice(0, 10))) fromIso = loadSpan.first;
    if (loadSpan && !to && (!toIso || loadSpan.last > toIso.slice(0, 10))) toIso = loadSpan.last;
  }

  const windows: Array<{ start: string; end: string }> = [];
  if (fromIso && toIso && fromIso <= toIso) {
    const toDate = parseDate(toIso);
    if (bucket === 'maand') {
      let ms = getMonthStart(parseDate(fromIso));
      let guard = 0;
      while (ms <= toDate && guard++ < 100_000) {
        const next = addCalendarMonths(ms, 1);
        windows.push({ start: formatDate(ms), end: formatDate(addCalendarDays(next, -1)) });
        ms = next;
      }
    } else if (bucket === 'week') {
      let ws = getWeekStart(parseDate(fromIso));
      let guard = 0;
      while (ws <= toDate && guard++ < 100_000) {
        const we = addCalendarDays(ws, 6);
        windows.push({ start: formatDate(ws), end: formatDate(we) });
        ws = addCalendarDays(ws, 7);
      }
    } else {
      let d = parseDate(fromIso);
      let guard = 0;
      while (d <= toDate && guard++ < 1_000_000) {
        const iso = formatDate(d);
        windows.push({ start: iso, end: iso });
        d = addCalendarDays(d, 1);
      }
    }
  }

  return windows;
}

function windowIndexOf(windows: ReadonlyArray<{ start: string; end: string }>, iso: string): number {
  let lo = 0;
  let hi = windows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (windows[mid].end < iso) lo = mid + 1;
    else if (windows[mid].start > iso) hi = mid - 1;
    else return mid;
  }
  return -1;
}

export function enumerateWorkDays(engine: CalendarEngine, startIso: string, finishIso: string): string[] {
  const start = parseDate(startIso);
  const finish = parseDate(finishIso);
  const isos: string[] = [];
  let current = new Date(start.getTime());
  let guard = 0;
  const MAX_DAYS = 200_000;
  while (current <= finish) {
    if (engine.isWorkDay(current)) isos.push(formatDate(current));
    current = addCalendarDays(current, 1);
    if (++guard > MAX_DAYS) break;
  }
  return isos;
}
