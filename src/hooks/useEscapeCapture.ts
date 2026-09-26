import { useEffect } from 'react';

/**
 * Escape sluit ALLEEN deze laag: een listener in de capture-fase met `stopImmediatePropagation`,
 * zodat de globale Escape-sneltoets (`edit.deselect` heeft geen dialooggrendel) en onderliggende
 * lagen de toets niet meer zien. Voor gestapelde vensters en pop-overs (ContourDialog,
 * RelationTypePopover). `ConfirmDialog` wijkt bewust af: die vangt ook Enter en stopt alleen de
 * propagatie.
 */
export function useEscapeCapture(onEscape: () => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onEscape();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onEscape]);
}
