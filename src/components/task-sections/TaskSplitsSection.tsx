import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { useDisplayDate } from '@/hooks/displayDate';
import { durationMinutesOf, taskDurationUnit } from '@/engine/scheduler/duration';
import { isSummaryTask } from '@/engine/scheduler/relationRules';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import {
  canSplitTask, completedWorkMinutes, removeGap, setGapLength, setWorkLength, splitAt,
  splitUnitMinutes, toSplitPieces, type SplitEditResult, type SplitPiece,
} from '@/engine/scheduler/splitEdit';
import { splitEngineFor, taskSplitSegments } from '@/engine/renderer/splitBarGeometry';
import { formatDate, formatInstant } from '@/utils/dateUtils';
import { taskDateLabel } from '@/utils/taskDateLabel';
import { useProfileCountsWorkdays } from '@/hooks/useDurationMeasure';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { shownFinish, shownStart } from '@/utils/taskDates';

const formatUnits = (minutes: number, unit: number): string => String(Math.round((minutes / unit) * 100) / 100);

const sourceOf = (p: SplitPiece): string | undefined => (p.kind === 'gap' ? p.source : undefined);
const samePieces = (a: readonly SplitPiece[], b: readonly SplitPiece[]): boolean =>
  a.length === b.length && a.every((p, i) => p.kind === b[i].kind
    && Math.abs(p.minutes - b[i].minutes) < 1e-6 && sourceOf(p) === sourceOf(b[i]));

function SplitNumberInput({ value, onCommit, label, dataAttr }: {
  value: string;
  onCommit: (units: number) => boolean;
  label: string;
  dataAttr: 'after' | 'pause';
}) {
  const [draft, setDraft] = useState(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => { setDraft(valueRef.current); }, [value]);
  const commit = () => {
    const raw = draft.trim().replace(',', '.');
    const units = Number(raw);
    if (raw === '' || !Number.isFinite(units) || !onCommit(units)) setDraft(valueRef.current);
  };
  return (
    <input
      type="number"
      step={1}
      min={dataAttr === 'after' ? 1 : 0}
      value={draft}
      aria-label={label}
      title={label}
      {...{ [`data-ops-split-${dataAttr}`]: '' }}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setDraft(valueRef.current); e.currentTarget.blur(); }
      }}
      className="input !w-full !text-small !px-1 !py-0.5 text-right tabular-nums"
    />
  );
}

export function splitPieceRanges(task: Task, cal: WorkCalendar, workdayDurationMeasure: boolean): { from: string; to: string }[] {
  const segments = taskSplitSegments(task, cal, workdayDurationMeasure);
  if (!segments) return [];
  const eng = splitEngineFor(cal);
  const instants = (shownStart(task) || '').includes('T') || (shownFinish(task) || '').includes('T');
  return segments.slice(1).map((s, k) => {
    const last = k === segments.length - 2;
    if (!instants) return { from: formatDate(s.start), to: formatDate(last ? s.end : eng.prevWorkDayBefore(s.end)) };
    const from = formatInstant(eng.nextWorkInstant(s.start), 'hour');
    const to = formatInstant(eng.prevWorkInstant(s.end), 'hour');
    return { from: taskDateLabel(task, from, 'start', cal), to: taskDateLabel(task, to, 'end', cal) };
  });
}

export function TaskSplitsSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const { date, dateTime } = useDisplayDate();
  const task = useAppStore(s => s.tasks.find(x => x.id === taskId));
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  const setTaskSplits = useAppStore(s => s.setTaskSplits);
  const workdayDurationMeasure = useProfileCountsWorkdays();

  if (!task) return null;
  const hoursPerDay = taskCalendarHoursPerDay(task, calendars, calendar);
  const refusal = canSplitTask(task, hoursPerDay, isSummaryTask(task));
  if (refusal !== null && refusal !== 'not-editable') return null;

  const hourUnit = taskDurationUnit(task) === 'hours';
  const unit = splitUnitMinutes(task, hoursPerDay);
  const unitLabel = t(hourUnit ? 'properties.splits.unitHours' : 'properties.splits.unitDays');
  const workMinutes = durationMinutesOf(task, { isHourMode: hourUnit, hoursPerDay });
  const pieces = refusal === null ? toSplitPieces(task.splitGaps, workMinutes) : null;
  const ranges = splitPieceRanges(task, resolveCalendar(task.calendarId, calendars, calendar), workdayDurationMeasure);
  const showDate = (iso: string) => (iso.includes('T') ? dateTime(iso) : date(iso));

  const apply = (result: SplitEditResult): boolean => {
    if (!pieces || !result.ok || samePieces(result.pieces, pieces)) return false;
    return setTaskSplits(task.id, result.pieces) === null;
  };

  const header = (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-small !leading-4">{t('properties.splits.title')}</span>
    </>
  );

  if (!pieces) {
    return (
      <>
        {header}
        <span className="badge badge--gray !whitespace-normal self-start" data-ops-split-readonly>
          {t('properties.splits.readOnly')}
        </span>
        <div className="flex flex-col gap-1">
          {ranges.map((r, i) => (
            <div key={`${task.id}:${i}`} data-ops-split-row={i} className="!text-small">
              <span data-ops-split-dates className="tabular-nums text-text-secondary">
                {showDate(r.from)} – {showDate(r.to)}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          data-ops-split-remove-all
          className="dependency-add-button"
          onClick={() => setTaskSplits(task.id, null)}
        >
          <Icon id="planning.interruption-remove" size={10} />
          {t('properties.splits.removeAll')}
        </button>
      </>
    );
  }

  const gaps: { index: number; minutes: number; leveling: boolean; workBefore: number; earlierWork: number }[] = [];
  let work = 0;
  let lastWork = 0;
  for (const p of pieces) {
    if (p.kind === 'work') { lastWork = p.minutes; work += p.minutes; continue; }
    gaps.push({
      index: gaps.length, minutes: p.minutes, leveling: p.source === 'leveling',
      workBefore: work, earlierWork: work - lastWork,
    });
  }

  let longest = 0;
  let longestStart = 0;
  let cursor = 0;
  for (const p of pieces) {
    if (p.kind !== 'work') continue;
    if (p.minutes > longest + 1e-6) { longest = p.minutes; longestStart = cursor; }
    cursor += p.minutes;
  }
  const addResult = splitAt(pieces, longestStart + longest / 2, unit, unit, completedWorkMinutes(task, hoursPerDay));

  return (
    <>
      {header}
      {gaps.length > 0 && (
        <div className="flex flex-col gap-1">
          {gaps.map(g => {
            const r = ranges[g.index];
            return (
              <div
                key={`${task.id}:${g.index}`}
                data-ops-split-row={g.index}
                className="grid grid-cols-[auto_3rem_auto_3rem_minmax(0,1fr)_1rem] items-center gap-x-1 gap-y-0.5 !text-small"
              >
                <span>{t('properties.splits.after')}</span>
                <SplitNumberInput
                  dataAttr="after"
                  label={`${t('properties.splits.after')} (${unitLabel})`}
                  value={formatUnits(g.workBefore, unit)}
                  onCommit={units => {
                    const minutes = units * unit - g.earlierWork;
                    if (!(minutes >= unit - 1e-6)) return false;
                    return apply(setWorkLength(pieces, g.index, minutes, unit));
                  }}
                />
                <span>{t('properties.splits.pause')}</span>
                <SplitNumberInput
                  dataAttr="pause"
                  label={`${t('properties.splits.pause')} (${unitLabel})`}
                  value={formatUnits(g.minutes, unit)}
                  onCommit={units => (units >= 0 ? apply(setGapLength(pieces, g.index, units * unit, unit)) : false)}
                />
                <span className="truncate text-text-secondary">{unitLabel}</span>
                <button
                  type="button"
                  data-ops-split-remove
                  title={t('properties.splits.remove')}
                  aria-label={t('properties.splits.remove')}
                  className="justify-self-center"
                  style={{ color: 'var(--error)' }}
                  onClick={() => apply(removeGap(pieces, g.index))}
                >
                  <Icon id="planning.interruption-remove" size={10} />
                </button>
                <span className="col-start-2 col-span-4 flex items-center gap-1 min-w-0">
                  {r && (
                    <span data-ops-split-dates className="tabular-nums text-text-secondary truncate">
                      {showDate(r.from)} – {showDate(r.to)}
                    </span>
                  )}
                  {g.leveling && (
                    <span className="badge badge--gray shrink-0" data-ops-split-leveling>
                      {t('properties.splits.leveling')}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <button
        type="button"
        data-ops-split-add
        disabled={!addResult.ok}
        className="dependency-add-button disabled:opacity-50 disabled:pointer-events-none"
        onClick={() => { if (addResult.ok) setTaskSplits(task.id, addResult.pieces); }}
      >
        <Icon id="planning.interruption-add" size={10} />
        {t('properties.splits.add')}
      </button>
    </>
  );
}
