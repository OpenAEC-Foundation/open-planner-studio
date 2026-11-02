import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { expect, test, type Page } from '@playwright/test';
import { seedProject, state, test as appTest } from './fixtures/ops';

let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./fixtures/inputPrimitives.tsx', import.meta.url))],
    bundle: true, write: false, format: 'iife', platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  bundle = result.outputFiles[0].text;
});

async function mount(page: Page, fixture = 'menu') {
  await page.setContent(`<html lang="nl"><head><style>* { box-sizing: border-box; } body { margin: 8px; }</style></head>
    <body data-fixture="${fixture}"><div id="root"></div></body></html>`);
  await page.addScriptTag({ content: bundle });
}

test('gedeeld menu: Escape sluit en focust de bediende helft van de knop', async ({ page }) => {
  await mount(page);
  const trigger = page.getByRole('button', { name: 'Menu openen' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: 'Keuzes' });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem').first().click();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await page.getByRole('button', { name: 'Buiten het menu' }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Buiten het menu' })).toBeFocused();
});

test('gedeeld menu: alleen scrollen van de triggeromgeving sluit het paneel', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await mount(page);
  await page.getByRole('button', { name: 'Menu openen' }).click();
  const menu = page.getByRole('menu', { name: 'Keuzes' });
  const list = page.locator('[data-menu-list]');
  await list.hover();
  await page.mouse.wheel(0, 100);
  await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect(menu).toBeVisible();
  const other = page.locator('[data-other-scroll]');
  await other.hover();
  await page.mouse.wheel(0, 100);
  await expect.poll(() => other.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect(menu).toBeVisible();
  const ribbon = page.locator('[data-ribbon-scroll]');
  await ribbon.hover();
  await page.mouse.wheel(100, 0);
  await expect.poll(() => ribbon.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await expect(menu).toHaveCount(0);
});

test('gedeeld menu: ook in een laag venster blijven lijst en voetregel bereikbaar', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 240 });
  await mount(page);
  await page.getByRole('button', { name: 'Menu openen' }).click();
  const menu = page.getByRole('menu', { name: 'Keuzes' });
  await expect(menu).toBeVisible();
  const footer = page.locator('[data-menu-footer]');
  await expect.poll(async () => {
    const rect = (await footer.boundingBox())!;
    return rect.y + rect.height;
  }).toBeLessThanOrEqual(232);
  await menu.getByRole('menuitem', { name: 'Keuze 30', exact: true }).click();
  await expect(menu.getByRole('menuitem', { name: 'Keuze 30', exact: true })).toBeFocused();
});

test('celeditor: kandidaatkeuze met Enter of Escape bewerkt geen cel tijdens compositie', async ({ page }) => {
  await mount(page, 'editor');
  const input = page.getByRole('textbox', { name: 'Taaknaam' });
  await input.focus();
  const session = await page.context().newCDPSession(page);
  for (const key of ['Enter', 'Escape']) {
    await session.send('Input.imeSetComposition', { text: '日本', selectionStart: 2, selectionEnd: 2 });
    await page.keyboard.press(key);
    await expect(page.locator('[data-last-key]')).toHaveText(JSON.stringify({ key, composing: true, code: key === 'Enter' ? 13 : 27, trusted: true }));
    await expect(page.locator('[data-commits]')).toHaveText('0');
    await expect(page.locator('[data-cancels]')).toHaveText('0');
    await expect(page.locator('[data-focus-requests]')).toHaveText('0');
  }
  await session.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
  // Oudere invoermethoden markeren de toets alleen met 229, zonder isComposing.
  for (const key of ['Enter', 'Escape']) {
    await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: 229 });
    await expect(page.locator('[data-last-key]')).toHaveText(JSON.stringify({ key, composing: false, code: 229, trusted: true }));
    await expect(page.locator('[data-commits]')).toHaveText('0');
    await expect(page.locator('[data-cancels]')).toHaveText('0');
    await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: 229 });
  }
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-commits]')).toHaveText('1');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-cancels]')).toHaveText('1');
  await expect(page.locator('[data-focus-requests]')).toHaveText('2');
  await session.detach();
});

// Een aparte appopstelling bewaakt de document-/focuseffecten; de componentproef hierboven bewaakt
// ook de precieze native toetsvlaggen. De bestaande TableEditor-meetroute blijft ongewijzigd.
appTest('tabelinvoer: compositie behoudt de editor en maakt geen documentbewerking', async ({ page, ops: _ops }) => {
  const [id] = await seedProject(page, [
    { name: 'Oorspronkelijke naam', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const before = await state(page);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const cell = page.locator(`[data-task-grid-surface-id="full-task-grid"] [data-grid-row-key="${id}"] [data-grid-column-id="task.name"]`);
  await cell.click();
  await page.keyboard.press('Enter');
  const input = cell.locator('input');
  await expect(input).toBeFocused();
  const ime = await page.context().newCDPSession(page);
  for (const key of ['Enter', 'Escape']) {
    await ime.send('Input.imeSetComposition', { text: '日本', selectionStart: 2, selectionEnd: 2 });
    await page.keyboard.press(key);
    await expect(input).toBeFocused();
    expect((await state(page)).undoDepth).toBe(before.undoDepth);
    expect((await state(page)).tasks.find(task => task.id === id)?.name).toBe('Oorspronkelijke naam');
  }
  await ime.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
  for (const key of ['Enter', 'Escape']) {
    await ime.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: 229 });
    await expect(input).toBeFocused();
    expect((await state(page)).undoDepth).toBe(before.undoDepth);
    await ime.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: 229 });
  }
  await ime.detach();
  await input.fill('Naam na compositie');
  await page.keyboard.press('Enter');
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.find(task => task.id === id)?.name)).toBe('Naam na compositie');
  expect((await state(page)).undoDepth).toBe(before.undoDepth + 1);
});
