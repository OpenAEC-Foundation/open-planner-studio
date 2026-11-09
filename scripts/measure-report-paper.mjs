// Snelheidsmeting van het nieuwe Rapport-tabblad in een grote planning (issue #817, PR #847). Niet in CI,
// niet in `verify`: een handmeting voor de bouwer en de review, zoals `measure:large-plans`.
//
// Gebruik (dev-server van deze worktree draait; adres uit de uitvoer van `npm run dev`):
//
//   node scripts/measure-report-paper.mjs --url http://localhost:<poort>/ [--out pad.json]
//
// Het plan (5000 taken, seed 0x5eed) komt uit `scripts/measure-large-plans-data.ts`; ontbreekt
// `qa/report-paper/plan-5000.ifc`, dan maakt dit script het eerst. Standaarduitvoer:
// `qa/report-paper/snelheid-<commit>.json`. Op aia09-mp50 onder `flock /tmp/ops-zwaar.lock`.
//
// Route (één keer laden, daarna in deze volgorde):
//   1. open qa/report-paper/plan-5000.ifc (5000 taken, 139 bladen A3) op 1600×900, licht, nl;
//   2. sprongen naar 70, 30, 90, 50, 10 en 70 % van het document (bladeren);
//   3. op ±70 % (blad ±100): vier zoomstappen (+, −, −, +), dan "Hele blad";
//   4. drie keer Kalenderdagen toevoegen (Enter in de kolomkiezer) en weghalen (× in de lijst);
//   5. twee keer papier A2 ↔ A3 en twee keer de schakelaar Speling.
//
// Meetmethode: alles in de browser zelf, zonder vertraging van de automatisering.
//   - Start = `event.timeStamp` van het klik- of toetsevent (een luisteraar in de capture-fase legt hem
//     vast), bij een sprong `performance.now()` vlak voor `scrollTop` gezet wordt.
//   - Eind = het tweede `requestAnimationFrame` nadat het nieuwe papier in de DOM staat: het eerste frame
//     met het nieuwe papier is dan getekend (`rAF ×2`).
//   - "Nieuw papier": bij een instelling (kolom, papier, schakelaar) een nieuwe opname op het papier
//     (`data-rs-paper` op de bladenlijst verandert) én alle bladen in beeld met hun SVG; bij zoom en sprong
//     alleen alle bladen in beeld met hun SVG (na zoom: ook de nieuwe zoomwaarde). De lus kijkt elk frame
//     (`requestAnimationFrame`); het eerste frame waarin dat klopt, toont het nieuwe papier.
//   - Per handeling ook het aantal frames waarin het blad in het midden van het beeld nog een skelet is.
//   - De rekenstappen van de app (`ops-report:record`, `record-rows`, `svg`) staan er per handeling bij.
//
// Uitvoer: een tabel op stdout en een JSON-bestand (standaard qa/817-rapport/r4/snelheid.json).
// Exitcode 0 als alles gemeten is; de oordelen (< 150 ms) staan in de JSON, niet in de exitcode.

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
// Het plan staat in `qa/` (niet in git): de dev-server opent het via `?open=` als bestand uit de worktree.
const PLAN_DIR = path.join('qa', 'report-paper');
const PLAN = `${PLAN_DIR}/plan-5000.ifc`;
if (!fs.existsSync(PLAN)) {
  execSync(`"${process.execPath}" scripts/run-ts.mjs scripts/measure-large-plans-data.ts --out ${PLAN_DIR} --sizes 5000 --repeats 1`, { stdio: 'inherit' });
}
const GOAL_MS = 150;

const result = {
  started: new Date().toISOString(),
  commit,
  url: BASE, plan: PLAN, viewport: '1600x900', loadStart: os.loadavg(), actions: {}, errors: [],
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'nl-NL' });
await ctx.addInitScript(() => {
  localStorage.setItem('ops-welcomeSeen', 'true');
  localStorage.setItem('ops-locale', 'nl');
  localStorage.removeItem('ops-reportSettings');

  // ---- In de pagina: de meter --------------------------------------------------------------------
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
  /** Het volgnummer van de opname die het papier toont (`data-rs-paper` op de bladenlijst). */
  const paperId = () => document.querySelector('[data-rs-paper]')?.getAttribute('data-rs-paper') ?? null;

  /**
   * Meet één handeling. `trigger`: 'click' | 'keydown' | 'now' (sprong). `needPaper`: wacht op een nieuwe
   * `ops-report:paper`. `zoomFrom`: wacht tot de zoomwaarde anders is.
   */
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

const ready = async () => {
  await page.waitForFunction(() => document.querySelector('[data-rs-status]')?.getAttribute('data-busy') === 'false', null, { timeout: 120000 });
  // Rust: laat bladen naast beeld en nagekomen werk eerst klaar zijn.
  await page.waitForTimeout(700);
};
const done = () => page.evaluate(() => window.__meetDone);
const record = (key, value) => { (result.actions[key] ??= []).push(value); console.log(key.padEnd(22), JSON.stringify(value)); };
const openStep = async id => {
  if (!await page.locator(`[data-rs-step-body="${id}"]`).count()) await page.locator(`[data-rs-step-head="${id}"]`).click();
  await ready();
};

try {
  const t0 = Date.now();
  await page.goto(`${BASE}?open=${PLAN}&tab=report&flag=reportRedesign&theme=light`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.__OPS__?.store.getState().tasks.length === 5000, null, { timeout: 240000 });
  await page.locator('[data-report-page-svg="0"]').waitFor({ timeout: 240000 });
  await ready();
  result.loadMs = Date.now() - t0;
  console.log('geladen in', result.loadMs, 'ms');

  // 2. Bladeren: sprongen.
  for (const ratio of [0.7, 0.3, 0.9, 0.5, 0.1, 0.7]) {
    await page.evaluate(() => window.__meet.arm({ trigger: 'now' }));
    await page.evaluate(r => {
      const vp = document.querySelector('[data-rs-viewport]');
      window.__meetBegin();
      vp.scrollTop = (vp.scrollHeight - vp.clientHeight) * r;
    }, ratio);
    record('sprong', { ratio, ...await done() });
    await ready();
  }

  // 3. Zoom op ±70 %.
  for (const mode of ['in', 'out', 'out', 'in']) {
    const before = await page.locator('[data-rs-zoom="value"]').innerText();
    await page.evaluate(zoomFrom => window.__meet.arm({ trigger: 'click', zoomFrom }), before);
    await page.locator(`[data-rs-zoom="${mode}"]`).click();
    record(`zoom-${mode}`, { from: before, ...await done() });
    await ready();
  }
  await page.locator('[data-rs-zoom="page"]').click();
  await ready();

  // 4. Kalenderdagen toevoegen en weghalen.
  await openStep('columns');
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-rs-add-column]').click();
    await page.locator('[data-rs-picker-search]').fill('Kalenderdagen');
    await page.waitForTimeout(150);
    await page.evaluate(() => window.__meet.arm({ trigger: 'keydown', needPaper: true }));
    await page.keyboard.press('Enter');
    record('kolom-erbij', await done());
    await ready();
    await page.evaluate(() => window.__meet.arm({ trigger: 'click', needPaper: true }));
    await page.locator('[data-rs-remove="task.time.calendarDays"]').click();
    record('kolom-weg', await done());
    await ready();
  }

  // 5. Papier en schakelaar.
  await openStep('page');
  for (const size of ['A2', 'A3', 'A2', 'A3']) {
    await page.evaluate(() => window.__meet.arm({ trigger: 'click', needPaper: true }));
    await page.locator(`[data-rs-segmented="paperSize"] [data-rs-value="${size}"]`).click();
    record('papier', { size, ...await done() });
    await ready();
  }
  await openStep('bars');
  // Terug naar ±70 % van het document (A3 heeft na de wissel bovenaan blad 1 gezet).
  await page.evaluate(() => { const vp = document.querySelector('[data-rs-viewport]'); vp.scrollTop = (vp.scrollHeight - vp.clientHeight) * 0.7; });
  await ready();
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__meet.arm({ trigger: 'click', needPaper: true }));
    await page.locator('[data-rs-switch="showFloat"]').click();
    record('speling', await done());
    await ready();
  }
} catch (err) {
  result.errors.push(String(err?.stack ?? err));
  console.error(err);
} finally {
  result.finished = new Date().toISOString();
  result.loadEnd = os.loadavg();
  // Samenvatting per handeling: mediaan, maximum en of elke meting onder het doel bleef.
  result.summary = Object.fromEntries(Object.entries(result.actions).map(([key, list]) => {
    const ms = list.map(v => v.ms).sort((a, b) => a - b);
    return [key, {
      samples: list.map(v => v.ms), median: ms[Math.floor(ms.length / 2)], max: ms[ms.length - 1],
      underGoal: list.every(v => !v.timeout && v.ms < GOAL_MS),
      centerSkeletonFrames: list.map(v => v.centerSkeletonFrames ?? null),
    }];
  }));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log('\nhandeling              mediaan  max   onder 150 ms  skeletframes midden');
  for (const [key, s] of Object.entries(result.summary)) {
    console.log(`${key.padEnd(22)} ${String(s.median).padStart(6)} ${String(s.max).padStart(5)}   ${s.underGoal ? 'ja ' : 'nee'}           ${s.centerSkeletonFrames.join(',')}`);
  }
  console.log('\nload', result.loadStart.map(v => v.toFixed(2)).join(' '), '→', result.loadEnd.map(v => v.toFixed(2)).join(' '), '| uitvoer', OUT);
  await browser.close();
  if (result.errors.length) process.exitCode = 1;
}
