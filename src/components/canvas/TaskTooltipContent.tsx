import { useTranslation } from 'react-i18next';
import { useDisplayDate } from '@/hooks/displayDate';
import { Task } from '@/types/task';

/**
 * Inhoud van de taak-hovertooltip (naam, WBS, duur, start/finish, status, kritiek, total float) —
 * geëxtraheerd uit `GanttCanvas` (issue #58) zodat issue #65 'm kan hergebruiken vanuit het
 * eigenschappenpaneel: hover op de WBS-sprongknop bij een afhankelijkheid moet exact dezelfde
 * details tonen als hover over de taakbalk op het canvas. Puur een `{ task }`-in, JSX-uit —
 * de positionering (`HoverTooltip`) blijft aan de aanroeper.
 */
export function TaskTooltipContent({ task }: { task: Task }) {
  const { t: tTask } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const dd = useDisplayDate();
  // Tooltip-datums volgen de datumnotatie-instelling (taak #53); leeg → '-'.
  const formatTooltipDate = (dateStr: string) => (dateStr ? dd.date(dateStr) : '-');

  return (
    <>
      <div className="tooltip-title">{task.name}</div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('table.wbs')}:</span>
        <span className="tooltip-value">{task.wbsCode || '-'}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('table.duration')}:</span>
        <span className="tooltip-value">{task.time.scheduleDuration}d</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('table.start')}:</span>
        <span className="tooltip-value">{formatTooltipDate(task.time.earlyStart || task.time.scheduleStart)}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('table.finish')}:</span>
        <span className="tooltip-value">{formatTooltipDate(task.time.earlyFinish || task.time.scheduleFinish)}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('tooltip.status')}:</span>
        <span className="tooltip-value">{task.status}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('table.critical')}:</span>
        <span className={task.time.isCritical ? 'tooltip-critical-yes' : 'tooltip-value'}>
          {task.time.isCritical ? tCommon('yes') : tCommon('no')}
        </span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('properties.totalFloat')}</span>
        <span className="tooltip-value">{task.time.totalFloat}d</span>
      </div>
    </>
  );
}
