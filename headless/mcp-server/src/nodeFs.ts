// Bestandstoegang van de headless MCP-server: de `McpFileFs`-naad van `planner_export_ifc` en
// `planner_import_schedule` (`src/services/mcp/tools/fileTools.ts`) op Node `fs`, opgesloten in één
// werkmap (`--root`).
//
// Twee poorten, net als in de app:
//  1. LEXICAAL — `checkScope` in fileTools: het pad wordt genormaliseerd (`..`, `.`, dubbele scheiders,
//     `~`) en moet onder `homeDir()` liggen. Hier is `homeDir()` de werkmap, dus `~/plan.ifc` is
//     `<root>/plan.ifc`.
//  2. FYSIEK — `check()` hieronder, vóór elke operatie: de `realpath` van het pad (of van de
//     dichtstbijzijnde bestaande bovenmap) moet binnen de `realpath` van de werkmap liggen. Die
//     vergelijking is EXACT, teken voor teken: geen aanname over hoofdletters per besturingssysteem
//     (een hoofdlettergevoelig volume op macOS bestaat). Een andere schrijfwijze van hetzelfde pad wordt
//     dus geweigerd, nooit toegelaten. Geweigerd met `SCOPE`: een link of junction naar buiten, een dode
//     link, een bestand met meer dan één harde link (niet te bewijzen dat elke naam binnen ligt), en een
//     bestand dat in de app open staat (`appLock.ts`).
//
// GEBONDEN AAN WAT GECONTROLEERD IS (review PR #572, bevinding 2). Een controle vooraf is geen grens: een
// ander proces kan daarna een map door een link vervangen. Daarom:
//   - lezen opent het ECHTE pad met `O_NOFOLLOW` en vergelijkt daarna `dev`/`ino` van de geopende handle
//     met het gecontroleerde bestand; wijkt het af, dan wordt er niets gelezen;
//   - schrijven maakt het halffabricaat exclusief aan (`O_CREAT | O_EXCL | O_NOFOLLOW`) in de
//     gecontroleerde ECHTE map, en controleert vóór het schrijven en vlak vóór de `rename` dat die map
//     nog dezelfde `dev`/`ino` heeft en dat het pad van het halffabricaat nog naar de eigen handle wijst.
// Wat overblijft (eerlijk): Node kent geen `openat`/`renameat`. Tussen de laatste controle en de
// `rename` zit een venster van één systeemaanroep; een proces dat precies dan een map wisselt, kan de
// `rename` naar een andere map sturen. De gelezen of geschreven INHOUD verlaat de werkmap daardoor niet
// ongemerkt bij lezen; bij schrijven landt hooguit ons eigen halffabricaat elders. Wie dat ook wil
// uitsluiten, draait de server als eigen gebruiker of in een container met alleen de werkmap.
//
// SCHRIJVEN IS ALTIJD ATOMAIR (review PR #572, bevinding 1). Eerst een eigen halffabricaat naast het
// ECHTE doel, `fsync`, dan `rename`. Een link naar een bestand binnen de werkmap blijft een link: het
// echte doel wordt vervangen. Mislukt schrijven of `rename`, dan wordt het halffabricaat opgeruimd en
// geeft de tool een fout; het origineel blijft byte-gelijk. Er is GEEN terugval op direct schrijven
// (die in de app bestaat voor Tauri-scope en gelinkte bestanden; daar verandert niets).
import { constants as fsConstants, promises as fsp, type BigIntStats } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import type { McpFileFs } from '@/services/mcp/tools/fileTools';
import type { FileIdentityInfo } from '@/services/fileAccess/fileIdentity';
import { isPathOpenInApp as noAppLock, type IsPathOpenInApp } from './appLock';

/** Is `child` gelijk aan of binnen `parent`? Beide zijn absolute, door `realpath` opgeloste paden.
 *  Exacte vergelijking, ook op Windows en macOS: liever een terechte weigering dan een ontsnapping. */
export function isInside(parent: string, child: string, sep: string = path.sep): boolean {
  if (child === parent) return true;
  const prefix = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child.startsWith(prefix);
}

function errCode(e: unknown): string | undefined {
  return e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

/** Een eigen fouttype, zodat een scopeweigering in een bestandsoperatie herkenbaar blijft. */
export class ScopeEscapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeEscapeError';
  }
}

/** `dev` + `ino` van een bestand of map. */
interface Identity { dev: bigint; ino: bigint }
const idOf = (s: BigIntStats): Identity => ({ dev: s.dev, ino: s.ino });
const sameId = (a: Identity, b: Identity) => a.dev === b.dev && a.ino === b.ino;

/** Wat `check()` vaststelde over één pad. */
interface Checked {
  /** Het echte pad (bestaande delen via `realpath`), binnen de werkmap. */
  real: string;
  /** De echte map waarin het bestand staat of komt, en haar identiteit. */
  dir: string;
  dirId: Identity;
  /** Bestaat het doel? Dan zijn identiteit en permissiebits. */
  file: { id: Identity; mode: number; isFile: boolean } | null;
}

/**
 * Testhaken (alleen voor `tests/mcp/cases-headless-server.ts`): `afterCheck` draait tussen de controle
 * en de bestandsoperatie (om daar een map te wisselen), `fault` gooit op een gekozen moment (om een
 * schrijf- of rename-fout na te bootsen). De server zelf geeft geen haken mee.
 */
export interface NodeFsHooks {
  afterCheck?: (phase: 'open' | 'create' | 'rename', target: string) => Promise<void>;
  fault?: (phase: 'write' | 'rename') => void;
}

const O_NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0;

/**
 * Maak de bestandstoegang voor één werkmap. `root` moet de `realpath` van een bestaande map zijn
 * (`host.ts` controleert dat). `isOpenInApp` is de slot-haak (`appLock.ts`).
 */
export async function createNodeFileFs(
  root: string,
  isOpenInApp: IsPathOpenInApp = noAppLock,
  hooks: NodeFsHooks = {},
): Promise<McpFileFs & { root: string }> {
  const realRoot = root;
  const rootId = idOf(await fsp.stat(realRoot, { bigint: true }));

  const outside = (target: string) => new ScopeEscapeError(
    `Path '${target}' leads outside the working folder '${realRoot}' (through a symbolic link, junction, ` +
    'other alias or a different spelling). The headless server may only read and write inside its working folder.');

  /** De fysieke poort. Gooit `ScopeEscapeError` bij een weigering. */
  async function check(target: string): Promise<Checked> {
    if (!sameId(idOf(await fsp.stat(realRoot, { bigint: true })), rootId)) {
      throw new ScopeEscapeError(`The working folder '${realRoot}' was replaced while the server runs; refusing file access.`);
    }
    const native = path.resolve(target);
    // Loop omhoog tot een bestaand deel; alles daaronder bestaat (nog) niet en kan dus geen link zijn.
    let existing = native;
    const missing: string[] = [];
    for (;;) {
      try {
        await fsp.lstat(existing); // ook een dode link bestaat voor `lstat`; `realpath` weigert hem
        break;
      } catch (e) {
        if (errCode(e) !== 'ENOENT' && errCode(e) !== 'ENOTDIR') throw e;
        const parent = path.dirname(existing);
        if (parent === existing) break;
        missing.unshift(path.basename(existing));
        existing = parent;
      }
    }
    let realExisting: string;
    try {
      realExisting = await fsp.realpath(existing);
    } catch (e) {
      if (errCode(e) === 'ENOENT') {
        throw new ScopeEscapeError(`Path '${target}' contains a link that points to nothing (a dangling symbolic ` +
          'link). The server refuses it, because writing there would create a file wherever the link points.');
      }
      throw e;
    }
    const real = missing.length > 0 ? path.join(realExisting, ...missing) : realExisting;
    if (!isInside(realRoot, real) || real === realRoot) {
      if (real === realRoot) throw new ScopeEscapeError(`Path '${target}' is the working folder itself, not a file in it.`);
      throw outside(target);
    }
    if (await isOpenInApp(real)) {
      throw new ScopeEscapeError(`'${target}' is open in Open Planner Studio. Close it there first, or let the user ` +
        'work on it in the app; two programs writing one file lose each other\'s changes.');
    }
    let file: Checked['file'] = null;
    if (missing.length === 0) {
      const info = await fsp.stat(real, { bigint: true });
      if (info.isFile() && info.nlink > 1n) {
        throw new ScopeEscapeError(`Path '${target}' is a file with ${info.nlink} hard links. The server cannot prove ` +
          'that every name of that file is inside its working folder, so it does not read or write it. Copy the file first.');
      }
      file = { id: idOf(info), mode: Number(info.mode & 0o777n), isFile: info.isFile() };
    }
    const dir = path.dirname(real);
    let dirId: Identity;
    try {
      dirId = idOf(await fsp.stat(dir, { bigint: true }));
    } catch (e) {
      if (errCode(e) === 'ENOENT') dirId = { dev: -1n, ino: -1n }; // map bestaat nog niet (schrijven maakt hem)
      else throw e;
    }
    return { real, dir, dirId, file };
  }

  async function confine(target: string): Promise<string | null> {
    try {
      await check(target);
      return null;
    } catch (e) {
      if (e instanceof ScopeEscapeError) return e.message;
      throw e;
    }
  }

  const changed = (target: string) => new ScopeEscapeError(
    `Path '${target}' changed while the server was checking it (a folder or file was replaced). Nothing was ` +
    'read or written; try again.');

  /** Lees een bestaand bestand via een handle die aantoonbaar het gecontroleerde bestand is. */
  async function readChecked(target: string): Promise<Buffer> {
    const c = await check(target);
    if (!c.file) {
      const err = new Error(`ENOENT: no such file or directory, open '${target}'`) as Error & { code: string };
      err.code = 'ENOENT';
      throw err;
    }
    if (!c.file.isFile) throw new Error(`'${target}' is not a file`);
    await hooks.afterCheck?.('open', c.real);
    const handle = await fsp.open(c.real, fsConstants.O_RDONLY | O_NOFOLLOW);
    try {
      const opened = await handle.stat({ bigint: true });
      if (!sameId(idOf(opened), c.file.id)) throw changed(target);
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  }

  /** Schrijf atomair: eigen halffabricaat in de gecontroleerde echte map, `fsync`, `rename`. */
  async function writeChecked(target: string, content: string): Promise<void> {
    let c = await check(target);
    if (c.file && !c.file.isFile) throw new Error(`'${target}' is a folder, not a file`);
    if (c.dirId.ino === -1n) {
      // De map bestaat nog niet: maak hem binnen de werkmap aan en controleer opnieuw.
      await fsp.mkdir(c.dir, { recursive: true });
      c = await check(target);
      if (c.dirId.ino === -1n) throw changed(target);
    }
    const tmp = path.join(c.dir, `.${path.basename(c.real)}.${randomBytes(6).toString('hex')}.ops-save.tmp`);
    const verifyPlace = async (tmpId: Identity) => {
      // Een map die verdwijnt of vervangen is, geeft hier ENOENT of ENOTDIR: dat is ook een wissel.
      let dirNow: Identity;
      let tmpNow: Identity;
      try {
        dirNow = idOf(await fsp.stat(c.dir, { bigint: true }));
        tmpNow = idOf(await fsp.lstat(tmp, { bigint: true }));
      } catch {
        throw changed(target);
      }
      if (!sameId(dirNow, c.dirId) || !sameId(tmpNow, tmpId)) throw changed(target);
    };
    await hooks.afterCheck?.('create', c.real);
    const handle = await fsp.open(tmp, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | O_NOFOLLOW, c.file?.mode ?? 0o666);
    let tmpId: Identity | null = null;
    let closed = false;
    try {
      tmpId = idOf(await handle.stat({ bigint: true }));
      await verifyPlace(tmpId);
      hooks.fault?.('write');
      await handle.writeFile(content, 'utf8');
      if (c.file) await handle.chmod(c.file.mode); // permissiebits van het origineel, los van de umask
      await handle.sync(); // de data staat op schijf vóór de rename
      await handle.close();
      closed = true;
      await hooks.afterCheck?.('rename', c.real);
      await verifyPlace(tmpId);
      hooks.fault?.('rename');
      await fsp.rename(tmp, c.real);
    } catch (error) {
      if (!closed) await handle.close().catch(() => {});
      // Alleen ons eigen halffabricaat opruimen: wijst het pad nog naar de eigen handle?
      if (tmpId) {
        try {
          if (sameId(idOf(await fsp.lstat(tmp, { bigint: true })), tmpId)) await fsp.unlink(tmp);
        } catch { /* al weg, of niet meer van ons */ }
      }
      throw error;
    }
  }

  return {
    root: realRoot,
    homeDir: async () => realRoot,
    confine,
    exists: async (p) => (await check(p)).file !== null,
    stat: async (p): Promise<FileIdentityInfo> => {
      const c = await check(p);
      // `compareFilePaths` (fileIdentity.ts) herkent een ontbrekend doel alleen aan de foutvorm van
      // Tauri plugin-fs. Geef het ontbreken in precies die vorm door, anders telt een nieuw bestand als
      // "onbekend" en weigert de export het.
      if (!c.file) throw new Error(`failed to get metadata of path: ${p} with error: No such file or directory (os error 2)`);
      const safe = (n: bigint): number | null => (n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : null);
      return { isFile: c.file.isFile, dev: safe(c.file.id.dev), ino: safe(c.file.id.ino) };
    },
    readTextFile: async (p) => (await readChecked(p)).toString('utf8'),
    readFile: async (p) => new Uint8Array(await readChecked(p)),
    writeTextFile: (p, content) => writeChecked(p, content),
  };
}
