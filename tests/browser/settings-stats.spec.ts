import { expect, test } from './fixtures/ops';
import type { Page } from '@playwright/test';

const STATS_URL = 'https://raw.githubusercontent.com/OpenAEC-Foundation/open-planner-studio/stats/downloads.json';

const bucket = (install: number, update: number, both: number) => ({ install, update, both, byKind: {} });
const release = (tag: string, publishedAt: string, win: number, mac: number, linux: number) => ({
  tag, publishedAt, prerelease: false, polls: 1,
  os: { windows: bucket(win, 0, 0), macos: bucket(mac, 0, 0), linux: bucket(0, 0, linux) },
});
const FIXTURE = {
  schemaVersion: 1,
  generatedAt: '2026-09-07T13:54:32.273Z',
  totals: { windows: bucket(358, 87, 0), macos: bucket(59, 24, 0), linux: bucket(13, 0, 256) },
  polls: 1061,
  releases: [
    release('v2026.9.0', '2026-09-02T06:59:30Z', 72, 5, 30),
    release('v2026.8.1', '2026-08-19T09:48:18Z', 98, 10, 50),
    release('v2026.8.0', '2026-08-17T14:23:51Z', 14, 1, 16),
    release('v2026.7.14', '2026-07-30T14:41:10Z', 44, 9, 25),
    release('v2026.7.13', '2026-07-27T17:59:56Z', 12, 27, 28),
    release('v2026.7.12', '2026-07-23T07:45:20Z', 14, 1, 8),
    release('v2026.7.11', '2026-07-20T07:29:13Z', 11, 0, 7),
    release('v2026.7.10', '2026-07-10T12:07:01Z', 24, 1, 12),
  ],
};

async function openStatsDialog(page: Page): Promise<void> {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const settings = page.locator('.settings-dialog');
  await expect(settings).toBeVisible();
  await settings.locator('[data-ops-settings-group="about"]').click();
  await settings.getByRole('button', { name: 'Statistics…' }).click();
  await expect(settings).toHaveCount(0);
  await expect(page.locator('[data-ops-stats-dialog]')).toBeVisible();
}

test('Statistieken achter de knop op tab Geavanceerd: downloads per OS en per release, past in de dialoog, en valt bij een fout terug op de cache', async ({ page, ops }) => {
  ops.acceptError(/status of 503/);
  let hits = 0;
  await page.route(STATS_URL, route => { hits++; void route.fulfill({ json: FIXTURE }); });

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  await expect(page.locator('.settings-dialog [data-ops-settings-group="stats"]')).toHaveCount(0);
  await openStatsDialog(page);

  const dialog = page.locator('[data-ops-stats-dialog]');
  const stats = dialog.locator('[data-ops-download-stats]');
  await expect(stats).toBeVisible();
  const windowsRow = stats.getByRole('row', { name: /^Windows/ });
  await expect(windowsRow).toContainText('358');
  await expect(windowsRow).toContainText('87');
  await expect(stats.getByRole('row', { name: /^Total/ })).toContainText('686');
  await expect(stats.getByText('Update checks from the app: 1,061')).toBeVisible();
  await expect(stats.getByText(/As of/)).toBeVisible();
  await page.screenshot({ path: 'test-results/settings-stats-tab-top.png' });

  await expect(stats.getByRole('row', { name: /^v2026\./ })).toHaveCount(6);
  await stats.getByRole('button', { name: 'Show all 8 releases' }).click();
  await expect(stats.getByRole('row', { name: /^v2026\./ })).toHaveCount(8);
  await expect(stats.getByRole('row', { name: /^v2026\.7\.10/ })).toContainText('24');

  await expect(dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).resolves.toBe(true);
  await expect(stats.evaluate(el => el.scrollWidth <= el.clientWidth)).resolves.toBe(true);
  await page.screenshot({ path: 'test-results/settings-stats-tab.png' });

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await openStatsDialog(page);
  await expect(stats.getByRole('row', { name: /^Total/ })).toContainText('686');
  expect(hits).toBe(1);

  await page.unroute(STATS_URL);
  await page.route(STATS_URL, route => { hits++; void route.fulfill({ status: 503, body: 'down' }); });
  await stats.getByRole('button', { name: 'Refresh now' }).click();
  await expect(stats.getByRole('alert')).toContainText('could not be fetched');
  await expect(stats.getByRole('row', { name: /^Total/ })).toContainText('686');
  expect(hits).toBe(2);
});
