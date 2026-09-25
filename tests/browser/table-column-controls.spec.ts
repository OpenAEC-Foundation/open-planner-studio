// De in-app gids "Kolommen kiezen" (public/docs/<taal>/ref-kolommen.md) beschrijft de kolombediening
// van de twee taaktabellen. Tot deze spec beschreef hij een verdwenen venster (Zichtbaar-vinkjes,
// Breedte-velden, een sleepgreep en een lijst "Beschikbare velden") en vaste kolommen voor de
// takenlijst naast de Gantt. Deze spec loopt de beweringen van de herschreven gids na met echte
// klikken, toetsen, sleepbewegingen en hover: de kolomkiezer (plus, lint, klassieke Beeld-knop), het
// toevoegen, en in de kolomkop verplaatsen, verbreden, passend maken, vastzetten en verwijderen, elk
// als één stap voor Ctrl+Z. De `__OPS__`-brug zet alleen de planning en de legacy-instelling, en leest
// state. "Herstel standaard" staat in table-column-reset.spec.ts.
import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';

type Surface = 'full-task-grid' | 'gantt-task-grid';
interface Column { id: string; width: number; pinned: boolean }

const TABLE_DEFAULT_IDS = [
  'task.wbsCode',
  'task.name',
  'task.time.scheduleDuration',
  'task.time.start',
  'task.time.finish',
  'task.taskType',
  'task.time.isCritical',
  'task.time.totalFloat',
  'task.time.completion',
];
const GANTT_DEFAULT_IDS = ['task.wbsCode', 'task.name', 'task.time.scheduleDuration'];

const CHOOSER = /^(Choose column|Kolom kiezen)$/;
const RECENT = /^(Recently used|Laatst gebruikt)$/;
const SEARCH = /^(Search|Zoeken)$/;
const SEARCH_RESULTS = /^(Search results|Zoekresultaten)$/;
const CATEGORIES = [
  /^(Task|Taak)$/,
  /^(Planning)$/,
  /^(Constraints|Beperkingen)$/,
  /^(Relations|Relaties)$/,
  /^(Resources)$/,
  /^(Progress|Voortgang)$/,
  /^(Calculated|Berekend)$/,
  /^(Baseline)$/,
  /^(Custom|Aangepast)$/,
  /^(Technical|Technisch)$/,
];

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

async function storeColumns(page: Page, surface: Surface): Promise<Column[]> {
  return page.evaluate(id => window.__OPS__!.store.getState().taskGridSurfaces[id].columns
    .map(column => ({ id: column.id as string, width: column.width, pinned: column.pinned })), surface);
}

async function widthOf(page: Page, surface: Surface, columnId: string): Promise<number | undefined> {
  return (await storeColumns(page, surface)).find(column => column.id === columnId)?.width;
}

async function undoDepth(page: Page): Promise<number> {
  return (await state(page)).undoDepth;
}

async function openTable(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(shell(page, 'full-task-grid').locator('[role="grid"]')).toBeVisible();
}

test('kolomkiezer: plus, zoeken, groepen, toevoegen en Laatst gebruikt zoals de gids ze beschrijft', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Ruwbouw', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 }]);
  await openTable(page);
  expect(await headerIds(page, 'full-task-grid')).toEqual(TABLE_DEFAULT_IDS);

  const plus = shell(page, 'full-task-grid').locator('.task-grid-add-column');
  const chooser = page.getByRole('dialog', { name: CHOOSER });
  await plus.click();
  await expect(chooser).toBeVisible();

  // Nog niets toegevoegd: geen blok "Laatst gebruikt". Wel het zoekveld en de tien groepen, dicht,
  // in de volgorde van de gids, elk met een aantal.
  await expect(chooser.getByRole('region', { name: RECENT })).toHaveCount(0);
  await expect(chooser.getByRole('searchbox', { name: SEARCH })).toBeVisible();
  const categoryButtons = chooser.locator('.task-grid-column-chooser-category');
  await expect(categoryButtons).toHaveCount(CATEGORIES.length);
  for (const [index, label] of CATEGORIES.entries()) {
    const button = categoryButtons.nth(index);
    await expect(button.locator('span').first()).toHaveText(label);
    await expect(button.locator('.task-grid-column-chooser-category-count')).toHaveText(/^\d+$/);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  }

  // Een groep openklappen: een veld dat al een kolom is staat aangevinkt en is niet te kiezen.
  const calculated = categoryButtons.nth(CATEGORIES.findIndex(label => label.test('Calculated')));
  await calculated.click();
  await expect(calculated).toHaveAttribute('aria-expanded', 'true');
  const critical = chooser.getByRole('menuitemcheckbox', { name: /^(Critical|Kritiek)$/ });
  await expect(critical).toHaveAttribute('aria-checked', 'true');
  await expect(critical).toBeDisabled();
  for (const name of [/^(Free float|Vrije speling)$/, /^(Interfering float|Interfererende speling)$/,
    /^(Near critical|Bijna kritiek)$/, /^(Float path|Spelingpad)$/]) {
    await expect(chooser.getByRole('menuitemcheckbox', { name })).toHaveAttribute('aria-checked', 'false');
  }

  // Een veld kiezen: het komt als laatste kolom in de tabel en de kiezer sluit. Eén stap voor Ctrl+Z.
  const beforeAdd = await undoDepth(page);
  await chooser.getByRole('menuitemcheckbox', { name: /^(Free float|Vrije speling)$/ }).click();
  await expect(chooser).toHaveCount(0);
  await expect.poll(() => headerIds(page, 'full-task-grid'))
    .toEqual([...TABLE_DEFAULT_IDS, 'task.time.freeFloat']);
  expect(await undoDepth(page)).toBe(beforeAdd + 1);
  // De takenlijst naast de Gantt heeft een eigen indeling en blijft ongemoeid.
  expect((await storeColumns(page, 'gantt-task-grid')).map(column => column.id)).toEqual(GANTT_DEFAULT_IDS);

  // Opnieuw open: "Laatst gebruikt" toont het toegevoegde veld, aangevinkt.
  await plus.click();
  const recent = chooser.getByRole('region', { name: RECENT });
  await expect(recent).toBeVisible();
  await expect(recent.getByRole('menuitemcheckbox', { name: /^(Free float|Vrije speling)$/ }))
    .toHaveAttribute('aria-checked', 'true');

  // Zoeken doorzoekt alle groepen.
  await chooser.getByRole('searchbox', { name: SEARCH }).fill('float');
  const results = chooser.getByRole('region', { name: SEARCH_RESULTS });
  await expect(results.getByRole('menuitemcheckbox', { name: /^(Total float|Totale speling)$/ })).toBeVisible();
  await expect(results.getByRole('menuitemcheckbox', { name: /^(Interfering float|Interfererende speling)$/ })).toBeVisible();

  // Esc sluit; nog een klik op het plusje sluit ook.
  await page.keyboard.press('Escape');
  await expect(chooser).toHaveCount(0);
  await plus.click();
  await expect(chooser).toBeVisible();
  await plus.click();
  await expect(chooser).toHaveCount(0);

  // Ctrl+Z haalt de toegevoegde kolom weg.
  await page.keyboard.press('Control+z');
  await expect.poll(() => headerIds(page, 'full-task-grid')).toEqual(TABLE_DEFAULT_IDS);
});

test('kolomkop: verplaatsen, verbreden, passend maken, vastzetten en verwijderen, elk één stap', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Ruwbouw', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Afbouw', start: '2026-09-21', finish: '2026-10-02', durationDays: 10 },
  ]);
  await openTable(page);
  const surface = 'full-task-grid';

  // Verplaatsen: sleep de kop Einde naar de linkerhelft van de kop Start.
  let depth = await undoDepth(page);
  await header(page, surface, 'task.time.finish').dragTo(header(page, surface, 'task.time.start'), {
    targetPosition: { x: 4, y: 10 },
  });
  await expect.poll(() => headerIds(page, surface)).toEqual([
    'task.wbsCode', 'task.name', 'task.time.scheduleDuration', 'task.time.finish', 'task.time.start',
    'task.taskType', 'task.time.isCritical', 'task.time.totalFloat', 'task.time.completion',
  ]);
  expect(await undoDepth(page)).toBe(++depth);

  // Breedte: sleep de rechterrand van Start 40 px naar rechts.
  const startHandle = header(page, surface, 'task.time.start').locator('.task-grid-resize-handle');
  const box = (await startHandle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 4 });
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => widthOf(page, surface, 'task.time.start')).toBe(140);
  expect(await undoDepth(page)).toBe(++depth);

  // Toetsenbord op de rand: pijl rechts +8, Shift+pijl rechts +32. (De focus zetten is opzet; de
  // geteste handeling is de toets.)
  await startHandle.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => widthOf(page, surface, 'task.time.start')).toBe(148);
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(() => widthOf(page, surface, 'task.time.start')).toBe(180);
  depth += 2;
  expect(await undoDepth(page)).toBe(depth);

  // Dubbelklik op de rand van Taaknaam: passend voor kop en langste waarde (binnen 40–480 px).
  await header(page, surface, 'task.name').locator('.task-grid-resize-handle').dblclick();
  await expect.poll(() => widthOf(page, surface, 'task.name')).not.toBe(240);
  const fitted = (await widthOf(page, surface, 'task.name'))!;
  expect(fitted).toBeGreaterThanOrEqual(40);
  expect(fitted).toBeLessThanOrEqual(480);
  expect(await undoDepth(page)).toBe(++depth);

  // Rechtsklik: Vastzetten, Automatisch passend maken en Verwijderen. Vastzetten schuift de kolom
  // naar voren.
  await header(page, surface, 'task.time.totalFloat').click({ button: 'right' });
  const menu = page.getByRole('menu', { name: /^(Total float|Totale speling)$/ });
  await expect(menu.getByRole('menuitem')).toHaveText([
    /^(Pin|Vastzetten)$/,
    /^(Auto fit|Automatisch passend maken)$/,
    /^(Remove|Verwijderen): (Total float|Totale speling)$/,
  ]);
  await menu.getByRole('menuitem', { name: /^(Pin|Vastzetten)$/ }).click();
  await expect.poll(() => headerIds(page, surface).then(ids => ids[0])).toBe('task.time.totalFloat');
  expect((await storeColumns(page, surface))[0]).toMatchObject({ id: 'task.time.totalFloat', pinned: true });
  expect(await undoDepth(page)).toBe(++depth);

  // Een losse kolom komt niet tussen de vastgezette: WBS op de vastgezette kop laten vallen
  // verandert niets (en telt geen stap).
  const idsBefore = await headerIds(page, surface);
  await header(page, surface, 'task.wbsCode').dragTo(header(page, surface, 'task.time.totalFloat'), {
    targetPosition: { x: 4, y: 10 },
  });
  expect(await headerIds(page, surface)).toEqual(idsBefore);
  expect(await undoDepth(page)).toBe(depth);

  // Het contextmenu toont nu Losmaken.
  await header(page, surface, 'task.time.totalFloat').click({ button: 'right' });
  await expect(menu.getByRole('menuitem').first()).toHaveText(/^(Unpin|Losmaken)$/);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);

  // Verwijderen via het minteken: het verschijnt pas als je over de kolomkop beweegt.
  const taskTypeHeader = header(page, surface, 'task.taskType');
  const minus = taskTypeHeader.locator('.task-grid-remove-column');
  await page.mouse.move(0, 0);
  await expect(minus).toHaveCSS('opacity', '0');
  await taskTypeHeader.hover();
  await expect(minus).toHaveCSS('opacity', '1');
  await minus.click();
  await expect.poll(() => headerIds(page, surface).then(ids => ids.includes('task.taskType'))).toBe(false);
  expect(await undoDepth(page)).toBe(++depth);

  // Het veld blijft kiesbaar in de kolomkiezer.
  await shell(page, surface).locator('.task-grid-add-column').click();
  const chooser = page.getByRole('dialog', { name: CHOOSER });
  await chooser.getByRole('searchbox', { name: SEARCH }).fill('type');
  await expect(chooser.getByRole('region', { name: SEARCH_RESULTS })
    .getByRole('menuitemcheckbox', { name: /^(Task type|Taaktype)$/ })).toBeEnabled();
  await page.keyboard.press('Escape');

  // Elke handeling was één stap: Ctrl+Z zet ze een voor een terug, tot de standaardindeling.
  for (let step = 0; step < 7; step++) await page.keyboard.press('Control+z');
  await expect.poll(() => headerIds(page, surface)).toEqual(TABLE_DEFAULT_IDS);
  expect(await widthOf(page, surface, 'task.time.start')).toBe(100);
  expect(await widthOf(page, surface, 'task.name')).toBe(240);
  expect((await storeColumns(page, surface)).every(column => !column.pinned)).toBe(true);
  // De planning zelf is niet aangeraakt.
  expect((await state(page)).tasks.map(task => task.name)).toEqual(['Ruwbouw', 'Afbouw']);
});

test('takenlijst naast de Gantt: eigen plus en eigen kolommen; het lint opent de kiezer van de Tabel', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Ruwbouw', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 }]);
  await expect(shell(page, 'gantt-task-grid').locator('[role="grid"]')).toBeVisible();
  expect(await headerIds(page, 'gantt-task-grid')).toEqual(GANTT_DEFAULT_IDS);

  // Het plusje van de takenlijst werkt alleen op de takenlijst.
  await shell(page, 'gantt-task-grid').locator('.task-grid-add-column').click();
  const chooser = page.getByRole('dialog', { name: CHOOSER });
  await chooser.getByRole('searchbox', { name: SEARCH }).fill('start');
  await chooser.getByRole('region', { name: SEARCH_RESULTS })
    .getByRole('menuitemcheckbox', { name: /^Start$/ }).click();
  await expect.poll(() => headerIds(page, 'gantt-task-grid')).toEqual([...GANTT_DEFAULT_IDS, 'task.time.start']);
  expect((await storeColumns(page, 'full-task-grid')).map(column => column.id)).toEqual(TABLE_DEFAULT_IDS);

  // Tabblad Tabel → Kolommen… opent de kiezer van de Tabel.
  await openTable(page);
  await page.getByRole('button', { name: /^(Choose the columns of the Table view|Kolommen van de Tabel-weergave kiezen)$/ }).click();
  await expect(chooser).toBeVisible();
  await expect(shell(page, 'full-task-grid').locator('.task-grid-add-column')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(chooser).toHaveCount(0);

  // Klassieke weergaveknoppen aan (legacy-instelling, als fixture): Beeld → Weergave → Kolommen… gaat
  // naar het tabblad Tabel en opent daar dezelfde kiezer.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showClassicViewControls: true }));
  await page.getByRole('button', { name: /^(View|Beeld)$/ }).click();
  await expect(shell(page, 'full-task-grid')).toHaveCount(0);
  await page.locator('.ribbon-display-grid button', { hasText: /^(Columns…|Kolommen…)$/ }).click();
  await expect(chooser).toBeVisible();
  await expect(shell(page, 'full-task-grid').locator('.task-grid-add-column')).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.activeRibbonTab)).toBe('table');

  // Een klik buiten de kiezer sluit hem.
  await header(page, 'full-task-grid', 'task.wbsCode').click();
  await expect(chooser).toHaveCount(0);
});
