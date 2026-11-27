import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/common/Dialog';

interface NewProfileDialogProps {
  sourceName: string;
  initialName: string;
  onCreate: (name: string) => void;
  onCancel: () => void;
}

export function NewProfileDialog({ sourceName, initialName, onCreate, onCancel }: NewProfileDialogProps) {
  const { t } = useTranslation('common');
  const { t: tTask } = useTranslation('task');
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const valid = name.trim().length > 0;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
      else if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault(); e.stopPropagation();
        if (name.trim().length > 0) onCreate(name);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [name, onCancel, onCreate]);

  return (
    <Dialog
      overlayClassName="bg-black/60 z-[60]"
      stopBackdropPropagation
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[420px] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-new-profile-dialog': true, 'aria-labelledby': 'ops-new-profile-title' }}
    >
      <div className="flex flex-col gap-3 p-4">
        <span id="ops-new-profile-title" className="text-heading leading-5 font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('schedulingProfile.newProfileTitle')}
        </span>
        <div className="alert alert--info" data-ops-new-profile-intro>
          {t('schedulingProfile.newProfileIntro', { name: sourceName })}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-text-secondary font-medium">{t('schedulingProfile.newProfileName')}</span>
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            aria-invalid={!valid}
            className="px-2 py-1.5 bg-surface border-[1.5px] border-[var(--theme-control-border)] rounded-[8px] text-text-primary focus:outline-none focus:border-accent"
            data-ops-new-profile-name
          />
        </label>
        {!valid && (
          <div className="alert alert--warning" data-ops-new-profile-name-required>
            {tTask('taskGrid.validation.required')}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
        <button type="button" onClick={onCancel} className="btn btn--sm btn--secondary" data-ops-new-profile-cancel>
          {t('cancel')}
        </button>
        <button type="button" onClick={() => onCreate(name)} disabled={!valid}
          className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]" data-ops-new-profile-create>
          {t('schedulingProfile.newProfileCreate')}
        </button>
      </div>
    </Dialog>
  );
}
