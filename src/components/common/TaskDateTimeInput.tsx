import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { useTimeNotation } from '@/hooks/displayDate';
import { dayEndInstant, dayStartInstant, type DayClock, type InstantSide } from '@/engine/calendar/workdayRules';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import type { Task } from '@/types/task';
import { addCalendarDays, formatDate, formatInstant, parseDate, parseInstant } from '@/utils/dateUtils';
import { formatClock, parseClock } from '@/utils/displayTime';
import { taskDateClock, taskDateLabel, type TaskDateLabelOptions } from '@/utils/taskDateLabel';
import { DateTextInput, splitDateValue } from './DateTextInput';
import { TimeInput } from './TimeInput';

/** De minuten na middernacht van een moment (`YYYY-MM-DDTHH:mm`), of `undefined` zonder tijd. */
function clockMinutes(value: string): number | undefined {
  const m = /T(\d{2}):(\d{2})/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` + minuten ⇒ `YYYY-MM-DDTHH:mm` (0..1439). */
function withClock(date: string, minutes: number): string {
  return `${date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * Wat een tijdveld naar buiten brengt (pure kern, getoetst in `check-f4b-datuminvoer.ts`):
 *  - leeg ⇒ alleen de datum die het veld toont: de store zet die op de dagrand van het veld (D1 of D2);
 *  - een tijd ⇒ die datum met die tijd (een tijd hoort bij de klokdatum, B4);
 *  - `null` ⇒ niets te committen (onleesbaar, of dezelfde waarde als nu).
 * `label` is de getoonde vorm (`taskDateLabel`), `value` de opgeslagen waarde.
 *
 * Toont het veld een werkdag zonder tijd (`label` = datum), dan valt de getypte tijd binnen die werkdag
 * (`clock`). Dat telt bij een nachtploeg: het blok wo 22:00–do 06:00 hoort bij wo (B4), dus 05:00 bij
 * "wo" is do 05:00. Zonder `clock` blijft de tijd op de getoonde datum.
 */
export function timeCommitValue(text: string, label: string, value: string, clock?: DayClock): string | null {
  const date = splitDateValue(label).date;
  if (!date) return null;
  const trimmed = text.trim();
  if (trimmed === '') return label.includes('T') ? date : null;
  const minutes = parseClock(trimmed);
  if (minutes === undefined || minutes >= 1440) return null;
  let next = withClock(date, minutes);
  if (clock && !label.includes('T')) {
    const dayStart = dayStartInstant(clock, date);
    const dayEnd = dayEndInstant(clock, date);
    const nextDay = withClock(formatDate(addCalendarDays(parseDate(date), 1)), minutes);
    // Vóór het begin van de werkdag, maar binnen haar blok over middernacht: de klokdag erna.
    if (dayStart && dayEnd && next < dayStart && nextDay <= dayEnd) next = nextDay;
  }
  return next === value ? null : next;
}

/** Een stap van het tijdveld: vanaf de getoonde tijd, of zonder getoonde tijd vanaf het opgeslagen moment.
 *  `null` als er geen moment is. */
export function timeStepValue(label: string, value: string, delta: number): string | null {
  const base = label.includes('T') ? label : value.includes('T') ? value : '';
  if (!base) return null;
  const at = parseInstant(base);
  if (Number.isNaN(at.getTime())) return null;
  return formatInstant(new Date(at.getTime() + delta * 60_000), 'hour');
}

/**
 * Een datum van een taak met een optionele tijd (spec "alleen uren" §3.6, besluit B4). Het veld toont wat
 * de tabel toont: alleen de datum als het moment op de dagrand van zijn kant valt, en datum plus tijd als
 * het midden op de werkdag valt.
 *  - Een datum zonder tijd typen: de store zet hem op de dagrand van het veld (D1 begin, D2 einde, D7
 *    mijlpaal), net als in de tabel en via MCP. Een werkelijke datum van een mijlpaal krijgt de
 *    klokketijd uit de planning (`normalizeActualDate`, besluit 2026-10-29).
 *  - Een tijd typen: dat moment, op de getoonde datum. De tijd leegmaken: terug naar de dagrand.
 *  - Een andere datum bij een getoonde tijd houdt die tijd (`dateCommitValue`).
 * De commit gaat via `onCommit`, zoals bij `DateTextInput` (`false` = geweigerd, het veld valt terug).
 */
export function TaskDateTimeInput({
  task, value, side, milestoneOwn, onCommit, required, disabled, title, ariaLabel, className = '', dataAttribute,
}: {
  task: Task;
  value: string;
  side: InstantSide;
  /** Eigen start- of eindveld van de taak (dan geldt de mijlpaalregel). Standaard aan. */
  milestoneOwn?: TaskDateLabelOptions['milestoneOwn'];
  onCommit: (value: string) => void | false;
  required?: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel: string;
  className?: string;
  /** Naam voor `data-ops-task-date-time` (tests). */
  dataAttribute: string;
}) {
  const { t } = useTranslation('task');
  const notation = useTimeNotation();
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  const [draft, setDraft] = useState<string | null>(null);
  const taskCalendar = resolveCalendar(task.calendarId, calendars, calendar);
  const label = value ? taskDateLabel(task, value, side, taskCalendar, { milestoneOwn }) : '';
  const minutes = clockMinutes(label);
  const timeText = draft ?? (minutes === undefined ? '' : formatClock(minutes, notation));

  const commitTime = () => {
    if (draft === null) return;
    const next = timeCommitValue(draft, label, value, taskDateClock(task, taskCalendar));
    setDraft(null);
    if (next !== null) onCommit(next);
  };
  const step = (delta: number) => {
    if (disabled) return;
    const next = timeStepValue(label, value, delta);
    setDraft(null);
    if (next !== null && next !== value) onCommit(next);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-stretch gap-1" data-ops-task-date-time={dataAttribute}>
      <div className="min-w-0 flex-[1_1_8.5rem]">
        <DateTextInput
          className={className}
          ariaLabel={ariaLabel}
          title={title}
          value={label}
          required={required}
          disabled={disabled}
          onCommit={onCommit}
        />
      </div>
      <div className="min-w-0 flex-[0_1_6.5rem]" title={t('dateTimeInput.timeHint')}>
        {disabled ? (
          <input
            className={`${className} w-full`}
            value={timeText}
            disabled
            aria-label={t('dateTimeInput.time', { field: ariaLabel })}
            data-ops-task-date-time-input={dataAttribute}
          />
        ) : (
          <TimeInput
            value={timeText}
            onTextChange={setDraft}
            onCommit={commitTime}
            onStep={step}
            ariaLabel={t('dateTimeInput.time', { field: ariaLabel })}
            increaseLabel={t('dateTimeInput.later')}
            decreaseLabel={t('dateTimeInput.earlier')}
            className={className}
            dataAttribute={`task-date-${dataAttribute}`}
            dataAttributes={{ 'data-ops-task-date-time-input': dataAttribute }}
          />
        )}
      </div>
    </div>
  );
}

