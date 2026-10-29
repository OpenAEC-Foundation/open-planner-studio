// Alleen opt-in CI. Geen productinstrumentatie: de bestaande brug zet fixtures en leest state.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cpus, totalmem } from 'node:os';
import { build as bundle } from 'esbuild';
import { build, preview } from 'vite';
import ts from 'typescript';
import { chromium, expect } from '@playwright/test';
import { fixture, queries } from './fixture.mjs';

assert.equal(process.env.CI, 'true', 'Deze meting draait uitsluitend in CI');
const [beforeRoot, afterRoot, out] = process.argv.slice(2).map(value => resolve(value));
assert.ok(beforeRoot && afterRoot && out, 'verwacht voor-map, na-map en uitvoermap');
mkdirSync(out, { recursive: true });
const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const sides = [
  { name: 'voor', root: beforeRoot, expected: process.env.BASE_REVISION },
  { name: 'na', root: afterRoot, expected: process.env.HEAD_REVISION },
];
const report = {
  status: 'bezig', node: process.version, cpu: cpus()[0]?.model, memory: totalmem(),
  mode: 'Vite production, React productie, minify=false, VITE_OPS_BENCH_BRIDGE=1; geen dev-server',
  timing: 'Helper: één aanroep. Browser: eerste echte input/keydown tot twee rAFs na de verwachte DOM-lijst; één fill-input of Ctrl+A/Backspace. CDP uit tijdens tijden.',
  warmups: { helper: 2, browser: 1 }, repeats: { helper: 9, browser: 5 },
  executionCheck: 'Tellerdelta, uitsluitend nul/positief als poort; twee positieve zoekacties bewaken herhaalde observatie.',
  harnessHashes: Object.fromEntries(['measure.mjs', 'fixture.mjs'].map(name => [name, hash(readFileSync(new URL(name, import.meta.url)))])),
  sides: [], fixtures: [], helper: [], browser: [], coverage: [], errors: [],
};
const save = () => writeFileSync(join(out, 'resultaten.json'), JSON.stringify(report, null, 2));
const order = round => round % 2 ? [...sides].reverse() : sides;
let browser;
const servers = [];
function freeze(value) {
  for (const item of Object.values(value)) if (item && typeof item === 'object') freeze(item);
  return Object.freeze(value);
}
async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
const options = page => page.locator('[data-ops-dependency-option]');
const search = page => page.locator('[data-ops-dependency-search]');

async function domain(page) {
  return page.evaluate(() => {
    const s = window.__OPS__.store.getState();
    return { tasks: s.tasks, sequences: s.sequences, assignments: s.assignments,
      dirty: s.isDirty, stale: s.scheduleStale,
      undo: s.historyEvents.filter(event => event.state === 'applied').length };
  });
}
async function seed(side, tasks) {
  const page = side.page;
  if (await page.locator('[data-ops-dependency-draft]').count()) await search(page).press('Escape');
  await page.evaluate(tasks => {
    const store = window.__OPS__.store;
    const s = store.getState();
    s.newProject();
    s.setProject({ name: 'Zoekmeting', startDate: '2026-09-07' });
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false, showPropertiesPanel: true,
      rightPanelCollapsed: false, autoCalcCPM: false });
    store.setState({ tasks, sequences: [], assignments: [], cpmResult: null });
    store.getState().recomputeViewRows();
    s.setViewStartDate('2026-09-07');
  }, tasks);
  await page.locator('[data-grid-data-row="true"][data-grid-row-key="zoek-0"] [data-grid-column-id="task.name"]').first().click();
  await page.locator('[data-ops-dependency-add]').click();
  await expect(options(page)).toHaveCount(8);
  await settle(page);
  assert.deepEqual((await domain(page)).tasks, tasks);
}

// Alleen passief observeren: input/keydown en de echte DOM. Geen React- of helperwrapper.
async function timedAction(page, expectedLabels, highlight, action) {
  await page.evaluate(({ labels, highlight }) => {
    window.__relationTiming = { start: null, end: null, longTasks: [] };
    const record = window.__relationTiming;
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) record.longTasks.push({ start: entry.startTime, duration: entry.duration });
    });
    observer.observe({ type: 'longtask' });
    const start = event => {
      if (record.start !== null) return;
      if (!event.target.matches('[data-ops-dependency-search]')) return;
      record.start = performance.now();
      const check = () => {
        const nodes = [...document.querySelectorAll('[data-ops-dependency-option]')];
        const matching = JSON.stringify(nodes.map(node => node.textContent)) === JSON.stringify(labels)
          && (highlight === null || nodes[highlight]?.getAttribute('data-ops-dependency-highlighted') === 'true');
        if (!matching) { requestAnimationFrame(check); return; }
        requestAnimationFrame(() => requestAnimationFrame(() => {
          record.end = performance.now();
          for (const entry of observer.takeRecords()) record.longTasks.push({ start: entry.startTime, duration: entry.duration });
          observer.disconnect();
          document.removeEventListener('input', start, true);
          document.removeEventListener('keydown', start, true);
        }));
      };
      requestAnimationFrame(check);
    };
    document.addEventListener('input', start, true);
    document.addEventListener('keydown', start, true);
  }, { labels: expectedLabels, highlight });
  await action();
  await page.waitForFunction(() => window.__relationTiming.end !== null);
  const result = await page.evaluate(() => window.__relationTiming);
  await expect(options(page)).toHaveText(expectedLabels);
  return { milliseconds: result.end - result.start, longTasks: result.longTasks.filter(task => task.start >= result.start && task.start < result.end) };
}

async function memoProof(side, tasks) {
  const page = side.page;
  await seed(side, tasks);
  const original = await domain(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Debugger.enable');
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
  let helper;
  const steps = [];
  async function probe(name, action, expected) {
    await cdp.send('Profiler.takePreciseCoverage');
    await action();
    await settle(page);
    const { result } = await cdp.send('Profiler.takePreciseCoverage');
    writeFileSync(join(out, `coverage-${side.name}-${tasks.length}-${steps.length}.json`), JSON.stringify(result));
    if (!helper) {
      const candidates = [];
      // CDP kan een lege of herschreven functienaam leveren. Zoek de echte declaratie in de
      // geleverde JavaScript en koppel uitsluitend het omsloten functiebereik, nooit de module.
      for (const script of result) {
        if (!script.url.startsWith(side.url + '/assets/')) continue;
        const { scriptSource } = await cdp.send('Debugger.getScriptSource', { scriptId: script.scriptId });
        if (!scriptSource.includes('relationTaskOptions')) continue;
        const source = ts.createSourceFile(script.url, scriptSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        const declarations = [];
        const visit = node => {
          if (ts.isFunctionDeclaration(node) && node.name?.text.includes('relationTaskOptions')) declarations.push(node);
          ts.forEachChild(node, visit);
        };
        visit(source);
        for (const declaration of declarations) {
          const start = declaration.getStart(source);
          const end = declaration.end;
          const marker = declaration.body.getStart(source) + 1;
          for (const fn of script.functions) {
            const range = fn.ranges[0];
            if (range.startOffset >= start && range.startOffset <= marker && range.endOffset === end) {
              candidates.push({ scriptId: script.scriptId, url: script.url, functionName: fn.functionName,
                declarationName: declaration.name.text, startOffset: range.startOffset, endOffset: range.endOffset,
                sourceHash: hash(scriptSource) });
            }
          }
        }
      }
      assert.equal(candidates.length, 1, 'de echte helper moet één exact bronbereik in de browsercode hebben');
      helper = candidates[0];
    }
    const counts = result.filter(script => script.scriptId === helper.scriptId).flatMap(script =>
      script.functions.flatMap(fn => fn.ranges.filter(range =>
        range.startOffset === helper.startOffset && range.endOffset === helper.endOffset).map(range => range.count)));
    assert.ok(counts.every(count => Number.isSafeInteger(count) && count >= 0));
    const count = counts.reduce((sum, value) => sum + value, 0);
    const executed = count > 0;
    steps.push({ name, count, executed, expected });
    report.coverage.push({ side: side.name, size: tasks.length, name, count, executed, expected,
      helper });
    save();
    assert.equal(executed, expected, `${side.name}: ${name}`);
  }
  try {
    // Deze echte zoekactie kalibreert de profiler vóór de geteste nul-/positiefroute.
    // De volgende zoekactie moet de helper opnieuw waarnemen na het uitlezen van deze delta.
    await probe('kalibratie zoektekst', () => search(page).fill('kalibratie-zonder-treffers'), true);
    await probe('zoektekst', () => search(page).fill('Werk'), true);
    await probe('pijl', () => search(page).press('ArrowDown'), side.name === 'voor');
    await expect(options(page).nth(1)).toHaveAttribute('data-ops-dependency-highlighted', 'true');
    // Eerst een taak kiezen, zoals in de bestaande browserroute. De trefferlijst ligt boven
    // het typeveld; pas na de keuze zijn de overige conceptvelden met de muis bereikbaar.
    const chosenLabel = await options(page).nth(1).textContent();
    await probe('taak kiezen', () => search(page).press('Enter'), true);
    await expect(options(page)).toHaveCount(0);
    await expect(search(page)).toHaveValue(chosenLabel);
    assert.deepEqual(await domain(page), original, 'een taak kiezen bevestigt nog geen relatie');
    await probe('type', async () => {
      await page.locator('[data-ops-dependency-type] .ops-select__trigger').click();
      await page.getByRole('option', { name: 'SS', exact: true }).click();
    }, side.name === 'voor');
    await probe('richting', async () => {
      await page.locator('[data-ops-dependency-direction] .ops-select__trigger').click();
      await page.getByRole('option', { name: /^(Successor|Opvolger)$/ }).click();
    }, side.name === 'voor');
    await probe('lag', async () => {
      await page.locator('.dependency-draft .dependency-lag-field').fill('2d');
      await search(page).click();
    }, side.name === 'voor');
    await probe('nieuwe zoektekst', () => search(page).fill('Late unieke taak'), true);
  } finally {
    await cdp.send('Profiler.stopPreciseCoverage');
    await cdp.detach();
  }
  assert.deepEqual(await domain(page), original, 'conceptwerk mag geen domeinmutatie veroorzaken');
  await search(page).press('Enter');
  assert.deepEqual(await domain(page), original, 'kiezen is nog geen bevestigen');
  await search(page).press('Enter');
  await expect(page.locator('[data-ops-dependency-draft]')).toHaveCount(0);
  const committed = await domain(page);
  assert.equal(committed.undo, original.undo + 1);
  assert.equal(committed.sequences.length, 1);
  assert.deepEqual({ ...committed.sequences[0], id: '<gegenereerd>' }, {
    id: '<gegenereerd>', predecessorId: 'zoek-0', successorId: `zoek-${tasks.length - 1}`,
    type: 'START_START', lagDays: 2, lagUnit: undefined, lagPercent: undefined, lagMinutes: undefined,
  });
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await domain(page)).sequences.length).toBe(0);
  const undone = await domain(page);
  assert.deepEqual(undone.tasks, original.tasks);
  assert.deepEqual(undone.assignments, original.assignments);
  assert.deepEqual(undone.sequences, original.sequences);
  assert.equal(undone.undo, original.undo);
  await page.locator('[data-ops-dependency-add]').click();
  const beforeEscape = await domain(page);
  await search(page).fill('Werk');
  await search(page).press('Escape');
  assert.deepEqual(await domain(page), beforeEscape);
  return { steps, committed: { ...committed, sequences: committed.sequences.map(s => ({ ...s, id: '<gegenereerd>' })) }, undone };
}

try {
  for (const side of sides) {
    const revision = git(side.root, 'rev-parse', 'HEAD');
    assert.equal(revision, side.expected);
    assert.equal(git(side.root, 'status', '--porcelain', '--untracked-files=no'), '');
    const sourcePaths = ['src/engine/taskGrid/relationCell.ts', 'src/components/task-sections/TaskDependenciesSection.tsx', 'package-lock.json', 'vite.config.ts'];
    report.sides.push({ name: side.name, revision,
      sourceTreeHash: hash(git(side.root, 'ls-tree', '-r', 'HEAD', 'src')),
      sources: Object.fromEntries(sourcePaths.map(path => [path, hash(readFileSync(join(side.root, path)))])),
    });
    save();
    const target = join(out, `${side.name}-helper.mjs`);
    await bundle({ entryPoints: [join(side.root, 'src/engine/taskGrid/relationCell.ts')], outfile: target,
      bundle: true, platform: 'node', format: 'esm', target: 'node22', alias: { '@': join(side.root, 'src') }, logLevel: 'warning' });
    side.helper = (await import(pathToFileURL(target).href)).relationTaskOptions;
    report.sides.at(-1).helperBundleHash = hash(readFileSync(target));
  }
  assert.equal(report.sides[0].sources['package-lock.json'], report.sides[1].sources['package-lock.json']);
  for (const size of [1000, 5000, 10000]) {
    const tasks = freeze(fixture(size));
    const inputHash = hash(tasks);
    for (const query of queries) {
      const expected = sides[0].helper(tasks, 'zoek-0', query).slice(0, 8);
      report.fixtures.push({ size, query, inputHash, expected });
      assert.deepEqual(sides[1].helper(tasks, 'zoek-0', query), sides[0].helper(tasks, 'zoek-0', query), 'onbegrensde aanroeper blijft gelijk');
      for (let round = -2; round < 9; round++) {
        for (const side of order(round)) {
          const start = performance.now();
          const result = side.name === 'voor' ? side.helper(tasks, 'zoek-0', query).slice(0, 8) : side.helper(tasks, 'zoek-0', query, 8);
          const ms = performance.now() - start;
          assert.deepEqual(result, expected);
          let visits = 0;
          const counted = { *[Symbol.iterator]() { for (const task of tasks) { visits++; yield task; } } };
          const countedResult = side.name === 'voor' ? side.helper(counted, 'zoek-0', query).slice(0, 8) : side.helper(counted, 'zoek-0', query, 8);
          assert.deepEqual(countedResult, expected);
          if (round >= 0) report.helper.push({ side: side.name, size, query, round, inputHash, outputHash: hash(result), milliseconds: ms, visits });
        }
      }
    }
    assert.deepEqual(tasks, fixture(size), 'alle fixturevelden blijven intact');
    save();
  }
  process.env.VITE_OPS_BENCH_BRIDGE = '1';
  for (const side of sides) {
    const dist = join(out, `${side.name}-dist`);
    await build({ root: side.root, configFile: join(side.root, 'vite.config.ts'), mode: 'production',
      build: { outDir: dist, emptyOutDir: true, minify: false } });
    const server = await preview({ root: side.root, configFile: join(side.root, 'vite.config.ts'),
      build: { outDir: dist }, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } });
    servers.push(server);
    side.url = `http://127.0.0.1:${server.httpServer.address().port}`;
  }
  browser = await chromium.launch();
  report.chromium = browser.version();
  for (const side of sides) {
    const context = await browser.newContext({ locale: 'en-GB', viewport: { width: 1600, height: 1000 } });
    side.page = await context.newPage();
    side.page.setDefaultTimeout(15000);
    side.page.on('pageerror', error => { report.errors.push({ side: side.name, error: error.stack }); save(); });
    side.page.on('console', message => {
      if (message.type() === 'error') { report.errors.push({ side: side.name, console: message.text() }); save(); }
    });
    await side.page.goto(side.url);
    await side.page.waitForFunction(() => !!window.__OPS__);
    await side.page.locator('[data-ops-welcome-dialog]').waitFor();
  }
  for (const size of [1000, 5000, 10000]) {
    const tasks = fixture(size);
    for (const side of sides) await seed(side, tasks);
    for (const query of queries) {
      const expected = sides[0].helper(tasks, 'zoek-0', query).slice(0, 8);
      const labels = expected.map(option => option.label);
      for (let round = -1; round < 5; round++) {
        for (const side of order(round)) {
          const page = side.page;
          await search(page).fill('voorbereiding-zonder-treffers');
          await expect(options(page)).toHaveCount(0);
          await settle(page);
          const input = await timedAction(page, labels, null, async () => {
            if (query) await search(page).fill(query);
            else { await search(page).press('Control+a'); await search(page).press('Backspace'); }
          });
          const arrow = await timedAction(page, labels, expected.length ? 1 % expected.length : null,
            () => search(page).press('ArrowDown'));
          if (round >= 0) report.browser.push({ side: side.name, size, query, round,
            inputHash: hash(tasks), outputHash: hash(await options(page).allTextContents()), helperOutputHash: hash(expected), input, arrow });
          assert.deepEqual((await domain(page)).tasks, tasks);
          save();
        }
      }
    }
    for (const side of sides) {
      await search(side.page).fill('Werk');
      await side.page.screenshot({ path: join(out, `${side.name}-${size}.png`) });
    }
    const beforeProof = await memoProof(sides[0], tasks);
    const afterProof = await memoProof(sides[1], tasks);
    // Alleen het willekeurige relatie-id is genormaliseerd; alle taakvelden blijven aanwezig.
    assert.deepEqual(afterProof.committed, beforeProof.committed);
    assert.deepEqual(afterProof.undone, beforeProof.undone);
    writeFileSync(join(out, `domein-${size}.json`), JSON.stringify({ beforeProof, afterProof }, null, 2));
  }
  assert.deepEqual(report.errors, []);
  report.status = 'geslaagd';
} catch (error) {
  report.status = 'mislukt';
  report.errors.push({ error: error.stack ?? String(error) });
  process.exitCode = 1;
} finally {
  save();
  await browser?.close();
  for (const server of servers) await new Promise(resolve => server.httpServer.close(resolve));
}
console.log(`Zoekmeting: ${report.status}; ruwe gegevens: ${join(out, 'resultaten.json')}`);
