#!/usr/bin/env node
// #804 fase 0: meting van de scanner en de indeling (ontwerp "Gebouwmodel behouden", §4.13, §4.10 en §8).
//
// Maakt synthetische STEP-bestanden van de gevraagde grootte: een eigen planning (een voorbeeld uit public/examples)
// plus veel wanden met plaatsing, eenvoudige geometrie en een pset. Meet per bestand in een eigen Node-proces:
//   - lezen als bytes (`readFileSync`), de scanner (`scanStep`) en de indeling (`classify`): tijd en piekgeheugen;
//   - de controle op inhoud vóór opslaan (§4.10): het bestand opnieuw lezen en de sha256 rekenen, twee keer
//     (stap 2 en stap 5 van de vervangroute), en de sha256 van de bytes in het geheugen.
// Met --browser=chromium[,webkit] ook in Playwright (alleen tijd; Chromium ook de JS-heap): fetch als ArrayBuffer,
// scanner, indeling en `crypto.subtle.digest('SHA-256')`.
//
// #804 fixronde 2: ook de doelcontrole vóór Opslaan als, een export en AutoSave (`targetModelScan.ts`): bevat het
// bestaande doel een gebouwmodel? Gemeten op drie bestanden van dezelfde grootte (`target` in de uitvoer):
//   - `model`: het model staat direct na de planning (de lezer stopt vroeg);
//   - `none`: geen model, het slechtste geval (de lezer leest alles);
//   - `end`: hetzelfde, met één wand vlak voor het einde (alles gelezen, uitkomst "model").
// In Node als stroom in stukken van 1 MiB (zoals de Tauri-route met plugin-fs `read`) en als `Blob`-stroom van
// `fs.openAsBlob` (zoals de `File` van een FSA-handle); in de browser als `Blob` van `fetch`.
//
// #804 fase 1b: ook de merge-writer (`mergeWriter.ts`, `merge` in de uitvoer): openen via de bytes-route zoals de app met
// de flag, en `writeIfcMerge` zonder wijziging. Tijd, piekgeheugen, uitkomst (geschreven of `merge-needs-phase2`) en de
// grootte van de uitvoer. Boven `IFC_BYTES_ROUTE_MAX_BYTES` (300 MiB) valt de route terug zonder bron; de meting van
// 300 MB gebruikt daarom een bestand net onder die grens (`mergeSize` in de uitvoer).
//
// #804 fase 1b, fixronde 2: de merge toetst nu of de lezer elk veld van de bron draagt (de leesverliestoets). Het
// voorbeeld is met een oudere writer gemaakt en weigert daarom al zonder bewerking (`niet-gedragen`). Het script zet het
// voorbeeld daarom eerst zoals de huidige writer het schrijft (`settle` uit tests/planning/ifcMergeKern.ts), en bouwt
// alle bestanden op dat gezette voorbeeld.
//
// Lokaal alleen tot en met 50 MB (AGENTS.md, server load). Groter alleen in CI (`CI=true`), via de handmatige job in
// .github/workflows/ifc-foreign.yml.
//
//   node scripts/proef/meet-scanner.mjs --mb=50                       # lokaal
//   node scripts/proef/meet-scanner.mjs --mb=50,150,300 --browser=chromium,webkit --out=meting.json   # CI
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, createReadStream, mkdtempSync, openSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
const EXAMPLE = join(ROOT, 'public/examples/showcase-appartementencomplex.ifc');

const opts = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (!m) throw new Error(`onbekend argument: ${a}`);
  return [m[1], m[2] ?? '1'];
}));
const sizes = (opts.mb ?? '50').split(',').map(Number);
const browsers = opts.browser ? opts.browser.split(',') : [];
if (sizes.some(s => !(s > 0))) throw new Error('--mb verwacht getallen, bijvoorbeeld --mb=50,150,300');
if (sizes.some(s => s > 50) && process.env.CI !== 'true') {
  console.error('Boven 50 MB alleen in CI (AGENTS.md: server load). Gebruik de handmatige job in ifc-foreign.yml.');
  process.exit(2);
}

const work = mkdtempSync(join(tmpdir(), 'ops-meet-scanner-'));
const ESBUILD_COMMON = ['--bundle', `--alias:@=${join(ROOT, 'src')}`, '--log-level=error', '--external:react-dom/server',
  '--define:import.meta.env.DEV=false', '--define:import.meta.env.PROD=true', '--define:import.meta.env.MODE="production"'];

// ── Bundels ──────────────────────────────────────────────────────────────────────────────────────────────────────
writeFileSync(join(work, 'node-entry.ts'), `
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { scanStep } from '@/services/ifc/foreign/stepScanner';
import { classify } from '@/services/ifc/foreign/classify';
const file = process.argv[2];
const gc = (globalThis as { gc?: () => void }).gc ?? (() => {});
const mb = (n: number) => Math.round(n / 1048576);
const t = () => performance.now();
gc();
const rssStart = process.memoryUsage().rss;
let t0 = t();
const bytes = new Uint8Array(readFileSync(file));
const readMs = t() - t0;
t0 = t();
const index = scanStep(bytes);
const scanMs = t() - t0;
const afterScan = process.memoryUsage();
t0 = t();
const cls = classify(index);
const classifyMs = t() - t0;
const afterClassify = process.memoryUsage();
t0 = t();
createHash('sha256').update(bytes).digest('hex');
const hashMemMs = t() - t0;
// De controle op inhoud (§4.10): het doel opnieuw lezen en hashen, in stap 2 en stap 5 van de vervangroute.
const rereadHash = () => { const s = t(); createHash('sha256').update(readFileSync(file)).digest('hex'); return t() - s; };
const rereadHash1Ms = rereadHash();
const rereadHash2Ms = rereadHash();
const usage = process.resourceUsage();
console.log(JSON.stringify({
  bytes: bytes.length, entities: index.entityCount, counts: cls.counts,
  readMs, scanMs, classifyMs, hashMemMs, rereadHash1Ms, rereadHash2Ms,
  rssStartMB: mb(rssStart), maxRssMB: Math.round(usage.maxRSS / 1024),
  heapAfterScanMB: mb(afterScan.heapUsed), arrayBuffersAfterScanMB: mb(afterScan.arrayBuffers),
  heapAfterClassifyMB: mb(afterClassify.heapUsed), arrayBuffersAfterClassifyMB: mb(afterClassify.arrayBuffers),
}));
`);
execFileSync(ESBUILD, [join(work, 'node-entry.ts'), ...ESBUILD_COMMON, '--platform=node', '--format=esm', `--outfile=${join(work, 'meet-node.mjs')}`], { cwd: ROOT, stdio: 'inherit' });
writeFileSync(join(work, 'target-entry.ts'), `
import { closeSync, openAsBlob, openSync, readSync } from 'node:fs';
import { scanTargetBlob, scanTargetSource } from '@/services/ifc/foreign/targetModelScan';
const file = process.argv[2];
const t = () => performance.now();
// Als stroom in stukken van 1 MiB, zoals de Tauri-route (plugin-fs \`open\` + \`read\` + \`seek\`; elk stuk een eigen buffer).
const fd = openSync(file, 'r');
let at = 0;
let bytesRead = 0;
let seeks = 0;
let t0 = t();
const result = await scanTargetSource({
  next: async () => {
    const buffer = new Uint8Array(1 << 20);
    const n = readSync(fd, buffer, 0, buffer.length, at);
    at += n;
    bytesRead += n;
    return n === 0 ? null : buffer.subarray(0, n);
  },
  seek: async (offset) => { at = offset; seeks++; },
  close: () => closeSync(fd),
});
const streamMs = t() - t0;
// Als Blob-stroom, zoals de File van een FSA-handle.
const blob = await openAsBlob(file);
t0 = t();
const blobResult = await scanTargetBlob(blob);
const blobMs = t() - t0;
console.log(JSON.stringify({ result, bytesRead, seeks, streamMs, blobResult, blobMs,
  maxRssMB: Math.round(process.resourceUsage().maxRSS / 1024) }));
`);
execFileSync(ESBUILD, [join(work, 'target-entry.ts'), ...ESBUILD_COMMON, '--platform=node', '--format=esm', `--outfile=${join(work, 'meet-target.mjs')}`], { cwd: ROOT, stdio: 'inherit' });
writeFileSync(join(work, 'merge-entry.ts'), `
import { readFileSync } from 'node:fs';
import { openReadPlanning } from '${ROOT}/tests/planning/ifcAppRoute';
import { readIfcBytesDetailed, IFC_BYTES_ROUTE_MAX_BYTES } from '@/services/ifc/foreign/ifcBytesRoute';
import { MergeNeedsPhase2Error, writeIfcMerge } from '@/services/ifc/foreign/mergeWriter';
const file = process.argv[2];
const t = () => performance.now();
const mb = (n: number) => Math.round(n / 1048576);
const bytes = new Uint8Array(readFileSync(file));
let t0 = t();
const opened = await readIfcBytesDetailed(bytes, {}, { createWorker: () => null });
const openMs = t() - t0;
const afterOpen = process.memoryUsage();
const source = opened.result.ifcSource;
const base = { bytes: bytes.length, cap: IFC_BYTES_ROUTE_MAX_BYTES, openMs, heapAfterOpenMB: mb(afterOpen.heapUsed),
  arrayBuffersAfterOpenMB: mb(afterOpen.arrayBuffers) };
if (!source) {
  console.log(JSON.stringify({ ...base, outcome: 'geen bron (terugval van de bytes-route)', maxRssMB: Math.round(process.resourceUsage().maxRSS / 1024) }));
} else {
  let outcome = 'geschreven';
  let parts: Uint8Array[] = [];
  t0 = t();
  try { parts = await writeIfcMerge(opened.result, source, openReadPlanning); } catch (e) {
    if (!(e instanceof MergeNeedsPhase2Error)) throw e;
    outcome = 'merge-needs-phase2: ' + [...new Set(e.cases.map(c => c.kind))].join(', ');
  }
  const mergeMs = t() - t0;
  const afterMerge = process.memoryUsage();
  const outBytes = parts.reduce((a, p) => a + p.length, 0);
  console.log(JSON.stringify({ ...base, foreign: source.foreign, outcome, mergeMs, parts: parts.length, outBytes,
    largestPartMB: mb(Math.max(0, ...parts.map(p => p.length))),
    heapAfterMergeMB: mb(afterMerge.heapUsed), arrayBuffersAfterMergeMB: mb(afterMerge.arrayBuffers),
    maxRssMB: Math.round(process.resourceUsage().maxRSS / 1024) }));
}
`);
execFileSync(ESBUILD, [join(work, 'merge-entry.ts'), ...ESBUILD_COMMON, '--platform=node', '--format=esm', `--outfile=${join(work, 'meet-merge.mjs')}`], { cwd: ROOT, stdio: 'inherit' });
// Het voorbeeld zoals de huidige writer het schrijft (fixronde 2): de basis van alle synthetische bestanden.
writeFileSync(join(work, 'settle-entry.ts'), `
import { readFileSync, writeFileSync } from 'node:fs';
import { settle } from ${JSON.stringify(join(ROOT, 'tests/planning/ifcMergeKern.ts'))};
const [from, to] = process.argv.slice(2);
writeFileSync(to, await settle(new Uint8Array(readFileSync(from))));
`);
execFileSync(ESBUILD, [join(work, 'settle-entry.ts'), ...ESBUILD_COMMON, '--platform=node', '--format=esm', `--outfile=${join(work, 'settle.mjs')}`], { cwd: ROOT, stdio: 'inherit' });
if (browsers.length > 0) {
  writeFileSync(join(work, 'browser-entry.ts'), `
import { scanStep } from '@/services/ifc/foreign/stepScanner';
import { classify } from '@/services/ifc/foreign/classify';
import { scanTargetBlob } from '@/services/ifc/foreign/targetModelScan';
(window as unknown as { __meetTarget: (url: string) => Promise<unknown> }).__meetTarget = async (url: string) => {
  const blob = await (await fetch(url)).blob();
  const t0 = performance.now();
  const result = await scanTargetBlob(blob);
  return { result, blobMs: performance.now() - t0 };
};
(window as unknown as { __meet: (url: string) => Promise<unknown> }).__meet = async (url: string) => {
  const heap = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  let t0 = performance.now();
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const fetchMs = performance.now() - t0;
  t0 = performance.now();
  const index = scanStep(bytes);
  const scanMs = performance.now() - t0;
  const heapAfterScan = heap();
  t0 = performance.now();
  const cls = classify(index);
  const classifyMs = performance.now() - t0;
  const heapAfterClassify = heap();
  t0 = performance.now();
  await crypto.subtle.digest('SHA-256', bytes);
  const hashMs = performance.now() - t0;
  const mb = (n: number | undefined) => (n === undefined ? null : Math.round(n / 1048576));
  return { bytes: bytes.length, entities: index.entityCount, counts: cls.counts, fetchMs, scanMs, classifyMs, hashMs,
    heapAfterScanMB: mb(heapAfterScan), heapAfterClassifyMB: mb(heapAfterClassify) };
};
`);
  execFileSync(ESBUILD, [join(work, 'browser-entry.ts'), ...ESBUILD_COMMON, '--platform=browser', '--format=iife', `--outfile=${join(work, 'meet-browser.js')}`], { cwd: ROOT, stdio: 'inherit' });
  writeFileSync(join(work, 'index.html'), '<!doctype html><meta charset="utf-8"><script src="meet-browser.js"></script>');
}

// ── Synthetisch bestand: eigen planning + wanden ─────────────────────────────────────────────────────────────────
const GUID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
function guid(n) {
  let s = '';
  let v = n;
  for (let i = 0; i < 21; i++) { s = GUID_CHARS[v % 64] + s; v = Math.floor(v / 64); }
  return `3${s}`;
}
// `variant`: 'model' (het model direct na de planning), 'none' (geen IfcProduct: de wanden worden eigenschappen) of
// 'end' (als 'none', met één wand vlak voor het einde).
function makeFile(targetMb, path, variant = 'model', base = BASE_TEXT) {
  const model = variant === 'model';
  const end = base.lastIndexOf('ENDSEC;');
  const ids = [...base.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1]));
  let next = Math.max(...ids) + 1;
  const project = /^#(\d+)=IFCPROJECT\(/m.exec(base)[1];
  const oh = /^#(\d+)=IFCOWNERHISTORY\(/m.exec(base)[1];
  const ctx = /^#(\d+)=IFCGEOMETRICREPRESENTATIONCONTEXT\(/m.exec(base)[1];
  const fd = openSync(path, 'w');
  let written = 0;
  const parts = [];
  let buffered = 0;
  const out = s => {
    parts.push(s);
    buffered += s.length;
    if (buffered > 1 << 20) { const b = Buffer.from(parts.join('')); writeSync(fd, b); written += b.length; parts.length = 0; buffered = 0; }
  };
  out(base.slice(0, end));
  const site = next++, building = next++, storey = next++;
  if (model) {
    out(`#${site}=IFCSITE('${guid(1)}',#${oh},'Terrein',$,$,$,$,$,.ELEMENT.,$,$,$,$,$);\n`);
    out(`#${building}=IFCBUILDING('${guid(2)}',#${oh},'Gebouw',$,$,$,$,$,.ELEMENT.,$,$,$);\n`);
    out(`#${storey}=IFCBUILDINGSTOREY('${guid(3)}',#${oh},'Begane grond',$,$,$,$,$,.ELEMENT.,0.);\n`);
    out(`#${next++}=IFCRELAGGREGATES('${guid(4)}',#${oh},$,$,#${project},(#${site}));\n`);
    out(`#${next++}=IFCRELAGGREGATES('${guid(5)}',#${oh},$,$,#${site},(#${building}));\n`);
    out(`#${next++}=IFCRELAGGREGATES('${guid(6)}',#${oh},$,$,#${building},(#${storey}));\n`);
  }
  const target = targetMb * 1048576;
  let wall = 0;
  let group = [];
  const tail = base.slice(end);
  while (written + buffered + tail.length < target) {
    wall++;
    const p = next++, a = next++, lp = next++, c0 = next++, c1 = next++, pl = next++, sr = next++, pds = next++, w = next++;
    const v1 = next++, v2 = next++, ps = next++, rel = next++;
    out(`#${p}=IFCCARTESIANPOINT((${(wall % 1000) * 5}.,${Math.floor(wall / 1000) * 5}.,0.));\n`
      + `#${a}=IFCAXIS2PLACEMENT3D(#${p},$,$);\n#${lp}=IFCLOCALPLACEMENT($,#${a});\n`
      + `#${c0}=IFCCARTESIANPOINT((0.,0.));\n#${c1}=IFCCARTESIANPOINT((5.,0.));\n#${pl}=IFCPOLYLINE((#${c0},#${c1}));\n`
      + `#${sr}=IFCSHAPEREPRESENTATION(#${ctx},'Axis','Curve2D',(#${pl}));\n#${pds}=IFCPRODUCTDEFINITIONSHAPE($,$,(#${sr}));\n`
      + (model ? `#${w}=IFCWALL('${guid(100 + wall * 3)}',#${oh},'Wand ${wall}',$,$,#${lp},#${pds},$,.STANDARD.);\n`
        : `#${w}=IFCPROPERTYSINGLEVALUE('Wand ${wall}',$,IFCLABEL('${guid(100 + wall * 3)}'),$);\n`)
      + `#${v1}=IFCPROPERTYSINGLEVALUE('IsExternal',$,IFCBOOLEAN(.F.),$);\n`
      + `#${v2}=IFCPROPERTYSINGLEVALUE('Reference',$,IFCIDENTIFIER('W-${wall}'),$);\n`
      + `#${ps}=IFCPROPERTYSET('${guid(101 + wall * 3)}',#${oh},'Pset_WallCommon',$,(#${v1},#${v2}));\n`
      + `#${rel}=IFCRELDEFINESBYPROPERTIES('${guid(102 + wall * 3)}',#${oh},$,$,(#${w}),#${ps});\n`);
    group.push(w);
    if (group.length === 1000 && model) {
      out(`#${next++}=IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid(10_000_000 + wall)}',#${oh},$,$,(${group.map(x => `#${x}`).join(',')}),#${storey});\n`);
      group = [];
    }
  }
  if (variant === 'end') out(`#${next++}=IFCWALL('${guid(3)}',#${oh},'Laatste wand',$,$,$,$,$,.STANDARD.);\n`);
  if (group.length && model) out(`#${next++}=IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid(10_000_000 + wall + 1)}',#${oh},$,$,(${group.map(x => `#${x}`).join(',')}),#${storey});\n`);
  out(tail);
  const b = Buffer.from(parts.join(''));
  writeSync(fd, b);
  closeSync(fd);
  return wall;
}

// ── Het voorbeeld zoals de huidige writer het schrijft (fixronde 2) ────────────────────────────────────────────────
// `settle` heeft een vreemd deel nodig: het zet het voorbeeld met een terrein, een gebouw en een verdieping erbij, en
// laat die drie (met hun relaties, alle `#id`s boven die van het voorbeeld) daarna weer weg.
const exampleText = readFileSync(EXAMPLE, 'utf8');
const maxExampleId = Math.max(...[...exampleText.matchAll(/^#(\d+)=/gm)].map(m => Number(m[1])));
const probe = join(work, 'voorbeeld-met-model.ifc');
makeFile(0, probe, 'model', exampleText);
execFileSync(process.execPath, [join(work, 'settle.mjs'), probe, probe], { stdio: 'inherit' });
const BASE_TEXT = readFileSync(probe, 'utf8').split('\n')
  .filter(line => { const m = /^#(\d+)=/.exec(line); return !m || Number(m[1]) <= maxExampleId; }).join('\n');
rmSync(probe, { force: true });

// De weg van de weigering (fixronde 6 van #867): het gezette voorbeeld met een model, en de eerste taakduur met een
// decimale komma (`P1,5D`, die de lezer als 5 dagen leest, knownbug 1029). De merge moet dan getypeerd weigeren
// (`merge-needs-phase2`) in plaats van te stoppen met een andere fout. Eén klein bestand, voor elke grootte gelijk.
const refusalFile = join(work, 'voorbeeld-met-komma.ifc');
const commaText = BASE_TEXT.replace(/^(#\d+=IFCTASKTIME\(.*?,\.(?:WORK|ELAPSED)TIME\.,)'P0Y0M\d+D'/m, "$1'P1,5D'");
if (commaText === BASE_TEXT) throw new Error('geen taakduur P0Y0M…D in het voorbeeld');
makeFile(0, refusalFile, 'model', commaText);
const refusalRun = spawnSync(process.execPath, [join(work, 'meet-merge.mjs'), refusalFile], { encoding: 'utf8', maxBuffer: 1 << 24 });
const mergeRefusal = refusalRun.status === 0 ? JSON.parse(refusalRun.stdout.trim().split('\n').pop())
  : { error: (refusalRun.stderr || '').trim().split('\n').slice(-3).join(' ') };
rmSync(refusalFile, { force: true });
console.log(JSON.stringify({ mergeRefusal }));

// ── Meten ────────────────────────────────────────────────────────────────────────────────────────────────────────
const results = [];
for (const mb of sizes) {
  const file = join(work, `synthetisch-${mb}mb.ifc`);
  const walls = makeFile(mb, file);
  const size = statSync(file).size;
  const r = spawnSync(process.execPath, ['--expose-gc', '--max-old-space-size=8192', join(work, 'meet-node.mjs'), file], { encoding: 'utf8', maxBuffer: 1 << 24 });
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    results.push({ mb, size, walls, node: { error: (r.stderr || '').trim().split('\n').slice(-3).join(' ') } });
  } else {
    results.push({ mb, size, walls, node: JSON.parse(r.stdout.trim().split('\n').pop()) });
  }
  const row = results[results.length - 1];
  for (const browser of browsers) row[browser] = await measureBrowser(browser, file);
  // De merge-writer (fase 1b), in een eigen Node-proces. Net onder de grens van de bytes-route als het bestand erboven zit.
  const capMb = 300;
  const mergeFile = size > capMb * 1048576 ? join(work, `synthetisch-${mb}mb-merge.ifc`) : file;
  if (mergeFile !== file) makeFile(capMb - 0.5, mergeFile);
  const m = spawnSync(process.execPath, ['--max-old-space-size=8192', join(work, 'meet-merge.mjs'), mergeFile], { encoding: 'utf8', maxBuffer: 1 << 24 });
  row.merge = m.status === 0 ? JSON.parse(m.stdout.trim().split('\n').pop())
    : { error: (m.stderr || '').trim().split('\n').slice(-3).join(' ') };
  row.merge.mergeSize = statSync(mergeFile).size;
  if (mergeFile !== file) rmSync(mergeFile, { force: true });
  // De doelcontrole (fixronde 2) op drie varianten van dezelfde grootte.
  row.target = {};
  for (const variant of ['model', 'none', 'end']) {
    const vfile = variant === 'model' ? file : join(work, `synthetisch-${mb}mb-${variant}.ifc`);
    if (variant !== 'model') makeFile(mb, vfile, variant);
    const t = spawnSync(process.execPath, [join(work, 'meet-target.mjs'), vfile], { encoding: 'utf8', maxBuffer: 1 << 24 });
    const entry = { size: statSync(vfile).size };
    entry.node = t.status === 0 ? JSON.parse(t.stdout.trim().split('\n').pop())
      : { error: (t.stderr || '').trim().split('\n').slice(-3).join(' ') };
    for (const browser of browsers) entry[browser] = await measureBrowser(browser, vfile, '__meetTarget');
    row.target[variant] = entry;
    if (variant !== 'model') rmSync(vfile, { force: true });
  }
  rmSync(file, { force: true });
  console.log(JSON.stringify(row));
}

async function measureBrowser(name, file, fn = '__meet') {
  let pw;
  try {
    pw = await import('playwright');
  } catch (e) {
    return { error: `playwright ontbreekt: ${e.message}` };
  }
  // Alleen deze drie paden; de server leest nooit een pad uit het verzoek.
  const routes = new Map([
    ['/', join(work, 'index.html')],
    ['/meet-browser.js', join(work, 'meet-browser.js')],
    ['/data.ifc', file],
  ]);
  const server = createServer((req, res) => {
    const path = routes.get(req.url ?? '');
    if (!path) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-length': statSync(path).size });
    createReadStream(path).pipe(res);
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const url = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    browser = await pw[name].launch();
    const page = await browser.newPage();
    await page.goto(url);
    return await page.evaluate(f => window[f]('/data.ifc'), fn);
  } catch (e) {
    return { error: String(e.message).split('\n')[0] };
  } finally {
    await browser?.close();
    server.close();
  }
}

if (opts.out) writeFileSync(opts.out, `${JSON.stringify({ base: 'public/examples/showcase-appartementencomplex.ifc', settled: true, node: process.version, mergeRefusal, results }, null, 2)}\n`);
rmSync(work, { recursive: true, force: true });

// Het resultaatbestand komt er altijd, ook met fouten erin. Maar mislukte een gevraagde meting (Node of een browser),
// dan eindigt het script met een foutcode, zodat de job in CI rood wordt (review van #863, Sol en Terra).
const failed = [
  // De weigering moet getypeerd zijn (zie boven).
  ...(String(mergeRefusal.outcome ?? '').startsWith('merge-needs-phase2') ? [] : [`weigering: ${mergeRefusal.error ?? mergeRefusal.outcome ?? 'geen resultaat'}`]),
  ...results.flatMap(row => [
  // De merge-writer moet het eigen-plus-model-bestand schrijven (een eigen planning, geen vreemde herkomst).
  ...(row.merge?.error !== undefined ? [`${row.mb} MB merge: ${row.merge.error}`]
    : row.merge?.outcome !== 'geschreven' ? [`${row.mb} MB merge: ${row.merge?.outcome ?? 'geen resultaat'}`] : []),
  ...['node', ...browsers]
    .filter(env => !row[env] || row[env].error !== undefined)
    .map(env => `${row.mb} MB ${env}: ${row[env]?.error ?? 'geen resultaat'}`),
  // De doelcontrole moet ook de juiste uitkomst geven: model vooraan en achteraan "model", zonder model "no-model".
  ...Object.entries(row.target ?? {}).flatMap(([variant, entry]) => ['node', ...browsers].flatMap(env => {
    const want = variant === 'none' ? 'no-model' : 'model';
    const got = entry[env];
    if (!got || got.error !== undefined) return [`${row.mb} MB doel ${variant} ${env}: ${got?.error ?? 'geen resultaat'}`];
    const results = env === 'node' ? [got.result, got.blobResult] : [got.result];
    return results.every(r => r === want) ? [] : [`${row.mb} MB doel ${variant} ${env}: ${results.join('/')} ≠ ${want}`];
  })),
  ]),
];
if (failed.length > 0) {
  console.error(`Mislukte metingen:\n  ${failed.join('\n  ')}`);
  process.exitCode = 1;
}
