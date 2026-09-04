// Issue #89 — de tabelweergave als de gebruiker hem ziet: hiërarchie-inspringing van taaknamen,
// precies één tooltip per cel, een Delete-melding in de interfacetaal, lucht rond de
// kolom-plusknop en een naameditor over de volle kolombreedte. Alle handelingen zijn echte
// muis- en toetsevents; de brug zet alleen de fixture.
import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';

function taskRow(page: Page, taskId: string, surfaceId = 'full-task-grid'): Locator {
  return page.locator(
    `[data-task-grid-surface-id="${surfaceId}"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"]`,
  );
}

function taskCell(page: Page, taskId: string, columnId: string, surfaceId = 'full-task-grid'): Locator {
  return taskRow(page, taskId, surfaceId).locator(
    `[data-grid-data-cell="true"][data-grid-column-id="${columnId}"]`,
  );
}

async function left(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!.x;
}

/** Bouwt via de publieke acties een boom: ouder › (blad, samenvatting › (blad, blad)), blad. */
async function seedTree(page: Page): Promise<{ root: string; leaf1: string; summary: string; deep1: string; deep2: string; leaf2: string; top: string }> {
  const [root, top] = await seedProject(page, [
    { name: 'Ruwbouw', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Afbouw', start: '2026-09-21', finish: '2026-10-02', durationDays: 10 },
  ]);
  const ids = await page.evaluate(({ rootId }) => {
    const s = window.__OPS__!.store.getState();
    const leaf1 = s.addTask({ name: 'Fundering', parentId: rootId });
    const summary = s.addTask({ name: 'Casco', parentId: rootId });
    const deep1 = window.__OPS__!.store.getState().addTask({ name: 'Wanden', parentId: summary });
    const deep2 = window.__OPS__!.store.getState().addTask({ name: 'Vloeren', parentId: summary });
    const leaf2 = window.__OPS__!.store.getState().addTask({ name: 'Dak', parentId: rootId });
    window.__OPS__!.store.getState().runCPM();
    return { leaf1, summary, deep1, deep2, leaf2 };
  }, { rootId: root });
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.length)).toBe(7);
  return { root, top, ...ids };
}

async function openTable(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(page.locator('[data-task-grid-surface-id="full-task-grid"] [role="grid"]')).toBeVisible();
}

test('tabel: taaknamen springen per niveau in en het triehoekje staat onder de oudernaam', async ({ page, ops: _ops }) => {
  const tree = await seedTree(page);
  await openTable(page);
  const label = (id: string) => taskCell(page, id, 'task.name').locator('.full-task-grid-name-label');
  const disclosure = (id: string) => taskCell(page, id, 'task.name').locator('.full-task-grid-disclosure');

  const rootText = await left(label(tree.root));
  const leaf1Text = await left(label(tree.leaf1));
  const summaryText = await left(label(tree.summary));
  const summaryArrow = await left(disclosure(tree.summary));
  const deep1Text = await left(label(tree.deep1));
  const deep2Text = await left(label(tree.deep2));
  const leaf2Text = await left(label(tree.leaf2));
  const topText = await left(label(tree.top));

  // De kern van de melding: een subtaak stond links van zijn ouder. Nu begint elk niveau exact één
  // eenheid verder, blad of samenvatting, en het triehoekje van "Casco" staat waar "Ruwbouw" begint.
  expect(leaf1Text).toBeGreaterThan(rootText);
  expect(Math.round(leaf1Text - rootText)).toBe(20);
  expect(Math.round(summaryText - rootText)).toBe(20);
  expect(Math.round(summaryArrow - rootText)).toBe(0);
  expect(Math.round(deep1Text - summaryText)).toBe(20);
  expect(Math.round(deep2Text - deep1Text)).toBe(0);
  expect(Math.round(leaf2Text - leaf1Text)).toBe(0);
  // Een blad op het hoogste niveau ("Afbouw") begint op dezelfde kolom als de samenvatting ernaast.
  expect(Math.round(topText - rootText)).toBe(0);
});

test('gantt: de subtaak-plus staat rechts in de naamkolom, achter de tekst', async ({ page, ops: _ops }) => {
  const tree = await seedTree(page);
  const cell = taskCell(page, tree.root, 'task.name', 'gantt-task-grid');
  const cellBox = (await cell.boundingBox())!;
  const plus = cell.locator('.gantt-task-grid-add-child');
  await expect(plus).toBeVisible();
  const plusBox = (await plus.boundingBox())!;
  const labelBox = (await cell.locator('.full-task-grid-name-label').boundingBox())!;
  expect(plusBox.x).toBeGreaterThan(labelBox.x + labelBox.width);
  // Rechts uitgelijnd, maar met lucht tot de kolomrand (punt 4 van het issue ging juist over een
  // plus die tegen de rand aan stond).
  const gapToEdge = cellBox.x + cellBox.width - (plusBox.x + plusBox.width);
  expect(gapToEdge).toBeGreaterThanOrEqual(5);
  expect(gapToEdge).toBeLessThanOrEqual(12);
});

test('tabel: één tooltip per cel — geen taakkaart op gewone cellen, waarde alleen bij afknippen', async ({ page, ops: _ops }) => {
  const longName = 'Een taaknaam die veel langer is dan de kolom breed is, zodat hij zeker wordt afgeknipt';
  const [longId, shortId] = await seedProject(page, [
    { name: longName, start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Kort', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate(({ from, to }) => {
    const s = window.__OPS__!.store.getState();
    s.addSequence({ predecessorId: from, successorId: to, type: 'FINISH_START', lagDays: 2 });
    // De voorgangerskolom staat niet in de standaardset van de tabel; dezelfde voorkeur als via
    // de kolomkiezer, zonder de kiezerdialoog zelf te hoeven bedienen.
    const columns = window.__OPS__!.store.getState().taskGridSurfaces['full-task-grid'].columns;
    window.__OPS__!.store.getState().setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'relation.predecessors', width: 160, pinned: false } as unknown as (typeof columns)[number],
    ]);
    window.__OPS__!.store.getState().runCPM();
  }, { from: longId, to: shortId });
  await openTable(page);
  const tooltip = page.locator('.gantt-tooltip');
  // De app toont elk `title`-attribuut via zijn eigen TooltipHost-bubbel (na 400 ms) en neemt het
  // attribuut tijdens de hover weg; de zichtbare bubbel is dus wat de gebruiker ziet.
  const bubble = page.locator('.ops-tooltip');

  // Een gewone, volledig zichtbare cel: geen taakkaart en geen bubbel.
  const shortName = taskCell(page, shortId, 'task.name');
  await shortName.hover();
  await page.mouse.move((await shortName.boundingBox())!.x + 10, (await shortName.boundingBox())!.y + 5);
  await page.waitForTimeout(700);
  await expect(tooltip).toHaveCount(0);
  await expect(bubble).toHaveCount(0);
  await expect(shortName).not.toHaveAttribute('title', /.+/);

  // Een datumcel toont de canonieke waarde achter de persoonlijke notatie: die zegt méér dan de
  // zichtbare tekst en blijft dus altijd bereikbaar, zonder taakkaart ernaast. (Met de
  // jaar-maand-dag-notatie zou weergave en waarde samenvallen en verdwijnt de tooltip terecht.)
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ dateNotation: 'dmy' }));
  const startCell = taskCell(page, shortId, 'task.time.scheduleStart');
  await expect(startCell).toHaveText('07-09-2026');
  await startCell.hover();
  await expect(bubble).toHaveText('2026-09-07');
  await expect(tooltip).toHaveCount(0);

  // Een afgeknipte naam: de volledige waarde als bubbel, nog steeds geen taakkaart. De meting
  // gebeurt pas bij binnenkomst van de muis; de host kijkt daarom één keer opnieuw.
  const longNameCell = taskCell(page, longId, 'task.name');
  await longNameCell.hover();
  await expect(bubble).toHaveText(longName);
  await expect(tooltip).toHaveCount(0);

  // De relatiecel: boven de link precies één zwevende kaart (van de andere taak, mét
  // relatiedetails) en geen native title op cel of chip.
  const relationCell = taskCell(page, shortId, 'relation.predecessors');
  const link = relationCell.locator('.task-grid-relation-jump');
  await expect(link).toBeVisible();
  await link.hover();
  await expect(tooltip).toHaveCount(1);
  await expect(tooltip.locator('.tooltip-title')).toHaveText(longName);
  await expect(tooltip).toContainText('FS');
  await page.waitForTimeout(700);
  await expect(bubble).toHaveCount(0);
  expect(await link.getAttribute('title')).toBe('');
  await expect(relationCell.locator('.task-grid-relation-chip')).not.toHaveAttribute('title', /.+/);
});

test('tabel: Delete op een verplichte cel meldt in de interfacetaal, niet in het Nederlands', async ({ page, ops: _ops }) => {
  const [id] = await seedProject(page, [
    { name: 'Verplichte naam', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await openTable(page);
  const locale = await page.evaluate(() => document.documentElement.lang);
  const nameCell = taskCell(page, id, 'task.name');
  await nameCell.click();
  await page.keyboard.press('Delete');
  const error = page.locator('.full-task-grid-error');
  await expect(error).toBeVisible();
  const text = (await error.textContent()) ?? '';
  // De browser draait in het Engels; de melding hoort dan Engels te zijn en nooit de oude
  // Nederlandse `defaultValue`. (Een Nederlandse interface krijgt de Nederlandse tekst.)
  expect(text).not.toContain('Wissen is');
  if (locale.startsWith('en')) expect(text).toBe('This value is required and cannot be left empty.');
  else if (locale.startsWith('nl')) expect(text).toBe('Deze waarde is verplicht en kan niet leeg blijven.');
  // De taak zelf blijft bestaan: Delete wist celinhoud, geen taken.
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.length)).toBe(1);
});

test('tabel: de naameditor beslaat de kolom vanaf de tekstpositie tot de rechterrand', async ({ page, ops: _ops }) => {
  const tree = await seedTree(page);
  await openTable(page);
  const cell = taskCell(page, tree.leaf1, 'task.name');
  const labelLeft = await left(cell.locator('.full-task-grid-name-label'));
  await cell.click();
  await page.keyboard.press('Enter');
  const input = cell.locator('input');
  await expect(input).toBeFocused();
  const cellBox = (await cell.boundingBox())!;
  const inputBox = (await input.boundingBox())!;
  expect(Math.abs(inputBox.x - labelLeft)).toBeLessThanOrEqual(2);
  expect(cellBox.x + cellBox.width - (inputBox.x + inputBox.width)).toBeLessThanOrEqual(3);
  expect(inputBox.width).toBeGreaterThan(cellBox.width * 0.7);
  await page.keyboard.press('Escape');
});

test('tabel: de kolom-plusknop staat vrij van de kaderrand en van de laatste kolom', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Enige taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await openTable(page);
  const shell = page.locator('[data-task-grid-surface-id="full-task-grid"] .task-grid-shell');
  const button = shell.locator('.task-grid-add-column');
  const anchor = shell.locator('.task-grid-column-chooser-anchor');
  const anchorBox = (await anchor.boundingBox())!;
  const buttonBox = (await button.boundingBox())!;
  // Zes pixels lucht links en rechts van de knop binnen de strook, en de knop staat verticaal vrij.
  expect(anchorBox.x + anchorBox.width - (buttonBox.x + buttonBox.width)).toBeGreaterThanOrEqual(5);
  expect(buttonBox.x - anchorBox.x).toBeGreaterThanOrEqual(5);
  expect(anchorBox.y + anchorBox.height - (buttonBox.y + buttonBox.height)).toBeGreaterThanOrEqual(2);
  expect(buttonBox.y - anchorBox.y).toBeGreaterThanOrEqual(2);
});
