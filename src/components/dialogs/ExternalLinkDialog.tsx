import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { X, Link2, FileDown } from 'lucide-react';
import { Dialog } from '@/components/common/Dialog';
import type { Task, ExternalLink } from '@/types/task';
import { externalSourceSide } from '@/engine/externalLinks';

type Direction = ExternalLink['direction'];
type RelType = ExternalLink['relType'];

/**
 * Externe (cross-project) koppeling toevoegen (fase 2.9, §5.5). Twee routes in één dialoog:
 *  1. Kies een RECENT bestand → we lezen het ALLEEN-LEZEN in (parseExternalSource, geen document-open)
 *     en tonen de taaklijst → kies taak + relType + lag; het anker leest automatisch de juiste
 *     brontaak-datum (start/finish per richting+relType).
 *  2. HANDMATIG (fallback): plak project-id/taak-id + een ankerdatum — werkt ook zonder bronbestand
 *     (en in de web-build waar bestand-lezen niet kan).
 */
export function ExternalLinkDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { t } = useTranslation('task');
  const getRecentFiles = useAppStore((s) => s.getRecentFiles);
  const parseExternalSource = useAppStore((s) => s.parseExternalSource);
  const addExternalLink = useAppStore((s) => s.addExternalLink);

  const recent = useMemo(() => getRecentFiles(), [getRecentFiles]);

  const [direction, setDirection] = useState<Direction>('predecessor');
  const [relType, setRelType] = useState<RelType>('FS');
  const [lag, setLag] = useState<string>('0');
  const [manual, setManual] = useState<boolean>(recent.length === 0);

  // Bron-route
  const [sourceFile, setSourceFile] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [source, setSource] = useState<{ projectId: string; projectName: string; filePath: string; tasks: Task[] } | null>(null);
  const [sourceTaskId, setSourceTaskId] = useState<string>('');

  // Handmatige fallback
  const [manualProjectId, setManualProjectId] = useState<string>('');
  const [manualTaskId, setManualTaskId] = useState<string>('');
  const [manualTaskName, setManualTaskName] = useState<string>('');
  const [manualAnchor, setManualAnchor] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    if (manual || !sourceFile) { setSource(null); setSourceTaskId(''); return; }
    setLoading(true);
    parseExternalSource(sourceFile).then((res) => {
      if (cancelled) return;
      setSource(res);
      setSourceTaskId(res?.tasks[0]?.id ?? '');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [manual, sourceFile, parseExternalSource]);

  const srcTask = source?.tasks.find((x) => x.id === sourceTaskId) ?? null;
  const anchorPreview = srcTask
    ? (externalSourceSide(direction, relType) === 'finish'
        ? srcTask.time.earlyFinish || srcTask.time.scheduleFinish
        : srcTask.time.earlyStart || srcTask.time.scheduleStart)
    : manualAnchor;

  const canAdd = manual
    ? manualProjectId.trim() !== '' && manualTaskId.trim() !== '' && manualAnchor.trim() !== ''
    : !!srcTask;

  const submit = () => {
    if (!canAdd) return;
    const lagDays = Number.isFinite(Number(lag)) ? Number(lag) : 0;
    const link: Omit<ExternalLink, 'id'> = manual
      ? {
          direction, relType, lagDays, anchorDate: manualAnchor,
          sourceRef: {
            projectId: manualProjectId.trim(),
            taskId: manualTaskId.trim(),
            ...(manualTaskName.trim() ? { taskName: manualTaskName.trim() } : {}),
          },
          sourceMissing: true, // handmatig: bron niet (aantoonbaar) geladen ⇒ verouderd tot verversen
        }
      : {
          direction, relType, lagDays, anchorDate: anchorPreview,
          sourceRef: {
            projectId: source!.projectId,
            projectName: source!.projectName,
            taskId: srcTask!.id,
            taskName: srcTask!.name,
            filePath: source!.filePath,
          },
          sourceMissing: false,
        };
    addExternalLink(taskId, link);
    onClose();
  };

  const fileLabel = (p: string) => p.split(/[\\/]/).pop() || p;

  return (
    // Let op: deze dialoog had bewust GEEN Escape-afhandeling — daarom geen `onCancel`.
    <Dialog
      onBackdropClick={onClose}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-testid': 'external-link-dialog' }}
    >
        {/* Kop */}
        <div className="flex items-center justify-between px-4" style={{ minHeight: 44, borderBottom: '1px solid var(--theme-border)' }}>
          <span className="ui-card-header flex items-center gap-2"><Link2 size={14} />{t('externalLinks.dialogTitle')}</span>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-xs">
          {/* Bron vs handmatig */}
          <div className="flex gap-2">
            <button
              className={`btn btn--sm flex-1 ${!manual ? 'btn--primary' : ''}`}
              disabled={recent.length === 0}
              onClick={() => setManual(false)}
              style={recent.length === 0 ? { opacity: 0.5 } : undefined}
            >{t('externalLinks.sourceFile')}</button>
            <button
              className={`btn btn--sm flex-1 ${manual ? 'btn--primary' : ''}`}
              onClick={() => setManual(true)}
            >{t('externalLinks.manualTitle')}</button>
          </div>

          {!manual && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-text-muted">{t('externalLinks.pickRecent')}</span>
                <select className="input" value={sourceFile} onChange={(e) => setSourceFile(e.target.value)}>
                  <option value="">—</option>
                  {recent.map((p) => <option key={p} value={p}>{fileLabel(p)}</option>)}
                </select>
              </label>
              <p className="text-[10px] text-text-muted flex items-center gap-1"><FileDown size={11} />{t('externalLinks.readOnlyNote')}</p>
              {loading && <span className="text-text-muted">{t('externalLinks.loadingTasks')}</span>}
              {source && (
                <label className="flex flex-col gap-1">
                  <span className="text-text-muted">{t('externalLinks.sourceTask')}</span>
                  <select className="input" value={sourceTaskId} onChange={(e) => setSourceTaskId(e.target.value)}>
                    {source.tasks.map((tk) => <option key={tk.id} value={tk.id}>{tk.wbsCode ? tk.wbsCode + ' ' : ''}{tk.name}</option>)}
                  </select>
                </label>
              )}
            </>
          )}

          {manual && (
            <>
              <p className="text-[10px] text-text-muted">{t('externalLinks.manualHint')}</p>
              <label className="flex flex-col gap-1">
                <span className="text-text-muted">{t('externalLinks.projectId')}</span>
                <input className="input" value={manualProjectId} onChange={(e) => setManualProjectId(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-text-muted">{t('externalLinks.taskId')}</span>
                <input className="input" value={manualTaskId} onChange={(e) => setManualTaskId(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-text-muted">{t('externalLinks.taskName')}</span>
                <input className="input" value={manualTaskName} onChange={(e) => setManualTaskName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-text-muted">{t('externalLinks.anchorDate')}</span>
                <input className="input" type="date" value={manualAnchor} onChange={(e) => setManualAnchor(e.target.value)} />
              </label>
            </>
          )}

          {/* Richting / relType / lag (voor beide routes) */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-text-muted">{t('externalLinks.direction')}</span>
              <select className="input" value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
                <option value="predecessor">{t('externalLinks.directionPredecessor')}</option>
                <option value="successor">{t('externalLinks.directionSuccessor')}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-text-muted">{t('externalLinks.relType')}</span>
              <select className="input" value={relType} onChange={(e) => setRelType(e.target.value as RelType)}>
                {(['FS', 'SS', 'FF', 'SF'] as RelType[]).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted">{t('externalLinks.lag')}</span>
            <input className="input w-24" type="number" value={lag} onChange={(e) => setLag(e.target.value)} />
          </label>

          {anchorPreview && !manual && (
            <div className="text-[11px] text-text-dim">{t('externalLinks.anchorDate')}: <b>{anchorPreview}</b></div>
          )}
        </div>

        {/* Voet */}
        <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--theme-border)' }}>
          <button className="btn btn--sm" onClick={onClose}>{t('externalLinks.cancel')}</button>
          <button className="btn btn--sm btn--primary" onClick={submit} disabled={!canAdd} data-testid="external-link-add"
            style={!canAdd ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            {t('externalLinks.add')}
          </button>
        </div>
    </Dialog>
  );
}
