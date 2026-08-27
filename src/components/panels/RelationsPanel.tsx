import { useCallback, useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { createRelationWithFeedback } from '@/state/relationActions';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { Sequence, SequenceType, SEQUENCE_TYPE_OPTIONS } from '@/types/sequence';
import { resolveEffectiveLagDays } from '@/engine/scheduler/CPMSolver';
import { SequenceLagInput } from '@/components/common/SequenceLagInput';
import { ExternalLinkDialog } from '@/components/dialogs/ExternalLinkDialog';
import { AlertTriangle, Plus, Trash2, Zap, Link2, RefreshCw } from 'lucide-react';
import { buildImportLabels } from '@/i18n/importLabels';

type SortKey = 'predecessor' | 'successor' | 'type' | 'lag' | 'driving' | 'freeFloat';

function taskLabel(task: Task | undefined): string {
  return task ? `${task.wbsCode ? task.wbsCode + ' ' : ''}${task.name}` : '?';
}

/**
 * Relatietabel (P6-stijl "Relationships"-weergave): alle relaties van het actieve document
 * in één bewerkbare, sorteerbare tabel — voorganger, type, lag (MSP-notatie), opvolger,
 * driving-markering, relatie-vrije-speling en waarschuwingen (afgekapte lead, lead langer
 * dan de voorgangerduur). Rij-klik selecteert beide taken in de Gantt/tabel.
 */
export function RelationsPanel() {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const cpmResult = useAppStore(s => s.cpmResult);
  const selectedTaskIds = useAppStore(s => s.selectedTaskIds);
  const selectTask = useAppStore(s => s.selectTask);
  const updateSequence = useAppStore(s => s.updateSequence);
  const removeSequence = useAppStore(s => s.removeSequence);
  const removeExternalLink = useAppStore(s => s.removeExternalLink);
  const refreshExternalAnchorsFrom = useAppStore(s => s.refreshExternalAnchorsFrom);
  const refreshAllExternalAnchors = useAppStore(s => s.refreshAllExternalAnchors);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [extDialogTaskId, setExtDialogTaskId] = useState<string | null>(null);
  const [extStatus, setExtStatus] = useState<string>('');

  // Alle externe koppelingen over alle taken (fase 2.9, §5.5): platte lijst voor de onder-sectie.
  const externalRows = useMemo(
    () => tasks.flatMap(tk => (tk.externalLinks ?? []).map(link => ({ task: tk, link }))),
    [tasks],
  );
  const hasExternal = externalRows.length > 0;

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
  // Relaties die de solver ECHT niet kon meerekenen (voorouder-guard, lege/kapotte tak, of de
  // MAX_EXPANDED_RELATIONS-klem in `expandSummaryRelations`) — `droppedSequenceIds` draagt al
  // ORIGINELE relatie-ids (`foldSyntheticSequenceIds` in `solveProject` vouwt de synthetische
  // `::exp-N`-ids terug vóórdat het resultaat de store bereikt), dus een rechtstreekse `seq.id`-
  // vergelijking hier is correct. Vervangt de oude `hasSummaryEndpoint`-markering (elke relatie MET
  // een verzameltaak-eindpunt), die sinds het eigenaarsbesluit van 2026-08-15 niet meer klopt: zo'n
  // relatie rekent normaal mee, tenzij de solver hem daadwerkelijk moest droppen.
  const droppedSet = useMemo(
    () => new Set(hasCalc ? cpmResult!.droppedSequenceIds ?? [] : []),
    [hasCalc, cpmResult],
  );

  const rowData = useCallback((seq: Sequence) => {
    const pred = taskById.get(seq.predecessorId);
    const succ = taskById.get(seq.successorId);
    const effLag = pred ? resolveEffectiveLagDays(seq, pred) : 0;
    const predDur = pred && !pred.isMilestone ? pred.time.scheduleDuration : 0;
    const warnings: string[] = [];
    // Écht gedropt door de solver (voorouder-guard, lege/kapotte tak, of de budgetklem) — niet
    // langer "elke relatie met een verzameltaak-eindpunt", zie `droppedSet` hierboven.
    if (droppedSet.has(seq.id)) warnings.push(t('relations.warnDropped'));
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
  }, [taskById, droppedSet, truncatedSet, t, drivingSet, hasCalc, cpmResult]);

  const rows = useMemo(() => {
    const data = sequences.map(rowData);
    if (!sortKey) return data;
    const cmp = (a: typeof data[number], b: typeof data[number]): number => {
      switch (sortKey) {
        case 'predecessor': return taskLabel(a.pred).localeCompare(taskLabel(b.pred));
        case 'successor': return taskLabel(a.succ).localeCompare(taskLabel(b.succ));
        case 'type': return a.seq.type.localeCompare(b.seq.type);
        case 'lag': return a.effLag - b.effLag;
        case 'driving': return Number(a.driving) - Number(b.driving);
        case 'freeFloat': return (a.freeFloat ?? Infinity) - (b.freeFloat ?? Infinity);
      }
    };
    return [...data].sort((a, b) => cmp(a, b) * sortDir);
  }, [sequences, rowData, sortKey, sortDir]);

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
    // Issue #40: dezelfde wrapper als de lint-knop en het slepen in de Gantt — die meldt succes
    // én een geweigerd duplicaat (dat laatste was hier eerder een stille no-op).
    createRelationWithFeedback(selectedTaskIds[0], selectedTaskIds[1]);
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
          {extStatus && (
            <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>{extStatus}</span>
          )}
          {!hasCalc && sequences.length > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
              {t('relations.notCalculated')}
            </span>
          )}
          {hasExternal && (
            <button
              onClick={() => { void (async () => {
                const r = await refreshAllExternalAnchors(buildImportLabels(tCommon));
                setExtStatus(r.sources === 0
                  ? t('externalLinks.noSourcesToast')
                  : t('externalLinks.refreshedToast', { refreshed: r.refreshed, missing: r.missing }));
              })(); }}
              title={t('externalLinks.refreshAllHint')}
              className="btn btn--sm flex items-center gap-1"
            >
              <RefreshCw size={12} />
              {t('externalLinks.refreshAll')}
            </button>
          )}
          <button
            onClick={() => {
              if (selectedTaskIds.length !== 1) { setExtStatus(t('externalLinks.pickTaskFirst')); return; }
              setExtDialogTaskId(selectedTaskIds[0]);
            }}
            title={t('externalLinks.action')}
            className="btn btn--sm flex items-center gap-1"
            style={selectedTaskIds.length !== 1 ? { opacity: 0.5 } : undefined}
          >
            <Link2 size={12} />
            {t('externalLinks.action')}
          </button>
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
            <div className="flex-1 min-w-[160px] px-2 truncate">{taskLabel(pred)}</div>
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
            <div className="flex-1 min-w-[160px] px-2 truncate">{taskLabel(succ)}</div>
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

        {/* Externe (cross-project) koppelingen (fase 2.9, §5.5) */}
        {hasExternal && (
          <div style={{ borderTop: '2px solid var(--theme-border)' }}>
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
              style={{ color: 'var(--theme-text-muted)', fontFamily: 'var(--font-heading)' }}>
              <Link2 size={11} />{t('externalLinks.existingTitle')}
            </div>
            {externalRows.map(({ task: extTask, link }) => (
              <div key={link.id} className="flex items-center text-xs hover:bg-surface-hover"
                style={{ minHeight: 28, borderBottom: '1px solid var(--theme-border-light)' }}
                onClick={() => selectTask(extTask.id)}
              >
                <div className="flex-1 min-w-[140px] px-2 truncate">{taskLabel(extTask)}</div>
                <div className="w-[150px] px-2 truncate" style={{ color: 'var(--theme-text-dim)' }}>
                  {link.direction === 'predecessor' ? '← ' : '→ '}
                  {link.relType}{link.lagDays ? `+${link.lagDays}` : ''} · {link.sourceRef.taskName || link.sourceRef.taskId}
                </div>
                <div className="w-[100px] px-2 text-right" style={{ color: 'var(--theme-text-dim)' }}>{link.anchorDate}</div>
                <div className="w-[90px] px-1 flex justify-center">
                  {link.sourceMissing && (
                    <span title={t('externalLinks.sourceMissing')}
                      className="text-[9px] px-1 rounded"
                      style={{ background: 'var(--error)', color: '#fff' }}>
                      {t('externalLinks.stale')}
                    </span>
                  )}
                </div>
                <div className="w-[36px] px-1 flex justify-center" onClick={e => e.stopPropagation()}>
                  {link.sourceRef.filePath && (
                    <button title={t('externalLinks.refresh')} style={{ color: 'var(--theme-accent)' }}
                      onClick={() => { void (async () => {
                        const r = await refreshExternalAnchorsFrom(link.sourceRef.filePath!, buildImportLabels(tCommon));
                        if (r) setExtStatus(t('externalLinks.refreshedToast', { refreshed: r.refreshed, missing: r.missing }));
                        else setExtStatus(t('externalLinks.notAvailableWeb'));
                      })(); }}>
                      <RefreshCw size={12} />
                    </button>
                  )}
                </div>
                <div className="w-[36px] px-1 flex justify-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => removeExternalLink(extTask.id, link.id)} style={{ color: 'var(--error)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {extDialogTaskId && (
        <ExternalLinkDialog taskId={extDialogTaskId} onClose={() => setExtDialogTaskId(null)} />
      )}
    </div>
  );
}
