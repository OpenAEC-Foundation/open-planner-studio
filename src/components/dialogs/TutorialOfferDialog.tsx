import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { saveTutorialOfferAnswered } from '@/utils/settingsStore';
import { appLog } from '@/services/debug/appLog';
import { emitExtensionEvent } from '@/services/extensionEvents';
import { enableExtension, whenExtensionSettled } from '@/extensions/extensionLoader';
import { fetchCatalog, installFromCatalog } from '@/extensions/extensionService';
import { getGuideView } from '@/extensions/guideRuntime';
import { startFirstTutorial, type FirstTutorialDeps, type FirstTutorialOutcome } from '@/extensions/firstTutorial';
import { getRegisteredHelpArticles } from '@/utils/helpArticleRegistry';
import { tutorialsInOrder } from '@/utils/helpManifest';
import type { NotifyInput } from '@/state/slices/types';

/** De echte app-binding van {@link startFirstTutorial}: store, loader, catalogus, Help-register. */
function appFirstTutorialDeps(): FirstTutorialDeps {
  return {
    extensionStatus: id => useAppStore.getState().installedExtensions[id]?.status ?? null,
    whenSettled: whenExtensionSettled,
    enable: id => enableExtension(id),
    fetchCatalog,
    catalog: () => {
      const s = useAppStore.getState();
      return { entries: s.catalogEntries, error: s.catalogError };
    },
    install: installFromCatalog,
    firstTutorialId: id => tutorialsInOrder(getRegisteredHelpArticles().filter(a => a.source === id))[0]?.id ?? null,
    emit: emitExtensionEvent,
    guideRunningFor: id => getGuideView()?.extensionId === id,
  };
}

/** "Je vindt de tutorials altijd in Help › Tutorials", met een knop naar Help. */
const LATER_NOTICE: NotifyInput = {
  severity: 'info',
  messageKey: 'notifications.tutorialOfferLater',
  action: { kind: 'openBackstageSection', section: 'help', labelKey: 'notifications.actions.openHelp' },
};

/**
 * De tutorialvraag: verschijnt eenmalig na een VOLTOOIDE rondleiding (`tourFinishPatch`,
 * `state/onboarding.ts`). Elk antwoord — Ja, Nee, het kruisje of Escape — telt als beantwoord
 * (`ops-tutorialOfferAnswered`), dus hij komt nooit terug.
 *
 * Ja = installeren en meteen starten (`startFirstTutorial`). De dialoog blijft zolang in een
 * bezig-stand open; de toestemmingsvraag van de installatie stapelt er bovenop (hij staat later in de
 * boom). Lukt het niet, dan opent Help op Tutorials, met een melding. Nee = een melding dat de
 * tutorials in Help › Tutorials staan.
 */
export function TutorialOfferDialog() {
  const { t } = useTranslation('common');
  const [busy, setBusy] = useState(false);

  const markAnswered = () => {
    void saveTutorialOfferAnswered(true);
    useAppStore.getState().setUI({ tutorialOfferAnswered: true });
  };

  const decline = () => {
    if (busy) return;
    markAnswered();
    const store = useAppStore.getState();
    store.setUI({ showTutorialOffer: false });
    store.notify(LATER_NOTICE);
  };

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    markAnswered();
    let outcome: FirstTutorialOutcome;
    try {
      outcome = await startFirstTutorial(appFirstTutorialDeps());
    } catch (error) {
      appLog.emit('error', 'tutorials', 'tutorialvraag: starten mislukt', error);
      outcome = { kind: 'unavailable', reason: 'install-failed' };
    }
    appLog.emit('event', 'tutorials',
      `tutorialvraag: ${outcome.kind}${outcome.kind === 'unavailable' ? ` (${outcome.reason})` : ''}`);

    const store = useAppStore.getState();
    if (outcome.kind === 'started') {
      store.setUI({ showTutorialOffer: false });
    } else if (outcome.kind === 'declined') {
      store.setUI({ showTutorialOffer: false });
      store.notify(LATER_NOTICE);
    } else {
      // Terugval: Help › Tutorials, de blijvende plek om het later opnieuw te proberen.
      store.setUI({
        showTutorialOffer: false,
        activeRibbonTab: 'file',
        backstageSection: 'help',
        pendingHelpSection: 'tutorials',
      });
      store.notify({ severity: 'info', messageKey: 'notifications.tutorialOfferUnavailable' });
    }
  };

  return (
    // Bewust geen backdrop-close: een keuzevraag, geen melding. Tijdens "bezig" doen Escape, Enter
    // en het kruisje niets — de installatie loopt dan al.
    <Dialog
      onCancel={busy ? undefined : decline}
      onConfirm={busy ? undefined : () => { void accept(); }}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[440px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-tutorial-offer': true, 'aria-busy': busy }}
    >
      <DialogHeader
        title={t('tutorialOffer.title')}
        icon={<GraduationCap size={16} aria-hidden />}
        onClose={decline}
        closeDisabled={busy}
      />
      <div className="p-4 flex flex-col gap-3 text-body leading-5">
        <p className="font-semibold">{t('tutorialOffer.question')}</p>
        <p className="text-text-secondary">{t('tutorialOffer.body')}</p>
        {busy && <p className="text-small leading-4 text-text-secondary" role="status">{t('tutorialOffer.busy')}</p>}
      </div>
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
        <button onClick={decline} disabled={busy} className="btn btn--sm">{t('tutorialOffer.no')}</button>
        <button onClick={() => { void accept(); }} disabled={busy} className="btn btn--sm btn--primary">
          {t('tutorialOffer.yes')}
        </button>
      </div>
    </Dialog>
  );
}
