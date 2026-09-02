import { access, lstat, mkdir, readFile, readlink, symlink, unlink, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readOpsState, assertSmallAState, XER_OPEN_MESSAGE_KEY } from './helpers/ops-state.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const DEFAULT_CHROMIUM = '/home/nozzit/.cache/ms-playwright/chromium-1237/chrome-linux64/chrome';
const FALLBACK_CHROMIUM = '/usr/bin/google-chrome';
const DEFAULT_CORPUS_FILE = 'crawl-xer/p6diff-baseline.xer';
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
  const statusPorcelainV1 = gitOutput(['status', '--porcelain=v1'], 'status');
  if (toplevel !== REPO_ROOT) {
    fail(`git-toplevel-gate rood: ${toplevel}, verwacht exact ${REPO_ROOT}`);
  }
  return { toplevel, branch, head, statusPorcelainV1 };
}

function assertGitStatusUnchanged(before, after) {
  if (before.statusPorcelainV1 !== after.statusPorcelainV1) {
    fail(
      `git-status-integriteitsgate rood: begin=${JSON.stringify(before.statusPorcelainV1)}; ` +
      `eind=${JSON.stringify(after.statusPorcelainV1)}`,
    );
  }
}

function assertMetadataGitIdentity(metadata, expected) {
  const observed = metadata.git;
  if (observed?.toplevel !== expected.toplevel || observed?.branch !== expected.branch ||
      observed?.head !== expected.head || observed?.statusPorcelainV1 !== expected.statusPorcelainV1) {
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
  await readableFile(resolve(corpusRoot, DEFAULT_CORPUS_FILE), 'XER-corpusbestand');
  if (!chromiumPath) fail('geen bruikbaar Chromium-executable gevonden');
  if (!display && !existsSync(waylandSocket)) {
    fail('geen bruikbaar desktopdisplay: DISPLAY is leeg en Wayland-socket ontbreekt');
  }

  return {
    corpusRoot: resolve(corpusRoot),
    xerPath: resolve(corpusRoot, DEFAULT_CORPUS_FILE),
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
  ];
  if (forbidden.some((token) => source.includes(token))) {
    fail('statische guard: direct pad-openen is verboden in het X11-harnas');
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
    const makeSnapshot = () => {
      const live = liveGetState();
      const notificationEntries = Object.create(null);
      const liveNotifications = Array.isArray(live.ui?.notifications) ? live.ui.notifications : [];
      for (let index = 0; index < liveNotifications.length; index += 1) {
        const item = liveNotifications[index];
        notificationEntries[String(index)] = dataRecord([
          ['severity', typeof item.severity === 'string' ? item.severity : null],
          ['messageKey', typeof item.messageKey === 'string' ? item.messageKey : null],
          ['helpArticleId', typeof item.helpArticleId === 'string' ? item.helpArticleId : null],
        ]);
      }
      Object.freeze(notificationEntries);
      const importedTaskCount = Array.isArray(live.tasks)
        ? live.tasks.filter((task) => task.isSummary !== true && (task.childIds?.length ?? 0) === 0).length
        : 0;
      return dataRecord([
        ['documents', dataRecord([['count', Array.isArray(live.documents) ? live.documents.length : 0]])],
        ['tasks', dataRecord([['importedCount', importedTaskCount]])],
        ['sequences', dataRecord([['count', Array.isArray(live.sequences) ? live.sequences.length : 0]])],
        ['cpmResult', Boolean(live.cpmResult)],
        ['xerSourceArchive', dataRecord([['present', Boolean(live.xerSourceArchive)]])],
        ['xerSourceProjectId', typeof live.xerSourceProjectId === 'string' ? live.xerSourceProjectId : null],
        ['ui', dataRecord([
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

async function runBrowserSmallA(preflightResult, server, evidenceDir) {
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

    const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^Open$/ });
    if (await openButton.count() !== 1) fail(`zichtbare Engelse Open-knop niet uniek: ${await openButton.count()}`);
    const fileChooserPromise = page.waitForEvent('filechooser');
    await openButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(preflightResult.xerPath);

    const toast = page.locator('.ops-toast').filter({ hasText: 'XER file opened' }).first();
    await toast.waitFor({ state: 'visible', timeout: 30_000 });
    const domText = await toast.innerText();
    const toastBox = await toast.boundingBox();
    assertPrivacySafeToast(domText, toastBox);
    const toastScreenshotPath = resolve(evidenceDir, 'xer-toast.png');
    await toast.screenshot({ path: toastScreenshotPath });

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

    const screenshotPath = resolve(evidenceDir, 'imported-redacted.png');
    await page.screenshot({
      path: screenshotPath,
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
      screenshotPath,
      toastScreenshotPath,
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
  await mkdir(evidenceDir, { recursive: true });
  const dependencies = await ensureDependencies();
  let serverHandle = null;
  let browserEvidence = null;
  let runError = null;
  const cleanupErrors = [];
  try {
    serverHandle = await startDevServer();
    browserEvidence = await runBrowserSmallA(preflightResult, serverHandle.server, evidenceDir);
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
  assertGitStatusUnchanged(gitStart, gitEnd);
  if (cleanupErrors.length > 0) fail(`cleanup rood: ${cleanupErrors.join('; ')}`);
  if (runError) throw runError;
  if (!serverHandle || !browserEvidence) fail('browser- of serverbewijs ontbreekt na de run');

  const metadata = {
    runId: evidenceDir.split('/').pop(),
    git: {
      toplevel: gitStart.toplevel,
      branch: gitStart.branch,
      head: gitStart.head,
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
    dom: { text: browserEvidence.domText },
    nativeDialogs: browserEvidence.dialogCounts,
    devBridgeOpenGate: browserEvidence.bridgeGate,
    screenshot: 'imported-redacted.png',
    toastScreenshot: { file: 'xer-toast.png', box: browserEvidence.toastBox },
  };
  assertMetadataGitIdentity(metadata, gitStart);
  await writeFile(resolve(evidenceDir, 'state.json'), `${JSON.stringify(browserEvidence.state, null, 2)}\n`, 'utf8');
  await writeFile(resolve(evidenceDir, 'server-output.txt'), serverHandle.server.output, 'utf8');
  await writeFile(resolve(evidenceDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  console.log(`SMALL-A OK: zichtbare importasserties geslaagd; evidence=${evidenceDir}`);
}

main().catch((error) => {
  console.error(`X11-harnas rood: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
