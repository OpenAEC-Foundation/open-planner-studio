#!/usr/bin/env node
// Alleen opt-in CI. Eén ongewijzigd harnas bedient beide exacte checkouts, achtereenvolgens op
// dezelfde runner. Dev-modus met React StrictMode; geen productie- of algemene snelheidsclaim.
// Tijdmeting zonder profiler; de deterministische aanroeptelling volgt in een aparte browsercontext.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

assert.equal(process.env.CI, 'true', 'Dit harnas draait uitsluitend in CI.');
const [baseRoot, headRoot, outputDir] = process.argv.slice(2).map(p => resolve(p));
assert.ok(baseRoot && headRoot && outputDir, 'Gebruik: <basischeckout> <headcheckout> <uitvoer>');
const BASE = 'fbd4a3f9dcc7bdd308ab86b992d0b26f4670a553';
const WARMUPS = 2;
const SAMPLES = 7;
mkdirSync(outputDir, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const trackedFiles = [
  'src/components/layout/DocumentChrome/useDocumentCards.ts',
  'src/components/layout/DocumentChrome/ProjectOverview.tsx',
  'src/utils/documents.ts', 'package-lock.json', 'vite.config.ts', 'src/main.tsx',
];
const report = {
  mode: 'Vite-ontwikkelmodus, React StrictMode, Chromium zonder venster, nl-NL, UTC, 1600x1000',
  timing: 'Echte Enter-keydown tot twee requestAnimationFrame-callbacks na zichtbare commit; openen vanaf echte click. Dit is een paintgelegenheid, geen GPU-presentatietijd.',
  warmups: WARMUPS, samples: SAMPLES, order: ['base', 'head'],
  runner: { node: process.version, cpu: cpus()[0]?.model, cores: cpus().length, memory: totalmem() },
  harnessSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  run: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  variants: [], comparisons: [], errors: [],
};
const save = () => writeFileSync(join(outputDir, 'result.json'), JSON.stringify(report, null, 2));
save();

// Canonieke serialisatie in de pagina bewaart ALLE documentvelden, ook undefined, Map en Set.
// Geen wegfilteren van output. HTML bevat alle kaarttekst, attributen, kleuren, dirty/active en balken.
async function snapshot(page) {
  return page.evaluate(async () => {
    const { capturePayload } = await import('/src/state/documentContract.ts');
    const s = window.__OPS__.store.getState();
    const encode = value => {
      if (value === undefined) return { $undefined: true };
      if (value instanceof Map) return { $map: [...value].map(([k, v]) => [encode(k), encode(v)]) };
      if (value instanceof Set) return { $set: [...value].map(encode) };
      if (value instanceof Date) return { $date: value.toISOString() };
      if (Array.isArray(value)) return value.map(encode);
      if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, encode(value[k])]));
      if (typeof value === 'number' && !Number.isFinite(value)) return { $number: String(value) };
      if (typeof value === 'function') throw new Error('Onverwachte functie in documentdata');
      return value;
    };
    const rect = el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      domain: encode({
        activeDocumentId: s.activeDocumentId,
        documents: s.documents.map(entry => ({ ...entry, payload: entry.id === s.activeDocumentId ? capturePayload(s) : entry.payload })),
        // De volledige DOCUMENT_FIELDS zijn hierboven opgenomen. Historie bevat opnieuw alle
        // snapshots; registreer hier alleen de aantallen en volgorde, niet die dubbele data.
        // Undo/redo wordt daarnaast via echte toetsen en volledige domeinsnapshots vergeleken.
        history: s.historyEvents.map(({ id, sequence, state, label }) => ({ id, sequence, state, label })),
        nextHistorySequence: s.nextHistorySequence,
      }),
      cards: [...document.querySelectorAll('[data-ops-overview-card]')].map(card => ({
        id: card.dataset.opsOverviewCard, text: card.textContent, html: card.outerHTML, rect: rect(card),
        bars: [...card.querySelectorAll('div')].filter(el => el.style.position === 'absolute' && el.style.height === '6px')
          .map(el => ({ style: el.getAttribute('style'), rect: rect(el), color: getComputedStyle(el).backgroundColor })),
      })),
      focusedId: document.activeElement?.id,
    };
  });
}
function recordSnapshot(variant, scenario, phase, data) {
  const json = JSON.stringify(data);
  const file = `${variant}-${scenario.key}-${phase}.json.gz`;
  writeFileSync(join(outputDir, file), gzipSync(json));
  scenario.snapshots.push({ phase, file, sha256: hash(json), domainSha256: hash(JSON.stringify(data.domain)), cardsSha256: hash(JSON.stringify(data.cards)) });
}

async function fixture(page, size, documents) {
  await page.evaluate(async ({ size, documents }) => {
    const { freshPayload, hydratePayload } = await import('/src/state/documentContract.ts');
    const { buildNewTask, createDefaultTaskTime } = await import('/src/utils/taskDefaults.ts');
    const payloads = Array.from({ length: documents }, (_, d) => {
      const p = freshPayload();
      p.project = { ...p.project, id: `project-${d}`, name: d < 2 ? '' : 'Project C',
        startDate: '2026-09-07', endDate: '2026-12-31' };
      p.calendar.holidays = [];
      p.calendars = [p.calendar];
      p.view.viewStartDate = '2026-09-07';
      p.filePath = d === 2 ? 'project-c.ifc' : null;
      p.isDirty = d === 1;
      p.tasks = Array.from({ length: size }, (_, i) => {
        const date = new Date(Date.UTC(2026, 8, 7 + (i === 0 ? 0 : 1 + i % 20) + d));
        const time = createDefaultTaskTime(date.toISOString().slice(0, 10), i === 7 ? 0 : 5 + i % 6);
        time.isCritical = i % 7 === 2;
        // Opzettelijk identieke taak-ID's tussen documenten, met andere datums en kleuren.
        return buildNewTask({ name: `Document ${d} taak ${i}`, manuallyScheduled: true, isMilestone: i === 7 }, {
          id: `task-${i}`, parentId: null, parentTask: undefined, constructionMode: false, time,
        });
      });
      return p;
    });
    window.__OPS__.store.setState(s => {
      hydratePayload(s, payloads[0]);
      s.documents = payloads.map((p, d) => ({ id: `document-${d}`, payload: d === 0 ? null : p }));
      s.activeDocumentId = 'document-0';
      s.historyEvents = [];
      s.nextHistorySequence = 1;
      s.ui.showWelcomeDialog = false;
      s.ui.showTourOverlay = false;
      s.ui.showProjectOverview = false;
      s.ui.activeRibbonTab = 'table';
      s.ui.autoCalcCPM = false;
      s.ui.documentChromeStyle = 'tabs';
      s.ui.rightPanelCollapsed = true;
      s.ui.showMiniMap = false;
    });
    window.__OPS__.store.getState().recomputeViewRows();
  }, { size, documents });
  await expect(page.locator('[data-task-grid-surface-id="full-task-grid"]')).toBeVisible();
  await expect(page.locator('[data-ops-tab]')).toHaveCount(documents);
  await settle(page);
}

const cell = (page, column) => page.locator(`[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="task-0"] [data-grid-column-id="${column}"]`);
const overview = page => page.locator('[data-ops-overview]');
async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function open(page) {
  await page.locator('.ops-tabstrip-menu').click();
  await expect(overview(page)).toBeVisible();
  await settle(page);
  await expect(page.locator('[data-ops-overview-card="document-0"] .ops-card-close')).toBeFocused();
}
async function close(page) {
  await page.keyboard.press('Escape');
  await expect(overview(page)).toHaveCount(0);
  await settle(page);
}
async function edit(page, column, value, measure = false) {
  await expect(overview(page)).toHaveCount(0);
  const target = cell(page, column);
  await target.click();
  await expect(target).toBeFocused();
  await page.keyboard.press('Enter');
  const input = target.locator('input').first();
  await expect(input).toBeFocused();
  await input.fill(value);
  if (measure) await page.evaluate(name => { window.__documentMeasure.arm = { kind: 'edit', name }; window.__documentMeasure.result = null; }, value);
  await page.keyboard.press('Enter');
  await expect(input).toHaveCount(0);
  if (measure) {
    await page.waitForFunction(() => window.__documentMeasure.result !== null);
    return page.evaluate(() => window.__documentMeasure.result);
  }
  await settle(page);
}

async function prepare(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'nl-NL', timezoneId: 'UTC' });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // Datum vast, timers en performance.now lopen gewoon. Alleen fixture-identiteit is deterministisch.
  await page.clock.setFixedTime(new Date('2026-09-07T12:00:00Z'));
  await page.addInitScript(() => {
    let seed = 71;
    Math.random = () => { seed = Math.imul(1664525, seed) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
    localStorage.setItem('ops-language', 'nl');
    const m = window.__documentMeasure = { arm: null, result: null };
    const start = event => {
      const arm = m.arm;
      if (!arm) return;
      if (arm.kind === 'edit' && !(event.type === 'keydown' && event.key === 'Enter' && event.target instanceof HTMLInputElement)) return;
      if (arm.kind === 'open' && !(event.type === 'click' && event.target.closest('.ops-tabstrip-menu'))) return;
      m.arm = null;
      const begin = performance.now();
      const tick = () => {
        const ready = arm.kind === 'edit'
          ? window.__OPS__.store.getState().tasks[0].name === arm.name && !document.querySelector('[data-grid-row-key="task-0"] input')
          : !!document.querySelector('[data-ops-overview-card]');
        if (!ready) { requestAnimationFrame(tick); return; }
        requestAnimationFrame(() => { m.result = { start: begin, end: performance.now(), ms: performance.now() - begin }; });
      };
      requestAnimationFrame(tick);
    };
    window.addEventListener('keydown', start, true);
    window.addEventListener('click', start, true);
  });
  await page.goto(url);
  await page.waitForFunction(() => !!window.__OPS__);
  await page.locator('[data-ops-welcome-dialog]').waitFor({ state: 'attached' });
  await page.evaluate(() => {
    const s = window.__OPS__.store.getState();
    s.newProject();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false });
  });
  await page.evaluate(() => document.fonts.ready);
  return { page, context, errors };
}

async function runTiming(browser, url, label, scenario) {
  const { page, context, errors } = await prepare(browser, url);
  try {
    await fixture(page, scenario.size, scenario.documents);
    await open(page);
    recordSnapshot(label, scenario, 'input', await snapshot(page));
    await close(page);
    for (let sample = 0; sample < WARMUPS + SAMPLES; sample++) {
      const editTime = await edit(page, 'task.name', `Gewijzigde taak ${sample}`, true);
      await page.evaluate(() => { window.__documentMeasure.arm = { kind: 'open' }; window.__documentMeasure.result = null; });
      await open(page);
      await page.waitForFunction(() => window.__documentMeasure.result !== null);
      const openTime = await page.evaluate(() => window.__documentMeasure.result);
      scenario.timings.push({ sample, warmup: sample < WARMUPS, edit: editTime, open: openTime });
      recordSnapshot(label, scenario, `sample-${sample}`, await snapshot(page));
      await close(page);
    }
    // Gedragsbewijs naast de tijdmeting: geometrie verandert na echte datumedit en herstelt na undo.
    await open(page);
    const before = await snapshot(page);
    await close(page);
    await edit(page, 'task.time.finish', '31-12-2026');
    await expect.poll(() => page.evaluate(() => window.__OPS__.store.getState().tasks[0].time.scheduleFinish)).toBe('2026-12-31');
    await open(page);
    const after = await snapshot(page);
    assert.notDeepEqual(after.cards[0].bars, before.cards[0].bars, 'Datumedit moet mini-Gantt wijzigen');
    recordSnapshot(label, scenario, 'date-edit', after);
    await page.screenshot({ path: join(outputDir, `${label}-${scenario.key}-overview.png`) });
    await close(page);
    await page.keyboard.press('Control+z');
    await open(page);
    const undone = await snapshot(page);
    assert.deepEqual(undone.cards, before.cards, 'Undo moet volledige kaarten herstellen');
    recordSnapshot(label, scenario, 'undo', undone);
    await close(page);
    await page.keyboard.press('Control+y');
    await open(page);
    const redone = await snapshot(page);
    assert.deepEqual(redone.cards, after.cards, 'Redo moet volledige kaarten herstellen');
    recordSnapshot(label, scenario, 'redo', redone);
    if (scenario.documents > 1) {
      await page.locator('[data-ops-overview-card="document-1"]').click();
      await expect(overview(page)).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => window.__OPS__.store.getState().activeDocumentId)).toBe('document-1');
      await page.locator('.ops-tabstrip-menu').click();
      await settle(page);
      const switched = await snapshot(page);
      assert.deepEqual(switched.cards.map(c => c.bars), after.cards.map(c => c.bars));
      recordSnapshot(label, scenario, 'switch', switched);
      await expect(page.locator('[data-ops-overview-card="document-1"] .ops-card-close')).toBeFocused();
      await page.locator('[data-ops-overview-card="document-0"]').click();
      await open(page);
      const returned = await snapshot(page);
      assert.deepEqual(returned.cards, after.cards);
      recordSnapshot(label, scenario, 'return', returned);
    }
    assert.deepEqual(errors, [], 'Browserfouten');
  } catch (error) {
    await page.screenshot({ path: join(outputDir, `${label}-${scenario.key}-failure.png`) }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}

async function runCounts(browser, url, label, scenario) {
  const { page, context, errors } = await prepare(browser, url);
  try {
    await fixture(page, scenario.size, scenario.documents);
    // Warm de thumbnailfunctie eenmaal op zodat de profiler ook een nul aan dezelfde functie bindt.
    await open(page);
    await close(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    const take = async phase => {
      const coverage = await cdp.send('Profiler.takePreciseCoverage');
      const matches = coverage.result.filter(s => /\/src\/utils\/documents\.ts(?:\?|$)/.test(s.url))
        .flatMap(s => s.functions.filter(f => f.functionName === 'buildThumbnail').map(f => ({ url: s.url, ...f })));
      // V8 mag onuitgevoerde functies uit de delta weglaten; bron en warme open zijn hierboven bewezen.
      const count = matches.reduce((n, f) => n + f.ranges[0].count, 0);
      scenario.counts.push({ phase, count, functions: matches });
      return count;
    };
    await take('start');
    await edit(page, 'task.name', 'Aanroeptelling');
    const closed = await take('closed-edit');
    if (label === 'head') assert.equal(closed, 0, 'Gesloten overzicht mag geen thumbnails berekenen');
    else assert.ok(closed >= 2 * scenario.documents, 'Basis moet het bestaande dubbele thumbnailwerk tonen');
    await open(page);
    const opened = await take('open');
    if (label === 'head') {
      // StrictMode herhaalt de useMemo-berekening tweemaal; alleen het overzicht mag dit doen.
      assert.equal(opened, 2 * scenario.documents, 'Geopend overzicht: één berekening per kaart, tweemaal door StrictMode');
    }
    await close(page);
    await page.keyboard.press('Control+z');
    await settle(page);
    await page.keyboard.press('Control+y');
    await settle(page);
    if (scenario.documents > 1) {
      await page.locator('[data-ops-tab="document-1"]').click();
      await settle(page);
      await page.locator('[data-ops-tab="document-0"]').click();
      await settle(page);
    }
    const closedRoute = await take('closed-undo-redo-switch');
    if (label === 'head') assert.equal(closedRoute, 0);
    else assert.ok(closedRoute > 0);
    await cdp.send('Profiler.stopPreciseCoverage');
    await cdp.detach();
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}

let browser;
try {
  assert.equal(git(baseRoot, 'rev-parse', 'HEAD'), BASE);
  assert.equal(git(headRoot, 'rev-parse', 'HEAD'), process.env.EXPECTED_HEAD);
  assert.equal(hash(readFileSync(join(baseRoot, 'package-lock.json'))), hash(readFileSync(join(headRoot, 'package-lock.json'))));
  browser = await chromium.launch();
  report.runner.chromium = browser.version();
  for (const [label, root] of [['base', baseRoot], ['head', headRoot]]) {
    const variant = { label, commit: git(root, 'rev-parse', 'HEAD'),
      trackedDiff: git(root, 'diff', 'HEAD', '--'),
      sources: Object.fromEntries(trackedFiles.map(file => [file, hash(readFileSync(join(root, file)))])), scenarios: [] };
    report.variants.push(variant);
    let server;
    try {
      assert.equal(variant.trackedDiff, '');
      server = await createServer({ root, configFile: join(root, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: true, open: false }, clearScreen: false });
      await server.listen();
      const address = server.httpServer.address();
      assert.ok(address && typeof address !== 'string');
      const url = `http://127.0.0.1:${address.port}`;
      for (const size of [1000, 5000, 10000]) for (const documents of [1, 3]) {
        const scenario = { key: `${size}x${documents}`, size, documents, timings: [], snapshots: [], counts: [] };
        variant.scenarios.push(scenario);
        try {
          await runTiming(browser, url, label, scenario);
          await runCounts(browser, url, label, scenario);
        } catch (error) {
          scenario.error = String(error.stack || error);
          report.errors.push(`${label}/${scenario.key}: ${scenario.error}`);
        }
        save();
      }
      assert.equal(git(root, 'diff', 'HEAD', '--'), '');
    } catch (error) { report.errors.push(`${label}: ${error.stack || error}`); }
    finally { if (server) await server.close(); save(); }
  }
  const [base, head] = report.variants;
  for (const before of base.scenarios) {
    const after = head.scenarios.find(s => s.key === before.key);
    assert.ok(after, `Headscenario ontbreekt: ${before.key}`);
    assert.ok(!before.error && !after.error, `Scenario mislukt: ${before.key}`);
    assert.equal(before.snapshots.length, after.snapshots.length);
    for (let i = 0; i < before.snapshots.length; i++) {
      assert.equal(before.snapshots[i].phase, after.snapshots[i].phase);
      assert.equal(before.snapshots[i].sha256, after.snapshots[i].sha256, `Volledige input/output verschilt: ${before.key}/${before.snapshots[i].phase}`);
    }
    const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
    const summarize = s => Object.fromEntries(['edit', 'open'].map(phase => {
      const samples = s.timings.filter(t => !t.warmup).map(t => t[phase].ms);
      assert.equal(samples.length, SAMPLES);
      return [phase, { medianMs: median(samples), minMs: Math.min(...samples), maxMs: Math.max(...samples) }];
    }));
    report.comparisons.push({ key: before.key, identicalSnapshots: before.snapshots.length, base: summarize(before), head: summarize(after) });
  }
} catch (error) { report.errors.push(String(error.stack || error)); }
finally {
  if (browser) await browser.close();
  report.exitCode = report.errors.length ? 1 : 0;
  save();
  console.log(JSON.stringify({ exitCode: report.exitCode, comparisons: report.comparisons, errors: report.errors }, null, 2));
  process.exitCode = report.exitCode;
}
