import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import type { WorkCalendar } from '@/types/calendar';
import { effectiveCalendarOf } from '@/utils/taskDuration';
import { shownStart, startAnchorAfterEdit } from '@/utils/taskDates';
import {
  constraintBlockingStart,
  predecessorDrivenTaskIds,
  startConstraintAfterEdit,
} from '@/engine/startEditConstraint';
import { notifyStartEdit } from '@/state/startConstraintNotice';
import { Task } from '@/types/task';
import { DateTextInput } from '@/components/common/DateTextInput';
import { Field } from './shared';
import { TaskDurationField } from './TaskDurationField';

/**
 * Start + gedeelde taakduur — sectie 4 uit `TaskPropertiesPanel`. Dialoog en paneel monteren
 * allebei `TaskDurationField`, zodat parser, validatie, omzetvoorstel en toegankelijkheid identiek
 * blijven. Pakket G (bugfix) wijzigde het Start-veld nadien: het toonde vroeger het rauwe
 * `scheduleStart`-anker, terwijl Gantt, tooltip en TaskDialog de getoonde start (`shownStart`,
 * `utils/taskDates.ts`) tonen — nu gelijkgetrokken. De Tabel-kolom **Start** toont en schrijft via
 * dezelfde twee helpers; de kiesbare kolom **Geplande start** toont bewust het rauwe anker.
 * Op een taak met voorganger wordt een getypte start bovendien een beperking "Start niet eerder dan"
 * (`startConstraintAfterEdit`, dezelfde regel als Tabel, Taak bewerken en Gantt-sleep), in dezelfde
 * undo-stap. Houdt een andere constraint de start tegen (`constraintBlockingStart`), dan wordt er
 * niets toegepast: een melding noemt die constraint en het veld valt terug.
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

  const cal: WorkCalendar = effectiveCalendarOf(task, projectCal, calendars);
  // Getoonde start = berekende start (`shownStart`), dezelfde datum als de Gantt-balk, de tooltip,
  // TaskDialog en de Tabel-kolom Start. `scheduleStart` blijft het GEPLANDE anker — zie
  // `applyCpmResult` ("BEWUST GEEN scheduleStart-ANKER-drift"). Commit schrijft daarom alleen naar
  // scheduleStart als de gebruiker de waarde daadwerkelijk wijzigde t.o.v. wat getoond werd
  // (`startAnchorAfterEdit`, gedeeld met TaskDialog en de Tabel) — anders zou elke render/commit-
  // cyclus het anker naar de berekende datum laten meeschuiven.
  const shown = shownStart(task);

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-small !leading-4">{t('properties.time')}</span>

      {/* In de smalle rechterrail zou de helft van een tweekolomsrij de duurwaarde weer tot een
          strookje drukken. Start en duur blijven dezelfde velden, maar krijgen hier elk de volle
          paneelbreedte; de dialoog heeft onafhankelijk daarvan voldoende ruimte voor twee kolommen. */}
      <div className="grid grid-cols-1 gap-2">
        <Field label={t('properties.start')}>
          <DateTextInput
            className="input !text-small !leading-4 !px-2.5 !py-1.5"
            ariaLabel={t('properties.start')}
            title={t('properties.scheduleStartHint')}
            value={shown}
            onCommit={v => {
              const anchor = startAnchorAfterEdit(task, v);
              if (anchor === undefined) return;
              const state = useAppStore.getState();
              const driven = predecessorDrivenTaskIds(state.tasks, state.sequences).has(task.id);
              // Een andere constraint houdt de start tegen: niets toepassen (ook geen dood anker),
              // melden, en het veld laat de invoer los (`false`).
              const blocking = constraintBlockingStart(task, driven);
              if (blocking) {
                notifyStartEdit(state.notify, [{ kind: 'blocked', name: task.name, constraint: blocking }], state.ui.dateNotation);
                return false;
              }
              // Voorganger? Dan wordt de getypte start een SNET. Anker en beperking in één patch,
              // dus in één undo-stap.
              const snet = startConstraintAfterEdit(task, anchor, driven);
              // Niets nieuws (zoals de Tabel: `applyTypedStart`). Het veld toont tot F5 de oude
              // berekende start, dus het verlaten na Enter committeert dezelfde datum nog eens; die
              // lege patch zou anders een loze undo-stap vóór de echte bewerking leggen.
              if (!snet && anchor === task.time.scheduleStart) return;
              onChange({ time: { ...task.time, scheduleStart: anchor }, ...(snet ? { constraint: snet.constraint } : {}) });
              if (snet) {
                notifyStartEdit(state.notify, [{ kind: 'snet', name: task.name, date: anchor, change: snet.change }], state.ui.dateNotation);
              }
            }}
          />
        </Field>
        <Field label={t('duration.label')}>
          <TaskDurationField task={task} calendar={cal} onChange={onChange} />
        </Field>
      </div>
    </>
  );
}
