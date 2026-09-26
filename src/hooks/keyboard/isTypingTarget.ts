/**
 * Zit de toetsenbordfocus in een tekst- of keuzeveld? Dan horen globale sneltoetsen de toets niet
 * te kapen. Eén definitie voor alle toetsenbordhooks: eerder kende de zoomhook `<select>` niet
 * (−/+/0 zoomden terwijl een keuzelijst focus had) en het sneltoetsregister geen contentEditable.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
