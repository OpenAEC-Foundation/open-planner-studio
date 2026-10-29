// Platformbouw voor de OpenAEC-app op Frappe (issues #307, #308, #310, #311).
//
// Deze spec bouwt ÉÉN keer de platformbundel met het echte commando (`npm run build:platform`,
// hier rechtstreeks `node scripts/build-platform.mjs`, wat dat npm-script ook doet) en serveert
// `dist-platform/` met een kleine statische server onder het subpad `/tools/planner/`. Alles buiten
// dat subpad geeft 404, zoals op de site: een hard pad naar `/icon.png` of `/docs/…` valt dan op.
//
// Een productiebouw heeft geen `window.__OPS__`; alle controles lopen via de DOM en echte klikken.
// De dev-server die Playwright voor de rest van de suite start, gebruikt deze spec niet.

import { expect, test, type Page, type Request } from '@playwright/test';
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

/** Statische server: alleen `BASE` bestaat, de rest is 404 (net als een subpad op de site). */
function startStaticServer(): Promise<Server> {
  const root = resolve(OUT_DIR);
  const srv = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith(BASE)) {
      res.writeHead(404).end();
      return;
    }
    let rel = decodeURIComponent(url.pathname.slice(BASE.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(root, rel));
    if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
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

  // Extensies uit (#311): de catalogus-URL zit nergens in de JS.
  const jsFiles = listFiles(OUT_DIR).filter((f) => f.endsWith('.js'));
  expect(jsFiles.length).toBeGreaterThan(0);
  const withCatalog = jsFiles.filter((f) => readFileSync(f, 'utf8').includes(CATALOG_MARKER));
  expect(withCatalog, 'JS-bestanden met de catalogus-URL').toEqual([]);
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
