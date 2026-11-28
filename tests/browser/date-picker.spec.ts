import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';
import { chooseLocale, LOCALE_CASES } from './fixtures/locale';

const picker = (page: Page) => page.locator('[data-ops-date-picker]');
const day = (page: Page, iso: string) => picker(page).locator(`button[data-iso="${iso}"]`);
const title = (page: Page) => picker(page).locator('[data-ops-date-picker-title]');
const focusedIso = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('data-iso') ?? null);
const segments = (field: Locator) => field.getByRole('textbox');
const focusInField = (field: Locator) => field.evaluate(el => el.contains(document.activeElement)
  && document.activeElement?.tagName === 'INPUT');

const deadlineOf = (page: Page, id: string) => page.evaluate(
  taskId => window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!.deadline?.slice(0, 10) ?? null, id,
);

test('datumkiezer in het eigenschappenpaneel: klikken, toetsen, typen, notatie en taal', async ({ page, ops: _ops }) => {
  await chooseLocale(page, LOCALE_CASES.find(l => l.code === 'nl')!);
  const [taskId] = await seedProject(page, [{ name: 'Metselwerk', start: '2026-11-09', finish: '2026-11-13' }]);
  await page.evaluate(id => window.__OPS__!.store.getState().updateTask(id, { deadline: '2026-11-18' }), taskId);
  await page.locator(`[data-grid-row-key="${taskId}"] [data-grid-column-id="task.name"]`).first().click();

  const wrapper = page.locator('[data-ops-task-date-time="deadline"]');
  const field = wrapper.getByRole('group', { name: 'Deadline' });
  const button = wrapper.locator('[data-ops-date-picker-button]');
  await expect(segments(field)).toHaveCount(3);
  await expect(button).toHaveAttribute('tabindex', '-1');

  const depth = (await state(page)).undoDepth;
  await button.click();
  await expect(picker(page)).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(title(page)).toHaveText('november 2026');
  await expect(picker(page).locator('[data-ops-date-picker-weekday]').first()).toHaveText('Ma');
  await expect.poll(() => focusedIso(page)).toBe('2026-11-18');
  await expect(day(page, '2026-11-18')).toHaveAttribute('aria-label', 'woensdag 18 november 2026');
  await expect(day(page, '2026-11-18').locator('xpath=..')).toHaveAttribute('aria-selected', 'true');
  await picker(page).locator('[data-ops-date-picker-nav="next"]').click();
  await expect(title(page)).toHaveText('december 2026');
  await picker(page).locator('[data-ops-date-picker-nav="previous"]').click();
  await expect(title(page)).toHaveText('november 2026');
  await day(page, '2026-11-25').click();
  await expect(picker(page)).toHaveCount(0);
  await expect.poll(() => deadlineOf(page, taskId)).toBe('2026-11-25');
  await expect(segments(field).nth(0)).toHaveValue('25');
  expect((await state(page)).undoDepth).toBe(depth + 1);
  await expect.poll(() => focusInField(field)).toBe(true);

  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => focusedIso(page)).toBe('2026-11-25');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => focusedIso(page)).toBe('2026-11-26');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => focusedIso(page)).toBe('2026-12-03');
  await expect(title(page)).toHaveText('december 2026');
  await page.keyboard.press('PageUp');
  await expect.poll(() => focusedIso(page)).toBe('2026-11-03');
  await page.keyboard.press('Shift+PageDown');
  await expect.poll(() => focusedIso(page)).toBe('2027-11-03');
  await page.keyboard.press('Home');
  await expect.poll(() => focusedIso(page)).toBe('2027-11-01');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await picker(page).evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await day(page, '2027-11-01').focus();
  await page.keyboard.press('Enter');
  await expect(picker(page)).toHaveCount(0);
  await expect.poll(() => deadlineOf(page, taskId)).toBe('2027-11-01');
  await expect.poll(() => focusInField(field)).toBe(true);
  expect((await state(page)).selectedTaskIds).toEqual([taskId]);

  await page.keyboard.press('Alt+ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(picker(page)).toHaveCount(0);
  await expect.poll(() => focusInField(field)).toBe(true);
  expect(await deadlineOf(page, taskId)).toBe('2027-11-01');
  expect((await state(page)).selectedTaskIds).toEqual([taskId]);

  await segments(field).nth(0).fill('15');
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => focusedIso(page)).toBe('2027-11-15');
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width / 2, viewport.height - 6);
  await expect(picker(page)).toHaveCount(0);
  await expect.poll(() => deadlineOf(page, taskId)).toBe('2027-11-15');

  await segments(field).nth(0).fill('20');
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => focusedIso(page)).toBe('2027-11-20');
  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const ifc = readFileSync(await (await download).path(), 'utf8');
  expect(await deadlineOf(page, taskId)).toBe('2027-11-20');
  expect(ifc).toContain('2027-11-20');
  await expect(picker(page)).toHaveCount(0);
  await expect.poll(() => focusInField(field)).toBe(true);
  await segments(field).nth(0).fill('22');
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => focusedIso(page)).toBe('2027-11-22');
  await page.keyboard.press('F5');
  await expect(picker(page)).toHaveCount(0);
  await expect.poll(() => deadlineOf(page, taskId)).toBe('2027-11-22');
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ dateNotation: 'mdy', weekStartDay: 'sunday' }));
  await chooseLocale(page, LOCALE_CASES.find(l => l.code === 'en')!);
  await page.locator(`[data-grid-row-key="${taskId}"] [data-grid-column-id="task.name"]`).first().click();
  await button.click();
  await expect(title(page)).toHaveText('November 2027');
  await expect(picker(page).locator('[data-ops-date-picker-weekday]').first()).toHaveText('Sun');
  await expect(day(page, '2027-11-15')).toHaveAttribute('aria-label', 'Monday, November 15, 2027');
  await day(page, '2027-11-10').click();
  await expect.poll(() => deadlineOf(page, taskId)).toBe('2027-11-10');
  await expect(segments(field).nth(0)).toHaveValue('11');
  await expect(segments(field).nth(1)).toHaveValue('10');
  await expect(segments(field).nth(2)).toHaveValue('2027');

  await chooseLocale(page, LOCALE_CASES.find(l => l.code === 'ar')!);
  await page.locator(`[data-grid-row-key="${taskId}"] [data-grid-column-id="task.name"]`).first().click();
  await button.click();
  await expect(picker(page)).toHaveAttribute('dir', 'rtl');
  await expect(title(page)).toContainText('2027');
  await expect.poll(() => focusedIso(page)).toBe('2027-11-10');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => focusedIso(page)).toBe('2027-11-11');
  await page.keyboard.press('Escape');
  await expect(picker(page)).toHaveCount(0);
});

test('datumkiezer in een dialoog: Escape, Enter en klikken blijven bij de kiezer', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Fundering', start: '2026-09-07', finish: '2026-09-11' }]);
  const projectStart = () => page.evaluate(() => window.__OPS__!.store.getState().project.startDate.slice(0, 10));
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showMoveProjectDialog: true }));
  const dialog = page.locator('[data-ops-move-project-dialog]');
  await expect(dialog).toBeVisible();
  const field = dialog.getByRole('group', { name: /^(New project start|Nieuwe projectstart)$/ });
  const button = dialog.locator('[data-ops-date-picker-button]');

  await button.click();
  await expect.poll(() => focusedIso(page)).toBe('2026-09-07');
  await page.keyboard.press('Escape');
  await expect(picker(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect.poll(() => focusInField(field)).toBe(true);

  await page.keyboard.press('Alt+ArrowDown');
  await page.keyboard.press('PageDown');
  await page.keyboard.press('Enter');
  await expect(picker(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(segments(field).nth(0)).toHaveValue('07');
  await expect(segments(field).nth(1)).toHaveValue('10');

  await button.click();
  await day(page, '2026-10-05').click();
  await expect(dialog).toBeVisible();
  await expect(segments(field).nth(0)).toHaveValue('05');

  const calc = dialog.getByRole('button', { name: /^(Calculate preview|Voorbeeld berekenen)$/ });
  const apply = dialog.getByRole('button', { name: /^(Move|Verplaatsen)$/ });
  await calc.click();
  await expect(apply).toBeEnabled();
  await segments(field).nth(0).fill('31');
  await segments(field).nth(1).fill('02');
  await page.keyboard.press('Tab');
  await expect(segments(field).nth(0)).toHaveAttribute('aria-invalid', 'true');
  await expect(apply).toBeDisabled();
  await expect(calc).toBeDisabled();
  await button.click();
  await day(page, '2026-10-05').click();
  await expect(segments(field).nth(0)).toHaveValue('05');

  await dialog.getByRole('button', { name: /^(Calculate preview|Voorbeeld berekenen)$/ }).click();
  await dialog.getByRole('button', { name: /^(Move|Verplaatsen)$/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(projectStart).toBe('2026-10-05');
});

test('datumkiezer in een tabelcel: kiezen legt de cel vast, Escape laat de editor open', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{ name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 }]);
  const startOf = () => page.evaluate(
    id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.time.scheduleStart.slice(0, 10), taskId,
  );
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const cell = page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"] `
    + '[data-grid-data-cell="true"][data-grid-column-id="task.time.start"]',
  );
  await cell.click();
  await page.keyboard.press('Enter');
  const input = cell.locator('input[data-task-editor-kind]');
  await expect(input).toBeFocused();
  const button = cell.locator('button[data-task-editor-picker]');
  await expect(cell.locator('input[type="date"], input[type="datetime-local"]')).toHaveCount(0);

  const depth = (await state(page)).undoDepth;
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => focusedIso(page)).toBe('2026-09-07');
  await page.keyboard.press('Escape');
  await expect(picker(page)).toHaveCount(0);
  await expect(input).toBeFocused();

  await button.click();
  await expect(title(page)).toHaveText('September 2026');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => focusedIso(page)).toBe('2026-09-14');
  await page.keyboard.press('Enter');
  await expect(picker(page)).toHaveCount(0);
  await expect(input).toHaveCount(0);
  await expect.poll(startOf).toBe('2026-09-14');
  expect((await state(page)).undoDepth).toBe(depth + 1);
});
