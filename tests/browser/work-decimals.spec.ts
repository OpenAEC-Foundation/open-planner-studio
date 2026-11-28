import type { Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';
import { chooseLocale, LOCALE_CASES } from './fixtures/locale';

const UNITS = 1.71428571428571;
const WORK = 37028.57;
const ACTUAL = 1600;

async function seed(page: Page): Promise<string> {
  const [taskId] = await seedProject(page, [
    { name: 'Tekenwerk', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate(({ id, units, work, actual }) => {
    const ops = window.__OPS__!;
    const s = ops.store.getState();
    const resourceId = s.addResource({ name: 'Draughtman', type: 'LABOR', description: '', maxUnits: 2 });
    s.assignResource(id, resourceId, 1);
    s.runCPM();
    ops.store.setState(draft => {
      const a = draft.assignments.find(x => x.taskId === id)!;
      a.unitsPerDay = units;
      a.plannedWorkMinutes = work;
      a.actualWorkMinutes = actual;
      a.remainingWorkMinutes = work;
    });
    const g = ops.store.getState();
    const columns = g.taskGridSurfaces['full-task-grid'].columns;
    const wanted = ['assignment.unitsPerDay', 'assignment.plannedWork', 'assignment.actualWork', 'assignment.remainingWork'] as
      (typeof columns)[number]['id'][];
    g.commitTaskGridColumns('full-task-grid', 'Werkkolommen voor browsertest', [
      ...columns.filter(c => !wanted.includes(c.id)),
      ...wanted.map(w => ({ id: w, width: 200, pinned: false })),
    ]);
    g.setUI({ showTaskTypes: true });
  }, { id: taskId, units: UNITS, work: WORK, actual: ACTUAL });
  return taskId;
}

function storeState(page: Page, taskId: string) {
  return page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const a = s.assignments.find(x => x.taskId === id)!;
    return {
      units: a.unitsPerDay, planned: a.plannedWorkMinutes, actual: a.actualWorkMinutes, remaining: a.remainingWorkMinutes,
      history: s.historyEvents.length, stale: s.scheduleStale,
    };
  }, taskId);
}

const cell = (page: Page, taskId: string, column: string) => page.locator(
  `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"] `
  + `[data-grid-data-cell="true"][data-grid-column-id="${column}"]`,
);

for (const locale of LOCALE_CASES.filter(l => l.code === 'nl' || l.code === 'en')) {
  const dec = (text: string) => (locale.code === 'nl' ? text.replace('.', ',') : text);

  test(`werk en inzet in de notatie van de taal; bevestigen zonder wijziging schrijft niets (${locale.code})`, async ({ page, ops: _ops }) => {
    const taskId = await seed(page);
    if (locale.code !== 'en') await chooseLocale(page, locale);
    const initial = await storeState(page, taskId);
    expect(initial).toMatchObject({ units: UNITS, planned: WORK, actual: ACTUAL, remaining: WORK });

    await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
    await expect(cell(page, taskId, 'assignment.unitsPerDay')).toHaveText(`Draughtman: ${dec('1.71')}`);
    await expect(cell(page, taskId, 'assignment.plannedWork')).toHaveText(`Draughtman: ${dec('617.14')}`);
    await expect(cell(page, taskId, 'assignment.actualWork')).toHaveText(`Draughtman: ${dec('26.67')}`);
    await expect(cell(page, taskId, 'assignment.remainingWork')).toHaveText(`Draughtman: ${dec('617.14')}`);

    for (const [column, kind, shown] of [
      ['assignment.unitsPerDay', 'units', dec('1.71')],
      ['assignment.remainingWork', 'work', dec('617.14')],
    ] as const) {
      await cell(page, taskId, column).click();
      await page.keyboard.press('Enter');
      const input = page.locator(`[data-task-editor-kind="assignment-tokens"] input[data-assignment-number="${kind}"]`);
      await expect(input).toHaveValue(shown);
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-task-editor-kind="assignment-tokens"]')).toHaveCount(0);
      expect(await storeState(page, taskId)).toEqual(initial);
    }

    await cell(page, taskId, 'assignment.unitsPerDay').click();
    await page.keyboard.press('Enter');
    const unitsCellInput = page.locator('[data-task-editor-kind="assignment-tokens"] input[data-assignment-number="units"]');
    await unitsCellInput.press('Control+a');
    await unitsCellInput.pressSequentially(dec('2.5'));
    await page.keyboard.press('Enter');
    await expect.poll(() => storeState(page, taskId).then(s => s.units)).toBe(2.5);
    expect((await storeState(page, taskId)).history).toBe(initial.history + 1);
    await expect(cell(page, taskId, 'assignment.unitsPerDay')).toHaveText(`Draughtman: ${dec('2.5')}`);
  });
}
