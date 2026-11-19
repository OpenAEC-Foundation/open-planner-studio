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
  for (const end of [...active]) end();
}
