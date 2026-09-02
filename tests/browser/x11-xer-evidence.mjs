import { access, lstat, mkdir, readFile, readlink, symlink, unlink, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { spawn } from 'node:child_process';
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
  let output = `[harness] SERVER_PID=${child.pid}\n`;
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

  return { assignedUrl, pid: child.pid, procCwd, output };
}

async function startDevServer() {
  const npmCommand = process.env.OPS_NPM_PATH?.trim() || 'npm';
  const child = spawn(npmCommand, ['run', 'dev'], {
    cwd: REPO_ROOT,
    detached: true,
    env: process.env,
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

    const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^Open$/ });
    if (await openButton.count() !== 1) fail(`zichtbare Engelse Open-knop niet uniek: ${await openButton.count()}`);
    const fileChooserPromise = page.waitForEvent('filechooser');
    await openButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(preflightResult.xerPath);

    try {
      await page.waitForFunction((messageKey) => {
        const bridge = window.__OPS__;
        const state = bridge?.store.getState();
        const notification = state?.ui.notifications.find((item) => item.messageKey === messageKey);
        const importedTasks = state?.tasks?.filter((task) =>
          task.isSummary !== true && (task.childIds?.length ?? 0) === 0,
        );
        return Boolean(
          state && state.documents?.length === 1 && importedTasks?.length === 8 &&
          state.sequences?.length === 7 && state.cpmResult && state.xerSourceArchive &&
          state.xerSourceProjectId && notification?.helpArticleId === 'gids-xer-import',
        );
      }, XER_OPEN_MESSAGE_KEY, { timeout: 30_000 });
    } catch (error) {
      const observed = await readOpsState(page).catch((readError) => ({ readError: String(readError) }));
      fail(`${error instanceof Error ? error.message : String(error)}; observed=${JSON.stringify(observed)}`);
    }

    const toast = page.locator('.ops-toast').filter({ hasText: 'XER file opened' });
    await toast.first().waitFor({ state: 'visible', timeout: 5_000 });
    const domText = await toast.first().innerText();
    const state = await readOpsState(page);
    assertSmallAState(state);

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
    return { state, domText, dialogCounts, screenshotPath, launchArgs, headless: false };
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
  const preflightResult = await preflight();
  if (!preflightResult) return;
  await assertNoDirectPathOpen();
  const evidenceDir = resolve(EVIDENCE_ROOT, runId());
  await mkdir(evidenceDir, { recursive: true });
  const dependencies = await ensureDependencies();
  let serverHandle = null;
  try {
    serverHandle = await startDevServer();
    const browserEvidence = await runBrowserSmallA(preflightResult, serverHandle.server, evidenceDir);
    await writeFile(resolve(evidenceDir, 'state.json'), `${JSON.stringify(browserEvidence.state, null, 2)}\n`, 'utf8');
    await writeFile(resolve(evidenceDir, 'server-output.txt'), serverHandle.server.output, 'utf8');
    await writeFile(resolve(evidenceDir, 'metadata.json'), `${JSON.stringify({
      runId: evidenceDir.split('/').pop(),
      repository: REPO_ROOT,
      branch: 'codex/xer-x11-harness',
      server: { url: serverHandle.server.assignedUrl, pid: serverHandle.server.pid, cwd: serverHandle.server.procCwd, httpStatus: 200 },
      browser: { executablePath: preflightResult.chromiumPath, headless: browserEvidence.headless, launchArgs: browserEvidence.launchArgs },
      dom: { text: browserEvidence.domText },
      nativeDialogs: browserEvidence.dialogCounts,
      screenshot: 'imported-redacted.png',
    }, null, 2)}\n`, 'utf8');
    console.log(`SMALL-A OK: zichtbare importasserties geslaagd; evidence=${evidenceDir}`);
  } finally {
    if (serverHandle) await stopDevServer(serverHandle.child);
    await removeTemporaryDependencies(dependencies.linkPath);
  }
}

main().catch((error) => {
  console.error(`X11-harnas rood: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
