import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { answerDependentAnchorWarning } from '@/state/dependentAnchorQuestionBridge';
import type { TightAnchor } from '@/engine/dependentProjects';

/** Een anker zoals in de relatiecel (ISO), met een spatie in plaats van de `T`. */
const anchorText = (anchor: string) => anchor.replace('T', ' ');

/**
 * De waarschuwing vóór opslaan bij de bron (stap 1.11, keuze 3 zonder cloud): na deze wijziging worden
 * ankers van afhankelijke projecten te krap. Lijst per koppeling: project, taak daar, onze taak, oud
 * anker → nieuw anker. *Toch opslaan* of *Annuleren* (ook Esc en het kruisje: dan wordt er niets
 * opgeslagen). Rendert alleen bij `ui.pendingDependentAnchorWarning`; het antwoord gaat via
 * `answerDependentAnchorWarning` (`state/dependentAnchorQuestionBridge.ts`). De focus staat bij het
 * openen op *Annuleren*, zodat Enter niet ongemerkt opslaat.
 */
export function DependentAnchorWarningDialog() {
  const pending = useAppStore((s) => s.ui.pendingDependentAnchorWarning);
  if (!pending) return null;
  return <DependentAnchorWarningBody anchors={pending} />;
}

function DependentAnchorWarningBody({ anchors }: { anchors: TightAnchor[] }) {
  const { t } = useTranslation('common');
  const cancel = () => answerDependentAnchorWarning(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);

  // Ctrl/⌘+S en Ctrl/⌘+O niet doorlaten naar de globale sneltoetsen (zelfde regel als de schemavraag).
  const stopFileShortcuts = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['s', 'o'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <Dialog
      onCancel={cancel}
      // Kan uit "Opslaan" in de sluitvraag van een tabblad komen (z-index 80): daar bovenop.
      overlayClassName="bg-black/60 z-[90]"
      focusedButtonOwnsEnter
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-w-[95vw] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-dependent-anchor-warning': true, onKeyDown: stopFileShortcuts }}
    >
      <DialogHeader title={t('dependentAnchorWarning.title')} onClose={cancel} />
      <div className="p-4 text-small leading-5 flex flex-col gap-3">
        <p>{t('dependentAnchorWarning.body')}</p>
        <div className="max-h-[50vh] overflow-auto border border-border rounded">
          <table className="w-full text-small leading-4">
            <thead className="text-text-muted">
              <tr>
                <th className="text-left font-normal px-2 py-1">{t('dependentAnchorWarning.colProject')}</th>
                <th className="text-left font-normal px-2 py-1">{t('dependentAnchorWarning.colTheirTask')}</th>
                <th className="text-left font-normal px-2 py-1">{t('dependentAnchorWarning.colOwnTask')}</th>
                <th className="text-left font-normal px-2 py-1">{t('dependentAnchorWarning.colAnchor')}</th>
              </tr>
            </thead>
            <tbody>
              {anchors.map(a => (
                <tr key={`${a.projectId}:${a.taskId}:${a.linkId}`} className="border-t border-border" data-ops-dependent-anchor-row>
                  <td className="px-2 py-1">{a.projectName}</td>
                  <td className="px-2 py-1">{a.taskName}</td>
                  <td className="px-2 py-1">{a.ownTaskName}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{anchorText(a.anchorDate)} → <b>{anchorText(a.newAnchorDate)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
        <button
          className="btn btn--sm btn--secondary"
          onClick={() => answerDependentAnchorWarning(true)}
          data-ops-dependent-anchor-choice="save"
        >
          {t('dependentAnchorWarning.saveAnyway')}
        </button>
        <button
          ref={cancelRef}
          className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]"
          onClick={cancel}
          data-ops-dependent-anchor-choice="cancel"
        >
          {t('dependentAnchorWarning.cancel')}
        </button>
      </div>
    </Dialog>
  );
}
