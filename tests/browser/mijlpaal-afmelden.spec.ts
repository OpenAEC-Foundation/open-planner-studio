// Een afgemelde mijlpaal houdt de klokketijd uit de planning (besluit Ethan, 2026-10-29, vloot-wiki
// `besluiten/2026-10-29 afgemelde mijlpaal houdt de geplande tijd.md`): "De dag komt van wat je typt, de
// tijd uit de planning. Typ je zelf een tijd, dan geldt die."
//
// De echte invoerroute: in de Tabel een datum typen bij een mijlpaal, met klik, Enter, toetsenbord en
// Enter. De `__OPS__`-brug zet alleen de opstelling (taken, relaties, kolommen, statusdatum) en leest
// de stand. Headless tegenhanger, alle routes en profielen: tests/planning/check-mijlpaal-afmelden.ts.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const surface = (page: Page) => page.locator('[data-task-grid-surface-id="full-task-grid"]');

function taskCell(page: Page, taskId: string, columnId: string): Locator {
  return surface(page).locator(
    `[data-grid-data-row="true"][data-grid-row-key="${taskId}"] [data-grid-data-cell="true"][data-grid-column-id="${columnId}"]`,
  );
}

/** Standaardkalender ma–vr 07:00–16:00, projectstart ma 1 jun 2026 (OPS-profiel). */
async function seed(page: Page): Promise<{ oplevering: string; startBouw: string; keuring: string }> {
  const ids = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    s.setCalendar({ ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [] });
    s.setProject({ name: 'Mijlpaal afmelden', startDate: '2026-06-01' });
    s.setUI({ dateNotation: 'dmy' });
    const milestone = (name: string, kind?: 'START' | 'FINISH') => s.addTask({
      name, isMilestone: true, ...(kind ? { milestoneKind: kind } : {}), time: { scheduleDuration: 0 } as never,
    });
    const hours = (name: string, h: number) => {
      const id = s.addTask({ name });
      const task = window.__OPS__!.store.getState().tasks.find(t => t.id === id)!;
      s.updateTask(id, { time: { ...task.time, durationUnit: 'hours', durationMinutes: h * 60, scheduleDuration: h / 8 } });
      return id;
    };
    // De botsing uit het besluit: een losse mijlpaal zonder soort staat in OPS om 16:00 (B6).
    const oplevering = milestone('Oplevering');
    // "Start bouw": startmijlpaal met een opvolger, om 07:00.
    const startBouw = milestone('Start bouw', 'START');
    s.addSequence({ predecessorId: startBouw, successorId: hours('Grondwerk', 8), type: 'FINISH_START', lagDays: 0 });
    // Midden op de dag door de logica: FS na een taak van 3 u, om 10:00.
    const keuring = milestone('Keuring');
    s.addSequence({ predecessorId: hours('Inspectie', 3), successorId: keuring, type: 'FINISH_START', lagDays: 0 });
    const after = window.__OPS__!.store.getState();
    after.runCPM();
    after.setStatusDate('2026-06-05');
    const columns = after.taskGridSurfaces['full-task-grid'].columns;
    after.setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'task.time.actualStart', width: 140, pinned: false } as unknown as (typeof columns)[number],
      { id: 'task.time.actualFinish', width: 140, pinned: false } as unknown as (typeof columns)[number],
    ]);
    return { oplevering, startBouw, keuring };
  });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(5);
  return ids;
}

const timeOf = (page: Page, id: string) => page.evaluate((taskId) => {
  const t = window.__OPS__!.store.getState().tasks.find(task => task.id === taskId)!.time;
  return { planned: t.earlyStart, actualStart: t.actualStart ?? null, actualFinish: t.actualFinish ?? null };
}, id);

/** Klik de cel, open de editor met Enter, typ `text` met het toetsenbord en bevestig met Enter. */
async function typeInCell(page: Page, cell: Locator, text: string): Promise<void> {
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  await page.keyboard.press('Enter');
  const input = cell.locator('input').first();
  await expect(input).toBeFocused();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('tabel: een datum zonder tijd bij een mijlpaal houdt de klokketijd uit de planning', async ({ page, ops: _ops }) => {
  const { oplevering, startBouw, keuring } = await seed(page);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(surface(page).locator('[role="grid"]')).toBeVisible();

  // Voorwaarden: de planning staat waar het besluit zegt.
  expect((await timeOf(page, oplevering)).planned).toBe('2026-06-01T16:00');
  expect((await timeOf(page, startBouw)).planned).toBe('2026-06-01T07:00');
  expect((await timeOf(page, keuring)).planned).toBe('2026-06-01T10:00');

  // "Oplevering", gepland ma 1 jun 16:00, werkelijk einde 03-06-2026 ⇒ wo 3 jun 16:00 (D7 gaf 07:00).
  const opleveringFinish = taskCell(page, oplevering, 'task.time.actualFinish');
  await typeInCell(page, opleveringFinish, '03-06-2026');
  await expect.poll(() => timeOf(page, oplevering)).toEqual({
    planned: '2026-06-01T16:00', actualStart: '2026-06-03T16:00', actualFinish: '2026-06-03T16:00',
  });
  // Op de dagrand toont de cel alleen de datum (B4).
  await expect(opleveringFinish).toHaveText('03-06-2026');

  // "Start bouw", gepland ma 1 jun 07:00, werkelijke start 02-06-2026 ⇒ di 2 jun 07:00.
  await typeInCell(page, taskCell(page, startBouw, 'task.time.actualStart'), '02-06-2026');
  await expect.poll(() => timeOf(page, startBouw).then(t => t.actualStart)).toBe('2026-06-02T07:00');

  // Midden op de dag: de afgemelde datum krijgt die tijd, en de cel toont hem.
  const keuringFinish = taskCell(page, keuring, 'task.time.actualFinish');
  await typeInCell(page, keuringFinish, '04-06-2026');
  await expect.poll(() => timeOf(page, keuring).then(t => t.actualFinish)).toBe('2026-06-04T10:00');
  await expect(keuringFinish).toContainText('04-06-2026');
  await expect(keuringFinish).toContainText('10:00');

  // Een getypte tijd gaat voor (niet vóór de werkelijke start van 4 jun 10:00).
  await typeInCell(page, keuringFinish, '05-06-2026 09:30');
  await expect.poll(() => timeOf(page, keuring).then(t => t.actualFinish)).toBe('2026-06-05T09:30');
});

// Nachtploeg ma–vr 22:00–06:00 met statusdatum wo 3 jun: afmelden op de statuswerkdag mag (voorheen
// knownbug 445). Een losse mijlpaal staat in OPS op het einde van de werkdag (B6): di 2 jun 06:00, de
// tabel toont "01-06-2026". Met 03-06-2026 wordt het do 4 jun 06:00, het einde van de nacht van wo; de
// cel toont "03-06-2026". Zonder soort en START werden hier eerst geweigerd.
test('tabel: nachtploeg, een mijlpaal afmelden op de statuswerkdag mag', async ({ page, ops: _ops }) => {
  const ids = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const night = [{ start: 1320, end: 1800 }];
    s.setCalendar({
      ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [], workStartHour: 22, workEndHour: 30, hoursPerDay: 8,
      workTime: { byWeekday: { 1: night, 2: night, 3: night, 4: night, 5: night, 6: [], 7: [] } },
    });
    s.setProject({ name: 'Mijlpaal nachtploeg', startDate: '2026-06-01' });
    s.setUI({ dateNotation: 'dmy' });
    const milestone = (name: string, kind?: 'START' | 'FINISH') => s.addTask({
      name, isMilestone: true, ...(kind ? { milestoneKind: kind } : {}), time: { scheduleDuration: 0 } as never,
    });
    const zonder = milestone('Oplevering nacht');
    const start = milestone('Start nacht', 'START');
    const after = window.__OPS__!.store.getState();
    after.runCPM();
    after.setStatusDate('2026-06-03');
    const columns = after.taskGridSurfaces['full-task-grid'].columns;
    after.setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'task.time.actualStart', width: 140, pinned: false } as unknown as (typeof columns)[number],
      { id: 'task.time.actualFinish', width: 140, pinned: false } as unknown as (typeof columns)[number],
    ]);
    return { zonder, start };
  });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(2);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(surface(page).locator('[role="grid"]')).toBeVisible();

  // Voorwaarden: beide mijlpalen op di 2 jun 06:00, de cel Start toont 01-06-2026 zonder tijd (na de
  // statusdatum staat er ook de markering "verouderd" bij).
  for (const id of [ids.zonder, ids.start]) {
    expect((await timeOf(page, id)).planned).toBe('2026-06-02T06:00');
    const startCell = taskCell(page, id, 'task.time.start');
    await expect(startCell).toContainText('01-06-2026');
    await expect(startCell).not.toContainText('06:00');
  }

  // Zonder soort, werkelijk einde 03-06-2026.
  const zonderFinish = taskCell(page, ids.zonder, 'task.time.actualFinish');
  await typeInCell(page, zonderFinish, '03-06-2026');
  await expect.poll(() => timeOf(page, ids.zonder)).toEqual({
    planned: '2026-06-02T06:00', actualStart: '2026-06-04T06:00', actualFinish: '2026-06-04T06:00',
  });
  await expect(zonderFinish).toHaveText('03-06-2026');

  // START, werkelijke start 03-06-2026.
  const startStart = taskCell(page, ids.start, 'task.time.actualStart');
  await typeInCell(page, startStart, '03-06-2026');
  await expect.poll(() => timeOf(page, ids.start).then(t => t.actualStart)).toBe('2026-06-04T06:00');
  await expect(startStart).toHaveText('03-06-2026');
});

// Dezelfde nachtploeg met de statusdatum op za 6 jun, een dag zonder werkblok (D4). Afmelden met
// 06-06-2026 geeft zo 7 jun 06:00, het einde van de typische nacht van za; de cel toont "06-06-2026".
// Eerst werd dat geweigerd (review ronde 2 van #724).
test('tabel: nachtploeg, afmelden op een statusdag zonder werkblok mag', async ({ page, ops: _ops }) => {
  const id = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const night = [{ start: 1320, end: 1800 }];
    s.setCalendar({
      ...s.calendar, workDays: [1, 2, 3, 4, 5], holidays: [], workStartHour: 22, workEndHour: 30, hoursPerDay: 8,
      workTime: { byWeekday: { 1: night, 2: night, 3: night, 4: night, 5: night, 6: [], 7: [] } },
    });
    s.setProject({ name: 'Mijlpaal nachtploeg zaterdag', startDate: '2026-06-01' });
    s.setUI({ dateNotation: 'dmy' });
    const milestone = s.addTask({ name: 'Oplevering nacht', isMilestone: true, time: { scheduleDuration: 0 } as never });
    const after = window.__OPS__!.store.getState();
    after.runCPM();
    after.setStatusDate('2026-06-06');
    const columns = after.taskGridSurfaces['full-task-grid'].columns;
    after.setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'task.time.actualFinish', width: 140, pinned: false } as unknown as (typeof columns)[number],
    ]);
    return milestone;
  });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(1);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(surface(page).locator('[role="grid"]')).toBeVisible();
  expect((await timeOf(page, id)).planned).toBe('2026-06-02T06:00');

  const finish = taskCell(page, id, 'task.time.actualFinish');
  await typeInCell(page, finish, '06-06-2026');
  await expect.poll(() => timeOf(page, id)).toEqual({
    planned: '2026-06-02T06:00', actualStart: '2026-06-07T06:00', actualFinish: '2026-06-07T06:00',
  });
  await expect(finish).toHaveText('06-06-2026');
});
