// Mechanische eigendomsgrens voor storegebonden runtimecode.
//
// Deze check draait de echte repositorypoort en bewijst daarnaast met tijdelijke bronfixtures dat
// de poort semantische importdeclaraties beoordeelt (geen commentaar-grep), verboden singleton-
// bindingen afwijst en domeinlogica in de twee compatibiliteitsadapters niet laat binnensluipen.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const diffs: string[] = [];
let checks = 0;

function ok(label: string, condition: boolean, detail = ''): void {
  checks++;
  if (!condition) diffs.push(`${label}${detail ? `: ${detail}` : ''}`);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const script = join(root, 'scripts', 'verify-store-boundaries.mjs');

function run(checkRoot: string) {
  return spawnSync(process.execPath, [script, '--root', checkRoot], {
    cwd: root,
    encoding: 'utf8',
  });
}

function fixture(files: Record<string, string>): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'ops-store-boundaries-'));
  for (const [relative, source] of Object.entries(files)) {
    const target = join(fixtureRoot, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source, 'utf8');
  }
  return fixtureRoot;
}

// 1. De actuele repository moet door exact dezelfde poort als `npm run verify`.
const repository = run(root);
ok('1 actuele storegrenzen zijn groen', repository.status === 0,
  `${repository.stdout}${repository.stderr}`.trim());

// 2. Commentaartekst en type-only imports zijn geen runtime-singletonlek.
const cleanRoot = fixture({
  'src/services/mcp/tools/clean.ts': [
    "// import { useAppStore } from '@/state/appStore';",
    "import type { AppState, AppStoreContext } from '@/state/appStore';",
    'export function read(context: AppStoreContext): AppState {',
    '  return context.store.getState();',
    '}',
  ].join('\n'),
});
try {
  const clean = run(cleanRoot);
  ok('2 commentaar en type-imports blijven toegestaan', clean.status === 0,
    `${clean.stdout}${clean.stderr}`.trim());
} finally {
  rmSync(cleanRoot, { recursive: true, force: true });
}

// 3. Eén fixture injecteert twee onafhankelijke overtredingen. De poort moet beide rapporteren:
// een echte value-import in storegebonden toolcode én een storemutatie in een dunne adapter.
const brokenRoot = fixture({
  'src/services/mcp/tools/leak.ts': [
    "import { appStoreContext } from '@/state/appStore';",
    'export const leaked = appStoreContext;',
  ].join('\n'),
  'src/state/batchTransaction.ts': [
    "import { appStoreContext } from './appStore';",
    'export const leakedState = appStoreContext.store.getState();',
  ].join('\n'),
  'src/state/mcpTransaction.ts': "export { createMcpTransactions } from './runtime/createMcpTransactions';\n",
});
try {
  const broken = run(brokenRoot);
  const output = `${broken.stdout}${broken.stderr}`;
  ok('3 verboden singletonimport geeft exit ongelijk aan nul', broken.status !== 0, output.trim());
  ok('3a rapport noemt het lekkende toolbestand', output.includes('src/services/mcp/tools/leak.ts'), output.trim());
  ok('3b rapport noemt de verboden singletonbinding', output.includes('appStoreContext'), output.trim());
  ok('3c adapterlogica wordt afzonderlijk gemeld',
    output.includes('src/state/batchTransaction.ts') && output.includes('.getState('), output.trim());
} finally {
  rmSync(brokenRoot, { recursive: true, force: true });
}

if (diffs.length === 0) {
  console.log(`OK: store-runtime-grenzen — ${checks} checks groen`);
} else {
  console.log(`XX store-runtime-grenzen — ${diffs.length} van ${checks} checks rood:`);
  for (const diff of diffs) console.log(`  - ${diff}`);
  process.exit(1);
}
