// MCP-toolregistry — volledigheidscheck (contract ⇄ registratie).
//
// Zie docs/recepten/mcp-tool.md voor het volledige recept van een nieuwe tool. Dit bestand is het
// mechanische vangnet daarachter: het bewijst dat elke tool die in de broncode staat als
// `McpToolDef` met een `name: 'planner_...'` óók daadwerkelijk in `registerAllTools()` terechtkomt —
// en omgekeerd dat er geen geregistreerde tool bestaat zonder zo'n bron-literal, met EXACT gelijke
// namen. Zonder deze poort compileert een vergeten regel in `MODULES` (`toolRegistry.ts`) gewoon:
// het tool-bestand exporteert zijn array keurig, TypeScript ziet niets fout, en de tool verdwijnt
// stilzwijgend uit `tools/list` — precies het gat dat `cases-schemavalidatie.ts` (dat tegen een
// hardgecodeerd aantal van 39 test) niet dicht: dat bestand bewijst dat de AL geregistreerde set
// intern consistent is, niet dat er niets aan die set ontbreekt.
//
// Let op het onderscheid met Poort 7e in `scripts/verify-docs.ts`: die telt `planner_*`-literals in
// dezelfde map en vergelijkt alleen het GETAL met de "N `planner_*`-tools"-bewering in CLAUDE.md.
// Beide scannen dezelfde bron, maar Poort 7e bewaakt de documentatie; dit bestand bewaakt de
// registratie zelf.
//
// De bron-van-waarheid hier is een REGEX-scan van `src/services/mcp/tools/*.ts` op `name: '...'`-
// literals — bewust dezelfde scanmethode als Poort 7e, en bewust GEEN introspectie van de al
// geregistreerde staat (dat zou de vraag "is er iets vergeten?" niet kunnen beantwoorden).
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, assertEq, run } from './harness';
import { getTools, registerAllTools } from '@/services/mcp/toolRegistry';

// esbuild bundelt dit bestand naar tests/mcp/.cases-toolregistry.mjs (zie run.sh); twee mapniveaus
// omhoog vanaf de OUTPUT-locatie is de repo-root, ongeacht de cwd waarmee run.sh is aangeroepen.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOOLS_DIR = join(ROOT, 'src', 'services', 'mcp', 'tools');

/** Alle `name: 'planner_...'`-literals in de tool-broncode — de "contracten" uit het recept. */
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
