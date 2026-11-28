import { isTauri } from '@/utils/platform';
import i18n from '@/i18n/config';
import { dataUrlToBytes } from '@/utils/dataUrl';
import { GITHUB_REPO } from '@/services/githubRepo';

export const FEEDBACK_ENDPOINT = 'https://open-feedback-studio.pages.dev/api/feedback';
export const FEEDBACK_APP_ID = 'open-planner-studio';
export const FEEDBACK_TIMEOUT_MS = 20_000;
let timeoutMs = FEEDBACK_TIMEOUT_MS;
export function setFeedbackTimeoutForTests(ms: number | null): void {
  if (!import.meta.env.DEV) return;
  timeoutMs = ms ?? FEEDBACK_TIMEOUT_MS;
}
export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 5000;
export const FEEDBACK_IMAGE_MAX_BYTES = 900 * 1024;
const SCREENSHOT_QUALITIES = [0.9, 0.85, 0.8, 0.75];
const SCREENSHOT_SHRINK_STEP = 0.8;
const SCREENSHOT_MIN_WIDTH = 480;

import type { FeedbackType } from './feedbackDraft';
export type { FeedbackType } from './feedbackDraft';

export interface FeedbackPayload {
  type: FeedbackType;
  title: string;
  description: string;
  screenshotDataUrl: string | null;
}

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
  email: string;
}

export interface SubmitFeedbackResult {
  githubIssueUrl: string | null;
  screenshotDropped: boolean;
  screenshotBytes: number | null;
}

export interface SendResult {
  savedPath: string | null;
  githubUrl: string;
}

function buildGitHubUrl(payload: FeedbackPayload, os: string): string {
  const label = payload.type === 'bug' ? 'bug' : payload.type === 'feature' ? 'enhancement' : null;
  const typeLabel = payload.type === 'bug' ? 'Bug' : payload.type === 'feature' ? 'Feature request' : 'Question or comment';
  const locale = i18n.language;

  let body: string;
  if (payload.screenshotDataUrl) {
    body =
      `### Omschrijving\n${payload.description}\n\n` +
      `### Screenshot\n> Plak hier je screenshot met **Ctrl + V** (Cmd + V op Mac).\n\n` +
      `---\nType: ${typeLabel} · Open Planner Studio v${__APP_VERSION__} · ${os} · ${locale}`;
  } else {
    body =
      `### Omschrijving\n${payload.description}\n\n` +
      `---\nType: ${typeLabel} · Open Planner Studio v${__APP_VERSION__} · ${os} · ${locale}`;
  }

  const enc = encodeURIComponent;
  const labels = label ? `&labels=${enc(label)}` : '';
  return `https://github.com/${GITHUB_REPO}/issues/new?title=${enc(payload.title)}${labels}&body=${enc(body)}`;
}

async function getPlatform(): Promise<string> {
  if (isTauri()) {
    try {
      const { platform } = await import('@tauri-apps/plugin-os');
      return platform();
    } catch {
    }
  }
  return navigator.platform || 'unknown';
}

export function readableOsName(raw: string): string {
  const r = raw.toLowerCase();
  if (/mac|darwin/.test(r)) return 'macOS';
  if (/iphone|ipad|ios/.test(r)) return 'iOS';
  if (r.includes('android')) return 'Android';
  if (r.includes('win')) return 'Windows';
  if (r.includes('linux')) return 'Linux';
  return raw || 'unknown';
}

export interface FeedbackMeta { version: string; os: string; locale: string; }

export async function getFeedbackMeta(): Promise<FeedbackMeta> {
  return { version: __APP_VERSION__, os: readableOsName(await getPlatform()), locale: i18n.language };
}

export function isValidFeedbackEmail(email: string): boolean {
  const e = email.trim();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function feedbackUserText(title: string, description: string): string {
  const t = title.trim();
  const d = description.trim();
  return d ? `${t}\n\n${d}` : t;
}

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
function canEncodeWebp(): boolean {
  if (webpSupport === null) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpSupport;
}

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
    body = form;
  } else {
    body = JSON.stringify(fields);
    headers['Content-Type'] = 'application/json';
  }

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
      throw new FeedbackSubmitError('uncertain', errorDetail(err));
    }

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const json = await raceAbort(response.json() as Promise<unknown>, controller.signal);
        if (json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string') {
          detail = (json as { error: string }).error;
        }
      } catch { }
      throw new FeedbackSubmitError(errorKindForStatus(response.status), detail);
    }

    try {
      const json = await raceAbort(response.json() as Promise<unknown>, controller.signal);
      if (json && typeof json === 'object') data = json as typeof data;
    } catch (err) {
      throw new FeedbackSubmitError('uncertain', errorDetail(err));
    }
  } finally {
    clearTimeout(timer);
  }

  if (data.success !== true) {
    throw new FeedbackSubmitError('uncertain', typeof data.error === 'string' ? data.error : 'geen success in antwoord');
  }

  return {
    githubIssueUrl: typeof data.githubIssueUrl === 'string' && data.githubIssueUrl.startsWith('https://')
      ? data.githubIssueUrl : null,
    screenshotDropped,
    screenshotBytes: image ? image.size : null,
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const mime = dataUrl.match(/^data:(.*?);/)?.[1] ?? 'image/png';
  return new Blob([dataUrlToBytes(dataUrl)], { type: mime });
}

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
      resolve({ data: new Uint8Array(imageData.data.buffer), width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function copyScreenshotToClipboard(dataUrl: string): Promise<void> {
  if (isTauri()) {
    try {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const { Image } = await import('@tauri-apps/api/image');
      const { data, width, height } = await getRgbaFromDataUrl(dataUrl);
      const image = await Image.new(data, width, height);
      await writeImage(image);
    } catch (err) {
      console.warn('Tauri clipboard write failed:', err);
      throw err;
    }
  } else {
    const blob = dataUrlToBlob(dataUrl);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }
}

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
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `feedback-${Date.now()}.png`;
    a.click();
    return null;
  }
}

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

export async function prepareGitHubFallback(payload: FeedbackPayload): Promise<SendResult> {
  const { os } = await getFeedbackMeta();
  const url = buildGitHubUrl(payload, os);

  if (!payload.screenshotDataUrl) {
    return { savedPath: null, githubUrl: url };
  }

  try {
    await copyScreenshotToClipboard(payload.screenshotDataUrl);
  } catch {
  }

  const savedPath = await saveScreenshot(payload.screenshotDataUrl);

  return { savedPath, githubUrl: url };
}
