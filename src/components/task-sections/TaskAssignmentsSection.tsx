import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import type { ResourceCurve } from '@/types/resource';
import { UnitsInput } from '@/components/common/UnitsInput';
import { Trash2 } from 'lucide-react';
import { RESOURCE_CURVES, CURVE_KEY } from './shared';

/**
 * Toewijzingen (fase 2.5, §6.3 + fase 2.10 item 4 "verplaats naar…") — sectie 10 uit
 * `TaskPropertiesPanel` (fase 2.10, item 2). RELATIONEEL/storeful: roept `assignResource`/
 * `updateAssignment`/`unassignResource`/`moveAssignment` rechtstreeks aan, identiek in paneel
 * én dialoog.
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

  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  // Toewijzingen (fase 2.5, §6.3) — leaf-only, geen mijlpalen/samenvattingstaken.
  const taskAssignments = assignments.filter(a => a.taskId === taskId);
  const assignmentsDisabled = task.isMilestone || task.childIds.length > 0;
  const assignedResourceIds = new Set(taskAssignments.map(a => a.resourceId));
  const availableResources = resources.filter(r => !assignedResourceIds.has(r.id));

  /** Kandidaat-doeltaken voor "verplaats naar…" (item 4): leaf-taken zonder deze resource, exclusief
   *  de huidige taak zelf. */
  const moveCandidates = (resourceId: string) => tasks.filter(t =>
    t.id !== taskId && !t.isMilestone && t.childIds.length === 0
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
            return (
              <div key={a.id} className="flex items-center gap-1 text-[10px]">
                <span className="flex-1 truncate" title={res?.name}>{res?.name || '?'}</span>
                <UnitsInput
                  value={a.unitsPerDay}
                  title={t('properties.assignments.unitsPerDay')}
                  ariaLabel={t('properties.assignments.unitsPerDay')}
                  onCommit={n => updateAssignment(a.id, { unitsPerDay: n })}
                  className="input !text-[10px] !px-1 !py-0.5 !w-14 text-right"
                />
                <select
                  value={a.curve ?? 'UNIFORM'}
                  title={t('properties.assignments.curve')}
                  onChange={e => updateAssignment(a.id, { curve: e.target.value as ResourceCurve })}
                  className="input !text-[10px] !px-1 !py-0.5 !w-24"
                >
                  {RESOURCE_CURVES.map(c => (
                    <option key={c} value={c}>{tCommon(CURVE_KEY[c])}</option>
                  ))}
                </select>
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
    </>
  );
}
