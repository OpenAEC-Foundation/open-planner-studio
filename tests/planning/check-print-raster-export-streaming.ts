// Rasterexport-streaming: `exportRaster()` in `ReportPanel.tsx` heeft geen paginalimiet — terecht,
// een export moet compleet zijn — maar hield vóór deze batterij WEL alle `rows * cols`
// pagina-canvassen tegelijk in het geheugen vóór de omzetting naar JPEG. Op `SUPERSAMPLE = 2` is
// één A3-pagina-canvas ~16 MB; 300 taken met `timelineColumns: 8` (160 pagina's) kwam zo op
// ~2,5 GB piekgeheugen, synchroon op de UI-thread. Extra venijnig omdat de raster-tak de `catch`-
// TERUGVAL van de vector-export is: hij slaat precies aan als de vector-tak net gefaald is.
//
// `paginateCanvasToPdfBytes` (`src/services/print/paginate.ts`) pagineert nu STREAMEND: per pagina
// precies één pagina-canvas (via `paginateCanvasToTile`), meteen naar JPEG omgezet, daarna
// vrijgegeven (`width`/`height` op 0) vóór de volgende pagina getekend wordt.
//
// WAT DEZE BATTERIJ WEL EN NIET DEKT. Er is geen jsdom/`node-canvas` in dit project (zie
// `domShim.ts`), dus een echt `HTMLCanvasElement` met een werkende 2D-context en `toDataURL` bestaat
// hier niet. Deze batterij stubt daarom `document.createElement('canvas')` met een minimale
// fake-canvas die precies twee dingen bijhoudt die de echte bug/fix bepalen: (1) hoeveel
// pagina-canvassen tegelijk "leven" (`width > 0 && height > 0`) op enig moment tijdens de export,
// en (2) hoeveel er in totaal aangemaakt worden. De 2D-context zelf is een no-op-proxy (tekenen
// zelf wordt hier niet geverifieerd — dat doet `check-print-report.ts` al via een opnemende Draw2D
// op de renderer, een andere laag). Wat NIET geverifieerd wordt: het werkelijke geheugengedrag van
// een browser-`HTMLCanvasElement`/GC, en dat de geproduceerde JPEG-bytes zelf een geldig beeld zijn
// (de fake-canvas levert vaste, niet-decodeerbare bytes — `buildImagePdf` valideert die verder ook
// niet, zolang `imageWidthPx`/`imageHeightPx` expliciet meegegeven worden, wat `paginateCanvasToTile`
// altijd doet).

import { paginateCanvasToPdfBytes } from '@/services/print/paginate';
import { computeTileLayout } from '@/services/print/tileLayout';

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };

// ── Fake canvas + no-op 2D-contextproxy ───────────────────────────────────────────────────────

interface Tracker {
  created: number;
  alive: number;
  peakAlive: number;
}

function makeFakeCtx(): CanvasRenderingContext2D {
  const store: Record<string, unknown> = {};
  const noop = () => undefined;
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      return noop;
    },
    set(target, prop, value) {
      target[prop as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const FAKE_JPEG_B64 = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03]).toString('base64');

class FakeCanvas {
  private _w = 0;
  private _h = 0;
  constructor(private readonly tracker: Tracker) { tracker.created++; }
  get width(): number { return this._w; }
  set width(v: number) { this.resize(v, this._h); }
  get height(): number { return this._h; }
  set height(v: number) { this.resize(this._w, v); }
  private resize(w: number, h: number): void {
    const wasAlive = this._w > 0 && this._h > 0;
    this._w = w;
    this._h = h;
    const isAlive = this._w > 0 && this._h > 0;
    if (isAlive && !wasAlive) {
      this.tracker.alive++;
      if (this.tracker.alive > this.tracker.peakAlive) this.tracker.peakAlive = this.tracker.alive;
    } else if (!isAlive && wasAlive) {
      this.tracker.alive--;
    }
  }
  getContext(kind: string): CanvasRenderingContext2D | null {
    return kind === '2d' ? makeFakeCtx() : null;
  }
  toDataURL(): string {
    return `data:image/jpeg;base64,${FAKE_JPEG_B64}`;
  }
}

// ── Scenario: een A4-portret-bron die met mode 'actual' over meerdere rijen ÉN kolommen tegelt ──
// (dus rows > 1 en cols > 1 — het scenario waarin de oude implementatie `rows * cols` canvassen
// tegelijk vasthield).

const opts = {
  paperSize: 'a4' as const,
  orientation: 'portrait' as const,
  mode: 'actual' as const,
  logicalWidth: 2_000,
  logicalHeight: 2_500,
  frozenColumnWidthPx: 100,
};

const layout = computeTileLayout(opts);
ok(layout.rows >= 2, `testscenario tegelt verticaal over meerdere pagina's (got rows=${layout.rows})`);
ok(layout.cols >= 2, `testscenario tegelt horizontaal over meerdere pagina's (got cols=${layout.cols})`);
const expectedTotalPages = layout.rows * layout.cols;

{
  const tracker: Tracker = { created: 0, alive: 0, peakAlive: 0 };
  const originalDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document: { createElement: (tag: string) => unknown } }).document = {
    createElement(tag: string) {
      if (tag !== 'canvas') throw new Error(`onverwacht element: ${tag}`);
      return new FakeCanvas(tracker);
    },
  };

  // De bron ("het gerenderde rapport") zelf: nooit aangemaakt via createElement, dus telt niet mee
  // in de tracker. Alleen `.width` doet ertoe (voor de srcScale-berekening); de fake 2D-context
  // tekent toch niets echts.
  const sourceCanvas = { width: opts.logicalWidth * 2 } as unknown as HTMLCanvasElement;

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = paginateCanvasToPdfBytes(sourceCanvas, opts);
  } finally {
    (globalThis as { document?: unknown }).document = originalDocument;
  }

  ok(tracker.created === expectedTotalPages,
    `elke pagina van het rooster wordt aangemaakt, geen paginalimiet (got created=${tracker.created}, verwacht ${expectedTotalPages})`);
  ok(tracker.peakAlive === 1,
    `nooit meer dan één pagina-canvas tegelijk in leven — dat is de kern van de streaming-fix (got peakAlive=${tracker.peakAlive})`);
  ok(tracker.alive === 0,
    `na afloop is de laatste pagina-canvas ook weer vrijgegeven (got alive=${tracker.alive})`);

  const asLatin1 = Buffer.from(pdfBytes).toString('latin1');
  const countMatch = /\/Count (\d+)/.exec(asLatin1);
  ok(countMatch !== null && Number(countMatch[1]) === expectedTotalPages,
    `de opgebouwde PDF bevat evenveel pagina's als het rooster (got ${countMatch?.[1] ?? 'geen /Count'}, verwacht ${expectedTotalPages})`);
}

// ── Regressiehek: dezelfde toets op het scenario UIT de melding zelf — fit-width met de tijdlijn
// over 8 paginabreedtes uitgesmeerd, dus een rooster dat vér boven de preview-limiet uitkomt. Als
// een toekomstige wijziging de pagina's weer zou opsparen (of de vrijgave zou laten vallen), groeit
// `peakAlive` met het paginatotaal mee en zakt deze toets door — bij een klein rooster zou 1 nog
// toevallig kunnen kloppen.
{
  const wideOpts = {
    ...opts,
    mode: 'fit-width' as const,
    logicalWidth: 6_000,
    logicalHeight: 7_000,
    timelineColumns: 8,
  };
  const wideLayout = computeTileLayout(wideOpts);
  const widePages = wideLayout.rows * wideLayout.cols;
  ok(wideLayout.cols === 8,
    `fit-width met timelineColumns: 8 levert ook echt 8 kolommen (got cols=${wideLayout.cols})`);
  ok(widePages > expectedTotalPages,
    `groter testscenario heeft ook echt meer pagina's (got ${widePages}, vorige ${expectedTotalPages})`);

  const tracker: Tracker = { created: 0, alive: 0, peakAlive: 0 };
  const originalDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document: { createElement: (tag: string) => unknown } }).document = {
    createElement(tag: string) {
      if (tag !== 'canvas') throw new Error(`onverwacht element: ${tag}`);
      return new FakeCanvas(tracker);
    },
  };
  const sourceCanvas = { width: wideOpts.logicalWidth * 2 } as unknown as HTMLCanvasElement;
  try {
    paginateCanvasToPdfBytes(sourceCanvas, wideOpts);
  } finally {
    (globalThis as { document?: unknown }).document = originalDocument;
  }
  ok(tracker.created === widePages,
    `ook hier wordt elke pagina aangemaakt (got created=${tracker.created}, verwacht ${widePages})`);
  ok(tracker.peakAlive === 1,
    `piek blijft 1 canvas ook bij een groter rooster (got peakAlive=${tracker.peakAlive}, ${tracker.created} pagina's)`);
  ok(tracker.alive === 0,
    `en ook hier is na afloop alles vrijgegeven (got alive=${tracker.alive})`);
}

if (failures > 0) { console.log(`print-raster-export-streaming: ${failures} faalregels`); process.exit(1); }
console.log('print-raster-export-streaming: alles groen');
