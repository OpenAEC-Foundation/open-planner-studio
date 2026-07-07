import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Task } from '@/types/task';
import { SequenceType } from '@/types/sequence';

/**
 * Hammock/Level-of-Effort-toggle + read-only driver-info (fase 2.9 §5.3) — deel van sectie 4 uit
 * `TaskPropertiesPanel`, losgetrokken van `TaskTimeFields` zodat hij WEL gedeeld kan worden met
 * `TaskDialog` (puur informatief/vlag-zetten, geen commit-drift-risico zoals de duur-invoer).
 * Alleen op leaf-taken die geen mijlpaal zijn — zelfde guard als het paneel.
 */
export function TaskHammockFields({ task, onChange }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');
  const sequences = useAppStore(s => s.sequences);
  const tasks = useAppStore(s => s.tasks);
  const cpmResult = useAppStore(s => s.cpmResult);

  if (task.isMilestone || task.childIds.length > 0) return null;

  // Hammock-drivers (fase 2.9 §5.3, besluit B6): auto-detectie volgens P6-conventie — inkomende
  // FS/SS-relaties = start-driver (leveren de ES), FF/SF-relaties = finish-driver (leveren de EF,
  // dus de afgeleide span). READ-ONLY getoond zodat de gebruiker de spanne ziet zonder klikwerk.
  const incoming = sequences.filter(s => s.successorId === task.id);
  const startDrivers = incoming.filter(s => s.type === 'FINISH_START' || s.type === 'START_START');
  const finishDrivers = incoming.filter(s => s.type === 'FINISH_FINISH' || s.type === 'START_FINISH');
  const SEQ_SHORT: Record<SequenceType, string> = {
    FINISH_START: 'FS', FINISH_FINISH: 'FF', START_START: 'SS', START_FINISH: 'SF',
  };
  const predName = (id: string) => tasks.find(t => t.id === id)?.name || '?';
  const hammockNoFinishDriver = !!cpmResult && !cpmResult.error
    && cpmResult.hammockNoFinishDriverTaskIds?.includes(task.id);

  return (
    <>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={!!task.isHammock}
          onChange={e => onChange({ isHammock: e.target.checked || undefined })}
          className="accent-accent"
          data-ops-hammock-toggle
        />
        {t('properties.hammock')}
      </label>
      {task.isHammock && (
        <div className="flex flex-col gap-1 pl-5 text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
          <div>
            <span className="text-text-secondary">{t('properties.startDriver')}: </span>
            {startDrivers.length > 0
              ? startDrivers.map(s => `${predName(s.predecessorId)} (${SEQ_SHORT[s.type]})`).join(', ')
              : t('properties.hammockNoDriver')}
          </div>
          <div>
            <span className="text-text-secondary">{t('properties.finishDriver')}: </span>
            {finishDrivers.length > 0
              ? finishDrivers.map(s => `${predName(s.predecessorId)} (${SEQ_SHORT[s.type]})`).join(', ')
              : t('properties.hammockNoDriver')}
          </div>
          {hammockNoFinishDriver && (
            <div style={{ color: 'var(--error)' }}>{t('properties.hammockNoFinishDriver')}</div>
          )}
        </div>
      )}
    </>
  );
}
