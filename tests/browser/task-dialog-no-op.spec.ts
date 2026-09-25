// "Taak bewerken" openen en zonder iets te wijzigen op OK drukken is geen bewerking: de uit MS Project
// geïmporteerde sturing (laag 3: `timephasedFinishFloor`/`timephasedStartAnchor`) blijft staan, er
// komt geen melding, geen undo-stap en het document blijft ongewijzigd. Vóór de fix stuurde het
// venster altijd het volledige `time`-object mee en besliste de app op sleutel-aanwezigheid; zie
// `taskTriggerChanges` in src/utils/taskDefaults.ts en tests/planning/check-value-based-triggers.ts.
//
// De brug zet alleen de fixture (MSP-sturing, schoon document) en leest de state; openen en OK
// drukken gaan via echte muisklikken (rechtsklik op de taakrij → "Bewerken..." → OK).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const FLOOR = '2026-09-11T17:00';
const ANCHOR = '2026-09-07T08:00';

async function seedSteeredTask(page: Page): Promise<string> {
  return page.evaluate(({ floor, anchor }) => {
    const ops = window.__OPS__!;
    const s = ops.store.getState();
    s.setProject({ name: 'MSP-import', startDate: '2026-09-07' });
    s.setViewStartDate('2026-09-07');
    const id = s.addTask({ name: 'Metselwerk' });
    ops.store.getState().runCPM();
    // Zoals de .mpp-lezer het aanlevert: een gelezen Z8-venster op een verder gewone taak. Daarna
    // een schoon document, zodat "gewijzigd" en "melding" alleen van de dialoog kunnen komen.
    ops.store.setState((state) => {
      const task = state.tasks.find(candidate => candidate.id === id)!;
      task.timephasedFinishFloor = floor;
      task.timephasedStartAnchor = anchor;
      state.isDirty = false;
      state.ui.notifications = [];
    });
    return id;
  }, { floor: FLOOR, anchor: ANCHOR });
}

async function snapshot(page: Page, taskId: string) {
  return page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks.find(candidate => candidate.id === id)!;
    return {
      floor: task.timephasedFinishFloor ?? null,
      anchor: task.timephasedStartAnchor ?? null,
      name: task.name,
      isDirty: s.isDirty,
      notifications: s.ui.notifications.map(notification => notification.messageKey),
      undoDepth: s.historyEvents.filter(event => event.state === 'applied').length,
    };
  }, taskId);
}

async function openTaskDialogFromRow(page: Page, taskId: string): Promise<void> {
  const nameCell = page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key="${taskId}"][data-grid-column-id="task.name"]`,
  );
  await nameCell.click({ button: 'right' });
  await page.getByRole('button', { name: /^(Edit|Bewerken)\.\.\.$/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('Taak bewerken → OK zonder wijziging laat MSP-sturing, meldingen en documentstatus ongemoeid', async ({ page, ops: _ops }) => {
  const taskId = await seedSteeredTask(page);
  const before = await snapshot(page, taskId);
  expect(before).toMatchObject({ floor: FLOOR, anchor: ANCHOR, isDirty: false, notifications: [] });

  await openTaskDialogFromRow(page, taskId);
  await page.getByRole('dialog').locator('[data-ops-task-save]').click();
  await expect(page.getByRole('dialog')).toBeHidden();

  // De dialoog is dicht, dus `handleSave` heeft zijn `updateTask` al gedaan; de state is ongemoeid.
  expect(await snapshot(page, taskId)).toEqual(before);
});

test('Taak bewerken → een echte naamswijziging is één undo-stap maar laat de MSP-sturing staan', async ({ page, ops: _ops }) => {
  const taskId = await seedSteeredTask(page);
  const before = await snapshot(page, taskId);

  await openTaskDialogFromRow(page, taskId);
  const dialog = page.getByRole('dialog');
  const nameInput = dialog.getByRole('textbox').first();
  await expect(nameInput).toHaveValue('Metselwerk');
  await nameInput.fill('Metselwerk begane grond');
  await dialog.locator('[data-ops-task-save]').click();
  await expect(dialog).toBeHidden();

  await expect.poll(() => snapshot(page, taskId)).toEqual({
    ...before,
    name: 'Metselwerk begane grond',
    isDirty: true,
    undoDepth: before.undoDepth + 1,
  });
});
