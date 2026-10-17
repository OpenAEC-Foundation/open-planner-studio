import { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';
import { HoverTooltip } from '@/components/canvas/HoverTooltip';
import { StatusBanner } from '@/components/panels/StatusBanner';
import { useAppStore } from '@/state/appStore';
import { saveEnableHourPlanning } from '@/utils/settingsStore';
import { applySetting } from '@/components/settings/applySetting';
import {
  formatTaskDurationInput,
  parseTaskDurationInput,
  convertTaskDurationUnit,
  type ParsedTaskDuration,
} from '@/utils/taskDurationInput';
import { hasConcreteWorkBlocks } from '@/services/subdayIo';
import { hourTaskScheduleDuration } from '@/utils/taskDuration';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import type { WorkCalendar } from '@/types/calendar';
import type { Task, TaskDurationUnit } from '@/types/task';

/** De duur zoals het duurveld hem noemt, bijv. `12h` of `12h 30m`; voor de niet-exactmelding. */
function durationText(task: Task): string {
  if (task.time.durationUnit === 'days') return `${task.time.scheduleDuration}d`;
  const minutes = task.time.durationMinutes ?? 0;
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
  const allowMixedDayHour = useAppStore((s) => s.ui.allowMixedDayHour);
  const seed = formatTaskDurationInput(task);
  const [value, setValue] = useState(seed);
  const [message, setMessage] = useState<string | null>(null);
  // Eigenaar (2026-10-12): een niet-exacte omzetting is een duidelijk gekleurd blok, geen toast en
  // geen kleine grijze tekst. Het blok verdwijnt bij een andere taak, een nieuwe waarde of een
  // geslaagde omzetting.
  const [notExact, setNotExact] = useState<string | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const awaitFreshInfoHover = useRef(false);
  const infoId = useId();
  // Telt elke doorgegeven wijziging. Na `onChange` toont het veld altijd weer de echte duur van de
  // taak: ook als de store de wijziging weigert (bv. korter dan het gedane werk). Dan verandert
  // `seed` niet, en zonder deze teller bleef het getypte getal staan tot een andere taak gekozen werd.
  const [commitTick, setCommitTick] = useState(0);
  const derived = isZeroDurationMilestone(task) || task.childIds.length > 0 || !!task.isHammock;
  const hourEditBlocked = task.time.durationUnit === 'hours' && !enableHourPlanning;
  const showUnitControls = enableHourPlanning && allowMixedDayHour;

  // Een knop die precies onder een stilstaande muis terugkomt, krijgt van React opnieuw een
  // mouseenter zonder dat de gebruiker opnieuw heeft gehoverd. Eis daarom eerst een echte leave;
  // focus blijft wel meteen een geldige, afzonderlijke toetsenbordactie.
  useEffect(() => {
    if (!showUnitControls) {
      awaitFreshInfoHover.current = true;
      setInfoVisible(false);
    }
  }, [showUnitControls]);

  useEffect(() => {
    setValue(seed);
    // Een melding hoort bij precies deze taak en kalender; na een selectie- of kalenderwissel weg.
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
    if (derived || hourEditBlocked) return;
    setNotExact(null);
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
    setNotExact(null);
    if (target === 'hours' && !enableHourPlanning) {
      setMessage(t('duration.enableHourPlanningFirst'));
      return;
    }
    if (!hasConcreteWorkBlocks(calendar)) {
      setMessage(t('duration.requiresWorkBlocks'));
      return;
    }
    // De gekozen eenheid geldt meteen: een exacte omzetting wordt direct toegepast, als één
    // wijziging (één undo-stap), net als in het taakraster. Niet exact ⇒ melding, eenheid blijft.
    const next = convertTaskDurationUnit(task, target, calendar);
    if (!next) {
      setMessage(null);
      setNotExact(durationText(task));
      return;
    }
    apply(next);
  };

  const enableHours = () => {
    applySetting('enableHourPlanning', true, saveEnableHourPlanning);
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

  const showInfoOnHover = () => {
    if (awaitFreshInfoHover.current) return;
    showInfo();
  };

  // Na het terugplaatsen van de bediening kan de browser een verlate mouseenter afleveren voor
  // de positie die al onder de cursor lag. Een daadwerkelijke pointerbeweging op de nieuwe knop is
  // wél nieuwe interactie en heft die wachttijd op; zo blijft de tooltip na herinschakelen dicht,
  // maar werkt de eerstvolgende echte hover zonder een tweede rondje.
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
                onMouseEnter={showInfoOnHover}
                onMouseLeave={hideInfoOnMouseLeave}
                onPointerMove={showInfoOnPointerMove}
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
          </>
        )}
      </div>
      {hourEditBlocked && (
        <div className="!text-small text-text-secondary" data-ops-duration-hour-planning-blocked>
          {t('duration.enableHourPlanningFirst')}{' '}
          <button type="button" className="underline" onClick={enableHours}>{t('duration.enableHourPlanning')}</button>
        </div>
      )}
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
