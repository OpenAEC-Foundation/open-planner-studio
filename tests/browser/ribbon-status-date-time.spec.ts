import type { Locator, Page } from '@playwright/test';
import { expect, state, test } from './fixtures/ops';

const STATUS = '2026-07-06T17:00';

async function statusDate(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__OPS__!.store.getState().project.statusDate);
}

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

  const size = page.viewportSize()!;
  const ribbonGroup = page.locator('[data-tour-anchor="ribbon-group:planning:baselines"]');
  const trigger = ribbonGroup.getByRole('button', { name: /^(Baselines & progress|Baselines & voortgang)$/ });
  const calc = page.locator('[data-ops-ribbon-item="calc"]');
  const scroller = page.locator('.ribbon-content-scroll');
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
    await expect(calc.locator('.ribbon-btn-label')).toBeVisible();
    if (width >= 900) await expect(page.locator('.ribbon-group').first().locator('.ribbon-btn[data-ribbon-mini]')).toHaveCount(0);
    await expect.poll(() => scroller.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await freeSpace(), `lege ruimte rechts bij ${width} px`).toBeLessThan(120);
  }

  await page.setViewportSize({ width: 900, height: size.height });
  await expect(ribbonGroup).toHaveAttribute('data-ribbon-collapsed', '');
  await trigger.click();
  const popoverField = page.getByRole('group', { name: /^(Status date|Statusdatum)$/ });
  await expect(popoverField).toHaveCount(1);
  await expect.poll(() => segmentValues(popoverField)).toEqual(expected);
  await page.getByRole('combobox', { name: /^(Progress mode|Voortgangsmodus)$/ }).selectOption('PROGRESS_OVERRIDE');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().project.progressMode)).toBe('PROGRESS_OVERRIDE');
  await expect(popoverField).toBeVisible();

  const panel = page.locator('div[style*="position: fixed"]').filter({ has: popoverField });
  const horizontalOverlap = async () => {
    const [p, t] = [await panel.boundingBox(), await trigger.boundingBox()];
    return p && t ? Math.min(p.x + p.width, t.x + t.width) - Math.max(p.x, t.x) : -1;
  };
  expect(await horizontalOverlap()).toBeGreaterThan(0);
  const triggerXAt900 = (await trigger.boundingBox())!.x;
  await page.setViewportSize({ width: 1600, height: size.height });
  await expect(popoverField).toBeVisible();
  await expect(ribbonGroup).toHaveAttribute('data-ribbon-collapsed', '');
  await expect.poll(async () => (await trigger.boundingBox())!.x).toBeGreaterThan(triggerXAt900 + 100);
  expect(await horizontalOverlap(), 'paneel staat onder zijn knop na verbreden').toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(popoverField).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.locator('.ribbon-group-label').first().click();
  await expect(ribbonGroup).not.toHaveAttribute('data-ribbon-collapsed', '');
  await expect(trigger).toBeHidden();
  await expect(page.getByRole('group', { name: /^(Status date|Statusdatum)$/ })).toHaveCount(1);
  await expect.poll(() => segmentValues(group)).toEqual(expected);

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

  const groupWidth = async () => (await ribbonGroup.boundingBox())!.width;
  const widthWithDate = await groupWidth();
  const clear = ribbonGroup.getByRole('button', { name: /^(Clear status date|Statusdatum leegmaken)$/ });
  await clear.click();
  await expect.poll(() => statusDate(page)).toBeUndefined();
  await expect(clear).toHaveCount(0);
  expect(await groupWidth()).toBe(widthWithDate);
  expect(await ribbonGroup.locator('.ribbon-btn.small[aria-hidden="true"]').evaluate(el => el.getBoundingClientRect().width)).toBeLessThan(30);
  await page.evaluate((value) => window.__OPS__!.store.getState().setProject({ statusDate: value }), STATUS);
  await expect(clear).toBeVisible();

  await page.setViewportSize({ width: 900, height: size.height });
  await expect(ribbonGroup).toHaveAttribute('data-ribbon-collapsed', '');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(popoverField).toBeVisible();
  await expect(page.getByRole('dialog', { name: /^(Baselines & progress|Baselines & voortgang)$/ })).toBeVisible();
  await expect(popoverField.locator('input').first()).toBeFocused();
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  expect(await panel.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await panel.getByRole('button', { name: /^(Clear status date|Statusdatum leegmaken)$/ }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => statusDate(page)).toBeUndefined();
  await expect(popoverField.locator('input').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(popoverField).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await page.evaluate((value) => window.__OPS__!.store.getState().setProject({ statusDate: value }), STATUS);
  await trigger.click();
  await expect.poll(() => segmentValues(popoverField)).toEqual(expected);
  await popoverField.locator('input').nth(order.indexOf('day')).click();
  await page.keyboard.type('15');
  await page.locator('.ribbon-group-label').first().click();
  await expect(popoverField).toHaveCount(0);
  await expect.poll(() => statusDate(page)).toBe('2026-07-15T17:00');
});

test('lint: Statusdatum aanklikken en verlaten zonder wijziging laat hem exact staan, zonder undo-stap', async ({ page, ops: _ops }) => {
  const { group, order } = await openStatusDateField(page);
  const depth = (await state(page)).undoDepth;
  const daySegment = group.locator('input').nth(order.indexOf('day'));

  await daySegment.click();
  await expect(daySegment).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(daySegment).not.toBeFocused();
  expect(await statusDate(page)).toBe(STATUS);
  expect((await state(page)).undoDepth).toBe(depth);

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

  await daySegment.click();
  await page.keyboard.type('08');
  await page.keyboard.press('Enter');
  await expect.poll(() => statusDate(page)).toBe('2026-07-08T17:00');
  expect((await state(page)).undoDepth).toBe(depth + 1);
  await expect.poll(() => segmentValues(group)).toEqual(expectedSegments(order, { day: '08', month: '07', year: '2026' }));
});
