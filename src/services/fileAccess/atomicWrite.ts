/**
 * Schrijf-en-vervang voor bestanden die de app zelf in `appDataDir` beheert, en —
 * onderaan — voor de projectbestanden van de gebruiker.
 * `writeTextFile` truncate't het doelbestand vóórdat het schrijft, dus een crash midden in de
 * schrijfactie laat een AFGEKAPT bestand achter. Daarom eerst naar `<naam><tmpSuffix>`, dan
 * `rename` over het doel.
 *
 * Een atomaire schrijf-primitief kent `plugin-fs` niet; `rename` is het beste wat er is. Die mapt
 * op `std::fs::rename`, en binnen dezelfde map (dus gegarandeerd hetzelfde volume) is dat een
 * atomaire vervanging op zowel POSIX als Windows. Na een crash staat er dus óf het complete oude,
 * óf het complete nieuwe bestand — nooit een halve.
 *
 * Wat dit NIET afdekt: er is geen `fsync`/flush in `plugin-fs`, dus bij stroomuitval of een
 * kernel-panic kan de rename op sommige bestandssystemen vóór de data landen. Tegen een app-crash
 * dekt het wel volledig.
 */

import { generateId } from '@/utils/id';

/** De drie bestandsoperaties die de schrijf-en-vervang nodig heeft — injecteerbaar voor tests. */
export interface AtomicWriteFs {
  writeTextFile(path: string, text: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/** Schrijf `text` naar `tmp` en vervang daarmee `target`. Mislukt de rename, dan wordt het
 *  halffabricaat opgeruimd en de fout doorgegeven; `target` blijft dan onaangeroerd. */
export async function writeViaTemp(fs: AtomicWriteFs, target: string, tmp: string, text: string): Promise<void> {
  await fs.writeTextFile(tmp, text);
  try {
    await fs.rename(tmp, target);
  } catch (err) {
    try { await fs.remove(tmp); } catch { /* al weg */ }
    throw err;
  }
}

/** Tauri-variant: `name` in `dir`, halffabricaat `name + tmpSuffix` in dezelfde map. */
export async function writeTextFileAtomic(dir: string, name: string, text: string, tmpSuffix = '.tmp'): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  await writeViaTemp(
    { writeTextFile: (p, t) => fs.writeTextFile(p, t), rename: (a, b) => fs.rename(a, b), remove: p => fs.remove(p) },
    await join(dir, name),
    await join(dir, `${name}${tmpSuffix}`),
    text,
  );
}

/** Tauri-variant voor binaire inhoud (de content-adressed XER-archiefblob van crashherstel). */
export async function writeBytesFileAtomic(dir: string, name: string, bytes: Uint8Array, tmpSuffix = '.tmp'): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  const { join } = await import('@tauri-apps/api/path');
  const target = await join(dir, name);
  const tmp = await join(dir, `${name}${tmpSuffix}`);
  // Zelfde volgorde als `writeViaTemp`: eerst het halffabricaat, dan de atomaire rename.
  await fs.writeFile(tmp, bytes);
  try {
    await fs.rename(tmp, target);
  } catch (err) {
    try { await fs.remove(tmp); } catch { /* al weg */ }
    throw err;
  }
}

// ── Gebruikersbestanden (Opslaan, Opslaan als, automatisch opslaan, export) ──────────────────────
//
// Zelfde schrijf-en-vervang, maar voor een bestand dat de GEBRUIKER beheert. Daar gelden drie
// extra randen die in appDataDir niet spelen:
//  - scope: de capability geeft schrijfrecht onder `$HOME`; buiten `$HOME` geeft de bestandskiezer
//    alleen het gekozen bestand zelf vrij, dus een halffabricaat ernaast wordt geweigerd
//    ("forbidden path"). Dan blijft alleen direct schrijven over.
//  - links: een rename zet een gewoon bestand op de plek van een symlink (het doel van de link
//    blijft dan oud), en bij een harde link houdt de andere naam de oude inhoud. Een gelinkt bestand
//    wordt daarom direct beschreven.
//  - rechten: de permissiebits van het bestaande bestand worden als aanmaakmode meegegeven (Unix).
//    De proces-umask kan die verder beperken; dit garandeert geen exact modebehoud. Eigenaar en
//    ACL's gaan bij een rename wel verloren; dat kan plugin-fs niet overzetten.
// Mislukt het vervangen zelf (bijv. Windows: het doel is geopend zonder deel-toegang), dan valt de
// route terug op direct schrijven. Deze terugvallen hebben niet de foutveiligheid van vervangen.

/** Achtervoegsel van het halffabricaat naast een gebruikersbestand. */
export const USER_FILE_TMP_SUFFIX = '.ops-save.tmp';

/** De bestandsoperaties die `replaceUserFile` nodig heeft — injecteerbaar voor tests. */
export interface UserFileFs<D> {
  lstat(path: string): Promise<{ isSymlink: boolean; nlink: number | null; mode: number | null }>;
  /** Exclusief aanmaken: weigert ieder bestaand bestand, directory of link, ook een dode symlink.
   *  Alleen een geslaagde aanmaak geeft de aanroeper eigendom voor schrijven en opruimen. */
  createNew(path: string, mode?: number): Promise<{
    write(data: D): Promise<void>;
    close(): Promise<void>;
  }>;
  write(path: string, data: D, mode?: number): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/** Een scope-weigering van plugin-fs (`Error::PathForbidden`, tekst "forbidden path: …"). */
export function isForbiddenPathError(err: unknown): boolean {
  return String(err instanceof Error ? err.message : err).includes('forbidden path');
}

/** Schrijf eerst via een exclusief aangemaakt, eigen halffabricaat; schrijf- en sluitfouten laten
 *  het doel dan onaangeroerd. Scope, gelinkte doelen en rename-fouten houden de directe terugval.
 *  Dit vergrendelt geen paden tegen latere link-/directorywissels of concurrerende doelwijzigingen. */
export async function replaceUserFile<D>(fs: UserFileFs<D>, path: string, data: D): Promise<void> {
  let info: Awaited<ReturnType<UserFileFs<D>['lstat']>> | null = null;
  try {
    info = await fs.lstat(path);
  } catch {
    // Bestaat nog niet (Opslaan als naar een nieuwe naam) of geen metarecht: geen link bekend.
  }
  if (info && (info.isSymlink || (info.nlink ?? 1) > 1)) {
    await fs.write(path, data);
    return;
  }
  // Het oude vaste pad blijft geheel met rust, ook als daar een link of een andere save staat.
  // Een verse naam voorkomt normale botsingen; createNew beslist, niet de willekeur of een lstat.
  // Een zelfstandige, korte basename laat ook lange doelnamen toe. Behoud de map letterlijk;
  // in een absoluut POSIX-pad is een backslash een geldig onderdeel van de bestandsnaam.
  const windowsPath = /^[a-z]:[\\/]|^\\\\/i.test(path);
  const lastSeparator = windowsPath ? Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) : path.lastIndexOf('/');
  const tmp = `${path.slice(0, lastSeparator + 1)}${generateId('save')}${USER_FILE_TMP_SUFFIX}`;
  const mode = info?.mode != null ? info.mode & 0o777 : undefined;
  let file: Awaited<ReturnType<UserFileFs<D>['createNew']>>;
  try {
    file = await fs.createNew(tmp, mode);
  } catch (err) {
    // Geen eigendom bij een mislukte aanmaak: niets verwijderen. Ook EEXIST is géén reden om
    // direct te schrijven (of het bestaande halffabricaat te hergebruiken).
    if (isForbiddenPathError(err)) {
      await fs.write(path, data);
      return;
    }
    throw err;
  }
  const removeOwnTemp = async () => {
    try { await fs.remove(tmp); } catch { /* eigen halffabricaat blijft mogelijk achter */ }
  };
  try {
    await file.write(data);
  } catch (err) {
    try { await file.close(); } catch { /* behoud de schrijffout */ }
    await removeOwnTemp();
    throw err;
  }
  try {
    await file.close(); // Windows: sluit de handle vóór rename/remove.
  } catch (err) {
    await removeOwnTemp();
    throw err;
  }
  try {
    await fs.rename(tmp, path);
  } catch {
    await removeOwnTemp();
    await fs.write(path, data);
  }
}

type TauriFs = typeof import('@tauri-apps/plugin-fs');

function tauriUserFileFs<D>(
  fs: TauriFs, write: (path: string, data: D, options?: { mode: number }) => Promise<void>,
  encode: (data: D) => Uint8Array,
): UserFileFs<D> {
  return {
    lstat: p => fs.lstat(p),
    createNew: async (p, mode) => {
      const file = await fs.open(p, { read: false, write: true, createNew: true, ...(mode === undefined ? {} : { mode }) });
      return {
        write: async data => {
          const bytes = encode(data);
          let offset = 0;
          // De vastgelegde Rust-plugin gebruikt File::write, niet write_all: korte writes afmaken.
          while (offset < bytes.length) {
            const written = await file.write(bytes.subarray(offset));
            if (!Number.isInteger(written) || written <= 0 || written > bytes.length - offset) {
              throw new Error('Incomplete temporary file write');
            }
            offset += written;
          }
        },
        close: () => file.close(),
      };
    },
    write: (p, data, mode) => write(p, data, mode === undefined ? undefined : { mode }),
    rename: (a, b) => fs.rename(a, b),
    remove: p => fs.remove(p),
  };
}

/** Tauri: een tekstbestand van de gebruiker veilig vervangen (zie `replaceUserFile`). */
export async function writeUserTextFileTauri(path: string, text: string): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  await replaceUserFile(tauriUserFileFs<string>(fs, (p, t, o) => fs.writeTextFile(p, t, o), t => new TextEncoder().encode(t)), path, text);
}

/** Tauri: een binair bestand van de gebruiker (PDF-export) veilig vervangen. */
export async function writeUserBytesTauri(path: string, bytes: Uint8Array): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  await replaceUserFile(tauriUserFileFs<Uint8Array>(fs, (p, b, o) => fs.writeFile(p, b, o), b => b), path, bytes);
}
