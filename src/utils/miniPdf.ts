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
 * Eén pagina voor {@link buildImagePdf}: ruwe JPEG-bytes + de fysieke paginamaat in punten.
 *
 * De rasterpixel-afmetingen (`imageWidthPx`/`imageHeightPx`) zijn optioneel — worden ze
 * weggelaten, dan leest {@link buildImagePdf} ze uit de JPEG-headers (`readJpegSize`). De
 * puntmaat schaalt de JPEG pagina-vullend in de MediaBox; de rasterresolutie blijft de
 * feitelijke beeldkwaliteit (mag dus hoger zijn dan de puntmaat → scherpe tekst).
 */
export interface PdfImagePage {
  jpegBytes: Uint8Array;
  widthPt: number;
  heightPt: number;
  imageWidthPx?: number;
  imageHeightPx?: number;
}

/**
 * Lees de pixel-afmetingen uit de JPEG-headers (SOF-marker). DCTDecode-XObjects in PDF
 * moeten een /Width en /Height dragen die met de JPEG-inhoud overeenkomen; die halen we
 * hier byte-voor-byte uit de markerketen i.p.v. te vertrouwen op een externe opgave.
 */
function readJpegSize(bytes: Uint8Array): { width: number; height: number } {
  const len = bytes.length;
  if (len < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('Geen geldige JPEG (ontbrekende SOI-marker)');
  }
  let i = 2;
  while (i + 1 < len) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    let marker = bytes[i + 1];
    // Vul-bytes (0xFF) overslaan totdat we de echte markercode hebben.
    while (marker === 0xff && i + 2 < len) {
      i++;
      marker = bytes[i + 1];
    }
    i += 2;
    // Standalone markers zonder lengte-veld: SOI/EOI (D8/D9), RSTn (D0-D7), TEM (01).
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      continue;
    }
    if (i + 1 >= len) break;
    const segLen = (bytes[i] << 8) | bytes[i + 1];
    // SOF-markers dragen de afmetingen: C0-CF, behalve DHT (C4), JPG (C8) en DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (i + 6 >= len) break;
      const height = (bytes[i + 3] << 8) | bytes[i + 4];
      const width = (bytes[i + 5] << 8) | bytes[i + 6];
      return { width, height };
    }
    i += segLen;
  }
  throw new Error('Kon JPEG-afmetingen niet bepalen (geen SOF-marker gevonden)');
}

/**
 * Bouw een geldige multi-page PDF 1.4 rond een reeks pagina-vullende JPEG's.
 *
 * Object-layout (1-op-1 met de xref-tabel), voor N pagina's:
 *   1: Catalog
 *   2: Pages (/Kids [alle Page-objecten] /Count N)
 * Daarna per pagina i (0-indexed) drie objecten, base = 3 + i*3:
 *   3+i*3: Page   (MediaBox = eigen puntmaat, Resources → eigen Image, Contents → eigen stream)
 *   4+i*3: XObject /Image (DCTDecode = raw JPEG-bytes, ongewijzigd doorgegeven)
 *   5+i*3: Content-stream (tekent de image pagina-vullend met `cm`/`Do`)
 *
 * De byte-offsets voor de xref-tabel worden exact bijgeteld (PDF is binair/latin1, geen UTF-8);
 * dit deelt dezelfde offset-boekhouding als de oorspronkelijke single-page-generator.
 */
export function buildImagePdf(pages: PdfImagePage[]): Uint8Array<ArrayBuffer> {
  if (pages.length === 0) throw new Error('buildImagePdf: minstens één pagina vereist');

  const header = asciiBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const streamEnd = asciiBytes('\nendstream');
  const objTail = asciiBytes('\nendobj\n');

  const parts: Uint8Array[] = [header];
  const objectCount = 3 + pages.length * 3; // objecten 0..(2 + N*3)
  const offsets: number[] = new Array(objectCount).fill(0); // index 0 = free object
  let pos = header.length;

  function pushObject(num: number, bodies: Uint8Array[]) {
    offsets[num] = pos;
    const head = asciiBytes(`${num} 0 obj\n`);
    parts.push(head, ...bodies, objTail);
    pos += head.length + bodies.reduce((n, b) => n + b.length, 0) + objTail.length;
  }

  // Object 1: Catalog.
  pushObject(1, [asciiBytes('<< /Type /Catalog /Pages 2 0 R >>')]);

  // Object 2: Pages — verwijst naar alle Page-objecten.
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  pushObject(2, [asciiBytes(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`)]);

  // Per pagina: Page, Image XObject, Content-stream.
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageObj = 3 + i * 3;
    const imageObj = 4 + i * 3;
    const contentObj = 5 + i * 3;

    const widthPt = page.widthPt;
    const heightPt = page.heightPt;
    const size = page.imageWidthPx != null && page.imageHeightPx != null
      ? { width: page.imageWidthPx, height: page.imageHeightPx }
      : readJpegSize(page.jpegBytes);

    // Page-object: eigen MediaBox + verwijzingen naar eigen image/content.
    pushObject(pageObj, [asciiBytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}] ` +
      `/Resources << /XObject << /Im0 ${imageObj} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${contentObj} 0 R >>`
    )]);

    // Image-XObject: DCTDecode-stream met de ruwe JPEG-bytes als payload.
    const imageDict = asciiBytes(
      `<< /Type /XObject /Subtype /Image /Width ${size.width} /Height ${size.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`
    );
    pushObject(imageObj, [imageDict, page.jpegBytes, streamEnd]);

    // Content-stream: teken /Im0 pagina-vullend.
    const contentBytes = asciiBytes(
      `q\n${widthPt.toFixed(2)} 0 0 ${heightPt.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`
    );
    const contentDict = asciiBytes(`<< /Length ${contentBytes.length} >>\nstream\n`);
    pushObject(contentObj, [contentDict, contentBytes, streamEnd]);
  }

  const xrefStart = pos;
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

/**
 * Bouw een geldige PDF 1.4 rond één pagina-vullende JPEG. Dunne wrapper over
 * {@link buildImagePdf} zodat er maar één PDF-structuur/xref-implementatie bestaat.
 */
export function buildSinglePageImagePdf(image: MiniPdfImage): Uint8Array<ArrayBuffer> {
  return buildImagePdf([{
    jpegBytes: image.jpegBytes,
    widthPt: image.pageWidthPt,
    heightPt: image.pageHeightPt,
    imageWidthPx: image.imageWidthPx,
    imageHeightPx: image.imageHeightPx,
  }]);
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
