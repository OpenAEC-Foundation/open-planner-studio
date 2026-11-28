import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAppStore } from '@/state/appStore';
import { useResolvedUITheme } from '@/hooks/useResolvedUITheme';
import { UI_THEMES, type ModifierMap, type UIState, type WheelFunction } from '@/state/slices/types';
import {
  saveExperimentalSettingsVisible, saveFeatureFlags, saveFormatNoticeHidden, saveZoomSettings,
} from '@/utils/settingsStore';
import { FORMAT_NOTICE_KINDS, withFormatNoticeShown } from '@/services/formatNoticeKinds';
import { FEATURE_FLAGS, isFeatureEnabled } from '@/utils/featureFlags';
import { UPDATES_AVAILABLE } from '@/utils/buildFlags';
import { isTauri } from '@/utils/platform';
import { Select } from '@/components/common/Select';
import { AppLogo } from '@/components/common/AppLogo';
import { applySetting, applyTheme } from './applySetting';
import { SettingToggle, THEME_LABEL_KEYS } from './settingControls';
import { ThemeSwatches, WheelMapVisual } from './settingVisuals';
import { VisualChoice } from './VisualChoice';

function openFromSettings(patch: Partial<UIState>): void {
  useAppStore.getState().setUI({ showSettingsDialog: false, activeRibbonTab: 'start', ...patch });
}

export const themeSearchTexts = (t: TFunction<'common'>): string[] => [
  ...UI_THEMES.map(({ id }) => t(THEME_LABEL_KEYS[id])), t('settings.themeFollowSystem'),
];

export function ThemeControl() {
  const { t } = useTranslation('common');
  const currentTheme = useAppStore(s => s.ui.uiTheme);
  const resolvedTheme = useResolvedUITheme();
  const followSystem = currentTheme === 'system';
  return (
    <>
      <VisualChoice
        label={t('settings.theme')}
        selectedKey={followSystem ? resolvedTheme : currentTheme}
        disabled={followSystem}
        onSelect={key => applyTheme(key as typeof UI_THEMES[number]['id'])}
        options={UI_THEMES.map(({ id }) => ({
          key: id,
          label: t(THEME_LABEL_KEYS[id]),
          visual: <ThemeSwatches theme={id} />,
          cardProps: { 'data-ops-theme-card': id },
        }))}
      />
      <SettingToggle
        label={t('settings.themeFollowSystem')}
        checked={followSystem}
        onChange={checked => applyTheme(checked ? 'system' : resolvedTheme)}
        inputProps={{ 'data-ops-follow-system-theme': true }}
      />
      {followSystem && (
        <p className="settings-hint">
          {t('settings.themeSystemHint', { theme: t(THEME_LABEL_KEYS[resolvedTheme]) })}
        </p>
      )}
    </>
  );
}

type ControlKey = keyof ModifierMap;
const CONTROL_KEYS: ControlKey[] = ['plain', 'ctrl', 'shift'];
const FUNCTIONS: WheelFunction[] = ['vertical', 'horizontal', 'zoom'];
const CONTROL_LABEL_KEYS = {
  plain: 'settings.wheelCtrlPlain',
  ctrl: 'settings.wheelCtrlCtrl',
  shift: 'settings.wheelCtrlShift',
} as const;
const FUNCTION_LABEL_KEYS = {
  vertical: 'settings.wheelFnVertical',
  horizontal: 'settings.wheelFnHorizontal',
  zoom: 'settings.wheelFnZoom',
} as const;

export const modifierMapSearchTexts = (t: TFunction<'common'>): string[] => [
  ...FUNCTIONS.map(fn => t(FUNCTION_LABEL_KEYS[fn])), ...CONTROL_KEYS.map(k => t(CONTROL_LABEL_KEYS[k])),
];

function controlForFunction(map: ModifierMap, fn: WheelFunction): ControlKey {
  return CONTROL_KEYS.find(k => map[k] === fn)!;
}

export function ModifierMapControl() {
  const { t } = useTranslation('common');
  const modifierMap = useAppStore(s => s.ui.modifierMap);
  const assign = (control: ControlKey, targetFn: WheelFunction) => {
    const currentFn = modifierMap[control];
    if (currentFn === targetFn) return;
    const displaced = controlForFunction(modifierMap, targetFn);
    const next: ModifierMap = { ...modifierMap, [control]: targetFn, [displaced]: currentFn };
    applySetting('modifierMap', next, v => saveZoomSettings({ modifierMap: v }));
  };
  return (
    <div className="settings-wheelmap">
      <div className="settings-wheelmap-fields">
        {FUNCTIONS.map(fn => (
          <label className="settings-inline-field" key={fn}>
            <span>{t(FUNCTION_LABEL_KEYS[fn])}</span>
            <Select
              aria-label={t(FUNCTION_LABEL_KEYS[fn])}
              value={controlForFunction(modifierMap, fn)}
              onChange={v => assign(v as ControlKey, fn)}
              options={CONTROL_KEYS.map(k => ({ value: k, label: t(CONTROL_LABEL_KEYS[k]) }))}
            />
          </label>
        ))}
      </div>
      <WheelMapVisual map={modifierMap} />
    </div>
  );
}

export function FormatNoticesControl() {
  const { t } = useTranslation('common');
  const hidden = useAppStore(s => s.ui.formatNoticeHidden);
  return (
    <div className="settings-toggle-list" data-ops-setting-format-notice>
      {FORMAT_NOTICE_KINDS.map(kind => (
        <SettingToggle
          key={kind}
          label={t(`formatNotice.formats.${kind}.name`)}
          checked={!hidden.includes(kind)}
          onChange={checked => applySetting(
            'formatNoticeHidden',
            withFormatNoticeShown(useAppStore.getState().ui.formatNoticeHidden, kind, checked),
            saveFormatNoticeHidden,
          )}
          inputProps={{ 'data-ops-setting-format-notice-kind': kind }}
        />
      ))}
    </div>
  );
}

export const versionSearchTexts = (t: TFunction<'common'>): string[] => [
  __APP_VERSION__,
  ...(UPDATES_AVAILABLE ? [t('updates.checkButton'), t('updates.justUpdated.whatsNewButton')] : []),
];

export function VersionControl() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const experimentalVisible = useAppStore(s => s.ui.experimentalSettingsVisible);
  const unlockSequence = useRef<{ start: number; last: number } | null>(null);

  const activateVersion = () => {
    if (experimentalVisible) return;
    const now = performance.now();
    const sequence = unlockSequence.current;
    if (!sequence || now - sequence.last > 500) {
      unlockSequence.current = { start: now, last: now };
    } else if (now - sequence.start >= 5_000) {
      unlockSequence.current = null;
      applySetting('experimentalSettingsVisible', true, saveExperimentalSettingsVisible);
    } else {
      sequence.last = now;
    }
  };

  const openWhatsNew = async () => {
    let version = __APP_VERSION__;
    if (isTauri()) {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        version = await getVersion();
      } catch {
      }
    }
    setUI({ justUpdated: { from: null, to: version }, showSettingsDialog: false });
  };

  return (
    <>
      <div className="settings-version-row">
        <AppLogo size={32} />
        <button
          type="button"
          className="settings-version"
          data-ops-settings-version
          onClick={activateVersion}
          onBlur={() => { unlockSequence.current = null; }}
        >
          {__APP_VERSION__}
        </button>
      </div>
      {UPDATES_AVAILABLE && (
        <div className="settings-button-row">
          <button className="settings-link" onClick={() => setUI({ showSettingsDialog: false, showUpdateDialog: true })}>
            {t('updates.checkButton')}
          </button>
          <button className="settings-link" onClick={() => { void openWhatsNew(); }}>
            {t('updates.justUpdated.whatsNewButton')}
          </button>
        </div>
      )}
    </>
  );
}

export const experimentalSearchTexts = (t: TFunction<'common'>): string[] => [
  ...FEATURE_FLAGS.flatMap(flag => (flag.descriptionKey ? [t(flag.nameKey), t(flag.descriptionKey)] : [t(flag.nameKey)])),
  t('settings.experimentalHide'),
];

export function ExperimentalControl() {
  const { t } = useTranslation('common');
  const featureFlags = useAppStore(s => s.ui.featureFlags);
  const hide = (button: HTMLButtonElement) => {
    const version = button.closest('.settings-content')?.querySelector<HTMLButtonElement>('[data-ops-settings-version]');
    applySetting('experimentalSettingsVisible', false, saveExperimentalSettingsVisible);
    version?.focus();
  };
  return (
    <div className="settings-toggle-list" data-ops-experimental-settings>
      {FEATURE_FLAGS.length === 0 && <p className="settings-hint">{t('settings.experimentalEmpty')}</p>}
      {FEATURE_FLAGS.map(flag => (
        <SettingToggle
          key={flag.id}
          label={t(flag.nameKey)}
          hint={flag.descriptionKey ? t(flag.descriptionKey) : undefined}
          checked={isFeatureEnabled(featureFlags, flag.id)}
          onChange={checked => applySetting(
            'featureFlags',
            { ...useAppStore.getState().ui.featureFlags, [flag.id]: checked },
            saveFeatureFlags,
          )}
          inputProps={{ 'data-ops-feature-flag': flag.id }}
        />
      ))}
      <div className="settings-button-row">
        <button type="button" className="settings-link" onClick={e => hide(e.currentTarget)}>
          {t('settings.experimentalHide')}
        </button>
      </div>
    </div>
  );
}

export function TourControl() {
  const { t } = useTranslation('common');
  return (
    <div className="settings-button-row">
      <button className="settings-link" onClick={() => openFromSettings({ showTourOverlay: true, tourStepIndex: 0 })}>
        {t('tour.backstageRestart')}
      </button>
    </div>
  );
}

export function StatsControl() {
  const { t } = useTranslation('common');
  return (
    <div className="settings-button-row" data-ops-settings-stats>
      <button className="settings-link" onClick={() => openFromSettings({ showStatsDialog: true })}>
        {t('settings.statsOpen')}
      </button>
    </div>
  );
}

export function BenchmarkControl() {
  const { t } = useTranslation('common');
  return (
    <div className="settings-button-row">
      <button className="settings-link" onClick={() => openFromSettings({ showBenchmarkDialog: true })}>
        {t('benchmark.open')}
      </button>
    </div>
  );
}
