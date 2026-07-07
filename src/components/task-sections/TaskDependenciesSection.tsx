import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { SequenceType, SEQUENCE_TYPE_OPTIONS } from '@/types/sequence';
import { SequenceLagInput } from '@/components/common/SequenceLagInput';
import { Trash2, Zap } from 'lucide-react';

/**
 * Afhankelijkheden (relatietabel: type + lag + driving-badge + verwijderen) — sectie 9 uit
 * `TaskPropertiesPanel` (fase 2.10, item 2). RELATIONEEL/storeful: roept `updateSequence`/
 * `removeSequence` rechtstreeks aan, identiek in paneel én dialoog (dialoog heeft altijd een
 * bestaand `task.id` — zie ontwerp-doc-vondst).
 */
export function TaskDependenciesSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const cpmResult = useAppStore(s => s.cpmResult);
  const updateSequence = useAppStore(s => s.updateSequence);
  const removeSequence = useAppStore(s => s.removeSequence);

  const taskSequences = sequences.filter(
    s => s.predecessorId === taskId || s.successorId === taskId
  );
  if (taskSequences.length === 0) return null;

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-xs">{t('properties.dependencies')}</span>
      {taskSequences.map(seq => {
        const other = seq.predecessorId === taskId
          ? tasks.find(t => t.id === seq.successorId)
          : tasks.find(t => t.id === seq.predecessorId);
        const role = seq.predecessorId === taskId ? '→' : '←';
        const isDriving = !!cpmResult && !cpmResult.error
          && cpmResult.drivingSequenceIds.includes(seq.id);
        return (
          <div key={seq.id} className="flex items-center gap-1 text-[10px]">
            <span>{role}</span>
            <span className="flex-1 truncate">{other?.name || '?'}</span>
            {isDriving && (
              <span title={t('properties.driving')} style={{ color: 'var(--theme-accent)' }}>
                <Zap size={10} />
              </span>
            )}
            <select
              value={seq.type}
              onChange={e => updateSequence(seq.id, { type: e.target.value as SequenceType })}
              className="input !text-[10px] !px-1 !py-0.5"
            >
              {SEQUENCE_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <SequenceLagInput
              seq={seq}
              title={t('properties.lag')}
              onCommit={patch => updateSequence(seq.id, patch)}
            />
            <button
              onClick={() => removeSequence(seq.id)}
              style={{ color: 'var(--error)' }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        );
      })}
    </>
  );
}
