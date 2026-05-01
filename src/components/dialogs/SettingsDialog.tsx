import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Locale, LANGUAGE_LABELS, supportedLanguages } from '@/i18n/config';
import { UITheme, UI_THEMES } from '@/state/slices/types';
import { saveLocale, saveTheme } from '@/utils/settingsStore';
import './SettingsDialog.css';

type SettingsTab = 'general' | 'language' | 'timeline';


export function SettingsDialog() {
  const { t, i18n } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const currentTheme = useAppStore(s => s.ui.uiTheme);
  const mouseWheelMode = useAppStore(s => s.ui.mouseWheelMode);
  const enableQuarterHourZoom = useAppStore(s => s.ui.enableQuarterHourZoom);
  const weekStartDay = useAppStore(s => s.ui.weekStartDay);
  const smoothZoom = useAppStore(s => s.ui.smoothZoom);

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [pendingLocale, setPendingLocale] = useState<Locale>(i18n.language as Locale);
  const [pendingTheme, setPendingTheme] = useState<UITheme>(currentTheme);

  // Dragging
  const dialogRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !dialogRef.current) return;
      const x = e.clientX - dragOffset.current.x;
      const y = e.clientY - dragOffset.current.y;
      dialogRef.current.style.left = `${x}px`;
      dialogRef.current.style.top = `${y}px`;
      dialogRef.current.style.transform = 'none';
    };
    const onMouseUp = () => { dragging.current = false; };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel(); };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.modal-close-btn')) return;
    if (!dialogRef.current) return;
    dragging.current = true;
    const rect = dialogRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  const handleSave = useCallback(() => {
    if (pendingLocale !== i18n.language) {
      i18n.changeLanguage(pendingLocale);
      saveLocale(pendingLocale);
    }
    if (pendingTheme !== currentTheme) {
      setUI({ uiTheme: pendingTheme });
      saveTheme(pendingTheme);
    }
    setUI({ showSettingsDialog: false });
  }, [pendingLocale, pendingTheme, i18n, currentTheme, setUI]);

  const handleCancel = () => {
    setUI({ showSettingsDialog: false });
  };

  return (
    <div className="settings-overlay">
      <div ref={dialogRef} className="settings-dialog">
        {/* Header */}
        <div ref={headerRef} className="settings-header" onMouseDown={onHeaderMouseDown}>
          <span>{t('settings.title')}</span>
          <button className="modal-close-btn" onClick={handleCancel}>&times;</button>
        </div>

        {/* Body */}
        <div className="settings-body">
          <div className="settings-content">
            {/* Left sidebar tabs */}
            <div className="settings-tabs">
              <button
                className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
                onClick={() => setActiveTab('general')}
              >
                {t('settings.general')}
              </button>
              <button
                className={`settings-tab ${activeTab === 'language' ? 'active' : ''}`}
                onClick={() => setActiveTab('language')}
              >
                {t('settings.language')}
              </button>
              <button
                className={`settings-tab ${activeTab === 'timeline' ? 'active' : ''}`}
                onClick={() => setActiveTab('timeline')}
              >
                {t('settings.timeline')}
              </button>
            </div>

            {/* Right content */}
            <div className="settings-tab-content">
              {activeTab === 'general' && (
                <div className="settings-section-list">
                  <div className="settings-section">
                    <h3>{t('settings.theme')}</h3>
                    <select
                      className="settings-select"
                      value={pendingTheme}
                      onChange={e => setPendingTheme(e.target.value as UITheme)}
                    >
                      {UI_THEMES.map(({ id, label }) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="settings-section">
                    <h3>{t('settings.version')}</h3>
                    <div className="settings-row">
                      <span>{__APP_VERSION__}</span>
                    </div>
                  </div>
                  <div className="settings-section">
                    <h3>{t('settings.defaultZoom')}</h3>
                    <div className="settings-row">
                      <span>30 px/day</span>
                    </div>
                  </div>
                  <div className="settings-section">
                    <button
                      className="settings-link"
                      onClick={() => {
                        setUI({ showSettingsDialog: false, showProjectInfoDialog: true });
                      }}
                    >
                      {t('settings.projectInfo')}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'language' && (
                <div className="settings-section-list">
                  <div className="settings-section">
                    <h3>{t('settings.language')}</h3>
                    <select
                      className="settings-select"
                      value={pendingLocale}
                      onChange={e => setPendingLocale(e.target.value as Locale)}
                    >
                      {[...supportedLanguages]
                        .sort((a, b) => LANGUAGE_LABELS[a][0].localeCompare(LANGUAGE_LABELS[b][0]))
                        .map(code => {
                          const [short, label] = LANGUAGE_LABELS[code];
                          return (
                            <option key={code} value={code}>{short} — {label}</option>
                          );
                        })}
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="settings-section-list">
                  <div className="settings-section">
                    <h3>{t('settings.mouseWheelMode')}</h3>
                    <select
                      className="settings-select"
                      value={mouseWheelMode}
                      onChange={e => setUI({ mouseWheelMode: e.target.value as 'zoom' | 'scroll' })}
                    >
                      <option value="zoom">{t('settings.mouseWheelModeZoom')}</option>
                      <option value="scroll">{t('settings.mouseWheelModeScroll')}</option>
                    </select>
                  </div>
                  <div className="settings-section">
                    <h3>{t('settings.weekStartDay')}</h3>
                    <select
                      className="settings-select"
                      value={weekStartDay}
                      onChange={e => setUI({ weekStartDay: e.target.value as 'monday' | 'sunday' })}
                    >
                      <option value="monday">{t('settings.weekStartMonday')}</option>
                      <option value="sunday">{t('settings.weekStartSunday')}</option>
                    </select>
                  </div>
                  <div className="settings-section">
                    <label className="settings-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={enableQuarterHourZoom}
                        onChange={e => setUI({ enableQuarterHourZoom: e.target.checked })}
                      />
                      <span>{t('settings.enableQuarterHourZoom')}</span>
                    </label>
                  </div>
                  <div className="settings-section">
                    <label className="settings-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={smoothZoom}
                        onChange={e => setUI({ smoothZoom: e.target.checked })}
                      />
                      <span>{t('settings.smoothZoom')}</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <div className="settings-footer-right">
            <button className="settings-btn settings-btn-primary" onClick={handleSave}>
              {t('ok')}
            </button>
            <button className="settings-btn settings-btn-secondary" onClick={handleCancel}>
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
