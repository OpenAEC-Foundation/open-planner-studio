// Schrijft de definities van de `planner_*`-tools als JSON, zoals `tools/list` ze geeft, naar het bestand uit het
// eerste argument. Hosts die de tools in de browser aanroepen (`window.__OPDS_APP__`, zie
// `src/services/mcp/siteAppTools.ts`) leiden hun tooldefinities hiervan af, zodat ze geen tweede lijst bijhouden.
// `npm run build:platform` (`scripts/build-platform.mjs`) draait dit na de Vite-build naar `dist-platform/mcp-tools.json`.
//
//   node scripts/run-ts.mjs scripts/export-mcp-tools.ts dist-platform/mcp-tools.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// De store sleept via zijn slices canvas-code en i18n mee; die verwachten een minimale `document` (zie tests/mcp/harness.ts).
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
// Dezelfde pure functie als `definitions()` van `window.__OPDS_APP__`, getoetst in tests/mcp/cases-site-app-tools.ts.
mkdirSync(dirname(resolve(target)), { recursive: true });
writeFileSync(target, siteAppToolsJson(getTools()));
console.log(`${siteAppToolDefinitions(getTools()).length} tools naar ${target}`);
