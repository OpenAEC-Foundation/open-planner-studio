import { expect, test } from './fixtures/ops';

test('compact resource panel: kleurvlakje per resource volgt de resourcekleur', async ({ page, ops: _ops }) => {
  const ids = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const withColor = s.addResource({ name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 1, color: '#FBBF24' });
    const noColor = s.addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
    s.setUI({ showResourcePanel: true, resourcePanelDocked: true, rightPanelCollapsed: false });
    return { withColor, noColor };
  });
  const explicit = page.locator(`[data-ops-resource-color="${ids.withColor}"]`);
  await expect(explicit).toBeVisible();
  await expect(explicit).toHaveCSS('background-color', 'rgb(251, 191, 36)');
  const auto = page.locator(`[data-ops-resource-color="${ids.noColor}"]`);
  await expect(auto).toBeVisible();
  await expect(auto).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});
