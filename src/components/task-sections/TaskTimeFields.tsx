import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import type { WorkCalendar } from '@/types/calendar';
import { effectiveCalendarOf } from '@/utils/taskDuration';
import { Task } from '@/types/task';
import { DateTextInput } from '@/components/common/DateTextInput';
import { Field } from './shared';
import { TaskDurationField } from './TaskDurationField';

/**
 * Start + gedeelde taakduur — sectie 4 uit `TaskPropertiesPanel`. Dialoog en paneel monteren
 * allebei `TaskDurationField`, zodat parser, validatie, omzetvoorstel en toegankelijkheid identiek
 * blijven. Pakket G (bugfix, zie scheduleSlice.ts:96-100) wijzigde
 * het Start-veld nadien: het toonde vroeger de rauwe `scheduleStart`-anker terwijl elk ander oppervlak
 * (Gantt/tabel/tooltip/TaskDialog) `earlyStart || scheduleStart` toont — nu getrokken gelijk.
 *
 * Het startveld blijft paneel-instant-apply; `TaskDialog` bewaart zijn bestaande Save-commitgrens.
 * Alleen de duurbediening is gedeeld. Hammock-toggle/-info staat apart in `TaskHammockFields`.
 */
export function TaskTimeFields({ task, onChange }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');
  const calendars = useAppStore(s => s.calendars);
  const projectCal = useAppStore(s => s.calendar);

  const updateTime = (key: string, value: string | number) => {
    onChange({ time: { ...task.time, [key]: value } });
  };

  const cal: WorkCalendar = effectiveCalendarOf(task, projectCal, calendars);
  // Getoonde start = berekende start, consistent met Gantt/tabel/tooltip/TaskDialog
  // (`earlyStart || scheduleStart`). `scheduleStart` blijft de GEPLANDE anker — zie
  // scheduleSlice.ts:96-100 ("BEWUST GEEN scheduleStart-ANKER-drift"). Commit schrijft daarom alleen
  // naar scheduleStart als de gebruiker de waarde daadwerkelijk wijzigde t.o.v. wat getoond werd
  // (zelfde patroon als TaskDialog.tsx:145-146) — anders zou elke render/commit-cyclus het anker naar
  // de berekende datum laten meeschuiven en precies de drift veroorzaken die dat commentaar beschrijft.
  const shownStart = task.time.earlyStart || task.time.scheduleStart;

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-xs">{t('properties.time')}</span>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('properties.start')}>
          <DateTextInput
            className="input !text-xs !px-2.5 !py-1.5"
            ariaLabel={t('properties.start')}
            title={t('properties.scheduleStartHint')}
            value={shownStart}
            onCommit={v => { if (v !== shownStart) updateTime('scheduleStart', v); }}
          />
        </Field>
        <Field label={t('duration.label')}>
          <TaskDurationField task={task} calendar={cal} onChange={onChange} />
        </Field>
      </div>
    </>
  );
}
