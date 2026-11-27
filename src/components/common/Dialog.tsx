import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useDialogKeys } from '@/hooks/useDialogKeys';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { HelpButton } from '@/components/common/HelpButton';

export interface DialogProps {
  panelClassName: string;
  suspended?: boolean;
  initialFocus?: () => HTMLElement | null;
  onBackdropClick?: () => void;
  onCancel?: () => void;
  onConfirm?: () => void;
  focusedButtonOwnsEnter?: boolean;
  overlayClassName?: string;
  stopBackdropPropagation?: boolean;
  overlayProps?: Record<string, unknown>;
  panelProps?: Record<string, unknown>;
  children: ReactNode;
}

export function Dialog({
  panelClassName, suspended = false, initialFocus, onBackdropClick, onCancel, onConfirm, focusedButtonOwnsEnter,
  overlayClassName = 'bg-black/60 z-50', stopBackdropPropagation = false,
  overlayProps, panelProps, children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleBackdrop = (onBackdropClick || stopBackdropPropagation)
    ? (e: React.MouseEvent) => {
        if (stopBackdropPropagation) e.stopPropagation();
        onBackdropClick?.();
      }
    : undefined;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center ${overlayClassName}`}
      onClick={handleBackdrop}
      {...overlayProps}
      {...(suspended ? { style: { display: 'none' as const }, inert: true, 'aria-hidden': true } : {})}
    >
      {!suspended && (
        <DialogBehavior
          panelRef={panelRef}
          initialFocus={initialFocus}
          onConfirm={onConfirm}
          onCancel={onCancel}
          focusedButtonOwnsEnter={focusedButtonOwnsEnter}
        />
      )}
      <div
        ref={panelRef}
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        {...panelProps}
      >
        {children}
      </div>
    </div>
  );
}

function DialogBehavior({ panelRef, initialFocus, ...keys }: {
  panelRef: RefObject<HTMLDivElement | null>;
} & Pick<DialogProps, 'initialFocus' | 'onConfirm' | 'onCancel' | 'focusedButtonOwnsEnter'>) {
  useDialogKeys(keys);
  useFocusTrap(panelRef, initialFocus);
  return null;
}

export interface DialogHelp {
  articleId: string;
  confirmLeave?: {
    onSave: (openHelpLater: () => void) => boolean | 'later' | void;
    dirty?: boolean;
  };
  close?: () => void;
}

export interface DialogHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  closeIconSize?: number;
  help?: DialogHelp;
}

export function DialogHeader({ title, icon, onClose, closeDisabled, closeIconSize = 16, help }: DialogHeaderProps) {
  const { t } = useTranslation('common');
  const closeLabel = t('close');

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
      <span
        className={icon ? 'text-body leading-5 font-semibold flex items-center gap-2' : 'text-body leading-5 font-semibold'}
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        {icon}
        {title}
      </span>
      <span className="flex items-center gap-1">
        {help && <DialogHelpButton help={help} onClose={help.close ?? onClose} disabled={closeDisabled} size={closeIconSize} />}
        <button
          onClick={onClose}
          disabled={closeDisabled}
          className="p-1 hover:bg-surface-hover rounded-[8px] disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={closeLabel}
          title={closeLabel}
        >
          <Icon id="ui.close" size={closeIconSize} />
        </button>
      </span>
    </div>
  );
}

export function DialogHelpButton({ help, onClose, disabled, size = 16 }: {
  help: DialogHelp;
  onClose: () => void;
  disabled?: boolean;
  size?: number;
}) {
  const [pendingOpen, setPendingOpen] = useState<null | (() => void)>(null);

  const handleHelp = (open: () => void) => {
    const leave = help.confirmLeave;
    if (leave && (leave.dirty ?? true)) {
      setPendingOpen(() => open);
      return;
    }
    onClose();
    open();
  };

  return (
    <>
      <HelpButton articleId={help.articleId} onOpen={handleHelp} disabled={disabled} size={size} />
      {pendingOpen && help.confirmLeave && (
        <HelpLeaveDialog
          onBack={() => setPendingOpen(null)}
          onDiscard={() => { setPendingOpen(null); onClose(); pendingOpen(); }}
          onSave={() => {
            const open = pendingOpen;
            setPendingOpen(null);
            const saved = help.confirmLeave!.onSave(open);
            if (saved === false || saved === 'later') return;
            open();
          }}
        />
      )}
    </>
  );
}

function HelpLeaveDialog({ onBack, onDiscard, onSave }: { onBack: () => void; onDiscard: () => void; onSave: () => void }) {
  const { t } = useTranslation('common');
  return (
    <Dialog
      onCancel={onBack}
      overlayClassName="bg-black/60 z-[60]"
      stopBackdropPropagation
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[440px] max-w-[90vw] p-5 flex flex-col gap-3"
      panelProps={{ 'data-ops-help-leave-dialog': '', 'aria-labelledby': 'ops-help-leave-title' }}
    >
      <h3 id="ops-help-leave-title" className="!text-heading leading-6 font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
        {t('dialogHelp.leaveTitle')}
      </h3>
      <div className="alert alert--warning">{t('dialogHelp.leaveBody')}</div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn--secondary btn--sm" onClick={onBack} data-ops-help-leave-choice="back">
          {t('dialogHelp.back')}
        </button>
        <button type="button" className="btn btn--danger btn--sm" onClick={onDiscard} data-ops-help-leave-choice="discard">
          {t('cancel')}
        </button>
        <button type="button" className="btn btn--primary btn--sm" onClick={onSave} data-ops-help-leave-choice="save">
          {t('save')}
        </button>
      </div>
    </Dialog>
  );
}
