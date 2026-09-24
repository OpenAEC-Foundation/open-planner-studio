import type { Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

// Taaktypes-etappe (spec 2026-09-04 §7, bouwstap 5): de werkregel en het resterende werk bewerken
// via het eigenschappenpaneel. Fixture via de brug (taak + resource + toewijzing, instelling
// "Toon taaktypes" aan); de geteste handelingen zijn echte keuzelijst- en invoerbewerkingen.
// Asserties op de store (werkregel, werkveld, duur, undo) — geen canvaspixels.

async function seedAssignedTask(page: Page): Promise<{ taskId: string; resourceId: string }> {
  const [taskId] = await seedProject(page, [
    { name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-10', durationDays: 4 },
  ]);
  return page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const resourceId = s.addResource({ name: 'Metselploeg', type: 'LABOR', description: '', maxUnits: 2 });
    s.assignResource(id, resourceId, 1);
    s.runCPM();
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false, showTaskTypes: true });
    s.selectTask(id);
    return { taskId: id, resourceId };
  }, taskId);
}

function taskState(page: Page, taskId: string): Promise<{ workRule?: string; duration: number; units: number; work?: number; stale: boolean }> {
  return page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const t = s.tasks.find(x => x.id === id)!;
    const a = s.assignments.find(x => x.taskId === id)!;
    return { workRule: t.workRule, duration: t.time.scheduleDuration, units: a.unitsPerDay, work: a.remainingWorkMinutes, stale: s.scheduleStale };
  }, taskId);
}

test('werkregel kiezen, werk typen en inzet wijzigen volgen de regel; undo in één stap', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);

  const select = page.locator('[data-ops-work-rule]');
  await expect(select).toBeVisible();
  // Standaard: projectstandaard (vaste duur en inzet) — de inzetkolom draagt het slotje.
  await expect(page.locator('[data-ops-assignment-lock-units]')).toHaveAttribute('data-ops-assignment-lock-units', 'locked');
  await expect(page.locator('[data-ops-assignment-work]')).toHaveAttribute('data-ops-assignment-work', 'derived');

  // Vast werk kiezen: geen getal verandert, het restwerk (4 d × 8 u = 32 u) wordt vastgelegd.
  await select.selectOption('FIXED_WORK');
  let st = await taskState(page, taskId);
  expect(st.workRule).toBe('FIXED_WORK');
  expect(st.duration).toBe(4);
  expect(st.work).toBe(4 * 8 * 60);
  await expect(page.locator('[data-ops-work-rule-protects]')).toHaveAttribute('data-ops-work-rule-protects', 'FIXED_WORK');
  await expect(page.locator('[data-ops-assignment-lock-work]')).toHaveAttribute('data-ops-assignment-lock-work', 'locked');
  await expect(page.locator('[data-ops-assignment-work]')).toHaveAttribute('data-ops-assignment-work', 'stored');

  // Werk 32 → 64 uur TYPEN (toets voor toets, review K5: pas op Enter committen — "6" onderweg mag
  // geen eigen driehoekstap zijn): onder vast werk wordt de taak twee keer zo lang (8 d), inzet blijft 1.
  const workInput = page.locator('[data-ops-assignment-work] input');
  await expect(workInput).toHaveValue('32');
  await workInput.click();
  await workInput.press('Control+a');
  await workInput.pressSequentially('64');
  st = await taskState(page, taskId);
  expect(st.duration).toBe(4);
  await workInput.press('Enter');
  st = await taskState(page, taskId);
  expect(st.duration).toBe(8);
  expect(st.units).toBe(1);
  expect(st.work).toBe(64 * 60);
  expect(st.stale).toBe(true);

  // Inzet 1 → 2 via de inzetkolom: 64 u ÷ 2 = 4 d.
  const row = page.locator('[data-ops-assignment-row]').first();
  const unitsInput = row.locator('input').first();
  await unitsInput.fill('2');
  await unitsInput.press('Enter');
  st = await taskState(page, taskId);
  expect(st.duration).toBe(4);
  expect(st.units).toBe(2);

  // Undo in één stap: terug naar 8 d en inzet 1.
  await page.keyboard.press('Control+z');
  st = await taskState(page, taskId);
  expect(st.duration).toBe(8);
  expect(st.units).toBe(1);

  // Terug naar de projectstandaard: het veld verdwijnt, het werk blijft staan (besluit 2).
  await select.selectOption('');
  st = await taskState(page, taskId);
  expect(st.workRule).toBeUndefined();
  expect(st.work).toBe(64 * 60);
});

test('taakdialoog: werkregel kiezen commit direct, werk typen in dezelfde dialoog rekent met die regel, Opslaan draait de duur niet terug', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);
  await page.evaluate((id) => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), taskId);
  const dialog = page.locator('[role="dialog"]').last();
  await expect(dialog).toBeVisible();
  const select = dialog.locator('[data-ops-work-rule]');
  await select.selectOption('FIXED_WORK');
  let st = await taskState(page, taskId);
  expect(st.workRule).toBe('FIXED_WORK');
  const workInput = dialog.locator('[data-ops-assignment-work] input');
  await workInput.fill('64');
  await workInput.press('Enter');
  st = await taskState(page, taskId);
  expect(st.duration).toBe(8);
  // Opslaan: de duur die de driehoek zette blijft 8 (review B4).
  await dialog.getByRole('button', { name: /opslaan|save/i }).click();
  st = await taskState(page, taskId);
  expect(st.duration).toBe(8);
  expect(st.workRule).toBe('FIXED_WORK');
});

test('instelling uit en document zonder taaktypes: geen werkregel-UI; een gezette regel ontsluit het document', async ({ page, ops: _ops }) => {
  const { taskId } = await seedAssignedTask(page);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showTaskTypes: false }));
  await expect(page.locator('[data-ops-work-rule]')).toHaveCount(0);
  await expect(page.locator('[data-ops-assignment-header]')).toHaveCount(0);
  // Documentontsluiting: een regel via de store zet `taskTypesVisible` ⇒ de UI verschijnt.
  await page.evaluate((id) => window.__OPS__!.store.getState().setTaskWorkRule(id, 'FIXED_RATE'), taskId);
  await expect(page.locator('[data-ops-work-rule]')).toBeVisible();
  await expect(page.locator('[data-ops-work-rule]')).toHaveValue('FIXED_RATE');
});
