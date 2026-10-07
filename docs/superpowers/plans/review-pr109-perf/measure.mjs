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
if (rest.includes('--no-panel')) await page.evaluate(() => window.__OPS__.store.getState().setUI({ showPropertiesPanel: false }));
if (rest.includes('--no-dash')) await page.evaluate(() => { CanvasRenderingContext2D.prototype.setLineDash = function () {}; });

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

// --- fase 2: scrollen in de tabel (linker raster naast de Gantt) ---
await phase('2-tabel-scroll', async () => {
  const grid = page.locator('[data-task-grid-surface-id="gantt-task-grid"] [role="grid"]').first();
  const box = await grid.boundingBox();
  if (!box) return { skipped: 'geen grid' };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const lat = [];
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 400);
    lat.push(await frameLatency());
  }
  await waitIdle(1000);
  return { scrollSteps: 40, maxFrameLatencyMs: Math.round(Math.max(...lat)), meanFrameLatencyMs: Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) };
});

// --- fase 3: scrollen en zoomen in de Gantt ---
await phase('3-gantt-scroll-zoom', async () => {
  const canvas = page.getByTestId('gantt-primary-canvas');
  const box = await canvas.boundingBox();
  if (!box) return { skipped: 'geen canvas' };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const lat = [];
  for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 400); lat.push(await frameLatency()); }
  for (let i = 0; i < 20; i++) { await page.mouse.wheel(400, 0); lat.push(await frameLatency()); }
  await page.keyboard.down('Control');
  for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -200); lat.push(await frameLatency()); }
  for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 200); lat.push(await frameLatency()); }
  await page.keyboard.up('Control');
  await waitIdle(1000);
  const zoom = await page.evaluate(() => window.__OPS__.store.getState().view.zoom);
  return { steps: lat.length, maxFrameLatencyMs: Math.round(Math.max(...lat)), meanFrameLatencyMs: Math.round(lat.reduce((a, b) => a + b, 0) / lat.length), zoom };
});

// --- fase 4: een taak selecteren (klik op een rij in het raster) ---
let selectedId = null;
await phase('4-selecteren', async () => {
  const cell = page.locator('[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"] [data-grid-data-cell="true"][data-grid-column-id="task.name"]').nth(5);
  const t0 = await now();
  await cell.click();
  await page.waitForFunction(() => window.__OPS__.store.getState().selectedTaskIds.length > 0, null, { polling: 50 });
  const t1 = await now();
  selectedId = await page.evaluate(() => window.__OPS__.store.getState().selectedTaskIds[0]);
  await waitIdle(1000);
  return { selectToStoreMs: Math.round(t1 - t0), frameLatencyMs: Math.round(await frameLatency()) };
});

// --- fase 5: een veld wijzigen (naamcel: Enter, typen, Enter) ---
await phase('5-veld-wijzigen', async () => {
  const cell = page.locator(`[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key="${selectedId}"] [data-grid-data-cell="true"][data-grid-column-id="task.name"]`);
  await cell.click();
  await page.keyboard.press('Enter');
  const input = cell.locator('input');
  await input.waitFor({ state: 'visible' });
  await input.fill('Perfmeting gewijzigd');
  const t0 = await now();
  await page.keyboard.press('Enter');
  await page.waitForFunction((id) => window.__OPS__.store.getState().tasks.find(t => t.id === id)?.name === 'Perfmeting gewijzigd', selectedId, { polling: 50 });
  const t1 = await now();
  await waitIdle(1000);
  const s = await page.evaluate(() => { const s = window.__OPS__.store.getState(); return { stale: s.scheduleStale, undo: s.historyEvents.length }; });
  return { commitToStoreMs: Math.round(t1 - t0), frameLatencyMs: Math.round(await frameLatency()), ...s };
});

// --- fase 6: F5 (herberekenen) ---
await phase('6-F5', async () => {
  await page.locator('body').click({ position: { x: 5, y: 500 } }).catch(() => {});
  const t0 = await now();
  await page.keyboard.press('F5');
  await page.waitForFunction(() => !window.__OPS__.store.getState().scheduleStale, null, { polling: 100 });
  const t1 = await now();
  await waitIdle(2000);
  const s = await page.evaluate(() => { const s = window.__OPS__.store.getState(); return { datesAsRecorded: s.datesAsRecorded }; });
  return { f5ToFreshMs: Math.round(t1 - t0), ...s };
});

// --- fase 7: 30 s stilzitten (auto-save-ticks) ---
await phase('7-stil-30s', async () => {
  const lat = [];
  const end = Date.now() + 30_000;
  while (Date.now() < end) { lat.push(await frameLatency()); await new Promise(r => setTimeout(r, 250)); }
  return { maxFrameLatencyMs: Math.round(Math.max(...lat)), samples: lat.length };
});

fs.writeFileSync(`${OUT}/phases.json`, JSON.stringify(phases, null, 2));
await browser.close();
log('KLAAR');
