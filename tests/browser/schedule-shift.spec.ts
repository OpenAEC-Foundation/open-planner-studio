// De uitleg na F5 (#742): F5 rekent direct, daarna rechtsonder de melding met Waarom? en Ongedaan
// maken. Waarom? opent de lijst in de rail, een klik op een regel toont de taak in de Gantt.
// De brug zet alleen de fixture en leest state; F5 en de klikken zijn echte events.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

/** Fundering → Metselwerk → Dak, FS, doorgerekend. Daarna wordt de Fundering langer. */
async function seedEditedChain(page: Page): Promise<{ a: string; b: string; c: string }> {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setCalendar({ ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [] });
    s.setProject({ startDate: '2026-06-01', name: 'Verschuiving' });
    s.setViewStartDate('2026-06-01');
    s.setUI({ dateNotation: 'dmy', showPropertiesPanel: true, rightPanelCollapsed: false, showWarningsPanel: true });
    const a = s.addTask({ name: 'Fundering', time: { scheduleDuration: 5 } as never });
    const b = s.addTask({ name: 'Metselwerk', time: { scheduleDuration: 3 } as never });
    const c = s.addTask({ name: 'Dak', time: { scheduleDuration: 2 } as never });
    s.addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
    s.addSequence({ predecessorId: b, successorId: c, type: 'FINISH_START', lagDays: 0 });
    s.runCPM();
    const task = window.__OPS__!.store.getState().tasks.find(t => t.id === a)!;
    s.updateTask(a, { time: { ...task.time, scheduleDuration: 8 } });
    return { a, b, c };
  });
}

const finishOf = (page: Page, id: string) => page.evaluate(
  taskId => window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!.time.earlyFinish,
  id,
);

test('F5 meldt de verschuiving; Waarom? toont de lijst en Ongedaan maken draait de berekening terug', async ({ page, ops: _ops }) => {
  const { a, b, c } = await seedEditedChain(page);
  const before = await finishOf(page, b);

  await page.keyboard.press('F5');
  await expect.poll(() => finishOf(page, b)).not.toBe(before);

  const toast = page.locator('.ops-toast').filter({ hasText: 'tasks moved' });
  await expect(toast).toContainText('3 tasks moved');
  await expect(toast).toContainText('Project finish 3 working days later');

  // De melding staat rechtsonder, niet in het midden.
  const box = (await toast.boundingBox())!;
  expect(box.x + box.width).toBeGreaterThan(page.viewportSize()!.width - 60);

  // Waarom?: de lijst, onder het Waarschuwingenpaneel. De melding gaat weg; het paneel neemt het over.
  await toast.locator('[data-ops-notification-action="showScheduleShift"]').click();
  const panel = page.locator('[data-ops-shift-panel]');
  await expect(panel).toBeVisible();
  await expect(page.locator('[data-ops-rail-panel="warnings"]')).toBeVisible();
  await expect(toast).toHaveCount(0);
  await expect(panel.locator('[data-ops-shift-summary]')).toContainText('Project finish 3 working days later');

  const rowB = panel.locator(`[data-ops-shift-id="${b}"]`);
  await expect(rowB).toContainText('Metselwerk');
  await expect(rowB).toContainText('Predecessor: 1 Fundering');
  await expect(rowB).toContainText(/Finish .*→/);
  await expect(panel.locator(`[data-ops-shift-id="${a}"]`)).toContainText('Own duration changed');
  await expect(panel.locator(`[data-ops-shift-id="${c}"]`)).toContainText('Predecessor: 2 Metselwerk');

  // Een klik op een regel selecteert de taak en stuurt de Gantt erheen.
  await rowB.click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().activeTaskId)).toBe(b);

  // Ongedaan maken in het paneel: alleen de berekening terug, de bewerking blijft en is weer verouderd.
  await panel.locator('[data-ops-shift-undo]').click();
  await expect.poll(() => finishOf(page, b)).toBe(before);
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    return { stale: s.scheduleStale, duration: s.tasks.find(t => t.id === id)!.time.scheduleDuration };
  }, a)).toEqual({ stale: true, duration: 8 });

  // Hetzelfde vanuit de melding.
  await page.keyboard.press('F5');
  await toast.locator('[data-ops-notification-action="undoScheduleShift"]').click();
  await expect.poll(() => finishOf(page, b)).toBe(before);
  await expect(toast).toHaveCount(0);

  // Opnieuw F5, dan een andere bewerking: de lijst blijft, de knop Ongedaan maken verdwijnt.
  await page.keyboard.press('F5');
  await expect(toast).toBeVisible();
  await page.evaluate(id => window.__OPS__!.store.getState().updateTask(id, { name: 'Dakwerk' }), c);
  await expect(toast.locator('[data-ops-notification-action="undoScheduleShift"]')).toHaveCount(0);
  await expect(toast.locator('[data-ops-notification-action="showScheduleShift"]')).toBeVisible();

  // Het paneel staat ook in het lint, voor als de melding weg is.
  await toast.locator('[data-ops-toast-close]').click();
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'beeld' }));
  await page.locator('[data-ops-ribbon-item="scheduleShiftPanel"]').click();
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-ops-shift-undo]')).toHaveCount(0);
  await expect(panel.locator(`[data-ops-shift-id="${b}"]`)).toBeVisible();
});
