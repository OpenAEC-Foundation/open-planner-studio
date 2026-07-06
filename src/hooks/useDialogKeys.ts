import { useEffect } from 'react';

/**
 * Standaard dialoog-sneltoetsen (fase 2.8b): Esc = annuleren/sluiten, Enter = primaire actie
 * (Toepassen/Aanmaken) — hetzelfde als de primaire knop, zoals `RecoveryDialog` het al deed.
 *
 * Enter wordt NIET afgevuurd wanneer de focus in een element staat waar Enter een eigen betekenis
 * heeft:
 *  - een `<textarea>` (regeleinde),
 *  - een open dropdown (`aria-expanded="true"`) of een `Select`-trigger (`aria-haspopup="listbox"`,
 *    Enter opent/kiest daar),
 *  - tijdens IME-compositie (`isComposing` — CJK/complexe invoer),
 *  - of wanneer de toets al is afgehandeld (`defaultPrevented`, bv. door een open `Select`).
 */
export function useDialogKeys({
  onConfirm,
  onCancel,
}: {
  onConfirm?: () => void;
  onCancel?: () => void;
}): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onCancel) { e.preventDefault(); onCancel(); }
        return;
      }
      if (e.key === 'Enter') {
        if (!onConfirm || e.defaultPrevented || e.isComposing) return;
        const el = document.activeElement as HTMLElement | null;
        if (el?.tagName === 'TEXTAREA') return;
        if (el?.getAttribute('aria-expanded') === 'true') return;   // open dropdown
        if (el?.getAttribute('aria-haspopup') === 'listbox') return; // Select-trigger (open/dicht)
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);
}
