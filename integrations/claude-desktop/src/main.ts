// Startpunt van de Claude Desktop-bundel. Claude Desktop start dit bestand met zijn eigen Node
// (`server.mcp_config` in `manifest.json`) en praat er via stdio mee. Token en poort komen uit de
// omgeving, die het manifest vult uit het installatievenster (`user_config`).
//
// stdout is het MCP-kanaal: log daarom alleen naar stderr (Claude Desktop bewaart dat in zijn logs).
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createBridgeProxy } from './proxy';
import { CLAUDE_DESKTOP_SETTINGS_HINT, readProxyConfig } from './config';

/** Gezet door `scripts/build-mcpb.mjs` (= appversie). */
declare const __OPS_MCPB_VERSION__: string;

const log = (line: string) => process.stderr.write(`[open-planner-studio] ${line}\n`);

const config = readProxyConfig(process.env);
for (const note of config.notes) log(note);

const transport = new StdioServerTransport();
const proxy = createBridgeProxy(
  { port: config.port, token: config.token, version: __OPS_MCPB_VERSION__, settingsHint: CLAUDE_DESKTOP_SETTINGS_HINT, log },
  (message) => transport.send(message),
);

transport.onmessage = (message) => { void proxy.handle(message); };
transport.onerror = (error) => log(`stdio error: ${error.message}`);
transport.onclose = () => process.exit(0);
// Claude Desktop sluit stdin bij het stoppen van de extensie.
process.stdin.on('end', () => process.exit(0));

await transport.start();
log(`v${__OPS_MCPB_VERSION__}: forwarding to http://127.0.0.1:${config.port}/mcp${config.token ? '' : ' (no token set)'}`);
