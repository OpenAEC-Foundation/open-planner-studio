#!/usr/bin/env node
// #804 fase 1a: de verwachting voor de pariteitsproef tegen main (bijsturing 1 punt 2 van de orkestrator).
//
// Eis: met de flag `ifcForeignContent` uit opent en bewaart de app een IFC-bestand byte-gelijk aan main, en weigert hij
// een bestand met een gebouwmodel met dezelfde melding. Dit script draait de kern `tests/planning/ifcPariteitKern.ts`
// met de code van main (`git archive` van BASIS) op de invoer uit de werkmap, en schrijft de uitkomst naar
// `tests/planning/fixtures/main-pariteit.json`. `check-ifc-foreign-pariteit.ts` draait dezelfde kern met de code van de
// branch en vergelijkt.
//
// Licht: één esbuild-bundel en één Node-proces. Draaien:
//   node scripts/proef/maak-main-pariteit.mjs                 # de fixture opnieuw maken
//   node scripts/proef/maak-main-pariteit.mjs --uitvoer <map>  # ook de volledige uitvoer van main per bestand (diffen)
// Opnieuw maken is nodig als een invoerbestand verandert (de check meldt dat), of na een bewuste wijziging van lezer of
// writer op main: kies dan een nieuwe BASIS en zeg dat in de PR.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASIS = 'a4783fc35';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'tests/planning/fixtures/main-pariteit.json');
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
const uitvoerAt = process.argv.indexOf('--uitvoer');
const uitvoerDir = uitvoerAt >= 0 ? resolve(process.argv[uitvoerAt + 1]) : '';

// De werkmap staat in de repo (`temp/` is genegeerd), zodat esbuild de pakketten in `node_modules` vindt.
mkdirSync(join(ROOT, 'temp'), { recursive: true });
const work = mkdtempSync(join(ROOT, 'temp', 'ops-pariteit-'));
try {
  const tar = execFileSync('git', ['-C', ROOT, 'archive', BASIS, 'src'], { maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', work], { input: tar });
  const kern = join(ROOT, 'tests/planning/ifcPariteitKern.ts');
  writeFileSync(join(work, 'entry.ts'), `
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parityFixture } from ${JSON.stringify(kern)};
const [root, out, basis, uitvoer] = process.argv.slice(2);
const { fixture, saved } = await parityFixture(root, basis);
writeFileSync(out, JSON.stringify(fixture, null, 1) + '\\n');
if (uitvoer) {
  for (const [pad, text] of saved) {
    const target = join(uitvoer, pad);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, text);
  }
}
process.exit(0);
`);
  const bundle = join(work, 'entry.mjs');
  execFileSync(ESBUILD, [join(work, 'entry.ts'), '--bundle', '--platform=node', '--format=esm', `--alias:@=${join(work, 'src')}`,
    '--log-level=error', '--external:react-dom/server', '--define:import.meta.env.DEV=false',
    '--define:import.meta.env.PROD=true', '--define:import.meta.env.MODE="production"', '--define:__OPS_DEV_INSTANCE__="test"',
    `--outfile=${bundle}`], { stdio: 'inherit', cwd: ROOT });
  execFileSync(process.execPath, [bundle, ROOT, OUT, BASIS, uitvoerDir], {
    stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Amsterdam' },
  });
  console.log(`OK  pariteit met main ${BASIS}: ${OUT.slice(ROOT.length + 1)}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
