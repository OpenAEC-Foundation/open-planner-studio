import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useFileDrop } from '@/hooks/useFileDrop';

export function FileDropOverlay() {
  const active = useFileDrop();
  const { t } = useTranslation('common');
  if (!active) return null;
  return (
    <div className="file-drop-overlay" data-ops-file-drop-overlay>
      <div className="file-drop-overlay-card">
        <Icon id="file.open" size={32} className="text-text-secondary" />
        <p className="text-heading font-semibold leading-6">{t('fileDrop.title')}</p>
        <p className="text-body leading-5 text-text-secondary">{t('fileDrop.subtitle')}</p>
      </div>
    </div>
  );
}
