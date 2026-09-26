// Kolom "Totaal" in het resourcepaneel tegenover het urentotaal van de contourdialoog (audit
// resources-kalenders R6). Een taak op een 10-uurskalender (projectkalender 8 u), tarief €50/u: de
// contourdialoog telt 50 u, dus hoort het paneel 2.500 te tonen — vroeger 2.000 (40 u, de uren per
// dag van de projectkalender). Fixture en navigatie via de brug; de contourdialoog opent met een
// echte klik, beide getallen worden uit de gerenderde DOM gelezen. Headless: check-resource-cost-hours.ts.
import { expect, test } from './fixtures/ops';

test('resourcepaneel: Totaal = uren van de contourdialoog × tarief, ook op een taakkalender met andere uren/dag', async ({ page, ops: _ops }) => {
  const { resourceId } = await page.evaluate(() => {
    const g = () => window.__OPS__!.store.getState();
    g().setProject({ startDate: '2026-06-01' });
    g().setViewStartDate('2026-06-01');
    const longCal = g().addCalendar({
      name: 'Lange dagen', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 6, workEndHour: 16, hoursPerDay: 10, holidays: [],
    });
    const taskId = g().addTask({ name: 'Bekisting', manuallyScheduled: false });
    const t = g().tasks.find(x => x.id === taskId)!;
    g().updateTask(taskId, { time: { ...t.time, scheduleDuration: 5, scheduleStart: '2026-06-01', earlyStart: '2026-06-01' } });
    g().setTaskCalendar(taskId, longCal);
    const resourceId = g().addResource({ name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 2, costPerHour: 50 });
    g().assignResource(taskId, resourceId, 1);
    g().runCPM();
    g().setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    g().selectTask(taskId);
    return { resourceId };
  });

  // Contourdialoog: echte klik op de toewijzing in het eigenschappenpaneel.
  await page.locator('[data-ops-assignment-row]').first().locator('[data-ops-assignment-contour]').click();
  const dialog = page.locator('[data-ops-contour-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-ops-contour-total]')).toHaveText('50');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Resourcepaneel, Projectweergave.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({
    activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false, resourcesView: 'project',
  }));
  const total = page.locator(`[data-ops-resource-total="${resourceId}"]`);
  await expect(total).toBeVisible();
  // Alleen de cijfers: 2.500,00 / 2,500.00 ⇒ "250000", los van de taal van de runner.
  await expect.poll(async () => (await total.textContent())?.replace(/\D/g, '')).toBe('250000');
});
