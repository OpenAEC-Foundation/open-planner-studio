// Issue #174: "Taak splitsen" en "Relatie tekenen" werken alleen op een balk in de Gantt. Op de
// Tabel-tab staat die Gantt er niet, dus daar horen ze uit te staan — en een modus die in de
// Gantt aan stond, gaat uit zodra je naar de Tabel wisselt.
//
// Alles via echte klikken; de dev-brug zet alleen de fixture en leest de UI-state terug.
import { expect, seedProject, test } from './fixtures/ops';

test('Tabel-tab: splitsen en relatie tekenen staan uit, en een lopende modus gaat uit', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Taak', start: '2026-06-01', finish: '2026-06-12', durationDays: 10 }]);

  await page.locator('[data-ops-ribbon-tab="start"]').click();
  const split = page.locator('[data-ops-ribbon-item="splitTask"]');
  await expect(split).not.toHaveAttribute('aria-disabled', 'true');
  await split.click();
  await expect(page.locator('[data-ops-split-mode]')).toBeVisible();

  await page.locator('[data-ops-ribbon-tab="table"]').click();
  await expect(page.locator('[data-ops-split-mode]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showSplitMode)).toBe(false);

  await expect(split).toHaveAttribute('aria-disabled', 'true');
  await split.click({ force: true });
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showSplitMode)).toBe(false);

  // De relatie-dropdown heeft geen spec-id; het schakelicoon is taalonafhankelijk.
  await page.locator('.ribbon-btn[aria-haspopup="menu"]').filter({ has: page.locator('.lucide-link') }).click();
  const draw = page.locator('.ribbon-relation-menu-item').first();
  await expect(draw).toBeDisabled();
  await expect(page.locator('[data-ops-dependency-mode]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showDependencyMode)).toBe(false);

  // Het rijmenu van de tabel: "Relatie toevoegen" staat uit en zegt waarom.
  await page.keyboard.press('Escape');
  await page.locator('[data-grid-cell-key]').first().click({ button: 'right' });
  const addRelation = page.locator('button[data-ops-context-disabled][title]');
  await expect(addRelation).toHaveCount(1);
  await expect(addRelation).toBeDisabled();
  await expect(addRelation).toHaveAttribute('title', /Gantt/);

  // Terug naar de Gantt: de knoppen doen het weer.
  await page.keyboard.press('Escape');
  await page.locator('[data-ops-ribbon-tab="start"]').click();
  await expect(split).not.toHaveAttribute('aria-disabled', 'true');
});
