// ⚠ bij een baseline met de oude dagtelling (eigenaarsbesluit 2026-10-15): oude baselines worden niet
// omgerekend, maar de kolommen Baselineduur en Duurafwijking tonen een klein ⚠ met uitleg. Detectie en
// randgevallen: `tests/planning/check-baseline-oude-dagtelling.ts`.
//
// Fixture `fixtures/ifc/oude-baseline.ifc` is gemaakt met main 3832e5d85 (oude telling): urentaak
// "Lange urentaak" 1870 u op "Lange dagen" (8 u/dag, blokken van 10 u) met baseline "Oud" = 233,75 d;
// "Dagtaak" 40 u op een dagkalender. Echte flow: ribbonknop Openen en de bestandskiezer, de kolomkiezer
// in de tabelkop, het venster Baselines beheren, hover op het ⚠. `__OPS__` leest alleen (rij- en
// baseline-id's).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(here, 'fixtures', 'ifc', 'oude-baseline.ifc'));
const CHOOSER = /^(Choose column|Kolom kiezen)$/;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** De uitleg in en of nl (de testtaal volgt de browser). */
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

/** Leest alleen: de rijsleutel van een taak en de id van een baseline. */
const rowKeyOf = (page: Page, name: string) => page.evaluate(n => window.__OPS__!.store.getState().viewRows
  .find(r => r.kind === 'task' && r.task.name === n)!.rowKey, name);
const baselineIdOf = (page: Page, name: string) => page.evaluate(n => window.__OPS__!.store.getState().baselines
  .find(b => b.name === n)!.id, name);

/** Zet via de plus in de tabelkop de kolom `<baseline> — <veld>` erbij. */
async function addBaselineColumn(page: Page, table: Locator, label: RegExp): Promise<void> {
  await table.locator('.task-grid-add-column').click();
  const chooser = page.getByRole('dialog', { name: CHOOSER });
  await expect(chooser).toBeVisible();
  const category = chooser.locator('.task-grid-column-chooser-category', { hasText: /^Baseline/ });
  if (await category.getAttribute('aria-expanded') !== 'true') await category.click();
  await category.locator('xpath=..').getByRole('menuitemcheckbox', { name: label }).click();
  await expect(chooser).toHaveCount(0);
}

/** De ⚠ in de baselinekolommen van één baseline, voor één taakrij. */
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
  // De cel houdt haar getal: 233,75 d baseline, −46,75 d afwijking.
  await expect(table.locator(`[role="gridcell"][data-grid-row-key="${longRow}"][data-grid-column-id*="${oud}"]`))
    .toHaveText([/^233[.,]75d$/, /^[-−]46[.,]75d$/]);

  // Hover: de thema-tooltip (TooltipHost) toont de uitleg.
  await oldWarnings.first().hover();
  await expect(page.locator('.ops-tooltip')).toHaveText(TEXT);
  await page.mouse.move(5, 5);

  // Neem de baseline opnieuw: Planning › Baselines beheren… › Opslaan.
  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  await page.getByRole('button', { name: /^(Manage baselines…|Baselines beheren…)$/ }).click();
  // Het venster heeft geen toegankelijke naam; herken het aan zijn blok "Nieuwe baseline opslaan".
  const dialog = page.getByRole('dialog').filter({ hasText: /(Save new baseline|Nieuwe baseline opslaan)/ });
  await expect(dialog).toBeVisible();
  const name = dialog.getByRole('textbox', { name: /^(Name|Naam)$/ }).last();
  await name.fill('Nieuw');
  const save = dialog.getByRole('button', { name: /^(Save|Opslaan)$/ });
  // #804 stap 3, fixronde 2: in de laatste fase van afsluiten (`ui.appClosing`; afsluiten bestaat alleen op desktop, hier
  // gezet via de bridge) is ook een dialoog die al openstond niet te bedienen. Een echte klik op Opslaan en Escape doen
  // niets; breekt het afsluiten af, dan staat de dialoog er nog met de getypte naam.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ appClosing: true }));
  await expect(page.locator('[data-ops-app-root]')).toHaveAttribute('inert', '');
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
  // De tab Planning toont de Gantt; terug naar de Tabel via de tab Home/Start.
  await page.locator('.ribbon-tab').first().click();
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(table.locator('[role="grid"]')).toBeVisible();

  await addBaselineColumn(page, table, /^Nieuw — (Duration|Duur)$/);
  await addBaselineColumn(page, table, /^Nieuw — (Duration variance|Duurafwijking)$/);
  const nieuw = await baselineIdOf(page, 'Nieuw');
  await expect(table.locator(`[role="gridcell"][data-grid-row-key="${longRow}"][data-grid-column-id*="${nieuw}"]`))
    .toHaveText([/^187d$/, /^0d$/]);
  await expect(warnings(table, longRow, nieuw)).toHaveCount(0);

  // De oude baseline weg: dan staat er nergens meer een ⚠.
  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  await page.getByRole('button', { name: /^(Manage baselines…|Baselines beheren…)$/ }).click();
  await expect(dialog).toBeVisible();
  // De eerste rij is "Oud" (volgorde van opslaan); de poll hieronder bewijst dat juist die weg is.
  await dialog.locator('tbody tr').first().getByTitle(/^(Delete|Verwijderen)$/).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().baselines.map(b => b.name))).toEqual(['Nieuw']);
  await dialog.getByRole('button', { name: /^(Close|Sluiten)$/ }).last().click();
  await page.locator('.ribbon-tab').first().click();
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(table.locator('[role="grid"]')).toBeVisible();
  await expect(table.locator('[data-ops-baseline-old-day]')).toHaveCount(0);
});
