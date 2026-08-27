import { useEffect, useId, useState } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';
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
  const infoId = useId();
  const derived = isZeroDurationMilestone(task) || task.childIds.length > 0 || !!task.isHammock;
  const hourEditBlocked = task.time.durationUnit === 'hours' && !enableHourPlanning;

  useEffect(() => setValue(seed), [seed]);

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

  return (
    <div className="flex flex-col gap-1.5" data-ops-task-duration>
      <div className="flex items-center gap-1.5">
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
          className="input !text-xs !px-2.5 !py-1.5 min-w-0 flex-1 disabled:opacity-50"
          data-ops-duration-value
        />
        <Select
          aria-label={t('duration.unit')}
          value={task.time.durationUnit}
          onChange={(next) => requestUnit(next as TaskDurationUnit)}
          disabled={derived || hourEditBlocked}
          options={[
            { value: 'days', label: t('duration.days') },
            { value: 'hours', label: t('duration.hours') },
          ]}
        />
        <span className="relative inline-flex">
          <button
            type="button"
            className="p-1 rounded-[5px] text-text-secondary hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            aria-label={t('duration.unitInfo')}
            aria-describedby={infoVisible ? infoId : undefined}
            onMouseEnter={() => setInfoVisible(true)}
            onMouseLeave={() => setInfoVisible(false)}
            onFocus={() => setInfoVisible(true)}
            onBlur={() => setInfoVisible(false)}
            data-ops-duration-info
          >
            <Info size={14} aria-hidden="true" />
          </button>
          {infoVisible && (
            <span
              id={infoId}
              role="tooltip"
              className="absolute right-0 top-full z-[10000] mt-1 w-[min(260px,calc(100vw-24px))] rounded-[5px] border border-border bg-surface px-2 py-1 text-[11px] normal-case leading-[1.3] text-text shadow-lg"
            >
              {t('duration.unitInfo')}
            </span>
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
