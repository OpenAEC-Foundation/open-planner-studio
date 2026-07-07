import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Task, TaskType } from '@/types/task';
import { useTaskTypeLabels } from '@/i18n/taskTypes';
import { Select } from '@/components/common/Select';
import { Field, Input } from './shared';

/**
 * Naam / WBS-code / omschrijving / type / kalender (fase 2.10, item 2 — sectie 2 uit
 * `TaskPropertiesPanel`). `CalendarForm`-patroon: puur `{ task, onChange }`, geen store-schrijf
 * hier. `wbsAutoNumber` wordt — net als `CalendarForm` z'n `enableHourPlanning` — rechtstreeks
 * uit de store gelezen (read-only contextvlag, geen mutatie).
 *
 * Kalender is een LICHTE UITZONDERING: in het paneel gaat een kalenderwissel via de dedicated
 * `setTaskCalendar`-actie (no-op-guard + `scheduleStale`-vlag + `recomputeViewRows`), niet via de
 * generieke patch — vandaar de aparte `onCalendarChange`-prop i.p.v. het door `onChange` te laten
 * lopen. De dialoog geeft hiervoor gewoon `onChange({ calendarId })` door (zijn bestaande
 * Save-tijd-gedrag: calendarId werd al gewoon met de andere velden gebundeld).
 *
 * `hideName` (dialoog-only): `TaskDialog` rendert het naam-veld zelf (het zet er een auto-focus/
 * select-all-ref op bij het openen) — deze sectie slaat het dan over zodat het niet dubbel
 * verschijnt. Het paneel laat dit weg (toont het naam-veld gewoon hier).
 */
export function TaskBasicFields({ task, onChange, onCalendarChange, hideName }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
  onCalendarChange: (calendarId: string | undefined) => void;
  hideName?: boolean;
}) {
  const { t } = useTranslation('task');
  const { options: taskTypeOptions } = useTaskTypeLabels();
  const wbsAutoNumber = useAppStore(s => !!s.project.wbsAutoNumber);
  const calendars = useAppStore(s => s.calendars);

  return (
    <>
      {!hideName && (
        <Field label={t('properties.name')}>
          <Input value={task.name} onChange={v => onChange({ name: v })} />
        </Field>
      )}

      <Field label={t('properties.wbsCode')}>
        {/* Bij auto-nummering bezit de app de codes — handmatige invoer zou bij de
            eerstvolgende structuurmutatie toch overschreven worden. */}
        {wbsAutoNumber ? (
          <input value={task.wbsCode} disabled title={t('properties.wbsAutoHint')}
            className="input !text-xs !px-2.5 !py-1.5 opacity-60 cursor-not-allowed" />
        ) : (
          <Input value={task.wbsCode} onChange={v => onChange({ wbsCode: v })} />
        )}
      </Field>

      <Field label={t('properties.description')}>
        <textarea
          value={task.description}
          onChange={e => onChange({ description: e.target.value })}
          className="input !text-xs !px-2.5 !py-1.5 h-16 resize-none"
        />
      </Field>

      <Field label={t('properties.type')}>
        <Select
          aria-label={t('properties.type')}
          value={task.taskType}
          onChange={v => onChange({ taskType: v as TaskType })}
          options={taskTypeOptions.map(tt => ({ value: tt.value, label: tt.label }))}
        />
      </Field>

      <Field label={t('properties.calendar')}>
        <Select
          aria-label={t('properties.calendar')}
          value={task.calendarId ?? ''}
          onChange={v => onCalendarChange(v || undefined)}
          options={[
            { value: '', label: t('properties.calendarProject') },
            ...calendars.map(c => ({ value: c.id, label: c.name })),
          ]}
        />
      </Field>
    </>
  );
}
