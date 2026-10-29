import { useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import type { DateNotation, TimeNotation } from '@/types/view';
import { displayDate, displayDateTime } from '@/utils/displayDate';
import type { InstantSide } from '@/engine/calendar/workdayRules';
import type { Task } from '@/types/task';
import { taskDateLabelIn, type TaskDateLabelOptions } from '@/utils/taskDateLabel';

/**
 * React-hooks rond de datum-weergaveformatters. Deze leven in `src/hooks/` (niet in
 * `src/utils/`) omdat ze op de Zustand-store subscriben; de pure formatters zelf blijven in
 * `@/utils/displayDate`.
 */

/** Reactieve toegang tot de huidige notatie-instelling (hertekent bij wijziging). */
export function useDateNotation(): DateNotation {
  return useAppStore(s => s.ui.dateNotation);
}

/** Reactieve toegang tot de instelling Tijdnotatie (24 of 12 uur; hertekent bij wijziging). */
export function useTimeNotation(): TimeNotation {
  return useAppStore(s => s.ui.timeNotation);
}

/**
 * Reactieve formatters gebonden aan de huidige instelling. Componenten lezen zo de notatie via
 * de store-hook (niet via een module-constante), zodat ze live hertekenen bij een wijziging.
 */
export function useDisplayDate(): {
  date: (iso: string | undefined) => string;
  dateTime: (iso: string | undefined) => string;
} {
  const notation = useDateNotation();
  const timeNotation = useTimeNotation();
  return useMemo(() => ({
    date: (iso: string | undefined) => displayDate(iso, notation),
    dateTime: (iso: string | undefined) => displayDateTime(iso, notation, timeNotation),
  }), [notation, timeNotation]);
}

/** Toont een taakdatum. `side`: startachtig of eindachtig veld. */
export type TaskDateText = (task: Task, value: string | undefined, side: InstantSide, opts?: TaskDateLabelOptions) => string;

/**
 * Taakdatums volgens besluit B4 (spec "alleen uren"): een tijd alleen als het moment midden op de werkdag
 * valt, in de kalender van de taak (`taskDateLabel`). Leeg blijft leeg.
 */
export function useTaskDateText(): TaskDateText {
  const dd = useDisplayDate();
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  return useMemo<TaskDateText>(
    () => (task, value, side, opts) => (value ? dd.dateTime(taskDateLabelIn(task, value, side, { calendar, calendars }, opts)) : ''),
    [dd, calendar, calendars],
  );
}

/** Toont een datum van de taak met deze id volgens B4; een onbekende id toont alleen de datum. */
export type TaskIdDateText = (taskId: string, value: string | undefined, side: InstantSide, opts?: TaskDateLabelOptions) => string;

/** {@link useTaskDateText} voor rapportrijen, die een taak-id dragen en geen taak. */
export function useTaskIdDateText(): TaskIdDateText {
  const dd = useDisplayDate();
  const taskDate = useTaskDateText();
  const tasks = useAppStore(s => s.tasks);
  return useMemo<TaskIdDateText>(() => {
    const byId = new Map(tasks.map(task => [task.id, task]));
    return (taskId, value, side, opts) => {
      const task = byId.get(taskId);
      return task ? taskDate(task, value, side, opts) : dd.date(value);
    };
  }, [dd, taskDate, tasks]);
}
