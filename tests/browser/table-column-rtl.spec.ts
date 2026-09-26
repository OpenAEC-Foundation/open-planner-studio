// Kolomkop-bediening in een rechts-naar-linkstaal (ar/fa). Het raster van beide taaktabellen is in
// elke taal ltr (`DataGridCore` pint `direction: ltr`): de WBS staat links, de kolommen lopen naar
// rechts, pijl-rechts gaat een kolom naar rechts en de strook voor het plusje zit rechts. Alleen de
// tekst van kop en cel volgt de taal. Eerst volgde de bediening in de kop de TEKSTrichting: in ar/fa
// stond het plusje links, over de WBS-kop heen (die daar niet meer midden aan te klikken was); de
// breedterand zat op de linkergrens van zijn kolom terwijl slepen naar rechts de rechtergrens
// verschoof; het minteken stond links en de invoegstreep bij het herordenen aan de andere kant dan
// waar de kolom landt. De bediening volgt nu het raster, in elke taal.
//
// Dezelfde stappen draaien in ar, fa, nl en en: de ltr-talen bewijzen dat daar niets veranderde.
// Handelingen via echte muis- en toetsevents; de `__OPS__`-brug zet alleen de planning en het
// instellingenvenster (de taalkeuze zelf is een klik), en leest state.
import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';
import { box, centerX, centerY, chooseLocale, LOCALE_CASES, type LocaleCase } from './fixtures/locale';

type Surface = 'full-task-grid' | 'gantt-task-grid';

const SURFACES: readonly Surface[] = ['full-task-grid', 'gantt-task-grid'];

/** Breedte van de afsluitende strook waarin het plusje staat (`--task-grid-chooser-strip`). */
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

/** Horizontale plek van de invoegstreep (`::before` = ervoor, `::after` = erna) van een kolomkop. */
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
  // Vastgezette koppen krijgen een eigen laag boven de rest (ze blijven staan als je horizontaal
  // scrolt). Ook tussen twee vastgezette koppen is de greep over zijn volle 4 px pakbaar.
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
      // En een echte sleep vanaf de buitenste pixel verbreedt de kolom.
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

      // De WBS-kop is als geheel bereikbaar: een echte rechtsklik midden op de kop opent zijn
      // kopmenu. In ar/fa ving de strook van het plusje die klik eerst af.
      await header(page, surface, 'task.wbsCode').click({ button: 'right', timeout: 5_000 });
      await expect(page.getByRole('menu')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);

      const core = await box(shell(page, surface).locator('.task-grid-core'));
      const plus = shell(page, surface).locator('.task-grid-add-column');
      const plusBox = await box(plus);

      // Het plusje staat in de afsluitende strook aan de rechterkant van het raster, waar ook de
      // kolommen eindigen — in elke taal.
      expect(plusBox.left).toBeGreaterThanOrEqual(core.right - CHOOSER_STRIP);
      expect(plusBox.right).toBeLessThanOrEqual(core.right);

      // Het ligt over geen enkele kolomkop die volledig buiten die strook in beeld is (in ar/fa lag
      // het eerst over de WBS-kop).
      for (const id of await headerIds(page, surface)) {
        const rect = await box(header(page, surface, id));
        if (rect.right > core.right - CHOOSER_STRIP) continue;
        expect(plusBox.left >= rect.right || plusBox.right <= rect.left, `plusje over kop ${id}`).toBe(true);
      }

      // Een echte klik op het plusje opent de kolomkiezer; nog een klik sluit hem.
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

      // De rand zit op de grens die bij verbreden verschuift: rechts, zoals in ltr.
      expect(Math.abs(centerX(handleBefore) - before.right)).toBeLessThanOrEqual(2);

      // De greep is over zijn volle 4 px pakbaar, ook het deel voorbij de kolomgrens dat over de
      // volgende kop hangt: op elke pixelkolom toont een echte muisbeweging de hoverkleur van de
      // greep. Eerst lag dat deel onder de volgende kop (eigen laag per kop, later in de DOM): 3 px
      // pakbaar in ltr, 2 in rtl. Hele coördinaten: Chromium rondt het muispunt af, x + 0,5 valt
      // al in de volgende pixel.
      const y = centerY(handleBefore);
      for (let px = Math.round(handleBefore.left); px < Math.round(handleBefore.right); px++) {
        await page.mouse.move(px, y);
        await expect(handle, `greeppixel x=${px}`).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      }

      // Verbreden: pak de rand precies op de kolomgrens en sleep hem 40 px naar rechts. De
      // linkergrens blijft staan, de rechtergrens schuift 40 px mee en ligt daarna weer onder de muis.
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

      // Versmallen: pak de buitenste greeppixel (over de volgende kop) en sleep 30 px terug naar
      // links; de rand volgt weer.
      const handleWide = await box(handle);
      const xWide = Math.round(handleWide.right) - 1;
      await page.mouse.move(xWide, y);
      await page.mouse.down();
      await page.mouse.move(xWide - 30, y, { steps: 6 });
      await page.mouse.up();
      await expect.poll(() => widthOf(page, surface, 'task.wbsCode')).toBe(widthBefore + 10);
      expect(Math.abs(centerX(await box(handle)) - (xWide - 30))).toBeLessThanOrEqual(2);
      expect((await state(page)).undoDepth).toBe(depth + 2);

      // Toetsenbord op de rand: pijl-rechts verbreedt, de rechtergrens schuift naar rechts.
      const rightBefore = (await box(wbs)).right;
      await handle.focus();
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => widthOf(page, surface, 'task.wbsCode')).toBe(widthBefore + 18);
      expect(Math.abs((await box(wbs)).right - (rightBefore + 8))).toBeLessThanOrEqual(1);
    });

    test(`${locale.code} ${surface}: minteken rechts in de kop, invoegstreep aan de kant waar de kolom landt`, async ({ page, ops: _ops }) => {
      await open(page, surface, locale);

      // Herordenen: sleep de kop Taaknaam naar de linkerhelft van de WBS-kop. Tijdens het slepen
      // staat de invoegstreep op de LINKERgrens van WBS, precies waar Taaknaam daarna landt.
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

      // Het minteken verschijnt bij hover rechts in de kop, naast de breedterand.
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
