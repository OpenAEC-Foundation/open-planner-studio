import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { answerSiteSave } from '@/state/siteDialogBridge';
import { ensureExtension } from '@/utils/filePath';

export function SiteSaveDialog() {
  const pending = useAppStore((s) => s.ui.pendingSiteSave);
  if (!pending) return null;
  return <SiteSaveDialogBody defaultName={pending.defaultName} />;
}

function SiteSaveDialogBody({ defaultName }: { defaultName: string }) {
  const { t } = useTranslation('common');
  const [name, setName] = useState(defaultName);
  const trimmed = name.trim();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const dot = input.value.toLowerCase().lastIndexOf('.ifc');
    input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
  }, []);

  const cancel = () => answerSiteSave(null);
  const submit = () => {
    if (!trimmed) return;
    answerSiteSave({ kind: 'site', name: ensureExtension(trimmed, 'ifc') });
  };

  const stopFileShortcuts = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['s', 'o'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <Dialog
      onCancel={cancel}
      onConfirm={submit}
      overlayClassName="bg-black/60 z-[90]"
      focusedButtonOwnsEnter
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[440px] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-site-save-dialog': true, onKeyDown: stopFileShortcuts }}
    >
      <DialogHeader title={t('siteFiles.saveTitle')} onClose={cancel} />

      <div className="p-4 flex flex-col gap-2 text-small leading-4">
        <label className="font-semibold" htmlFor="ops-site-save-name">{t('siteFiles.nameLabel')}</label>
        <input
          id="ops-site-save-name"
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input !text-small !leading-4 !px-2.5 !py-1.5"
          data-ops-site-save-name
        />
        <p className="text-text-secondary">{t('siteFiles.saveHint')}</p>
      </div>

      <div className="flex justify-between gap-2 px-4 py-3 border-t border-border">
        <button
          className="btn btn--sm btn--secondary flex items-center gap-1.5"
          onClick={() => answerSiteSave({ kind: 'local' })}
          data-ops-site-save-local
        >
          <Icon id="file.local" size={13} />
          {t('siteFiles.toThisPc')}
        </button>
        <div className="flex gap-2">
          <button className="btn btn--sm btn--secondary" onClick={cancel}>{t('cancel')}</button>
          <button
            className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]"
            disabled={!trimmed}
            onClick={submit}
            data-ops-site-save-confirm
          >
            {t('siteFiles.saveToSite')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
