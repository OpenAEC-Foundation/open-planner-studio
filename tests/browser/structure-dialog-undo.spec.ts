// Dialoog "Codes & velden" (StructureDialog). Code, omschrijving en kleur van een activity-code-waarde,
// en de namen van codetypes en gebruikersvelden, schreven per toetsaanslag (of per sleepstap in de
// kleurkiezer) naar de store: "Kelder" typen gaf zes undo-stappen. Nu is één bewerking van een veld
// één undo-stap: tekst bij het verlaten van het veld (of Enter), kleur bij het kiezen.
//
// Typen, Tab, Escape en Ctrl+Z zijn echte browser-events. De native kleurkiezer ligt buiten de pagina
// (Playwright kan hem niet bedienen); daarom speelt de test de eventreeks na die de browser tijdens
// een sleep aan het veld levert: per tussenkleur de waarde + `input`, bij het kiezen één `change`.
// `window.__OPS__` zet alleen de structuur klaar, opent de dialoog en leest state.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

async function openStructure(page: Page): Promise<{ typeId: string; valueId: string; fieldId: string }> {
  const ids = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const typeId = s.addActivityCodeType('Locatie');
    const valueId = s.addActivityCodeValue(typeId, { code: 'BG', description: 'Begane grond', color: '#112233' });
    const fieldId = s.addCustomField('Contract', 'text');
    s.setUI({ showStructureDialog: true });
    return { typeId, valueId, fieldId };
  });
  await expect(dialog(page)).toBeVisible();
  return ids;
}

const dialog = (page: Page) => page.getByRole('dialog');
// Tekstvakken (rol textbox, het kleurveld telt mee) bij één type, één waarde en één veld: typenaam,
// code, omschrijving, kleur, nieuw-type-invoer, veldnaam, nieuw-veld-invoer.
const typeName = (page: Page) => dialog(page).getByRole('textbox').nth(0);
const code = (page: Page) => dialog(page).getByPlaceholder(/^Code$/);
const description = (page: Page) => dialog(page).getByPlaceholder(/^(Omschrijving|Description)$/);
const fieldName = (page: Page) => dialog(page).getByRole('textbox').nth(5);
const color = (page: Page) => dialog(page).locator('input[type="color"]');

const structure = (page: Page, ids: { typeId: string; valueId: string; fieldId: string }) => page.evaluate((i) => {
  const s = window.__OPS__!.store.getState();
  const type = s.activityCodeTypes.find(t => t.id === i.typeId)!;
  const value = type.values.find(v => v.id === i.valueId)!;
  return {
    typeName: type.name,
    code: value.code,
    description: value.description ?? null,
    color: value.color ?? null,
    fieldName: s.customFieldDefs.find(d => d.id === i.fieldId)!.name,
    undo: s.historyEvents.filter(e => e.state === 'applied').length,
  };
}, ids);

async function retype(field: Locator, page: Page, text: string): Promise<void> {
  await field.click();
  await field.press('ControlOrMeta+a');
  await page.keyboard.type(text, { delay: 15 });
}

test('codes & velden: code en omschrijving typen is één undo-stap per veld', async ({ page, ops: _ops }) => {
  const ids = await openStructure(page);
  const before = await structure(page, ids);

  await retype(code(page), page, 'Kelder');
  // Tijdens het typen verandert er nog niets in de store.
  expect(await structure(page, ids)).toEqual(before);
  await page.keyboard.press('Tab');
  let after = await structure(page, ids);
  expect(after.code).toBe('Kelder');
  expect(after.undo - before.undo).toBe(1);

  await retype(description(page), page, 'Kelderverdieping');
  await page.keyboard.press('Enter');
  after = await structure(page, ids);
  expect(after.description).toBe('Kelderverdieping');
  expect(after.undo - before.undo).toBe(2);

  // Dialoog dicht (Escape), dan Ctrl+Z: de omschrijving komt in één stap terug, daarna de code.
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => structure(page, ids).then(s => s.description)).toBe('Begane grond');
  expect((await structure(page, ids)).code).toBe('Kelder');
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => structure(page, ids).then(s => s.code)).toBe('BG');
});

test('codes & velden: slepen in de kleurkiezer is één undo-stap per gekozen kleur', async ({ page, ops: _ops }) => {
  const ids = await openStructure(page);
  const before = await structure(page, ids);

  await color(page).evaluate((el: HTMLInputElement) => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    for (const value of ['#223344', '#334455', '#445566']) {
      setValue.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await expect(color(page)).toHaveValue('#445566');
  expect(await structure(page, ids)).toEqual(before);

  await color(page).evaluate((el: HTMLInputElement) => el.dispatchEvent(new Event('change', { bubbles: true })));
  const after = await structure(page, ids);
  expect(after.color).toBe('#445566');
  expect(after.undo - before.undo).toBe(1);

  // Playwrights eigen invoer voor een kleurveld (`fill`: waarde + `input` + `change`) = één keuze.
  await color(page).fill('#aa0000');
  await expect.poll(() => structure(page, ids).then(s => s.color)).toBe('#aa0000');
  expect((await structure(page, ids)).undo - before.undo).toBe(2);
});

test('codes & velden: typenaam en veldnaam hernoemen is één undo-stap per veld', async ({ page, ops: _ops }) => {
  const ids = await openStructure(page);
  const before = await structure(page, ids);

  await retype(typeName(page), page, 'Bouwdeel');
  expect(await structure(page, ids)).toEqual(before);
  await page.keyboard.press('Tab');
  await retype(fieldName(page), page, 'Contractnummer');
  await page.keyboard.press('Tab');

  const after = await structure(page, ids);
  expect(after.typeName).toBe('Bouwdeel');
  expect(after.fieldName).toBe('Contractnummer');
  expect(after.undo - before.undo).toBe(2);
});

test('codes & velden: Escape tijdens het typen bewaart de getypte code', async ({ page, ops: _ops }) => {
  const ids = await openStructure(page);
  const before = await structure(page, ids);

  await retype(code(page), page, 'K1');
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);

  const after = await structure(page, ids);
  expect(after.code).toBe('K1');
  expect(after.undo - before.undo).toBe(1);
});

test('codes & velden: een waarde omhoog of omlaag zetten is één undo-stap en laat de taak ongemoeid', async ({ page, ops: _ops }) => {
  const ids = await openStructure(page);
  await page.evaluate((typeId) => {
    const s = window.__OPS__!.store.getState();
    s.addActivityCodeValue(typeId, { code: 'OV' });
    s.setUI({ showStructureDialog: false });
    s.setUI({ showStructureDialog: true });
  }, ids.typeId);
  const order = () => page.evaluate((typeId) =>
    window.__OPS__!.store.getState().activityCodeTypes.find(t => t.id === typeId)!.values.map(v => v.code), ids.typeId);
  const undoCount = () => structure(page, ids).then(s => s.undo);
  expect(await order()).toEqual(['BG', 'OV']);
  const before = await undoCount();

  // De bovenste kan niet omhoog, de onderste niet omlaag.
  await expect(dialog(page).getByRole('button', { name: /^(Waarde omhoog|Move value up)$/ }).first()).toBeDisabled();
  await expect(dialog(page).getByRole('button', { name: /^(Waarde omlaag|Move value down)$/ }).last()).toBeDisabled();

  await dialog(page).getByRole('button', { name: /^(Waarde omhoog|Move value up)$/ }).last().click();
  await expect.poll(order).toEqual(['OV', 'BG']);
  expect((await undoCount()) - before).toBe(1);

  await dialog(page).getByRole('button', { name: /^(Waarde omlaag|Move value down)$/ }).first().click();
  await expect.poll(order).toEqual(['BG', 'OV']);

  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(order).toEqual(['OV', 'BG']);
});
