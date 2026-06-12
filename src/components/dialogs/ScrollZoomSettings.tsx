import { useState } from 'react';
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

// The three draggable controls (keys of ModifierMap).
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

  // For the non-drag click fallback: which control chip is "picked up".
  const [picked, setPicked] = useState<ControlKey | null>(null);
  const [dragOverFn, setDragOverFn] = useState<WheelFunction | null>(null);

  const setMode = (mode: ScrollMode) => {
    setUI({ scrollMode: mode });
    void saveZoomSettings({ scrollMode: mode });
  };

  const setDivision = (division: PositionDivision) => {
    setUI({ positionDivision: division });
    void saveZoomSettings({ positionDivision: division });
  };

  // Assign `control` to slot `targetFn`, swapping with whatever control
  // currently owns `targetFn` so the map stays a strict bijection.
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

  const handleSlotActivate = (targetFn: WheelFunction) => {
    if (!picked) return;
    assignControlToFunction(picked, targetFn);
    setPicked(null);
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
          <div className="scrollzoom-slots" role="list">
            {FUNCTIONS.map(fn => {
              const control = controlForFunction(modifierMap, fn);
              const isDropTarget = dragOverFn === fn;
              return (
                <div
                  key={fn}
                  role="listitem"
                  className={
                    'scrollzoom-slot' +
                    (isDropTarget ? ' is-drop-target' : '') +
                    (picked ? ' is-pick-target' : '')
                  }
                  onClick={() => handleSlotActivate(fn)}
                  onDragOver={e => {
                    e.preventDefault();
                    setDragOverFn(fn);
                  }}
                  onDragLeave={() => setDragOverFn(prev => (prev === fn ? null : prev))}
                  onDrop={e => {
                    e.preventDefault();
                    const dropped = e.dataTransfer.getData('text/plain') as ControlKey;
                    if (CONTROL_KEYS.includes(dropped)) {
                      assignControlToFunction(dropped, fn);
                    }
                    setDragOverFn(null);
                    setPicked(null);
                  }}
                >
                  <span className="scrollzoom-slot-label">
                    {t(FUNCTION_LABEL_KEYS[fn])}
                  </span>
                  <button
                    type="button"
                    className={
                      'scrollzoom-chip' + (picked === control ? ' is-picked' : '')
                    }
                    draggable
                    aria-pressed={picked === control}
                    onClick={e => {
                      // Click-to-pick fallback; stop the slot click from firing.
                      e.stopPropagation();
                      setPicked(prev => (prev === control ? null : control));
                    }}
                    onDragStart={e => {
                      e.dataTransfer.setData('text/plain', control);
                      e.dataTransfer.effectAllowed = 'move';
                      setPicked(null);
                    }}
                  >
                    {t(CONTROL_LABEL_KEYS[control])}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
