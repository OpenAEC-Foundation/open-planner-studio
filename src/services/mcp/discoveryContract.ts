export const MCP_DISCOVERY_FORMAT_VERSION = 1;

export const MCP_DISCOVERY_DIR = 'mcp';

export const MCP_DISCOVERY_FILE_MODE = 0o600;

export const MCP_DISCOVERY_DIR_MODE = 0o700;

export const MCP_DISCOVERY_TMP_SUFFIX = '.tmp';

export interface McpRuntimeFile {
  formatVersion: 1;
  pid: number;
  port: number;
  token: string;
  appVersion: string;
  startedAt: string;
}

export interface McpOpenFilesFile {
  formatVersion: 1;
  pid: number;
  appVersion: string;
  updatedAt: string;
  files: string[];
}

export const MCP_APP_IDENTIFIER = 'org.openaec.planner';

export const MCP_DISCOVERY_DIR_ENV = 'OPS_MCP_DISCOVERY_DIR';

export interface DiscoveryLocation {
  platform: string;
  home: string;
  env: Record<string, string | undefined>;
}

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

export interface McpDiscoveryNames {
  runtime: string;
  openFiles: string;
}

export function mcpDiscoveryNames(devInstance: string | null | undefined): McpDiscoveryNames {
  const suffix = devInstance ? `.${devInstance}` : '';
  return { runtime: `runtime${suffix}.json`, openFiles: `open-files${suffix}.json` };
}

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

export function serializeDiscoveryFile(file: McpRuntimeFile | McpOpenFilesFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function openFileList(paths: readonly string[]): string[] {
  const set = new Set<string>();
  for (const p of paths) {
    if (typeof p === 'string' && p !== '') set.add(p);
  }
  return [...set].sort();
}

export interface DiscoveryDocumentFields {
  filePath: string | null;
  fileHandle: unknown;
  siteFileId: string | null;
}

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

export type DiscoveryRead<T> =
  | { status: 'missing' }
  | { status: 'valid'; file: T }
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

export type PidState = 'alive' | 'dead' | 'unknown';

export function openFilesWritePolicy(
  read: DiscoveryRead<McpOpenFilesFile>,
  pidState: (pid: number) => PidState,
): 'free' | 'check-files' | 'refuse-all' {
  if (read.status === 'missing') return 'free';
  if (read.status === 'valid') return pidState(read.file.pid) === 'dead' ? 'free' : 'check-files';
  if (read.pid !== null && pidState(read.pid) === 'dead') return 'free';
  return 'refuse-all';
}
