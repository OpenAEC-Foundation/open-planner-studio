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
import { MSPDI_FIXTURE, P6XML_FIXTURE } from '../fixtures/recordedTimesFormats';

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
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR1\tT3\tT1\tP1\tP1\tPR_FS\t0',
  '%E',
].join('\n');

function taskCell(page: Page, taskId: string, columnId: string): Locator {
  return page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"]`
      + ` [data-grid-data-cell="true"][data-grid-column-id="${columnId}"]`,
  );
}

async function openViaFileChooser(page: Page, name: string, mimeType: string, content: string): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooserPromise = page.waitForEvent('filechooser');
  await openButton.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name, mimeType, buffer: Buffer.from(content) });
}

async function openXerViaFileChooser(page: Page): Promise<void> {
  await openViaFileChooser(page, 'laag3.xer', 'application/octet-stream', XER_FIXTURE);
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
  expect((await state(page)).sequences).toHaveLength(1);

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

  // Knownbug 183: dezelfde onbekende status in Bepalend én de relatiechips, in beide richtingen.
  // De brug zet alleen de kolomvoorkeur; aanwijzen en springen blijven echte browserhandelingen.
  await page.evaluate(() => {
    const columns = window.__OPS__!.store.getState().taskGridSurfaces['full-task-grid'].columns;
    window.__OPS__!.store.getState().setTaskGridColumns('full-task-grid', [
      { id: 'task.name', width: 170, pinned: true },
      { id: 'relation.predecessors', width: 150, pinned: false },
      { id: 'relation.successors', width: 150, pinned: false },
      { id: 'relation.driving', width: 130, pinned: false },
      { id: 'task.time.totalFloat', width: 110, pinned: false },
    ].map(column => ({ ...column, id: column.id as typeof columns[number]['id'] })));
  });
  const unknownText = /^(Onbekend|Unknown)$/;
  const unknownExplanation = /^(Bepalende relaties onbekend zonder berekening\.|Driving relationships unknown without a calculation\.)$/;
  const predecessorCell = taskCell(page, ids.earlyOnly, 'relation.predecessors');
  const successorCell = taskCell(page, ids.deviates, 'relation.successors');
  for (const id of [ids.deviates, ids.earlyOnly]) {
    await expect(taskCell(page, id, 'relation.driving')).toHaveText(unknownText);
  }
  for (const cell of [predecessorCell, successorCell]) {
    await expect(cell.getByRole('img', { name: unknownExplanation })).toBeVisible();
    await expect(cell.locator('.task-grid-relation-chip--driving')).toHaveCount(0);
  }
  await predecessorCell.locator('.task-grid-relation-jump').hover();
  await expect(page.locator('.gantt-tooltip')).toContainText(/Bepalende relaties onbekend zonder berekening\.|Driving relationships unknown without a calculation\./);
  const beforeJump = await state(page);
  await predecessorCell.locator('.task-grid-relation-jump').click();
  await expect.poll(() => state(page).then(snapshot => snapshot.selectedTaskIds)).toEqual([ids.deviates]);
  expect((await state(page)).sequences).toEqual(beforeJump.sequences);
  expect((await state(page)).undoDepth).toBe(beforeJump.undoDepth);

  // Eigenschappenpaneel: de badge zegt per taak hetzelfde als de tabel, en noemt Primavera alleen
  // omdat dit een XER-herkomst is.
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
  });
  await taskCell(page, ids.earlyOnly, 'task.name').click();
  // Besluit 4 (eigenaar 2026-10-19, optie 3): één oranje blok, de ontbrekende velden als derde regel.
  await expect(page.locator('[data-ops-task-recorded-dates="active"][data-ops-task-recorded-dates-missing]')).toBeVisible();
  await taskCell(page, ids.deviates, 'task.name').click();
  const activeBadge = page.locator('[data-ops-task-recorded-dates="active"]:not([data-ops-task-recorded-dates-missing])');
  await expect(activeBadge).toBeVisible();
  await expect(activeBadge).toContainText(/Primavera/);

  // Knownbug 105: het paneel onderscheidt onbekende driving van een berekende lege lijst.
  const dependencies = page.locator('[data-ops-rail-panel="properties"] .dependency-list');
  const unknownDriving = dependencies.getByRole('img', {
    name: /^(Bepalende relaties onbekend zonder berekening\.|Driving relationships unknown without a calculation\.)$/,
  });
  await unknownDriving.scrollIntoViewIfNeeded();
  await expect(unknownDriving).toBeVisible();
  await expect(dependencies.locator('[data-b2-icon="planning.driving"]')).toHaveCount(0);

  // Echte bediening: richtingen aanzetten, selectie wisselen, dezelfde trace naar de Gantt meenemen.
  const beforeTrace = await state(page);
  await taskCell(page, ids.earlyOnly, 'task.name').click();
  await page.getByRole('button', { name: /^(Predecessors|Voorgangers)$/, exact: true }).click();
  const tableRow = (id: string) => taskCell(page, id, 'task.name').locator('..');
  await expect(tableRow(ids.deviates)).toHaveAttribute('data-grid-trace-role', 'predecessor-driving');
  await page.getByRole('button', { name: /^(Successors|Opvolgers)$/, exact: true }).click();
  await taskCell(page, ids.deviates, 'task.name').click();
  await expect(tableRow(ids.earlyOnly)).toHaveAttribute('data-grid-trace-role', 'successor-driving');
  await page.getByRole('button', { name: /^(Planning)$/ }).click();
  const ganttName = (id: string) => page.locator(
    `[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key="${id}"] [data-grid-column-id="task.name"]`,
  );
  await expect(ganttName(ids.earlyOnly).locator('..')).toHaveAttribute('data-grid-trace-role', 'successor-driving');
  // De bestaande springknop in het taakpaneel verzet de focus; de trace volgt mee.
  await dependencies.locator('.dependency-wbs-link').click();
  await expect(ganttName(ids.deviates).locator('..')).toHaveAttribute('data-grid-trace-role', 'predecessor-driving');
  expect((await state(page)).selectedTaskIds).toEqual([ids.earlyOnly]);
  expect((await state(page)).undoDepth).toBe(beforeTrace.undoDepth);
  expect(await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return { mode: s.ui.traceMode, recorded: s.datesAsRecorded, unknown: s.cpmResult?.drivingUnknown };
  })).toEqual({ mode: 'both', recorded: true, unknown: true });

  // Eindreview bevinding 6: de rapporten kennen de "niet vastgelegd"-cel niet; in de modus staat
  // daarom boven elk rapport (hier het standaardtype, de Gantt-afdruk) één melding die zegt dat je
  // naar de datums uit het bestand kijkt. Buiten de modus is die melding weg.
  await page.getByRole('button', { name: /^(Report|Rapport)$/ }).click();
  const reportNote = page.locator('[data-report-recorded-dates-note]');
  await expect(reportNote).toBeVisible();
  await expect(reportNote).toContainText(/(opgeslagen|recorded)/);

  // Herberekenen verlaat de modus: strook weg, en de kolom toont weer onze eigen, echte speling.
  await page.locator('[data-ops-recorded-dates-recalculate]').click();
  await expect(strip).toHaveCount(0);
  await expect(reportNote).toHaveCount(0);
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect.poll(() => state(page).then(() => page.evaluate(() => window.__OPS__!.store.getState().datesAsRecorded))).toBe(false);
  await expect(taskCell(page, ids.earlyOnly, 'task.time.totalFloat')).not.toHaveText(/^(Niet vastgelegd|Not recorded)$/);
  // De geplande start in maart blijft onder het P6-profiel een ondergrens. De voorganger in
  // januari is daardoor bekend niet-driving: geen onbekend-badge of bliksem, wel de gewone trace.
  await expect(unknownDriving).toHaveCount(0);
  await expect(dependencies.locator('.dependency-wbs-link')).toHaveCount(1);
  await expect(dependencies.locator('[data-b2-icon="planning.driving"]')).toHaveCount(0);
  expect(await page.evaluate(() => {
    const cpm = window.__OPS__!.store.getState().cpmResult;
    return { unknown: cpm?.drivingUnknown === true, driving: cpm?.drivingSequenceIds };
  })).toEqual({ unknown: false, driving: [] });
  await expect(tableRow(ids.deviates)).toHaveAttribute('data-grid-trace-role', 'predecessor');
  for (const id of [ids.deviates, ids.earlyOnly]) {
    await expect(taskCell(page, id, 'relation.driving')).toHaveText('—');
  }
  for (const cell of [predecessorCell, successorCell]) {
    await expect(cell.getByRole('img', { name: unknownExplanation })).toHaveCount(0);
    await expect(cell.locator('.task-grid-relation-chip--driving')).toHaveCount(0);
    await expect(cell.locator('.task-grid-relation-jump')).toHaveCount(1);
  }
  await predecessorCell.locator('.task-grid-relation-jump').hover();
  await expect(page.locator('.gantt-tooltip')).toContainText(/Niet bepalend|Not driving/);
  expect((await state(page)).sequences).toEqual(beforeJump.sequences);
  await page.getByRole('button', { name: /^(Predecessors|Voorgangers)$/, exact: true }).click();
  await page.getByRole('button', { name: /^(Successors|Opvolgers)$/, exact: true }).click();
  await expect(tableRow(ids.deviates)).not.toHaveAttribute('data-grid-trace-role');
  expect((await state(page)).selectedTaskIds).toEqual([ids.earlyOnly]);
});

// Eigenaarsbesluit 2026-09-09: "het moet altijd gaan zoals het nu bij XER werkt". Dezelfde
// gebruikersflow met een Primavera P6 XML en een MS Project XML uit `tests/fixtures/
// recordedTimesFormats.ts` (gedeeld met de headless check): openen via de bestandskiezer, de modus
// gaat vanzelf aan, de strook kiest per herkomst de Primavera- of de neutrale tekst, en de kolom
// laatste start zegt "Niet vastgelegd" voor de taak zonder late datums in het bestand.
for (const variant of [
  { label: 'P6 XML', name: 'recorded.xml', content: P6XML_FIXTURE, primavera: true },
  { label: 'MS Project XML', name: 'recorded-mspdi.xml', content: MSPDI_FIXTURE, primavera: false },
] as const) {
  test(`datums zoals opgeslagen: een ${variant.label} met restverschillen opent in de modus, zoals XER`, async ({ page, ops: _ops }) => {
    await openViaFileChooser(page, variant.name, 'text/xml', variant.content);

    const strip = page.locator('[data-ops-recorded-dates-active]');
    await expect(strip).toBeVisible();
    if (variant.primavera) await expect(strip).toContainText(/Primavera/);
    else await expect(strip).not.toContainText(/Primavera/);
    await expect.poll(() => state(page).then(snapshot => snapshot.tasks.length)).toBe(3);
    const ids = await page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      return {
        full: s.tasks.find(task => task.wbsCode === '1.1')!.id,
        earlyOnly: s.tasks.find(task => task.wbsCode === '1.2')!.id,
        datesAsRecorded: s.datesAsRecorded,
        scheduleStale: s.scheduleStale,
        importPristine: s.importPristine,
        origin: s.recordedDates?.origin,
      };
    });
    expect(ids.datesAsRecorded).toBe(true);
    expect(ids.scheduleStale).toBe(false);
    expect(ids.importPristine).toBe(true);
    expect(ids.origin).toBe(variant.primavera ? 'p6xml' : 'mspdi');

    await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
    await expect(page.locator('[data-task-grid-surface-id="full-task-grid"] [role="grid"]')).toBeVisible();
    await page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      const columns = s.taskGridSurfaces['full-task-grid'].columns;
      if (!columns.some(column => column.id === 'task.time.lateStart')) {
        s.setTaskGridColumns('full-task-grid', [
          ...columns,
          { id: 'task.time.lateStart' as typeof columns[number]['id'], width: 140, pinned: false },
        ]);
      }
    });
    await expect(taskCell(page, ids.earlyOnly, 'task.time.lateStart')).toHaveText(/^(Niet vastgelegd|Not recorded)$/);
    await expect(taskCell(page, ids.full, 'task.time.lateStart')).toHaveText(/09.03.2026|2026.03.09|03.09.2026/);

    // Herberekenen verlaat de modus, zoals bij XER.
    await page.locator('[data-ops-recorded-dates-recalculate]').click();
    await expect(strip).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().datesAsRecorded)).toBe(false);
  });
}
