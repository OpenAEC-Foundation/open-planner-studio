import { useCallback, useEffect, useRef, type FocusEvent, type FormEvent, type KeyboardEvent } from 'react';
import { holdAutoCalc } from '@/state/editHold';

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color', 'file']);

function isTextEntry(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type);
}

/**
 * Container-props die Automatisch berekenen vasthouden zolang de gebruiker in een tekstveld typt.
 * Het eigenschappenpaneel commit per toetsaanslag (één undo-stap via `coalesceKey`); zonder dit
 * rekende de CPM al bij "1" terwijl je "12" wilde typen. De bewerking is voltooid bij het verlaten
 * van het veld of bij Enter; typ je daarna in hetzelfde veld verder, dan houdt hij opnieuw vast.
 * Vinkjes, keuzelijsten en schuiven vallen erbuiten: die zijn per klik al een voltooide bewerking.
 */
export function useTextEntryAutoCalcHold() {
  const release = useRef<(() => void) | null>(null);
  const hold = useCallback((event: FocusEvent | FormEvent) => {
    if (!release.current && isTextEntry(event.target)) release.current = holdAutoCalc();
  }, []);
  const done = useCallback(() => {
    release.current?.();
    release.current = null;
  }, []);
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Enter' && isTextEntry(event.target)) done();
  }, [done]);
  useEffect(() => done, [done]);
  return { onFocus: hold, onInput: hold, onBlur: done, onKeyDown };
}
