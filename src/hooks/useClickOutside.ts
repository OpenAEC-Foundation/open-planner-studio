import { useEffect, useRef, type RefObject } from 'react';

/**
 * Opties voor {@link useClickOutside} — dekken de randgevallen die de bestaande
 * click-outside-implementaties door de codebase gebruikten:
 *  - `escape`: sluit óók op de Escape-toets (dropdowns deden dit niet, popovers/menu's wel).
 *  - `contextmenu`: sluit óók bij een rechtsklik (`contextmenu`-event) buiten het element — nodig
 *    voor het canvas-contextmenu, dat op een nieuwe rechtsklik meteen moet verspringen/sluiten.
 *  - `defer`: hang de buiten-listeners pas ná de huidige event-cyclus aan (`setTimeout 0`), zodat
 *    de openende klik/mouseup het net-geopende paneel niet in dezelfde cyclus weer sluit
 *    (ContextMenu/RelationTypePopover-patroon).
 */
export interface UseClickOutsideOptions {
  escape?: boolean;
  contextmenu?: boolean;
  defer?: boolean;
}

/**
 * Gedeelde click-outside-hook (audit UI-F3): vervangt de ~10 losse `useEffect`-implementaties die
 * allemaal `document`-listeners aanhingen en `ref.current.contains(e.target)` toetsten.
 *
 * De callback wordt via een ref actueel gehouden, zodat het effect NIET reset wanneer de parent bij
 * elke render een nieuwe closure doorgeeft (bijv. `() => setOpen(false)` of een verse `onClose`). Dat
 * is precies waarom `ContextMenu` voorheen een handmatige `onCloseRef` + lege deps nodig had: met
 * `[onClose]`-deps werd de `defer`-timer bij elke parent-render gereset en werkte klik-buiten nooit.
 *
 * @param ref        Element dat als "binnen" telt.
 * @param onOutside  Aangeroepen bij een klik/rechtsklik buiten `ref` (en bij Escape als `escape`).
 * @param enabled    Haak alleen actief als dit waar is (default `true`); dropdowns geven hier hun
 *                   `open`-vlag door zodat de listeners alleen bij een open paneel hangen.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
  enabled = true,
  options: UseClickOutsideOptions = {},
): void {
  const { escape = false, contextmenu = false, defer = false } = options;

  // Callback via ref: houdt 'm actueel zonder het effect (en z'n defer-timer) te resetten.
  const cbRef = useRef(onOutside);
  cbRef.current = onOutside;

  useEffect(() => {
    if (!enabled) return;

    const isOutside = (target: EventTarget | null) =>
      ref.current !== null && !ref.current.contains(target as Node | null);

    const onPointer = (e: MouseEvent) => { if (isOutside(e.target)) cbRef.current(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cbRef.current(); };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const attachPointer = () => {
      document.addEventListener('mousedown', onPointer);
      if (contextmenu) document.addEventListener('contextmenu', onPointer);
    };
    // Escape hangt altijd meteen (niet gedeferd) — net als de bestaande sites die de
    // mousedown-listener deferden maar de keydown-listener direct aanhingen.
    if (escape) document.addEventListener('keydown', onKey);
    if (defer) timer = setTimeout(attachPointer, 0);
    else attachPointer();

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('contextmenu', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, enabled, escape, contextmenu, defer]);
}
