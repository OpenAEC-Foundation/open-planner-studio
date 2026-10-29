// Opties van de headless MCP-server: elke optie als CLI-vlag én als omgevingsvariabele (handig in de
// configuratie van een MCP-client of plugin). Een CLI-vlag wint van de omgevingsvariabele.
// Puur: geen bestandstoegang, geen proces-globals behalve de meegegeven `env`/`cwd`.
import path from 'node:path';

export type Transport = 'stdio' | 'http';

export interface ServerOptions {
  transport: Transport;
  /** Werkmap: de enige map waarin de bestands-tools lezen en schrijven. */
  root: string;
  host: string;
  port: number;
  /** Bearer-token voor HTTP (verplicht bij `http`). Nooit via een CLI-vlag: die is zichtbaar in `ps`. */
  token: string | null;
  tokenFile: string | null;
  /** Map voor de MCP-backups (`<dataDir>/ai-backups/…`). `null` = de standaard per platform. */
  dataDir: string | null;
  backup: boolean;
  readOnly: boolean;
  /** Bestand dat bij de start als document wordt geopend (zoals `planner_import_schedule`). */
  open: string | null;
  help: boolean;
  version: boolean;
}

/** Standaardpoort voor HTTP: één naast de bridge van de app (3877), zodat beide naast elkaar kunnen. */
export const DEFAULT_HTTP_PORT = 3878;

export const OPTION_HELP = `Open Planner Studio — headless MCP server

Usage: node server.mjs [options]

Options (each also as an environment variable; the flag wins):
  --transport <stdio|http>  OPS_MCP_TRANSPORT   default: stdio
  --root <dir>              OPS_MCP_ROOT        working folder for file tools; default: current folder
  --host <address>          OPS_MCP_HOST        HTTP only; loopback only; default: 127.0.0.1
  --port <n>                OPS_MCP_PORT        HTTP only; default: ${DEFAULT_HTTP_PORT} (0 = any free port)
  --token-file <file>       OPS_MCP_TOKEN_FILE  HTTP only; file with the Bearer token
                            OPS_MCP_TOKEN       HTTP only; the Bearer token itself (no flag: flags show in ps)
  --data-dir <dir>          OPS_MCP_DATA_DIR    where MCP backups go (<dir>/ai-backups); default: per-user data folder
  --no-backup               OPS_MCP_BACKUP=off  no MCP backup before the first change per document
  --read-only               OPS_MCP_READ_ONLY=1 refuse every mutating tool (READ_ONLY)
  --open <file>             OPS_MCP_OPEN        open this schedule at start (path inside --root)
  --version                                     print the version and exit
  --help                                        print this help and exit
`;

const BOOL_TRUE = new Set(['1', 'true', 'yes', 'on']);
const BOOL_FALSE = new Set(['0', 'false', 'no', 'off']);

function envBool(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const v = raw.trim().toLowerCase();
  if (BOOL_TRUE.has(v)) return true;
  if (BOOL_FALSE.has(v)) return false;
  throw new Error(`${name} must be one of: ${[...BOOL_TRUE, ...BOOL_FALSE].join(', ')}`);
}

function parsePort(raw: string, source: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`${source} must be a port number from 0 to 65535`);
  return n;
}

/** Is dit een loopback-adres? Alleen dan luistert de HTTP-transport (zoals de bridge van de app). */
export function isLoopbackHost(host: string): boolean {
  if (host === 'localhost' || host === '::1' || host === '[::1]') return true;
  const m = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  return m !== null && m.slice(1).every((part) => Number(part) <= 255);
}

/** Lees argv + env. Gooit een `Error` met een Engelse uitleg bij een ongeldige optie. */
export function parseOptions(argv: readonly string[], env: NodeJS.ProcessEnv, cwd: string): ServerOptions {
  const flags = new Map<string, string | true>();
  const valued = new Set(['transport', 'root', 'host', 'port', 'token-file', 'data-dir', 'open']);
  const switches = new Set(['no-backup', 'read-only', 'help', 'version']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument '${arg}'. Run with --help.`);
    const eq = arg.indexOf('=');
    const name = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    if (name === 'token') {
      throw new Error('There is no --token flag (a flag is visible to other users in the process list). Use OPS_MCP_TOKEN or --token-file.');
    }
    if (switches.has(name)) {
      if (eq >= 0) throw new Error(`--${name} takes no value`);
      flags.set(name, true);
      continue;
    }
    if (!valued.has(name)) throw new Error(`Unknown option '--${name}'. Run with --help.`);
    const value = eq >= 0 ? arg.slice(eq + 1) : argv[++i];
    if (value === undefined || value === '') throw new Error(`--${name} needs a value`);
    flags.set(name, value);
  }
  const pick = (flag: string, envName: string): string | null => {
    const f = flags.get(flag);
    if (typeof f === 'string') return f;
    const e = env[envName];
    return e !== undefined && e !== '' ? e : null;
  };

  const transportRaw = pick('transport', 'OPS_MCP_TRANSPORT') ?? 'stdio';
  if (transportRaw !== 'stdio' && transportRaw !== 'http') {
    throw new Error(`transport must be 'stdio' or 'http', not '${transportRaw}'`);
  }
  const host = pick('host', 'OPS_MCP_HOST') ?? '127.0.0.1';
  if (!isLoopbackHost(host)) {
    throw new Error(`host '${host}' is not a loopback address. The HTTP transport only listens on this computer ` +
      '(127.0.0.1, ::1 or localhost), like the bridge in the desktop app.');
  }
  const portRaw = typeof flags.get('port') === 'string' ? flags.get('port') as string : env.OPS_MCP_PORT;
  const port = portRaw !== undefined && portRaw !== ''
    ? parsePort(portRaw, flags.has('port') ? '--port' : 'OPS_MCP_PORT')
    : DEFAULT_HTTP_PORT;
  const resolveFrom = (p: string | null) => (p === null ? null : path.resolve(cwd, p));
  const tokenFile = resolveFrom(pick('token-file', 'OPS_MCP_TOKEN_FILE'));
  const token = env.OPS_MCP_TOKEN !== undefined && env.OPS_MCP_TOKEN !== '' ? env.OPS_MCP_TOKEN : null;
  if (token !== null && tokenFile !== null) throw new Error('Set OPS_MCP_TOKEN or a token file, not both');

  return {
    transport: transportRaw,
    root: path.resolve(cwd, pick('root', 'OPS_MCP_ROOT') ?? '.'),
    host,
    port,
    token,
    tokenFile,
    dataDir: resolveFrom(pick('data-dir', 'OPS_MCP_DATA_DIR')),
    backup: flags.has('no-backup') ? false : envBool(env, 'OPS_MCP_BACKUP', true),
    readOnly: flags.has('read-only') ? true : envBool(env, 'OPS_MCP_READ_ONLY', false),
    open: pick('open', 'OPS_MCP_OPEN'),
    help: flags.has('help'),
    version: flags.has('version'),
  };
}

/** Minimale tokenlengte: een te kort token is te raden. Het token van de app is 64 hex-tekens. */
export const MIN_TOKEN_LENGTH = 32;

/** Controleer een token (na trimmen). Gooit bij een ongeldige waarde. */
export function validateToken(token: string): string {
  const t = token.trim();
  if (t.length < MIN_TOKEN_LENGTH) {
    throw new Error(`The Bearer token must be at least ${MIN_TOKEN_LENGTH} characters (for example: openssl rand -hex 32)`);
  }
  if (!/^[\x21-\x7e]+$/.test(t)) throw new Error('The Bearer token may only contain visible ASCII characters');
  return t;
}
