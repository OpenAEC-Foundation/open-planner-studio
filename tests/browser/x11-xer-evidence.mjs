import { access, lstat, mkdir, readFile, readlink, symlink, unlink, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  readOpsState,
  readMultiDocumentOpsState,
  assertSmallAState,
  assertMultiDocumentEvidence,
  assertMultiDocumentToastLines,
  normalizeVisibleToastLines,
  XER_OPEN_MESSAGE_KEY,
} from './helpers/ops-state.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DEFAULT_CHROMIUM = '/home/nozzit/.cache/ms-playwright/chromium-1237/chrome-linux64/chrome';
const FALLBACK_CHROMIUM = '/usr/bin/google-chrome';
const DEFAULT_CORPUS_FILE = 'crawl-xer/p6diff-baseline.xer';
const MULTI_DOCUMENT_CORPUS_FILE = 'crawl-xer/eh_P6Workshops/OZB-Start-09Dec24.xer';
const MULTI_DOCUMENT_SCENARIO = 'multidoc-help';
const EVIDENCE_ROOT = '/tmp/xer-x11-evidence';

function runId() {
  return `${new Date().toISOString().replace(/[^0-9TZ]/g, '')}-${process.pid}`;
}

function isExplicitCiMode() {
  return process.env.OPS_XER_X11_CI === '1';
}

function fail(message) {
  throw new Error(message);
}

function gitOutput(args, label) {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
    fail(`git-bewijs kon ${label} niet lezen${stderr ? `: ${stderr}` : ''}`);
  }
}

function readGitEvidence() {
  const toplevel = gitOutput(['rev-parse', '--show-toplevel'], 'toplevel').trim();
  const branch = gitOutput(['branch', '--show-current'], 'branch').trim();
  const head = gitOutput(['rev-parse', 'HEAD'], 'HEAD').trim();
  const parent = gitOutput(['rev-parse', 'HEAD^'], 'HEAD-parent').trim();
  const statusPorcelainV1 = gitOutput(['status', '--porcelain=v1'], 'status');
  if (toplevel !== REPO_ROOT) {
    fail(`git-toplevel-gate rood: ${toplevel}, verwacht exact ${REPO_ROOT}`);
  }
  return { toplevel, branch, head, parent, statusPorcelainV1 };
}

export function assertGitEvidenceUnchanged(before, after) {
  const fields = ['toplevel', 'branch', 'head', 'statusPorcelainV1'];
  const differences = fields.filter((field) => before[field] !== after[field]);

  if (differences.length > 0) {
    fail(
      `git-eindintegriteitsgate rood: verschil=${differences.join(',')}; ` +
        `begin=${JSON.stringify(before)}; eind=${JSON.stringify(after)}`,
    );
  }
}

export function assertMetadataGitIdentity(metadata, expected) {
  const observed = metadata.git;
  if (observed?.toplevel !== expected.toplevel || observed?.branch !== expected.branch ||
      observed?.head !== expected.head || observed?.parent !== expected.parent ||
      observed?.statusPorcelainV1 !== expected.statusPorcelainV1) {
    fail(`metadata-git-identiteitsgate rood: observed=${JSON.stringify(observed)}; expected=${JSON.stringify(expected)}`);
  }
}

async function readableFile(path, label) {
  try {
    await access(path, fsConstants.R_OK);
  } catch {
    fail(`${label} ontbreekt of is niet leesbaar: ${path}`);
  }
}

async function preflight() {
  const scenario = process.env.OPS_XER_X11_SCENARIO?.trim() || 'small-a';
  if (!['small-a', MULTI_DOCUMENT_SCENARIO].includes(scenario)) {
    fail(`onbekend OPS_XER_X11_SCENARIO: ${scenario}`);
  }
  const corpusFile = scenario === MULTI_DOCUMENT_SCENARIO ? MULTI_DOCUMENT_CORPUS_FILE : DEFAULT_CORPUS_FILE;
  const corpusRoot = process.env.OPS_XER_CORPUS?.trim();
  const display = process.env.DISPLAY?.trim();
  const waylandSocket = resolve(process.env.XDG_RUNTIME_DIR?.trim() || '/run/user/1000', process.env.WAYLAND_DISPLAY?.trim() || 'wayland-0');
  const chromiumPath = [
    process.env.OPS_CHROMIUM_PATH?.trim(),
    DEFAULT_CHROMIUM,
    FALLBACK_CHROMIUM,
  ].find((candidate) => candidate && existsSync(candidate));

  if (isExplicitCiMode()) {
    console.log('SKIP: expliciete CI-modus (OPS_XER_X11_CI=1)');
    return null;
  }

  if (!corpusRoot) fail('OPS_XER_CORPUS is verplicht voor een lokale X11-run');
  await readableFile(resolve(corpusRoot, corpusFile), 'XER-corpusbestand');
  if (!chromiumPath) fail('geen bruikbaar Chromium-executable gevonden');
  if (!display && !existsSync(waylandSocket)) {
    fail('geen bruikbaar desktopdisplay: DISPLAY is leeg en Wayland-socket ontbreekt');
  }

  return {
    corpusRoot: resolve(corpusRoot),
    xerPath: resolve(corpusRoot, corpusFile),
    scenario,
    chromiumPath,
    display: display || null,
    waylandSocket: existsSync(waylandSocket) ? waylandSocket : null,
  };
}

async function waitForDevServer(child) {
  let output = `[harness] SERVER_PID=${child.pid}\n[harness] DEV_ENV OPS_DEV_GUARDED=absent OPS_DEV_PORT=absent\n`;
  let assignedUrl = null;

  const observe = (chunk) => {
    output += chunk.toString();
    assignedUrl ??= output.match(/http:\/\/localhost:\d+\//)?.[0] ?? null;
  };
  child.stdout.on('data', observe);
  child.stderr.on('data', observe);

  const deadline = Date.now() + 30_000;
  while (!assignedUrl && Date.now() < deadline) {
    if (child.exitCode !== null) fail(`npm run dev stopte vóór URL (${child.exitCode}). Output:\n${output}`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  if (!assignedUrl) fail(`npm run dev gaf binnen 30s geen toegewezen URL. Output:\n${output}`);

  let response = null;
  let lastFetchError = null;
  while (!response && Date.now() < deadline) {
    try {
      const candidate = await fetch(assignedUrl);
      if (candidate.status === 200) response = candidate;
      else fail(`dev-server ${assignedUrl} gaf HTTP ${candidate.status}`);
    } catch (error) {
      lastFetchError = error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
  }
  if (!response) fail(`dev-server ${assignedUrl} werd niet bereikbaar: ${lastFetchError}. Output:\n${output}`);

  const procCwd = await readlink(`/proc/${child.pid}/cwd`);
  if (procCwd !== REPO_ROOT) {
    fail(`servercwd is ${procCwd}, verwacht exact ${REPO_ROOT}`);
  }

  const launchConfig = JSON.parse(await readFile(resolve(REPO_ROOT, '.claude/launch.json'), 'utf8'));
  const recordedPort = launchConfig.opsDevPort;
  const assignedPort = Number(new URL(assignedUrl).port);
  const normalRoute = output.includes(
    `▶ open-planner-studio dev — worktree "${REPO_ROOT.split('/').pop()}" → ${assignedUrl}`,
  );
  if (!normalRoute) {
    fail(`serveroutput bewijst de normale bewaakte devroute niet. Output:\n${output}`);
  }
  if (!Number.isInteger(recordedPort) || assignedPort !== recordedPort) {
    fail(`devpoort ${assignedPort} is niet de vaste worktreepoort ${recordedPort}`);
  }

  return {
    assignedUrl,
    pid: child.pid,
    procCwd,
    output,
    guard: {
      inheritedEnvRemoved: true,
      normalRoute,
      externallyForcedPort: false,
      recordedPort,
    },
  };
}

async function startDevServer() {
  const npmCommand = process.env.OPS_NPM_PATH?.trim() || 'npm';
  const childEnv = { ...process.env };
  delete childEnv.OPS_DEV_GUARDED;
  delete childEnv.OPS_DEV_PORT;
  if ('OPS_DEV_GUARDED' in childEnv || 'OPS_DEV_PORT' in childEnv) {
    fail('serverguard-env kon niet worden opgeschoond');
  }
  const child = spawn(npmCommand, ['run', 'dev'], {
    cwd: REPO_ROOT,
    detached: true,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const server = await waitForDevServer(child);
    return { child, server };
  } catch (error) {
    await stopDevServer(child);
    throw error;
  }
}

async function ensureDependencies() {
  const linkPath = resolve(REPO_ROOT, 'node_modules');
  if (existsSync(linkPath)) return { linkPath: null };
  const externalCandidates = [
    process.env.OPS_NODE_MODULES_DIR?.trim(),
    '/home/nozzit/open-aec/open-planner-studio/node_modules',
  ].filter(Boolean);
  const external = externalCandidates.find((candidate) =>
    existsSync(resolve(candidate, 'react/package.json')) && existsSync(resolve(candidate, 'vite/package.json')),
  );
  if (!external) fail('geen bestaand extern node_modules-pad; stel OPS_NODE_MODULES_DIR in');
  await readableFile(resolve(external, 'react/package.json'), 'extern node_modules');
  await symlink(external, linkPath, 'dir');
  return { linkPath };
}

async function removeTemporaryDependencies(linkPath) {
  if (!linkPath) return;
  try {
    const stat = await lstat(linkPath);
    if (stat.isSymbolicLink()) await unlink(linkPath);
  } catch { /* opruimen is best effort; de runstatus blijft leidend */ }
}

function loadPlaywrightCore() {
  const candidates = [
    process.env.OPS_PLAYWRIGHT_DIR?.trim(),
    '/home/nozzit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const require = createRequire(import.meta.url);
      const packageJson = resolve(candidate, 'package.json');
      if (existsSync(packageJson)) {
        const metadata = JSON.parse(require(packageJson));
        if (metadata.name === 'playwright-core') return require(candidate);
      }
      return require(require.resolve('playwright-core', { paths: [candidate] }));
    } catch { /* probeer het volgende expliciete/externe pad */ }
  }
  fail('playwright-core niet gevonden; stel OPS_PLAYWRIGHT_DIR in');
}

async function assertNoDirectPathOpen() {
  const source = await readFile(fileURLToPath(import.meta.url), 'utf8');
  const forbidden = [
    ['open', 'From', 'Path'].join(''),
    ['open', 'From', 'Path', 'WithIO'].join(''),
    ['open', 'Help', 'Article'].join(''),
  ];
  if (forbidden.some((token) => source.includes(token))) {
    fail('statische guard: directe pad- of Help-openactie is verboden in het X11-harnas');
  }
}

async function installDevBridgeOpenGate(page) {
  return page.evaluate(() => {
    const bridge = window.__OPS__;
    if (!bridge) throw new Error('window.__OPS__ ontbreekt voor anti-sluiproute-gate');
    const gate = { calls: [], wrapped: [] };
    window.__OPS_X11_BRIDGE_GATE__ = gate;

    const liveGetState = bridge.store.getState.bind(bridge.store);
    const dataRecord = (entries) => {
      const record = Object.create(null);
      for (const [key, value] of entries) record[key] = value;
      return Object.freeze(record);
    };
    const hashScalar = (value) => {
      if (typeof value !== 'string' || value.length === 0) return null;
      let hash = 0x811c9dc5;
      for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
      }
      return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
    };
    const makeSnapshot = () => {
      const live = liveGetState();
      const notificationEntries = Object.create(null);
      const liveNotifications = Array.isArray(live.ui?.notifications) ? live.ui.notifications : [];
      for (let index = 0; index < liveNotifications.length; index += 1) {
        const item = liveNotifications[index];
        const detailEntries = Object.create(null);
        const liveDetails = Array.isArray(item.detailLines) ? item.detailLines : [];
        for (let detailIndex = 0; detailIndex < liveDetails.length; detailIndex += 1) {
          const detail = liveDetails[detailIndex];
          detailEntries[String(detailIndex)] = dataRecord([
            ['messageKey', typeof detail.messageKey === 'string' ? detail.messageKey : null],
            ['count', Number.isFinite(detail.params?.count) ? detail.params.count : null],
            ['encoding', typeof detail.params?.encoding === 'string' ? detail.params.encoding : null],
          ]);
        }
        Object.freeze(detailEntries);
        notificationEntries[String(index)] = dataRecord([
          ['severity', typeof item.severity === 'string' ? item.severity : null],
          ['messageKey', typeof item.messageKey === 'string' ? item.messageKey : null],
          ['helpArticleId', typeof item.helpArticleId === 'string' ? item.helpArticleId : null],
          ['count', Number.isFinite(item.params?.count) ? item.params.count : null],
          ['detailLines', detailEntries],
        ]);
      }
      Object.freeze(notificationEntries);
      const importedTaskCount = Array.isArray(live.tasks)
        ? live.tasks.filter((task) => task.isSummary !== true && (task.childIds?.length ?? 0) === 0).length
        : 0;
      const rawReport = live.xerSourceArchive?.diagnostics?.file?.importReport;
      const importReport = dataRecord([
        ['projectsSeen', Number.isInteger(rawReport?.projectsSeen) ? rawReport.projectsSeen : null],
        ['documentsOpened', Number.isInteger(rawReport?.documentsOpened) ? rawReport.documentsOpened : null],
        ['emptyProjectsSkipped', Number.isInteger(rawReport?.emptyProjectsSkipped) ? rawReport.emptyProjectsSkipped : null],
        ['baselineProjectsExcluded', Number.isInteger(rawReport?.baselineProjectsExcluded) ? rawReport.baselineProjectsExcluded : null],
        ['baselinesMaterialized', Number.isInteger(rawReport?.baselinesMaterialized) ? rawReport.baselinesMaterialized : null],
        ['danglingBaselineReferences', Number.isInteger(rawReport?.danglingBaselineReferences) ? rawReport.danglingBaselineReferences : null],
      ]);
      return dataRecord([
        ['documents', dataRecord([['count', Array.isArray(live.documents) ? live.documents.length : 0]])],
        ['tasks', dataRecord([['importedCount', importedTaskCount]])],
        ['sequences', dataRecord([['count', Array.isArray(live.sequences) ? live.sequences.length : 0]])],
        ['cpmResult', Boolean(live.cpmResult)],
        ['xerSourceArchive', dataRecord([['present', Boolean(live.xerSourceArchive)]])],
        ['xerSourceProjectId', typeof live.xerSourceProjectId === 'string' ? live.xerSourceProjectId : null],
        ['xerImportReport', importReport],
        ['activeDocument', dataRecord([
          ['documentHash', hashScalar(live.activeDocumentId)],
          ['projectIdentityHash', hashScalar(live.xerSourceProjectId)],
          ['taskCount', importedTaskCount],
          ['sequenceCount', Array.isArray(live.sequences) ? live.sequences.length : 0],
          ['cpmPresent', Boolean(live.cpmResult)],
          ['sourceArchivePresent', Boolean(live.xerSourceArchive)],
        ])],
        ['ui', dataRecord([
          ['activeRibbonTab', typeof live.ui?.activeRibbonTab === 'string' ? live.ui.activeRibbonTab : null],
          ['backstageSection', typeof live.ui?.backstageSection === 'string' ? live.ui.backstageSection : null],
          ['pendingHelpArticleConsumed', live.ui?.pendingHelpArticleId === null],
          ['notifications', dataRecord([
            ['count', liveNotifications.length],
            ['entries', notificationEntries],
          ])],
        ])],
      ]);
    };
    const storeFacade = Object.create(null);
    Object.defineProperty(storeFacade, 'getState', {
      value: () => makeSnapshot(),
      enumerable: true,
      writable: false,
      configurable: false,
    });
    Object.freeze(storeFacade);
    Object.defineProperty(bridge, 'store', {
      value: storeFacade,
      enumerable: true,
      writable: false,
      configurable: false,
    });

    const inspectFunctions = (value, path, found, invalidObjects, seenObjects) => {
      if (typeof value === 'function') {
        found.push(path);
        return;
      }
      if (!value || typeof value !== 'object' || seenObjects.has(value)) return;
      seenObjects.add(value);
      if (Array.isArray(value) || Object.getPrototypeOf(value) !== null) invalidObjects.push(path);
      for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && 'value' in descriptor) {
          inspectFunctions(descriptor.value, `${path}.${String(key)}`, found, invalidObjects, seenObjects);
        }
      }
    };
    const inspectStoreFacade = () => {
      const snapshot = storeFacade.getState();
      const secondSnapshot = storeFacade.getState();
      const facadeFunctions = [];
      const snapshotFunctions = [];
      const invalidFacadeObjects = [];
      const invalidSnapshotObjects = [];
      inspectFunctions(storeFacade, 'devBridge.store', facadeFunctions, invalidFacadeObjects, new WeakSet());
      inspectFunctions(snapshot, 'snapshot', snapshotFunctions, invalidSnapshotObjects, new WeakSet());
      const result = {
        frozen: Object.isFrozen(storeFacade),
        freshSnapshots: snapshot !== secondSnapshot,
        facadeFunctions,
        snapshotFunctions,
        invalidFacadeObjects,
        invalidSnapshotObjects,
        openFileAbsent: !Reflect.has(snapshot, 'openFile'),
        applyOpenedImportAbsent: !Reflect.has(snapshot, 'applyOpenedImport'),
      };
      if (!result.frozen || !result.freshSnapshots ||
          JSON.stringify(result.facadeFunctions) !== JSON.stringify(['devBridge.store.getState']) ||
          result.snapshotFunctions.length !== 0 || result.invalidFacadeObjects.length !== 0 ||
          result.invalidSnapshotObjects.length !== 0 || !result.openFileAbsent || !result.applyOpenedImportAbsent) {
        throw new Error(`read-only-store-gate rood: ${JSON.stringify(result)}`);
      }
      return result;
    };

    const seen = new WeakSet();

    const visit = (value, path) => {
      if (!value || (typeof value !== 'object' && typeof value !== 'function') || seen.has(value)) return;
      seen.add(value);
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || (path === 'devBridge' && (key === 'store' || key === 'log'))) continue;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor)) continue;
        const memberPath = `${path}.${key}`;
        const member = descriptor.value;
        if (typeof member === 'function' && /open|import/i.test(key)) {
          const blocked = function blockedDevBridgeOpen(...args) {
            gate.calls.push({ method: memberPath, argc: args.length });
            throw new Error(`X11 anti-sluiproute: ${memberPath} werd aangeroepen`);
          };
          Object.defineProperty(value, key, { ...descriptor, value: blocked });
          gate.wrapped.push(memberPath);
          continue;
        }
        visit(member, memberPath);
      }
    };

    visit(bridge, 'devBridge');
    if (gate.wrapped.length === 0) throw new Error('anti-sluiproute-gate vond geen devBridge-openmethoden');
    return { wrapped: [...gate.wrapped], storeFacade: inspectStoreFacade() };
  });
}

async function readDevBridgeOpenGate(page) {
  return page.evaluate(() => {
    const bridge = window.__OPS__;
    if (!bridge) throw new Error('window.__OPS__ ontbreekt bij gate-readback');
    const inspectFunctions = (value, path, found, invalidObjects, seenObjects) => {
      if (typeof value === 'function') {
        found.push(path);
        return;
      }
      if (!value || typeof value !== 'object' || seenObjects.has(value)) return;
      seenObjects.add(value);
      if (Array.isArray(value) || Object.getPrototypeOf(value) !== null) invalidObjects.push(path);
      for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && 'value' in descriptor) {
          inspectFunctions(descriptor.value, `${path}.${String(key)}`, found, invalidObjects, seenObjects);
        }
      }
    };
    const snapshot = bridge.store.getState();
    const secondSnapshot = bridge.store.getState();
    const facadeFunctions = [];
    const snapshotFunctions = [];
    const invalidFacadeObjects = [];
    const invalidSnapshotObjects = [];
    inspectFunctions(bridge.store, 'devBridge.store', facadeFunctions, invalidFacadeObjects, new WeakSet());
    inspectFunctions(snapshot, 'snapshot', snapshotFunctions, invalidSnapshotObjects, new WeakSet());
    const storeFacade = {
      frozen: Object.isFrozen(bridge.store),
      freshSnapshots: snapshot !== secondSnapshot,
      facadeFunctions,
      snapshotFunctions,
      invalidFacadeObjects,
      invalidSnapshotObjects,
      openFileAbsent: !Reflect.has(snapshot, 'openFile'),
      applyOpenedImportAbsent: !Reflect.has(snapshot, 'applyOpenedImport'),
    };
    if (!storeFacade.frozen || !storeFacade.freshSnapshots ||
        JSON.stringify(storeFacade.facadeFunctions) !== JSON.stringify(['devBridge.store.getState']) ||
        storeFacade.snapshotFunctions.length !== 0 || storeFacade.invalidFacadeObjects.length !== 0 ||
        storeFacade.invalidSnapshotObjects.length !== 0 || !storeFacade.openFileAbsent ||
        !storeFacade.applyOpenedImportAbsent) {
      throw new Error(`read-only-store-gate rood: ${JSON.stringify(storeFacade)}`);
    }
    return {
      calls: [...(window.__OPS_X11_BRIDGE_GATE__?.calls ?? [])],
      wrapped: [...(window.__OPS_X11_BRIDGE_GATE__?.wrapped ?? [])],
      storeFacade,
    };
  });
}

function assertPrivacySafeToast(text, box) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const expected = /^XER file opened: \d+ project documents?\. \d+ projects? found\.(?: \d+ enum fallbacks?\.)? Read more$/;
  if (!expected.test(normalized)) fail(`toasttekst valt buiten privacyveilige allowlist: ${JSON.stringify(normalized)}`);
  if (/[\\/]|\.xer\b/i.test(normalized)) fail(`toasttekst bevat een pad of bestandsnaam: ${JSON.stringify(normalized)}`);
  if (!box || box.width < 180 || box.height < 40 || box.width > 1440 || box.height > 300) {
    fail(`toastclip heeft ongeldige afmetingen: ${JSON.stringify(box)}`);
  }
}

function assertPrivacySafeMultiDocumentToast(text, box) {
  assertMultiDocumentToastLines(normalizeVisibleToastLines(text));
  if (!box || box.width < 180 || box.height < 80 || box.width > 1440 || box.height > 500) {
    fail(`multi-documenttoast heeft ongeldige afmetingen: ${JSON.stringify(box)}`);
  }
}

async function openWithVisibleFileChooser(page, xerPath) {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^Open$/ });
  if (await openButton.count() !== 1) fail(`zichtbare Engelse Open-knop niet uniek: ${await openButton.count()}`);
  const fileChooserPromise = page.waitForEvent('filechooser');
  await openButton.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(xerPath);
}

async function readActiveTabCorrelation(page) {
  return page.evaluate(() => {
    const hashScalar = (value) => {
      if (typeof value !== 'string' || value.length === 0) return null;
      let hash = 0x811c9dc5;
      for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
      }
      return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
    };
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    const panel = document.querySelector('[role="tabpanel"]');
    const rect = activeTab?.getBoundingClientRect();
    const tabViewport = activeTab?.closest('[data-ops-tabstrip-viewport]')?.getBoundingClientRect();
    const activeElement = document.activeElement;
    const inInput = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement || activeElement?.getAttribute('contenteditable') === 'true';
    const state = window.__OPS__?.store.getState();
    return {
      observedOrdinal: Number(activeTab?.getAttribute('data-ops-tab-index')),
      outsideInput: !inInput,
      tabVisible: Boolean(
        rect && tabViewport && rect.width > 0 && rect.height > 0 &&
        rect.left >= tabViewport.left && rect.right <= tabViewport.right,
      ),
      tabpanelCorrelated: Boolean(
        activeTab?.id && panel?.id && activeTab.getAttribute('aria-controls') === panel.id &&
        panel.getAttribute('aria-labelledby') === activeTab.id,
      ),
      activeDocumentHashCorrelated: Boolean(
        state?.activeDocument?.documentHash &&
        state.activeDocument.documentHash === hashScalar(activeTab?.getAttribute('data-ops-tab')),
      ),
    };
  });
}

async function waitForActiveOrdinal(page, ordinal) {
  await page.waitForFunction((expected) => {
    const active = document.querySelector('[role="tab"][aria-selected="true"]');
    return Number(active?.getAttribute('data-ops-tab-index')) === expected;
  }, ordinal, { timeout: 10_000 });
}

async function switchToOrdinal(page, ordinal, route) {
  const started = performance.now();
  if (route.startsWith('shortcut:')) {
    await page.locator('[role="tab"][aria-selected="true"]').click();
    const outsideInputBefore = await page.evaluate(() => {
      const active = document.activeElement;
      return !(active instanceof HTMLInputElement) && !(active instanceof HTMLTextAreaElement) &&
        !(active instanceof HTMLSelectElement) && active?.getAttribute('contenteditable') !== 'true';
    });
    if (!outsideInputBefore) fail(`shortcut ${ordinal} startte in een invoerveld`);
    await page.keyboard.press(route.slice('shortcut:'.length));
  } else if (route === 'click') {
    await page.locator(`[role="tab"][data-ops-tab-index="${ordinal}"]`).click();
  } else if (route === 'keyboard:ArrowRight') {
    await page.locator('[role="tab"][aria-selected="true"]').press('ArrowRight');
  } else {
    fail(`onbekende documentwisselroute: ${route}`);
  }
  await waitForActiveOrdinal(page, ordinal);
  const latencyMs = performance.now() - started;
  return { ...(await readActiveTabCorrelation(page)), latencyMs };
}

async function runBrowserMultiDocumentHelp(page, preflightResult, bridgeGateSetup) {
  const openStarted = performance.now();
  await openWithVisibleFileChooser(page, preflightResult.xerPath);

  const toast = page.locator('.ops-toast').filter({ hasText: 'XER file opened' }).first();
  await toast.waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => window.__OPS__?.store.getState()?.documents?.count === 12, null, { timeout: 30_000 });
  const openLatencyMs = performance.now() - openStarted;
  const toastText = await toast.innerText();
  const toastLines = normalizeVisibleToastLines(toastText);
  const toastBox = await toast.boundingBox();
  assertPrivacySafeMultiDocumentToast(toastText, toastBox);
  const toastScreenshot = await toast.screenshot();

  const imported = await readMultiDocumentOpsState(page);
  if (imported.documentCount !== 12) fail(`DOM/store import opende ${imported.documentCount} documenten, verwacht 12`);
  if (imported.notification?.count !== 12 || imported.notification.helpArticleId !== 'gids-xer-import') {
    fail(`XER-notificatieprojectie onjuist: ${JSON.stringify(imported.notification)}`);
  }
  const detailCounts = Object.fromEntries(imported.notification.detailLines.map((line) => [line.messageKey, line.count]));
  const expectedDetails = {
    'notifications.xerImportProjectsSeen': 15,
    'notifications.xerImportEmptyProjectsSkipped': 3,
    'notifications.xerImportDanglingBaselineReferences': 9,
  };
  for (const [messageKey, count] of Object.entries(expectedDetails)) {
    if (detailCounts[messageKey] !== count) fail(`zichtbare toastdetail ${messageKey}=${detailCounts[messageKey]}, verwacht ${count}`);
  }
  const encodingDetail = imported.notification.detailLines.find(
    (line) => line.messageKey === 'notifications.xerImportEncoding',
  );
  const encoding = {
    messageKey: encodingDetail?.messageKey ?? null,
    value: encodingDetail?.encoding ?? null,
  };

  const readMore = toast.locator('button.ops-toast-readmore');
  if (await readMore.count() !== 1) fail('zichtbare Read more-knop ontbreekt of is niet uniek');
  await readMore.click();
  const activeHelpItem = page.locator('.help-toc-item.active');
  const articleHeading = page.locator('.help-article-body h1');
  await activeHelpItem.waitFor({ state: 'visible', timeout: 15_000 });
  await articleHeading.waitFor({ state: 'visible', timeout: 15_000 });
  const activeTocTitle = (await activeHelpItem.innerText()).trim();
  const headingTitle = (await articleHeading.innerText()).trim();
  const helpBodyText = await page.locator('.help-article-body').innerText();
  const helpState = await readMultiDocumentOpsState(page);
  const help = {
    notificationHelpArticleId: imported.notification.helpArticleId,
    activeTocTitle,
    articleHeading: headingTitle,
    activeRibbonTab: helpState.ui.activeRibbonTab,
    backstageSection: helpState.ui.backstageSection,
    pendingHelpArticleConsumed: helpState.ui.pendingHelpArticleConsumed,
    hasMultiDocumentExplanation: helpBodyText.includes('several project documents'),
    hasEmptyProjectExplanation: helpBodyText.includes('Empty projects do not create a pointless tab.'),
    hasBaselineExplanation: helpBodyText.includes('A P6 baseline project is not opened as a separate schedulable document.'),
  };
  const helpScreenshot = await page.screenshot({
    fullPage: false,
    mask: [
      page.locator('canvas'),
      page.locator('.title-bar-file-name'),
      page.locator('[role="tab"]'),
      page.locator('.help-article-body'),
    ],
    maskColor: '#263238',
  });

  const homeTab = page.locator('button.ribbon-tab').filter({ hasText: /^Home$/ });
  if (await homeTab.count() !== 1) fail('zichtbare Engelse Home-tab ontbreekt of is niet uniek');
  await homeTab.click();
  const tabs = page.locator('[role="tab"][data-ops-tab-index]');
  await tabs.first().waitFor({ state: 'visible', timeout: 10_000 });
  if (await tabs.count() !== 12) fail(`DOM-tabtelling=${await tabs.count()}, verwacht 12`);

  const routeByOrdinal = new Map([
    [1, 'shortcut:Control+1'],
    [5, 'shortcut:Control+5'],
    [9, 'shortcut:Control+9'],
    [10, 'click'],
    [11, 'keyboard:ArrowRight'],
    [12, 'keyboard:ArrowRight'],
  ]);
  const documents = [];
  const switches = [];
  for (let ordinal = 1; ordinal <= 12; ordinal += 1) {
    const route = routeByOrdinal.get(ordinal) ?? 'click';
    const switched = await switchToOrdinal(page, ordinal, route);
    const snapshot = await readMultiDocumentOpsState(page);
    switches.push({ requestedOrdinal: ordinal, route, ...switched });
    documents.push({ ordinal, ...snapshot.activeDocument });
  }

  const screenshot = await page.screenshot({
    fullPage: false,
    mask: [
      page.locator('canvas'),
      page.locator('.title-bar-file-name'),
      page.locator('[role="tab"]'),
      page.locator('.help-article-body'),
    ],
    maskColor: '#263238',
  });
  const evidence = { report: imported.report, encoding, toastLines, openLatencyMs, documents, switches, help };
  assertMultiDocumentEvidence(evidence);

  const bridgeGate = await readDevBridgeOpenGate(page);
  if (bridgeGate.calls.length !== 0) fail(`anti-sluiproute-gate rood: ${JSON.stringify(bridgeGate.calls)}`);
  if (bridgeGate.wrapped.length !== bridgeGateSetup.wrapped.length || bridgeGate.wrapped.length === 0) {
    fail(`anti-sluiproute-gate verloor wrappers: ${JSON.stringify(bridgeGate)}`);
  }
  const dialogCounts = await page.evaluate(() => ({ ...window.__OPS_X11_DIALOG_COUNTS__ }));
  if (dialogCounts.alert !== 0 || dialogCounts.confirm !== 0 || dialogCounts.prompt !== 0) {
    fail(`native-dialog-audit rood: ${JSON.stringify(dialogCounts)}`);
  }
  return {
    state: evidence,
    domText: null,
    dialogCounts,
    bridgeGate,
    screenshot,
    toastScreenshot,
    helpScreenshot,
    toastBox,
  };
}

async function runBrowserSmallA(preflightResult, server) {
  const { chromium } = loadPlaywrightCore();
  const browserEnv = { ...process.env };
  const launchArgs = [];
  if (!browserEnv.DISPLAY?.trim() && preflightResult.waylandSocket) {
    browserEnv.XDG_RUNTIME_DIR = '/run/user/1000';
    browserEnv.WAYLAND_DISPLAY = 'wayland-0';
    launchArgs.push('--ozone-platform=wayland');
  }

  const browser = await chromium.launch({
    executablePath: preflightResult.chromiumPath,
    headless: false,
    env: browserEnv,
    args: launchArgs,
  });
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
  });
  // Deze drie wijzigingen gelden alleen binnen dit Playwright-contextobject. De eerste gebeurt
  // vóór de eerste pagina-load, zodat de bestaande input[type=file]-terugval werkelijk wordt
  // gekozen in plaats van de Chromium File System Access API.
  await context.addInitScript(() => {
    delete window.showOpenFilePicker;
    localStorage.setItem('ops-locale', 'en');
    localStorage.setItem('ops-docs-locale', 'en');
    localStorage.setItem('ops-documentChromeStyle', 'tabs');
    localStorage.setItem('ops-welcomeSeen', 'true');
    const counts = { alert: 0, confirm: 0, prompt: 0 };
    window.__OPS_X11_DIALOG_COUNTS__ = counts;
    window.alert = () => { counts.alert += 1; };
    window.confirm = () => { counts.confirm += 1; return false; };
    window.prompt = () => { counts.prompt += 1; return null; };
  });
  const page = await context.newPage();
  try {
    await page.goto(server.assignedUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__OPS__) && typeof window.showOpenFilePicker === 'undefined');
    const bridgeGateSetup = await installDevBridgeOpenGate(page);

    if (preflightResult.scenario === MULTI_DOCUMENT_SCENARIO) {
      return {
        ...(await runBrowserMultiDocumentHelp(page, preflightResult, bridgeGateSetup)),
        launchArgs,
        headless: false,
      };
    }

    await openWithVisibleFileChooser(page, preflightResult.xerPath);

    const toast = page.locator('.ops-toast').filter({ hasText: 'XER file opened' }).first();
    await toast.waitFor({ state: 'visible', timeout: 30_000 });
    const domText = await toast.innerText();
    const toastBox = await toast.boundingBox();
    assertPrivacySafeToast(domText, toastBox);
    const toastScreenshot = await toast.screenshot();

    try {
      await page.waitForFunction((messageKey) => {
        const bridge = window.__OPS__;
        const state = bridge?.store.getState();
        const notifications = state?.ui?.notifications?.entries ?? {};
        const notification = Object.values(notifications).find((item) => item.messageKey === messageKey);
        return Boolean(
          state && state.documents?.count === 1 && state.tasks?.importedCount === 8 &&
          state.sequences?.count === 7 && state.cpmResult && state.xerSourceArchive?.present &&
          state.xerSourceProjectId && notification?.helpArticleId === 'gids-xer-import',
        );
      }, XER_OPEN_MESSAGE_KEY, { timeout: 30_000 });
    } catch (error) {
      const observed = await readOpsState(page).catch((readError) => ({ readError: String(readError) }));
      fail(`${error instanceof Error ? error.message : String(error)}; observed=${JSON.stringify(observed)}`);
    }

    const state = await readOpsState(page);
    assertSmallAState(state);

    const bridgeGate = await readDevBridgeOpenGate(page);
    if (bridgeGate.calls.length !== 0) {
      fail(`anti-sluiproute-gate rood: ${JSON.stringify(bridgeGate.calls)}`);
    }
    if (bridgeGate.wrapped.length !== bridgeGateSetup.wrapped.length || bridgeGate.wrapped.length === 0) {
      fail(`anti-sluiproute-gate verloor wrappers: ${JSON.stringify(bridgeGate)}`);
    }

    const dialogCounts = await page.evaluate(() => ({ ...window.__OPS_X11_DIALOG_COUNTS__ }));
    if (dialogCounts.alert !== 0 || dialogCounts.confirm !== 0 || dialogCounts.prompt !== 0) {
      fail(`native-dialog-audit rood: ${JSON.stringify(dialogCounts)}`);
    }

    const screenshot = await page.screenshot({
      fullPage: false,
      mask: [
        page.locator('canvas'),
        page.locator('.title-bar-file-name'),
        page.locator('[role="tab"]'),
      ],
      maskColor: '#263238',
    });
    return {
      state,
      domText,
      dialogCounts,
      bridgeGate,
      screenshot,
      toastScreenshot,
      toastBox,
      launchArgs,
      headless: false,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function stopDevServer(child) {
  if (child.exitCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  await new Promise((resolvePromise) => {
    const timeout = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      resolvePromise();
    }, 5_000);
    child.once('exit', () => { clearTimeout(timeout); resolvePromise(); });
  });
}

async function main() {
  const gitStart = readGitEvidence();
  const preflightResult = await preflight();
  if (!preflightResult) return;
  await assertNoDirectPathOpen();
  const evidenceDir = resolve(EVIDENCE_ROOT, runId());
  const dependencies = await ensureDependencies();
  let serverHandle = null;
  let browserEvidence = null;
  let runError = null;
  const cleanupErrors = [];
  try {
    serverHandle = await startDevServer();
    browserEvidence = await runBrowserSmallA(preflightResult, serverHandle.server);
  } catch (error) {
    runError = error;
  } finally {
    try {
      if (serverHandle) await stopDevServer(serverHandle.child);
    } catch (error) {
      cleanupErrors.push(`serverstop: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      await removeTemporaryDependencies(dependencies.linkPath);
    } catch (error) {
      cleanupErrors.push(`dependencies: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const gitEnd = readGitEvidence();
  assertGitEvidenceUnchanged(gitStart, gitEnd);
  if (cleanupErrors.length > 0) fail(`cleanup rood: ${cleanupErrors.join('; ')}`);
  if (runError) throw runError;
  if (!serverHandle || !browserEvidence) fail('browser- of serverbewijs ontbreekt na de run');

  const metadata = {
    runId: evidenceDir.split('/').pop(),
    scenario: preflightResult.scenario,
    git: {
      toplevel: gitStart.toplevel,
      branch: gitStart.branch,
      head: gitStart.head,
      parent: gitStart.parent,
      statusPorcelainV1: gitStart.statusPorcelainV1,
      statusUnchangedAfterCleanup: true,
    },
    server: {
      url: serverHandle.server.assignedUrl,
      pid: serverHandle.server.pid,
      cwd: serverHandle.server.procCwd,
      httpStatus: 200,
      guard: serverHandle.server.guard,
    },
    browser: { executablePath: preflightResult.chromiumPath, headless: browserEvidence.headless, launchArgs: browserEvidence.launchArgs },
    dom: preflightResult.scenario === MULTI_DOCUMENT_SCENARIO
      ? { tabCount: 12, helpTitle: browserEvidence.state.help.articleHeading }
      : { text: browserEvidence.domText },
    nativeDialogs: browserEvidence.dialogCounts,
    devBridgeOpenGate: browserEvidence.bridgeGate,
    screenshot: 'imported-redacted.png',
    toastScreenshot: { file: 'xer-toast.png', box: browserEvidence.toastBox },
    helpScreenshot: browserEvidence.helpScreenshot ? 'help-redacted.png' : null,
  };
  assertMetadataGitIdentity(metadata, gitStart);
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, 'imported-redacted.png'), browserEvidence.screenshot);
  await writeFile(resolve(evidenceDir, 'xer-toast.png'), browserEvidence.toastScreenshot);
  if (browserEvidence.helpScreenshot) {
    await writeFile(resolve(evidenceDir, 'help-redacted.png'), browserEvidence.helpScreenshot);
  }
  await writeFile(resolve(evidenceDir, 'state.json'), `${JSON.stringify(browserEvidence.state, null, 2)}\n`, 'utf8');
  await writeFile(resolve(evidenceDir, 'server-output.txt'), serverHandle.server.output, 'utf8');
  await writeFile(resolve(evidenceDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  const label = preflightResult.scenario === MULTI_DOCUMENT_SCENARIO ? 'FASE-2A' : 'SMALL-A';
  console.log(`${label} OK: zichtbare importasserties geslaagd; evidence=${evidenceDir}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`X11-harnas rood: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
