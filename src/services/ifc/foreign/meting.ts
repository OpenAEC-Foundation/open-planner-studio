// METING — alleen in de meet-branch meting/804-grote-bestanden, nooit naar main.
// Grenzen tussen de onderdelen van één opslag (`prepareIfcWrite`), voor `scripts/proef/meet-opslag.mjs`. Zonder haak op
// `globalThis.__opsMeting` doet niets hier iets; met haak verandert alleen wat de haak zelf meet, nooit de uitvoer.
interface MetingHaak {
  grens(label: string): void;
  data(label: string, data: Record<string, unknown>): void;
  readonly proef?: Readonly<Record<string, boolean>>;
}
const haak = (): MetingHaak | undefined => (globalThis as { __opsMeting?: MetingHaak }).__opsMeting; // METING
/** Einde van een onderdeel: het werk sinds de vorige grens heet `label`. */
export const METING = (label: string): void => { haak()?.grens(label); }; // METING
/** Losse getallen bij een grens (aantallen, buffergroottes). */
export const METING_DATA = (label: string, data: () => Record<string, unknown>): void => { const h = haak(); if (h) h.data(label, data()); }; // METING
/** Staat proef `naam` aan? Alleen voor de ruwe proeven van deel 2. */
export const PROEF = (naam: string): boolean => haak()?.proef?.[naam] === true; // METING
