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
    verticalY: document.querySelector<HTMLElement>('[data-task-grid-surface-id="gantt-task-grid"] [role="grid"]')?.scrollTop,
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
    ratio: 0.68, zoom: 48, scrollX: 360, scrollY: 190, secondaryZoom: 28, secondaryScrollX: 275,
  };
  await configureDocument(page, bIds[5], viewB);

  await page.locator(`[data-testid="document-tab"][data-ops-tab="${aId}"]`).click();
  await expectDocument(page, aId, 'Document A', aIds[3], viewA);

  await page.locator(`[data-testid="document-tab"][data-ops-tab="${bId}"]`).click();
  await expectDocument(page, bId, 'Document B', bIds[5], viewB);
});

// Andere beginstand en doel dan de Gantt-scrollroute hierboven: een gekoppeld, gewijzigd
// document bewerken via de IFC-editor, daarna undo/redo, wisselen en veilig sluiten (knownbug 127).
test('IFC toepassen behoudt documentbinding en sluitwaarschuwing, met één undo-stap', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Voor IFC-bewerking', start: '2026-09-07', finish: '2026-09-08', durationDays: 2 },
  ], 'IFC-editorproject');
  const otherId = await page.evaluate(() => {
    const s = () => window.__OPS__!.store.getState();
    const companyId = s().seedDemoLibrary();
    s().bindProjectToCompany(companyId);
    const pool = s().pools[companyId];
    s().addLibraryResourceToProject(companyId, pool.resources[0].id);
    const calendar = s().addLibraryCalendarToProject(companyId, pool.calendars[0].id);
    s().setProjectCalendar(calendar.calendarId!);
    s().setFilePath('editor.ifc');
    // Alleen fixturedata: geen opslagactie. De versie moet de basis voor de volgende opslag blijven.
    window.__OPS__!.store.setState({ siteFileId: 'site-editor', siteFileVersion: 'version-17' });
    s().runCPM();
    const sourceId = s().activeDocumentId;
    const secondId = s().newDocument();
    s().setProject({ name: 'Ander document' });
    s().switchDocument(sourceId);
    return secondId;
  });
  const identity = () => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return {
      documentId: s.activeDocumentId,
      documentCount: s.documents.length,
      projectId: s.project.id,
      companyId: s.project.companyId,
      companyName: s.project.companyName,
      resourceOrigin: s.resources[0].libraryOrigin,
      calendarOrigin: s.calendar.libraryOrigin,
      filePath: s.filePath,
      siteFileId: s.siteFileId,
      siteFileVersion: s.siteFileVersion,
      isDirty: s.isDirty,
    };
  });
  const before = await identity();
  const undoBefore = (await state(page)).undoDepth;
  expect(before.isDirty).toBe(true);
  expect(before.resourceOrigin).toBeDefined();
  expect(before.calendarOrigin).toBeDefined();

  await page.locator('[data-ops-ribbon-tab="ifc"]').click();
  const editor = page.locator('textarea:visible');
  await expect(editor).toHaveValue(/Voor IFC-bewerking/);
  const sourceText = await editor.inputValue();
  const editedText = sourceText.replace(/(=IFCTASK\('[^']*',#\d+,)'Voor IFC-bewerking'/, "$1'Na IFC-bewerking'");
  // De eerste losse naam staat in IFCTASKTIME; wijzig doelgericht het IFCTASK-naamslot.
  expect(editedText.match(/^#\d+=IFCTASK\(.*$/gm)).toHaveLength(1);
  expect(/=IFCTASK\('[^']*',#\d+,'([^']*)'/.exec(editedText)?.[1]).toBe('Na IFC-bewerking');
  expect(editedText.match(/^#\d+=IFCTASKTIME\(.*$/gm)).toEqual(sourceText.match(/^#\d+=IFCTASKTIME\(.*$/gm));
  await editor.fill(editedText);
  await expect(editor).toHaveValue(editedText);
  const apply = page.getByRole('button', { name: /^(Apply|Toepassen)$/ });
  await apply.click();
  await expect.poll(() => state(page).then(s => s.tasks[0]?.name)).toBe('Na IFC-bewerking');
  await expect(apply).toBeDisabled();
  expect(await identity()).toEqual(before);
  expect((await state(page)).undoDepth).toBe(undoBefore + 1);

  // Toetsen in de planning bedienen document-undo; in de teksteditor hebben ze hun native betekenis.
  await page.locator('[data-ops-ribbon-tab="start"]').click();
  await page.keyboard.press('Control+z');
  await expect.poll(() => state(page).then(s => s.tasks[0]?.name)).toBe('Voor IFC-bewerking');
  expect(await identity()).toEqual(before);
  await page.keyboard.press('Control+y');
  await expect.poll(() => state(page).then(s => s.tasks[0]?.name)).toBe('Na IFC-bewerking');

  await page.locator(`[data-ops-tab="${otherId}"]`).click();
  await page.locator(`[data-ops-tab="${before.documentId}"]`).click();
  await expect.poll(identity).toEqual(before);
  await page.locator(`[data-ops-tab="${before.documentId}"]`).locator('..')
    .getByRole('button', { name: /^(Close|Sluiten) / }).click();
  const closeDialog = page.locator('[data-ops-close-dialog]');
  await expect(closeDialog).toBeVisible();
  await closeDialog.getByRole('button', { name: /^(Cancel|Annuleren)$/ }).click();
  await expect(closeDialog).toHaveCount(0);
  expect(await identity()).toEqual(before);
});
