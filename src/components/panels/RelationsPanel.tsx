import { useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { Sequence, SequenceType, SEQUENCE_TYPE_OPTIONS } from '@/types/sequence';
import { resolveEffectiveLagDays } from '@/engine/scheduler/CPMSolver';
import { SequenceLagInput } from '@/components/common/SequenceLagInput';
import { AlertTriangle, Plus, Trash2, Zap } from 'lucide-react';

type SortKey = 'predecessor' | 'successor' | 'type' | 'lag' | 'driving' | 'freeFloat';

/**
 * Relatietabel (P6-stijl "Relationships"-weergave): alle relaties van het actieve document
 * in één bewerkbare, sorteerbare tabel — voorganger, type, lag (MSP-notatie), opvolger,
 * driving-markering, relatie-vrije-speling en waarschuwingen (afgekapte lead, lead langer
 * dan de voorgangerduur). Rij-klik selecteert beide taken in de Gantt/tabel.
 */
export function RelationsPanel() {
  const { t } = useTranslation('task');
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const cpmResult = useAppStore(s => s.cpmResult);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const selectTask = useAppStore(s => s.selectTask);
  const addSequence = useAppStore(s => s.addSequence);
  const updateSequence = useAppStore(s => s.updateSequence);
  const removeSequence = useAppStore(s => s.removeSequence);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const taskById = useMemo(() => new Map(tasks.map(t2 => [t2.id, t2])), [tasks]);
  const hasCalc = !!cpmResult && !cpmResult.error;
  const drivingSet = useMemo(
    () => new Set(hasCalc ? cpmResult!.drivingSequenceIds : []),
    [hasCalc, cpmResult],
  );
  const truncatedSet = useMemo(
    () => new Set(hasCalc ? cpmResult!.truncatedLeadSequenceIds : []),
    [hasCalc, cpmResult],
  );

  const label = (task: Task | undefined) =>
    task ? `${task.wbsCode ? task.wbsCode + ' ' : ''}${task.name}` : '?';

  const rowData = (seq: Sequence) => {
    const pred = taskById.get(seq.predecessorId);
    const succ = taskById.get(seq.successorId);
    const effLag = pred ? resolveEffectiveLagDays(seq, pred) : 0;
    const predDur = pred && !pred.isMilestone ? pred.time.scheduleDuration : 0;
    const warnings: string[] = [];
    if (truncatedSet.has(seq.id)) warnings.push(t('relations.warnTruncatedLead'));
    if (effLag < 0 && Math.abs(effLag) > predDur) warnings.push(t('relations.warnLeadExceedsDuration'));
    return {
      seq,
      pred,
      succ,
      effLag,
      driving: drivingSet.has(seq.id),
      freeFloat: hasCalc ? cpmResult!.sequenceFreeFloat[seq.id] : undefined,
      warnings,
    };
  };

  const rows = useMemo(() => {
    const data = sequences.map(rowData);
    if (!sortKey) return data;
    const cmp = (a: typeof data[number], b: typeof data[number]): number => {
      switch (sortKey) {
        case 'predecessor': return label(a.pred).localeCompare(label(b.pred));
        case 'successor': return label(a.succ).localeCompare(label(b.succ));
        case 'type': return a.seq.type.localeCompare(b.seq.type);
        case 'lag': return a.effLag - b.effLag;
        case 'driving': return Number(a.driving) - Number(b.driving);
        case 'freeFloat': return (a.freeFloat ?? Infinity) - (b.freeFloat ?? Infinity);
      }
    };
    return [...data].sort((a, b) => cmp(a, b) * sortDir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequences, taskById, drivingSet, truncatedSet, hasCalc, cpmResult, sortKey, sortDir, t]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const canAddFromSelection = selectedTaskIds.length === 2;
  const addFromSelection = () => {
    if (!canAddFromSelection) return;
    addSequence({
      predecessorId: selectedTaskIds[0],
      successorId: selectedTaskIds[1],
      type: 'FINISH_START',
      lagDays: 0,
    });
  };

  const selectPair = (seq: Sequence) => {
    selectTask(seq.predecessorId);
    selectTask(seq.successorId, true);
  };

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : '');

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`px-2 flex items-center text-left uppercase tracking-wider select-none cursor-pointer hover:text-text-primary ${className ?? ''}`}
      style={{ font: 'inherit', letterSpacing: 'inherit', color: 'inherit' }}
    >
      {children}{sortIndicator(k)}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface">
      {/* Kopbalk met titel + acties */}
      <div
        className="flex items-center justify-between px-3"
        style={{ minHeight: 36, borderBottom: '1px solid var(--theme-border)' }}
      >
        <span className="ui-card-header !text-xs">{t('relations.title')}</span>
        <div className="flex items-center gap-2">
          {!hasCalc && sequences.length > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
              {t('relations.notCalculated')}
            </span>
          )}
          <button
            onClick={addFromSelection}
            disabled={!canAddFromSelection}
            title={t('relations.addFromSelectionHint')}
            className="btn btn--sm flex items-center gap-1"
            style={!canAddFromSelection ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            <Plus size={12} />
            {t('relations.addFromSelection')}
          </button>
        </div>
      </div>

      {/* Kolomkoppen — zelfde stijl als TableEditor */}
      <div
        className="sticky top-0 z-10 flex bg-surface-alt text-[10px] font-bold uppercase tracking-wider select-none"
        style={{
          minHeight: 28,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.08em',
          color: 'var(--theme-text-muted)',
          borderBottom: '1px solid var(--theme-border)',
        }}
      >
        <Th k="predecessor" className="flex-1 min-w-[160px]">{t('relations.predecessor')}</Th>
        <Th k="type" className="w-[64px]">{t('relations.type')}</Th>
        <Th k="lag" className="w-[80px]">{t('relations.lag')}</Th>
        <Th k="successor" className="flex-1 min-w-[160px]">{t('relations.successor')}</Th>
        <Th k="driving" className="w-[70px] justify-center">{t('relations.driving')}</Th>
        <Th k="freeFloat" className="w-[80px] justify-end">{t('relations.freeFloat')}</Th>
        <div className="w-[60px] px-2 flex items-center justify-center">{t('relations.warnings')}</div>
        <div className="w-[40px]" />
      </div>

      {/* Rijen */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 && (
          <div className="p-4 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            {t('relations.empty')}
          </div>
        )}
        {rows.map(({ seq, pred, succ, driving, freeFloat, warnings }) => (
          <div
            key={seq.id}
            className="flex items-center text-xs hover:bg-surface-hover cursor-default"
            style={{ minHeight: 28, borderBottom: '1px solid var(--theme-border-light)' }}
            onClick={() => selectPair(seq)}
          >
            <div className="flex-1 min-w-[160px] px-2 truncate">{label(pred)}</div>
            <div className="w-[64px] px-1" onClick={e => e.stopPropagation()}>
              <select
                value={seq.type}
                onChange={e => updateSequence(seq.id, { type: e.target.value as SequenceType })}
                className="input !text-[10px] !px-1 !py-0.5 w-full"
              >
                {SEQUENCE_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="w-[80px] px-1" onClick={e => e.stopPropagation()}>
              <SequenceLagInput
                seq={seq}
                title={t('properties.lag')}
                className="input !text-[10px] !px-1 !py-0.5 w-full text-right"
                onCommit={patch => updateSequence(seq.id, patch)}
              />
            </div>
            <div className="flex-1 min-w-[160px] px-2 truncate">{label(succ)}</div>
            <div className="w-[70px] px-1 flex justify-center">
              {driving && (
                <span title={t('properties.driving')} style={{ color: 'var(--theme-accent)' }}>
                  <Zap size={12} />
                </span>
              )}
            </div>
            <div className="w-[80px] px-2 text-right" style={{ color: 'var(--theme-text-dim)' }}>
              {freeFloat !== undefined ? freeFloat : '—'}
            </div>
            <div className="w-[60px] px-1 flex justify-center">
              {warnings.length > 0 && (
                <span title={warnings.join('\n')} style={{ color: 'var(--warning, #D97706)' }}>
                  <AlertTriangle size={12} />
                </span>
              )}
            </div>
            <div className="w-[40px] px-1 flex justify-center" onClick={e => e.stopPropagation()}>
              <button onClick={() => removeSequence(seq.id)} style={{ color: 'var(--error)' }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
