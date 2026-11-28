import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const SHOT_DIR = process.env.OPS_QA_SHOTS;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, clip: { x: 0, y: 0, width: 760, height: 160 } });
}

test('titelbalk: geen Nieuw/Openen/Opslaan meer, wel Ongedaan/Opnieuw/Automatisch opslaan', async ({ page, ops: _ops }) => {
  const toolbar = page.locator('.quick-access-toolbar');
  await expect(toolbar).toBeVisible();
  await expect(page.locator('.window-controls')).toHaveCount(0);
  await expect(toolbar.locator('button.quick-access-btn')).toHaveCount(3);
  await expect(toolbar.locator('button[title="Save as..."]')).toHaveCount(0);
  await expect(toolbar.locator('[data-ops-autosave]')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New', exact: true })).toBeVisible();
  await shot(page, 'titelbalk');
});
