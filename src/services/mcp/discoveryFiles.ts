// Schrijver van de ontdekkingsbestanden voor de MCP-plugin (`runtime.json`, `open-files.json`).
// Contract en uitleg: `discoveryContract.ts` en `docs/mcp-ontdekking.md`.
//
// De kern (`createDiscoveryWriter`) is Tauri-vrij: de bestandsoperaties, het proces-id, de appversie
// en de klok zijn geïnjecteerd, zodat `tests/mcp/cases-discovery.ts` hem headless toetst. De echte
// wiring (`getMcpDiscoveryWriter`) laadt `@tauri-apps/*` dynamisch en alleen in de desktop-app; in de
// browser en in de platformbouw geeft hij `null` en gebeurt er niets.
//
// Alle schrijf- en wisacties lopen achter elkaar door één wachtrij. Zo kan een late schrijfactie
// (bijv. een bridge-start die nog liep) nooit een bestand terugzetten dat een latere stop al wiste.

import { isTauri } from '@/utils/platform';
import {
  MCP_DISCOVERY_DIR,
  MCP_DISCOVERY_DIR_MODE,
  MCP_DISCOVERY_FILE_MODE,
  MCP_DISCOVERY_TMP_SUFFIX,
  buildOpenFilesFile,
  buildRuntimeFile,
  mcpDiscoveryNames,
  openFileList,
  openFilePathsFromDocuments,
  serializeDiscoveryFile,
  type DiscoveryDocumentFields,
  type McpDiscoveryNames,
} from './discoveryContract';

/** Bestandsoperaties binnen de map `<appDataDir>/mcp/`; namen zijn kale bestandsnamen. */
export interface DiscoveryDirFs {
  /** Maak exclusief aan: alleen succes geeft eigendom om later op te ruimen. */
  createNew(name: string, mode: number): Promise<{
    write(text: string): Promise<void>;
    close(): Promise<void>;
  }>;
  /** Vervang `to` door `from` (zelfde map, dus atomair). */
  rename(from: string, to: string): Promise<void>;
  /** Verwijder; een ontbrekend bestand is geen fout. */
  remove(name: string): Promise<void>;
  /** Namen in de map; een ontbrekende map geeft een lege lijst. */
  list(): Promise<string[]>;
}

export interface DiscoveryWriterDeps {
  fs: DiscoveryDirFs;
  names: McpDiscoveryNames;
  /** Proces-id van de app; `null` als het onbekend is (dan schrijft de writer niets). */
  pid: () => Promise<number | null>;
  appVersion: () => Promise<string>;
  now: () => Date;
  /** Uniek stukje voor de naam van een halffabricaat. */
  tmpId: () => string;
  log?: (message: string, error?: unknown) => void;
}

export interface DiscoveryWriter {
  /** De bridge draait (ook na autostart, nieuw token of poortwissel): schrijf `runtime.json`. */
  bridgeStarted(port: number, token: string): Promise<void>;
  /** De bridge is gestopt (of de MCP-koppeling is uitgezet): verwijder `runtime.json`. */
  bridgeStopped(): Promise<void>;
  /** Nieuwe lijst open paden. Schrijft alleen als de (ontdubbelde, gesorteerde) lijst veranderde. */
  setOpenFiles(paths: readonly string[]): Promise<void>;
  /** Bij het opstarten: halffabricaten opruimen en een achtergebleven `runtime.json` weghalen als
   *  de bridge in deze sessie nog niet startte. */
  startup(): Promise<void>;
  /** Bij afsluiten: beide bestanden verwijderen. Daarna schrijft de writer niets meer. */
  shutdown(): Promise<void>;
  /** Wacht tot de wachtrij leeg is (tests). */
  idle(): Promise<void>;
}

export function createDiscoveryWriter(deps: DiscoveryWriterDeps): DiscoveryWriter {
  const log = deps.log ?? ((message, error) => console.warn(message, error));
  let chain: Promise<void> = Promise.resolve();
  let closed = false;
  /** Is in deze sessie al een runtime-bestand gevraagd? Dan ruimt `startup` het niet meer op. */
  let runtimeRequested = false;
  /** Sleutel van de laatst gevraagde lijst open paden (`null` = nog nooit geschreven). */
  let openFilesKey: string | null = null;
  let pidWarned = false;

  function enqueue(label: string, job: () => Promise<void>): Promise<void> {
    const next = chain.then(job).catch((error: unknown) => {
      log(`MCP-ontdekking: ${label} mislukt`, error);
    });
    chain = next;
    return next;
  }

  async function knownPid(): Promise<number | null> {
    const pid = await deps.pid();
    if (pid === null && !pidWarned) {
      pidWarned = true;
      log('MCP-ontdekking: proces-id onbekend; de ontdekkingsbestanden worden niet geschreven');
    }
    return pid;
  }

  async function writeAtomic(name: string, text: string): Promise<void> {
    const tmp = `${name}.${deps.tmpId()}${MCP_DISCOVERY_TMP_SUFFIX}`;
    const file = await deps.fs.createNew(tmp, MCP_DISCOVERY_FILE_MODE);
    // Na exclusieve aanmaak is het halffabricaat van ons, ook als schrijven deels faalt.
    const removeOwnTemp = async () => {
      try { await deps.fs.remove(tmp); } catch (error) { log('MCP-ontdekking: eigen halffabricaat opruimen mislukt', error); }
    };
    try {
      await file.write(text);
    } catch (error) {
      try { await file.close(); } catch { /* behoud de oorspronkelijke schrijffout */ }
      await removeOwnTemp();
      throw error;
    }
    try {
      await file.close(); // Windows: sluiten vóór rename of remove.
    } catch (error) {
      await removeOwnTemp();
      throw error;
    }
    try {
      await deps.fs.rename(tmp, name);
    } catch (first) {
      // Windows: het doel kan heel even open staan bij een lezer. Eén keer opnieuw, dan opgeven.
      try {
        await deps.fs.rename(tmp, name);
      } catch {
        await removeOwnTemp();
        throw first;
      }
    }
  }

  async function removeQuietly(name: string): Promise<void> {
    try { await deps.fs.remove(name); } catch (error) { log(`MCP-ontdekking: ${name} verwijderen mislukt`, error); }
  }

  return {
    bridgeStarted(port, token) {
      if (closed) return Promise.resolve();
      runtimeRequested = true;
      const startedAt = deps.now();
      return enqueue('runtime-bestand schrijven', async () => {
        if (closed) return;
        const pid = await knownPid();
        if (pid === null) return;
        const appVersion = await deps.appVersion();
        await writeAtomic(deps.names.runtime, serializeDiscoveryFile(buildRuntimeFile({ pid, port, token, appVersion, startedAt })));
      });
    },

    bridgeStopped() {
      if (closed) return Promise.resolve();
      return enqueue('runtime-bestand verwijderen', () => removeQuietly(deps.names.runtime));
    },

    setOpenFiles(paths) {
      if (closed) return Promise.resolve();
      const files = openFileList(paths);
      const key = JSON.stringify(files);
      if (key === openFilesKey) return Promise.resolve();
      openFilesKey = key;
      const updatedAt = deps.now();
      return enqueue('register van open bestanden schrijven', async () => {
        if (closed) return;
        const pid = await knownPid();
        if (pid === null) return;
        const appVersion = await deps.appVersion();
        try {
          await writeAtomic(deps.names.openFiles, serializeDiscoveryFile(buildOpenFilesFile({ pid, appVersion, updatedAt, paths: files })));
        } catch (error) {
          // Mislukt: de volgende aanroep met dezelfde lijst moet het opnieuw proberen.
          if (openFilesKey === key) openFilesKey = null;
          throw error;
        }
      });
    },

    startup() {
      if (closed) return Promise.resolve();
      return enqueue('opruimen bij opstarten', async () => {
        const own = [deps.names.runtime, deps.names.openFiles];
        const names = await deps.fs.list();
        for (const name of names) {
          if (!name.endsWith(MCP_DISCOVERY_TMP_SUFFIX)) continue;
          if (own.some((base) => name.startsWith(`${base}.`))) await removeQuietly(name);
        }
        // Een runtime-bestand van een vorige sessie (crash, of een webview-herlaad terwijl de bridge
        // nog liep) beschrijft geen bridge die deze sessie bedient. Startte de bridge al in deze
        // sessie, dan is het bestand van ons en blijft het staan.
        if (!runtimeRequested && names.includes(deps.names.runtime)) await removeQuietly(deps.names.runtime);
      });
    },

    shutdown() {
      if (closed) return chain;
      closed = true;
      return enqueue('opruimen bij afsluiten', async () => {
        await removeQuietly(deps.names.runtime);
        await removeQuietly(deps.names.openFiles);
      });
    },

    idle() {
      return chain;
    },
  };
}

// --- Welke paden staan open (store-vrij, structureel getypt) --------------------------------------

/** Het deel van de app-state dat het register nodig heeft. */
export interface DiscoveryStateView extends DiscoveryDocumentFields {
  documents: ReadonlyArray<{ id: string; payload: DiscoveryDocumentFields | null }>;
  activeDocumentId: string;
}

/** De ruwe paden van alle open documenten: het actieve document uit de live state, de andere uit hun payload. */
export function openFilePathsFromState(state: DiscoveryStateView, tauri: boolean): string[] {
  const live: DiscoveryDocumentFields = { filePath: state.filePath, fileHandle: state.fileHandle, siteFileId: state.siteFileId };
  const docs: DiscoveryDocumentFields[] = state.documents.length === 0
    ? [live]
    : state.documents.flatMap((d) => {
      if (d.id === state.activeDocumentId) return [live];
      return d.payload ? [d.payload] : [];
    });
  return openFilePathsFromDocuments(docs, tauri);
}

// --- Live wiring (alleen desktop-app) --------------------------------------------------------------

declare global {
  interface Window {
    /** Gezet door het initialisatiescript `ops-process-info` in `src-tauri/src/main.rs`. */
    __OPS_PROCESS__?: { pid: number };
  }
}

function readInjectedPid(): number | null {
  const pid = typeof window !== 'undefined' ? window.__OPS_PROCESS__?.pid : undefined;
  return Number.isSafeInteger(pid) && (pid as number) > 0 ? (pid as number) : null;
}

let liveWriter: DiscoveryWriter | null = null;

function randomTmpId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function createLiveDirFs(): DiscoveryDirFs {
  let dirPromise: Promise<string> | null = null;
  const dir = async (): Promise<string> => {
    if (!dirPromise) {
      dirPromise = (async () => {
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const { mkdir } = await import('@tauri-apps/plugin-fs');
        const path = await join(await appDataDir(), MCP_DISCOVERY_DIR);
        // `mode` geldt alleen bij aanmaken en wordt op Windows genegeerd; daar beschermt de
        // standaard-ACL van het gebruikersprofiel de map.
        await mkdir(path, { recursive: true, mode: MCP_DISCOVERY_DIR_MODE });
        return path;
      })();
      dirPromise.catch(() => { dirPromise = null; });
    }
    return dirPromise;
  };
  const pathOf = async (name: string): Promise<string> => {
    const { join } = await import('@tauri-apps/api/path');
    return join(await dir(), name);
  };
  return {
    async createNew(name, mode) {
      const { open } = await import('@tauri-apps/plugin-fs');
      const file = await open(await pathOf(name), { read: false, write: true, createNew: true, mode });
      return {
        write: async text => {
          const bytes = new TextEncoder().encode(text);
          let offset = 0;
          // plugin-fs gebruikt File::write: ook korte writes volledig afmaken.
          while (offset < bytes.length) {
            const written = await file.write(bytes.subarray(offset));
            if (!Number.isInteger(written) || written <= 0 || written > bytes.length - offset) {
              throw new Error('Incomplete discovery file write');
            }
            offset += written;
          }
        },
        close: () => file.close(),
      };
    },
    async rename(from, to) {
      const { rename } = await import('@tauri-apps/plugin-fs');
      await rename(await pathOf(from), await pathOf(to));
    },
    async remove(name) {
      const { remove, exists } = await import('@tauri-apps/plugin-fs');
      const path = await pathOf(name);
      if (await exists(path)) await remove(path);
    },
    async list() {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      try {
        return (await readDir(await dir())).filter((e) => e.isFile).map((e) => e.name);
      } catch {
        return [];
      }
    },
  };
}

/**
 * De writer van deze app-sessie, of `null` buiten de desktop-app (browser, platformbouw, tests).
 * Eén exemplaar per webview-sessie, zodat bridge en register dezelfde wachtrij delen.
 */
export function getMcpDiscoveryWriter(): DiscoveryWriter | null {
  if (!isTauri()) return null;
  if (!liveWriter) {
    liveWriter = createDiscoveryWriter({
      fs: createLiveDirFs(),
      names: mcpDiscoveryNames(__OPS_DEV_INSTANCE__ || null),
      pid: () => Promise.resolve(readInjectedPid()),
      appVersion: async () => {
        const { getVersion } = await import('@tauri-apps/api/app');
        return getVersion();
      },
      now: () => new Date(),
      tmpId: randomTmpId,
    });
  }
  return liveWriter;
}
