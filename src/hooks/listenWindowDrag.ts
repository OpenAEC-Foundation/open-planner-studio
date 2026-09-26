/**
 * Hang de window-listeners van een sleepgebaar aan — mousemove, mouseup en optioneel keydown
 * (`keyCapture`: in de capture-fase, zodat Escape vóór de globale sneltoetsen binnenkomt) — en
 * geef de opruimfunctie terug, zodat een effect hem direct kan retourneren.
 *
 * Bewust een functie en geen hook: elk gebaar (balk, splitsen, pan, kaderselectie, relatie
 * trekken, rijsleep, minimap) houdt zijn eigen effect, deps en per-gebaar-toestand; alleen de
 * registratie is gedeeld.
 */
export function listenWindowDrag({ onMove, onUp, onKeyDown, keyCapture = false }: {
  onMove: (event: MouseEvent) => void;
  onUp: (event: MouseEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  keyCapture?: boolean;
}): () => void {
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  if (onKeyDown) window.addEventListener('keydown', onKeyDown, keyCapture);
  return () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (onKeyDown) window.removeEventListener('keydown', onKeyDown, keyCapture);
  };
}
