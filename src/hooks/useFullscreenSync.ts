import { useEffect } from 'react';
import { useAppStore } from '@/state/appStore';

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
