import type { FileFilter, FileRef, OpenDialogOpts, OpenedFile, SaveDialogOpts, SaveOutcome } from './index';
import { basename, ensureExtension, extensionOf } from '@/utils/filePath';
import { writeUserBytesTauri, writeUserTextFileTauri } from '@/services/fileAccess/atomicWrite';
import { missingTarget, type FileIdentityFs } from './fileIdentity';
import { scanForeignTargetSource, type TargetForeignScan } from '@/services/ifc/foreign/targetForeignScan';

/** De bestandsidentiteit van plugin-fs (`stat`: dev en ino) voor `compareFilePaths` (#804 fixronde 1). */
export async function fileIdentityFsTauri(): Promise<FileIdentityFs> {
  const { stat } = await import('@tauri-apps/plugin-fs');
  return { stat: (path) => stat(path) };
}

/**
 * Een bestaand pad als stroom lezen voor de doelcontrole (#804 fixronde 2 en 4): stukken van 1 MiB via plugin-fs
 * `open`/`read`/`seek` (toegestaan via `fs:allow-home-read-recursive`, dat `read-all` bevat), tot de uitkomst vaststaat.
 * Elk stuk krijgt een eigen buffer: de lezer houdt stukken vast om terug te spoelen. `seek` leest opnieuw vanaf een
 * positie (een mislukte entiteit, of de tweede lezing vanaf het regel-verankerde `DATA;`).
 * `null` als het bestand niet te openen is (bestaat nog niet, geen rechten): dan is het doel niet leesbaar.
 */
export async function scanTargetPathTauri(path: string): Promise<TargetForeignScan | null> {
  const { open, stat, SeekMode } = await import('@tauri-apps/plugin-fs');
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(path, { read: true });
  } catch {
    // Alleen bewezen afwezig is een nieuw doel; geen rechten of een onzekere stat is geen vrijbrief.
    try { await stat(path); } catch (error) { if (missingTarget(error)) return null; }
    return 'unreadable';
  }
  return scanForeignTargetSource({
    next: async () => {
      const buffer = new Uint8Array(1 << 20);
      const n = await handle.read(buffer);
      return n === null || n === 0 ? null : buffer.subarray(0, n);
    },
    seek: async (offset) => { await handle.seek(offset, SeekMode.Start); },
    close: async () => { try { await handle.close(); } catch { /* al dicht */ } },
  });
}

export interface TauriOpenIO {
  readTextFile(path: string): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
}

/** Injecteerbare kern van de Tauri-openroute: bewaakt vooral dat binaire bronformaten nooit via
 * `readTextFile` lopen en hun oorspronkelijke bytes dus behouden. */
export async function readOpenedTauriPath(
  path: string,
  opts: OpenDialogOpts | undefined,
  io: TauriOpenIO,
): Promise<OpenedFile> {
  const isBinary = (opts?.binaryExtensions ?? []).includes(extensionOf(path));
  if (isBinary) {
    const bytes = await io.readFile(path);
    return { name: basename(path), content: '', bytes, ref: { kind: 'path', path } };
  }
  const content = await io.readTextFile(path);
  return { name: basename(path), content, ref: { kind: 'path', path } };
}

export async function openFileDialogTauri(filters: FileFilter[], opts?: OpenDialogOpts): Promise<OpenedFile | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({ multiple: false, filters });
  if (!selected) return null;
  const path = selected as string;
  const { readTextFile, readFile } = await import('@tauri-apps/plugin-fs');
  return readOpenedTauriPath(path, opts, { readTextFile, readFile });
}

/**
 * De dialoogkant van beide opslaan-als-varianten: downloadmap-voorkeur, de kiezer zelf en de
 * extensienormalisatie. Alleen het wegschrijven verschilt tussen tekst en bytes, dus dat blijft
 * bij de aanroeper — één plek voor het gedrag dat de gebruiker ziet.
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
  const picked = await save({ defaultPath, filters });
  if (!picked) return null;
  // Linux/GTK plakt de filter-extensie niet automatisch → normaliseren.
  const ext = filters[0]?.extensions[0] ?? '';
  return ext ? ensureExtension(picked, ext) : picked;
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
