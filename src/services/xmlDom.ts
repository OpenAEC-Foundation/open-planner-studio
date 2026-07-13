/**
 * Gedeelde DOM-lees-primitieven voor de XML-readers (MSPDI, P6) — F5-b. De twee formaten
 * verschillen BEWUST in scope-strategie, dus die staat hier als twee expliciete functies:
 *
 *   - `descendantText` (MSPDI): `getElementsByTagName(tag)[0]` — de eerste tag ergens ONDER `parent`.
 *   - `directChildText` (P6): alleen de DIRECTE kinderen van `parent`, zodat geneste elementen met
 *     dezelfde tag (bv. een Relationship-subboom) niet per ongeluk worden opgepikt.
 *
 * De numerieke wrappers (`toInt`/`toFloat`) delen de `parseInt/parseFloat`+`isNaN`-fallback-conventie
 * die eerder in beide readers identiek gekopieerd stond. Elke reader houdt een dunne lokale
 * `getElement*`-wrapper die de juiste text-strategie inprikt — zo veranderen de ~60 aanroepen niet en
 * blijft het per-formaat-gedrag exact hetzelfde.
 */

/** MSPDI-scope: eerste voorkomen van `tagName` ergens onder `parent` (descendant-search). */
export function descendantText(parent: Element, tagName: string): string {
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || '';
}

/** P6-scope: eerste DIRECTE kind van `parent` met `tagName` (nooit geneste subbomen). */
export function directChildText(parent: Element, tagName: string): string {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === tagName || child.tagName === tagName) {
      return child.textContent?.trim() || '';
    }
  }
  return '';
}

/** `parseInt` (radix-loos, zoals de readers deden) met `fallback` bij een niet-numerieke waarde. */
export function toInt(text: string, fallback = 0): number {
  const n = parseInt(text);
  return isNaN(n) ? fallback : n;
}

/** `parseFloat` met `fallback` bij een niet-numerieke waarde. */
export function toFloat(text: string, fallback = 0): number {
  const n = parseFloat(text);
  return isNaN(n) ? fallback : n;
}
