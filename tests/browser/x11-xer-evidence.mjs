import { access, lstat, mkdir, readFile, readlink, symlink, unlink, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {
  readOpsState,
  readMultiDocumentOpsState,
  readPhase2BDocumentState,
  assertSmallAState,
  assertMultiDocumentEvidence,
  assertRecoveryEvidence,
  assertLargeResourceEvidence,
  assertPhase2BEvidencePrivacy,
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
const RECOVERY_SCENARIO = 'multidoc-recovery';
const LARGE_RESOURCE_SCENARIO = 'large-resources';
const LARGE_RESOURCE_CORPUS_FILE = 'crawl-xer-extra/jailaff-xer-splitter/rehab-2.xer';
const EVIDENCE_ROOT = '/tmp/xer-x11-evidence';
const PHASE_2A_BASE = '790d6cd8266682fa9b7798a3d1f9e0a1a2498db9';

function runId() {
  return `x11-${randomUUID()}`;
}

function fingerprint(value) {
  return `sha256-${createHash('sha256').update(String(value)).digest('hex')}`;
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
  const base = gitOutput(['rev-parse', `${PHASE_2A_BASE}^{commit}`], 'fase-2A-basis').trim();
  const commitParent = gitOutput(['rev-parse', 'HEAD^'], 'directe HEAD-parent').trim();
  const statusPorcelainV1 = gitOutput(['status', '--porcelain=v1'], 'status');
  if (toplevel !== REPO_ROOT) {
    fail(`git-toplevel-gate rood: ${toplevel}, verwacht exact ${REPO_ROOT}`);
  }
  return { toplevel, branch, head, base, commitParent, statusPorcelainV1 };
}

export function assertGitEvidenceUnchanged(before, after) {
  const fields = ['toplevel', 'branch', 'head', 'base', 'commitParent', 'statusPorcelainV1'];
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
  const sanitizedExpected = metadataGitIdentity(expected);
  if (JSON.stringify(observed) !== JSON.stringify(sanitizedExpected)) {
    fail(`metadata-git-identiteitsgate rood: observed=${JSON.stringify(observed)}; expected=${JSON.stringify(expected)}`);
  }
}

export function metadataGitIdentity(evidence) {
  return {
    worktreeFingerprint: fingerprint(evidence.toplevel),
    branchFingerprint: fingerprint(evidence.branch),
    head: evidence.head,
    base: evidence.base,
    commitParent: evidence.commitParent,
    statusFingerprint: fingerprint(evidence.statusPorcelainV1),
    statusClean: evidence.statusPorcelainV1 === '',
    integrityFieldsMatched: true,
  };
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
  if (!['small-a', MULTI_DOCUMENT_SCENARIO, RECOVERY_SCENARIO, LARGE_RESOURCE_SCENARIO].includes(scenario)) {
    fail(`onbekend OPS_XER_X11_SCENARIO: ${scenario}`);
  }
  const corpusFile = scenario === LARGE_RESOURCE_SCENARIO
    ? LARGE_RESOURCE_CORPUS_FILE
    : [MULTI_DOCUMENT_SCENARIO, RECOVERY_SCENARIO].includes(scenario)
      ? MULTI_DOCUMENT_CORPUS_FILE
      : DEFAULT_CORPUS_FILE;
  const corpusRoot = process.env.OPS_XER_CORPUS?.trim();
  const display = process.env.DISPLAY?.trim();
  const waylandSocket = resolve(process.env.XDG_RUNTIME_DIR?.trim() || '/run/user/1000', process.env.WAYLAND_DISPLAY?.trim() || 'wayland-0');
  const chromiumPath = [
    process.env.OPS_CHROMIUM_PATH?.trim(),
    DEFAULT_CHROMIUM,
    FALLBACK_CHROMIUM,
  ].find((candidate) => candidate && existsSync(candidate));

  if (isExplicitCiMode()) {
    console.error('SKIP: expliciete CI-modus (OPS_XER_X11_CI=1)');
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

function privacySafeServerSummary(server) {
  return {
    processObserved: Number.isInteger(server.pid) && server.pid > 0,
    httpStatus: 200,
    assignedPort: Number(new URL(server.assignedUrl).port),
    cwdMatched: server.procCwd === REPO_ROOT,
    normalGuardedRoute: server.guard.normalRoute === true,
    inheritedGuardEnvRemoved: server.guard.inheritedEnvRemoved === true,
    externallyForcedPort: server.guard.externallyForcedPort === true,
    fixedPortMatched: Number(new URL(server.assignedUrl).port) === server.guard.recordedPort,
    outputDigest: fingerprint(server.output),
  };
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
      const documentOrderEntries = Object.create(null);
      const liveDocuments = Array.isArray(live.documents) ? live.documents : [];
      for (let index = 0; index < liveDocuments.length; index += 1) {
        documentOrderEntries[String(index)] = hashScalar(liveDocuments[index]?.id);
      }
      Object.freeze(documentOrderEntries);
      const sourceResourceCatalog = live.xerSourceArchive?.readModel?.resourceCatalog;
      const sourceMetadataCatalog = live.xerSourceArchive?.readModel?.metadataCatalog;
      const importReport = dataRecord([
        ['projectsSeen', Number.isInteger(rawReport?.projectsSeen) ? rawReport.projectsSeen : null],
        ['documentsOpened', Number.isInteger(rawReport?.documentsOpened) ? rawReport.documentsOpened : null],
        ['emptyProjectsSkipped', Number.isInteger(rawReport?.emptyProjectsSkipped) ? rawReport.emptyProjectsSkipped : null],
        ['baselineProjectsExcluded', Number.isInteger(rawReport?.baselineProjectsExcluded) ? rawReport.baselineProjectsExcluded : null],
        ['baselinesMaterialized', Number.isInteger(rawReport?.baselinesMaterialized) ? rawReport.baselinesMaterialized : null],
        ['danglingBaselineReferences', Number.isInteger(rawReport?.danglingBaselineReferences) ? rawReport.danglingBaselineReferences : null],
      ]);
      return dataRecord([
        ['documents', dataRecord([
          ['count', liveDocuments.length],
          ['order', documentOrderEntries],
          ['activeDocumentHash', hashScalar(live.activeDocumentId)],
        ])],
        ['tasks', dataRecord([['importedCount', importedTaskCount]])],
        ['sequences', dataRecord([['count', Array.isArray(live.sequences) ? live.sequences.length : 0]])],
        ['cpmResult', Boolean(live.cpmResult)],
        ['xerSourceArchive', dataRecord([['present', Boolean(live.xerSourceArchive)]])],
        ['xerSourceProjectId', typeof live.xerSourceProjectId === 'string' ? live.xerSourceProjectId : null],
        ['xerImportReport', importReport],
        ['activeDocument', dataRecord([
          ['documentHash', hashScalar(live.activeDocumentId)],
          ['projectIdentityHash', hashScalar(live.xerSourceProjectId)],
          ['selectorHash', hashScalar(live.xerSourceProjectId)],
          ['selectorPresent', typeof live.xerSourceProjectId === 'string' && live.xerSourceProjectId.length > 0],
          ['taskCount', importedTaskCount],
          ['sequenceCount', Array.isArray(live.sequences) ? live.sequences.length : 0],
          ['assignmentCount', Array.isArray(live.assignments) ? live.assignments.length : 0],
          ['resourceCount', Array.isArray(live.resources) ? live.resources.length : 0],
          ['calendarCount', Array.isArray(live.calendars) ? live.calendars.length : 0],
          ['activityCodeTypeCount', Array.isArray(live.activityCodeTypes) ? live.activityCodeTypes.length : 0],
          ['customFieldDefCount', Array.isArray(live.customFieldDefs) ? live.customFieldDefs.length : 0],
          ['cpmPresent', Boolean(live.cpmResult)],
          ['sourceArchivePresent', Boolean(live.xerSourceArchive)],
          ['archiveDigest', typeof live.xerSourceArchive?.sha256 === 'string' ? live.xerSourceArchive.sha256 : null],
          ['archiveByteLength', Number.isInteger(live.xerSourceArchive?.byteLength) ? live.xerSourceArchive.byteLength : null],
          ['sourceResourceCatalogCount', Array.isArray(sourceResourceCatalog?.resources) ? sourceResourceCatalog.resources.length : 0],
          ['sourceResourceRowCount', Array.isArray(sourceResourceCatalog?.rows?.resources) ? sourceResourceCatalog.rows.resources.length : 0],
          ['sourceMetadataActivityCodeTypeCount', Array.isArray(sourceMetadataCatalog?.activityCodeTypes) ? sourceMetadataCatalog.activityCodeTypes.length : 0],
          ['sourceMetadataCustomFieldDefCount', Array.isArray(sourceMetadataCatalog?.customFieldDefs) ? sourceMetadataCatalog.customFieldDefs.length : 0],
        ])],
        ['ui', dataRecord([
          ['activeRibbonTab', typeof live.ui?.activeRibbonTab === 'string' ? live.ui.activeRibbonTab : null],
          ['backstageSection', typeof live.ui?.backstageSection === 'string' ? live.ui.backstageSection : null],
          ['pendingHelpArticleConsumed', live.ui?.pendingHelpArticleId === null],
          ['showResourcePanel', Boolean(live.ui?.showResourcePanel)],
          ['showHistogram', Boolean(live.ui?.showHistogram)],
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

async function readRecoveryDatabase(page) {
  return page.evaluate(async () => {
    const hashScalar = (value) => {
      if (typeof value !== 'string') return null;
      let hash = 0x811c9dc5;
      for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
      }
      return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
    };
    const sessionId = sessionStorage.getItem('ops-recovery-session');
    if (!sessionId) return null;
    const db = await new Promise((resolvePromise, reject) => {
      const request = indexedDB.open('ops-recovery');
      request.onsuccess = () => resolvePromise(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const records = await new Promise((resolvePromise, reject) => {
        const request = db.transaction('records', 'readonly').objectStore('records').getAll();
        request.onsuccess = () => resolvePromise(request.result);
        request.onerror = () => reject(request.error);
      });
      const ours = records.filter((record) => record.sessionId === sessionId);
      const manifest = ours.find((record) => record.kind === 'manifest');
      if (!manifest) return null;
      const documents = (manifest.documents ?? []).map((document, index) => {
        const record = ours.find((item) => item.kind === 'doc' && item.docId === document.id);
        return {
          ordinal: index + 1,
          documentHash: hashScalar(document.id),
          ifcDigest: record ? hashScalar(record.ifc) : null,
          ifcByteLength: record ? new TextEncoder().encode(record.ifc).byteLength : 0,
          addedAt: record?.addedAt ?? null,
        };
      });
      const fingerprint = hashScalar(JSON.stringify(ours
        .map((record) => ({
          id: hashScalar(record.id), kind: record.kind, addedAt: record.addedAt,
          active: record.kind === 'manifest' ? hashScalar(record.activeDocumentId) : null,
          order: record.kind === 'manifest' ? (record.documents ?? []).map((item) => hashScalar(item.id)) : null,
          ifc: record.kind === 'doc' ? hashScalar(record.ifc) : null,
        }))
        .sort((left, right) => String(left.id).localeCompare(String(right.id)))));
      return {
        sessionHash: hashScalar(sessionId),
        addedAt: manifest.addedAt,
        activeDocumentHash: hashScalar(manifest.activeDocumentId),
        documentOrder: documents.map((document) => document.documentHash),
        documents,
        fingerprint,
      };
    } finally {
      db.close();
    }
  });
}

async function waitForRecoveryDatabase(page, predicate, label, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  let observed = null;
  while (Date.now() < deadline) {
    observed = await readRecoveryDatabase(page);
    if (observed && predicate(observed)) return observed;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  fail(`${label} niet binnen ${timeout}ms waargenomen; observed=${JSON.stringify(observed)}`);
}

async function abortIndexedDbTransaction(page) {
  return page.evaluate(async () => {
    const sessionId = sessionStorage.getItem('ops-recovery-session');
    if (!sessionId) throw new Error('recovery-session ontbreekt voor abortproef');
    const db = await new Promise((resolvePromise, reject) => {
      const request = indexedDB.open('ops-recovery');
      request.onsuccess = () => resolvePromise(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolvePromise, reject) => {
        const tx = db.transaction('records', 'readwrite');
        // Een expliciete abort levert volgens IndexedDB ook een bubbling error-event op de
        // request/transaction. Onderdruk alleen dat verwachte AbortError-pad; onabort is de gate.
        tx.onerror = (event) => { event.preventDefault(); };
        tx.oncomplete = () => reject(new Error('abortproef committeerde onverwacht'));
        tx.onabort = () => resolvePromise(true);
        const request = tx.objectStore('records').put({
          id: `${sessionId}::phase2b-abort-probe`, kind: 'doc', sessionId,
          docId: 'phase2b-abort-probe', ifc: 'NIET-COMMITTEREN', addedAt: Date.now(),
        });
        request.onerror = (event) => { event.preventDefault(); };
        tx.abort();
      });
    } finally {
      db.close();
    }
  });
}

async function collectDocumentSnapshots(page, { proveCpm = false } = {}) {
  const tabs = page.locator('[role="tab"][data-ops-tab-index]');
  const count = await tabs.count();
  const documents = [];
  for (let ordinal = 1; ordinal <= count; ordinal += 1) {
    await tabs.nth(ordinal - 1).click();
    await waitForActiveOrdinal(page, ordinal);
    let snapshot = await readPhase2BDocumentState(page);
    let cpmExecutedViaF5 = false;
    if (proveCpm) {
      await page.keyboard.press('F5');
      await page.waitForFunction(() => window.__OPS__?.store.getState()?.activeDocument?.cpmPresent, null, { timeout: 30_000 });
      snapshot = await readPhase2BDocumentState(page);
      cpmExecutedViaF5 = true;
    }
    documents.push({
      ordinal,
      ...snapshot.activeDocument,
      cpmExecutable: Boolean(snapshot.activeDocument.cpmPresent),
      cpmExecutedViaF5,
    });
  }
  return documents;
}

async function runBrowserRecovery(page, preflightResult, bridgeGateSetup) {
  await openWithVisibleFileChooser(page, preflightResult.xerPath);
  await page.waitForFunction(() => window.__OPS__?.store.getState()?.documents?.count === 12, null, { timeout: 45_000 });
  const tabs = page.locator('[role="tab"][data-ops-tab-index]');
  if (await tabs.count() !== 12) fail(`recovery-import leverde ${await tabs.count()} tabs, verwacht 12`);

  // Een geopende bronimport is terecht schoon en maakt dus nog geen crashsnapshot. Maak via de
  // gewone zichtbare productbediening één echte gebruikerswijziging; vanaf dat moment moet de
  // browser-autosave alle twaalf open documenten veiligstellen.
  const taskCountBeforeTrigger = (await readPhase2BDocumentState(page)).activeDocument.taskCount;
  const homeTab = page.locator('button.ribbon-tab').filter({ hasText: /^Home$/ });
  await homeTab.click();
  const addTaskButton = page.locator('button.ribbon-btn').filter({ hasText: /^Task$/ });
  if (await addTaskButton.count() !== 1) fail('zichtbare Engelse Task-knop voor autosavetrigger ontbreekt of is niet uniek');
  await addTaskButton.click();
  await page.waitForFunction((previous) => window.__OPS__?.store.getState()?.activeDocument?.taskCount === previous + 1, taskCountBeforeTrigger);
  const autosaveTrigger = { route: 'visible:Home>Task', taskDelta: 1 };

  const firstStored = await waitForRecoveryDatabase(
    page,
    (value) => value.documents.length === 12 && value.documents.every((document) => document.ifcByteLength > 0),
    'eerste volledige recoveryset',
  );
  const currentOrdinal = Number(await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-ops-tab-index'));
  const targetOrdinal = currentOrdinal === 2 ? 1 : 2;
  await tabs.nth(targetOrdinal - 1).click();
  await waitForActiveOrdinal(page, targetOrdinal);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
  const beforeDue = await readRecoveryDatabase(page);
  const secondStored = await waitForRecoveryDatabase(
    page,
    (value) => value.addedAt > firstStored.addedAt && value.activeDocumentHash !== firstStored.activeDocumentHash,
    'door throttle uitgestelde manifestupdate',
    20_000,
  );
  const throttle = {
    firstAddedAt: firstStored.addedAt,
    secondAddedAt: secondStored.addedAt,
    intervalMs: secondStored.addedAt - firstStored.addedAt,
    manifestUnchangedBeforeDue: beforeDue?.addedAt === firstStored.addedAt,
  };

  const liveBefore = await readPhase2BDocumentState(page);
  const liveDocuments = await collectDocumentSnapshots(page);
  await tabs.nth(targetOrdinal - 1).click();
  await waitForActiveOrdinal(page, targetOrdinal);
  const activeBeforeReload = await readPhase2BDocumentState(page);
  const manifestForReload = await waitForRecoveryDatabase(
    page,
    (value) => value.activeDocumentHash === activeBeforeReload.activeDocumentHash,
    'manifest met gekozen actief document',
    20_000,
  );
  const initialDocuments = liveDocuments.map((document, index) => ({
    ...document,
    ifcDigest: manifestForReload.documents[index]?.ifcDigest ?? null,
    ifcByteLength: manifestForReload.documents[index]?.ifcByteLength ?? 0,
  }));

  const beforeAbort = await readRecoveryDatabase(page);
  const transactionAborted = await abortIndexedDbTransaction(page);
  const afterAbort = await readRecoveryDatabase(page);
  const abortedTransaction = {
    transactionAborted,
    beforeFingerprint: beforeAbort?.fingerprint ?? null,
    afterFingerprint: afterAbort?.fingerprint ?? null,
  };

  const preReloadDialogs = await page.evaluate(() => ({ ...window.__OPS_X11_DIALOG_COUNTS__ }));
  let beforeUnloadDialogs = 0;
  const handleDialog = async (dialog) => {
    if (dialog.type() === 'beforeunload') { beforeUnloadDialogs += 1; await dialog.accept(); return; }
    await dialog.dismiss();
  };
  page.on('dialog', handleDialog);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForFunction(() => Boolean(window.__OPS__) && typeof window.showOpenFilePicker === 'undefined');
  const restoredBridgeSetup = await installDevBridgeOpenGate(page);
  const recoveryDialog = page.locator('[role="dialog"]').filter({ hasText: 'Restore unsaved work' });
  await recoveryDialog.waitFor({ state: 'visible', timeout: 60_000 });
  const entryCount = await recoveryDialog.locator('li').count();
  const privacyLines = [
    (await recoveryDialog.locator('span').filter({ hasText: /^Restore unsaved work$/ }).innerText()).trim(),
    (await recoveryDialog.locator('button').filter({ hasText: /^Don't restore$/ }).innerText()).trim(),
    (await recoveryDialog.locator('button').filter({ hasText: /^Restore$/ }).innerText()).trim(),
  ];
  const recoveryScreenshot = await page.screenshot({
    fullPage: false,
    mask: [page.locator('canvas'), page.locator('.title-bar-file-name'), page.locator('[role="tab"]'), recoveryDialog.locator('li')],
    maskColor: '#263238',
  });
  await recoveryDialog.locator('button').filter({ hasText: /^Restore$/ }).click();
  await page.waitForFunction(() => window.__OPS__?.store.getState()?.documents?.count === 12, null, { timeout: 60_000 });
  await page.locator('[role="tab"][data-ops-tab-index]').first().waitFor({ state: 'visible' });
  const restoredDocuments = await collectDocumentSnapshots(page, { proveCpm: true });
  await page.locator(`[role="tab"][data-ops-tab-index="${targetOrdinal}"]`).click();
  await waitForActiveOrdinal(page, targetOrdinal);
  const restoredState = await readPhase2BDocumentState(page);
  const evidence = {
    initial: {
      documentCount: liveBefore.documentCount,
      manifestDocumentCount: manifestForReload.documents.length,
      activeDocumentHash: activeBeforeReload.activeDocumentHash,
      manifestActiveDocumentHash: manifestForReload.activeDocumentHash,
      documentOrder: activeBeforeReload.documentOrder,
      manifestOrder: manifestForReload.documentOrder,
      documents: initialDocuments,
    },
    throttle,
    autosaveTrigger,
    abortedTransaction,
    recoveryUi: { visible: true, entryCount, restoredViaVisibleButton: true, beforeUnloadDialogs },
    runtime: { nativeDialogs: null },
    restored: {
      documentCount: restoredState.documentCount,
      activeDocumentHash: restoredState.activeDocumentHash,
      documentOrder: restoredState.documentOrder,
      documents: restoredDocuments,
    },
    privacy: { visibleLines: privacyLines },
  };
  const bridgeGate = await readDevBridgeOpenGate(page);
  if (bridgeGate.calls.length !== 0 || restoredBridgeSetup.wrapped.length === 0 || bridgeGateSetup.wrapped.length === 0) {
    fail(`recovery anti-sluiproute-gate rood: ${JSON.stringify(bridgeGate)}`);
  }
  const postReloadDialogs = await page.evaluate(() => ({ ...window.__OPS_X11_DIALOG_COUNTS__ }));
  const dialogCounts = Object.fromEntries(Object.keys(postReloadDialogs).map((key) => [key, preReloadDialogs[key] + postReloadDialogs[key]]));
  evidence.runtime.nativeDialogs = dialogCounts;
  assertRecoveryEvidence(evidence);
  if (Object.values(dialogCounts).some((count) => count !== 0)) fail(`recovery native-dialog-audit rood: ${JSON.stringify(dialogCounts)}`);
  const screenshot = await page.screenshot({
    fullPage: false,
    mask: [page.locator('canvas'), page.locator('.title-bar-file-name'), page.locator('[role="tab"]')],
    maskColor: '#263238',
  });
  page.off('dialog', handleDialog);
  return { state: evidence, dialogCounts, bridgeGate, screenshot, recoveryScreenshot, toastScreenshot: null, toastBox: null };
}

async function readPrimaryGanttRenderEvidence(page) {
  return page.evaluate(() => {
    const anchor = document.querySelector('[data-testid="gantt-vscroll"]');
    const root = anchor?.parentElement ?? null;
    const primaryContainer = root?.firstElementChild ?? null;
    const primaryCanvas = primaryContainer?.querySelector(':scope > canvas') ?? null;
    const primaryScroll = primaryContainer?.querySelector(':scope > [data-testid="gantt-hscroll"]') ?? null;
    const primaryCanvasBound = Boolean(
      root && primaryContainer && primaryCanvas instanceof HTMLCanvasElement && primaryScroll &&
      anchor?.parentElement === root && primaryContainer.parentElement === root,
    );
    if (!(primaryCanvas instanceof HTMLCanvasElement)) {
      return {
        rootAnchor: anchor ? 'gantt-vscroll' : null,
        primaryCanvasBound,
        width: 0,
        height: 0,
        sampleCount: 0,
        nonTransparentSamples: 0,
        uniqueColorBuckets: 0,
        luminanceRange: 0,
        transitionCount: 0,
      };
    }
    const rect = primaryCanvas.getBoundingClientRect();
    const sampleWidth = 64;
    const sampleHeight = 64;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sampleContext) throw new Error('Gantt-samplecontext ontbreekt');
    sampleContext.drawImage(primaryCanvas, 0, 0, sampleWidth, sampleHeight);
    const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const buckets = new Set();
    let nonTransparentSamples = 0;
    let minLuminance = 255;
    let maxLuminance = 0;
    let transitionCount = 0;
    let previousBucket = null;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const alpha = pixels[index + 3];
      if (alpha > 0) nonTransparentSamples += 1;
      const bucket = `${red >> 4}:${green >> 4}:${blue >> 4}:${alpha >> 4}`;
      buckets.add(bucket);
      if (previousBucket !== null && previousBucket !== bucket) transitionCount += 1;
      previousBucket = bucket;
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      minLuminance = Math.min(minLuminance, luminance);
      maxLuminance = Math.max(maxLuminance, luminance);
    }
    return {
      rootAnchor: anchor ? 'gantt-vscroll' : null,
      primaryCanvasBound,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      sampleCount: sampleWidth * sampleHeight,
      nonTransparentSamples,
      uniqueColorBuckets: buckets.size,
      luminanceRange: Number((maxLuminance - minLuminance).toFixed(3)),
      transitionCount,
    };
  });
}

async function runBrowserLargeResources(page, preflightResult, bridgeGateSetup) {
  const pageErrors = [];
  let crashed = false;
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('crash', () => { crashed = true; });
  const importStarted = performance.now();
  await openWithVisibleFileChooser(page, preflightResult.xerPath);
  await page.waitForFunction(() => {
    const state = window.__OPS__?.store.getState();
    return state?.documents?.count > 0 && state?.activeDocument?.taskCount > 0 && state?.activeDocument?.sourceArchivePresent;
  }, null, { timeout: 180_000 });
  const importMs = performance.now() - importStarted;
  const tabs = page.locator('[role="tab"][data-ops-tab-index]');
  const tabCount = await tabs.count();
  let richOrdinal = 1;
  let richSnapshot = null;
  for (let ordinal = 1; ordinal <= tabCount; ordinal += 1) {
    await tabs.nth(ordinal - 1).click();
    await waitForActiveOrdinal(page, ordinal);
    const candidate = await readPhase2BDocumentState(page);
    if (!richSnapshot || candidate.activeDocument.assignmentCount > richSnapshot.activeDocument.assignmentCount) {
      richSnapshot = candidate;
      richOrdinal = ordinal;
    }
  }
  if (!richSnapshot) fail('grootbestand leverde geen documentprojectie');
  let tabActivationMs = 0;
  if (tabCount > 1) {
    const otherOrdinal = richOrdinal === 1 ? 2 : 1;
    await tabs.nth(otherOrdinal - 1).click();
    await waitForActiveOrdinal(page, otherOrdinal);
    const switchStarted = performance.now();
    await tabs.nth(richOrdinal - 1).click();
    await waitForActiveOrdinal(page, richOrdinal);
    tabActivationMs = performance.now() - switchStarted;
  } else {
    const switchStarted = performance.now();
    await tabs.first().click();
    await waitForActiveOrdinal(page, 1);
    tabActivationMs = performance.now() - switchStarted;
  }
  richSnapshot = await readPhase2BDocumentState(page);
  const ganttStarted = performance.now();
  await page.locator('[data-testid="gantt-vscroll"]').waitFor({ state: 'visible', timeout: 60_000 });
  await page.evaluate(() => new Promise((resolvePromise) => requestAnimationFrame(() => requestAnimationFrame(resolvePromise))));
  const gantt = await readPrimaryGanttRenderEvidence(page);
  const firstGanttMs = performance.now() - ganttStarted;

  const resourcesTab = page.locator('button.ribbon-tab').filter({ hasText: /^Resources$/ });
  await resourcesTab.click();
  const resourcesStarted = performance.now();
  const resourcesButton = page.locator('button.ribbon-btn').filter({ hasText: /^Resources$/ });
  await resourcesButton.click();
  await page.waitForFunction(() => window.__OPS__?.store.getState()?.ui?.showResourcePanel === true);
  const resourcePanelTitle = page.locator('.ui-card-header').filter({ hasText: /^Resources$/ });
  await resourcePanelTitle.waitFor({ state: 'visible', timeout: 30_000 });
  const resourcePanelLabel = (await resourcePanelTitle.innerText()).trim();
  const resourcesPanelMs = performance.now() - resourcesStarted;
  const resourcesPanelVisible = (await readPhase2BDocumentState(page)).ui.showResourcePanel;
  const closeResourcePanel = resourcePanelTitle.locator('xpath=..').locator('button[title="Close"]');
  if (await closeResourcePanel.count() !== 1) fail('zichtbare sluitknop van Resources-paneel ontbreekt of is niet uniek');
  await closeResourcePanel.click();
  await page.waitForFunction(() => window.__OPS__?.store.getState()?.ui?.showResourcePanel === false);

  await resourcesTab.click();
  const histogramStarted = performance.now();
  const histogramButton = page.locator('button.ribbon-btn').filter({ hasText: /^Histogram$/ });
  await histogramButton.click();
  await page.locator('[data-tour-anchor="histogram-strip"]').waitFor({ state: 'visible', timeout: 30_000 });
  const histogramMs = performance.now() - histogramStarted;
  const finalState = await readPhase2BDocumentState(page);
  const active = finalState.activeDocument;
  const dialogCounts = await page.evaluate(() => ({ ...window.__OPS_X11_DIALOG_COUNTS__ }));
  const evidence = {
    counts: { tasks: active.taskCount, assignments: active.assignmentCount, calendars: active.calendarCount },
    sourceArchivePresent: active.sourceArchivePresent,
    sourceArchiveDigest: active.archiveDigest,
    selectorPresent: active.selectorPresent,
    cpmPresent: active.cpmPresent,
    catalogs: {
      resources: active.sourceResourceCatalogCount,
      sourceRows: active.sourceResourceRowCount,
      activityCodeCatalogs: active.sourceMetadataActivityCodeTypeCount,
      udfDefs: active.sourceMetadataCustomFieldDefCount,
    },
    gantt,
    routes: {
      firstGanttRendered: true,
      resourcesPanelVisible,
      histogramVisible: finalState.ui.showHistogram,
      richDocumentOrdinal: richOrdinal,
      documentCount: tabCount,
    },
    latencies: { importMs, firstGanttMs, tabActivationMs, resourcesPanelMs, histogramMs },
    runtime: { crashed, pageErrors: pageErrors.length, nativeDialogs: dialogCounts },
    privacy: { visibleLines: [resourcePanelLabel, (await histogramButton.innerText()).trim()] },
  };
  assertLargeResourceEvidence(evidence);
  const bridgeGate = await readDevBridgeOpenGate(page);
  if (bridgeGate.calls.length !== 0 || bridgeGate.wrapped.length !== bridgeGateSetup.wrapped.length) {
    fail(`grootbestand anti-sluiproute-gate rood: ${JSON.stringify(bridgeGate)}`);
  }
  const screenshot = await page.screenshot({
    fullPage: false,
    mask: [
      page.locator('canvas'), page.locator('.title-bar-file-name'), page.locator('[role="tab"]'),
      page.locator('tbody'), page.locator('.ops-toast'),
    ],
    maskColor: '#263238',
  });
  return { state: evidence, dialogCounts, bridgeGate, screenshot, toastScreenshot: null, toastBox: null };
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

    if (preflightResult.scenario === RECOVERY_SCENARIO) {
      return {
        ...(await runBrowserRecovery(page, preflightResult, bridgeGateSetup)),
        launchArgs,
        headless: false,
      };
    }
    if (preflightResult.scenario === LARGE_RESOURCE_SCENARIO) {
      return {
        ...(await runBrowserLargeResources(page, preflightResult, bridgeGateSetup)),
        launchArgs,
        headless: false,
      };
    }
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
  const evidenceId = runId();
  const evidenceDir = resolve(EVIDENCE_ROOT, evidenceId);
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

  const serverSummary = privacySafeServerSummary(serverHandle.server);
  const metadata = {
    runId: evidenceId,
    scenario: preflightResult.scenario,
    git: metadataGitIdentity(gitStart),
    server: serverSummary,
    browser: {
      headless: browserEvidence.headless,
      visible: browserEvidence.headless === false,
      executableVerified: true,
      wayland: browserEvidence.launchArgs.includes('--ozone-platform=wayland'),
    },
    dom: preflightResult.scenario === MULTI_DOCUMENT_SCENARIO
      ? { tabCount: 12, helpTitle: browserEvidence.state.help.articleHeading }
      : preflightResult.scenario === RECOVERY_SCENARIO
        ? { tabCount: browserEvidence.state.restored.documentCount, recoveryUi: true }
        : preflightResult.scenario === LARGE_RESOURCE_SCENARIO
          ? { tabCount: browserEvidence.state.routes.documentCount, resourcesPanel: true, histogram: true }
          : { text: browserEvidence.domText },
    nativeDialogs: browserEvidence.dialogCounts,
    devBridgeOpenGate: browserEvidence.bridgeGate,
    artifacts: {
      redactedUiScreenshot: true,
      redactedToastScreenshot: Boolean(browserEvidence.toastScreenshot),
      redactedHelpScreenshot: Boolean(browserEvidence.helpScreenshot),
      redactedRecoveryScreenshot: Boolean(browserEvidence.recoveryScreenshot),
      stateProjection: true,
      serverSummary: true,
    },
    cleanup: { serverStopped: true, temporaryDependencyLinkRemoved: true, gitIdentityUnchanged: true },
  };
  assertMetadataGitIdentity(metadata, gitStart);
  const phase2BScenario = [RECOVERY_SCENARIO, LARGE_RESOURCE_SCENARIO].includes(preflightResult.scenario);
  if (phase2BScenario) {
    const privacyAudit = assertPhase2BEvidencePrivacy({
      evidenceId,
      stdout: evidenceId,
      metadata,
      serverSummary,
      stateArtifact: browserEvidence.state,
    });
    metadata.privacyAudit = privacyAudit;
    assertPhase2BEvidencePrivacy({
      evidenceId,
      stdout: evidenceId,
      metadata,
      serverSummary,
      stateArtifact: browserEvidence.state,
    });
  }
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, 'imported-redacted.png'), browserEvidence.screenshot);
  if (browserEvidence.toastScreenshot) {
    await writeFile(resolve(evidenceDir, 'xer-toast.png'), browserEvidence.toastScreenshot);
  }
  if (browserEvidence.helpScreenshot) {
    await writeFile(resolve(evidenceDir, 'help-redacted.png'), browserEvidence.helpScreenshot);
  }
  if (browserEvidence.recoveryScreenshot) {
    await writeFile(resolve(evidenceDir, 'recovery-redacted.png'), browserEvidence.recoveryScreenshot);
  }
  await writeFile(resolve(evidenceDir, 'state.json'), `${JSON.stringify(browserEvidence.state, null, 2)}\n`, 'utf8');
  await writeFile(resolve(evidenceDir, 'server-summary.json'), `${JSON.stringify(serverSummary, null, 2)}\n`, 'utf8');
  if (metadata.privacyAudit) {
    await writeFile(resolve(evidenceDir, 'privacy-audit.json'), `${JSON.stringify(metadata.privacyAudit, null, 2)}\n`, 'utf8');
  }
  await writeFile(resolve(evidenceDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  console.log(evidenceId);
}

async function runWithCapturedStdout() {
  if (process.env.OPS_XER_X11_CAPTURED_CHILD === '1' || isExplicitCiMode()) {
    await main();
    return;
  }
  const scriptPath = fileURLToPath(import.meta.url);
  const child = spawn(process.execPath, [scriptPath], {
    cwd: REPO_ROOT,
    env: { ...process.env, OPS_XER_X11_CAPTURED_CHILD: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let capturedStdout = '';
  child.stdout.on('data', (chunk) => { capturedStdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { process.stderr.write(chunk); });
  const exitCode = await new Promise((resolvePromise) => child.once('exit', (code) => resolvePromise(code ?? 1)));
  if (exitCode !== 0) fail(`gecapteerde X11-childrun eindigde met exitcode ${exitCode}`);
  const stdout = capturedStdout.trim();
  if (!/^x11-[0-9a-f-]{36}$/i.test(stdout) || capturedStdout !== `${stdout}\n`) {
    fail('stdout-privacygate rood: childstdout is niet exact één opaque evidence-id-regel');
  }

  const evidenceDir = resolve(EVIDENCE_ROOT, stdout);
  const metadataPath = resolve(evidenceDir, 'metadata.json');
  const privacyPath = resolve(evidenceDir, 'privacy-audit.json');
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  if ([RECOVERY_SCENARIO, LARGE_RESOURCE_SCENARIO].includes(metadata.scenario)) {
    const serverSummary = JSON.parse(await readFile(resolve(evidenceDir, 'server-summary.json'), 'utf8'));
    const stateArtifact = JSON.parse(await readFile(resolve(evidenceDir, 'state.json'), 'utf8'));
    const privacyAudit = {
      ...assertPhase2BEvidencePrivacy({
        evidenceId: stdout,
        stdout,
        metadata,
        serverSummary,
        stateArtifact,
      }),
      capturedStdout: true,
    };
    metadata.privacyAudit = privacyAudit;
    assertPhase2BEvidencePrivacy({ evidenceId: stdout, stdout, metadata, serverSummary, stateArtifact });
    await writeFile(privacyPath, `${JSON.stringify(privacyAudit, null, 2)}\n`, 'utf8');
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${stdout}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runWithCapturedStdout().catch((error) => {
    console.error(`X11-harnas rood: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
