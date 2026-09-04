// Karakterisering voor expliciete canvas- en documentinvalidatie. Fixtures bouwen alleen de
// deterministische toestand; thema-, splitter-, Gantt- en documenttabhandelingen zijn echte
// browserevents. Na elke paint-trigger volgen twee rustige vensters van 500 ms.
import type { Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';

type PaintSurface = 'primary' | 'histogram';

async function paintCount(page: Page, surface: PaintSurface): Promise<number> {
  return page.evaluate(requested => window.__OPS__!.gantt.paintCount(requested), surface);
}

async function waitForFontsAndTwoQuietWindows(page: Page, surface: PaintSurface): Promise<number> {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(500);
  const afterFirst = await paintCount(page, surface);
  await page.waitForTimeout(500);
  const afterSecond = await paintCount(page, surface);
  expect(afterSecond, `${surface} bleef tekenen tijdens het tweede rustige venster`).toBe(afterFirst);
  return afterSecond;
}

async function canvasDataUrl(page: Page, selector: string): Promise<string> {
  return page.locator(selector).evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
}

async function addLibraryBooking(page: Page, taskId: string, label: string): Promise<{
  companyId: string;
  poolResourceId: string;
}> {
  return page.evaluate(({ id, name }) => {
    const s = window.__OPS__!.store.getState();
    const companyId = s.addCompany(`${name} bibliotheek`);
    const poolResourceId = s.addPoolResource(companyId, {
      name: `${name} kraan`,
      type: 'LABOR',
      description: '',
      maxUnits: 2,
    });
    if (!poolResourceId) throw new Error('poolresource kon niet worden aangemaakt');
    s.bindProjectToCompany(companyId);
    const materialized = s.addLibraryResourceToProject(companyId, poolResourceId);
    if (!materialized.resourceId) throw new Error('poolresource kon niet worden gematerialiseerd');
    s.assignResource(id, materialized.resourceId, 1);
    s.runCPM();
    return { companyId, poolResourceId };
  }, { id: taskId, name: label });
}

async function openOccupancyWithRealClick(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({
      showResourcePanel: true,
      resourcePanelDocked: false,
      resourcesView: 'project',
    });
  });
  await page.locator('[data-ops-occupancy-view-button]').click();
  await expect(page.locator('[data-ops-occupancy-view]')).toBeVisible();
}

test('theme switch tekent Gantt en minimap opnieuw en wordt daarna stil', async ({ page, ops: _ops }) => {
  await seedProject(page, [{
    name: 'Themataak',
    start: '2026-09-07',
    finish: '2026-09-18',
    durationDays: 10,
  }]);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showMiniMap: true }));
  const miniMap = page.getByTestId('minimap').locator('canvas');
  await expect(miniMap).toBeVisible();
  await waitForFontsAndTwoQuietWindows(page, 'primary');

  const before = {
    paint: await paintCount(page, 'primary'),
    gantt: await canvasDataUrl(page, '[data-testid="gantt-primary-canvas"]'),
    minimap: await canvasDataUrl(page, '[data-testid="minimap"] canvas'),
  };

  // Het openen mag fixturematig; de geteste gebruikershandeling is de echte klik op de themakaart.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const settings = page.getByRole('dialog');
  await expect(settings).toBeVisible();
  await settings.locator('[data-ops-theme-card="high-contrast"]').click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme))
    .toBe('high-contrast');
  await expect.poll(() => paintCount(page, 'primary')).toBeGreaterThan(before.paint);
  await expect.poll(() => canvasDataUrl(page, '[data-testid="gantt-primary-canvas"]')).not.toBe(before.gantt);
  await expect.poll(() => canvasDataUrl(page, '[data-testid="minimap"] canvas')).not.toBe(before.minimap);
  await waitForFontsAndTwoQuietWindows(page, 'primary');
});

test('histogramsplitter tekent de nieuwe hoogte en veroorzaakt geen ResizeObserver-loop', async ({ page, ops: _ops }) => {
  await seedProject(page, [{
    name: 'Histogramtaak',
    start: '2026-09-07',
    finish: '2026-09-18',
    durationDays: 10,
  }]);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showHistogram: true }));
  await expect(page.getByTestId('gantt-histogram-canvas')).toBeVisible();
  const beforePaint = await waitForFontsAndTwoQuietWindows(page, 'histogram');
  const beforeHeight = await page.evaluate(() => window.__OPS__!.store.getState().ui.histogramHeight);

  const splitter = page.locator('.histogram-splitter');
  const box = await splitter.boundingBox();
  if (!box) throw new Error('histogramsplitter heeft geen geometrie');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 36, { steps: 4 });
  await page.mouse.up();

  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.histogramHeight))
    .toBeGreaterThan(beforeHeight);
  await expect.poll(() => paintCount(page, 'histogram')).toBeGreaterThan(beforePaint);
  const expectedHeight = await page.evaluate(() => window.__OPS__!.store.getState().ui.histogramHeight);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.gantt.lastSize('histogram')?.height))
    .toBe(expectedHeight);
  await waitForFontsAndTwoQuietWindows(page, 'histogram');
});

test('occupancy ververst na actieve-documentedit zonder documentwissel', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{
    name: 'Bezettingstaak',
    start: '2026-09-07',
    finish: '2026-09-18',
    durationDays: 10,
  }], 'Bezettingsproject');
  const { poolResourceId } = await addLibraryBooking(page, taskId, 'Actief');
  const documentId = (await state(page)).activeDocumentId;
  await openOccupancyWithRealClick(page);
  const row = page.locator(`[data-ops-occupancy-row="${poolResourceId}"]`);
  await expect(row).toBeVisible();
  const beforeText = await row.innerText();

  // Het volledige resourcepaneel blijft gemount terwijl de taakdialoog erboven opent. De
  // toewijzingseenheden zijn in deze gedeelde sectie direct-storeful: typen is dus de echte
  // gebruikershandeling en moet het onderliggende overzicht meteen invalidateren.
  await page.evaluate(id => window.__OPS__!.store.getState().setUI({
    showTaskDialog: true,
    editingTaskId: id,
  }), taskId);
  const taskDialog = page.locator('[data-ops-task-dialog]');
  await expect(taskDialog).toBeVisible();
  const units = taskDialog.locator('input[type="number"][step="any"]');
  await expect(units).toHaveCount(1);
  await units.fill('1.5');

  await expect.poll(() => row.innerText()).not.toBe(beforeText);
  expect((await state(page)).activeDocumentId).toBe(documentId);
});

test('occupancy gebruikt na echte documenttabwissel de nieuwe company- en poolcache', async ({ page, ops: _ops }) => {
  const [taskA] = await seedProject(page, [{
    name: 'Document A taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10,
  }], 'Document A');
  const a = await addLibraryBooking(page, taskA, 'A');
  const documentA = (await state(page)).activeDocumentId;

  const documentB = await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  const [taskB] = await seedProject(page, [{
    name: 'Document B taak', start: '2026-10-05', finish: '2026-10-16', durationDays: 10,
  }], 'Document B');
  const b = await addLibraryBooking(page, taskB, 'B');
  await openOccupancyWithRealClick(page);
  await expect(page.locator(`[data-ops-occupancy-row="${b.poolResourceId}"]`)).toBeVisible();
  await expect(page.locator(`[data-ops-occupancy-row="${a.poolResourceId}"]`)).toHaveCount(0);

  await page.locator(`[data-testid="document-tab"][data-ops-tab="${documentA}"]`).click();
  await expect.poll(() => state(page).then(snapshot => snapshot.activeDocumentId)).toBe(documentA);
  // De bestaande documentgrens zet deze app-globale paneelkeuze bewust terug naar Project;
  // opnieuw op Occupancy klikken is daarom onderdeel van de echte gebruikershandeling.
  await page.locator('[data-ops-occupancy-view-button]').click();
  await expect(page.locator(`[data-ops-occupancy-row="${a.poolResourceId}"]`)).toBeVisible();
  await expect(page.locator(`[data-ops-occupancy-row="${b.poolResourceId}"]`)).toHaveCount(0);

  await page.locator(`[data-testid="document-tab"][data-ops-tab="${documentB}"]`).click();
  await page.locator('[data-ops-occupancy-view-button]').click();
  await expect(page.locator(`[data-ops-occupancy-row="${b.poolResourceId}"]`)).toBeVisible();
});
