import { FilePlus2, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/common/Dialog';
import { useAppStore } from '@/state/appStore';
import { buildImportLabels } from '@/i18n/importLabels';

/** Eén compacte keuze voor de plusknoppen in de documentkiezer. */
export function NewOrOpenProjectDialog() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const openFile = useAppStore(s => s.openFile);
  const close = () => setUI({ showNewOrOpenProjectDialog: false });
  const create = () => setUI({ showNewOrOpenProjectDialog: false, showNewProjectDialog: true });
  const open = () => {
    close();
    void openFile(buildImportLabels(t));
  };

  return (
    <Dialog
      onBackdropClick={close}
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[360px] overflow-hidden"
      panelProps={{ 'data-ops-new-or-open-project-dialog': true }}
    >
      <div className="px-4 py-3 border-b border-border text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
        {t('documents.newOrOpenTitle')}
      </div>
      <div className="p-3 flex flex-col gap-2">
        <button className="btn btn--primary justify-start gap-2" onClick={create} data-ops-new-project-choice>
          <FilePlus2 size={16} />{t('documents.newProject')}
        </button>
        <button className="btn btn--secondary justify-start gap-2" onClick={open} data-ops-open-project-choice>
          <FolderOpen size={16} />{t('documents.openExistingProject')}
        </button>
      </div>
      <div className="flex justify-end px-4 py-3 border-t border-border">
        <button className="btn btn--sm btn--secondary" onClick={close}>{t('cancel')}</button>
      </div>
    </Dialog>
  );
}
