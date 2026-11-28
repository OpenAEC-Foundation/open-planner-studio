import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, state, test } from './fixtures/ops';

const FIXTURE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'statusdatum-1700.xml'), 'utf8');

async function openFixture(page: Page): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooserPromise = page.waitForEvent('filechooser');
  await openButton.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'statusdatum-1700.xml', mimeType: 'application/xml', buffer: Buffer.from(FIXTURE) });
}

async function spyOnCanvasText(page: Page): Promise<void> {
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const drawn: string[] = [];
    CanvasRenderingContext2D.prototype.fillText = function fillText(text: string, x: number, y: number, maxWidth?: number) {
      drawn.push(String(text));
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
    Object.defineProperty(window, '__opsDrawnText', { configurable: true, value: drawn });
  });
}

async function drawnText(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as Window & { __opsDrawnText?: string[] }).__opsDrawnText ?? []);
}

async function clearDrawnText(page: Page): Promise<void> {
  await page.evaluate(() => { (window as Window & { __opsDrawnText?: string[] }).__opsDrawnText!.length = 0; });
}

async function store(page: Page) {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks.find(t => t.name === 'Metselwerk lopend');
    return {
      statusDate: s.project.statusDate,
      scheduleStale: s.scheduleStale,
      earlyFinish: task?.time.earlyFinish,
      dateNotation: s.ui.dateNotation,
      timeNotation: s.ui.timeNotation,

    };
  });
}

test('statusdatum met tijd: lint toont datum én 17:00, tijd naar 12:00 + F5 verschuift het restwerk, Gantt-label in datumnotatie', async ({ page, ops: _ops }) => {
  await spyOnCanvasText(page);
  await openFixture(page);
  await expect.poll(async () => (await store(page)).statusDate).toBe('2006-09-20T17:00');
  await page.keyboard.press('F5');
  await expect.poll(async () => (await store(page)).earlyFinish?.slice(0, 10)).toBe('2006-09-22');
  const before = await store(page);
  expect(before.dateNotation).toBe('dmy');
  expect(before.timeNotation).toBe('24h');
  expect(before.earlyFinish?.slice(0, 10)).toBe('2006-09-22');

  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  const group = page.getByRole('group', { name: /^(Status date|Statusdatum)$/ }).first();
  await expect(group).toBeVisible();
  await expect.poll(() => group.locator('input').evaluateAll(inputs => inputs.map(i => (i as HTMLInputElement).value)))
    .toEqual(['20', '09', '2006']);
  const timeField = page.locator('input[data-ops-status-date-time]');
  await expect(timeField).toBeVisible();
  await expect(timeField).toHaveValue('17:00');

  await expect.poll(() => drawnText(page)).toContain('20-09-2006 17:00');
  expect((await drawnText(page)).some(text => text.startsWith('2006-09-20'))).toBe(false);

  const depth = (await state(page)).undoDepth;
  await timeField.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('12:00');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await store(page)).statusDate).toBe('2006-09-20T12:00');
  expect((await store(page)).scheduleStale).toBe(true);
  expect((await state(page)).undoDepth).toBe(depth + 1);
  await expect(timeField).toHaveValue('12:00');

  await clearDrawnText(page);
  await page.locator('.ribbon-info').filter({ hasText: /^(Status date|Statusdatum)$/ }).first().click();
  await page.keyboard.press('F5');
  await expect.poll(async () => (await store(page)).scheduleStale).toBe(false);
  expect((await store(page)).earlyFinish?.slice(0, 10)).toBe('2006-09-21');
  await expect.poll(() => drawnText(page)).toContain('20-09-2006 12:00');

  const dayField = group.locator('input').first();
  await dayField.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('19');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await store(page)).statusDate).toBe('2006-09-19T12:00');
  await expect(timeField).toHaveValue('12:00');
});

test('dag-modus: geen tijdveld, ook met Urenplanning aan en een statusdatum met tijd; label zonder tijd', async ({ page, ops: _ops }) => {
  await spyOnCanvasText(page);
  expect(await page.evaluate(() => !!window.__OPS__!.store.getState().calendar.workTime)).toBe(false);
  const day = '2027-06-28';
  await page.evaluate(iso => {
    const s = window.__OPS__!.store.getState();
    s.setViewStartDate('2027-06-27');
    s.setProject({ statusDate: `${iso}T17:00` });
  }, day);
  const [yyyy, mm, dd] = day.split('-');
  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  const group = page.getByRole('group', { name: /^(Status date|Statusdatum)$/ }).first();
  await expect(group).toBeVisible();
  await expect.poll(() => group.locator('input').evaluateAll(inputs => inputs.map(i => (i as HTMLInputElement).value)))
    .toEqual([dd, mm, yyyy]);
  await expect(page.locator('input[data-ops-status-date-time]')).toHaveCount(0);
  await expect.poll(() => drawnText(page)).toContain(`${dd}-${mm}-${yyyy}`);
  expect((await drawnText(page)).some(text => text.includes('17:00'))).toBe(false);
  expect((await drawnText(page)).some(text => text.startsWith(day))).toBe(false);
  await clearDrawnText(page);
  await group.locator('input').first().click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('29');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await store(page)).statusDate).toBe('2027-06-29T17:00');
  await expect.poll(() => drawnText(page)).toContain('29-06-2027');
  expect((await drawnText(page)).some(text => text.startsWith('2027-06-29') || text.includes('17:00'))).toBe(false);
});

test('uur-modus zonder tijd in de statusdatum: leeg tijdveld, tijd zetten en weghalen', async ({ page, ops: _ops }) => {
  await spyOnCanvasText(page);
  await openFixture(page);
  await expect.poll(async () => (await store(page)).statusDate).toBe('2006-09-20T17:00');
  await page.evaluate(() => window.__OPS__!.store.getState().setProject({ statusDate: '2006-09-20' }));
  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  const timeField = page.locator('input[data-ops-status-date-time]');
  await expect(timeField).toHaveValue('');
  await timeField.click();
  await page.keyboard.type('7:30');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await store(page)).statusDate).toBe('2006-09-20T07:30');
  await timeField.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await store(page)).statusDate).toBe('2006-09-20');
});
