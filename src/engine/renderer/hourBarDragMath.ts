import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';

export interface HourBarDragInput {
  calendar: CalendarEngine;
  edge: 'left' | 'right' | 'body';
  originalStart: Date;
  originalFinish: Date;
  originalDurationMinutes: number;
  /** De aspositie bij pointer-down en de actuele positie. Beide komen uit dezelfde GanttAxis. */
  pointerStart: Date;
  pointerCurrent: Date;
  /** De actieve minor-tier: dag, uur of kwartier. */
  snapMinutes: number;
}

export interface HourBarDragResult {
  start: Date;
  finish: Date;
  durationMinutes: number;
}

function snappedDeltaMs(from: Date, to: Date, snapMinutes: number): number {
  const quantumMs = Math.max(1, snapMinutes) * 60_000;
  return Math.round((to.getTime() - from.getTime()) / quantumMs) * quantumMs;
}

/**
 * Reken de nieuwe positie of omvang van een urentaak uit vanuit één gedeelde CalendarEngine.
 *
 * De Gantt-as levert uitsluitend de visuele verplaatsing. Alle domeinsemantiek — pauzes, nachten,
 * weekenden, feestdagen en uitzonderingen — blijft vervolgens bij CalendarEngine. Zo kan een
 * drag nooit een klokspan als gewerkte duur wegschrijven die CPM later anders zou interpreteren.
 */
export function resolveHourBarDrag(input: HourBarDragInput): HourBarDragResult {
  const {
    calendar,
    edge,
    originalStart,
    originalFinish,
    originalDurationMinutes,
    pointerStart,
    pointerCurrent,
    snapMinutes,
  } = input;
  const deltaMs = snappedDeltaMs(pointerStart, pointerCurrent, snapMinutes);
  // Verplaatsen verandert de duur nooit, ook niet als een bestaand/importbestand een taak van
  // minder dan een uur draagt. Resizen klemt wel op de fijnste beschikbare editorstap: 15 min op
  // kwartierzoom, anders het bestaande minimum van één uur.
  const durationMinutes = Math.max(1, Math.round(originalDurationMinutes));
  const minimumResizeMinutes = snapMinutes <= 15 ? 15 : 60;

  if (edge === 'body') {
    const candidate = new Date(originalStart.getTime() + deltaMs);
    const start = calendar.nextWorkInstant(candidate);
    return {
      start,
      finish: calendar.addWorkMinutes(start, durationMinutes),
      durationMinutes,
    };
  }

  if (edge === 'right') {
    const candidate = calendar.nextWorkInstant(new Date(originalFinish.getTime() + deltaMs));
    const nextDuration = Math.max(
      minimumResizeMinutes,
      Math.round(calendar.workMinutesBetween(originalStart, candidate)),
    );
    return {
      start: new Date(originalStart.getTime()),
      finish: calendar.addWorkMinutes(originalStart, nextDuration),
      durationMinutes: nextDuration,
    };
  }

  const candidate = calendar.nextWorkInstant(new Date(originalStart.getTime() + deltaMs));
  const nextDuration = Math.max(
    minimumResizeMinutes,
    Math.round(calendar.workMinutesBetween(candidate, originalFinish)),
  );
  return {
    start: calendar.subtractWorkMinutes(originalFinish, nextDuration),
    finish: new Date(originalFinish.getTime()),
    durationMinutes: nextDuration,
  };
}
