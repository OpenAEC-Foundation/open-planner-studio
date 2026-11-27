import { resourceIsLevelable } from '@/types/resource';
import type { Task, TaskSplitGap } from '@/types/task';
import type { CompanyPool } from '@/types/library';
import type { WorkCalendar } from '@/types/calendar';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import {
  levelResources,
  type LevelingOptions,
  type LevelingPoolLedger,
  type LevelingReason,
  type LevelingResult,
} from '@/engine/scheduler/ResourceLeveler';
import { maxUnitsOn } from '@/engine/scheduler/ResourceLoad';
import { expandSummaryRelations, leafTasksForSolve } from '@/engine/scheduler/expandSummaryRelations';
import { computeLibraryOccupancy, solveClone, type OccupancyDocInput, type OccupancySolveInput } from './occupancy';
import { parseDate, formatDate, addCalendarDays } from '@/utils/dateUtils';

export interface DistributionDocInput extends OccupancyDocInput {
  rank: number;
  pinned: boolean;
  datesAsRecorded: boolean;
  ceilingWorkdays: number | null;
  levelInput: OccupancySolveInput;
}

export interface DistributionOptions {
  allowSplits: boolean;
}

export type DistributionPinReason = 'pin' | 'dates-as-recorded';

export type DistributionBlockReason = 'UNCOUNTED_DOCUMENT' | 'MATERIAL_ITEM' | 'NO_DEMAND';

export interface DistributionShortfall {
  taskId: string;
  reason?: LevelingReason;
  days: string[];
}

export interface DistributionDocResult {
  docId: string;
  title: string;
  participated: boolean;
  pinnedReason?: DistributionPinReason;
  cannotMove: boolean;
  delays: Record<string, number>;
  delayMinutes?: Record<string, number>;
  gaps: Record<string, TaskSplitGap[]>;
  projectEndBefore: string;
  projectEndAfter: string;
  endShiftWorkdays: number;
  shortfalls: DistributionShortfall[];
}

export interface DistributionProposal {
  libraryItemId: string;
  blocked: { reason: DistributionBlockReason; docIds: string[] } | null;
  docs: DistributionDocResult[];
  fixedLoadByDay: Record<string, number>;
  residualByDay: Record<string, number>;
  hasShortfall: boolean;
  bookingByDay: Record<string, Record<string, number>>;
  afterLoadByDay: Record<string, Record<string, number>>;
  afterIncomplete: boolean;
}

export type DistributionLevelRun = (doc: DistributionDocInput, options: LevelingOptions) => LevelingResult;

const defaultLevelRun: DistributionLevelRun = (doc, options) => {
  const { tasks, result: cpmResult } = solveClone(doc.levelInput, doc.calendar, doc.calendars);
  const { sequences } = expandSummaryRelations(tasks, doc.levelInput.sequences);
  return levelResources(
    leafTasksForSolve(tasks), sequences, doc.resources, doc.assignments,
    doc.calendar, doc.calendars, cpmResult, options,
    doc.levelInput.options,
  );
};

function currentProjectEnd(tasks: Task[]): string {
  let end = '';
  for (const t of tasks) {
    if (t.childIds.length > 0) continue;
    if (t.time.earlyFinish && (!end || t.time.earlyFinish > end)) end = t.time.earlyFinish;
  }
  return end;
}

function currentProjectEndFor(doc: DistributionDocInput): string {
  if (!doc.scheduleStale) return currentProjectEnd(doc.levelInput.tasks);
  try {
    const { tasks, result } = solveClone(doc.levelInput, doc.calendar, doc.calendars);
    if (result.error) return currentProjectEnd(doc.levelInput.tasks);
    return currentProjectEnd(tasks);
  } catch {
    return currentProjectEnd(doc.levelInput.tasks);
  }
}

function endShiftWorkdays(before: string, after: string, calendar: WorkCalendar): number {
  const eng = new CalendarEngine(calendar);
  const from = parseDate(before), to = parseDate(after);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return 0;
  return to >= from ? eng.workDaysBetween(from, to) - 1 : -(eng.workDaysBetween(to, from) - 1);
}

export function scopeTaskIdsFor(doc: DistributionDocInput, companyId: string, libraryItemId: string): string[] {
  const stampedResourceIds = new Set(
    doc.resources
      .filter(r => r.libraryOrigin !== undefined
        && r.libraryOrigin.companyId === companyId
        && r.libraryOrigin.libraryItemId === libraryItemId)
      .map(r => r.id),
  );
  if (stampedResourceIds.size === 0) return [];
  return [...new Set(doc.assignments.filter(a => stampedResourceIds.has(a.resourceId)).map(a => a.taskId))];
}

function scopeHasDemand(doc: DistributionDocInput, scopeTaskIds: string[]): boolean {
  if (scopeTaskIds.length === 0) return false;
  const scopeSet = new Set(scopeTaskIds);
  const tasksById = new Map(doc.levelInput.tasks.map(t => [t.id, t]));
  const resById = new Map(doc.resources.map(r => [r.id, r]));
  for (const a of doc.assignments) {
    if (!scopeSet.has(a.taskId) || a.unitsPerDay <= 0) continue;
    const res = resById.get(a.resourceId);
    if (!res || !resourceIsLevelable(res)) continue;
    const task = tasksById.get(a.taskId);
    if (!task || task.isMilestone || task.childIds.length > 0) continue;
    if (task.time.scheduleDuration <= 0) continue;
    return true;
  }
  return false;
}

function computeHorizonIso(
  fixedLoadByDay: Record<string, number>,
  placed: Record<string, number>,
  participants: DistributionDocInput[],
): string | null {
  let latest: string | null = null;
  for (const iso of Object.keys(fixedLoadByDay)) if (!latest || iso > latest) latest = iso;
  for (const iso of Object.keys(placed)) if (!latest || iso > latest) latest = iso;
  if (!latest) return null;
  let maxSpanDays = 30;
  for (const doc of participants) {
    for (const t of doc.levelInput.tasks) {
      if (!t.time.earlyStart || !t.time.earlyFinish) continue;
      const s = parseDate(t.time.earlyStart), f = parseDate(t.time.earlyFinish);
      if (isNaN(s.getTime()) || isNaN(f.getTime())) continue;
      const spanDays = Math.round((f.getTime() - s.getTime()) / 86400000);
      if (spanDays > maxSpanDays) maxSpanDays = spanDays;
    }
  }
  return formatDate(addCalendarDays(parseDate(latest), maxSpanDays + 30));
}

export function computeDistribution(
  companyId: string,
  pool: CompanyPool,
  libraryItemId: string,
  docs: DistributionDocInput[],
  options: DistributionOptions,
  runLeveling: DistributionLevelRun = defaultLevelRun,
): DistributionProposal {
  const empty: DistributionProposal = {
    libraryItemId, blocked: null, docs: [], fixedLoadByDay: {}, residualByDay: {}, hasShortfall: false,
    bookingByDay: {}, afterLoadByDay: {}, afterIncomplete: false,
  };

  const poolItem = pool.resources.find(r => r.id === libraryItemId);
  if (!poolItem) return empty;

  const { rows } = computeLibraryOccupancy(companyId, pool, docs);
  const row = rows.find(r => r.libraryItemId === libraryItemId);
  if (!row) return empty;

  const uncounted = row.docs.filter(b => !b.counted);
  if (uncounted.length > 0) {
    return { ...empty, blocked: { reason: 'UNCOUNTED_DOCUMENT', docIds: uncounted.map(b => b.docId) } };
  }

  if (!resourceIsLevelable(poolItem)) {
    return { ...empty, blocked: { reason: 'MATERIAL_ITEM', docIds: row.docs.map(b => b.docId) } };
  }

  const docById = new Map(docs.map(d => [d.docId, d]));

  const bookingByDay: Record<string, Record<string, number>> = {};
  for (const booking of row.docs) bookingByDay[booking.docId] = { ...booking.dailyLoad };

  const afterLoadByDay: Record<string, Record<string, number>> = {};

  const fixedLoadByDay: Record<string, number> = {};
  for (const booking of row.docs) {
    const input = docById.get(booking.docId);
    if (!input || (!input.pinned && !input.datesAsRecorded)) continue;
    for (const [iso, units] of Object.entries(booking.dailyLoad)) {
      fixedLoadByDay[iso] = (fixedLoadByDay[iso] ?? 0) + units;
    }
    afterLoadByDay[booking.docId] = { ...booking.dailyLoad };
  }

  const placedByItem: Record<string, Record<string, number>> = {};
  const bookPlaced = (itemId: string, iso: string, units: number, docId: string) => {
    const bucket = placedByItem[itemId] ?? (placedByItem[itemId] = {});
    bucket[iso] = (bucket[iso] ?? 0) + units;
    const docBucket = afterLoadByDay[docId] ?? (afterLoadByDay[docId] = {});
    docBucket[iso] = (docBucket[iso] ?? 0) + units;
  };
  const residualOn = (itemId: string, iso: string): number =>
    itemId === libraryItemId
      ? Math.max(0, maxUnitsOn(poolItem, iso) - (fixedLoadByDay[iso] ?? 0) - (placedByItem[itemId]?.[iso] ?? 0))
      : 0;

  const makeLedgerForDoc = (doc: DistributionDocInput, horizonIso: string | null): LevelingPoolLedger => {
    const resourceById = new Map(doc.resources.map(r => [r.id, r]));
    return {
      poolItemOf: (resourceId: string): string | null => {
        const r = resourceById.get(resourceId);
        if (!r || r.libraryOrigin === undefined) return null;
        if (r.libraryOrigin.companyId !== companyId || r.libraryOrigin.libraryItemId !== libraryItemId) return null;
        return libraryItemId;
      },
      residualOn: (itemId: string, iso: string): number => residualOn(itemId, iso),
      book: (itemId: string, iso: string, units: number): void => bookPlaced(itemId, iso, units, doc.docId),
      horizonIso,
    };
  };

  const participantBookings = row.docs.filter(b => {
    const input = docById.get(b.docId);
    return input !== undefined && !input.pinned && !input.datesAsRecorded;
  });
  const participants = participantBookings
    .map(b => docById.get(b.docId)!)
    .sort((a, b) => a.rank - b.rank || a.docId.localeCompare(b.docId));

  const scopeTaskIdsByDoc = new Map(participants.map(doc => [doc.docId, scopeTaskIdsFor(doc, companyId, libraryItemId)]));

  if (participants.length > 0 && !participants.some(doc => scopeHasDemand(doc, scopeTaskIdsByDoc.get(doc.docId)!))) {
    return { ...empty, blocked: { reason: 'NO_DEMAND', docIds: participants.map(d => d.docId) } };
  }

  const results: DistributionDocResult[] = [];

  for (const booking of row.docs) {
    const input = docById.get(booking.docId);
    if (!input || (!input.pinned && !input.datesAsRecorded)) continue;
    const end = currentProjectEndFor(input);
    results.push({
      docId: booking.docId,
      title: booking.title,
      participated: false,
      pinnedReason: input.datesAsRecorded ? 'dates-as-recorded' : 'pin',
      cannotMove: false,
      delays: {},
      gaps: {},
      projectEndBefore: end,
      projectEndAfter: end,
      endShiftWorkdays: 0,
      shortfalls: [],
    });
  }

  for (const doc of participants) {
    const scopeTaskIds = scopeTaskIdsByDoc.get(doc.docId)!;
    const tasksById = new Map(doc.levelInput.tasks.map(t => [t.id, t]));
    const cannotMove = scopeTaskIds.length > 0 && scopeTaskIds.every(id => tasksById.get(id)?.priority === 1000);

    const horizonIso = computeHorizonIso(fixedLoadByDay, placedByItem[libraryItemId] ?? {}, participants);
    const levelOptions: LevelingOptions = {
      constrainToFloat: false,
      scopeTaskIds,
      ...(cannotMove ? { preserveExistingLeveling: true } : {}),
      ...(doc.ceilingWorkdays !== null ? { overrunCeilingDays: doc.ceilingWorkdays } : {}),
      allowSplits: options.allowSplits,
      poolLedger: makeLedgerForDoc(doc, horizonIso),
    };
    const result = runLeveling(doc, levelOptions);

    const shortfalls: DistributionShortfall[] = Object.keys(result.unresolved).map(taskId => ({
      taskId,
      reason: result.unresolvedReasons[taskId],
      days: result.unresolved[taskId],
    }));

    results.push({
      docId: doc.docId,
      title: doc.title,
      participated: true,
      cannotMove,
      delays: result.delays,
      ...(result.delayMinutes ? { delayMinutes: result.delayMinutes } : {}),
      gaps: result.gaps,
      projectEndBefore: result.projectEndBefore,
      projectEndAfter: result.projectEndAfter,
      endShiftWorkdays: endShiftWorkdays(result.projectEndBefore, result.projectEndAfter, doc.calendar),
      shortfalls,
    });
  }

  const residualByDay: Record<string, number> = {};
  const placedThisItem = placedByItem[libraryItemId] ?? {};
  for (const iso of new Set([...Object.keys(fixedLoadByDay), ...Object.keys(placedThisItem)])) {
    residualByDay[iso] = residualOn(libraryItemId, iso);
  }

  const hasShortfall = results.some(d => d.shortfalls.length > 0);

  return {
    libraryItemId,
    blocked: null,
    docs: results,
    fixedLoadByDay,
    residualByDay,
    hasShortfall,
    bookingByDay,
    afterLoadByDay,
    afterIncomplete: hasShortfall,
  };
}
