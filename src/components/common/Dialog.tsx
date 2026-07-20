import type { ReactNode } from 'react';
import { useDialogKeys } from '@/hooks/useDialogKeys';

/**
 * Gedeelde dialoog-primitive (audit UI-F4): de overlay-JSX die ~16 dialogs letterlijk kopieerden
 * (`fixed inset-0 bg-black/60 flex items-center justify-center z-50` + backdrop-klik-sluiten +
 * `stopPropagation` op het paneel), gebundeld met de standaard-toetsafhandeling uit
 * {@link useDialogKeys} (Escape = annuleren, Enter = primaire actie).
 *
 * Gedrag is per dialoog instelbaar zodat de migratie het bestaande gedrag exact behoudt:
 *  - géén `onBackdropClick` ⇒ backdrop-klik doet niets (WelcomeDialog);
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
  /** Backdrop-klik sluit de dialoog; weglaten = backdrop-klik doet niets. */
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
      <div className={panelClassName} onClick={e => e.stopPropagation()} {...panelProps}>
        {children}
      </div>
    </div>
  );
}
