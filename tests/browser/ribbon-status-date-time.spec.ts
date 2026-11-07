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

test('lint: een statusdatum mét tijd staat in het Statusdatum-veld (niet leeg), ook in de ingeklapte groep bij een smal venster', async ({ page, ops: _ops }) => {
  const { group, order } = await openStatusDateField(page);
  const expected = expectedSegments(order, { day: '06', month: '07', year: '2026' });
  await expect.poll(() => segmentValues(group)).toEqual(expected);

  // Smal venster: een veld kan niet tot een icoon krimpen, dus de groep klapt als geheel in tot één
  // grote knop met ▾ en een popover (automatische inpassing). Geen los mini-icoontje naast velden op
  // volle breedte, en geen gat: de vrijgekomen ruimte gaat terug naar labels.
  const size = page.viewportSize()!;
  const ribbonGroup = page.locator('[data-tour-anchor="ribbon-group:planning:baselines"]');
  const trigger = ribbonGroup.getByRole('button', { name: /^(Baselines & progress|Baselines & voortgang)$/ });
  const calc = page.locator('[data-ops-ribbon-item="calc"]');
  const scroller = page.locator('.ribbon-content-scroll');
  // Lege ruimte rechts van de laatste groep. Grens 120 px: één stap van de automaat (één knop terug
  // op volle grootte, eventueel met het groepslabel dat terugkomt) kost op deze tab 60 tot ongeveer
  // 100 px; zo'n rest is onvermijdelijk. Een gat van 150 px of meer betekent dat de ruimte van de
  // ingeklapte groep niet naar labels is gegaan.
  const freeSpace = () => scroller.evaluate(el => {
    const groups = el.querySelectorAll('.ribbon-group');
    return el.getBoundingClientRect().left + el.clientWidth - groups[groups.length - 1].getBoundingClientRect().right;
  });
  for (const width of [1000, 900, 760]) {
    await page.setViewportSize({ width, height: size.height });
    await expect(ribbonGroup).toHaveAttribute('data-ribbon-collapsed', '');
    await expect(ribbonGroup).not.toHaveAttribute('data-ribbon-fully-mini', '');
    await expect(page.getByRole('group', { name: /^(Status date|Statusdatum)$/ })).toHaveCount(0);
    await expect(trigger).toBeVisible();
    // De eerste groep (Bereken en de andere hoofdacties) houdt zijn labels zolang een veldengroep nog
    // kan inklappen. Zonder die regel stond bij 1000 px de groep nog open en waren deze knoppen mini.
    // Bij 760 px zijn alle veldengroepen al dicht; dan mag de eerste groep deels mini worden, maar
    // Bereken zelf (de eerste knop) als laatste.
    await expect(calc.locator('.ribbon-btn-label')).toBeVisible();
    if (width >= 900) await expect(page.locator('.ribbon-group').first().locator('.ribbon-btn[data-ribbon-mini]')).toHaveCount(0);
    await expect.poll(() => scroller.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await freeSpace(), `lege ruimte rechts bij ${width} px`).toBeLessThan(120);
  }

  // De popover bevat dezelfde bediening en werkt: de statusdatum staat erin, de voortgangsmodus wisselt.
  await trigger.click();
  const popoverField = page.getByRole('group', { name: /^(Status date|Statusdatum)$/ });
  await expect(popoverField).toHaveCount(1);
  await expect.poll(() => segmentValues(popoverField)).toEqual(expected);
  await page.getByRole('combobox', { name: /^(Progress mode|Voortgangsmodus)$/ }).selectOption('PROGRESS_OVERRIDE');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().project.progressMode)).toBe('PROGRESS_OVERRIDE');
  await expect(popoverField).toBeVisible();

  // Weer breed terwijl de popover open is: hij blijft open (geen invoer kwijt midden in het werk).
  // Na Escape staat de focus op de knop; pas als de focus weg is, staan de velden weer in het lint.
  await page.setViewportSize(size);
  await expect(popoverField).toBeVisible();
  await expect(ribbonGroup).toHaveAttribute('data-ribbon-collapsed', '');
  await page.keyboard.press('Escape');
  await expect(popoverField).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.locator('.ribbon-group-label').first().click();
  await expect(ribbonGroup).not.toHaveAttribute('data-ribbon-collapsed', '');
  await expect(trigger).toBeHidden();
  await expect(page.getByRole('group', { name: /^(Status date|Statusdatum)$/ })).toHaveCount(1);
  await expect.poll(() => segmentValues(group)).toEqual(expected);

  // Smaller worden terwijl de focus in het datumveld staat: de groep klapt niet in en het veld houdt
  // focus en halve invoer; na het verlaten klapt hij alsnog in.
  const daySegment = group.locator('input').nth(order.indexOf('day'));
  await daySegment.click();
  await page.keyboard.type('1');
  await page.setViewportSize({ width: 900, height: size.height });
  await expect(ribbonGroup).not.toHaveAttribute('data-ribbon-collapsed', '');
  await expect(daySegment).toBeFocused();
  await page.keyboard.type('5');
  await page.keyboard.press('Enter');
  await expect.poll(() => statusDate(page)).toBe('2026-07-15T17:00');
  await page.locator('.ribbon-group-label').first().click();
  await expect(ribbonGroup).toHaveAttribute('data-ribbon-collapsed', '');
  await page.setViewportSize(size);
  await expect(ribbonGroup).not.toHaveAttribute('data-ribbon-collapsed', '');
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
