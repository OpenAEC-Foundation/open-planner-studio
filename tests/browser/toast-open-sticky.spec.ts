import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, state, test } from './fixtures/ops';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, 'fixtures', 'xer', name));

async function openXer(page: Page, name: string): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name, mimeType: 'application/octet-stream', buffer: fixture(name) });
}

const openToast = (page: Page) => page.locator('.ops-toast', { hasText: /XER file opened/ });

async function pauseClock(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 500);
}

async function stickyAfterSixSeconds(page: Page): Promise<void> {
  const toast = openToast(page);
  await expect(toast).toBeVisible();
  await pauseClock(page);
  await page.evaluate(() => window.__OPS__!.store.getState().notify({ severity: 'info', messageKey: 'notifications.templateSaved', params: { name: 'klokcontrole' } }));
  const control = page.locator('.ops-toast.toast-info', { hasText: /klokcontrole/ });
  await expect(control).toBeVisible();
  await page.clock.runFor(6_000);
  await expect(control).toHaveCount(0);
  await expect(toast).toBeVisible();
  await toast.locator('[data-ops-toast-close]').click();
  await expect(toast).toHaveCount(0);
}

test('XER met een ontbrekende geplande start: de openingsmelding blijft staan tot het kruisje', async ({ page, ops: _ops }) => {
  await page.clock.install();
  await openXer(page, 'zonder-geplande-start.xer');
  await stickyAfterSixSeconds(page);
});

test('XER met een onbekend taaktype (enum-terugval): de openingsmelding blijft staan tot het kruisje', async ({ page, ops: _ops }) => {
  await page.clock.install();
  await openXer(page, 'onbekend-taaktype.xer');
  await stickyAfterSixSeconds(page);
});

test('XER zonder bijzonderheden: de openingsmelding verdwijnt vanzelf na 5 s', async ({ page, ops: _ops }) => {
  await page.clock.install();
  await openXer(page, 'zonder-bijzonderheden.xer');
  const toast = openToast(page);
  await expect(toast).toBeVisible();
  await pauseClock(page);
  await page.clock.runFor(3_000);
  await expect(toast).toBeVisible();
  await page.clock.runFor(2_000);
  await expect(toast).toHaveCount(0);
});

async function openMsProject(page: Page, name: string): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({
    name, mimeType: 'application/xml', buffer: readFileSync(join(here, 'fixtures', 'msproject', name)),
  });
}

const msProjectToast = (page: Page) => page.locator('.ops-toast', { hasText: /Not everything in this MS Project file was imported/ });

test('MS Project XML met een extra baseline en een hyperlink: het verslag blijft staan tot het kruisje', async ({ page, ops: _ops }) => {
  await openMsProject(page, 'verslag.xml');
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.length)).toBe(1);
  const toast = msProjectToast(page);
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('1 baseline (Baseline 1–10) was not imported.');
  await expect(toast).toContainText('1 hyperlink was not imported.');
  await page.waitForTimeout(6000);
  await expect(toast).toBeVisible();
  await toast.locator('[data-ops-toast-close]').click();
  await expect(toast).toHaveCount(0);
});

test('MS Project XML zonder verlies: geen importverslag', async ({ page, ops: _ops }) => {
  await openMsProject(page, 'schoon.xml');
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.length)).toBe(1);
  await page.waitForTimeout(500);
  await expect(msProjectToast(page)).toHaveCount(0);
});
