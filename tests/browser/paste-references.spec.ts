// Kopiëren in document A en plakken in document B met echte Ctrl+C/Ctrl+V (audit taakmutaties §8).
// Het klembord is app-globaal; een geplakte taak droeg daardoor een taakkalender, eigen taaktype,
// activity code en gebruikersveld mee die alleen in A bestaan. Na de fix worden die verwijzingen in B
// leeggemaakt en verschijnt er één melding. `__OPS__` zet alleen de fixture (document A, een tweede
// document) en leest state; kopiëren, plakken en de balkklik zijn echte browser-events.
import { barPoint, expect, test } from './fixtures/ops';

test('plakken in een ander document maakt onbekende verwijzingen leeg en meldt dat', async ({ page, ops: _ops }) => {
  // Breed genoeg dat de balk naast het eigenschappenpaneel valt.
  await page.setViewportSize({ width: 1600, height: 1000 });
  const taskId = await page.evaluate(() => {
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
    window.__OPS__!.store.getState().runCPM();
    window.__OPS__!.store.getState().setViewStartDate('2026-09-04');
    return id;
  });

  // Echte klik op de balk selecteert de taak; echte Ctrl+C kopieert hem.
  const point = await barPoint(page, taskId);
  await page.mouse.click(point.x, point.y);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([taskId]);
  await page.keyboard.press('Control+c');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().taskClipboard?.tasks.length ?? 0)).toBe(1);

  // Fixture: een tweede, leeg document.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.newDocument();
    window.__OPS__!.store.getState().setProject({ name: 'Project B', startDate: '2026-09-07' });
    window.__OPS__!.store.getState().setViewStartDate('2026-09-01');
  });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(0);

  await page.keyboard.press('Control+v');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(1);

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
});
