import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { fontkit } from '@/services/pdf/fontkit';
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, type PDFPage } from 'pdf-lib';
import type { Download, Page } from '@playwright/test';
import { expect, seedProject, test, waitForOps, waitForWelcomeDialog } from './fixtures/ops';

const MARGIN_PT = 24;
const PAGE_NUMBER_PT = 14;

interface PageShape { width: number; draws: number; footerRects: { x: number; y: number; w: number; h: number; textOps: number }[] }

async function pageShapes(pdfBytes: Uint8Array): Promise<PageShape[]> {
  const doc = await PDFDocument.load(pdfBytes);
  const streamText = (page: PDFPage): string => {
    const contents = page.node.Contents();
    if (!contents) return '';
    const streams = contents instanceof PDFArray
      ? contents.asArray().map(ref => doc.context.lookup(ref))
      : [contents];
    return streams.map(stream => {
      if (!(stream instanceof PDFRawStream)) return '';
      const raw = stream.contents;
      const filter = stream.dict.get(PDFName.of('Filter'));
      const bytes = filter ? inflateSync(raw) : raw;
      return Buffer.from(bytes).toString('latin1');
    }).join('\n');
  };
  return doc.getPages().map(page => {
    const text = streamText(page);
    const windows: { x: number; y: number; w: number; h: number; textOps: number }[] = [];
    const tokens = text.split(/\s+/);
    let depth = 0;
    let current: { depth: number; win: typeof windows[number] } | null = null;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === 'q') {
        depth++;
        if (!current && tokens[i + 5] === 're') {
          current = { depth, win: { x: Number(tokens[i + 1]), y: Number(tokens[i + 2]), w: Number(tokens[i + 3]), h: Number(tokens[i + 4]), textOps: 0 } };
        }
      } else if (tok === 'Q') {
        if (current && depth === current.depth) { windows.push(current.win); current = null; }
        depth--;
      } else if (current && (tok === 'Tj' || tok === 'TJ')) {
        current.win.textOps++;
      }
    }
    const footerRects = windows.filter(r => Math.abs(r.y - (MARGIN_PT + PAGE_NUMBER_PT)) < 0.01 && r.h > 15 && r.h < page.getHeight() / 2);
    return { width: page.getWidth(), draws: (text.match(/\/X0 Do/g) ?? []).length, footerRects };
  });
}

function expectFullFooterOnEveryPage(shapes: PageShape[]): void {
  expect(shapes.length).toBeGreaterThan(1);
  for (const shape of shapes) {
    expect(shape.footerRects).toHaveLength(1);
    const footer = shape.footerRects[0];
    expect(footer.x).toBeCloseTo(MARGIN_PT, 1);
    expect(footer.w).toBeCloseTo(shape.width - 2 * MARGIN_PT, 1);
    expect(footer.textOps).toBeGreaterThanOrEqual(4);
  }
}

async function openStep(page: Page, step: string): Promise<void> {
  const head = page.locator(`[data-rs-step-head="${step}"]`);
  if (await head.getAttribute('aria-expanded') !== 'true') await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'true');
}

async function exportStudioPdf(page: Page, name: RegExp): Promise<Uint8Array> {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-rs-export]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(name);
  const path = await download.path();
  expect(path).not.toBeNull();
  return new Uint8Array(await readFile(path!));
}

test('rapport-studio: klik op het papier opent de stap, kolom toevoegen, zijbalk inklappen', async ({ page, ops: _ops }) => {
  test.slow();
  await seedProject(page, [
    { name: 'Fundering storten', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Wanden metselen', start: '2026-09-21', finish: '2026-10-09', durationDays: 15 },
  ], 'Rapportstudio');

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const studio = page.locator('[data-rs-studio]');
  await expect(studio).toBeVisible();
  await expect(page.locator('.ribbon-content')).toHaveCount(0);
  const page0 = page.locator('[data-report-page-svg="0"]');
  await expect(page0).toBeVisible();
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ }).first()).toBeAttached();

  await expect(page.locator('[data-rs-step-body="tasks"]')).toBeVisible();
  await expect(page.locator('[data-rs-paper-hint]')).toBeVisible();

  const sheet = page.locator('[data-preview-page="0"]');
  const sheetBox = (await sheet.boundingBox())!;
  await page.mouse.move(sheetBox.x + sheetBox.width * 0.3, sheetBox.y + sheetBox.height * 0.04);
  const label = page.locator('[data-rs-region-label]');
  await expect(label).toBeVisible();
  expect((await label.boundingBox())!.y + (await label.boundingBox())!.height).toBeLessThanOrEqual(sheetBox.y + 1);

  await expect(page.locator('[data-rs-step-body="columns"]')).toHaveCount(0);
  await page0.locator('text', { hasText: /^Start$/ }).first().click();
  await expect(page.locator('[data-rs-paper-hint]')).toHaveCount(0);
  await expect(page.locator('[data-rs-step-body="columns"]')).toBeVisible();
  await expect(page.locator('[data-rs-column="task.time.start"]')).toBeFocused();

  await page0.locator('text', { hasText: /^(August|Augustus|October|Oktober) 2026$/ }).first().click();
  await expect(page.locator('[data-rs-step-body="bars"]')).toBeVisible();

  await page.locator('[data-rs-step-body="bars"]').evaluate(el => {
    const seg = el.querySelector('[data-rs-segmented="statusLine"]')!;
    el.scrollTop += seg.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom + 1;
  });
  await page.locator('[data-rs-segmented="statusLine"] [data-rs-value="statusDate"]').click();
  await expect(page.locator('[data-rs-notice="no-status-date"]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-rs-status-today]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-rs-step="bars"] [data-rs-reset="bars"]')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('[data-rs-step-foot]')).toHaveCount(0);
  await page.locator('[data-rs-status-today]').click();
  await expect(page.locator('[data-rs-notice="no-status-date"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return !!s.project.statusDate && !s.scheduleStale;
  })).toBe(true);
  await expect(page.locator('[data-rs-banner="stale"]')).toHaveCount(0);
  await page.locator('[data-rs-segmented="statusLine"] [data-rs-value="none"]').click();
  await expect(page.locator('[data-rs-notice="no-status-date"]')).toHaveCount(0);

  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const t = s.tasks.find(x => x.name === 'Wanden metselen')!;
    s.updateTask(t.id, { time: { ...t.time, scheduleStart: '2026-09-28T08:00' } });
  });
  const stale = page.locator('[data-rs-banner="stale"]');
  await expect(stale).toBeVisible();
  await page.locator('[data-rs-recalculate]').click();
  await expect(stale).toHaveCount(0);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);

  const calendarDays = (await page.evaluate(() => document.documentElement.lang)).startsWith('nl') ? 'Kalenderdagen' : 'Calendar days';
  const chooser = page.getByRole('dialog', { name: /^(Choose column|Kolom kiezen)$/ });
  const addColumn = async (label: string) => {
    await page.locator('[data-rs-add-column]').click();
    await expect(chooser).toBeVisible();
    await expect(chooser.getByRole('searchbox')).toBeFocused();
    await page.keyboard.type(label);
    await chooser.getByRole('menuitemcheckbox', { name: new RegExp(`^${label}$`) }).last().click();
  };
  await page.locator('[data-rs-step-head="columns"]').click();
  const requiredX = page.locator('[data-rs-column="task.name"] [data-rs-required-slot]');
  await expect(requiredX).toHaveAttribute('aria-disabled', 'true');
  await expect(requiredX).toHaveAttribute('title', /(task name|taaknaam)/i);
  await expect(requiredX.locator('svg')).toBeAttached();
  const columnCount = await page.locator('[data-rs-column]').count();
  await page.locator('[data-rs-column="task.name"]').hover();
  await requiredX.click({ force: true });
  await expect(page.locator('[data-rs-column]')).toHaveCount(columnCount);
  await expect(page.locator('[data-rs-column="task.name"]')).toBeVisible();
  await addColumn(calendarDays);
  await expect(page.locator('[data-rs-column="task.time.calendarDays"]')).toBeVisible();
  await expect(chooser).toHaveCount(0);
  await expect(page.locator('[data-rs-add-column]')).toBeFocused();
  await expect(page0.locator('text', { hasText: new RegExp(`^${calendarDays}$`) }).first()).toBeAttached();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').columns))
    .toEqual(['task.wbsCode', 'task.name', 'task.time.scheduleDuration', 'task.time.start', 'task.time.finish', 'task.time.completion', 'task.time.calendarDays']);
  await page.locator('[data-rs-column="task.time.calendarDays"]').focus();
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').columns.at(-1)))
    .toBe('task.time.completion');

  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}'));
  const writeStored = (patch: Record<string, unknown>) => page.evaluate(next => {
    const stored = JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}');
    localStorage.setItem('ops-reportSettings', JSON.stringify({ ...stored, ...next }));
  }, patch);
  const surfaceIds = (id: 'full-task-grid' | 'gantt-task-grid') => page.evaluate(
    surface => window.__OPS__!.store.getState().taskGridSurfaces[surface].columns.map(column => String(column.id)), id);
  const tableIds = await surfaceIds('full-task-grid');
  const ganttIds = await surfaceIds('gantt-task-grid');
  expect(tableIds).not.toEqual(ganttIds);
  const ownColumns = (await saved()).columns;
  await page.locator('[data-rs-like-grid="table"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(tableIds);
  await expect(page.locator('[data-rs-undo]')).toContainText(/(Table tab|tabblad Tabel)/);
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(ownColumns);
  await page.locator('[data-rs-like-grid="gantt"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(ganttIds);
  await expect(page.locator('[data-rs-undo]')).toContainText(/(next to the Gantt|naast de Gantt)/);
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(ownColumns);

  const listedColumns = () => page.locator('[data-rs-columns] [data-rs-column]').evaluateAll(
    rows => rows.map(row => row.getAttribute('data-rs-column')));
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="view"]').click();
  await page.locator('[data-rs-step-head="columns"]').click();
  await expect.poll(listedColumns).toEqual(ganttIds);
  await expect(page.locator('[data-rs-notice="columns-follow-view"]')).toHaveCount(0);
  const nameOpacity = () => page.locator('[data-rs-column] .rs-col-name').first().evaluate(el => Number(getComputedStyle(el).opacity));
  expect(await nameOpacity()).toBeLessThan(0.6);
  await page.locator(`[data-rs-column="${ganttIds[0]}"]`).hover();
  await expect(page.locator('.ops-tooltip strong')).toHaveText(/^(These columns follow the table next to the Gantt|Deze kolommen volgen de tabel naast de Gantt)$/);
  await page.mouse.move(0, 0);
  await expect(page.locator('.ops-tooltip')).toHaveCount(0);
  await expect(page.locator('[data-rs-add-column]')).toHaveCount(0);
  await expect(page.locator('[data-rs-like-grid]')).toHaveCount(0);
  await expect(page.locator('[data-rs-grip]')).toHaveCount(0);
  await expect(page.locator('[data-rs-remove]')).toHaveCount(0);
  await page.locator(`[data-rs-column="${ganttIds[ganttIds.length - 1]}"]`).focus();
  await expect(page.locator('.ops-tooltip strong')).toHaveText(/^(These columns follow the table next to the Gantt|Deze kolommen volgen de tabel naast de Gantt)$/);
  await page.keyboard.press('Delete');
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(listedColumns).toEqual(ganttIds);
  expect((await saved()).columns).toEqual(ownColumns);
  const ganttPrefs = await page.evaluate(() => window.__OPS__!.store.getState().taskGridSurfaces['gantt-task-grid'].columns);
  const fewer = ganttIds.filter(id => id !== 'task.time.scheduleDuration');
  expect(fewer).toHaveLength(ganttIds.length - 1);
  await page.evaluate(ids => {
    const state = window.__OPS__!.store.getState();
    state.setTaskGridColumns('gantt-task-grid', state.taskGridSurfaces['gantt-task-grid'].columns.filter(c => ids.includes(String(c.id))));
  }, fewer);
  await expect.poll(listedColumns).toEqual(fewer);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await expect(page.locator('[data-rs-summary="columns"]')).toContainText(String(fewer.length));
  await page.evaluate(prefs => window.__OPS__!.store.getState().setTaskGridColumns('gantt-task-grid', prefs), ganttPrefs);
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]').click();
  await page.locator('[data-rs-step-head="columns"]').click();
  await expect.poll(listedColumns).toEqual(ownColumns);
  await expect(page.locator('[data-rs-add-column]')).toBeVisible();
  expect(await nameOpacity()).toBe(1);
  await expect(page.locator('[data-rs-column]').first()).not.toHaveAttribute('title');

  await page.locator('[data-rs-step="columns"] [data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-column]')).toHaveCount(6);
  await openStep(page, 'page');
  await page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A2"]').click();
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns.length).toBe(7);
  expect((await saved()).paperSize).toBe('A2');

  const zoomPct = async () => Number((await page.locator('[data-rs-zoom="value"]').innerText()).replace(/\D/g, ''));
  await page.locator('[data-rs-zoom="page"]').click();
  const openZoom = await zoomPct();
  const toggleIcon = () => page.locator('[data-rs-sidebar-toggle] svg').getAttribute('class');
  const collapseIcon = await toggleIcon();
  await page.locator('[data-rs-sidebar-toggle="collapse"]').click();
  await expect(page.locator('[data-rs-sidebar-toggle="expand"]')).toBeVisible();
  expect(await toggleIcon()).not.toBe(collapseIcon);
  await expect(page.locator('[data-rs-rail-step="columns"]')).toBeVisible();
  await expect(page.locator('[data-rs-export]')).toHaveCount(0);
  const fab = page.locator('[data-rs-fab-export]');
  await expect(fab).toBeVisible();
  await expect(fab).toHaveAccessibleName(/^(PDF exporteren|Export PDF)$/);
  await expect.poll(zoomPct).toBeGreaterThanOrEqual(openZoom);
  const fabCoversSheet = () => page.evaluate(() => {
    const f = document.querySelector('[data-rs-fab-export]')!.getBoundingClientRect();
    const v = document.querySelector('[data-rs-viewport]')!.getBoundingClientRect();
    return [...document.querySelectorAll('.rs-page')].some(p => {
      const b = p.getBoundingClientRect();
      const top = Math.max(b.top, v.top), bottom = Math.min(b.bottom, v.bottom), left = Math.max(b.left, v.left), right = Math.min(b.right, v.right);
      return right > f.left && left < f.right && bottom > f.top && top < f.bottom;
    });
  });
  await page.locator('[data-rs-zoom="width"]').click();
  await expect.poll(fabCoversSheet).toBe(false);
  await page.locator('[data-rs-viewport]').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect.poll(fabCoversSheet).toBe(false);
  await page.locator('[data-rs-zoom="in"]').click();
  await expect.poll(fabCoversSheet).toBe(false);
  await page.locator('[data-rs-zoom="page"]').click();
  await page0.locator('text', { hasText: /^Start$/ }).first().click();
  await expect(page.locator('[data-rs-popover="columns"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-rs-popover]')).toHaveCount(0);
  await page.locator('[data-rs-rail-step="columns"]').click();
  const popover = page.locator('[data-rs-popover="columns"]');
  await expect(popover.locator('[data-rs-add-column]')).toBeFocused();
  const popBefore = (await popover.boundingBox())!;
  const popHead = (await popover.locator('[data-rs-pop-drag]').boundingBox())!;
  await page.mouse.move(popHead.x + 30, popHead.y + popHead.height / 2);
  await page.mouse.down();
  await page.mouse.move(popHead.x + 230, popHead.y + popHead.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await popover.boundingBox())!.x).toBeGreaterThan(popBefore.x + 150);
  const dragged = (await popover.boundingBox())!;
  await page.mouse.move(dragged.x + 30, dragged.y + popHead.height / 2);
  await page.mouse.down();
  await page.mouse.move(0, 719, { steps: 6 });
  await page.mouse.up();
  const railRight = (await page.locator('.rs-sidebar').boundingBox())!;
  const fabBox = (await fab.boundingBox())!;
  await expect.poll(async () => (await popover.boundingBox())!.x).toBeGreaterThanOrEqual(railRight.x + railRight.width);
  const corner = (await popover.boundingBox())!;
  expect(corner.y + corner.height).toBeLessThanOrEqual(fabBox.y);
  await expect(popover).toBeVisible();
  await expect(popover.locator('.rs-pop-head [data-rs-reset="columns"]')).toBeVisible();
  await page.locator('[data-rs-popover="columns"] [data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-popover="columns"] [data-rs-column]')).toHaveCount(6);
  await expect(page.locator('[data-rs-toolbar] [data-rs-undo]')).toBeVisible();
  await page.locator('[data-rs-undo-button]').click();
  await expect(page.locator('[data-rs-popover="columns"]')).toBeVisible();
  await expect(page.locator('[data-rs-popover="columns"] [data-rs-column]')).toHaveCount(7);
  await page.locator('[data-rs-popover="columns"] [data-rs-add-column]').click();
  await expect(chooser).toBeVisible();
  await chooser.locator('.task-grid-column-chooser-category').first().click();
  await expect(chooser).toBeVisible();
  await expect(popover).toBeVisible();
  await expect.poll(() => popover.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight;
  })).toBe(true);
  await page.keyboard.press('Escape');
  await expect(chooser).toHaveCount(0);
  await expect(popover).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-rs-popover]')).toHaveCount(0);

  await page.locator('[data-rs-rail-step="headerFooter"]').click();
  const company = page.locator('[data-rs-popover="headerFooter"] #rs-company');
  await company.fill('');
  await company.pressSequentially('abc');
  await expect(company).toHaveValue('abc');
  await expect(company).toBeFocused();
  await page.keyboard.press('Escape');

  const download = page.waitForEvent('download');
  await fab.click();
  expect((await download).suggestedFilename()).toMatch(/^Rapportstudio-.+\.pdf$/);

  await page.locator('[data-rs-sidebar-toggle="expand"]').click();
  await expect(page.locator('[data-rs-export]')).toBeVisible();
  expect(await toggleIcon()).toBe(collapseIcon);
  await expect(fab).toHaveCount(0);

  const refreshStored = (patch: Record<string, unknown>) => page.evaluate(next => {
    const oldValue = localStorage.getItem('ops-reportSettings');
    const newValue = JSON.stringify({ ...JSON.parse(oldValue ?? '{}'), ...next });
    localStorage.setItem('ops-reportSettings', newValue);
    window.dispatchEvent(new StorageEvent('storage', { key: 'ops-reportSettings', oldValue, newValue, storageArea: localStorage, url: location.href }));
  }, patch);
  await page.locator('[data-rs-step-head="columns"]').click();
  await page.locator('[data-rs-step="columns"] [data-rs-reset="columns"]').click();
  await expect(page.locator('[data-rs-column]')).toHaveCount(6);
  await openStep(page, 'page');
  await page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A3"]').click();
  await expect.poll(async () => (await saved()).paperSize).toBe('A3');
  await expect(page.locator('[data-rs-undo-button]')).toBeVisible();
  await refreshStored({ paperSize: 'A1', columns: ['task.name'] });
  await expect(page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A1"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page0.locator('text', { hasText: /^Start$/ })).toHaveCount(0);
  await expect(page.locator('[data-rs-undo-button]')).toHaveCount(0);
  await page.locator('[data-rs-segmented="orientation"] [data-rs-value="portrait"]').click();
  await expect.poll(async () => (await saved()).orientation).toBe('portrait');
  expect(await saved()).toMatchObject({ paperSize: 'A1', columns: ['task.name'], orientation: 'portrait' });
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}');
    localStorage.setItem('ops-reportSettings', JSON.stringify({ ...stored, tableReports: { ...stored.tableReports, nearCriticalDays: 13 } }));
  });
  await page.locator('[data-rs-segmented="orientation"] [data-rs-value="landscape"]').click();
  await expect.poll(async () => (await saved()).orientation).toBe('landscape');
  expect(await saved()).toMatchObject({ paperSize: 'A1', columns: ['task.name'], tableReports: { nearCriticalDays: 13 } });
  await page.locator('[data-rs-segmented="orientation"] [data-rs-value="portrait"]').click();
  await expect.poll(async () => (await saved()).orientation).toBe('portrait');

  await refreshStored({ reportType: 'milestones' });
  await expect(studio).toHaveCount(0);
  const panelFields = ['reportType', 'tableReports', 'paperSize', 'orientation', 'reportFontFamily'];
  const studioFields = async () => Object.fromEntries(Object.entries(await saved()).filter(([key]) => !panelFields.includes(key)));
  const studioBefore = await studioFields();
  expect(studioBefore).toMatchObject({ columns: ['task.name'] });
  const typePicker = page.getByLabel(/^(Report type|Rapporttype)$/).first();
  await typePicker.click();
  await page.getByRole('option', { name: /^Look-ahead$/ }).click();
  await expect(page.locator('[data-ops-table-report]')).toBeVisible();
  const tablePaper = page.locator('[data-ops-report-options]').getByLabel(/^(Paper:|Papier:)$/);
  await tablePaper.click();
  await page.getByRole('option', { name: 'A4', exact: true }).click();
  await expect.poll(async () => (await saved()).paperSize).toBe('A4');
  expect(await saved()).toMatchObject({ reportType: 'lookAhead', orientation: 'portrait' });
  expect(await studioFields()).toEqual(studioBefore);
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}');
    localStorage.setItem('ops-reportSettings', JSON.stringify({ ...stored, tableReports: { ...stored.tableReports, nearCriticalDays: 11 } }));
  });
  await page.locator('[data-ops-report-period="lookAheadPeriod"]').getByLabel(/^(Reporting period:|Rapportageperiode:)$/).click();
  await page.getByRole('option', { name: /^(Next week|Volgende week)$/ }).click();
  await expect.poll(async () => (await saved()).tableReports.lookAheadPeriod).toEqual({ preset: 'nextWeek' });
  expect((await saved()).tableReports.nearCriticalDays).toBe(11);
  await typePicker.click();
  await page.getByRole('option', { name: /^(Gantt chart|Gantt-afdruk)$/ }).click();
  await expect(studio).toBeVisible();
  await expect(page.locator('[data-rs-segmented="paperSize"] [data-rs-value="A4"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page0.locator('text', { hasText: /^Start$/ })).toHaveCount(0);
  expect(await saved()).toMatchObject({ reportType: 'gantt', paperSize: 'A4', columns: ['task.name'], orientation: 'portrait' });
  const kept = ['columns', 'barColors', 'layoutId', 'followView', 'sidebar', 'resourceGantt', 'truncateTaskNames', 'taskNameColumnWidth'];
  const pick = (o: Record<string, unknown>) => Object.fromEntries(kept.map(key => [key, o[key]]));
  expect(pick(await saved())).toEqual(pick(studioBefore));
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}');
    localStorage.setItem('ops-reportSettings', JSON.stringify({ ...stored, layoutId: 'builtin:resource-diagram' }));
  });
  await typePicker.click();
  await page.getByRole('option', { name: /^Look-ahead$/ }).click();
  await expect(page.locator('[data-ops-table-report]')).toBeVisible();
  expect(await saved()).toMatchObject({ reportType: 'lookAhead', layoutId: 'builtin:resource-diagram' });
  await typePicker.click();
  await page.getByRole('option', { name: /^(Gantt chart|Gantt-afdruk)$/ }).click();
  await expect(studio).toBeVisible();
  await openStep(page, 'tasks');
  await expect(page.locator('[data-rs-layout="builtin:resource-diagram"]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]').click();
  await expect.poll(async () => (await saved()).layoutId).toBe('');
  const rowSource = async () => { const s = await saved(); return [s.reportType, s.layoutId, s.followView]; };
  await writeStored({ layoutId: 'builtin:resource-diagram' });
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="view"]').click();
  await expect.poll(rowSource).toEqual(['gantt', '', true]);
  await writeStored({ reportType: 'resourceGantt', followView: false });
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]').click();
  await expect.poll(rowSource).toEqual(['gantt', '', false]);

  const ganttPeriod = page.locator('[data-ops-report-period="ganttPeriod"]');
  const ownPeriod = page.locator('[data-rs-option="ownPeriod"]');
  await expect(ownPeriod).not.toBeChecked();
  await expect(ganttPeriod).toHaveCount(0);
  await ownPeriod.check();
  await expect.poll(async () => (await saved()).period).toEqual({ preset: 'custom', from: '2026-09-07', to: '2026-10-09' });
  const fillPeriodDay = async (which: RegExp, day: string, month: string) => {
    const parts = ganttPeriod.getByRole('group', { name: which }).getByRole('textbox');
    await parts.nth(0).fill(day);
    await parts.nth(1).fill(month);
    await parts.nth(2).fill('2026');
    await page.keyboard.press('Enter');
  };
  await fillPeriodDay(/^(From|Van)$/, '21', '09');
  await fillPeriodDay(/^(To|Tot)$/, '30', '09');
  await expect.poll(async () => (await saved()).period).toEqual({ preset: 'custom', from: '2026-09-21', to: '2026-09-30' });
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ })).toHaveCount(0);
  await expect(page0.locator('text', { hasText: /^Wanden metselen$/ }).first()).toBeAttached();
  await expect(page.locator('[data-rs-period-outside]')).toHaveText(/1/);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await expect(page.locator('[data-rs-summary="tasks"]')).toContainText(/21.*30/);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await ownPeriod.uncheck();
  await expect.poll(async () => (await saved()).period).toEqual({ preset: 'project' });
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ }).first()).toBeAttached();
  await expect(ganttPeriod).toHaveCount(0);

  await openStep(page, 'page');
  await page.locator('[data-rs-segmented="autoFit"] [data-rs-value="fit"]').click();
  await expect(page.locator('[data-preview-page]')).toHaveCount(1);
  await page.locator('[data-rs-option="timelineColumns-more"]').click();
  await expect(page.locator('[data-preview-page]')).toHaveCount(2);
  await page.locator('[data-rs-step-head="headerFooter"]').click();
  const footerSwitch = page.locator('[data-rs-switch="repeatFooter"]');
  await expect(footerSwitch.locator('input')).toBeChecked();
  const withFooter = await pageShapes(await exportStudioPdf(page, /^Rapportstudio-.+\.pdf$/));
  expectFullFooterOnEveryPage(withFooter);
  await footerSwitch.click();
  await expect(footerSwitch.locator('input')).not.toBeChecked();
  const withoutFooter = await pageShapes(await exportStudioPdf(page, /^Rapportstudio-.+\.pdf$/));
  expect(withoutFooter).toHaveLength(2);
  withoutFooter.forEach((shape, i) => {
    expect(shape.draws).toBe(withFooter[i].draws - 1);
    expect(shape.footerRects).toHaveLength(0);
  });
  await footerSwitch.click();
  await openStep(page, 'page');
  await page.locator('[data-rs-option="timelineColumns-less"]').click();
  await expect(page.locator('[data-preview-page]')).toHaveCount(1);

  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const id = (name: string) => s.tasks.find(task => task.name === name)!.id;
    const ploeg = s.addResource({ name: 'Ploeg A', type: 'CREW', description: '', maxUnits: 1 });
    const kraan = s.addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
    s.assignResource(id('Fundering storten'), ploeg, 1);
    s.assignResource(id('Wanden metselen'), ploeg, 1);
    s.assignResource(id('Wanden metselen'), kraan, 1);
    window.__OPS__!.store.getState().runCPM();
  });
  const screen = () => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return { filter: s.view.filter, group: s.view.group, sort: s.view.sort, rows: s.viewRows.map(row => row.rowKey) };
  });
  const screenBefore = await screen();
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-layout="builtin:resource-diagram"]').click();
  await expect(page.locator('[data-rs-layout="builtin:resource-diagram"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-rs-resource-counts]')).toHaveText(/:\s*2\D+:\s*3\D+:\s*0$/);
  await expect(page0.locator('text', { hasText: /^Ploeg A \(2\)$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Kraan \(1\)$/ }).first()).toBeAttached();
  const pageBreak = page.locator('[data-rs-switch="pageBreakPerResource"]');
  await pageBreak.click();
  await expect(pageBreak.locator('input')).toBeChecked();
  await expect(page.locator('[data-preview-page]')).toHaveCount(2);
  const resourcePdf = await PDFDocument.load(await exportStudioPdf(page, /^Rapportstudio-(resource-diagram|resourcediagram)\.pdf$/));
  expect(resourcePdf.getPageCount()).toBe(2);
  await pageBreak.click();
  await expect(page.locator('[data-preview-page]')).toHaveCount(1);
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(page.locator('[data-rs-relations-off]')).toBeVisible();
  await expect(page.locator('[data-rs-option="showDeps"]')).toBeDisabled();
  await expect(page.locator('[data-rs-option="showDeps"]')).not.toBeChecked();
  await expect.poll(async () => (await saved()).layoutId).toBe('builtin:resource-diagram');
  expect(await screen()).toEqual(screenBefore);
  expect(await saved()).toMatchObject({ reportType: 'gantt', layoutId: 'builtin:resource-diagram' });
  const rdChoice = page.locator('[data-rs-layout="builtin:resource-diagram"]');
  const resourceCounts = page.locator('[data-rs-resource-counts]');
  const reportTypePicker = page.getByLabel(/^(Report type|Rapporttype)$/).first();
  const toOtherReportAndBack = async () => {
    await reportTypePicker.click();
    await expect(page.getByRole('option', { name: /^(Other report|Ander rapport)/ })).toHaveCount(0);
    await page.getByRole('option', { name: /^(Milestone overview|Mijlpalen-overzicht)$/ }).click();
    await expect(studio).toHaveCount(0);
    await reportTypePicker.click();
    await page.getByRole('option', { name: /^(Gantt chart|Gantt-afdruk)$/ }).click();
    await expect(studio).toBeVisible();
  };
  await page.locator('[data-rs-step-head="tasks"]').click();
  await ownPeriod.check();
  const periodTo = page.locator('[data-ops-report-period="ganttPeriod"]').getByRole('group', { name: /^(To|Tot)$/ }).getByRole('textbox');
  await periodTo.nth(0).fill('18');
  await periodTo.nth(1).fill('09');
  await periodTo.nth(2).fill('2026');
  await page.keyboard.press('Enter');
  const inPeriod = /:\s*1\D+:\s*1\D+:\s*0\D+:\s*\d+$/;
  await expect(resourceCounts).toHaveText(inPeriod);
  await expect(page0.locator('text', { hasText: /^Ploeg A \(1\)$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Kraan/ })).toHaveCount(0);
  const countsInPeriod = (await resourceCounts.textContent()) ?? '';
  await toOtherReportAndBack();
  await expect(rdChoice).toHaveAttribute('aria-checked', 'true');
  await expect(resourceCounts).toHaveText(countsInPeriod);
  await expect(ownPeriod).toBeChecked();
  await expect(page0.locator('text', { hasText: /^Ploeg A \(1\)$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Kraan/ })).toHaveCount(0);
  expect(await saved()).toMatchObject({
    reportType: 'gantt', layoutId: 'builtin:resource-diagram', period: { preset: 'custom', to: '2026-09-18' },
  });
  await ownPeriod.uncheck();
  await expect(resourceCounts).toHaveText(/:\s*2\D+:\s*3\D+:\s*0$/);
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]').click();
  await expect.poll(async () => (await saved()).layoutId).toBe('');
  await page.evaluate(() => window.__OPS__!.store.getState().setStatusDate('2026-09-14'));
  const oldPeriod = { preset: 'next2Weeks' };
  await refreshStored({ period: undefined, resourceGantt: { ...(await saved()).resourceGantt, period: oldPeriod } });
  await expect(ownPeriod).not.toBeChecked();
  const depsBefore = (await saved()).showDeps;
  await openStep(page, 'bars');
  await page.locator('[data-rs-switch="showDeps"]').click();
  await expect.poll(async () => (await saved()).showDeps).toBe(!depsBefore);
  await page.locator('[data-rs-switch="showDeps"]').click();
  await expect.poll(async () => (await saved()).showDeps).toBe(depsBefore);
  await openStep(page, 'tasks');
  await rdChoice.click();
  await expect(ownPeriod).toBeChecked();
  await expect.poll(async () => { const s = await saved(); return [s.period, s.legacyResourcePeriod]; }).toEqual([oldPeriod, undefined]);
  const shownFrom = ganttPeriod.getByRole('group', { name: /^(From|Van)$/ }).getByRole('textbox');
  const shownTo = ganttPeriod.getByRole('group', { name: /^(To|Tot)$/ }).getByRole('textbox');
  await expect(shownFrom.nth(0)).toHaveValue('14');
  await expect(shownFrom.nth(1)).toHaveValue('09');
  await expect(shownFrom.nth(2)).toHaveValue('2026');
  await expect(shownTo.nth(0)).toHaveValue('27');
  await expect(page0.locator('text', { hasText: /^September 2026$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^(October|Oktober) 2026$/ })).toHaveCount(0);
  await page.evaluate(() => window.__OPS__!.store.getState().setStatusDate('2026-09-21'));
  await expect(shownFrom.nth(0)).toHaveValue('21');
  await expect(shownTo.nth(0)).toHaveValue('04');
  await expect(shownTo.nth(1)).toHaveValue('10');
  await expect(page0.locator('text', { hasText: /^(October|Oktober) 2026$/ }).first()).toBeAttached();
  await refreshStored({});
  await expect(shownFrom.nth(0)).toHaveValue('21');
  expect((await saved()).period).toEqual(oldPeriod);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await expect(page.locator('[data-rs-summary="tasks"]')).toContainText(/21.*04/);
  await openStep(page, 'tasks');
  await shownTo.nth(0).fill('02');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await saved()).period).toEqual({ preset: 'custom', from: '2026-09-21', to: '2026-10-02' });
  await ownPeriod.uncheck();
  await expect.poll(async () => (await saved()).period).toEqual({ preset: 'project' });
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]').click();
  await expect.poll(async () => (await saved()).layoutId).toBe('');
  await refreshStored({ reportType: 'resourceGantt', layoutId: '' });
  await expect(rdChoice).toHaveAttribute('aria-checked', 'true');
  await toOtherReportAndBack();
  await expect(rdChoice).toHaveAttribute('aria-checked', 'true');
  await expect(resourceCounts).toHaveText(/:\s*2\D+:\s*3\D+:\s*0$/);
  await page.locator('[data-rs-switch="includeUnassigned"]').click();
  await expect.poll(async () => (await saved()).resourceGantt.includeUnassigned).toBe(true);
  await writeStored({ resourceGantt: { ...(await saved()).resourceGantt, groupByType: true } });
  await page.locator('[data-rs-step="tasks"] [data-rs-reset="tasks"]').click();
  await expect.poll(async () => (await saved()).resourceGantt).toEqual({
    pageBreakPerResource: false, includeUnassigned: false, groupByType: false, showAssignmentColumns: true,
  });
  expect(await rowSource()).toEqual(['gantt', '', false]);
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).resourceGantt).toMatchObject({ includeUnassigned: true, groupByType: true });
  await expect(rdChoice).toHaveAttribute('aria-checked', 'true');
  await page.locator('[data-rs-switch="includeUnassigned"]').click();
  await page.locator('[data-rs-switch="groupByType"]').click();
  await expect.poll(async () => (await saved()).resourceGantt).toMatchObject({ includeUnassigned: false, groupByType: false });
  await writeStored({ resourceGantt: { ...(await saved()).resourceGantt, groupByType: true } });
  await page.locator('[data-rs-switch="includeUnassigned"]').click();
  await expect.poll(async () => (await saved()).resourceGantt).toMatchObject({ includeUnassigned: true, groupByType: true });
  await expect(page.locator('[data-rs-switch="groupByType"] input')).toBeChecked();
  await page.locator('[data-rs-switch="includeUnassigned"]').click();
  await page.locator('[data-rs-switch="groupByType"]').click();
  await expect.poll(async () => (await saved()).resourceGantt).toMatchObject({ includeUnassigned: false, groupByType: false });
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(page.locator('[data-rs-summary="columns"]')).toHaveText(/^3\D.*(Units\/d|Eenh\.\/d).*Curve/);
  const unitsHead = page0.locator('text', { hasText: /^(Units\/d|Eenh\.\/d)$/ }).first();
  await unitsHead.hover();
  await expect(page.locator('[data-rs-region-label]')).toHaveText(/^(Columns|Kolommen) · (Units\/d|Eenh\.\/d)$/);
  await unitsHead.click();
  await expect(page.locator('[data-rs-step-body="tasks"]')).toBeVisible();
  await expect(page.locator('[data-rs-option="showAssignmentColumns"]')).toBeFocused();
  await page.locator('[data-rs-step-head="columns"]').click();
  await page.locator('[data-rs-to-resource-options]').click();
  await expect(page.locator('[data-rs-option="showAssignmentColumns"]')).toBeFocused();
  await page.locator('[data-rs-step-head="bars"]').click();

  const storeLayouts = (layouts: unknown[]) => page.evaluate(list => {
    const oldValue = localStorage.getItem('ops-taskGridLayouts');
    const newValue = JSON.stringify({ version: 1, layouts: list });
    localStorage.setItem('ops-taskGridLayouts', newValue);
    window.dispatchEvent(new StorageEvent('storage', { key: 'ops-taskGridLayouts', oldValue, newValue, storageArea: localStorage, url: location.href }));
  }, layouts);
  const onlyTask = (name: string) => ({
    id: 'layout-rapport', name: 'Een taak',
    filter: { kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'eq', value: name },
  });
  await storeLayouts([onlyTask('Fundering storten')]);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-layout="layout-rapport"]').click();
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Wanden metselen$/ })).toHaveCount(0);
  await expect(page.locator('[data-rs-resource-counts]')).toHaveCount(0);
  await storeLayouts([onlyTask('Wanden metselen')]);
  await expect(page0.locator('text', { hasText: /^Wanden metselen$/ }).first()).toBeAttached();
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ })).toHaveCount(0);
  expect(await saved()).toMatchObject({ reportType: 'gantt', layoutId: 'layout-rapport', followView: false });
  expect(await screen()).toEqual(screenBefore);
  await expect(page.locator('[data-rs-notice="layout-missing-field"]')).toHaveCount(0);
  const missingFieldLayout = {
    id: 'layout-rapport', name: 'Een taak',
    filter: { kind: 'rule', field: { src: 'customField', defId: 'removed-custom-field' }, operator: 'eq', value: 'A' },
  };
  await storeLayouts([missingFieldLayout]);
  await expect(page.locator('[data-rs-notice="layout-missing-field"]')).toBeVisible();
  await expect(page.locator('[data-rs-notice="layout-missing-field"]')).toContainText(/(not in this project|niet in dit project)/);
  await expect(page0.locator('text', { hasText: /^(Fundering storten|Wanden metselen)$/ })).toHaveCount(0);
  await expect(page.locator('[data-rs-layout="layout-rapport"]')).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ops-taskGridLayouts') ?? '{}').layouts)).toEqual([missingFieldLayout]);
  await storeLayouts([]);
  await expect(page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
    .some(n => n.messageKey === 'notifications.reportLayoutGone'))).toBe(true);
  await expect(page0.locator('text', { hasText: /^Fundering storten$/ }).first()).toBeAttached();
  await expect(page.locator('[data-rs-notice="layout-missing-field"]')).toHaveCount(0);
  await storeLayouts([missingFieldLayout]);
  await page.locator('[data-rs-layout="layout-rapport"]').click();
  await expect.poll(async () => (await saved()).layoutId).toBe('layout-rapport');
  await writeStored({ layoutId: '', followView: true });
  await storeLayouts([]);
  await expect(page.locator('[data-rs-step-body="tasks"] [data-rs-value="view"]')).toHaveAttribute('aria-checked', 'true');
  expect(await saved()).toMatchObject({ reportType: 'gantt', layoutId: '', followView: true });
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]').click();
  await expect.poll(async () => (await saved()).followView).toBe(false);
  await storeLayouts([missingFieldLayout]);
  await page.locator('[data-rs-layout="layout-rapport"]').click();
  await expect.poll(async () => (await saved()).layoutId).toBe('layout-rapport');
  await page.locator('[data-ops-ribbon-tab="start"]').click();
  await page.evaluate(() => {
    const w = window as unknown as { opsRealGetItem?: Storage['getItem'] };
    const realGetItem = w.opsRealGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (key.startsWith('ops-')) throw new DOMException('geweigerd', 'SecurityError');
      return realGetItem.call(this, key);
    };
  });
  await page.locator('[data-ops-ribbon-tab="report"]').click();
  await expect(page.locator('[data-rs-studio]')).toBeVisible();
  await page.evaluate(() => new Promise(resolve => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 50)));
  await page.evaluate(() => {
    Storage.prototype.getItem = (window as unknown as { opsRealGetItem: Storage['getItem'] }).opsRealGetItem;
  });
  const paperBefore = (await saved()).paperSize;
  const otherPaper = paperBefore === 'A2' ? 'A3' : 'A2';
  await openStep(page, 'page');
  await page.locator(`[data-rs-segmented="paperSize"] [data-rs-value="${otherPaper}"]`).click();
  await expect.poll(async () => (await saved()).paperSize).toBe(otherPaper);
  expect(await saved()).toMatchObject({ layoutId: 'layout-rapport', followView: false });
  await page.locator(`[data-rs-segmented="paperSize"] [data-rs-value="${paperBefore}"]`).click();
  await expect.poll(async () => (await saved()).paperSize).toBe(paperBefore);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]').click();
  await expect.poll(async () => (await saved()).layoutId).toBe('');

  await page.locator('[data-rs-step-head="columns"]').click();
  await page.locator('[data-rs-step="columns"] [data-rs-reset="columns"]').click();
  await addColumn(calendarDays);
  await expect(page.locator('[data-rs-column]')).toHaveCount(7);
  await page.locator('[data-rs-step-head="bars"]').click();
  await page.locator('[data-rs-switch="showDeps"]').click();
  const own = async () => {
    const s = await saved();
    return { columns: s.columns, showDeps: s.showDeps, showFloat: s.showFloat, showBaselineOverlay: s.showBaselineOverlay, statusLine: s.statusLine, barColors: s.barColors };
  };
  await expect.poll(async () => (await own()).showDeps).toBe(false);
  const ownBefore = await own();
  expect(ownBefore).toMatchObject({ showFloat: true, showBaselineOverlay: false, statusLine: 'none', barColors: { mode: 'critical' } });
  expect(ownBefore.columns).toHaveLength(7);
  const shortColumns = ['task.wbsCode', 'task.name', 'task.time.scheduleDuration'];
  await storeLayouts([{
    id: 'layout-kort', name: 'Korte tabel', icon: 'flag',
    columns: shortColumns.map(id => ({ id, width: 80, pinned: false })),
    group: [{ field: { src: 'builtin', key: 'taskType' }, dir: 'asc' }],
    showRelations: true,
    overlays: { baseline: true, progressLine: true, statusDateLine: false, resourceAccent: false, floatBand: false, barColors: { mode: 'auto' } },
  }]);
  await page.locator('[data-rs-step-head="tasks"]').click();
  const shortTable = page.locator('[data-rs-layout="layout-kort"]');
  const allTasks = page.locator('[data-rs-step-body="tasks"] [data-rs-value="all"]');
  await shortTable.click();
  await expect.poll(async () => (await saved()).layoutId).toBe('layout-kort');
  expect(await own()).toEqual(ownBefore);
  await expect(page.locator('[data-rs-undo]')).toHaveCount(0);
  await expect(page.locator('[data-rs-notice="layout-own"]')).toBeVisible();
  const layoutInfo = page.locator('[data-rs-step-body="tasks"] [data-rs-group-info]');
  await layoutInfo.focus();
  await expect(page.locator('.ops-tooltip')).toBeVisible();
  await expect(page.locator('.ops-tooltip strong')).toHaveText(/^(Een layout bepaalt alleen de rijen|A layout only sets the rows)$/);
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await saved()).layoutId).toBe('layout-kort');
  await page.keyboard.press('Escape');
  await allTasks.click();
  await expect.poll(async () => (await saved()).layoutId).toBe('');
  expect(await own()).toEqual(ownBefore);
  await allTasks.focus();
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowUp']) await page.keyboard.press(key);
  await expect.poll(async () => (await saved()).followView).toBe(true);
  expect(await own()).toEqual(ownBefore);
  await shortTable.click();
  await expect.poll(async () => (await saved()).layoutId).toBe('layout-kort');
  await page.locator('[data-rs-step-head="bars"]').click();
  const floatBefore = (await saved()).showFloat;
  await page.locator('[data-rs-switch="showFloat"]').click();
  await expect.poll(async () => (await saved()).showFloat).toBe(!floatBefore);
  const beforeSecondClick = await saved();
  await page.locator('[data-rs-step-head="tasks"]').click();
  await shortTable.click();
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(page.locator('[data-rs-step-body="bars"]')).toBeVisible();
  expect(await saved()).toEqual(beforeSecondClick);
  await expect(page.locator('[data-rs-undo]')).toHaveCount(0);
  await page.locator('[data-rs-switch="showFloat"]').click();
  await expect.poll(own).toEqual(ownBefore);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-take-over="columns"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(shortColumns);
  expect(await own()).toMatchObject({ showDeps: false, showFloat: true, statusLine: 'none' });
  await expect(page.locator('[data-rs-take-over="columns"]')).toHaveCount(0);
  await expect(page.locator('[data-rs-take-over="bars"]')).toBeVisible();
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(ownBefore.columns);
  expect((await saved()).layoutId).toBe('layout-kort');
  await expect(page.locator('[data-rs-take-over="columns"]')).toBeVisible();
  await page.locator('[data-rs-take-over="bars"]').click();
  await expect.poll(own).toEqual({ ...ownBefore, showDeps: true, showFloat: false, showBaselineOverlay: true, statusLine: 'progress', barColors: { mode: 'auto' } });
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(own).toEqual(ownBefore);
  expect((await saved()).layoutId).toBe('layout-kort');
  await page.locator('[data-rs-take-over="columns"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(shortColumns);
  await page.locator('[data-rs-take-over="bars"]').click();
  await expect.poll(own).toEqual({ columns: shortColumns, showDeps: true, showFloat: false, showBaselineOverlay: true, statusLine: 'progress', barColors: { mode: 'auto' } });
  await expect(page.locator('[data-rs-undo]')).toContainText(/^Korte tabel: (columns and bar options applied|kolommen en balkopties overgenomen)\./);
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(own).toEqual(ownBefore);
  await expect(page.locator('[data-rs-undo]')).toHaveCount(0);
  expect(await screen()).toEqual(screenBefore);
  await page.locator('[data-rs-step-head="bars"]').click();
  await page.locator('[data-rs-switch="showFloat"]').click();
  await expect.poll(async () => (await saved()).showFloat).toBe(false);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await expect.poll(async () => (await saved()).studioStep).toBe('tasks');
  await writeStored({ showFloat: true });
  await page.locator('[data-rs-take-over="bars"]').click();
  await expect.poll(own).toEqual({ ...ownBefore, showDeps: true, showFloat: false, showBaselineOverlay: true, statusLine: 'progress', barColors: { mode: 'auto' } });
  await page.locator('[data-rs-take-over="columns"]').click();
  await expect.poll(async () => (await saved()).columns).toEqual(shortColumns);
  await page.locator('[data-rs-undo-button]').click();
  await expect.poll(own).toEqual(ownBefore);
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(page.locator('[data-rs-switch="showFloat"] input')).toBeChecked();
  const screenColors = () => page.evaluate(() => window.__OPS__!.store.getState().ui.barColorSelection);
  expect(await screenColors()).toEqual({ mode: 'critical' });
  await openStep(page, 'bars');
  const colorPicker = page.locator('[data-rs-step-body="bars"]').getByRole('button', { name: /^(Bar colours|Balkkleuren)$/ });
  await colorPicker.click();
  await page.getByRole('option', { name: /^(Per task — automatic|Per taak — automatisch)$/ }).click();
  await expect.poll(async () => (await saved()).barColors).toEqual({ mode: 'auto' });
  expect(await screenColors()).toEqual({ mode: 'critical' });
  await expect(page.locator('[data-rs-bar-colors-hint]')).toHaveText(/^(This choice applies only to the report|Deze keuze geldt alleen voor het rapport)/);
  await page.locator('[data-rs-step-head="tasks"]').click();
  await page.locator('[data-rs-step-body="tasks"] [data-rs-value="view"]').click();
  await expect.poll(async () => (await saved()).followView).toBe(true);
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(colorPicker).toBeDisabled();
  await expect(colorPicker).toContainText(/Critical path|Kritiek pad/);
  await expect(page.locator('[data-rs-bar-colors-hint]')).toHaveText(/follow your Gantt chart|volgen je Gantt-diagram/);
  expect((await saved()).barColors).toEqual({ mode: 'auto' });
  await page.locator('[data-rs-step-head="tasks"]').click();
  await allTasks.click();
  await page.locator('[data-rs-step-head="bars"]').click();
  await expect(colorPicker).toBeEnabled();
  await expect(colorPicker).toContainText(/Per task — automatic|Per taak — automatisch/);
  expect(await screenColors()).toEqual({ mode: 'critical' });
  const paper = page.locator('[data-report-page-svg="0"]');
  const outline = /Critical path \(outline\)|Kritiek pad \(rand\)/;
  await expect(paper).toContainText(outline);
  await page.evaluate(() => window.__OPS__!.store.getState().setOverlays({ barColors: { mode: 'category', field: { src: 'builtin', key: 'taskType' } } }));
  await expect.poll(screenColors).toMatchObject({ mode: 'category' });
  await expect(colorPicker).toContainText(/Per task — automatic|Per taak — automatisch/);
  await expect(paper).toContainText(outline);
  await page.locator('[data-rs-step="bars"] [data-rs-reset="bars"]').click();
  await expect.poll(async () => (await saved()).barColors).toEqual({ mode: 'critical' });
  await expect(colorPicker).toContainText(/Critical path|Kritiek pad/);
  await expect(paper).not.toContainText(outline);
  expect(await screenColors()).toMatchObject({ mode: 'category' });
});

test('rapport-studio: een Arabische of lange naam past in de naamkolom op het papier', async ({ page, ops: _ops }) => {
  const arabic = 'أعمال البناء والتشييد وإدارة الموارد ومتابعة التنفيذ';
  const latin = 'Stakeholder management en afstemming met de gemeente over de bouwlogistiek';
  const [taskId] = await seedProject(page, [
    { name: arabic, start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Rapport Arabisch');
  type FontId = 'inter' | 'carlito';
  const measured = (text: string, font: string, id: FontId) => page.evaluate(async ({ text, font, id }) => {
    const { loadReportTextMetrics } = await import('/src/services/pdf/fontLoader.ts' as string);
    return (await loadReportTextMetrics(id, 'ltr')).measure(text, font) as number;
  }, { text, font, id });
  const fontIdOf = (font: string): FontId => (font.includes('OpsReportCarlito') ? 'carlito' : 'inter');
  const rename = (name: string) => page.evaluate(({ id, name }) => window.__OPS__!.store.getState().updateTask(id, { name }), { id: taskId, name });
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const page0 = page.locator('[data-report-page-svg="0"]');
  await expect(page0).toBeVisible();
  await openStep(page, 'columns');
  await page.locator('[data-rs-segmented="name-mode"] [data-rs-value="full"]').click();

  const nameCell = (name: string) => page0.evaluate((svg, name) => {
    const cells = [...svg.querySelectorAll('text')].filter(t => t.textContent === name);
    if (cells.length === 0) return null;
    const cell = cells.reduce((a, b) => (b.getBBox().x < a.getBBox().x ? b : a));
    const box = cell.getBBox();
    const borders: number[] = [];
    for (const path of cell.ownerSVGElement!.querySelectorAll('path')) {
      for (const m of (path.getAttribute('d') ?? '').matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)) {
        const [x1, y1, x2, y2] = m.slice(1).map(Number);
        if (x1 === x2 && x1 > box.x + 1 && Math.min(y1, y2) <= box.y && Math.max(y1, y2) >= box.y + box.height) borders.push(x1);
      }
    }
    const style = getComputedStyle(cell);
    return {
      end: box.x + box.width, border: Math.min(...borders), drawn: cell.getComputedTextLength(),
      font: `${style.fontWeight === '700' ? 'bold ' : ''}${style.fontSize} InterPDF`, family: style.fontFamily,
    };
  }, name);
  const paperCell = async (name: string, id: FontId = 'inter') => {
    await expect.poll(() => nameCell(name).then(c => c !== null && Number.isFinite(c.border) && fontIdOf(c.family) === id)).toBe(true);
    const cell = (await nameCell(name))!;
    expect(Math.abs(cell.drawn - await measured(name, cell.font, id)), `getekend ${cell.drawn}`).toBeLessThan(0.1);
    expect(cell.end, `kolomlijn op ${cell.border}`).toBeLessThanOrEqual(cell.border - 2);
    return cell;
  };
  const arabicCell = await paperCell(arabic);
  expect(arabicCell.family).toMatch(/^"?OpsReportArabic"?, /);
  await expect.poll(() => page.evaluate(() => Array.from(document.fonts as unknown as Iterable<FontFace>)
    .filter(face => face.family.replace(/"/g, '') === 'OpsReportArabic' && face.status === 'loaded').map(face => face.weight).sort()))
    .toEqual(['400', '700']);
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}'))).truncateTaskNames).toBe(false);

  await rename(latin);
  await paperCell(latin);
  const fullName = page0.locator('text', { hasText: latin });
  await expect(fullName).toHaveCount(2);
  const cutName = () => page0.evaluate((svg, name) => [...svg.querySelectorAll('text')]
    .map(t => t.textContent ?? '').filter(text => text.endsWith('…') && name.startsWith(text.slice(0, 8))), latin);
  await page.locator('[data-rs-segmented="name-mode"] [data-rs-value="cut"]').click();
  const nameWidth = page.locator('[data-rs-option="taskNameColumnWidth"]');
  await nameWidth.fill(await nameWidth.getAttribute('min') ?? '60');
  await expect.poll(async () => (await cutName()).length).toBeGreaterThan(0);
  await expect(fullName).toHaveCount(1);
  await page.locator('[data-rs-segmented="name-mode"] [data-rs-value="full"]').click();
  await paperCell(latin);

  const chinese = '地基浇筑与钢筋绑扎工程施工';
  await rename(chinese);
  await paperCell(chinese);

  const mixed = 'Fase 1 أعمال البناء en afstemming met de gemeente over de bouwlogistiek en bereikbaarheid van de bouwplaats';
  const mixedDigits = 'Fase 2.3 – أعمال (البناء) 50%, week 12/03: 3 dagen';
  await rename(mixedDigits);
  await paperCell(mixedDigits);
  await rename(mixed);
  await paperCell(mixed);
  await openStep(page, 'page');
  const fontPicker = page.getByLabel(/^(Font:|Lettertype:)$/);
  await fontPicker.click();
  await page.getByRole('option', { name: /^Carlito/ }).click();
  await expect(fontPicker).toContainText(/^Carlito/);
  await expect.poll(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}'))).reportFontFamily).toBe('carlito');
  await expect.poll(() => page.evaluate(() => Array.from(document.fonts as unknown as Iterable<FontFace>)
    .filter(face => face.family.replace(/"/g, '') === 'OpsReportCarlito' && face.status === 'loaded').map(face => face.weight).sort()), { timeout: 20_000 })
    .toEqual(['400', '700']);
  expect((await paperCell(mixed, 'carlito')).family).toMatch(/^"?OpsReportArabic"?, "?OpsReportCarlito"?, /);
});

function type0BaseFonts(pdf: PDFDocument): string[] {
  const baseFonts: string[] = [];
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of('Subtype')) === PDFName.of('Type0')) baseFonts.push(String(obj.get(PDFName.of('BaseFont'))));
  }
  return baseFonts;
}

async function pdfTextsInFont(pdf: PDFDocument, fontKey: string, fontFile: string): Promise<string[]> {
  const font = fontkit.create(await readFile(join(process.cwd(), fontFile)));
  const charOf = new Map<number, string>();
  for (const cp of [...font.characterSet].sort((a, b) => a - b)) {
    const gid = font.glyphForCodePoint(cp).id;
    if (!charOf.has(gid)) charOf.set(gid, String.fromCodePoint(cp));
  }
  const usesKey = new RegExp(`/${fontKey} [\\d.]+ Tf`);
  const texts: string[] = [];
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream)) continue;
      const ops = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
      for (const [, block] of ops.matchAll(/BT\s([\s\S]*?)\sET/g)) {
        if (!usesKey.test(block)) continue;
        for (const [, hex] of block.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) {
          texts.push((hex.match(/.{4}/g) ?? []).map(h => charOf.get(parseInt(h, 16)) ?? '�').join(''));
        }
      }
    }
  }
  return texts;
}

test('rapport-studio: de gekozen rapportletter staat in de PDF en blijft na een herstart', async ({ page, ops: _ops }) => {
  test.slow();
  const longName = 'Afwerking begane grond noordzijde';
  const [letterTaskId] = await seedProject(page, [
    { name: '✓ Lettertaak Фундамент', start: '2026-09-07', finish: '2026-10-16', durationDays: 30 },
    { name: longName, start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Rapportletter');
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setStatusDate('2026-09-14');
    s.runCPM();
  });
  const loadedWeights = (family: string) => page.evaluate(fam => Array.from(document.fonts as unknown as Iterable<FontFace>)
    .filter(face => face.family.replace(/"/g, '') === fam && face.status === 'loaded')
    .map(face => face.weight)
    .sort(), family);
  const readPdf = async (download: Download): Promise<PDFDocument> => {
    const pdfPath = await download.path();
    expect(pdfPath).not.toBeNull();
    return PDFDocument.load(await readFile(pdfPath!));
  };

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const page0 = page.locator('[data-report-page-svg="0"]');
  await expect(page0).toBeVisible();

  await openStep(page, 'page');
  const fontPicker = page.getByLabel(/^(Font:|Lettertype:)$/);
  await expect(fontPicker).toContainText(/^Inter/);
  await fontPicker.click();
  await page.getByRole('option', { name: /^Carlito/ }).click();
  await expect(fontPicker).toContainText(/^Carlito/);
  await expect.poll(() => loadedWeights('OpsReportCarlito'), { timeout: 20_000 }).toEqual(['400', '700']);

  const carlitoFonts = type0BaseFonts(await PDFDocument.load(await exportStudioPdf(page, /^Rapportletter-.+\.pdf$/)));
  expect(carlitoFonts).toContainEqual(expect.stringMatching(/^\/Carlito-Regular-\d+$/));
  expect(carlitoFonts).toContainEqual(expect.stringMatching(/^\/Carlito-Bold-\d+$/));
  expect(carlitoFonts).toContainEqual(expect.stringMatching(/Inter/));

  await openStep(page, 'columns');
  await page.locator('[data-rs-segmented="name-mode"] [data-rs-value="full"]').click();
  await expect(page0.locator('text', { hasText: longName }).first()).toBeAttached();

  const heldFonts: string[] = [];
  let releaseFonts = () => {};
  const fontsReleased = new Promise<void>(resolve => { releaseFonts = resolve; });
  const liberationSansFiles = /LiberationSans-(Regular|Bold)\.ttf/;
  await page.route(liberationSansFiles, async route => {
    heldFonts.push(route.request().url());
    await fontsReleased;
    await route.continue();
  });
  await openStep(page, 'page');
  await fontPicker.click();
  await page.getByRole('option', { name: /^Liberation Sans/ }).click();
  await expect(fontPicker).toContainText(/^Liberation Sans/);
  await expect.poll(() => heldFonts.length).toBeGreaterThan(0);
  const lateDownload = page.waitForEvent('download');
  await page.locator('[data-rs-export]').click();
  expect(await loadedWeights('OpsReportLiberationSans')).toEqual([]);
  releaseFonts();
  const latePdf = await readPdf(await lateDownload);
  await page.unroute(liberationSansFiles);
  expect(type0BaseFonts(latePdf)).toContainEqual(expect.stringMatching(/^\/LiberationSans-\d+$/));
  const lateTexts = await pdfTextsInFont(latePdf, 'F0', 'src/services/pdf/fonts/LiberationSans-Regular.ttf');
  expect(lateTexts).toContain(longName);
  expect(lateTexts.filter(text => text.endsWith('…') && longName.startsWith(text.slice(0, -1)))).toEqual([]);

  await page.getByLabel(/^(Report type|Rapporttype)$/).first().click();
  await page.getByRole('option', { name: /^Look-ahead$/ }).click();
  const tableFontPicker = page.locator('[data-ops-report-options]').getByLabel(/^(Font:|Lettertype:)$/);
  await expect(tableFontPicker).toContainText(/^Liberation Sans/);
  const tableReport = page.locator('[data-ops-table-report]');
  await expect(tableReport).toHaveCSS('font-family', /OpsReportLiberationSans/);
  await tableFontPicker.click();
  await page.getByRole('option', { name: /^Liberation Mono/ }).click();
  await expect(tableReport).toHaveCSS('font-family', /OpsReportLiberationMono/);
  await expect.poll(() => loadedWeights('OpsReportLiberationMono'), { timeout: 20_000 }).toEqual(['400', '700']);
  await tableFontPicker.click();
  await page.getByRole('option', { name: /^Liberation Sans/ }).click();
  await expect(tableReport).toHaveCSS('font-family', /OpsReportLiberationSans/);

  await page.evaluate(() => {
    const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
    const shots: string[] = [];
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get(this: HTMLImageElement) { return src.get!.call(this) as string; },
      set(this: HTMLImageElement, value: string) {
        if (typeof value === 'string' && value.startsWith('data:image/svg+xml')) shots.push(decodeURIComponent(value.slice(value.indexOf(',') + 1)));
        src.set!.call(this, value);
      },
    });
    Object.defineProperty(window, '__opsDomShots', { configurable: true, value: shots });
  });
  await page.evaluate(id => { window.__OPS__!.store.getState().updateTask(id, { name: '施工 Lettertaak' }); }, letterTaskId);
  await expect(tableReport).toContainText('施工 Lettertaak');
  const rasterDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /^(Export PDF|Exporteer PDF)$/ }).click();
  const rasterPdf = await readPdf(await rasterDownload);
  expect(type0BaseFonts(rasterPdf)).not.toContainEqual(expect.stringMatching(/LiberationSans/));
  const shotFamilies = await page.evaluate(() => ((window as Window & { __opsDomShots?: string[] }).__opsDomShots ?? [])
    .map(svg => [...svg.matchAll(/@font-face\s*\{([^}]*)\}/g)]
      .filter(([, body]) => /url\(\s*["']?data:/.test(body))
      .map(([, body]) => (/font-family:\s*["']?([^"';]+)/.exec(body)?.[1] ?? '').trim())));
  expect(shotFamilies).toContainEqual(expect.arrayContaining(['OpsReportLiberationSans']));

  await page.reload();
  await waitForOps(page);
  const recovery = page.locator('[data-ops-recovery-dialog]');
  const welcome = page.locator('[data-ops-welcome-dialog]');
  await expect(recovery.or(welcome).first()).toBeAttached({ timeout: 15_000 });
  if (await recovery.count() > 0) {
    await recovery.getByRole('button', { name: /^(Don't restore|Niet herstellen)$/ }).click();
    await expect(recovery).toHaveCount(0);
  }
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false });
  });
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  await expect(page.locator('[data-ops-report-options]').getByLabel(/^(Font:|Lettertype:)$/)).toContainText(/^Liberation Sans/);
  await page.getByLabel(/^(Report type|Rapporttype)$/).first().click();
  await page.getByRole('option', { name: /^(Gantt chart|Gantt-afdruk)$/ }).click();
  await openStep(page, 'page');
  await expect(page.getByLabel(/^(Font:|Lettertype:)$/)).toContainText(/^Liberation Sans/);

  const studioFontPicker = page.getByLabel(/^(Font:|Lettertype:)$/);
  await studioFontPicker.click();
  await page.getByRole('option', { name: /^(Other font…|Ander lettertype…)$/ }).click();
  const fontDialog = page.locator('[data-ops-custom-font-dialog]');
  await expect(fontDialog).toBeVisible();
  await fontDialog.locator('[data-ops-custom-font-file]').setInputFiles('README.md');
  await expect(fontDialog.getByRole('alert')).toContainText(/(not a readable font file|geen leesbaar lettertypebestand)/);
  await fontDialog.locator('[data-ops-custom-font-file]').setInputFiles('src/services/pdf/fonts/LiberationSerif-Regular.ttf');
  await expect(fontDialog).toHaveCount(0);
  await expect(studioFontPicker).toContainText(/^Liberation Serif \((own font|eigen lettertype)\)/);
  await expect.poll(() => loadedWeights('OpsReportCustom'), { timeout: 20_000 }).toEqual(['400', '700']);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
    .filter(n => n.messageKey === 'notifications.reportFontNoBold').map(n => n.params?.name))).toEqual(['Liberation Serif']);
  const ownFonts = type0BaseFonts(await PDFDocument.load(await exportStudioPdf(page, /\.pdf$/)));
  expect(ownFonts.filter(font => /^\/LiberationSerif-\d+$/.test(font))).toHaveLength(2);

  const pageB = await page.context().newPage();
  await pageB.goto('/');
  await waitForOps(pageB);
  await waitForWelcomeDialog(pageB);
  await pageB.evaluate(() => { window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }); });
  await pageB.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  await openStep(pageB, 'page');
  const fontPickerB = pageB.getByLabel(/^(Font:|Lettertype:)$/);
  await fontPickerB.click();
  await pageB.getByRole('option', { name: /^(Other font…|Ander lettertype…)$/ }).click();
  await pageB.locator('[data-ops-custom-font-file]').setInputFiles(['src/services/pdf/fonts/Carlito-Regular.ttf', 'src/services/pdf/fonts/Carlito-Bold.ttf']);
  await expect(fontPickerB).toContainText(/^Carlito \((own font|eigen lettertype)\)/);
  await expect(studioFontPicker).toContainText(/^Carlito \((own font|eigen lettertype)\)/);
  const storedFont = (target: Page) => target.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').customReportFont));
  const chosenByB = await storedFont(pageB);
  await page.waitForTimeout(1500);
  expect(await storedFont(page)).toBe(chosenByB);
  expect(await storedFont(pageB)).toBe(chosenByB);
  await expect(studioFontPicker).toContainText(/^Carlito /);
  const fontsA = type0BaseFonts(await PDFDocument.load(await exportStudioPdf(page, /\.pdf$/)));
  expect(fontsA).toContainEqual(expect.stringMatching(/^\/Carlito-Regular-\d+$/));
  expect(fontsA).toContainEqual(expect.stringMatching(/^\/Carlito-Bold-\d+$/));
  await pageB.close();

  await page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.deleteDatabase('ops-report-font');
    request.onsuccess = request.onerror = request.onblocked = () => resolve(null);
  }));
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}');
    localStorage.setItem('ops-reportSettings', JSON.stringify({ ...settings, studioStep: 'none' }));
  });
  await page.reload();
  await waitForOps(page);
  await expect(recovery.or(welcome).first()).toBeAttached({ timeout: 15_000 });
  if (await recovery.count() > 0) await recovery.getByRole('button', { name: /^(Don't restore|Niet herstellen)$/ }).click();
  await waitForWelcomeDialog(page);
  await page.evaluate(() => { window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }); });
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  await expect(studioFontPicker).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
    .filter(n => n.messageKey === 'notifications.reportFontMissing').map(n => n.params?.name))).toEqual(['Carlito']);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').reportFontFamily)).toBe('inter');
  await openStep(page, 'page');
  await expect(studioFontPicker).toContainText(/^Inter/);
});

for (const reportType of ['milestones', 'lookAhead'] as const) {
  test(`ontbrekend eigen lettertype valt ook bij ${reportType} terug`, async ({ page, ops: _ops }) => {
    await page.evaluate(type => {
      const settings = JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}');
      localStorage.setItem('ops-reportSettings', JSON.stringify({
        ...settings, reportType: type, reportFontFamily: 'custom',
        customReportFont: { name: 'Verdwenen letter', rev: 123 },
      }));
    }, reportType);
    await page.reload();
    await waitForOps(page);
    await waitForWelcomeDialog(page);
    await page.evaluate(() => {
      window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false });
    });
    await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-reportSettings') ?? '{}').reportFontFamily)).toBe('inter');
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
      .filter(n => n.messageKey === 'notifications.reportFontMissing').map(n => n.params?.name))).toEqual(['Verdwenen letter']);
  });
}
