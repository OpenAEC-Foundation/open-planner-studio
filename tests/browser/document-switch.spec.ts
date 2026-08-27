// Karakterisering vóór contextisolatie: documenttabs moeten zowel documentdata als alle drie de
// Gantt-scrollposities uit de geparkeerde payload herstellen.
import type { Page } from '@playwright/test';
import { barPoint, expect, seedProject, state, test } from './fixtures/ops';

interface ViewFixture {
  ratio: number;
  zoom: number;
  scrollX: number;
  scrollY: number;
  secondaryZoom: number;
  secondaryScrollX: number;
}

function taskInputs(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `${prefix} ${index + 1}`,
    start: '2026-09-07',
    finish: '2026-09-18',
    durationDays: 10,
  }));
}

async function configureDocument(page: Page, selectedTaskId: string, view: ViewFixture): Promise<void> {
  await page.evaluate(({ taskId, fixture }) => {
    const s = window.__OPS__!.store.getState();
    s.setZoom(fixture.zoom);
    s.setSplitView({
      ratio: fixture.ratio,
      secondaryZoom: fixture.secondaryZoom,
      secondaryScrollX: fixture.secondaryScrollX,
    });
    s.setScroll(fixture.scrollX, fixture.scrollY);
    s.selectTask(taskId);
  }, { taskId: selectedTaskId, fixture: view });
  await expect.poll(() => state(page).then(snapshot => ({
    zoom: snapshot.view.zoom,
    scrollX: snapshot.view.scrollX,
    scrollY: snapshot.view.scrollY,
    selected: snapshot.selectedTaskIds,
  }))).toEqual({
    zoom: view.zoom,
    scrollX: view.scrollX,
    scrollY: view.scrollY,
    selected: [selectedTaskId],
  });
}

async function expectDocument(page: Page, documentId: string, prefix: string, selectedTaskId: string, view: ViewFixture) {
  await expect.poll(() => state(page).then(snapshot => snapshot.activeDocumentId)).toBe(documentId);
  const snapshot = await state(page);
  expect(snapshot.tasks.every(task => task.name.startsWith(prefix))).toBe(true);
  expect(snapshot.selectedTaskIds).toEqual([selectedTaskId]);
  expect(snapshot.view.zoom).toBe(view.zoom);
  expect(snapshot.view.scrollX).toBe(view.scrollX);
  expect(snapshot.view.scrollY).toBe(view.scrollY);
  expect(snapshot.view.splitView).toEqual({
    ratio: view.ratio,
    secondaryZoom: view.secondaryZoom,
    secondaryScrollX: view.secondaryScrollX,
  });

  await expect(page.getByTestId('gantt-secondary-canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    primaryX: document.querySelector<HTMLElement>('[data-testid="gantt-hscroll"]')?.scrollLeft,
    secondaryX: document.querySelector<HTMLElement>('[data-testid="gantt-hscroll-secondary"]')?.scrollLeft,
    verticalY: document.querySelector<HTMLElement>('[data-testid="gantt-vscroll"]')?.scrollTop,
  }))).toEqual({
    primaryX: view.scrollX,
    secondaryX: view.secondaryScrollX,
    verticalY: view.scrollY,
  });
}

test('Gantt documenttabs herstellen beide paneviews en DOM-scrollbars', async ({ page, ops: _ops }) => {
  const aIds = await seedProject(page, taskInputs('Document A', 45), 'Document A');
  const aId = (await state(page)).activeDocumentId;
  await barPoint(page, aIds[0]);
  const viewA: ViewFixture = {
    ratio: 0.42, zoom: 36, scrollX: 210, scrollY: 84, secondaryZoom: 22, secondaryScrollX: 130,
  };
  await configureDocument(page, aIds[3], viewA);

  const bId = await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  const bIds = await seedProject(page, taskInputs('Document B', 48), 'Document B');
  await barPoint(page, bIds[0]);
  const viewB: ViewFixture = {
    ratio: 0.68, zoom: 48, scrollX: 360, scrollY: 196, secondaryZoom: 28, secondaryScrollX: 275,
  };
  await configureDocument(page, bIds[5], viewB);

  await page.locator(`[data-testid="document-tab"][data-ops-tab="${aId}"]`).click();
  await expectDocument(page, aId, 'Document A', aIds[3], viewA);

  await page.locator(`[data-testid="document-tab"][data-ops-tab="${bId}"]`).click();
  await expectDocument(page, bId, 'Document B', bIds[5], viewB);
});
