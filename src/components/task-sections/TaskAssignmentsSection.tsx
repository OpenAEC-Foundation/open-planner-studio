import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { refusalNotice } from '@/state/refusalNotice';
import { contourSiblings, isCostResource, type ResourceCurve } from '@/types/resource';
import { AmountInput, UnitsInput } from '@/components/common/UnitsInput';
import { Select, type SelectOption } from '@/components/common/Select';
import { decimalSeparatorOf, localizeDecimalPoint } from '@/utils/reportNumber';
import { Icon } from '@/components/icons';
import { RESOURCE_CURVES, CURVE_KEY } from './shared';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { assignmentCurveState, contouredAssignmentIds } from '@/engine/contour/curveState';
import { ContourDialog } from '@/components/dialogs/ContourDialog';
import { matchContoursToAssignments } from '@/engine/contour/contourEngine';
import { effectiveWorkRule, workRuleApplies } from '@/engine/work/workRuleApply';
import { shownRemainingWorkMinutes, shownWorkHours } from '@/engine/work/shownWork';
import { assignmentWorkDeviation, workDeviationEffectKey } from '@/engine/work/assignmentWorkDeviation';
import { ruleProtectsWork } from '@/engine/work/workTriangle';
import { taskTypesUnlocked } from '@/state/taskTypesVisibility';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import { createMoveCandidateLookup } from './moveCandidates';
import { ensureThemeVisible, resourceDisplayColor } from '@/engine/renderer/resourcePalette';
import { useResolvedUITheme } from '@/hooks/useResolvedUITheme';

const CONTOURED = '__contoured';
const IMPORTED_CURVE = '__importedCurve';

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
  const setAssignmentWork = useAppStore(s => s.setAssignmentWork);
  const setAssignmentCost = useAppStore(s => s.setAssignmentCost);
  const notify = useAppStore(s => s.notify);
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
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const detailsIdBase = useId();
  const costResourceIds = useMemo(() => new Set(resources.filter(isCostResource).map(r => r.id)), [resources]);
  const moveLookup = useMemo(
    () => createMoveCandidateLookup(tasks, assignments, costResourceIds),
    [tasks, assignments, costResourceIds],
  );

  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  const taskAssignments = assignments.filter(a => a.taskId === taskId);
  const contourList = contourSiblings(taskAssignments, costResourceIds);
  const contouredIds = contouredAssignmentIds(task, contourList);
  const contourOf = matchContoursToAssignments(task.timephasedContours, contourList);
  const assignmentsDisabled = isSummaryTask(task);
  const milestone = !!task.isMilestone;
  const assignedResourceIds = new Set(taskAssignments.map(a => a.resourceId));
  const availableResources = resources.filter(r => !assignedResourceIds.has(r.id) && (!milestone || isCostResource(r)));
  const rule = effectiveWorkRule(task, defaultWorkRule);
  const unitsProtected = rule === 'FIXED_DURATION_RATE' || rule === 'FIXED_RATE';
  const workProtected = ruleProtectsWork(rule);
  const showWork = unlocked && workRuleApplies(task);
  const hoursPerDay = taskCalendarHoursPerDay(task, calendars, projectCalendar);
  const remainingHoursOf = (assignmentId: string, unitsPerDay: number, stored: number | undefined): number =>
    shownWorkHours(shownRemainingWorkMinutes(task, { unitsPerDay, remainingWorkMinutes: stored }, contourOf.get(assignmentId), hoursPerDay));
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
          {t('properties.assignments.disabledSummary')}
        </span>
      ) : (
        <>
          {milestone && (
            <span className="!text-small text-text-secondary" data-ops-assignment-milestone-cost-only>
              {t('properties.assignments.milestoneCostOnly')}
            </span>
          )}
          {taskAssignments.length === 0 && (
            <span className="!text-small text-text-secondary">{t('properties.assignments.empty')}</span>
          )}
          {taskAssignments.length > 0 && (
            <div className={`assignment-list !text-small${showWork ? '' : ' assignment-list--no-work'}`}>
              <div className="assignment-header text-caption leading-3 uppercase tracking-wide" style={mutedStyle} data-ops-assignment-header>
                <span className="assignment-name min-w-0 truncate ps-[16px]">{t('properties.assignments.resource')}</span>
                <span
                  className="assignment-units flex min-w-0 items-center gap-0.5 whitespace-nowrap"
                  title={showWork && unitsProtected ? lockTitle : t('properties.assignments.unitsPerDay')}
                  data-ops-assignment-lock-units={showWork ? (unitsProtected ? 'locked' : 'free') : undefined}
                >
                  {showWork && unitsProtected && <Icon id="status.assignment-protected" size={9} className="shrink-0" />}
                  <span className="truncate">{t('properties.assignments.units')}</span>
                </span>
                {showWork && (
                  <span
                    className="assignment-work flex min-w-0 items-center gap-0.5 whitespace-nowrap"
                    title={workProtected ? lockTitle : t('properties.assignments.workHint')}
                    data-ops-assignment-lock-work={workProtected ? 'locked' : 'free'}
                  >
                    {workProtected && <Icon id="status.assignment-protected" size={9} className="shrink-0" />}
                    <span className="truncate">{t('properties.assignments.workHours')}</span>
                  </span>
                )}
              </div>
              {taskAssignments.map(a => {
                const res = resources.find(r => r.id === a.resourceId);
                const resName = res?.name || '?';
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
                const curveMarked = curveValue !== 'UNIFORM';
                const open = expanded.has(a.id);
                const detailsId = `${detailsIdBase}-${a.id}`;
                const isMaterial = res?.type === 'MATERIAL';
                const isCost = isCostResource(res);
                const deviation = showWork && !isMaterial && !isCost
                  ? assignmentWorkDeviation(task, a.unitsPerDay, a.remainingWorkMinutes, hoursPerDay, contourOf.has(a.id))
                  : null;
                return (
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
                      <Icon id="tree.expand"
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
                      {curveMarked && !isCost && (
                        <span
                          className="inline-flex shrink-0 items-center text-text-secondary"
                          title={`${t('properties.assignments.curve')}: ${curveLabel}`}
                          data-ops-assignment-curve-mark={curveValue}
                        >
                          <Icon id="assignment.hours-distribution" size={11} aria-hidden="true" />
                        </span>
                      )}
                    </button>
                    {isCost ? (
                      <AmountInput
                        value={a.costAmount}
                        locale={i18n.language}
                        commitOnBlur
                        onAmbiguous={notifyAmbiguous}
                        title={t('properties.assignments.amountHint')}
                        ariaLabel={`${t('properties.assignments.amount')} — ${res?.name ?? a.resourceId}`}
                        onCommit={n => setAssignmentCost(a.id, n)}
                        className={`assignment-units ${numberInputClass}`}
                      />
                    ) : (
                    <UnitsInput
                      value={a.unitsPerDay}
                      locale={i18n.language}
                      commitOnBlur
                      onAmbiguous={notifyAmbiguous}
                      title={`${t('properties.assignments.unitsPerDay')}: ${localizeDecimalPoint(String(a.unitsPerDay), i18n.language)}`}
                      ariaLabel={`${t('properties.assignments.unitsPerDay')} — ${res?.name ?? a.resourceId}`}
                      onCommit={n => updateAssignment(a.id, { unitsPerDay: n })}
                      className={`assignment-units ${numberInputClass}`}
                    />
                    )}
                    {showWork && (isMaterial || isCost ? (
                      <span className="assignment-work pe-1 text-right text-text-secondary" data-ops-assignment-work={isCost ? 'cost' : 'material'}>—</span>
                    ) : (
                      <span className="assignment-work relative flex items-center" data-ops-assignment-work={a.remainingWorkMinutes !== undefined ? 'stored' : 'derived'}>
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
                              durationEffect: t(workDeviationEffectKey(task, defaultWorkRule)),
                            })}
                            aria-label={t('properties.assignments.workDeviates')}
                            role="img"
                            data-ops-assignment-work-deviates={`${deviation.stored}/${deviation.derived}`}
                          >
                            <Icon id="status.warning" size={10} aria-hidden />
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
                      <Icon id="edit.delete" size={12} />
                    </button>
                    {open && (
                      <div
                        id={detailsId}
                        className="assignment-details ms-1.5 mb-1 flex min-w-0 flex-col gap-1 border-s ps-3"
                        style={{ borderColor: 'var(--theme-border-light)' }}
                        data-ops-assignment-details
                      >
                        {!isCost && (<>
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
                          <Icon id="assignment.hours-distribution" size={12} aria-hidden="true" className={contoured ? 'shrink-0 text-text-secondary' : 'shrink-0'} />
                          <span className="truncate">{t('properties.assignments.contour')}</span>
                        </button>
                        </>)}
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
