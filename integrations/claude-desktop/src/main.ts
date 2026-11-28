import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPlannerProxy } from './proxy';
import { CLAUDE_DESKTOP_SETTINGS_HINT, readBundleConfig } from './config';
import { createAppFinder } from './discovery';
import { createHeadlessStarter } from './headlessChild';

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
process.stdin.on('end', stop);

await transport.start();
log(`v${__OPS_MCPB_VERSION__} on Node.js ${process.versions.node}: the app when it runs with its MCP bridge, `
  + `otherwise ${config.root ? `the working folder ${config.root}` : 'no working folder set'}`);
