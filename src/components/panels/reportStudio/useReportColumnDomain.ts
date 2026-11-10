import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { createTaskGridAdapterDomain, type TaskGridAdapterDomain } from '@/engine/taskGrid/taskGridAdapter';
import { resolveColumnLabel } from '@/engine/taskGrid/columnLabel';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { signedWorkDaysBetween } from '@/engine/variance';
import { createBaselineOldDayCheck } from '@/engine/baselineOldDay';
import { recordedGridBinding } from '@/state/recordedDatesSelectors';
import { useEffectiveDurationDisplay, useProfileCountsWorkdays } from '@/hooks/useDurationMeasure';

/**
 * Het kolomregister van het taakraster, voor de kolommen van de Gantt-afdruk (issue #817 deel B).
 *
 * Dezelfde domeininvoer als `TaskGridSurface` in `FullTaskGrid.tsx` (zonder de spookregel en de
 * editors: de afdruk bewerkt niets), zodat een kolom op papier precies de tekst en de kop van de tabel
 * draagt. Wijzig je daar een invoer die de celtekst raakt, wijzig hem dan ook hier.
 */
export function useReportColumnDomain(): { domain: TaskGridAdapterDomain; labelForColumn: (key: string) => string } {
  const { t: tTask, i18n: taskI18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const assignments = useAppStore(s => s.assignments);
  const resources = useAppStore(s => s.resources);
  const baselines = useAppStore(s => s.baselines);
  const activityCodeTypes = useAppStore(s => s.activityCodeTypes);
  const customFieldDefs = useAppStore(s => s.customFieldDefs);
  const customTaskTypes = useAppStore(s => s.customTaskTypes);
  const project = useAppStore(s => s.project);
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  const scheduleStale = useAppStore(s => s.scheduleStale);
  const showTaskTypes = useAppStore(s => s.ui.showTaskTypes);
  const taskTypesVisible = useAppStore(s => s.taskTypesVisible);
  const cpmResult = useAppStore(s => s.cpmResult);
  const recordedDates = useAppStore(s => s.recordedDates);
  const datesAsRecorded = useAppStore(s => s.datesAsRecorded);
  const dateNotation = useAppStore(s => s.ui.dateNotation);
  const timeNotation = useAppStore(s => s.ui.timeNotation);
  const durationDisplay = useEffectiveDurationDisplay();
  const countsWorkdays = useProfileCountsWorkdays();
  const textDirection = taskI18n.dir() === 'rtl' ? 'rtl' : 'ltr';

  const labelForColumn = useCallback(
    (labelKey: string) => resolveColumnLabel(labelKey, key => tTask(key, { defaultValue: key })),
    [tTask],
  );
  const calendarEngine = useMemo(() => new CalendarEngine(calendar), [calendar]);
  const calendarOptions = useMemo(() => [
    { value: '', label: tTask('properties.calendarProject') + ': ' + calendar.name },
    ...[calendar, ...calendars]
      .filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index)
      .map(item => ({ value: item.id, label: item.name })),
  ], [calendar, calendars, tTask]);

  const domain = useMemo(() => createTaskGridAdapterDomain({
    projectId: project.id,
    tasks,
    sequences,
    cpmResult,
    assignments,
    resources,
    baselines,
    activityCodeTypes,
    customFieldDefs,
    customTaskTypes,
    scheduleStale,
    wbsAutoNumber: project.wbsAutoNumber === true,
    dateNotation,
    timeNotation,
    calendarOptions,
    durationDisplay,
    workdayDurationMeasure: countsWorkdays,
    numberLocale: taskI18n.language,
    effectiveHoursPerDay: task => effHoursPerDay(effectiveCalendarOf(task, calendar, calendars)),
    effectiveCalendar: task => effectiveCalendarOf(task, calendar, calendars),
    signedWorkDaysBetween: (fromIso, toIso) => signedWorkDaysBetween(calendarEngine, fromIso, toIso),
    baselineOldDay: createBaselineOldDayCheck(calendar, calendars),
    ...recordedGridBinding(recordedDates, datesAsRecorded),
    taskTypesUnlocked: showTaskTypes || taskTypesVisible,
    defaultWorkRule: project.defaultWorkRule,
    labelForColumn,
    labelForBoolean: value => tCommon(value ? 'yes' : 'no'),
    labelForText: (key, values) => key.startsWith('resource.curve.') || key.startsWith('duration.')
      || key.startsWith('recordedDates.')
      ? tCommon(key, { ...values, defaultValue: key })
      : tTask(key, { ...values, defaultValue: key }),
    textDirection,
  }), [
    activityCodeTypes, assignments, baselines, calendar, calendarEngine, calendarOptions, calendars, cpmResult,
    customFieldDefs, customTaskTypes, datesAsRecorded, dateNotation, timeNotation, durationDisplay, countsWorkdays,
    project.id, project.defaultWorkRule, project.wbsAutoNumber, recordedDates, resources, scheduleStale, sequences,
    showTaskTypes, taskTypesVisible, tCommon, tTask, taskI18n.language, tasks, textDirection, labelForColumn,
  ]);
  return { domain, labelForColumn };
}
