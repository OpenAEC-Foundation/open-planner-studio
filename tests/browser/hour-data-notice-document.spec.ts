// T25: oude voorkeuren blijven staan en hebben geen invloed op bewerken of uurzoom.
import { expect, test, waitForOps } from './fixtures/ops';

test('oude urenplanningvoorkeur aan en uit verandert niets; urentaak blijft bewerkbaar', async ({ page, ops: _ops }) => {
  for (const legacy of ['true', 'false']) {
    await page.evaluate(value => localStorage.setItem('ops-enableHourPlanning', value), legacy);
    await page.reload();
    await waitForOps(page);
    const id = await page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false, allowMixedDayHour: true });
      const id = s.addTask({ name: 'Altijd bewerkbare uren', manuallyScheduled: true });
      const task = window.__OPS__!.store.getState().tasks.find(t => t.id === id)!;
      s.updateTask(id, { time: { ...task.time, durationUnit: 'hours', durationMinutes: 240, scheduleDuration: 0.5 } });
      s.selectTask(id);
      return id;
    });
    const input = page.locator('[data-ops-task-duration] [data-ops-duration-value]').first();
    await expect(input).toBeEnabled();
    await input.fill('6h');
    await input.press('Enter');
    await expect.poll(() => page.evaluate(taskId => {
      const s = window.__OPS__!.store.getState();
      return { minutes: s.tasks.find(t => t.id === taskId)!.time.durationMinutes,
        legacy: localStorage.getItem('ops-enableHourPlanning'), hasSwitch: 'enableHourPlanning' in s.ui };
    }, id)).toEqual({ minutes: 360, legacy, hasSwitch: false });
    await expect(page.locator('[data-ops-hour-data-notice]')).toHaveCount(0);
  }
});
