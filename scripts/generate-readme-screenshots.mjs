#!/usr/bin/env node
// Screenshots en demo voor de README, reproduceerbaar met één commando:
//
//   npm run gen:readme-screenshots                     # alle stilstaande beelden
//   npm run gen:readme-screenshots -- --only critical-path,ai-tab
//   npm run gen:readme-screenshots -- --demo           # ook demo.gif en demo.mp4 (duurt langer)
//   npm run gen:readme-screenshots -- --demo-only      # alleen de demo
//   npm run gen:readme-screenshots -- --url http://100.86.248.78:3221/ --demo
//
// Met --url gebruikt het script een apart gestarte Vite-dienst. Zonder die vlag start het Vite op
// een vrije poort uit de browsertest-baan (3107-3206, `dev-port.mjs`). Het opent de
// app in headless Chromium (licht thema, 1600x900, schaal 1, Engels) en bedient hem met echte muis- en
// toetsgebeurtenissen. `window.__OPS__` dient alleen om state klaar te zetten (instelling, scrollpositie,
// geselecteerde taak), nooit om te vervangen wat de afbeelding moet tonen.
// Uitvoer: `docs/images/readme/*.png` (palet-gequantiseerd met ffmpeg als een PNG boven de 150 kB uitkomt)
// en met --demo ook `demo.gif` en `demo.mp4`. De app verandert nog: een stap die mislukt, meldt zijn naam
// en laat de overige beelden gewoon doorlopen. Exitcode 1 als er één mislukte.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { acquireNamedGuardLock } from './dev-lock.mjs';
import { allocateNamedPort, worktreeRoot, worktreeSlug } from './dev-port.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(root, 'docs', 'images', 'readme');
const VIEWPORT = { width: 1600, height: 900 };
const MAX_PNG_BYTES = 150 * 1024;
const SHOWCASE = /Vaart/; // De Vaart Apartment Complex: groot, met voortgang, kritiek pad en resources
const SMALL = /Refurbishment/i; // klein voorbeeld voor de demo

const argv = process.argv.slice(2);
const flag = name => argv.includes(name);
const argValue = name => {
  const i = argv.indexOf(name);
  if (i >= 0) return argv[i + 1];
  const eq = argv.find(a => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
};
const only = argValue('--only')?.split(',').filter(Boolean) ?? null;
const wantDemo = flag('--demo') || flag('--demo-only');
const wantStills = !flag('--demo-only');

// ---------------------------------------------------------------- Vite

async function startVite() {
  const wtRoot = worktreeRoot() ?? root;
  const port = await allocateNamedPort(wtRoot, 'browser');
  const release = acquireNamedGuardLock(wtRoot, port, 'browser');
  const viteBin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
  const child = spawn(viteBin, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, OPS_DEV_PORT: String(port), OPS_DEV_INSTANCE: `${worktreeSlug(wtRoot)}-browser-test` },
  });
  const url = `http://127.0.0.1:${port}/`;
  const stop = () => {
    if (!child.killed) child.kill('SIGTERM');
    release();
  };
  process.once('exit', stop);
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return { url, stop };
    } catch { /* nog niet klaar */ }
    await new Promise(r => setTimeout(r, 500));
  }
  stop();
  throw new Error(`Vite startte niet op ${url}`);
}

// ---------------------------------------------------------------- app-helpers

async function newPage(browser, url, { aiMode = false, video = null } = {}) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
    ...(video ? { recordVideo: { dir: video, size: VIEWPORT } } : {}),
  });
  await context.addInitScript(aiOn => {
    localStorage.setItem('ops-theme', 'light');
    localStorage.setItem('ops-welcomeSeen', 'true');
    if (aiOn) localStorage.setItem('ops-aiMode', 'true');
  }, aiMode);
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.__OPS__ !== undefined);
  await page.waitForTimeout(1200);
  return { context, page };
}

const ops = (page, fn, arg) => page.evaluate(fn, arg);

async function openExample(page, name) {
  await page.locator('.ribbon-tab--file').first().click();
  await page.locator('button.backstage-nav-item[data-tour-anchor="backstage-examples"]').click();
  await page.locator('button.backstage-export-card').filter({ has: page.locator('h4', { hasText: name }) }).first().click();
  await page.waitForFunction(() => window.__OPS__.store.getState().tasks.length > 10);
  await page.waitForTimeout(800);
}

async function dismissNotices(page) {
  // De melding "bestand bevat urenplanning" is ruis in een screenshot; sluit hem met zijn eigen kruisje.
  const banner = page.getByText(/hour-based planning/).first();
  if (await banner.isVisible().catch(() => false)) {
    await banner.locator('xpath=ancestor::*[.//button][1]').locator('button').last().click();
    await page.waitForTimeout(300);
  }
}

const calculate = async page => {
  await page.keyboard.press('F5');
  await page.waitForTimeout(1200);
};

// Lintbladen via hun vaste `data-ops-ribbon-tab`-sleutel (de zichtbare tekst is vertaald en kan veranderen).
const TAB_KEYS = { Home: 'start', Planning: 'planning', Resources: 'resources', View: 'beeld', Settings: 'instellingen', Table: 'table', IFC: 'ifc', Report: 'report', AI: 'ai' };
const tab = (page, name) => page.locator(`[data-ops-ribbon-tab="${TAB_KEYS[name]}"]`).click();

const focusTask = async (page, taskName, zoom) => {
  await ops(page, ({ taskName, zoom }) => {
    const s = window.__OPS__.store.getState();
    const t = s.tasks.find(x => x.name === taskName);
    if (!t) throw new Error(`taak niet gevonden: ${taskName}`);
    s.focusOnTask(t.id, { preserveZoom: true });
  }, { taskName, zoom });
  await page.waitForTimeout(1000);
  if (zoom != null) {
    await ops(page, z => window.__OPS__.store.getState().setZoom(z), zoom);
    await page.waitForTimeout(800);
  }
};

/** Open het showcase-voorbeeld, rekent door en zet de Gantt op de kritieke Tower A-keten. */
async function showcaseReady(page, { zoom, wide = false } = {}) {
  await openExample(page, SHOWCASE);
  await calculate(page);
  await dismissNotices(page);
  if (wide) {
    // Breder takenraster (Duur past) en geen eigenschappenpaneel: meer ruimte voor de tijdlijn.
    await ops(page, () => window.__OPS__.store.getState().setUI({ leftPanelWidth: 400, showPropertiesPanel: false }));
    await page.waitForTimeout(500);
  }
  await focusTask(page, 'Slab, floor 1 — Tower A', zoom);
  if (zoom != null) await focusTask(page, 'Slab, floor 1 — Tower A'); // opnieuw centreren op de gekozen schaal
}

// ---------------------------------------------------------------- de beelden

const SHOTS = {
  async 'critical-path'(page) {
    await showcaseReady(page);
    await tab(page, 'View');
    // Float-band aan (echte klik op de ribbonknop) zodat de speling van niet-kritieke taken zichtbaar is.
    const floatOn = await ops(page, () => window.__OPS__.store.getState().ui.showFloatBand);
    if (!floatOn) await page.getByRole('button', { name: /^Float band/ }).first().click();
    await ops(page, () => window.__OPS__.store.getState().setUI({ leftPanelWidth: 400, showPropertiesPanel: false }));
    await focusTask(page, 'Slab, floor 1 — Tower A', 12);
    await focusTask(page, 'Slab, floor 1 — Tower A');
  },

  async 'table-editing'(page) {
    await openExample(page, SHOWCASE);
    await calculate(page);
    await dismissNotices(page);
    await tab(page, 'Table');
    const grid = page.locator('[data-task-grid-surface-id="full-task-grid"]');
    await grid.locator('[role="grid"]').waitFor();
    await ops(page, () => {
      const s = window.__OPS__.store.getState();
      const t = s.tasks.find(x => x.name === 'Slab, floor 1 — Tower A');
      s.focusOnTask(t.id, { preserveZoom: true });
    });
    await page.waitForTimeout(800);
    await grid.hover();
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(800);
    const row = grid.locator('[data-grid-data-row="true"]').filter({ hasText: 'Slab, floor 1 — Tower A' }).first();
    const cell = row.locator('[data-grid-data-cell="true"][data-grid-column-id="task.time.scheduleDuration"]').first();
    await cell.click();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('4');
  },

  async 'resources-histogram'(page) {
    await openExample(page, SHOWCASE);
    await calculate(page);
    await dismissNotices(page);
    await ops(page, () => window.__OPS__.store.getState().setUI({ showPropertiesPanel: false }));
    await tab(page, 'Resources');
    await page.getByRole('button', { name: /^Histogram$/ }).first().click();
    await page.waitForTimeout(800);
    // Eén resource met zichtbare overbezetting: de torenkraan, via de knop Next van de histogramgroep.
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /^Next$/ }).first().click();
    await page.waitForTimeout(800);
  },

  async 'calendar-dialog'(page) {
    await openExample(page, SHOWCASE);
    await dismissNotices(page);
    await tab(page, 'Settings');
    await page.getByRole('button', { name: /^Calendar/ }).first().click();
    await page.waitForTimeout(1000);
  },

  async 'report-preview'(page) {
    await openExample(page, SHOWCASE);
    await calculate(page);
    await dismissNotices(page);
    await tab(page, 'Report');
    await page.waitForTimeout(2500);
  },

  async 'ai-tab'(page) {
    await openExample(page, SMALL);
    await dismissNotices(page);
    await tab(page, 'AI');
    await page.waitForTimeout(800);
  },

  // Bestandsformaten: de exportkaarten van de Backstage (IFC, MS Project XML, P6 XML, CSV, voortgangsbladen).
  async formats(page) {
    await openExample(page, SHOWCASE);
    await dismissNotices(page);
    await page.locator('.ribbon-tab--file').first().click();
    await page.locator('button.backstage-nav-item').filter({ hasText: /^Export$/ }).click();
    await page.waitForTimeout(800);
  },

  async 'help-viewer'(page) {
    await openExample(page, SHOWCASE);
    await dismissNotices(page);
    await ops(page, () => window.__OPS__.store.getState().openHelpArticle('uitleg-kritiek-pad'));
    await page.waitForTimeout(1500);
  },
};

const NEEDS_AI = new Set(['ai-tab']);

// ---------------------------------------------------------------- PNG-optimalisatie

function optimizePng(path) {
  if (statSync(path).size <= MAX_PNG_BYTES) return;
  const tmp = `${path}.q.png`;
  const run = spawnSync('ffmpeg', [
    '-v', 'error', '-y', '-threads', '1', '-filter_complex_threads', '1', '-i', path,
    '-vf', 'split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=none',
    tmp,
  ]);
  if (run.status === 0 && statSync(tmp).size < statSync(path).size) renameSync(tmp, path);
  else rmSync(tmp, { force: true });
}

// ---------------------------------------------------------------- demo

async function recordDemo(browser, url) {
  const dir = mkdtempSync(join(tmpdir(), 'ops-readme-demo-'));
  const recordingStarted = Date.now();
  const { context, page } = await newPage(browser, url, { video: dir });
  let trim;
  try {
    trim = await demoScript(page, recordingStarted);
  } finally {
    await context.close(); // sluit de video af
  }
  const webm = readdirSync(dir).find(f => f.endsWith('.webm'));
  if (!webm) throw new Error('geen video opgenomen');
  mkdirSync(OUT, { recursive: true });
  const src = join(dir, webm);
  const gif = join(OUT, 'demo.gif');
  const mp4 = join(OUT, 'demo.mp4');
  const palette = join(dir, 'palette.png');
  const run = args => {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-threads', '1', '-filter_complex_threads', '1', ...args], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`ffmpeg faalde: ${args.join(' ')}`);
  };
  // Start in het geladen project; de laadtijd hangt van de machine af.
  const TRIM = String(trim);
  const fps = 8;
  const scale = `fps=${fps},scale=960:-1:flags=lanczos`;
  run(['-ss', TRIM, '-i', src, '-vf', `${scale},palettegen=max_colors=80:stats_mode=diff`, palette]);
  run(['-ss', TRIM, '-i', src, '-i', palette, '-lavfi', `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, gif]);
  run(['-ss', TRIM, '-i', src, '-vf', 'fps=25,scale=1280:-2:flags=lanczos', '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', mp4]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`demo.gif ${(statSync(gif).size / 1048576).toFixed(1)} MB, demo.mp4 ${(statSync(mp4).size / 1048576).toFixed(1)} MB`);
}

/** Het demoverloop: voorbeeld openen, een relatie leggen, herberekenen, het kritieke pad lezen. */
async function demoScript(page, recordingStarted) {
  const pause = ms => page.waitForTimeout(ms);
  await pause(1500);
  await openExample(page, SMALL);
  await dismissNotices(page);
  await calculate(page);
  const trim = (Date.now() - recordingStarted) / 1000;
  await pause(2000);
  await demoLinkAndRecalc(page, pause);
  return trim;
}

async function demoLinkAndRecalc(page, pause) {
  const row = name => page.getByText(name, { exact: true }).first();
  // 1. Twee taken kiezen en een relatie leggen via Link, Link selected tasks.
  await row('Set up site').click();
  await pause(900);
  await page.keyboard.down('Control');
  await row('Pour ground floor slab').click();
  await page.keyboard.up('Control');
  await pause(1200);
  await page.getByRole('button', { name: /^Link/ }).first().click();
  await pause(900);
  await page.getByText('Link selected tasks', { exact: true }).click();
  await pause(2000);
  // 2. De eerste taak langer maken: dan loopt zijn nieuwe relatie het kritieke pad in.
  await row('Set up site').click();
  await pause(900);
  const duration = page.getByText('Duration', { exact: true }).last().locator('xpath=following::input[1]');
  await duration.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('20');
  await page.keyboard.press('Enter');
  await pause(1500);
  // 3. Herberekenen: het kritieke pad (rood) en de einddatum in de statusbalk veranderen.
  await page.getByRole('button', { name: /^Calculate/ }).first().click();
  await pause(4000);
}

// ---------------------------------------------------------------- main

mkdirSync(OUT, { recursive: true });
const failures = [];
const externalUrl = argValue('--url');
const vite = externalUrl ? { url: externalUrl, stop() {} } : await startVite();
const browser = await chromium.launch({ headless: true });
try {
  if (wantStills) {
    const names = only ?? Object.keys(SHOTS);
    for (const name of names) {
      if (!SHOTS[name]) { failures.push(`${name}: onbekend beeld`); continue; }
      const { context, page } = await newPage(browser, vite.url, { aiMode: NEEDS_AI.has(name) });
      try {
        await SHOTS[name](page);
        const path = join(OUT, `${name}.png`);
        await page.screenshot({ path });
        optimizePng(path);
        console.log(`ok  ${name}.png (${(statSync(path).size / 1024).toFixed(0)} kB)`);
      } catch (e) {
        await page.screenshot({ path: join(tmpdir(), `readme-fail-${name}.png`) }).catch(() => {});
        failures.push(`${name}: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
        console.error(`XX  ${name}: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
      } finally {
        await context.close();
      }
    }
  }
  if (wantDemo) {
    try { await recordDemo(browser, vite.url); }
    catch (e) { failures.push(`demo: ${e instanceof Error ? e.message : e}`); console.error(`XX  demo: ${e}`); }
  }
} finally {
  await browser.close();
  vite.stop();
}
if (failures.length) {
  console.error(`\n${failures.length} mislukt:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nklaar → ${OUT}`);
