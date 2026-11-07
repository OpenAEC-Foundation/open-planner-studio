// Platformbouw voor de OpenAEC-app op Frappe (issues #307, #308, #310, #311).
//
// Deze spec bouwt ÉÉN keer de platformbundel met het echte commando (`npm run build:platform`,
// hier rechtstreeks `node scripts/build-platform.mjs`, wat dat npm-script ook doet) en serveert
// `dist-platform/` met een kleine statische server onder het subpad `/tools/planner/`. Alles buiten
// dat subpad geeft 404, zoals op de site: een hard pad naar `/icon.png` of `/docs/…` valt dan op.
//
// Een productiebouw heeft geen `window.__OPS__`; alle controles lopen via de DOM en echte klikken.
// De dev-server die Playwright voor de rest van de suite start, gebruikt deze spec niet.
//
// De werkplek van de SuperCloud (#818) staat onderaan: dezelfde bundel in een sandbox-frame met een
// strikte CSP en een nep-`window.openaecHost`. De server levert daarvoor ook `/werkplek.html`.

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

// De werkplek van de SuperCloud (#818), BENADERD: de echte SuperCloud zet zijn eigen ouderpagina, CSP en
// berichtbrug neer; die hebben we hier niet. Wat we wel nadoen, volgens het contract:
//   - een ouderpagina buiten het basispad met een frame `sandbox="allow-scripts allow-modals"` (zonder
//     `allow-same-origin`): het document in het frame heeft een opaque origin (`null`);
//   - een strikte CSP op het document in het frame: alleen de eigen bundel, geen inline scripts, geen
//     netwerk naar buiten. Inline stijlen mogen volgens het contract. `data:` en `blob:` voor afbeeldingen
//     en lettertypen laten we toe: dat is geen netwerk, en of de SuperCloud ze toelaat, staat niet in het
//     contract (zie knownbugs 866);
//   - `Access-Control-Allow-Origin: *` op de bestanden van de bundel: een opaque frame haalt modules en
//     lettertypen op met origin `null` (calc-supercloud.md).
// De CSP gaat alleen mee met een document dat in een frame laadt (`Sec-Fetch-Dest: iframe`) of een worker,
// zodat de scenario's hierboven (de bundel als gewone pagina, zoals op Frappe) ongewijzigd blijven.
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

/** Statische server: alleen `BASE` bestaat, de rest is 404 (net als een subpad op de site). Uitzondering:
 *  de ouderpagina van de werkplek op `WORKPLACE_PATH`. */
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

/** Open de app op het subpad. Welkomst en "net geüpdatet" staan uit; een oude `ops-aiMode = true`
 *  staat wél klaar, om te bewijzen dat de platformbouw die negeert. */
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

/** Taakrijen in de taaktabel; de lege invoerrij (`data-grid-ghost`) telt niet mee. */
const taskRows = (page: Page) => page.locator('[data-grid-data-row="true"]:not([data-grid-ghost="true"])');

const navItem = (page: Page, label: string) =>
  page.locator('.backstage-sidebar .backstage-nav-item', { hasText: new RegExp(`^${label}$`) });

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
  // Vite's build.manifest: hiermee voegt de site de entry in.
  const manifestPath = join(OUT_DIR, '.vite', 'manifest.json');
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, { file: string; isEntry?: boolean }>;
  const entry = manifest['index.html'];
  expect(entry?.isEntry).toBe(true);
  expect(existsSync(join(OUT_DIR, entry.file))).toBe(true);

  // Elke src/href in index.html wijst naar een bestand onder het basispad.
  const html = readFileSync(join(OUT_DIR, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  expect(refs.length).toBeGreaterThan(0);
  for (const ref of refs) expect(ref, `pad in index.html: ${ref}`).toMatch(/^\/tools\/planner\//);
  // Geen inline script (#818: de CSP van de SuperCloud laat alleen de eigen bundel toe). Het pre-paint-script
  // staat als klassiek script onder het basispad en is meegekopieerd.
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)];
  for (const [, attrs, body] of scripts) {
    expect(attrs, 'elk script heeft een src').toMatch(/\ssrc="/);
    expect(body.trim(), 'geen inline code').toBe('');
  }
  expect(html).toMatch(new RegExp(`<script src="${BASE}theme-prepaint\\.js"></script>`));
  expect(existsSync(join(OUT_DIR, 'theme-prepaint.js'))).toBe(true);

  // Extensies uit (#311): de catalogus-URL zit nergens in de JS.
  const jsFiles = listFiles(OUT_DIR).filter((f) => f.endsWith('.js'));
  expect(jsFiles.length).toBeGreaterThan(0);
  const withCatalog = jsFiles.filter((f) => readFileSync(f, 'utf8').includes(CATALOG_MARKER));
  expect(withCatalog, 'JS-bestanden met de catalogus-URL').toEqual([]);

  // De tooldefinities voor de assistent van de site liggen naast de bundel (#818), zonder de bestandstools.
  const tools = JSON.parse(readFileSync(join(OUT_DIR, 'mcp-tools.json'), 'utf8')) as { name: string }[];
  const names = tools.map((tool) => tool.name);
  expect(names).toContain('planner_add_tasks');
  expect(names).not.toContain('planner_export_ifc');
  expect(names).not.toContain('planner_import_schedule');
});

test('de app op het subpad: icoon, leeg document, geen MCP-tabblad, geen token', async ({ page }) => {
  const seen = await openApp(page);

  // Het icoon laadt via het basispad.
  const icon = page.locator('img.title-bar-app-icon');
  await expect(icon).toHaveAttribute('src', `${BASE}icon.png`);
  await expect.poll(() => icon.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

  // Geen demo-start (#310): de tool haalt geen voorbeeld op en het document blijft leeg.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_000);
  const exampleRequests = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/examples/')));
  expect(exampleRequests).toEqual([]);
  await expect(page.locator('[data-grid-data-row="true"]').first()).toBeVisible();
  await expect(taskRows(page)).toHaveCount(0);

  // MCP-koppeling uit, ook met een oude `ops-aiMode = true`; er komt geen token in de opslag.
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

  // Controle dat de selector werkt: de andere items zijn er wel.
  await expect(navItem(page, 'App settings')).toHaveCount(1);
  await expect(navItem(page, 'Help')).toHaveCount(1);
  await expect(navItem(page, 'Extensions')).toHaveCount(0);

  // Importeren: de eigen kaart wel, maar geen extensie-importers en geen verwijzing naar Extensies.
  await navItem(page, 'Import').click();
  await expect(page.locator('[data-ops-progress-import-card]')).toBeVisible();
  await expect(page.locator('.backstage-main')).not.toContainText('Extensions');

  // Instellingen → Geavanceerd: Debug-terminal wel, MCP-koppeling niet.
  await navItem(page, 'App settings').click();
  await page.locator('.backstage-main .settings-tab', { hasText: 'Advanced' }).click();
  await expect(page.locator('.backstage-main').getByText('Debug terminal', { exact: true })).toBeVisible();
  await expect(page.locator('.backstage-main').getByText('MCP connection', { exact: true })).toHaveCount(0);
  // Geen downloadcijfers (#818): die komen van GitHub, en de werkplek laat geen netwerk buiten de bundel toe.
  await expect(page.locator('.backstage-main [data-ops-settings-stats]')).toHaveCount(0);

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

  // Na het openen sluit de Backstage en staat de planning in de taaktabel.
  await expect(page.locator('.backstage')).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => taskRows(page).count(), { timeout: 15_000 }).toBeGreaterThan(0);

  expect(seen.sameOriginOutsideBase).toEqual([]);
  expect(seen.catalogRequests).toEqual([]);
  expect(seen.pageErrors).toEqual([]);
});

// Productiebundel (PR #369, hercheck): in een productiebouw vangt een voorpoort Ctrl+S af vóór het
// sneltoets-register. Die voorpoort moet het actieve tekstveld eerst laten committen, net als het
// register; anders staat een getypte inzet die direct met Ctrl+S wordt opgeslagen er niet in.
// Geen `__OPS__` in deze bouw: we lezen de waarde uit het gedownloade IFC-bestand.
test('Ctrl+S direct na het typen van een inzet slaat de nieuwe inzet op', async ({ page }) => {
  const seen = await openApp(page);
  await openBackstage(page);
  await navItem(page, 'Examples').click();
  const card = page.locator('.backstage-main button.backstage-export-card').first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(page.locator('.backstage')).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => taskRows(page).count(), { timeout: 15_000 }).toBeGreaterThan(0);

  // Kies de eerste taak met een toewijzing (klik op de rij, zoals een planner).
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

  // De focus staat weer in het veld: Backspace verwijdert de geselecteerde taak niet.
  await expect(input).toBeFocused();
  const rowsBefore = await taskRows(page).count();
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
  expect(await taskRows(page).count()).toBe(rowsBefore);

  expect(seen.pageErrors).toEqual([]);
});

// ── De werkplek van de SuperCloud (#818) ──────────────────────────────────────────────────────────────
// De controle uit het issue: de bundel start zonder fouten in een sandbox-frame met een strikte CSP (zie
// `WORKPLACE_CSP` hierboven, een benadering), en Openen, Opslaan, Opslaan als, instellingen en de assistent
// werken met een nep-`window.openaecHost` in de platte vorm van het contract.

/** Een aanroep van de nep-host, zoals hij hem bijhoudt op `window.__werkplek.calls` in het frame. */
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
}

const WORKPLACE_IFC = readFileSync(join(ROOT, 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
/** Een taak uit dat voorbeeld; de eerste rijen van de taaktabel. */
const WORKPLACE_TASK = 'Set up site';
const FLOAT_BAND = (JSON.parse(readFileSync(join(ROOT, 'src/i18n/locales/en/menu.json'), 'utf8')) as {
  ribbon: { toggleFloatBand: string };
}).ribbon.toggleFloatBand;
/** De instelling die het scenario omzet. De tool bewaart elke blijvende `ops-`-sleutel onder dezelfde naam
 *  bij de host, met de tekst uit `localStorage` als waarde (`siteHostSettings.ts`). */
const FLOAT_BAND_KEY = 'ops-showFloatBand';

/**
 * Zet in het frame (en alleen daar) vóór de start wat de SuperCloud daar neerzet: opslag in het geheugen
 * voor `localStorage`/`sessionStorage` (het opaque frame weigert de echte) en `window.openaecHost`. De
 * nep-host houdt elke aanroep bij op `window.__werkplek.calls`; CSP-schendingen komen in
 * `window.__werkplek.violations`.
 */
async function installWorkplaceHost(page: Page): Promise<void> {
  await page.addInitScript((ifc) => {
    if (window.top === window) return;
    type Call = Record<string, unknown>;
    const state = { calls: [] as Call[], violations: [] as string[] };
    (window as unknown as { __werkplek: typeof state }).__werkplek = state;
    document.addEventListener('securitypolicyviolation', (event) => {
      state.violations.push(`${event.effectiveDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`);
    }, true);

    // De SuperCloud geeft het frame opslag in het geheugen (contract: "Geen opslag in de browser").
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

    // Bestanden in de map van de tool; versies als GETAL, zoals de SuperCloud.
    interface HostFile { id: string; name: string; version: number; bytes: Uint8Array }
    const files = new Map<string, HostFile>([['f1', { id: 'f1', name: 'Verbouwing.ifc', version: 7, bytes: new TextEncoder().encode(ifc) }]]);
    let seq = 0;
    const hostSettings = new Map<string, unknown>();
    const modified = '2026-11-06T10:00:00Z';
    (window as unknown as { openaecHost: unknown }).openaecHost = {
      taal: 'en',
      thema: 'light',
      initialFileId: 'f1',
      async open(id: string, version?: string | number) {
        state.calls.push({ fn: 'open', id, version: version ?? null });
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
        async get(key: string) { state.calls.push({ fn: 'settings.get', key }); return hostSettings.get(key) ?? null; },
        async set(key: string, value: unknown) { state.calls.push({ fn: 'settings.set', key, value }); hostSettings.set(key, value); return null; },
        async delete(key: string) { state.calls.push({ fn: 'settings.delete', key }); hostSettings.delete(key); return null; },
      },
    };
  }, WORKPLACE_IFC);
}

/** Het frame van de tool op de ouderpagina. */
async function toolFrame(page: Page): Promise<Frame> {
  await expect.poll(() => page.frames().length, { timeout: 15_000 }).toBe(2);
  return page.frames().find((frame) => frame !== page.mainFrame())!;
}

const workplaceCalls = (frame: Frame) =>
  frame.evaluate(() => (window as unknown as { __werkplek: { calls: unknown[] } }).__werkplek.calls) as Promise<WorkplaceHostCall[]>;
const workplaceSaves = async (frame: Frame) => (await workplaceCalls(frame)).filter((call) => call.fn === 'save');

test('werkplek: in een sandbox-frame met CSP openen, opslaan, instellingen en de assistent via de host', async ({ page }) => {
  test.setTimeout(120_000);
  // Een donkere systeemvoorkeur: dan bewijst `data-theme="light"` dat het thema van de host wint.
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

  // Echt een opaque origin, en de nep-opslag van de SuperCloud staat er.
  await expect(frame.locator('.title-bar')).toBeVisible({ timeout: 20_000 });
  expect(await frame.evaluate(() => [self.origin, typeof window.localStorage.getItem])).toEqual(['null', 'function']);

  // Het startbestand van de host opent: een taak staat in de taaktabel.
  await expect(frame.getByText(WORKPLACE_TASK, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  expect((await workplaceCalls(frame)).filter((call) => call.fn === 'open')).toEqual([{ fn: 'open', id: 'f1', version: null }]);

  // Taal en thema van de host: Engels en licht, ook al is het systeem donker.
  await expect(frame.locator('html')).toHaveAttribute('lang', 'en');
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'light');

  // De assistent van de site: definities zonder bestandstools, een leestool met paginering, en een
  // bestandstool die weigert met `niet_in_browser`.
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
  // `mcp-tools.json` naast de bundel heeft precies dezelfde tools als `definitions()`.
  const toolsFile = await page.request.get(`${origin}${BASE}mcp-tools.json`);
  expect(toolsFile.status()).toBe(200);
  expect(((await toolsFile.json()) as { name: string }[]).map((tool) => tool.name)).toEqual(assistant!.names);

  // Een echte wijziging: een nieuwe taak in de taaktabel. Insert opent de naamcel van de nieuwe rij; het
  // typen moet daar landen, niet in het naamveld van het eigenschappenpaneel (in de productiebundel won
  // dat veld eerst de focus en bleef de cel leeg open).
  const grid = frame.locator('[data-task-grid-surface-id="gantt-task-grid"]');
  await grid.locator('[data-grid-row-key][data-grid-column-id="task.name"]').first().click();
  await page.keyboard.press('Insert');
  await expect(grid.locator('input:focus')).toHaveCount(1);
  await page.keyboard.type('In de werkplek');
  await page.keyboard.press('Enter');
  await expect(grid.getByText('In de werkplek', { exact: true }).first()).toBeVisible();

  // Ctrl+S: een nieuwe versie van hetzelfde bestand, met de geopende versie als GETAL.
  await page.keyboard.press('Control+s');
  await expect.poll(() => workplaceSaves(frame).then((saves) => saves.length)).toBe(1);
  const [save] = await workplaceSaves(frame);
  expect(save).toMatchObject({ fn: 'save', id: 'f1', name: null, expectedVersion: 7, bytes: true });
  expect(typeof save.expectedVersion).toBe('number');
  expect(save.text).toContain("'In de werkplek'");
  await expect(frame.locator('[data-ops-site-save-dialog]')).toHaveCount(0);

  // Nog een Ctrl+S na een wijziging: de basis is nu de versie die de host teruggaf (8).
  await grid.getByText('In de werkplek', { exact: true }).first().click();
  await page.keyboard.press('Insert');
  await expect(grid.locator('input:focus')).toHaveCount(1);
  await page.keyboard.type('Tweede wijziging');
  await page.keyboard.press('Enter');
  await expect(grid.getByText('Tweede wijziging', { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect.poll(() => workplaceSaves(frame).then((saves) => saves.length)).toBe(2);
  expect((await workplaceSaves(frame))[1]).toMatchObject({ id: 'f1', expectedVersion: 8 });

  // Opslaan als: een nieuw bestand met alleen een naam.
  await page.keyboard.press('Control+Shift+s');
  const saveDialog = frame.locator('[data-ops-site-save-dialog]');
  await expect(saveDialog).toBeVisible();
  await page.keyboard.type('Variant');
  await saveDialog.locator('[data-ops-site-save-confirm]').click();
  await expect(saveDialog).toHaveCount(0);
  await expect.poll(() => workplaceSaves(frame).then((saves) => saves.length)).toBe(3);
  expect((await workplaceSaves(frame))[2]).toMatchObject({ fn: 'save', id: null, name: 'Variant.ifc', expectedVersion: null, bytes: true });

  // Een instelling die de gebruiker omzet, komt gebundeld bij `settings.set` van de host, onder haar eigen
  // sleutel. Bij de start vroeg de tool die sleutel op met `settings.get`.
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

  // Nivelleren: het opaque frame weigert een worker van de bundel al in de constructor (`SecurityError`);
  // de berekening valt dan terug op de hoofdthread en levert gewoon een voorstel.
  await frame.locator('[data-ops-ribbon-tab="resources"]').click();
  await frame.locator('[data-ops-ribbon-item="levelResources"]').first().click();
  const leveling = frame.getByRole('dialog');
  await expect(leveling).toBeVisible();
  await leveling.getByRole('button', { name: /^Calculate$/ }).click();
  await expect(leveling.getByText(/^Project end date: /)).toBeVisible({ timeout: 20_000 });
  await expect(leveling.getByText(/^Leveling failed/)).toHaveCount(0);
  await leveling.getByRole('button', { name: /^Cancel$/ }).click();
  await expect(leveling).toBeHidden();

  // Geen fout, geen CSP-schending en geen verzoek buiten de bundel, over de hele route.
  expect(await frame.evaluate(() => (window as unknown as { __werkplek: { violations: string[] } }).__werkplek.violations), 'CSP-schendingen').toEqual([]);
  expect(consoleErrors, 'consolefouten').toEqual([]);
  expect(pageErrors, 'onafgevangen fouten').toEqual([]);
  expect(outsideBundle, 'verzoeken buiten de bundel').toEqual([]);
});
