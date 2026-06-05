import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { SettingsPanelContent } from '@/components/settings/SettingsPanelContent';
import './SettingsDialog.css';

export function SettingsDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);

  // Dragging
  const dialogRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const close = () => setUI({ showSettingsDialog: false });

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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUI({ showSettingsDialog: false });
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [setUI]);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.modal-close-btn')) return;
    if (!dialogRef.current) return;
    dragging.current = true;
    const rect = dialogRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  return (
    <div className="settings-overlay">
      <div ref={dialogRef} className="settings-dialog">
        {/* Header */}
        <div ref={headerRef} className="settings-header" onMouseDown={onHeaderMouseDown}>
          <span>{t('settings.title')}</span>
          <button className="modal-close-btn" onClick={close}>&times;</button>
        </div>

        {/* Body — shared settings panel */}
        <div className="settings-body">
          <SettingsPanelContent />
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <div className="settings-footer-right">
            <button className="settings-btn settings-btn-primary" onClick={close}>
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
