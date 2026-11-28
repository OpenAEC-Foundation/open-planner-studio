import type { Task, TaskConstraint } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { isSummaryTask } from '@/utils/taskHierarchy';
import type { CalendarEngine } from './CalendarEngine';
import { resolveCalendar } from './resolveCalendar';
import { engineForTaskCalendar, snapWorkInstantOnOrAfter } from './CPMSolver';
import { shiftIso } from '../moveProject';
import { parseDate, parseInstant, formatInstant, diffDays, type DateMode } from '@/utils/dateUtils';

function hasForwardConstraint(c: TaskConstraint | undefined): boolean {
  return !!c && !!c.date && (c.type === 'SNET' || c.type === 'MSO' || c.type === 'FNET' || c.type === 'MFO');
}

export interface ClampProjectStartAnchorsInput {
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkCalendar;
  calendars: WorkCalendar[];
  prevStartDate: string;
  nextStartDate: string;
}

export function clampProjectStartAnchors(input: ClampProjectStartAnchorsInput): number {
  const nextRaw = parseDate(input.nextStartDate);
  const prevRaw = parseDate(input.prevStartDate);
  if (isNaN(nextRaw.getTime()) || isNaN(prevRaw.getTime())) return 0;
  if (nextRaw.getTime() <= prevRaw.getTime()) return 0;

  const hasPredecessor = new Set(input.sequences.map((seq) => seq.successorId));
  const engineCache = new Map<string, CalendarEngine>();

  let clamped = 0;
  for (const t of input.tasks) {
    if (isSummaryTask(t)) continue;
    if (t.isHammock) continue;
    if (hasPredecessor.has(t.id)) continue;
    if (hasForwardConstraint(t.constraint)) continue;
    if (hasForwardConstraint(t.constraint2)) continue;

    const eng = engineForTaskCalendar(engineCache, resolveCalendar(t.calendarId, input.calendars, input.calendar));
    const mode: DateMode = eng.isHourMode ? 'hour' : 'day';
    const own = eng.isHourMode ? parseInstant(t.time.scheduleStart) : parseDate(t.time.scheduleStart);
    if (isNaN(own.getTime())) continue;
    const floor = snapWorkInstantOnOrAfter(eng, nextRaw);
    if (own.getTime() >= floor.getTime()) continue;

    const newAnchorIso = formatInstant(floor, mode);
    const deltaDays = diffDays(t.time.scheduleStart, newAnchorIso);
    t.time.scheduleStart = newAnchorIso;
    t.time.scheduleFinish = shiftIso(t.time.scheduleFinish, deltaDays);
    clamped++;
  }
  return clamped;
}
