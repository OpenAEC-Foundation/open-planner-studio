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

// ── Bevinding 5: feestdag met einde vóór begin ──────────────────────────────────────────────────

async function fillDate(group: ReturnType<Page['locator']>, day: string, month: string, year: string) {
  await group.getByLabel('day', { exact: true }).fill(day);
  await group.getByLabel('month', { exact: true }).fill(month);
  await group.getByLabel('year', { exact: true }).fill(year);
  await group.getByLabel('year', { exact: true }).press('Tab');
}

const storedHolidays = (page: Page) => page.evaluate(() =>
  window.__OPS__!.store.getState().calendar.holidays.filter(h => h.name === 'Bouwvak'));

test('kalenderdialoog: feestdag met Tot vóór Van wordt gemarkeerd en blokkeert Toepassen en Enter', async ({ page, ops: _ops }) => {
  const dialog = await openCalendarDialog(page);
  const apply = dialog.locator('[data-ops-cal-apply]');
  await dialog.locator('button').filter({ hasText: 'Add holiday' }).click();
  const from = dialog.getByRole('group', { name: 'From' }).last();
  const until = dialog.getByRole('group', { name: 'Until' }).last();
  const name = from.locator('xpath=ancestor::div[contains(@class,"grid-cols")][1]').locator('input').first();
  await name.fill('Bouwvak');
  await fillDate(from, '17', '07', '2026');
  await fillDate(until, '13', '07', '2026');

  // Enter in het naamveld commit de buffer tussentijds — maar niet zolang er een ongeldige regel is.
  await name.press('Enter');
  await expect(dialog).toBeVisible();
  expect(await storedHolidays(page)).toEqual([]);
  await expect(apply).toBeDisabled();

  const invalidRow = dialog.locator('[data-ops-holiday-invalid]');
  await expect(invalidRow).toHaveCount(1);
  await expect(invalidRow).toHaveAttribute('data-ops-holiday-invalid', 'endBeforeStart');
  await expect(dialog.locator('[data-ops-holiday-error]')).toHaveText('The end date is before the start date.');

  // In de lijst links is de kalender gemarkeerd, ook als je een andere kiest.
  await dialog.locator('button[title="New calendar"]').click();
  await expect(dialog.locator('[data-ops-calendar-row-invalid]')).toHaveCount(1);
  await expect(apply).toBeDisabled();
  await dialog.locator('[data-ops-calendar-row-invalid]').click();

  // Corrigeren ⇒ markering weg, Toepassen werkt en bewaart het goede bereik.
  await fillDate(dialog.getByRole('group', { name: 'Until' }).last(), '24', '07', '2026');
  await expect(invalidRow).toHaveCount(0);
  await expect(dialog.locator('[data-ops-calendar-row-invalid]')).toHaveCount(0);
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(dialog).toBeHidden();
  expect(await storedHolidays(page)).toEqual([{ name: 'Bouwvak', startDate: '2026-07-17', endDate: '2026-07-24' }]);
});

test('resourcekalenderdialoog: een al opgeslagen omgekeerde feestdag wordt gemarkeerd en blokkeert Toepassen', async ({ page, ops: _ops }) => {
  // Fixture: zoals de dialoog zo'n regel vóór deze fix stil bewaarde.
  const calendarId = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const { id: _ignored, ...calendar } = structuredClone(s.calendar);
    void _ignored;
    const id = s.addCalendar({
      ...calendar, name: 'Ploegkalender',
      holidays: [{ name: 'Bouwvak', startDate: '2027-07-19', endDate: '2026-08-07' }],
    });
    s.addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1, calendarId: id });
    window.__OPS__!.store.getState().setUI({
      activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false, resourcesView: 'project',
    });
    return id;
  });
  const row = page.getByRole('row', { name: /Ploeg/ });
  await row.getByRole('button', { name: 'Edit…' }).click();
  const dialog = page.getByRole('dialog');
  const apply = dialog.getByRole('button', { name: 'Apply' });
  await expect(apply).toBeDisabled();
  await expect(dialog.locator('[data-ops-holiday-invalid="endBeforeStart"]')).toHaveCount(1);
  await fillDate(dialog.getByRole('group', { name: 'Until' }).last(), '06', '08', '2027');
  await expect(dialog.locator('[data-ops-holiday-invalid]')).toHaveCount(0);
  await apply.click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate((id) => window.__OPS__!.store.getState().calendars.find(c => c.id === id)!.holidays, calendarId))
    .toEqual([{ name: 'Bouwvak', startDate: '2027-07-19', endDate: '2027-08-06' }]);
});

// ── Bevinding 7: twee routes voor een nieuwe kalender ───────────────────────────────────────────

async function resourceRowFixture(page: Page): Promise<string> {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const id = s.addResource({ name: 'Kraan', type: 'LABOR', description: '', maxUnits: 1 });
    window.__OPS__!.store.setState({ isDirty: false });
    window.__OPS__!.store.getState().setUI({
      activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false, resourcesView: 'project',
    });
    return id;
  });
}

const libraryState = (page: Page, resourceId: string) => page.evaluate((rid) => {
  const s = window.__OPS__!.store.getState();
  return {
    calendarIds: s.calendars.map(c => c.id),
    resourceCalendarId: s.resources.find(r => r.id === rid)?.calendarId ?? null,
    undo: s.historyEvents.filter(e => e.state === 'applied').length,
  };
}, resourceId);

test('"+ Resource calendar": Annuleren laat geen kalender en geen koppeling achter', async ({ page, ops: _ops }) => {
  const resourceId = await resourceRowFixture(page);
  const before = await libraryState(page, resourceId);
  const row = page.getByRole('row', { name: /Kraan/ });
  await row.locator('select').filter({ has: page.locator('option[value="__new"]') }).selectOption('__new');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // De dialoog staat in aanmaakmodus: er is nog niets aangemaakt of gekoppeld.
  expect(await libraryState(page, resourceId)).toEqual(before);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect(await libraryState(page, resourceId)).toEqual(before);
});

test('"+ Resource calendar": Toepassen maakt en koppelt in één undo-stap, met dezelfde standaard als "+" in de kalenderdialoog', async ({ page, ops: _ops }) => {
  const resourceId = await resourceRowFixture(page);
  const before = await libraryState(page, resourceId);
  const row = page.getByRole('row', { name: /Kraan/ });
  await row.locator('select').filter({ has: page.locator('option[value="__new"]') }).selectOption('__new');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog).toBeHidden();
  const after = await libraryState(page, resourceId);
  const createdId = after.calendarIds.find(id => !before.calendarIds.includes(id));
  expect(createdId).toBeTruthy();
  expect(after.resourceCalendarId).toBe(createdId);

  // Dezelfde fabriek als "+" in de kalenderdialoog: gelijke werktijden en gelijke feestdagen.
  const viaResourceRow = await page.evaluate((id) => {
    const c = window.__OPS__!.store.getState().calendars.find(x => x.id === id)!;
    return { workDays: c.workDays, hours: [c.workStartHour, c.workEndHour, c.hoursPerDay], holidays: c.holidays.length, generation: c.generation?.ruleSetId ?? null };
  }, createdId);
  const idsBeforeDialog = await page.evaluate(() => window.__OPS__!.store.getState().calendars.map(c => c.id));
  const calendarDialog = await openCalendarDialog(page);
  await calendarDialog.locator('button[title="New calendar"]').click();
  await calendarDialog.locator('[data-ops-cal-apply]').click();
  await expect(calendarDialog).toBeHidden();
  const viaCalendarDialog = await page.evaluate((ids) => {
    const c = window.__OPS__!.store.getState().calendars.find(x => !ids.includes(x.id))!;
    return { workDays: c.workDays, hours: [c.workStartHour, c.workEndHour, c.hoursPerDay], holidays: c.holidays.length, generation: c.generation?.ruleSetId ?? null };
  }, idsBeforeDialog);
  expect(viaCalendarDialog).toEqual(viaResourceRow);
  // Bouwmodus staat standaard aan: beide dus met de NL-feestdagen, net als een nieuw project.
  expect(viaResourceRow.generation).toBe('NL');
  expect(viaResourceRow.holidays).toBeGreaterThan(0);
  // Aanmaken + koppelen via de resourcerij was één undo-stap.
  expect(after.undo).toBe(before.undo + 1);

  // Eén Ctrl+Z haalt het aanmaken van de kalenderdialoog weg; de tweede ook de koppeling en de kalender.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => libraryState(page, resourceId)).toEqual(before);
});

test('"+ Resource calendar" in de Bibliotheekweergave: pas bij Toepassen aangemaakt en gekoppeld', async ({ page, ops: _ops }) => {
  const { companyId, resourceId } = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const cid = s.addCompany('Bouwbedrijf');
    window.__OPS__!.store.getState().bindProjectToCompany(cid);
    const rid = window.__OPS__!.store.getState().addPoolResource(cid, {
      name: 'Kraan', type: 'LABOR', description: '', maxUnits: 1,
    })!;
    window.__OPS__!.store.getState().setUI({
      activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false,
    });
    return { companyId: cid, resourceId: rid };
  });
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  const poolState = () => page.evaluate(({ cid, rid }) => {
    const pool = window.__OPS__!.store.getState().pools[cid];
    return {
      calendarIds: pool.calendars.map(c => c.id),
      resourceCalendarId: pool.resources.find(r => r.id === rid)?.calendarId ?? null,
    };
  }, { cid: companyId, rid: resourceId });
  const before = await poolState();
  const row = page.getByRole('row', { name: /Kraan/ });
  const select = row.locator('select').filter({ has: page.locator('option[value="__new"]') });

  await select.selectOption('__new');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await poolState()).toEqual(before);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect(await poolState()).toEqual(before);

  await select.selectOption('__new');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog).toBeHidden();
  const after = await poolState();
  const createdId = after.calendarIds.find(id => !before.calendarIds.includes(id));
  expect(createdId).toBeTruthy();
  expect(after.resourceCalendarId).toBe(createdId);
});
