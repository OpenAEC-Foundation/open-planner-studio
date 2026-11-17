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
import { ByteWriteError } from './byteWrite';
import { placeFileExclusive, type PlaceFileOutcome } from './placeFileExclusive';

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

/** Het eigen halffabricaat naast `path`: `save-<id>.ops-save.tmp` in dezelfde map, elke keer een verse naam.
 * Een zelfstandige, korte basename laat ook lange doelnamen toe. Behoud de map letterlijk; in een absoluut
 * POSIX-pad is een backslash een geldig onderdeel van de bestandsnaam. `place_file.rs` herkent deze vorm
 * als eigen hulpnaam (`is_helper_name`). */
export function userFileTempPath(path: string): string {
  const windowsPath = /^[a-z]:[\\/]|^\\\\/i.test(path);
  const lastSeparator = windowsPath ? Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) : path.lastIndexOf('/');
  return `${path.slice(0, lastSeparator + 1)}${generateId('save')}${USER_FILE_TMP_SUFFIX}`;
}

/** De bestandsoperaties die `replaceUserFile` nodig heeft — injecteerbaar voor tests. */
export interface UserFileFs<D> {
  lstat(path: string): Promise<{ isSymlink: boolean; nlink: number | null; mode: number | null }>;
  /** Exclusief aanmaken en `data` erin schrijven, in één stap op één open bestand: weigert ieder
   *  bestaand bestand, directory of link, ook een dode symlink. Alleen een `OwnFileWriteError` zegt dat
   *  het bestand wél ontstond en daarna het schrijven mislukte: dan is het (onvolledige) bestand van de
   *  aanroeper en mag hij het opruimen. Elke andere fout geeft geen eigendom. */
  createNew(path: string, data: D, mode?: number): Promise<void>;
  write(path: string, data: D, mode?: number): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

/** `createNew` maakte het bestand aan, maar het schrijven daarna mislukte; `cause` is de schrijffout. */
export class OwnFileWriteError extends Error {
  constructor(readonly cause: unknown) {
    super(String(cause instanceof Error ? cause.message : cause));
    this.name = 'OwnFileWriteError';
  }
}

/** Een scope-weigering van plugin-fs (`Error::PathForbidden`, tekst "forbidden path: …"). */
export function isForbiddenPathError(err: unknown): boolean {
  return String(err instanceof Error ? err.message : err).includes('forbidden path');
}

/** Schrijf eerst via een exclusief aangemaakt, eigen halffabricaat; een schrijffout laat het doel
 *  dan onaangeroerd. Scope, gelinkte doelen en rename-fouten houden de directe terugval.
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
  const tmp = userFileTempPath(path);
  const mode = info?.mode != null ? info.mode & 0o777 : undefined;
  const removeOwnTemp = async () => {
    try { await fs.remove(tmp); } catch { /* eigen halffabricaat blijft mogelijk achter */ }
  };
  try {
    // Eén stap: de modus van het oude bestand (ook 0444) geldt pas voor latere openingen.
    await fs.createNew(tmp, data, mode);
  } catch (err) {
    // Na een geslaagde aanmaak is het halffabricaat van ons: opruimen, het doel blijft onaangeroerd.
    if (err instanceof OwnFileWriteError) {
      await removeOwnTemp();
      throw err.cause;
    }
    // Geen eigendom bij een mislukte aanmaak: niets verwijderen. Ook EEXIST is géén reden om
    // direct te schrijven (of het bestaande halffabricaat te hergebruiken).
    if (isForbiddenPathError(err)) {
      await fs.write(path, data);
      return;
    }
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
/** Begin van de schrijffout van `write_file_inner` in tauri-plugin-fs 2.5.0 (`commands.rs`). Verandert
 *  die tekst bij een upgrade, dan blijft een onvolledig eigen halffabricaat staan; het doel niet. */
export const WRITE_AFTER_CREATE_ERROR = 'failed to write bytes to file at path:';
type TauriWriteOptions = import('@tauri-apps/plugin-fs').WriteFileOptions;

/**
 * Bytes naar Tauri alleen als HELE payload (`writeFile`/`writeTextFile`), nooit in een object.
 * Tauri stuurt een kale `Uint8Array` als rauwe body; een `Uint8Array` in een object (zoals
 * `FileHandle.write` doet: `{ rid, data }`) wordt JSON met `Array.from`, één getal per byte, synchroon
 * op de hoofdthread (`process-ipc-message-fn.js` in tauri 2.12.3). Rust opent bij `write_file` met
 * de opties uit de kop `options` en schrijft met `write_all` (tauri-plugin-fs 2.5.0, `write_file_inner`).
 * Die kop moet geldige JSON zijn: onleesbare opties vallen in Rust stil terug op aanmaken en afkappen.
 */
function tauriUserFileFs<D>(fs: TauriFs, write: (path: string, data: D, options?: TauriWriteOptions) => Promise<void>): UserFileFs<D> {
  return {
    lstat: p => fs.lstat(p),
    createNew: async (p, data, mode) => {
      try {
        await write(p, data, { createNew: true, ...(mode === undefined ? {} : { mode }) });
      } catch (err) {
        // `write_file_inner` opent eerst (fout "failed to open file at path: …", of een scope-weigering)
        // en schrijft daarna met write_all; alleen die tweede fout komt na een geslaagde aanmaak.
        if (String(err instanceof Error ? err.message : err).startsWith(WRITE_AFTER_CREATE_ERROR)) throw new OwnFileWriteError(err);
        throw err;
      }
    },
    write: (p, data, mode) => write(p, data, mode === undefined ? undefined : { mode }),
    rename: (a, b) => fs.rename(a, b),
    remove: p => fs.remove(p),
  };
}

/** Tauri: een tekstbestand van de gebruiker veilig vervangen (zie `replaceUserFile`). */
export async function writeUserTextFileTauri(path: string, text: string): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  await replaceUserFile(tauriUserFileFs<string>(fs, (p, t, o) => fs.writeTextFile(p, t, o)), path, text);
}

/** Tauri: een binair bestand van de gebruiker (PDF-export) veilig vervangen. */
export async function writeUserBytesTauri(path: string, bytes: Uint8Array): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  await replaceUserFile(tauriUserFileFs<Uint8Array>(fs, (p, b, o) => fs.writeFile(p, b, o)), path, bytes);
}

/** De bestandsoperaties van `writeNewUserBytes`: exclusief aanmaken, opruimen en exclusief plaatsen. */
export type NewUserBytesFs = Pick<UserFileFs<Uint8Array>, 'createNew' | 'remove'> & {
  place(from: string, to: string): Promise<PlaceFileOutcome>;
};

/**
 * Een NIEUW einddoel (#804, knownbug 1131 stap 4): Opslaan als, Exporteren → IFC en `planner_export_ifc`. Vervangt
 * nooit een bestaand bestand. Eerst het eigen tijdelijke bestand `save-<id>.ops-save.tmp` in dezelfde map, met de hele
 * buffer in één rauwe `createNew`-aanroep; dan zet `place_file_exclusive` het op de naam. Een crash vóór die stap laat
 * hoogstens het tijdelijke bestand staan, nooit een half einddoel. Per uitkomst:
 * - `placed`, `dir-not-synced`: klaar (het bestand ís verplaatst; het tweede alleen met een waarschuwing);
 * - `target-exists`: eigen bestand weg, fout `create-new`;
 * - `unsupported`, `refused`/`scope`: eigen bestand weg, dan de directe exclusieve aanmaak;
 * - `refused` met een andere reden: fout; bij `not-regular-file` niets opruimen (dan staat er iets anders onder de
 *   hulpnaam);
 * - `source-changed`: stoppen. De stand op schijf is onbekend: niets terugzetten, niets opruimen, geen terugval;
 * - `io`: eigen bestand weg, fout `write`.
 * Na `io` of `target-exists` kan de hernoeming op een netwerkschijf toch gebeurd zijn (knownbug 1795): het opruimen
 * is best effort en verbergt of vervangt de fout nooit, en de route leest het doel niet terug om succes te melden.
 * Mag het tijdelijke bestand niet ontstaan (`forbidden path`: buiten de thuismap, of in een map die via een link naar
 * buiten wijst), dan blijft de directe exclusieve aanmaak de weg; die is niet crashvast (1131).
 * De aanroeper wijzigt de buffer niet tot de opslag klaar is.
 */
export async function writeNewUserBytes(fs: NewUserBytesFs, path: string, bytes: Uint8Array): Promise<void> {
  if (path) return createNewDirectly(fs, path, bytes); // MUTATIE a
  const tmp = userFileTempPath(path);
  // Alleen ons eigen tijdelijke bestand, en alleen als het van ons kan zijn; een mislukt opruimen is geen fout.
  const removeOwnTemp = async () => {
    try { await fs.remove(tmp); } catch { /* weg, of het blijft achter: de oorspronkelijke uitkomst telt */ }
  };
  try {
    await fs.createNew(tmp, bytes);
  } catch (error) {
    if (error instanceof OwnFileWriteError) {
      await removeOwnTemp();
      throw new ByteWriteError('write', error.cause);
    }
    if (isForbiddenPathError(error)) return createNewDirectly(fs, path, bytes);
    // Geen eigendom (ook EEXIST op de hulpnaam): niets verwijderen, geen terugval.
    throw new ByteWriteError('write', error);
  }
  const outcome = await fs.place(tmp, path);
  switch (outcome.code) {
    case 'placed':
      return;
    case 'dir-not-synced':
      console.warn(`Opgeslagen, maar de map is niet vastgelegd: ${outcome.message}`);
      return;
    case 'target-exists':
      await removeOwnTemp();
      throw new ByteWriteError('create-new');
    case 'unsupported':
      await removeOwnTemp();
      return createNewDirectly(fs, path, bytes);
    case 'refused':
      if (outcome.reason === 'scope') {
        await removeOwnTemp();
        return createNewDirectly(fs, path, bytes);
      }
      if (outcome.reason !== 'not-regular-file') await removeOwnTemp();
      throw new ByteWriteError('write', new Error(`place_file_exclusive: refused (${outcome.reason})`));
    case 'source-changed':
      throw new ByteWriteError('source-changed');
    case 'io':
      await removeOwnTemp();
      throw new ByteWriteError('write', new Error(outcome.message));
  }
}

/** De directe exclusieve aanmaak: één `createNew` op het einddoel met de hele buffer. Vervangt nooit een bestaand
 *  bestand, maar een crash halverwege kan een onvolledig einddoel laten staan. */
async function createNewDirectly(fs: Pick<NewUserBytesFs, 'createNew' | 'remove'>, path: string, bytes: Uint8Array): Promise<void> {
  try {
    await fs.createNew(path, bytes);
  } catch (error) {
    if (!(error instanceof OwnFileWriteError)) throw new ByteWriteError('create-new', error);
    // Alleen na een geslaagde eigen aanmaak opruimen; een botsend doel nooit verwijderen.
    try { await fs.remove(path); } catch { /* eigen onvolledig bestand kan achterblijven */ }
    throw new ByteWriteError('write', error.cause);
  }
}

/** Tauri: een nieuw doel via het eigen tijdelijke bestand en `place_file_exclusive`; bytes als rauwe body. */
export async function writeNewUserBytesTauri(path: string, bytes: Uint8Array): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  await writeNewUserBytes({
    ...tauriUserFileFs<Uint8Array>(fs, (p, b, o) => fs.writeFile(p, b, o)),
    place: placeFileExclusive,
  }, path, bytes);
}
