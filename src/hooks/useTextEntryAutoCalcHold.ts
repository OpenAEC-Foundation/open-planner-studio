import { useCallback, useEffect, useRef, type FocusEvent, type FormEvent, type KeyboardEvent } from 'react';
import { holdAutoCalc } from '@/state/editHold';
import { mountedPendingTextEdits } from '@/state/pendingTextEdits';
import { noteTextEntry } from '@/state/textEntryActivity';

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color', 'file']);

export function isTextEntry(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type);
}

export function useTextEntryAutoCalcHold() {
  const release = useRef<(() => void) | null>(null);
  const done = useCallback(() => {
    release.current?.();
    release.current = null;
  }, []);
  const hold = useCallback((event: FocusEvent | FormEvent) => {
    if ((event.target as HTMLElement | null)?.dataset?.opsRefocus === 'true') return;
    if (release.current || !isTextEntry(event.target)) return;
    const unhold = holdAutoCalc();
    const unregister = mountedPendingTextEdits.register({ release: done });
    release.current = () => { unregister(); unhold(); };
  }, [done]);
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Enter' && isTextEntry(event.target)) done();
  }, [done]);
  useEffect(() => done, [done]);
  const onInput = useCallback((event: FormEvent) => {
    if (isTextEntry(event.target)) noteTextEntry();
    hold(event);
  }, [hold]);
  return { onFocus: hold, onInput, onBlur: done, onKeyDown };
}
