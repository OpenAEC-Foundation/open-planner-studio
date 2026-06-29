/**
 * Feedback-service — niet-UI-logica voor het feedback-systeem.
 *
 * Verantwoordelijkheden:
 * - GitHub-issue-URL bouwen (title, labels, body)
 * - Screenshot naar klembord kopiëren (web: ClipboardItem PNG; Tauri: raw-RGBA-weg)
 * - Screenshot opslaan als bestand (Tauri: appDataDir/feedback/; web: download-anchor)
 * - URL openen in de browser (Tauri: shell-open; web: window.open)
 *
 * KRITIEK: alle @tauri-apps/*-imports zijn DYNAMISCH en gated achter isTauri().
 */

import { isTauri } from '@/utils/platform';
import i18n from '@/i18n/config';

export const FEEDBACK_REPO = 'OpenAEC-Foundation/open-planner-studio';

export type FeedbackType = 'bug' | 'feature';

export interface FeedbackPayload {
  type: FeedbackType;
  title: string;
  description: string;
  /** Volledig geflattende PNG als dataURL (screenshot + annotaties), of null. */
  screenshotDataUrl: string | null;
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
  const label = payload.type === 'bug' ? 'bug' : 'enhancement';
  const typeLabel = payload.type === 'bug' ? 'Bug' : 'Feature request';
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
  return `https://github.com/${FEEDBACK_REPO}/issues/new?title=${enc(payload.title)}&labels=${enc(label)}&body=${enc(body)}`;
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

/**
 * Maak een PNG Blob van een dataURL.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
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

      // Converteer dataURL naar Uint8Array voor binair schrijven.
      const [, b64] = dataUrl.split(',');
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      await writeFile(filepath, bytes);
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
 * Bereid de feedback-verzending voor en geef het resultaat terug.
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
export async function sendFeedback(payload: FeedbackPayload): Promise<SendResult> {
  const os = await getPlatform();
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
