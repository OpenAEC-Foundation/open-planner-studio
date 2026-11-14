/**
 * Sneltoetsen vanuit een open datumkiezer (#904). De kiezer hangt los aan `body`, dus een sneltoets
 * die daar begint, ziet zijn datumveld niet. Opslaan en herberekenen ronden eerst de invoer van het
 * actieve veld af; zonder deze brug sloeg Ctrl+S vanuit de kiezer de vorige datum op (review #940).
 */
const closers = new WeakMap<Element, () => void>();

/** De kiezer meldt zich aan met de handeling die hem sluit en de focus terugzet in zijn veld. */
export function registerDatePickerPanel(panel: Element, close: () => void): () => void {
  closers.set(panel, close);
  return () => { closers.delete(panel); };
}

/** Staat dit element in een open kiezer? Dan geldt het voor sneltoetsen als een invoerveld. */
export function isInDatePicker(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-ops-date-picker]') !== null;
}

/**
 * Sluit de kiezer rond `target` en geef het element terug dat daarna de focus heeft (het veld).
 * Buiten een kiezer komt `target` ongewijzigd terug.
 */
export function leaveDatePicker(target: EventTarget | null): EventTarget | null {
  const panel = target instanceof Element ? target.closest('[data-ops-date-picker]') : null;
  const close = panel ? closers.get(panel) : undefined;
  if (!close) return target;
  close();
  return document.activeElement;
}
