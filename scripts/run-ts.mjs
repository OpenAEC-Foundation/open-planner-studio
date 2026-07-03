#!/usr/bin/env node
// Bundelt één TypeScript-entry (met @/-alias naar src/) headless voor Node via esbuild en
// draait 'm meteen — dezelfde techniek als tests/planning/run.sh, maar via de esbuild-JS-API
// zodat de generator/verificatie de ECHTE store + writer/reader kunnen importeren.
//
//   node scripts/run-ts.mjs scripts/generate-examples.ts [args...]
import esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const [entry, ...rest] = process.argv.slice(2);
if (!entry) {
  console.error('gebruik: node scripts/run-ts.mjs <entry.ts> [args...]');
  process.exit(2);
}

const out = join(mkdtempSync(join(tmpdir(), 'ops-runts-')), 'bundle.mjs');
await esbuild.build({
  entryPoints: [resolve(root, entry)],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  alias: { '@': join(root, 'src') },
  logLevel: 'warning',
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': '"production"',
    '__OPS_DEV_INSTANCE__': '"gen"',
  },
});

const r = spawnSync(process.execPath, [out, ...rest], { stdio: 'inherit', cwd: root });
process.exit(r.status ?? 1);
