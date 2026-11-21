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
import { appLog } from '@/services/debug/appLog';
import { ByteWriteError } from './byteWrite';
import { placeFileExclusive, type PlaceFileOutcome } from './placeFileExclusive';
import type { FileData, RefuseBeforePlace } from './index';

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
//    ("forbidden path"). Dan blijft alleen direct schrijven over. Sinds plugin-fs 2.7.0 geldt dat ook
//    voor een map in `$HOME` die via een link naar buiten `$HOME` wijst: de scope toetst het echte pad.
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
export function userFileTempPath(path: string, id: string = userFileHelperId()): string {
  return `${userFileDir(path)}save-${id}${USER_FILE_TMP_SUFFIX}`;
}

/** Een vers id voor de eigen hulpnamen (`save-<id>.ops-save.tmp`, `save-<id>.ops-vorige-<id>`): kleine letters en cijfers,
 *  zoals `place_file.rs` (`is_helper_id`) het eist. */
export function userFileHelperId(): string {
  return generateId();
}

/** De map van `path` met het scheidingsteken erachter, letterlijk; leeg als er geen map in staat. */
export function userFileDir(path: string): string {
  const windowsPath = /^[a-z]:[\\/]|^\\\\/i.test(path);
  const lastSeparator = windowsPath ? Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) : path.lastIndexOf('/');
  return path.slice(0, lastSeparator + 1);
}

/** De bestandsoperaties die `replaceUserFile` nodig heeft — injecteerbaar voor tests. */
export interface UserFileFs<D> {
  lstat(path: string): Promise<{ isSymlink: boolean; nlink: number | null; mode: number | null }>;
  /** Exclusief aanmaken en `data` erin schrijven: weigert ieder bestaand bestand, directory of link, ook
   *  een dode symlink. Op de desktop gaat een grote buffer in stukken (`tauriUserBytesFs`): het eerste
   *  stuk maakt aan, de volgende voegen toe. Alleen een `OwnFileWriteError` zegt dat het bestand wél
   *  ontstond en daarna het schrijven mislukte: dan is het (onvolledige) bestand van de aanroeper en mag
   *  hij het opruimen. Elke andere fout geeft geen eigendom. */
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
 *  Dit vergrendelt geen paden tegen latere link-/directorywissels of concurrerende doelwijzigingen.
 *  Knownbug 1896: `refuseBeforePlace` beslist vlak vóór de hernoeming en vóór elke directe schrijfactie; weigert hij,
 *  dan gaat het eigen halffabricaat weg, blijft het doel zoals het was en geeft de functie `false`. */
export async function replaceUserFile<D>(
  fs: UserFileFs<D>, path: string, data: D, refuseBeforePlace?: RefuseBeforePlace | null,
): Promise<boolean> {
  const refused = () => refuseBeforePlace?.() === true;
  let info: Awaited<ReturnType<UserFileFs<D>['lstat']>> | null = null;
  try {
    info = await fs.lstat(path);
  } catch {
    // Bestaat nog niet (Opslaan als naar een nieuwe naam) of geen metarecht: geen link bekend.
  }
  if (info && (info.isSymlink || (info.nlink ?? 1) > 1)) {
    if (refused()) return false;
    await fs.write(path, data);
    return true;
  }
  // Het oude vaste pad blijft geheel met rust, ook als daar een link of een andere save staat.
  // Een verse naam voorkomt normale botsingen; createNew beslist, niet de willekeur of een lstat.
  const tmp = userFileTempPath(path);
  const mode = info?.mode != null ? info.mode & 0o777 : undefined;
  const removeOwnTemp = async () => {
    try { await fs.remove(tmp); } catch { /* eigen halffabricaat blijft mogelijk achter */ }
  };
  try {
    // De modus van het oude bestand (ook 0444) geldt pas voor latere openingen; daarom schrijft
    // `tauriUserBytesFs` een modus zonder schrijfrecht voor de eigenaar in de aanroep die aanmaakt.
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
      if (refused()) return false;
      await fs.write(path, data);
      return true;
    }
    throw err;
  }
  if (refused()) {
    await removeOwnTemp();
    return false;
  }
  try {
    await fs.rename(tmp, path);
  } catch {
    await removeOwnTemp();
    if (refused()) return false;
    await fs.write(path, data);
  }
  return true;
}

type TauriFs = typeof import('@tauri-apps/plugin-fs');
/** Begin van de schrijffout van `write_file_inner` in tauri-plugin-fs (2.5.0 tot en met 2.7.1, `commands.rs`).
 *  Verandert die tekst bij een upgrade, dan blijft een onvolledig eigen halffabricaat staan; het doel niet. */
export const WRITE_AFTER_CREATE_ERROR = 'failed to write bytes to file at path:';
type TauriWriteOptions = import('@tauri-apps/plugin-fs').WriteFileOptions;

/**
 * Bytes naar Tauri per aanroep (`writeFile`/`writeTextFile`) als HELE payload, nooit in een object.
 * Tauri stuurt een kale `Uint8Array` als rauwe body; een `Uint8Array` in een object (zoals
 * `FileHandle.write` doet: `{ rid, data }`) wordt JSON met `Array.from`, één getal per byte, synchroon
 * op de hoofdthread (`process-ipc-message-fn.js` in tauri 2.12.3). Rust opent bij `write_file` met
 * de opties uit de kop `options` en schrijft met `write_all` (tauri-plugin-fs 2.7.1, `write_file_inner`).
 * Een grote buffer gaat in stukken (`tauriUserBytesFs`): per aanroep één stuk als hele payload.
 * Sinds 2.6.0 faalt de aanroep vóór het openen als die opties niet te lezen zijn; daarvóór vielen ze stil
 * terug op aanmaken en afkappen (ook zonder `createNew`). De opties hieronder zijn altijd leesbaar.
 */
export function tauriUserFileFs<D>(fs: TauriFs, write: (path: string, data: D, options?: TauriWriteOptions) => Promise<void>): UserFileFs<D> {
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

/** Hoogstens zoveel bytes gaan in één `writeFile` naar Rust (#804, knownbug 1936). Tauri stuurt de payload als één
 *  HTTP-body en onderweg ontstaan kopieën: bij 157 MB in één aanroep kostte dat op de desktop 0,4 tot 0,7 GB extra. */
export const USER_FILE_CHUNK_BYTES = 16 * 1024 * 1024;

/**
 * De bytes van een gebruikersbestand op plugin-fs (#804, knownbug 1936): `tauriUserFileFs` met `writeFile`, en een
 * `createNew` die een buffer groter dan `chunkBytes` in stukken schrijft. Het eerste stuk is de exclusieve aanmaak van
 * `tauriUserFileFs`, met dezelfde herkenning van eigendom. Elk volgend stuk gaat met `{ append: true, create: false }`:
 * toevoegen, niet afkappen, en geen nieuw bestand als het weg is. Na een geslaagd eerste stuk is het bestand van ons;
 * elke fout van een volgend stuk, ook bij het openen, is dan een `OwnFileWriteError`. Elk stuk is een eigen kopie
 * (`slice`), zodat ook een webview die van een view de hele onderliggende buffer zou sturen alleen dit stuk stuurt.
 * Eén aanroep zoals voorheen blijft het voor een buffer van hoogstens één stuk, en voor een modus zonder schrijfrecht
 * voor de eigenaar (0444, knownbug 162): die modus geldt pas voor latere openingen, dus een volgend stuk zou falen.
 * De directe terugval (`write`) blijft één aanroep. Grens: elk volgend stuk opent het pad opnieuw en volgt een link
 * (knownbug 2023).
 */
export function tauriUserBytesFs(fs: TauriFs, chunkBytes = USER_FILE_CHUNK_BYTES): UserFileFs<Uint8Array> {
  const whole = tauriUserFileFs<Uint8Array>(fs, (p, b, o) => fs.writeFile(p, b, o));
  return {
    ...whole,
    createNew: async (p, bytes, mode) => {
      if (bytes.byteLength <= chunkBytes || (mode !== undefined && (mode & 0o200) === 0)) return whole.createNew(p, bytes, mode);
      await whole.createNew(p, bytes.slice(0, chunkBytes), mode);
      for (let at = chunkBytes; at < bytes.byteLength; at += chunkBytes) {
        try {
          await fs.writeFile(p, bytes.slice(at, at + chunkBytes), { append: true, create: false });
        } catch (error) {
          throw new OwnFileWriteError(error);
        }
      }
    },
  };
}

/** Tauri: een tekstbestand van de gebruiker veilig vervangen (zie `replaceUserFile`). `false`: `refuseBeforePlace`
 *  weigerde. */
export async function writeUserTextFileTauri(path: string, text: string): Promise<void> {
  await writeUserFileTauri(path, text);
}

/** Tauri: tekst of bytes (#804 stap 6: de bytes van de opslagworker) via dezelfde veilige vervanging; dezelfde bytes op
 *  schijf. Met `refuseBeforePlace` de laatste controle van een documentopslag (knownbug 1896): `false` als die weigerde,
 *  het doel is dan onveranderd. */
export async function writeUserFileTauri(path: string, data: FileData, refuseBeforePlace?: RefuseBeforePlace | null): Promise<boolean> {
  const fs = await import('@tauri-apps/plugin-fs');
  return typeof data === 'string'
    ? replaceUserFile(tauriUserFileFs<string>(fs, (p, t, o) => fs.writeTextFile(p, t, o)), path, data, refuseBeforePlace)
    : replaceUserFile(tauriUserBytesFs(fs), path, data, refuseBeforePlace);
}

/** De bestandsoperaties van `writeNewUserBytes`: exclusief aanmaken, opruimen en exclusief plaatsen. */
export type NewUserBytesFs = Pick<UserFileFs<Uint8Array>, 'createNew' | 'remove'> & {
  place(from: string, to: string): Promise<PlaceFileOutcome>;
};

/**
 * Een NIEUW einddoel (#804, knownbug 1131 stap 4): Opslaan als, Exporteren → IFC en `planner_export_ifc`. Vervangt
 * nooit een bestaand bestand. Eerst het eigen tijdelijke bestand `save-<id>.ops-save.tmp` in dezelfde map, met de hele
 * buffer via één `createNew` (rauwe bytes, een grote buffer in stukken: `tauriUserBytesFs`); dan zet
 * `place_file_exclusive` het op de naam. Een crash vóór die stap laat
 * hoogstens het tijdelijke bestand staan, nooit een half einddoel. Per uitkomst:
 * - `placed`, `dir-not-synced`: klaar (het bestand ís verplaatst; het tweede alleen met een waarschuwing);
 * - `target-exists`: eigen bestand weg, fout `create-new`;
 * - `unsupported`, `refused`/`scope`: eigen bestand weg, dan de directe exclusieve aanmaak;
 * - `refused` met een andere reden: fout; bij `not-regular-file` niets opruimen (dan staat er iets anders onder de
 *   hulpnaam). Bij `hard-linked` (het tijdelijke bestand kreeg een tweede naam) wel: `remove` haalt alleen deze naam
 *   weg, de inhoud blijft onder de andere naam;
 * - `source-changed`: stoppen. De stand op schijf is onbekend: niets terugzetten, niets opruimen, geen terugval. Ook
 *   als het commando vóór de stap zag dat de open bron geen naam meer had: onder de hulpnaam kan dan iets anders staan;
 * - `io`: eigen bestand weg, fout `write`.
 * Na `io` of `target-exists` kan de hernoeming op een netwerkschijf toch gebeurd zijn (knownbug 1795): het opruimen
 * is best effort en verbergt of vervangt de fout nooit, en de route leest het doel niet terug om succes te melden.
 * Mag het tijdelijke bestand niet ontstaan (`forbidden path`: buiten de thuismap, en sinds plugin-fs 2.7.1 ook in een
 * map die via een link naar buiten wijst), dan blijft de directe exclusieve
 * aanmaak de weg; die is niet crashvast (1131). Alleen de plaatsing via het tijdelijke bestand laat nooit een half
 * einddoel staan.
 * Per doel schrijft de route één regel in het app-log (kanaal `NEW_NAME_LOG_CHANNEL`): het doelpad en de weg, nooit
 * inhoud. De echte-app-proef leest die regel terug (`tests/mcp/realApp/run-real-app.ts`).
 * De aanroeper wijzigt de buffer niet tot de opslag klaar is.
 */
export const NEW_NAME_LOG_CHANNEL = 'nieuweNaam';
const logWay = (path: string, way: string) => appLog.emit('event', NEW_NAME_LOG_CHANNEL, `${path}: ${way}`);

/** Het eigen tijdelijke bestand weghalen; een mislukt opruimen is geen fout (de oorspronkelijke uitkomst telt). */
async function removeQuietly(fs: Pick<UserFileFs<Uint8Array>, 'remove'>, path: string): Promise<void> {
  try { await fs.remove(path); } catch { /* weg, of het blijft achter */ }
}

/**
 * De eerste stap van elke schrijfroute via een eigen hulpnaam (`writeNewUserBytes`, de vervanging van het eigen bestand
 * in `ownFileReplace.ts`): de hele buffer via één `createNew` (op de desktop een grote buffer in stukken,
 * `tauriUserBytesFs`). Alleen na een `OwnFileWriteError` is het onvolledige
 * bestand van ons en gaat het weg. `forbidden`: het tijdelijke bestand mag daar niet ontstaan. Elke andere fout (ook
 * EEXIST op de hulpnaam) geeft geen eigendom: niets verwijderen.
 */
export async function createOwnTemp(
  fs: Pick<UserFileFs<Uint8Array>, 'createNew' | 'remove'>, tmp: string, bytes: Uint8Array, mode?: number,
): Promise<{ failed: null } | { failed: 'forbidden' | 'write'; cause: unknown }> {
  try {
    await fs.createNew(tmp, bytes, mode);
    return { failed: null };
  } catch (error) {
    if (error instanceof OwnFileWriteError) {
      await removeQuietly(fs, tmp);
      return { failed: 'write', cause: error.cause };
    }
    return { failed: isForbiddenPathError(error) ? 'forbidden' : 'write', cause: error };
  }
}

/** Knownbug 1896: `refuseBeforePlace` beslist vlak vóór de plaatsing en vóór elke directe exclusieve aanmaak; weigert
 *  hij, dan gaat het eigen tijdelijke bestand weg, ontstaat de naam niet en geeft de functie `false`. */
export async function writeNewUserBytes(
  fs: NewUserBytesFs, path: string, bytes: Uint8Array, refuseBeforePlace?: RefuseBeforePlace | null,
): Promise<boolean> {
  const tmp = userFileTempPath(path);
  const removeOwnTemp = () => removeQuietly(fs, tmp);
  const stopped = () => {
    if (refuseBeforePlace?.() !== true) return false;
    logWay(path, 'niet geplaatst (gestopt vóór de plaatsing)');
    return true;
  };
  const directly = async (why: string) => {
    if (stopped()) return false;
    await createNewDirectly(fs, path, bytes, why);
    return true;
  };
  const created = await createOwnTemp(fs, tmp, bytes);
  if (created.failed === 'forbidden') return directly('forbidden path');
  if (created.failed) throw new ByteWriteError('write', created.cause);
  if (stopped()) {
    await removeOwnTemp();
    return false;
  }
  const outcome = await fs.place(tmp, path);
  switch (outcome.code) {
    case 'placed':
      logWay(path, 'geplaatst (placed)');
      return true;
    case 'dir-not-synced':
      logWay(path, 'geplaatst (dir-not-synced)');
      console.warn(`Opgeslagen, maar de map is niet vastgelegd: ${outcome.message}`);
      return true;
    case 'target-exists':
      logWay(path, 'niet geplaatst (target-exists)');
      await removeOwnTemp();
      throw new ByteWriteError('create-new');
    case 'unsupported':
      await removeOwnTemp();
      return directly('unsupported');
    case 'refused':
      if (outcome.reason === 'scope') {
        await removeOwnTemp();
        return directly('refused/scope');
      }
      logWay(path, `niet geplaatst (refused/${outcome.reason})`);
      if (outcome.reason !== 'not-regular-file') await removeOwnTemp();
      throw new ByteWriteError('write', new Error(`place_file_exclusive: refused (${outcome.reason})`));
    case 'source-changed':
      logWay(path, 'niet geplaatst (source-changed)');
      throw new ByteWriteError('source-changed');
    case 'io':
      logWay(path, 'niet geplaatst (io)');
      await removeOwnTemp();
      throw new ByteWriteError('write', new Error(outcome.message));
  }
}

/** De directe exclusieve aanmaak: één `createNew` op het einddoel met de hele buffer (op de desktop een grote buffer
 *  in stukken). Vervangt nooit een bestaand bestand, maar een crash halverwege kan een onvolledig einddoel laten staan. */
async function createNewDirectly(fs: Pick<NewUserBytesFs, 'createNew' | 'remove'>, path: string, bytes: Uint8Array, why: string): Promise<void> {
  logWay(path, `directe aanmaak (${why})`);
  try {
    await fs.createNew(path, bytes);
  } catch (error) {
    if (!(error instanceof OwnFileWriteError)) throw new ByteWriteError('create-new', error);
    // Alleen na een geslaagde eigen aanmaak opruimen; een botsend doel nooit verwijderen.
    try { await fs.remove(path); } catch { /* eigen onvolledig bestand kan achterblijven */ }
    throw new ByteWriteError('write', error.cause);
  }
}

/** Tauri: een nieuw doel via het eigen tijdelijke bestand en `place_file_exclusive`; bytes als rauwe body, in stukken
 *  (`tauriUserBytesFs`). `false`: `refuseBeforePlace` weigerde. */
export async function writeNewUserBytesTauri(path: string, bytes: Uint8Array, refuseBeforePlace?: RefuseBeforePlace | null): Promise<boolean> {
  const fs = await import('@tauri-apps/plugin-fs');
  return writeNewUserBytes({ ...tauriUserBytesFs(fs), place: placeFileExclusive }, path, bytes, refuseBeforePlace);
}
