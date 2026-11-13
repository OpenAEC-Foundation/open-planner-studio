#!/usr/bin/env node
// #916: de gemaakte-koppentabel vers meten met productcode van een opgegeven main-commit.
// node scripts/proef/maak-oude-kop-main.mjs [basis=origin/main] [uitvoer=tests/planning/fixtures/oude-kop-main.json]
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const basis = execFileSync('git', ['-C', root, 'rev-parse', process.argv[2] || 'origin/main'], { encoding: 'utf8' }).trim();
const output = resolve(root, process.argv[3] || 'tests/planning/fixtures/oude-kop-main.json');
mkdirSync(join(root, 'temp'), { recursive: true });
const work = mkdtempSync(join(root, 'temp/oude-kop-main-'));
try {
  const archive = execFileSync('git', ['-C', root, 'archive', basis, 'src'], { maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', work], { input: archive });
  writeFileSync(join(work, 'entry.ts'), `
import { writeFileSync } from 'node:fs';
import { oldHeaderTable } from ${JSON.stringify(join(root, 'tests/planning/ifcOudeKopVergelijking.ts'))};
const rows = await oldHeaderTable(${JSON.stringify(root)});
writeFileSync(${JSON.stringify(output)}, JSON.stringify({ basis: ${JSON.stringify(basis)}, rows }, null, 1) + '\\n');
console.log('OK oude kop: ' + rows.length + ' gevallen vers op main ' + ${JSON.stringify(basis)});
process.exit(0);
`);
  execFileSync(join(root, 'node_modules/.bin/esbuild'), [join(work, 'entry.ts'), '--bundle', '--platform=node', '--format=esm',
    `--alias:@=${join(work, 'src')}`, '--external:react-dom/server', '--define:import.meta.env.DEV=false',
    '--define:import.meta.env.PROD=true', '--define:import.meta.env.MODE="production"', '--define:__OPS_DEV_INSTANCE__="test"',
    `--outfile=${join(work, 'entry.mjs')}`, '--log-level=error'], { cwd: root, stdio: 'inherit' });
  execFileSync(process.execPath, [join(work, 'entry.mjs')], { cwd: root, stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Amsterdam' } });
} finally {
  rmSync(work, { recursive: true, force: true });
}
