import { expect, seedProject, state, test } from './fixtures/ops';

// Relatie toevoegen vanuit het eigenschappenpaneel (sectie Afhankelijkheden, 2026-09). De fixture
// (drie taken + selectie) komt via de brug; alles daarna is echte bediening: klikken op de
// toevoegknop, typen in het zoekveld, kiezen met pijltoets/Enter of met de muis, en bevestigen.
// Asserties lopen over de store — de sequences zijn de bron, niet de DOM.

test('conceptrij: zoeken met pijltoets + Enter legt een voorgangerrelatie vast', async ({ page, ops: _ops }) => {
  const [grondwerk, fundering] = await seedProject(page, [
    { name: 'Grondwerk', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Fundering', start: '2026-09-21', finish: '2026-10-02' },
    { name: 'Ruwbouw', start: '2026-10-05', finish: '2026-10-16' },
  ]);

  await page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(id);
  }, fundering);

  // Zonder relaties is de sectie nu tóch bereikbaar: de toevoegknop is de ingang.
  const add = page.locator('[data-ops-dependency-add]');
  await expect(add).toBeVisible();
  await add.click();

  const draft = page.locator('[data-ops-dependency-draft]');
  await expect(draft).toBeVisible();
  await expect(draft.locator('[data-ops-dependency-direction]')).toHaveValue('predecessor');

  const search = draft.locator('[data-ops-dependency-search]');
  await search.click();
  await search.pressSequentially('Grond');
  await expect(draft.locator('[data-ops-dependency-option="0"]')).toContainText('Grondwerk');

  // Pijl-omlaag + Enter kiest de treffer; de tweede Enter bevestigt de samengestelde relatie.
  await search.press('ArrowDown');
  await search.press('Enter');
  await draft.locator('[data-ops-dependency-type]').selectOption('START_START');
  await search.press('Enter');

  await expect(page.locator('[data-ops-dependency-draft]')).toHaveCount(0);
  await expect.poll(() => state(page).then(s => s.sequences.map(q => ({
    p: q.predecessorId, s: q.successorId, t: q.type,
  })))).toEqual([{ p: grondwerk, s: fundering, t: 'START_START' }]);
});

test('conceptrij: muiskeuze met richting Opvolger, en een duplicaat wordt geweigerd', async ({ page, ops: _ops }) => {
  const [grondwerk, fundering] = await seedProject(page, [
    { name: 'Grondwerk', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Fundering', start: '2026-09-21', finish: '2026-10-02' },
  ]);

  await page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(id);
  }, grondwerk);

  await page.locator('[data-ops-dependency-add]').click();
  const draft = page.locator('[data-ops-dependency-draft]');
  await draft.locator('[data-ops-dependency-direction]').selectOption('successor');
  await draft.locator('[data-ops-dependency-search]').click();
  await draft.locator('[data-ops-dependency-search]').pressSequentially('Fund');
  await draft.locator('[data-ops-dependency-option="0"]').click();
  await draft.locator('[data-ops-dependency-confirm]').click();

  await expect(page.locator('[data-ops-dependency-draft]')).toHaveCount(0);
  await expect.poll(() => state(page).then(s => s.sequences.map(q => ({
    p: q.predecessorId, s: q.successorId,
  })))).toEqual([{ p: grondwerk, s: fundering }]);

  // Exact dezelfde relatie nog eens: de verdict-laag weigert, het meldingenkanaal legt uit waarom,
  // en er komt geen tweede sequence bij. De conceptrij blijft staan om te corrigeren.
  await page.locator('[data-ops-dependency-add]').click();
  const again = page.locator('[data-ops-dependency-draft]');
  await again.locator('[data-ops-dependency-direction]').selectOption('successor');
  await again.locator('[data-ops-dependency-search]').click();
  await again.locator('[data-ops-dependency-search]').pressSequentially('Fund');
  await again.locator('[data-ops-dependency-option="0"]').click();
  await again.locator('[data-ops-dependency-confirm]').click();

  await expect(page.locator('.ops-toast', { hasText: /already exists|bestaat al/ })).toBeVisible();
  await expect(page.locator('[data-ops-dependency-draft]')).toBeVisible();
  await expect.poll(() => state(page).then(s => s.sequences.length)).toBe(1);

  // Escape gooit het concept weg zonder iets aan te raken.
  await again.locator('[data-ops-dependency-search]').press('Escape');
  await expect(page.locator('[data-ops-dependency-draft]')).toHaveCount(0);
  await expect.poll(() => state(page).then(s => s.sequences.length)).toBe(1);
});

// Audit taakmutaties, bevinding 9: het lag-veld commit bij elke blur. Alleen in- en uittabben
// maakte het document gewijzigd ("Unsaved"), zette de herbereken-hint aan en gaf een loze undo-stap.
// Nu is een commit zonder werkelijke wijziging een no-op, zoals in het raster en via MCP.
test('lag-veld: in- en uittabben zonder wijziging raakt het document niet', async ({ page, ops: _ops }) => {
  const [grondwerk, fundering] = await seedProject(page, [
    { name: 'Grondwerk', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Fundering', start: '2026-09-21', finish: '2026-10-02' },
  ]);
  await page.evaluate(({ from, to }) => {
    const store = window.__OPS__!.store;
    const s = store.getState();
    s.addSequence({ predecessorId: from, successorId: to, type: 'FINISH_START', lagDays: 2 });
    s.runCPM();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(to);
    store.setState({ isDirty: false });
  }, { from: grondwerk, to: fundering });
  const documentState = () => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return { isDirty: s.isDirty, stale: s.scheduleStale };
  });
  const before = await state(page);
  expect(await documentState()).toEqual({ isDirty: false, stale: false });

  const lag = page.locator('.dependency-lag-field').first();
  await expect(lag).toHaveValue('+2d');
  await lag.click();
  await page.keyboard.press('Tab');
  await lag.click();
  await page.keyboard.press('Tab');

  expect(await documentState()).toEqual({ isDirty: false, stale: false });
  expect((await state(page)).undoDepth).toBe(before.undoDepth);
  expect((await state(page)).sequences).toEqual(before.sequences);

  // Een echte wijziging blijft gewoon één undo-stap.
  await lag.click();
  await lag.fill('3d');
  await page.keyboard.press('Tab');
  await expect.poll(() => state(page).then(s => s.sequences.map(q => q.lagDays))).toEqual([3]);
  expect((await state(page)).undoDepth).toBe(before.undoDepth + 1);
  expect(await documentState()).toEqual({ isDirty: true, stale: true });
});
