import { useRef, type RefObject } from 'react';

/**
 * Houdt de nieuwste waarde leesbaar voor een langlevende eventlistener zonder die listener bij elke
 * render opnieuw te koppelen. Alleen gebruiken wanneer herregistratie tijdens een gesture bewust
 * ongewenst is; gewone React-effectdata hoort in de dependency-array.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
