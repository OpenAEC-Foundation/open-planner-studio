import { useEffect, useRef } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { SettingsPanelContent } from '@/components/settings/SettingsPanelContent';
import { useDialogKeys } from '@/hooks/useDialogKeys';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { DialogHelpButton } from '@/components/common/Dialog';
import { SETTINGS_HELP_ARTICLE_ID } from '@/state/helpArticles';
import './SettingsDialog.css';

const searchField = () => document.querySelector<HTMLElement>('.settings-dialog [data-ops-settings-search]');

export function SettingsDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);

  const dialogRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const close = () => setUI({ showSettingsDialog: false });

  useDialogKeys({ onCancel: close });
  useFocusTrap(dialogRef, searchField);

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
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [setUI]);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.modal-close-btn, [data-ops-help-button]')) return;
    if (!dialogRef.current) return;
    dragging.current = true;
    const rect = dialogRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  return (
    <div className="settings-overlay">
      <div
        ref={dialogRef}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.title')}
      >
        <div ref={headerRef} className="settings-header" onMouseDown={onHeaderMouseDown}>
          <span>{t('settings.title')}</span>
          <span className="flex items-center gap-1">
            <DialogHelpButton help={{ articleId: SETTINGS_HELP_ARTICLE_ID }} onClose={close} />
            <button className="modal-close-btn" onClick={close} aria-label={t('close')} title={t('close')}>
              <Icon id="ui.close" size={16} />
            </button>
          </span>
        </div>

        <div className="settings-body">
          <SettingsPanelContent />
        </div>

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
