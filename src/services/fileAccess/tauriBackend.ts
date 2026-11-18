import type { FileFilter, FileRef, OpenDialogOpts, OpenedFile, SaveDialogOpts, SaveOutcome } from './index';
import { basename, ensureExtension, extensionOf } from '@/utils/filePath';
import {
  isForbiddenPathError, writeUserBytesTauri, writeUserTextFileTauri, writeNewUserBytesTauri,
} from '@/services/fileAccess/atomicWrite';
import { missingTarget, type FileIdentityFs } from './fileIdentity';
import { scanForeignTargetSource, type TargetForeignScan } from '@/services/ifc/foreign/targetForeignScan';
import { compareTargetChunks, TARGET_CHUNK_BYTES, type SourceTargetContent } from './sourceTargetContent';
import type { RemnantEvent } from './ownFileReplace';

/** De bestandsidentiteit van plugin-fs (`stat`: dev en ino) voor `compareFilePaths` (#804 fixronde 1). */
export async function fileIdentityFsTauri(): Promise<FileIdentityFs> {
  const { stat } = await import('@tauri-apps/plugin-fs');
  return { stat: (path) => stat(path) };
}

/** Een geopend pad als stroom stukken van `TARGET_CHUNK_BYTES` (plugin-fs `open`/`read`/`seek`). */
interface PathChunksTauri {
  next(): Promise<Uint8Array | null>;
  seek(offset: number): Promise<void>;
  close(): Promise<void>;
}

/** plugin-fs geeft de bereikte positie terug; een afwijking is een leesfout, geen veilige doelcontrole. */
export async function seekToExactPosition(seek: (offset: number) => Promise<number>, offset: number): Promise<void> {
  const actual = await seek(offset);
  if (actual !== offset) throw new Error(`Terugspoelen mislukt: verwacht ${offset}, kreeg ${actual}`);
}

/**
 * Een bestaand pad openen als stroom van stukken van 1 MiB via plugin-fs (toegestaan via `fs:allow-home-read-recursive`,
 * dat `read-all` bevat). Elk stuk krijgt een eigen buffer: de doelscan houdt stukken vast om terug te spoelen. `seek`
 * leest opnieuw vanaf een positie. `null` uitsluitend bij bewezen ontbreken; een bestaand of onzeker pad dat niet open
 * wil, is 'unreadable'.
 */
async function openPathChunksTauri(path: string): Promise<PathChunksTauri | null | 'unreadable'> {
  const { open, stat, SeekMode } = await import('@tauri-apps/plugin-fs');
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(path, { read: true });
  } catch {
    // Alleen bewezen afwezig is een nieuw doel; geen rechten of een onzekere stat is geen vrijbrief.
    try { await stat(path); } catch (error) { if (missingTarget(error)) return null; }
    return 'unreadable';
  }
  return {
    next: async () => {
      const buffer = new Uint8Array(TARGET_CHUNK_BYTES);
      const n = await handle.read(buffer);
      return n === null || n === 0 ? null : buffer.subarray(0, n);
    },
    seek: (offset) => seekToExactPosition(n => handle.seek(n, SeekMode.Start), offset),
    close: async () => { try { await handle.close(); } catch { /* al dicht */ } },
  };
}

/**
 * Een bestaand pad als stroom lezen voor de doelcontrole (#804 fixronde 2 en 4), tot de uitkomst vaststaat (een
 * mislukte entiteit, of de tweede lezing vanaf het regel-verankerde `DATA;`, spoelt terug).
 * `null` uitsluitend bij bewezen ontbreken. Een bestaand of onzeker doel met een leesfout is 'unreadable'.
 */
export async function scanTargetPathTauri(path: string): Promise<TargetForeignScan | null> {
  const chunks = await openPathChunksTauri(path);
  if (chunks === null || chunks === 'unreadable') return chunks;
  return scanForeignTargetSource(chunks);
}

/**
 * #804, knownbug 1131 stap 1: staat op dit pad nog precies `expected`? Eerst de grootte (`stat`), dan dezelfde stukken
 * als de doelscan, byte voor byte (`compareTargetChunks`). Een pad dat tussen `stat` en `open` verdwijnt, is weg.
 */
export async function sourceTargetContentOfPathTauri(path: string, expected: Uint8Array): Promise<SourceTargetContent> {
  const { stat } = await import('@tauri-apps/plugin-fs');
  try {
    if ((await stat(path)).size !== expected.length) return 'changed';
  } catch (error) {
    return missingTarget(error) ? 'missing' : 'unreadable';
  }
  const chunks = await openPathChunksTauri(path);
  if (chunks === null) return 'missing';
  if (chunks === 'unreadable') return 'unreadable';
  try {
    return await compareTargetChunks(chunks.next, expected);
  } catch {
    return 'unreadable';
  } finally {
    await chunks.close();
  }
}

export interface TauriOpenIO {
  readTextFile(path: string): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
  /** Knownbug 1131 stap 5: een onafgeronde vervanging van dit pad afhandelen vóór het lezen (`settlePendingReplaces`). */
  settle(path: string): Promise<RemnantEvent[]>;
}

/** De bytes-of-tekstkeuze van de dialoog en neerzetten: de extensie van het pad staat in de lijst van binaire
 *  leesformaten (`binaryExtensions`). Recent kiest zelf, met `readsAsBytes` op de naam (met de IFC-terugval). */
export function readsPathAsBytes(path: string, opts: OpenDialogOpts | undefined): boolean {
  return (opts?.binaryExtensions ?? []).includes(extensionOf(path));
}

/** Lezen mislukte nadat het afhandelen van een onafgeronde vervanging iets deed: de gebeurtenissen gaan mee, zodat de
 *  melding met hun pad niet verloren gaat (`openFailureNotices`). `cause` is de oorspronkelijke leesfout. */
export class ReadAfterSettleError extends Error {
  constructor(readonly cause: unknown, readonly replaceRemnants: RemnantEvent[]) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'ReadAfterSettleError';
  }
}

/** Injecteerbare kern van de Tauri-openroute, de enige plek waar de desktop een lokaal pad leest om het te openen
 * (de dialoog, neerzetten en Recent). Eerst een onafgeronde vervanging van dat pad afhandelen (zonder herstelrecord
 * voor het pad raakt dat de projectmap niet), dan pas lezen. `asBytes` kiest de aanroeper, zoals voorheen per route
 * (`readsPathAsBytes`, of `readsAsBytes` voor Recent); binaire bronformaten lopen dus nooit via `readTextFile` en
 * houden hun oorspronkelijke bytes. */
export async function readOpenedTauriPath(path: string, asBytes: boolean, io: TauriOpenIO): Promise<OpenedFile> {
  const remnants = await io.settle(path);
  const replaceRemnants = remnants.length > 0 ? { replaceRemnants: remnants } : {};
  try {
    if (asBytes) {
      const bytes = await io.readFile(path);
      return { name: basename(path), content: '', bytes, ref: { kind: 'path', path }, ...replaceRemnants };
    }
    const content = await io.readTextFile(path);
    return { name: basename(path), content, ref: { kind: 'path', path }, ...replaceRemnants };
  } catch (error) {
    throw remnants.length > 0 ? new ReadAfterSettleError(error, remnants) : error;
  }
}

/** De dialoog kiest alleen het pad; lezen gaat via `readOpenedTauriPath` (`tauriOpenPath.ts`). */
export async function pickOpenPathTauri(filters: FileFilter[]): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ multiple: false, filters });
  return selected ? selected as string : null;
}

/**
 * De dialoogkant van beide opslaan-als-varianten: downloadmap-voorkeur, de kiezer zelf en de
 * extensienormalisatie. Alleen het wegschrijven verschilt tussen tekst en bytes, dus dat blijft
 * bij de aanroeper — één plek voor het gedrag dat de gebruiker ziet. Vult de app de extensie aan
 * en is de eindnaam niet vrij of niet toegestaan, dan opent het venster nog eens met die naam
 * (`check-save-dialog-extension.ts`); in het gewone geval blijft het één venster.
 */
async function pickSavePathTauri(
  defaultName: string, filters: FileFilter[], opts?: SaveDialogOpts,
): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  let defaultPath = defaultName;
  if (opts?.preferDownloads) {
    try {
      const { downloadDir, join } = await import('@tauri-apps/api/path');
      defaultPath = await join(await downloadDir(), defaultName);
    } catch {
      // Downloadmap onbekend/ontoegankelijk (zeldzaam) — val terug op de kale bestandsnaam,
      // net als het bestaande gedrag van elke andere export.
    }
  }
  const ext = filters[0]?.extensions[0] ?? '';
  let picked = await save({ defaultPath, filters });
  while (picked) {
    // Linux/GTK plakt de filter-extensie niet automatisch → normaliseren.
    const target = ext ? ensureExtension(picked, ext) : picked;
    // Het venster gaf toestemming (scope) en stelde de overschrijfvraag voor `picked`, niet voor `target`. Valt
    // `target` buiten de scope of bestaat hij al, dan gaat hij zelf nog een keer door het venster, ingevuld.
    if (target === picked || !(await needsOwnDialogRound(target))) return target;
    picked = await save({ defaultPath: target, filters });
  }
  return null;
}

/** Mag de app op de aangevulde naam schrijven zonder dat het venster die naam zag? Niet als plugin-fs het pad
 *  buiten de scope weigert (`exists` toetst eerst de scope) of als er al iets staat. */
async function needsOwnDialogRound(path: string): Promise<boolean> {
  const { exists } = await import('@tauri-apps/plugin-fs');
  try {
    return await exists(path);
  } catch (error) {
    if (isForbiddenPathError(error)) return true;
    throw error;
  }
}

export async function saveFileDialogTauri(
  defaultName: string, content: string, filters: FileFilter[], opts?: SaveDialogOpts,
): Promise<SaveOutcome | null> {
  const savedPath = await pickSavePathTauri(defaultName, filters, opts);
  if (!savedPath) return null;
  // #804 fixronde 1: het gekozen pad vóór het schrijven controleren (bijv. het bronbestand van een gebouwmodel).
  if (await opts?.refuseTarget?.({ kind: 'path', path: savedPath })) return null;
  await writeUserTextFileTauri(savedPath, content);
  return { ref: { kind: 'path', path: savedPath }, name: basename(savedPath) };
}

/** Binaire tegenhanger van `saveFileDialogTauri`: zelfde kiezer, `writeFile` i.p.v.
 *  `writeTextFile`. Geen `viaDownload` — op desktop bestaat die route niet. */
export async function saveBytesDialogTauri(
  defaultName: string, bytes: Uint8Array, filters: FileFilter[], opts?: SaveDialogOpts,
): Promise<SaveOutcome | null> {
  const savedPath = await pickSavePathTauri(defaultName, filters, opts);
  if (!savedPath) return null;
  if (await opts?.refuseTarget?.({ kind: 'path', path: savedPath })) return null;
  await writeUserBytesTauri(savedPath, bytes);
  return { ref: { kind: 'path', path: savedPath }, name: basename(savedPath) };
}

export async function saveToRefTauri(ref: FileRef, content: string): Promise<boolean> {
  if (ref.kind !== 'path') return false;
  await writeUserTextFileTauri(ref.path, content);
  return true;
}

/** Strikte byte-ingang: dezelfde kiezer/doelcontrole, uitsluitend exclusieve nieuwe aanmaak. */
export async function saveNewBytesDialogTauri(
  defaultName: string, bytes: Uint8Array, filters: FileFilter[], opts: SaveDialogOpts,
): Promise<SaveOutcome | null> {
  const savedPath = await pickSavePathTauri(defaultName, filters, opts);
  if (!savedPath) return null;
  if (await opts.refuseTarget?.({ kind: 'path', path: savedPath })) return null;
  await writeNewUserBytesTauri(savedPath, bytes);
  return { ref: { kind: 'path', path: savedPath }, name: basename(savedPath) };
}

export async function saveNewBytesToRefTauri(ref: FileRef, bytes: Uint8Array): Promise<boolean> {
  if (ref.kind !== 'path') return false;
  await writeNewUserBytesTauri(ref.path, bytes);
  return true;
}

export async function readFromRefTauri(ref: FileRef): Promise<string | null> {
  if (ref.kind !== 'path') return null;
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  return readTextFile(ref.path);
}

export async function readBytesFromRefTauri(ref: FileRef): Promise<Uint8Array | null> {
  if (ref.kind !== 'path') return null;
  const { readFile } = await import('@tauri-apps/plugin-fs');
  return readFile(ref.path);
}
