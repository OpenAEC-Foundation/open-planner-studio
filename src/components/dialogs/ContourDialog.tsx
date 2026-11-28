import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatReportNumber } from '@/utils/reportNumber';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHelpButton } from '@/components/common/Dialog';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { contourLookup } from '@/engine/scheduler/ResourceLoad';
import { contourSiblings, costResourceIds } from '@/types/resource';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import type { ContourShape } from '@/engine/contour/contourEngine';
import { EDITABLE_CONTOUR_SHAPES, shapeSlotWork } from '@/engine/contour/contourEdit';
import {
  contourDayModel, contourPeriodsFromRates, ratesFromShapeWork, remainingMinutesOfRates,
} from '@/engine/contour/contourDays';
import {
  type ContourPhase, fitPhasesToDays, mergePhaseWithNext, phaseStartDay, phasesFromSlots,
  phasesTotalDays, setPhaseDays, setPhaseUnits, slotsFromPhases, splitPhase,
} from '@/engine/contour/contourPhases';
import { parseDate } from '@/utils/dateUtils';
import { useLiveGridNav } from '@/components/panels/hooks/useLiveGridNav';
import { ContourPhaseStrip } from './ContourPhaseStrip';
import { useEscapeCapture } from '@/hooks/useEscapeCapture';
import { CONTOUR_HELP_ARTICLE_ID } from '@/state/helpArticles';

const PHASE_GRID_FIELDS = ['days', 'units'] as const;
type PhaseGridField = typeof PHASE_GRID_FIELDS[number];

const SHAPE_KEY = {
  FLAT: 'resource.curve.uniform',
  FRONT_LOADED: 'resource.curve.frontLoaded',
  BACK_LOADED: 'resource.curve.backLoaded',
  DOUBLE_PEAK: 'resource.curve.doublePeak',
  EARLY_PEAK: 'resource.curve.earlyPeak',
  LATE_PEAK: 'resource.curve.latePeak',
  BELL: 'resource.curve.bell',
  TURTLE: 'resource.curve.turtle',
} as const satisfies Record<ContourShape, string>;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function ContourDialog({ assignmentId, onClose }: { assignmentId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation('task');
  const fmtNum = (n: number) => formatReportNumber(n, i18n.language);
  const fmtHours = (minutes: number) => fmtNum(minutes / 60);
  const { t: tCommon } = useTranslation('common');
  const tasks = useAppStore(s => s.tasks);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  const schedulingProfile = useAppStore(s => s.project.schedulingProfile);
  const schedulingOptions = useAppStore(s => s.project.schedulingOptions);
  const setAssignmentContour = useAppStore(s => s.setAssignmentContour);

  const assignment = assignments.find(a => a.id === assignmentId);
  const task = assignment ? tasks.find(x => x.id === assignment.taskId) : undefined;
  const resource = assignment ? resources.find(r => r.id === assignment.resourceId) : undefined;

  const [model] = useState(() => {
    if (!assignment || !task) return null;
    const engine = new CalendarEngine(calendarForEngine(resolveCalendar(task.calendarId, calendars, calendar)));
    const siblings = contourSiblings(assignments.filter(a => a.taskId === task.id), costResourceIds(resources));
    const contour = contourLookup(siblings)(task, assignment);
    const days = contourDayModel(task, assignment, contour, engine, effectiveSchedulingOptions({ schedulingProfile, schedulingOptions }));
    const mpd = days.mpd;
    const n = days.days.length;
    const phases = fitPhasesToDays(phasesFromSlots(days.remainingRates.map(r => r * mpd), mpd), n, assignment.unitsPerDay);
    return {
      engine, mpd, contour, n, phases,
      placement: days.days,
      isos: days.isos,
      shares: days.shares,
      actual: days.actualMinutes,
      actualRate: days.actualMinutes.map((m, i) => (days.shares[i] > 0 ? m / days.shares[i] : 0)),
      hasActual: days.actualMinutes.some(m => m > 0),
      hasPartialDay: days.shares.some(sh => Math.abs(sh - 1) > 1e-6),
    };
  });

  const [phases, setPhasesState] = useState<ContourPhase[]>(() => model?.phases ?? []);
  const [unitsText, setUnitsText] = useState<string[]>(() => (model?.phases ?? []).map(p => fmtNum(p.unitsPerDay)));
  const [selected, setSelected] = useState<number | null>(null);
  const [initialPhases] = useState(() => JSON.stringify(model?.phases ?? []));

  const setPhases = (next: ContourPhase[]) => {
    setPhasesState(next);
    setUnitsText(next.map(p => fmtNum(p.unitsPerDay)));
  };

  useEscapeCapture(onClose);

  const grid = useLiveGridNav<PhaseGridField>({
    rowIds: phases.map((_, i) => String(i)),
    fields: PHASE_GRID_FIELDS,
  });

  if (!assignment || !task || !model) return null;

  const hoursPerDay = model.engine.hoursPerDay;
  const invalidRows = unitsText.map(text => {
    const n = Number(text.trim().replace(',', '.'));
    return text.trim() === '' || !Number.isFinite(n) || n < 0;
  });
  const anyInvalid = invalidRows.some(Boolean);
  const totalDays = phasesTotalDays(phases);
  const rates = slotsFromPhases(phases, 1);
  const remainingMinutes = remainingMinutesOfRates(rates, model.shares, model.mpd);
  const actualMinutes = model.actual.reduce((a, b) => a + b, 0);
  const maxUnits = phases.reduce((m, p) => Math.max(m, p.unitsPerDay), 0);
  const actualMaxUnits = model.actualRate.reduce((m, v) => Math.max(m, v / model.mpd), 0);
  const scaleMax = Math.max(1, resource?.maxUnits ?? 0, maxUnits, actualMaxUnits) * 1.15;

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const fmtIso = (iso: string | undefined) => {
    if (!iso) return '—';
    try { return dateFmt.format(parseDate(iso)); } catch { return iso; }
  };
  const actualMinutesOfPhase = (index: number) => {
    const start = phaseStartDay(phases, index);
    let sum = 0;
    for (let d = start; d < start + phases[index].days; d++) sum += model.actual[d] ?? 0;
    return sum;
  };
  const remainingMinutesOfPhase = (index: number) => {
    const start = phaseStartDay(phases, index);
    const days = phases[index].days;
    return remainingMinutesOfRates(rates.slice(start, start + days), model.shares.slice(start, start + days), model.mpd);
  };

  const applyShape = (shape: ContourShape) => {
    const total = remainingMinutes > 0 ? remainingMinutes : remainingMinutesOfRates(model.shares.map(() => assignment.unitsPerDay), model.shares, model.mpd);
    const shaped = ratesFromShapeWork(shapeSlotWork(shape, total, model.n), model.shares, total, model.mpd);
    setPhases(fitPhasesToDays(phasesFromSlots(shaped.map(r => r * model.mpd), model.mpd), model.n, assignment.unitsPerDay));
    setSelected(null);
  };
  const commitUnitsText = (index: number, text: string) => {
    const next = [...unitsText];
    next[index] = text;
    setUnitsText(next);
    const n = Number(text.trim().replace(',', '.'));
    if (text.trim() !== '' && Number.isFinite(n) && n >= 0) setPhasesState(setPhaseUnits(phases, index, round2(n)));
  };
  const commitDays = (index: number, text: string) => {
    const n = Number(text);
    if (Number.isFinite(n) && n >= 1) setPhases(setPhaseDays(phases, index, Math.floor(n)));
  };
  const split = (index: number, afterDays: number) => { setPhases(splitPhase(phases, index, afterDays)); setSelected(index); };
  const merge = (index: number) => { setPhases(mergePhaseWithNext(phases, index)); setSelected(index); };

  const apply = (): boolean => {
    if (anyInvalid || totalDays === 0) return false;
    const periods = contourPeriodsFromRates(model.contour?.periods, rates, model.placement, model.mpd);
    setAssignmentContour(assignment.id, periods);
    onClose();
    return true;
  };
  const release = () => {
    setAssignmentContour(assignment.id, null);
    onClose();
  };

  const cellCls = 'px-2 py-1 !text-body';
  const inputCls = 'input !text-body !px-1 !py-0.5 text-right';

  return (
    <Dialog
      overlayClassName="bg-black/60 z-[60]"
      stopBackdropPropagation
      overlayProps={{ 'data-ops-contour-dialog': true }}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[600px] max-h-[88vh] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="text-body leading-5 font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('contourDialog.title')}
          </h2>
          <span className="!text-body text-text-secondary truncate">
            {resource?.name || assignment.resourceId} · {task.name}
          </span>
        </div>
        <span className="flex items-center gap-1">
          <DialogHelpButton
            help={{ articleId: CONTOUR_HELP_ARTICLE_ID, confirmLeave: { dirty: JSON.stringify(phases) !== initialPhases, onSave: apply } }}
            onClose={onClose}
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-hover rounded-[8px]"
            aria-label={tCommon('close')}
            title={tCommon('close')}
          >
            <Icon id="ui.close" size={16} />
          </button>
        </span>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b border-border !text-body">
        <label className="flex items-center gap-1">
          <span className="text-text-secondary">{t('contourDialog.applyShape')}</span>
          <select
            className="input !text-body !px-1 !py-0.5"
            value=""
            data-ops-contour-shape
            onChange={e => { if (e.target.value) applyShape(e.target.value as ContourShape); }}
          >
            <option value="">…</option>
            {EDITABLE_CONTOUR_SHAPES.map(shape => (
              <option key={shape} value={shape}>{tCommon(SHAPE_KEY[shape])}</option>
            ))}
          </select>
        </label>
        <span className="flex-1" />
        <span className="text-text-secondary">
          {t('contourDialog.hoursPerDay', { hours: hoursPerDay })}
        </span>
      </div>

      {totalDays > 0 && (
        <div className="px-4 pt-3 pb-1">
          <ContourPhaseStrip
            phases={phases}
            actualSlots={model.actualRate}
            slotMinutes={model.mpd}
            isos={model.isos}
            scaleMax={scaleMax}
            selected={selected}
            onChange={setPhases}
            onSelect={setSelected}
            onSplit={split}
            fmtDay={fmtIso}
            fmtUnits={fmtNum}
          />
          <div className="!text-small text-text-secondary mt-1">{t('contourDialog.stripHint')}</div>
          {model.hasPartialDay && (
            <div className="!text-small text-text-secondary mt-1" data-ops-contour-partial-hint>{t('contourDialog.partialDayHint')}</div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto" ref={grid.gridRef}>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-left !text-small uppercase tracking-wide text-text-secondary border-b border-border">
              <th className={cellCls}>#</th>
              <th className={cellCls}>{t('contourDialog.from')}</th>
              <th className={cellCls}>{t('contourDialog.to')}</th>
              <th className={`${cellCls} text-right`}>{t('contourDialog.days')}</th>
              <th className={`${cellCls} text-right`}>{t('contourDialog.unitsPerDay')}</th>
              <th className={`${cellCls} text-right`}>{t('contourDialog.hoursPerDayCol')}</th>
              {model.hasActual && <th className={`${cellCls} text-right`}>{t('contourDialog.actual')}</th>}
              <th className={`${cellCls} text-right`}>{t('contourDialog.hoursTotal')}</th>
              <th className={cellCls} />
            </tr>
          </thead>
          <tbody>
            {phases.map((p, i) => {
              const start = phaseStartDay(phases, i);
              const isLast = i === phases.length - 1;
              return (
                <tr
                  key={i}
                  style={{ borderBottom: '1px solid var(--theme-border-light)', background: selected === i ? 'var(--theme-surface-alt)' : undefined }}
                  data-ops-contour-phase={i}
                  onClick={() => setSelected(i)}
                  {...grid.rowProps(String(i))}
                >
                  <td className={`${cellCls} text-text-secondary`}>{i + 1}</td>
                  <td className={cellCls}>{fmtIso(model.isos[start])}</td>
                  <td className={cellCls}>{fmtIso(model.isos[start + p.days - 1])}</td>
                  <td className={`${cellCls} text-right`}>
                    {isLast ? (
                      <span title={t('contourDialog.lastPhaseHint')}>{p.days}</span>
                    ) : (
                      <input
                        type="number" min={1} step={1}
                        value={p.days}
                        aria-label={`${t('contourDialog.days')} ${i + 1}`}
                        data-ops-contour-days={i}
                        onChange={e => commitDays(i, e.target.value)}
                        className={`${inputCls} !w-14`}
                        {...grid.cellProps(String(i), 'days')}
                      />
                    )}
                  </td>
                  <td className={`${cellCls} text-right`}>
                    <input
                      type="text" inputMode="decimal"
                      value={unitsText[i] ?? ''}
                      aria-label={`${t('contourDialog.unitsPerDay')} ${i + 1}`}
                      aria-invalid={invalidRows[i]}
                      data-ops-contour-units={i}
                      onChange={e => commitUnitsText(i, e.target.value)}
                      className={`${inputCls} !w-16${invalidRows[i] ? ' input--error' : ''}`}
                      {...grid.cellProps(String(i), 'units')}
                    />
                  </td>
                  <td className={`${cellCls} text-right text-text-secondary`}>{fmtNum(p.unitsPerDay * hoursPerDay)}</td>
                  {model.hasActual && <td className={`${cellCls} text-right text-text-secondary`}>{fmtHours(actualMinutesOfPhase(i))}</td>}
                  <td className={`${cellCls} text-right`} data-ops-contour-phase-hours={i}>{fmtHours(remainingMinutesOfPhase(i))}</td>
                  <td className={`${cellCls} whitespace-nowrap`}>
                    <button
                      type="button"
                      className="ops-textlink !text-small mr-2 disabled:opacity-40"
                      disabled={p.days < 2}
                      data-ops-contour-split={i}
                      onClick={e => { e.stopPropagation(); split(i, Math.floor(p.days / 2)); }}
                    >
                      {t('contourDialog.split')}
                    </button>
                    <button
                      type="button"
                      className="ops-textlink !text-small disabled:opacity-40"
                      disabled={isLast}
                      data-ops-contour-merge={i}
                      onClick={e => { e.stopPropagation(); merge(i); }}
                    >
                      {t('contourDialog.merge')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t border-border">
              <td className={cellCls} />
              <td className={cellCls} colSpan={2}>{tCommon('resource.total')}</td>
              <td className={`${cellCls} text-right`}>{totalDays}</td>
              <td className={cellCls} />
              <td className={cellCls} />
              {model.hasActual && <td className={`${cellCls} text-right`}>{fmtHours(actualMinutes)}</td>}
              <td className={`${cellCls} text-right`} data-ops-contour-total>{fmtHours(remainingMinutes)}</td>
              <td className={cellCls} />
            </tr>
          </tfoot>
        </table>
        {totalDays === 0 && (
          <div className="p-4 !text-body text-text-secondary">{t('contourDialog.noDays')}</div>
        )}
      </div>

      <div className="px-4 py-2 !text-small text-text-secondary border-t border-border">
        {t('contourDialog.hint')}
      </div>

      <div className="flex items-center gap-3 px-4 py-3 border-t border-border">
        {model.contour && (
          <button onClick={release} className="btn btn--sm btn--secondary" data-ops-contour-release>
            {t('contourDialog.release')}
          </button>
        )}
        <span className="flex-1" />
        <button onClick={onClose} className="btn btn--sm btn--secondary">
          {tCommon('cancel')}
        </button>
        <button
          onClick={apply}
          disabled={anyInvalid || totalDays === 0}
          className="btn btn--sm btn--primary shadow-[var(--shadow-glow)] disabled:opacity-40"
          data-ops-contour-apply
        >
          {tCommon('apply')}
        </button>
      </div>
    </Dialog>
  );
}
