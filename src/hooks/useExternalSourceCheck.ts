import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { buildImportLabels } from '@/i18n/importLabels';

const FOCUS_THROTTLE_MS = 2000;
const OPEN_DELAY_MS = 500;

export function useExternalSourceCheck(): void {
  const { t } = useTranslation('common');
  const activeDocumentId = useAppStore(s => s.activeDocumentId);
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
