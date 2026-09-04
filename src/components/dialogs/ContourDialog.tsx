import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Dialog } from '@/components/common/Dialog';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { assignmentDayUnits, taskWorkDayIsos } from '@/engine/scheduler/ResourceLoad';
import { contourIndexForAssignment, type ContourShape } from '@/engine/contour/contourEngine';
import {
  EDITABLE_CONTOUR_SHAPES, buildEditedContourPeriods, contourDaySlots, shapeSlotWork,
} from '@/engine/contour/contourEdit';
import { parseDate } from '@/utils/dateUtils';

/** ContourShape → i18n-key in de common-namespace (`resource.curve.*`, dezelfde familie als
 *  `task-sections/shared.tsx`'s `CURVE_KEY`; FLAT deelt het label "Uniform"). */
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

/** Uren met hooguit twee decimalen, zonder overbodige nullen (draft-tekst én weergave). */
function fmtHours(minutes: number): string {
  const h = Math.round((minutes / 60) * 100) / 100;
  return String(h);
}

function fmtUnits(minutes: number, mpd: number): string {
  if (mpd <= 0) return '—';
  return (Math.round((minutes / mpd) * 100) / 100).toString();
}

/**
 * Contour-UI (2026-09) — het dialoogvenster waarmee de gebruiker de urenverdeling van ÉÉN
 * toewijzing per werkdag bewerkt. Gestapeld bóven het eigenschappenpaneel óf de taakdialoog
 * (`z-[60]` + `stopBackdropPropagation`, hetzelfde patroon als `ConfirmDialog`), want de
 * Toewijzingen-sectie leeft op beide plekken.
 *
 * Model (puur, `contourEdit.ts`): per werkdag van de taak — dezelfde dagenlijst als het histogram
 * (`taskWorkDayIsos`) — het VERRICHTE werk (alleen-lezen, uit de `actual`-periodes) en het
 * RESTERENDE werk (bewerkbaar, in uren). Zonder opgeslagen contour is het vertrekpunt precies wat de
 * lastlezers nu al boeken (`assignmentDayUnits` × slotminuten: de curve-formule of de exacte
 * P6-/MSPDI-curve), zodat "Toepassen" zonder wijziging de huidige verdeling als data vastlegt en
 * niets anders. Toepassen ⇒ `setAssignmentContour(periodes)`; Loslaten ⇒ `null` (terug naar de
 * formule). Geen enkele knop raakt een taakdatum of een onderbreking (zie `contourEdit.ts`).
 */
export function ContourDialog({ assignmentId, onClose }: { assignmentId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const tasks = useAppStore(s => s.tasks);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  const setAssignmentContour = useAppStore(s => s.setAssignmentContour);

  const assignment = assignments.find(a => a.id === assignmentId);
  const task = assignment ? tasks.find(x => x.id === assignment.taskId) : undefined;
  const resource = assignment ? resources.find(r => r.id === assignment.resourceId) : undefined;

  // Vertrekpunt — één keer berekend bij het openen (lazy `useState`-initialisatie: de dialoog is
  // modaal en de store wijzigt intussen niet door deze dialoog zelf).
  const [model] = useState(() => {
    if (!assignment || !task) return null;
    const engine = new CalendarEngine(calendarForEngine(resolveCalendar(task.calendarId, calendars, calendar)));
    const mpd = engine.hoursPerDay * 60;
    const siblings = assignments.filter(a => a.taskId === task.id);
    const idx = contourIndexForAssignment(task.timephasedContours, siblings, assignment.id);
    const contour = idx >= 0 ? task.timephasedContours![idx] : null;
    const durationDays = Math.max(0, Math.ceil(task.time.scheduleDuration));
    let actual: number[];
    let remaining: number[];
    if (contour) {
      const slots = contourDaySlots(contour.periods, task.splitGaps, mpd, durationDays);
      actual = slots.actual;
      remaining = slots.remaining;
    } else {
      actual = [];
      remaining = assignmentDayUnits(task, assignment, mpd, null).map(u => u * mpd);
      while (remaining.length < durationDays) remaining.push(0);
      actual = remaining.map(() => 0);
    }
    const isos = taskWorkDayIsos(task, engine, Math.max(durationDays, remaining.length));
    return { engine, mpd, contour, actual, remaining, isos, hasActual: actual.some(m => m > 0) };
  });

  const [draft, setDraft] = useState<string[]>(() => (model ? model.remaining.map(fmtHours) : []));

  // Escape sluit ALLEEN dit venster. Capture-fase + `stopImmediatePropagation`, zoals `ConfirmDialog`:
  // de globale Escape-sneltoets (`edit.deselect`, `shortcutRegistry.ts`) heeft geen dialooggrendel
  // en zou anders — met de focus op een knop i.p.v. een invoerveld — de taak deselecteren en daarmee
  // het eigenschappenpaneel (en dit venster) onder de gebruiker wegtrekken.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (!assignment || !task || !model) return null;

  const parsed = draft.map(text => {
    const trimmed = text.trim().replace(',', '.');
    if (trimmed === '') return 0;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n * 60 : NaN;
  });
  const invalidRows = parsed.map(v => Number.isNaN(v));
  const anyInvalid = invalidRows.some(Boolean);
  const totalRemaining = parsed.reduce((a, v) => a + (Number.isNaN(v) ? 0 : v), 0);
  const totalActual = model.actual.reduce((a, v) => a + v, 0);
  const hoursPerDay = model.engine.hoursPerDay;

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const fmtIso = (iso: string | undefined) => {
    if (!iso) return '—';
    try { return dateFmt.format(parseDate(iso)); } catch { return iso; }
  };

  const applyShape = (shape: ContourShape) => {
    const total = totalRemaining > 0 ? totalRemaining : assignment.unitsPerDay * draft.length * model.mpd;
    setDraft(shapeSlotWork(shape, total, draft.length).map(fmtHours));
  };

  const apply = () => {
    if (anyInvalid) return;
    const periods = buildEditedContourPeriods(model.contour?.periods, parsed, task.splitGaps, model.mpd);
    setAssignmentContour(assignment.id, periods);
    onClose();
  };

  const release = () => {
    setAssignmentContour(assignment.id, null);
    onClose();
  };

  const cellCls = 'px-2 py-1 text-[11px]';

  return (
    <Dialog
      overlayClassName="bg-black/60 z-[60]"
      stopBackdropPropagation
      onBackdropClick={onClose}
      overlayProps={{ 'data-ops-contour-dialog': true }}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[85vh] flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('contourDialog.title')}
          </h2>
          <span className="text-[11px] text-text-secondary truncate">
            {resource?.name || assignment.resourceId} · {task.name}
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded-[8px]" title={tCommon('close')}>
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-[11px]">
        <label className="flex items-center gap-1">
          <span className="text-text-secondary">{t('contourDialog.applyShape')}</span>
          <select
            className="input !text-[11px] !px-1 !py-0.5"
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

      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-left text-[10px] uppercase tracking-wide text-text-secondary border-b border-border">
              <th className={cellCls}>#</th>
              <th className={cellCls}>{t('contourDialog.day')}</th>
              {model.hasActual && <th className={`${cellCls} text-right`}>{t('contourDialog.actual')}</th>}
              <th className={`${cellCls} text-right`}>{t('contourDialog.remaining')}</th>
              <th className={`${cellCls} text-right`}>{t('contourDialog.units')}</th>
            </tr>
          </thead>
          <tbody>
            {draft.map((text, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--theme-border-light)' }} data-ops-contour-row={i}>
                <td className={`${cellCls} text-text-secondary`}>{i + 1}</td>
                <td className={cellCls}>{fmtIso(model.isos[i])}</td>
                {model.hasActual && (
                  <td className={`${cellCls} text-right text-text-secondary`}>{fmtHours(model.actual[i] ?? 0)}</td>
                )}
                <td className={`${cellCls} text-right`}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={text}
                    aria-label={`${t('contourDialog.remaining')} ${i + 1}`}
                    aria-invalid={invalidRows[i]}
                    data-ops-contour-hours={i}
                    onChange={e => {
                      const next = [...draft];
                      next[i] = e.target.value;
                      setDraft(next);
                    }}
                    className={`input !text-[11px] !px-1 !py-0.5 !w-20 text-right${invalidRows[i] ? ' input--error' : ''}`}
                  />
                </td>
                <td className={`${cellCls} text-right text-text-secondary`}>
                  {invalidRows[i] ? '—' : fmtUnits((model.actual[i] ?? 0) + parsed[i], model.mpd)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t border-border">
              <td className={cellCls} />
              <td className={cellCls}>{tCommon('resource.total')}</td>
              {model.hasActual && <td className={`${cellCls} text-right`}>{fmtHours(totalActual)}</td>}
              <td className={`${cellCls} text-right`} data-ops-contour-total>{fmtHours(totalRemaining)}</td>
              <td className={`${cellCls} text-right text-text-secondary`}>
                {fmtUnits(totalActual + totalRemaining, model.mpd * Math.max(1, draft.length))}
              </td>
            </tr>
          </tfoot>
        </table>
        {draft.length === 0 && (
          <div className="p-4 text-[11px] text-text-secondary">{t('contourDialog.noDays')}</div>
        )}
      </div>

      <div className="px-4 py-2 text-[10px] text-text-secondary border-t border-border">
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
          disabled={anyInvalid || draft.length === 0}
          className="btn btn--sm btn--primary shadow-[var(--shadow-glow)] disabled:opacity-40"
          data-ops-contour-apply
        >
          {tCommon('apply')}
        </button>
      </div>
    </Dialog>
  );
}
