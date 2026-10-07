// Meet de gebruikersroute op een XER-bestand. Gebruik:
//   node measure.mjs <bestand.xer> <label> <poort> [--no-profile]
// Uitvoer: /tmp/ops-perf-rehab2/out/<label>/{phases.json, <fase>.cpuprofile, <fase>.png}
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const WT = '/home/nozzit/open-aec/open-planner-studio/.claude/worktrees/agent-perf-rehab2';
const require = createRequire(path.join(WT, 'package.json'));
const { chromium } = require('playwright');

const [file, label, port, ...rest] = process.argv.slice(2);
const noProfile = rest.includes('--no-profile');
const OUT = `/tmp/ops-perf-rehab2/out/${label}`;
fs.mkdirSync(OUT, { recursive: true });
const base = `http://localhost:${port}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'nl-NL' });
const page = await context.newPage();
page.setDefaultTimeout(600_000);
page.on('pageerror', e => log('PAGEERROR', e.message));
page.on('console', m => { if (m.type() === 'error') log('CONSOLE.ERROR', m.text().slice(0, 300)); });
await page.addInitScript(() => {
  window.__lt = [];
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) window.__lt.push({ s: e.startTime, d: e.duration });
  }).observe({ type: 'longtask', buffered: true });
});
const cdp = await context.newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
await cdp.send('Performance.enable');

const phases = [];
async function now() { return page.evaluate(() => performance.now()); }
async function heapMB() {
  const m = await cdp.send('Performance.getMetrics');
  const h = m.metrics.find(x => x.name === 'JSHeapUsedSize');
  return h ? Math.round(h.value / 1e6) : null;
}
async function phase(name, fn) {
  log('fase start', name);
  if (!noProfile) await cdp.send('Profiler.start');
  const t0 = await now();
  const w0 = Date.now();
  const extra = await fn();
  const t1 = await now();
  const wall = Date.now() - w0;
  let profile = null;
  if (!noProfile) {
    profile = (await cdp.send('Profiler.stop')).profile;
    fs.writeFileSync(`${OUT}/${name}.cpuprofile`, JSON.stringify(profile));
  }
  const lt = await page.evaluate(([a, b]) => window.__lt.filter(e => e.s >= a - 1 && e.s <= b), [t0, t1]);
  const rec = {
    name, wallMs: wall, pageMs: Math.round(t1 - t0),
    longTasks: lt.length,
    longTasksOver200: lt.filter(e => e.d > 200).length,
    maxLongTaskMs: Math.round(Math.max(0, ...lt.map(e => e.d))),
    sumLongTaskMs: Math.round(lt.reduce((s, e) => s + e.d, 0)),
    longTaskList: lt.filter(e => e.d > 200).map(e => ({ at: Math.round(e.s - t0), d: Math.round(e.d) })),
    heapMB: await heapMB(),
    ...(extra ?? {}),
  };
  phases.push(rec);
  fs.writeFileSync(`${OUT}/phases.json`, JSON.stringify(phases, null, 2));
  await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
  log('fase klaar', JSON.stringify({ ...rec, longTaskList: undefined }));
}

// Responsiviteit: hoe lang duurt het voordat een rAF terugkomt (= hoofdthread vrij)?
async function frameLatency() {
  return page.evaluate(() => new Promise(r => { const t = performance.now(); requestAnimationFrame(() => r(performance.now() - t)); }));
}
async function waitIdle(quietMs = 1000, timeout = 600_000) {
  // wacht tot er `quietMs` lang geen nieuwe long task bijkomt
  const start = Date.now();
  let lastCount = -1; let stableSince = Date.now();
  while (Date.now() - start < timeout) {
    const c = await page.evaluate(() => window.__lt.length);
    if (c !== lastCount) { lastCount = c; stableSince = Date.now(); }
    else if (Date.now() - stableSince >= quietMs) return;
    await new Promise(r => setTimeout(r, 100));
  }
}

// --- opstart zoals de testfixture ---
await page.goto(base + '/');
await page.waitForFunction(() => window.__OPS__ !== undefined, null, { timeout: 60_000 });
await page.locator('[data-ops-welcome-dialog]').waitFor({ state: 'attached', timeout: 30_000 });
await page.evaluate(() => {
  const s = window.__OPS__.store.getState();
  s.newProject();
  s.setUI({ showWelcomeDialog: false, showTourOverlay: false, activeRibbonTab: 'start' });
});
await waitIdle(1500);

const buf = fs.readFileSync(file);

// --- fase 1: openen via de echte bestandskiezer ---
await phase('1-openen', async () => {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  const chooserPromise = page.waitForEvent('filechooser');
  await openButton.click();
  const chooser = await chooserPromise;
  const tSet = await now();
  await chooser.setFiles({ name: path.basename(file), mimeType: 'application/octet-stream', buffer: buf });
  // wacht tot taken in de store staan
  await page.waitForFunction(() => window.__OPS__.store.getState().tasks.length > 0, null, { timeout: 600_000, polling: 200 });
  const tTasks = await now();
  await waitIdle(2000);
  const tIdle = await now();
  const info = await page.evaluate(() => {
    const s = window.__OPS__.store.getState();
    return { tasks: s.tasks.length, sequences: s.sequences.length, datesAsRecorded: s.datesAsRecorded, docs: s.documents.length, scheduleStale: s.scheduleStale };
  });
  return { tasksVisibleAfterMs: Math.round(tTasks - tSet), idleAfterMs: Math.round(tIdle - tSet), frameLatencyMs: Math.round(await frameLatency()), ...info };
});


await waitIdle(12000); // eerste auto-save na openen laten passeren
const r = await page.evaluate(async () => {
  const { writeIFC } = await import('/src/services/ifc/ifcWriter.ts');
  const { buildWriteIFCInput } = await import('/src/state/ifcSaveInput.ts');
  const { saveRecovery, fullRecoverySave } = await import('/src/services/recovery/recoveryStore.ts');
  const s = window.__OPS__.store.getState();
  const { id, payload } = s.getOpenDocumentPayloads()[0];
  const out = {};
  const lt0 = window.__lt.length;
  for (const [label, src] of [['z1', { ...payload, xerSourceArchive: undefined }], ['m1', payload], ['z2', { ...payload, xerSourceArchive: undefined }], ['m2', payload]]) {
    let t = performance.now(); const ifc = writeIFC(buildWriteIFCInput(src)); const tw = performance.now() - t;
    t = performance.now();
    await saveRecovery(fullRecoverySave(id, [{ id, ifc, filePath: null, isDirty: true, datesAsRecorded: payload.datesAsRecorded }]));
    const ts = performance.now() - t;
    out[label] = { writeIfcMs: Math.round(tw), ifcMB: +(ifc.length / 1e6).toFixed(1), saveRecoveryWallMs: Math.round(ts) };
    await new Promise(r => setTimeout(r, 1500));
  }
  out.archiveBytes = payload.xerSourceArchive?.byteLength ?? null;
  out.longTasks = window.__lt.slice(lt0).map(e => Math.round(e.d));
  return out;
});
log('AUTOSAVE-ABLATIE', JSON.stringify(r));
await browser.close();
