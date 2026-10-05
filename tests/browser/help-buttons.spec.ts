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
