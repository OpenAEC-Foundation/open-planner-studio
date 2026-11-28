import { useEffect } from 'react';
import type { UIState } from '@/state/slices/types';
import { useAppStore } from '@/state/appStore';
import { createDefaultUI } from '@/state/slices/uiSlice';
import i18n, { embeddedLocale, initLocale, setLocale } from '@/i18n/config';
import { SITE_HOST_READY_EVENT, candidateHosts, siteHostWindows } from '@/services/fileAccess/siteHost';
import { SITE_HOST_PREFERENCES_EVENT, siteHostTheme } from '@/services/fileAccess/siteHostPreferences';
import {
  adoptLateSiteHostSettings, onSiteHostSettingsEvent, releaseLateSiteHostSettings, settleLateSiteHostSettings,
  siteHostSettingsDelayed, siteHostSettingsUnavailable, takeLateSiteHostSettings, type LateSettingsApplied,
} from '@/services/fileAccess/siteHostSettings';
import { loadAllSettings, settingFieldsByStorageKey } from '@/utils/settingsRegistry';

export type LateSettingsHandler = (keys: ReadonlySet<string>) => Promise<void> | void;

export interface LateSettingsDeps {
  take(): LateSettingsApplied | null;
  settle(keys: Iterable<string>): void;
  release(): void;
  initLocale(): Promise<void>;
  language(): string;
}

const SITE_DEPS: LateSettingsDeps = {
  take: takeLateSiteHostSettings,
  settle: settleLateSiteHostSettings,
  release: releaseLateSiteHostSettings,
  initLocale,
  language: () => i18n.language,
};

const TASK_GRID_KEY = 'ops-taskGridPreferences';
const LOCALE_KEY = 'ops-locale';

let unavailableNoticeShown = false;
function noticeIfSettingsUnavailable(): void {
  if (unavailableNoticeShown || !siteHostSettingsUnavailable()) return;
  unavailableNoticeShown = true;
  useAppStore.getState().notify({
    severity: 'info', messageKey: 'notifications.hostSettingsUnavailable', dedupeKey: 'host-settings-unavailable', sticky: true,
  });
}

let delayDialogShown = false;
function showDelayDialogOnce(): void {
  if (delayDialogShown || !siteHostSettingsDelayed()) return;
  delayDialogShown = true;
  useAppStore.getState().setUI({ showSettingsDelayDialog: true });
}

const sameValue = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export async function processLateSettings(
  setUI: (patch: Partial<UIState>) => void, onLate?: LateSettingsHandler, deps: LateSettingsDeps = SITE_DEPS,
): Promise<void> {
  const applied = deps.take();
  if (!applied) return;
  if (useAppStore.getState().ui.showSettingsDelayDialog) setUI({ showSettingsDelayDialog: false });
  const refresh = new Set(applied.refresh);
  const touched = new Set(applied.touched);
  const fields = settingFieldsByStorageKey();
  deps.settle([...refresh].filter(key => !fields.has(key) && key !== LOCALE_KEY && key !== TASK_GRID_KEY));
  let reverted = applied.reverted;
  try {
    const before = useAppStore.getState().ui;
    const loaded = await loadAllSettings();
    const defaults = createDefaultUI();
    const patch: Partial<UIState> = {};
    for (const [key, field] of fields) {
      if (!refresh.has(key)) continue;
      (patch as Record<string, unknown>)[field] = field in loaded ? loaded[field] : defaults[field];
    }
    if (Object.keys(patch).length > 0) setUI(patch);
    const after = useAppStore.getState().ui;
    for (const [key, field] of fields) {
      if (touched.has(key) && !sameValue(before[field], after[field])) reverted = true;
    }
    deps.settle(fields.keys());

    await onLate?.(refresh);
    deps.settle([TASK_GRID_KEY]);

    if (refresh.has(LOCALE_KEY)) {
      const language = deps.language();
      await deps.initLocale();
      if (touched.has(LOCALE_KEY) && deps.language() !== language) reverted = true;
    }
  } catch (error) {
    console.warn('Instellingen van de host niet toegepast:', error);
  } finally {
    deps.release();
  }
  useAppStore.getState().notify({
    severity: 'info',
    messageKey: reverted ? 'notifications.settingsLoadedLateReverted' : 'notifications.settingsLoadedLate',
    dedupeKey: 'host-settings-late',
  });
}

export function useSiteHostPreferences(setUI: (patch: Partial<UIState>) => void, onLate?: LateSettingsHandler): void {
  useEffect(() => {
    const onSettingsEvent = () => {
      showDelayDialogOnce();
      noticeIfSettingsUnavailable();
      void processLateSettings(setUI, onLate);
    };
    const offSettings = onSiteHostSettingsEvent(onSettingsEvent);
    onSettingsEvent();

    const targets = siteHostWindows();
    if (targets.length === 0) return offSettings;
    const startTheme = siteHostTheme();
    let lastTheme = startTheme !== null && useAppStore.getState().ui.uiTheme === startTheme ? startTheme : null;
    const startLocale = embeddedLocale();
    let lastLocale = startLocale !== null && i18n.language === startLocale ? startLocale : null;

    const applyPreferences = () => {
      const theme = siteHostTheme();
      if (theme !== null && theme !== lastTheme) setUI({ uiTheme: theme });
      lastTheme = theme;
      const locale = embeddedLocale();
      if (locale === null || locale === lastLocale) return;
      if (locale === i18n.language) { lastLocale = locale; return; }
      void setLocale(locale)
        .then(() => { if (embeddedLocale() === locale) lastLocale = locale; })
        .catch(error => console.warn('Taal van de host niet geladen:', error));
    };

    let readyAttached = false;
    const onReady = () => {
      if (candidateHosts().length === 0) return;
      detachReady();
      adoptLateSiteHostSettings();
      applyPreferences();
    };
    const detachReady = () => {
      if (!readyAttached) return;
      readyAttached = false;
      for (const target of targets) {
        try { target.removeEventListener(SITE_HOST_READY_EVENT, onReady); } catch { }
      }
    };

    for (const target of targets) target.addEventListener(SITE_HOST_PREFERENCES_EVENT, applyPreferences);
    if (candidateHosts().length === 0) {
      readyAttached = true;
      for (const target of targets) target.addEventListener(SITE_HOST_READY_EVENT, onReady);
    } else {
      onReady();
    }

    let attached = true;
    const detach = () => {
      if (!attached) return;
      attached = false;
      offSettings();
      detachReady();
      for (const target of targets) {
        try { target.removeEventListener(SITE_HOST_PREFERENCES_EVENT, applyPreferences); } catch { }
      }
      window.removeEventListener('pagehide', detach);
    };
    window.addEventListener('pagehide', detach);
    return detach;
  }, [setUI, onLate]);
}
