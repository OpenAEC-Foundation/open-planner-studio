// Standaardmaat voor nieuwe taken (spec "alleen uren" §3.2, besluit B1a) in Projectinstellingen, met
// echte klikken: in het OPS-profiel kies je Dagenmaat of Urenmaat; onder het P6-profiel staat de keuze
// vast op Urenmaat, met de uitleg eronder. `window.__OPS__` zet alleen de beginstand (het profiel) en
// leest de store; de geteste handelingen zijn klikken.
//
// OPS_MEASURE_SHOTS=<map> bewaart schermbeelden van het veld, licht en donker, in beide standen.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const SHOTS = process.env.OPS_MEASURE_SHOTS;

/** Alleen voor de schermbeelden: het thema via de store (`ui.uiTheme`), zoals de instelling het zet. */
async function shots(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme);
  await field(page).scrollIntoViewIfNeeded();
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => window.__OPS__!.store.getState().setUI({ uiTheme: t }), theme);
    await page.waitForTimeout(400);
    const box = await field(page).boundingBox();
    await page.screenshot({
      path: `${SHOTS}/${name}-${theme === 'light' ? 'licht' : 'donker'}.png`,
      clip: box ? { x: Math.max(0, box.x - 16), y: Math.max(0, box.y - 16), width: box.width + 32, height: box.height + 32 } : undefined,
    });
  }
  await page.evaluate((t) => window.__OPS__!.store.getState().setUI({ uiTheme: t }), before);
}

const field = (page: Page) => page.locator('[data-ops-default-task-measure]');
const trigger = (page: Page) =>
  field(page).getByRole('button', { name: /^(Default measure for new tasks|Standaardmaat voor nieuwe taken)$/ });
const storedUnit = (page: Page) =>
  page.evaluate(() => window.__OPS__!.store.getState().project.defaultTaskDurationUnit ?? null);
const activeTab = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().ui.activeRibbonTab);

async function toProjectInfo(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
  await page.locator('.backstage-sidebar').getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).click();
  await expect(field(page)).toBeVisible();
}

test('standaardmaat: kiezen in OPS, vast op Urenmaat onder P6', async ({ page, ops }) => {
  void ops;
  await toProjectInfo(page);
  // OPS-profiel: Dagenmaat staat gekozen en de keuze is vrij.
  await expect(trigger(page)).toHaveText(/^(Day measure|Dagenmaat)$/);
  await expect(trigger(page)).toBeEnabled();
  await shots(page, 'standaardmaat-ops');

  await trigger(page).click();
  await page.getByRole('option', { name: /^(Hour measure|Urenmaat)$/ }).click();
  await expect(trigger(page)).toHaveText(/^(Hour measure|Urenmaat)$/);
  await page.locator('[data-ops-project-info-actions]').getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => activeTab(page)).not.toBe('file');
  await expect.poll(() => storedUnit(page)).toBe('hours');

  // Beginstand voor het tweede deel: het P6-profiel, met de eigen keuze terug op dagen.
  await page.evaluate(() => window.__OPS__!.store.getState().setProject({
    defaultTaskDurationUnit: 'days',
    schedulingProfile: { baseId: 'p6', id: 'p6', name: '', overrides: {} },
  }));
  await toProjectInfo(page);
  await expect(trigger(page)).toHaveText(/^(Hour measure|Urenmaat)$/);
  await expect(trigger(page)).toBeDisabled();
  await expect(field(page)).toContainText('Primavera P6');
  await shots(page, 'standaardmaat-p6');
  // De eigen keuze blijft bewaard voor een wissel terug naar OPS.
  expect(await storedUnit(page)).toBe('days');
});
