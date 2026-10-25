import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, seedProject, state, test } from './fixtures/ops';

test('document-plus kiest eerst nieuw of bestaand; annuleren verandert geen document', async ({ page, ops }) => {
  const before = await state(page);
  await page.locator('[data-ops-tabstrip] .ops-tabstrip-add').click();
  await expect(page.locator('[data-ops-new-or-open-project-dialog]')).toBeVisible();
  expect((await state(page)).documentIds).toEqual(before.documentIds);

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ops-new-or-open-project-dialog]')).toBeHidden();
  expect((await state(page)).documentIds).toEqual(before.documentIds);

  await page.locator('[data-ops-tabstrip] .ops-tabstrip-add').click();
  await page.locator('[data-ops-new-project-choice]').click();
  await expect(page.locator('[data-ops-project-dialog="new"]')).toBeVisible();
  expect((await state(page)).documentIds).toEqual(before.documentIds);
  await page.locator('[data-ops-project-cancel]').click();

  // Dezelfde route: een bestaand bestand openen mag bij weigering geen document veranderen.
  const planning = readFileSync(resolve('public/examples/10-villa-wassenaar.ifc'), 'utf8');
  const combined = planning.replace('DATA;', "DATA;\n#900001=IFCWALL('0YvctVUKr0kugbFTf53O9L',$,'Muur',$,$,$,$,$,.NOTDEFINED.);");
  ops.acceptError(/Failed to open file:.*building model objects/);
  const open = async (text: string, name = 'planning.ifc') => {
    const chooser = page.waitForEvent('filechooser');
    await page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ }).click();
    await (await chooser).setFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(text) });
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    await open(combined);
    const toast = page.locator('.ops-toast', { hasText: 'This IFC file contains building model objects.' });
    await expect(toast).toBeVisible();
    expect((await state(page)).documentIds).toEqual(before.documentIds);
    expect((await state(page)).tasks).toEqual(before.tasks);
    await toast.locator('[data-ops-toast-close]').click();
  }
  // Ook een ongeldige MPP-container laat bestaand werk intact. De kop vertaalt, de
  // technische CFB-diagnose blijft Engels, zoals bij andere importfouten.
  ops.acceptError(/Failed to open file:.*CFB: file too small for a valid header/);
  for (const [locale, message] of [
    ['nl', 'Dit MPP-bestand heeft een ongeldige bestandsstructuur en kan niet worden geopend.'],
    ['en', 'This MPP file has an invalid file structure and cannot be opened.'],
  ]) {
    await page.evaluate(async language => {
      const localePath = '/src/i18n/config.ts';
      const { setLocale } = await import(/* @vite-ignore */ localePath);
      await setLocale(language);
    }, locale);
    await open('invalid', 'planning.mpp');
    const toast = page.locator('.ops-toast').filter({ hasText: message });
    await expect(toast.locator('.ops-toast-message')).toHaveText(message);
    await expect.poll(() => page.evaluate(() => {
      const notice = window.__OPS__!.store.getState().ui.notifications.find(n => n.messageKey === 'notifications.mppInvalidContainer');
      return notice && { severity: notice.severity, refusal: notice.refusal ?? false };
    })).toEqual({ severity: 'error', refusal: false });
    await expect(toast.locator('.ops-toast-detail')).toHaveText('CFB: file too small for a valid header (7 bytes, minimum 512)');
    expect((await state(page)).documentIds).toEqual(before.documentIds);
    expect((await state(page)).tasks).toEqual(before.tasks);
    await toast.locator('[data-ops-toast-close]').click();
  }
  await open(planning);
  await expect.poll(() => state(page).then(s => s.tasks.length)).toBeGreaterThan(0);
});

test('Taak toevoegen selecteert, onthult en richt de nieuwe taak zonder zoomwijziging', async ({ page, ops: _ops }) => {
  const [firstId] = await seedProject(page, [
    { name: 'Bestaande taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setZoom(96);
    s.setUI({ showPropertiesPanel: false, rightPanelCollapsed: true });
  });
  const before = await state(page);

  await page.getByRole('button', { name: /(?:Taak toevoegen|New task at the bottom of the list)/ }).click();

  await expect.poll(() => state(page).then(s => s.tasks.length)).toBe(2);
  const after = await state(page);
  const created = after.tasks.at(-1)!;
  expect(after.selectedTaskIds).toEqual([created.id]);
  expect(after.view.zoom).toBe(before.view.zoom);
  await expect.poll(() => state(page).then(s => s.view.pendingFocusTaskId)).toBeNull();
  const name = page.locator('[data-ops-rail] input').first();
  await expect(name).toBeFocused();
  await expect(name).toHaveJSProperty('selectionStart', 0);
  await expect(name).toHaveJSProperty('selectionEnd', created.name.length);

  await page.keyboard.type('Directe naam');
  await page.keyboard.press('Enter');
  await expect.poll(() => state(page).then(s => s.tasks.find(task => task.id === created.id)?.name)).toBe('Directe naam');
  await expect(page.locator('[data-ops-rail]')).toBeVisible();

  // Ctrl+M is dezelfde gewone invoegroute: onder de selectie, geen inspectiemoment.
  await page.locator('[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key="' + firstId + '"][data-grid-column-id="task.name"]').click();
  await page.keyboard.press('ControlOrMeta+m');
  await expect.poll(() => state(page).then(s => s.tasks.length)).toBe(3);
  const milestone = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks.find(task => task.isMilestone)!;
    return { id: task.id, type: task.taskType, kind: task.milestoneKind, mandatory: task.mandatory ?? false,
      position: s.tasks.indexOf(task), selected: s.selectedTaskIds, zoom: s.view.zoom };
  });
  expect(milestone).toMatchObject({ type: 'USERDEFINED', kind: 'FINISH', mandatory: false, position: 1,
    selected: [milestone.id], zoom: before.view.zoom });
  await expect(name).toBeFocused();

  // Alleen de expliciete inspectiekeuze blijft een verplichte keuring.
  await page.getByRole('button', { name: 'Milestone ▾', exact: true }).click();
  await page.getByRole('button', { name: 'Inspection point (mandatory)', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const t = window.__OPS__!.store.getState().tasks.find(t => t.mandatory);
    return t && [t.isMilestone, t.taskType, t.milestoneKind];
  })).toEqual([true, 'ATTENDANCE', 'FINISH']);
});
