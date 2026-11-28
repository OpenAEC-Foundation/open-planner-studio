import { useEffect, useRef, type RefObject } from 'react';

export interface UseClickOutsideOptions {
  escape?: boolean;
  contextmenu?: boolean;
  defer?: boolean;
  extraRef?: RefObject<HTMLElement | null>;
  ignoreSelector?: string;
}

export const PORTALED_MENU_SELECTOR = '.ops-select__menu, .ops-date-picker';

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
  enabled = true,
  options: UseClickOutsideOptions = {},
): void {
  const { escape = false, contextmenu = false, defer = false, extraRef, ignoreSelector } = options;

  const cbRef = useRef(onOutside);
  cbRef.current = onOutside;

  useEffect(() => {
    if (!enabled) return;

    const isOutside = (target: EventTarget | null) => {
      const node = target as Node | null;
      const insideMain = ref.current !== null && ref.current.contains(node);
      const insideExtra = extraRef?.current != null && extraRef.current.contains(node);
      const element = node instanceof Element ? node : node?.parentElement ?? null;
      const insideFloatingMenu = element?.closest(PORTALED_MENU_SELECTOR) != null;
      const insideIgnored = ignoreSelector !== undefined && element?.closest(ignoreSelector) != null;
      return !insideMain && !insideExtra && !insideFloatingMenu && !insideIgnored;
    };

    const onPointer = (e: MouseEvent) => { if (isOutside(e.target)) cbRef.current(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cbRef.current(); };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const attachPointer = () => {
      document.addEventListener('mousedown', onPointer);
      if (contextmenu) document.addEventListener('contextmenu', onPointer);
    };
    if (escape) document.addEventListener('keydown', onKey);
    if (defer) timer = setTimeout(attachPointer, 0);
    else attachPointer();

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('contextmenu', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, enabled, escape, contextmenu, defer, extraRef, ignoreSelector]);
}
