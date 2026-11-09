import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { buildImportLabels } from '@/i18n/importLabels';

/** Hoe lang na een controle de app een nieuwe focus negeert (focus en `visibilitychange` vallen vaak samen). */
const FOCUS_THROTTLE_MS = 2000;
/** Wachttijd na het openen of wisselen van een document, zodat het laden eerst klaar is. */
const OPEN_DELAY_MS = 500;

/**
 * Het vangnet van keuze 6 (Ethan, 2026-11-03; 7.2 in `docs/relaties-tussen-projecten.md`): de app kijkt of
 * een bron een nieuwe versie heeft als een document opent of actief wordt, en als het venster weer actief
 * wordt. Een nieuwe versie geeft de balk (`ExternalSourceNotice`). Zonder externe koppelingen doet de
 * controle niets.
 */
export function useExternalSourceCheck(): void {
  const { t } = useTranslation('common');
  const activeDocumentId = useAppStore(s => s.activeDocumentId);
  // Een geopend bestand kan het lege tabblad hergebruiken; dan verandert alleen het pad.
  const filePath = useAppStore(s => s.filePath);

  useEffect(() => {
    let last = 0;
    const run = () => {
      last = Date.now();
      void useAppStore.getState().checkExternalSources(buildImportLabels(t));
    };
    const onFocus = () => {
      if (Date.now() - last < FOCUS_THROTTLE_MS) return;
      run();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') onFocus(); };
    const timer = window.setTimeout(run, OPEN_DELAY_MS);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeDocumentId, filePath, t]);
}
