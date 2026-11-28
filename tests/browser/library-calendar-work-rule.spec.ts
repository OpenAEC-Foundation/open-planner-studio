import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

interface Fixture { taskId: string; companyId: string; poolCalendarId: string }

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
  expect(st.dirty).toBe(false);
  expect(st.stale).toBe(true);
  await expect(durationNotice(page)).toHaveCount(1);

  const resourcePicker = dialog.getByRole('button', { name: 'Choose a library item for Metselploeg', exact: true });
  await expect(resourcePicker).toBeDisabled();
  const resourceFixture = await page.evaluate(cid => {
    const s = () => window.__OPS__!.store.getState();
    const resource = s().resources.find(r => r.name === 'Metselploeg')!;
    const poolId = s().addPoolResource(cid, { name: 'Handmatige ploeg', type: 'LABOR', description: 'Gekozen bron', maxUnits: 4 })!;
    return { resourceId: resource.id, poolId, maxUnits: resource.maxUnits };
  }, companyId);
  await expect(resourcePicker).toBeEnabled();
  await page.mouse.click(5, 100);
  await expect(dialog).toBeVisible();
  await resourcePicker.click();
  await expect(page.getByRole('option', { name: 'Handmatige ploeg', exact: true })).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(1);
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
  await expect(page.getByRole('option')).toHaveCount(1);
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
  await page.evaluate(({ cid, poolId }) => {
    const s = () => window.__OPS__!.store.getState();
    const poolResourceId = s().addPoolResource(cid, { name: 'Bibliotheekploeg', type: 'LABOR', description: '', maxUnits: 1 })!;
    s().updatePoolResource(cid, poolResourceId, { calendarId: poolId });
    window.__OPS__!.store.setState((st) => { st.ui.notifications = []; st.isDirty = false; });
    s().setUI({ activeRibbonTab: 'resources', showResourcePanel: true, resourcePanelDocked: false });
  }, { cid: companyId, poolId: poolCalendarId });

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
    await sourceRow.locator('.danger-icon').click();
    await expect(confirm.getByRole('button', { name: /^(Cancel|Annuleren)$/ })).toBeFocused();
    for (const focus of ['cancel', 'confirm', 'none'] as const) {
      if (focus === 'cancel') await confirm.getByRole('button', { name: /^(Cancel|Annuleren)$/ }).focus();
      if (focus === 'confirm') await confirm.getByRole('button', { name: /^(Delete|Verwijderen)$/ }).focus();
      const prevented = await page.evaluate(clearFocus => {
        if (clearFocus && document.activeElement instanceof HTMLElement) document.activeElement.blur();
        const event = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true,
          bubbles: true, cancelable: true });
        (document.activeElement ?? document.body).dispatchEvent(event);
        return event.defaultPrevented;
      }, focus === 'none');
      expect(prevented).toBe(true);
      await expect(confirm).toBeVisible();
      expect(await poolState()).toEqual(beforeRemove);
      expect(await projectCopy()).toEqual(beforeCopy);
    }
    await confirm.getByRole('button', { name: /^(Cancel|Annuleren)$/ }).focus();
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
