export const ISO_WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Volgorde voor zichtbare weekdagbediening, volgens de bestaande eerste-weekdaginstelling. */
export function orderedWeekDays(weekStartDay: 'monday' | 'sunday'): readonly (typeof ISO_WEEK_DAYS)[number][] {
  return weekStartDay === 'sunday' ? [7, 1, 2, 3, 4, 5, 6] : ISO_WEEK_DAYS;
}
