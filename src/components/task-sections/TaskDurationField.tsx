import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';
import { HoverTooltip } from '@/components/canvas/HoverTooltip';
import { StatusBanner } from '@/components/panels/StatusBanner';
import { useAppStore } from '@/state/appStore';
import {
  formatTaskDurationInput,
  parseTaskDurationInput,
  convertTaskDurationUnit,
  taskDurationInputContext,
  type ParsedTaskDuration,
} from '@/utils/taskDurationInput';
import { durationSuffixesFrom, effHoursPerDay, formatTaskDurationText, hourTaskScheduleDuration } from '@/utils/taskDuration';
import { localizeDecimalPoint } from '@/utils/reportNumber';
import { useEffectiveDurationDisplay, useProfileCountsWorkdays } from '@/hooks/useDurationMeasure';
import { effectiveWorkRule, workRuleApplies } from '@/engine/work/workRuleApply';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskDurationUnit } from '@/types/task';

export function TaskDurationField({ task, calendar, onChange }: {
  task: Task;
  calendar: WorkCalendar;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const allowMixedDayHour = useAppStore((s) => s.ui.allowMixedDayHour);
  const defaultWorkRule = useAppStore((s) => s.project.defaultWorkRule);
  const countsWorkdays = useProfileCountsWorkdays();
  const display = useEffectiveDurationDisplay();
  const hoursPerDay = effHoursPerDay(calendar);
  const inputContext = taskDurationInputContext(task, { countsWorkdays, hoursPerDay, display });
  const seed = localizeDecimalPoint(formatTaskDurationInput(task, {
    shownUnit: inputContext.shownUnit, hoursPerDay: inputContext.hoursPerDay,
  }), i18n.language);
  const fixedWork = workRuleApplies(task) && effectiveWorkRule(task, defaultWorkRule) === 'FIXED_WORK';
  const [value, setValue] = useState(seed);
  const [message, setMessage] = useState<string | null>(null);
  const [notExact, setNotExact] = useState<string | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const awaitFreshInfoHover = useRef(false);
  const infoId = useId();
  const [commitTick, setCommitTick] = useState(0);
  const derived = isZeroDurationMilestone(task) || task.childIds.length > 0 || !!task.isHammock;
  const showUnitControls = allowMixedDayHour;

  useEffect(() => {
    if (!showUnitControls) {
      awaitFreshInfoHover.current = true;
      setInfoVisible(false);
    }
  }, [showUnitControls]);

  useEffect(() => {
    setValue(seed);
    setMessage(null);
    setNotExact(null);
  }, [task.id, seed, calendar, commitTick]);

  const apply = (parsed: ParsedTaskDuration) => {
    const time = { ...task.time, durationUnit: parsed.unit };
    if (parsed.unit === 'days') {
      time.scheduleDuration = parsed.scheduleDuration ?? 0;
      time.durationMinutes = undefined;
    } else {
      const minutes = parsed.durationMinutes ?? 0;
      time.durationMinutes = minutes;
      time.scheduleDuration = hourTaskScheduleDuration(minutes, calendar);
    }
    onChange({ time });
    setMessage(null);
    setNotExact(null);
    setCommitTick((n) => n + 1);
  };

  const commitInput = () => {
    if (derived) return;
    setNotExact(null);
    const parsed = parseTaskDurationInput(value, task.time.durationUnit, inputContext);
    if (!parsed) {
      setMessage(t('duration.invalid'));
      setValue(seed);
      return;
    }
    apply(parsed);
  };

  const requestUnit = (target: TaskDurationUnit) => {
    if (target === task.time.durationUnit) return;
    if (target === 'days' && fixedWork) return;
    setNotExact(null);
    const next = convertTaskDurationUnit(task, target, calendar, { workdayDurationMeasure: countsWorkdays });
    if (!next) {
      setMessage(null);
      setNotExact(formatTaskDurationText(task, hoursPerDay, { suffixes: durationSuffixesFrom(tCommon), locale: i18n.language }));
      return;
    }
    apply(next);
  };


  const syncInfoAnchor = () => {
    const rect = infoButtonRef.current?.getBoundingClientRect();
    if (rect) setInfoAnchor({ left: rect.left, top: rect.top, width: rect.width });
  };

  const showInfo = () => {
    syncInfoAnchor();
    setInfoVisible(true);
  };

  const showInfoOnHover = () => {
    if (awaitFreshInfoHover.current) return;
    showInfo();
  };

  const showInfoOnPointerMove = () => {
    if (!awaitFreshInfoHover.current) return;
    awaitFreshInfoHover.current = false;
    showInfo();
  };

  const hideInfoOnMouseLeave = () => {
    awaitFreshInfoHover.current = false;
    setInfoVisible(false);
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
          onFocus={event => {
            if (event.currentTarget.dataset.opsRefocus !== 'true') event.currentTarget.select();
          }}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commitInput}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              (event.currentTarget as HTMLInputElement).blur();
            }
          }}
          disabled={derived}
          aria-label={t('duration.label')}
          className="input h-9 min-w-0 flex-1 !px-2.5 !py-0 !text-small !leading-4 disabled:opacity-50"
          data-ops-duration-value
        />
        {showUnitControls && (
          <>
            <div className="shrink-0">
              <Select
                aria-label={t('duration.unit')}
                className="ops-select__trigger--duration"
                fitWidestOption
                value={task.time.durationUnit}
                onChange={(next) => requestUnit(next as TaskDurationUnit)}
                disabled={derived}
                options={[
                  { value: 'days', label: t('duration.days'), disabled: fixedWork },
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
                onMouseEnter={showInfoOnHover}
                onMouseLeave={hideInfoOnMouseLeave}
                onPointerMove={showInfoOnPointerMove}
                onFocus={showInfo}
                onBlur={() => setInfoVisible(false)}
                data-ops-duration-info
              >
                <Icon id="help.context-hint" size={14} aria-hidden="true" />
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
          </>
        )}
      </div>
      {notExact && (
        <StatusBanner tone="warning" inline bannerProps={{ 'data-ops-duration-not-exact': true }}>
          <span className="!text-small">{t('duration.conversionNotExact', { value: notExact })}</span>
        </StatusBanner>
      )}
      {message && (
        <div className="!text-small text-text-secondary" role="status" data-ops-duration-message>
          {message}
        </div>
      )}
    </div>
  );
}
