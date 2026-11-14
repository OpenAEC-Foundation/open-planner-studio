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
const row = (page: Page, surface: Surface, id: string): Locator =>
  page.locator(`[data-task-grid-surface-id="${surface}"] [data-grid-data-row="true"][data-grid-row-key="${id}"]`);
const nameCell = (page: Page, surface: Surface, id: string): Locator =>
  row(page, surface, id).locator('[data-grid-data-cell="true"][data-grid-column-id="task.name"]');

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
  for (let i = 0; i < 40 && !(await isInGrid(page, surface, id)); i++) await page.mouse.wheel(0, 100);
  expect(await isInGrid(page, surface, id)).toBe(true);
}

async function isInGrid(page: Page, surface: Surface, id: string): Promise<boolean> {
  if (await row(page, surface, id).count() === 0) return false;
  const [g, r] = await Promise.all([grid(page, surface).boundingBox(), row(page, surface, id).boundingBox()]);
  return !!g && !!r && r.y >= g.y && r.y + r.height <= g.y + g.height;
}

const selection = (page: Page) => page.evaluate(() => {
  const s = window.__OPS__!.store.getState();
  return { selected: s.selectedTaskIds, active: s.activeTaskId, scrollY: s.view.scrollY };
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

test('lange planning: inklappen en verwijderen houden de selectie op haar plek (issue #899)', async ({ page, ops: _ops }) => {
  test.setTimeout(60_000); // twee rasters, elk met scrollen en inklappen
  const { phases, children } = await seedLongPlan(page);

  // Takenlijst naast de Gantt.
  await collapseParentKeepsPlace(page, 'gantt-task-grid', phases[2], children[2][2]);

  // Verwijderen via rechtsklik › Verwijderen: de taak eronder neemt de selectie over, in beeld.
  const doomed = children[3][4];
  const below = children[3][5];
  await scrollUntilVisible(page, 'gantt-task-grid', doomed);
  await nameCell(page, 'gantt-task-grid', doomed).click();
  await nameCell(page, 'gantt-task-grid', doomed).click({ button: 'right' });
  // Het menu-item, niet de lintknop met dezelfde naam.
  await page.getByRole('button', { name: /^(Delete|Verwijderen)$/ })
    .and(page.locator(':not([data-ops-ribbon-item])')).click();
  await expect(row(page, 'gantt-task-grid', doomed)).toHaveCount(0);
  await expect.poll(() => selection(page)).toMatchObject({ selected: [below], active: below });
  await expect(row(page, 'gantt-task-grid', below).locator('[data-grid-active="true"]')).toHaveCount(1);
  expect(await isInGrid(page, 'gantt-task-grid', below)).toBe(true);
  expect((await selection(page)).scrollY).toBeGreaterThan(0);

  // Tabel: dezelfde rasterkern, dezelfde afspraak.
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(grid(page, 'full-task-grid')).toBeVisible();
  await collapseParentKeepsPlace(page, 'full-task-grid', phases[3], children[3][2]);
});
