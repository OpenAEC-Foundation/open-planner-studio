#!/usr/bin/env node
// Knownbug 1107: meet vóór de bouw de extra volledige open-route op de echte merge-uitvoer.
// Draai onder flock /tmp/ops-zwaar.lock. Geen productiebuild; alleen deze gerichte proef bundelen.
// De generator is letterlijk die van meet-scanner.mjs (#867); geen tweede modelgenerator.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const work = mkdtempSync(join(tmpdir(), 'ops-1107-kosten-'));
const entry = `
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { generatedModel } from '${root}/tests/planning/ifcGeneratedModel';
import { openForeign, cloneDomain, concat, settle, canon, openReadPlanning, applyEdit, ordinaryEdits } from '${root}/tests/planning/ifcMergeKern';
import { writeIfcMerge } from '@/services/ifc/foreign/mergeWriter';
import { installDeterminism } from '${root}/tests/planning/ifcPariteitKern';
const reseed = installDeterminism();
const [mode, file] = process.argv.slice(2);
if (mode === 'genereren') {
  writeFileSync(file, generatedModel(${JSON.stringify(root)}, readFileSync(process.argv[5], 'utf8'), Number(process.argv[4])));
} else if (mode === 'zetten') {
  const example = readFileSync(file, 'utf8');
  writeFileSync(file, await settle(generatedModel(${JSON.stringify(root)}, example, 0)));
} else {
  const bytes = new Uint8Array(readFileSync(file));
  const opened = await openForeign(bytes);
  if (!opened.ifcSource?.foreign) throw new Error('geen vreemd deel');
  let input = cloneDomain(opened);
  globalThis.gc?.();
  const before = process.memoryUsage();
  const t0 = performance.now();
  let callbackMs = 0;
  let shown;
  if (mode === 'groot') input = await applyEdit(ordinaryEdits(input).find(e => e.kind === 'duur'), input);
  const parts = await writeIfcMerge(input, opened.ifcSource, async (parsed, side) => {
    const start = performance.now();
    const result = await openReadPlanning(parsed, side);
    callbackMs += performance.now() - start;
    if (side === 'uitvoer') shown = result;
    return result;
  });
  const mergeMs = performance.now() - t0;
  const afterMerge = process.memoryUsage();
  const mergePeakKiB = process.resourceUsage().maxRSS;
  const t1 = performance.now();
  // Volledige bytes-route alleen voor bewijs en ter vergelijking van de kosten.
  const reread = await openForeign(concat(parts));
  const reopenMs = performance.now() - t1;
  const afterReopen = process.memoryUsage();
  if (mode === 'groot') {
    assert(shown);
    assert.equal(canon(shown, reseed), canon(reread, reseed), 'groot model: naad = volledige bytes-route');
  }
  console.log(JSON.stringify({node: process.version, bytes: bytes.length, tasks: input.tasks.length,
    reopenedTasks: reread.tasks.length, mode, callbackMs, mergeMs, reopenMs, combinedMs: mergeMs + reopenMs,
    before, afterMerge, afterReopen, mergePeakKiB, totalPeakKiB: process.resourceUsage().maxRSS}));
}
`;
try {
  const src = join(work, 'entry.ts'), bundle = join(work, 'entry.mjs');
  writeFileSync(join(work, 'basis.ifc'), readFileSync(join(root, 'public/examples/showcase-appartementencomplex.ifc')));
  writeFileSync(src, entry);
  execFileSync(join(root, 'node_modules/.bin/esbuild'), [src, '--bundle', '--platform=node', '--format=esm',
    `--alias:@=${root}/src`, '--external:react-dom/server', '--define:import.meta.env.DEV=false',
    '--define:import.meta.env.PROD=true', '--define:import.meta.env.MODE="production"',
    '--define:__OPS_DEV_INSTANCE__="test"', '--log-level=error', `--outfile=${bundle}`], {stdio:'inherit'});
  execFileSync(process.execPath, [bundle, 'zetten', join(work, 'basis.ifc')], {stdio:'inherit'});
  const example = readFileSync(join(root, 'public/examples/showcase-appartementencomplex.ifc'), 'utf8');
  const maxId = Math.max(...[...example.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1])));
  const base = readFileSync(join(work, 'basis.ifc'), 'utf8').split('\n')
    .filter(line => { const m = /^#(\d+)=/.exec(line); return !m || Number(m[1]) <= maxId; }).join('\n');
  // De grootste opgeslagen IFC in de repo is 481752 bytes. Maak eenvoudig een groter model van 10 MiB.
  // Twee groottes, dezelfde planning: daarmee is de groei met modelbytes zichtbaar. Geen 300 MB-run.
  writeFileSync(join(work, 'basis-gezette.ifc'), base);
  for (const mb of (process.argv.includes('--groot') ? [10] : [5, 10])) {
    const file = join(work, `model-${mb}.ifc`);
    // Generator en grote-modelproef zitten in de gerichte bundel, niet in productie.
    execFileSync(process.execPath, [bundle, 'genereren', file, String(mb), join(work, 'basis-gezette.ifc')], {stdio:'inherit'});
    execFileSync(process.execPath, ['--expose-gc', bundle, process.argv.includes('--groot') ? 'groot' : 'meten', file], {stdio:'inherit'});
  }
} finally {
  rmSync(work, {recursive:true, force:true});
}
