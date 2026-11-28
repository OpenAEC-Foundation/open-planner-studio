import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';

export function SettingsDelayDialog() {
  const { t } = useTranslation('common');
  const close = () => useAppStore.getState().setUI({ showSettingsDelayDialog: false });

  return (
    <Dialog
      onCancel={close}
      onConfirm={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[min(440px,calc(100vw-2rem))] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-settings-delay-dialog': true }}
    >
      <DialogHeader
        title={t('settingsDelay.title')}
        icon={<Icon id="status.warning" size={16} aria-hidden />}
        onClose={close}
      />
      <p className="px-4 py-4 text-body leading-5 text-text-primary">{t('settingsDelay.body')}</p>
      <div className="flex justify-end px-4 py-3 border-t border-border">
        <button type="button" onClick={close} className="btn btn--sm btn--primary" data-ops-settings-delay-ok>
          {t('ok')}
        </button>
      </div>
    </Dialog>
  );
}
