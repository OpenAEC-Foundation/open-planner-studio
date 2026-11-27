import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTaskDateText } from '@/hooks/displayDate';
import { useEffectiveDurationDisplay } from '@/hooks/useDurationMeasure';
import { useAppStore } from '@/state/appStore';
import { durationSuffixesFrom, effectiveCalendarOf, formatTaskDurationDisplay, formatWorkDaysText } from '@/utils/taskDuration';
import { Task } from '@/types/task';
import { shownFinish, shownStart } from '@/utils/taskDates';

export function TooltipRow({ label, value, valueClassName = 'tooltip-value', colon = true }: {
  label: string;
  value?: ReactNode;
  valueClassName?: string;
  colon?: boolean;
}) {
  return (
    <div className="tooltip-row">
      <span className="tooltip-label">{label}{colon && ':'}</span>
      {value !== undefined && <span className={valueClassName}>{value}</span>}
    </div>
  );
}

export function TaskTooltipContent({ task }: { task: Task }) {
  const { t: tTask, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const projectCalendar = useAppStore((s) => s.calendar);
  const calendars = useAppStore((s) => s.calendars);
  const durationDisplay = useEffectiveDurationDisplay();

  const taskDate = useTaskDateText();
  const suffixes = durationSuffixesFrom(tCommon);
  const duration = formatTaskDurationDisplay(
    task,
    effectiveCalendarOf(task, projectCalendar, calendars),
    durationDisplay,
    suffixes,
    i18n.language,
  );
  const formatTooltipDate = (dateStr: string, side: 'start' | 'end') => taskDate(task, dateStr, side) || '-';

  return (
    <>
      <div className="tooltip-title">{task.name}</div>
      <TooltipRow label={tTask('table.wbs')} value={task.wbsCode || '-'} />
      <TooltipRow label={tTask('table.duration')} value={duration} />
      <TooltipRow label={tTask('table.start')} value={formatTooltipDate(shownStart(task), 'start')} />
      <TooltipRow label={tTask('table.finish')} value={formatTooltipDate(shownFinish(task), 'end')} />
      <TooltipRow label={tTask('tooltip.status')} value={tTask(`taskStatus.${task.status}`, { defaultValue: task.status })} />
      <TooltipRow
        label={tTask('table.critical')}
        value={task.time.isCritical ? tCommon('yes') : tCommon('no')}
        valueClassName={task.time.isCritical ? 'tooltip-critical-yes' : 'tooltip-value'}
      />
      <TooltipRow
        label={tTask('properties.totalFloat')}
        value={formatWorkDaysText(task.time.totalFloat, { suffixes, locale: i18n.language })}
        colon={false}
      />
    </>
  );
}

export function MilestoneGroupTooltipContent({ tasks }: { tasks: readonly Task[] }) {
  const { t: tTask } = useTranslation('task');
  const taskDate = useTaskDateText();
  return (
    <>
      <div className="tooltip-title">{tTask('table.milestonesRun', { n: tasks.length })}</div>
      {tasks.map(task => (
        <TooltipRow key={task.id} label={task.name} value={taskDate(task, shownFinish(task) || shownStart(task), 'end') || '-'} />
      ))}
    </>
  );
}
