import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { readPoolIFC, resolveUniqueCompanyName, resolvePoolImportPreselection, classifyPoolImportIdentityHint } from '@/services/library';
import { openFileDialog } from '@/services/fileAccess';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { LIBRARY_IMPORT_HELP_ARTICLE_ID } from '@/state/helpArticles';
import type { CompanyPool } from '@/types/library';

const TARGET_COMPANY_SELECT_ID = 'pool-import-target-company';

export function PoolImportDialog() {
  const { t } = useTranslation();
  const open = useAppStore(s => s.ui.showPoolImportDialog);
  const setUI = useAppStore(s => s.setUI);
  const companies = useAppStore(s => s.companies);
  const defaultCompanyId = useAppStore(s => s.defaultCompanyId);
  const poolImportCompanyId = useAppStore(s => s.ui.poolImportCompanyId);
  const isLocalPoolNewer = useAppStore(s => s.isLocalPoolNewer);
  const replacePool = useAppStore(s => s.replacePool);
  const importPoolAsNewCompany = useAppStore(s => s.importPoolAsNewCompany);

  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [action, setAction] = useState<'add' | 'replace'>('replace');
  const [imported, setImported] = useState<CompanyPool | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openDefaultsRef = useRef({ companies, defaultCompanyId, poolImportCompanyId });
  openDefaultsRef.current = { companies, defaultCompanyId, poolImportCompanyId };

  useEffect(() => {
    if (!open) return;
    const { companies: currentCompanies, defaultCompanyId: currentDefaultCompanyId,
      poolImportCompanyId: currentPoolImportCompanyId } = openDefaultsRef.current;
    const preferred = currentPoolImportCompanyId
      && currentCompanies.some(c => c.id === currentPoolImportCompanyId)
      ? currentPoolImportCompanyId
      : currentDefaultCompanyId;
    const valid = currentCompanies.some(c => c.id === preferred)
      ? preferred
      : currentCompanies[0]?.id;
    if (valid) setCompanyId(valid);
  }, [open]);

  if (!open) return null;
  const close = () => {
    setImported(null);
    setError(null);
    setAction('replace');
    setUI({ showPoolImportDialog: false, poolImportCompanyId: null });
  };

  const pick = async () => {
    setError(null);
    const res = await openFileDialog([{ name: 'IFC', extensions: ['ifc'] }]);
    if (!res) return;
    try {
      const pool = await readPoolIFC(res.content);
      setImported(pool);
      const preselection = resolvePoolImportPreselection(pool.companyId, companies);
      if (preselection.action === 'replace') {
        setAction('replace');
        setCompanyId(preselection.companyId);
      } else {
        setAction('add');
      }
    } catch {
      setError(t('companyLibrary.importNotAPool'));
      setImported(null);
    }
  };

  const newer = imported && action === 'replace' ? isLocalPoolNewer(companyId, imported) : false;
  const newCompanyName = imported ? resolveUniqueCompanyName(imported.companyName, companies.map(c => c.name)) : '';
  const identityHint = imported ? classifyPoolImportIdentityHint(imported.companyId, companies) : 'none';

  const confirm = () => {
    if (imported) {
      if (action === 'add') {
        importPoolAsNewCompany(imported);
      } else {
        replacePool(companyId, imported);
      }
    }
    close();
  };

  return (
    <Dialog
      onCancel={close}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-pool-import-dialog': true }}
    >
      <DialogHeader
        title={t('companyLibrary.importTitle')}
        onClose={close}
        help={{ articleId: LIBRARY_IMPORT_HELP_ARTICLE_ID, confirmLeave: { dirty: imported !== null, onSave: confirm } }}
      />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-small leading-4">
        <button onClick={() => { void pick(); }} className="btn btn--sm btn--secondary self-start">
          {t('companyLibrary.chooseFile')}
        </button>

        {error && <p style={{ color: 'var(--error)' }}>{error}</p>}

        {imported && (
          <div className="flex flex-col gap-2">
            <p>{t('companyLibrary.importPreview', { calendars: imported.calendars.length, resources: imported.resources.length, version: imported.poolVersion })}</p>

            <div className="flex flex-col gap-3 border border-border rounded-[10px] p-2.5">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="poolImportAction"
                  className="accent-accent mt-0.5"
                  checked={action === 'add'}
                  onChange={() => setAction('add')}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{t('companyLibrary.importActionAdd')}</span>
                  <span className="text-text-secondary">{t('companyLibrary.importAsNewPreview', { name: newCompanyName })}</span>
                  {identityHint === 'collision' && <span className="text-text-secondary">{t('companyLibrary.importAsNewCopyHint')}</span>}
                  {identityHint === 'fresh-identity' && <span className="text-text-secondary">{t('companyLibrary.importAsNewFreshIdentityHint')}</span>}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="poolImportAction"
                  className="accent-accent"
                  checked={action === 'replace'}
                  onChange={() => setAction('replace')}
                />
                <span className="font-medium">{t('companyLibrary.importActionReplace')}</span>
              </label>
              <div className="flex flex-col gap-1.5 pl-6">
                {companies.length >= 2 && (
                  <div className="flex flex-col gap-1">
                    <label htmlFor={TARGET_COMPANY_SELECT_ID} className="text-text-secondary">{t('companyLibrary.importInto')}</label>
                    <select
                      id={TARGET_COMPANY_SELECT_ID}
                      value={companyId}
                      onChange={e => setCompanyId(e.target.value)}
                      disabled={action !== 'replace'}
                      className="input !text-small !leading-4 !px-2.5 !py-1.5"
                    >
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <span className="text-text-secondary">{t('companyLibrary.importReplaces')}</span>
                {action === 'replace' && newer && (
                  <span className="alert alert--warning flex items-center gap-2">
                    <Icon id="status.warning" size={16} /> {t('companyLibrary.dempingWarning')}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <p className="text-text-secondary border-t border-border pt-3">{t('companyLibrary.syncNote')}</p>
      </div>

      <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
        <button onClick={close} className="btn btn--sm btn--secondary">{t('cancel')}</button>
        <button onClick={confirm} disabled={!imported} className="btn btn--sm btn--primary">
          {action === 'add' ? t('companyLibrary.importConfirmAdd') : t('companyLibrary.importConfirm')}
        </button>
      </div>
    </Dialog>
  );
}
