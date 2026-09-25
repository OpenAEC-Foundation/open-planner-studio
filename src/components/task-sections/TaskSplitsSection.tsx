import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { useDisplayDate } from '@/hooks/displayDate';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { durationMinutesOf, taskDurationUnit } from '@/engine/scheduler/duration';
import { isSummaryTask } from '@/engine/scheduler/relationRules';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import {
  canSplitTask, completedWorkMinutes, removeGap, setGapLength, setWorkLength, splitAt,
  splitUnitMinutes, toSplitPieces, type SplitEditResult, type SplitPiece,
} from '@/engine/scheduler/splitEdit';
import { computeSplitSegments } from '@/engine/scheduler/splitWalk';
import { formatDate, formatInstant, parseDate, parseInstant } from '@/utils/dateUtils';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';

/** Eenheden met hooguit twee decimalen: een importgat van een kwartdag blijft zichtbaar (spec
 *  "Dag-modus-afronding") zonder dat een float-staart als `4.999999` in het veld belandt. */
const formatUnits = (minutes: number, unit: number): string => String(Math.round((minutes / unit) * 100) / 100);

const sourceOf = (p: SplitPiece): string | undefined => (p.kind === 'gap' ? p.source : undefined);
const samePieces = (a: readonly SplitPiece[], b: readonly SplitPiece[]): boolean =>
  a.length === b.length && a.every((p, i) => p.kind === b[i].kind
    && Math.abs(p.minutes - b[i].minutes) < 1e-6 && sourceOf(p) === sourceOf(b[i]));

/**
 * Getalveld met commit op blur/Enter (Enter = blur, zelfde vorm als `SequenceLagInput`). `onCommit`
 * geeft `false` bij een geweigerde of lege bewerking: het veld springt dan terug op de huidige
 * waarde — er blijft nooit een getal staan dat niet in de data zit.
 */
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

/** Van–tot per werkstuk NA een pauze, op exact dezelfde as als de Gantt-balk: dezelfde datums
 *  (`earlyStart || scheduleStart`, zoals `GanttRenderer.barGeometry`), dezelfde kalender-engine
 *  (`engineForAnyMode`) en dezelfde wandeling (`computeSplitSegments`). Tussengrenzen zijn daar
 *  EXCLUSIEF; in dag-modus wordt de einddag dus de werkdag vóór die grens. */
function segmentRanges(task: Task, cal: WorkCalendar): { from: string; to: string }[] {
  const startStr = task.time.earlyStart || task.time.scheduleStart || '';
  const endStr = task.time.earlyFinish || task.time.scheduleFinish || '';
  if (!startStr || !endStr) return [];
  const hourMode = startStr.includes('T') || endStr.includes('T');
  const start = hourMode ? parseInstant(startStr) : parseDate(startStr);
  const end = hourMode ? parseInstant(endStr) : parseDate(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const eng = new CalendarEngine(cal);
  const segments = computeSplitSegments(task.splitGaps, start, end, hourMode, eng);
  return segments.slice(1).map((s, k) => {
    const last = k === segments.length - 2;
    const to = hourMode || last ? s.end : eng.prevWorkDayBefore(s.end);
    return hourMode
      ? { from: formatInstant(s.start, 'hour'), to: formatInstant(to, 'hour') }
      : { from: formatDate(s.start), to: formatDate(to) };
  });
}

/**
 * Onderbrekingen (issue #146, etappe 4) — de exacte invoer naast het splitsgebaar in de Gantt, op
 * dezelfde data. Eén regel per pauze: *na n* (werk vóór de pauze op de WERK-as, dus zonder eerdere
 * pauzes) · *pauze n* · van–tot van het stuk erna · verwijderen. Eenheid = werkdagen, bij een
 * urentaak uren (`splitUnitMinutes`).
 *
 * Al het rekenwerk loopt via `splitEdit.ts` en elke commit is één `setTaskSplits` zonder
 * coalesceKey — dus één undo-stap per bewerking. De sectie rekent zelf nooit op
 * `afterMinutes`/`gapMinutes`; ze leest de stukken van `toSplitPieces`.
 *
 * Niet-wélgevormde importsplits (`'not-editable'`) tonen één gekleurd blok, de van–tot-datums en
 * alleen "Alle onderbrekingen opheffen". Elke andere weigering van `canSplitTask` (mijlpaal,
 * verzameltaak, hammock, verstreken tijd, handmatig, te kort) ⇒ geen sectie.
 */
export function TaskSplitsSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const { date, dateTime } = useDisplayDate();
  const task = useAppStore(s => s.tasks.find(x => x.id === taskId));
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  const setTaskSplits = useAppStore(s => s.setTaskSplits);

  if (!task) return null;
  const hoursPerDay = taskCalendarHoursPerDay(task, calendars, calendar);
  const refusal = canSplitTask(task, hoursPerDay, isSummaryTask(task));
  if (refusal !== null && refusal !== 'not-editable') return null;

  const hourUnit = taskDurationUnit(task) === 'hours';
  const unit = splitUnitMinutes(task, hoursPerDay);
  const unitLabel = t(hourUnit ? 'properties.splits.unitHours' : 'properties.splits.unitDays');
  const workMinutes = durationMinutesOf(task, { isHourMode: hourUnit, hoursPerDay });
  const pieces = refusal === null ? toSplitPieces(task.splitGaps, workMinutes) : null;
  const ranges = segmentRanges(task, resolveCalendar(task.calendarId, calendars, calendar));
  const showDate = (iso: string) => (iso.includes('T') ? dateTime(iso) : date(iso));

  /** `false` = geweigerd of niets veranderd ⇒ het veld springt terug, geen undo-stap. */
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
    // Alleen-lezen: de datums uit dezelfde wandeling als de balk, geen invoer.
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
          <Trash2 size={10} />
          {t('properties.splits.removeAll')}
        </button>
      </>
    );
  }

  // Werk vóór elke pauze, cumulatief op de WERK-as: `workBefore` = som van werkstuk 0..i,
  // `earlierWork` = som van werkstuk 0..i−1 (wat "na n" niet verschuift).
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

  // Toevoegen: halverwege het langste werkstuk (het eerste bij gelijke lengte), pauze één eenheid.
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
                  // "na n" verschuift alleen werkstuk i: dat is n minus het werk van de stukken ervóór.
                  // Kleiner dan één eenheid voor dit stuk ⇒ weigeren i.p.v. `setWorkLength`s stille klem.
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
                  // 0 = de pauze opheffen (spec §1: samenvoegen met de buren); negatief is geen lengte.
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
                  <Trash2 size={10} />
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
        <Plus size={10} />
        {t('properties.splits.add')}
      </button>
    </>
  );
}
