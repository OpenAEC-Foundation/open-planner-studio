// Vindt de bridge van de draaiende desktop-app via `runtime.json` (contract: `discoveryContract.ts`,
// uitleg: `docs/mcp-ontdekking.md`). De proxy roept `findApp` bij elke aanvraag aan; het bestand is klein.
//
// Regels uit het contract:
//   - alleen de canonieke naam `runtime.json` (een dev-build: `runtime.<slug>.json`, alleen met
//     `OPS_MCP_DEV_INSTANCE`, voor tests en ontwikkelaars);
//   - een onbruikbaar bestand ⇒ niet verbinden;
//   - een bestand van een proces dat niet meer leeft ⇒ achtergebleven, overslaan. Leeft het pid (of is dat
//     onbekend), dan beslist de verbindingstest in de proxy: geen verbinding of 401 ⇒ zonder app.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  mcpDiscoveryDirs, mcpDiscoveryNames, readRuntimeFile, type DiscoveryLocation, type PidState,
} from '../../../src/services/mcp/discoveryContract';
import type { AppTarget } from './proxy';

/** Leeft proces `pid`? `process.kill(pid, 0)` stuurt geen signaal; `EPERM` betekent: leeft, maar van een ander. */
export function pidState(pid: number): PidState {
  try {
    process.kill(pid, 0);
    return 'alive';
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : null;
    if (code === 'ESRCH') return 'dead';
    if (code === 'EPERM') return 'alive';
    return 'unknown';
  }
}

export interface AppFinderOptions {
  location: DiscoveryLocation;
  /** Slug van een dev-build (`runtime.<slug>.json`); `null` = de canonieke naam. */
  devInstance: string | null;
  log: (line: string) => void;
  readText?: (file: string) => string | null;
  pidState?: (pid: number) => PidState;
}

function readOrNull(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : null;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw error;
  }
}

/** Maakt `findApp` voor de proxy. Logt een bevinding alleen als die verandert, niet bij elke aanvraag. */
export function createAppFinder(opts: AppFinderOptions): () => AppTarget | null {
  const dirs = mcpDiscoveryDirs(opts.location);
  const name = mcpDiscoveryNames(opts.devInstance).runtime;
  const readText = opts.readText ?? readOrNull;
  const alive = opts.pidState ?? pidState;
  let lastNote = '';
  const note = (text: string) => {
    if (text !== lastNote) opts.log(text);
    lastNote = text;
  };
  return () => {
    const skipped: string[] = [];
    for (const dir of dirs) {
      const file = join(dir, name);
      let text: string | null;
      try {
        text = readText(file);
      } catch (error) {
        skipped.push(`${file} cannot be read (${error instanceof Error ? error.message : String(error)})`);
        continue;
      }
      const read = readRuntimeFile(text);
      if (read.status === 'missing') continue;
      if (read.status === 'unusable') {
        skipped.push(`${file} is not usable (${read.reason})`);
        continue;
      }
      const { pid, port, token, appVersion } = read.file;
      if (alive(pid) === 'dead') {
        skipped.push(`${file} is left over: process ${pid} is not running`);
        continue;
      }
      note(`found the app: ${file} (Open Planner Studio ${appVersion}, pid ${pid}, port ${port})`);
      return { port, token, appVersion, pid, key: `${pid}|${port}|${token}` };
    }
    note(skipped.length > 0 ? `no running app: ${skipped.join('; ')}` : `no running app: no ${name} in ${dirs.join(' or ')}`);
    return null;
  };
}
