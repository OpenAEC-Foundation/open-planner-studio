import type { FileFilter, FileRef, OpenDialogOpts, OpenedFile, SaveDialogOpts, SaveOutcome } from './index';
import { extensionOf } from '@/utils/filePath';

const hasFSA = (): boolean => typeof window !== 'undefined' && 'showOpenFilePicker' in window;

/** Onze FileFilter[] → de picker `types`-vorm (accept: MIME → extensies met punt). */
function toAcceptTypes(filters: FileFilter[]): FilePickerAcceptType[] {
  return filters.map((f) => ({
    description: f.name,
    accept: { 'application/octet-stream': f.extensions.map((e) => `.${e}`) },
  }));
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Weigert de OMGEVING de schrijfactie (in plaats van de gebruiker of de schijf)?
 *
 * Chromium gooit hier `NotAllowedError` wanneer de readwrite-grant van de handle niet op
 * `granted` staat, en `SecurityError` wanneer er geen geldige gebruikersactivatie is. Beide
 * betekenen: dit pad gaat het nooit worden, probeer een andere route. `QuotaExceededError`,
 * `NotFoundError`, `NoModificationAllowedError` e.d. zijn juist ECHTE fouten (schijf vol, bestand
 * verdwenen, bestand vergrendeld) — die horen als fout gemeld te worden, niet stil omzeild.
 *
 * Bewust op `err.name` en NIET op de fouttekst: die verschilt per browser, per versie en per
 * UI-taal.
 */
function isPlatformRefusal(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
}

/**
 * Pre-check vóór we de FSA-picker openen: sommige embedded webviews (o.a. de Electron-webview
 * van de Claude-desktopapp) laten `showOpenFilePicker`/`showSaveFilePicker` gewoon bestaan, maar
 * blokkeren de feature via een permissions-policy. `document.featurePolicy.allowsFeature(...)`
 * geeft dat dan vooraf `false` — zo vermijden we de zinloze picker-flits (kiezer verschijnt, en
 * de eerstvolgende call gooit alsnog `NotAllowedError`/`SecurityError`).
 *
 * Defensief: `featurePolicy` (non-standaard, Chromium-only, en inmiddels afgebouwd ten gunste
 * van Permissions Policy) kan ontbreken — dan geven we `false` terug (niet geblokkeerd) en laat
 * de runtime-vangnetten hieronder het werk doen zodra de weigering zich daadwerkelijk voordoet.
 */
function featurePolicyBlocksFSA(): boolean {
  const fp = typeof document !== 'undefined' ? document.featurePolicy : undefined;
  if (!fp || typeof fp.allowsFeature !== 'function') return false;
  try {
    return fp.allowsFeature('file-system-access') === false;
  } catch {
    return false;
  }
}

/**
 * Gemeten 2026-07-30: in de embedded webview van de Claude-desktopapp (Electron 42 / Chrome 148)
 * bestáát de File System Access API volledig — `showSaveFilePicker`, `FileSystemWritableFileStream`
 * en `createWritable` zijn alle drie aanwezig, en OPFS-handles (die geen grant nodig hebben)
 * schrijven gewoon — maar een handle uit de bestandskiezer krijgt nooit een readwrite-grant, dus
 * `createWritable` gooit `NotAllowedError`. Feature-detectie kan dat per definitie niet zien: de
 * API bestáát, hij weigert alleen bij gebruik.
 *
 * Daarom onthouden we de eerste weigering. Vanaf dat moment gaat elke schrijfactie rechtstreeks
 * via de download-route in plaats van de gebruiker per opslagpoging een kiezer voor te schotelen
 * die tóch nergens toe leidt. Module-scope (niet per handle): het is een eigenschap van de
 * omgeving, niet van één bestand.
 */
let platformRefusesWrites = false;

/** Alleen voor tests/diagnose: is de download-terugval geactiveerd? */
export function webWriteRefusedByPlatform(): boolean {
  return platformRefusesWrites;
}

/** Alleen voor tests: zet de omgevingsdetectie terug op onbekend. */
export function resetWebWriteRefusalForTests(): void {
  platformRefusesWrites = false;
}

/**
 * Spiegelbeeld van `platformRefusesWrites`, maar voor het openen van bestanden: de picker
 * verschijnt, maar `handle.getFile()`/de permissievraag gooit `NotAllowedError`/`SecurityError`
 * (zelfde omgeving, zelfde policy-blokkade). Zodra dat één keer gebeurt, slaat elke volgende
 * open-poging de kansloze picker over en gaat meteen naar `openViaInput`.
 */
let platformRefusesReads = false;

/** Alleen voor tests/diagnose: is de input-terugval voor openen geactiveerd? */
export function webReadRefusedByPlatform(): boolean {
  return platformRefusesReads;
}

/** Alleen voor tests: zet de openen-detectie terug op onbekend. */
export function resetWebReadRefusalForTests(): void {
  platformRefusesReads = false;
}

// ---- Fallback (Firefox/Safari): <input type=file> + blob-download ----

function isBinaryName(name: string, opts?: OpenDialogOpts): boolean {
  return (opts?.binaryExtensions ?? []).includes(extensionOf(name));
}

function openViaInput(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',');
    input.addEventListener('cancel', () => resolve(null));
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      if (isBinaryName(file.name, opts)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        resolve({ name: file.name, content: '', bytes, ref: null });
        return;
      }
      const content = await file.text();
      resolve({ name: file.name, content, ref: null });
    };
    input.click();
  });
}

function downloadBlob(name: string, content: string): void {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Publieke web-backend ----

export async function openFileDialogWeb(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  // Twee vangnetten tegen een policy-geblokkeerde FSA (gemeten in de Claude-desktopapp-webview,
  // zie `featurePolicyBlocksFSA`): vooraf de picker-flits vermijden als de policy het al meldt,
  // én — als de policy niets zegt of zich vergist — de doorlopende poging alsnog opvangen.
  if (hasFSA() && !platformRefusesReads && !featurePolicyBlocksFSA()) {
    try {
      const [handle] = await window.showOpenFilePicker!({ multiple: false, types: toAcceptTypes(filters) });
      const file = await handle.getFile();
      if (isBinaryName(file.name, opts)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        return { name: file.name, content: '', bytes, ref: { kind: 'handle', handle } };
      }
      const content = await file.text();
      return { name: file.name, content, ref: { kind: 'handle', handle } };
    } catch (err) {
      // Annuleren blijft `null` — geen tweede picker via de input-terugval.
      if (isAbort(err)) return null;
      // De omgeving (niet de gebruiker) weigert: dit gebeurt vóórdat er inhoud gelezen is
      // (`getFile`/de impliciete permissievraag daarvóór), dus er is niets om kwijt te raken.
      // Eenmalig terugvallen op de input-picker, en onthouden voor volgende keren.
      if (isPlatformRefusal(err)) {
        platformRefusesReads = true;
        return openViaInput(filters, opts);
      }
      throw err;
    }
  }
  return openViaInput(filters, opts);
}

export async function saveFileDialogWeb(
  defaultName: string, content: string, filters: FileFilter[], opts?: SaveDialogOpts,
): Promise<SaveOutcome | null> {
  // Zelfde policy-blokkade kan hier ook optreden (`showSaveFilePicker` bestaat, `createWritable`
  // weigert) — de catch hieronder ving dat al af via `platformRefusesWrites`/de download-route,
  // maar de featurePolicy-precheck bespaart ook hier de nutteloze picker-flits.
  if (hasFSA() && !platformRefusesWrites && !featurePolicyBlocksFSA()) {
    try {
      // `startIn: 'downloads'` is een Chromium-uitbreiding op de FSA-spec (well-known directory) —
      // niet-Chromium browsers negeren een onbekende optie stilzwijgend, dus dit is veilig overal.
      const handle = await window.showSaveFilePicker!({
        suggestedName: defaultName,
        types: toAcceptTypes(filters),
        ...(opts?.preferDownloads ? { startIn: 'downloads' as const } : {}),
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      const file = await handle.getFile();
      return { ref: { kind: 'handle', handle }, name: file.name };
    } catch (err) {
      // Annuleren is geen fout — en mag dus ook geen download opleveren.
      if (isAbort(err)) return null;
      // Echte fout (schijf vol, bestand verdwenen/vergrendeld, geblokkeerd bestandstype): doorgeven,
      // zodat de aanroeper hem als fout meldt. Alleen een omgevingsweigering valt terug.
      if (!isPlatformRefusal(err)) throw err;
      platformRefusesWrites = true;
    }
  }
  // Terugval: download. Geen herbruikbare ref — dit is de enige route die in élke omgeving werkt,
  // dus het bestand raakt hoe dan ook bij de gebruiker. `viaDownload` laat de aanroeper dat zeggen.
  downloadBlob(defaultName, content);
  return { ref: null, name: defaultName, viaDownload: true };
}

export async function saveToRefWeb(ref: FileRef, content: string): Promise<boolean> {
  if (ref.kind !== 'handle') return false;
  // Weet de omgeving al dat schrijven via handles hier niet kan? Dan de permissievraag overslaan:
  // die levert alleen een prompt op die tóch nergens toe leidt. `false` stuurt de aanroeper naar
  // `saveFileDialog`, die dan meteen de download-route pakt.
  if (platformRefusesWrites) return false;
  const { handle } = ref;
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
  // In-place opslaan vereist readwrite; showOpenFilePicker geeft alleen read (spec §3.2).
  try {
    if ((await handle.queryPermission?.(opts)) !== 'granted') {
      if ((await handle.requestPermission?.(opts)) !== 'granted') return false;
    }
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch (err) {
    // Weigert de omgeving (niet de gebruiker) het schrijven, onthoud dat dan: anders krijgt de
    // gebruiker bij élke opslagpoging eerst een permissieprompt en dan een bestandskiezer, om
    // vervolgens alsnog in de download-terugval te landen. Andere fouten blijven `false` geven —
    // net als voorheen valt de aanroeper dan terug op "opslaan als", wat bij een verdwenen of
    // vergrendeld bestand precies de juiste uitweg is.
    if (isPlatformRefusal(err)) platformRefusesWrites = true;
    return false;
  }
}

/** Promptvrije browser-precheck voor de daadwerkelijke AutoSave-timer. */
export async function canWriteToRefWithoutPromptWeb(ref: FileRef): Promise<boolean> {
  if (ref.kind !== 'handle' || platformRefusesWrites) return false;
  try {
    return (await ref.handle.queryPermission?.({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

/** Timerpad: geen `requestPermission`, geen picker en geen download-terugval. */
export async function saveToRefWithoutPromptWeb(ref: FileRef, content: string): Promise<boolean> {
  if (!await canWriteToRefWithoutPromptWeb(ref) || ref.kind !== 'handle') return false;
  try {
    const writable = await ref.handle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch (err) {
    if (isPlatformRefusal(err)) platformRefusesWrites = true;
    return false;
  }
}

/**
 * Gedeelde permissie-dans voor een leesactie op een handle (T11, T2-kwaliteitsreview-agenda
 * stap 0 b): `readFromRefWeb`/`readBytesFromRefWeb` waren tot deze refactor twee bijna-identieke
 * kopieën van dezelfde read-grant-aanvraag, alleen verschillend in hoe ze de uiteindelijke `File`
 * naar het resultaat vertalen (`.text()` vs. `new Uint8Array(await .arrayBuffer())`). `extract`
 * draagt dat verschil; de rest (kind-guard, queryPermission/requestPermission, try/catch → `null`)
 * blijft één plek.
 *
 * Geen `openViaInput`-terugval hier: een handle-ref komt uit "recente bestanden" en `<input
 * type=file>` levert geen handle op om te heronthouden — een nieuwe kiezer zou een compleet
 * andere UX zijn dan "dit recente bestand heropenen". In een omgeving die FSA-reads blokkeert
 * (zie `featurePolicyBlocksFSA`/`platformRefusesReads`) kan een handle-ref dus per definitie
 * nooit gelezen worden; de bestaande stille `null`-afhandeling (aanroepers verwijderen de entry
 * dan gewoon uit de recente-bestandenlijst) is voor dát geval het juiste gedrag.
 */
async function readRefWeb<T>(ref: FileRef, extract: (file: File) => Promise<T>): Promise<T | null> {
  if (ref.kind !== 'handle') return null;
  const { handle } = ref;
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'read' };
  try {
    if ((await handle.queryPermission?.(opts)) !== 'granted') {
      if ((await handle.requestPermission?.(opts)) !== 'granted') return null;
    }
    const file = await handle.getFile();
    return await extract(file);
  } catch {
    return null;
  }
}

export function readFromRefWeb(ref: FileRef): Promise<string | null> {
  return readRefWeb(ref, (file) => file.text());
}

export function readBytesFromRefWeb(ref: FileRef): Promise<Uint8Array | null> {
  return readRefWeb(ref, async (file) => new Uint8Array(await file.arrayBuffer()));
}
