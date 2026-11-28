import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, assertEq, run } from './harness';
import { getTools, registerAllTools } from '@/services/mcp/toolRegistry';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOOLS_DIR = join(ROOT, 'src', 'services', 'mcp', 'tools');

function scanContractNames(): string[] {
  const names: string[] = [];
  for (const file of readdirSync(TOOLS_DIR)) {
    if (!file.endsWith('.ts')) continue;
    const src = readFileSync(join(TOOLS_DIR, file), 'utf8');
    for (const m of src.matchAll(/\bname:\s*["'](planner_[a-z_]+)["']/g)) names.push(m[1]);
  }
  return names;
}

test('elke tool-naam-literal in de broncode komt precies één keer voor (geen kopieerfout)', () => {
  const seen = new Map<string, number>();
  for (const n of scanContractNames()) seen.set(n, (seen.get(n) ?? 0) + 1);
  const dupes = [...seen.entries()].filter(([, c]) => c > 1).map(([n, c]) => `${n} (${c}×)`);
  assertEq(dupes, [], `dubbele naam-literals in src/services/mcp/tools/: ${dupes.join(', ')}`);
});

test('elke tool in de broncode is geregistreerd, en omgekeerd — namen matchen exact', () => {
  registerAllTools();
  const sourceNames = [...new Set(scanContractNames())].sort();
  const registeredNames = getTools().map((t) => t.name).sort();

  const missing = sourceNames.filter((n) => !registeredNames.includes(n));
  const extra = registeredNames.filter((n) => !sourceNames.includes(n));

  assertEq(
    missing, [],
    `deze tool(s) staan met een \`name:\`-literal in src/services/mcp/tools/ maar zijn NIET ` +
    `geregistreerd (module vergeten in toolRegistry.ts's MODULES, of het exporterende bestand ` +
    `niet geïmporteerd — zie docs/recepten/mcp-tool.md): ${missing.join(', ') || '(geen)'}`,
  );
  assertEq(
    extra, [],
    `deze tool(s) zijn geregistreerd maar hebben geen \`name: '...'\`-literal in ` +
    `src/services/mcp/tools/ (spookregistratie, of de scan-regex mist een schrijfwijze): ` +
    `${extra.join(', ') || '(geen)'}`,
  );
  assertEq(
    sourceNames.length, registeredNames.length,
    `aantal tools loopt uiteen: broncode ${sourceNames.length}, registry ${registeredNames.length}`,
  );
  assertEq(sourceNames, registeredNames, 'de exacte naamverzamelingen moeten gelijk zijn');
});

test('elke geregistreerde tool heeft een niet-leeg objectschema (contract ⇒ schema)', () => {
  registerAllTools();
  const offenders: string[] = [];
  for (const t of getTools()) {
    const s = t.inputSchema as { type?: unknown; properties?: unknown } | null | undefined;
    if (!s || typeof s !== 'object' || s.type !== 'object' || typeof s.properties !== 'object' || s.properties === null) {
      offenders.push(t.name);
    }
  }
  assertEq(offenders, [], `deze tool(s) hebben geen (bruikbaar) objectschema: ${offenders.join(', ')}`);
});

await run();
