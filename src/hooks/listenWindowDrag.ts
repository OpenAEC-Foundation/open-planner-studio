/**
 * Hang de window-listeners van een sleepgebaar aan — mousemove, mouseup en optioneel keydown
 * (`keyCapture`: in de capture-fase, zodat Escape vóór de globale sneltoetsen binnenkomt) — en
 * geef de opruimfunctie terug, zodat een effect hem direct kan retourneren.
 *
 * Bewust een functie en geen hook: elk gebaar (balk, splitsen, pan, kaderselectie, relatie
 * trekken, rijsleep, minimap) houdt zijn eigen effect, deps en per-gebaar-toestand; alleen de
 * registratie is gedeeld.
 *
 * Een gebaar hoort bij het document waarin het begon (review #1004, rondes 10–12): een variant draagt
 * dezelfde taak-id's, dus wat na een documentwissel nog binnenkomt, landde anders in het andere
 * document. Daarom zegt elk gebaar met `onDocumentSwitch` hoe het dan stopt, en roept
 * {@link endWindowDragsForDocumentSwitch} bij de wissel eerst de listeners af en daarna die afsluiting.
 */
const active = new Set<() => void>();

export function listenWindowDrag({ onMove, onUp, onKeyDown, keyCapture = false, onDocumentSwitch }: {
  onMove: (event: MouseEvent) => void;
  onUp: (event: MouseEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  keyCapture?: boolean;
  /** Ruim het gebaar op zonder nog in een document te schrijven; de listeners zijn dan al weg. */
  onDocumentSwitch: () => void;
}): () => void {
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  if (onKeyDown) window.addEventListener('keydown', onKeyDown, keyCapture);
  const stop = () => {
    active.delete(endForSwitch);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (onKeyDown) window.removeEventListener('keydown', onKeyDown, keyCapture);
  };
  const endForSwitch = () => {
    stop();
    onDocumentSwitch();
  };
  active.add(endForSwitch);
  return stop;
}

/** Een documentwissel: beëindig elk lopend gebaar. Eén aanroeper, het storeabonnement in `App.tsx`,
 *  dat synchroon binnen de wissel loopt, vóór er nog een muisgebeurtenis binnenkomt. */
export function endWindowDragsForDocumentSwitch(): void {
  if (active.size === 0) return;
  for (const end of [...active]) end();
  swallowReleaseClick();
}

/** De click van het loslaten hoort nog bij het afgebroken gebaar, dus bij het oude document: anders
 *  koos hij een taak in het nieuwe (review #1004, ronde 13). Komt er geen click, omdat de muis buiten
 *  het element werd losgelaten, dan vervalt dit bij de volgende mousedown. */
function swallowReleaseClick(): void {
  const swallow = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  window.addEventListener('mousedown', () => window.removeEventListener('click', swallow, { capture: true }), {
    capture: true, once: true,
  });
}
