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
  // Onbekende XML: Engelse technische details, maar een vertaalde melding voor de planner.
  ops.acceptError(/Failed to open file:.*Unknown XML format/);
  for (const [locale, message] of [
    ['nl', 'Onbekend XML-planningsformaat. Open een MS Project-XML (Project) of Primavera P6-XML (APIBusinessObjects).'],
    ['en', 'Unknown XML schedule format. Open an MS Project XML (Project) or Primavera P6 XML (APIBusinessObjects).'],
  ] as const) {
    await page.evaluate(async (lang) => {
      const modulePath = '/src/i18n/config.ts';
      const { setLocale } = await import(/* @vite-ignore */ modulePath);
      await setLocale(lang);
    }, locale);
    const chooser = page.waitForEvent('filechooser');
    await page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ }).click();
    await (await chooser).setFiles({ name: 'lijst.xml', mimeType: 'application/xml', buffer: Buffer.from('<Lijst/>') });
    const toast = page.locator('.ops-toast', { hasText: message });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Unknown XML format:');
    expect((await state(page)).documentIds).toEqual(before.documentIds);
    expect((await state(page)).tasks).toEqual(before.tasks);
    await toast.locator('[data-ops-toast-close]').click();
  }
  // Ook een ongeldige MPP-container laat bestaand werk intact. De kop vertaalt, de
  // technische CFB-diagnose blijft Engels, zoals bij andere importfouten.
  // 321: maak echt onopgeslagen werk, niet alleen een leeg nieuw document.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.addTask({ name: 'Onopgeslagen werk behouden', manuallyScheduled: true });
  });
  const mppSnapshot = () => page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return { activeDocumentId: s.activeDocumentId, documentIds: s.documents.map(d => d.id),
      project: s.project, tasks: s.tasks, sequences: s.sequences, assignments: s.assignments, isDirty: s.isDirty };
  });
  const beforeMpp = await mppSnapshot();
  expect(beforeMpp.tasks).toHaveLength(1);
  expect(beforeMpp.tasks[0].name).toBe('Onopgeslagen werk behouden');
  expect(beforeMpp.isDirty).toBe(true);
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
    expect(await mppSnapshot()).toEqual(beforeMpp);
    await toast.locator('[data-ops-toast-close]').click();
  }
  await open(planning);
  await expect.poll(() => state(page).then(s => s.tasks.length)).toBeGreaterThan(0);

  // Slepen en neerzetten (#771): tijdens een sleep met bestanden ligt de laag over het venster; hij
  // gaat weg bij het verlaten van het venster, na de rusttijd zonder dragover en bij loslaten. Een
  // onbekend formaat geeft een melding en verandert geen document; met een dialoog open blijven
  // dialoog en documenten staan; een IFC-bestand opent in een nieuw tabblad. Playwright kan geen
  // bestand uit het besturingssysteem slepen: dit zijn DragEvents met een echte DataTransfer. Zo'n
  // DataTransfer negeert `dropEffect`, dus de test kijkt of de app de sleep accepteert
  // (`preventDefault`, anders opent de browser het bestand zelf) en naar wat er daarna gebeurt.
  const overlay = page.locator('[data-ops-file-drop-overlay]');
  const dragged = (name: string, text: string) => page.evaluateHandle(([n, t]) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([t], n));
    return transfer;
  }, [name, text] as const);
  type Dragged = Awaited<ReturnType<typeof dragged>>;
  /** Stuur één sleep-event naar `selector`; geeft terug of de app het accepteerde (`preventDefault`). */
  const fire = (transfer: Dragged, type: string, selector = 'body') => transfer.evaluate((dataTransfer, [t, sel]) => {
    const event = new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer });
    document.querySelector(sel)!.dispatchEvent(event);
    return event.defaultPrevented;
  }, [type, selector] as const);
  const dragOverApp = async (transfer: Dragged) => {
    await fire(transfer, 'dragenter');
    return fire(transfer, 'dragover');
  };

  const pdf = await dragged('tekening.pdf', '%PDF-1.7');
  expect(await dragOverApp(pdf)).toBe(true);
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText('Drop to open');
  await expect(overlay).toContainText('Project file or import');
  // Verlaten: een verse dragover vlak ervoor, zodat niet de rusttijd (1,5 s) de laag weghaalt.
  await fire(pdf, 'dragover', '[data-ops-file-drop-overlay]');
  await fire(pdf, 'dragleave', '[data-ops-file-drop-overlay]');
  await expect(overlay).toBeHidden({ timeout: 1000 });
  // De rusttijd: blijft dragover uit (een gemiste dragleave), dan gaat de laag vanzelf weg.
  await dragOverApp(pdf);
  await expect(overlay).toBeVisible();
  await expect(overlay).toBeHidden({ timeout: 5000 });

  const beforeDrop = await state(page);
  await dragOverApp(pdf);
  await expect(overlay).toBeVisible();
  expect(await fire(pdf, 'drop', '[data-ops-file-drop-overlay]')).toBe(true);
  await expect(overlay).toBeHidden({ timeout: 1000 });
  const refused = page.locator('.ops-toast', { hasText: 'Not opened: tekening.pdf. The app only opens IFC, XML, MPP, XER and CSV.' });
  await expect(refused).toBeVisible();
  expect((await state(page)).documentIds).toEqual(beforeDrop.documentIds);
  await refused.locator('[data-ops-toast-close]').click();

  // Met een dialoog open: geen laag. De app accepteert de sleep wel (anders opent de browser het
  // bestand zelf), en een drop zoals de desktopapp hem dan nog levert, laat dialoog en documenten staan.
  await page.locator('[data-ops-tabstrip] .ops-tabstrip-add').click();
  const dialog = page.locator('[data-ops-new-or-open-project-dialog]');
  await expect(dialog).toBeVisible();
  const ifc = await dragged('gesleept.ifc', planning);
  expect(await dragOverApp(ifc)).toBe(true);
  await expect(overlay).toBeHidden();
  await fire(ifc, 'drop');
  const blocked = page.locator('.ops-toast', { hasText: 'Not opened: gesleept.ifc. Close the open dialog first.' });
  await expect(blocked).toBeVisible();
  await expect(dialog).toBeVisible();
  expect((await state(page)).documentIds).toEqual(beforeDrop.documentIds);
  await blocked.locator('[data-ops-toast-close]').click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await dragOverApp(ifc);
  await expect(overlay).toBeVisible();
  await fire(ifc, 'drop', '[data-ops-file-drop-overlay]');
  await expect(overlay).toBeHidden({ timeout: 1000 });
  await expect.poll(() => state(page).then(s => s.documentIds.length)).toBe(beforeDrop.documentIds.length + 1);
  const afterDrop = await state(page);
  expect(afterDrop.activeDocumentId).not.toBe(beforeDrop.activeDocumentId);
  expect(afterDrop.tasks.length).toBeGreaterThan(0);
  await expect(page.locator('[data-ops-tabstrip]')).toContainText('gesleept');
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
  // De punthaak achter het label is een icoon (ui.dropdown); de knop zelf herken je aan zijn lint-icoon.
  await page.locator('.ribbon-btn').filter({ has: page.locator('[data-icon="task.milestone-menu"]') }).click();
  await page.getByRole('button', { name: 'Inspection point (mandatory)', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const t = window.__OPS__!.store.getState().tasks.find(t => t.mandatory);
    return t && [t.isMilestone, t.taskType, t.milestoneKind];
  })).toEqual([true, 'ATTENDANCE', 'FINISH']);
});
