import { useAppStore } from '@/state/appStore';
import { setConsentAsker } from './consent';

let resolvePending: ((granted: boolean) => void) | null = null;

export function resolveExtensionConsent(granted: boolean): void {
  const resolve = resolvePending;
  if (!resolve) return;
  resolvePending = null;
  useAppStore.getState().setUI({ pendingExtensionConsent: null });
  resolve(granted);
}

export function installConsentDialogAsker(): void {
  setConsentAsker((request) => new Promise<boolean>((resolve) => {
    if (resolvePending) {
      const vorige = resolvePending;
      resolvePending = null;
      vorige(false);
    }
    resolvePending = (granted: boolean) => {
      resolvePending = null;
      useAppStore.getState().setUI({ pendingExtensionConsent: null });
      resolve(granted);
    };
    useAppStore.getState().setUI({ pendingExtensionConsent: request });
  }));
}
