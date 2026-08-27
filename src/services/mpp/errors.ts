/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 */

/** Herkenbaar afgewezen .mpp. `mppCode` wordt duck-typed gelezen door
 *  `importErrorMessageKey` in formatRegistry (bewust geen statische import daarheen:
 *  deze module leeft in de lazy mpp-chunk). Boodschappen in het Engels (dienstlaag-
 *  conventie), mét de handelingshint — die tekst ziet de AI-/console-kant. */
export class MppUnsupportedError extends Error {
  readonly mppCode: 'MPP_LEGACY' | 'MPP_ENCRYPTED';

  constructor(code: 'MPP_LEGACY' | 'MPP_ENCRYPTED', detail: string) {
    super(`${detail} Open the file in MS Project and export it as XML (File > Save As > XML), then open that file.`);
    this.name = 'MppUnsupportedError';
    this.mppCode = code;
  }
}
