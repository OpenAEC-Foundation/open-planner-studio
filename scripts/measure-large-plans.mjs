#!/usr/bin/env node
// `npm run measure:large-plans` — nulmeting van de prestaties bij grote planningen (#405 deel 2.4,
// #391 Must 4). Doel: een HERHAALBARE meting met vastgelegde omstandigheden. Geen optimalisatie en
// geen doelen; die stelt de eigenaar vast na de nulmeting.
//
// Wat het doet, in deze volgorde:
//   1. datasets: `scripts/measure-large-plans-data.ts` (via run-ts/esbuild) genereert per grootte een
//      deterministisch IFC-bestand met de bestaande benchmarkgenerator, beschrijft de dataset en meet
//      in Node los: rekenen, IFC schrijven, IFC lezen (controlegetallen, geen browser);
//   2. bouw: een productiebuild (`vite build`, React in productiemodus) met ALLEEN de bestaande
//      bouwvlag `VITE_OPS_BENCH_BRIDGE=1`, zodat `window.__OPS__` er is om state te LEZEN. Hij komt in
//      een tijdelijke map, nooit in `dist/`;
//   3. een kleine statische server op 127.0.0.1 met een vrije poort (geen dev-server, niet bereikbaar
//      van buiten deze machine);
//   4. per grootte en per herhaling een VERSE browsercontext (Playwright Chromium headless, 1600×1000,
//      nl-NL) met de route: openen → scrollen en zoomen → F5 → nivelleren (berekenen + toepassen)
//      → één autosave-tick → herstel na herladen → opslaan (Ctrl+S);
//   5. schrijft één JSON-resultaat (standaard `build/measure-large-plans/<datum>-<commit>.json`) en
//      print een Markdown-tabel (mediaan, min–max).
//
// Alle gemeten handelingen zijn echte browserinvoer (klik, toets, wiel, bestandskiezer). De brug
// `window.__OPS__` leest alleen state (aantal taken, cpmResult, isDirty).
// Meetinstrumenten in de pagina (Long Tasks-observer, een passieve wrapper om IndexedDB-transacties,
// een rAF-lus) veranderen geen productgedrag.
//
// Vlaggen: --sizes 1000,5000,10000  --repeats 3  --out <bestand.json>  --dist <bestaande build>
//          --headed  --skip <fase,...>  --step-timeout-s 900
// Exit 0 = alle metingen gelukt; 1 = minstens één fase mislukt of time-out (staat in de JSON).
// Niet in `npm run verify` en niet in CI: zwaar en machine-afhankelijk.
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { cpus, totalmem, tmpdir, release, platform, arch } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── argumenten ──────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function opt(name, fallback) {
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) { console.error(`${name} mist een waarde`); process.exit(2); }
  return v;
}
const KNOWN = new Set(['--sizes', '--repeats', '--out', '--dist', '--headed', '--skip', '--step-timeout-s']);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  if (!KNOWN.has(argv[i])) { console.error(`onbekend argument: ${argv[i]}`); process.exit(2); }
  if (argv[i] !== '--headed') i++;
}
const SIZES = opt('--sizes', '1000,5000,10000').split(',').map(Number);
const REPEATS = Number(opt('--repeats', '3'));
const HEADED = argv.includes('--headed');
const SKIP = new Set(opt('--skip', '').split(',').filter(Boolean));
const STEP_TIMEOUT_MS = Number(opt('--step-timeout-s', '900')) * 1000;
if (SIZES.some(s => !Number.isInteger(s) || s < 10) || !Number.isInteger(REPEATS) || REPEATS < 1) {
  console.error('ongeldige --sizes of --repeats'); process.exit(2);
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sh = (cmd, args, extra = {}) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...extra });

// ── omstandigheden ──────────────────────────────────────────────────────────────────────────────
function conditions() {
  const git = (...a) => (sh('git', a).stdout ?? '').trim();
  const cpuinfo = existsSync('/proc/cpuinfo') ? readFileSync('/proc/cpuinfo', 'utf8') : '';
  const osRelease = existsSync('/etc/os-release') ? readFileSync('/etc/os-release', 'utf8') : '';
  const prettyOs = /^PRETTY_NAME="?([^"\n]+)"?/m.exec(osRelease)?.[1] ?? `${platform()} ${arch()}`;
  const governor = existsSync('/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor')
    ? readFileSync('/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor', 'utf8').trim() : null;
  const load = existsSync('/proc/loadavg') ? readFileSync('/proc/loadavg', 'utf8').split(' ').slice(0, 3).map(Number) : null;
  return {
    commit: git('rev-parse', 'HEAD'),
    commitShort: git('rev-parse', '--short=9', 'HEAD'),
    commitSubject: git('log', '-1', '--format=%s'),
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    // Productcode: de laatste main-commit in deze stand (de meetscripts zelf raken geen productcode).
    mainBase: git('merge-base', 'HEAD', 'origin/main'),
    productCodeChangedSinceMain: git('diff', '--name-only', 'origin/main...HEAD', '--', 'src', 'public', 'index.html', 'vite.config.ts', 'package.json').split('\n').filter(Boolean),
    // Wijzigingen buiten de meetscripts zelf maken de meting niet meer gelijk aan de commit.
    worktreeDirty: git('status', '--porcelain').split('\n').filter(Boolean),
    appVersion: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version,
    date: new Date().toISOString(),
    cpuModel: /^model name\s*:\s*(.+)$/m.exec(cpuinfo)?.[1] ?? cpus()[0]?.model ?? null,
    logicalCores: cpus().length,
    physicalCores: new Set([...cpuinfo.matchAll(/^core id\s*:\s*(\d+)$/gm)].map(m => m[1])).size || null,
    cpuGovernor: governor,
    ramGiB: Math.round(totalmem() / 2 ** 30 * 10) / 10,
    os: prettyOs,
    kernel: release(),
    node: process.version,
    loadAvgAtStart: load,
  };
}

// ── statische server ────────────────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.wasm': 'application/wasm', '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8', '.ifc': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};
function serve(dir) {
  // Vaste lijst van de bestanden in de buildmap, vooraf opgebouwd: het verzoekpad kiest alleen uit
  // die lijst en komt zelf nooit in een bestandspad terecht. Onbekend pad ⇒ index.html.
  const files = new Map();
  const walk = (abs, rel) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childAbs = join(abs, entry.name);
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(childAbs, childRel);
      else if (entry.isFile()) files.set(childRel, childAbs);
    }
  };
  walk(resolve(dir), '');
  const index = files.get('/index.html');
  const server = createServer((req, res) => {
    let key = '/';
    try { key = decodeURIComponent((req.url ?? '/').split('?')[0]); } catch { /* ongeldig pad ⇒ index */ }
    const file = files.get(key) ?? index;
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

// ── meethulp in de pagina (alleen observeren) ────────────────────────────────────────────────────
// Long Tasks, een passieve paintteller op het Gantt-canvas, een passieve wrapper om IndexedDB-transacties op `ops-recovery` (start, einde, bytes),
// de tijdstempel van de laatste echte invoer (wheel/keydown/pointerdown) en een rAF-lus die wacht op
// een vaste voorwaarde. Voorwaarden staan hier als vaste functies (geen eval in de pagina).
const INIT_SCRIPT = `(() => {
  const nm = window.__nm = { lt: [], idb: [], input: { wheel: 0, keydown: 0, pointerdown: 0 } };
  try {
    new PerformanceObserver(list => { for (const e of list.getEntries()) nm.lt.push({ s: e.startTime, d: e.duration }); })
      .observe({ type: 'longtask', buffered: true });
  } catch {}
  for (const type of ['wheel', 'keydown', 'pointerdown']) {
    window.addEventListener(type, e => { nm.input[type] = e.timeStamp; }, { capture: true, passive: true });
  }
  const origTx = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function (stores, mode, ...rest) {
    const tx = origTx.call(this, stores, mode, ...rest);
    if (this.name === 'ops-recovery' && mode === 'readwrite') {
      const rec = { start: performance.now(), end: null, bytes: 0, ok: null };
      nm.idb.push(rec);
      tx.addEventListener('complete', () => { rec.end = performance.now(); rec.ok = true; });
      tx.addEventListener('abort', () => { rec.end = performance.now(); rec.ok = false; });
      const origStore = tx.objectStore;
      tx.objectStore = function (name) {
        const store = origStore.call(this, name);
        const origPut = store.put;
        store.put = function (value, ...r) {
          if (value && typeof value.ifc === 'string') rec.bytes += value.ifc.length;
          return origPut.call(this, value, ...r);
        };
        return store;
      };
    }
    return tx;
  };
  // Gantt-tekeningen: de brug telt paints, maar meet geen duur. Daarom herkent hier een
  // passieve wrapper om fillRect de achtergrondvulling (0,0) waarmee GanttRenderer.render() begint op
  // het primaire Gantt-canvas. Begin = die vulling; einde = de microtaak direct na de synchrone
  // tekenaanroep (dus inclusief wat dezelfde taak er nog synchroon achteraan doet).
  nm.paintLog = [];
  let inPaint = false;
  const origFill = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
    if (x === 0 && y === 0 && !inPaint && this.canvas.dataset && this.canvas.dataset.testid === 'gantt-primary-canvas') {
      inPaint = true;
      const rec = { s: performance.now(), e: null };
      nm.paintLog.push(rec);
      queueMicrotask(() => { rec.e = performance.now(); inPaint = false; });
    }
    return origFill.call(this, x, y, w, h);
  };
  // Opslaan: tijdstip van de download-klik (terugvalroute) of van het sluiten van een FSA-schrijfstroom.
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) nm.downloadAt = performance.now(); return origClick.call(this); };
  if (typeof FileSystemWritableFileStream !== 'undefined') {
    const origClose = FileSystemWritableFileStream.prototype.close;
    FileSystemWritableFileStream.prototype.close = function () { return origClose.call(this).then(v => { nm.fsaCloseAt = performance.now(); return v; }); };
  }
  const S = () => window.__OPS__.store.getState();
  // Store-voorwaarden: de subscription in arm() noteert het EERSTE moment dat ze waar zijn
  // (synchroon binnen de store-update, dus vóór React en vóór de tekening).
  const storeConds = {
    loaded: (s, a) => s.tasks.length === a.tasks && s.tasks !== nm.refTasks,
    cpm: s => s.cpmResult !== nm.refCpm,
    clean: s => !s.isDirty,
    tasksChanged: s => s.tasks !== nm.refTasks,
  };
  const paintAfter = t => nm.paintLog.find(p => p.s >= t && p.e != null) ?? null;
  const conds = {
    // Taken in de store én daarna een complete Gantt-tekening.
    store: a => nm.storeAt != null && (!a.paint || !!paintAfter(nm.storeAt)),
    paint: a => nm.paintLog.length > a.p0 && nm.paintLog[a.p0].e != null,
    levelDone: () => {
      const d = document.querySelector('[role="dialog"]');
      if (!d || d.querySelector('[role="status"]')) return false;
      if (d.querySelector('[role="alert"]')) return true;
      const apply = [...d.querySelectorAll('button')].find(b => /^(Toepassen|Apply)$/.test(b.textContent.trim()));
      return !!apply && !apply.disabled;
    },
    recoveryDialog: () => !!document.querySelector('[data-ops-recovery-dialog]'),
  };
  nm.arm = (kind, a) => {
    nm.p0 = nm.paintLog.length;
    nm.storeAt = null;
    if (nm.unsub) nm.unsub();
    nm.unsub = null;
    if (window.__OPS__) {
      nm.refCpm = S().cpmResult; nm.refTasks = S().tasks;
      if (kind) nm.unsub = window.__OPS__.store.subscribe(st => {
        if (nm.storeAt == null && storeConds[kind](st, a)) nm.storeAt = performance.now();
      });
    }
    nm.t0 = performance.now();
    return { p0: nm.p0, t0: nm.t0 };
  };
  // Wacht via rAF tot de voorwaarde waar is. Geeft { hit (rAF-tijd van herkenning), storeAt,
  // paintEnd (einde van de eerste Gantt-tekening na de store-wijziging, of na p0) } terug, of null.
  nm.until = (name, a, timeoutMs) => new Promise(resolve => {
    const start = performance.now();
    const tick = () => {
      let ok = false;
      try { ok = conds[name](a); } catch {}
      if (ok) {
        const p = name === 'paint' ? nm.paintLog[a.p0] : (nm.storeAt != null ? paintAfter(nm.storeAt) : null);
        resolve({ hit: performance.now(), storeAt: nm.storeAt, paintStart: p ? p.s : null, paintEnd: p ? p.e : null });
        return;
      }
      if (performance.now() - start > timeoutMs) { resolve(null); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  nm.longTasks = (from, to) => nm.lt.filter(e => e.s + e.d >= from && e.s <= to);
})();`;

// ── statistiek ──────────────────────────────────────────────────────────────────────────────────
const r1 = v => (v == null || Number.isNaN(v) ? null : Math.round(v * 10) / 10);
function summarize(samples) {
  const xs = samples.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return { n: 0, median: null, min: null, max: null, samples };
  const mid = Math.floor(xs.length / 2);
  const median = xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  return { n: xs.length, median: r1(median), min: r1(xs[0]), max: r1(xs[xs.length - 1]), samples: samples.map(r1) };
}
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };

// ── één herhaling voor één grootte ───────────────────────────────────────────────────────────────
async function oneRun(browser, baseUrl, dataset, ifcBuffer, repIndex) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'nl-NL', acceptDownloads: true });
  await context.addInitScript(INIT_SCRIPT);
  const page = await context.newPage();
  page.setDefaultTimeout(STEP_TIMEOUT_MS);
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`.slice(0, 400)));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`.slice(0, 400)); });
  // Herladen met een gewijzigd document vraagt een beforeunload-bevestiging; die accepteren we.
  page.on('dialog', d => { void d.accept(); });

  const r = { rep: repIndex + 1, phases: {}, notes: [], errors };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const until = (name, a = {}, timeout = STEP_TIMEOUT_MS) => ev(([n, x, t]) => window.__nm.until(n, x, t), [name, a, timeout]);
  const arm = (kind = null, a = {}) => ev(([k, x]) => window.__nm.arm(k, x), [kind, a]);
  const longest = (from, to) => ev(([f, t]) => window.__nm.longTasks(f, t).reduce((m, e) => Math.max(m, e.d), 0), [from, to]);
  async function waitQuiet(quietMs = 1500, timeout = 120_000) {
    const t = Date.now(); let last = -1; let since = Date.now();
    while (Date.now() - t < timeout) {
      const c = await ev(() => window.__nm.lt.length + window.__nm.idb.filter(x => x.end == null).length * 1000);
      if (c !== last) { last = c; since = Date.now(); } else if (Date.now() - since >= quietMs) return;
      await new Promise(res => setTimeout(res, 100));
    }
  }
  const fail = (phase, msg) => { r.phases[phase] = { ok: false, error: msg }; log(`  ! ${phase}: ${msg}`); };

  try {
    // Opstart: app laden tot de welkomstdialoog, dan "Overslaan" (echte klik).
    await page.goto(baseUrl + '/');
    await page.waitForFunction(() => window.__OPS__ !== undefined, null, { timeout: 60_000 });
    await page.locator('[data-ops-welcome-dialog]').waitFor({ state: 'attached', timeout: 60_000 });
    r.bootToWelcomeMs = r1(await ev(() => performance.now()));
    await page.locator('[data-ops-welcome-dialog] button').filter({ hasText: /^(Overslaan|Skip)$/ }).click();
    await page.locator('[data-ops-welcome-dialog]').waitFor({ state: 'detached' });
    await waitQuiet(1000);

    // ── 1 openen: bestandskiezer → taken in de store én de Gantt opnieuw getekend ──
    {
      const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
      const chooserP = page.waitForEvent('filechooser');
      await openButton.click();
      const chooser = await chooserP;
      const { t0 } = await arm('loaded', { tasks: dataset.tasks });
      await chooser.setFiles({ name: dataset.file, mimeType: 'application/octet-stream', buffer: ifcBuffer });
      const hit = await until('store', { paint: true });
      if (!hit) fail('open', 'time-out');
      else {
        const state = await ev(() => { const s = window.__OPS__.store.getState(); return { scheduleStale: s.scheduleStale, datesAsRecorded: s.datesAsRecorded, hasCpm: !!s.cpmResult, isDirty: s.isDirty, documents: s.documents.length }; });
        r.phases.open = { ok: true, ms: r1(hit.paintEnd - t0), storeMs: r1(hit.storeAt - t0), paintMs: r1(hit.paintEnd - hit.paintStart), longestTaskMs: r1(await longest(t0, hit.paintEnd)), ...state };
      }
      await waitQuiet();
    }

    // ── 2 interactie: verticaal scrollen en zoomen in de Gantt, wiel → einde volgende Gantt-tekening ──
    // Standaard scrollmodus is 'drag' (src/utils/ganttWheel.ts): Shift+wiel scrolt de rijen, het
    // wiel zonder toets zoomt (op de cursor). Dat zijn hier de twee gemeten handelingen.
    if (!SKIP.has('interaction') && r.phases.open?.ok) {
      const canvas = page.getByTestId('gantt-primary-canvas');
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const steps = async (n, dy, shift) => {
        const lat = []; const render = []; let missed = 0;
        if (shift) await page.keyboard.down('Shift');
        for (let i = 0; i < n; i++) {
          const { p0 } = await arm();
          await page.mouse.wheel(0, dy);
          const hit = await until('paint', { p0 }, 3000);
          if (!hit) { missed++; continue; }
          const input = await ev(() => window.__nm.input.wheel);
          lat.push(hit.paintEnd - input);
          render.push(hit.paintEnd - hit.paintStart);
        }
        if (shift) await page.keyboard.up('Shift');
        return { lat, render, missed };
      };
      const pack = st => ({
        steps: st.lat.length, noPaint: st.missed,
        frameMedianMs: r1(pct(st.lat, 0.5)), frameP95Ms: r1(pct(st.lat, 0.95)), frameMaxMs: r1(Math.max(...st.lat)),
        renderMedianMs: r1(pct(st.render, 0.5)), renderMaxMs: r1(Math.max(...st.render)),
      });
      const t0 = await ev(() => performance.now());
      const scroll = await steps(30, 300, true);
      const yAfter = await ev(() => window.__OPS__.store.getState().view.scrollY);
      await waitQuiet(800);
      const t1 = await ev(() => performance.now());
      const zoomIn = await steps(8, -100, false);
      const zoomOut = await steps(8, 100, false);
      await waitQuiet(800);
      const t2 = await ev(() => performance.now());
      r.phases.scroll = { ok: scroll.lat.length > 0, ...pack(scroll), scrollYAfter: r1(yAfter), longestTaskMs: r1(await longest(t0, t1)) };
      r.phases.zoom = { ok: zoomIn.lat.length + zoomOut.lat.length > 0,
        ...pack({ lat: [...zoomIn.lat, ...zoomOut.lat], render: [...zoomIn.render, ...zoomOut.render], missed: zoomIn.missed + zoomOut.missed }),
        longestTaskMs: r1(await longest(t1, t2)) };
      r.viewAfterInteraction = await ev(() => { const v = window.__OPS__.store.getState().view; return { zoom: v.zoom, scrollY: v.scrollY }; });
    }

    // ── 3 herberekenen: F5 → nieuw cpmResult in de store én de Gantt getekend ──
    if (!SKIP.has('f5') && r.phases.open?.ok) {
      await page.getByTestId('gantt-primary-canvas').hover();
      await arm('cpm');
      const idbBefore = await ev(() => window.__nm.idb.length);
      await page.keyboard.press('F5');
      const hit = await until('store', { paint: true });
      const input = await ev(() => window.__nm.input.keydown);
      if (!hit) fail('f5', 'time-out (geen nieuw cpmResult)');
      else {
        const overlap = await ev(([n, a, b]) => window.__nm.idb.slice(n).some(x => x.start >= a && x.start <= b), [idbBefore, input, hit.paintEnd]);
        r.phases.f5 = { ok: true, ms: r1(hit.paintEnd - input), storeMs: r1(hit.storeAt - input), paintMs: r1(hit.paintEnd - hit.paintStart), longestTaskMs: r1(await longest(input, hit.paintEnd)), autosaveInWindow: overlap,
          isDirtyAfter: await ev(() => window.__OPS__.store.getState().isDirty) };
      }
      await waitQuiet(2000);
    }

    // ── 5 nivelleren: Resources → Nivelleren → Berekenen (worker) → Toepassen ──
    if (!SKIP.has('level') && r.phases.open?.ok) {
      await page.locator('[data-ops-ribbon-tab="resources"]').click();
      await page.locator('[data-ops-ribbon-item="levelResources"]').first().click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
      const inCalc = await ev(() => window.__nm.input.pointerdown);
      const calc = await until('levelDone', {});
      if (!calc) fail('levelCalculate', 'time-out');
      else {
        const info = await ev(() => {
          const d = document.querySelector('[role="dialog"]');
          return { rows: d.querySelectorAll('table tbody tr').length, problem: d.querySelector('[role="alert"]')?.textContent ?? null };
        });
        // Herkend in een rAF-lus: resolutie ±1 frame (16,7 ms).
        r.phases.levelCalculate = { ok: !info.problem, ms: r1(calc.hit - inCalc), longestTaskMs: r1(await longest(inCalc, calc.hit)), ...info };
        if (!info.problem) {
          await arm('tasksChanged');
          await dialog.getByRole('button', { name: /^(Toepassen|Apply)$/ }).click();
          const inApply = await ev(() => window.__nm.input.pointerdown);
          const applied = await until('store', { paint: true });
          if (!applied) fail('levelApply', 'time-out');
          else r.phases.levelApply = { ok: true, ms: r1(applied.paintEnd - inApply), storeMs: r1(applied.storeAt - inApply), longestTaskMs: r1(await longest(inApply, applied.paintEnd)),
            isDirtyAfter: await ev(() => window.__OPS__.store.getState().isDirty) };
        }
      }
      // Nivelleerdialoog nog open (fout)? Sluit met Escape zodat de rest kan doorgaan.
      if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
    }

    // ── 6 autosave-tick: de eerste crashherstel-ronde na de laatste wijziging ──
    // Gemeten zonder productcode: de tick serialiseert synchroon (één long task) en schrijft daarna
    // in één IndexedDB-readwrite-transactie. Tick = start van die long task → einde transactie.
    if (!SKIP.has('autosave') && r.phases.open?.ok) {
      const dirty = await ev(() => window.__OPS__.store.getState().isDirty);
      if (!dirty) r.notes.push('autosave: document was niet gewijzigd; geen tick verwacht');
      // Wacht tot er een complete ronde met IFC-inhoud ligt die NA de laatste wijziging begon
      // (throttle: hoogstens ±10 s na de vorige ronde).
      const since = await ev(() => Math.max(window.__nm.input.pointerdown, window.__nm.input.keydown));
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        const seen = await ev(s => window.__nm.idb.some(x => x.start >= s && x.end != null && x.bytes > 0), since);
        if (seen) break;
        await new Promise(res => setTimeout(res, 250));
      }
      // Neem de LAATSTE complete tick met IFC-inhoud (die na nivelleren), niet een eerdere.
      let tick = await ev(() => [...window.__nm.idb].reverse().find(x => x.end != null && x.bytes > 0) ?? null);
      if (!tick) fail('autosave', 'geen autosave-tick met IFC-inhoud gezien');
      else {
        const ser = await ev(t => window.__nm.lt.filter(e => e.s <= t.start && e.s + e.d >= t.start - 50).sort((a, b) => b.s - a.s)[0] ?? null, tick);
        const start = ser ? ser.s : tick.start;
        r.phases.autosave = {
          ok: !!tick.ok, ms: r1(tick.end - start), serializeTaskMs: ser ? r1(ser.d) : null, idbTransactionMs: r1(tick.end - tick.start),
          ifcChars: tick.bytes, serializeDetected: !!ser,
        };
        r.allTicks = await ev(() => window.__nm.idb.map(x => ({ start: Math.round(x.start), ms: x.end == null ? null : Math.round(x.end - x.start), bytes: x.bytes })));
      }
    }

    // ── 7 herstel: herladen (crashherstel-kopie in IndexedDB) → herstelvraag → Herstellen → Gantt ──
    if (!SKIP.has('recovery') && r.phases.autosave?.ok) {
      await page.reload({ waitUntil: 'commit' });
      await page.waitForFunction(() => window.__nm && window.__OPS__ !== undefined, null, { timeout: 60_000 });
      const shown = await until('recoveryDialog', {}, 120_000);
      if (!shown) fail('recoveryOffer', 'geen herstelvraag na herladen');
      else {
        r.phases.recoveryOffer = { ok: true, ms: r1(shown.hit), note: 'navigatiestart → herstelvraag zichtbaar (app-start + snapshot lezen en parsen)' };
        await arm('loaded', { tasks: dataset.tasks });
        await page.locator('[data-ops-recovery-dialog] button').filter({ hasText: /^(Herstellen|Restore)$/ }).click();
        const inRestore = await ev(() => window.__nm.input.pointerdown);
        const done = await until('store', { paint: true });
        if (!done) fail('recoveryRestore', 'time-out');
        else r.phases.recoveryRestore = { ok: true, ms: r1(done.paintEnd - inRestore), storeMs: r1(done.storeAt - inRestore), longestTaskMs: r1(await longest(inRestore, done.paintEnd)),
          isDirtyAfter: await ev(() => window.__OPS__.store.getState().isDirty) };
      }
      await waitQuiet(1500);
    }

    // ── 8 opslaan: Ctrl+S op het herstelde, gewijzigde document → bestand klaar ──
    // Een document uit de bestandskiezer van Playwright heeft geen schrijfbare handle; de app valt dan
    // terug op een download (dezelfde route als ifc-schema.spec.ts). Klaar = de download-klik van de
    // app (IFC-tekst geschreven en als Blob aangeboden); daarnaast: isDirty → false.
    if (!SKIP.has('save') && r.phases.open?.ok) {
      const dirty = await ev(() => window.__OPS__.store.getState().isDirty);
      if (!dirty) r.notes.push('opslaan: document was niet gewijzigd vóór Ctrl+S');
      const downloadP = page.waitForEvent('download', { timeout: STEP_TIMEOUT_MS }).catch(() => null);
      await arm('clean');
      await ev(() => { window.__nm.downloadAt = null; window.__nm.fsaCloseAt = null; });
      await page.keyboard.press('Control+s');
      const input = await ev(() => window.__nm.input.keydown);
      const dl = await downloadP;
      const done = await ev(() => ({ downloadAt: window.__nm.downloadAt, fsaCloseAt: window.__nm.fsaCloseAt, cleanAt: window.__nm.storeAt }));
      const end = done.downloadAt ?? done.fsaCloseAt;
      if (end == null) fail('save', 'geen download of bestandsschrijfactie gezien');
      else r.phases.save = { ok: true, ms: r1(end - input), cleanMs: done.cleanAt == null ? null : r1(done.cleanAt - input),
        longestTaskMs: r1(await longest(input, end)), route: done.downloadAt != null ? 'download' : 'bestandshandle',
        bytes: dl ? statSync(await dl.path()).size : null, wasDirty: dirty };
    }
  } catch (e) {
    r.notes.push(`afgebroken: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    log('  ! afgebroken:', e instanceof Error ? e.message.split('\n')[0] : e);
  } finally {
    r.heapMB = await ev(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null).catch(() => null);
    await context.close();
  }
  return r;
}

// ── hoofdroute ──────────────────────────────────────────────────────────────────────────────────
const cond = conditions();
log(`commit ${cond.commitShort} (${cond.branch}) · ${cond.cpuModel} · ${cond.logicalCores} threads · ${cond.ramGiB} GiB`);
const work = mkdtempSync(join(tmpdir(), 'ops-measure-large-plans-'));

log('datasets genereren + Node-metingen …');
const dataRun = sh(process.execPath, ['scripts/run-ts.mjs', 'scripts/measure-large-plans-data.ts', '--out', work, '--sizes', SIZES.join(','), '--repeats', String(REPEATS)], { stdio: 'inherit' });
if (dataRun.status !== 0) { console.error('datasets genereren mislukt'); process.exit(1); }
const datasets = JSON.parse(readFileSync(join(work, 'datasets.json'), 'utf8'));

let dist = opt('--dist', null);
if (dist) dist = resolve(dist);
else {
  dist = join(work, 'dist');
  log('productiebuild met VITE_OPS_BENCH_BRIDGE=1 …');
  const b = sh(join(ROOT, 'node_modules', '.bin', 'vite'), ['build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'], {
    env: { ...process.env, VITE_OPS_BENCH_BRIDGE: '1' }, stdio: 'inherit',
  });
  if (b.status !== 0) { console.error('build mislukt'); process.exit(1); }
}
if (!existsSync(join(dist, 'index.html'))) { console.error(`geen build in ${dist}`); process.exit(1); }

const server = await serve(dist);
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: !HEADED });
cond.chromium = browser.version();
cond.headless = !HEADED;
cond.viewport = '1600x1000';
cond.deviceScaleFactor = 1;
cond.locale = 'nl-NL';
cond.build = 'vite build (productie, React productiemodus) + VITE_OPS_BENCH_BRIDGE=1';
cond.repeats = REPEATS;
log(`Chromium ${cond.chromium} ${HEADED ? 'headed' : 'headless'} op ${baseUrl}`);

const results = [];
let failed = false;
for (const ds of datasets.datasets) {
  const buf = readFileSync(join(work, ds.file));
  const runs = [];
  for (let i = 0; i < REPEATS; i++) {
    log(`grootte ${ds.size} · herhaling ${i + 1}/${REPEATS}`);
    const run = await oneRun(browser, baseUrl, ds, buf, i);
    for (const [k, v] of Object.entries(run.phases)) log(`  ${k}: ${v.ok ? `${v.ms ?? v.frameMedianMs} ms` : `MISLUKT ${v.error ?? ''}`}`);
    runs.push(run);
  }
  const phaseNames = [...new Set(runs.flatMap(r => Object.keys(r.phases)))];
  const summary = {};
  for (const name of phaseNames) {
    const okRuns = runs.map(r => r.phases[name]).filter(p => p?.ok);
    if (okRuns.length < REPEATS) failed = true;
    const fields = [...new Set(okRuns.flatMap(p => Object.keys(p)))].filter(f => okRuns.every(p => typeof p[f] === 'number'));
    summary[name] = Object.fromEntries(fields.map(f => [f, summarize(okRuns.map(p => p[f]))]));
    summary[name].okRuns = okRuns.length;
  }
  results.push({ size: ds.size, dataset: ds, summary, runs });
}
await browser.close();
server.close();

const outFile = resolve(opt('--out', join(ROOT, 'build', 'measure-large-plans', `${cond.date.slice(0, 10)}-${cond.commitShort}.json`)));
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify({ kind: 'ops-measure-large-plans', schema: 1, conditions: cond, seed: datasets.seed, results }, null, 2) + '\n');

// ── Markdown-tabel ──────────────────────────────────────────────────────────────────────────────
const fmt = s => (s && s.median != null ? `${s.median} (${s.min}–${s.max})` : '—');
const ROWS = [
  ['open', 'ms', 'Openen: bestand gekozen → Gantt getekend'],
  ['open', 'storeMs', 'Openen: bestand gekozen → taken in de store'],
  ['scroll', 'frameMedianMs', 'Verticaal scrollen (Shift+wiel): wiel → tekening klaar, mediaan per stap'],
  ['scroll', 'frameP95Ms', 'Verticaal scrollen: p95 per stap'],
  ['scroll', 'renderMedianMs', 'Verticaal scrollen: duur van één Gantt-tekening, mediaan'],
  ['zoom', 'frameMedianMs', 'Zoomen (wiel): wiel → tekening klaar, mediaan per stap'],
  ['zoom', 'frameP95Ms', 'Zoomen: p95 per stap'],
  ['zoom', 'renderMedianMs', 'Zoomen: duur van één Gantt-tekening, mediaan'],
  ['f5', 'ms', 'F5: toets → Gantt getekend'],
  ['f5', 'storeMs', 'F5: toets → nieuw rekenresultaat in de store'],
  ['levelCalculate', 'ms', 'Nivelleren: Berekenen → voorstel zichtbaar'],
  ['levelApply', 'ms', 'Nivelleren: Toepassen → Gantt getekend'],
  ['autosave', 'ms', 'Autosave-tick: serialiseren + IndexedDB-transactie'],
  ['autosave', 'serializeTaskMs', 'Autosave-tick: serialiseren (long task)'],
  ['autosave', 'idbTransactionMs', 'Autosave-tick: IndexedDB-transactie'],
  ['recoveryOffer', 'ms', 'Herstel: herladen → herstelvraag zichtbaar'],
  ['recoveryRestore', 'ms', 'Herstel: Herstellen → Gantt getekend'],
  ['save', 'ms', 'Opslaan: Ctrl+S → bestand klaar (download)'],
];
const lines = [];
lines.push(`Nulmeting grote planningen — commit ${cond.commitShort}, ${cond.date.slice(0, 10)}, ${REPEATS}× per grootte, mediaan (min–max) in ms`);
lines.push('');
lines.push(`| Fase | Waar | ${results.map(r => `${r.size}`).join(' | ')} |`);
lines.push(`| --- | --- | ${results.map(() => '---:').join(' | ')} |`);
for (const [phase, field, label] of ROWS) {
  lines.push(`| ${label} | browser | ${results.map(r => fmt(r.summary[phase]?.[field])).join(' | ')} |`);
}
for (const [field, label] of [['cpmMs', 'Rekenen (CPMSolver.solve)'], ['ifcWriteMs', 'IFC schrijven (writeIFC)'], ['ifcReadMs', 'IFC lezen (readIFC)']]) {
  lines.push(`| ${label} | Node | ${results.map(r => fmt(r.dataset.node[field])).join(' | ')} |`);
}
console.log('\n' + lines.join('\n') + '\n');
log(`resultaat: ${outFile}`);
process.exit(failed ? 1 : 0);
