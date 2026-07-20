import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';

// Presentation mode (fase 2.7, §9.3): de fullscreenchange-listener zet de ui-flag terug op false
// als de gebruiker fullscreen verlaat buiten onze eigen knop/F11/Escape om (bv. OS-toets, browser-
// chrome), zodat de flag nooit desynct van de werkelijke fullscreen-status.
export function useFullscreenSync(): void {
  const setUI = useAppStore(s => s.setUI);
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && useAppStore.getState().ui.presentationMode) {
        setUI({ presentationMode: false });
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [setUI]);
}
