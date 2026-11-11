#!/usr/bin/env node
// #886, fixronde 1 (besluit van Trias, 11 november 2026): de toets van Trias vergelijkt de merge met een gewone opslag op
// main, niet met de writer van de branch. Dit script draait de route van `tests/planning/ifcAppRoute.ts`
// (`plainSaveAfterF5`: het bestand zonder model openen via de app, een dag langer, F5, opslaan) met de code van main
// (`git archive` van BASIS), en schrijft per bestand de sha256 van de uitvoer naar
// `tests/planning/fixtures/main-toets-trias.json`. `check-ifc-foreign-oude-eigen.ts` draait dezelfde route met de code van
// de branch, eist dezelfde bytes, en vergelijkt pas dan de planning met die van de merge.
//
// Licht: één esbuild-bundel en één Node-proces. Draaien: `node scripts/proef/maak-main-toets-trias.mjs`. Opnieuw maken is
// nodig als een invoerbestand verandert (de check meldt dat), of na een bewuste wijziging op main: kies dan een nieuwe
// BASIS (dezelfde als `maak-main-pariteit.mjs`) en zeg dat in de PR.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASIS = '20b9af79a74e7d886c2a38f93bba1adbcbb2ba5c';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'tests/planning/fixtures/main-toets-trias.json');
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');

mkdirSync(join(ROOT, 'temp'), { recursive: true });
const work = mkdtempSync(join(ROOT, 'temp', 'ops-toets-trias-'));
try {
  const tar = execFileSync('git', ['-C', ROOT, 'archive', BASIS, 'src'], { maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', work], { input: tar });
  writeFileSync(join(work, 'entry.ts'), `
import { writeFileSync } from 'node:fs';
import { trias } from ${JSON.stringify(join(ROOT, 'tests/planning/ifcAppRoute.ts'))};
const [root, out, basis] = process.argv.slice(2);
writeFileSync(out, JSON.stringify({ basis, bestanden: await trias(root) }, null, 1) + '\\n');
process.exit(0);
`);
  const bundle = join(work, 'entry.mjs');
  execFileSync(ESBUILD, [join(work, 'entry.ts'), '--bundle', '--platform=node', '--format=esm', `--alias:@=${join(work, 'src')}`,
    '--log-level=error', '--external:react-dom/server', '--define:import.meta.env.DEV=false',
    '--define:import.meta.env.PROD=true', '--define:import.meta.env.MODE="production"', '--define:__OPS_DEV_INSTANCE__="test"',
    `--outfile=${bundle}`], { stdio: 'inherit', cwd: ROOT });
  execFileSync(process.execPath, [bundle, ROOT, OUT, BASIS], { stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Amsterdam' } });
  console.log(`OK  toets van Trias tegen main ${BASIS}: ${OUT.slice(ROOT.length + 1)}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
