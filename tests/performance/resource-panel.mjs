// Alleen via de aparte meetworkflow: productie-React, echte klikken, geen productinstrumentatie.
// De fixture wordt vóór de meting gezet; klikken vervangen we nooit door store-acties.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { cpus, totalmem } from 'node:os';
import { extname, resolve, sep } from 'node:path';
import { chromium, expect } from '@playwright/test';

const [beforeDist, afterDist, output] = process.argv.slice(2).map(p => resolve(p));
assert(beforeDist && afterDist && output, 'Geef vóór-build, na-build en uitvoermap op');
mkdirSync(output, { recursive: true });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const openPanelTitle = /Open the full resource panel|Volledig resourcepaneel openen/i;

async function serve(root) {
  const server = createServer((req, res) => {
    const path = resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`);
    if (!path.startsWith(root + sep) && path !== root) { res.writeHead(403).end(); return; }
    const file = path === root ? resolve(root, 'index.html') : path;
    res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    const stream = createReadStream(file);
    stream.on('error', () => res.writeHead(404).end());
    stream.pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function fixture(page, size) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__OPS__);
  await page.locator('[data-ops-welcome-dialog]').waitFor();
  await page.evaluate(size => {
    const store = window.__OPS__.store;
    store.getState().newProject();
    const templateId = store.getState().addTask({ name: 'Meettaak' });
    const template = store.getState().tasks.find(t => t.id === templateId);
    const resources = Array.from({ length: size }, (_, i) => ({
      id: `measure-resource-${i}`, name: `Resource ${String(i).padStart(4, '0')}`,
      type: 'EQUIPMENT', description: '', maxUnits: 1, color: '#2563eb',
    }));
    const tasks = Array.from({ length: 40 }, (_, i) => ({
      ...template, id: `measure-task-${i}`, name: `Meetwerk ${i}`, sortOrder: i,
      resourceIds: resources.map(r => r.id),
      time: { ...template.time, scheduleStart: '2026-06-01', scheduleFinish: '2026-06-01', scheduleDuration: 1 },
    }));
    const assignments = tasks.flatMap(t => resources.map(r => ({
      id: `${t.id}-${r.id}`, taskId: t.id, resourceId: r.id, unitsPerDay: 1,
    })));
    store.setState(s => {
      s.resources = resources;
      s.tasks = tasks;
      s.assignments = assignments;
      s.resourceLoadResult = null;
      s.cpmResult = null;
      s.historyEvents = [];
      s.nextHistorySequence = 1;
      s.isDirty = false;
      Object.assign(s.ui, {
        showWelcomeDialog: false, showTourOverlay: false, showTutorialPrompt: false,
        activeRibbonTab: 'resources', resourcesView: 'project', showResourcePanel: false,
        resourcePanelDocked: false, showPropertiesPanel: false, autoCalcCPM: false,
      });
    });
    store.getState().recomputeViewRows();
  }, size);
  await expect(page.getByTitle(openPanelTitle)).toBeVisible();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function clickMs(page, button, readySelector, present = true) {
  // Een eerdere hover kan title tijdelijk hebben weggehaald; echt vertrek herstelt de locator.
  await page.mouse.move(0, 0);
  // Begin bij de vertrouwde click, einde na zichtbare doel-DOM plus de volgende framekans.
  // Playwrights wachttijd op een bedienbare knop zit daarmee buiten het gemeten interval.
  await page.evaluate(({ selector, present }) => {
    window.__resourceMeasure = new Promise((resolve, reject) => {
      document.addEventListener('click', function start(event) {
        if (!event.isTrusted) { reject(new Error('Geen echte browserklik')); return; }
        const t0 = performance.now();
        const check = () => {
          const node = document.querySelector(selector);
          const visible = !!node?.getClientRects().length;
          if (visible === present) requestAnimationFrame(() => resolve(performance.now() - t0));
          else if (performance.now() - t0 > 10_000) reject(new Error('Doel-DOM bleef uit'));
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }, { capture: true, once: true });
    });
  }, { selector: readySelector, present });
  await button.click();
  return page.evaluate(() => window.__resourceMeasure);
}

async function snapshot(page, size) {
  const result = await page.evaluate(() => {
    const s = window.__OPS__.store.getState();
    const table = document.querySelector('[data-ops-grid-row="measure-resource-0"]').closest('table');
    return {
      dom: { text: table.innerText, fields: [...table.querySelectorAll('input,select')].map(e => [e.dataset.opsGridCell, e.value]) },
      state: {
        resources: s.resources, assignments: s.assignments,
        tasks: s.tasks.map(t => ({ id: t.id, resourceIds: t.resourceIds })),
        history: s.historyEvents, isDirty: s.isDirty, resourcesView: s.ui.resourcesView,
      },
    };
  });
  assert.equal(result.state.resources.length, size);
  assert.equal(result.state.assignments.length, size * 40);
  assert.deepEqual(result.state.history, []);
  assert.equal(result.state.isDirty, false);
  assert.equal(result.state.resourcesView, 'project');
  assert.equal(result.dom.fields.find(([id]) => id === 'measure-resource-0:name')[1], 'Resource 0000');
  return { dom: hash(result.dom), state: hash(result.state) };
}

const servers = [];
let browser;
const samples = [];
try {
  servers.push(await serve(beforeDist), await serve(afterDist));
  browser = await chromium.launch({ headless: true });
  for (const size of [250, 1000]) {
    // Eén opwarming, daarna vijf metingen; volgorde wisselt per herhaling op dezelfde runner.
    for (let repeat = -1; repeat < 5; repeat++) {
      for (const revision of repeat % 2 === 0 ? [1, 0] : [0, 1]) {
        const context = await browser.newContext({ baseURL: servers[revision].url, locale: 'nl-NL', viewport: { width: 1600, height: 1000 } });
        const page = await context.newPage();
        page.setDefaultTimeout(15_000);
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        try {
          await fixture(page, size);
          const openMs = await clickMs(page, page.getByTitle(openPanelTitle), `[data-ops-grid-row="measure-resource-${size - 1}"]`);
          await expect(page.locator('tbody [data-ops-grid-row]')).toHaveCount(size);
          const opened = await snapshot(page, size);
          const steps = page.locator('[data-ops-grid-row="measure-resource-0"]').getByTitle(/^(Time-phased capacity|Tijd-gefaseerde capaciteit)$/);
          // De extra rij is de echte capaciteit-editor; de fixture heeft nog geen stappen.
          const editor = 'tbody tr:not([data-ops-grid-row])';
          const expandMs = await clickMs(page, steps, editor);
          await expect(page.getByText(/^(Geen stappen — vlakke max. eenheden geldt altijd.|No steps — the flat max units always applies.)$/)).toBeVisible();
          const expanded = await snapshot(page, size);
          if (repeat === 0 && size === 1000) await page.screenshot({ path: resolve(output, `${revision ? 'na' : 'voor'}-capaciteit.png`) });
          const collapseMs = await clickMs(page, steps, editor, false);
          const collapsed = await snapshot(page, size);
          assert.deepEqual(opened, collapsed, 'Open/dicht wijzigt DOM, store of undo');
          assert.equal(opened.state, expanded.state, 'Uitklappen wijzigt projectdata');
          assert.deepEqual(errors, [], 'Onverwachte browserfouten');
          const sample = { revision: revision ? 'na' : 'voor', size, assignments: size * 40, repeat, openMs, expandMs, collapseMs, opened, expanded, collapsed };
          samples.push(sample);
          writeFileSync(resolve(output, 'raw.json'), JSON.stringify(samples, null, 2) + '\n');
          console.log(JSON.stringify(sample));
        } catch (error) {
          // Ook de zelfstandige productiemeting bewaart foutbeelden; de test-runner doet dit hier niet.
          const prefix = `${revision ? 'na' : 'voor'}-${size}-${repeat}`;
          await page.screenshot({ path: resolve(output, `${prefix}-fout.png`) }).catch(() => {});
          writeFileSync(resolve(output, `${prefix}-fout.json`), JSON.stringify({
            revision, size, repeat, before: process.env.BEFORE_SHA, after: process.env.AFTER_SHA,
            error: String(error), browserErrors: errors,
            visibleText: await page.locator('body').innerText().catch(() => ''),
          }, null, 2) + '\n');
          throw error;
        } finally { await context.close(); }
      }
    }
    const group = samples.filter(s => s.size === size);
    for (const s of group) {
      for (const stage of ['opened', 'expanded', 'collapsed']) assert.deepEqual(s[stage], group[0][stage], `Voor/na-uitvoer verschilt: ${size}/${stage}`);
    }
  }
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const summary = [250, 1000].map(size => ({
    size, assignments: size * 40,
    timings: Object.fromEntries(['voor', 'na'].map(revision => [revision,
      Object.fromEntries(['openMs', 'expandMs', 'collapseMs'].map(key => [key, median(samples.filter(s => s.size === size && s.revision === revision && s.repeat >= 0).map(s => s[key]))])),
    ])),
  }));
  const metadata = {
    before: process.env.BEFORE_SHA, after: process.env.AFTER_SHA, node: process.version,
    chromium: browser.version(), cpu: cpus()[0].model, cores: cpus().length, ram: totalmem(),
    build: 'vite build + VITE_OPS_BENCH_BRIDGE=1; React productiemodus',
    runner: process.env.RUNNER_OS, runId: process.env.GITHUB_RUN_ID,
    benchmarkSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  };
  writeFileSync(resolve(output, 'summary.json'), JSON.stringify({ metadata, summary }, null, 2) + '\n');
  console.log(JSON.stringify({ metadata, summary }, null, 2));
} finally {
  await browser?.close();
  for (const { server } of servers) await new Promise(r => server.close(r));
}
