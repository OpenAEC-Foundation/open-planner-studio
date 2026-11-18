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

  // Meerdere voorgangers tegelijk (issue #888, besluit Ethan 2026-11-14 "1"): vinkjes in dezelfde
  // zoekrij. Met het toetsenbord: zoeken, Enter vinkt aan; opnieuw zoeken houdt de keuze vast; een
  // Enter met de lijst dicht legt alles vast als één stap.
  const picked = draft.locator('[data-ops-dependency-picked]');
  const extra = (n: number) => ids[3 + n]!;
  await add.click();
  await search.pressSequentially('Grond');
  await search.press('Enter');
  await expect(picked).toHaveCount(1);
  await search.fill('Extra werk 4');
  await expect(options).toHaveCount(1);
  await search.press('Enter');
  await expect(picked).toHaveCount(2);
  await expect(draft.locator('[data-ops-dependency-confirm]')).toHaveAttribute('aria-label', /2/);
  await search.press('Enter');
  await expect(page.locator('[data-ops-dependency-draft]')).toHaveCount(0);
  await expect.poll(() => state(page).then(s => s.sequences.map(q => [q.predecessorId, q.successorId]))).toEqual([
    [grondwerk, fundering], [extra(4), fundering],
  ]);
  expect((await state(page)).undoDepth).toBe(before.undoDepth + 1);
  await page.keyboard.press('Control+z');
  await expect.poll(() => state(page).then(s => s.sequences)).toEqual(before.sequences);

  // Met de muis: een klik vinkt aan en laat de lijst open; nog eens klikken haalt het vinkje weg,
  // het kruisje op een label ook. Type en lag gelden voor alle gekozen taken.
  await add.click();
  await search.pressSequentially('Extra werk');
  await options.nth(1).click();
  await options.nth(2).click();
  await options.nth(3).click();
  await expect(options).toHaveCount(8);
  await expect(draft.locator('[role="option"][aria-selected="true"]')).toHaveCount(3);
  await options.nth(2).click();
  await expect(draft.locator('[role="option"][aria-selected="true"]')).toHaveCount(2);
  await expect(picked).toHaveCount(2);
  await picked.first().locator('[data-ops-dependency-unpick]').click();
  await expect(picked).toHaveCount(1);
  await options.nth(5).click();
  await expect(picked).toHaveCount(2);
  // Enter met de lijst open op een al aangevinkte treffer sluit alleen de lijst; pas de volgende
  // Enter (of het vinkje) legt vast. Zo blijft er ruimte om type en lag in te stellen.
  for (let i = 0; i < 3; i++) await search.press('ArrowDown');
  await expect(options.nth(3)).toHaveAttribute('data-ops-dependency-highlighted', 'true');
  await search.press('Enter');
  await expect(options).toHaveCount(0);
  await expect(picked).toHaveCount(2);
  expect((await state(page)).sequences).toEqual(before.sequences);
  await draft.locator('.dependency-lag-field').fill('1d');
  await draft.locator('[data-ops-dependency-confirm]').click();
  await expect(page.locator('[data-ops-dependency-draft]')).toHaveCount(0);
  await expect.poll(() => state(page).then(s => s.sequences.map(q => [q.predecessorId, q.lagDays]))).toEqual([
    [extra(3), 1], [extra(5), 1],
  ]);
  expect((await state(page)).undoDepth).toBe(before.undoDepth + 1);

  // Deels geweigerd: Extra werk 3 bestaat al, Extra werk 6 komt erbij. Het concept blijft staan met
  // de weigering aangevinkt, en Ctrl+Z neemt de toevoeging terug (niet het typen in het zoekveld).
  await add.click();
  await search.pressSequentially('Extra werk 3');
  await search.press('Enter');
  await search.fill('Extra werk 6');
  await search.press('Enter');
  await search.press('Enter');
  await expect.poll(() => state(page).then(s => s.sequences.map(q => q.predecessorId))).toEqual([extra(3), extra(5), extra(6)]);
  await expect(draft).toBeVisible();
  await expect(picked).toHaveCount(1);
  await expect(picked).toHaveAttribute('data-ops-dependency-picked', extra(3));
  await page.keyboard.press('Control+z');
  await expect.poll(() => state(page).then(s => s.sequences.map(q => q.predecessorId))).toEqual([extra(3), extra(5)]);
});

test('conceptrij: muiskeuze met richting Opvolger, een duplicaat wordt geweigerd, toewijzen via rechtsklik en Ctrl+F2', async ({ page, ops: _ops }) => {
  const [grondwerk, fundering, ruwbouw, afbouw] = await seedProject(page, [
    { name: 'Grondwerk', start: '2026-09-07', finish: '2026-09-18' },
    { name: 'Fundering', start: '2026-09-21', finish: '2026-10-02' },
    { name: 'Ruwbouw', start: '2026-10-05', finish: '2026-10-16' },
    { name: 'Afbouw', start: '2026-10-19', finish: '2026-10-30' },
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

  // Issue #1000, zoals Assign in Primavera: rechtsklik op een rij ⇒ "Voorgangers toewijzen…". Ook
  // met het paneel dicht gaat het open, met de conceptrij in beeld, richting Voorganger en de focus
  // in het zoekveld; kiezen en vastleggen kan daarna met alleen het toetsenbord.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showPropertiesPanel: false }));
  await expect(page.locator('[data-ops-dependency-add]')).toHaveCount(0);
  const cell = (id: string) => page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key="${id}"][data-grid-column-id="task.name"]`,
  );
  await cell(ruwbouw).click({ button: 'right' });
  await page.getByRole('button', { name: /^(Assign predecessors|Voorgangers toewijzen)…$/ }).click();
  const assign = page.locator('[data-ops-dependency-draft]');
  await expect(assign).toBeInViewport();
  await expect(assign.locator('[data-ops-dependency-direction]')).toHaveAttribute('data-ops-dependency-direction', 'predecessor');
  await expect(assign.locator('[data-ops-dependency-search]')).toBeFocused();
  await page.keyboard.type('Fund');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-ops-dependency-draft]')).toHaveCount(0);
  await expect.poll(() => state(page).then(s => s.sequences.map(q => [q.predecessorId, q.successorId])))
    .toEqual([[grondwerk, fundering], [fundering, ruwbouw]]);

  // Zoals Ctrl+F2 in MS Project: drie taken selecteren en als keten koppelen, in de volgorde van
  // klikken. Eén Ctrl+Z haalt de hele keten weg.
  await cell(grondwerk).click();
  await cell(ruwbouw).click({ modifiers: ['ControlOrMeta'] });
  await cell(afbouw).click({ modifiers: ['ControlOrMeta'] });
  await page.keyboard.press('ControlOrMeta+F2');
  await expect.poll(() => state(page).then(s => s.sequences.slice(2).map(q => [q.predecessorId, q.successorId, q.type])))
    .toEqual([[grondwerk, ruwbouw, 'FINISH_START'], [ruwbouw, afbouw, 'FINISH_START']]);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => state(page).then(s => s.sequences.length)).toBe(2);
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

// De pijlen naar voorganger en opvolger (issue #888, eigenaarsbesluit 2026-11-14 "1"): ze werken altijd
// zolang er een relatie is, en lopen bij meerdere relaties langs de sturende, zodat je met een paar
// klikken het kritieke pad terug of vooruit loopt. De keuzeregel zelf staat in check-relation-step.ts.
test('pijlen lopen de keten af langs de sturende relaties', async ({ page, ops: _ops }) => {
  const ids = await seedProject(page, [
    { name: 'Bouwrijp', start: '2026-09-07', finish: '2026-09-08', durationDays: 2 },
    { name: 'Grondwerk', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Fundering', start: '2026-09-21', finish: '2026-10-02', durationDays: 10 },
    { name: 'Ruwbouw', start: '2026-10-05', finish: '2026-10-16', durationDays: 10 },
  ]);
  const [bouwrijp, grondwerk, fundering, ruwbouw] = ids;
  await page.evaluate(([a, b, c, d]) => {
    const s = window.__OPS__!.store.getState();
    for (const id of [a, b, c, d]) s.updateTask(id, { manuallyScheduled: false });
    s.addSequence({ predecessorId: a, successorId: c, type: 'FINISH_START', lagDays: 0 });
    s.addSequence({ predecessorId: b, successorId: c, type: 'FINISH_START', lagDays: 0 });
    s.addSequence({ predecessorId: c, successorId: d, type: 'FINISH_START', lagDays: 0 });
    window.__OPS__!.store.getState().runCPM();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(d);
  }, [bouwrijp, grondwerk, fundering, ruwbouw]);

  const active = () => page.evaluate(() => window.__OPS__!.store.getState().activeTaskId);
  const left = page.locator('[data-ops-dependency-step="predecessor"]');
  const right = page.locator('[data-ops-dependency-step="successor"]');
  const link = (role: 'predecessor' | 'successor') => page.locator(`.dependency-wbs-link[data-dependency-role="${role}"]`);
  const label = async (id: string) => page.evaluate(i => {
    const task = window.__OPS__!.store.getState().tasks.find(t => t.id === i)!;
    return `${task.wbsCode} ${task.name}`.trim();
  }, id);
  const undoDepth = (await state(page)).undoDepth;

  // Zonder eerdere sprong werkt links meteen; rechts is grijs, want Ruwbouw heeft geen opvolger.
  await expect(left).toBeEnabled();
  await expect(left).toHaveAttribute('title', new RegExp(`${await label(fundering)}$`));
  await expect(right).toBeDisabled();

  // Terug langs het kritieke pad: Fundering, dan de sturende Grondwerk (niet Bouwrijp, met de lagere WBS).
  await left.click();
  await expect.poll(active).toBe(fundering);
  await expect(left).toHaveAttribute('title', new RegExp(`${await label(grondwerk)}$`));
  await left.click();
  await expect.poll(active).toBe(grondwerk);
  await expect(left).toBeDisabled();

  // En weer vooruit tot het eind.
  await right.click();
  await expect.poll(active).toBe(fundering);
  await right.click();
  await expect.poll(active).toBe(ruwbouw);
  await expect(right).toBeDisabled();

  // Een klik op een nummer in de lijst springt ook. De focus staat in de bovenste relatie (de uitlegzin
  // staat eronder); een klik op de onderste springt toch, want de zin verhuist pas na het loslaten.
  await left.click();
  await expect.poll(active).toBe(fundering);
  await page.locator('.dependency-item').first().locator('.dependency-lag-field').click();
  await expect(page.locator('.dependency-item').first().locator('.relation-sentence')).toBeVisible();
  await link('successor').click();
  await expect.poll(active).toBe(ruwbouw);

  // Lopen langs de keten verandert de planning niet.
  expect((await state(page)).undoDepth).toBe(undoDepth);
});
