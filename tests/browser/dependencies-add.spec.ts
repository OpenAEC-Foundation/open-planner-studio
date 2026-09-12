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
