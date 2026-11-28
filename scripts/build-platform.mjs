#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE = 'npm run build:platform -- --base /assets/openaec/planner/';

function usageError(message) {
  console.error(`build-platform: ${message}`);
  console.error(`build-platform: Voorbeeld: ${EXAMPLE}`);
  process.exit(2);
}

export function parseArgs(argv) {
  let base;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base') {
      base = argv[i + 1];
      if (base === undefined || base.startsWith('--')) return { error: 'Na --base ontbreekt het basispad.' };
      i++;
    } else if (arg.startsWith('--base=')) {
      base = arg.slice('--base='.length);
    } else {
      return { error: `Onbekend argument: ${arg}` };
    }
  }
  if (base === undefined) return { error: 'Het basispad ontbreekt (--base is verplicht).' };
  return { base };
}

export function validateBase(base) {
  if (base === './') return null;
  if (!base.startsWith('/') || !base.endsWith('/')) {
    return `Het basispad moet "./" zijn, of met "/" beginnen en eindigen, maar is "${base}".`;
  }
  const segments = base.slice(1, -1);
  if (segments === '') return null;
  for (const segment of segments.split('/')) {
    if (segment === '' || segment === '.' || segment === '..' || !/^[A-Za-z0-9._~-]+$/.test(segment)) {
      return `Het basispad "${base}" bevat een ongeldig segment ("${segment}"). Gebruik alleen letters, cijfers en . _ ~ -.`;
    }
  }
  return null;
}

const BUILD_ENV = { ...process.env };
delete BUILD_ENV.OPS_DEV_INSTANCE;
for (const key of Object.keys(BUILD_ENV)) if (key.startsWith('VITE_')) delete BUILD_ENV[key];

function run(bin, args) {
  const command = bin === 'node' ? process.execPath : path.join(ROOT, 'node_modules', '.bin', bin);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', env: BUILD_ENV });
  if (result.error) {
    console.error(`build-platform: ${bin} starten mislukt: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`build-platform: ${bin} faalde (exit ${result.status ?? result.signal}).`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) usageError(parsed.error);
  const problem = validateBase(parsed.base);
  if (problem) usageError(problem);

  console.log(`build-platform: typecheck (tsc)…`);
  run('tsc', []);
  console.log(`build-platform: vite build --mode platform --base ${parsed.base} → dist-platform/`);
  run('vite', ['build', '--mode', 'platform', '--base', parsed.base]);
  console.log(`build-platform: tooldefinities → dist-platform/mcp-tools.json`);
  run('node', ['scripts/run-ts.mjs', 'scripts/export-mcp-tools.ts', 'dist-platform/mcp-tools.json']);
  console.log(`build-platform: klaar: dist-platform/ (manifest: dist-platform/.vite/manifest.json, tools: dist-platform/mcp-tools.json)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
