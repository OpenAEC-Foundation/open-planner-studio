import { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';
import { HoverTooltip } from '@/components/canvas/HoverTooltip';
import { useAppStore } from '@/state/appStore';
import { saveEnableHourPlanning } from '@/utils/settingsStore';
import {
  formatTaskDurationInput,
  parseTaskDurationInput,
  proposeTaskDurationConversion,
  type ParsedTaskDuration,
} from '@/utils/taskDurationInput';
import { hasConcreteWorkBlocks } from '@/services/subdayIo';
import { effHoursPerDay } from '@/utils/taskDuration';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskDurationUnit } from '@/types/task';

function proposalText(proposal: ParsedTaskDuration): string {
  if (proposal.unit === 'days') return `${proposal.scheduleDuration ?? 0}d`;
  const minutes = proposal.durationMinutes ?? 0;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function TaskDurationField({ task, calendar, onChange }: {
  task: Task;
  calendar: WorkCalendar;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');
  const enableHourPlanning = useAppStore((s) => s.ui.enableHourPlanning);
  const setUI = useAppStore((s) => s.setUI);
  const seed = formatTaskDurationInput(task);
  const [value, setValue] = useState(seed);
  const [message, setMessage] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ParsedTaskDuration | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const infoId = useId();
  const derived = isZeroDurationMilestone(task) || task.childIds.length > 0 || !!task.isHammock;
  const hourEditBlocked = task.time.durationUnit === 'hours' && !enableHourPlanning;

  useEffect(() => {
    setValue(seed);
    // Een conversievoorstel hoort bij precies deze taak én kalenderwandeling. Zonder reset kon
    // een voorstel van taak A na selectie- of kalenderwissel nog op taak B worden toegepast.
    setProposal(null);
    setMessage(null);
  }, [task.id, seed, calendar]);

  const apply = (parsed: ParsedTaskDuration) => {
    const time = { ...task.time, durationUnit: parsed.unit };
    if (parsed.unit === 'days') {
      time.scheduleDuration = parsed.scheduleDuration ?? 0;
      time.durationMinutes = undefined;
    } else {
      const minutes = parsed.durationMinutes ?? 0;
      time.durationMinutes = minutes;
      const hpd = effHoursPerDay(calendar);
      time.scheduleDuration = hpd > 0 ? minutes / (hpd * 60) : 0;
    }
    onChange({ time });
    setProposal(null);
    setMessage(null);
  };

  const commitInput = () => {
    if (derived || hourEditBlocked) return;
    const parsed = parseTaskDurationInput(value, task.time.durationUnit);
    if (!parsed) {
      setMessage(t('duration.invalid'));
      setValue(seed);
      return;
    }
    if (parsed.unit === 'hours' && (!enableHourPlanning || !hasConcreteWorkBlocks(calendar))) {
      setMessage(!enableHourPlanning ? t('duration.enableHourPlanningFirst') : t('duration.requiresWorkBlocks'));
      setValue(seed);
      return;
    }
    apply(parsed);
  };

  const requestUnit = (target: TaskDurationUnit) => {
    if (target === task.time.durationUnit) return;
    if (target === 'hours' && !enableHourPlanning) {
      setMessage(t('duration.enableHourPlanningFirst'));
      return;
    }
    if (!hasConcreteWorkBlocks(calendar)) {
      setMessage(t('duration.requiresWorkBlocks'));
      return;
    }
    const next = proposeTaskDurationConversion(task, target, calendar);
    if (!next) {
      setProposal(null);
      setMessage(t('duration.conversionNotExact'));
      return;
    }
    setProposal(next);
    setMessage(t('duration.conversionProposal', { value: proposalText(next) }));
  };

  const enableHours = () => {
    setUI({ enableHourPlanning: true });
    void saveEnableHourPlanning(true);
    setMessage(null);
  };

  const syncInfoAnchor = () => {
    const rect = infoButtonRef.current?.getBoundingClientRect();
    if (rect) setInfoAnchor({ left: rect.left, top: rect.top, width: rect.width });
  };

  const showInfo = () => {
    syncInfoAnchor();
    setInfoVisible(true);
  };

  useEffect(() => {
    if (!infoVisible) return;
    window.addEventListener('resize', syncInfoAnchor);
    window.addEventListener('scroll', syncInfoAnchor, true);
    return () => {
      window.removeEventListener('resize', syncInfoAnchor);
      window.removeEventListener('scroll', syncInfoAnchor, true);
    };
  }, [infoVisible]);

  return (
    <div className="flex flex-col gap-1.5" data-ops-task-duration>
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commitInput}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              (event.currentTarget as HTMLInputElement).blur();
            }
          }}
          disabled={derived || hourEditBlocked}
          aria-label={t('duration.label')}
          className="input h-9 min-w-0 flex-1 !px-2.5 !py-0 !text-xs disabled:opacity-50"
          data-ops-duration-value
        />
        <div className="w-20 shrink-0">
          <Select
            aria-label={t('duration.unit')}
            className="ops-select__trigger--duration"
            value={task.time.durationUnit}
            onChange={(next) => requestUnit(next as TaskDurationUnit)}
            disabled={derived || hourEditBlocked}
            options={[
              { value: 'days', label: t('duration.days') },
              { value: 'hours', label: t('duration.hours') },
            ]}
          />
        </div>
        <span className="inline-flex aspect-square shrink-0 self-stretch">
          <button
            ref={infoButtonRef}
            type="button"
            className="inline-flex h-full w-full items-center justify-center rounded-[5px] text-text-secondary hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            aria-label={t('duration.unitInfo')}
            aria-describedby={infoVisible ? infoId : undefined}
            onMouseEnter={showInfo}
            onMouseLeave={() => setInfoVisible(false)}
            onFocus={showInfo}
            onBlur={() => setInfoVisible(false)}
            data-ops-duration-info
          >
            <Info size={14} aria-hidden="true" />
          </button>
          {infoVisible && infoAnchor && (
            <HoverTooltip
              left={infoAnchor.left}
              top={infoAnchor.top}
              placement="before-anchor"
              anchorWidth={infoAnchor.width}
              className="duration-unit-tooltip"
              id={infoId}
            >
              {t('duration.unitInfo')}
            </HoverTooltip>
          )}
        </span>
      </div>
      {hourEditBlocked && (
        <div className="text-[10px] text-text-secondary" data-ops-duration-hour-planning-blocked>
          {t('duration.enableHourPlanningFirst')}{' '}
          <button type="button" className="underline" onClick={enableHours}>{t('duration.enableHourPlanning')}</button>
        </div>
      )}
      {message && (
        <div className="text-[10px] text-text-secondary" role="status" data-ops-duration-message>
          {message}
          {proposal && (
            <span className="ml-1.5 inline-flex gap-1">
              <button type="button" className="underline" onClick={() => apply(proposal)}>{t('duration.applyProposal')}</button>
              <button type="button" className="underline" onClick={() => { setProposal(null); setMessage(null); }}>{t('duration.keepCurrent')}</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
