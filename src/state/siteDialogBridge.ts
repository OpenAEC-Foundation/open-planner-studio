import { useAppStore } from '@/state/appStore';
import {
  setSiteOpenAsker, setSiteSaveAsker, type SiteOpenChoice, type SiteSaveChoice,
} from '@/services/fileAccess/siteDialogs';

let resolveOpen: ((choice: SiteOpenChoice) => void) | null = null;
let resolveSave: ((choice: SiteSaveChoice) => void) | null = null;

export function answerSiteOpen(choice: SiteOpenChoice): void {
  const resolve = resolveOpen;
  if (!resolve) return;
  resolveOpen = null;
  useAppStore.getState().setUI({ pendingSiteOpen: null });
  resolve(choice);
}

export function answerSiteSave(choice: SiteSaveChoice): void {
  const resolve = resolveSave;
  if (!resolve) return;
  resolveSave = null;
  useAppStore.getState().setUI({ pendingSiteSave: null });
  resolve(choice);
}

export function installSiteDialogAskers(): void {
  setSiteOpenAsker((request) => new Promise<SiteOpenChoice>((resolve) => {
    if (resolveOpen) {
      const previous = resolveOpen;
      resolveOpen = null;
      previous(null);
    }
    resolveOpen = resolve;
    useAppStore.getState().setUI({ pendingSiteOpen: request });
  }));
  setSiteSaveAsker((request) => new Promise<SiteSaveChoice>((resolve) => {
    if (resolveSave) {
      const previous = resolveSave;
      resolveSave = null;
      previous(null);
    }
    resolveSave = resolve;
    useAppStore.getState().setUI({ pendingSiteSave: request });
  }));
}
