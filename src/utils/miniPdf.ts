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

export interface PdfImagePage {
  jpegBytes: Uint8Array;
  widthPt: number;
  heightPt: number;
  imageWidthPx?: number;
  imageHeightPx?: number;
}

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
    while (marker === 0xff && i + 2 < len) {
      i++;
      marker = bytes[i + 1];
    }
    i += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      continue;
    }
    if (i + 1 >= len) break;
    const segLen = (bytes[i] << 8) | bytes[i + 1];
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

export function buildImagePdf(pages: PdfImagePage[]): Uint8Array<ArrayBuffer> {
  if (pages.length === 0) throw new Error('buildImagePdf: minstens één pagina vereist');

  const header = asciiBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const streamEnd = asciiBytes('\nendstream');
  const objTail = asciiBytes('\nendobj\n');

  const parts: Uint8Array[] = [header];
  const objectCount = 3 + pages.length * 3;
  const offsets: number[] = new Array(objectCount).fill(0);
  let pos = header.length;

  function pushObject(num: number, bodies: Uint8Array[]) {
    offsets[num] = pos;
    const head = asciiBytes(`${num} 0 obj\n`);
    parts.push(head, ...bodies, objTail);
    pos += head.length + bodies.reduce((n, b) => n + b.length, 0) + objTail.length;
  }

  pushObject(1, [asciiBytes('<< /Type /Catalog /Pages 2 0 R >>')]);

  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  pushObject(2, [asciiBytes(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`)]);

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

    pushObject(pageObj, [asciiBytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}] ` +
      `/Resources << /XObject << /Im0 ${imageObj} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${contentObj} 0 R >>`
    )]);

    const imageDict = asciiBytes(
      `<< /Type /XObject /Subtype /Image /Width ${size.width} /Height ${size.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`
    );
    pushObject(imageObj, [imageDict, page.jpegBytes, streamEnd]);

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

const DPI = 96;

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
