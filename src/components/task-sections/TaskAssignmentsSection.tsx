import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import type { ResourceCurve } from '@/types/resource';
import { UnitsInput } from '@/components/common/UnitsInput';
import { AlertTriangle, BarChart3, Lock, Trash2 } from 'lucide-react';
import { RESOURCE_CURVES, CURVE_KEY } from './shared';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { assignmentCurveState, contouredAssignmentIds } from '@/engine/contour/curveState';
import { ContourDialog } from '@/components/dialogs/ContourDialog';
import { matchContoursToAssignments } from '@/engine/contour/contourEngine';
import { effectiveWorkRule, remainingMinutesOf, workRuleApplies } from '@/engine/work/workRuleApply';
import { ruleProtectsWork } from '@/engine/work/workTriangle';
import { taskTypesUnlocked } from '@/state/taskTypesVisibility';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';

/** Pseudowaarden van de curve-dropdown voor de twee data-toestanden van de contour-engine:
 *  een opgeslagen contour (de dropdown is dan uitgeschakeld — loslaten gaat via het
 *  contourvenster, expliciet en niet als bijeffect van een curvekeuze) en een geïmporteerde exacte
 *  curve zonder OPS-vorm (kiesbaar: een nieuwe curvekeuze vervangt de importcurve, zie
 *  `resourceSlice.updateAssignment`). */
const CONTOURED = '__contoured';
const IMPORTED_CURVE = '__importedCurve';

/**
 * Werkinvoer in uren die pas op Enter/blur commit — anders zou elke
 * toetsaanslag ("6" op weg naar "64") een eigen driehoekstap, undo-stap en contour-/venster-nazorg
 * afvuren. Ongeldig (≤ 0 of geen getal) ⇒ rode rand, geen commit, terug naar de getoonde waarde.
 */
function WorkHoursInput({ value, onCommit, ariaLabel, title, className }: {
  value: number; onCommit: (hours: number) => void; ariaLabel: string; title: string; className: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const parsed = parseFloat(shown.replace(',', '.'));
  const invalid = draft !== null && !(Number.isFinite(parsed) && parsed > 0);
  const commit = () => {
    if (draft !== null && Number.isFinite(parsed) && parsed > 0 && parsed !== value) onCommit(parsed);
    setDraft(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); }
    if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); }
  };
  return (
    <input
      type="number"
      min="0"
      step="any"
      value={shown}
      title={title}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      className={className}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

/**
 * Toewijzingen (incl. "verplaats naar…") — sectie van
 * `TaskPropertiesPanel`. RELATIONEEL/storeful: roept `assignResource`/
 * `updateAssignment`/`unassignResource`/`moveAssignment` rechtstreeks aan, identiek in paneel
 * én dialoog. Contour-UI: per toewijzing een knop naar `ContourDialog` (urenverdeling
 * per werkdag); een toewijzing mét opgeslagen contour toont dat in de curve-dropdown.
 */
export function TaskAssignmentsSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const tasks = useAppStore(s => s.tasks);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const assignResource = useAppStore(s => s.assignResource);
  const updateAssignment = useAppStore(s => s.updateAssignment);
  const unassignResource = useAppStore(s => s.unassignResource);
  const moveAssignment = useAppStore(s => s.moveAssignment);
  // Kolom "Werk (rest)" + slotjes op de beschermde hoek(en).
  const setAssignmentWork = useAppStore(s => s.setAssignmentWork);
  const unlocked = useAppStore(s => taskTypesUnlocked(s));
  const defaultWorkRule = useAppStore(s => s.project.defaultWorkRule);
  const calendars = useAppStore(s => s.calendars);
  const projectCalendar = useAppStore(s => s.calendar);
  const [contourAssignmentId, setContourAssignmentId] = useState<string | null>(null);

  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  // Toewijzingen — leaf-only, geen mijlpalen/samenvattingstaken.
  const taskAssignments = assignments.filter(a => a.taskId === taskId);
  // Dezelfde weergaveregel als het resourcediagram (`curveState.ts`): contour > geïmporteerde curve > vorm.
  const contouredIds = contouredAssignmentIds(task, taskAssignments);
  // De gekoppelde contour zelf, voor het restwerk uit de `remaining`-periodes.
  const contourOf = matchContoursToAssignments(task.timephasedContours, taskAssignments);
  const assignmentsDisabled = task.isMilestone || isSummaryTask(task);
  const assignedResourceIds = new Set(taskAssignments.map(a => a.resourceId));
  const availableResources = resources.filter(r => !assignedResourceIds.has(r.id));
  const rule = effectiveWorkRule(task, defaultWorkRule);
  const unitsProtected = rule === 'FIXED_DURATION_RATE' || rule === 'FIXED_RATE';
  const workProtected = ruleProtectsWork(rule);
  // De werkkolom alleen waar de regel werkt (geen hangmat/ELAPSEDTIME — de kern zou stil weigeren).
  const showWork = unlocked && workRuleApplies(task);
  const hoursPerDay = taskCalendarHoursPerDay(task, calendars, projectCalendar);
  /** Resterend werk in uren: opgeslagen, anders de som van de `remaining`-periodes van een contour,
   *  anders afgeleid als restduur × inzet. */
  const remainingHoursOf = (assignmentId: string, unitsPerDay: number, stored: number | undefined): number => {
    const contour = contourOf.get(assignmentId);
    const contourRemaining = contour
      ? contour.periods.reduce((sum, p) => sum + (p.kind === 'actual' ? 0 : p.workMinutes), 0)
      : undefined;
    const minutes = stored ?? contourRemaining ?? remainingMinutesOf(task, { hoursPerDay }) * unitsPerDay;
    return Math.round((minutes / 60) * 100) / 100;
  };
  const lockTitle = t('properties.assignments.locked', { rule: t(`workRule.${rule}`) });
  /** Opgeslagen werk dat afwijkt van
   *  inzet × restduur (bv. een P6-toewijzing met een eigen spanne binnen de taak) krijgt een
   *  markering — géén stille aanpassing van de inzet (brondata). Niet bij een contour: die
   *  vormt de inzet per dag zelf. Tolerantie 1 % (en minstens een minuut) tegen afronding. */
  const workDeviation = (assignmentId: string, unitsPerDay: number, stored: number | undefined): { stored: number; derived: number } | null => {
    if (stored === undefined || contourOf.has(assignmentId)) return null;
    const derived = remainingMinutesOf(task, { hoursPerDay }) * unitsPerDay;
    if (Math.abs(stored - derived) <= Math.max(1, 0.01 * Math.max(stored, derived))) return null;
    const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;
    return { stored: hours(stored), derived: hours(derived) };
  };

  /** Kandidaat-doeltaken voor "verplaats naar…" (item 4): leaf-taken zonder deze resource, exclusief
   *  de huidige taak zelf. */
  const moveCandidates = (resourceId: string) => tasks.filter(t =>
    t.id !== taskId && !t.isMilestone && isLeafTask(t)
    && !assignments.some(a => a.taskId === t.id && a.resourceId === resourceId)
  );

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-small !leading-4">{t('properties.assignments.title')}</span>
      {assignmentsDisabled ? (
        <span className="!text-small text-text-secondary italic">
          {task.isMilestone
            ? t('properties.assignments.disabledMilestone')
            : t('properties.assignments.disabledSummary')}
        </span>
      ) : (
        <>
          {taskAssignments.length === 0 && (
            <span className="!text-small text-text-secondary">{t('properties.assignments.empty')}</span>
          )}
          {showWork && taskAssignments.length > 0 && (
            // De kop hoort bij de TWEEDE regel van elke toewijzing (inzet,
            // werk, curve, acties); het slotje is een eigen `shrink-0`-icoon naast een kop die mag
            // afbreken, zodat "EENH./DAG" het nooit tot 0 px wegdrukt.
            <div className="flex items-end gap-1 text-caption leading-3 uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }} data-ops-assignment-header>
              <span className="w-[calc(var(--text-small)*5)] shrink-0 flex items-end justify-end gap-0.5" title={unitsProtected ? lockTitle : undefined} data-ops-assignment-lock-units={unitsProtected ? 'locked' : 'free'}>
                {unitsProtected && <Lock size={9} className="shrink-0" />}<span className="min-w-0 text-right">{t('properties.assignments.unitsPerDay')}</span>
              </span>
              <span className="w-[calc(var(--text-small)*5)] shrink-0 flex items-end justify-end gap-0.5" title={workProtected ? lockTitle : t('properties.assignments.workHint')} data-ops-assignment-lock-work={workProtected ? 'locked' : 'free'}>
                {workProtected && <Lock size={9} className="shrink-0" />}<span className="min-w-0 text-right">{t('properties.assignments.work')}</span>
              </span>
              <span className="flex-1" />
            </div>
          )}
          {taskAssignments.map(a => {
            const res = resources.find(r => r.id === a.resourceId);
            const candidates = moveCandidates(a.resourceId);
            const curveState = assignmentCurveState(a, contouredIds.has(a.id));
            const contoured = curveState === 'contoured';
            const importedCurve = curveState === 'imported';
            const curveValue = contoured ? CONTOURED : importedCurve ? IMPORTED_CURVE : curveState;
            return (
              // Twee regels — de naam op volle breedte (afkappen met title,
              // nooit 0 px) met de verwijderknop, daaronder inzet, werk, curve en acties.
              <div key={a.id} className="flex flex-col gap-0.5 !text-small" data-ops-assignment-row={a.id}>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="flex-1 min-w-0 truncate font-medium" title={res?.name} data-ops-assignment-name>{res?.name || '?'}</span>
                  <button onClick={() => unassignResource(a.id)} className="shrink-0 p-0.5 rounded" style={{ color: 'var(--error)' }} title={t('properties.assignments.remove')} aria-label={t('properties.assignments.remove')} data-ops-assignment-remove>
                    <Trash2 size={10} />
                  </button>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <UnitsInput
                    value={a.unitsPerDay}
                    title={`${t('properties.assignments.unitsPerDay')}: ${a.unitsPerDay}`}
                    ariaLabel={`${t('properties.assignments.unitsPerDay')} — ${res?.name ?? a.resourceId}`}
                    onCommit={n => updateAssignment(a.id, { unitsPerDay: n })}
                    className="input !text-small !px-1 !py-0.5 !w-[calc(var(--text-small)*5)] shrink-0 text-right"
                  />
                  {showWork && (res?.type === 'MATERIAL' ? (
                    <span className="w-[calc(var(--text-small)*5)] shrink-0 text-right text-text-secondary" data-ops-assignment-work="material">—</span>
                  ) : (
                    <span className="shrink-0 flex items-center gap-0.5" data-ops-assignment-work={a.remainingWorkMinutes !== undefined ? 'stored' : 'derived'}>
                      <WorkHoursInput
                        value={remainingHoursOf(a.id, a.unitsPerDay, a.remainingWorkMinutes)}
                        title={t('properties.assignments.workHint')}
                        ariaLabel={`${t('properties.assignments.work')} — ${res?.name ?? a.resourceId}`}
                        onCommit={hours => setAssignmentWork(a.id, Math.round(hours * 60))}
                        className="input !text-small !px-1 !py-0.5 !w-[calc(var(--text-small)*5)] text-right"
                      />
                      {(() => {
                        const deviation = workDeviation(a.id, a.unitsPerDay, a.remainingWorkMinutes);
                        return deviation && (
                          <span
                            className="shrink-0 inline-flex items-center"
                            style={{ color: 'var(--theme-warning-text)' }}
                            title={t('properties.assignments.workDeviatesHint', deviation)}
                            aria-label={t('properties.assignments.workDeviates')}
                            role="img"
                            data-ops-assignment-work-deviates={`${deviation.stored}/${deviation.derived}`}
                          >
                            <AlertTriangle size={11} aria-hidden />
                          </span>
                        );
                      })()}
                    </span>
                  ))}
                  <select
                    value={curveValue}
                    disabled={contoured}
                    title={contoured ? t('properties.assignments.contouredHint') : t('properties.assignments.curve')}
                    aria-label={t('properties.assignments.curve')}
                    onChange={e => {
                      if (e.target.value === CONTOURED || e.target.value === IMPORTED_CURVE) return;
                      updateAssignment(a.id, { curve: e.target.value as ResourceCurve });
                    }}
                    className="input !text-small !px-1 !py-0.5 flex-1 min-w-0 !w-auto disabled:opacity-60"
                    data-ops-assignment-curve
                  >
                    {contoured && <option value={CONTOURED}>{t('properties.assignments.contoured')}</option>}
                    {importedCurve && <option value={IMPORTED_CURVE} disabled>{t('properties.assignments.importedCurve')}</option>}
                    {RESOURCE_CURVES.map(c => (
                      <option key={c} value={c}>{tCommon(CURVE_KEY[c])}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setContourAssignmentId(a.id)}
                    className="shrink-0 p-0.5 rounded"
                    style={{ color: contoured ? 'var(--theme-accent)' : undefined }}
                    title={t('properties.assignments.contour')}
                    aria-label={t('properties.assignments.contour')}
                    data-ops-assignment-contour={contoured ? 'contoured' : 'formula'}
                  >
                    <BarChart3 size={10} />
                  </button>
                  {candidates.length > 0 && (
                    <select
                      value=""
                      title={t('properties.assignments.moveTo')}
                      aria-label={t('properties.assignments.moveTo')}
                      onChange={e => { if (e.target.value) moveAssignment(a.id, e.target.value); }}
                      className="input !text-small !px-1 !py-0.5 flex-1 min-w-0 !w-auto"
                      data-ops-assignment-move
                    >
                      <option value="">{t('properties.assignments.moveTo')}</option>
                      {candidates.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.wbsCode ? `${c.wbsCode} — ${c.name}` : c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            );
          })}
          {availableResources.length > 0 ? (
            <select
              value=""
              onChange={e => { if (e.target.value) assignResource(taskId, e.target.value, 1); }}
              className="input !text-small !leading-4 !px-2.5 !py-1.5"
            >
              <option value="">{t('properties.assignments.add')}</option>
              {availableResources.map(r => (
                <option key={r.id} value={r.id}>{r.name || r.id}</option>
              ))}
            </select>
          ) : (
            <span className="!text-small text-text-secondary">
              {resources.length === 0
                ? t('properties.assignments.noResources')
                : t('properties.assignments.allAssigned')}
            </span>
          )}
        </>
      )}
      {contourAssignmentId && (
        <ContourDialog assignmentId={contourAssignmentId} onClose={() => setContourAssignmentId(null)} />
      )}
    </>
  );
}
