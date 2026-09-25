// Kalenderdialogen als echte gebruikershandeling (audit resources-kalenders, bevindingen 4, 5 en 7).
// Klikken, Enter, datuminvoer en Annuleren zijn echte browser-events; `window.__OPS__` zet alleen de
// fixture klaar (project, kalender, resource, het IFC-document), navigeert naar het lint/paneel en
// leest state. De store-kant staat headless in tests/planning/check-calendar-dialog-commits.ts.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';
import { externIfc } from '../fixtures/recordedDatesIfc';

async function observe(page: Page) {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return {
      datesAsRecorded: s.datesAsRecorded,
      isDirty: s.isDirty,
      scheduleStale: s.scheduleStale,
      undo: s.historyEvents.filter(e => e.state === 'applied').length,
    };
  });
}

/** Fixture: een IFC-document waarvan de opgeslagen datums niet uit de logica volgen (issue #63),
 *  daarna de echte knop "datums zoals opgeslagen tonen". */
async function loadRecordedDatesDocument(page: Page): Promise<void> {
  await page.evaluate(async (text) => {
    const modulePath = '/src/services/ifc/ifcReader.ts';
    const { readIFC } = await import(/* @vite-ignore */ modulePath) as typeof import('@/services/ifc/ifcReader');
    window.__OPS__!.store.getState().applyLoadedProject(readIFC(text), { filePath: null, recompute: true });
  }, externIfc('2'));
  await page.locator('[data-ops-recorded-dates-show]').click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().datesAsRecorded)).toBe(true);
}

async function openCalendarDialog(page: Page) {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'planning' }));
  await page.locator('[data-ops-ribbon-item="calendar"]').first().click();
  const dialog = page.locator('[data-ops-calendar-dialog]');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('kalenderdialoog: Toepassen en Enter zonder wijziging laten document en "datums zoals opgeslagen" staan', async ({ page, ops: _ops }) => {
  await loadRecordedDatesDocument(page);
  const before = await observe(page);
  expect(before).toMatchObject({ datesAsRecorded: true, isDirty: false });

  let dialog = await openCalendarDialog(page);
  await dialog.locator('[data-ops-cal-apply]').click();
  await expect(dialog).toBeHidden();
  expect(await observe(page)).toEqual(before);
  await expect(page.locator('[data-ops-recorded-dates-active]')).toBeVisible();

  dialog = await openCalendarDialog(page);
  const name = dialog.locator('input').first();
  await name.click();
  for (let i = 0; i < 3; i++) await name.press('Enter');
  await expect(dialog).toBeVisible();
  expect(await observe(page)).toEqual(before);
  await dialog.locator('[data-ops-cal-cancel]').click();
  await expect(dialog).toBeHidden();
  expect(await observe(page)).toEqual(before);
});

test('kalenderdialoog: na Enter met een wijziging commit een volgende Enter niets meer', async ({ page, ops: _ops }) => {
  await page.evaluate(() => window.__OPS__!.store.setState({ isDirty: false }));
  const dialog = await openCalendarDialog(page);
  const name = dialog.locator('input').first();
  await name.fill('Bouwkalender 2027');
  await name.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().calendar.name)).toBe('Bouwkalender 2027');
  const afterFirst = await observe(page);
  await name.press('Enter');
  await name.press('Enter');
  expect(await observe(page)).toEqual(afterFirst);
  await dialog.locator('[data-ops-cal-cancel]').click();
});

test('resourcekalenderdialoog: Toepassen zonder wijziging is een no-op', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const { id: _ignored, ...calendar } = structuredClone(s.calendar);
    void _ignored;
    const calendarId = s.addCalendar({ ...calendar, name: 'Ploegkalender' });
    s.addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1, calendarId });
    window.__OPS__!.store.getState().runCPM();
    window.__OPS__!.store.setState({ isDirty: false });
    window.__OPS__!.store.getState().setUI({
      activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false, resourcesView: 'project',
    });
  });
  const before = await observe(page);
  const row = page.getByRole('row', { name: /Ploeg/ });
  await row.getByRole('button', { name: 'Edit…' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog).toBeHidden();
  expect(await observe(page)).toEqual(before);
});
