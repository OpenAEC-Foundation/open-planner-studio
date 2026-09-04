#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 50));
  }
  throw new Error(`${label} niet gereed binnen ${timeoutMs} ms${lastError ? `: ${lastError}` : ''}`);
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('CDP-verbinding gesloten'));
      this.pending.clear();
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { method, resolve: resolvePromise, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function connectWebSocket(url) {
  const socket = new WebSocket(url);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', resolvePromise, { once: true });
    socket.addEventListener('error', () => reject(new Error(`WebSocket kon niet verbinden met ${url}`)), { once: true });
  });
  return socket;
}

async function evaluate(client, expression) {
  const response = await client.call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description
      ?? response.exceptionDetails.text
      ?? 'onbekende browserexceptie';
    throw new Error(detail);
  }
  return response.result?.value;
}

async function performanceMetrics(client) {
  const response = await client.call('Performance.getMetrics');
  return Object.fromEntries(response.metrics.map(metric => [metric.name, metric.value]));
}

async function dismissWelcome(client) {
  await evaluate(client, `(async () => {
    const welcome = document.querySelector('[data-ops-welcome-dialog]');
    if (welcome) {
      const skip = [...welcome.querySelectorAll('button')]
        .find(button => ['Overslaan', 'Skip'].includes(button.textContent?.trim()));
      if (!skip) throw new Error('Overslaan-knop in welkomstdialoog ontbreekt');
      skip.click();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    }
    if (document.querySelector('[data-ops-welcome-dialog]')) {
      throw new Error('Welkomstdialoog bleef open na Overslaan');
    }
    return true;
  })()`);
}

function metricDelta(before, after, name) {
  return round(((after[name] ?? 0) - (before[name] ?? 0)) * 1_000);
}

async function moveMouse(client, target) {
  await client.call('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: target.x,
    y: target.y,
    button: 'none',
    buttons: 0,
    pointerType: 'mouse',
  });
}

async function dispatchMouseClick(client, target, move = true) {
  if (move) await moveMouse(client, target);
  await client.call('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: target.x,
    y: target.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
    pointerType: 'mouse',
  });
  await client.call('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: target.x,
    y: target.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
    pointerType: 'mouse',
  });
}

async function settleMouseAt(client, target) {
  await moveMouse(client, target);
  await evaluate(client, `(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    return true;
  })()`);
}

async function startClickClock(client) {
  await evaluate(client, 'window.__opsSelectionStarted = performance.now()');
}

function timingSample(result, before, after, details = {}) {
  return {
    wallMs: round(result.milliseconds),
    scriptMs: metricDelta(before, after, 'ScriptDuration'),
    layoutMs: metricDelta(before, after, 'LayoutDuration'),
    styleMs: metricDelta(before, after, 'RecalcStyleDuration'),
    taskMs: metricDelta(before, after, 'TaskDuration'),
    ...details,
  };
}

function timingMedians(samples) {
  return Object.fromEntries(
    ['wallMs', 'scriptMs', 'layoutMs', 'styleMs', 'taskMs']
      .map(name => [name, round(median(samples.map(sample => sample[name])))])
  );
}

function summarizeCpuProfile(profile) {
  const nodesById = new Map(profile.nodes.map(node => [node.id, node]));
  const categories = new Map();
  const frames = new Map();
  const samples = profile.samples ?? [];
  const timeDeltas = profile.timeDeltas ?? [];
  for (let index = 0; index < samples.length; index++) {
    const node = nodesById.get(samples[index]);
    if (!node) continue;
    const milliseconds = (timeDeltas[index] ?? 0) / 1_000;
    const frame = node.callFrame;
    const url = frame.url ?? '';
    const functionName = frame.functionName || '(anonymous)';
    const category = url.includes('/src/components/task-grid/') || url.includes('/src/engine/taskGrid/')
      ? 'task-grid'
      : url.includes('/src/components/layout/RightRail/')
        || url.includes('/src/components/panels/')
        || url.includes('/src/components/task-sections/')
        ? 'properties-and-panels'
        : url.includes('/src/components/canvas/') || url.includes('/src/engine/renderer/')
          ? 'gantt-renderer-source'
          : url.includes('react-dom')
            || url.includes('node_modules/.vite/deps/react_')
            || url.includes('node_modules/.vite/deps/scheduler')
            ? 'react-runtime'
            : url.includes('/src/state/')
              ? 'store'
              : url.includes('/src/')
                ? 'other-app'
                : functionName === '(idle)'
                  ? 'idle'
                  : 'browser-and-other';
    categories.set(category, (categories.get(category) ?? 0) + milliseconds);
    const frameKey = `${functionName}\u0000${url}\u0000${frame.lineNumber ?? -1}`;
    const current = frames.get(frameKey) ?? {
      functionName,
      url: url.replace(/^https?:\/\/[^/]+/, ''),
      lineNumber: frame.lineNumber ?? -1,
      selfMs: 0,
    };
    current.selfMs += milliseconds;
    frames.set(frameKey, current);
  }
  return {
    sampledMs: round(timeDeltas.reduce((sum, value) => sum + value, 0) / 1_000),
    categoriesMs: Object.fromEntries(
      [...categories.entries()].sort((left, right) => right[1] - left[1])
        .map(([name, value]) => [name, round(value)])
    ),
    topSelfFrames: [...frames.values()]
      .sort((left, right) => right.selfMs - left.selfMs)
      .slice(0, 30)
      .map(frame => ({ ...frame, selfMs: round(frame.selfMs) })),
  };
}

const appUrl = argumentValue('--url');
const fixturePath = resolve(argumentValue('--fixture') ?? '');
const label = argumentValue('--label') ?? 'product';
const revision = argumentValue('--revision') ?? 'unknown';
const runs = Number(argumentValue('--runs') ?? '9');
const warmups = Number(argumentValue('--warmups') ?? '2');
const expectedTasks = Number(argumentValue('--tasks') ?? '10000');
const outputPath = argumentValue('--out') ? resolve(argumentValue('--out')) : null;

if (!appUrl || !fixturePath || !Number.isInteger(runs) || runs < 1 || !Number.isInteger(warmups) || warmups < 0) {
  console.error('Gebruik: node scripts/bench-task-grid-product.mjs --url URL --fixture PAD [--label NAAM] [--revision HASH] [--warmups 2] [--runs 9]');
  process.exit(64);
}

const fixture = await readFile(fixturePath);
const profileDir = await mkdtemp(join(tmpdir(), 'ops-product-benchmark-chrome-'));
let chrome;
let socket;
let fixtureServer;

try {
  fixtureServer = createServer((request, response) => {
    if (request.url !== '/fixture.ifc') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/octet-stream',
      'Content-Length': fixture.length,
      'Cache-Control': 'no-store',
    });
    response.end(fixture);
  });
  await new Promise((resolvePromise, reject) => {
    fixtureServer.once('error', reject);
    fixtureServer.listen(0, '127.0.0.1', resolvePromise);
  });
  const fixtureAddress = fixtureServer.address();
  if (!fixtureAddress || typeof fixtureAddress === 'string') throw new Error('fixture-server kreeg geen TCP-poort');
  const fixtureUrl = `http://127.0.0.1:${fixtureAddress.port}/fixture.ifc`;

  chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-features=Translate,OptimizationHints,MediaRouter',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--window-size=1400,936',
    appUrl,
  ], {
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      XDG_CONFIG_HOME: profileDir,
      XDG_CACHE_HOME: profileDir,
    },
  });
  let chromeErrors = '';
  chrome.stderr.setEncoding('utf8');
  chrome.stderr.on('data', chunk => { chromeErrors = `${chromeErrors}${chunk}`.slice(-8_000); });

  const activePortPath = join(profileDir, 'DevToolsActivePort');
  let activePort;
  try {
    activePort = await waitFor(async () => {
      const raw = await readFile(activePortPath, 'utf8');
      const value = Number(raw.split(/\r?\n/)[0]);
      return Number.isInteger(value) && value > 0 ? value : null;
    }, 15_000, 'Chrome DevTools');
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : error}\nChrome stderr:\n${chromeErrors}`);
  }
  const targets = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${activePort}/json/list`);
    const list = await response.json();
    return list.find(target => target.type === 'page' && target.url.startsWith(appUrl)) ? list : null;
  }, 15_000, 'app-pagina');
  const target = targets.find(candidate => candidate.type === 'page' && candidate.url.startsWith(appUrl));
  socket = await connectWebSocket(target.webSocketDebuggerUrl);
  const client = new CdpClient(socket);
  await client.call('Runtime.enable');
  await client.call('Performance.enable');

  await waitFor(async () => evaluate(client, 'Boolean(window.__OPS__?.store?.getState)'), 30_000, 'OPS-devbridge');
  await dismissWelcome(client);
  const loadResult = await evaluate(client, `(async () => {
    const text = await fetch(${JSON.stringify(fixtureUrl)}).then(response => {
      if (!response.ok) throw new Error('fixture HTTP ' + response.status);
      return response.text();
    });
    const started = performance.now();
    window.__OPS__.store.getState().openExampleFromString(text, 'Benchmark 10000 taken');
    while (window.__OPS__.store.getState().tasks.length !== ${expectedTasks}) {
      await new Promise(requestAnimationFrame);
    }
    await document.fonts.ready;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    return {
      milliseconds: performance.now() - started,
      tasks: window.__OPS__.store.getState().tasks.length,
      sequences: window.__OPS__.store.getState().sequences.length,
    };
  })()`);

  const samples = [];
  const totalRuns = warmups + runs;
  for (let index = 0; index < totalRuns; index++) {
    await evaluate(client, `(async () => {
      const start = [...document.querySelectorAll('button.ribbon-tab')].find(button => ['Start', 'Home'].includes(button.textContent?.trim()));
      if (!start) throw new Error('Start-tabknop ontbreekt');
      start.click();
      while (window.__OPS__.store.getState().ui.activeRibbonTab !== 'start') await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      return true;
    })()`);
    const before = await performanceMetrics(client);
    const result = await evaluate(client, `(async () => {
      const table = [...document.querySelectorAll('button.ribbon-tab')].find(button => ['Tabel', 'Table'].includes(button.textContent?.trim()));
      if (!table) throw new Error('Tabel-tabknop ontbreekt');
      const started = performance.now();
      table.click();
      while (window.__OPS__.store.getState().ui.activeRibbonTab !== 'table') await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const grid = document.querySelector('[role="grid"]');
      return {
        milliseconds: performance.now() - started,
        elements: document.getElementsByTagName('*').length,
        ariaRowCount: grid?.getAttribute('aria-rowcount') ?? null,
        mountedGridRows: document.querySelectorAll('[data-grid-data-row="true"]').length,
        mountedGridCells: document.querySelectorAll('[data-grid-data-cell="true"]').length,
      };
    })()`);
    const after = await performanceMetrics(client);
    const sample = {
      wallMs: round(result.milliseconds),
      scriptMs: metricDelta(before, after, 'ScriptDuration'),
      layoutMs: metricDelta(before, after, 'LayoutDuration'),
      styleMs: metricDelta(before, after, 'RecalcStyleDuration'),
      taskMs: metricDelta(before, after, 'TaskDuration'),
      elements: result.elements,
      ariaRowCount: result.ariaRowCount,
      mountedGridRows: result.mountedGridRows,
      mountedGridCells: result.mountedGridCells,
    };
    if (index >= warmups) samples.push(sample);
    console.error(`${label} ${index < warmups ? 'warmup' : 'run'} ${index < warmups ? index + 1 : index - warmups + 1}/${index < warmups ? warmups : runs}: ${sample.wallMs} ms, ${sample.elements} elementen`);
  }

  await dismissWelcome(client);
  const selectionSamples = [];
  for (let index = 0; index < totalRuns; index++) {
    const target = await evaluate(client, `(() => {
      const wbsCells = [...document.querySelectorAll('[data-grid-data-cell="true"][data-grid-readonly="true"]')]
        .filter(cell => {
          const key = cell.getAttribute('data-grid-cell-key') ?? '';
          const rect = cell.getBoundingClientRect();
          return key.startsWith('bm-leaf-')
            && key.endsWith('\\u0000task.wbsCode')
            && rect.width > 0
            && rect.height > 0;
        });
      const cell = wbsCells[${index % 2}];
      if (!cell) throw new Error('Twee zichtbare, alleen-lezen WBS-cellen ontbreken');
      const key = cell.getAttribute('data-grid-cell-key');
      const taskId = key.split('\\u0000')[0];
      const rect = cell.getBoundingClientRect();
      const x = rect.x + rect.width / 2;
      const y = rect.y + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      const hitKey = hit?.closest('[data-grid-data-cell="true"]')
        ?.getAttribute('data-grid-cell-key') ?? null;
      return {
        x,
        y,
        key,
        taskId,
        hitKey,
        hitTag: hit?.tagName ?? null,
        hitClass: hit?.getAttribute('class') ?? null,
        hitText: hit?.textContent?.slice(0, 120) ?? null,
      };
    })()`);
    if (target.hitKey !== target.key) {
      throw new Error(`Selectie-doelcel is niet klikbaar op het meetpunt: ${JSON.stringify(target)}`);
    }
    await settleMouseAt(client, target);
    const before = await performanceMetrics(client);
    await startClickClock(client);
    await dispatchMouseClick(client, target, false);
    const result = await evaluate(client, `(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const current = [...document.querySelectorAll('[data-grid-data-cell="true"]')]
        .find(candidate => candidate.getAttribute('data-grid-cell-key') === ${JSON.stringify(target.key)});
      const state = window.__OPS__.store.getState();
      return {
        milliseconds: performance.now() - window.__opsSelectionStarted,
        key: ${JSON.stringify(target.key)},
        taskId: ${JSON.stringify(target.taskId)},
        activeTaskId: state.activeTaskId,
        selectedTaskIds: state.selectedTaskIds,
        ariaSelected: current?.getAttribute('aria-selected') ?? null,
        activeCell: current?.getAttribute('data-grid-active') ?? null,
      };
    })()`);
    const after = await performanceMetrics(client);
    if (result.activeTaskId !== target.taskId
      || result.selectedTaskIds.length !== 1
      || result.selectedTaskIds[0] !== target.taskId
      || result.ariaSelected !== 'true'
      || result.activeCell !== 'true') {
      throw new Error(`Selectie-eindtoestand klopt niet voor ${target.key}: ${JSON.stringify(result)}`);
    }
    const sample = timingSample(result, before, after, {
      taskId: result.taskId,
      key: result.key,
      selectedTaskIds: result.selectedTaskIds,
      ariaSelected: result.ariaSelected,
      activeCell: result.activeCell,
    });
    if (index >= warmups) selectionSamples.push(sample);
    console.error(`${label} selectie ${index < warmups ? 'warmup' : 'run'} ${index < warmups ? index + 1 : index - warmups + 1}/${index < warmups ? warmups : runs}: ${sample.wallMs} ms, taak ${sample.taskId}`);
  }

  const sameCellFloorSamples = [];
  for (let index = 0; index < totalRuns; index++) {
    const target = await evaluate(client, `(() => {
      const cell = document.querySelector('[data-grid-data-cell="true"][data-grid-active="true"]');
      if (!cell) throw new Error('Actieve cel ontbreekt voor herhaalde-klikvloer');
      const key = cell.getAttribute('data-grid-cell-key');
      const taskId = key.split('\\u0000')[0];
      const rect = cell.getBoundingClientRect();
      const x = rect.x + rect.width / 2;
      const y = rect.y + rect.height / 2;
      const hitKey = document.elementFromPoint(x, y)
        ?.closest('[data-grid-data-cell="true"]')
        ?.getAttribute('data-grid-cell-key') ?? null;
      return { x, y, key, taskId, hitKey };
    })()`);
    if (target.hitKey !== target.key) {
      throw new Error(`Actieve cel is niet klikbaar voor herhaalde-klikvloer: ${JSON.stringify(target)}`);
    }
    const before = await performanceMetrics(client);
    await startClickClock(client);
    await dispatchMouseClick(client, target, false);
    const result = await evaluate(client, `(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const state = window.__OPS__.store.getState();
      return {
        milliseconds: performance.now() - window.__opsSelectionStarted,
        activeTaskId: state.activeTaskId,
        selectedTaskIds: state.selectedTaskIds,
      };
    })()`);
    const after = await performanceMetrics(client);
    if (result.activeTaskId !== target.taskId
      || result.selectedTaskIds.length !== 1
      || result.selectedTaskIds[0] !== target.taskId) {
      throw new Error(`Herhaalde-klikvloer veranderde de selectie onverwacht: ${JSON.stringify(result)}`);
    }
    const sample = timingSample(result, before, after, { taskId: target.taskId, key: target.key });
    if (index >= warmups) sameCellFloorSamples.push(sample);
    console.error(`${label} zelfde-celvloer ${index < warmups ? 'warmup' : 'run'} ${index < warmups ? index + 1 : index - warmups + 1}/${index < warmups ? warmups : runs}: ${sample.wallMs} ms`);
  }

  const neutralFloorSamples = [];
  for (let index = 0; index < totalRuns; index++) {
    const target = await evaluate(client, `(() => {
      const element = [...document.querySelectorAll('span')]
        .find(candidate => /^(Tasks|Taken):\\s*\\d+/.test(candidate.textContent?.trim() ?? ''));
      if (!element) throw new Error('Neutraal statusbalkelement ontbreekt');
      const rect = element.getBoundingClientRect();
      const x = rect.x + rect.width / 2;
      const y = rect.y + rect.height / 2;
      const state = window.__OPS__.store.getState();
      return {
        x,
        y,
        hitTag: document.elementFromPoint(x, y)?.tagName ?? null,
        activeTaskId: state.activeTaskId,
        selectedTaskIds: state.selectedTaskIds,
      };
    })()`);
    if (target.hitTag !== 'SPAN') {
      throw new Error(`Neutrale klik raakt niet de bedoelde statustekst: ${JSON.stringify(target)}`);
    }
    if (index === 0) await settleMouseAt(client, target);
    const before = await performanceMetrics(client);
    await startClickClock(client);
    await dispatchMouseClick(client, target, false);
    const result = await evaluate(client, `(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const state = window.__OPS__.store.getState();
      return {
        milliseconds: performance.now() - window.__opsSelectionStarted,
        activeTaskId: state.activeTaskId,
        selectedTaskIds: state.selectedTaskIds,
      };
    })()`);
    const after = await performanceMetrics(client);
    if (result.activeTaskId !== target.activeTaskId
      || JSON.stringify(result.selectedTaskIds) !== JSON.stringify(target.selectedTaskIds)) {
      throw new Error(`Neutrale klik veranderde de taakselectie: ${JSON.stringify({ target, result })}`);
    }
    const sample = timingSample(result, before, after);
    if (index >= warmups) neutralFloorSamples.push(sample);
    console.error(`${label} neutrale-vloer ${index < warmups ? 'warmup' : 'run'} ${index < warmups ? index + 1 : index - warmups + 1}/${index < warmups ? warmups : runs}: ${sample.wallMs} ms`);
  }

  const profileTarget = await evaluate(client, `(() => {
    const state = window.__OPS__.store.getState();
    const cell = [...document.querySelectorAll('[data-grid-data-cell="true"][data-grid-readonly="true"]')]
      .find(candidate => {
        const key = candidate.getAttribute('data-grid-cell-key') ?? '';
        return key.startsWith('bm-leaf-')
          && key.endsWith('\\u0000task.wbsCode')
          && !key.startsWith(state.activeTaskId + '\\u0000');
      });
    if (!cell) throw new Error('CPU-profiel mist een ander zichtbaar WBS-doel');
    const key = cell.getAttribute('data-grid-cell-key');
    const taskId = key.split('\\u0000')[0];
    const rect = cell.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    return { x, y, key, taskId };
  })()`);
  await settleMouseAt(client, profileTarget);
  await client.call('Profiler.enable');
  await client.call('Profiler.setSamplingInterval', { interval: 100 });
  const profileBefore = await performanceMetrics(client);
  await client.call('Profiler.start');
  await startClickClock(client);
  await dispatchMouseClick(client, profileTarget, false);
  const profileResult = await evaluate(client, `(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const state = window.__OPS__.store.getState();
    return {
      milliseconds: performance.now() - window.__opsSelectionStarted,
      activeTaskId: state.activeTaskId,
      selectedTaskIds: state.selectedTaskIds,
      canvasCount: document.querySelectorAll('canvas').length,
    };
  })()`);
  const cpuProfile = (await client.call('Profiler.stop')).profile;
  const profileAfter = await performanceMetrics(client);
  await client.call('Profiler.disable');
  if (profileResult.activeTaskId !== profileTarget.taskId
    || profileResult.selectedTaskIds.length !== 1
    || profileResult.selectedTaskIds[0] !== profileTarget.taskId) {
    throw new Error(`CPU-profielselectie eindigde verkeerd: ${JSON.stringify({ profileTarget, profileResult })}`);
  }
  const selectionCpuProfile = {
    target: profileTarget,
    timing: timingSample(profileResult, profileBefore, profileAfter),
    canvasCount: profileResult.canvasCount,
    ...summarizeCpuProfile(cpuProfile),
  };

  const tableSurface = await evaluate(client, `(async () => {
    const closeProperties = [...document.querySelectorAll('button')]
      .find(button => ['Close properties', 'Eigenschappen sluiten'].includes(button.getAttribute('title')));
    if (!closeProperties) throw new Error('Knop om eigenschappen te sluiten ontbreekt');
    closeProperties.click();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    return {
      canvasCount: document.querySelectorAll('canvas').length,
      propertiesPanelCount: document.querySelectorAll('[data-tour-anchor="properties-panel"]').length,
    };
  })()`);
  if (tableSurface.canvasCount !== 0 || tableSurface.propertiesPanelCount !== 0) {
    throw new Error(`Grid-only meetoppervlak klopt niet: ${JSON.stringify(tableSurface)}`);
  }

  const gridOnlySelectionSamples = [];
  for (let index = 0; index < totalRuns; index++) {
    const target = await evaluate(client, `(() => {
      const wbsCells = [...document.querySelectorAll('[data-grid-data-cell="true"][data-grid-readonly="true"]')]
        .filter(cell => {
          const key = cell.getAttribute('data-grid-cell-key') ?? '';
          const rect = cell.getBoundingClientRect();
          return key.startsWith('bm-leaf-')
            && key.endsWith('\\u0000task.wbsCode')
            && rect.width > 0
            && rect.height > 0;
        });
      const cell = wbsCells[${(index + 1) % 2}];
      if (!cell) throw new Error('Twee zichtbare WBS-cellen ontbreken voor grid-only meting');
      const key = cell.getAttribute('data-grid-cell-key');
      const taskId = key.split('\\u0000')[0];
      const rect = cell.getBoundingClientRect();
      const x = rect.x + rect.width / 2;
      const y = rect.y + rect.height / 2;
      const hitKey = document.elementFromPoint(x, y)
        ?.closest('[data-grid-data-cell="true"]')
        ?.getAttribute('data-grid-cell-key') ?? null;
      return { x, y, key, taskId, hitKey };
    })()`);
    if (target.hitKey !== target.key) {
      throw new Error(`Grid-only doelcel is niet klikbaar: ${JSON.stringify(target)}`);
    }
    await settleMouseAt(client, target);
    const before = await performanceMetrics(client);
    await startClickClock(client);
    await dispatchMouseClick(client, target, false);
    const result = await evaluate(client, `(async () => {
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      const current = [...document.querySelectorAll('[data-grid-data-cell="true"]')]
        .find(candidate => candidate.getAttribute('data-grid-cell-key') === ${JSON.stringify(target.key)});
      const state = window.__OPS__.store.getState();
      return {
        milliseconds: performance.now() - window.__opsSelectionStarted,
        activeTaskId: state.activeTaskId,
        selectedTaskIds: state.selectedTaskIds,
        ariaSelected: current?.getAttribute('aria-selected') ?? null,
        activeCell: current?.getAttribute('data-grid-active') ?? null,
      };
    })()`);
    const after = await performanceMetrics(client);
    if (result.activeTaskId !== target.taskId
      || result.selectedTaskIds.length !== 1
      || result.selectedTaskIds[0] !== target.taskId
      || result.ariaSelected !== 'true'
      || result.activeCell !== 'true') {
      throw new Error(`Grid-only selectie-eindtoestand klopt niet: ${JSON.stringify({ target, result })}`);
    }
    const sample = timingSample(result, before, after, { taskId: target.taskId, key: target.key });
    if (index >= warmups) gridOnlySelectionSamples.push(sample);
    console.error(`${label} grid-only selectie ${index < warmups ? 'warmup' : 'run'} ${index < warmups ? index + 1 : index - warmups + 1}/${index < warmups ? warmups : runs}: ${sample.wallMs} ms`);
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    label,
    revision,
    appUrl,
    fixture: { path: fixturePath, bytes: fixture.length, expectedTasks },
    environment: {
      node: process.version,
      chrome: await evaluate(client, 'navigator.userAgent'),
      platform: process.platform,
      arch: process.arch,
      cpuModel: cpus()[0]?.model ?? 'unknown',
      logicalCpuCount: cpus().length,
    },
    protocol: {
      operation: `klik linttab Tabel vanuit Start na laden van hetzelfde ${expectedTasks}-taken-IFC`,
      warmups,
      runs,
      statistic: 'median',
      readiness: 'actieve tabelstate plus twee animation frames',
    },
    selectionProtocol: {
      operation: 'echte CDP-muisklik op afwisselend twee zichtbare, alleen-lezen WBS-cellen',
      warmups,
      runs,
      statistic: 'median',
      readiness: 'pointerdown tot en met twee animation frames, met actieve taak en celtoestand gecontroleerd',
    },
    floorProtocol: {
      operation: 'dezelfde meetklok voor een herhaalde klik op de actieve cel en een neutrale klik op statustekst',
      warmups,
      runs,
      statistic: 'median',
      readiness: 'twee animation frames, met ongewijzigde taakselectie gecontroleerd',
    },
    gridOnlyProtocol: {
      operation: 'dezelfde taakselectie na sluiten van de eigenschappenrail',
      warmups,
      runs,
      statistic: 'median',
      readiness: 'nul canvas-elementen en nul eigenschappenpanelen plus twee animation frames',
    },
    load: loadResult,
    samples,
    medians: Object.fromEntries(
      ['wallMs', 'scriptMs', 'layoutMs', 'styleMs', 'taskMs', 'elements'].map(name => [name, round(median(samples.map(sample => sample[name])))])
    ),
    selectionSamples,
    selectionMedians: timingMedians(selectionSamples),
    sameCellFloorSamples,
    sameCellFloorMedians: timingMedians(sameCellFloorSamples),
    neutralFloorSamples,
    neutralFloorMedians: timingMedians(neutralFloorSamples),
    selectionCpuProfile,
    tableSurface,
    gridOnlySelectionSamples,
    gridOnlySelectionMedians: timingMedians(gridOnlySelectionSamples),
  };
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill('SIGTERM');
    await Promise.race([
      new Promise(resolvePromise => chrome.once('exit', resolvePromise)),
      new Promise(resolvePromise => setTimeout(resolvePromise, 3_000)),
    ]);
  }
  await new Promise(resolvePromise => fixtureServer?.close(resolvePromise));
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
