import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import type { WorkCalendar } from '@/types/calendar';
import { isHourCalendar } from '@/services/subdayIo';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { Task } from '@/types/task';
import { DateTextInput } from '@/components/common/DateTextInput';
import { formatDuration } from '@/utils/durationFormat';
import { Field, Input, HourDurationField } from './shared';

/**
 * Start + duur (dag/uur-boxen) — sectie 4 uit `TaskPropertiesPanel` (fase 2.10, item 2), exact
 * de bestaande paneel-JSX, ongewijzigd gedrag.
 *
 * LET OP (KRITIEK spec-risico, item 2-voorstel): dit is een PANEL-ONLY sectie. `TaskDialog` deelt
 * deze component NIET — de dialoog heeft een eigen, dialoogspecifieke duur-UI (drie gesyncte
 * dagen/uren/totaal-vakjes) mét een subtiele Save-tijd-commit-regel ("scheduleStart alleen bijwerken
 * als de gebruiker die daadwerkelijk wijzigde", "duur-bron behouden tenzij gewijzigd") die WEL bij de
 * dialoog-specifieke code hoort en NIET verplaatst mag worden (zie ontwerp-doc, item 2). Instant-apply
 * hier zou die drift-preventie-logica breken. Hammock-toggle/-info staat apart in
 * `TaskHammockFields` (WEL gedeeld — puur informatief, geen commit-risico).
 */
export function TaskTimeFields({ task, onChange }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');
  const calendars = useAppStore(s => s.calendars);
  const projectCal = useAppStore(s => s.calendar);
  const enableHourPlanning = useAppStore(s => s.ui.enableHourPlanning);

  const updateTime = (key: string, value: string | number) => {
    onChange({ time: { ...task.time, [key]: value } });
  };

  const cal: WorkCalendar = effectiveCalendarOf(task, projectCal, calendars);
  const hourTask = enableHourPlanning && isHourCalendar(cal) && !task.isMilestone;

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-xs">{t('properties.time')}</span>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('properties.start')}>
          <DateTextInput
            className="input !text-xs !px-2.5 !py-1.5"
            ariaLabel={t('properties.start')}
            value={task.time.scheduleStart}
            onCommit={v => updateTime('scheduleStart', v)}
          />
        </Field>
        {/* Label modus-bewust (FIX golf, §6.4): een uur-taak toont uur-waarden, dus het label moet
            "(uren)" tonen i.p.v. het misleidende "(dagen)". Dag-taken houden het dagen-label (dag-taken
            kunnen per invariant Bevinding 2 geen sub-dag-duur dragen, dus het veld blijft dagen). */}
        <Field label={hourTask ? t('properties.durationHours') : t('properties.duration')}>
          {(() => {
            // Hammock (fase 2.9 §5.3): de duur is AFGELEID uit de span tussen start- en
            // finish-driver — read-only weergave (invoer wordt door de solver overschreven).
            if (task.isHammock) {
              const hpd = effHoursPerDay(cal);
              const text = hourTask
                ? formatDuration(task.time.durationMinutes ?? task.time.scheduleDuration * hpd * 60, hpd, 'hours')
                : `${task.time.scheduleDuration}`;
              return (
                <input
                  value={text}
                  disabled
                  title={t('properties.hammockDerivedHint')}
                  className="input !text-xs !px-2.5 !py-1.5 opacity-60 cursor-not-allowed"
                  data-ops-hammock-duration
                />
              );
            }
            if (!hourTask) {
              return (
                <Input
                  type="number"
                  value={task.isMilestone ? 0 : task.time.scheduleDuration}
                  onChange={v => updateTime('scheduleDuration', parseInt(v) || 0)}
                  min={0}
                  disabled={task.isMilestone}
                />
              );
            }
            const hpd = effHoursPerDay(cal);
            const minutes = task.time.durationMinutes ?? task.time.scheduleDuration * hpd * 60;
            return (
              <HourDurationField
                key={task.id}
                minutes={minutes}
                hpd={hpd}
                onCommitMinutes={m => onChange({
                  time: { ...task.time, durationMinutes: m, scheduleDuration: hpd > 0 ? m / (hpd * 60) : task.time.scheduleDuration },
                })}
              />
            );
          })()}
        </Field>
      </div>
    </>
  );
}
