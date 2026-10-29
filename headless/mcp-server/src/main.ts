// Ingang van de headless MCP-server van Open Planner Studio (issue #570). Gebouwd door
// `scripts/build-mcp-server.mjs` tot één zelfstandig bestand (`dist-mcp-server/server.mjs`) dat met
// alleen `node server.mjs` draait: zonder repo, zonder `node_modules`. Uitleg: docs/headless-mcp.md.
import { promises as fsp } from 'node:fs';
import { MCP_SERVER_VERSION } from '@/services/mcp/dispatcher';
import { EMBEDDED_ASSETS } from 'ops:embedded-assets';
import { parseOptions, validateToken, OPTION_HELP, type ServerOptions } from './options';
import { createHeadlessHost } from './host';
import { defaultDataDir } from './backupFs';
import { runStdio } from './stdio';
import { startHttpTransport } from './http';

const log = (line: string) => process.stderr.write(`[ops-mcp] ${line}\n`);

/**
 * stdout is het protocolkanaal van stdio. Elke `console.log` uit app-code zou daar een kapot
 * JSON-RPC-bericht van maken; daarom gaat alle console-uitvoer naar stderr.
 */
function consoleToStderr(): void {
  const toErr = (...args: unknown[]) => { console.error(...args); };
  console.log = toErr;
  console.info = toErr;
  console.debug = toErr;
  console.warn = toErr;
}

const writeStdout = (text: string) => new Promise<void>((resolve) => { process.stdout.write(text, () => resolve()); });

async function readToken(opts: ServerOptions): Promise<string> {
  if (opts.token !== null) return validateToken(opts.token);
  if (opts.tokenFile !== null) return validateToken(await fsp.readFile(opts.tokenFile, 'utf8'));
  throw new Error('The HTTP transport needs a Bearer token: set OPS_MCP_TOKEN or --token-file (for example: openssl rand -hex 32)');
}

async function main(): Promise<number> {
  let opts: ServerOptions;
  try {
    opts = parseOptions(process.argv.slice(2), process.env, process.cwd());
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 2;
  }
  if (opts.help) {
    await writeStdout(OPTION_HELP);
    return 0;
  }
  if (opts.version) {
    await writeStdout(`${MCP_SERVER_VERSION}\n`);
    return 0;
  }
  if (opts.transport === 'stdio') consoleToStderr();

  let token = '';
  try {
    if (opts.transport === 'http') token = await readToken(opts);
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
    return 2;
  }

  const dataDir = opts.dataDir ?? defaultDataDir();
  const host = await createHeadlessHost({
    root: opts.root, dataDir, backup: opts.backup, readOnly: opts.readOnly, assets: EMBEDDED_ASSETS, open: opts.open,
  });
  log(`version ${MCP_SERVER_VERSION}; working folder ${host.root}; ` +
    `MCP backups ${opts.backup ? `in ${dataDir}` : 'off'}${opts.readOnly ? '; read-only' : ''}`);

  if (opts.transport === 'stdio') {
    await runStdio({
      input: process.stdin, output: process.stdout,
      buildContext: host.buildContext, handleMessage: host.handleMessage,
    });
    return 0;
  }

  const http = await startHttpTransport({
    token, host: opts.host, port: opts.port,
    buildContext: host.buildContext, handleMessage: host.handleMessage, log,
  });
  // Een vaste regel die een script of test kan lezen om de (eventueel vrije) poort te vinden.
  log(`listening on ${http.url}`);
  await new Promise<void>((resolve) => {
    const stop = () => { void http.close().then(resolve); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
  return 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (error: unknown) => {
    log(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  },
).finally(() => {
  // stdio: stdin is dicht en het laatste antwoord is geschreven; HTTP: de server is gestopt. Open
  // handles (timers van de store) mogen het proces niet in leven houden.
  process.exit();
});
