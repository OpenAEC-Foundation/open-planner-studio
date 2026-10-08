// Review vader (2026-10-06), punt 4: de knoppen Nieuw, Openen en Opslaan linksboven in de
// titelbalk zijn weg. Ze stonden ook op Start en in Bestand, en de Opslaan-knop droeg het
// misleidende label "Opslaan als…". Ongedaan maken, Opnieuw en Automatisch opslaan blijven staan.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const SHOT_DIR = process.env.OPS_QA_SHOTS;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, clip: { x: 0, y: 0, width: 760, height: 160 } });
}

test('titelbalk: geen Nieuw/Openen/Opslaan meer, wel Ongedaan/Opnieuw/Automatisch opslaan', async ({ page, ops: _ops }) => {
  const toolbar = page.locator('.quick-access-toolbar');
  await expect(toolbar).toBeVisible();
  // Alleen nog de twee pijlen (en het tandwiel) als icoonknop.
  await expect(toolbar.locator('button.quick-access-btn')).toHaveCount(3);
  await expect(toolbar.locator('button[title="Save as..."]')).toHaveCount(0);
  await expect(toolbar.locator('[data-ops-autosave]')).toBeVisible();

  // Opslaan, Openen en Nieuw blijven bereikbaar via het lint.
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New', exact: true })).toBeVisible();
  await shot(page, 'titelbalk');
});
