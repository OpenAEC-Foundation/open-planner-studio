// Review vader (2026-10-06), punt 3: onder de keuze van het relatietype staat één regel uitleg met
// de echte taaknamen ("Metselwerk begint pas als Fundering klaar is."), op alle drie de plekken
// waar je een type kiest: de popover na het slepen in de Gantt, het blok Relaties in het
// eigenschappenpaneel en de relatiecel in de tabel. Alleen echte muis- en toetsenbordevents; de
// dev-bridge zet alleen de fixture neer en leest de toestand.
import type { Page } from '@playwright/test';
import { barPoint, expect, seedProject, test } from './fixtures/ops';

const SHOT_DIR = process.env.OPS_QA_SHOTS;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

async function seedPair(page: Page): Promise<[string, string]> {
  const [source, target] = await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 },
    { name: 'Metselwerk', start: '2026-09-21', finish: '2026-09-25', durationDays: 5 },
  ]);
  return [source, target];
}

async function link(page: Page, source: string, target: string): Promise<void> {
  await page.evaluate(({ predecessorId, successorId }) => {
    window.__OPS__!.store.getState().addSequence({ predecessorId, successorId, type: 'FINISH_START', lagDays: 0 });
  }, { predecessorId: source, successorId: target });
}

test('Gantt-popover toont de uitlegzin en volgt de typekeuze', async ({ page, ops: _ops }) => {
  const [source, target] = await seedPair(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showPropertiesPanel: false, rightPanelCollapsed: true });
    s.setZoom(18);
    s.setScroll(0, 0);
  });
  const from = await barPoint(page, source);
  const to = await barPoint(page, target);

  await page.keyboard.down('Shift');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Shift');

  const popover = page.locator('[data-ops-relation-popover]');
  const sentence = popover.locator('[data-ops-relation-sentence]');
  await expect(sentence).toHaveText('Metselwerk can only start once Fundering has finished.');
  await shot(page, 'popover-fs');

  // Zonder muis: de focus staat na het slepen op de typekeuze.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(popover).toBeVisible();
  await expect(sentence).toHaveAttribute('data-ops-relation-sentence', 'SS');
  await expect(sentence).toHaveText('Metselwerk can only start once Fundering has started.');
  await shot(page, 'popover-ss');
});

test('eigenschappenpaneel: uitlegzin alleen onder de relatie met focus', async ({ page, ops: _ops }) => {
  const [source, target] = await seedPair(page);
  await link(page, source, target);
  await page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    s.selectTask(id);
  }, target);

  const item = page.locator('.dependency-item').first();
  await item.scrollIntoViewIfNeeded();
  await expect(item.locator('[data-ops-relation-sentence]')).toHaveCount(0);

  const type = item.locator('.dependency-type-field .ops-select__trigger');
  await type.click();
  await expect(item.locator('[data-ops-relation-sentence]'))
    .toHaveText('Metselwerk can only start once Fundering has finished.');
  await page.getByRole('option', { name: 'FF', exact: true }).click();
  await expect(item.locator('[data-ops-relation-sentence]'))
    .toHaveText('Metselwerk can only finish once Fundering has finished.');
  await shot(page, 'paneel-ff');

  // Focus weg uit de regel: de zin verdwijnt weer.
  await page.locator('[data-ops-dependency-add]').focus();
  await expect(item.locator('[data-ops-relation-sentence]')).toHaveCount(0);
});

test('relatiecel in de tabel: uitlegzin met de eigen taak als opvolger', async ({ page, ops: _ops }) => {
  const [source, target] = await seedPair(page);
  await link(page, source, target);
  await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    store.setUI({ activeRibbonTab: 'table' });
    const columns = store.taskGridSurfaces['full-task-grid'].columns;
    if (!columns.some(column => column.id === 'relation.predecessors')) {
      store.commitTaskGridColumns('full-task-grid', 'Relatiekolom voor browsertest', [
        ...columns,
        { id: 'relation.predecessors' as (typeof columns)[number]['id'], width: 240, pinned: false },
      ]);
    }
  });

  const cell = page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-row-key="${target}"][data-grid-column-id="relation.predecessors"]`,
  );
  await cell.click();
  await page.keyboard.press('Enter');
  const editor = page.locator('[data-task-editor-kind="relations"]');
  await expect(editor).toBeVisible();
  await expect(editor.locator('[data-ops-relation-sentence]')).toHaveCount(0);

  const type = editor.locator('.task-grid-relation-type .ops-select__trigger').first();
  await type.focus();
  await expect(editor.locator('[data-ops-relation-sentence]'))
    .toHaveText('Metselwerk can only start once Fundering has finished.');
  // Escape sluit eerst alleen de lijst; de celbewerking blijft open.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(editor).toBeVisible();
  await type.click();
  await page.getByRole('option', { name: 'SF', exact: true }).click();
  await expect(editor.locator('[data-ops-relation-sentence]'))
    .toHaveText('Metselwerk can only finish once Fundering has started.');
  await shot(page, 'tabel-sf');
});
