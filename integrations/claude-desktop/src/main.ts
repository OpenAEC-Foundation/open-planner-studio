// Startpunt van de Claude Desktop-bundel. Claude Desktop start dit bestand met zijn eigen Node
// (`server.mcp_config` in `manifest.json`) en praat er via stdio mee. De werkmap komt uit de omgeving,
// die het manifest vult uit het installatievenster (`user_config`); poort en token van de app komen uit
// `runtime.json`.
//
// stdout is het MCP-kanaal: log daarom alleen naar stderr (Claude Desktop bewaart dat in zijn logs).
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPlannerProxy } from './proxy';
import { CLAUDE_DESKTOP_SETTINGS_HINT, readBundleConfig } from './config';
import { createAppFinder } from './discovery';
import { createHeadlessStarter } from './headlessChild';

/** Gezet door `scripts/build-mcpb.mjs` (= appversie). */
declare const __OPS_MCPB_VERSION__: string;

const log = (line: string) => process.stderr.write(`[open-planner-studio] ${line}\n`);

const config = readBundleConfig(process.env);
for (const note of config.notes) log(note);

const transport = new StdioServerTransport();
const proxy = createPlannerProxy(
  {
    version: __OPS_MCPB_VERSION__,
    findApp: createAppFinder({
      location: { platform: process.platform, home: homedir(), env: process.env },
      devInstance: config.devInstance,
      log,
    }),
    headless: createHeadlessStarter({
      root: config.root,
      serverFile: join(dirname(fileURLToPath(import.meta.url)), 'headless.mjs'),
      execPath: process.execPath,
      nodeVersion: process.versions.node,
      env: process.env,
      settingsHint: CLAUDE_DESKTOP_SETTINGS_HINT,
      log,
    }),
    log,
  },
  (message) => transport.send(message),
);

const stop = () => { void proxy.close().finally(() => process.exit(0)); };
transport.onmessage = (message) => { void proxy.handle(message); };
transport.onerror = (error) => log(`stdio error: ${error.message}`);
transport.onclose = stop;
// Claude Desktop sluit stdin bij het stoppen van de extensie.
process.stdin.on('end', stop);

await transport.start();
log(`v${__OPS_MCPB_VERSION__} on Node.js ${process.versions.node}: the app when it runs with its MCP bridge, `
  + `otherwise ${config.root ? `the working folder ${config.root}` : 'no working folder set'}`);
