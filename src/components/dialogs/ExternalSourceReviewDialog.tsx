import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { useAppStore } from '@/state/appStore';
import { useDisplayDate, useTaskDateText } from '@/hooks/displayDate';
import { buildImportLabels } from '@/i18n/importLabels';
import { scheduleErrorText } from '@/i18n/scheduleErrors';
import { externalSourceScope, refreshExternalAnchors, type ExternalSourceDoc } from '@/engine/externalLinks';
import { previewExternalRefresh, type ExternalRefreshPreview } from '@/engine/externalRefreshPreview';
import { externalSourceSide } from '@/engine/taskGrid/relationFormat';
import { EXTERNAL_LINKS_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { calendarClock, momentLabel } from '@/utils/taskDateLabel';
import { formatLocalDateTime } from '@/utils/displayTime';
import type { ExternalLink } from '@/types/task';

type ReviewState =
  | { kind: 'reading' }
  | { kind: 'failed' }
  | { kind: 'read'; source: ExternalSourceDoc };

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
    u => u.documentId === s.activeDocumentId && u.key === s.ui.externalSourceReview,
  ));
  const tasks = useAppStore(s => s.tasks);
  const calendar = useAppStore(s => s.calendar);
  const project = useAppStore(s => s.project);
  const sequences = useAppStore(s => s.sequences);
  const calendars = useAppStore(s => s.calendars);
  const cpmResult = useAppStore(s => s.cpmResult);
  const notation = useAppStore(s => s.ui.timeNotation);
  const taskDate = useTaskDateText();
  const dd = useDisplayDate();
  const [state, setState] = useState<ReviewState>({ kind: 'reading' });

  const close = () => setUI({ externalSourceReview: null });

  // De balk is weg (geaccepteerd, *Later*, ander document): dan ook het venster.
  useEffect(() => {
    if (!update) setUI({ externalSourceReview: null });
  }, [update, setUI]);

  // De bron met pad (desktop), zonder pad (browser, onthouden handvat; stap 1.8) of op de site (`open(id)`,
  // stap 1.9). Het object
  // `locator` blijft hetzelfde zolang de balk dezelfde is.
  // Komt de balk uit een geopend document (stap 1.7), dan leest de app dat document (`readExternalSourceUpdate`).
  const locator = update?.locator;
  const documentId = update?.documentId;
  const version = update?.version;
  const openDocumentId = update?.openDocumentId;
  useEffect(() => {
    if (!locator || !documentId) return;
    let cancelled = false;
    setState({ kind: 'reading' });
    void (async () => {
      const src = await useAppStore.getState().readExternalSourceUpdate({ locator, openDocumentId }, buildImportLabels(tCommon));
      if (cancelled) return;
      if (!src) { setState({ kind: 'failed' }); return; }
      if (useAppStore.getState().activeDocumentId !== documentId) return;
      setState({ kind: 'read', source: src });
    })();
    return () => { cancelled = true; };
  }, [locator, documentId, version, openDocumentId, tCommon]);

  // Het voorstel volgt de stand van het document. Rekent de planner opnieuw (F5) terwijl het venster open
  // staat, dan vergelijkt het met de nieuwe berekening, met de al gelezen bron (review #811 ronde 2).
  const source = state.kind === 'read' ? state.source : null;
  const preview = useMemo(() => {
    if (!source) return null;
    // Alleen de koppelingen naar dít bestand, of zonder pad naar dit project, net als de balk
    // (`checkExternalSources`) en *Accepteren*.
    const refreshed = refreshExternalAnchors(tasks, source, externalSourceScope(source));
    return previewExternalRefresh({ project, tasks, sequences, calendar, calendars, cpmResult }, refreshed.tasks);
  }, [source, project, tasks, sequences, calendar, calendars, cpmResult]);

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
  // Op de site (stap 1.9) het versienummer; anders de wijzigingstijd van het bestand.
  const siteVersion = update.siteVersionLabel;
  // Uit een geopend document (stap 1.7): geen opslagtijd.
  const saved = siteVersion !== undefined || update.openDocumentId !== undefined
    ? '' : formatLocalDateTime(new Date(update.version), i18n.language, notation);

  const ready = source && preview && preview.changes.length > 0 ? { source, preview } : null;
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
          {update.openDocumentId !== undefined
            ? t('externalLinks.reviewOpenDocument')
            : siteVersion !== undefined
            ? (update.author
              ? t('externalLinks.reviewSavedSiteAuthor', { version: siteVersion, author: update.author })
              : t('externalLinks.reviewSavedSite', { version: siteVersion }))
            : update.author
              ? t('externalLinks.reviewSavedAuthor', { saved, author: update.author })
              : t('externalLinks.reviewSaved', { saved })}
        </div>

        {state.kind === 'reading' && <div>{t('externalLinks.reviewReading')}</div>}
        {state.kind === 'failed' && (
          <div style={{ color: 'var(--error)' }}>{t('externalLinks.reviewReadFailed')}</div>
        )}
        {preview && preview.changes.length === 0 && (
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
            <button className="btn btn--sm btn--secondary" onClick={() => dismiss(update.key)} data-ops-external-source-review-later>
              {t('externalLinks.later')}
            </button>
            <button className="btn btn--sm btn--primary" onClick={onAccept} data-ops-external-source-review-accept>
              {t('externalLinks.reviewAccept')}
            </button>
          </>
        ) : (
          <button
            className="btn btn--sm btn--secondary"
            onClick={() => (state.kind === 'read' ? dismiss(update.key) : close())}
            data-ops-external-source-review-close
          >
            {tCommon('close')}
          </button>
        )}
      </div>
    </Dialog>
  );
}
