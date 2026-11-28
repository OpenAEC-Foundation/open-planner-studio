import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/common/Dialog';

export interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  requireButtonFocus?: boolean;
}

export function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel, cancelLabel, danger, requireButtonFocus }: ConfirmDialogProps) {
  const { t } = useTranslation('common');
  const buttonsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
      else if (e.key === 'Enter') {
        e.stopPropagation();
        if (e.isComposing) { e.preventDefault(); return; }
        const el = document.activeElement;
        if (el instanceof HTMLButtonElement && buttonsRef.current?.contains(el)) return;
        e.preventDefault();
        if (!requireButtonFocus) onConfirm();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel, onConfirm, requireButtonFocus]);

  return (
    <Dialog
      overlayClassName="bg-black/60 z-[60]"
      stopBackdropPropagation
      onBackdropClick={onCancel}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[420px] max-h-[90vh] flex flex-col overflow-hidden"
    >
        <div className="flex-1 overflow-y-auto p-4 text-small text-text-primary leading-relaxed">
          {message}
        </div>

        <div ref={buttonsRef} className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={onCancel} className="btn btn--sm btn--secondary">
            {cancelLabel ?? t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={danger ? 'btn btn--sm btn--danger' : 'btn btn--sm btn--primary shadow-[var(--shadow-glow)]'}
            style={{ fontWeight: 600 }}
          >
            {confirmLabel ?? t('delete')}
          </button>
        </div>
    </Dialog>
  );
}
