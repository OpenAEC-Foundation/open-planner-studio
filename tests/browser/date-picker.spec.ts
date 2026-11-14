import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';
import { chooseLocale, LOCALE_CASES } from './fixtures/locale';

// De eigen datumkiezer bij het gedeelde datumveld (#904, besluit 2026-11-14: zelf gemaakt, geen native
// kiezer). Het raster, de toetsen en de teksten zelf liggen headless vast in
// tests/planning/check-date-picker-month.ts; hier alleen wat een echte browser laat zien: klikken, focus,
// toetsen die niet naar de dialoog of de app lekken, en de koppeling tussen kiezer, veld en store.

const picker = (page: Page) => page.locator('[data-ops-date-picker]');
const day = (page: Page, iso: string) => picker(page).locator(`button[data-iso="${iso}"]`);
const title = (page: Page) => picker(page).locator('[data-ops-date-picker-title]');
const focusedIso = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('data-iso') ?? null);
const segments = (field: Locator) => field.getByRole('textbox');
/** Staat de focus in een vakje van dit veld? */
const focusInField = (field: Locator) => field.evaluate(el => el.contains(document.activeElement)
  && document.activeElement?.tagName === 'INPUT');

/** De datum van de deadline (de store zet hem op het einde van de werkdag, bv. `T16:00`). */
const deadlineOf = (page: Page, id: string) => page.evaluate(
  taskId => window.__OPS__!.store.getState().tasks.find(t => t.id === taskId)!.deadline?.slice(0, 10) ?? null, id,
);

test('datumkiezer in het eigenschappenpaneel: klikken, toetsen, typen, notatie en taal', async ({ page, ops: _ops }) => {
  await chooseLocale(page, LOCALE_CASES.find(l => l.code === 'nl')!);
  const [taskId] = await seedProject(page, [{ name: 'Metselwerk', start: '2026-11-09', finish: '2026-11-13' }]);
  // Fixture: een bestaande deadline, zodat de kiezer op een vaste maand opent (niet op vandaag).
  await page.evaluate(id => window.__OPS__!.store.getState().updateTask(id, { deadline: '2026-11-18' }), taskId);
  await page.locator(`[data-grid-row-key="${taskId}"] [data-grid-column-id="task.name"]`).first().click();

  const wrapper = page.locator('[data-ops-task-date-time="deadline"]');
  const field = wrapper.getByRole('group', { name: 'Deadline' });
  const button = wrapper.locator('[data-ops-date-picker-button]');
  await expect(segments(field)).toHaveCount(3);
  // Typen blijft zoals het was: de knop is geen extra tabstop en geen tekstvak.
  await expect(button).toHaveAttribute('tabindex', '-1');

  // ── Klikken: de kiezer opent op de deadline, in het Nederlands, met maandag als eerste dag.
  const depth = (await state(page)).undoDepth;
  await button.click();
  await expect(picker(page)).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(title(page)).toHaveText('november 2026');
  await expect(picker(page).locator('[data-ops-date-picker-weekday]').first()).toHaveText('Ma');
  await expect.poll(() => focusedIso(page)).toBe('2026-11-18');
  await expect(day(page, '2026-11-18')).toHaveAttribute('aria-label', 'woensdag 18 november 2026');
  await expect(day(page, '2026-11-18').locator('xpath=..')).toHaveAttribute('aria-selected', 'true');
  // Bladeren met de pijlknop houdt het paneel open en de focus op die knop.
  await picker(page).locator('[data-ops-date-picker-nav="next"]').click();
  await expect(title(page)).toHaveText('december 2026');
  await picker(page).locator('[data-ops-date-picker-nav="previous"]').click();
  await expect(title(page)).toHaveText('november 2026');
  await day(page, '2026-11-25').click();
  await expect(picker(page)).toHaveCount(0);
  await expect.poll(() => deadlineOf(page, taskId)).toBe('2026-11-25');
  await expect(segments(field).nth(0)).toHaveValue('25');
  // Een keuze is één handeling: één undo-stap, en de focus staat terug in het veld. (Volgende wijzigingen
  // van hetzelfde veld voegt het paneel bewust samen tot die ene stap, zie `TaskPropertiesPanel`.)
  expect((await state(page)).undoDepth).toBe(depth + 1);
  await expect.poll(() => focusInField(field)).toBe(true);

  // ── Toetsenbord: Alt+Pijl-omlaag opent vanuit het veld, de pijlen, PageUp/PageDown en Home verplaatsen,
  // Enter kiest. Geen toets lekt naar de app (de taak blijft geselecteerd, er komt geen extra undo-stap).
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
  // Tab blijft in het paneel.
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

  // ── Escape sluit zonder keuze en zet de focus terug in het veld; de taak blijft geselecteerd.
  await page.keyboard.press('Alt+ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(picker(page)).toHaveCount(0);
  await expect.poll(() => focusInField(field)).toBe(true);
  expect(await deadlineOf(page, taskId)).toBe('2027-11-01');
  expect((await state(page)).selectedTaskIds).toEqual([taskId]);

  // ── Een getypte, nog niet afgeronde datum: de kiezer opent op die datum.
  await segments(field).nth(0).fill('15');
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => focusedIso(page)).toBe('2027-11-15');
  // Een klik ernaast sluit de kiezer en rondt het veld af zoals elke andere klik ernaast.
  // (de statusbalk onderaan: tekst zonder eigen bediening)
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width / 2, viewport.height - 6);
  await expect(picker(page)).toHaveCount(0);
  await expect.poll(() => deadlineOf(page, taskId)).toBe('2027-11-15');

  // ── Notatie en eerste weekdag uit de instellingen, taal Engels.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ dateNotation: 'mdy', weekStartDay: 'sunday' }));
  await chooseLocale(page, LOCALE_CASES.find(l => l.code === 'en')!);
  await page.locator(`[data-grid-row-key="${taskId}"] [data-grid-column-id="task.name"]`).first().click();
  await button.click();
  await expect(title(page)).toHaveText('November 2027');
  await expect(picker(page).locator('[data-ops-date-picker-weekday]').first()).toHaveText('Sun');
  await expect(day(page, '2027-11-15')).toHaveAttribute('aria-label', 'Monday, November 15, 2027');
  await day(page, '2027-11-10').click();
  await expect.poll(() => deadlineOf(page, taskId)).toBe('2027-11-10');
  // In m-d-j-volgorde: maand, dag, jaar.
  await expect(segments(field).nth(0)).toHaveValue('11');
  await expect(segments(field).nth(1)).toHaveValue('10');
  await expect(segments(field).nth(2)).toHaveValue('2027');

  // ── Rechts naar links: het raster staat gespiegeld, dus pijl links is de volgende dag.
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

  // Escape sluit alleen de kiezer, niet de dialoog.
  await button.click();
  await expect.poll(() => focusedIso(page)).toBe('2026-09-07');
  await page.keyboard.press('Escape');
  await expect(picker(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect.poll(() => focusInField(field)).toBe(true);

  // Enter op een dag kiest die dag en bevestigt de dialoog niet.
  await page.keyboard.press('Alt+ArrowDown');
  await page.keyboard.press('PageDown');
  await page.keyboard.press('Enter');
  await expect(picker(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(segments(field).nth(0)).toHaveValue('07');
  await expect(segments(field).nth(1)).toHaveValue('10');

  // Een klik op een dag sluit de dialoog niet (de kiezer hangt buiten het dialoogpaneel).
  await button.click();
  await day(page, '2026-10-05').click();
  await expect(dialog).toBeVisible();
  await expect(segments(field).nth(0)).toHaveValue('05');

  // De gekozen datum is de invoer van de dialoog: voorbeeld berekenen en toepassen verplaatst het project.
  await dialog.getByRole('button', { name: /^(Calculate preview|Voorbeeld berekenen)$/ }).click();
  await dialog.getByRole('button', { name: /^(Move|Verplaatsen)$/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(projectStart).toBe('2026-10-05');
});
