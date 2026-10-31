// Start de headless MCP-server (`server/headless.mjs` in de bundel, gebouwd door
// `scripts/build-mcp-server.mjs`) als kindproces op de werkmap, en praat er via stdio mee: één JSON-RPC-
// bericht per regel. Eén kindproces per sessie; de proxy hergebruikt het tot hij naar de app wisselt.
//
// Waarom een kindproces en geen import: de server zet per bestandsoperatie de procesmap (`chdir`, zie
// `headless/mcp-server/src/nodeFs.ts`), en dat mag de bundel zelf niet raken. In een worker kan `chdir` niet.
// Het kind krijgt de omgeving van de bundel mee: zo draait het op dezelfde Node als de bundel (ook de
// ingebouwde Node van Claude Desktop, die daar een variabele voor nodig kan hebben).
import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import { createInterface } from 'node:readline';
import type { HeadlessChannel, HeadlessReply, HeadlessStarter } from './proxy';

/** De headless server vraagt Node 22 of nieuwer (`engines` in zijn `package.json`). */
export const HEADLESS_MIN_NODE_MAJOR = 22;

/** Omgevingsvariabelen van de headless server die de bundel zelf bepaalt (of die er niet horen: geen token). */
const CHILD_ENV_DROP = ['OPS_MCP_TRANSPORT', 'OPS_MCP_ROOT', 'OPS_MCP_HOST', 'OPS_MCP_PORT', 'OPS_MCP_TOKEN', 'OPS_MCP_TOKEN_FILE', 'OPS_MCP_OPEN'];

export interface HeadlessStarterOptions {
  /** De werkmap uit het installatievenster, of `null`. */
  root: string | null;
  /** Absoluut pad van `headless.mjs`. */
  serverFile: string;
  /** Node om het kind mee te starten (`process.execPath`). */
  execPath: string;
  /** `process.versions.node`. */
  nodeVersion: string;
  env: Record<string, string | undefined>;
  /** Waar de gebruiker de werkmap instelt; komt in de foutmeldingen. */
  settingsHint: string;
  log: (line: string) => void;
}

export function createHeadlessStarter(opts: HeadlessStarterOptions): HeadlessStarter {
  const choose = `Ask the user to choose a working folder under "Working folder" in ${opts.settingsHint}.`;
  return {
    root: opts.root,
    async start() {
      if (opts.root === null) {
        throw new Error(`No working folder is set for working without the app. ${choose}`);
      }
      const major = Number(opts.nodeVersion.split('.')[0]);
      if (!Number.isInteger(major) || major < HEADLESS_MIN_NODE_MAJOR) {
        throw new Error(`Working without the app needs Node.js ${HEADLESS_MIN_NODE_MAJOR} or newer, and this extension runs on `
          + `Node.js ${opts.nodeVersion}. Ask the user to update Claude Desktop.`);
      }
      let isFolder: boolean;
      try {
        isFolder = (await fsp.stat(opts.root)).isDirectory();
      } catch {
        throw new Error(`The working folder '${opts.root}' does not exist. Ask the user to create it, or to choose another one `
          + `under "Working folder" in ${opts.settingsHint}.`);
      }
      if (!isFolder) throw new Error(`'${opts.root}' is not a folder. ${choose}`);
      return spawnChannel(opts, opts.root);
    },
  };
}

function spawnChannel(opts: HeadlessStarterOptions, root: string): HeadlessChannel {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(opts.env)) {
    if (value !== undefined && !CHILD_ENV_DROP.includes(key)) env[key] = value;
  }
  const child = spawn(opts.execPath, [opts.serverFile, '--transport', 'stdio', '--root', root], {
    env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
  opts.log(`starting the planner without the app (pid ${child.pid ?? '?'}): ${opts.serverFile} --root ${root}`);
  let alive = true;
  let exitDetail = '';
  const stderrTail: string[] = [];
  const pending = new Map<string, (reply: HeadlessReply) => void>();

  const finish = (detail: string) => {
    if (!alive) return;
    alive = false;
    const last = stderrTail.at(-1);
    exitDetail = last ? `${detail}: ${last}` : detail;
    for (const resolve of pending.values()) resolve({ type: 'exited', detail: exitDetail });
    pending.clear();
  };

  createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', (line) => {
    if (line.trim() === '') return;
    let json: unknown;
    try { json = JSON.parse(line); } catch {
      opts.log(`headless: unreadable line on stdout (${line.length} characters)`);
      return;
    }
    const id = typeof json === 'object' && json !== null && 'id' in json ? (json as { id: unknown }).id : undefined;
    const key = JSON.stringify(id ?? null);
    const resolve = pending.get(key);
    if (resolve) {
      pending.delete(key);
      resolve({ type: 'reply', json });
    } else {
      opts.log(`headless: answer without a waiting request (id ${key}); dropped`);
    }
  });
  createInterface({ input: child.stderr, crlfDelay: Infinity }).on('line', (line) => {
    stderrTail.push(line);
    if (stderrTail.length > 5) stderrTail.shift();
    opts.log(`headless: ${line}`);
  });
  child.stdin.on('error', () => { /* het kind is weg; `close` meldt het */ });
  child.on('error', (error) => finish(`could not start Node.js: ${error.message}`));
  child.on('close', (code, signal) => finish(signal ? `ended by signal ${signal}` : `exit code ${code}`));

  const write = (message: unknown) => new Promise<boolean>((resolve) => {
    child.stdin.write(`${JSON.stringify(message)}\n`, (error) => resolve(!error));
  });

  return {
    get alive() { return alive; },
    async request(message, timeoutMs) {
      if (!alive) return { type: 'exited', detail: exitDetail };
      const id = typeof message === 'object' && message !== null && 'id' in message ? (message as { id: unknown }).id : undefined;
      if (id === undefined) {
        await write(message);
        return { type: 'none' };
      }
      const key = JSON.stringify(id);
      const answer = new Promise<HeadlessReply>((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(key);
          resolve({ type: 'timeout' });
        }, timeoutMs);
        pending.set(key, (reply) => {
          clearTimeout(timer);
          resolve(reply);
        });
      });
      if (!(await write(message)) && alive) finish('could not write to the process');
      return answer;
    },
    async close() {
      if (!alive) return;
      child.stdin.end(); // de server stopt als stdin sluit en het laatste antwoord geschreven is
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => { child.kill(); resolve(); }, 2000);
        child.once('close', () => { clearTimeout(timer); resolve(); });
      });
      opts.log('stopped the planner without the app');
    },
  };
}
