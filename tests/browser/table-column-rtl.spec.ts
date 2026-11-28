import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';
import { box, centerX, centerY, chooseLocale, LOCALE_CASES, type LocaleCase } from './fixtures/locale';

type Surface = 'full-task-grid' | 'gantt-task-grid';

const SURFACES: readonly Surface[] = ['full-task-grid', 'gantt-task-grid'];

const CHOOSER_STRIP = 32;

function shell(page: Page, surface: Surface): Locator {
  return page.locator(`[data-task-grid-surface-id="${surface}"] .task-grid-shell`);
}

function header(page: Page, surface: Surface, columnId: string): Locator {
  return shell(page, surface).locator(`[role="columnheader"][data-grid-column-id="${columnId}"]`);
}

async function headerIds(page: Page, surface: Surface): Promise<string[]> {
  return shell(page, surface).locator('[role="columnheader"][data-grid-column-id]').evaluateAll(
    headers => headers.map(item => item.getAttribute('data-grid-column-id')!),
  );
}

async function widthOf(page: Page, surface: Surface, columnId: string): Promise<number | undefined> {
  return page.evaluate(({ id, column }) => window.__OPS__!.store.getState().taskGridSurfaces[id].columns
    .find(candidate => candidate.id === column)?.width, { id: surface, column: columnId });
}

async function dropLineX(target: Locator, pseudo: '::before' | '::after'): Promise<number> {
  return target.evaluate((element, which) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element, which);
    const width = parseFloat(style.width);
    return style.left !== 'auto'
      ? rect.left + parseFloat(style.left) + width / 2
      : rect.right - parseFloat(style.right) - width / 2;
  }, pseudo);
}

async function open(page: Page, surface: Surface, locale: LocaleCase): Promise<void> {
  await seedProject(page, [
    { name: 'Ruwbouw', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Afbouw', start: '2026-09-21', finish: '2026-10-02', durationDays: 10 },
  ]);
  if (surface === 'full-task-grid') {
    await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  }
  await chooseLocale(page, locale);
  await expect(shell(page, surface).locator('[role="grid"]')).toBeVisible();
}

for (const locale of LOCALE_CASES) {
  test(`${locale.code} full-task-grid: greep tussen twee vastgezette kolommen over de volle 4 px`, async ({ page, ops: _ops }) => {
    const surface: Surface = 'full-task-grid';
    await seedProject(page, [
      { name: 'Ruwbouw', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    ]);
    await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
    for (const id of ['task.wbsCode', 'task.name']) {
      await header(page, surface, id).click({ button: 'right' });
      await page.getByRole('menu').getByRole('menuitem', { name: /^(Pin|Vastzetten)$/ }).click();
      await expect(header(page, surface, id)).toHaveAttribute('data-grid-pinned', 'true');
    }
    await chooseLocale(page, locale);
    expect((await headerIds(page, surface)).slice(0, 2)).toEqual(['task.wbsCode', 'task.name']);

    for (const id of ['task.wbsCode', 'task.name']) {
      const handle = header(page, surface, id).locator('.task-grid-resize-handle');
      const grip = await box(handle);
      const y = centerY(grip);
      for (let px = Math.round(grip.left); px < Math.round(grip.right); px++) {
        await page.mouse.move(px, y);
        await expect(handle, `${id} greeppixel x=${px}`).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      }
      const widthBefore = (await widthOf(page, surface, id))!;
      const x = Math.round(grip.right) - 1;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 30, y, { steps: 5 });
      await page.mouse.up();
      await expect.poll(() => widthOf(page, surface, id)).toBe(widthBefore + 30);
    }
  });

  for (const surface of SURFACES) {
    test(`${locale.code} ${surface}: plusje rechts in zijn strook, niet over een kolomkop`, async ({ page, ops: _ops }) => {
      await open(page, surface, locale);

      await header(page, surface, 'task.wbsCode').click({ button: 'right', timeout: 5_000 });
      await expect(page.getByRole('menu')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);

      const core = await box(shell(page, surface).locator('.task-grid-core'));
      const plus = shell(page, surface).locator('.task-grid-add-column');
      const plusBox = await box(plus);

      expect(plusBox.left).toBeGreaterThanOrEqual(core.right - CHOOSER_STRIP);
      expect(plusBox.right).toBeLessThanOrEqual(core.right);

      for (const id of await headerIds(page, surface)) {
        const rect = await box(header(page, surface, id));
        if (rect.right > core.right - CHOOSER_STRIP) continue;
        expect(plusBox.left >= rect.right || plusBox.right <= rect.left, `plusje over kop ${id}`).toBe(true);
      }

      await plus.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(plus).toHaveAttribute('aria-expanded', 'true');
      await plus.click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test(`${locale.code} ${surface}: breedterand op de rechtergrens volgt de muis`, async ({ page, ops: _ops }) => {
      await open(page, surface, locale);
      const wbs = header(page, surface, 'task.wbsCode');
      const handle = wbs.locator('.task-grid-resize-handle');
      const before = await box(wbs);
      const handleBefore = await box(handle);
      const widthBefore = (await widthOf(page, surface, 'task.wbsCode'))!;
      const depth = (await state(page)).undoDepth;

      expect(Math.abs(centerX(handleBefore) - before.right)).toBeLessThanOrEqual(2);

      const y = centerY(handleBefore);
      for (let px = Math.round(handleBefore.left); px < Math.round(handleBefore.right); px++) {
        await page.mouse.move(px, y);
        await expect(handle, `greeppixel x=${px}`).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      }

      const x = before.right;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 20, y, { steps: 4 });
      await page.mouse.move(x + 40, y, { steps: 4 });
      await page.mouse.up();
      await expect.poll(() => widthOf(page, surface, 'task.wbsCode')).toBe(widthBefore + 40);
      const wider = await box(wbs);
      expect(Math.abs(wider.left - before.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(wider.right - (before.right + 40))).toBeLessThanOrEqual(1);
      expect(Math.abs(centerX(await box(handle)) - (x + 40))).toBeLessThanOrEqual(2);
      expect((await state(page)).undoDepth).toBe(depth + 1);

      const handleWide = await box(handle);
      const xWide = Math.round(handleWide.right) - 1;
      await page.mouse.move(xWide, y);
      await page.mouse.down();
      await page.mouse.move(xWide - 30, y, { steps: 6 });
      await page.mouse.up();
      await expect.poll(() => widthOf(page, surface, 'task.wbsCode')).toBe(widthBefore + 10);
      expect(Math.abs(centerX(await box(handle)) - (xWide - 30))).toBeLessThanOrEqual(2);
      expect((await state(page)).undoDepth).toBe(depth + 2);

      const rightBefore = (await box(wbs)).right;
      await handle.focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => widthOf(page, surface, 'task.wbsCode')).toBe(widthBefore + 18);
      expect(Math.abs((await box(wbs)).right - (rightBefore + 8))).toBeLessThanOrEqual(1);
    });

    test(`${locale.code} ${surface}: minteken rechts in de kop, invoegstreep aan de kant waar de kolom landt`, async ({ page, ops: _ops }) => {
      await open(page, surface, locale);

      const wbs = header(page, surface, 'task.wbsCode');
      const name = header(page, surface, 'task.name');
      const wbsBox = await box(wbs);
      const nameBox = await box(name);
      await page.mouse.move(centerX(nameBox), centerY(nameBox));
      await page.mouse.down();
      await page.mouse.move(wbsBox.left + 20, centerY(wbsBox), { steps: 8 });
      await page.mouse.move(wbsBox.left + 6, centerY(wbsBox), { steps: 4 });
      await expect(wbs).toHaveAttribute('data-grid-drop-before', 'true');
      expect(Math.abs(await dropLineX(wbs, '::before') - wbsBox.left)).toBeLessThanOrEqual(2);
      await page.mouse.up();
      await expect.poll(async () => (await headerIds(page, surface)).slice(0, 2))
        .toEqual(['task.name', 'task.wbsCode']);
      expect((await box(name)).right).toBeLessThanOrEqual((await box(wbs)).left + 1);

      const minus = wbs.locator('.task-grid-remove-column');
      await page.mouse.move(0, 0);
      await expect(minus).toHaveCSS('opacity', '0');
      await wbs.hover();
      await expect(minus).toHaveCSS('opacity', '1');
      const wbsNow = await box(wbs);
      const minusBox = await box(minus);
      expect(minusBox.left).toBeGreaterThan(centerX(wbsNow));
      expect(Math.abs(minusBox.right - (wbsNow.right - 7))).toBeLessThanOrEqual(1);
      await minus.click();
      await expect.poll(() => headerIds(page, surface).then(ids => ids.includes('task.wbsCode'))).toBe(false);
    });
  }
}
