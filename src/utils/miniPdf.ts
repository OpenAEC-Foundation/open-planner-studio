/**
 * Minimale PDF-generator (geen dependency): bedt één JPEG-afbeelding pagina-vullend in
 * een geldig PDF 1.4-document in.
 *
 * Waarom zelf bouwen i.p.v. een library: het rapport is al een canvas dat we naar JPEG
 * kunnen sereren (`canvas.toDataURL('image/jpeg', …)`), en een PDF die één full-page
 * DCTDecode-afbeelding toont is een klein, goed gespecificeerd bestandsformaat — een
 * catalog + pages + page + XObject + contentstream + xref-tabel. Zie ISO 32000-1 §7.2
 * (file structure) en §7.4.8 (DCTDecode) voor de spec waar dit op leunt.
 *
 * Belangrijk: PDF is een BINAIR (byte-niveau, latin1) formaat, geen UTF-8-tekst. We
 * bouwen daarom alles op als Uint8Array-fragmenten (nooit als JS-string die we naar
 * UTF-8 zouden encoden) en tellen byte-offsets voor de xref-tabel exact bij.
 */

export interface MiniPdfImage {
  /** Ruwe JPEG-bytes (zonder data-URL-prefix). */
  jpegBytes: Uint8Array;
  /** Rasterpixel-afmetingen van de JPEG zelf (voor het /Image XObject-dict). */
  imageWidthPx: number;
  imageHeightPx: number;
  /**
   * Fysieke paginamaat in PDF-punten (1/72 inch). Losstaand van de rasterresolutie —
   * `printPreview` tekent op high-DPI-canvassen (`canvas.width = logicalWidth * devicePixelRatio`),
   * dus de puntmaat moet uit de *logische* (CSS-px, 96 DPI) afmeting komen, niet uit de rasterpixels,
   * anders wordt de pagina op een retina-scherm 2-3x te groot.
   */
  pageWidthPt: number;
  pageHeightPt: number;
}

/** Zet een ASCII/latin1-string om in bytes (géén UTF-8 — PDF-syntaxtokens zijn altijd ASCII). */
function asciiBytes(s: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Bouw een geldige PDF 1.4 rond één pagina-vullende JPEG.
 *
 * Object-layout (vast, 1-op-1 met de xref-tabel):
 *   1: Catalog
 *   2: Pages
 *   3: Page (verwijst naar 4=XObject via Resources, en 5=content-stream)
 *   4: XObject /Image (DCTDecode = raw JPEG-bytes, ongewijzigd doorgegeven)
 *   5: Content-stream (tekent object 4 pagina-vullend met de `cm`/`Do`-operatoren)
 */
export function buildSinglePageImagePdf(image: MiniPdfImage): Uint8Array<ArrayBuffer> {
  const widthPt = image.pageWidthPt;
  const heightPt = image.pageHeightPt;

  const contentStream = `q\n${widthPt.toFixed(2)} 0 0 ${heightPt.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = asciiBytes(contentStream);

  const objects: Uint8Array[] = [];

  objects[1] = asciiBytes('<< /Type /Catalog /Pages 2 0 R >>');
  objects[2] = asciiBytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects[3] = asciiBytes(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}] ` +
    `/Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`
  );
  // Object 4 (image XObject) and 5 (content stream) are built below with raw binary payloads,
  // so they are assembled directly into the file rather than as simple dict strings.

  const header = asciiBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const parts: Uint8Array[] = [header];
  const offsets: number[] = new Array(6).fill(0); // index 0 unused (free object)
  let pos = header.length;

  function pushObject(num: number, body: Uint8Array) {
    offsets[num] = pos;
    const head = asciiBytes(`${num} 0 obj\n`);
    const tail = asciiBytes('\nendobj\n');
    parts.push(head, body, tail);
    pos += head.length + body.length + tail.length;
  }

  pushObject(1, objects[1]);
  pushObject(2, objects[2]);
  pushObject(3, objects[3]);

  // Object 4: image XObject stream (raw JPEG bytes as the stream payload).
  const imageDict = asciiBytes(
    `<< /Type /XObject /Subtype /Image /Width ${image.imageWidthPx} /Height ${image.imageHeightPx} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.jpegBytes.length} >>\nstream\n`
  );
  const streamEnd = asciiBytes('\nendstream');
  offsets[4] = pos;
  {
    const head = asciiBytes('4 0 obj\n');
    parts.push(head, imageDict, image.jpegBytes, streamEnd, asciiBytes('\nendobj\n'));
    pos += head.length + imageDict.length + image.jpegBytes.length + streamEnd.length + '\nendobj\n'.length;
  }

  // Object 5: content stream.
  const contentDict = asciiBytes(`<< /Length ${contentBytes.length} >>\nstream\n`);
  offsets[5] = pos;
  {
    const head = asciiBytes('5 0 obj\n');
    parts.push(head, contentDict, contentBytes, streamEnd, asciiBytes('\nendobj\n'));
    pos += head.length + contentDict.length + contentBytes.length + streamEnd.length + '\nendobj\n'.length;
  }

  const xrefStart = pos;
  const objectCount = 6; // objects 0..5
  let xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
  for (let i = 1; i < objectCount; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const xrefBytes = asciiBytes(xref);

  const trailer = asciiBytes(
    `trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  );

  parts.push(xrefBytes, trailer);

  return concatBytes(parts);
}

/** Haal de ruwe JPEG-bytes uit een `data:image/jpeg;base64,...`-URL. */
export function jpegDataUrlToBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
  const marker = ';base64,';
  const idx = dataUrl.indexOf(marker);
  if (idx === -1) throw new Error('Onverwacht data-URL-formaat (geen base64-JPEG)');
  const base64 = dataUrl.slice(idx + marker.length);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 1 punt = 1/72 inch; de logische (CSS-px) canvasmaat is getekend op 96 DPI (zie `printPreview`). */
const DPI = 96;
const POINTS_PER_INCH = 72;

/**
 * Genereer PDF-bytes rechtstreeks vanaf een canvas (JPEG-encodering, paginavullend).
 *
 * `printPreview.renderPrintCanvas` tekent op een high-DPI-canvas: `canvas.width/height` zijn
 * rasterpixels (`logische maat * devicePixelRatio`), terwijl `canvas.style.width/height` de
 * logische CSS-pixelmaat op 96 DPI is — dezelfde maat waarop de paginaformaten (A4/A3/A1) in
 * `PAPER_SIZES` zijn gebaseerd. De paginamaat in punten moet dus uit de logische maat komen
 * (anders wordt de PDF-pagina 2-3x te groot op een retina-scherm); de rasterpixels blijven
 * gewoon de JPEG-resolutie.
 */
export function canvasToPdfBytes(canvas: HTMLCanvasElement, quality = 0.92): Uint8Array<ArrayBuffer> {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const jpegBytes = jpegDataUrlToBytes(dataUrl);
  const logicalWidthPx = parseFloat(canvas.style.width) || canvas.width;
  const logicalHeightPx = parseFloat(canvas.style.height) || canvas.height;
  return buildSinglePageImagePdf({
    jpegBytes,
    imageWidthPx: canvas.width,
    imageHeightPx: canvas.height,
    pageWidthPt: (logicalWidthPx / DPI) * POINTS_PER_INCH,
    pageHeightPt: (logicalHeightPx / DPI) * POINTS_PER_INCH,
  });
}

/**
 * Bepaal de raster-schaal (t.o.v. de logische 96-DPI-maat) voor een hoge-resolutie PDF-export,
 * onafhankelijk van het scherm van de exporterende gebruiker (`window.devicePixelRatio` varieert
 * van 1 op een headless/standaard monitor tot 2-3 op retina — daarmee alleen zou de exportkwaliteit
 * willekeurig zijn).
 *
 * Streefwaarde is een effectieve resolutie van ~`targetDpi` (200-300 DPI is scherp genoeg om
 * tekst/lijnen leesbaar te printen); begrensd door `maxMegapixels` zodat een groot papierformaat
 * (bv. A1-liggend, ±3179×2245 logische px) geen tientallen-MP-canvas oplevert die het geheugen of
 * canvas-groottelimieten van de browser raakt. `minScale` is de ondergrens zodat een zwaar begrensd
 * (zeer groot) rapport nog steeds scherper is dan de eventuele 1x-preview.
 */
export function computeHighResScale(
  logicalWidthPx: number,
  logicalHeightPx: number,
  targetDpi = 220,
  maxMegapixels = 24,
  minScale = 1.5,
): number {
  let scale = targetDpi / DPI;
  const maxPixels = maxMegapixels * 1_000_000;
  const rasterPixelsAtScale = logicalWidthPx * scale * logicalHeightPx * scale;
  if (rasterPixelsAtScale > maxPixels) {
    scale = Math.sqrt(maxPixels / (logicalWidthPx * logicalHeightPx));
  }
  return Math.max(scale, minScale);
}
