import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useDialogKeys } from '@/hooks/useDialogKeys';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/**
 * Gedeelde dialoog-primitive (audit UI-F4): de overlay-JSX die ~16 dialogs letterlijk kopieerden
 * (`fixed inset-0 bg-black/60 flex items-center justify-center z-50` + backdrop-klik-sluiten +
 * `stopPropagation` op het paneel), gebundeld met de standaard-toetsafhandeling uit
 * {@link useDialogKeys} (Escape = annuleren, Enter = primaire actie).
 *
 * Gedrag is per dialoog instelbaar zodat de migratie het bestaande gedrag exact behoudt:
 *  - géén `onBackdropClick` ⇒ backdrop-klik doet niets (WelcomeDialog);
 *    **Regel sinds issue #158:** `onBackdropClick` alleen op dialogen ZONDER bewerkbare invoer
 *    (informatie- en keuzedialogen zoals Confirm/Update/Recovery/Shortcuts). Een dialoog met
 *    invoervelden of een lokale bewerkbuffer (wizard, taak, kalender, filter, …) sluit uitsluitend
 *    via Annuleren/X/Escape — een klik naast het paneel gooit anders stil getypt werk weg.
 *    `tests/planning/check-dialog-backdrop.ts` bewaakt dat mechanisch met een allowlist.
 *  - géén `onCancel` ⇒ Escape doet niets (ColumnsDialog/FilterDialog/ExternalLinkDialog);
 *  - géén `onConfirm` ⇒ Enter doet niets (de meeste dialogs);
 *  - `overlayClassName` overschrijft tint + z-laag (TaskDialog: `bg-black/50`; ConfirmDialog:
 *    `z-[60]`, gestapeld bóven een openstaande dialoog);
 *  - `stopBackdropPropagation` stopt de backdrop-klik vóór hij doorbubbelt naar een ónderliggende
 *    dialoog-backdrop (ConfirmDialog-stapeling — zie de toelichting daar).
 */
export interface DialogProps {
  /** Paneel-klassen — exact de bestaande klassen per dialoog (incl. breedte/max-hoogte). */
  panelClassName: string;
  /**
   * Backdrop-klik sluit de dialoog; weglaten = backdrop-klik doet niets. Alleen zetten op een
   * dialoog zonder bewerkbare invoer (zie de regel hierboven, issue #158).
   */
  onBackdropClick?: () => void;
  /** Escape-afhandeling (via `useDialogKeys`); weglaten = Escape doet niets. */
  onCancel?: () => void;
  /** Enter = primaire actie (via `useDialogKeys`, met de textarea/dropdown/IME-uitzonderingen). */
  onConfirm?: () => void;
  /** Overschrijft de standaard-overlaytint + z-laag (`bg-black/60 z-50`). */
  overlayClassName?: string;
  /** `stopPropagation` op de backdrop-klik (nodig bij stapeling boven een andere dialoog). */
  stopBackdropPropagation?: boolean;
  /** Extra attributen op de overlay (bv. `data-ops-task-dialog` voor de self-test-harness). */
  overlayProps?: Record<string, unknown>;
  /** Extra attributen op het paneel (bv. `data-ops-welcome-dialog`). */
  panelProps?: Record<string, unknown>;
  children: ReactNode;
}

export function Dialog({
  panelClassName, onBackdropClick, onCancel, onConfirm,
  overlayClassName = 'bg-black/60 z-50', stopBackdropPropagation = false,
  overlayProps, panelProps, children,
}: DialogProps) {
  useDialogKeys({ onConfirm, onCancel });
  // Focus-trap (a11y): Tab/Shift+Tab blijven binnen dit paneel; role/aria-modal maken het modaal.
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef);

  // Alleen een klik-handler op de overlay zetten als er iets te doen valt — WelcomeDialog heeft
  // bewust géén backdrop-close en had ook geen onClick.
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
    >
      {/* stopPropagation: klikken ín het paneel mogen de backdrop-close niet triggeren. */}
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

export interface DialogHeaderProps {
  title: ReactNode;
  /** Icoon vóór de titel (Stats/Shortcuts/Benchmark). */
  icon?: ReactNode;
  onClose: () => void;
  /** Sluitknop tijdelijk uit (Update tijdens een download, Benchmark tijdens een run). */
  closeDisabled?: boolean;
  /** StructureDialog tekent een kleiner kruisje (14 i.p.v. 16). */
  closeIconSize?: number;
}

/**
 * De kopbalk (titel + sluitkruisje) die de meeste dialogen letterlijk kopieerden. Het kruisje
 * draagt altijd dezelfde toegankelijke naam én tooltip — voorheen had de helft geen van beide.
 */
export function DialogHeader({ title, icon, onClose, closeDisabled, closeIconSize = 16 }: DialogHeaderProps) {
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
      <button
        onClick={onClose}
        disabled={closeDisabled}
        className="p-1 hover:bg-surface-hover rounded-[8px] disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={closeLabel}
        title={closeLabel}
      >
        <X size={closeIconSize} />
      </button>
    </div>
  );
}
