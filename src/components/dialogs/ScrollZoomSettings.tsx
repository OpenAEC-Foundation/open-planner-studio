import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { saveZoomSettings } from '@/utils/settingsStore';
import { Select } from '@/components/common/Select';
import type {
  ScrollMode,
  PositionDivision,
  ModifierMap,
  WheelFunction,
} from '@/state/slices/types';

// The three assignable controls (keys of ModifierMap).
type ControlKey = keyof ModifierMap; // 'plain' | 'ctrl' | 'shift'
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

// Given a map (control -> function), find which control currently owns a function.
function controlForFunction(map: ModifierMap, fn: WheelFunction): ControlKey {
  return CONTROL_KEYS.find(k => map[k] === fn)!;
}

export function ScrollZoomSettings() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const scrollMode = useAppStore(s => s.ui.scrollMode);
  const positionDivision = useAppStore(s => s.ui.positionDivision);
  const modifierMap = useAppStore(s => s.ui.modifierMap);

  const setMode = (mode: ScrollMode) => {
    setUI({ scrollMode: mode });
    void saveZoomSettings({ scrollMode: mode });
  };

  const setDivision = (division: PositionDivision) => {
    setUI({ positionDivision: division });
    void saveZoomSettings({ positionDivision: division });
  };

  // Assign `control` to `targetFn`, swapping with whatever control currently
  // owns `targetFn` so the map stays a strict bijection. Because each function
  // has its own visible dropdown, the swap is shown live: the other dropdown's
  // value updates in place — no hidden "the displaced key jumped elsewhere".
  const assignControlToFunction = (control: ControlKey, targetFn: WheelFunction) => {
    const currentFn = modifierMap[control];
    if (currentFn === targetFn) return; // already there
    const displaced = controlForFunction(modifierMap, targetFn);
    const next: ModifierMap = { ...modifierMap };
    next[control] = targetFn;
    next[displaced] = currentFn; // swap
    setUI({ modifierMap: next });
    void saveZoomSettings({ modifierMap: next });
  };

  return (
    <div className="settings-section">
      <h3>{t('settings.scrollZoom')}</h3>

      {/* Mode dropdown */}
      <div className="scrollzoom-field">
        <label className="scrollzoom-label">{t('settings.scrollMode')}</label>
        <Select
          aria-label={t('settings.scrollMode')}
          value={scrollMode}
          onChange={v => setMode(v as ScrollMode)}
          options={[
            { value: 'position', label: t('settings.scrollModePosition') },
            { value: 'modifier', label: t('settings.scrollModeModifier') },
            { value: 'drag', label: t('settings.scrollModeDrag') },
          ]}
        />
      </div>

      {scrollMode === 'drag' && (
        <p className="scrollzoom-hint">{t('settings.dragModeHint')}</p>
      )}

      {scrollMode === 'position' && (
        <>
          <div className="scrollzoom-field">
            <label className="scrollzoom-label">{t('settings.screenDivision')}</label>
            <Select
              aria-label={t('settings.screenDivision')}
              value={positionDivision}
              onChange={v => setDivision(v as PositionDivision)}
              options={[
                { value: 'left-right', label: t('settings.screenDivisionLeftRight') },
                { value: 'top-bottom', label: t('settings.screenDivisionTopBottom') },
                { value: 'corner', label: t('settings.screenDivisionCorner') },
              ]}
            />
          </div>
          <p className="scrollzoom-hint">{t('settings.positionModeHint')}</p>
        </>
      )}

      {scrollMode === 'modifier' && (
        <div className="scrollzoom-mapper">
          <p className="scrollzoom-hint">{t('settings.modifierMapHint')}</p>
          {/* One dropdown per wheel-action: pick which key triggers it. Choosing a
              key that is already in use swaps it with the action that had it — and
              because all three dropdowns stay on screen, that swap is visible. */}
          {FUNCTIONS.map(fn => (
            <div className="scrollzoom-field" key={fn}>
              <label className="scrollzoom-label">{t(FUNCTION_LABEL_KEYS[fn])}</label>
              <Select
                aria-label={t(FUNCTION_LABEL_KEYS[fn])}
                value={controlForFunction(modifierMap, fn)}
                onChange={v => assignControlToFunction(v as ControlKey, fn)}
                options={CONTROL_KEYS.map(k => ({
                  value: k,
                  label: t(CONTROL_LABEL_KEYS[k]),
                }))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
