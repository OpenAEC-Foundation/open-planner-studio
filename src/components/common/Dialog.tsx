import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useDialogKeys } from '@/hooks/useDialogKeys';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { HelpButton } from '@/components/common/HelpButton';

/**
 * Gedeelde dialoog-primitive: de overlay-JSX van de dialogs
 * (`fixed inset-0 bg-black/60 flex items-center justify-center z-50` + backdrop-klik-sluiten +
 * `stopPropagation` op het paneel), gebundeld met de standaard-toetsafhandeling uit
 * {@link useDialogKeys} (Escape = annuleren, Enter = primaire actie).
 *
 * Gedrag is per dialoog instelbaar:
 *  - géén `onBackdropClick` ⇒ backdrop-klik doet niets (WelcomeDialog);
 *    **Regel:** `onBackdropClick` alleen op dialogen ZONDER bewerkbare invoer
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
  /** Paneel-klassen per dialoog (incl. breedte/max-hoogte). */
  panelClassName: string;
  /**
   * Backdrop-klik sluit de dialoog; weglaten = backdrop-klik doet niets. Alleen zetten op een
   * dialoog zonder bewerkbare invoer (zie de regel hierboven).
   */
  onBackdropClick?: () => void;
  /** Escape-afhandeling (via `useDialogKeys`); weglaten = Escape doet niets. */
  onCancel?: () => void;
  /** Enter = primaire actie (via `useDialogKeys`, met de textarea/dropdown/IME-uitzonderingen). */
  onConfirm?: () => void;
  /**
   * Enter op een gefocuste knop activeert díé knop in plaats van `onConfirm` (zie `useDialogKeys`).
   * `onConfirm` blijft dan de actie voor Enter zonder knopfocus. Voor keuzedialogen (Ja/Nee).
   */
  focusedButtonOwnsEnter?: boolean;
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
  panelClassName, onBackdropClick, onCancel, onConfirm, focusedButtonOwnsEnter,
  overlayClassName = 'bg-black/60 z-50', stopBackdropPropagation = false,
  overlayProps, panelProps, children,
}: DialogProps) {
  useDialogKeys({ onConfirm, onCancel, focusedButtonOwnsEnter });
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

/**
 * Contextuele hulp in een dialoogkop (ontwerp gebruikersdocumentatie §8.1 en §10.2): een ?-knop naast
 * het kruisje die de dialoog via zijn eigen `onClose` sluit en daarna Backstage → Help op `articleId`
 * opent (nooit Help áchter een openstaande dialoog).
 */
export interface DialogHelp {
  /** Artikel-id (of `id#anker`) uit `src/state/helpArticles.ts`. */
  articleId: string;
  /**
   * Alleen voor een dialoog met onopgeslagen invoer: vraag eerst Opslaan / Annuleren / Terug.
   * `onSave` is de eigen opslaanroute van de dialoog (dezelfde als zijn OK-knop): hij bewaart én
   * sluit, en geeft `false` terug als dat niet lukte (bijv. validatie) — dan blijft de dialoog open en
   * opent Help niet. Annuleren loopt via `onClose` van de kop. `dirty: false` slaat de vraag over
   * (niets gewijzigd); weglaten = altijd vragen.
   */
  confirmLeave?: {
    onSave: () => boolean | void;
    dirty?: boolean;
  };
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
  /** ?-knop naast het kruisje (zie {@link DialogHelp}). */
  help?: DialogHelp;
}

/**
 * De gedeelde kopbalk (titel + sluitkruisje) van de dialogen. Het kruisje
 * draagt altijd dezelfde toegankelijke naam én tooltip. Met `help` staat er een ?-knop naast.
 */
export function DialogHeader({ title, icon, onClose, closeDisabled, closeIconSize = 16, help }: DialogHeaderProps) {
  const { t } = useTranslation('common');
  const closeLabel = t('close');
  // De open-functie van de ?-knop, vastgehouden zolang de Opslaan/Annuleren/Terug-vraag openstaat.
  const [pendingOpen, setPendingOpen] = useState<null | (() => void)>(null);

  const handleHelp = (open: () => void) => {
    const leave = help?.confirmLeave;
    if (leave && (leave.dirty ?? true)) {
      setPendingOpen(() => open);
      return;
    }
    // Eerst de dialoog via zijn eigen route sluiten, dan pas Help openen.
    onClose();
    open();
  };

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
        {help && (
          <HelpButton articleId={help.articleId} onOpen={handleHelp} disabled={closeDisabled} size={closeIconSize} />
        )}
        <button
          onClick={onClose}
          disabled={closeDisabled}
          className="p-1 hover:bg-surface-hover rounded-[8px] disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={closeLabel}
          title={closeLabel}
        >
          <X size={closeIconSize} />
        </button>
      </span>
      {pendingOpen && help?.confirmLeave && (
        <HelpLeaveDialog
          onBack={() => setPendingOpen(null)}
          onDiscard={() => { setPendingOpen(null); onClose(); pendingOpen(); }}
          onSave={() => {
            setPendingOpen(null);
            if (help.confirmLeave!.onSave() === false) return;
            pendingOpen();
          }}
        />
      )}
    </div>
  );
}

/**
 * De vraag vóór Help vanuit een dialoog met onopgeslagen invoer: Terug (blijft staan, krijgt de
 * beginfocus), Annuleren (gooit de invoer weg via de eigen sluitroute) of Opslaan (eigen opslaanroute).
 * Zelfde driekeuzepatroon als `UnappliedChangesDialog` en `CloseDocumentDialog`; gestapeld boven de
 * aanroepende dialoog (`z-[60]`, zoals `ConfirmDialog`). Escape = Terug via de dialoogstapel van
 * `useDialogKeys` (alleen de bovenste dialoog reageert), bewust geen Enter-als-Opslaan en geen
 * backdrop-klik: wegklikken mag geen invoer committen of weggooien.
 */
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
