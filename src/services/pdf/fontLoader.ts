import { ARABIC_REPORT_FAMILY, ARABIC_REPORT_UNICODE_RANGE, CUSTOM_REPORT_FAMILY, REPORT_FONTS, type ReportFontChoice, type ReportFontId } from './reportFont';
import { getCustomFont, type CustomFontRecord } from './customFontStore';
import { assembleReportMeasureFonts, createReportTextMetrics, type ReportFontkitFont, type ReportTextMetrics } from './reportTextMeasure';
import { createCanvasTextMetrics } from './canvasTextMetrics';

const FONT_URLS = import.meta.glob<string>('./fonts/*.ttf', { query: '?url', import: 'default', eager: true });

function fontUrl(file: string): string {
  const url = FONT_URLS[`./fonts/${file}`];
  if (!url) throw new Error(`Gevendord font ontbreekt: ${file}`);
  return url;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font laden mislukt (${res.status}): ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

const byteCache = new Map<string, Promise<Uint8Array>>();

function cachedBytes(file: string): Promise<Uint8Array> {
  let pending = byteCache.get(file);
  if (!pending) {
    pending = fetchBytes(fontUrl(file));
    pending.catch(() => { byteCache.delete(file); });
    byteCache.set(file, pending);
  }
  return pending;
}

function customBytes(font: CustomFontRecord, weight: 400 | 700): Uint8Array {
  return weight === 700 ? font.bold ?? font.regular : font.regular;
}

async function requireCustomFont(): Promise<CustomFontRecord> {
  const font = await getCustomFont();
  if (!font) throw new Error('Eigen lettertype ontbreekt');
  return font;
}

export function getReportFontBytes(id: ReportFontChoice, weight: 400 | 700): Promise<Uint8Array> {
  if (id === 'custom') return requireCustomFont().then(font => customBytes(font, weight));
  const { files } = REPORT_FONTS[id];
  return cachedBytes(weight === 700 ? files.bold : files.regular);
}

export function getInterFontBytes(weight: 400 | 700): Promise<Uint8Array> {
  return getReportFontBytes('inter', weight);
}

const ARABIC_FILES = { regular: 'NotoSansArabic-Regular.ttf', bold: 'NotoSansArabic-Bold.ttf' } as const;

export function getArabicFontBytes(weight: 400 | 700): Promise<Uint8Array> {
  return cachedBytes(weight === 700 ? ARABIC_FILES.bold : ARABIC_FILES.regular);
}

interface FaceSpec {
  family: string;
  urls: { regular: string; bold: string };
  unicodeRange?: string;
  sample?: string;
}

const ARABIC_FACES: FaceSpec = {
  family: ARABIC_REPORT_FAMILY, urls: { regular: fontUrl(ARABIC_FILES.regular), bold: fontUrl(ARABIC_FILES.bold) }, unicodeRange: ARABIC_REPORT_UNICODE_RANGE, sample: '\u0627\u0628',
};

const faceLoads = new Map<string, Promise<void>>();

function ensureFaces(key: string, { family, urls, unicodeRange, sample }: FaceSpec): Promise<void> {
  let pending = faceLoads.get(key);
  if (pending) return pending;
  const style = document.createElement('style');
  style.dataset.opsReportFont = key;
  style.textContent = ([[urls.regular, 400], [urls.bold, 700]] as const).map(([url, weight]) => (
    `@font-face { font-family: "${family}"; src: url("${url}") format("truetype"); `
    + `font-weight: ${weight}; font-style: normal; font-display: block;${unicodeRange ? ` unicode-range: ${unicodeRange};` : ''} }`
  )).join('\n');
  document.head.appendChild(style);
  pending = (async () => {
    const [regular, bold] = await Promise.all([
      document.fonts.load(`9px "${family}"`, sample),
      document.fonts.load(`bold 9px "${family}"`, sample),
    ]);
    if (regular.length === 0 || bold.length === 0) throw new Error(`Letter '${key}' niet geladen`);
  })();
  pending.catch(() => {
    faceLoads.delete(key);
    style.remove();
  });
  faceLoads.set(key, pending);
  return pending;
}

function ensureReportFaces(id: ReportFontId): Promise<void> {
  const { family, files } = REPORT_FONTS[id];
  return ensureFaces(id, { family, urls: { regular: fontUrl(files.regular), bold: fontUrl(files.bold) } });
}

let customFaceUrls: { key: string; regular: string; bold: string } | null = null;

async function ensureCustomFaces(): Promise<void> {
  const font = await requireCustomFont();
  const key = `custom:${font.rev}`;
  if (customFaceUrls?.key !== key) {
    if (customFaceUrls) {
      faceLoads.delete(customFaceUrls.key);
      document.head.querySelector(`style[data-ops-report-font="${customFaceUrls.key}"]`)?.remove();
      URL.revokeObjectURL(customFaceUrls.regular);
      URL.revokeObjectURL(customFaceUrls.bold);
    }
    const toUrl = (bytes: Uint8Array) => URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'font/ttf' }));
    const regular = toUrl(font.regular);
    customFaceUrls = { key, regular, bold: font.bold ? toUrl(font.bold) : regular };
  }
  return ensureFaces(key, { family: CUSTOM_REPORT_FAMILY, urls: customFaceUrls });
}

export async function ensureReportFontLoaded(id: ReportFontChoice = 'inter'): Promise<void> {
  try {
    await Promise.all([
      ensureReportFaces('inter'),
      ...(id === 'inter' ? [] : [id === 'custom' ? ensureCustomFaces() : ensureReportFaces(id)]),
      ensureFaces('arabic', ARABIC_FACES),
    ]);
    await document.fonts.ready;
  } catch (err) {
    console.warn(`[fontLoader] Rapportletter '${id}' niet geladen; het canvas valt terug op de volgende letter in de stack:`, err);
  }
}

const metricLoads = new Map<string, Promise<ReportTextMetrics>>();

export function loadReportTextMetrics(id: ReportFontChoice = 'inter', baseDir: 'ltr' | 'rtl' = 'ltr'): Promise<ReportTextMetrics> {
  if (id === 'custom') {
    return getCustomFont().then(font => (font ? loadMetrics(`custom:${font.rev}|${baseDir}`, 'custom', baseDir) : createCanvasTextMetrics()));
  }
  return loadMetrics(`${id}|${baseDir}`, id, baseDir);
}

function loadMetrics(key: string, id: ReportFontChoice, baseDir: 'ltr' | 'rtl'): Promise<ReportTextMetrics> {
  let pending = metricLoads.get(key);
  if (pending) return pending;
  pending = (async () => {
    try {
      const [{ fontkit }, regular, bold, arabicRegular, arabicBold, interRegular, interBold] = await Promise.all([
        import('@/services/pdf/fontkit'),
        getReportFontBytes(id, 400),
        getReportFontBytes(id, 700),
        getArabicFontBytes(400),
        getArabicFontBytes(700),
        id === 'inter' ? Promise.resolve(null) : getInterFontBytes(400),
        id === 'inter' ? Promise.resolve(null) : getInterFontBytes(700),
      ]);
      const fonts = assembleReportMeasureFonts(
        bytes => fontkit.create(bytes) as unknown as ReportFontkitFont,
        { regular, bold },
        {
          interFallback: interRegular && interBold ? { regular: interRegular, bold: interBold } : undefined,
          arabic: { regular: arabicRegular, bold: arabicBold },
          baseDir,
        },
      );
      return createReportTextMetrics(fonts, createCanvasTextMetrics());
    } catch (err) {
      metricLoads.delete(key);
      console.warn(`[fontLoader] Lettermaten van '${id}' niet geladen; het papier meet met het canvas:`, err);
      return createCanvasTextMetrics();
    }
  })();
  metricLoads.set(key, pending);
  return pending;
}
