import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import type { ResourceCurve } from '@/types/resource';
import { UnitsInput } from '@/components/common/UnitsInput';
import { BarChart3, Trash2 } from 'lucide-react';
import { RESOURCE_CURVES, CURVE_KEY } from './shared';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { matchContoursToAssignments } from '@/engine/contour/contourEngine';
import { ContourDialog } from '@/components/dialogs/ContourDialog';

/** Pseudowaarden van de curve-dropdown voor de twee data-toestanden van de contour-engine
 *  (2026-09): een opgeslagen contour (de dropdown is dan uitgeschakeld — loslaten gaat via het
 *  contourvenster, expliciet en niet als bijeffect van een curvekeuze) en een geïmporteerde exacte
 *  curve zonder OPS-vorm (kiesbaar: een nieuwe curvekeuze vervangt de importcurve, zie
 *  `resourceSlice.updateAssignment`). */
const CONTOURED = '__contoured';
const IMPORTED_CURVE = '__importedCurve';

/**
 * Toewijzingen (fase 2.5, §6.3 + fase 2.10 item 4 "verplaats naar…") — sectie 10 uit
 * `TaskPropertiesPanel` (fase 2.10, item 2). RELATIONEEL/storeful: roept `assignResource`/
 * `updateAssignment`/`unassignResource`/`moveAssignment` rechtstreeks aan, identiek in paneel
 * én dialoog. Contour-UI (2026-09): per toewijzing een knop naar `ContourDialog` (urenverdeling
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
  const [contourAssignmentId, setContourAssignmentId] = useState<string | null>(null);

  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  // Toewijzingen (fase 2.5, §6.3) — leaf-only, geen mijlpalen/samenvattingstaken.
  const taskAssignments = assignments.filter(a => a.taskId === taskId);
  const contourOf = matchContoursToAssignments(task.timephasedContours, taskAssignments);
  const assignmentsDisabled = task.isMilestone || isSummaryTask(task);
  const assignedResourceIds = new Set(taskAssignments.map(a => a.resourceId));
  const availableResources = resources.filter(r => !assignedResourceIds.has(r.id));

  /** Kandidaat-doeltaken voor "verplaats naar…" (item 4): leaf-taken zonder deze resource, exclusief
   *  de huidige taak zelf. */
  const moveCandidates = (resourceId: string) => tasks.filter(t =>
    t.id !== taskId && !t.isMilestone && isLeafTask(t)
    && !assignments.some(a => a.taskId === t.id && a.resourceId === resourceId)
  );

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-xs">{t('properties.assignments.title')}</span>
      {assignmentsDisabled ? (
        <span className="text-[10px] text-text-secondary italic">
          {task.isMilestone
            ? t('properties.assignments.disabledMilestone')
            : t('properties.assignments.disabledSummary')}
        </span>
      ) : (
        <>
          {taskAssignments.length === 0 && (
            <span className="text-[10px] text-text-secondary">{t('properties.assignments.empty')}</span>
          )}
          {taskAssignments.map(a => {
            const res = resources.find(r => r.id === a.resourceId);
            const candidates = moveCandidates(a.resourceId);
            const contoured = contourOf.has(a.id);
            const importedCurve = !contoured && !a.curve && !!a.curveValues;
            const curveValue = contoured ? CONTOURED : importedCurve ? IMPORTED_CURVE : (a.curve ?? 'UNIFORM');
            return (
              <div key={a.id} className="flex items-center gap-1 text-[10px]" data-ops-assignment-row={a.id}>
                <span className="flex-1 truncate" title={res?.name}>{res?.name || '?'}</span>
                <UnitsInput
                  value={a.unitsPerDay}
                  title={t('properties.assignments.unitsPerDay')}
                  ariaLabel={t('properties.assignments.unitsPerDay')}
                  onCommit={n => updateAssignment(a.id, { unitsPerDay: n })}
                  className="input !text-[10px] !px-1 !py-0.5 !w-14 text-right"
                />
                <select
                  value={curveValue}
                  disabled={contoured}
                  title={contoured ? t('properties.assignments.contouredHint') : t('properties.assignments.curve')}
                  aria-label={t('properties.assignments.curve')}
                  onChange={e => {
                    if (e.target.value === CONTOURED || e.target.value === IMPORTED_CURVE) return;
                    updateAssignment(a.id, { curve: e.target.value as ResourceCurve });
                  }}
                  className="input !text-[10px] !px-1 !py-0.5 !w-24 disabled:opacity-60"
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
                  className="p-0.5 rounded"
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
                    className="input !text-[10px] !px-1 !py-0.5 !w-24"
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
                <button onClick={() => unassignResource(a.id)} style={{ color: 'var(--error)' }} title={t('properties.assignments.remove')}>
                  <Trash2 size={10} />
                </button>
              </div>
            );
          })}
          {availableResources.length > 0 ? (
            <select
              value=""
              onChange={e => { if (e.target.value) assignResource(taskId, e.target.value, 1); }}
              className="input !text-xs !px-2.5 !py-1.5"
            >
              <option value="">{t('properties.assignments.add')}</option>
              {availableResources.map(r => (
                <option key={r.id} value={r.id}>{r.name || r.id}</option>
              ))}
            </select>
          ) : (
            <span className="text-[10px] text-text-secondary">
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
