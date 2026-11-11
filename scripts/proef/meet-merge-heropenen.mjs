#!/usr/bin/env node
// Knownbug 1107: meet vóór de bouw de extra volledige open-route op de echte merge-uitvoer.
// Draai onder flock /tmp/ops-zwaar.lock. Geen productiebuild; alleen deze gerichte proef bundelen.
// De generator is letterlijk die van meet-scanner.mjs (#867); geen tweede modelgenerator.
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const work = mkdtempSync(join(tmpdir(), 'ops-1107-kosten-'));
const generator = readFileSync(join(root, 'scripts/proef/meet-scanner.mjs'), 'utf8');
const start = generator.indexOf("const GUID_CHARS =");
const end = generator.indexOf('// ── Het voorbeeld zoals', start);
if (start < 0 || end < 0) throw new Error('modelgenerator niet gevonden');
const makeFile = new Function('openSync', 'writeSync', 'closeSync', generator.slice(start, end) + '\nreturn makeFile;')(openSync, writeSync, closeSync);
const example = readFileSync(join(root, 'public/examples/showcase-appartementencomplex.ifc'), 'utf8');
makeFile(0, join(work, 'basis.ifc'), 'model', example);
const entry = `
import { readFileSync, writeFileSync } from 'node:fs';
import { openForeign, cloneDomain, concat, settle } from '${root}/tests/planning/ifcMergeKern';
import { writeIfcMerge } from '@/services/ifc/foreign/mergeWriter';
const [mode, file] = process.argv.slice(2);
if (mode === 'zetten') {
  writeFileSync(file, await settle(new Uint8Array(readFileSync(file))));
} else {
  const bytes = new Uint8Array(readFileSync(file));
  const opened = await openForeign(bytes);
  if (!opened.ifcSource?.foreign) throw new Error('geen vreemd deel');
  const input = cloneDomain(opened);
  globalThis.gc?.();
  const before = process.memoryUsage();
  const t0 = performance.now();
  const parts = await writeIfcMerge(input, opened.ifcSource);
  const mergeMs = performance.now() - t0;
  const afterMerge = process.memoryUsage();
  const mergePeakKiB = process.resourceUsage().maxRSS;
  const t1 = performance.now();
  // Dit is precies de extra stap die de verplichte naad zou uitvoeren; nog geen vergelijking.
  const reread = await openForeign(concat(parts));
  const reopenMs = performance.now() - t1;
  const afterReopen = process.memoryUsage();
  console.log(JSON.stringify({node: process.version, bytes: bytes.length, tasks: input.tasks.length,
    reopenedTasks: reread.tasks.length, mergeMs, reopenMs, combinedMs: mergeMs + reopenMs,
    before, afterMerge, afterReopen, mergePeakKiB, totalPeakKiB: process.resourceUsage().maxRSS}));
}
`;
try {
  const src = join(work, 'entry.ts'), bundle = join(work, 'entry.mjs');
  writeFileSync(src, entry);
  execFileSync(join(root, 'node_modules/.bin/esbuild'), [src, '--bundle', '--platform=node', '--format=esm',
    `--alias:@=${root}/src`, '--external:react-dom/server', '--define:import.meta.env.DEV=false',
    '--define:import.meta.env.PROD=true', '--define:import.meta.env.MODE="production"',
    '--define:__OPS_DEV_INSTANCE__="test"', '--log-level=error', `--outfile=${bundle}`], {stdio:'inherit'});
  execFileSync(process.execPath, [bundle, 'zetten', join(work, 'basis.ifc')], {stdio:'inherit'});
  const maxId = Math.max(...[...example.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1])));
  const base = readFileSync(join(work, 'basis.ifc'), 'utf8').split('\n')
    .filter(line => { const m = /^#(\d+)=/.exec(line); return !m || Number(m[1]) <= maxId; }).join('\n');
  // De grootste opgeslagen IFC in de repo is 481752 bytes. Maak eenvoudig een groter model van 10 MiB.
  // Twee groottes, dezelfde planning: daarmee is de groei met modelbytes zichtbaar. Geen 300 MB-run.
  for (const mb of [5, 10]) {
    const file = join(work, `model-${mb}.ifc`);
    makeFile(mb, file, 'model', base);
    execFileSync(process.execPath, ['--expose-gc', bundle, 'meten', file], {stdio:'inherit'});
  }
} finally {
  rmSync(work, {recursive:true, force:true});
}
