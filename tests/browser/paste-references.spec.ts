// Kopiëren in document A en plakken in document B met echte Ctrl+C/Ctrl+V (audit taakmutaties §8).
// Het klembord is app-globaal; een geplakte taak droeg daardoor een taakkalender, eigen taaktype,
// activity code en gebruikersveld mee die alleen in A bestaan. Na de fix worden die verwijzingen in B
// leeggemaakt en verschijnt er één melding. `__OPS__` zet alleen de fixture (document A, een tweede
// document) en leest state; kopiëren, plakken en de canvasklik zijn echte browser-events.
import { barPoint, expect, test } from './fixtures/ops';

test('plakken in een ander document maakt onbekende verwijzingen leeg en meldt dat', async ({ page, ops: _ops }) => {
  // Breed genoeg dat de balk naast het eigenschappenpaneel valt.
  await page.setViewportSize({ width: 1600, height: 1000 });
  const { taskId, leafId } = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ name: 'Project A', startDate: '2026-09-07' });
    s.setViewStartDate('2026-09-01');
    const cal7 = s.addCalendar({ ...s.calendar, name: 'Continu 7/7', workDays: [0, 1, 2, 3, 4, 5, 6], holidays: [] });
    const st = window.__OPS__!.store.getState();
    st.ensureProjectTaskType({ id: 'ctt-stort', name: 'Betonstort' });
    const codeType = st.addActivityCodeType('Locatie');
    const codeValue = window.__OPS__!.store.getState().addActivityCodeValue(codeType, { code: 'B1' });
    const field = window.__OPS__!.store.getState().addCustomField('Volume m3', 'number');
    const id = window.__OPS__!.store.getState().addTask({ name: 'Beton uitharden' });
    const next = window.__OPS__!.store.getState();
    const current = next.tasks.find(task => task.id === id)!;
    next.updateTask(id, {
      time: { ...current.time, scheduleDuration: 7 },
      taskType: 'USERDEFINED',
      customTaskTypeId: 'ctt-stort',
    });
    window.__OPS__!.store.getState().setTaskCalendar(id, cal7);
    window.__OPS__!.store.getState().setTaskActivityCode(id, codeType, codeValue);
    window.__OPS__!.store.getState().setTaskCustomField(id, field, 42);
    // Eén echte tak met twee bladeren en een interne relatie, zodat dezelfde toetsroute ook
    // de ingevoegde kinderen en relaties door de gedeelde lookup laat lopen. Geef de kinderen
    // een standaardwerksoort, anders erven ze de eigen werksoort en zijn er zes verwijzingen.
    const a = window.__OPS__!.store.getState().addTask({ name: 'Voorbereiden', parentId: id, taskType: 'CONSTRUCTION' });
    const b = window.__OPS__!.store.getState().addTask({ name: 'Nabehandelen', parentId: id, taskType: 'CONSTRUCTION' });
    window.__OPS__!.store.getState().addSequence({ predecessorId: a, successorId: b,
      type: 'FINISH_START', lagDays: 0 });
    window.__OPS__!.store.getState().runCPM();
    window.__OPS__!.store.getState().setViewStartDate('2026-09-04');
    return { taskId: id, leafId: a };
  });

  // Een fase heeft geen sleepbare balk voor barPoint. De x van haar kind ligt binnen de
  // fasebalk; de DOM-rij geeft de y. Klik echt op het canvas, zodat Ctrl+C de tak kopieert.
  const point = await barPoint(page, leafId);
  const rootRow = page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"]`,
  );
  await expect(rootRow).toBeVisible();
  const rootBounds = await rootRow.boundingBox();
  expect(rootBounds).not.toBeNull();
  await page.mouse.click(point.x, rootBounds!.y + rootBounds!.height / 2);
  await expect(page.getByTestId('gantt-primary-canvas')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([taskId]);
  await page.keyboard.press('Control+c');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().taskClipboard?.tasks.length ?? 0)).toBe(3);

  // Fixture: een tweede, leeg document.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.newDocument();
    window.__OPS__!.store.getState().setProject({ name: 'Project B', startDate: '2026-09-07' });
    window.__OPS__!.store.getState().setViewStartDate('2026-09-01');
  });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(0);

  await page.keyboard.press('Control+v');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(3);

  const pasted = await page.evaluate(() => {
    const t = window.__OPS__!.store.getState().tasks[0];
    return {
      name: t.name,
      calendarId: t.calendarId ?? null,
      customTaskTypeId: t.customTaskTypeId ?? null,
      activityCodes: t.activityCodes ?? null,
      customFields: t.customFields ?? null,
    };
  });
  expect(pasted).toEqual({
    name: 'Beton uitharden',
    calendarId: null,
    customTaskTypeId: null,
    activityCodes: null,
    customFields: null,
  });
  await expect(page.locator('.ops-toast', { hasText: /4 references did not exist in this document and were cleared/ }))
    .toBeVisible();

  const branch = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const [root, a, b] = s.tasks;
    return { data: JSON.stringify({ tasks: s.tasks, sequences: s.sequences, assignments: s.assignments }),
      children: root.childIds, parents: [a.parentId, b.parentId], root: root.id,
      leaves: [a.id, b.id], relations: s.sequences.map(r => [r.predecessorId, r.successorId]) };
  });
  expect(branch.children).toEqual(branch.leaves);
  expect(branch.parents).toEqual([branch.root, branch.root]);
  expect(branch.relations).toEqual([branch.leaves]);
  await page.keyboard.press('Control+z');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(0);
  await page.keyboard.press('Control+y');
  await expect.poll(() => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return JSON.stringify({ tasks: s.tasks, sequences: s.sequences, assignments: s.assignments });
  })).toBe(branch.data);
});

// Issue #900: kopiëren met de focus in de kolommen en plakken in een ANDERE planning plakt de taken.
// Het raster kopieert dan ook naar het app-brede takenklembord. Binnen dezelfde planning, en met tekst
// van buiten (Excel), blijft plakken in de kolommen celwaarden plakken zoals voorheen.
test('kopiëren in de kolommen en plakken in een andere planning plakt de taken (issue #900)', async ({ page, ops: _ops }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1400, height: 800 });
  const nameCell = (rowKey: string) => page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${rowKey}"]`
    + ' [data-grid-data-cell="true"][data-grid-column-id="task.name"]',
  );
  const names = () => page.evaluate(() => window.__OPS__!.store.getState().tasks.map(task => task.name));
  const { phase, loose } = await page.evaluate(() => {
    const store = window.__OPS__!.store;
    store.getState().setProject({ name: 'Project A', startDate: '2026-09-07' });
    const phase = store.getState().addTask({ name: 'Ruwbouw' });
    store.getState().addTask({ name: 'Graven', parentId: phase });
    store.getState().addTask({ name: 'Storten', parentId: phase });
    const loose = store.getState().addTask({ name: 'Losse taak' });
    store.getState().runCPM();
    return { phase, loose };
  });

  // Ctrl+C in de kolommen: de celtekst op het systeemklembord én de tak op het takenklembord.
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await nameCell(phase).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([phase]);
  await page.keyboard.press('Control+c');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('Ruwbouw');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().taskClipboard?.tasks.length ?? 0))
    .toBe(3);

  // Zelfde planning: Ctrl+V in de kolommen plakt de celwaarde, er komen geen taken bij.
  await nameCell(loose).click();
  await page.keyboard.press('Control+v');
  await expect.poll(names).toEqual(['Ruwbouw', 'Graven', 'Storten', 'Ruwbouw']);

  // Andere planning (fixture), met één bestaande taak; focus in haar naamcel.
  const existing = await page.evaluate(() => {
    const store = window.__OPS__!.store;
    store.getState().newDocument();
    store.getState().setProject({ name: 'Project B', startDate: '2026-09-07' });
    return store.getState().addTask({ name: 'Bestaand' });
  });
  await nameCell(existing).click();
  await page.keyboard.press('Control+v');
  await expect.poll(names).toEqual(['Bestaand', 'Ruwbouw', 'Graven', 'Storten']);

  // Tekst van buiten (Excel) blijft een celwaarde, ook in de andere planning.
  await page.evaluate(() => navigator.clipboard.writeText('Uit Excel'));
  await nameCell(existing).click();
  await page.keyboard.press('Control+v');
  await expect.poll(names).toEqual(['Uit Excel', 'Ruwbouw', 'Graven', 'Storten']);
});
