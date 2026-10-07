import { expect, seedProject, test } from './fixtures/ops';
import type { Page } from '@playwright/test';

// ?-knoppen in dialogen en panelen (ontwerp gebruikersdocumentatie §8.1 en §10.2, fase 4). Een
// dialoog zonder onopgeslagen invoer sluit en opent Help meteen; een dialoog met wijzigingen vraagt
// eerst Opslaan / Annuleren / Terug. De dev-brug opent alleen de dialoog of het paneel (fixture); de
// geteste handeling — de ?-knop en de keuze in de vraag — zijn echte klikken.

const current = (page: Page) => page.locator('.help-article-body');

async function expectHelpOn(page: Page, id: string): Promise<void> {
  await expect(page.locator('.help-panel')).toBeVisible();
  await expect(current(page)).toHaveAttribute('data-help-current', id);
}

test('instellingen: de ?-knop sluit het venster en opent Instellingen in Help', async ({ page, ops: _ops }) => {
  await page.getByTitle(/^(Settings|Instellingen)$/, { exact: true }).click();
  const dialog = page.locator('.settings-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-help-button="ref-instellingen"]').click();
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'ref-instellingen');
});

test('kalendervenster zonder wijziging: Help opent meteen', async ({ page, ops: _ops }) => {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showCalendarDialog: true }));
  const dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-help-button="ref-kalenders"]').click();
  await expect(page.locator('[data-ops-help-leave-dialog]')).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'ref-kalenders');
});

test('kalendervenster met een wijziging: Terug, Annuleren en Opslaan', async ({ page, ops: _ops }) => {
  const calendarName = () => page.evaluate(() => window.__OPS__!.store.getState().calendar.name);
  const before = await calendarName();
  const dialog = page.locator('[data-ops-calendar-dialog]');
  const leave = page.locator('[data-ops-help-leave-dialog]');
  const open = async (name: string) => {
    await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showCalendarDialog: true }));
    await expect(dialog).toBeVisible();
    await dialog.locator('input').first().fill(name);
    await dialog.locator('[data-ops-help-button="ref-kalenders"]').click();
    await expect(leave).toBeVisible();
  };

  // Terug: de vraag sluit, de dialoog en de invoer blijven staan.
  await open('Concept A');
  await leave.locator('[data-ops-help-leave-choice="back"]').click();
  await expect(leave).toHaveCount(0);
  await expect(dialog.locator('input').first()).toHaveValue('Concept A');

  // Annuleren: de invoer is weg, Help staat op het artikel.
  await dialog.locator('[data-ops-cal-cancel]').click();
  await expect(dialog).toHaveCount(0);
  await open('Concept B');
  await leave.locator('[data-ops-help-leave-choice="discard"]').click();
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'ref-kalenders');
  expect(await calendarName()).toBe(before);

  // Opslaan: de invoer staat in de planning, daarna Help.
  await open('Bouwkalender help');
  await leave.locator('[data-ops-help-leave-choice="save"]').click();
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'ref-kalenders');
  await expect.poll(calendarName).toBe('Bouwkalender help');
});

test('taakvenster: de ?-knop vraagt altijd eerst, Terug laat het venster staan', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{ name: 'Metselwerk', start: '2026-09-07', finish: '2026-09-11' }]);
  await page.evaluate(id => window.__OPS__!.store.getState().setUI({ showTaskDialog: true, editingTaskId: id }), taskId);
  const dialog = page.locator('[data-ops-task-dialog]');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-help-button="ref-taak-eigenschappen"]').click();
  const leave = page.locator('[data-ops-help-leave-dialog]');
  await expect(leave).toBeVisible();
  await leave.locator('[data-ops-help-leave-choice="back"]').click();
  await expect(leave).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-help-button="ref-taak-eigenschappen"]').click();
  await leave.locator('[data-ops-help-leave-choice="discard"]').click();
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'ref-taak-eigenschappen');
});

test('panelen: Waarschuwingen en Eigenschappen hebben een ?-knop naar hun referentie', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{ name: 'Fundering', start: '2026-09-07', finish: '2026-09-11' }]);
  await page.evaluate(id => {
    const s = window.__OPS__!.store.getState();
    s.selectTask(id, false);
    s.setUI({ showWarningsPanel: true, showPropertiesPanel: true, rightPanelCollapsed: false });
  }, taskId);
  await page.locator('[data-ops-help-button="ref-meldingen"]').click();
  await expectHelpOn(page, 'ref-meldingen');

  await page.locator('.ribbon-tab').filter({ hasText: /^(Home|Start)$/ }).first().click();
  await page.locator('[data-ops-help-button="ref-taak-eigenschappen"]').click();
  await expectHelpOn(page, 'ref-taak-eigenschappen');
});

// ── Zes vensters erbij (besluit eigenaar): Projectinformatie, Project verplaatsen, Nivelleren,
// Bibliotheek koppelen/importeren, Voortgang importeren en Herstellen. ─────────────────────────────────

const leaveDialog = (page: Page) => page.locator('[data-ops-help-leave-dialog]');
const choose = (page: Page, choice: 'back' | 'discard' | 'save') =>
  leaveDialog(page).locator(`[data-ops-help-leave-choice="${choice}"]`).click();

test('projectinformatie: zonder wijziging meteen Help, met een wijziging eerst de vraag en Opslaan past toe', async ({ page, ops: _ops }) => {
  const projectName = () => page.evaluate(() => window.__OPS__!.store.getState().project.name);
  const dialog = page.locator('[data-ops-project-dialog="info"]');
  const help = dialog.locator('[data-ops-help-button="ref-projectinfo"]');

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showProjectInfoDialog: true }));
  await expect(dialog).toBeVisible();
  await help.click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'ref-projectinfo');

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showProjectInfoDialog: true }));
  await dialog.locator('input').first().fill('Aanbouw help');
  await help.click();
  await expect(leaveDialog(page)).toBeVisible();
  await choose(page, 'save');
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'ref-projectinfo');
  await expect.poll(projectName).toBe('Aanbouw help');
});

test('project verplaatsen: Opslaan zonder voorbeeld laat het venster staan, met voorbeeld verplaatst het', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Fundering', start: '2026-09-07', finish: '2026-09-11' }]);
  const projectStart = () => page.evaluate(() => window.__OPS__!.store.getState().project.startDate.slice(0, 10));
  const dialog = page.locator('[data-ops-move-project-dialog]');
  const help = dialog.locator('[data-ops-help-button="howto-project-verplaatsen"]');
  const open = () => page.evaluate(() => window.__OPS__!.store.getState().setUI({ showMoveProjectDialog: true }));

  // Niets veranderd: Help opent meteen.
  await open();
  await expect(dialog).toBeVisible();
  await help.click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'howto-project-verplaatsen');

  // Nieuwe startdatum zonder voorbeeld: de vraag komt; Opslaan kan nog niets toepassen.
  await open();
  await dialog.locator('input[type="date"]').fill('2026-10-05');
  await help.click();
  await expect(leaveDialog(page)).toBeVisible();
  await choose(page, 'save');
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
  expect(await projectStart()).toBe('2026-09-07');

  // Met voorbeeld: Opslaan verplaatst het project en opent Help.
  await dialog.getByRole('button', { name: /^(Calculate preview|Voorbeeld berekenen)$/ }).click();
  await help.click();
  await choose(page, 'save');
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'howto-project-verplaatsen');
  await expect.poll(projectStart).toBe('2026-10-05');
});

test('nivelleren: de ?-knop vraagt altijd eerst — Terug, Annuleren en Opslaan', async ({ page, ops: _ops }) => {
  const [first, second] = await seedProject(page, [
    { name: 'Metselen', start: '2026-09-07', finish: '2026-09-09', durationDays: 3 },
    { name: 'Voegen', start: '2026-09-07', finish: '2026-09-09', durationDays: 3 },
  ]);
  await page.evaluate(([a, b]) => {
    const s = window.__OPS__!.store.getState();
    for (const id of [a, b]) s.updateTask(id, { manuallyScheduled: false });
    const resourceId = s.addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 });
    s.assignResource(a, resourceId, 1);
    s.assignResource(b, resourceId, 1);
    s.runCPM();
  }, [first, second]);
  const starts = () => page.evaluate(([a, b]) => {
    const s = window.__OPS__!.store.getState();
    return [a, b].map(id => s.tasks.find(t => t.id === id)!.time.earlyStart).sort();
  }, [first, second]);
  const before = await starts();
  const dialog = page.locator('[data-ops-leveling-dialog]');
  const help = dialog.locator('[data-ops-help-button="howto-overbezetting-oplossen"]');
  const open = () => page.evaluate(() => window.__OPS__!.store.getState().setUI({ showLevelingDialog: true }));

  // Ook zonder wijziging komt de vraag. Terug: de vraag sluit, het venster blijft staan.
  await open();
  await expect(dialog).toBeVisible();
  await help.click();
  await expect(leaveDialog(page)).toBeVisible();
  await choose(page, 'back');
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();

  // Annuleren met een voorstel: het voorstel vervalt, Help staat op het artikel, de planning is gelijk.
  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
  await expect(dialog.locator('table tbody tr')).toHaveCount(1);
  await help.click();
  await choose(page, 'discard');
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'howto-overbezetting-oplossen');
  expect(await starts()).toEqual(before);

  // Opslaan zonder voorstel past niets toe: het venster blijft open.
  await open();
  await help.click();
  await choose(page, 'save');
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
  expect(await starts()).toEqual(before);

  // Opslaan met een voorstel: toegepast, daarna Help.
  await dialog.getByRole('button', { name: /^(Berekenen|Calculate)$/ }).click();
  await expect(dialog.locator('table tbody tr')).toHaveCount(1);
  await help.click();
  await choose(page, 'save');
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'howto-overbezetting-oplossen');
  await expect.poll(async () => (await starts())[1] > '2026-09-09').toBe(true);
});

test('bibliotheek koppelen: Help opent meteen (elke keuze werkt al direct)', async ({ page, ops: _ops }) => {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showLibraryLinkDialog: true }));
  const dialog = page.locator('[data-ops-library-link-dialog]');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-help-button="howto-resourcebibliotheek-gebruiken"]').click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'howto-resourcebibliotheek-gebruiken');
});

test('bibliotheek importeren: zonder bestand meteen Help, met een gekozen bestand eerst de vraag', async ({ page, ops: _ops }) => {
  const setup = await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    const sourceId = store.addCompany('Bronbibliotheek');
    return { sourceId, ifc: window.__OPS__!.store.getState().exportPoolIFC(sourceId)! };
  });
  const companyCount = () => page.evaluate(() => window.__OPS__!.store.getState().companies.length);
  const dialog = page.locator('[data-ops-pool-import-dialog]');
  const help = dialog.locator('[data-ops-help-button="howto-bibliotheken-beheren"]');
  const open = (id: string) => page.evaluate(
    companyId => window.__OPS__!.store.getState().setUI({ showPoolImportDialog: true, poolImportCompanyId: companyId }),
    id,
  );

  await open(setup.sourceId);
  await expect(dialog).toBeVisible();
  await help.click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'howto-bibliotheken-beheren');

  await open(setup.sourceId);
  const chooserPromise = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: /^(Choose file…|Bestand kiezen…)$/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'bronbibliotheek.ifc', mimeType: 'text/plain', buffer: Buffer.from(setup.ifc) });
  await expect(dialog.locator('input[type="radio"]').first()).toBeVisible();
  const companiesBefore = await companyCount();
  await help.click();
  await expect(leaveDialog(page)).toBeVisible();
  await choose(page, 'discard');
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'howto-bibliotheken-beheren');
  expect(await companyCount()).toBe(companiesBefore);
});

test('voortgang importeren: bij het kiezen meteen Help, met een ingelezen blad eerst de vraag en Opslaan past toe', async ({ page, ops: _ops }) => {
  const [taskId] = await seedProject(page, [{ name: 'Voortgang-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 }]);
  const completion = () => page.evaluate(
    id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.time.completion,
    taskId,
  );
  const dialog = page.locator('[data-ops-progress-import-dialog]');
  const help = dialog.locator('[data-ops-help-button="howto-voortgang-importeren"]');
  const open = () => page.evaluate(() => window.__OPS__!.store.getState().setUI({ showProgressImportDialog: true }));

  await open();
  await expect(dialog).toBeVisible();
  await help.click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'howto-voortgang-importeren');

  await open();
  await page.evaluate(() => { delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker; });
  const chooserPromise = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: /^(Choose file…|Bestand kiezen…)$/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'voortgang.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(['OPS Task ID;Completion (%)', `${taskId};40`, ''].join('\r\n'), 'utf-8'),
  });
  await expect(dialog.getByRole('button', { name: /^(Apply|Toepassen)$/ })).toBeEnabled();
  await help.click();
  await expect(leaveDialog(page)).toBeVisible();
  await choose(page, 'save');
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'howto-voortgang-importeren');
  await expect.poll(completion).toBe(0.4);
});

test('herstellen na een crash: de ?-knop stelt uit en opent Help meteen', async ({ page, ops: _ops }) => {
  // Fixture: een gewijzigd project krijgt meteen een herstelkopie (eerste auto-save-ronde); daarna
  // herladen in hetzelfde tabblad, zoals de gids beschrijft. De welkomst staat als gezien, zodat hij
  // na het uitstellen niet over Help heen komt.
  await seedProject(page, [{ name: 'Onopgeslagen werk', start: '2026-09-07', finish: '2026-09-11' }]);
  const recordCount = () => page.evaluate(() => new Promise<number>((resolve) => {
    const request = indexedDB.open('ops-recovery');
    request.onerror = () => resolve(0);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('records')) { db.close(); resolve(0); return; }
      const count = db.transaction('records', 'readonly').objectStore('records').count();
      count.onsuccess = () => { db.close(); resolve(count.result); };
      count.onerror = () => { db.close(); resolve(0); };
    };
  }));
  await expect.poll(recordCount, { timeout: 20_000 }).toBeGreaterThan(0);
  await page.evaluate(() => localStorage.setItem('ops-welcomeSeen', 'true'));
  page.on('dialog', d => { void d.accept(); });
  await page.reload();

  const dialog = page.locator('[data-ops-recovery-dialog]');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.locator('[data-ops-help-button="howto-herstellen-na-een-crash"]').click();
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
  await expectHelpOn(page, 'howto-herstellen-na-een-crash');
  // Uitgesteld, niet weggegooid: de kopie staat er nog.
  expect(await recordCount()).toBeGreaterThan(0);
});
