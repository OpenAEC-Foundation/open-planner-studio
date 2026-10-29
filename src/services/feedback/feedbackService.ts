/**
 * Feedback-service — niet-UI-logica voor het feedback-systeem.
 *
 * Hoofdweg: `submitFeedback()` post de melding naar Open Feedback Studio (OpenAEC). Die server
 * zet de melding in zijn dashboard en maakt zelf een GitHub-issue (met soortlabel) als de
 * beheerder de app aan een repo heeft gekoppeld. De gebruiker heeft dus geen GitHub-account nodig.
 *
 * Terugval (alleen als versturen mislukt door netwerk, server of timeout): `prepareGitHubFallback()`
 * bouwt de oude GitHub-new-issue-URL en zet een screenshot op het klembord en als bestand klaar.
 *
 * KRITIEK: alle @tauri-apps/*-imports zijn DYNAMISCH en gated achter isTauri().
 */

import { isTauri } from '@/utils/platform';
import i18n from '@/i18n/config';
import { dataUrlToBytes } from '@/utils/dataUrl';
import { GITHUB_REPO } from '@/services/githubRepo';

// ─── Open Feedback Studio: één plek voor endpoint en app-id ────────────────────
export const FEEDBACK_ENDPOINT = 'https://open-feedback-studio.pages.dev/api/feedback';
export const FEEDBACK_APP_ID = 'open-planner-studio';
/** Na deze tijd breekt het versturen af (verbinden, antwoord én lezen van de body samen). */
export const FEEDBACK_TIMEOUT_MS = 20_000;
let timeoutMs = FEEDBACK_TIMEOUT_MS;
/** Alleen in de dev-build: de browsertest zet een korte timeout, zodat hij geen 20 s wacht. */
export function setFeedbackTimeoutForTests(ms: number | null): void {
  if (!import.meta.env.DEV) return;
  timeoutMs = ms ?? FEEDBACK_TIMEOUT_MS;
}
/** Grenzen van de server voor `message` (in tekens). */
export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 5000;
/** De server neemt samen max 1 MB aan afbeeldingen; wij blijven daar ruim onder. */
export const FEEDBACK_IMAGE_MAX_BYTES = 900 * 1024;
/** Kwaliteiten die we per afmeting proberen, van hoog naar laag. */
const SCREENSHOT_QUALITIES = [0.9, 0.85, 0.8, 0.75];
/** Past het op volle resolutie niet, dan per stap deze factor smaller, tot deze minimale breedte. */
const SCREENSHOT_SHRINK_STEP = 0.8;
const SCREENSHOT_MIN_WIDTH = 480;

import type { FeedbackType } from './feedbackDraft';
export type { FeedbackType } from './feedbackDraft';

export interface FeedbackPayload {
  type: FeedbackType;
  title: string;
  description: string;
  /** Volledig geflattende PNG als dataURL (screenshot + annotaties), of null. */
  screenshotDataUrl: string | null;
}

/** Soorten fout die de dialoog vertaald toont.
 *  - `failed`: zeker niet aangekomen (5xx, geblokkeerd, of offline vóór de fetch). Alleen dan
 *    biedt de dialoog de GitHub-terugval aan.
 *  - `uncertain`: timeout of netwerkfout nadat het verzoek weg kon zijn. De server kan de melding
 *    dan toch verwerken (hij gaat door na ons afbreken), dus géén GitHub-terugval: dat zou dubbel
 *    geven. Een volgende poging die 409 krijgt, telt in de dialoog als aangekomen. */
export type FeedbackErrorKind = 'validation' | 'rateLimited' | 'duplicate' | 'failed' | 'uncertain';

export class FeedbackSubmitError extends Error {
  readonly kind: FeedbackErrorKind;
  constructor(kind: FeedbackErrorKind, detail: string) {
    super(detail);
    this.name = 'FeedbackSubmitError';
    this.kind = kind;
  }
}

export interface SubmitFeedbackInput extends FeedbackPayload {
  /** Optioneel e-mailadres voor een reactie; leeg = niet meesturen. */
  email: string;
}

export interface SubmitFeedbackResult {
  /** Het issue dat de server aanmaakte, of null (app niet aan een repo gekoppeld). Geen fout. */
  githubIssueUrl: string | null;
  /** Er was een screenshot, maar het bleef na verkleinen te groot en ging niet mee. */
  screenshotDropped: boolean;
  /** Grootte (bytes) van het meegestuurde screenshot, of null zonder screenshot. */
  screenshotBytes: number | null;
}

export interface SendResult {
  /** Pad naar het opgeslagen bestand (alleen Tauri-build), of null. */
  savedPath: string | null;
  /** Vooraf-ingevulde GitHub new-issue-URL. Door de UI geopend: pad A meteen,
   *  pad B pas nadat de gebruiker in de plak-instructie op "OK" klikt. */
  githubUrl: string;
}

/**
 * Bouw de GitHub new-issue-URL.
 * De body verschilt naargelang er een screenshot is (PAD A vs PAD B).
 */
function buildGitHubUrl(payload: FeedbackPayload, os: string): string {
  // `general` (vraag of opmerking) krijgt geen bug/enhancement-label.
  const label = payload.type === 'bug' ? 'bug' : payload.type === 'feature' ? 'enhancement' : null;
  const typeLabel = payload.type === 'bug' ? 'Bug' : payload.type === 'feature' ? 'Feature request' : 'Question or comment';
  const locale = i18n.language;

  let body: string;
  if (payload.screenshotDataUrl) {
    // PAD B — met screenshot-plak-instructie in de body
    body =
      `### Omschrijving\n${payload.description}\n\n` +
      `### Screenshot\n> Plak hier je screenshot met **Ctrl + V** (Cmd + V op Mac).\n\n` +
      `---\nType: ${typeLabel} · Open Planner Studio v${__APP_VERSION__} · ${os} · ${locale}`;
  } else {
    // PAD A — zonder screenshot-blok
    body =
      `### Omschrijving\n${payload.description}\n\n` +
      `---\nType: ${typeLabel} · Open Planner Studio v${__APP_VERSION__} · ${os} · ${locale}`;
  }

  const enc = encodeURIComponent;
  const labels = label ? `&labels=${enc(label)}` : '';
  return `https://github.com/${GITHUB_REPO}/issues/new?title=${enc(payload.title)}${labels}&body=${enc(body)}`;
}

/**
 * Haal het OS-platform op.
 * Tauri: @tauri-apps/plugin-os → platform().
 * Web: navigator.platform (beperkt, maar voldoende als fallback).
 */
async function getPlatform(): Promise<string> {
  if (isTauri()) {
    try {
      const { platform } = await import('@tauri-apps/plugin-os');
      return platform();
    } catch {
      /* terugval */
    }
  }
  return navigator.platform || 'unknown';
}

/** Leesbare naam van het besturingssysteem (Windows, macOS, Linux); anders wat er is. */
export function readableOsName(raw: string): string {
  const r = raw.toLowerCase();
  if (/mac|darwin/.test(r)) return 'macOS';
  if (/iphone|ipad|ios/.test(r)) return 'iOS';
  if (r.includes('android')) return 'Android';
  if (r.includes('win')) return 'Windows';
  if (r.includes('linux')) return 'Linux';
  return raw || 'unknown';
}

/** Wat de metaregel meestuurt. Eén bron: de dialoog toont precies dit (regel *Meegestuurd*). */
export interface FeedbackMeta { version: string; os: string; locale: string; }

export async function getFeedbackMeta(): Promise<FeedbackMeta> {
  return { version: __APP_VERSION__, os: readableOsName(await getPlatform()), locale: i18n.language };
}

/** Eenvoudige vormcontrole van een e-mailadres (de server controleert ook; max 254 tekens). */
export function isValidFeedbackEmail(email: string): boolean {
  const e = email.trim();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** De tekst die de gebruiker zelf schreef, zoals hij in `message` komt (zonder metaregel). */
export function feedbackUserText(title: string, description: string): string {
  const t = title.trim();
  const d = description.trim();
  return d ? `${t}\n\n${d}` : t;
}

/** `message` voor de server: titel, lege regel, omschrijving en een metaregel. */
export function buildFeedbackMessage(payload: Pick<FeedbackPayload, 'title' | 'description'>, os: string, locale: string): string {
  return `${feedbackUserText(payload.title, payload.description)}\n\n---\nOpen Planner Studio v${__APP_VERSION__} · ${os} · ${locale}`;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Screenshot kon niet worden geladen'));
    img.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

let webpSupport: boolean | null = null;
/** Schrijft deze browser WebP? Een canvas zonder WebP-encoder geeft stil een PNG terug. */
function canEncodeWebp(): boolean {
  if (webpSupport === null) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpSupport;
}

/**
 * Maak een screenshot klaar voor de upload, onder {@link FEEDBACK_IMAGE_MAX_BYTES}:
 * 1. volle resolutie als WebP, kwaliteit 0.9 en dalend tot 0.75;
 * 2. pas als dat niet past, stap voor stap smaller (zelfde kwaliteitsreeks per stap);
 * 3. zonder WebP-encoder dezelfde aanpak met JPEG.
 * Geeft null als het ook op de kleinste breedte niet past.
 */
export async function prepareScreenshotForUpload(dataUrl: string): Promise<Blob | null> {
  const img = await loadImage(dataUrl);
  const type = canEncodeWebp() ? 'image/webp' : 'image/jpeg';
  let width = img.width;
  for (;;) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(img.height * (width / img.width)));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // JPEG kent geen transparantie: eerst wit, zodat doorzichtige delen niet zwart worden.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of SCREENSHOT_QUALITIES) {
      const blob = await canvasToBlob(canvas, type, quality);
      if (blob && blob.size <= FEEDBACK_IMAGE_MAX_BYTES) return blob;
    }
    if (width <= SCREENSHOT_MIN_WIDTH) return null;
    width = Math.max(SCREENSHOT_MIN_WIDTH, width * SCREENSHOT_SHRINK_STEP);
  }
}

function errorDetail(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/** Laat `promise` verwerpen zodra `signal` afbreekt, ook als de onderliggende bron het signaal
 *  niet volgt (bijvoorbeeld een body-stream die stilvalt). */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('Afgebroken', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Time-out', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      v => { signal.removeEventListener('abort', onAbort); resolve(v); },
      e => { signal.removeEventListener('abort', onAbort); reject(e instanceof Error ? e : new Error(String(e))); },
    );
  });
}

function errorKindForStatus(status: number): FeedbackErrorKind {
  if (status === 400) return 'validation';
  if (status === 409) return 'duplicate';
  if (status === 429) return 'rateLimited';
  return 'failed';
}

/**
 * Verstuur de melding naar Open Feedback Studio.
 * Zonder screenshot: JSON. Met screenshot: multipart met één verkleinde afbeelding.
 * Gooit {@link FeedbackSubmitError} bij elke fout; de dialoog vertaalt `kind`.
 * Het honeypotveld `website` gaat nooit mee.
 */
export async function submitFeedback(input: SubmitFeedbackInput): Promise<SubmitFeedbackResult> {
  const meta = await getFeedbackMeta();
  const fields: Record<string, string> = {
    app: FEEDBACK_APP_ID,
    category: input.type,
    message: buildFeedbackMessage(input, meta.os, meta.locale),
    appVersion: meta.version,
  };
  const email = input.email.trim();
  if (email) fields.email = email;

  let image: Blob | null = null;
  let screenshotDropped = false;
  if (input.screenshotDataUrl) {
    try {
      image = await prepareScreenshotForUpload(input.screenshotDataUrl);
    } catch (err) {
      console.warn('Screenshot verkleinen mislukt:', err);
      image = null;
    }
    screenshotDropped = image === null;
  }

  let body: BodyInit;
  const headers: Record<string, string> = {};
  if (image) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    const ext = image.type === 'image/webp' ? 'webp' : 'jpg';
    form.append('screenshot', image, `screenshot.${ext}`);
    body = form; // de browser zet zelf de multipart-boundary
  } else {
    body = JSON.stringify(fields);
    headers['Content-Type'] = 'application/json';
  }

  // De timeout dekt het hele verzoek: verbinden, de headers én het lezen van de body. Een body
  // die stilvalt, breekt dus ook af. `raceAbort` laat ook een stream die het signaal negeert
  // stoppen.
  // Offline vóór verzenden: zeker niet aangekomen, dus niet versturen en `failed` (GitHub-terugval
  // mag). Dit moet VÓÓR de fetch: valt de verbinding pas weg tijdens het verzoek, dan kan de server
  // de melding al verwerkt hebben, en dan is het `uncertain`.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new FeedbackSubmitError('failed', 'offline vóór verzenden');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  let data: { success?: unknown; githubIssueUrl?: unknown; error?: unknown } = {};
  try {
    try {
      response = await raceAbort(
        fetch(FEEDBACK_ENDPOINT, { method: 'POST', body, headers, signal: controller.signal }),
        controller.signal,
      );
    } catch (err) {
      // De fetch is gestart: elke netwerkfout of timeout kan na het versturen van de body vallen.
      throw new FeedbackSubmitError('uncertain', errorDetail(err));
    }

    if (!response.ok) {
      // De status beslist; de body is alleen een detail voor de console.
      let detail = `HTTP ${response.status}`;
      try {
        const json = await raceAbort(response.json() as Promise<unknown>, controller.signal);
        if (json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string') {
          detail = (json as { error: string }).error;
        }
      } catch { /* geen of trage body: status volstaat */ }
      throw new FeedbackSubmitError(errorKindForStatus(response.status), detail);
    }

    try {
      const json = await raceAbort(response.json() as Promise<unknown>, controller.signal);
      if (json && typeof json === 'object') data = json as typeof data;
    } catch (err) {
      // 2xx, maar de body kwam niet (op tijd) binnen: de server kan hem verwerkt hebben.
      throw new FeedbackSubmitError('uncertain', errorDetail(err));
    }
  } finally {
    clearTimeout(timer);
  }

  if (data.success !== true) {
    // 2xx zonder `success: true`: geen bewijs van ontvangst, maar ook geen weigering.
    throw new FeedbackSubmitError('uncertain', typeof data.error === 'string' ? data.error : 'geen success in antwoord');
  }

  return {
    githubIssueUrl: typeof data.githubIssueUrl === 'string' && data.githubIssueUrl.startsWith('https://')
      ? data.githubIssueUrl : null,
    screenshotDropped,
    screenshotBytes: image ? image.size : null,
  };
}

/**
 * Maak een PNG Blob van een dataURL.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const mime = dataUrl.match(/^data:(.*?);/)?.[1] ?? 'image/png';
  return new Blob([dataUrlToBytes(dataUrl)], { type: mime });
}

/**
 * Haal raw RGBA-bytes op uit een dataURL via een offscreen canvas.
 * Dit is het formaat dat writeImage() van plugin-clipboard-manager verwacht:
 * aaneengesloten Uint8Array met [R, G, B, A, R, G, B, A, ...] in row-major
 * volgorde van boven naar beneden (= wat canvas.getImageData() levert).
 *
 * CLIPBOARD-FORMAAT: we geven RAW RGBA-bytes door aan Tauri writeImage(),
 * NIET een PNG-blob/dataURL. Reden: de Tauri plugin-clipboard-manager API
 * accepteert Uint8Array als RGBA-pixeldata (zie de typedef-example met
 * `[255, 0, 0, 255, ...]`), geen PNG-binair. Een Image-object van
 * @tauri-apps/api/image zou ook RGBA-data intern gebruiken.
 */
async function getRgbaFromDataUrl(dataUrl: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No 2D context')); return; }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      // Echte Uint8Array over dezelfde buffer (getImageData levert Uint8ClampedArray);
      // Image.new() verwacht Uint8Array | number[] | ArrayBuffer.
      resolve({ data: new Uint8Array(imageData.data.buffer), width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Kopieer de screenshot naar het klembord.
 * - Tauri: Image.new(rgba, w, h) → writeImage(image).
 * - Web: navigator.clipboard.write() met ClipboardItem PNG.
 *
 * Geëxporteerd zodat de dev-only self-test (devBridge) exact deze weg toetst.
 */
export async function copyScreenshotToClipboard(dataUrl: string): Promise<void> {
  if (isTauri()) {
    try {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const { Image } = await import('@tauri-apps/api/image');
      // KLEMBORD-FORMAAT: rauwe RGBA + afmetingen via Image.new(). Een kale
      // Uint8Array aan writeImage() wordt als ENCODED (png/ico) geïnterpreteerd
      // en kan rauwe RGBA niet decoderen — daarom een echte Image-resource.
      const { data, width, height } = await getRgbaFromDataUrl(dataUrl);
      const image = await Image.new(data, width, height);
      await writeImage(image);
    } catch (err) {
      console.warn('Tauri clipboard write failed:', err);
      throw err;
    }
  } else {
    // Web-build: ClipboardItem met PNG blob.
    const blob = dataUrlToBlob(dataUrl);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }
}

/**
 * Sla de screenshot op als bestand.
 * - Tauri: schrijf naar appDataDir/feedback/feedback-<timestamp>.png.
 * - Web: trigger een download van de PNG via een anchor.
 * @returns Het opgeslagen pad (Tauri) of null (web).
 */
async function saveScreenshot(dataUrl: string): Promise<string | null> {
  if (isTauri()) {
    try {
      const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs');
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const dir = await appDataDir();
      const feedbackDir = await join(dir, 'feedback');

      try {
        await mkdir(feedbackDir, { recursive: true });
      } catch {
        /* map bestaat al — negeren */
      }

      const filename = `feedback-${Date.now()}.png`;
      const filepath = await join(feedbackDir, filename);

      await writeFile(filepath, dataUrlToBytes(dataUrl));
      return filepath;
    } catch (err) {
      console.warn('Screenshot opslaan mislukt:', err);
      return null;
    }
  } else {
    // Web-build: browser-download.
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `feedback-${Date.now()}.png`;
    a.click();
    return null;
  }
}

/**
 * Open een URL in de standaardbrowser.
 * - Tauri: @tauri-apps/plugin-shell → open().
 * - Web: window.open().
 *
 * Geëxporteerd zodat de dialoog de GitHub-pagina pas opent op het juiste moment
 * (pad A meteen na versturen, pad B nadat de gebruiker op "OK" klikt).
 */
export async function openFeedbackUrl(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

/**
 * TERUGVAL — alleen als `submitFeedback()` mislukte door netwerk, server of timeout.
 * Bereid de oude GitHub-weg voor en geef het resultaat terug.
 * Opent ZELF de GitHub-URL NIET — dat doet de dialoog op het juiste moment
 * (pad A meteen, pad B pas na "OK"), via openFeedbackUrl().
 *
 * PAD A (geen screenshot): bouw alleen de URL.
 * PAD B (met screenshot):
 *   1. Kopieer naar klembord (Tauri: RGBA via Image.new; web: ClipboardItem).
 *   2. Sla op als bestand (Tauri: appDataDir/feedback/; web: download).
 *   3. Retourneer savedPath + githubUrl zodat de UI de plak-instructie kan tonen
 *      en de URL pas na "OK" opent.
 */
export async function prepareGitHubFallback(payload: FeedbackPayload): Promise<SendResult> {
  const { os } = await getFeedbackMeta();
  const url = buildGitHubUrl(payload, os);

  if (!payload.screenshotDataUrl) {
    // PAD A: geen screenshot — niets klaarzetten; de dialoog opent de URL meteen.
    return { savedPath: null, githubUrl: url };
  }

  // PAD B: met screenshot
  // a) Klembord
  try {
    await copyScreenshotToClipboard(payload.screenshotDataUrl);
  } catch {
    /* Klembord mislukt — doorgaan met opslaan */
  }

  // b) Opslaan als bestand (vangnet als plakken faalt)
  const savedPath = await saveScreenshot(payload.screenshotDataUrl);

  return { savedPath, githubUrl: url };
}
