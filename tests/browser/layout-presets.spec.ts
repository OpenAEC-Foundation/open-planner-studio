// Layouts als weergavepresets (issue #144, gfayat): één klik van de WBS-boom naar het resourcediagram
// en één klik terug, zonder dat zoom of filter meeverhuizen. De pure kern en de migratie worden
// headless bewaakt (tests/planning/check-layout-presets.ts); hier de echte gebruikersflow.
import { expect, seedProject, test } from './fixtures/ops';

const SHOTS = process.env.OPS_LAYOUT_SHOTS;

async function seedWithResources(page: import('@playwright/test').Page): Promise<void> {
  await seedProject(page, [
    { name: 'Fundering', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Casco', start: '2026-09-21', finish: '2026-10-16', durationDays: 20 },
    { name: 'Gevel', start: '2026-10-19', finish: '2026-10-30', durationDays: 10 },
  ], 'Layoutpresets');
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const [fundering, casco] = s.tasks.map(task => task.id);
    const ploeg = s.addResource({ name: 'Ploeg A', type: 'CREW', description: '', maxUnits: 1 });
    const kraan = s.addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
    s.assignResource(fundering, ploeg, 1);
    s.assignResource(casco, ploeg, 1);
    s.assignResource(casco, kraan, 1);
    window.__OPS__!.store.getState().runCPM();
  });
}

const viewState = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const v = window.__OPS__!.store.getState().view;
  return { group: v.group, sort: v.sort, filter: v.filter, zoom: v.zoom };
});

test('layoutlijst: één klik naar het resourcediagram en één klik terug, zoom en filter blijven staan', async ({ page, ops: _ops }) => {
  await seedWithResources(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setZoom(17);
    s.setFilter({ kind: 'group', op: 'AND', children: [
      { kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'neq', value: 'Gevel' },
    ] });
  });
  const before = await viewState(page);

  await page.getByRole('button', { name: /^(View|Beeld)$/ }).click();
  const select = page.locator('[data-ops-layout-select]');
  // Verse staat = de WBS-boom, en dat ZEGT de lijst ook: de waarde is afgeleid van het scherm.
  await expect(select).toHaveValue('builtin:gantt-wbs');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/01-lint-gantt-wbs.png` });

  await select.selectOption('builtin:resource-diagram');
  const grouped = await viewState(page);
  expect(grouped.group).toEqual([{ field: { src: 'resource' }, dir: 'asc' }]);
  expect(grouped.zoom).toBe(before.zoom);
  expect(grouped.filter).toEqual(before.filter);
  // Banden per resource: Ploeg A en Kraan (Gevel is weggefilterd, dus geen band "(geen)").
  await expect(page.locator('[data-grid-group-cell]')).toHaveCount(2);
  await expect(select).toHaveValue('builtin:resource-diagram');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/02-resourcediagram.png` });

  await select.selectOption('builtin:gantt-wbs');
  const back = await viewState(page);
  expect(back.group).toEqual([]);
  expect(back.zoom).toBe(before.zoom);
  expect(back.filter).toEqual(before.filter);
  await expect(page.locator('[data-grid-group-cell]')).toHaveCount(0);

  // Toepassen is een undo-stap: Ctrl+Z brengt het resourcediagram terug, en de lijst volgt het scherm.
  await page.keyboard.press('ControlOrMeta+z');
  expect((await viewState(page)).group).toEqual(grouped.group);
  await expect(select).toHaveValue('builtin:resource-diagram');
});

test('layoutlijst: een opgeslagen filter van vóór #144 verschijnt als layout en raakt alleen het filter', async ({ page, ops: _ops }) => {
  // De oude sleutel zetten en herladen: de migratie draait bij de eerste `loadLayouts()`.
  await page.evaluate(() => {
    localStorage.setItem('ops-savedFilters', JSON.stringify([{
      id: 'zonder-gevel', name: 'Zonder gevel',
      filter: { kind: 'group', op: 'AND', children: [
        { kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'neq', value: 'Gevel' },
      ] },
    }]));
    localStorage.removeItem('ops-savedFiltersMigrated');
    localStorage.removeItem('ops-taskGridLayouts');
  });
  await page.reload();
  await page.locator('[data-ops-welcome-dialog]').waitFor({ state: 'attached', timeout: 15_000 });
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.newProject();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false, activeRibbonTab: 'start' });
  });
  await seedWithResources(page);

  await page.getByRole('button', { name: /^(View|Beeld)$/ }).click();
  const select = page.locator('[data-ops-layout-select]');
  await select.selectOption('builtin:resource-diagram');
  await expect(select.locator('optgroup').last().locator('option')).toHaveText(['Zonder gevel']);
  if (SHOTS) {
    await select.focus();
    await page.screenshot({ path: `${SHOTS}/03-lijst-met-filterlayout.png` });
  }

  await select.selectOption('zonder-gevel');
  const after = await viewState(page);
  expect(after.filter).not.toBeNull();
  // De filter-layout draagt geen groepering: het resourcediagram blijft staan.
  expect(after.group).toEqual([{ field: { src: 'resource' }, dir: 'asc' }]);
  expect(await page.evaluate(() => localStorage.getItem('ops-savedFilters'))).toContain('zonder-gevel');
});
