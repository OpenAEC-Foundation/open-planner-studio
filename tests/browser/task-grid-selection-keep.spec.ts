// Issue #899 — in een lange planning blijft de planner bij zijn taak als hij inklapt of verwijdert.
// Voorheen sprong de celcursor (en daarmee de scroll) naar de bovenste rij. Nu:
//  - de ouder van de geselecteerde taak inklappen ⇒ de ouder is geselecteerd en blijft in beeld;
//  - de geselecteerde taak verwijderen (rechtsklik › Verwijderen) ⇒ de taak eronder, in beeld.
// Dat geldt voor de takenlijst naast de Gantt en voor de Tabel (zelfde rasterkern).
// Echte klikken, wiel en contextmenu; de brug zet alleen de fixture en leest state.
import type { Locator, Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

type Surface = 'gantt-task-grid' | 'full-task-grid';

const grid = (page: Page, surface: Surface): Locator =>
  page.locator(`[data-task-grid-surface-id="${surface}"] [role="grid"]`);
// In een groepering is de rijsleutel JSON; JSON.stringify citeert hem als geldige CSS-string.
const row = (page: Page, surface: Surface, rowKey: string): Locator =>
  page.locator(`[data-task-grid-surface-id="${surface}"] [data-grid-data-row="true"][data-grid-row-key=${JSON.stringify(rowKey)}]`);
const nameCell = (page: Page, surface: Surface, rowKey: string): Locator =>
  row(page, surface, rowKey).locator('[data-grid-data-cell="true"][data-grid-column-id="task.name"]');

/** Vier fases met elk tien taken: ruim langer dan het raster hoog is. */
async function seedLongPlan(page: Page): Promise<{ phases: string[]; children: string[][] }> {
  await page.setViewportSize({ width: 1400, height: 640 });
  await seedProject(page, [{ name: 'Start', start: '2026-09-07', finish: '2026-09-11', durationDays: 5 }]);
  return page.evaluate(() => {
    const store = window.__OPS__!.store;
    const phases: string[] = [];
    const children: string[][] = [];
    for (let p = 1; p <= 4; p++) {
      const phase = store.getState().addTask({ name: `Fase ${p}` });
      phases.push(phase);
      const kids: string[] = [];
      for (let c = 1; c <= 10; c++) kids.push(store.getState().addTask({ name: `Taak ${p}.${c}`, parentId: phase }));
      children.push(kids);
    }
    store.getState().runCPM();
    return { phases, children };
  });
}

async function scrollUntilVisible(page: Page, surface: Surface, id: string): Promise<void> {
  const box = await grid(page, surface).boundingBox();
  await page.mouse.move(box!.x + 80, box!.y + box!.height / 2);
  // Eerst omlaag; staat de rij erboven (na een groepering), dan omhoog.
  for (let i = 0; i < 40 && !(await isInGrid(page, surface, id)); i++) await page.mouse.wheel(0, 100);
  for (let i = 0; i < 80 && !(await isInGrid(page, surface, id)); i++) await page.mouse.wheel(0, -100);
  expect(await isInGrid(page, surface, id)).toBe(true);
}

async function isInGrid(page: Page, surface: Surface, id: string): Promise<boolean> {
  if (await row(page, surface, id).count() === 0) return false;
  const [g, r] = await Promise.all([grid(page, surface).boundingBox(), row(page, surface, id).boundingBox()]);
  return !!g && !!r && r.y >= g.y && r.y + r.height <= g.y + g.height;
}

const selection = (page: Page) => page.evaluate(() => {
  const s = window.__OPS__!.store.getState();
  return { selected: s.selectedTaskIds, active: s.activeTaskId, scrollY: s.view.scrollY, rowKey: s.ui.gridActiveRowKey };
});

async function collapseParentKeepsPlace(page: Page, surface: Surface, phase: string, child: string): Promise<void> {
  // Fase en taak samen in beeld, met de bovenste fases al weggescrold.
  await scrollUntilVisible(page, surface, child);
  expect(await isInGrid(page, surface, phase)).toBe(true);
  await nameCell(page, surface, child).click();
  await expect.poll(() => selection(page).then(s => s.active)).toBe(child);

  await nameCell(page, surface, phase).locator('.full-task-grid-disclosure').click();
  await expect(row(page, surface, child)).toHaveCount(0);
  // De ingeklapte fase is geselecteerd, draagt de celcursor en staat nog in beeld (niet bovenaan).
  await expect.poll(() => selection(page)).toMatchObject({ selected: [phase], active: phase });
  await expect(row(page, surface, phase).locator('[data-grid-active="true"]')).toHaveCount(1);
  expect(await isInGrid(page, surface, phase)).toBe(true);
  expect((await selection(page)).scrollY).toBeGreaterThan(0);

  await nameCell(page, surface, phase).locator('.full-task-grid-disclosure').click();
  await expect(row(page, surface, child)).toHaveCount(1);
  await expect.poll(() => selection(page).then(s => s.active)).toBe(phase);
}

/**
 * Rechtsklik › Verwijderen: de taak eronder neemt de selectie over en staat in beeld. Ids zijn
 * rijsleutels; buiten een groepering is dat het taak-id. Verandert de sleutel van de buur door het
 * verwijderen (groeperen op WBS), geef dan een functie die de nieuwe sleutel leest.
 */
async function deleteKeepsPlace(
  page: Page, surface: Surface, doomed: string, belowKey: string | (() => Promise<string>),
  taskOf: (rowKey: string) => string = rowKey => rowKey,
): Promise<void> {
  await scrollUntilVisible(page, surface, doomed);
  await nameCell(page, surface, doomed).click();
  // Het raster meldt zijn rij aan de store: in een groepering is dat het vertrekpunt.
  await expect.poll(() => selection(page).then(s => s.rowKey)).toBe(doomed);
  await nameCell(page, surface, doomed).click({ button: 'right' });
  // Het menu-item, niet de lintknop met dezelfde naam.
  await page.getByRole('button', { name: /^(Delete|Verwijderen)$/ })
    .and(page.locator(':not([data-ops-ribbon-item])')).click();
  await expect(row(page, surface, doomed)).toHaveCount(0);
  const below = typeof belowKey === 'string' ? belowKey : await belowKey();
  await expect.poll(() => selection(page))
    .toMatchObject({ selected: [taskOf(below)], active: taskOf(below), rowKey: below });
  await expect(row(page, surface, below).locator('[data-grid-active="true"]')).toHaveCount(1);
  expect(await isInGrid(page, surface, below)).toBe(true);
  expect((await selection(page)).scrollY).toBeGreaterThan(0);
}

/**
 * Groepering op resource: A en C staan allebei onder R1 tot en met R4. A onder R3 verwijderen ⇒ de
 * cursor op C onder R3. Niet op het eerste voorkomen van C (R1), en ook niet op C onder R4: daar
 * schuift de oude cursorplek heen als A uit alle vier de groepen verdwijnt. Review #947.
 */
async function deleteInGroupStaysInGroup(page: Page, surface: Surface, a: string, c: string): Promise<void> {
  const keys = await page.evaluate(({ a, c }) => {
    const store = window.__OPS__!.store;
    for (const name of ['R1', 'R2', 'R3', 'R4']) {
      const r = store.getState().addResource({ name, type: 'LABOR', description: '', maxUnits: 1 });
      for (const id of [a, c]) store.getState().assignResource(id, r, 1);
    }
    store.getState().setGroup([{ field: { src: 'resource' }, dir: 'asc' }]);
    const of = (id: string) => store.getState().viewRows
      .filter(row => row.kind === 'task' && row.task.id === id).map(row => row.rowKey);
    return { a: of(a), c: of(c) };
  }, { a, c });
  expect(keys.a).toHaveLength(4);
  expect(keys.c).toHaveLength(4);
  const taskOf = (rowKey: string) => (keys.c.includes(rowKey) ? c : a);
  await deleteKeepsPlace(page, surface, keys.a[2], keys.c[2], taskOf);
  await page.evaluate(() => window.__OPS__!.store.getState().setGroup([]));
}

/**
 * Groepering op WBS: verwijderen hernummert, dus de taak eronder krijgt een nieuwe groep en rijsleutel
 * (bijv. 2.7 → 2.6). Ze blijft de buur. Review #947.
 */
async function deleteInWbsGroupKeepsPlace(page: Page, surface: Surface, doomed: string, below: string): Promise<void> {
  const keyOf = (id: string) => page.evaluate(id => window.__OPS__!.store.getState().viewRows
    .find(row => row.kind === 'task' && row.task.id === id)!.rowKey, id);
  await page.evaluate(() => window.__OPS__!.store.getState()
    .setGroup([{ field: { src: 'builtin', key: 'wbsCode' }, dir: 'asc' }]));
  const before = await keyOf(below);
  await deleteKeepsPlace(page, surface, await keyOf(doomed), () => keyOf(below), () => below);
  expect(await keyOf(below)).not.toBe(before);
  await page.evaluate(() => window.__OPS__!.store.getState().setGroup([]));
}

/**
 * Groepering Resource → WBS, met onder de eerste resource de band van z ingeklapt. y onder de tweede
 * resource verwijderen hernummert z, en z verschijnt weer onder de eerste. De cursor blijft in de groep
 * waarin de planner werkte: z onder de tweede resource. Review #947.
 */
async function deleteInNestedGroupStaysInGroup(page: Page, surface: Surface, x: string, y: string, z: string): Promise<void> {
  const setup = await page.evaluate(({ x, y, z, surface }) => {
    const store = window.__OPS__!.store;
    for (const name of [`${surface}-P1`, `${surface}-P2`]) {
      const r = store.getState().addResource({ name, type: 'LABOR', description: '', maxUnits: 1 });
      for (const id of [x, y, z]) store.getState().assignResource(id, r, 1);
    }
    store.getState().setGroup([
      { field: { src: 'resource' }, dir: 'asc' }, { field: { src: 'builtin', key: 'wbsCode' }, dir: 'asc' },
    ]);
    const rows = () => store.getState().viewRows;
    const keysOf = (id: string) => rows().filter(row => row.kind === 'task' && row.task.id === id).map(row => row.rowKey);
    const band = rows()[rows().findIndex(row => row.kind === 'task' && row.task.id === z) - 1];
    const bandKey = band.kind === 'group' ? band.key : '';
    store.getState().setCollapsedGroupKey(bandKey, true);
    return { y: keysOf(y), z: keysOf(z), bandKey };
  }, { x, y, z, surface });
  expect(setup.y).toHaveLength(2);
  expect(setup.z).toHaveLength(1);
  const group = (rowKey: string) => (JSON.parse(rowKey) as { groupPath: string[] }).groupPath[0];
  const belowNow = () => page.evaluate(z => window.__OPS__!.store.getState().viewRows
    .filter(row => row.kind === 'task' && row.task.id === z).map(row => row.rowKey), z);
  await deleteKeepsPlace(page, surface, setup.y[1], async () => {
    const keys = await belowNow();
    expect(keys).toHaveLength(2);
    return keys.find(key => group(key) === group(setup.y[1]))!;
  }, () => z);
  await page.evaluate(bandKey => {
    const s = window.__OPS__!.store.getState();
    s.setCollapsedGroupKey(bandKey, false);
    s.setGroup([]);
  }, setup.bandKey);
}

test('lange planning: inklappen en verwijderen houden de selectie op haar plek (issue #899)', async ({ page, ops: _ops }) => {
  test.setTimeout(60_000); // twee rasters, elk met scrollen, inklappen en verwijderen
  const { phases, children } = await seedLongPlan(page);

  // Takenlijst naast de Gantt.
  await collapseParentKeepsPlace(page, 'gantt-task-grid', phases[2], children[2][2]);
  await deleteKeepsPlace(page, 'gantt-task-grid', children[3][4], children[3][5]);
  await deleteInGroupStaysInGroup(page, 'gantt-task-grid', children[1][0], children[1][1]);
  await deleteInWbsGroupKeepsPlace(page, 'gantt-task-grid', children[2][5], children[2][6]);
  await deleteInNestedGroupStaysInGroup(page, 'gantt-task-grid', children[0][0], children[0][1], children[0][2]);

  // Tabel: dezelfde rasterkern, dezelfde afspraak.
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(grid(page, 'full-task-grid')).toBeVisible();
  await collapseParentKeepsPlace(page, 'full-task-grid', phases[3], children[3][2]);
  await deleteKeepsPlace(page, 'full-task-grid', children[3][7], children[3][8]);
  await deleteInGroupStaysInGroup(page, 'full-task-grid', children[1][3], children[1][4]);
  await deleteInWbsGroupKeepsPlace(page, 'full-task-grid', children[2][7], children[2][8]);
  await deleteInNestedGroupStaysInGroup(page, 'full-task-grid', children[0][4], children[0][5], children[0][6]);
});
