import { resourceHasLoad, type Resource, type ResourceAssignment } from '@/types/resource';
import { exceedsCapacity } from '@/engine/scheduler/capacityTolerance';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { CompanyPool } from '@/types/library';
import { computeResourceLoad, maxUnitsOn, type LoadOptions } from '@/engine/scheduler/ResourceLoad';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import { solveOptionsFor, type ProjectSolveOptions, type SolveProjectFields } from '@/engine/scheduler/solveInput';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';

export interface OccupancySolveInput {
  tasks: Task[];
  sequences: Sequence[];
  options: ProjectSolveOptions;
}

export function occupancySolveInputFor(
  payload: { tasks: Task[]; sequences: Sequence[]; project: SolveProjectFields },
): OccupancySolveInput {
  return {
    tasks: payload.tasks,
    sequences: payload.sequences,
    options: solveOptionsFor(payload.project),
  };
}

export interface OccupancyDocInput {
  docId: string;
  title: string;
  scheduleStale: boolean;
  companyId: string | null;
  resources: Resource[];
  assignments: ResourceAssignment[];
  tasks: Task[];
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
  loadOptions: LoadOptions;
  solveInput?: OccupancySolveInput;
  skipEphemeralSolve?: boolean;
}

export type OccupancyEphemeralSolve = (doc: OccupancyDocInput) => Task[] | null;

export const ephemeralSolve: OccupancyEphemeralSolve = (doc) => {
  const input = doc.solveInput;
  if (!input) return null;
  const { tasks, result } = solveClone(input, doc.calendar, doc.calendars);
  if (result.error) return null;
  return tasks;
};

export function solveClone(
  input: OccupancySolveInput,
  calendar: WorkCalendar,
  calendars: WorkCalendar[],
): { tasks: Task[]; result: CPMResult } {
  const tasks = cloneTasksForSolve(input.tasks);
  const result = solveProject({ tasks, sequences: input.sequences, calendar, calendars, ...input.options });
  return { tasks, result };
}

export interface OccupancyDocBooking {
  docId: string;
  title: string;
  scheduleStale: boolean;
  counted: boolean;
  ephemeralComputed: boolean;
  firstDay: string | null;
  lastDay: string | null;
  peak: number;
  dailyLoad: Record<string, number>;
}

export interface OccupancyRow {
  libraryItemId: string;
  name: string;
  docs: OccupancyDocBooking[];
  totalPeak: number;
  capacityAtPeak: number;
  conflictDays: string[];
}

export function computeLibraryOccupancy(
  companyId: string,
  pool: CompanyPool,
  docs: OccupancyDocInput[],
  solve: OccupancyEphemeralSolve = ephemeralSolve,
): { rows: OccupancyRow[]; anyStale: boolean } {
  const poolItemIds = new Set(pool.resources.map(r => r.id));

  interface DocBucket {
    doc: OccupancyDocInput;
    counted: boolean;
    ephemeralComputed: boolean;
    daily: Map<string, number>;
  }
  const perItem = new Map<string, { byDoc: Map<string, DocBucket>; total: Map<string, number> }>();

  const bucketFor = (itemId: string) => {
    let bucket = perItem.get(itemId);
    if (!bucket) {
      bucket = { byDoc: new Map(), total: new Map() };
      perItem.set(itemId, bucket);
    }
    return bucket;
  };

  for (const doc of docs) {
    if (doc.companyId !== companyId) continue;

    const stampedResources = doc.resources.filter(r =>
      resourceHasLoad(r) &&
      r.libraryOrigin !== undefined &&
      r.libraryOrigin.companyId === companyId &&
      poolItemIds.has(r.libraryOrigin.libraryItemId));
    if (stampedResources.length === 0) continue;

    let solvedTasks: Task[] | null = null;
    if (doc.scheduleStale && doc.skipEphemeralSolve !== true) {
      try {
        solvedTasks = solve(doc);
      } catch {
        solvedTasks = null;
      }
    }

    if (doc.scheduleStale && doc.skipEphemeralSolve !== true && solvedTasks === null) {
      for (const resource of stampedResources) {
        if (!doc.assignments.some(a => a.resourceId === resource.id)) continue;
        const bucket = bucketFor(resource.libraryOrigin!.libraryItemId);
        if (!bucket.byDoc.has(doc.docId)) {
          bucket.byDoc.set(doc.docId, { doc, counted: false, ephemeralComputed: false, daily: new Map() });
        }
      }
      continue;
    }

    const loadTasks = solvedTasks ?? doc.tasks;
    const loadResult = computeResourceLoad(doc.resources, doc.assignments, loadTasks, doc.calendar, doc.calendars, doc.loadOptions);

    for (const resource of stampedResources) {
      const daily = loadResult.load[resource.id];
      if (!daily) continue;
      const itemId = resource.libraryOrigin!.libraryItemId;

      for (const [iso, units] of Object.entries(daily)) {
        if (units <= 0) continue;
        const bucket = bucketFor(itemId);
        let docBucket = bucket.byDoc.get(doc.docId);
        if (!docBucket) {
          docBucket = { doc, counted: true, ephemeralComputed: solvedTasks !== null, daily: new Map() };
          bucket.byDoc.set(doc.docId, docBucket);
        }
        docBucket.daily.set(iso, (docBucket.daily.get(iso) ?? 0) + units);
        bucket.total.set(iso, (bucket.total.get(iso) ?? 0) + units);
      }
    }
  }

  const rows: OccupancyRow[] = [];
  let anyStale = false;

  for (const poolItem of pool.resources) {
    if (!resourceHasLoad(poolItem)) continue;
    const bucket = perItem.get(poolItem.id);
    if (!bucket) continue;

    const docBookings: OccupancyDocBooking[] = [];
    for (const { doc, counted, ephemeralComputed, daily } of bucket.byDoc.values()) {
      let firstDay: string | null = null;
      let lastDay: string | null = null;
      let peak = 0;
      const dailyLoad: Record<string, number> = {};
      for (const [iso, units] of daily) {
        dailyLoad[iso] = units;
        if (firstDay === null || iso < firstDay) firstDay = iso;
        if (lastDay === null || iso > lastDay) lastDay = iso;
        if (units > peak) peak = units;
      }
      if (!counted || doc.scheduleStale) anyStale = true;
      docBookings.push({
        docId: doc.docId,
        title: doc.title,
        scheduleStale: doc.scheduleStale,
        counted,
        ephemeralComputed,
        firstDay,
        lastDay,
        peak,
        dailyLoad,
      });
    }

    let totalPeak = 0;
    let peakDay: string | null = null;
    const conflictDays: string[] = [];
    for (const iso of [...bucket.total.keys()].sort()) {
      const sum = bucket.total.get(iso)!;
      if (sum > totalPeak) {
        totalPeak = sum;
        peakDay = iso;
      }
      if (exceedsCapacity(sum, maxUnitsOn(poolItem, iso))) conflictDays.push(iso);
    }

    rows.push({
      libraryItemId: poolItem.id,
      name: poolItem.name,
      docs: docBookings,
      totalPeak,
      capacityAtPeak: peakDay !== null ? maxUnitsOn(poolItem, peakDay) : poolItem.maxUnits,
      conflictDays,
    });
  }

  return { rows, anyStale };
}
