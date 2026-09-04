/**
 * Canvas → multi-page PDF-tegeling.
 *
 * Snijdt een bron-`HTMLCanvasElement` (het gerenderde rapport/Gantt) in pagina-tegels op een
 * echt papierformaat (A4/A3/A2/A1) en zet die via {@link buildImagePdf} om in één geldige multi-page
 * PDF. Puur browser (gebruikt off-screen `<canvas>`-en + `drawImage`); de PDF-bytelaag zelf is
 * dependency-loos (`src/utils/miniPdf.ts`).
 *
 * Twee modi:
 *   - `fit-width`: schaal de bron zó dat de volledige breedte op één papierbreedte past; alleen
 *     verticaal tegelen (1 kolom). Met `timelineColumns: N` wordt de bron bewust over N
 *     paginabreedtes uitgesmeerd; dán wordt de bevroren naam-strip óók hier herhaald.
 *   - `actual`: 1 pt = 1 px (honoreert de on-screen zoom 1:1); zowel horizontaal als verticaal
 *     tegelen. De linker naam-strip (`frozenColumnWidthPx`) wordt op elke volgende horizontale
 *     tegel herhaald zodat elke pagina zelfstandig leesbaar blijft.
 *
 * De tegel-/schaalwiskunde zelf staat NIET hier maar in `tileLayout.ts` — gedeeld met de
 * vector-pagineerder en met de preview (`printPreview.renderPrintPreviewPage`), zodat preview en
 * export gegarandeerd dezelfde indeling krijgen.
 */

import { buildImagePdf, type PdfImagePage } from '@/utils/miniPdf';
import { computeTileLayout, type PaperSize, type Orientation, type PaginateMode } from './tileLayout';

export interface PaginateOptions {
  paperSize: PaperSize;
  orientation: Orientation;
  mode: PaginateMode;
  /**
   * Logische (CSS-px) breedte van de broninhoud — dezelfde eenheid als `renderPrintCanvas().width`.
   * ALLE tegel-wiskunde gebeurt in deze logische eenheid; de device-pixels van het canvas
   * (`canvas.width` = logisch × devicePixelRatio) dienen alléén als high-res bron voor `drawImage`.
   */
  logicalWidth: number;
  /** Logische (CSS-px) hoogte van de broninhoud (= `renderPrintCanvas().height`). */
  logicalHeight: number;
  /** Breedte (LOGISCHE px) van de linker bevroren naam-kolom die op elke volgende horizontale tegel herhaald wordt. */
  frozenColumnWidthPx?: number;
  /**
   * Hoogte (LOGISCHE px, vanaf de bovenkant van de bron) van de kopstrook — project-kop +
   * tijdschaal — die op ELKE pagina bovenaan herhaald moet worden (issue #25 punt 1). Vul hier
   * `renderPrintCanvas().headerHeight` in.
   *
   * De ENGINE-default is 0 = niet herhalen, exact het gedrag van vóór issue #25. Let op: dat is
   * niet meer wat de gebruiker ziet — het rapportpaneel (`ReportPanel.tsx`) zet de knop
   * "kop herhalen" bewust standaard AAN en geeft hier dus standaard een hoogte > 0 door. De
   * default hier houdt alleen deze module gedragsneutraal voor andere/toekomstige aanroepers.
   */
  repeatHeaderHeightPx?: number;
  /**
   * Aantal paginabreedtes waarover de tijdlijn uitgesmeerd wordt (issue #25 punt 5). Alleen in
   * `'fit-width'`; default 1 = alles op één paginabreedte persen (oud gedrag).
   */
  timelineColumns?: number;
  /** Paginamarge in punten (rondom). Default 24. */
  marginPt?: number;
  /** JPEG-kwaliteit voor elke pagina (0..1). Default 0.9. */
  quality?: number;
  /**
   * Dest-pixels per punt op het page-canvas — hoger = scherper maar duurder. Default {@link SUPERSAMPLE}.
   * De preview kan dit op 1 zetten (goedkoper; wordt toch verkleind weergegeven); de PDF-export
   * gebruikt de default.
   */
  supersample?: number;
}

/**
 * Maak precies één pagina uit het volledige rooster.
 *
 * Dit is de STREAMENDE route: {@link paginateCanvasToPdfBytes} roept dit per pagina-index aan,
 * zet het resultaat meteen om naar JPEG en geeft het canvas daarna vrij vóór de volgende pagina —
 * zodat het piekgeheugen van een export O(1 pagina) blijft in plaats van O(rows × cols) canvassen
 * tegelijk. Bruikbaar voor elke aanroeper die pagina's één voor één wil (streamend of, zoals hier,
 * een enkele losse pagina).
 */
export function paginateCanvasToTile(
  canvas: HTMLCanvasElement,
  opts: PaginateOptions,
  pageIndex: number,
): HTMLCanvasElement | undefined {
  const layout = computeTileLayout(opts);
  const totalPages = layout.rows * layout.cols;
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= totalPages) return undefined;

  const rowIndex = Math.floor(pageIndex / layout.cols);
  const columnIndex = pageIndex % layout.cols;
  const row = layout.bodyRows[rowIndex];
  const column = layout.columns[columnIndex];
  if (!row || !column) return undefined;

  const srcScale = opts.logicalWidth > 0 ? canvas.width / opts.logicalWidth : 1;
  const pxPt = opts.supersample ?? SUPERSAMPLE;
  const pageCanvasW = Math.max(1, Math.round(layout.pageWidthPt * pxPt));
  const pageCanvasH = Math.max(1, Math.round(layout.pageHeightPt * pxPt));
  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = pageCanvasW;
  pageCanvas.height = pageCanvasH;
  const ctx = pageCanvas.getContext('2d');
  if (!ctx) throw new Error('paginateCanvasToTile: kon 2D-context niet verkrijgen');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pageCanvasW, pageCanvasH);
  for (const win of column.xWindows) {
    const destXpx = win.pageX * pxPt;
    const destWpx = win.srcW * layout.scale * pxPt;
    if (layout.repeatHeaderPx > 0) {
      drawTile(ctx, canvas, srcScale, win.srcX, 0, win.srcW, layout.repeatHeaderPx,
        destXpx, layout.marginPt * pxPt, destWpx, layout.repeatHeaderPx * layout.scale * pxPt);
    }
    drawTile(ctx, canvas, srcScale, win.srcX, row.srcY, win.srcW, row.srcH,
      destXpx, layout.bodyTopPt * pxPt, destWpx, row.srcH * layout.scale * pxPt);
  }
  ctx.fillStyle = '#999999';
  ctx.font = `${Math.round(8 * pxPt)}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${pageIndex + 1} / ${totalPages}`, (layout.pageWidthPt - layout.marginPt) * pxPt,
    (layout.pageHeightPt - layout.marginPt * 0.5) * pxPt);
  return pageCanvas;
}

/** Supersample-factor: teken op punt-resolutie × deze factor voor scherpe tekst; MediaBox blijft de echte puntmaat. */
const SUPERSAMPLE = 2;

/**
 * Tegel een bron-canvas naar multi-page PDF-bytes.
 *
 * STREAMEND: per pagina wordt precies één pagina-canvas getekend ({@link paginateCanvasToTile}),
 * meteen naar JPEG omgezet en daarna vrijgegeven (`width`/`height` op 0) vóór de volgende pagina
 * wordt getekend. Piekgeheugen aan CANVASSEN is zo O(1) in plaats van O(rows × cols).
 *
 * WAAROM DIT ZO MOET. Deze functie is de raster-TERUGVAL van de vector-export in `ReportPanel.tsx`,
 * dus ze slaat precies aan op het moment dat de vector-tak net gefaald is. Een paginalimiet is hier
 * géén optie — een export die pagina's weglaat is stil dataverlies — dus de begrenzing moet uit het
 * geheugengedrag komen. Een vorige versie bouwde eerst het VOLLEDIGE array pagina-canvassen op vóór
 * er ook maar één naar JPEG omgezet werd: op `SUPERSAMPLE = 2` is één A3-pagina-canvas ~16 MB, en
 * een A3-rapport met kopherhaling, 300 taken en `timelineColumns: 8` (20 rijen × 8 kolommen = 160
 * pagina's) hield zo ~2,5 GB tegelijk vast, synchroon op de UI-thread.
 *
 * WAT ER WÉL met het paginatotaal meegroeit zijn de JPEG-BYTES in `pdfPages` — die moeten allemaal
 * in de PDF terecht komen, dus dat is onvermijdelijk. Maar dat is een andere grootteorde: een
 * gecomprimeerde A3-pagina is honderden kB's in plaats van 16 MB, zodat hetzelfde 160-pagina-geval
 * op tientallen MB's uitkomt in plaats van gigabytes. Regressiedekking:
 * `tests/planning/check-print-raster-export-streaming.ts`.
 *
 * @returns Uint8Array met een geldige PDF 1.4 (meerdere pagina's, rij-voor-rij van boven naar
 *          onder, binnen een rij van links naar rechts).
 */
export function paginateCanvasToPdfBytes(canvas: HTMLCanvasElement, opts: PaginateOptions): Uint8Array {
  const quality = opts.quality ?? 0.9;
  const layout = computeTileLayout(opts);
  const totalPages = layout.rows * layout.cols;

  const pdfPages: PdfImagePage[] = [];
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const pageCanvas = paginateCanvasToTile(canvas, opts, pageIndex);
    // Defensief: binnen [0, totalPages) levert paginateCanvasToTile altijd een canvas — totalPages
    // komt uit dezelfde computeTileLayout die de functie intern ook gebruikt om pageIndex te toetsen.
    if (!pageCanvas) continue;
    const dataUrl = pageCanvas.toDataURL('image/jpeg', quality);
    pdfPages.push({
      jpegBytes: dataUrlToBytes(dataUrl),
      widthPt: layout.pageWidthPt,
      heightPt: layout.pageHeightPt,
      imageWidthPx: pageCanvas.width,
      imageHeightPx: pageCanvas.height,
    });
    // Canvas meteen vrijgeven: dit — en niet de JPEG-omzetting zelf — is de reden dat het
    // piekgeheugen O(1) blijft. Zonder deze twee regels blijft de backing store van elke
    // pagina tot de volgende GC-cyclus hangen en groeit het geheugen alsnog met het paginatotaal mee.
    pageCanvas.width = 0;
    pageCanvas.height = 0;
  }

  return buildImagePdf(pdfPages);
}

/**
 * Teken een bron-regio → dest-regio; klemt zodat lege/negatieve regio's overgeslagen worden.
 * De bron-argumenten (sx/sy/sw/sh) komen in LOGISCHE px binnen en worden met `srcScale`
 * (device-px per logische px) naar het feitelijke high-res canvas-raster omgezet.
 */
function drawTile(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  srcScale: number,
  sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, dw: number, dh: number,
): void {
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
  ctx.drawImage(src, sx * srcScale, sy * srcScale, sw * srcScale, sh * srcScale, dx, dy, dw, dh);
}

/** Ruwe JPEG-bytes uit een `data:image/jpeg;base64,...`-URL. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const marker = ';base64,';
  const idx = dataUrl.indexOf(marker);
  if (idx === -1) throw new Error('Onverwacht data-URL-formaat (geen base64-JPEG)');
  const binary = atob(dataUrl.slice(idx + marker.length));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
