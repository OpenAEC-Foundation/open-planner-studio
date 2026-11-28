import { expect, test, type Frame, type Page, type Request } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, createReadStream } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = process.cwd();
const BASE = '/tools/planner/';
const OUT_DIR = join(ROOT, 'dist-platform');
const CATALOG_MARKER = 'open-planner-studio-extensions';
const APP_VERSION = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.ifc': 'text/plain; charset=utf-8',
};

let server: Server | undefined;
let origin = '';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

const WORKPLACE_PATH = '/werkplek.html';
const WORKPLACE_HTML = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><title>Werkplek (test)</title></head>
<body style="margin:0">
<iframe id="tool" title="Open Planner Studio" sandbox="allow-scripts allow-modals" src="${BASE}index.html"
  style="border:0;width:100vw;height:100vh;display:block"></iframe>
</body></html>
`;
const WORKPLACE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
].join('; ');

function startStaticServer(): Promise<Server> {
  const root = resolve(OUT_DIR);
  const srv = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === WORKPLACE_PATH) {
      res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(WORKPLACE_HTML);
      return;
    }
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(404).end();
      return;
    }
    let rel = decodeURIComponent(url.pathname.slice(BASE.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(root, rel));
    if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }).end();
      return;
    }
    const headers: Record<string, string> = {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    };
    const dest = req.headers['sec-fetch-dest'];
    if (dest === 'iframe' || dest === 'worker' || dest === 'sharedworker') headers['Content-Security-Policy'] = WORKPLACE_CSP;
    res.writeHead(200, headers);
    createReadStream(file).pipe(res);
  });
  return new Promise((resolveServer) => srv.listen(0, '127.0.0.1', () => resolveServer(srv)));
}

async function openApp(page: Page): Promise<{ sameOriginOutsideBase: string[]; catalogRequests: string[]; pageErrors: string[] }> {
  const sameOriginOutsideBase: string[] = [];
  const catalogRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', (req: Request) => {
    const url = new URL(req.url());
    if (url.origin === origin && !url.pathname.startsWith(BASE)) sameOriginOutsideBase.push(url.pathname);
    if (req.url().includes(CATALOG_MARKER)) catalogRequests.push(req.url());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.addInitScript((version) => {
    localStorage.setItem('ops-welcomeSeen', 'true');
    localStorage.setItem('ops-lastVersion', version);
    localStorage.setItem('ops-aiMode', 'true');
  }, APP_VERSION);
  await page.goto(`${origin}${BASE}`);
  await expect(page.locator('.title-bar')).toBeVisible({ timeout: 15_000 });
  return { sameOriginOutsideBase, catalogRequests, pageErrors };
}

async function openBackstage(page: Page): Promise<void> {
  await page.locator('.ribbon-tab--file').click();
  await expect(page.locator('.backstage')).toBeVisible();
}

const taskRows = (page: Page) => page.locator('[data-grid-data-row="true"]:not([data-grid-ghost="true"])');

const navItem = (page: Page, label: string) =>
  page.locator('.backstage-sidebar .backstage-nav-item', { hasText: new RegExp(`^${label}$`) });

async function walkTourFromSettings(root: Page | Frame): Promise<void> {
  await root.locator('.backstage-main').getByRole('button', { name: 'Start tour' }).click();
  const card = root.locator('[data-ops-tour-card]');
  const titles = ['Ribbon tabs', 'Task table and Gantt chart', 'Properties panel', 'Histogram', 'Reports', 'Example projects'];
  for (const [i, title] of titles.entries()) {
    await expect(card.locator('span.font-semibold')).toHaveText(title);
    const last = i === titles.length - 1;
    await card.getByRole('button', { name: last ? 'Close' : 'Next', exact: true }).click();
  }
  await expect(card).toHaveCount(0);
  await expect(root.getByText('Your feedback matters')).toHaveCount(0);
  await root.locator('[data-ops-ribbon-tab="planning"]').click();
  await expect(root.locator('[data-ops-ribbon-tab="planning"]')).toHaveClass(/active/);
}

test.describe.configure({ mode: 'serial' });
test.use({ locale: 'en-US' });

test.beforeAll(async () => {
  test.setTimeout(600_000);
  const build = spawnSync(process.execPath, ['scripts/build-platform.mjs', '--base', BASE], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (build.status !== 0) {
    throw new Error(`build:platform faalde (exit ${build.status}):\n${build.stdout}\n${build.stderr}`);
  }
  server = await startStaticServer();
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
});

test('de bundel: manifest, basispad in index.html, geen catalogus-URL', () => {
  const manifestPath = join(OUT_DIR, '.vite', 'manifest.json');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, { file: string; isEntry?: boolean }>;
  const entry = manifest['index.html'];
  expect(entry?.isEntry).toBe(true);
  expect(existsSync(join(OUT_DIR, entry.file))).toBe(true);

  const html = readFileSync(join(OUT_DIR, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  expect(refs.length).toBeGreaterThan(0);
  for (const ref of refs) expect(ref, `pad in index.html: ${ref}`).toMatch(/^\/tools\/planner\//);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)];
  for (const [, attrs, body] of scripts) {
    expect(attrs, 'elk script heeft een src').toMatch(/\ssrc="/);
    expect(body.trim(), 'geen inline code').toBe('');
  }
  expect(html).toMatch(new RegExp(`<script src="${BASE}theme-prepaint\\.js"></script>`));
  expect(existsSync(join(OUT_DIR, 'theme-prepaint.js'))).toBe(true);

  const jsFiles = listFiles(OUT_DIR).filter((f) => f.endsWith('.js'));
  expect(jsFiles.length).toBeGreaterThan(0);
  const withCatalog = jsFiles.filter((f) => readFileSync(f, 'utf8').includes(CATALOG_MARKER));
  expect(withCatalog, 'JS-bestanden met de catalogus-URL').toEqual([]);

  const tools = JSON.parse(readFileSync(join(OUT_DIR, 'mcp-tools.json'), 'utf8')) as { name: string }[];
  const names = tools.map((tool) => tool.name);
  expect(names).toContain('planner_add_tasks');
  expect(names).not.toContain('planner_export_ifc');
  expect(names).not.toContain('planner_import_schedule');
});

test('de app op het subpad: icoon, leeg document, geen MCP-tabblad, geen token', async ({ page }) => {
  const seen = await openApp(page);

  const icon = page.locator('img.title-bar-app-icon');
  await expect(icon).toHaveAttribute('src', `${BASE}icon.png`);
  await expect.poll(() => icon.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_000);
  const exampleRequests = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/examples/')));
  expect(exampleRequests).toEqual([]);
  await expect(page.locator('[data-grid-data-row="true"]').first()).toBeVisible();
  await expect(taskRows(page)).toHaveCount(0);

  await expect(page.locator('.ribbon-tab', { hasText: /^MCP$/ })).toHaveCount(0);
  await expect(page.locator('[data-ops-ribbon-tab="ai"]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('ops-mcpToken'))).toBeNull();

  expect(seen.sameOriginOutsideBase, 'verzoeken buiten het basispad').toEqual([]);
  expect(seen.catalogRequests).toEqual([]);
  expect(seen.pageErrors).toEqual([]);
});

test('Backstage: geen Extensies, geen extensie-importers, geen MCP-instellingen', async ({ page }) => {
  const seen = await openApp(page);
  await openBackstage(page);

  await expect(navItem(page, 'App settings')).toHaveCount(1);
  await expect(navItem(page, 'Help')).toHaveCount(1);
  await expect(navItem(page, 'Extensions')).toHaveCount(0);

  await navItem(page, 'Import').click();
  await expect(page.locator('[data-ops-progress-import-card]')).toBeVisible();
  await expect(page.locator('.backstage-main')).not.toContainText('Extensions');

  await navItem(page, 'App settings').click();
  await page.locator('.backstage-main [data-ops-settings-group="advanced"]').click();
  await expect(page.locator('.backstage-main [data-ops-setting="debugTerminal"]')).toBeVisible();
  await expect(page.locator('.backstage-main [data-ops-setting="aiMode"]')).toHaveCount(0);
  await page.locator('.backstage-main [data-ops-settings-search]').fill('MCP');
  await expect(page.locator('.backstage-main [data-ops-setting]')).toHaveCount(0);
  await page.locator('.backstage-main [data-ops-settings-search]').fill('');
  await page.locator('.backstage-main [data-ops-settings-group="about"]').click();
  await expect(page.locator('.backstage-main [data-ops-settings-stats]')).toHaveCount(0);
  await expect(page.locator('.backstage-main [data-ops-settings-version]')).toBeVisible();
  await expect(page.locator('.backstage-main').getByRole('button', { name: 'Check for updates' })).toHaveCount(0);
  await expect(page.locator('.backstage-main').getByRole('button', { name: "What's new" })).toHaveCount(0);
  await expect(page.locator('[data-tour-anchor="feedback-button"]')).toHaveCount(0);

  await walkTourFromSettings(page);

  expect(seen.sameOriginOutsideBase).toEqual([]);
  expect(seen.catalogRequests).toEqual([]);
  expect(seen.pageErrors).toEqual([]);
});

test('Help: een artikel laadt via het basispad, geen tutorialknop naar de catalogus', async ({ page }) => {
  const seen = await openApp(page);
  await openBackstage(page);
  await navItem(page, 'Help').click();

  const firstArticle = page.locator('[data-help-article]').first();
  await expect(firstArticle).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-help-install-tutorials]')).toHaveCount(0);

  const id = await firstArticle.getAttribute('data-help-article');
  await firstArticle.click();
  const body = page.locator(`.help-article-body[data-help-current="${id}"]`);
  await expect(body).toBeVisible();
  await expect(body.locator('h1, h2, p').first()).toBeVisible();

  expect(seen.sameOriginOutsideBase).toEqual([]);
  expect(seen.catalogRequests).toEqual([]);
  expect(seen.pageErrors).toEqual([]);
});

test('Voorbeelden: een voorbeeldproject laadt via het basispad', async ({ page }) => {
  const seen = await openApp(page);
  await openBackstage(page);
  await navItem(page, 'Examples').click();

  const card = page.locator('.backstage-main button.backstage-export-card').first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();

  await expect(page.locator('.backstage')).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => taskRows(page).count(), { timeout: 15_000 }).toBeGreaterThan(0);

  expect(seen.sameOriginOutsideBase).toEqual([]);
  expect(seen.catalogRequests).toEqual([]);
  expect(seen.pageErrors).toEqual([]);
});

test('Ctrl+S direct na het typen van een inzet slaat de nieuwe inzet op', async ({ page }) => {
  const seen = await openApp(page);
  await openBackstage(page);
  await navItem(page, 'Examples').click();
  const card = page.locator('.backstage-main button.backstage-export-card').first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(page.locator('.backstage')).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => taskRows(page).count(), { timeout: 15_000 }).toBeGreaterThan(0);

  const row = page.locator('[data-ops-assignment-row]').first();
  const count = await taskRows(page).count();
  for (let i = 0; i < count && !(await row.isVisible()); i++) {
    await taskRows(page).nth(i).click();
    await page.waitForTimeout(100);
  }
  await expect(row).toBeVisible();
  const input = row.locator('input').first();
  await input.click();
  await input.press('Control+a');
  await page.keyboard.type('3.25');
  await expect(input).toBeFocused();

  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const ifc = readFileSync(await (await download).path(), 'utf8');
  expect(ifc).toMatch(/IFCTEXT\('3\.25\|/);

  await expect(input).toBeFocused();
  const rowsBefore = await taskRows(page).count();
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
  expect(await taskRows(page).count()).toBe(rowsBefore);

  expect(seen.pageErrors).toEqual([]);
});

interface WorkplaceHostCall {
  fn: 'open' | 'save' | 'list' | 'versions' | 'settings.get' | 'settings.set' | 'settings.delete';
  id?: string | null;
  name?: string | null;
  version?: string | number | null;
  expectedVersion?: string | number | null;
  bytes?: boolean;
  text?: string;
  key?: string;
  value?: unknown;
  assistant?: string;
}

const WORKPLACE_IFC = readFileSync(join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
const WORKPLACE_TASK = 'Set up site';
const FLOAT_BAND = (JSON.parse(readFileSync(join(ROOT, 'src/i18n/locales/en/menu.json'), 'utf8')) as {
  ribbon: { toggleFloatBand: string };
}).ribbon.toggleFloatBand;
const FLOAT_BAND_KEY = 'ops-showFloatBand';

async function installWorkplaceHost(page: Page): Promise<void> {
  await page.addInitScript((ifc) => {
    if (window.top === window) return;
    type Call = Record<string, unknown>;
    const waiting: Record<'settings' | 'open', (() => void)[]> = { settings: [], open: [] };
    const holding = { settings: true, open: true };
    const hold = (what: 'settings' | 'open') => (holding[what] ? new Promise<void>((resolve) => { waiting[what].push(resolve); }) : Promise.resolve());
    const state = {
      calls: [] as Call[],
      violations: [] as string[],
      waiting: (what: 'settings' | 'open') => waiting[what].length,
      release: (what: 'settings' | 'open') => { holding[what] = false; for (const resolve of waiting[what].splice(0)) resolve(); },
    };
    (window as unknown as { __werkplek: typeof state }).__werkplek = state;
    document.addEventListener('securitypolicyviolation', (event) => {
      state.violations.push(`${event.effectiveDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`);
    }, true);

    const memoryStorage = (): Storage => {
      const items = new Map<string, string>();
      return {
        get length() { return items.size; },
        key: (index: number) => [...items.keys()][index] ?? null,
        getItem: (key: string) => items.get(String(key)) ?? null,
        setItem: (key: string, value: string) => { items.set(String(key), String(value)); },
        removeItem: (key: string) => { items.delete(String(key)); },
        clear: () => { items.clear(); },
      };
    };
    for (const name of ['localStorage', 'sessionStorage'] as const) {
      try { void window[name]; } catch { Object.defineProperty(window, name, { configurable: true, value: memoryStorage() }); }
    }

    interface HostFile { id: string; name: string; version: number; bytes: Uint8Array }
    const files = new Map<string, HostFile>([['f1', { id: 'f1', name: 'Verbouwing.ifc', version: 7, bytes: new TextEncoder().encode(ifc) }]]);
    let seq = 0;
    const hostSettings = new Map<string, unknown>([['ops-constructionMode', 'false']]);
    const modified = '2026-11-06T10:00:00Z';
    (window as unknown as { openaecHost: unknown }).openaecHost = {
      taal: 'en',
      thema: 'light',
      initialFileId: 'f1',
      async open(id: string, version?: string | number) {
        state.calls.push({ fn: 'open', id, version: version ?? null, assistant: typeof (window as unknown as { __OPDS_APP__?: unknown }).__OPDS_APP__ });
        await hold('open');
        const file = files.get(id);
        if (!file) throw new Error(`Bestand ${id} bestaat niet.`);
        return { id: file.id, name: file.name, version: file.version, readOnly: false, bytes: file.bytes };
      },
      async save(bytes: Uint8Array, options: { id?: string; name?: string; expectedVersion?: string | number }) {
        state.calls.push({
          fn: 'save', id: options.id ?? null, name: options.name ?? null, expectedVersion: options.expectedVersion ?? null,
          bytes: bytes instanceof Uint8Array, text: new TextDecoder().decode(bytes),
        });
        let file: HostFile;
        if (options.id === undefined) {
          seq += 1;
          file = { id: `nieuw-${seq}`, name: options.name ?? 'Naamloos.ifc', version: 1, bytes };
          files.set(file.id, file);
        } else {
          const current = files.get(options.id);
          if (!current) throw new Error(`Bestand ${options.id} bestaat niet.`);
          if (options.expectedVersion !== current.version) {
            throw Object.assign(new Error('Er is intussen een nieuwere versie.'), { code: 'VERSION_CONFLICT' });
          }
          file = { ...current, version: current.version + 1, bytes };
          files.set(file.id, file);
        }
        return { id: file.id, name: file.name, version: file.version };
      },
      async list() {
        state.calls.push({ fn: 'list' });
        return [...files.values()].map((file) => ({ id: file.id, name: file.name, modified }));
      },
      async versions(id: string) {
        state.calls.push({ fn: 'versions', id });
        const file = files.get(id);
        return file ? [{ version: file.version, modified, author: 'Test' }] : [];
      },
      settings: {
        async get(key: string) { state.calls.push({ fn: 'settings.get', key }); await hold('settings'); return hostSettings.get(key) ?? null; },
        async set(key: string, value: unknown) { state.calls.push({ fn: 'settings.set', key, value }); hostSettings.set(key, value); return null; },
        async delete(key: string) { state.calls.push({ fn: 'settings.delete', key }); hostSettings.delete(key); return null; },
      },
    };
  }, WORKPLACE_IFC);
}

async function toolFrame(page: Page): Promise<Frame> {
  await expect.poll(() => page.frames().length, { timeout: 15_000 }).toBe(2);
  return page.frames().find((frame) => frame !== page.mainFrame())!;
}

const workplaceCalls = (frame: Frame) =>
  frame.evaluate(() => (window as unknown as { __werkplek: { calls: unknown[] } }).__werkplek.calls) as Promise<WorkplaceHostCall[]>;
const workplaceSaves = async (frame: Frame) => (await workplaceCalls(frame)).filter((call) => call.fn === 'save');

test('werkplek: in een sandbox-frame met CSP openen, opslaan, instellingen en de assistent via de host', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ colorScheme: 'dark' });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const outsideBundle: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  page.on('request', (request: Request) => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.origin !== origin || (!url.pathname.startsWith(BASE) && url.pathname !== WORKPLACE_PATH)) outsideBundle.push(request.url());
  });
  await installWorkplaceHost(page);
  await page.goto(`${origin}${WORKPLACE_PATH}`);
  const frame = await toolFrame(page);

  await expect.poll(() => frame.evaluate(() => (window as unknown as { __werkplek: { waiting(what: string): number } }).__werkplek.waiting('settings')), { timeout: 20_000 }).toBeGreaterThan(0);
  expect(await frame.evaluate(() => [self.origin, typeof window.localStorage.getItem])).toEqual(['null', 'function']);

  const duringRead = await frame.evaluate(async () => {
    const app = (window as unknown as { __OPDS_APP__?: { definitions(): Promise<unknown> } }).__OPDS_APP__;
    if (app) await app.definitions().catch(() => null);
    return { assistant: app !== undefined, rendered: (document.getElementById('root')?.childElementCount ?? 0) > 0 };
  });
  expect(duringRead).toEqual({ assistant: false, rendered: false });
  await frame.evaluate(() => (window as unknown as { __werkplek: { release(what: string): void } }).__werkplek.release('settings'));

  await expect.poll(() => frame.evaluate(() => (window as unknown as { __werkplek: { waiting(what: string): number } }).__werkplek.waiting('open')), { timeout: 20_000 }).toBe(1);
  {
    const calls = await workplaceCalls(frame);
    const firstOpen = calls.findIndex((call) => call.fn === 'open');
    const gets = calls.map((call, index) => (call.fn === 'settings.get' ? index : -1)).filter((index) => index >= 0);
    expect(gets.length).toBeGreaterThan(0);
    expect(Math.max(...gets)).toBeLessThan(firstOpen);
    expect(calls[firstOpen]).toEqual({ fn: 'open', id: 'f1', version: null, assistant: 'object' });
    expect(calls.filter((call) => (call.fn === 'settings.set' || call.fn === 'settings.delete')
      && (call.key === 'ops-constructionMode' || call.key === FLOAT_BAND_KEY))).toEqual([]);
  }
  const startCalendar = await frame.evaluate(async () => {
    const app = (window as unknown as { __OPDS_APP__: { run(name: string, args?: object): Promise<unknown> } }).__OPDS_APP__;
    const result = await app.run('planner_get_calendars', {}) as { data: { calendars: { name: string; holidays?: unknown[]; isProjectDefault?: boolean }[] } };
    const calendar = result.data.calendars.find((candidate) => candidate.isProjectDefault);
    return calendar ? [calendar.name, calendar.holidays?.length ?? 0] : null;
  });
  expect(startCalendar).toEqual(['Standaardkalender', 0]);
  await frame.evaluate(() => (window as unknown as { __werkplek: { release(what: string): void } }).__werkplek.release('open'));
  await expect(frame.locator('.title-bar')).toBeVisible({ timeout: 20_000 });

  await expect(frame.getByText(WORKPLACE_TASK, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(frame.locator('[data-ops-settings-delay-dialog]')).toHaveCount(0);
  expect((await workplaceCalls(frame)).filter((call) => call.fn === 'open')).toEqual([{ fn: 'open', id: 'f1', version: null, assistant: 'object' }]);

  await expect(frame.locator('html')).toHaveAttribute('lang', 'en');
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'light');

  const assistant = await frame.evaluate(async () => {
    interface App {
      tools(): Promise<string[]>;
      definitions(): Promise<{ name: string; description: string; inputSchema: object }[]>;
      run(name: string, args?: Record<string, unknown>): Promise<unknown>;
    }
    const app = (window as unknown as { __OPDS_APP__?: App }).__OPDS_APP__;
    if (!app) return null;
    const definitions = await app.definitions();
    const tools = await app.tools();
    const list = await app.run('planner_list_tasks', { limit: 5 }) as { ok: boolean; data: { tasks: { name: string }[]; total: number } };
    let refusal: { message: string; code: unknown } | null = null;
    try { await app.run('planner_export_ifc', {}); } catch (error) {
      refusal = { message: (error as Error).message, code: (error as { code?: unknown }).code };
    }
    return {
      names: definitions.map((definition) => definition.name),
      schemas: definitions.every((definition) => typeof definition.description === 'string' && typeof definition.inputSchema === 'object'),
      tools,
      list: { ok: list.ok, count: list.data.tasks.length, total: list.data.total, names: list.data.tasks.map((task) => task.name) },
      refusal,
    };
  });
  expect(assistant, 'window.__OPDS_APP__ staat in het frame').not.toBeNull();
  expect(assistant!.names.length).toBeGreaterThan(10);
  expect(assistant!.names.every((name) => name.startsWith('planner_'))).toBe(true);
  expect(assistant!.names).not.toContain('planner_export_ifc');
  expect(assistant!.names).not.toContain('planner_import_schedule');
  expect(assistant!.schemas).toBe(true);
  expect(assistant!.tools).toEqual(assistant!.names);
  expect(assistant!.list.ok).toBe(true);
  expect(assistant!.list.count).toBe(5);
  expect(assistant!.list.total).toBeGreaterThan(5);
  expect(assistant!.list.names).toContain(WORKPLACE_TASK);
  expect(assistant!.refusal?.code).toBe('niet_in_browser');
  expect(assistant!.refusal?.message).toMatch(/^niet_in_browser: planner_export_ifc/);
  const toolsFile = await page.request.get(`${origin}${BASE}mcp-tools.json`);
  expect(toolsFile.status()).toBe(200);
  expect(((await toolsFile.json()) as { name: string }[]).map((tool) => tool.name)).toEqual(assistant!.names);

  const grid = frame.locator('[data-task-grid-surface-id="gantt-task-grid"]');
  await grid.locator('[data-grid-row-key][data-grid-column-id="task.name"]').first().click();
  await page.keyboard.press('Insert');
  await expect(grid.locator('input:focus')).toHaveCount(1);
  await page.keyboard.type('In de werkplek');
  await page.keyboard.press('Enter');
  await expect(grid.getByText('In de werkplek', { exact: true }).first()).toBeVisible();

  await page.keyboard.press('Control+s');
  await expect.poll(() => workplaceSaves(frame).then((saves) => saves.length)).toBe(1);
  const [save] = await workplaceSaves(frame);
  expect(save).toMatchObject({ fn: 'save', id: 'f1', name: null, expectedVersion: 7, bytes: true });
  expect(typeof save.expectedVersion).toBe('number');
  expect(save.text).toContain("'In de werkplek'");
  await expect(frame.locator('[data-ops-site-save-dialog]')).toHaveCount(0);

  await grid.getByText('In de werkplek', { exact: true }).first().click();
  await page.keyboard.press('Insert');
  await expect(grid.locator('input:focus')).toHaveCount(1);
  await page.keyboard.type('Tweede wijziging');
  await page.keyboard.press('Enter');
  await expect(grid.getByText('Tweede wijziging', { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect.poll(() => workplaceSaves(frame).then((saves) => saves.length)).toBe(2);
  expect((await workplaceSaves(frame))[1]).toMatchObject({ id: 'f1', expectedVersion: 8 });

  await page.keyboard.press('Control+Shift+s');
  const saveDialog = frame.locator('[data-ops-site-save-dialog]');
  await expect(saveDialog).toBeVisible();
  await page.keyboard.type('Variant');
  await saveDialog.locator('[data-ops-site-save-confirm]').click();
  await expect(saveDialog).toHaveCount(0);
  await expect.poll(() => workplaceSaves(frame).then((saves) => saves.length)).toBe(3);
  expect((await workplaceSaves(frame))[2]).toMatchObject({ fn: 'save', id: null, name: 'Variant.ifc', expectedVersion: null, bytes: true });

  expect((await workplaceCalls(frame)).some((call) => call.fn === 'settings.get' && call.key === FLOAT_BAND_KEY)).toBe(true);
  await frame.locator('[data-ops-ribbon-tab="beeld"]').click();
  const floatBand = frame.getByRole('button', { name: new RegExp(`^${FLOAT_BAND}`) });
  const wasActive = await floatBand.evaluate((element) => element.classList.contains('active'));
  await floatBand.click();
  await expect.poll(() => floatBand.evaluate((element) => element.classList.contains('active'))).toBe(!wasActive);
  await expect.poll(async () => {
    const sets = (await workplaceCalls(frame)).filter((call) => call.fn === 'settings.set' && call.key === FLOAT_BAND_KEY);
    return sets.at(-1)?.value;
  }).toBe(String(!wasActive));

  await frame.locator('[data-ops-ribbon-tab="resources"]').click();
  await frame.locator('[data-ops-ribbon-item="levelResources"]').first().click();
  const leveling = frame.getByRole('dialog');
  await expect(leveling).toBeVisible();
  await leveling.getByRole('button', { name: /^Calculate$/ }).click();
  await expect(leveling.getByText(/^Project end date: /)).toBeVisible({ timeout: 20_000 });
  await expect(leveling.getByText(/^Leveling failed/)).toHaveCount(0);
  await leveling.getByRole('button', { name: /^Cancel$/ }).click();
  await expect(leveling).toBeHidden();

  await expect(frame.locator('[data-tour-anchor="feedback-button"]')).toHaveCount(0);
  await frame.locator('.ribbon-tab--file').click();
  await frame.locator('.backstage-sidebar .backstage-nav-item', { hasText: /^App settings$/ }).click();
  await frame.locator('.backstage-main [data-ops-settings-group="about"]').click();
  await walkTourFromSettings(frame);

  expect(await frame.evaluate(() => (window as unknown as { __werkplek: { violations: string[] } }).__werkplek.violations), 'CSP-schendingen').toEqual([]);
  expect(consoleErrors, 'consolefouten').toEqual([]);
  expect(pageErrors, 'onafgevangen fouten').toEqual([]);
  expect(outsideBundle, 'verzoeken buiten de bundel').toEqual([]);
});
