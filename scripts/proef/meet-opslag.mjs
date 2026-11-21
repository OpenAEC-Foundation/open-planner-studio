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
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync, writeSync } from 'node:fs';
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
// --geheugen: per grootte en per weg (met en zonder wijziging) drie kindprocessen: zonder meethaak (de sha256 van de
// uitvoer zoals de code hem zonder meetregels geeft), met de haak zonder gc (de echte pieken per onderdeel) en met gc op
// elke grens (wat vastgehouden wordt). --proef=a+b,c: daarnaast per proefset `vrij`-runs met OPS_PROEF, met dezelfde
// sha256 als eis. --runs blijft voor de gewone tijdmeting; met --geheugen geen tijdruns en geen profielen.
const geheugen = opts.geheugen === '1';
const proefSets = (opts.proef ?? '').split(',').filter(Boolean).map(s => s.replace(/\+/g, ','));
const proefSetsSnel = (opts['proef-snel'] ?? '').split(',').filter(Boolean).map(s => s.replace(/\+/g, ','));
const proefRuns = Number(opts['proef-runs'] ?? 2);
// --refs=basis:<sha>,a:<sha>,…: per opgegeven commit de broncode van die commit (`src/`, de testhelpers in
// `tests/planning/`, `tsconfig.json`, `package.json`) uit git halen, apart bundelen en daarop de opslag meten zonder
// meethaak: per grootte en per weg --refs-runs ronden, in elke ronde elke commit één keer in een eigen Node-proces, om
// en om (basis, a, b, basis, a, b). Het meetscript, de generator en het gezette invoerbestand blijven die van deze
// branch, dus de invoer is voor alle commits byte-gelijk. Eis: de sha256 van de uitvoer is per grootte en weg gelijk
// voor alle commits; een afwijking komt in het resultaat (`shaGelijk: false`) en maakt de run rood, maar de meting
// gaat door. `node_modules` wordt gedeeld via een link in de map van elke commit.
const refs = (opts.refs ?? '').split(',').filter(Boolean).map(r => {
  const m = /^([\w-]+):([0-9a-f]{7,40})$/.exec(r);
  if (!m) throw new Error(`--refs verwacht naam:sha, kreeg ${r}`);
  return { name: m[1], sha: m[2] };
});
const refsRuns = Number(opts['refs-runs'] ?? 2);
if (refs.length && (geheugen || proefSets.length)) throw new Error('--refs niet samen met --geheugen of --proef');
if (new Set(refs.map(r => r.name)).size !== refs.length) throw new Error('--refs: dubbele naam');
if (sizes.some(s => !(s > 0)) || !(runs >= 0)) throw new Error('--mb verwacht getallen, --runs minstens 1');
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
const entryText = srcRoot => {
const T = p => JSON.stringify(join(srcRoot, p));
return `
import { copyFileSync, createReadStream, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { cpus, totalmem } from 'node:os';
import { openInStore } from ${T('tests/planning/ifcAppRoute.ts')};
import { applyEdit, cloneDomain, ordinaryEdits, settle } from ${T('tests/planning/ifcMergeKern.ts')};
import { installNodeFileIpc } from ${T('tests/planning/nodeFileIpc.ts')};
import { readIfcBytesDetailed } from '@/services/ifc/foreign/ifcBytesRoute';
import { handleIfcSaveRequest, outputFromResult } from '@/services/ifc/saveWorker/ifcSaveProtocol';
import { replaceOwnFileBytes, tauriOwnFileReplaceFs, type OwnFileReplaceFs } from '@/services/fileAccess/ownFileReplace';
import type { IfcSaveJob } from '@/state/prepareIfcOutput';

const [mode, file, tmp] = process.argv.slice(2);
const snel = mode === 'snel' || mode === 'profiel-snel';
// Geheugenmeting (deel 1 van opslag-geheugen): een vaste klok en een vaste toevalsreeks, zodat de uitvoerbytes per run
// gelijk zijn en de sha256 met en zonder meethaak (en met en zonder proef) te vergelijken is.
{
  const FIXED = Date.UTC(2026, 10, 21, 6, 0, 0);
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...a: unknown[]) { if (a.length === 0) super(FIXED); else super(...(a as [number])); }
    static now() { return FIXED; }
  }
  (globalThis as { Date: DateConstructor }).Date = FixedDate as unknown as DateConstructor;
  let seed = 12345;
  Math.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
}
const meting = process.env.OPS_METING ?? '';   // '' | 'vrij' | 'gc'
const proef = Object.fromEntries((process.env.OPS_PROEF ?? '').split(',').filter(Boolean).map(n => [n, true]));
if (mode === 'zetten') {
  writeFileSync(tmp, await settle(new Uint8Array(readFileSync(file))));
  process.exit(0);
}
const gc: () => void = (globalThis as { gc?: () => void }).gc ?? (() => {});
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
emit({ mode, node: process.version, pid: process.pid, meting, proef: Object.keys(proef), cpu: cpus()[0]?.model, kernen: cpus().length, geheugenGB: Math.round(totalmem() / 2 ** 30), ...mem() });

// De meetdraad: leest elke 10 ms de RSS van het hele proces en houdt per onderdeel de hoogste stand bij. Een eigen
// thread, dus ook binnen een lange lus van de hoofdthread. (De draad zelf kost een paar MB RSS.)
const memFull = () => {
  const m = process.memoryUsage();
  return { heapMB: MB(m.heapUsed), heapTotalMB: MB(m.heapTotal), externalMB: MB(m.external), arrayBuffersMB: MB(m.arrayBuffers), rssMB: MB(m.rss) };
};
const SECTIONS = 512;
const sab = new SharedArrayBuffer(8 + 8 * SECTIONS);
const ctl = new Int32Array(sab, 0, 2);
const maxRss = new Float64Array(sab, 8, SECTIONS);
let sampler: Worker | undefined;
let actief = false;
let tPrev = 0;
const grenzen: unknown[] = [];
if (meting || Object.keys(proef).length) {
  if (meting) {
    sampler = new Worker([
      "const { workerData } = require('node:worker_threads');",
      'const ctl = new Int32Array(workerData, 0, 2), max = new Float64Array(workerData, 8, 512);',
      'const pause = new Int32Array(new SharedArrayBuffer(4));',
      'while (Atomics.load(ctl, 1) === 0) {',
      '  const r = process.memoryUsage.rss(), s = Atomics.load(ctl, 0);',
      '  if (r > max[s]) max[s] = r;',
      '  Atomics.wait(pause, 0, 0, 10);',
      '}'].join('\\n'), { eval: true, workerData: sab });
    sampler.unref();
  }
  (globalThis as { __opsMeting?: unknown }).__opsMeting = {
    proef,
    grens(label: string) {
      if (!actief || !meting) return;
      const now = performance.now();
      const s = Atomics.load(ctl, 0);
      const a = memFull();
      const piek = Math.max(maxRss[s] / 1048576, a.rssMB);
      const row: Record<string, unknown> = { grens: label, ms: Math.round((now - tPrev) * 10) / 10, piekRssMB: Math.round(piek * 10) / 10, ...a };
      if (meting === 'gc') { gc(); row.naGc = memFull(); }
      const next = (s + 1) % SECTIONS;
      maxRss[next] = 0;
      Atomics.store(ctl, 0, next);
      grenzen.push(row);
      emit(row);
      tPrev = performance.now();
    },
    data(label: string, data: Record<string, unknown>) { if (actief && meting) emit({ data: label, ...data }); },
  };
}
const startMeting = () => {
  if (!meting) return;
  gc();
  emit({ grens: '(start 3b)', ...memFull(), naGc: memFull() });
  maxRss[0] = 0; Atomics.store(ctl, 0, 0);
  actief = true; tPrev = performance.now();
};
const stopMeting = () => { actief = false; Atomics.store(ctl, 1, 1); };

const bytes = await step('1a bestand lezen', () => new Uint8Array(readFileSync(file)));
if (!snel) {
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
if (!snel) {
  const edit = ordinaryEdits(input).find(e => e.kind === 'duur');
  if (!edit) throw new Error('geen duurwijziging');
  input = await step('2 wijziging (duur een dag langer)', () => applyEdit(edit, input));
}
const job: IfcSaveJob = { kind: 'merge', input, source };
let copy: IfcSaveJob | null = await step('3a kopie naar de worker (structuredClone)', () => structuredClone(job));
const window3 = { beginUs: 0, eindUs: 0 };
const handled = await step('3b werk van de worker (handleIfcSaveRequest)', async () => {
  window3.beginUs = hr();
  startMeting();
  const r = await handleIfcSaveRequest({ id: 1, job: copy! });
  stopMeting();
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
emit({ uitkomst: back.result.kind, uitvoerBytes: prepared.bytes.length, overgedragenMB: MB(transfer.reduce((a, b) => a + b.byteLength, 0)),
  uitvoerSha256: createHash('sha256').update(prepared.bytes).digest('hex'), opgegevenSha256: prepared.sha256 });

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
`;
};
/** Bundel de opslag-entry op de broncode onder `srcRoot` (de branch zelf of de map van een commit). */
function bundle(srcRoot, name) {
  writeFileSync(join(work, `${name}-entry.ts`), entryText(srcRoot));
  const args = ESBUILD_ARGS.map(a => a.startsWith('--alias:@=') ? `--alias:@=${join(srcRoot, 'src')}` : a);
  execFileSync(ESBUILD, [join(work, `${name}-entry.ts`), ...args, `--outfile=${join(work, `${name}.mjs`)}`], { cwd: srcRoot, stdio: 'inherit' });
  return join(work, `${name}.mjs`);
}
bundle(ROOT, 'opslag');

// ── De broncode van elke commit uit --refs: ophalen (in CI ondiep), uitpakken, node_modules delen, bundelen ─────────
const git = (args, opt = {}) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opt });
for (const ref of refs) {
  try { git(['cat-file', '-e', `${ref.sha}^{commit}`], { stdio: 'ignore' }); }
  catch { git(['fetch', '--quiet', '--depth=1', 'origin', ref.sha], { stdio: 'inherit', timeout: 300_000 }); }
  ref.sha = git(['rev-parse', `${ref.sha}^{commit}`]).trim();
  ref.dir = join(work, `bron-${ref.name}`);
  mkdirSync(ref.dir, { recursive: true });
  const tar = execFileSync('git', ['archive', '--format=tar', ref.sha, 'src', 'tests/planning', 'tsconfig.json', 'package.json'], { cwd: ROOT, maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', ref.dir], { input: tar });
  symlinkSync(join(ROOT, 'node_modules'), join(ref.dir, 'node_modules'));
  ref.bundle = bundle(ref.dir, `opslag-${ref.name}`);
  ref.commit = git(['log', '-1', '--format=%H %s', ref.sha]).trim();
  console.error(`# commit ${ref.name}: ${ref.commit}`);
}

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
function child(mode, file, extra = [], env = {}, bundlePath = join(work, 'opslag.mjs')) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--expose-gc', `--max-old-space-size=${heap}`, ...extra, bundlePath, mode, file, work],
    { encoding: 'utf8', maxBuffer: 1 << 28, timeout: childTimeoutMs, killSignal: 'SIGKILL', env: { ...process.env, OPS_METING: '', OPS_PROEF: '', ...env } });
  const lines = (r.stdout || '').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return { tekst: l }; } });
  const steps = lines.filter(l => l.stap);
  const grenzen = lines.filter(l => l.grens !== undefined);
  const data = lines.filter(l => l.data !== undefined);
  const info = Object.assign({}, ...lines.filter(l => !l.stap && !l.begin && l.grens === undefined && l.data === undefined));
  const lastBegin = [...lines].reverse().find(l => l.begin);
  const ok = r.status === 0 && info.klaar === true;
  return {
    mode, env, ok, status: r.status, signal: r.signal, wandMs: Date.now() - t0, steps, ...(grenzen.length ? { grenzen, data } : {}), ...info,
    ...(ok ? {} : { laatsteBegonnenStap: lastBegin ?? null, stderr: (r.stderr || '').trim().split('\n').slice(-8).join('\n') }),
  };
}

// ── De verdeling per functie uit het profiel, alleen binnen het venster van stap 3b ─────────────────────────────
const WATCH = ['structuralCounts', 'equalBytes', 'bindings', 'handleIfcSaveRequest', 'prepareIfcWrite', 'scanForeignStep', 'scanStep', 'classify', 'assertSameSource',
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
  const incl = new Map(), self = new Map(), inCheck = new Map();
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
    // Dezelfde functie binnen de uitvoercontrole (`validateMergeOutput`) en daarbuiten (o.a. het opnieuw scannen van de bron).
    if (onStack.has('validateMergeOutput')) for (const name of onStack) inCheck.set(name, (inCheck.get(name) ?? 0) + dur);
  }
  const s = us => Math.round(us / 1000) / 1000;
  const pct = us => Math.round(us / total * 1000) / 10;
  return {
    venster: inWindow ? 'stap 3b' : 'heel het proces (venster viel buiten het profiel)',
    vensterS: s(hi - lo), bemonsterdS: s(total),
    benoemd: WATCH.filter(n => incl.has(n)).map(n => ({ functie: n, inclusiefS: s(incl.get(n)), deel: pct(incl.get(n)), eigenS: s(self.get(n) ?? 0),
      binnenUitvoercontroleS: s(inCheck.get(n) ?? 0), buitenUitvoercontroleS: s(incl.get(n) - (inCheck.get(n) ?? 0)) })),
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
  if (refs.length) {
    row.refs = {};
    for (const mode of ['met', 'snel']) {
      const runsByRef = Object.fromEntries(refs.map(r => [r.name, []]));
      for (let k = 0; k < refsRuns; k++) {
        for (const ref of refs) {
          const res = child(mode, file, [], {}, ref.bundle);
          const ms = name => res.steps.find(s => s.stap.startsWith(name))?.ms;
          const opslagMs = res.steps.filter(s => /^3[abcd] /.test(s.stap) || s.stap.startsWith('4 vervangroute')).reduce((a, s) => a + s.ms, 0);
          const run = { ref: ref.name, ronde: k + 1, ok: res.ok, status: res.status, signal: res.signal, wandMs: res.wandMs,
            ms3b: ms('3b '), opslagMs: Math.round(opslagMs * 10) / 10, openenMs: ms('1c '), piekRssMB: res.maxRssMB,
            uitvoerBytes: res.uitvoerBytes, uitvoerSha256: res.uitvoerSha256, shaKlopt: res.opgegevenSha256 === res.uitvoerSha256,
            uitkomst: res.uitkomst, vervanging: res.vervanging, doelGelijkAanUitvoer: res.doelGelijkAanUitvoer,
            ...(res.ok ? {} : { fout: res.fout, laatsteBegonnenStap: res.laatsteBegonnenStap, stderr: res.stderr }) };
          runsByRef[ref.name].push(run);
          console.error(`# ${mb} MB ${mode} ${ref.name} ronde ${k + 1}: ${res.ok ? 'ok' : 'MISLUKT'}, 3b ${run.ms3b} ms, opslag ${run.opslagMs} ms, piek ${run.piekRssMB} MB, sha ${run.uitvoerSha256?.slice(0, 12)}`);
          writeFileSync(join(outDir, `ruw-${mb}mb-${mode}-${ref.name}-${k + 1}.json`), `${JSON.stringify({ ...res, ref: ref.name, sha: ref.sha }, null, 2)}\n`);
        }
      }
      const median = xs => { const v = xs.filter(x => typeof x === 'number').sort((a, b) => a - b); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
      const shas = new Set(Object.values(runsByRef).flat().map(r => r.uitvoerSha256 ?? 'geen'));
      row.refs[mode] = { shaGelijk: shas.size === 1 && !shas.has('geen'), shas: [...shas], perRef: Object.fromEntries(refs.map(ref => {
        const rs = runsByRef[ref.name];
        return [ref.name, { sha: ref.sha, runs: rs, middel3bMs: median(rs.map(r => r.ms3b)), middelOpslagMs: median(rs.map(r => r.opslagMs)), middelPiekRssMB: median(rs.map(r => r.piekRssMB)) }];
      })) };
      console.error(`# ${mb} MB ${mode}: sha256 ${row.refs[mode].shaGelijk ? 'GELIJK voor alle commits' : 'ANDERS: ' + [...shas].join(' ')}`);
      for (const ref of refs) { const p = row.refs[mode].perRef[ref.name]; console.error(`#   ${ref.name}: 3b ${p.runs.map(r => r.ms3b).join(' / ')} (middel ${p.middel3bMs}), opslag middel ${p.middelOpslagMs}, piek ${p.runs.map(r => r.piekRssMB).join(' / ')} MB`); }
    }
    rmSync(file, { force: true });
    results.push(row);
    writeFileSync(join(outDir, 'meting-opslag.json'), `${JSON.stringify({ node: process.version, refs: refs.map(({ name, sha, commit }) => ({ name, sha, commit })), refsRuns, heap, results }, null, 2)}\n`);
    continue;
  }
  if (geheugen) {
    row.geheugen = {};
    for (const mode of ['met', 'snel']) {
      const sets = mode === 'met' ? proefSets : proefSetsSnel;
      // Om en om: basis, dan elke proefset, en dat proefRuns keer, zodat een trage periode van de runner alle varianten raakt.
      const variants = [['zonder', {}], ['gc', { OPS_METING: 'gc' }],
        ...Array.from({ length: Math.max(1, sets.length ? proefRuns : 1) }, (_, k) => [[k ? `vrij #${k + 1}` : 'vrij', { OPS_METING: 'vrij' }],
          ...sets.map(set => [`proef ${set} #${k + 1}`, { OPS_METING: 'vrij', OPS_PROEF: set }])]).flat(),
        ...(sets.length ? [[`proef ${sets.at(-1)} gc`, { OPS_METING: 'gc', OPS_PROEF: sets.at(-1) }]] : [])];
      row.geheugen[mode] = {};
      for (const [name, env] of variants) {
        const res = child(mode, file, [], env);
        row.geheugen[mode][name] = res;
        const base = row.geheugen[mode].zonder;
        res.zelfdeBytes = res.uitvoerSha256 !== undefined && res.uitvoerSha256 === base?.uitvoerSha256;
        console.error(`# ${mb} MB ${mode} ${name}: ${res.ok ? 'ok' : 'MISLUKT'} in ${res.wandMs} ms, piek ${res.steps.at(-1)?.maxRssMB ?? '?'} MB, sha ${res.zelfdeBytes ? 'gelijk' : 'ANDERS'}`);
        writeFileSync(join(outDir, `ruw-${mb}mb-${mode}-${name.replace(/[^\w+-]+/g, '_')}.json`), `${JSON.stringify(res, null, 2)}\n`);
      }
    }
    rmSync(file, { force: true });
    results.push(row);
    writeFileSync(join(outDir, 'meting-opslag.json'), `${JSON.stringify({ node: process.version, geheugen, proefSets, heap, results }, null, 2)}\n`);
    continue;
  }
  for (let r = 0; r < runs; r++) {
    for (const mode of ['met', 'snel']) {
      const res = child(mode, file);
      row[mode].push(res);
      console.error(`# ${mb} MB ${mode} run ${r + 1}: ${res.ok ? 'ok' : 'MISLUKT'} in ${res.wandMs} ms, piek ${res.steps.at(-1)?.maxRssMB ?? '?'} MB`);
      writeFileSync(join(outDir, `ruw-${mb}mb-${mode}-${r + 1}.json`), `${JSON.stringify(res, null, 2)}\n`);
    }
  }
  for (const [key, mode] of [['profiel', 'profiel'], ['profielSnel', 'profiel-snel']]) {
    const profDir = join(outDir, `${mode}-${mb}mb`);
    rmSync(profDir, { recursive: true, force: true });
    mkdirSync(profDir, { recursive: true });
    const prof = child(mode, file, ['--cpu-prof', `--cpu-prof-dir=${profDir}`]);
    const profFile = readdirSync(profDir).find(f => f.endsWith('.cpuprofile'));
    row[key] = { mode, ok: prof.ok, status: prof.status, signal: prof.signal, steps: prof.steps, uitkomst: prof.uitkomst,
      ...(prof.ok ? {} : { laatsteBegonnenStap: prof.laatsteBegonnenStap, stderr: prof.stderr }),
      ...(profFile ? { bestand: profFile, verdeling: summarize(JSON.parse(readFileSync(join(profDir, profFile), 'utf8')), prof.venster3b) } : { verdeling: null }) };
    console.error(`# ${mb} MB ${mode}: ${prof.ok ? 'ok' : 'MISLUKT'}`);
  }
  rmSync(file, { force: true });
  results.push(row);
  writeFileSync(join(outDir, 'meting-opslag.json'), `${JSON.stringify({ node: process.version, runs, heap, results }, null, 2)}\n`);
}
if (opts.out) writeFileSync(opts.out, `${JSON.stringify({ node: process.version, runs, heap, ...(refs.length ? { refs: refs.map(({ name, sha, commit }) => ({ name, sha, commit })), refsRuns } : {}), results }, null, 2)}\n`);
rmSync(work, { recursive: true, force: true });
const failed = results.flatMap(row => row.refs
  ? Object.entries(row.refs).flatMap(([mode, v]) => [...(v.shaGelijk ? [] : [`${row.mb} MB ${mode}: sha256 verschilt tussen de commits`]),
    ...Object.values(v.perRef).flatMap(p => p.runs).filter(r => !r.ok).map(r => `${row.mb} MB ${mode} ${r.ref} ronde ${r.ronde}`)])
  : row.geheugen
  ? Object.values(row.geheugen).flatMap(v => Object.entries(v)).filter(([, r]) => !r.ok || !r.zelfdeBytes).map(([name, r]) => `${row.mb} MB ${r.mode} ${name}${r.ok ? ' (andere bytes)' : ''}`)
  : [...row.met, ...row.snel, row.profiel, row.profielSnel].filter(r => !r.ok).map(r => `${row.mb} MB ${r.mode}`));
if (failed.length) {
  console.error(`Mislukte runs (uitkomst, staat in het resultaat): ${failed.join(', ')}`);
  process.exitCode = 1;
}
