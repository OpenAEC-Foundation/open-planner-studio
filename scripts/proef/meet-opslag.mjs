#!/usr/bin/env node
// #804, meting grote bestanden stap 1 (meet-branch, niet voor main): één opslag van een document met een gebouwmodel,
// mét een wijziging en zonder, bij 50/150/300 MB, in Node. Per grootte in eigen Node-processen:
//   1. openen: het bestand lezen, `readIfcBytesDetailed` zonder worker (de lezing alleen), en daarna openen zoals de app
//      (`openInStore`: `openOpenedFile` met de flag, met de omzetting, de herberekening en `ifcSource.opened`);
//   2. één gewone wijziging: de duur van de vaste taak een dag langer (`ordinaryEdits(...).find(e => e.kind === 'duur')`,
//      zoals `meet-merge-heropenen.mjs --groot`);
//   3. de opslagworker nagebootst: `structuredClone` van de opdracht `{ kind: 'merge', input, source }` (de kopie naar de
//      worker), `handleIfcSaveRequest` op die kopie (het werk van de worker), `structuredClone` met overdracht van het
//      antwoord (terug) en `outputFromResult` (overnemen op de hoofdthread);
//   4. alleen met wijziging: de vervangroute `replaceOwnFileBytes` met de echte plugin-fs-client op Node-fs
//      (`tests/planning/nodeFileIpc.ts`) op een echt bestand, met de tijd per bestandsbewerking.
// Zonder wijziging (de snelle weg, reeks van knownbug 1021): stap 1 (zonder de losse lezing) en 3.
// Daarnaast per grootte één run met `node --cpu-prof`; de samenvatting per functie neemt alleen de monsters binnen het
// werk van de worker (stap 3b).
// De generator is `makeFile` uit meet-scanner.mjs (zoals tests/planning/ifcGeneratedModel.ts); geen tweede generator.
// Lokaal alleen tot en met 10 MB; groter alleen in CI (`CI=true`).
//
//   node scripts/proef/meet-opslag.mjs --mb=10 --runs=1 --heap=2048 --out=/tmp/x.json        # lokaal
//   node scripts/proef/meet-opslag.mjs --mb=50,150,300 --runs=3 --out=meting-opslag.json --dir=meting-opslag   # CI
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
const EXAMPLE = join(ROOT, 'public/examples/showcase-appartementencomplex.ifc');
const CAP_MB = 300;

const opts = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (!m) throw new Error(`onbekend argument: ${a}`);
  return [m[1], m[2] ?? '1'];
}));
const sizes = (opts.mb ?? '10').split(',').map(Number);
const runs = Number(opts.runs ?? 3);
const heap = Number(opts.heap ?? 8192);
const childTimeoutMs = Number(opts['timeout-min'] ?? 20) * 60_000;
if (sizes.some(s => !(s > 0)) || !(runs >= 1)) throw new Error('--mb verwacht getallen, --runs minstens 1');
if (sizes.some(s => s > 10) && process.env.CI !== 'true') {
  console.error('Boven 10 MB alleen in CI (gedeelde kantoor-pc). Gebruik de handmatige job in ifc-foreign.yml.');
  process.exit(2);
}
const outDir = resolve(opts.dir ?? mkdtempSync(join(tmpdir(), 'ops-meet-opslag-uit-')));
mkdirSync(outDir, { recursive: true });
const work = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'ops-meet-opslag-'));

// ── Bundel: dezelfde esbuild-instellingen als tests/planning/run.sh ─────────────────────────────────────────────
const fontkit = createRequire(join(ROOT, 'tests/planning/x.js')).resolve('fontkit');
const UNICODE_TRIE = join(dirname(createRequire(fontkit).resolve('unicode-properties')), 'binaryTrie.browser.js');
const ESBUILD_ARGS = [`--alias:#binary-trie=${UNICODE_TRIE}`, '--log-level=error', '--bundle', '--platform=node', '--format=esm',
  `--alias:@=${join(ROOT, 'src')}`, '--external:react-dom/server', '--define:import.meta.env.DEV=false',
  '--define:import.meta.env.PROD=true', '--define:import.meta.env.MODE="production"', '--define:__OPS_DEV_INSTANCE__="test"'];
const T = p => JSON.stringify(join(ROOT, p));
writeFileSync(join(work, 'opslag-entry.ts'), `
import { copyFileSync, createReadStream, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { openInStore } from ${T('tests/planning/ifcAppRoute.ts')};
import { applyEdit, cloneDomain, ordinaryEdits, settle } from ${T('tests/planning/ifcMergeKern.ts')};
import { installNodeFileIpc } from ${T('tests/planning/nodeFileIpc.ts')};
import { readIfcBytesDetailed } from '@/services/ifc/foreign/ifcBytesRoute';
import { handleIfcSaveRequest, outputFromResult } from '@/services/ifc/saveWorker/ifcSaveProtocol';
import { replaceOwnFileBytes, tauriOwnFileReplaceFs, type OwnFileReplaceFs } from '@/services/fileAccess/ownFileReplace';
import type { IfcSaveJob } from '@/state/prepareIfcOutput';

const [mode, file, tmp] = process.argv.slice(2);
if (mode === 'zetten') {
  writeFileSync(tmp, await settle(new Uint8Array(readFileSync(file))));
  process.exit(0);
}
const gc = (globalThis as { gc?: () => void }).gc ?? (() => {});
const MB = (n: number) => Math.round(n / 1048576 * 10) / 10;
const emit = (o: unknown) => process.stdout.write(JSON.stringify(o) + '\\n');
const mem = () => {
  const m = process.memoryUsage();
  return { heapMB: MB(m.heapUsed), arrayBuffersMB: MB(m.arrayBuffers), rssMB: MB(m.rss), maxRssMB: Math.round(process.resourceUsage().maxRSS / 1024) };
};
/** Eén stap: gc vooraf (buiten de tijd), dan de tijd en het geheugen direct na de stap. Meteen naar stdout, zodat bij
 *  een geheugenfout of time-out de laatst bereikte stap bekend is. */
async function step<R>(name: string, fn: () => R | Promise<R>): Promise<R> {
  gc();
  emit({ begin: name, ...mem() });
  const t0 = performance.now();
  const result = await fn();
  emit({ stap: name, ms: Math.round((performance.now() - t0) * 10) / 10, ...mem() });
  return result;
}
const hr = () => Number(process.hrtime.bigint() / 1000n);
emit({ mode, node: process.version, pid: process.pid, ...mem() });

const bytes = await step('1a bestand lezen', () => new Uint8Array(readFileSync(file)));
if (mode !== 'snel') {
  let raw: unknown = await step('1b readIfcBytesDetailed (zonder worker)', () => readIfcBytesDetailed(bytes, {}, { createWorker: () => null }));
  raw = null;
}
const { store, snapshot } = await step('1c openen zoals de app (openInStore)', () => openInStore(bytes, 'model.ifc'));
const opened = snapshot(store);
const source = store.getState().ifcSource!;
if (!source?.foreign || !source.opened) throw new Error('geen bron met een vreemd deel en opened na openen');
let entities = 0;
for (const id of source.chunkIds) if (id >= 0) entities++;
emit({ bron: { bytes: source.bytes.length, stukkenMetId: entities, vreemdeObjecten: source.foreignObjectCount, taken: opened.tasks.length } });

let input = cloneDomain(opened);
if (mode !== 'snel') {
  const edit = ordinaryEdits(input).find(e => e.kind === 'duur');
  if (!edit) throw new Error('geen duurwijziging');
  input = await step('2 wijziging (duur een dag langer)', () => applyEdit(edit, input));
}
const job: IfcSaveJob = { kind: 'merge', input, source };
let copy: IfcSaveJob | null = await step('3a kopie naar de worker (structuredClone)', () => structuredClone(job));
const window3 = { beginUs: 0, eindUs: 0 };
const handled = await step('3b werk van de worker (handleIfcSaveRequest)', async () => {
  window3.beginUs = hr();
  const r = await handleIfcSaveRequest({ id: 1, job: copy! });
  window3.eindUs = hr();
  return r;
});
copy = null;
emit({ venster3b: window3 });
const { response, transfer } = handled;
if ('error' in response) {
  emit({ uitkomst: 'fout in de worker', fout: response.error.type + ': ' + response.error.message.slice(0, 500),
    cases: (response.error.data as { cases?: unknown[] }).cases?.slice(0, 5) });
  process.exit(3);
}
if (!('result' in response)) throw new Error('onverwacht antwoord');
const back = await step('3c overdracht terug (structuredClone met transfer)', () => structuredClone(response, { transfer }));
const output = await step('3d overnemen (outputFromResult)', () => outputFromResult(job, back.result));
const prepared = output.prepared!;
emit({ uitkomst: back.result.kind, uitvoerBytes: prepared.bytes.length, overgedragenMB: MB(transfer.reduce((a, b) => a + b.byteLength, 0)) });

if (mode === 'met') {
  const target = join(tmp, 'doel-' + process.pid + '.ifc');
  copyFileSync(file, target);
  const ipc = installNodeFileIpc();
  const base = await tauriOwnFileReplaceFs();
  const names: Record<string, string[]> = { createNew: ['4.1 tijdelijk bestand schrijven'], content: ['4.2 inhoudscontrole doel', '4.5 inhoudscontrole vorige versie'],
    place: ['4.3 doel opzij (place_file_exclusive)', '4.4 tijdelijk bestand plaatsen'], remove: ['4.6 opruimen vorige versie'], lstat: ['4.0 lstat'] };
  const seen: Record<string, number> = {};
  const timed = <K extends keyof OwnFileReplaceFs>(k: K): OwnFileReplaceFs[K] => (async (...args: unknown[]) => {
    const i = seen[k] = (seen[k] ?? -1) + 1;
    const name = names[k]?.[i] ?? k + ' #' + (i + 1);
    gc();
    const t0 = performance.now();
    const r = await (base[k] as (...a: unknown[]) => Promise<unknown>)(...args);
    emit({ stap: name, ms: Math.round((performance.now() - t0) * 10) / 10, ...mem() });
    return r;
  }) as OwnFileReplaceFs[K];
  const fs: OwnFileReplaceFs = { lstat: timed('lstat'), createNew: timed('createNew'), remove: timed('remove'), place: timed('place'), content: timed('content') };
  const outcome = await step('4 vervangroute (replaceOwnFileBytes, totaal)', () => replaceOwnFileBytes(fs, {
    path: target, id: 'meting' + process.pid, bytes: prepared.bytes, source: job.source.bytes,
    label: () => 'versie van ander programma', refuseBeforePlace: () => false,
  }));
  const sha = await new Promise<string>((done, fail) => {
    const h = createHash('sha256');
    createReadStream(target).on('data', d => h.update(d)).on('end', () => done(h.digest('hex'))).on('error', fail);
  });
  emit({ vervanging: outcome.code, doelGelijkAanUitvoer: sha === prepared.sha256, ipcAanroepen: ipc.calls.length });
  ipc.dispose();
  rmSync(target, { force: true });
}
emit({ klaar: true, ...mem() });
`);
execFileSync(ESBUILD, [join(work, 'opslag-entry.ts'), ...ESBUILD_ARGS, `--outfile=${join(work, 'opslag.mjs')}`], { cwd: ROOT, stdio: 'inherit' });

// ── De generator: letterlijk `makeFile` uit meet-scanner.mjs (zoals ifcGeneratedModel.ts) ─────────────────────────
const generator = readFileSync(join(ROOT, 'scripts/proef/meet-scanner.mjs'), 'utf8');
const gStart = generator.indexOf('const GUID_CHARS =');
const gEnd = generator.indexOf('// ── Het voorbeeld zoals', gStart);
if (gStart < 0 || gEnd < 0) throw new Error('modelgenerator niet gevonden');
const makeFile = new Function('openSync', 'writeSync', 'closeSync', `${generator.slice(gStart, gEnd)}\nreturn makeFile;`)(openSync, writeSync, closeSync);
// Het voorbeeld zoals de huidige writer het schrijft, zoals meet-scanner.mjs het doet.
const exampleText = readFileSync(EXAMPLE, 'utf8');
const maxExampleId = Math.max(...[...exampleText.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1])));
const probe = join(work, 'voorbeeld-met-model.ifc');
makeFile(0, probe, 'model', exampleText);
execFileSync(process.execPath, [join(work, 'opslag.mjs'), 'zetten', probe, probe], { stdio: 'inherit' });
const BASE_TEXT = readFileSync(probe, 'utf8').split('\n')
  .filter(line => { const m = /^#(\d+)=/.exec(line); return !m || Number(m[1]) <= maxExampleId; }).join('\n');
rmSync(probe, { force: true });

// ── Een kindproces: alle JSON-regels, en bij een fout de laatste stap en het einde van stderr ─────────────────────
function child(mode, file, extra = []) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--expose-gc', `--max-old-space-size=${heap}`, ...extra, join(work, 'opslag.mjs'), mode, file, work],
    { encoding: 'utf8', maxBuffer: 1 << 26, timeout: childTimeoutMs, killSignal: 'SIGKILL' });
  const lines = (r.stdout || '').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return { tekst: l }; } });
  const steps = lines.filter(l => l.stap);
  const info = Object.assign({}, ...lines.filter(l => !l.stap && !l.begin));
  const lastBegin = [...lines].reverse().find(l => l.begin);
  const ok = r.status === 0 && info.klaar === true;
  return {
    mode, ok, status: r.status, signal: r.signal, wandMs: Date.now() - t0, steps, ...info,
    ...(ok ? {} : { laatsteBegonnenStap: lastBegin ?? null, stderr: (r.stderr || '').trim().split('\n').slice(-8).join('\n') }),
  };
}

// ── De verdeling per functie uit het profiel, alleen binnen het venster van stap 3b ─────────────────────────────
const WATCH = ['handleIfcSaveRequest', 'prepareIfcWrite', 'scanForeignStep', 'scanStep', 'classify', 'assertSameSource',
  'pristineDomain', 'buildLines', 'writeIfcMergeLines', 'sourceFormWhereUnchanged', 'lossCheck', 'changedScopes', 'readPlanning',
  'preserveAuxiliaryIdentities', 'assemble', 'concatParts', 'checkedBytes', 'validateMergeOutput', 'foreignScanFrom',
  'pristineFromScan', 'openMergePlanning', 'planningCanon', 'unchangedPlanningNumberProblem', 'ownOutputProblem',
  'writtenSource', 'precomputeSha256', 'digest', 'structuredClone', '(garbage collector)'];
function summarize(profile, window) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const nameOf = n => n.callFrame.functionName || `(anoniem ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1})`;
  // Tijdstip van elk monster; de duur van een monster is de afstand tot het volgende.
  const times = [];
  let t = profile.startTime;
  for (const d of profile.timeDeltas) { t += d; times.push(t); }
  const inWindow = window && window.beginUs >= profile.startTime && window.eindUs <= profile.endTime;
  const lo = inWindow ? window.beginUs : profile.startTime, hi = inWindow ? window.eindUs : profile.endTime;
  const incl = new Map(), self = new Map();
  let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const at = times[i];
    if (at < lo || at > hi) continue;
    const dur = (i + 1 < times.length ? times[i + 1] : profile.endTime) - at;
    if (dur <= 0) continue;
    const leaf = nodes.get(profile.samples[i]);
    if (!leaf || leaf.callFrame.functionName === '(idle)') continue;
    total += dur;
    self.set(nameOf(leaf), (self.get(nameOf(leaf)) ?? 0) + dur);
    const onStack = new Set();
    for (let id = leaf.id; id !== undefined; id = parent.get(id)) onStack.add(nameOf(nodes.get(id)));
    for (const name of onStack) incl.set(name, (incl.get(name) ?? 0) + dur);
  }
  const s = us => Math.round(us / 1000) / 1000;
  const pct = us => Math.round(us / total * 1000) / 10;
  return {
    venster: inWindow ? 'stap 3b' : 'heel het proces (venster viel buiten het profiel)',
    vensterS: s(hi - lo), bemonsterdS: s(total),
    benoemd: WATCH.filter(n => incl.has(n)).map(n => ({ functie: n, inclusiefS: s(incl.get(n)), deel: pct(incl.get(n)), eigenS: s(self.get(n) ?? 0) })),
    topInclusief: [...incl].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([n, us]) => ({ functie: n, inclusiefS: s(us), deel: pct(us) })),
    topEigen: [...self].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([n, us]) => ({ functie: n, eigenS: s(us), deel: pct(us) })),
  };
}

// ── Meten ────────────────────────────────────────────────────────────────────────────────────────────────────────
const results = [];
for (const mb of sizes) {
  const fileMb = mb >= CAP_MB ? CAP_MB - 0.5 : mb;
  const file = join(work, `model-${mb}mb.ifc`);
  const walls = makeFile(fileMb, file, 'model', BASE_TEXT);
  const row = { mb, fileMb, bytes: statSync(file).size, walls, met: [], snel: [] };
  console.error(`# ${mb} MB: ${row.bytes} bytes, ${walls} wanden`);
  for (let r = 0; r < runs; r++) {
    for (const mode of ['met', 'snel']) {
      const res = child(mode, file);
      row[mode].push(res);
      console.error(`# ${mb} MB ${mode} run ${r + 1}: ${res.ok ? 'ok' : 'MISLUKT'} in ${res.wandMs} ms, piek ${res.steps.at(-1)?.maxRssMB ?? '?'} MB`);
      writeFileSync(join(outDir, `ruw-${mb}mb-${mode}-${r + 1}.json`), `${JSON.stringify(res, null, 2)}\n`);
    }
  }
  const profDir = join(outDir, `profiel-${mb}mb`);
  rmSync(profDir, { recursive: true, force: true });
  mkdirSync(profDir, { recursive: true });
  const prof = child('profiel', file, ['--cpu-prof', `--cpu-prof-dir=${profDir}`]);
  const profFile = readdirSync(profDir).find(f => f.endsWith('.cpuprofile'));
  row.profiel = { ok: prof.ok, status: prof.status, signal: prof.signal, steps: prof.steps, uitkomst: prof.uitkomst,
    ...(prof.ok ? {} : { laatsteBegonnenStap: prof.laatsteBegonnenStap, stderr: prof.stderr }),
    ...(profFile ? { bestand: profFile, verdeling: summarize(JSON.parse(readFileSync(join(profDir, profFile), 'utf8')), prof.venster3b) } : { verdeling: null }) };
  console.error(`# ${mb} MB profiel: ${prof.ok ? 'ok' : 'MISLUKT'}`);
  rmSync(file, { force: true });
  results.push(row);
  writeFileSync(join(outDir, 'meting-opslag.json'), `${JSON.stringify({ node: process.version, runs, heap, results }, null, 2)}\n`);
}
if (opts.out) writeFileSync(opts.out, `${JSON.stringify({ node: process.version, runs, heap, results }, null, 2)}\n`);
rmSync(work, { recursive: true, force: true });
const failed = results.flatMap(row => [...row.met, ...row.snel, row.profiel].filter(r => !r.ok).map(r => `${row.mb} MB ${r.mode ?? 'profiel'}`));
if (failed.length) {
  console.error(`Mislukte runs (uitkomst, staat in het resultaat): ${failed.join(', ')}`);
  process.exitCode = 1;
}
