import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface ConfirmDialogProps {
  /** De te bevestigen vraag/mededeling — tekst wordt door de aanroeper vertaald aangeleverd. */
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Default: `t('delete')` — past bij het meest voorkomende gebruik (verwijderen). */
  confirmLabel?: string;
  /** Default: `t('cancel')`. */
  cancelLabel?: string;
  /** Rode bevestigknop (destructieve actie, bv. verwijderen). Default false. */
  danger?: boolean;
}

/**
 * Fase 2.10 (item 5): generieke in-app bevestigingsdialoog ter vervanging van `window.confirm()`.
 * Puur presentationeel (geen store-koppeling) — chrome/keyboard-gedrag exact naar `RecoveryDialog`
 * (Escape=annuleren, Enter=bevestigen). Bedoeld om BOVEN een reeds openstaande dialoog te stapelen
 * (de 3 call-sites — LayoutsDialog/BaselineDialog — zijn zelf al `fixed inset-0`-overlays met
 * `z-50`), dus deze laag gebruikt `z-[60]`, boven de aanroepende dialoog.
 */
export function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel, cancelLabel, danger }: ConfirmDialogProps) {
  const { t } = useTranslation('common');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onConfirm(); }
    };
    // Capture-fase: deze dialoog stapelt boven een al openstaande dialoog die zelf ook een
    // Escape/Enter-listener heeft (bv. LayoutsDialog/BaselineDialog sluiten op Escape) — zonder
    // capture zou die onderliggende listener ook vuren en de aanroepende dialoog per ongeluk sluiten.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]"
      // stopPropagation: deze laag stapelt BOVEN een al openstaande dialoog (LayoutsDialog/
      // BaselineDialog) die zelf ook een backdrop-onClick=close heeft. Zonder stopPropagation zou
      // een klik op déze backdrop (buiten de kaart, binnen de DOM-boom van de onderliggende
      // dialoog) doorbubbelen en die dialoog óók sluiten — de gebruiker wilde alleen de
      // bevestiging annuleren.
      onClick={e => { e.stopPropagation(); onCancel(); }}
    >
      <div
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[420px] max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto p-4 text-xs text-text-primary leading-relaxed">
          {message}
        </div>

        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
          <button onClick={onCancel} className="btn btn--sm btn--secondary">
            {cancelLabel ?? t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={danger ? 'btn btn--sm btn--danger' : 'btn btn--sm btn--primary shadow-[var(--shadow-glow)]'}
          >
            {confirmLabel ?? t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
