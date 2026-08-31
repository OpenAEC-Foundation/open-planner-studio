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
 * vector-pagineerder, zodat preview en export gegarandeerd dezelfde indeling krijgen.
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
  /**
   * Harde bovengrens op het aantal pagina-CANVASSEN dat {@link paginateCanvasToTiles} daadwerkelijk
   * AANMAAKT. Ontbreekt hij, dan wordt elke pagina van het rooster getekend (oud gedrag).
   *
   * WAAROM: elk pagina-canvas is een volledig `HTMLCanvasElement` op papierresolutie (A3-landscape ≈
   * 1191×842 px ≈ 4 MB RGBA). Een A3-rapport met kopherhaling, 300 taken en `timelineColumns: 8`
   * levert 20 rijen × 8 kolommen = 160 van die canvassen ≈ 640 MB — synchroon op de UI-thread, en de
   * preview hertekent bij ELKE optiewijziging. De preview toont er toch maar een handvol; met
   * `maxPages` stopt de lus met TEKENEN zodra dat aantal bereikt is.
   *
   * LET OP — het resultaat is dan bewust ONVOLLEDIG: `pages.length` kan KLEINER zijn dan
   * `rows * cols`. `rows`/`cols` blijven het VOLLEDIGE rooster rapporteren (die komen uit de pure
   * {@link computeTileLayout}, daar hoeft niets voor getekend te worden), zodat een aanroeper nog
   * steeds "pagina 5 van 160" kan tonen. Gebruik dus `rows * cols` — niet `pages.length` — als
   * paginatotaal.
   *
   * Deze optie is UITSLUITEND voor de preview. {@link paginateCanvasToPdfBytes} mag hem NIET
   * doorgeven: een export moet compleet zijn, anders ontbreken er pagina's in de PDF. Die functie
   * wist hem daarom expliciet.
   */
  maxPages?: number;
}

/** Resultaat van {@link paginateCanvasToTiles}: één canvas per pagina + paginamaat/rooster. */
export interface PaginatedTiles {
  /**
   * Eén canvas per pagina (rij-voor-rij van boven naar onder, binnen een rij van links naar rechts).
   *
   * Normaal `rows * cols` lang. Met {@link PaginateOptions.maxPages} bevat hij BEWUST alleen de
   * eerste N pagina's — de rest is nooit getekend. Wil je het paginatotaal weten, gebruik dan
   * `rows * cols` en niet `pages.length`.
   */
  pages: HTMLCanvasElement[];
  /** Papierbreedte in PDF-punten (honoreert oriëntatie). */
  pageWidthPt: number;
  /** Papierhoogte in PDF-punten (honoreert oriëntatie). */
  pageHeightPt: number;
  /** Aantal horizontale tegels. */
  cols: number;
  /** Aantal verticale tegels. */
  rows: number;
}

/** Supersample-factor: teken op punt-resolutie × deze factor voor scherpe tekst; MediaBox blijft de echte puntmaat. */
const SUPERSAMPLE = 2;

/**
 * Tegel een bron-canvas naar losse pagina-canvassen (één `HTMLCanvasElement` per pagina).
 *
 * Dit is de gedeelde pagineer-engine: zowel {@link paginateCanvasToPdfBytes} (voor de PDF-export)
 * als de rapport-preview gebruiken deze functie zodat de preview WYSIWYG-identiek is aan de export.
 *
 * Met {@link PaginateOptions.maxPages} stopt hij met TEKENEN na N pagina's: `pages.length` is dan
 * kleiner dan `rows * cols`, terwijl `rows`/`cols` het volledige rooster blijven rapporteren. Dat
 * is alleen voor de preview bedoeld — een export moet compleet zijn (zie de optie-doc).
 *
 * @returns {@link PaginatedTiles} — pagina-canvassen (rij-voor-rij van boven naar onder, binnen een
 *          rij van links naar rechts) + echte puntmaat + rooster.
 */
export function paginateCanvasToTiles(canvas: HTMLCanvasElement, opts: PaginateOptions): PaginatedTiles {
  const layout = computeTileLayout(opts);
  const {
    pageWidthPt: pageW, pageHeightPt: pageH, marginPt, scale, rows, cols,
    repeatHeaderPx, bodyTopPt, columns, bodyRows,
  } = layout;

  // Device-px per logische px: converteert een logische bron-rechthoek naar het feitelijke
  // high-res canvas-raster in de `drawImage`-bron-argumenten. `canvas.width` is logisch×dpr.
  const srcScale = opts.logicalWidth > 0 ? canvas.width / opts.logicalWidth : 1;

  const pxPt = opts.supersample ?? SUPERSAMPLE; // dest-pixels per punt op het page-canvas
  const pageCanvasW = Math.max(1, Math.round(pageW * pxPt));
  const pageCanvasH = Math.max(1, Math.round(pageH * pxPt));

  const totalPages = rows * cols;
  const pages: HTMLCanvasElement[] = [];

  // Bovengrens op het AANMAKEN van pagina-canvassen (zie {@link PaginateOptions.maxPages}). Zonder
  // grens: Infinity, zodat de vergelijking hieronder nooit aanslaat en het gedrag exact het oude is.
  // Defensief geklemd — een onzinnige (negatieve/niet-eindige) waarde mag geen halve lus opleveren.
  const maxPages = opts.maxPages === undefined || !Number.isFinite(opts.maxPages)
    ? Infinity
    : Math.max(0, Math.floor(opts.maxPages));

  let pageIndex = 0;
  // Gelabelde lus: de grens moet BEIDE lussen verlaten, anders zou hij per rij opnieuw beginnen.
  pageLoop:
  for (const row of bodyRows) {
    for (const column of columns) {
      if (pages.length >= maxPages) break pageLoop;
      pageIndex++;

      // Per pagina een NIEUW canvas (zodat de aanroeper alle pagina's tegelijk kan gebruiken).
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = pageCanvasW;
      pageCanvas.height = pageCanvasH;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) throw new Error('paginateCanvasToTiles: kon 2D-context niet verkrijgen');

      // Witte achtergrond.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvasW, pageCanvasH);

      for (const win of column.xWindows) {
        const destXpx = win.pageX * pxPt;
        const destWpx = win.srcW * scale * pxPt;

        // Kopstrook (bron y ∈ [0, repeatHeaderPx)) bovenaan de pagina herhalen — met EXACT het
        // x-venster van de body eronder, anders zou de tijdschaal niet boven de juiste dagen staan.
        if (repeatHeaderPx > 0) {
          drawTile(
            ctx, canvas, srcScale,
            win.srcX, 0, win.srcW, repeatHeaderPx,
            destXpx, marginPt * pxPt, destWpx, repeatHeaderPx * scale * pxPt,
          );
        }

        // Body-tegel: begint onder de (eventueel) herhaalde kopstrook.
        drawTile(
          ctx, canvas, srcScale,
          win.srcX, row.srcY, win.srcW, row.srcH,
          destXpx, bodyTopPt * pxPt, destWpx, row.srcH * scale * pxPt,
        );
      }

      // Paginanummer rechtsonder in de marge (grijs, ~8pt).
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#999999';
      ctx.font = `${Math.round(8 * pxPt)}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      const label = `${pageIndex} / ${totalPages}`;
      const labelX = (pageW - marginPt) * pxPt;
      const labelY = (pageH - marginPt * 0.5) * pxPt;
      ctx.fillText(label, labelX, labelY);

      pages.push(pageCanvas);
    }
  }

  return { pages, pageWidthPt: pageW, pageHeightPt: pageH, cols, rows };
}

/**
 * Tegel een bron-canvas naar multi-page PDF-bytes.
 *
 * Deelt de pagineer-engine ({@link paginateCanvasToTiles}) met de rapport-preview en zet elk
 * pagina-canvas om naar JPEG voor de PDF.
 *
 * @returns Uint8Array met een geldige PDF 1.4 (meerdere pagina's, rij-voor-rij van boven naar
 *          onder, binnen een rij van links naar rechts).
 */
export function paginateCanvasToPdfBytes(canvas: HTMLCanvasElement, opts: PaginateOptions): Uint8Array {
  const quality = opts.quality ?? 0.9;
  // `maxPages` is een PREVIEW-optie en wordt hier expliciet gewist: een export die pagina's weglaat
  // is stille dataverlies. De aanroeper deelt z'n optie-object soms met de preview, dus vertrouwen
  // op "die zet 'm hier toch niet" is niet genoeg — we wissen 'm actief.
  const { pages, pageWidthPt, pageHeightPt } = paginateCanvasToTiles(canvas, { ...opts, maxPages: undefined });

  const pdfPages: PdfImagePage[] = pages.map(pageCanvas => {
    const dataUrl = pageCanvas.toDataURL('image/jpeg', quality);
    return {
      jpegBytes: dataUrlToBytes(dataUrl),
      widthPt: pageWidthPt,
      heightPt: pageHeightPt,
      imageWidthPx: pageCanvas.width,
      imageHeightPx: pageCanvas.height,
    };
  });

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
