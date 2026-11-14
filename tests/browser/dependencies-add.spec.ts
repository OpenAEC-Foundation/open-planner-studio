import { expect, seedProject, state, test } from './fixtures/ops';

// Relatie toevoegen vanuit het eigenschappenpaneel (sectie Afhankelijkheden, 2026-09). De fixture
// (taken + selectie) komt via de brug; alles daarna is echte bediening: klikken op de
// toevoegknop, typen in het zoekveld, kiezen met pijltoets/Enter of met de muis, en bevestigen.
// Asserties lopen over de store — de sequences zijn de bron, niet de DOM.

test('conceptrij: zoeken met pijltoets + Enter legt een voorgangerrelatie vast', async ({ page, ops: _ops }) => {
  const ids = await seedProject(page, [
    { name: 'Grondwerk', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Fundering', start: '2026-09-21', finish: '2026-10-02' },
    { name: 'Ruwbouw', start: '2026-10-05', finish: '2026-10-16' },
    ...Array.from({ length: 10 }, (_, i) => ({
      name: `Extra werk ${i}`, start: '2026-10-05', finish: '2026-10-16',
    })),
  ]);
  const [grondwerk, fundering] = ids;

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
  await expect(draft.locator('[data-ops-dependency-direction]')).toHaveAttribute('data-ops-dependency-direction', 'predecessor');

  const search = draft.locator('[data-ops-dependency-search]');
  const options = draft.locator('[data-ops-dependency-option]');
  const firstEight = await page.evaluate(id => window.__OPS__!.store.getState().tasks
    .filter(task => task.id !== id).slice(0, 8).map(task => `${task.wbsCode} ${task.name}`.trim()), fundering);
  await expect(options).toHaveText(firstEight);
  const before = await state(page);
  await search.press('ArrowDown');
  await expect(options.nth(1)).toHaveAttribute('data-ops-dependency-highlighted', 'true');
  await search.press('ArrowUp');
  await expect(options.nth(0)).toHaveAttribute('data-ops-dependency-highlighted', 'true');
  await search.pressSequentially('Extra werk');
  await expect(options).toHaveCount(8);
  await search.fill('Extra werk 9');
  await expect(options).toHaveCount(1);
  await expect(options).toContainText('Extra werk 9');

  // Een vervangende takenarray moet dezelfde open zoekroute direct verversen, ook bij undo.
  const last = ids[ids.length - 1]!;
  await page.evaluate(id => window.__OPS__!.store.getState().updateTask(id, { name: 'Nieuwe naam' }), last);
  await expect(options).toHaveCount(0);
  await search.fill('Nieuwe naam');
  await expect(options).toHaveCount(1);
  await page.evaluate(() => window.__OPS__!.store.getState().undo());
  await expect(options).toHaveCount(0);
  // WBS komt normaal uit hiërarchiebewerkingen; hier wisselt alleen de fixture buiten de meting.
  await page.evaluate(id => {
    const store = window.__OPS__!.store;
    store.setState({ tasks: store.getState().tasks.map(task => task.id === id ? { ...task, wbsCode: '9.8' } : task) });
  }, last);
  await search.fill('9.8 Extra werk 9');
  await expect(options).toHaveText(['9.8 Extra werk 9']);
  await search.press('Escape');
  await expect(draft).toHaveCount(0);
  expect((await state(page)).sequences).toEqual(before.sequences);
  expect((await state(page)).undoDepth).toBe(before.undoDepth);

  // Een selectiewissel wist een open concept; opnieuw openen gebruikt de nieuwe eigenaar.
  await add.click();
  await page.locator(`[data-grid-data-row="true"][data-grid-row-key="${grondwerk}"] [data-grid-column-id="task.name"]`).first().click();
  await expect(draft).toHaveCount(0);
  await page.locator(`[data-grid-data-row="true"][data-grid-row-key="${fundering}"] [data-grid-column-id="task.name"]`).first().click();
  await add.click();
  await search.click();
  await search.pressSequentially('Grond');
  await expect(draft.locator('[data-ops-dependency-option="0"]')).toContainText('Grondwerk');

  // Pijl-omlaag + Enter kiest de treffer; de tweede Enter bevestigt de samengestelde relatie.
  await search.press('ArrowDown');
  await search.press('Enter');
  await draft.locator('[data-ops-dependency-type] .ops-select__trigger').click();
  await page.getByRole('option', { name: 'SS', exact: true }).click();
  const lag = draft.locator('.dependency-lag-field');
  await lag.fill('2d');
  await search.click();
  expect((await state(page)).sequences).toEqual(before.sequences);
  expect((await state(page)).undoDepth).toBe(before.undoDepth);
  await search.press('Enter');

  await expect(page.locator('[data-ops-dependency-draft]')).toHaveCount(0);
  await expect.poll(() => state(page).then(s => s.sequences.map(q => ({
    p: q.predecessorId, s: q.successorId, t: q.type,
  })))).toEqual([{ p: grondwerk, s: fundering, t: 'START_START' }]);
  expect((await state(page)).sequences[0]?.lagDays).toBe(2);
  expect((await state(page)).undoDepth).toBe(before.undoDepth + 1);
  await page.keyboard.press('Control+z');
  await expect.poll(() => state(page).then(s => s.sequences)).toEqual(before.sequences);
  expect((await state(page)).undoDepth).toBe(before.undoDepth);
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
  await draft.locator('[data-ops-dependency-direction] .ops-select__trigger').click();
  await page.getByRole('option', { name: /^(Successor|Opvolger)$/ }).click();
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
  await again.locator('[data-ops-dependency-direction] .ops-select__trigger').click();
  await page.getByRole('option', { name: /^(Successor|Opvolger)$/ }).click();
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

// Terug en vooruit (issue #888, eigenaarsbesluit 2026-11-14 "3"): alleen sprongen via het paneel
// tellen. Een eigen klik in de taaktabel telt niet mee en wist het spoor ook niet.
test('terug en vooruit lopen de sprongen via het paneel af, een klik in de tabel telt niet', async ({ page, ops: _ops }) => {
  const ids = await seedProject(page, [
    { name: 'Grondwerk', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Fundering', start: '2026-09-21', finish: '2026-10-02' },
    { name: 'Ruwbouw', start: '2026-10-05', finish: '2026-10-16' },
    { name: 'Afbouw', start: '2026-10-05', finish: '2026-10-16' },
  ]);
  const [grondwerk, fundering, ruwbouw, afbouw] = ids;
  await page.evaluate(([a, b, c]) => {
    const s = window.__OPS__!.store.getState();
    s.addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
    s.addSequence({ predecessorId: b, successorId: c, type: 'FINISH_START', lagDays: 0 });
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(c);
  }, [grondwerk, fundering, ruwbouw]);

  const active = () => page.evaluate(() => window.__OPS__!.store.getState().activeTaskId);
  const back = page.locator('[data-ops-dependency-trail="back"]');
  const forward = page.locator('[data-ops-dependency-trail="forward"]');
  const link = (role: 'predecessor' | 'successor') => page.locator(`.dependency-wbs-link[data-dependency-role="${role}"]`);
  const wbs = async (id: string) => page.evaluate(i => {
    const task = window.__OPS__!.store.getState().tasks.find(t => t.id === i)!;
    return `${task.wbsCode} ${task.name}`.trim();
  }, id);

  // Nog geen sprong: beide pijlen grijs.
  await expect(back).toBeDisabled();
  await expect(forward).toBeDisabled();

  // Backward pass: Ruwbouw → Fundering → Grondwerk via de nummers in het paneel.
  await link('predecessor').click();
  await expect.poll(active).toBe(fundering);
  await link('predecessor').click();
  await expect.poll(active).toBe(grondwerk);
  await expect(back).toBeEnabled();
  await expect(back).toHaveAttribute('title', new RegExp(`${await wbs(fundering)}$`));
  await expect(forward).toBeDisabled();
  const undoDepth = (await state(page)).undoDepth;

  // Een eigen klik in de tabel: het spoor blijft, terug wijst nog naar Fundering.
  await page.locator(`[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key="${afbouw}"] [data-grid-column-id="task.name"]`).click();
  await expect.poll(active).toBe(afbouw);
  await expect(back).toHaveAttribute('title', new RegExp(`${await wbs(fundering)}$`));
  await back.click();
  await expect.poll(active).toBe(fundering);
  await back.click();
  await expect.poll(active).toBe(ruwbouw);
  await expect(back).toBeDisabled();
  await forward.click();
  await expect.poll(active).toBe(fundering);
  await expect(forward).toHaveAttribute('title', new RegExp(`${await wbs(grondwerk)}$`));

  // De focus staat in de bovenste relatie (de uitlegzin staat eronder). Een klik op de onderste
  // springt toch: de zin verhuist pas na het loslaten, anders schuift de knop onder de muis weg.
  await page.locator('.dependency-item').first().locator('.dependency-lag-field').click();
  await expect(page.locator('.dependency-item').first().locator('.relation-sentence')).toBeVisible();
  // Een nieuwe sprong vanaf het midden vervangt wat vooruit lag, zoals in een browser.
  await link('successor').click();
  await expect.poll(active).toBe(ruwbouw);
  await expect(forward).toBeDisabled();

  // Lopen door het spoor verandert de planning niet.
  expect((await state(page)).undoDepth).toBe(undoDepth);
});
