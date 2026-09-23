/**
 * Wegnavigeerbewaking voor Backstage (B2, gebruikstest rekenprofielen 24-09).
 *
 * Backstage → Projectinfo werkt met een lokale draft die pas op **Toepassen** in de store landt.
 * Wie iets wijzigde en dan naar een andere Backstage-sectie ging, op **Terug** klikte, Escape drukte
 * of een linttabblad koos, verloor die wijziging stil (de sectie unmount en de draft is weg).
 *
 * Eén module-globale haak, geen store-state: de bewaking is puur UI-coördinatie tussen de Backstage-
 * zijbalk en het lint (dat buiten Backstage gemount is). Backstage registreert een bewaker zolang de
 * Projectinfo-draft afwijkt; elke wegnavigatie loopt via {@link leaveBackstageGuarded}. Onderschept
 * de bewaker, dan toont Backstage de in-app keuzedialoog (Toepassen / Verwerpen / Annuleren) en voert
 * hij `proceed` zelf uit na Toepassen of Verwerpen.
 */
export type BackstageLeaveGuard = (proceed: () => void) => boolean;

let current: BackstageLeaveGuard | null = null;

/** Registreert (of wist, met `null`) de bewaker. Geeft een opruimfunctie die alleen zijn eigen bewaker wist. */
export function setBackstageLeaveGuard(guard: BackstageLeaveGuard | null): () => void {
  current = guard;
  return () => { if (current === guard) current = null; };
}

/** Voert `proceed` uit, tenzij de actieve bewaker de wegnavigatie onderschept (die roept hem dan later zelf aan). */
export function leaveBackstageGuarded(proceed: () => void): void {
  if (current?.(proceed)) return;
  proceed();
}
