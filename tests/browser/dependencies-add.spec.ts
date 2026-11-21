import { barPoint, expect, seedProject, state, test } from './fixtures/ops';

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
  // Een lange route met twee documenten en elk sleepgebaar over een documentwissel.
  test.setTimeout(60_000);
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
  // Een tweede verzoek terwijl de rij al openstaat: de richting wisselt en de focus gaat terug naar
  // het zoekveld (de rechtsklik had hem naar de takenlijst gehaald).
  for (const [item, direction] of [['successors|Opvolgers', 'successor'], ['predecessors|Voorgangers', 'predecessor']] as const) {
    await cell(ruwbouw).click({ button: 'right' });
    await page.getByRole('button', { name: new RegExp(`^(Assign ${item.split('|')[0]}|${item.split('|')[1]} toewijzen)…$`) }).click();
    await expect(assign.locator('[data-ops-dependency-direction]')).toHaveAttribute('data-ops-dependency-direction', direction);
    await expect(assign.locator('[data-ops-dependency-search]')).toBeFocused();
  }
  await page.keyboard.type('Fund');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-ops-dependency-draft]')).toHaveCount(0);
  await expect.poll(() => state(page).then(s => s.sequences.map(q => [q.predecessorId, q.successorId])))
    .toEqual([[grondwerk, fundering], [fundering, ruwbouw]]);

  // Zoals Ctrl+F2 in MS Project: drie taken selecteren en als keten koppelen, in de volgorde op het
  // scherm. Eén Ctrl+Z haalt de hele keten weg.
  await cell(grondwerk).click();
  await cell(ruwbouw).click({ modifiers: ['ControlOrMeta'] });
  await cell(afbouw).click({ modifiers: ['ControlOrMeta'] });
  await page.keyboard.press('ControlOrMeta+F2');
  await expect.poll(() => state(page).then(s => s.sequences.slice(2).map(q => [q.predecessorId, q.successorId, q.type])))
    .toEqual([[grondwerk, ruwbouw, 'FINISH_START'], [ruwbouw, afbouw, 'FINISH_START']]);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => state(page).then(s => s.sequences.length)).toBe(2);

  // Review #1004: Shift-klik in de Gantt volgt de rijen op het scherm. In de Gantt selecteert
  // Shift-klik op de naam naast de balk een bereik (Shift op de balk zelf trekt een relatie). Fixture:
  // Fundering weggefilterd, en ver uitgezoomd zodat de namen naast de balken staan. Ruwbouw →
  // Shift-klik op de naam van Grondwerk wordt het bereik Grondwerk, Ruwbouw — zonder de verborgen
  // taak — en Ctrl+F2 legt precies die ene relatie.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setFilter({ kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'neq', value: 'Fundering' });
    s.setZoom(1);
  });
  await expect(cell(fundering)).toHaveCount(0);
  await cell(ruwbouw).click();
  const grondwerkEnd = await barPoint(page, grondwerk, 'right');
  await page.keyboard.down('Shift');
  await page.mouse.click(grondwerkEnd.x + 16, grondwerkEnd.y);
  await page.keyboard.up('Shift');
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([grondwerk, ruwbouw]);
  await page.keyboard.press('ControlOrMeta+F2');
  await expect.poll(() => state(page).then(s => s.sequences.slice(2).map(q => [q.predecessorId, q.successorId])))
    .toEqual([[grondwerk, ruwbouw]]);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => state(page).then(s => s.sequences.length)).toBe(2);

  // Zonder takenlijst in beeld koppelt Ctrl+F2 niets, zoals Delete: de selectie is dan onzichtbaar.
  await page.locator('.ribbon-tab').filter({ hasText: /^(Report|Rapport)$/ }).click();
  await page.keyboard.press('ControlOrMeta+F2');
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([grondwerk, ruwbouw]);
  await expect.poll(() => state(page).then(s => s.sequences.length)).toBe(2);
  await page.locator('.ribbon-tab').filter({ hasText: /^(Home|Start)$/ }).click();

  // Review #1004, ronde 2: een taak die NA het selecteren wordt weggefilterd, komt niet in de keten.
  // Selectie Grondwerk, Fundering, Ruwbouw; daarna Fundering weg (fixture). Ctrl+F2 doet niets.
  await page.evaluate(() => window.__OPS__!.store.getState().setFilter(null));
  await cell(grondwerk).click();
  await cell(fundering).click({ modifiers: ['ControlOrMeta'] });
  await cell(ruwbouw).click({ modifiers: ['ControlOrMeta'] });
  await page.evaluate(() => window.__OPS__!.store.getState().setFilter({
    kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'neq', value: 'Fundering',
  }));
  await expect(cell(fundering)).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+F2');
  await expect.poll(() => state(page).then(s => s.sequences.length)).toBe(2);

  // Review #1004, ronde 2: bij groeperen op resource staat Fundering in twee ploegen. Shift-klik op
  // de naam van Fundering in de TWEEDE ploeg neemt het bereik tot die rij. Fixture: twee ploegen,
  // groeperen op resource, aflopend op naam ⇒ | Grondwerk Fundering | Ruwbouw Fundering Afbouw.
  await page.evaluate(([g, f, r, a]) => {
    const s = window.__OPS__!.store.getState();
    s.setFilter(null);
    const p1 = s.addResource({ name: 'Ploeg 1', type: 'LABOR', description: '', maxUnits: 1 });
    const p2 = s.addResource({ name: 'Ploeg 2', type: 'LABOR', description: '', maxUnits: 1 });
    for (const [task, res] of [[g, p1], [f, p1], [r, p2], [a, p2], [f, p2]] as const) s.assignResource(task, res, 1, 'UNIFORM');
    s.setGroup([{ field: { src: 'resource' }, dir: 'asc' }]);
    s.setSort([{ field: { src: 'builtin', key: 'name' }, dir: 'desc' }]);
  }, [grondwerk, fundering, ruwbouw, afbouw]);
  const rowKeys = await page.evaluate(() => window.__OPS__!.store.getState().viewRows.map(row => row.rowKey));
  expect(rowKeys).toHaveLength(7);
  const gridRow = (rowKey: string) => page.locator(`[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key='${rowKey}'][data-grid-column-id="task.name"]`);
  await gridRow(rowKeys[6]!).click(); // Afbouw in ploeg 2
  const funderingEnd = await barPoint(page, fundering, 'right');
  const secondFundering = await gridRow(rowKeys[5]!).boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.click(funderingEnd.x + 16, secondFundering!.y + secondFundering!.height / 2);
  await page.keyboard.up('Shift');
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([fundering, afbouw]);
  await page.keyboard.press('ControlOrMeta+F2');
  await expect.poll(() => state(page).then(s => s.sequences.slice(2).map(q => [q.predecessorId, q.successorId])))
    .toEqual([[fundering, afbouw]]);

  // Review #1004, ronde 3: de takenlijst staat daarna op de rij die je in de tijdlijn aanklikte
  // (Fundering in ploeg 2), niet op het eerste voorkomen. Shift-klik in de lijst op Grondwerk gaat
  // vanaf die rij: Grondwerk, Fundering, Ruwbouw.
  await expect(gridRow(rowKeys[5]!)).toHaveAttribute('data-grid-active', 'true');
  // Ook als die taak al gekozen was: Fundering in ploeg 1 in de lijst, dan dezelfde taak in ploeg 2
  // in de tijdlijn. De selectie blijft gelijk, de cursor gaat mee naar ploeg 2.
  await gridRow(rowKeys[2]!).click();
  await expect(gridRow(rowKeys[2]!)).toHaveAttribute('data-grid-active', 'true');
  await page.mouse.click(funderingEnd.x + 16, secondFundering!.y + secondFundering!.height / 2);
  await expect(gridRow(rowKeys[5]!)).toHaveAttribute('data-grid-active', 'true');
  await gridRow(rowKeys[1]!).click({ modifiers: ['Shift'] });
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([grondwerk, fundering, ruwbouw]);

  // Review #1004, ronde 4: tijdlijn en lijst delen één beginpunt voor Shift. Grondwerk in de lijst,
  // Shift Fundering (ploeg 1) in de lijst, dan een gewone klik op Fundering in de tijdlijn, op de rij
  // waar de cursor al staat: Shift op Ruwbouw in de lijst gaat vanaf Fundering, niet vanaf Grondwerk.
  const firstFundering = await gridRow(rowKeys[2]!).boundingBox();
  await gridRow(rowKeys[1]!).click();
  await gridRow(rowKeys[2]!).click({ modifiers: ['Shift'] });
  await page.mouse.click(funderingEnd.x + 16, firstFundering!.y + firstFundering!.height / 2);
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([fundering]);
  await gridRow(rowKeys[4]!).click({ modifiers: ['Shift'] });
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([fundering, ruwbouw]);

  // En een kader (Ctrl-slepen over lege achtergrond) rond alleen Fundering in ploeg 1, na een klik op
  // Fundering in ploeg 2: Shift op de naam van Afbouw gaat vanaf de rij in het kader.
  await page.mouse.click(funderingEnd.x + 16, secondFundering!.y + secondFundering!.height / 2);
  const anchorRow = () => page.evaluate(() => window.__OPS__!.store.getState().ui.selectionAnchor?.rowKey);
  await expect.poll(anchorRow).toBe(rowKeys[5]);
  const canvas = (await page.getByTestId('gantt-primary-canvas').boundingBox())!;
  const emptyY = firstFundering!.y + firstFundering!.height / 2;
  await page.keyboard.down('Control');
  await page.mouse.move(canvas.x + canvas.width - 20, emptyY);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width - 80, emptyY, { steps: 4 });
  await expect(page.getByTestId('box-select-rect')).toBeVisible();
  await page.mouse.up();
  await page.keyboard.up('Control');
  await expect.poll(anchorRow).toBe(rowKeys[2]);
  // Het kader zet ook de cursor op die rij, net als een klik: verwijderen gaat daar van uit (ronde 7).
  await expect(gridRow(rowKeys[2]!)).toHaveAttribute('data-grid-active', 'true');
  const afbouwEnd = await barPoint(page, afbouw, 'right');
  const afbouwRow = await gridRow(rowKeys[6]!).boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.click(afbouwEnd.x + 16, afbouwRow!.y + afbouwRow!.height / 2);
  await page.keyboard.up('Shift');
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([fundering, ruwbouw, afbouw]);
  // Ronde 6: Fundering staat hier vóór Ruwbouw (ploeg 1) en erna (ploeg 2). De volgorde ligt niet
  // vast, dus Ctrl+F2 legt niets en zegt waarom; het lint zet de knop uit.
  await page.keyboard.press('ControlOrMeta+F2');
  await expect(page.locator('.ops-toast', { hasText: /order in the list is not fixed|volgorde in de lijst ligt niet vast/ })).toBeVisible();
  await expect.poll(() => state(page).then(s => s.sequences.slice(2).map(q => [q.predecessorId, q.successorId])))
    .toEqual([[fundering, afbouw]]);

  // Ronde 6: een open concept hoort bij zijn document. Ruwbouw gekozen in de bron én in de kopie;
  // in de kopie "Opvolgers toewijzen…" en Afbouw aangevinkt, dan terug naar de bron: het concept is
  // weg, zodat bevestigen niets in de bron kan leggen.
  const source = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setGroup([]);
    s.setSort([]);
    return s.activeDocumentId;
  });
  // Ronde 8: na Ctrl+A begint Shift in de lijst bij de actieve taak, net als in de tijdlijn, niet bij
  // het oude beginpunt. Grondwerk, Shift Fundering, alles kiezen (fixture), Shift Afbouw ⇒ Fundering
  // t/m Afbouw.
  await cell(grondwerk).click();
  await cell(fundering).click({ modifiers: ['Shift'] });
  await page.evaluate(() => window.__OPS__!.store.getState().selectAllTasks());
  await cell(afbouw).click({ modifiers: ['Shift'] });
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([fundering, ruwbouw, afbouw]);
  // Ronde 9: een bereik vanaf de spookregel "Nieuwe taak" houdt dat beginpunt bij een tweede Shift.
  await page.locator('[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key="ops-ghost-row"][data-grid-column-id="task.name"]').click();
  await cell(ruwbouw).click({ modifiers: ['Shift'] });
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([ruwbouw, afbouw]);
  await cell(fundering).click({ modifiers: ['Shift'] });
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([fundering, ruwbouw, afbouw]);

  await cell(ruwbouw).click();
  const copy = await page.evaluate(() => window.__OPS__!.store.getState().duplicateDocument());
  await cell(ruwbouw).click({ button: 'right' });
  await page.getByRole('button', { name: /^(Assign successors|Opvolgers toewijzen)…$/ }).click();
  await expect(assign.locator('[data-ops-dependency-search]')).toBeFocused();
  await page.keyboard.type('Afb');
  await page.keyboard.press('Enter');
  await expect(assign.locator('[data-ops-dependency-search]')).toHaveValue(/Afbouw/);
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), source);
  await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([ruwbouw]);
  await expect(page.locator('[data-ops-dependency-draft]')).toHaveCount(0);
  await expect.poll(() => state(page).then(s => s.sequences.slice(2).map(q => [q.predecessorId, q.successorId])))
    .toEqual([[fundering, afbouw]]);
  // Ook het rechtsklikmenu van de tijdlijn hoort bij zijn document: een documentwissel sluit het (ronde 9).
  const grondwerkBar = await barPoint(page, grondwerk);
  await page.mouse.click(grondwerkBar.x, grondwerkBar.y, { button: 'right' });
  const assignSuccessors = page.getByRole('button', { name: /^(Assign successors|Opvolgers toewijzen)…$/ });
  await expect(assignSuccessors).toBeVisible();
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), copy);
  await expect(assignSuccessors).toHaveCount(0);

  // Net zo een lopende relatiesleep en een open relatiepopover (ronde 10): na de wissel legt loslaten of
  // Enter niets vast, in geen van beide documenten. Beide documenten krijgen dezelfde weergave, zodat
  // dezelfde schermplek in beide op dezelfde balk valt.
  await page.evaluate(([src, cp]) => {
    const s = () => window.__OPS__!.store.getState();
    for (const id of [src, cp]) {
      s().switchDocument(id);
      s().setUI({ showPropertiesPanel: false });
      s().setZoom(10);
      s().setScroll(0, 0);
    }
  }, [source, copy]);
  const relationCounts = () => page.evaluate(() => window.__OPS__!.store.getState().getOpenDocumentPayloads()
    .map(doc => doc.payload.sequences.length));
  const countsBefore = await relationCounts();
  const from = await barPoint(page, grondwerk);
  const to = await barPoint(page, ruwbouw);
  const popover = page.locator('[data-ops-relation-popover]');
  await page.keyboard.down('Shift');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 3 });
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), source);
  const selectedAtSwitch = (await state(page)).selectedTaskIds;
  await page.mouse.move(to.x, to.y, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForTimeout(300);
  await expect(popover).toHaveCount(0);
  // De click van dat loslaten hoort bij het afgebroken gebaar: geen andere selectie in de bron (ronde 13).
  expect((await state(page)).selectedTaskIds).toEqual(selectedAtSwitch);
  await page.keyboard.down('Shift');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(popover).toBeVisible();
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), copy);
  await expect(popover).toHaveCount(0);
  await page.keyboard.press('Enter');
  expect(await relationCounts()).toEqual(countsBefore);

  // Een balksleep en een splitsgebaar horen ook bij hun document (ronde 11): na de wissel schrijft verder
  // slepen of loslaten niets meer, in geen van beide documenten.
  const ruwbouwPerDocument = () => page.evaluate((id) => Object.fromEntries(window.__OPS__!.store.getState()
    .getOpenDocumentPayloads().map(doc => {
      const task = doc.payload.tasks.find(candidate => candidate.id === id);
      return [doc.id, { start: task?.time.scheduleStart, gaps: task?.splitGaps ?? null }];
    })), ruwbouw);
  const beforeDrag = await ruwbouwPerDocument();
  const bar = await barPoint(page, ruwbouw);
  await page.mouse.move(bar.x, bar.y);
  await page.mouse.down();
  await page.mouse.move(bar.x + 60, bar.y, { steps: 6 });
  await expect.poll(() => ruwbouwPerDocument().then(docs => docs[copy].start)).not.toBe(beforeDrag[copy].start);
  const draggedInCopy = (await ruwbouwPerDocument())[copy];
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), source);
  await page.mouse.move(bar.x + 180, bar.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const afterDrag = await ruwbouwPerDocument();
  expect(afterDrag[source]).toEqual(beforeDrag[source]);
  expect(afterDrag[copy]).toEqual(draggedInCopy);

  // Splitsen weigert een handmatig geplande taak; zet Ruwbouw in beide documenten op automatisch.
  await page.evaluate(([src, cp, id]) => {
    const s = () => window.__OPS__!.store.getState();
    for (const doc of [src, cp]) {
      s().switchDocument(doc);
      s().updateTask(id, { manuallyScheduled: false });
    }
  }, [source, copy, ruwbouw]);
  const beforeSplit = await ruwbouwPerDocument();
  await page.locator('[data-ops-ribbon-item="splitTask"]').click();
  await expect(page.locator('[data-ops-split-mode]')).toBeVisible();
  const splitAt = await barPoint(page, ruwbouw);
  await page.mouse.move(splitAt.x, splitAt.y);
  await page.mouse.down();
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), source);
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await ruwbouwPerDocument()).toEqual(beforeSplit);
  // Zonder wissel splitst hetzelfde gebaar wel: de proef hierboven ging dus echt over de wissel.
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), copy);
  await page.mouse.move(splitAt.x, splitAt.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => ruwbouwPerDocument().then(docs => docs[copy].gaps)).not.toBeNull();
  expect((await ruwbouwPerDocument())[source]).toEqual(beforeSplit[source]);
  await page.keyboard.press('Escape');

  // Elk sleepgebaar stopt bij een wissel (ronde 12), ook pannen, een selectiekader (met Ctrl, want op de
  // achtergrond pant slepen) en een verticale balksleep (de rijsleep van de takenlijst): de bron houdt
  // haar selectie en haar volgorde.
  const perDocument = () => page.evaluate(() => Object.fromEntries(window.__OPS__!.store.getState()
    .getOpenDocumentPayloads().map(doc => [doc.id, {
      selection: doc.payload.selectedTaskIds,
      order: doc.payload.tasks.map(task => `${task.wbsCode} ${task.name}`),
    }])));
  const first = await barPoint(page, grondwerk);
  const last = await barPoint(page, afbouw);
  const beforeBox = await perDocument();
  await page.mouse.move(last.x + 40, last.y + 60);
  await page.mouse.down();
  await page.mouse.move(first.x - 20, first.y - 4, { steps: 8 });
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), source);
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect((await perDocument())[source]).toEqual(beforeBox[source]);
  const box = page.locator('[data-testid=box-select-rect]');
  await page.keyboard.down('Control');
  await page.mouse.move(last.x + 40, last.y + 60);
  await page.mouse.down();
  await page.mouse.move(first.x - 20, first.y - 4, { steps: 8 });
  await expect(box).toBeVisible();
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), copy);
  await expect(box).toHaveCount(0);
  await page.mouse.up();
  await page.keyboard.up('Control');
  await page.waitForTimeout(300);
  expect((await perDocument())[copy].selection).toEqual(beforeBox[copy].selection);
  expect((await perDocument())[source].selection).toEqual(beforeBox[source].selection);

  // Het pannen verschoof de kopie; zet beide weer op hetzelfde beeld en meet opnieuw.
  await page.evaluate(([src, cp]) => {
    const s = () => window.__OPS__!.store.getState();
    for (const id of [src, cp]) {
      s().switchDocument(id);
      s().setScroll(0, 0);
    }
  }, [source, copy]);
  const top = await barPoint(page, grondwerk);
  const bottom = await barPoint(page, afbouw);
  const beforeRowDrag = await perDocument();
  await page.mouse.move(top.x, top.y);
  await page.mouse.down();
  await page.mouse.move(top.x, bottom.y + 8, { steps: 8 });
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), source);
  await page.mouse.up();
  await page.waitForTimeout(300);
  // Indrukken op de balk koos Grondwerk nog in de kopie; de volgorde blijft in beide gelijk.
  const afterRowDrag = await perDocument();
  expect(afterRowDrag[source]).toEqual(beforeRowDrag[source]);
  expect(afterRowDrag[copy].order).toEqual(beforeRowDrag[copy].order);
  // Zonder wissel verplaatst hetzelfde gebaar Grondwerk wel, alleen in de kopie.
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), copy);
  await page.mouse.move(top.x, top.y);
  await page.mouse.down();
  await page.mouse.move(top.x, bottom.y + 8, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => perDocument().then(docs => docs[copy].order)).not.toEqual(beforeRowDrag[copy].order);
  expect((await perDocument())[source].order).toEqual(beforeRowDrag[source].order);

  // Ronde 13: Shift vervangt het lopende bereik, in de tijdlijn net als in de takenlijst. Afbouw,
  // Shift Grondwerk, Shift Ruwbouw ⇒ Ruwbouw en Afbouw; Ctrl+F2 legt in beide precies Ruwbouw → Afbouw.
  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), source);
  type Pick = (id: string, key?: 'Shift' | 'ControlOrMeta') => Promise<void>;
  const onBar: Pick = async (id, key) => {
    const point = await barPoint(page, id);
    if (key) await page.keyboard.down(key);
    await page.mouse.click(point.x, point.y);
    if (key) await page.keyboard.up(key);
  };
  const onCell: Pick = async (id, key) => {
    await cell(id).click(key ? { modifiers: [key] } : undefined);
  };
  const added = async (pick: Pick) => {
    const before = (await state(page)).sequences.map(q => q.id);
    await pick(afbouw);
    await pick(grondwerk, 'Shift');
    await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([grondwerk, fundering, ruwbouw, afbouw]);
    await pick(ruwbouw, 'Shift');
    await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([ruwbouw, afbouw]);
    await page.keyboard.press('ControlOrMeta+F2');
    await expect.poll(() => state(page).then(s => s.sequences.filter(q => !before.includes(q.id)).length)).toBe(1);
    const fresh = (await state(page)).sequences.filter(q => !before.includes(q.id))
      .map(q => [q.predecessorId, q.successorId, q.type, q.lagDays]);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => state(page).then(s => s.sequences.map(q => q.id))).toEqual(before);
    return fresh;
  };
  const viaTimeline = await added(onBar);
  expect(viaTimeline).toEqual([[ruwbouw, afbouw, 'FINISH_START', 0]]);
  expect(await added(onCell)).toEqual(viaTimeline);
  // Ronde 14: ook na een Ctrl-keuze kiest Shift precies het bereik, in beide oppervlakken gelijk.
  for (const pick of [onBar, onCell]) {
    await pick(grondwerk);
    await pick(ruwbouw, 'ControlOrMeta');
    await pick(afbouw, 'Shift');
    await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([ruwbouw, afbouw]);
  }
  // Ronde 15: is het beginpunt weggefilterd (Fundering, de laatste Ctrl-keuze), dan heeft geen van beide
  // oppervlakken een beginpunt: Shift kiest alleen Afbouw. De takenlijst nam eerst haar eigen anker,
  // dat naar Ruwbouw was geschoven, en koos Ruwbouw en Afbouw.
  for (const pick of [onBar, onCell]) {
    await page.evaluate(() => window.__OPS__!.store.getState().setFilter(null));
    await pick(grondwerk);
    await pick(fundering, 'ControlOrMeta');
    await page.evaluate(() => window.__OPS__!.store.getState().setFilter({
      kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'neq', value: 'Fundering',
    }));
    await expect(cell(fundering)).toHaveCount(0);
    await pick(afbouw, 'Shift');
    await expect.poll(() => state(page).then(s => s.selectedTaskIds)).toEqual([afbouw]);
  }
  await page.evaluate(() => window.__OPS__!.store.getState().setFilter(null));
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
