// Layoutknoppen (issue #144, gfayat): één klik zet het resourcediagram aan, nogmaals klikken brengt
// het beeld van vóór de klik terug, zonder dat zoom of filter meeverhuizen. De pure kern en de migratie worden
// headless bewaakt (tests/planning/check-layout-presets.ts); hier de echte gebruikersflow.
import { expect, seedProject, test, waitForWelcomeDialog } from './fixtures/ops';

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
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.newProject();
    s.setUI({ showWelcomeDialog: false, showTourOverlay: false, activeRibbonTab: 'start' });
  });
  await seedWithResources(page);

  await page.getByRole('button', { name: /^(View|Beeld)$/ }).click();
  // Het klassieke Weergave-blok (Kolommen/Filter/Groeperen/Sorteren) is een legacy-functie: standaard weg.
  await expect(page.getByRole('button', { name: /^(Sort|Sorteren)/ })).toHaveCount(0);
  const filterButton = page.locator('[data-ops-layout-button="zonder-gevel"] button');
  await expect(filterButton).toHaveText(/Zonder gevel/);

  await page.locator(RESOURCE_DIAGRAM).click();
  await filterButton.click();
  let v = await viewState(page);
  expect(v.filter).not.toBeNull();
  // Verschillende delen: beide knoppen staan samen aan, het resourcediagram blijft staan.
  expect(v.group).toEqual([{ field: { src: 'resource' }, dir: 'asc' }]);
  await expect(page.locator(RESOURCE_DIAGRAM)).toHaveClass(/active/);
  await expect(filterButton).toHaveClass(/active/);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/05-twee-knoppen-aan.png` });

  // De filterknop uit: alleen het filter gaat terug, het resourcediagram blijft aan.
  await filterButton.click();
  v = await viewState(page);
  expect(v.filter).toBeNull();
  expect(v.group).toEqual([{ field: { src: 'resource' }, dir: 'asc' }]);
  await expect(page.locator(RESOURCE_DIAGRAM)).toHaveClass(/active/);
  expect(await page.evaluate(() => localStorage.getItem('ops-savedFilters'))).toContain('zonder-gevel');
});

test('legacy-instelling: de klassieke weergaveknoppen komen terug via Instellingen → Legacy-functies', async ({ page, ops: _ops }) => {
  await page.getByRole('button', { name: /^(View|Beeld)$/ }).click();
  await expect(page.getByRole('button', { name: /^(Sort|Sorteren)/ })).toHaveCount(0);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const legacy = page.locator('[data-ops-legacy-settings]');
  // Het blok staat onderaan de laatste instellingentab (Toepassing/Geavanceerd).
  await page.locator('.settings-tab').last().click();
  await legacy.scrollIntoViewIfNeeded();
  await expect(legacy).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/06-legacy-instelling.png` });
  await legacy.getByRole('checkbox').check();
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: false }));
  await expect(page.getByRole('button', { name: /^(Sort|Sorteren)/ })).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('ops-showClassicViewControls'))).toBe('true');
});

test('layoutdialoog: plus maakt een eigen knop; je stelt de delen IN de dialoog in, en toepassen zonder opslaan maakt geen knop', async ({ page, ops: _ops }) => {
  await page.evaluate(() => { localStorage.removeItem('ops-taskGridLayouts'); });
  await seedWithResources(page);
  await page.evaluate(() => window.__OPS__!.store.getState().setZoom(17));

  await page.getByRole('button', { name: /^(View|Beeld)$/ }).click();
  const plus = page.getByRole('button', { name: /^(New layout|Nieuwe layout)$/ });
  await plus.click();
  const dialog = page.locator('[data-ops-layout-dialog]');
  await dialog.locator('[data-ops-layout-name]').fill('Per resource, zonder lijnen');
  await dialog.locator('[data-ops-layout-icon="star"]').click();
  // Alleen groepering en relatielijnen vastleggen; de rest uitvinken.
  for (const part of ['columns', 'filter', 'sort', 'timeScale']) {
    await dialog.locator(`[data-ops-layout-part="${part}"]`).uncheck();
  }
  // De groepering stel je HIER in — het scherm erachter is nog de WBS-boom.
  const groupRow = dialog.locator('[data-ops-layout-part-row="group"]');
  await groupRow.getByRole('button').click();
  await groupRow.locator('select').first().selectOption(JSON.stringify({ src: 'resource' }));
  await dialog.locator('[data-ops-layout-relations]').uncheck();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/03-layoutdialoog.png` });
  expect((await viewState(page)).group).toEqual([]);
  await page.locator('[data-ops-layout-save]').click();
  await expect(dialog).toHaveCount(0);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ops-taskGridLayouts')!).layouts);
  expect(stored).toHaveLength(1);
  expect(Object.keys(stored[0]).sort()).toEqual(['group', 'icon', 'id', 'name', 'showRelations']);
  // Opslaan past NIET toe: het scherm verandert pas bij een klik op de knop.
  expect((await viewState(page)).group).toEqual([]);

  const own = page.locator('[data-ops-layout-button]').filter({ hasText: 'Per resource' }).locator('button');
  await own.click();
  let v = await viewState(page);
  expect(v.group).toEqual([{ field: { src: 'resource' }, dir: 'asc' }]);
  expect(v.showRelations).toBe(false);
  expect(v.zoom).toBe(17);
  await expect(own).toHaveClass(/active/);
  // Dezelfde delen als het meegeleverde resourcediagram ⇒ die knop staat NIET mee aan (andere sortering).
  await own.click();
  v = await viewState(page);
  expect(v.group).toEqual([]);
  expect(v.showRelations).toBe(true);

  // Toepassen zonder opslaan: het beeld verandert, er komt geen knop bij en er gaat geen knop aan.
  await plus.click();
  for (const part of ['columns', 'filter', 'group', 'sort', 'timeScale']) {
    await dialog.locator(`[data-ops-layout-part="${part}"]`).uncheck();
  }
  await dialog.locator('[data-ops-layout-relations]').uncheck();
  await page.locator('[data-ops-layout-apply-only]').click();
  await expect(dialog).toHaveCount(0);
  expect((await viewState(page)).showRelations).toBe(false);
  await expect(page.locator('[data-ops-layout-button]')).toHaveCount(2);
  await expect(page.locator('[data-ops-layout-button] button.active')).toHaveCount(0);

  // Rechtsklik → dupliceren, daarna het origineel verwijderen.
  await own.click({ button: 'right' });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/04-rechtsklikmenu.png` });
  await page.getByRole('button', { name: /^(Duplicate|Dupliceren)$/ }).click();
  await expect(page.locator('[data-ops-layout-button]')).toHaveCount(3);
  await own.first().click({ button: 'right' });
  await page.getByRole('button', { name: /^(Delete|Verwijderen)$/ }).click();
  await page.getByRole('button', { name: /^(Delete|Verwijderen|OK|Confirm|Bevestigen)$/ }).last().click();
  await expect(page.locator('[data-ops-layout-button]')).toHaveCount(2);
});
