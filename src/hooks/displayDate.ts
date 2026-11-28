import { useMemo } from 'react';
import { useAppStore } from '@/state/appStore';
import type { DateNotation, TimeNotation } from '@/types/view';
import { displayDate, displayDateTime } from '@/utils/displayDate';
import type { InstantSide } from '@/engine/calendar/workdayRules';
import type { Task } from '@/types/task';
import { taskDateLabelIn, type TaskDateLabelOptions } from '@/utils/taskDateLabel';

export function useDateNotation(): DateNotation {
  return useAppStore(s => s.ui.dateNotation);
}

export function useTimeNotation(): TimeNotation {
  return useAppStore(s => s.ui.timeNotation);
}

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

export type TaskDateText = (task: Task, value: string | undefined, side: InstantSide, opts?: TaskDateLabelOptions) => string;

export function useTaskDateText(): TaskDateText {
  const dd = useDisplayDate();
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  return useMemo<TaskDateText>(
    () => (task, value, side, opts) => (value ? dd.dateTime(taskDateLabelIn(task, value, side, { calendar, calendars }, opts)) : ''),
    [dd, calendar, calendars],
  );
}

export type TaskIdDateText = (taskId: string, value: string | undefined, side: InstantSide, opts?: TaskDateLabelOptions) => string;

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
