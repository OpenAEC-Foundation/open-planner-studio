import type { Locator, Page } from '@playwright/test';
import { expect, state, test } from './fixtures/ops';

/**
 * Het Statusdatum-veld in het lint (Planning → Baselines & voortgang) met een statusdatum MÉT tijd.
 * MS Project bewaart de statusdatum op de standaard eindtijd (17:00) en zowel de MSPDI- als de
 * `.mpp`-lezer nemen die tijd over (`2026-07-06T17:00`); via IFC en MCP kan een uurproject hem ook
 * dragen. Het gedeelde datumveld kende alleen `JJJJ-MM-DD`: het toonde zo'n statusdatum leeg en wie
 * er alleen doorheen klikte of tabde wiste hem (een lege commit ⇒ `setStatusDate(undefined)`).
 *
 * Alle geteste handelingen gaan via echte muis-/toetsenbordevents. De dev-brug zet alleen de
 * fixture (de statusdatum, zoals een geopend bestand hem levert) en leest state.
 */

const STATUS = '2026-07-06T17:00';

async function statusDate(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__OPS__!.store.getState().project.statusDate);
}

/** Zet de fixture-statusdatum en opent het Planning-tabblad via een echte klik. De fixture gaat via
 *  `setProject` (een projectgegeven zoals een geopend bestand het levert), niet via `setStatusDate`:
 *  die bundelt opeenvolgende statusdatumwijzigingen in één undo-stap (`coalesceKey`), waardoor de
 *  fixture en de geteste bewerking één stap zouden worden. */
async function openStatusDateField(page: Page): Promise<{ group: Locator; order: string[] }> {
  const order = await page.evaluate((value) => {
    const s = window.__OPS__!.store.getState();
    s.setProject({ statusDate: value });
    return { dmy: ['day', 'month', 'year'], mdy: ['month', 'day', 'year'], ymd: ['year', 'month', 'day'] }[s.ui.dateNotation];
  }, STATUS);
  expect(await statusDate(page)).toBe(STATUS);
  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  const group = page.getByRole('group', { name: /^(Status date|Statusdatum)$/ }).first();
  await expect(group).toBeVisible();
  return { group, order };
}

async function segmentValues(group: Locator): Promise<string[]> {
  return group.locator('input').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
}

function expectedSegments(order: string[], parts: Record<string, string>): string[] {
  return order.map(kind => parts[kind]);
}

test('lint: een statusdatum mét tijd staat in het Statusdatum-veld (niet leeg)', async ({ page, ops: _ops }) => {
  const { group, order } = await openStatusDateField(page);
  await expect.poll(() => segmentValues(group)).toEqual(expectedSegments(order, { day: '06', month: '07', year: '2026' }));
});

test('lint: Statusdatum aanklikken en verlaten zonder wijziging laat hem exact staan, zonder undo-stap', async ({ page, ops: _ops }) => {
  const { group, order } = await openStatusDateField(page);
  const depth = (await state(page)).undoDepth;
  const daySegment = group.locator('input').nth(order.indexOf('day'));

  // Verlaten met Tab.
  await daySegment.click();
  await expect(daySegment).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(daySegment).not.toBeFocused();
  expect(await statusDate(page)).toBe(STATUS);
  expect((await state(page)).undoDepth).toBe(depth);

  // Verlaten met een klik ernaast (het label van het veld, niet focusbaar).
  await daySegment.click();
  await expect(daySegment).toBeFocused();
  await page.locator('.ribbon-info').filter({ hasText: /^(Status date|Statusdatum)$/ }).first().click();
  await expect(daySegment).not.toBeFocused();
  expect(await statusDate(page)).toBe(STATUS);
  expect((await state(page)).undoDepth).toBe(depth);
  await expect.poll(() => segmentValues(group)).toEqual(expectedSegments(order, { day: '06', month: '07', year: '2026' }));
});

test('lint: een andere dag typen in het Statusdatum-veld houdt het tijddeel (…T17:00), één undo-stap', async ({ page, ops: _ops }) => {
  const { group, order } = await openStatusDateField(page);
  const depth = (await state(page)).undoDepth;
  const daySegment = group.locator('input').nth(order.indexOf('day'));

  await daySegment.click(); // selecteert het gevulde segment, typen vervangt
  await page.keyboard.type('08');
  await page.keyboard.press('Enter');
  await expect.poll(() => statusDate(page)).toBe('2026-07-08T17:00');
  expect((await state(page)).undoDepth).toBe(depth + 1);
  await expect.poll(() => segmentValues(group)).toEqual(expectedSegments(order, { day: '08', month: '07', year: '2026' }));
});
