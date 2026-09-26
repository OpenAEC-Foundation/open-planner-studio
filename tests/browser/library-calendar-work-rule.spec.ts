import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

// H6 (eigenaarsbesluit 2026-09-26, "zelfde regel als de dialoog"): een kalenderwijziging die via de
// resourcebibliotheek binnenkomt, volgt de werkregel van de taken erop — Vast werk 32 u op 8 → 6 u/d
// wordt 6 d, met de melding "1 taak aangepast". Fixture via de brug (bibliotheek, gekoppelde
// projectkalender, taak onder Vast werk); de geteste handelingen zijn echte klikken en toetsen in het
// afwijkingenscherm en in de bibliotheekkalenderdialoog. Asserties op de store en de zichtbare melding.

interface Fixture { taskId: string; companyId: string; poolCalendarId: string }

/** Project met een projectkalender (07:00–16:00, pauze 60 min = 8 u) die aan de bibliotheek hangt,
 *  en één taak van 4 d onder Vast werk (32 u). */
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
    s().setTaskWorkRule(taskId, 'FIXED_WORK');
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

test('afwijkingenscherm: "Bibliotheekwaarden gebruiken" op een kalender laat Vast werk meebewegen (4 → 6 d) met melding', async ({ page, ops: _ops }) => {
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
  expect(st.duration).toBe(6);
  expect(st.work).toBe(32 * 60);
  // Niet-undoable verversing (spec §3): geen isDirty, wel herberekenen nodig.
  expect(st.dirty).toBe(false);
  expect(st.stale).toBe(true);
  await expect(durationNotice(page)).toHaveCount(1);
});

test('bibliotheekkalender bewerken: werkdag tot 14:00 ververst de gekoppelde projectkalender en Vast werk wordt 6 d, met melding', async ({ page, ops: _ops }) => {
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
  await expect(dialog.locator('[data-ops-simple-break-net-hours]')).toHaveText(/^6[.,]00/);
  await dialog.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect(dialog).toBeHidden();

  const st = await taskState(page, taskId);
  expect(st.hoursPerDay).toBe(6);
  expect(st.duration).toBe(6);
  expect(st.work).toBe(32 * 60);
  expect(st.dirty).toBe(false);
  expect(st.stale).toBe(true);
  await expect(durationNotice(page)).toHaveCount(1);
});
