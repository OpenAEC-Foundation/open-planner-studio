import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(here, 'fixtures', 'ifc', 'oude-baseline.ifc'));
const CHOOSER = /^(Choose column|Kolom kiezen)$/;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TEXT = new RegExp(`^(${[
  'This baseline was saved by an older version that counted a day differently. The duration variance is therefore not correct. Take the baseline again.',
  'Deze baseline is opgeslagen met een oudere versie, die een dag anders telde. De afwijking in duur klopt daarom niet. Neem de baseline opnieuw.',
].map(escape).join('|')})$`);

async function openFixture(page: Page): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'oude-baseline.ifc', mimeType: 'application/octet-stream', buffer: FIXTURE });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.map(t => t.name).sort()))
    .toEqual(['Dagtaak', 'Lange urentaak']);
}

const rowKeyOf = (page: Page, name: string) => page.evaluate(n => window.__OPS__!.store.getState().viewRows
  .find(r => r.kind === 'task' && r.task.name === n)!.rowKey, name);
const baselineIdOf = (page: Page, name: string) => page.evaluate(n => window.__OPS__!.store.getState().baselines
  .find(b => b.name === n)!.id, name);

async function addBaselineColumn(page: Page, table: Locator, label: RegExp): Promise<void> {
  await table.locator('.task-grid-add-column').click();
  const chooser = page.getByRole('dialog', { name: CHOOSER });
  await expect(chooser).toBeVisible();
  const category = chooser.locator('.task-grid-column-chooser-category', { hasText: /^Baseline/ });
  if (await category.getAttribute('aria-expanded') !== 'true') await category.click();
  await category.locator('xpath=..').getByRole('menuitemcheckbox', { name: label }).click();
  await expect(chooser).toHaveCount(0);
}

function warnings(table: Locator, rowKey: string, baselineId: string): Locator {
  return table.locator(`[role="gridcell"][data-grid-row-key="${rowKey}"][data-grid-column-id*="${baselineId}"] [data-ops-baseline-old-day]`);
}

test('oude baseline: ⚠ met uitleg in Baselineduur en Duurafwijking; een nieuwe baseline heeft er geen', async ({ page, ops: _ops }) => {
  test.setTimeout(90_000);
  await openFixture(page);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const table = page.locator('[data-task-grid-surface-id="full-task-grid"] .task-grid-shell');
  await expect(table.locator('[role="grid"]')).toBeVisible();

  await addBaselineColumn(page, table, /^Oud — (Duration|Duur)$/);
  await addBaselineColumn(page, table, /^Oud — (Duration variance|Duurafwijking)$/);

  const longRow = await rowKeyOf(page, 'Lange urentaak');
  const dayRow = await rowKeyOf(page, 'Dagtaak');
  const oud = await baselineIdOf(page, 'Oud');
  const oldWarnings = warnings(table, longRow, oud);
  await expect(oldWarnings).toHaveCount(2);
  await expect(warnings(table, dayRow, oud)).toHaveCount(0);
  for (const icon of await oldWarnings.all()) {
    await expect(icon).toHaveAttribute('aria-label', TEXT);
    await expect(icon).toHaveAttribute('title', TEXT);
  }
  await expect(table.locator(`[role="gridcell"][data-grid-row-key="${longRow}"][data-grid-column-id*="${oud}"]`))
    .toHaveText([/^233[.,]75d$/, /^[-−]46[.,]75d$/]);

  await oldWarnings.first().hover();
  await expect(page.locator('.ops-tooltip')).toHaveText(TEXT);
  await page.mouse.move(5, 5);

  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  await page.getByRole('button', { name: /^(Manage baselines…|Baselines beheren…)$/ }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: /(Save new baseline|Nieuwe baseline opslaan)/ });
  await expect(dialog).toBeVisible();
  const name = dialog.getByRole('textbox', { name: /^(Name|Naam)$/ }).last();
  await name.fill('Nieuw');
  const save = dialog.getByRole('button', { name: /^(Save|Opslaan)$/ });
  await page.evaluate(() => new Promise<void>(resolve => {
    window.__OPS__!.store.getState().setUI({ appClosing: true });
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const box = (await save.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().baselines.map(b => b.name))).toEqual(['Oud']);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ appClosing: false }));
  await expect(name).toHaveValue('Nieuw');
  await save.click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().baselines.map(b => b.name))).toEqual(['Oud', 'Nieuw']);
  await dialog.getByRole('button', { name: /^(Close|Sluiten)$/ }).last().click();
  await expect(dialog).toHaveCount(0);
  await page.locator('.ribbon-tab').first().click();
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(table.locator('[role="grid"]')).toBeVisible();

  await addBaselineColumn(page, table, /^Nieuw — (Duration|Duur)$/);
  await addBaselineColumn(page, table, /^Nieuw — (Duration variance|Duurafwijking)$/);
  const nieuw = await baselineIdOf(page, 'Nieuw');
  await expect(table.locator(`[role="gridcell"][data-grid-row-key="${longRow}"][data-grid-column-id*="${nieuw}"]`))
    .toHaveText([/^187d$/, /^0d$/]);
  await expect(warnings(table, longRow, nieuw)).toHaveCount(0);

  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  await page.getByRole('button', { name: /^(Manage baselines…|Baselines beheren…)$/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.locator('tbody tr').first().getByTitle(/^(Delete|Verwijderen)$/).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().baselines.map(b => b.name))).toEqual(['Nieuw']);
  await dialog.getByRole('button', { name: /^(Close|Sluiten)$/ }).last().click();
  await page.locator('.ribbon-tab').first().click();
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(table.locator('[role="grid"]')).toBeVisible();
  await expect(table.locator('[data-ops-baseline-old-day]')).toHaveCount(0);
});
