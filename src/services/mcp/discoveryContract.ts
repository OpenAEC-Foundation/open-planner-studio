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
  /** Proces-id van de app (het Rust-proces, niet de webview). Invariant: in elke formatVersion het eigenaarproces. */
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
  /** Proces-id van de app (het Rust-proces, niet de webview). Invariant: in elke formatVersion het eigenaarproces. */
  pid: number;
  /** Versie van de app. */
  appVersion: string;
  /** Moment van de laatste schrijfactie, ISO 8601 in UTC. */
  updatedAt: string;
  /** Paden van de open documenten met een pad op schijf, letterlijk zoals het document ze draagt. Uniek, gesorteerd. */
  files: string[];
}

/** Identifier van de desktop-app (`identifier` in `src-tauri/tauri.conf.json`); de naam van zijn `appDataDir`. */
export const MCP_APP_IDENTIFIER = 'org.openaec.planner';

/** Omgevingsvariabele die de mappen hieronder vervangt door één map (tests, een dev-build, een afwijkende
 *  installatie). Leeg of een niet-ingevulde manifestvariabele (`${…}`) telt als niet gezet. */
export const MCP_DISCOVERY_DIR_ENV = 'OPS_MCP_DISCOVERY_DIR';

/** Wat een lezer over zijn omgeving meegeeft; zo blijft deze module zonder imports. */
export interface DiscoveryLocation {
  /** `process.platform`. */
  platform: string;
  /** De thuismap (`os.homedir()`). */
  home: string;
  env: Record<string, string | undefined>;
}

/**
 * De mappen `<appDataDir>/mcp` waarin de desktop-app de ontdekkingsbestanden schrijft, in de volgorde
 * waarin een lezer ze afloopt (tabel in `docs/mcp-ontdekking.md`). Linux geeft er twee: de gewone map en
 * die van de Snap (snapd zet `HOME` om). `XDG_DATA_HOME` telt alleen als absoluut pad, zoals in de app.
 */
export function mcpDiscoveryDirs(loc: DiscoveryLocation): string[] {
  const override = (loc.env[MCP_DISCOVERY_DIR_ENV] ?? '').trim();
  if (override !== '' && !override.startsWith('${')) return [override];
  const win = loc.platform === 'win32';
  const sep = win ? '\\' : '/';
  const join = (base: string, ...parts: string[]) => [base.replace(/[\\/]+$/, ''), ...parts].join(sep);
  if (win) {
    const appData = (loc.env.APPDATA ?? '').trim();
    return [join(appData !== '' ? appData : join(loc.home, 'AppData', 'Roaming'), MCP_APP_IDENTIFIER, MCP_DISCOVERY_DIR)];
  }
  if (loc.platform === 'darwin') {
    return [join(loc.home, 'Library', 'Application Support', MCP_APP_IDENTIFIER, MCP_DISCOVERY_DIR)];
  }
  const xdg = (loc.env.XDG_DATA_HOME ?? '').trim();
  const data = xdg.startsWith('/') ? xdg : join(loc.home, '.local', 'share');
  return [
    join(data, MCP_APP_IDENTIFIER, MCP_DISCOVERY_DIR),
    join(loc.home, 'snap', 'open-planner-studio', 'current', '.local', 'share', MCP_APP_IDENTIFIER, MCP_DISCOVERY_DIR),
  ];
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
// Een tekstvergelijking is nooit een terugval (twee harde links hebben elk een eigen realpath). Mislukt
// `realpath` of `stat` om een andere reden dan "bestaat aantoonbaar niet" (ENOENT op het pad zelf, met een
// bestaande oudermap), dan weigert de lezer het schrijven. Zie `docs/mcp-ontdekking.md`.

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
// dat er niet is. Voor het register betekent "onbruikbaar": weigeren, behalve als het een geldig `pid`
// draagt van een proces dat aantoonbaar niet meer leeft (zie `openFilesWritePolicy`).
//
// INVARIANT voor elke toekomstige `formatVersion`: het veld `pid` op het hoogste niveau is altijd het
// proces-id van het eigenaarproces (de app die het bestand schreef). Alleen daarom mag een lezer een
// onbruikbaar register met een dood pid vrijgeven. Wie dit wil breken, verandert de bestandsnaam.

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
