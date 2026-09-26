// Audit "weergaven" bevinding 2: de standaardkolommen van de Tabel tonen dezelfde datums als de
// Gantt-balk (`earlyStart || scheduleStart`), en een ander Einde verandert na F5 echt de planning.
// Vóór de fix stonden de invoerankers "Geplande start/Gepland einde" in de standaardset: in het
// instapvoorbeeld week elke bladtaak met een voorganger af van de balk, en een bewerking van
// "Gepland einde" werd geaccepteerd maar deed na F5 niets.
//
// Echte events: het voorbeeld opent via Bestand → Voorbeelden, de Tabel via het lint, de cel via
// klik + Enter + typen + Enter, en herberekenen via F5. De `__OPS__`-brug leest alleen state.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const surface = (page: Page) => page.locator('[data-task-grid-surface-id="full-task-grid"]');

function taskCell(page: Page, taskId: string, columnId: string): Locator {
  return surface(page).locator(
    `[data-grid-data-row="true"][data-grid-row-key="${taskId}"] [data-grid-data-cell="true"][data-grid-column-id="${columnId}"]`,
  );
}

/** `2027-05-24` of `2027-05-24T08:00` → `24-05-2027`, de dmy-notatie van de cel. */
const dmy = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;

async function openExample(page: Page, name: RegExp): Promise<void> {
  await page.locator('.ribbon-tab--file').first().click();
  await page.locator('button.backstage-nav-item[data-tour-anchor="backstage-examples"]').click();
  const card = page.locator('button.backstage-export-card').filter({ has: page.locator('h4', { hasText: name }) }).first();
  await card.click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBeGreaterThan(3);
}

interface ShownTask { id: string; start: string; finish: string; anchorStart: string; anchorFinish: string; manual: boolean; leaf: boolean; preds: number }

async function shownTasks(page: Page): Promise<ShownTask[]> {
  return page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return s.tasks.map(task => ({
      id: task.id,
      // Precies wat de Gantt-balk tekent: de berekende datum, anders het anker.
      start: task.time.earlyStart || task.time.scheduleStart,
      finish: task.time.earlyFinish || task.time.scheduleFinish,
      anchorStart: task.time.scheduleStart,
      anchorFinish: task.time.scheduleFinish,
      manual: task.manuallyScheduled === true,
      leaf: task.childIds.length === 0,
      preds: s.sequences.filter(sequence => sequence.successorId === task.id).length,
    }));
  });
}

test('tabel: Start/Einde tonen de datums van de Gantt-balk, Einde bewerken verzet de planning na F5', async ({ page, ops: _ops }) => {
  await openExample(page, /Refurbishment/i);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ dateNotation: 'dmy' }));
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(surface(page).locator('[role="grid"]')).toBeVisible();

  const tasks = await shownTasks(page);
  const drifted = tasks.filter(task => task.leaf && !task.manual && task.preds > 0 && task.start !== task.anchorStart);
  // Het voorbeeld is juist gekozen omdat de ankers daar afwijken van de berekende datums.
  expect(drifted.length).toBeGreaterThan(3);

  // Elke gemounte rij: Start/Einde in de standaardkolommen = de datum van de Gantt-balk.
  const rowKeys = await surface(page).locator('[data-grid-data-row="true"]').evaluateAll(
    rows => rows.map(row => row.getAttribute('data-grid-row-key')!),
  );
  expect(rowKeys.length).toBeGreaterThan(3);
  const byId = new Map(tasks.map(task => [task.id, task]));
  let compared = 0;
  for (const rowKey of rowKeys) {
    const task = byId.get(rowKey);
    if (!task) continue;
    await expect(taskCell(page, rowKey, 'task.time.start')).toHaveText(dmy(task.start));
    await expect(taskCell(page, rowKey, 'task.time.finish')).toHaveText(dmy(task.finish));
    compared++;
  }
  expect(compared).toBeGreaterThan(3);
  // De invoerankers staan niet meer in de standaardset.
  await expect(surface(page).locator('[data-grid-column-id="task.time.scheduleStart"]')).toHaveCount(0);

  // Einde van een verschoven taak een week later zetten, op een werkdag van haar eigen kalender.
  const target = drifted[0];
  const newFinish = await page.evaluate(({ id, finish }) => {
    const s = window.__OPS__!.store.getState();
    const task = s.tasks.find(candidate => candidate.id === id)!;
    const calendar = s.calendars.find(candidate => candidate.id === task.calendarId) ?? s.calendar;
    const day = new Date(`${finish.slice(0, 10)}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + 7);
    const iso = () => day.toISOString().slice(0, 10);
    const isoWeekday = () => ((day.getUTCDay() + 6) % 7) + 1;
    const holiday = () => calendar.holidays.some(h => h.startDate <= iso() && iso() <= (h.endDate ?? h.startDate));
    while (!calendar.workDays.includes(isoWeekday()) || holiday()) day.setUTCDate(day.getUTCDate() + 1);
    return iso();
  }, { id: target.id, finish: target.finish });

  const finishCell = taskCell(page, target.id, 'task.time.finish');
  await finishCell.scrollIntoViewIfNeeded();
  await finishCell.click();
  await page.keyboard.press('Enter');
  const input = finishCell.locator('input').first();
  await expect(input).toBeFocused();
  await input.fill(dmy(newFinish));
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(true);

  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate(id => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return task.time.earlyFinish || task.time.scheduleFinish;
  }, target.id)).toBe(newFinish);
  const after = (await shownTasks(page)).find(task => task.id === target.id)!;
  expect(after.start).toBe(target.start);
  // Het ingevoerde einde blijft invoer: de fix leidt het niet af uit de berekende planning.
  expect(after.anchorFinish).toBe(target.anchorFinish);
  await expect(finishCell).toHaveText(dmy(newFinish));
});

test('tabel: Gepland einde van een automatisch geplande taak weigert met een reden', async ({ page, ops: _ops }) => {
  await openExample(page, /Refurbishment/i);
  const target = (await shownTasks(page)).find(task => task.leaf && !task.manual && task.preds > 0)!;
  // Fixture: de kiesbare kolom zichtbaar maken, zoals via de kolomkiezer.
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const columns = s.taskGridSurfaces['full-task-grid'].columns;
    s.setTaskGridColumns('full-task-grid', [
      ...columns,
      { id: 'task.time.scheduleFinish', width: 110, pinned: false } as unknown as (typeof columns)[number],
    ]);
  });
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const cell = taskCell(page, target.id, 'task.time.scheduleFinish');
  await cell.scrollIntoViewIfNeeded();
  await expect(cell).toHaveAttribute('aria-readonly', 'true');
  await cell.click();
  await page.keyboard.press('Enter');
  await expect(cell.locator('input')).toHaveCount(0);
  await expect(surface(page).locator('.full-task-grid-error[role="alert"]'))
    .toHaveText(/manually scheduled|handmatig geplande/);
  const unchanged = (await shownTasks(page)).find(task => task.id === target.id)!;
  expect(unchanged.anchorFinish).toBe(target.anchorFinish);
});
