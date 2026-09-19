// Layoutknoppen (issue #144, gfayat): één klik zet het resourcediagram aan, nogmaals klikken brengt
// het beeld van vóór de klik terug, zonder dat zoom of filter meeverhuizen. De pure kern en de migratie worden
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
  return { group: v.group, sort: v.sort, filter: v.filter, zoom: v.zoom, showRelations: v.showRelations ?? true };
});

const RESOURCE_DIAGRAM = '[data-ops-layout-button="builtin:resource-diagram"] button';

test('layoutknop: één klik zet het resourcediagram aan, nogmaals klikken brengt het beeld van vóór de klik terug', async ({ page, ops: _ops }) => {
  await seedWithResources(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setZoom(17);
    s.setSort([{ field: { src: 'builtin', key: 'name' }, dir: 'desc' }]);
    s.setFilter({ kind: 'group', op: 'AND', children: [
      { kind: 'rule', field: { src: 'builtin', key: 'name' }, operator: 'neq', value: 'Gevel' },
    ] });
  });
  const before = await viewState(page);

  await page.getByRole('button', { name: /^(View|Beeld)$/ }).click();
  const button = page.locator(RESOURCE_DIAGRAM);
  await expect(button).not.toHaveClass(/active/);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/01-knoppenrij-uit.png` });

  await button.click();
  const on = await viewState(page);
  expect(on.group).toEqual([{ field: { src: 'resource' }, dir: 'asc' }]);
  expect(on.showRelations).toBe(false);
  // Zoom en filter zijn geen deel van deze layout en blijven dus staan.
  expect(on.zoom).toBe(before.zoom);
  expect(on.filter).toEqual(before.filter);
  // Banden per resource: Ploeg A en Kraan (Gevel is weggefilterd, dus geen band "(geen)").
  await expect(page.locator('[data-grid-group-cell]')).toHaveCount(2);
  await expect(button).toHaveClass(/active/);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/02-resourcediagram-aan.png` });

  // Handmatig zoomen tijdens het resourcediagram: geen layoutdeel, dus uitzetten laat het staan.
  await page.evaluate(() => window.__OPS__!.store.getState().setZoom(23));
  await expect(button).toHaveClass(/active/);

  await button.click();
  const off = await viewState(page);
  expect(off.group).toEqual([]);
  expect(off.sort).toEqual(before.sort);
  expect(off.showRelations).toBe(true);
  expect(off.zoom).toBe(23);
  expect(off.filter).toEqual(before.filter);
  await expect(button).not.toHaveClass(/active/);

  // Elke klik is één undo-stap, en de knop volgt het scherm in plaats van de laatste klik.
  await page.keyboard.press('ControlOrMeta+z');
  expect((await viewState(page)).group).toEqual(on.group);
  await expect(button).toHaveClass(/active/);

  // Een gedragen deel met de hand wijzigen = de layout staat niet meer op het scherm.
  await page.evaluate(() => window.__OPS__!.store.getState().setGroup([]));
  await expect(button).not.toHaveClass(/active/);
});

test('layoutknop: een opgeslagen filter van vóór #144 staat onder de filterknop en raakt alleen het filter', async ({ page, ops: _ops }) => {
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
  await page.locator(RESOURCE_DIAGRAM).click();
  // Een layout die alleen een filter draagt is geen layoutknop maar een regel onder de filterknop.
  await expect(page.locator('[data-ops-layout-button]')).toHaveCount(1);
  await page.getByRole('button', { name: /^Filter/ }).click();
  await page.getByRole('button', { name: 'Zonder gevel' }).click();

  const after = await viewState(page);
  expect(after.filter).not.toBeNull();
  // De filter-layout draagt geen groepering: het resourcediagram blijft staan.
  expect(after.group).toEqual([{ field: { src: 'resource' }, dir: 'asc' }]);
  await expect(page.locator(RESOURCE_DIAGRAM)).toHaveClass(/active/);
  expect(await page.evaluate(() => localStorage.getItem('ops-savedFilters'))).toContain('zonder-gevel');
});
