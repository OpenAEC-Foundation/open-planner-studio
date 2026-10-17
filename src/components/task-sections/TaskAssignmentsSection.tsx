import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import type { ResourceCurve } from '@/types/resource';
import { UnitsInput } from '@/components/common/UnitsInput';
import { Select, type SelectOption } from '@/components/common/Select';
import { localizeDecimalPoint } from '@/utils/reportNumber';
import { AlertTriangle, BarChart3, Lock, Trash2 } from 'lucide-react';
import { RESOURCE_CURVES, CURVE_KEY } from './shared';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { assignmentCurveState, contouredAssignmentIds } from '@/engine/contour/curveState';
import { ContourDialog } from '@/components/dialogs/ContourDialog';
import { matchContoursToAssignments } from '@/engine/contour/contourEngine';
import { effectiveWorkRule, remainingMinutesOf, workRuleApplies } from '@/engine/work/workRuleApply';
import { assignmentWorkDeviation } from '@/engine/work/assignmentWorkDeviation';
import { ruleProtectsWork } from '@/engine/work/workTriangle';
import { taskTypesUnlocked } from '@/state/taskTypesVisibility';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import { createMoveCandidateLookup } from './moveCandidates';

/** Pseudowaarden van de curve-dropdown voor de twee data-toestanden van de contour-engine:
 *  een opgeslagen contour (de dropdown is dan uitgeschakeld — loslaten gaat via het
 *  contourvenster, expliciet en niet als bijeffect van een curvekeuze) en een geïmporteerde exacte
 *  curve zonder OPS-vorm (kiesbaar: een nieuwe curvekeuze vervangt de importcurve, zie
 *  `resourceSlice.updateAssignment`). */
const CONTOURED = '__contoured';
const IMPORTED_CURVE = '__importedCurve';

/**
 * Keuzelijst "verplaats naar…" die zijn opties pas bouwt als de gebruiker hem opent (focus of
 * muisklik). Op een groot project zijn dat duizenden opties per toewijzingsrij; die bij elke
 * render bouwen maakte selecteren en bewerken onbruikbaar (prestatiemeting rehab-2, 2026-10-07).
 * De eigen `Select` (nooit native, besluit eigenaar 2026-10-15) heeft geen open-event; de omhulling
 * luistert daarom zelf naar `pointerdown` en focus. `pointerdown` is een discreet React-event: de
 * state-update rendert synchroon, dus de opties staan er al als de klik de lijst openklapt.
 * Hermeting 2026-10-17 (rehab-2.xer, 6978 taken, 40 taken met toewijzingen selecteren): lui
 * mediaan 120–131 ms, met de lijst bij elke render 189 ms. De omhulling blijft dus.
 * `data-ops-assignment-move-options` telt de gebouwde opties; de browsertest toetst daarop dat er
 * vóór focus niets gebouwd is.
 */
function MoveToSelect({ label, candidates, onMove }: {
  label: string; candidates: () => Task[]; onMove: (targetTaskId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: SelectOption[] = open
    ? candidates().map(c => ({ value: c.id, label: c.wbsCode ? `${c.wbsCode} — ${c.name}` : c.name }))
    : [];
  return (
    <div
      className="min-w-0"
      title={label}
      onFocus={() => setOpen(true)}
      onPointerDown={() => setOpen(true)}
      onBlur={e => {
        // Het menu staat in een portal; React laat zijn events toch door deze omhulling bubbelen.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      data-ops-assignment-move={open ? 'open' : 'closed'}
      data-ops-assignment-move-options={options.length}
    >
      <Select
        value=""
        placeholder={label}
        aria-label={label}
        options={options}
        onChange={v => { if (v) onMove(v); }}
        className="ops-select__trigger--compact"
      />
    </div>
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
  const { t, i18n } = useTranslation('task');
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
  // Eén index per (taken, toewijzingen) — zie `moveCandidates.ts`. Vóór de vroege uitstap: hooks.
  const moveLookup = useMemo(() => createMoveCandidateLookup(tasks, assignments), [tasks, assignments]);

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
            // Alleen "is er een kandidaat?" per render; de lijst zelf bouwt `MoveToSelect` pas bij openen.
            const canMove = moveLookup.has(taskId, a.resourceId);
            const curveState = assignmentCurveState(a, contouredIds.has(a.id));
            const contoured = curveState === 'contoured';
            const importedCurve = curveState === 'imported';
            const curveValue = contoured ? CONTOURED : importedCurve ? IMPORTED_CURVE : curveState;
            const curveOptions: SelectOption[] = [
              ...(contoured ? [{ value: CONTOURED, label: t('properties.assignments.contoured') }] : []),
              ...(importedCurve ? [{ value: IMPORTED_CURVE, label: t('properties.assignments.importedCurve'), disabled: true }] : []),
              ...RESOURCE_CURVES.map(c => ({ value: c, label: tCommon(CURVE_KEY[c]) })),
            ];
            const isMaterial = res?.type === 'MATERIAL';
            // Opgeslagen werk dat afwijkt van inzet × restduur krijgt een markering (zelfde regel
            // als de planningssuite toetst). Hij staat naast de naam, niet in de veldenregel.
            const deviation = showWork && !isMaterial
              ? assignmentWorkDeviation(task, a.unitsPerDay, a.remainingWorkMinutes, hoursPerDay, contourOf.has(a.id))
              : null;
            return (
              // Drie regels, zodat in het smalste paneel niets wordt afgeknipt (eigenaar 2026-10-15):
              // 1. naam (afkappen met title, nooit 0 px), ⚠ en verwijderknop;
              // 2. inzet, werk en de curvegroep (curve + histogramknop). De curvegroep is zo breed als
              //    het langste curvelabel (`fitWidestOption`); past hij niet meer naast inzet en werk,
              //    dan schuift hij als geheel naar een eigen regel (`flex-wrap`);
              // 3. "Verplaatsen naar…" over de volle breedte, alleen als er een kandidaat is.
              <div key={a.id} className="flex flex-col gap-1 !text-small" data-ops-assignment-row={a.id}>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="flex-1 min-w-0 truncate font-medium" title={res?.name} data-ops-assignment-name>{res?.name || '?'}</span>
                  {deviation && (
                    <span
                      className="shrink-0 inline-flex items-center"
                      style={{ color: 'var(--theme-warning-text)' }}
                      title={t('properties.assignments.workDeviatesHint', deviation)}
                      aria-label={t('properties.assignments.workDeviates')}
                      role="img"
                      data-ops-assignment-work-deviates={`${deviation.stored}/${deviation.derived}`}
                    >
                      <AlertTriangle size={12} aria-hidden />
                    </span>
                  )}
                  <button onClick={() => unassignResource(a.id)} className="shrink-0 p-0.5 rounded" style={{ color: 'var(--error)' }} title={t('properties.assignments.remove')} aria-label={t('properties.assignments.remove')} data-ops-assignment-remove>
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1 min-w-0" data-ops-assignment-fields>
                  <UnitsInput
                    value={a.unitsPerDay}
                    locale={i18n.language}
                    commitOnBlur
                    // De exacte opgeslagen waarde, met het decimaalteken van de taal.
                    title={`${t('properties.assignments.unitsPerDay')}: ${localizeDecimalPoint(String(a.unitsPerDay), i18n.language)}`}
                    ariaLabel={`${t('properties.assignments.unitsPerDay')} — ${res?.name ?? a.resourceId}`}
                    onCommit={n => updateAssignment(a.id, { unitsPerDay: n })}
                    className="input !text-small !px-1 !py-0.5 !h-6 !w-[calc(var(--text-small)*5)] shrink-0 text-right"
                  />
                  {showWork && (isMaterial ? (
                    <span className="w-[calc(var(--text-small)*5)] shrink-0 text-right text-text-secondary" data-ops-assignment-work="material">—</span>
                  ) : (
                    <span className="shrink-0 flex items-center" data-ops-assignment-work={a.remainingWorkMinutes !== undefined ? 'stored' : 'derived'}>
                      {/* Werk in uren: zelfde veld als de inzet. Het commit pas op Enter/blur —
                          anders zou elke toetsaanslag ("6" op weg naar "64") een eigen
                          driehoekstap, undo-stap en contour-nazorg afvuren. Opslag is in hele
                          minuten: wat afrondt tot 0 minuten ("0,004" uur) is ongeldig, niet een
                          stille weigering in `setAssignmentWork`. */}
                      <UnitsInput
                        value={remainingHoursOf(a.id, a.unitsPerDay, a.remainingWorkMinutes)}
                        title={t('properties.assignments.workHint')}
                        ariaLabel={`${t('properties.assignments.work')} — ${res?.name ?? a.resourceId}`}
                        onCommit={hours => setAssignmentWork(a.id, Math.round(hours * 60))}
                        accepts={hours => Math.round(hours * 60) >= 1}
                        commitOnBlur
                        className="input !text-small !px-1 !py-0.5 !h-6 !w-[calc(var(--text-small)*5)] text-right"
                        locale={i18n.language}
                      />
                    </span>
                  ))}
                  {/* Bewust GEEN `shrink-0` op de groep of de omhulling: bij een smal paneel met een
                      grote tekstschaal (uk/ru/pl op 125 %) mag de groep dan krimpen, en de trigger
                      krimpt met een ellips in plaats van buiten het paneel te vallen. */}
                  <div className="flex items-center gap-1" data-ops-assignment-curve-group>
                    <div title={contoured ? t('properties.assignments.contouredHint') : t('properties.assignments.curve')} data-ops-assignment-curve={curveValue}>
                      <Select
                        value={curveValue}
                        disabled={contoured}
                        aria-label={t('properties.assignments.curve')}
                        options={curveOptions}
                        fitWidestOption
                        onChange={v => {
                          // Dezelfde keuze opnieuw komt hier niet: `Select` roept zonder
                          // `onReselect` geen `onChange` aan. Belangrijk, want `updateAssignment` met
                          // `curve` wist de geïmporteerde exacte curve (`curveValues`, P6/MSPDI); de
                          // spec "dezelfde curve opnieuw" bewaakt dat.
                          if (v === CONTOURED || v === IMPORTED_CURVE) return;
                          updateAssignment(a.id, { curve: v as ResourceCurve });
                        }}
                        className="ops-select__trigger--compact"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setContourAssignmentId(a.id)}
                      className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded hover:bg-surface-hover"
                      style={{ color: contoured ? 'var(--theme-accent)' : undefined }}
                      title={t('properties.assignments.contour')}
                      aria-label={t('properties.assignments.contour')}
                      data-ops-assignment-contour={contoured ? 'contoured' : 'formula'}
                    >
                      <BarChart3 size={12} />
                    </button>
                  </div>
                </div>
                {canMove && (
                  <MoveToSelect
                    label={t('properties.assignments.moveTo')}
                    candidates={() => moveLookup.list(taskId, a.resourceId)}
                    onMove={target => moveAssignment(a.id, target)}
                  />
                )}
              </div>
            );
          })}
          {availableResources.length > 0 ? (
            <div data-ops-assignment-add>
              <Select
                value=""
                placeholder={t('properties.assignments.add')}
                aria-label={t('properties.assignments.add')}
                options={availableResources.map(r => ({ value: r.id, label: r.name || r.id }))}
                onChange={v => { if (v) assignResource(taskId, v, 1); }}
                className="!h-9 !py-0 !px-2.5 !text-small !leading-4"
              />
            </div>
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
