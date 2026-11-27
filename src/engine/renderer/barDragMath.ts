import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { addCalendarDays } from '@/utils/dateUtils';

export function shiftByDisplayedColumns(
  calendarEngine: CalendarEngine,
  date: Date,
  colDelta: number,
  compressed: boolean,
): Date {
  return compressed ? calendarEngine.addWorkingDaysSigned(date, colDelta) : addCalendarDays(date, colDelta);
}
