import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, state, test } from './fixtures/ops';

/**
 * De statusdatum toont ook de TIJD, en die tijd is te wijzigen (besluit eigenaar 2026-10-17).
 *
 * Fixture: een kleine, zelfgemaakte MSPDI met statusdatum 2006-09-20 17:00 en één lopende taak
 * "Metselwerk lopend" (25 % klaar, 2 dagen). Met 17:00 valt het restwerk op 21 en 22 september;
 * met 12:00 begint het een halve dag eerder en eindigt het op 21 september.
 *
 * Alle geteste handelingen gaan via echte muis-/toetsenbordevents (bestand openen, tabblad, tijd typen,
 * F5). De dev-brug leest alleen state; de getekende canvastekst lezen we via een `fillText`-spion.
 */

const FIXTURE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'statusdatum-1700.xml'), 'utf8');

async function openFixture(page: Page): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooserPromise = page.waitForEvent('filechooser');
  await openButton.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'statusdatum-1700.xml', mimeType: 'application/xml', buffer: Buffer.from(FIXTURE) });
}

/** Spion op canvas-`fillText`: verzamelt alle getekende tekst in `window.__opsDrawnText`. */
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
      enableHourPlanning: s.ui.enableHourPlanning,
    };
  });
}

test('statusdatum met tijd: lint toont datum én 17:00, tijd naar 12:00 + F5 verschuift het restwerk, Gantt-label in datumnotatie', async ({ page, ops: _ops }) => {
  await spyOnCanvasText(page);
  await openFixture(page);
  await expect.poll(async () => (await store(page)).statusDate).toBe('2006-09-20T17:00');
  // Na openen staan de datums uit het bestand; F5 rekent ze door met de statusdatum 17:00.
  await page.keyboard.press('F5');
  await expect.poll(async () => (await store(page)).earlyFinish?.slice(0, 10)).toBe('2006-09-22');
  const before = await store(page);
  // Standaardinstellingen van de app: dag-maand-jaar, 24 uur, Urenplanning uit. De tijd is dus
  // zichtbaar omdat de statusdatum er een draagt, niet door de schakelaar.
  expect(before.dateNotation).toBe('dmy');
  expect(before.timeNotation).toBe('24h');
  expect(before.enableHourPlanning).toBe(false);
  expect(before.earlyFinish?.slice(0, 10)).toBe('2006-09-22');

  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  const group = page.getByRole('group', { name: /^(Status date|Statusdatum)$/ }).first();
  await expect(group).toBeVisible();
  await expect.poll(() => group.locator('input').evaluateAll(inputs => inputs.map(i => (i as HTMLInputElement).value)))
    .toEqual(['20', '09', '2006']);
  const timeField = page.locator('input[data-ops-status-date-time]');
  await expect(timeField).toBeVisible();
  await expect(timeField).toHaveValue('17:00');

  // Gantt-label van de statusdatumlijn: datum in de datumnotatie plus de tijd, geen ruwe ISO.
  await expect.poll(() => drawnText(page)).toContain('20-09-2006 17:00');
  expect((await drawnText(page)).some(text => text.startsWith('2006-09-20'))).toBe(false);

  // Tijd wijzigen via het lint: één commit ⇒ één undo-stap, planning verouderd.
  const depth = (await state(page)).undoDepth;
  await timeField.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('12:00');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await store(page)).statusDate).toBe('2006-09-20T12:00');
  expect((await store(page)).scheduleStale).toBe(true);
  expect((await state(page)).undoDepth).toBe(depth + 1);
  await expect(timeField).toHaveValue('12:00');

  // F5 rekent door: het vroegste einde van de lopende taak schuift van 22-09 naar 21-09.
  await clearDrawnText(page);
  // Focus uit het tijdveld (klik op het niet-focusbare label), zodat F5 de app bereikt.
  await page.locator('.ribbon-info').filter({ hasText: /^(Status date|Statusdatum)$/ }).first().click();
  await page.keyboard.press('F5');
  await expect.poll(async () => (await store(page)).scheduleStale).toBe(false);
  expect((await store(page)).earlyFinish?.slice(0, 10)).toBe('2006-09-21');
  await expect.poll(() => drawnText(page)).toContain('20-09-2006 12:00');
});

test('statusdatum zonder tijd en zonder urenplanning: alleen het datumveld; met Urenplanning aan wel een leeg tijdveld', async ({ page, ops: _ops }) => {
  await page.evaluate(() => window.__OPS__!.store.getState().setProject({ statusDate: '2026-07-06' }));
  await page.locator('.ribbon-tab').filter({ hasText: /^Planning$/ }).click();
  await expect(page.getByRole('group', { name: /^(Status date|Statusdatum)$/ }).first()).toBeVisible();
  await expect(page.locator('input[data-ops-status-date-time]')).toHaveCount(0);

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ enableHourPlanning: true }));
  const timeField = page.locator('input[data-ops-status-date-time]');
  await expect(timeField).toHaveValue('');
  await timeField.click();
  await page.keyboard.type('7:30');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await store(page)).statusDate).toBe('2026-07-06T07:30');
  // Leegmaken haalt de tijd weg; de datum blijft.
  await timeField.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await store(page)).statusDate).toBe('2026-07-06');
});
