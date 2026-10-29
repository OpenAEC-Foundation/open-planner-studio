/**
 * Zit de toetsenbordfocus in een tekst- of keuzeveld? Dan horen globale sneltoetsen de toets niet
 * te kapen. Eén definitie voor alle toetsenbordhooks: eerder kende de zoomhook `<select>` niet
 * (−/+/0 zoomden terwijl een keuzelijst focus had) en het sneltoetsregister geen contentEditable.
 *
 * De eigen keuzelijst (`Select`) is een knop met `aria-haspopup="listbox"`. Die telt ook als
 * keuzeveld: anders verwijderen Delete en Backspace de geselecteerde taak, zoomen − en 0 de Gantt en
 * heft Escape de taakselectie op terwijl de gebruiker in de keuzelijst zit. De open lijst van
 * `Select` krijgt nooit focus (de focus blijft op de trigger, met `aria-expanded="true"`); andere
 * lijsten met `role="listbox"` vallen hier bewust NIET onder.
 *
 * Eén uitzondering (besluit orkestrator 2026-10-15): op een DICHTE trigger gaan combinaties met
 * Ctrl/Meta wél door, behalve Delete en Backspace. Na een muiskeuze staat de focus weer op de
 * trigger, en een planner die verkeerd kiest drukt meteen Ctrl+Z; dat mag geen extra klik vragen.
 * In een open lijst blijft alles afgevangen. In een modale dialoog (`aria-modal="true"`) geldt de
 * uitzondering niet: daar staat de keuze in het concept van de dialoog, niet in de store, dus
 * Ctrl+Z of Ctrl+V zou iets achter de dialoog veranderen.
 *
 * Tweede uitzondering (PR #369): een tekstveld met `data-ops-app-keys="true"` (een `UnitsInput`
 * zonder draft; het veld toont dan de opgeslagen waarde) laat Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z en een
 * kale Escape door naar de app. Na Ctrl+S of F5 komt de focus terug in het veld; Ctrl+Z moet dan de
 * app-undo zijn, niet de veld-undo die alleen de tekst terugzet. Zelfde modale grens als hierboven.
 */
export function isTypingTarget(
  target: EventTarget | null,
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>,
): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (target.dataset.opsAppKeys === 'true' && target.closest('[aria-modal="true"]') === null) {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if ((mod && (key === 'z' || key === 'y')) || (!mod && event.key === 'Escape')) return false;
  }
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return true;
  const trigger = target.closest('[aria-haspopup="listbox"]');
  if (!trigger) return false;
  const closed = trigger.getAttribute('aria-expanded') !== 'true';
  const inModal = trigger.closest('[aria-modal="true"]') !== null;
  if (closed && !inModal && (event.ctrlKey || event.metaKey)
    && event.key !== 'Delete' && event.key !== 'Backspace') return false;
  return true;
}
