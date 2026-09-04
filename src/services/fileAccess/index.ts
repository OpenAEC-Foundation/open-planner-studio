import { isTauri } from '@/utils/platform';
import {
  openFileDialogTauri, saveFileDialogTauri, saveToRefTauri, readFromRefTauri, readBytesFromRefTauri,
} from './tauriBackend';
import {
  openFileDialogWeb, saveFileDialogWeb, saveToRefWeb, saveToRefWithoutPromptWeb, canWriteToRefWithoutPromptWeb, readFromRefWeb, readBytesFromRefWeb,
} from './webBackend';

/** Bestandsfilter (naam + extensies zonder punt), zoals de bestaande dialoog-aanroepen. */
export interface FileFilter {
  name: string;
  extensions: string[];
}

/**
 * Opake verwijzing naar een bestand als opslaan-doel (spec §3.1).
 * - `path`   : Tauri — echt OS-pad; herbruikbaar voor in-place opslaan.
 * - `handle` : Chromium-web — FileSystemFileHandle; herbruikbaar voor in-place opslaan.
 * Fallback-web (Firefox/Safari) heeft geen herbruikbare ref → `null`.
 */
export type FileRef =
  | { kind: 'path'; path: string }
  | { kind: 'handle'; handle: FileSystemFileHandle };

export interface OpenedFile {
  name: string;
  /** Tekstinhoud; bij een binair formaat (opts.binaryExtensions) leeg — gebruik dan `bytes`. */
  content: string;
  bytes?: Uint8Array;
  ref: FileRef | null;
}

export interface OpenDialogOpts {
  /** Extensies (zonder punt, lowercase) die als bytes gelezen moeten worden i.p.v. tekst. */
  binaryExtensions?: string[];
}

export interface SaveOutcome {
  ref: FileRef | null;
  name: string;
  /**
   * Het bestand is via de browser-download bij de gebruiker gekomen in plaats van naar de gekozen
   * locatie geschreven — omdat de omgeving geen File System Access-schrijfrechten geeft (embedded
   * webviews) of de API helemaal niet heeft (Firefox/Safari). Het opslaan is dus GESLAAGD, maar het
   * bestand staat in de downloadmap en niet waar de gebruiker het aanwees. De aanroeper meldt dat.
   */
  viaDownload?: boolean;
}

/** Capability-vlag voor UI-beslissingen (recents tonen/verbergen). */
export function supportsHandles(): boolean {
  return isTauri() || (typeof window !== 'undefined' && 'showOpenFilePicker' in window);
}

/** Openen via picker/input. `null` = geannuleerd. */
export function openFileDialog(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  return isTauri() ? openFileDialogTauri(filters, opts) : openFileDialogWeb(filters, opts);
}

/** Opslaan-als / export via picker. `null` = geannuleerd. */
export function saveFileDialog(defaultName: string, content: string, filters: FileFilter[]): Promise<SaveOutcome | null> {
  return isTauri() ? saveFileDialogTauri(defaultName, content, filters) : saveFileDialogWeb(defaultName, content, filters);
}

/** In-place opslaan naar een bestaande ref. `false` als onmogelijk (fallback-web of geweigerde
 *  permissie) → de aanroeper valt terug op `saveFileDialog`. */
export function saveToRef(ref: FileRef, content: string): Promise<boolean> {
  return isTauri() ? saveToRefTauri(ref, content) : saveToRefWeb(ref, content);
}

/** Stille precheck voor timerwerk: browser-FSA mag hier nooit permissie vragen. */
export function canWriteToRefWithoutPrompt(ref: FileRef): Promise<boolean> {
  return isTauri() ? Promise.resolve(ref.kind === 'path') : canWriteToRefWithoutPromptWeb(ref);
}

/** Schrijf naar een bestaand doel zonder dialoog, download-terugval of permissieprompt. */
export function saveToRefWithoutPrompt(ref: FileRef, content: string): Promise<boolean> {
  return isTauri() ? saveToRefTauri(ref, content) : saveToRefWithoutPromptWeb(ref, content);
}

/** Inhoud van een bewaarde ref herlezen (recents heropenen). `null` bij fout/geweigerd. */
export function readFromRef(ref: FileRef): Promise<string | null> {
  return isTauri() ? readFromRefTauri(ref) : readFromRefWeb(ref);
}

/** Bytes van een bewaarde ref herlezen (recents met een binair formaat). `null` bij fout/geweigerd. */
export function readBytesFromRef(ref: FileRef): Promise<Uint8Array | null> {
  return isTauri() ? readBytesFromRefTauri(ref) : readBytesFromRefWeb(ref);
}
