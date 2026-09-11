// Issue #115 (manuvarkey): het compacte Resources-paneel in de rechterrail toont per resource haar
// kleur — dezelfde bron (`resourceDisplayColor`) als het resource-accent onder de Gantt-balk, zodat de
// gebruiker het accent aan een resource kan koppelen.
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
  // Amber-400 ligt boven de donker-thema-verlichtingsdrempel van `ensureThemeVisible`, dus de
  // verwachting is in licht én donker thema dezelfde hex (donkere tinten worden op donker verlicht).
  await expect(explicit).toHaveCSS('background-color', 'rgb(251, 191, 36)');
  // Zonder eigen kleur: de deterministische paletkleur, nooit leeg/transparant.
  const auto = page.locator(`[data-ops-resource-color="${ids.noColor}"]`);
  await expect(auto).toBeVisible();
  await expect(auto).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});
