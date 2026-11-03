import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { useAppStore } from '@/state/appStore';
import { useDisplayDate, useTaskDateText } from '@/hooks/displayDate';
import { buildImportLabels } from '@/i18n/importLabels';
import { scheduleErrorText } from '@/i18n/scheduleErrors';
import { refreshExternalAnchors, type ExternalSourceDoc } from '@/engine/externalLinks';
import { previewExternalRefresh, type ExternalRefreshPreview } from '@/engine/externalRefreshPreview';
import { externalSourceSide } from '@/engine/taskGrid/relationFormat';
import { EXTERNAL_LINKS_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { calendarClock, momentLabel } from '@/utils/taskDateLabel';
import { formatLocalDateTime } from '@/utils/displayTime';
import type { ExternalLink } from '@/types/task';

type ReviewState =
  | { kind: 'reading' }
  | { kind: 'failed' }
  | { kind: 'ready'; source: ExternalSourceDoc; preview: ExternalRefreshPreview };

/**
 * *Bekijken* bij een nieuwe versie van een bron (keuze 1, Ethan 2026-11-03; stap 1.5 in
 * `docs/relaties-tussen-projecten.md` en 5.2 punt 2): de app leest de bron opnieuw, ververst de ankers in
 * een kopie van het plan, rekent die door en toont per koppeling het oude en het nieuwe anker en wat er in
 * het eigen plan verschuift. *Accepteren* zet het resultaat als één undo-stap; *Later* laat het plan staan.
 */
export function ExternalSourceReviewDialog() {
  const { t, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const accept = useAppStore(s => s.acceptExternalSourceUpdate);
  const dismiss = useAppStore(s => s.dismissExternalSourceUpdate);
  const update = useAppStore(s => s.ui.externalSourceUpdates.find(
    u => u.documentId === s.activeDocumentId && u.path === s.ui.externalSourceReview,
  ));
  const tasks = useAppStore(s => s.tasks);
  const calendar = useAppStore(s => s.calendar);
  const notation = useAppStore(s => s.ui.timeNotation);
  const taskDate = useTaskDateText();
  const dd = useDisplayDate();
  const [state, setState] = useState<ReviewState>({ kind: 'reading' });

  const close = () => setUI({ externalSourceReview: null });

  // De balk is weg (geaccepteerd, *Later*, ander document): dan ook het venster.
  useEffect(() => {
    if (!update) setUI({ externalSourceReview: null });
  }, [update, setUI]);

  const filePath = update?.filePath;
  const documentId = update?.documentId;
  const version = update?.version;
  useEffect(() => {
    if (!filePath || !documentId) return;
    let cancelled = false;
    setState({ kind: 'reading' });
    void (async () => {
      const src = await useAppStore.getState().parseExternalSource(filePath, buildImportLabels(tCommon));
      if (cancelled) return;
      if (!src) { setState({ kind: 'failed' }); return; }
      const doc = useAppStore.getState();
      if (doc.activeDocumentId !== documentId) return;
      // Alleen de koppelingen naar dít bestand, net als de balk (`checkExternalSources`).
      const refreshed = refreshExternalAnchors(doc.tasks, src, 'file-path');
      setState({ kind: 'ready', source: src, preview: previewExternalRefresh(doc, refreshed.tasks) });
    })();
    return () => { cancelled = true; };
  }, [filePath, documentId, version, tCommon]);

  if (!update) return null;

  const taskById = new Map(tasks.map(task => [task.id, task] as const));
  const taskLabel = (taskId: string) => {
    const task = taskById.get(taskId);
    if (!task) return taskId;
    return task.wbsCode ? `${task.wbsCode} ${task.name}` : task.name;
  };
  const anchorText = (taskId: string, link: ExternalLink, anchor: string) => {
    const task = taskById.get(taskId);
    const side = externalSourceSide(link.direction, link.relType) === 'finish' ? 'end' : 'start';
    return task ? taskDate(task, anchor, side, { milestoneOwn: false }) : dd.date(anchor);
  };
  const projectEnd = (value: string) => dd.dateTime(momentLabel(calendarClock(calendar), value, 'end'));
  const saved = formatLocalDateTime(new Date(update.version), i18n.language, notation);

  const ready = state.kind === 'ready' && state.preview.changes.length > 0 ? state : null;
  const onAccept = () => {
    if (!ready) return;
    accept(ready.source);
    close();
  };

  const effects = (preview: ExternalRefreshPreview): string[] => {
    if (preview.failed) return [t('externalLinks.reviewCalcFailed', { error: scheduleErrorText(preview.failed, tCommon) })];
    const lines = [preview.shiftedTaskIds.length === 0
      ? t('externalLinks.reviewShiftedNone')
      : t('externalLinks.reviewShifted', { count: preview.shiftedTaskIds.length })];
    if (preview.endBefore && preview.endAfter) {
      const before = projectEnd(preview.endBefore);
      const after = projectEnd(preview.endAfter);
      const delta = preview.durationAfter - preview.durationBefore;
      if (preview.endBefore === preview.endAfter) lines.push(t('externalLinks.reviewEndSame', { end: before }));
      else if (delta > 0) lines.push(t('externalLinks.reviewEndLater', { before, after, count: delta }));
      else if (delta < 0) lines.push(t('externalLinks.reviewEndEarlier', { before, after, count: -delta }));
      else lines.push(t('externalLinks.reviewEndMoved', { before, after }));
    }
    return lines;
  };

  return (
    <Dialog
      onCancel={close}
      onConfirm={ready ? onAccept : undefined}
      // Enter op een knop (*Later*, het kruisje, de help) doet wat die knop doet; alleen zonder knopfocus is
      // Enter *Accepteren* (review #811: Enter op *Later* accepteerde de wijziging).
      focusedButtonOwnsEnter
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[640px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-external-source-review-dialog': true }}
    >
      <DialogHeader
        title={t('externalLinks.reviewTitle', { file: update.fileName })}
        onClose={close}
        help={{ articleId: EXTERNAL_LINKS_HELP_ARTICLE_ID }}
      />
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-small leading-4">
        <div style={{ color: 'var(--theme-text-dim)' }}>
          {update.author
            ? t('externalLinks.reviewSavedAuthor', { saved, author: update.author })
            : t('externalLinks.reviewSaved', { saved })}
        </div>

        {state.kind === 'reading' && <div>{t('externalLinks.reviewReading')}</div>}
        {state.kind === 'failed' && (
          <div style={{ color: 'var(--error)' }}>{t('externalLinks.reviewReadFailed')}</div>
        )}
        {state.kind === 'ready' && state.preview.changes.length === 0 && (
          <div>{t('externalLinks.reviewNoChanges')}</div>
        )}
        {ready && (
          <>
            <span className="!text-small uppercase tracking-wide" style={{ color: 'var(--theme-text-muted)' }}>
              {t('externalLinks.reviewLinksTitle')}
            </span>
            <table className="w-full border-collapse" data-ops-external-source-review-links>
              <thead>
                <tr style={{ color: 'var(--theme-text-dim)' }}>
                  <th className="text-start font-normal py-1 pe-2">{t('externalLinks.reviewColTask')}</th>
                  <th className="text-start font-normal py-1 pe-2">{t('externalLinks.reviewColExternal')}</th>
                  <th className="text-start font-normal py-1 pe-2">{t('externalLinks.reviewColNow')}</th>
                  <th className="text-start font-normal py-1">{t('externalLinks.reviewColAfter')}</th>
                </tr>
              </thead>
              <tbody>
                {ready.preview.changes.map(change => (
                  <tr key={`${change.taskId}:${change.linkId}`} className="border-t border-border">
                    <td className="py-1 pe-2">{taskLabel(change.taskId)}</td>
                    <td className="py-1 pe-2">
                      {`${change.link.sourceRef.taskName || change.link.sourceRef.taskId} (${change.link.relType})`}
                    </td>
                    <td className="py-1 pe-2">{anchorText(change.taskId, change.link, change.before.anchorDate)}</td>
                    <td className="py-1 font-medium">
                      {change.link.sourceMissing
                        ? t('externalLinks.reviewMissing')
                        : anchorText(change.taskId, change.link, change.link.anchorDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <span className="!text-small uppercase tracking-wide pt-1" style={{ color: 'var(--theme-text-muted)' }}>
              {t('externalLinks.reviewEffectsTitle')}
            </span>
            <div className="flex flex-col gap-1" data-ops-external-source-review-effects>
              {effects(ready.preview).map(line => <div key={line}>{line}</div>)}
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
        {ready ? (
          <>
            <button className="btn btn--sm btn--secondary" onClick={() => dismiss(update.path)} data-ops-external-source-review-later>
              {t('externalLinks.later')}
            </button>
            <button className="btn btn--sm btn--primary" onClick={onAccept} data-ops-external-source-review-accept>
              {t('externalLinks.reviewAccept')}
            </button>
          </>
        ) : (
          <button
            className="btn btn--sm btn--secondary"
            onClick={() => (state.kind === 'ready' ? dismiss(update.path) : close())}
            data-ops-external-source-review-close
          >
            {tCommon('close')}
          </button>
        )}
      </div>
    </Dialog>
  );
}
