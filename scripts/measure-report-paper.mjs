import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const BASE = arg('--url');
if (!BASE) {
  console.error('gebruik: node scripts/measure-report-paper.mjs --url http://localhost:<poort>/ [--out pad.json]');
  process.exit(2);
}
const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'onbekend'; } })();
const OUT = arg('--out', path.join('qa', 'report-paper', `snelheid-${commit}.json`));
const PLAN_DIR = path.join('qa', 'report-paper');
const PLAN = `${PLAN_DIR}/plan-5000.ifc`;
if (!fs.existsSync(PLAN)) {
  execSync(`"${process.execPath}" scripts/run-ts.mjs scripts/measure-large-plans-data.ts --out ${PLAN_DIR} --sizes 5000 --repeats 1`, { stdio: 'inherit' });
}
const GOAL_MS = 150;
const ROUNDS = Math.max(1, Number(arg('--rounds', '1')) || 1);
const PROFILE = arg('--profile', null);

const result = {
  started: new Date().toISOString(),
  commit,
  url: BASE, plan: PLAN, viewport: '1600x900', rounds: ROUNDS, loadStart: os.loadavg(), actions: {}, roundEnds: [], errors: [],
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'nl-NL' });
await ctx.addInitScript(() => {
  localStorage.setItem('ops-welcomeSeen', 'true');
  localStorage.setItem('ops-locale', 'nl');
  localStorage.removeItem('ops-reportSettings');

  const viewport = () => document.querySelector('[data-rs-viewport]');
  const pagesInView = () => {
    const vp = viewport();
    if (!vp) return [];
    const r = vp.getBoundingClientRect();
    return [...document.querySelectorAll('[data-rs-page]')].filter(n => {
      const b = n.querySelector('.rs-page')?.getBoundingClientRect() ?? n.getBoundingClientRect();
      return b.bottom > r.top && b.top < r.bottom && b.right > r.left && b.left < r.right;
    });
  };
  const centerPage = () => {
    const vp = viewport();
    if (!vp) return null;
    const r = vp.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    let best = null;
    let bestD = Infinity;
    for (const n of pagesInView()) {
      const b = (n.querySelector('.rs-page') ?? n).getBoundingClientRect();
      const d = Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom));
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  };
  const drawn = n => !!n.querySelector('[data-report-page-svg]');
  const paperId = () => document.querySelector('[data-rs-paper]')?.getAttribute('data-rs-paper') ?? null;

  window.__meet = {
    arm({ trigger, needPaper = false, zoomFrom = null, timeoutMs = 10000 }) {
      const paperBefore = paperId();
      const marksFrom = performance.now();
      let resolveDone;
      const done = new Promise(r => { resolveDone = r; });
      const begin = start => {
        let frames = 0;
        let centerSkeleton = 0;
        const tick = () => {
          frames++;
          const center = centerPage();
          if (center && !drawn(center)) centerSkeleton++;
          const visible = pagesInView();
          const allDrawn = visible.length > 0 && visible.every(drawn);
          const paperOk = !needPaper || paperId() !== paperBefore;
          const zoomOk = zoomFrom === null || document.querySelector('[data-rs-zoom="value"]')?.textContent !== zoomFrom;
          if (allDrawn && paperOk && zoomOk) {
            requestAnimationFrame(() => {
              const end = performance.now();
              const steps = performance.getEntriesByType('measure')
                .filter(e => e.name.startsWith('ops-report:') && e.startTime >= marksFrom - 1)
                .map(e => [e.name.replace('ops-report:', ''), Math.round(e.duration)]);
              resolveDone({
                ms: Math.round(end - start), frames: frames + 1, centerSkeletonFrames: centerSkeleton,
                pages: visible.map(n => Number(n.dataset.rsPage)), steps,
              });
            });
          } else if (performance.now() - start > timeoutMs) {
            resolveDone({ timeout: true, ms: Math.round(performance.now() - start), frames, allDrawn, paperOk, zoomOk });
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      };
      if (trigger === 'now') {
        window.__meetBegin = () => begin(performance.now());
      } else {
        document.addEventListener(trigger, e => begin(e.timeStamp), { capture: true, once: true });
      }
      window.__meetDone = done;
    },
  };
});

const page = await ctx.newPage();
page.setDefaultTimeout(60000);
page.on('pageerror', e => result.errors.push(String(e.message ?? e)));
const cdp = await ctx.newCDPSession(page);
const heapMB = async () => Math.round((await cdp.send('Runtime.getHeapUsage')).usedSize / 1e5) / 10;
const domCounters = async () => {
  const c = await cdp.send('Memory.getDOMCounters');
  return { nodes: c.nodes, listeners: c.jsEventListeners, documents: c.documents };
};
let round = 1;

const ready = async () => {
  await page.waitForFunction(() => document.querySelector('[data-rs-status]')?.getAttribute('data-busy') === 'false', null, { timeout: 120000 });
  await page.waitForTimeout(700);
};
const done = () => page.evaluate(() => window.__meetDone);
const record = async (key, value) => {
  const entry = { round, ...value, heapMB: await heapMB(), dom: await domCounters() };
  (result.actions[key] ??= []).push(entry);
  console.log(`${key} r${round}`.padEnd(22), JSON.stringify(entry));
};
const topSelf = (profile, n = 15) => {
  const byId = new Map(profile.nodes.map(node => [node.id, node]));
  const self = new Map();
  const dt = profile.timeDeltas;
  for (let i = 0; i < profile.samples.length; i++) {
    const node = byId.get(profile.samples[i]);
    const f = node.callFrame;
    const key = `${f.functionName || '(anoniem)'} ${f.url.replace(/^.*\/(src|node_modules|@fs)\//, '$1/').replace(/\?.*$/, '')}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
  }
  return [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, ms]) => [k, Math.round(ms)]);
};
const openStep = async id => {
  if (!await page.locator(`[data-rs-step-body="${id}"]`).count()) await page.locator(`[data-rs-step-head="${id}"]`).click();
  await ready();
};

try {
  const t0 = Date.now();
  await page.goto(`${BASE}?open=${PLAN}&tab=report&theme=light`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.__OPS__?.store.getState().tasks.length === 5000, null, { timeout: 240000 });
  await page.locator('[data-report-page-svg="0"]').waitFor({ timeout: 240000 });
  await ready();
  result.loadMs = Date.now() - t0;
  console.log('geladen in', result.loadMs, 'ms');

  for (round = 1; round <= ROUNDS; round++) {
    for (const ratio of [0.7, 0.3, 0.9, 0.5, 0.1, 0.7]) {
      await page.evaluate(() => window.__meet.arm({ trigger: 'now' }));
      await page.evaluate(r => {
        const vp = document.querySelector('[data-rs-viewport]');
        window.__meetBegin();
        vp.scrollTop = (vp.scrollHeight - vp.clientHeight) * r;
      }, ratio);
      await record('sprong', { ratio, ...await done() });
      await ready();
    }

    for (const mode of ['in', 'out', 'out', 'in']) {
      const before = await page.locator('[data-rs-zoom="value"]').innerText();
      await page.evaluate(zoomFrom => window.__meet.arm({ trigger: 'click', zoomFrom }), before);
      await page.locator(`[data-rs-zoom="${mode}"]`).click();
      await record(`zoom-${mode}`, { from: before, ...await done() });
      await ready();
    }
    await page.locator('[data-rs-zoom="page"]').click();
    await ready();

    await openStep('columns');
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-rs-add-column]').click();
      await page.locator('[data-rs-picker-search]').fill('Kalenderdagen');
      await page.waitForTimeout(150);
      await page.evaluate(() => window.__meet.arm({ trigger: 'keydown', needPaper: true }));
      await page.keyboard.press('Enter');
      await record('kolom-erbij', await done());
      await ready();
      await page.evaluate(() => window.__meet.arm({ trigger: 'click', needPaper: true }));
      await page.locator('[data-rs-remove="task.time.calendarDays"]').click();
      await record('kolom-weg', await done());
      await ready();
    }

    await openStep('page');
    for (const size of ['A2', 'A3', 'A2', 'A3']) {
      await page.evaluate(() => window.__meet.arm({ trigger: 'click', needPaper: true }));
      await page.locator(`[data-rs-segmented="paperSize"] [data-rs-value="${size}"]`).click();
      await record('papier', { size, ...await done() });
      await ready();
    }
    await openStep('bars');
    await page.evaluate(() => { const vp = document.querySelector('[data-rs-viewport]'); vp.scrollTop = (vp.scrollHeight - vp.clientHeight) * 0.7; });
    await ready();
    if (PROFILE) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
      await cdp.send('Profiler.start');
      await cdp.send('HeapProfiler.enable');
      await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    }
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.__meet.arm({ trigger: 'click', needPaper: true }));
      await page.locator('[data-rs-switch="showFloat"]').click();
      await record('speling', await done());
      await ready();
    }
    if (PROFILE) {
      const { profile } = await cdp.send('Profiler.stop');
      await cdp.send('Profiler.disable');
      const file = `${PROFILE}-r${round}.cpuprofile`;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(profile));
      const top = topSelf(profile);
      const { profile: heap } = await cdp.send('HeapProfiler.stopSampling');
      const alloc = new Map();
      const walk = (node, stack) => {
        const f = node.callFrame;
        const here = `${f.functionName || '(anoniem)'} ${f.url.replace(/^.*\/(src|node_modules|@fs)\//, '$1/').replace(/\?.*$/, '')}:${f.lineNumber + 1}`;
        alloc.set(here, (alloc.get(here) ?? 0) + node.selfSize);
        for (const child of node.children) walk(child, stack);
      };
      walk(heap.head, []);
      const topAlloc = [...alloc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, b]) => [k, Math.round(b / 1e5) / 10]);
      fs.writeFileSync(`${PROFILE}-r${round}.heapprofile`, JSON.stringify(heap));
      (result.profiles ??= []).push({ round, file, topSelfMs: top, topAllocMB: topAlloc });
      console.log(`profiel ronde ${round} (${file}), eigen tijd:`);
      for (const [k, ms] of top) console.log(`  ${String(ms).padStart(6)} ms  ${k}`);
      console.log('geheugen toegewezen (MB, steekproef):');
      for (const [k, mb] of topAlloc) console.log(`  ${String(mb).padStart(6)} MB  ${k}`);
    }
    await cdp.send('HeapProfiler.collectGarbage');
    const entries = await page.evaluate(() => ({ all: performance.getEntries().length, measures: performance.getEntriesByType('measure').length }));
    const end = { round, heapAfterGcMB: await heapMB(), dom: await domCounters(), entries };
    result.roundEnds.push(end);
    console.log('einde ronde', JSON.stringify(end));
    await page.evaluate(() => { document.querySelector('[data-rs-viewport]').scrollTop = 0; });
    await ready();
  }
} catch (err) {
  result.errors.push(String(err?.stack ?? err));
  console.error(err);
} finally {
  result.finished = new Date().toISOString();
  result.loadEnd = os.loadavg();
  result.summary = Object.fromEntries(Object.entries(result.actions).map(([key, list]) => {
    const ms = list.map(v => v.ms).sort((a, b) => a - b);
    return [key, {
      samples: list.map(v => v.ms), median: ms[Math.floor(ms.length / 2)], max: ms[ms.length - 1],
      feedback: list.map(v => v.steps?.find(step => step[0] === 'feedback')?.[1] ?? null),
      underGoal: list.every(v => !v.timeout && v.ms < GOAL_MS),
      centerSkeletonFrames: list.map(v => v.centerSkeletonFrames ?? null),
    }];
  }));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log('\nhandeling              mediaan  max   terugkoppeling max  onder 150 ms  skeletframes midden');
  for (const [key, s] of Object.entries(result.summary)) {
    const fb = s.feedback.filter(v => v !== null);
    console.log(`${key.padEnd(22)} ${String(s.median).padStart(6)} ${String(s.max).padStart(5)}   ${String(fb.length ? Math.max(...fb) : '-').padStart(6)}              ${s.underGoal ? 'ja ' : 'nee'}           ${s.centerSkeletonFrames.join(',')}`);
  }
  for (const end of result.roundEnds) console.log(`ronde ${end.round}: geheugen na opruimen ${end.heapAfterGcMB} MB, DOM-knopen ${end.dom.nodes}, luisteraars ${end.dom.listeners}, User Timing-regels ${end.entries.measures}`);
  console.log('\nload', result.loadStart.map(v => v.toFixed(2)).join(' '), '→', result.loadEnd.map(v => v.toFixed(2)).join(' '), '| uitvoer', OUT);
  await browser.close();
  if (result.errors.length) process.exitCode = 1;
}
