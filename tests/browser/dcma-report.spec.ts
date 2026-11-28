import { expect, seedProject, test } from './fixtures/ops';

test('planningsgezondheid: DCMA-sectie toont de veertien punten met uitslag', async ({ page, ops: _ops }) => {
  const [a, b] = await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Casco', start: '2026-09-21', finish: '2026-10-16', durationDays: 20 },
  ], 'DCMA');
  await page.evaluate(({ a, b }) => {
    const s = window.__OPS__!.store.getState();
    s.addSequence({ predecessorId: a, successorId: b, type: 'START_START', lagDays: 2 });
    s.runCPM();
  }, { a, b });

  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  await page.getByLabel(/^(Report type|Rapporttype)$/).first().click();
  await page.getByRole('option', { name: /^(Schedule health|Planningsgezondheid)$/ }).click();

  const report = page.locator('[data-ops-table-report]');
  await expect(report).toBeVisible();
  const rows = report.locator('[data-ops-report-section="dcma"] tbody tr');
  await expect(rows).toHaveCount(14);
  await expect(rows.nth(0)).toContainText(/Logic|Logica/);
  await expect(rows.nth(2)).toContainText(/Flag|Markering/);
  await expect(rows.nth(3)).toContainText(/Flag|Markering/);
  await expect(rows.nth(8)).toContainText(/no status date|geen statusdatum/);
  await expect(report.locator('[data-ops-report-summary] > div').first()).toHaveText(/^(DCMA flags|DCMA-markeringen)\d+$/);
});
