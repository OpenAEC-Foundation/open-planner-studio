import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

function workWeekCalendar(): string {
  const day = (n: number) => `(0||${n}()(${n >= 2 && n <= 6 ? '(0||0(s|08:00|f|17:00)())' : ''}))`;
  return `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7].map(day).join('')}))(0||Exceptions()())))`;
}

const ACTUALS_XER = [
  'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${workWeekCalendar()}`,
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date',
  '%R\tP1\tVoortgang\tC1\t2026-03-02 08:00\t2026-01-05 08:00\t2026-06-30 17:00',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
  '%R\tTC\tP1\tC1\tC1\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Phys\t90\t0\t2026-01-05 08:00\t2026-01-16 17:00\t2026-01-05 08:00\t2026-01-16 17:00',
  '%R\tTL\tP1\tC1\tL1\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t90\t45\t2026-02-23 08:00\t2026-03-06 17:00\t2026-02-23 08:00\t',
  '%R\tTN\tP1\tC1\tN1\tNiet gestart\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t45\t45\t2026-03-09 08:00\t2026-03-13 17:00\t\t',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR1\tTN\tTL\tP1\tP1\tPR_FS\t0',
  '%E',
].join('\n');

async function openActualsXer(page: Page): Promise<{ c1: string; l1: string; n1: string }> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooserPromise = page.waitForEvent('filechooser');
  await openButton.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'voortgang.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(ACTUALS_XER) });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().tasks.length)).toBe(3);
  return page.evaluate(() => {
    const tasks = window.__OPS__!.store.getState().tasks;
    const id = (code: string) => tasks.find(task => task.wbsCode === code)!.id;
    return { c1: id('C1'), l1: id('L1'), n1: id('N1') };
  });
}

interface BarSpan { left: number; right: number; y: number; paints: number }

async function settledBar(page: Page, id: string): Promise<BarSpan> {
  let last: BarSpan | null = null;
  let stableReads = 0;
  await expect.poll(async () => {
    const now = await page.evaluate(taskId => {
      const gantt = window.__OPS__!.gantt;
      const left = gantt.taskBarPoint(taskId, 'left', 'primary');
      const right = gantt.taskBarPoint(taskId, 'right', 'primary');
      return left && right ? { left: left.x, right: right.x, y: left.y, paints: gantt.paintCount('primary') } : null;
    }, id);
    if (!now) { stableReads = 0; last = null; return false; }
    const unchanged = last !== null && last.paints === now.paints && last.left === now.left && last.right === now.right;
    stableReads = unchanged ? stableReads + 1 : 0;
    last = now;
    return stableReads >= 2;
  }, { message: `balk van taak ${id} komt niet tot rust` }).toBe(true);
  return last!;
}

const zoomOf = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().view.zoom);

test('werkelijke datums: een voltooide en een lopende P6-taak staan op hun werkelijke datums, ook na F5', async ({ page, ops: _ops }) => {
  const ids = await openActualsXer(page);
  const opened = await page.evaluate(({ c1, l1 }) => {
    const s = window.__OPS__!.store.getState();
    const time = (id: string) => s.tasks.find(task => task.id === id)!.time;
    return {
      profile: s.project.schedulingProfile?.baseId,
      datesAsRecorded: s.datesAsRecorded,
      c1EarlyStart: time(c1).earlyStart,
      l1EarlyStart: time(l1).earlyStart,
    };
  }, ids);
  expect(opened).toMatchObject({ profile: 'p6', datesAsRecorded: false, l1EarlyStart: '2026-03-02T08:00' });
  expect(opened.c1EarlyStart >= '2026-03-02').toBe(true);

  for (const round of ['geopend', 'na F5'] as const) {
    if (round === 'na F5') {
      await page.keyboard.press('F5');
      await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
    }
    const zoom = await zoomOf(page);
    const c1 = await settledBar(page, ids.c1);
    const l1 = await settledBar(page, ids.l1);
    const n1 = await settledBar(page, ids.n1);
    expect(c1.right - c1.left, `${round}: breedte van de voltooide balk`).toBeGreaterThan(8 * zoom);
    expect(l1.left - c1.right, `${round}: ruimte tussen voltooid einde en lopende start`).toBeGreaterThan(20 * zoom);
    expect(n1.left - l1.left, `${round}: afstand lopende start tot opvolger`).toBeGreaterThan(10 * zoom);
  }
});

test('werkelijke datums: Start van een gestarte taak is alleen-lezen in het paneel, slepen meldt het en verschuift niets', async ({ page, ops: _ops }) => {
  const ids = await openActualsXer(page);

  await page.evaluate(id => window.__OPS__!.store.getState().selectTask(id), ids.l1);
  const startField = page.locator('[data-ops-rail]').getByRole('group', { name: /^Start$/ });
  await expect(startField).toHaveAttribute('aria-disabled', 'true');
  await expect(startField.locator('input').first()).toBeDisabled();
  await expect(startField.locator('input').first()).toHaveValue('23');
  await expect(startField).toHaveAttribute('title', /(actual start|werkelijke start)/);

  await page.evaluate(id => window.__OPS__!.store.getState().selectTask(id), ids.n1);
  await expect(startField).not.toHaveAttribute('aria-disabled', 'true');
  await expect(startField.locator('input').first()).toBeEnabled();

  const before = await page.evaluate(id => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { time: JSON.stringify(task.time), constraint: JSON.stringify(task.constraint ?? null) };
  }, ids.c1);
  const zoom = await zoomOf(page);
  const bar = await settledBar(page, ids.c1);
  const canvasBox = await page.getByTestId('gantt-primary-canvas').boundingBox();
  expect(canvasBox, 'Gantt-canvas zichtbaar').not.toBeNull();
  const grabX = (bar.left + bar.right) / 2;
  expect(grabX > canvasBox!.x && grabX < canvasBox!.x + canvasBox!.width, 'voltooide balk binnen beeld').toBe(true);
  await page.mouse.move(grabX, bar.y);
  await page.mouse.down();
  await page.mouse.move(grabX + Math.max(3 * zoom, 40), bar.y, { steps: 6 });
  await page.mouse.up();

  const dragNotice = page.locator('.ops-toast.toast-error[role="alert"]').filter({ hasText: /(actual dates|werkelijke datums)/ });
  await expect(dragNotice).toHaveCount(1);
  await expect(dragNotice).toContainText('Voltooid');
  const after = await page.evaluate(id => {
    const task = window.__OPS__!.store.getState().tasks.find(candidate => candidate.id === id)!;
    return { time: JSON.stringify(task.time), constraint: JSON.stringify(task.constraint ?? null) };
  }, ids.c1);
  expect(after).toEqual(before);
  const settled = await settledBar(page, ids.c1);
  expect(Math.abs(settled.left - bar.left), 'voltooide balk staat nog op zijn plek').toBeLessThan(1);

  await page.mouse.move(grabX, bar.y);
  await page.mouse.down();
  await page.mouse.move(grabX + Math.max(3 * zoom, 40), bar.y, { steps: 6 });
  await page.mouse.up();
  await expect(dragNotice).toHaveCount(1);
  await expect(dragNotice.locator('.ops-toast-count')).toHaveText('×2');
});
