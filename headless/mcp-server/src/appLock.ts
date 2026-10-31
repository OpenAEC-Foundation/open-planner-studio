// Slot: staat dit bestand open in de desktop-app? (ontwerp "één plugin, drie situaties", #570; #730)
//
// Draait de app met de MCP-koppeling uit, dan werkt de headless server zelf op bestanden. Hij mag dan geen
// bestand SCHRIJVEN dat de gebruiker in de app open heeft: twee schrijvers op één IFC-bestand verliezen
// elkaars werk. Lezen mag wel. De app houdt de open bestanden bij in `<appDataDir>/mcp/open-files.json`
// (dev-builds: `open-files.<slug>.json`). Contract en leesregels: `src/services/mcp/discoveryContract.ts`
// en `docs/mcp-ontdekking.md`. `nodeFs.ts` roept het slot aan in de schrijfroute, na de fysieke controle.
//
// Regels (uit het contract):
//  - per schrijfactie opnieuw lezen, geen cache;
//  - elke map uit `mcpDiscoveryDirs`, elk `open-files*.json`, nooit een naam op `.tmp`;
//  - een map die niet bestaat is geen fout; een map of register dat er wel is maar niet te lezen: weigeren;
//  - `openFilesWritePolicy` beslist per register: vrij, toets de paden, of weiger elke schrijfactie;
//  - draait de app (een register met "toets de paden"), dan vervangt de server GEEN BESTAAND BESTAND, ook niet
//    een dat niet in het register staat. Het register loopt achter op de app: een net geopend bestand stond in
//    een echte run pas na 113–144 ms in het register (review #730, ronde 1). "Staat niet in het register" bewijst
//    dus niet dat het niet open is. Een nieuw bestand mag wel;
//  - onzekere identiteit ⇒ weigeren. Alleen een pad dat aantoonbaar niet bestaat (`ENOENT`/`ENOTDIR` op het
//    pad zelf, en `realpath` van de diepste bestaande bovenmap lukt) krijgt als sleutel die echte bovenmap
//    plus de rest van het pad. Bestaan doel en registerpad allebei niet, dan weigeren als de sleutels gelijk
//    zijn. De contracttekst noemt de oudermap; de diepste bestaande bovenmap is daar een ruimere vorm van,
//    nodig omdat de server bij opslaan ontbrekende mappen aanmaakt. Zo'n pad kan een open document zijn
//    waarvan het bestand weg is: de app zou het bij opslaan opnieuw aanmaken.
//
// Het register is een voorcontrole, geen slot in het besturingssysteem (regel 6 van het contract). Wat
// overblijft: de app start en maakt hetzelfde nieuwe bestand aan tussen de controle en de `rename` van de
// server (microseconden), of een app zonder register (ouder dan #570).
// Teksten die de agent leest zijn Engels; commentaar Nederlands.
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MCP_DISCOVERY_TMP_SUFFIX, mcpDiscoveryDirs, openFilesWritePolicy, readOpenFilesFile, type PidState,
} from '@/services/mcp/discoveryContract';

/** Krijgt het echte pad van het schrijfdoel (uit de fysieke controle van `nodeFs.ts`). `null` = vrij;
 *  anders de Engelse weigertekst voor de agent. */
export type AppLock = (realPath: string) => Promise<string | null>;

/** Geen register: nooit open. Alleen voor tests die `createNodeFileFs` direct aanroepen. */
export const noAppLock: AppLock = async () => null;

/** De mappen van de app op dit platform (Linux: ook de Snap-map), of `OPS_MCP_DISCOVERY_DIR`. */
export function platformDiscoveryDirs(env: Record<string, string | undefined> = process.env): string[] {
  return mcpDiscoveryDirs({ platform: process.platform, home: os.homedir(), env });
}

function errCode(e: unknown): string {
  return e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : 'unknown error';
}

/** Leeft het proces? `process.kill(pid, 0)` stuurt geen signaal; `EPERM` betekent: leeft, van een ander. */
export function nodePidState(pid: number): PidState {
  try {
    process.kill(pid, 0);
    return 'alive';
  } catch (e) {
    const code = errCode(e);
    if (code === 'ESRCH') return 'dead';
    if (code === 'EPERM') return 'alive';
    return 'unknown';
  }
}

/** `open-files.json` of `open-files.<slug>.json`; nooit een halffabricaat. */
export function isOpenFilesName(name: string): boolean {
  return name.startsWith('open-files') && name.endsWith('.json') && !name.endsWith(MCP_DISCOVERY_TMP_SUFFIX);
}

type Ident =
  /** Bestaat. Zolang de app draait, is dat genoeg om te weigeren: dan telt niet wélk bestand het is. */
  | { kind: 'file' }
  /** Bestaat aantoonbaar niet; `key` = echte bovenmap + rest van het pad (letterlijk aaneengeplakt). */
  | { kind: 'missing'; key: string }
  | { kind: 'uncertain'; code: string };

const notThere = (code: string) => code === 'ENOENT' || code === 'ENOTDIR';

/** Bestaat het pad, en zo niet: zijn sleutel. Volgens de regels hierboven. */
async function identify(p: string): Promise<Ident> {
  if (!path.isAbsolute(p)) return { kind: 'uncertain', code: 'not an absolute path' };
  try {
    await fsp.lstat(p);
  } catch (e) {
    const code = errCode(e);
    if (!notThere(code)) return { kind: 'uncertain', code };
    return missingKey(p);
  }
  // Het pad bestaat (ook een dode link bestaat voor `lstat`; `realpath` faalt daar en dan weigeren we).
  try {
    await fsp.stat(await fsp.realpath(p));
    return { kind: 'file' };
  } catch (e) {
    return { kind: 'uncertain', code: errCode(e) };
  }
}

async function missingKey(p: string): Promise<Ident> {
  const tail: string[] = [];
  let cur = p;
  for (;;) {
    const parent = path.dirname(cur);
    if (parent === cur) return { kind: 'uncertain', code: 'no existing parent folder' };
    tail.unshift(path.basename(cur));
    cur = parent;
    try {
      await fsp.lstat(cur);
      break;
    } catch (e) {
      const code = errCode(e);
      if (!notThere(code)) return { kind: 'uncertain', code };
    }
  }
  let realParent: string;
  try {
    realParent = await fsp.realpath(cur);
  } catch (e) {
    return { kind: 'uncertain', code: errCode(e) };
  }
  // Geen normalisatie van de rest: elke omvorming kan een ander bestand aanwijzen.
  const key = `${realParent.endsWith(path.sep) ? realParent : realParent + path.sep}${tail.join(path.sep)}`;
  // macOS en Windows hebben meestal een hoofdletterongevoelig volume: daar telt een andere schrijfwijze van
  // een nog niet bestaand pad als gelijk. Dat geeft alleen meer weigeringen, nooit minder.
  return { kind: 'missing', key: process.platform === 'darwin' || process.platform === 'win32' ? key.toLowerCase() : key };
}

// --- Weigerteksten (Engels, voor de agent) -----------------------------------------------------------

export function openInAppText(realPath: string): string {
  return `'${realPath}' is open in the Open Planner Studio desktop app. The server does not write a file that is ` +
    'open in the app: two programs writing one file lose each other\'s changes. Reading it still works. Save under ' +
    'a different name, or ask the user to close the file in the app or to start the MCP bridge there.';
}

export function appRunningText(realPath: string): string {
  return `Open Planner Studio is running, so the server does not replace the existing file '${realPath}': the app may ` +
    'have it open, also when it opened it just now. Two programs writing one file lose each other\'s changes. Reading ' +
    'it still works. Save under a new file name, or ask the user to start the MCP bridge in the app or to close the app.';
}

export function registerUnusableText(where: string, detail: string): string {
  return `Open Planner Studio may be running, but its list of open files '${where}' cannot be used (${detail}). ` +
    'Until that is solved, the server writes no file at all; reading still works. ' +
    'Ask the user to close Open Planner Studio or to start the MCP bridge there. If the app is newer than this ' +
    'server, update the server.';
}

export function identityUncertainText(realPath: string, side: 'target' | 'open-file', code: string): string {
  return side === 'target'
    ? `The server cannot establish the identity of '${realPath}' (${code}), so it cannot rule out that this file ` +
      'is open in the Open Planner Studio desktop app. It does not write there. Save under a different name, or ' +
      'ask the user to close the file in the app or to start the MCP bridge there.'
    : `The server cannot establish the identity of a file that is open in the Open Planner Studio desktop app ` +
      `(${code}), so it cannot rule out that '${realPath}' is that file. It does not write while that is uncertain. ` +
      'Ask the user to close that file in the app or to start the MCP bridge there.';
}

// --- Het slot ------------------------------------------------------------------------------------------

export interface AppLockDeps {
  pidState?: (pid: number) => PidState;
}

/** Het slot over de gegeven registermappen. Leest bij elke aanroep opnieuw. */
export function createAppLock(dirs: readonly string[], deps: AppLockDeps = {}): AppLock {
  const pidState = deps.pidState ?? nodePidState;
  return async (realPath) => {
    const listed: string[] = [];
    let appRunning = false;
    for (const dir of dirs) {
      let names: string[];
      try {
        names = await fsp.readdir(dir);
      } catch (e) {
        const code = errCode(e);
        if (notThere(code)) continue; // de app schreef hier nooit iets
        return registerUnusableText(dir, code);
      }
      for (const name of names.filter(isOpenFilesName).sort()) {
        const file = path.join(dir, name);
        let text: string | null;
        try {
          text = await fsp.readFile(file, 'utf8');
        } catch (e) {
          const code = errCode(e);
          if (code !== 'ENOENT') return registerUnusableText(file, code);
          text = null; // tussen readdir en lezen gewist: de app is gestopt
        }
        const read = readOpenFilesFile(text);
        const policy = openFilesWritePolicy(read, pidState);
        if (policy === 'refuse-all') return registerUnusableText(file, 'it is damaged or in a format this server does not know');
        if (policy === 'check-files' && read.status === 'valid') {
          appRunning = true;
          listed.push(...read.file.files);
        }
      }
    }
    if (!appRunning) return null;
    const target = await identify(realPath);
    if (target.kind === 'uncertain') return identityUncertainText(realPath, 'target', target.code);
    if (target.kind === 'file') return appRunningText(realPath);
    // Een nieuw bestand: alleen een open document waarvan het bestand weg is, heeft dezelfde sleutel.
    for (const p of listed) {
      const id = await identify(p);
      if (id.kind === 'uncertain') return identityUncertainText(realPath, 'open-file', id.code);
      if (id.kind === 'missing' && id.key === target.key) return openInAppText(realPath);
    }
    return null;
  };
}
