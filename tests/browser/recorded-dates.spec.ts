// "Datums zoals opgeslagen" voor XER (laag 3) — de eerste browserdekking van de standaard-aan-modus
// (her-check laag 3, bevinding 9). Echte gebruikersflow: een .xer via de ribbonknop Openen en de
// bestandskiezer; daarna wordt gecontroleerd wat de gebruiker ZIET — de strook, de celtekst in de
// tabel (mét de product-datumnotatie, precies de naad waar bevinding 1 zat) en de badge in het
// eigenschappenpaneel — met `window.__OPS__` alleen om de taak-id's op te zoeken en het paneel/de
// kolom aan te zetten. De fixture is dezelfde corpusloze orakel-fixture als in
// `tests/planning/check-xer-recorded-times.ts`: T1 legt vroege datums vast die van onze
// herberekening afwijken (⇒ de modus gaat vanzelf aan), T3 legt alleen het vroege paar vast
// (⇒ laat-start/-einde en speling zijn "niet vastgelegd").
import type { Locator, Page } from '@playwright/test';
import { expect, state, test } from './fixtures/ops';

const FIXTURE_HEADER = [
  'task_id', 'proj_id', 'clndr_id', 'task_code', 'task_name', 'task_type', 'duration_type',
  'status_code', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'target_start_date', 'target_end_date',
  'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
  'total_float_hr_cnt', 'free_float_hr_cnt',
].join('\t');

const XER_FIXTURE = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tLaag3Browser\tC1\t2026-01-01\t2026-01-01',
  '%T\tTASK',
  `%F\t${FIXTURE_HEADER}`,
  '%R\tT1\tP1\tC1\tA1\tDeviates\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-02\t2026-01-09\t2026-01-05\t2026-01-12\t2026-01-10\t2026-01-17\t40\t8',
  '%R\tT3\tP1\tC1\tA3\tEarlyOnly\tTT_Task\tDT_FixedDUR\tTK_NotStart\t16\t16\t2026-03-01\t2026-03-03\t2026-03-01\t2026-03-03\t\t\t\t',
  '%E',
].join('\n');

function taskCell(page: Page, taskId: string, columnId: string): Locator {
  return page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"]`
      + ` [data-grid-data-cell="true"][data-grid-column-id="${columnId}"]`,
  );
}

async function openXerViaFileChooser(page: Page): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooserPromise = page.waitForEvent('filechooser');
  await openButton.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'laag3.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(XER_FIXTURE) });
}

test('datums zoals opgeslagen: een XER met restverschillen opent in de modus, met "niet vastgelegd" in tabel en badge', async ({ page, ops: _ops }) => {
  await openXerViaFileChooser(page);

  // De modus gaat vanzelf aan (verse XER-import mét verschoven taken) en de strook zegt het.
  const strip = page.locator('[data-ops-recorded-dates-active]');
  await expect(strip).toBeVisible();
  await expect(strip).toContainText(/Primavera/);
  await expect.poll(() => state(page).then(snapshot => snapshot.tasks.length)).toBe(2);
  const ids = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return {
      deviates: s.tasks.find(task => task.wbsCode === 'A1')!.id,
      earlyOnly: s.tasks.find(task => task.wbsCode === 'A3')!.id,
      datesAsRecorded: s.datesAsRecorded,
      scheduleStale: s.scheduleStale,
    };
  });
  expect(ids.datesAsRecorded).toBe(true);
  expect(ids.scheduleStale).toBe(false);

  // Tabel: de late-start-kolom erbij (een productinstelling, via dezelfde actie als de kolomkiezer)
  // en dan de CELTEKST lezen — met de product-datumnotatie, want dat is de naad waar een verzonnen
  // late datum ("01-03-2026") stond in plaats van "Niet vastgelegd".
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(page.locator('[data-task-grid-surface-id="full-task-grid"] [role="grid"]')).toBeVisible();
  await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    const columns = s.taskGridSurfaces['full-task-grid'].columns;
    const wanted = ['task.time.lateStart', 'task.time.totalFloat'] as const;
    const missing = wanted.filter(id => !columns.some(column => column.id === id));
    if (missing.length > 0) {
      s.setTaskGridColumns('full-task-grid', [
        ...columns,
        ...missing.map(id => ({ id: id as typeof columns[number]['id'], width: 140, pinned: false })),
      ]);
    }
  });
  await expect(taskCell(page, ids.earlyOnly, 'task.time.lateStart')).toHaveText(/^(Niet vastgelegd|Not recorded)$/);
  await expect(taskCell(page, ids.earlyOnly, 'task.time.totalFloat')).toHaveText(/^(Niet vastgelegd|Not recorded)$/);
  // De volledig vastgelegde taak toont gewoon P6's late start (10 januari 2026) in de datumnotatie.
  await expect(taskCell(page, ids.deviates, 'task.time.lateStart')).toHaveText(/10.01.2026|2026.01.10|01.10.2026/);
  await expect(taskCell(page, ids.deviates, 'task.time.lateStart')).not.toHaveText(/^(Niet vastgelegd|Not recorded)$/);

  // Eigenschappenpaneel: de badge zegt per taak hetzelfde als de tabel, en noemt Primavera alleen
  // omdat dit een XER-herkomst is.
  await page.evaluate((taskId) => {
    const s = window.__OPS__!.store.getState();
    s.selectTask(taskId);
    s.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
  }, ids.earlyOnly);
  await expect(page.locator('[data-ops-task-recorded-dates="partly-unrecorded"]')).toBeVisible();
  await page.evaluate((taskId) => { window.__OPS__!.store.getState().selectTask(taskId); }, ids.deviates);
  const activeBadge = page.locator('[data-ops-task-recorded-dates="active"]');
  await expect(activeBadge).toBeVisible();
  await expect(activeBadge).toContainText(/Primavera/);

  // Herberekenen verlaat de modus: strook weg, en de kolom toont weer onze eigen, echte speling.
  await page.locator('[data-ops-recorded-dates-recalculate]').click();
  await expect(strip).toHaveCount(0);
  await expect.poll(() => state(page).then(() => page.evaluate(() => window.__OPS__!.store.getState().datesAsRecorded))).toBe(false);
  await expect(taskCell(page, ids.earlyOnly, 'task.time.totalFloat')).not.toHaveText(/^(Niet vastgelegd|Not recorded)$/);
});
