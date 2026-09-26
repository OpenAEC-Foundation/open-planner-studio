/**
 * Wegnavigeerbewaking voor Backstage.
 *
 * Backstage → Projectinfo werkt met een lokale draft die pas op **Toepassen** in de store landt.
 * Wie iets wijzigt en dan naar een andere Backstage-sectie gaat, op **Terug** klikt, Escape drukt
 * of een linttabblad kiest, verliest die wijziging anders stil (de sectie unmount en de draft is weg).
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

/**
 * Staat er een bewaker (= een afwijkende Projectinfo-draft)? Voor wegroutes die niet via een
 * keuzedialoog kunnen lopen omdat ze een ander document activeren (Ctrl/⌘+1–9, Ctrl/⌘+N, Ctrl/⌘+O):
 * die worden zolang geblokkeerd — de draft hoort bij het actieve document en een documentwissel
 * zou hem stil verwerpen (of, bij terugkeer, een verouderde draft tonen).
 */
export function isBackstageLeaveGuardActive(): boolean {
  return current !== null;
}

/** Voert `proceed` uit, tenzij de actieve bewaker de wegnavigatie onderschept (die roept hem dan later zelf aan). */
export function leaveBackstageGuarded(proceed: () => void): void {
  if (current?.(proceed)) return;
  proceed();
}
