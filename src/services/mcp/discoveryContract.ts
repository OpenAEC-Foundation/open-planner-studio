// Ontdekkingscontract app ↔ MCP-plugin (issue #570, "Ontwerp: één plugin, drie situaties").
//
// De desktop-app schrijft twee kleine JSON-bestanden in `<appDataDir>/mcp/`. De plugin (een headless
// MCP-server die buiten de app draait) leest ze en kiest daarmee per aanvraag:
//   - `runtime.json`    — bestaat zolang de MCP-bridge van de app draait. Daarmee vindt de plugin poort
//                         en token zelf; plakken is niet meer nodig. Draait de bridge, dan stuurt de
//                         plugin alles door naar de app.
//   - `open-files.json` — bestaat zolang de desktop-app draait, ook met de MCP-koppeling uit. Een
//                         plugin die zelf op bestanden werkt, weigert elk pad dat hierin staat.
//
// Deze module is HET contract: typen, bestandsnamen, de opbouw van de inhoud en de leesregels. Hij
// importeert niets (geen store, geen Tauri, geen i18n), zodat de plugin hem ongewijzigd kan bundelen.
// Uitleg voor mensen: `docs/mcp-ontdekking.md`. Een wijziging hier is een contractwijziging: een
// nieuw verplicht veld of een andere betekenis vraagt een hogere `formatVersion`.

/** Huidige versie van beide bestandsformaten. Een andere waarde maakt een bestand voor deze lezer
 *  onbruikbaar (niet afwezig): zie `readOpenFilesFile` en `openFilesWritePolicy`. */
export const MCP_DISCOVERY_FORMAT_VERSION = 1;

/** Submap van `appDataDir` waarin beide bestanden staan. */
export const MCP_DISCOVERY_DIR = 'mcp';

/** Unix-rechten van beide bestanden: alleen de eigenaar mag lezen en schrijven (het token is geheim). */
export const MCP_DISCOVERY_FILE_MODE = 0o600;

/** Unix-rechten van de map `mcp/`: alleen de eigenaar. */
export const MCP_DISCOVERY_DIR_MODE = 0o700;

/** Achtervoegsel van een halffabricaat. Een lezer slaat namen met dit achtervoegsel over. */
export const MCP_DISCOVERY_TMP_SUFFIX = '.tmp';

/** Inhoud van `runtime.json`. */
export interface McpRuntimeFile {
  formatVersion: 1;
  /** Proces-id van de app (het Rust-proces, niet de webview). */
  pid: number;
  /** TCP-poort van de bridge op `127.0.0.1`. */
  port: number;
  /** Bearer-token voor `Authorization: Bearer <token>`. */
  token: string;
  /** Versie van de app, zoals `2026.43.1`. */
  appVersion: string;
  /** Moment waarop deze bridge startte, ISO 8601 in UTC. */
  startedAt: string;
}

/** Inhoud van `open-files.json`. */
export interface McpOpenFilesFile {
  formatVersion: 1;
  /** Proces-id van de app (het Rust-proces, niet de webview). */
  pid: number;
  /** Versie van de app. */
  appVersion: string;
  /** Moment van de laatste schrijfactie, ISO 8601 in UTC. */
  updatedAt: string;
  /** Paden van de open documenten met een pad op schijf, letterlijk zoals het document ze draagt. Uniek, gesorteerd. */
  files: string[];
}

/** Bestandsnamen. Een productiebuild gebruikt de canonieke namen; een dev-instantie (worktree-slug,
 *  `OPS_DEV_INSTANCE`) schrijft `runtime.<slug>.json` en `open-files.<slug>.json`, zodat twee
 *  dev-builds naast elkaar elkaars bestanden niet overschrijven (zelfde reden als de recovery-namen). */
export interface McpDiscoveryNames {
  runtime: string;
  openFiles: string;
}

export function mcpDiscoveryNames(devInstance: string | null | undefined): McpDiscoveryNames {
  const suffix = devInstance ? `.${devInstance}` : '';
  return { runtime: `runtime${suffix}.json`, openFiles: `open-files${suffix}.json` };
}

// --- Inhoud opbouwen --------------------------------------------------------------------------------

export interface RuntimeFileInput {
  pid: number;
  port: number;
  token: string;
  appVersion: string;
  startedAt: Date;
}

export function buildRuntimeFile(input: RuntimeFileInput): McpRuntimeFile {
  return {
    formatVersion: MCP_DISCOVERY_FORMAT_VERSION,
    pid: input.pid,
    port: input.port,
    token: input.token,
    appVersion: input.appVersion,
    startedAt: input.startedAt.toISOString(),
  };
}

export interface OpenFilesInput {
  pid: number;
  appVersion: string;
  updatedAt: Date;
  /** Paden (al gefilterd op `FileRef` van de soort `path`); blijven letterlijk. */
  paths: readonly string[];
}

export function buildOpenFilesFile(input: OpenFilesInput): McpOpenFilesFile {
  return {
    formatVersion: MCP_DISCOVERY_FORMAT_VERSION,
    pid: input.pid,
    appVersion: input.appVersion,
    updatedAt: input.updatedAt.toISOString(),
    files: openFileList(input.paths),
  };
}

/** Bestandstekst: JSON met twee spaties inspringing en een slot-newline. */
export function serializeDiscoveryFile(file: McpRuntimeFile | McpOpenFilesFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

// --- Paden ------------------------------------------------------------------------------------------
//
// De app bewaart de paden LETTERLIJK, zoals het document ze draagt (uit de bestandskiezer van het OS of
// uit Opslaan als). Geen trim, geen `..`-oplossing, geen hoofdlettercorrectie: elke omvorming kan een
// ander bestand aanwijzen (een POSIX-naam mag op een spatie eindigen, een backslash bevatten, enz.).
// Alleen lege waarden vallen weg; de lijst wordt ontdubbeld en gesorteerd.
//
// Wie het register gebruikt om te beslissen of hij mag schrijven, vergelijkt BESTANDSIDENTITEIT, geen
// tekst: `realpath` van beide kanten en dan `stat` (dev + ino; op Windows het bestandsindex-nummer via
// `fs.stat(…, { bigint: true })`). Zo vallen ook symlinks, harde links en andere schrijfwijzen samen.
// Zie `docs/mcp-ontdekking.md`.

/** Ontdubbel en sorteer (vaste volgorde ⇒ geen onnodige schrijfactie); paden blijven letterlijk. */
export function openFileList(paths: readonly string[]): string[] {
  const set = new Set<string>();
  for (const p of paths) {
    if (typeof p === 'string' && p !== '') set.add(p);
  }
  return [...set].sort();
}

// --- Welke documenten tellen mee ------------------------------------------------------------------

/** De opslagvelden van één open document (live state van het actieve document, of de payload). */
export interface DiscoveryDocumentFields {
  filePath: string | null;
  fileHandle: unknown;
  siteFileId: string | null;
}

/**
 * De ruwe paden van de open documenten met een `FileRef` van de soort `path`. Dezelfde voorrang als
 * `saveTargetRef` in `src/services/fileAccess/index.ts`: een site-bestand of een browserhandle is
 * geen pad op schijf. Alleen in de desktop-app (`tauri`) is `filePath` een echt pad; in de browser is
 * het alleen de bestandsnaam.
 */
export function openFilePathsFromDocuments(docs: readonly DiscoveryDocumentFields[], tauri: boolean): string[] {
  if (!tauri) return [];
  const out: string[] = [];
  for (const d of docs) {
    if (d.siteFileId) continue;
    if (d.fileHandle) continue;
    if (d.filePath) out.push(d.filePath);
  }
  return out;
}

// --- Lezen (voor de plugin) -----------------------------------------------------------------------
//
// Drie uitkomsten, nooit twee: een bestand dat er WEL is maar dat de lezer niet begrijpt (kapotte JSON,
// verkeerd veldtype, andere `formatVersion`, bijv. van een nieuwere app) is iets anders dan een bestand
// dat er niet is. Voor het register betekent "onbruikbaar" dus nooit schrijftoestemming.

/** Uitkomst van het lezen van één ontdekkingsbestand. */
export type DiscoveryRead<T> =
  /** Het bestand bestaat niet. */
  | { status: 'missing' }
  /** Het bestand volgt dit contract. */
  | { status: 'valid'; file: T }
  /** Het bestand bestaat, maar volgt dit contract niet. `pid` alleen als dat veld wel een geldig pid is. */
  | { status: 'unusable'; reason: string; pid: number | null };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPid(v: unknown): v is number {
  return Number.isSafeInteger(v) && (v as number) > 0;
}

function unusable(reason: string, v: unknown): { status: 'unusable'; reason: string; pid: number | null } {
  return { status: 'unusable', reason, pid: isRecord(v) && isPid(v.pid) ? v.pid : null };
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try { return { ok: true, value: JSON.parse(text) }; } catch { return { ok: false }; }
}

/**
 * Lees `runtime.json`. `text === null` betekent: het bestand bestaat niet. Extra velden mogen (en worden
 * weggelaten); dat laat de app later velden toevoegen zonder versiesprong. Bij `unusable` verbindt de
 * plugin niet met de app.
 */
export function readRuntimeFile(text: string | null): DiscoveryRead<McpRuntimeFile> {
  if (text === null) return { status: 'missing' };
  const parsed = parseJson(text);
  if (!parsed.ok) return unusable('geen geldige JSON', null);
  const v = parsed.value;
  if (!isRecord(v)) return unusable('geen object', null);
  if (v.formatVersion !== MCP_DISCOVERY_FORMAT_VERSION) return unusable(`onbekende formatVersion ${JSON.stringify(v.formatVersion)}`, v);
  const { pid, port, token, appVersion, startedAt } = v;
  if (!isPid(pid)) return unusable('pid ongeldig', v);
  if (!Number.isInteger(port) || (port as number) < 1 || (port as number) > 65535) return unusable('port ongeldig', v);
  if (typeof token !== 'string' || token === '') return unusable('token ongeldig', v);
  if (typeof appVersion !== 'string' || typeof startedAt !== 'string') return unusable('appVersion of startedAt ongeldig', v);
  return { status: 'valid', file: { formatVersion: 1, pid, port: port as number, token, appVersion, startedAt } };
}

/** Lees `open-files.json`; zelfde drie uitkomsten als `readRuntimeFile`. */
export function readOpenFilesFile(text: string | null): DiscoveryRead<McpOpenFilesFile> {
  if (text === null) return { status: 'missing' };
  const parsed = parseJson(text);
  if (!parsed.ok) return unusable('geen geldige JSON', null);
  const v = parsed.value;
  if (!isRecord(v)) return unusable('geen object', null);
  if (v.formatVersion !== MCP_DISCOVERY_FORMAT_VERSION) return unusable(`onbekende formatVersion ${JSON.stringify(v.formatVersion)}`, v);
  const { pid, appVersion, updatedAt, files } = v;
  if (!isPid(pid)) return unusable('pid ongeldig', v);
  if (typeof appVersion !== 'string' || typeof updatedAt !== 'string') return unusable('appVersion of updatedAt ongeldig', v);
  if (!Array.isArray(files) || !files.every((f) => typeof f === 'string')) return unusable('files ongeldig', v);
  return { status: 'valid', file: { formatVersion: 1, pid, appVersion, updatedAt, files: files as string[] } };
}

/** Leeft het proces? `unknown` als de lezer het niet kan vaststellen (dan geldt: mogelijk levend). */
export type PidState = 'alive' | 'dead' | 'unknown';

/**
 * Wat het register betekent voor een SCHRIJVENDE aanvraag van de plugin in de bestandsstand:
 *  - `free`        — geen register, of het hoort bij een proces dat niet meer leeft: geen beperking;
 *  - `check-files` — geldig register van een (mogelijk) levende app: weiger elk doel dat dezelfde
 *                    bestandsidentiteit heeft als een pad in `files`;
 *  - `refuse-all`  — het register bestaat maar is onbruikbaar, en de app leeft mogelijk (of het pid is
 *                    onbekend): weiger elke schrijvende aanvraag. Een nieuwere app kan open bestanden
 *                    registreren in een formaat dat deze lezer niet kent.
 */
export function openFilesWritePolicy(
  read: DiscoveryRead<McpOpenFilesFile>,
  pidState: (pid: number) => PidState,
): 'free' | 'check-files' | 'refuse-all' {
  if (read.status === 'missing') return 'free';
  if (read.status === 'valid') return pidState(read.file.pid) === 'dead' ? 'free' : 'check-files';
  if (read.pid !== null && pidState(read.pid) === 'dead') return 'free';
  return 'refuse-all';
}
