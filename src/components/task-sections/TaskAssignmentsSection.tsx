import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { refusalNotice } from '@/state/refusalNotice';
import type { ResourceCurve } from '@/types/resource';
import { UnitsInput } from '@/components/common/UnitsInput';
import { Select, type SelectOption } from '@/components/common/Select';
import { decimalSeparatorOf, localizeDecimalPoint } from '@/utils/reportNumber';
import { AlertTriangle, BarChart3, ChevronRight, Lock, Trash2 } from 'lucide-react';
import { RESOURCE_CURVES, CURVE_KEY } from './shared';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { assignmentCurveState, contouredAssignmentIds } from '@/engine/contour/curveState';
import { ContourDialog } from '@/components/dialogs/ContourDialog';
import { matchContoursToAssignments } from '@/engine/contour/contourEngine';
import { effectiveWorkRule, remainingMinutesOf, workRuleApplies } from '@/engine/work/workRuleApply';
import { assignmentWorkDeviation, workDeviationEffectKey } from '@/engine/work/assignmentWorkDeviation';
import { ruleProtectsWork } from '@/engine/work/workTriangle';
import { taskTypesUnlocked } from '@/state/taskTypesVisibility';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import { createMoveCandidateLookup } from './moveCandidates';
import { ensureThemeVisible, resourceDisplayColor } from '@/engine/renderer/resourcePalette';
import { useResolvedUITheme } from '@/hooks/useResolvedUITheme';

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
 * én dialoog.
 *
 * Eén regel per resource in een raster met de kop erboven (CSS `.assignment-list`, zelfde opzet als de
 * relatielijst): naam, inzet, werk (alleen met "Taaktypes gebruiken" of een bestand met taaktypes) en verwijderen. De naam is
 * een uitklapknop; daaronder staan curve, de knop naar `ContourDialog` (urenverdeling per werkdag) en
 * "Verplaats naar…". Een afwijkende curve of een eigen urenverdeling blijft ook dichtgeklapt zichtbaar
 * als icoon naast de naam (indeling goedgekeurd door de eigenaar, 2026-10-19).
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
  // Kolom "Werk" + slotjes op de beschermde hoek(en).
  const setAssignmentWork = useAppStore(s => s.setAssignmentWork);
  const notify = useAppStore(s => s.notify);
  // "1,500" in en of "1.500" in nl: 1500 of 1,5? Geen gok; de waarde blijft. De melding noemt het
  // decimaalteken van de taal (de vertaling bouwt er het voorbeeld 1{{separator}}5 mee). Het is een
  // weigering ("De waarde is niet gewijzigd."): rood en blijvend via refusalNotice (#375/#396).
  const notifyAmbiguous = (text: string) => notify(refusalNotice({
    messageKey: 'notifications.ambiguousThousands',
    params: { text, separator: decimalSeparatorOf(i18n.language) },
  }));
  const unlocked = useAppStore(s => taskTypesUnlocked(s));
  const defaultWorkRule = useAppStore(s => s.project.defaultWorkRule);
  const calendars = useAppStore(s => s.calendars);
  const projectCalendar = useAppStore(s => s.calendar);
  const darkTheme = useResolvedUITheme() === 'dark';
  const [contourAssignmentId, setContourAssignmentId] = useState<string | null>(null);
  // Welke toewijzingen uitgeklapt staan (curve, urenverdeling, verplaatsen). Alleen voor deze weergave.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const detailsIdBase = useId();
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
  const toggleExpanded = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const numberInputClass = 'assignment-number input !text-small !px-1 !py-0.5 !h-6 text-right';
  const mutedStyle = { color: 'var(--theme-text-muted)' };

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
          {taskAssignments.length > 0 && (
            <div className={`assignment-list !text-small${showWork ? '' : ' assignment-list--no-work'}`}>
              {/* Kop in hetzelfde raster als de regels (subgrid): elke kop staat recht boven zijn kolom,
                  en een lange vertaling maakt de kolom breder in plaats van af te breken. Is het paneel
                  daar te smal voor, dan kapt de kop af met een ellips (`min-w-0` + `truncate`; de volle
                  tekst staat in de tooltip) in plaats van de regels buiten het paneel te duwen: in 13
                  talen gebeurde dat bij 200 px en 125 % (release v2026.10.0). */}
              <div className="assignment-header text-caption leading-3 uppercase tracking-wide" style={mutedStyle} data-ops-assignment-header>
                <span className="assignment-name min-w-0 truncate ps-[16px]">{t('properties.assignments.resource')}</span>
                <span
                  className="assignment-units flex min-w-0 items-center gap-0.5 whitespace-nowrap"
                  title={showWork && unitsProtected ? lockTitle : t('properties.assignments.unitsPerDay')}
                  data-ops-assignment-lock-units={showWork ? (unitsProtected ? 'locked' : 'free') : undefined}
                >
                  {showWork && unitsProtected && <Lock size={9} className="shrink-0" />}
                  <span className="truncate">{t('properties.assignments.units')}</span>
                </span>
                {showWork && (
                  <span
                    className="assignment-work flex min-w-0 items-center gap-0.5 whitespace-nowrap"
                    title={workProtected ? lockTitle : t('properties.assignments.workHint')}
                    data-ops-assignment-lock-work={workProtected ? 'locked' : 'free'}
                  >
                    {workProtected && <Lock size={9} className="shrink-0" />}
                    <span className="truncate">{t('properties.assignments.workHours')}</span>
                  </span>
                )}
              </div>
              {taskAssignments.map(a => {
                const res = resources.find(r => r.id === a.resourceId);
                const resName = res?.name || '?';
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
                const curveLabel = contoured
                  ? t('properties.assignments.contoured')
                  : importedCurve
                    ? t('properties.assignments.importedCurve')
                    : tCommon(CURVE_KEY[curveState]);
                // Ook dichtgeklapt zichtbaar: alles behalve de gewone gelijkmatige verdeling.
                const curveMarked = curveValue !== 'UNIFORM';
                const open = expanded.has(a.id);
                const detailsId = `${detailsIdBase}-${a.id}`;
                const isMaterial = res?.type === 'MATERIAL';
                // Opgeslagen werk dat afwijkt van inzet × restduur krijgt een markering (zelfde regel
                // als de planningssuite toetst). Hij staat binnen het werkveld, zodat de kolom niet
                // breder wordt.
                const deviation = showWork && !isMaterial
                  ? assignmentWorkDeviation(task, a.unitsPerDay, a.remainingWorkMinutes, hoursPerDay, contourOf.has(a.id))
                  : null;
                return (
                  // Eén regel in het raster van de lijst (subgrid): naam, inzet, werk, verwijderen. Op de
                  // smalste rail (≤ 14rem) krijgt de naam een eigen regel en staan de getallen eronder.
                  // Uitgeklapt volgt onder de regel: curve, urenverdeling en "Verplaats naar…".
                  <div key={a.id} className="assignment-row" data-ops-assignment-row={a.id}>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(a.id)}
                      aria-expanded={open}
                      aria-controls={detailsId}
                      title={t('properties.assignments.detailsHint')}
                      className="assignment-name flex min-w-0 items-center gap-1 rounded-[4px] py-0.5 text-start hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      data-ops-assignment-expand={open ? 'open' : 'closed'}
                    >
                      <ChevronRight
                        size={12}
                        aria-hidden="true"
                        className={`shrink-0 text-text-secondary transition-transform ${open ? 'rotate-90' : 'rtl:-scale-x-100'}`}
                      />
                      <span
                        aria-hidden="true"
                        className="h-[1em] w-[1em] shrink-0 rounded-[3px]"
                        style={{ background: res ? ensureThemeVisible(resourceDisplayColor(res), darkTheme) : 'var(--theme-border)' }}
                      />
                      <span className="min-w-0 truncate font-medium" title={resName} data-ops-assignment-name>{resName}</span>
                      {curveMarked && (
                        <span
                          className="inline-flex shrink-0 items-center"
                          style={{ color: 'var(--theme-accent)' }}
                          title={`${t('properties.assignments.curve')}: ${curveLabel}`}
                          data-ops-assignment-curve-mark={curveValue}
                        >
                          <BarChart3 size={11} aria-hidden="true" />
                        </span>
                      )}
                    </button>
                    <UnitsInput
                      value={a.unitsPerDay}
                      locale={i18n.language}
                      commitOnBlur
                      onAmbiguous={notifyAmbiguous}
                      // De exacte opgeslagen waarde, met het decimaalteken van de taal.
                      title={`${t('properties.assignments.unitsPerDay')}: ${localizeDecimalPoint(String(a.unitsPerDay), i18n.language)}`}
                      ariaLabel={`${t('properties.assignments.unitsPerDay')} — ${res?.name ?? a.resourceId}`}
                      onCommit={n => updateAssignment(a.id, { unitsPerDay: n })}
                      className={`assignment-units ${numberInputClass}`}
                    />
                    {showWork && (isMaterial ? (
                      <span className="assignment-work pe-1 text-right text-text-secondary" data-ops-assignment-work="material">—</span>
                    ) : (
                      <span className="assignment-work relative flex items-center" data-ops-assignment-work={a.remainingWorkMinutes !== undefined ? 'stored' : 'derived'}>
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
                          className={`${numberInputClass}${deviation ? ' assignment-number--flag !ps-4' : ''}`}
                          locale={i18n.language}
                          onAmbiguous={notifyAmbiguous}
                        />
                        {deviation && (
                          <span
                            className="absolute start-1 top-1/2 inline-flex -translate-y-1/2 items-center"
                            style={{ color: 'var(--theme-warning-text)' }}
                            title={t('properties.assignments.workDeviatesHint', {
                              ...deviation,
                              // Slotzin per regel (besluit V10): dezelfde keuze als de tabel en de duurbewerking.
                              durationEffect: t(workDeviationEffectKey(task, defaultWorkRule)),
                            })}
                            aria-label={t('properties.assignments.workDeviates')}
                            role="img"
                            data-ops-assignment-work-deviates={`${deviation.stored}/${deviation.derived}`}
                          >
                            <AlertTriangle size={10} aria-hidden />
                          </span>
                        )}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => unassignResource(a.id)}
                      className="assignment-remove rounded p-0.5"
                      style={{ color: 'var(--error)' }}
                      title={t('properties.assignments.remove')}
                      aria-label={t('properties.assignments.remove')}
                      data-ops-assignment-remove
                    >
                      <Trash2 size={12} />
                    </button>
                    {open && (
                      <div
                        id={detailsId}
                        className="assignment-details ms-1.5 mb-1 flex min-w-0 flex-col gap-1 border-s ps-3"
                        style={{ borderColor: 'var(--theme-border-light)' }}
                        data-ops-assignment-details
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0" style={mutedStyle}>{t('properties.assignments.curve')}</span>
                          <div
                            className="min-w-0 flex-1"
                            title={contoured ? t('properties.assignments.contouredHint') : t('properties.assignments.curve')}
                            data-ops-assignment-curve={curveValue}
                          >
                            <Select
                              value={curveValue}
                              disabled={contoured}
                              aria-label={t('properties.assignments.curve')}
                              options={curveOptions}
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
                        </div>
                        <button
                          type="button"
                          onClick={() => setContourAssignmentId(a.id)}
                          className="dependency-add-button min-w-0 max-w-full"
                          style={contoured ? { color: 'var(--theme-accent)' } : undefined}
                          title={contoured ? t('properties.assignments.contouredHint') : t('properties.assignments.contour')}
                          data-ops-assignment-contour={contoured ? 'contoured' : 'formula'}
                        >
                          <BarChart3 size={12} aria-hidden="true" className="shrink-0" />
                          <span className="truncate">{t('properties.assignments.contour')}</span>
                        </button>
                        {canMove && (
                          <MoveToSelect
                            label={t('properties.assignments.moveTo')}
                            candidates={() => moveLookup.list(taskId, a.resourceId)}
                            onMove={target => moveAssignment(a.id, target)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
