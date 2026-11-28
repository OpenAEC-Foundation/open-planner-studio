import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const H = 60;
const BAND = [{ start: 480, end: 960 }];

interface SeedTask { name: string; hours: number; workHours?: number; workRule?: 'FIXED_WORK' | 'FIXED_DURATION_RATE' }

async function seed(page: Page, tasks: SeedTask[]): Promise<string[]> {
  return page.evaluate(({ inputs, band }) => {
    const ops = window.__OPS__!;
    const s = ops.store.getState();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false, showTaskTypes: true });
    s.setProject({ name: 'DCP-03 nagebootst', startDate: '2026-09-07' });
    s.setViewStartDate('2026-09-07');
    s.setCalendar({
      ...s.calendar, workDays: [1, 2, 3, 4, 5], hoursPerDay: 8, workStartHour: 8, workEndHour: 16,
      workTime: { byWeekday: { 1: band, 2: band, 3: band, 4: band, 5: band, 6: [], 7: [] } },
    });
    const resourceId = ops.store.getState().addResource({ name: 'Design Engineer', type: 'LABOR', description: '', maxUnits: 1 });
    const ids = inputs.map((input) => {
      const id = ops.store.getState().addTask({ name: input.name });
      const current = ops.store.getState().tasks.find(t => t.id === id)!;
      ops.store.getState().updateTask(id, {
        time: {
          ...current.time, durationUnit: 'hours', durationMinutes: input.hours * 60, scheduleDuration: input.hours / 8,
          scheduleStart: '2026-09-07', earlyStart: '2026-09-07T08:00',
        },
      });
      if (input.workHours !== undefined) ops.store.getState().assignResource(id, resourceId, 1);
      ops.store.setState((st) => {
        st.tasks.find(t => t.id === id)!.time.remainingMinutes = input.hours * 60;
        if (input.workRule) st.tasks.find(t => t.id === id)!.workRule = input.workRule;
        const a = st.assignments.find(x => x.taskId === id);
        if (a && input.workHours !== undefined) a.remainingWorkMinutes = input.workHours * 60;
      });
      return id;
    });
    ops.store.getState().runCPM();
    ops.store.setState((st) => { st.ui.notifications = []; });
    return ids;
  }, { inputs: tasks, band: BAND });
}

function workOf(page: Page, taskId: string): Promise<{ duration?: number; rest?: number; work?: number }> {
  return page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const t = s.tasks.find(x => x.id === id)!;
    const a = s.assignments.find(x => x.taskId === id);
    return { duration: t.time.durationMinutes, rest: t.time.remainingMinutes, work: a?.remainingWorkMinutes };
  }, taskId);
}

const ONE = /(Remaining work of ‘Mobilise Design Team’ recalculated: 320h → 72h \(the value came from the file\)\. Ctrl\+Z restores it\.|Restwerk van ‘Mobilise Design Team’ opnieuw uitgerekend: 320u → 72u \(de waarde kwam uit het bestand\)\. Ctrl\+Z zet het terug\.)/;
const MANY = /(Remaining work of 2 tasks recalculated|Restwerk van 2 taken opnieuw uitgerekend)/;

test('paneel: duur 80 → 72 h ⇒ restwerk 72 h, één melding; Ctrl+Z zet 320 h en het waarschuwingsteken terug', async ({ page, ops: _ops }) => {
  const [taskId] = await seed(page, [{ name: 'Mobilise Design Team', hours: 80, workHours: 320 }]);
  await page.evaluate((id) => window.__OPS__!.store.getState().selectTask(id), taskId);

  const warning = page.locator('[data-ops-assignment-work-deviates]');
  await expect(warning).toHaveAttribute('data-ops-assignment-work-deviates', '320/80');

  const duration = page.locator('[data-ops-task-duration] [data-ops-duration-value]').first();
  await expect(duration).toHaveValue('80');
  await duration.click();
  await duration.press('ControlOrMeta+a');
  await duration.pressSequentially('72');
  for (const key of ['Control+p', 'F1']) {
    await page.keyboard.press(key);
    await expect(duration).toBeFocused();
    await expect(duration).toHaveValue('72');
    await expect.poll(() => workOf(page, taskId)).toEqual({ duration: 80 * H, rest: 80 * H, work: 320 * H });
    expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.activeRibbonTab)).toBe('start');
  }
  await duration.press('Enter');

  await expect.poll(() => workOf(page, taskId)).toEqual({ duration: 72 * H, rest: 72 * H, work: 72 * H });
  await expect(page.locator('.ops-toast', { hasText: ONE })).toHaveCount(1);
  await expect(warning).toHaveCount(0);

  await expect(duration).not.toBeFocused();
  await page.keyboard.press('Control+z');
  await expect.poll(() => workOf(page, taskId)).toEqual({ duration: 80 * H, rest: 80 * H, work: 320 * H });
  await expect(warning).toHaveAttribute('data-ops-assignment-work-deviates', '320/80');
});

test('tabel: één waarde plakken in twee rijen ⇒ beide herrekend, één melding met het aantal; Ctrl+Z zet beide terug', async ({ page, ops: _ops }) => {
  const [sourceId, firstId, secondId] = await seed(page, [
    { name: 'Bron 72 h', hours: 72 },
    { name: 'Mobilise Design Team', hours: 80, workHours: 320 },
    { name: 'Concept Design', hours: 40, workHours: 160 },
  ]);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const cell = (id: string) => page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${id}"] [data-grid-data-cell="true"][data-grid-column-id="task.time.scheduleDuration"]`,
  );
  await expect(cell(sourceId)).toBeVisible();

  await cell(sourceId).click();
  await expect(cell(sourceId)).toBeFocused();
  await page.keyboard.press('Control+c');

  await cell(firstId).click();
  await expect(cell(firstId)).toBeFocused();
  await cell(secondId).click({ modifiers: ['Shift'] });
  await page.keyboard.press('Control+v');

  await expect.poll(() => workOf(page, firstId)).toEqual({ duration: 72 * H, rest: 72 * H, work: 72 * H });
  await expect.poll(() => workOf(page, secondId)).toEqual({ duration: 72 * H, rest: 72 * H, work: 72 * H });
  await expect(page.locator('.ops-toast', { hasText: MANY })).toHaveCount(1);
  await expect(page.locator('.ops-toast', { hasText: ONE })).toHaveCount(0);

  await page.keyboard.press('Control+z');
  await expect.poll(() => workOf(page, firstId)).toEqual({ duration: 80 * H, rest: 80 * H, work: 320 * H });
  await expect.poll(() => workOf(page, secondId)).toEqual({ duration: 40 * H, rest: 40 * H, work: 160 * H });
});

const exactly = (texts: string[]) => new RegExp(`^(${texts.map(text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`);
const HINT_NL = 'Opgeslagen werk 320u wijkt af van inzet × resterende duur (80u). Het histogram volgt het opgeslagen werk over de hele taakduur.';
const HINT_EN = 'Stored work 320h differs from units × remaining duration (80h). The histogram follows the stored work across the whole task duration.';
const HINT_320_80 = exactly([
  `${HINT_NL} De app verandert dit niet vanzelf. Wijzig je de duur, dan vervangt de app dit werk door inzet × nieuwe duur. Je krijgt dan een melding; Ctrl+Z zet het terug.`,
  `${HINT_EN} The app does not change this by itself. If you change the duration, the app replaces this work with units × new duration. You then get a notice; Ctrl+Z undoes it.`,
]);
const HINT_320_80_KEEPS = exactly([
  `${HINT_NL} De app verandert dit niet vanzelf. Wijzig je de duur, dan blijft dit werk staan en past de app de inzet aan.`,
  `${HINT_EN} The app does not change this by itself. If you change the duration, this work stays and the app adjusts the units.`,
]);

test('tabel: ⚠ in Resterend werk bij afwijkend restwerk, met de uitleg van het paneel; weg na een duurwijziging, terug na Ctrl+Z', async ({ page, ops: _ops }) => {
  const [deviatingId, okId] = await seed(page, [
    { name: 'Mobilise Design Team', hours: 80, workHours: 320 },
    { name: 'Klopt al', hours: 40, workHours: 40 },
  ]);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const columns = s.taskGridSurfaces['full-task-grid'].columns;
    s.setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'assignment.remainingWork', width: 200, pinned: false } as unknown as (typeof columns)[number],
    ]);
  });
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const cell = (id: string, column: string) => page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-row-key="${id}"][data-grid-column-id="${column}"]`,
  );
  const warning = (id: string) => cell(id, 'assignment.remainingWork').locator('[data-ops-remaining-work-deviates]');

  await expect(cell(deviatingId, 'assignment.remainingWork')).toContainText('Design Engineer: 320');
  await expect(warning(deviatingId)).toHaveCount(1);
  await expect(warning(deviatingId)).toHaveAttribute('title', HINT_320_80);
  await expect(warning(deviatingId)).toHaveAttribute('aria-label', HINT_320_80);
  await expect(warning(okId)).toHaveCount(0);
  await warning(deviatingId).hover();
  await expect(page.locator('.ops-tooltip[role="tooltip"]')).toHaveText(HINT_320_80);
  await page.mouse.move(5, 5);
  await expect(page.locator('.ops-tooltip[role="tooltip"]')).toHaveCount(0);

  await page.evaluate((id) => window.__OPS__!.store.getState().selectTask(id), deviatingId);
  const panelWarning = page.locator('[data-ops-assignment-work-deviates]');
  await expect(panelWarning).toHaveCount(1);
  expect(await panelWarning.getAttribute('title')).toBe(await warning(deviatingId).getAttribute('title'));

  const duration = cell(deviatingId, 'task.time.scheduleDuration');
  await duration.click();
  await page.keyboard.press('Enter');
  await duration.locator('input').fill('72h');
  await page.keyboard.press('Enter');
  await expect.poll(() => workOf(page, deviatingId)).toEqual({ duration: 72 * H, rest: 72 * H, work: 72 * H });
  await expect(cell(deviatingId, 'assignment.remainingWork')).toContainText('Design Engineer: 72');
  await expect(warning(deviatingId)).toHaveCount(0);

  await page.keyboard.press('Control+z');
  await expect.poll(() => workOf(page, deviatingId)).toEqual({ duration: 80 * H, rest: 80 * H, work: 320 * H });
  await expect(warning(deviatingId)).toHaveCount(1);
  await expect(warning(deviatingId)).toHaveAttribute('title', HINT_320_80);
});

test('tabel: ⚠-uitleg bij Vast werk zegt dat het werk blijft; een duurwijziging laat het werk staan, zonder melding', async ({ page, ops: _ops }) => {
  const [taskId] = await seed(page, [{ name: 'Vast werk', hours: 80, workHours: 320, workRule: 'FIXED_WORK' }]);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const columns = s.taskGridSurfaces['full-task-grid'].columns;
    s.setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'assignment.remainingWork', width: 200, pinned: false } as unknown as (typeof columns)[number],
    ]);
  });
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const cell = (column: string) => page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-row-key="${taskId}"][data-grid-column-id="${column}"]`,
  );
  const warning = cell('assignment.remainingWork').locator('[data-ops-remaining-work-deviates]');
  await expect(warning).toHaveAttribute('title', HINT_320_80_KEEPS);
  await warning.hover();
  await expect(page.locator('.ops-tooltip[role="tooltip"]')).toHaveText(HINT_320_80_KEEPS);
  await page.mouse.move(5, 5);

  await page.evaluate((id) => window.__OPS__!.store.getState().selectTask(id), taskId);
  await expect(page.locator('[data-ops-assignment-work-deviates]')).toHaveAttribute('title', HINT_320_80_KEEPS);

  const duration = cell('task.time.scheduleDuration');
  await duration.click();
  await page.keyboard.press('Enter');
  await duration.locator('input').fill('72h');
  await page.keyboard.press('Enter');
  await expect.poll(() => workOf(page, taskId)).toEqual({ duration: 72 * H, rest: 72 * H, work: 320 * H });
  await expect(page.locator('.ops-toast', { hasText: /(Remaining work of|Restwerk van)/ })).toHaveCount(0);
});
