#!/usr/bin/env node
import esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
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

const tempDir = mkdtempSync(join(tmpdir(), 'ops-runts-'));
try {
  const out = join(tempDir, 'bundle.mjs');
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
  process.exitCode = r.status ?? 1;
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
