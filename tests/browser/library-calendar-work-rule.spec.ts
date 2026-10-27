import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

// H6 (eigenaarsbesluit 2026-09-26, "zelfde regel als de dialoog"): een kalenderwijziging die via de
// resourcebibliotheek binnenkomt, volgt de werkregel van de taken erop — Vaste inzet met 32 u werk op
// 8 → 6 u/d wordt 16/3 d (T14, exacte breuk), met de melding "1 taak aangepast". Fixture via de brug
// (bibliotheek, gekoppelde projectkalender, taak onder Vaste inzet); de geteste handelingen zijn echte
// klikken en toetsen in het afwijkingenscherm en in de bibliotheekkalenderdialoog. Asserties op de store
// en de zichtbare melding.
//
// B1 (spec "alleen uren" §3.2, besluit B1a): de taak stond op Vast werk. Vast werk is nu altijd urenmaat
// en houdt bij een kalenderwissel zijn minuten; de regel verandert dan geen duur en meldt niets. De
// regel, de melding en de nazorg worden daarom met Vaste inzet getoetst, net als in
// `tests/library/check-library-slice.ts` (H6) en `check-work-rule-library.ts`.

interface Fixture { taskId: string; companyId: string; poolCalendarId: string }

/** Project met een projectkalender (07:00–16:00, pauze 60 min = 8 u) die aan de bibliotheek hangt,
 *  en één taak van 4 d onder Vaste inzet (32 u werk). */
async function seedLinkedFixedWorkTask(page: Page): Promise<Fixture> {
  return page.evaluate(() => {
    const s = () => window.__OPS__!.store.getState();
    s().setProject({ name: 'Bibliotheek en werkregel', startDate: '2026-06-01' });
    s().setViewStartDate('2026-06-01');
    s().ensureProjectCalendarInLibrary();
    const companyId = s().addCompany('Bouwbedrijf H6');
    s().bindProjectToCompany(companyId);
    const projectCalendar = s().calendars.find(c => c.id === s().project.calendarId)!;
    const poolCalendarId = s().promoteCalendarToPool(companyId, projectCalendar)!;
    const taskId = s().addTask({ name: 'Metselwerk' });
    const resourceId = s().addResource({ name: 'Metselploeg', type: 'LABOR', description: '', maxUnits: 1 });
    s().assignResource(taskId, resourceId, 1);
    const task = s().tasks.find(t => t.id === taskId)!;
    s().updateTask(taskId, { time: { ...task.time, scheduleDuration: 4 } });
    s().setTaskWorkRule(taskId, 'FIXED_RATE');
    s().runCPM();
    return { taskId, companyId, poolCalendarId };
  });
}

function taskState(page: Page, taskId: string): Promise<{ duration: number; work?: number; hoursPerDay: number; stale: boolean; dirty: boolean }> {
  return page.evaluate((id) => {
    const s = window.__OPS__!.store.getState();
    const t = s.tasks.find(x => x.id === id)!;
    const a = s.assignments.find(x => x.taskId === id)!;
    return { duration: t.time.scheduleDuration, work: a.remainingWorkMinutes, hoursPerDay: s.calendar.hoursPerDay, stale: s.scheduleStale, dirty: s.isDirty };
  }, taskId);
}

const durationNotice = (page: Page) => page.locator('.ops-toast').filter({ hasText: /1 (task|taak)\b/ });

test('afwijkingenscherm: "Bibliotheekwaarden gebruiken" op een kalender laat Vaste inzet meebewegen (4 → 16/3 d) met melding', async ({ page, ops: _ops }) => {
  const { taskId, companyId, poolCalendarId } = await seedLinkedFixedWorkTask(page);
  // Fixture: de bibliotheek werkt voortaan tot 14:00 (6 u); de projectkopie is lokaal op 8 u gebleven
  // en wijkt dus af. De afwijking laten we het afwijkingenscherm tonen (navigatie via de brug).
  await page.evaluate(({ cid, poolId }) => {
    const s = () => window.__OPS__!.store.getState();
    const poolCal = s().pools[cid].calendars.find(c => c.id === poolId)!;
    s().updatePoolCalendar(cid, poolId, { ...structuredClone(poolCal), workEndHour: 14, hoursPerDay: 6 });
    s().updateCalendar(s().project.calendarId, { workEndHour: 16, hoursPerDay: 8 });
    s().runCPM();
    window.__OPS__!.store.setState((st) => { st.ui.notifications = []; st.isDirty = false; });
    s().setUI({ showLibraryLinkDialog: true });
  }, { cid: companyId, poolId: poolCalendarId });
  let st = await taskState(page, taskId);
  expect(st.hoursPerDay).toBe(8);
  expect(st.duration).toBe(4);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /^(Use library values|Bibliotheekwaarden gebruiken)$/ }).click();

  st = await taskState(page, taskId);
  expect(st.hoursPerDay).toBe(6);
  expect(st.duration).toBeCloseTo(16 / 3, 12);
  expect(st.work).toBe(32 * 60);
  // Niet-undoable verversing (spec §3): geen isDirty, wel herberekenen nodig.
  expect(st.dirty).toBe(false);
  expect(st.stale).toBe(true);
  await expect(durationNotice(page)).toHaveCount(1);

  // Knownbug 32: dezelfde koppelroute, nu met niet-herkende projectitems.
  const resourcePicker = dialog.getByRole('button', { name: 'Choose a library item for Metselploeg', exact: true });
  await expect(resourcePicker).toBeDisabled();
  const resourceFixture = await page.evaluate(cid => {
    const s = () => window.__OPS__!.store.getState();
    const resource = s().resources.find(r => r.name === 'Metselploeg')!;
    const poolId = s().addPoolResource(cid, { name: 'Handmatige ploeg', type: 'LABOR', description: 'Gekozen bron', maxUnits: 4 })!;
    return { resourceId: resource.id, poolId, maxUnits: resource.maxUnits };
  }, companyId);
  await expect(resourcePicker).toBeEnabled();
  // Een dialoog met invoer sluit niet via de backdrop (de gedeelde dialoogregel).
  await page.mouse.click(5, 100);
  await expect(dialog).toBeVisible();
  await resourcePicker.click();
  await expect(page.getByRole('option', { name: 'Handmatige ploeg', exact: true })).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(1); // Geen kalender als resourcekeuze.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  const resourceState = () => page.evaluate(id => {
    const r = window.__OPS__!.store.getState().resources.find(r => r.id === id)!;
    return { name: r.name, origin: r.libraryOrigin?.libraryItemId ?? null, maxUnits: r.maxUnits };
  }, resourceFixture.resourceId);
  expect((await resourceState()).origin).toBeNull();
  await resourcePicker.click();
  await page.getByRole('option', { name: 'Handmatige ploeg', exact: true }).click();
  await expect.poll(resourceState).toEqual({ name: 'Handmatige ploeg', origin: resourceFixture.poolId, maxUnits: resourceFixture.maxUnits });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.keyboard.press('Control+z');
  await expect.poll(resourceState).toEqual({ name: 'Metselploeg', origin: null, maxUnits: resourceFixture.maxUnits });

  const calendarId = await page.evaluate(async () => {
    const localePath = '/src/i18n/config.ts';
    const { setLocale } = await import(/* @vite-ignore */ localePath);
    await setLocale('nl');
    const s = () => window.__OPS__!.store.getState();
    const id = s().addCalendar({ ...structuredClone(s().calendar), name: 'Losse kalender', libraryOrigin: undefined });
    s().setUI({ showLibraryLinkDialog: true });
    return id;
  });
  const calendarPicker = dialog.getByRole('button', { name: 'Kies een bibliotheekitem voor Losse kalender', exact: true });
  await calendarPicker.click();
  await expect(page.getByRole('option')).toHaveCount(1); // Alleen de bibliotheekkalender.
  await expect(page.getByRole('option', { name: 'Handmatige ploeg', exact: true })).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const calendarOrigin = () => page.evaluate(id => window.__OPS__!.store.getState().calendars.find(c => c.id === id)?.libraryOrigin?.libraryItemId ?? null, calendarId);
  await expect.poll(calendarOrigin).toBe(poolCalendarId);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.keyboard.press('Control+z');
  await expect.poll(calendarOrigin).toBeNull();
});

test('bibliotheekkalender bewerken: werkdag tot 14:00 ververst de gekoppelde projectkalender en Vaste inzet wordt 16/3 d, met melding', async ({ page, ops: _ops }) => {
  const { taskId, companyId, poolCalendarId } = await seedLinkedFixedWorkTask(page);
  // Een bibliotheekresource die de bibliotheekkalender gebruikt: haar potlood in de Bibliotheekweergave
  // is de UI-ingang voor het bewerken van die kalender.
  await page.evaluate(({ cid, poolId }) => {
    const s = () => window.__OPS__!.store.getState();
    // `addPoolResource` neemt geen kalender mee; de keuze zetten we daarna, zoals de kalenderkolom doet.
    const poolResourceId = s().addPoolResource(cid, { name: 'Bibliotheekploeg', type: 'LABOR', description: '', maxUnits: 1 })!;
    s().updatePoolResource(cid, poolResourceId, { calendarId: poolId });
    window.__OPS__!.store.setState((st) => { st.ui.notifications = []; st.isDirty = false; });
    s().setUI({ activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false });
  }, { cid: companyId, poolId: poolCalendarId });

  // Het paneel opent in de Projectweergave; de Bibliotheekweergave kiezen we met de echte tabknop.
  await page.getByRole('button', { name: /^(Library|Bibliotheek)$/ }).click();
  const row = page.locator('tr[data-ops-pool-resource-row]').filter({ has: page.locator('input[value="Bibliotheekploeg"]') });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /^(Edit…|Bewerken…)$/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const workEnd = dialog.locator('[data-ops-work-end]');
  await expect(workEnd).toHaveValue('16:00');
  await workEnd.fill('14:00');
  await workEnd.press('Enter');
  await expect(dialog.locator('[data-ops-simple-break-net-hours]')).toHaveText(/^6[hu]$/);
  await dialog.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect(dialog).toBeHidden();

  const st = await taskState(page, taskId);
  expect(st.hoursPerDay).toBe(6);
  expect(st.duration).toBeCloseTo(16 / 3, 12);
  expect(st.work).toBe(32 * 60);
  expect(st.dirty).toBe(false);
  expect(st.stale).toBe(true);
  await expect(durationNotice(page)).toHaveCount(1);
});

// Knownbug 31: aparte route, omdat de bestaande scenario's al gekoppelde kalenders bewerken.
// Deze route begint met een lege bibliotheek en volgt de hint in Bestand → Bibliotheek.
test('bibliotheekhint verwijst alleen naar kalenders en de knop promoveert een projectkalender', async ({ page, ops: _ops }) => {
  for (const locale of ['nl', 'en']) {
    const fixture = await page.evaluate(async locale => {
      const localePath = '/src/i18n/config.ts';
      const { setLocale } = await import(/* @vite-ignore */ localePath);
      await setLocale(locale);
      const s = window.__OPS__!.store.getState();
      const companyId = s.addCompany(`Kalenderhint ${locale}`);
      s.setDefaultCompany(companyId);
      const calendar = window.__OPS__!.store.getState().calendars[0];
      return { companyId, calendarName: calendar.name, calendarId: calendar.id };
    }, locale);
    await page.locator('.ribbon-tab--file').click();
    await page.locator('.backstage-nav-item').filter({ hasText: /^(Library|Bibliotheek)$/ }).click();
    const section = page.locator('.library-section');
    await expect(section.locator('.library-promote-hint')).toHaveText(locale === 'nl'
      ? 'Promoveer een projectkalender naar de bibliotheek met de knop “+ Uit project” hierboven.'
      : 'Promote a project calendar to the library with the “+ From project” button above.');
    const toggle = section.locator('.library-promote-toggle');
    await toggle.click();
    const panel = section.locator('[data-ops-promote-calendar-panel]');
    await expect(panel).toBeVisible();
    await toggle.click();
    await expect(panel).toBeHidden();
    await toggle.click();
    const row = panel.locator('li').filter({ hasText: fixture.calendarName }).first();
    await row.locator('button').click();
    await expect(row.locator('.library-promote-linked')).toBeVisible();
    await expect.poll(() => page.evaluate(id => {
      const pool = window.__OPS__!.store.getState().pools[id];
      return { calendars: pool.calendars.map(c => c.name), resources: pool.resources.length };
    }, fixture.companyId)).toEqual({ calendars: [fixture.calendarName], resources: 0 });
    // Knownbug 33: verwijderen vraagt eerst; annuleren bewaart de bron. Na bevestigen kan
    // de behouden projectkopie opnieuw promoveren, in plaats van onterecht 'al gekoppeld'.
    const sourceRow = section.locator('.library-pool > ul > li').filter({ hasText: fixture.calendarName });
    const poolState = () => page.evaluate(id => {
      const pool = window.__OPS__!.store.getState().pools[id];
      return pool.calendars.map(c => ({ id: c.id, name: c.name }));
    }, fixture.companyId);
    const beforeRemove = await poolState();
    const projectCopy = () => page.evaluate(id => {
      const calendar = window.__OPS__!.store.getState().calendars.find(c => c.id === id)!;
      const { libraryOrigin: _origin, ...data } = calendar;
      return data;
    }, fixture.calendarId);
    const beforeCopy = await projectCopy();
    const confirm = page.getByRole('dialog');
    await sourceRow.locator('.danger-icon').click();
    await expect(confirm).toContainText(fixture.calendarName);
    expect(await poolState()).toEqual(beforeRemove);
    await page.keyboard.press('Escape');
    await expect(confirm).toBeHidden();
    expect(await poolState()).toEqual(beforeRemove);
    await sourceRow.locator('.danger-icon').click();
    await confirm.getByRole('button', { name: /^(Cancel|Annuleren)$/ }).click();
    await expect(confirm).toBeHidden();
    expect(await poolState()).toEqual(beforeRemove);
    // Enter op de gefocuste Annuleren-knop annuleert; alleen Enter zonder knopfocus bevestigt.
    await sourceRow.locator('.danger-icon').click();
    await expect(confirm.getByRole('button', { name: /^(Cancel|Annuleren)$/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(confirm).toBeHidden();
    expect(await poolState()).toEqual(beforeRemove);
    await sourceRow.locator('.danger-icon').click();
    await confirm.getByRole('button', { name: /^(Delete|Verwijderen)$/ }).click();
    await expect(confirm).toBeHidden();
    await expect.poll(poolState).toEqual([]);
    expect(await projectCopy()).toEqual(beforeCopy);
    await expect(row.locator('.library-promote-linked')).toHaveCount(0);
    await row.locator('button').click();
    await expect(row.locator('.library-promote-linked')).toBeVisible();
    const promotedAgain = await poolState();
    expect(promotedAgain.map(c => c.name)).toEqual([fixture.calendarName]);
    expect(promotedAgain[0].id).not.toBe(beforeRemove[0].id);
    await page.locator('[data-ops-ribbon-tab="start"]').click();
  }
});
