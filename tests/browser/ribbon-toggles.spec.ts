// Karakterisering van de gedeelde `use`-fabrieken in ribbonConfig: een gepersisteerde aan/uit-
// knop (Beeld → spelingsband) wisselt de vlag én bewaart hem, en een knop die alleen UI-state zet
// (Instellingen → Projectinfo) opent zijn dialoog — telkens opnieuw, ook na sluiten. Echte klikken;
// de storebrug leest alleen de uitkomst.
import { expect, test } from './fixtures/ops';

test('lint: gepersisteerde schakelaar wisselt en bewaart, UI-actieknop opent zijn dialoog herhaald', async ({ page, ops: _ops }) => {
  await page.locator('.ribbon-tab').filter({ hasText: /^(View|Beeld)$/ }).click();
  const floatBand = page.getByRole('button', { name: /^(Float band|Spelingsband)/ });
  const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.showFloatBand);

  await floatBand.click();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showFloatBand)).toBe(!before);
  expect(await page.evaluate(() => localStorage.getItem('ops-showFloatBand'))).toBe(String(!before));
  await expect.poll(() => floatBand.evaluate(el => el.classList.contains('active'))).toBe(!before);

  await floatBand.click();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showFloatBand)).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('ops-showFloatBand'))).toBe(String(before));

  await page.locator('.ribbon-tab').filter({ hasText: /^(Settings|Instellingen)$/ }).click();
  const projectInfo = page.getByRole('button', { name: /^(Project info|Projectinfo)/ });
  for (let i = 0; i < 2; i++) {
    await projectInfo.click();
    const dialog = page.locator('[data-ops-project-dialog="info"]');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});
