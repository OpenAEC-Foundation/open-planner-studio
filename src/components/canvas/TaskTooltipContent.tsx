import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDisplayDate } from '@/hooks/displayDate';
import { useAppStore } from '@/state/appStore';
import { durationSuffixesFrom, effectiveCalendarOf, formatTaskDurationDisplay } from '@/utils/taskDuration';
import { Task } from '@/types/task';

/**
 * Eén label/waarde-regel van een hovertooltip. `colon={false}` voor een label dat zijn eigen
 * leesteken draagt; zonder `value` staat alleen het label er (bv. "sturend").
 */
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

/**
 * Inhoud van de taak-hovertooltip (naam, WBS, duur, start/finish, status, kritiek, total float) —
 * geëxtraheerd uit `GanttCanvas` (issue #58) zodat issue #65 'm kan hergebruiken vanuit het
 * eigenschappenpaneel: hover op de WBS-sprongknop bij een afhankelijkheid moet exact dezelfde
 * details tonen als hover over de taakbalk op het canvas. Puur een `{ task }`-in, JSX-uit —
 * de positionering (`HoverTooltip`) blijft aan de aanroeper.
 */
export function TaskTooltipContent({ task }: { task: Task }) {
  const { t: tTask, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const projectCalendar = useAppStore((s) => s.calendar);
  const calendars = useAppStore((s) => s.calendars);
  const durationDisplay = useAppStore((s) => s.ui.durationDisplay);
  const enableHourPlanning = useAppStore((s) => s.ui.enableHourPlanning);
  const dd = useDisplayDate();
  const duration = formatTaskDurationDisplay(
    task,
    effectiveCalendarOf(task, projectCalendar, calendars),
    durationDisplay,
    enableHourPlanning,
    durationSuffixesFrom(tCommon),
    i18n.language,
  );
  // Tooltip-datums volgen de datumnotatie-instelling (taak #53); leeg → '-'.
  const formatTooltipDate = (dateStr: string) => (dateStr ? dd.date(dateStr) : '-');

  return (
    <>
      <div className="tooltip-title">{task.name}</div>
      <TooltipRow label={tTask('table.wbs')} value={task.wbsCode || '-'} />
      <TooltipRow label={tTask('table.duration')} value={duration} />
      <TooltipRow label={tTask('table.start')} value={formatTooltipDate(task.time.earlyStart || task.time.scheduleStart)} />
      <TooltipRow label={tTask('table.finish')} value={formatTooltipDate(task.time.earlyFinish || task.time.scheduleFinish)} />
      <TooltipRow label={tTask('tooltip.status')} value={tTask(`taskStatus.${task.status}`, { defaultValue: task.status })} />
      <TooltipRow
        label={tTask('table.critical')}
        value={task.time.isCritical ? tCommon('yes') : tCommon('no')}
        valueClassName={task.time.isCritical ? 'tooltip-critical-yes' : 'tooltip-value'}
      />
      <TooltipRow label={tTask('properties.totalFloat')} value={`${task.time.totalFloat}d`} colon={false} />
    </>
  );
}
