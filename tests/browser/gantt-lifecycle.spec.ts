// Observer-only rendererkarakterisering vóór hostextractie. `paintCount`/`lastSize` starten geen
// paint; elke trigger hieronder komt van een echte mount, resize of instellingenhandeling.
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { barPoint, expect, seedProject, test } from './fixtures/ops';

type Surface = 'primary' | 'secondary' | 'histogram';

test('Gantt lifecycle: rendererconstructors hebben uitsluitend de rendererhost als eigenaar', () => {
  const shell = readFileSync(resolve(process.cwd(), 'src/components/canvas/GanttCanvas.tsx'), 'utf8');
  const host = readFileSync(
    resolve(process.cwd(), 'src/components/canvas/hooks/useGanttRendererHost.ts'),
    'utf8',
  );

  // Vóór de extractie stonden hier aantoonbaar twee Gantt- en één histogramconstructor. Deze
  // negatieve poort blijft daarna bewaken dat de React-shell niet opnieuw rendererlevenscyclus
  // aantrekt en dat de host voor beide Gantt-panes één gedeelde constructieroute gebruikt.
  expect(shell.match(/new GanttRenderer\(/g) ?? []).toHaveLength(0);
  expect(shell.match(/new HistogramRenderer\(/g) ?? []).toHaveLength(0);
  expect(host.match(/new GanttRenderer\(/g) ?? []).toHaveLength(1);
  expect(host.match(/new HistogramRenderer\(/g) ?? []).toHaveLength(1);
});

async function paintCount(page: Page, surface: Surface): Promise<number> {
  return page.evaluate(requested => window.__OPS__!.gantt.paintCount(requested), surface);
}

async function waitForTwoQuietWindows(page: Page, surface: Surface): Promise<number> {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(500);
  const first = await paintCount(page, surface);
  await page.waitForTimeout(500);
  const second = await paintCount(page, surface);
  expect(second, `${surface} bleef tekenen in het tweede rustige venster`).toBe(first);
  return second;
}

test('Gantt lifecycle: primary mount en echte viewportresize eindigen stil', async ({ page, ops: _ops }) => {
  await seedProject(page, [{
    name: 'Lifecycle primary', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }]);
  await expect(page.getByTestId('gantt-primary-canvas')).toBeVisible();
  const beforePaint = await waitForTwoQuietWindows(page, 'primary');
  const beforeSize = await page.evaluate(() => window.__OPS__!.gantt.lastSize('primary'));
  expect(beforeSize?.width).toBeGreaterThan(0);
  expect(beforeSize?.height).toBeGreaterThan(0);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  await page.setViewportSize({ width: viewport!.width + 120, height: viewport!.height + 70 });

  await expect.poll(() => paintCount(page, 'primary')).toBeGreaterThan(beforePaint);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.gantt.lastSize('primary')))
    .not.toEqual(beforeSize);
  await waitForTwoQuietWindows(page, 'primary');
});

test('Gantt lifecycle: secondary uit en opnieuw aan levert geen stale rendererref', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{
    name: 'Lifecycle secondary', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }]);
  await page.evaluate(() => window.__OPS__!.store.getState().setSplitView({
    ratio: 0.55,
    secondaryZoom: 36,
    secondaryScrollX: 0,
  }));
  await expect(page.getByTestId('gantt-secondary-canvas')).toBeVisible();
  await barPoint(page, taskId, 'body', 'secondary');
  const beforeOff = await waitForTwoQuietWindows(page, 'secondary');

  await page.evaluate(() => window.__OPS__!.store.getState().setSplitView(undefined));
  await expect(page.getByTestId('gantt-secondary-canvas')).toHaveCount(0);
  expect(await page.evaluate(id => window.__OPS__!.gantt.taskBarPoint(id, 'body', 'secondary'), taskId))
    .toBeNull();

  await page.evaluate(() => window.__OPS__!.store.getState().setSplitView({
    ratio: 0.62,
    secondaryZoom: 28,
    secondaryScrollX: 40,
  }));
  await expect(page.getByTestId('gantt-secondary-canvas')).toBeVisible();
  await expect.poll(() => paintCount(page, 'secondary')).toBeGreaterThan(beforeOff);
  await barPoint(page, taskId, 'body', 'secondary');
  await waitForTwoQuietWindows(page, 'secondary');
});

test('Gantt lifecycle: histogram uit en opnieuw aan koppelt een levende surface', async ({ page, ops: _ops }) => {
  await seedProject(page, [{
    name: 'Lifecycle histogram', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }]);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showHistogram: true }));
  await expect(page.getByTestId('gantt-histogram-canvas')).toBeVisible();
  const beforeOff = await waitForTwoQuietWindows(page, 'histogram');

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showHistogram: false }));
  await expect(page.getByTestId('gantt-histogram-canvas')).toHaveCount(0);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showHistogram: true }));
  await expect(page.getByTestId('gantt-histogram-canvas')).toBeVisible();
  await expect.poll(() => paintCount(page, 'histogram')).toBeGreaterThan(beforeOff);
  await waitForTwoQuietWindows(page, 'histogram');
});

test('Gantt lifecycle: echte thema- en fontkeuze veroorzaken eindige paints', async ({ page, ops: _ops }) => {
  await seedProject(page, [{
    name: 'Lifecycle instellingen', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }]);
  const beforeTheme = await waitForTwoQuietWindows(page, 'primary');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByText(/^(Hoog contrast|High Contrast)$/).click();
  await expect.poll(() => paintCount(page, 'primary')).toBeGreaterThan(beforeTheme);
  const afterTheme = await waitForTwoQuietWindows(page, 'primary');

  const font = dialog.getByRole('button', { name: /^(Lettertype|Font)$/ });
  await font.click();
  await page.getByRole('option', { name: 'Monospace' }).click();
  await expect.poll(() => paintCount(page, 'primary')).toBeGreaterThan(afterTheme);
  await waitForTwoQuietWindows(page, 'primary');
});
