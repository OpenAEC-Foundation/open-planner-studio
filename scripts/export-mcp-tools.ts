import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

(globalThis as { document?: unknown }).document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => null }),
  documentElement: { dir: 'ltr', lang: 'en', setAttribute() {}, style: {} },
};

const { getTools } = await import('@/services/mcp/toolRegistry');
const { siteAppToolsJson, siteAppToolDefinitions } = await import('@/services/mcp/siteAppTools');

const target = process.argv[2];
if (!target) {
  console.error('gebruik: node scripts/run-ts.mjs scripts/export-mcp-tools.ts <uitvoerbestand>');
  process.exit(2);
}
mkdirSync(dirname(resolve(target)), { recursive: true });
writeFileSync(target, siteAppToolsJson(getTools()));
console.log(`${siteAppToolDefinitions(getTools()).length} tools naar ${target}`);
