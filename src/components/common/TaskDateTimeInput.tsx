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

function clockMinutes(value: string): number | undefined {
  const m = /T(\d{2}):(\d{2})/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}

const pad = (n: number) => String(n).padStart(2, '0');

function withClock(date: string, minutes: number): string {
  return `${date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

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
    if (dayStart && dayEnd && next < dayStart && nextDay <= dayEnd) next = nextDay;
  }
  return next === value ? null : next;
}

export function timeStepValue(label: string, value: string, delta: number): string | null {
  const base = label.includes('T') ? label : value.includes('T') ? value : '';
  if (!base) return null;
  const at = parseInstant(base);
  if (Number.isNaN(at.getTime())) return null;
  return formatInstant(new Date(at.getTime() + delta * 60_000), 'hour');
}

export function TaskDateTimeInput({
  task, value, side, milestoneOwn, onCommit, required, disabled, title, ariaLabel, className = '', dataAttribute,
}: {
  task: Task;
  value: string;
  side: InstantSide;
  milestoneOwn?: TaskDateLabelOptions['milestoneOwn'];
  onCommit: (value: string) => void | false;
  required?: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel: string;
  className?: string;
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

