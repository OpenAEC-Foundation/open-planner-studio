import { useCallback, useEffect, useRef, type FocusEvent, type FormEvent, type KeyboardEvent } from 'react';
import { holdAutoCalc } from '@/state/editHold';
import { mountedPendingTextEdits } from '@/state/pendingTextEdits';

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
  const done = useCallback(() => {
    release.current?.();
    release.current = null;
  }, []);
  const hold = useCallback((event: FocusEvent | FormEvent) => {
    // Een focus die Ctrl+S/F5 na het committen terugzet (`data-ops-refocus`, useKeyboardShortcuts)
    // is geen nieuwe invoer: de bewerking is af. Pas verder typen (`onInput`) houdt weer vast.
    if ((event.target as HTMLElement | null)?.dataset?.opsRefocus === 'true') return;
    if (release.current || !isTextEntry(event.target)) return;
    // Een route zonder blur (MCP-documentwissel, afsluiten) rondt de bewerking af via het register:
    // eerst commit het veld, dan geeft deze bewerking haar EIGEN blokkade vrij (review #401).
    const unhold = holdAutoCalc();
    const unregister = mountedPendingTextEdits.register({ release: done });
    release.current = () => { unregister(); unhold(); };
  }, [done]);
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Enter' && isTextEntry(event.target)) done();
  }, [done]);
  useEffect(() => done, [done]);
  return { onFocus: hold, onInput: hold, onBlur: done, onKeyDown };
}
