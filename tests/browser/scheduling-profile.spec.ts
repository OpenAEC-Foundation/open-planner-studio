import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

const profileSelect = (scope: Page | Locator) => scope.locator('[data-ops-scheduling-profile-select] .ops-select__trigger');
async function chooseProfile(trigger: Locator, value: string): Promise<void> {
  await trigger.click();
  await trigger.page().locator(`[role="option"][data-value="${value}"]`).click();
}
async function createProfile(page: Page, scope: Page | Locator = page, name?: string): Promise<void> {
  await scope.locator('[data-ops-scheduling-new-profile]').click();
  const dialog = page.locator('[data-ops-new-profile-dialog]');
  await expect(dialog).toBeVisible();
  if (name !== undefined) await dialog.locator('[data-ops-new-profile-name]').fill(name);
  await dialog.locator('[data-ops-new-profile-create]').click();
  await expect(dialog).toHaveCount(0);
  await expect(scope.locator('[data-ops-conventions-body]')).toBeVisible();
}
async function expandConventions(scope: Page | Locator): Promise<void> {
  const toggle = scope.locator('[data-ops-conventions-toggle]');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(scope.locator('[data-ops-conventions-body]')).toBeVisible();
}

const XER = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tProfielBrowser\tC1\t2026-03-02\t2026-01-05',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tC1\tA1\tNiet gestart\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
  '%E',
].join('\n');

async function openXer(page: Page): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'profiel.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(XER) });
}
const profileOf = (page: Page) => page.evaluate(() => {
  const p = window.__OPS__!.store.getState().project.schedulingProfile;
  return p ? { id: p.id, baseId: p.baseId, name: p.name } : null;
});
const earlyStart = (page: Page) => page.evaluate(() =>
  window.__OPS__!.store.getState().tasks.find(task => task.wbsCode === 'A1')?.time.earlyStart?.slice(0, 10));

test('rekenprofiel: XER opent als P6 met melding, wissel naar MS Project herberekent, conventie wijzigen maakt een kopie',
  async ({ page, ops: _ops }) => {
    await openXer(page);
    await expect.poll(() => profileOf(page)).toEqual({ id: 'p6', baseId: 'p6', name: '' });
    await expect.poll(() => earlyStart(page)).toBe('2026-03-02');

    const toast = page.locator('.ops-toast').filter({ hasText: /Primavera P6/ });
    await expect(toast).toHaveCount(1);
    await toast.locator('[data-ops-notification-action="openBackstageSection"]').click();

    const select = profileSelect(page);
    await expect(select).toHaveAttribute('data-value', 'builtin:p6');
    await expect(page.locator('[data-ops-crit-threshold-unit]')).toHaveText(/(uren, per taakkalender|hours, per task calendar)/);

    await chooseProfile(select, 'builtin:msproject');
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
    await expect.poll(() => profileOf(page)).toEqual({ id: 'msproject', baseId: 'msproject', name: '' });
    await expect.poll(() => earlyStart(page)).toBe('2026-01-05');
    await expect(page.locator('.ops-toast').filter({ hasText: /is 1 taak verschoven|1 task moved/ })).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);

    await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
    await page.getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).first().click();
    await expect(select).toHaveAttribute('data-value', 'builtin:msproject');
    await expect(page.locator('[data-ops-convention]')).toHaveCount(0);
    await page.locator('[data-ops-scheduling-new-profile]').click();
    await expect(page.locator('[data-ops-new-profile-name]')).toHaveValue(/^(Kopie van|Copy of) Microsoft Project$/);
    await page.locator('[data-ops-new-profile-create]').click();
    await page.locator('[data-ops-convention="clampNegativeFreeFloat"]').check();
    await expect(select).toHaveAttribute('data-value', 'current');
    const nameField = page.locator('[data-ops-scheduling-profile-name]');
    await expect(nameField).toHaveValue(/^(Kopie van|Copy of) Microsoft Project$/);
    await nameField.fill('');
    await expect(page.locator('[data-ops-scheduling-profile-name-required]')).toBeVisible();
    await expect(page.locator('[data-ops-scheduling-save-template]')).toBeDisabled();
    const applyButton = page.getByRole('button', { name: /^(Apply|Toepassen)$/ });
    await expect(applyButton).toBeDisabled();
    await nameField.pressSequentially('Mijn P6-variant ');
    await expect(nameField).toHaveValue('Mijn P6-variant ');
    await expect(page.locator('[data-ops-scheduling-profile-name-required]')).toHaveCount(0);
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
    await expect.poll(() => profileOf(page).then(p => p?.name)).toBe('Mijn P6-variant');

    const projectNameBefore = await page.evaluate(() => window.__OPS__!.store.getState().project.name);
    await page.locator('button.ribbon-tab').filter({ hasText: /^(Settings|Instellingen)$/ }).click();
    await page.locator('button.ribbon-btn').filter({ hasText: /^(Project\s+settings|Project\u00ad?instellingen)$/ }).click();
    const dialog = page.locator('[data-ops-project-dialog="info"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('input').first().fill('Nieuwe projectnaam');
    await expandConventions(dialog);
    await dialog.locator('[data-ops-convention="p6OpenLoeTargetSpan"]').check();
    await dialog.locator('[data-ops-scheduling-profile-name]').fill('');
    await expect(dialog.locator('[data-ops-scheduling-profile-name-required]')).toBeVisible();
    await expect(dialog.locator('[data-ops-project-primary]')).toBeDisabled();
    await dialog.locator('[data-ops-scheduling-profile-name]').press('Enter');
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      return [s.project.name, s.project.schedulingProfile?.name, s.project.schedulingProfile?.overrides.p6OpenLoeTargetSpan];
    })).toEqual([projectNameBefore, 'Mijn P6-variant', undefined]);
    await expect.poll(() => profileOf(page).then(p => [p?.baseId, p?.id.startsWith('prof')]))
      .toEqual(['msproject', true]);
  });

const RECORDED_XER = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tProfielModus\tC1\t2026-01-01\t2026-01-01',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt',
  '%R\tT1\tP1\tC1\tA1\tDeviates\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-02\t2026-01-09\t2026-01-05\t2026-01-12\t2026-01-10\t2026-01-17\t40\t8',
  '%E',
].join('\n');

test('rekenprofiel: in "datums zoals opgeslagen" is Toepassen zonder wijziging een no-op en is een wissel één undo-stap',
  async ({ page, ops: _ops }) => {
    const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
    const chooser = page.waitForEvent('filechooser');
    await openButton.click();
    await (await chooser).setFiles({ name: 'modus.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(RECORDED_XER) });
    const strip = page.locator('[data-ops-recorded-dates-active]');
    await expect(strip).toBeVisible();
    const snapshot = () => page.evaluate(() => {
      const s = window.__OPS__!.store.getState();
      return {
        profile: s.project.schedulingProfile?.id ?? null,
        mode: s.datesAsRecorded,
        stale: s.scheduleStale,
        dirty: s.isDirty,
        start: s.tasks.find(task => task.wbsCode === 'A1')?.time.earlyStart?.slice(0, 10),
        undo: s.historyEvents.filter(event => event.state === 'applied').length,
      };
    });
    const opened = await snapshot();
    expect([opened.profile, opened.mode, opened.stale]).toEqual(['p6', true, false]);

    const toBackstageInfo = async () => {
      await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
      await page.getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).first().click();
    };
    await toBackstageInfo();
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
    await expect(strip).toBeVisible();
    expect(await snapshot()).toEqual(opened);

    await toBackstageInfo();
    await chooseProfile(profileSelect(page), 'builtin:msproject');
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
    await expect.poll(() => snapshot().then(s => [s.profile, s.mode, s.undo])).toEqual(['msproject', false, opened.undo + 1]);
    await expect(strip).toHaveCount(0);

    await page.keyboard.press('Control+z');
    await expect(strip).toBeVisible();
    const undone = await snapshot();
    expect([undone.profile, undone.mode, undone.stale, undone.start]).toEqual([opened.profile, true, false, opened.start]);
  });

const WORKWEEK = `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7]
  .map(n => `(0||${n}()(${n >= 2 && n <= 6 ? '(0||0(s|08:00|f|17:00)())' : ''}))`).join('')}))(0||Exceptions()())))`;
const SS_LAG_XER = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  `%R\tC1\tWerkweek\tCA_Base\t9\t45\t${WORKWEEK}`,
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\trem_target_link_flag',
  '%R\tP1\tSsLagBrowser\tC1\t2026-03-02\t2026-01-05\tY',
  '%T\tSCHEDOPTIONS', '%F\tproj_id\tsched_lag_early_start_flag', '%R\tP1\tN',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tC1\tA1\tNiet gestart\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
  '%E',
].join('\n');

test('rekenprofiel: de SS-lag-variant komt uit de XER en is in Projectinfo te wijzigen', async ({ page, ops: _ops }) => {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'sslag.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(SS_LAG_XER) });
  const option = () => page.evaluate(() => window.__OPS__!.store.getState().project.schedulingOptions?.startToStartLagFrom);
  await expect.poll(option).toBe('actualStart');

  await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
  await page.getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).first().click();
  const ssLag = page.getByRole('button', { name: /^(SS-lag van een lopende voorganger rekenen vanaf|Calculate SS lag from an in-progress predecessor from)$/ });
  await expect(ssLag).toHaveText(/(Statusdatum|Data date) \(P6: Actual Start\)/);
  await expect(ssLag).toBeEnabled();
  await ssLag.click();
  await page.getByRole('option', { name: /^(Start van het restwerk|Remaining start)/ }).click();
  await expect(ssLag).toHaveText(/(Start van het restwerk|Remaining start) \(P6: Early Start\)/);
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(option).toBe('earlyStart');

  await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
  await page.getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).first().click();
  await expect(ssLag).toBeEnabled();
  await createProfile(page);
  await page.locator('[data-ops-convention="p6UseRemainingStartForProgress"]').uncheck();
  await expect(page.locator('[data-ops-convention="p6InProgressStartLagElapsed"]')).toBeChecked();
  await expect(ssLag).toBeDisabled();
  const a19Label = (await page.locator('[data-ops-convention-row="p6UseRemainingStartForProgress"] [data-ops-convention-label]').innerText()).trim();
  await expect(page.locator('[data-ops-ss-lag-needs-convention]')).toContainText(a19Label);
  await page.locator('[data-ops-convention="p6UseRemainingStartForProgress"]').check();
  await expect(ssLag).toBeEnabled();

  await chooseProfile(profileSelect(page), 'builtin:msproject');
  await expect(ssLag).toBeDisabled();
});

const SWITCH_XER = [
  'ERMHDR\t23.12\t2026-09-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  `%R\tC1\tWerkweek\tP1\tCA_Project\t9\t45\t${WORKWEEK}`,
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
  '%R\tP1\tWisselBrowser\tC1\t2026-03-02 08:00\t2026-01-05 08:00\t2026-06-30 17:00\tY',
  '%T\tSCHEDOPTIONS', '%F\tproj_id\tsched_lag_early_start_flag', '%R\tP1\tN',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date',
  '%R\tA1\tP1\tC1\tA1\tVoltooid\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t90\t0\t2026-01-05 08:00\t2026-01-16 17:00\t2026-01-05 08:00\t2026-01-16 17:00',
  '%R\tA2\tP1\tC1\tA2\tLopend\tTT_Task\tDT_FixedDUR2\tTK_Active\tCP_Drtn\t90\t45\t2026-02-23 08:00\t2026-03-06 17:00\t2026-02-23 08:00\t',
  '%R\tA3\tP1\tC1\tA3\tLos\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t45\t45\t2026-03-02 08:00\t2026-03-06 17:00\t\t',
  '%R\tA4\tP1\tC1\tA4\tNiet gestart\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t90\t90\t2026-03-09 08:00\t2026-03-20 17:00\t\t',
  '%R\tM1\tP1\tC1\tM1\tEindmijlpaal\tTT_FinMile\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t0\t0\t2026-03-27 17:00\t2026-03-27 17:00\t\t',
  '%T\tTASKPRED', '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR1\tA2\tA1\tP1\tP1\tPR_FS\t0',
  '%R\tR2\tA4\tA2\tP1\tP1\tPR_SS\t40',
  '%R\tR3\tM1\tA4\tP1\tP1\tPR_FS\t0',
  '%R\tR4\tM1\tA3\tP1\tP1\tPR_FS\t0',
  '%E',
].join('\n');

test('rekenprofiel: P6 → OPS → P6 geeft dezelfde datums terug, ook na Bereken (B1)', async ({ page, ops: _ops }) => {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'wissel.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(SWITCH_XER) });
  await expect.poll(() => profileOf(page)).toEqual({ id: 'p6', baseId: 'p6', name: '' });

  const times = () => page.evaluate(() => JSON.stringify(Object.fromEntries(window.__OPS__!.store.getState().tasks
    .map(task => [task.wbsCode, task.time]).sort(([a], [b]) => String(a).localeCompare(String(b))))));
  const m1 = () => page.evaluate(() => {
    const time = window.__OPS__!.store.getState().tasks.find(task => task.wbsCode === 'M1')!.time;
    return [time.earlyStart, time.earlyFinish];
  });
  await expect.poll(m1).toEqual(['2026-03-27T17:00', '2026-03-27T17:00']);
  const fresh = await times();

  const shiftedToast = page.locator('.ops-toast').filter({ hasText: /zijn 2 taken verschoven|2 tasks moved/ });
  const shiftedNotice = () => page.evaluate(() => {
    const n = window.__OPS__!.store.getState().ui.notifications
      .find(x => x.messageKey === 'notifications.schedulingProfileShifted');
    return n ? [n.params?.count, n.count] : null;
  });
  const applyProfile = async (choice: string) => {
    await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
    await page.getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).first().click();
    await chooseProfile(profileSelect(page), choice);
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  };

  await applyProfile('builtin:ops');
  await expect.poll(() => profileOf(page).then(p => p?.baseId ?? 'ops')).toBe('ops');
  await expect.poll(m1).toEqual(['2026-03-13T17:00', '2026-03-13T17:00']);
  await expect(shiftedToast).toHaveCount(1);
  expect(await shiftedNotice()).toEqual([2, 1]);

  await applyProfile('builtin:p6');
  await expect.poll(() => profileOf(page)).toEqual({ id: 'p6', baseId: 'p6', name: '' });
  await expect.poll(times).toBe(fresh);
  await expect(shiftedToast).toHaveCount(1);
  expect(await shiftedNotice()).toEqual([2, 2]);

  const calculate = page.locator('button.ribbon-btn').filter({ hasText: /^(Calculate|Bereken)$/ });
  await expect(calculate).toHaveCount(1);
  await calculate.click();
  expect(await times()).toBe(fresh);
  await expect.poll(m1).toEqual(['2026-03-27T17:00', '2026-03-27T17:00']);
});

test('rekenprofiel: conventies per thema met basiswaarde, terug naar basis en uitleg', async ({ page, ops: _ops }) => {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'groepen.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(SS_LAG_XER) });
  await expect.poll(() => profileOf(page)).toEqual({ id: 'p6', baseId: 'p6', name: '' });
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
  await page.getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).first().click();

  await expect(page.locator('[data-ops-convention-row]')).toHaveCount(0);
  await expect(page.locator('[data-ops-conventions-count]')).toHaveText('(29)');
  await expandConventions(page);
  await expect(page.locator('[data-ops-convention-row]')).toHaveCount(29);
  const a19 = page.locator('[data-ops-convention-group="completedWork"] [data-ops-convention-row="p6UseRemainingStartForProgress"]');
  await expect(a19).toHaveCount(1);
  await expect(page.locator('[data-ops-convention-group="ownProfilesOnly"] [data-ops-convention-row="p6CompletedPredecessorAtDataDate"]')).toHaveCount(1);
  await expect(page.locator('[data-ops-convention-group="msproject"] [data-ops-convention-row]')).toHaveCount(2);

  await expect(page.locator('[data-ops-convention-per-file]')).toHaveCount(0);
  await expect(a19.locator('[data-ops-convention-value]')).toHaveAttribute('data-value', 'on');
  await expect(page.locator('[data-ops-convention]')).toHaveCount(0);
  await expect(a19.locator('[data-ops-convention-base]')).toHaveCount(0);
  await expect(a19).not.toHaveAttribute('data-ops-convention-deviates', 'true');
  await expect(page.locator('[data-ops-convention-group="completedWork"] [data-ops-convention-group-deviating]')).toHaveCount(0);
  const select = profileSelect(page);
  await expect(select).toHaveAttribute('data-value', 'builtin:p6');
  await expect(select).toHaveText('Primavera P6');

  await a19.locator('[data-ops-convention-help]').hover();
  await expect(page.locator('.ops-tooltip[role="tooltip"]')).toBeVisible();

  await createProfile(page);
  await page.locator('[data-ops-convention="p6UseRemainingStartForProgress"]').uncheck();
  await expect(a19).toHaveAttribute('data-ops-convention-deviates', 'true');
  await expect(select).not.toHaveAttribute('data-value', 'builtin:p6');
  await a19.locator('[data-ops-convention-reset]').click();
  await expect(page.locator('[data-ops-convention="p6UseRemainingStartForProgress"]')).toBeChecked();
  await expect(a19.locator('[data-ops-convention-reset]')).toHaveCount(0);
  await page.locator('[data-ops-convention="clampNegativeFreeFloat"]').uncheck();
  await expect(page.locator('[data-ops-convention-row="clampNegativeFreeFloat"] [data-ops-convention-reset]')).toBeVisible();

  await expect(page.locator('[data-ops-scheduling-source-option="useExpectedFinishDates"]')).toBeVisible();
});

test('rekenprofiel: na Ctrl+Z en Ctrl+Y volgt het profielblok de store, ook in de dialoog (N1)', async ({ page, ops: _ops }) => {
  await openXer(page);
  await expect.poll(() => profileOf(page)).toEqual({ id: 'p6', baseId: 'p6', name: '' });
  const select = profileSelect(page);
  const storeChoice = () => profileOf(page).then(p => `builtin:${p?.id ?? 'ops'}`);
  const toBackstageInfo = async () => {
    await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
    await page.getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).first().click();
    await expect(select).toBeVisible();
  };
  const apply = () => page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  const pressOutsideField = async (combo: string) => {
    await page.locator('.backstage-title').first().click();
    await page.keyboard.press(combo);
  };
  const unapplied = page.locator('[data-ops-project-info-unapplied]');
  const storeChanged = page.locator('[data-ops-scheduling-store-changed]');

  await toBackstageInfo();
  await chooseProfile(select, 'builtin:msproject');
  await apply();
  await expect.poll(storeChoice).toBe('builtin:msproject');
  await toBackstageInfo();
  await expect(select).toHaveAttribute('data-value', 'builtin:msproject');

  await pressOutsideField('Control+z');
  await expect.poll(storeChoice).toBe('builtin:p6');
  await expect(select).toHaveAttribute('data-value', 'builtin:p6');
  await expect(unapplied).toHaveCount(0);
  await expect(storeChanged).toHaveCount(0);

  await pressOutsideField('Control+y');
  await expect.poll(storeChoice).toBe('builtin:msproject');
  await expect(select).toHaveAttribute('data-value', 'builtin:msproject');
  await expect(unapplied).toHaveCount(0);

  await pressOutsideField('Control+z');
  await expect.poll(storeChoice).toBe('builtin:p6');
  await expect(select).toHaveAttribute('data-value', 'builtin:p6');
  await page.locator('[data-ops-near-critical-enable]').check();
  await apply();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().project.schedulingOptions?.nearCriticalThreshold)).toBe(2);
  expect(await storeChoice()).toBe('builtin:p6');

  await toBackstageInfo();
  await chooseProfile(select, 'builtin:msproject');
  await pressOutsideField('Control+z');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().project.schedulingOptions?.nearCriticalThreshold)).toBeUndefined();
  await expect(select).toHaveAttribute('data-value', 'builtin:msproject');
  await expect(storeChanged).toBeVisible();
  await expect(unapplied).toBeVisible();
  await page.locator('[data-ops-project-info-discard]').click();
  await expect(select).toHaveAttribute('data-value', await storeChoice());
  await expect(storeChanged).toHaveCount(0);
  await expect(unapplied).toHaveCount(0);

  await page.locator('button.ribbon-tab').filter({ hasText: /^(Settings|Instellingen)$/ }).click();
  await page.locator('button.ribbon-btn').filter({ hasText: /^(Project\s+settings|Project\u00ad?instellingen)$/ }).click();
  const dialog = page.locator('[data-ops-project-dialog="info"]');
  await expect(dialog).toBeVisible();
  const dialogSelect = profileSelect(dialog);
  for (const combo of ['Control+y', 'Control+z', 'Control+z', 'Control+y']) {
    await dialog.locator('[data-ops-scheduling-title]').click();
    await page.keyboard.press(combo);
    await expect.poll(async () => (await dialogSelect.getAttribute('data-value')) === (await storeChoice())).toBe(true);
  }
  await expect(dialog.locator('[data-ops-scheduling-store-changed]')).toHaveCount(0);
});

test('rekenprofiel: Ctrl+Z van naam plus profiel zet beide velden terug (N1, metadata)', async ({ page, ops: _ops }) => {
  await openXer(page);
  await expect.poll(() => profileOf(page)).toEqual({ id: 'p6', baseId: 'p6', name: '' });
  const storeName = () => page.evaluate(() => window.__OPS__!.store.getState().project.name);
  const originalName = await storeName();
  const select = profileSelect(page);
  const nameInput = page.locator('[data-ops-project-name]');
  const toBackstageInfo = async () => {
    await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
    await page.getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).first().click();
    await expect(select).toBeVisible();
  };
  const pressOutsideField = async (combo: string) => {
    await page.locator('.backstage-title').first().click();
    await page.keyboard.press(combo);
  };
  const unapplied = page.locator('[data-ops-project-info-unapplied]');

  await toBackstageInfo();
  await nameInput.fill('Gewijzigde naam');
  await chooseProfile(select, 'builtin:msproject');
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(storeName).toBe('Gewijzigde naam');
  await toBackstageInfo();
  await expect(nameInput).toHaveValue('Gewijzigde naam');

  await pressOutsideField('Control+z');
  await expect.poll(storeName).toBe(originalName);
  await expect(nameInput).toHaveValue(originalName);
  await expect(select).toHaveAttribute('data-value', 'builtin:p6');
  await expect(unapplied).toHaveCount(0);

  await pressOutsideField('Control+y');
  await expect.poll(storeName).toBe('Gewijzigde naam');
  await expect(nameInput).toHaveValue('Gewijzigde naam');
  await expect(select).toHaveAttribute('data-value', 'builtin:msproject');
  await expect(unapplied).toHaveCount(0);

  await nameInput.fill('Eigen invoer');
  await pressOutsideField('Control+z');
  await expect.poll(storeName).toBe(originalName);
  await expect(nameInput).toHaveValue('Eigen invoer');
  await expect(select).toHaveAttribute('data-value', 'builtin:p6');
  await expect(unapplied).toBeVisible();
});

test('rekenprofiel: aangeraakt, teruggezet en Ctrl+Z, en een documentwissel geven geen valse waarschuwing (N1)', async ({ page, ops: _ops }) => {
  await openXer(page);
  await expect.poll(() => profileOf(page)).toEqual({ id: 'p6', baseId: 'p6', name: '' });
  const select = profileSelect(page);
  const toBackstageInfo = async () => {
    await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
    await page.getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).first().click();
    await expect(select).toBeVisible();
  };
  const pressOutsideField = async (combo: string) => {
    await page.locator('.backstage-title').first().click();
    await page.keyboard.press(combo);
  };
  const storeChanged = page.locator('[data-ops-scheduling-store-changed]');
  const unapplied = page.locator('[data-ops-project-info-unapplied]');

  await toBackstageInfo();
  await chooseProfile(select, 'builtin:msproject');
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => profileOf(page).then(p => p?.id)).toBe('msproject');
  await toBackstageInfo();

  await chooseProfile(select, 'builtin:ops');
  await chooseProfile(select, 'builtin:msproject');
  await expect(unapplied).toHaveCount(0);
  await pressOutsideField('Control+z');
  await expect.poll(() => profileOf(page).then(p => p?.id)).toBe('p6');
  await expect(select).toHaveAttribute('data-value', 'builtin:p6');
  await expect(storeChanged).toHaveCount(0);
  await expect(unapplied).toHaveCount(0);

  await chooseProfile(select, 'builtin:ops');
  await pressOutsideField('Control+y');
  await expect.poll(() => profileOf(page).then(p => p?.id)).toBe('msproject');
  await expect(storeChanged).toBeVisible();
  await chooseProfile(select, 'builtin:msproject');
  await expect(storeChanged).toHaveCount(0);
  await expect(unapplied).toHaveCount(0);
  await chooseProfile(select, 'builtin:ops');
  await expect(unapplied).toBeVisible();
  await expect(storeChanged).toHaveCount(0);

  await chooseProfile(select, 'builtin:p6');
  await expect(unapplied).toBeVisible();
  await page.evaluate(() => { window.__OPS__!.store.getState().newDocument(); });
  await toBackstageInfo();
  await expect(select).toHaveAttribute('data-value', await profileOf(page).then(p => `builtin:${p?.id ?? 'ops'}`));
  await expect(unapplied).toHaveCount(0);
  await chooseProfile(select, 'builtin:p6');
  await expect(unapplied).toBeVisible();
  await expect(storeChanged).toHaveCount(0);
});

test('rekenprofiel: poortlabels, SS-lag zonder urenkalender en sjabloonmeldingen (N2, B9)', async ({ page, ops: _ops }) => {
  const hasHourPlanning = await page.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return !!s.calendar.workTime || s.calendars.some(c => !!c.workTime) || s.tasks.some(t => t.time.durationMinutes != null);
  });
  expect(hasHourPlanning).toBe(false);
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
  await page.getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).first().click();
  const select = profileSelect(page);
  await chooseProfile(select, 'builtin:p6');
  await expandConventions(page);

  await expect(page.locator('[data-ops-convention-requires="hourPlanning"]')).toHaveCount(15);
  await expect(page.locator('[data-ops-convention-requires="xerOrigin"]')).toHaveCount(8);
  await expect(page.locator('[data-ops-convention-row="p6LateFinishOnOwnCalendar"] [data-ops-convention-requires="hourPlanning"]'))
    .toHaveText(/(alleen bij uurplanning|hour planning only)/i);
  await expect(page.locator('[data-ops-convention-row="p6LateFinishOnOwnCalendar"] [data-ops-convention-requires="hourPlanning"]'))
    .toHaveAttribute('title', /24/);
  await expect(page.locator('[data-ops-convention-row="p6PreserveActualInstants"] [data-ops-convention-requires="xerOrigin"]'))
    .toHaveText(/(alleen taken uit \.xer|\.xer tasks only)/i);
  await expect(page.locator('[data-ops-convention-row="p6UseRemainingStartForProgress"] [data-ops-convention-requires]')).toHaveCount(0);

  const ssLag = page.getByRole('button', { name: /^(SS-lag van een lopende voorganger rekenen vanaf|Calculate SS lag from an in-progress predecessor from)$/ });
  await expect(ssLag).toBeDisabled();
  await expect(page.locator('[data-ops-ss-lag-needs-convention]')).toHaveCount(0);
  await expect(page.locator('[data-ops-ss-lag-needs-hour-planning]')).toBeVisible();
  await page.evaluate(() => {
    const state = window.__OPS__!.store.getState();
    const id = state.addTask({ name: 'Uurtaak' });
    const current = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
    state.updateTask(id, { time: { ...current.time, durationUnit: 'hours', scheduleDuration: 0.5, durationMinutes: 240 } });
  });
  await expect(ssLag).toBeEnabled();
  await expect(page.locator('[data-ops-ss-lag-needs-hour-planning]')).toHaveCount(0);

  await createProfile(page, page, 'Mijn sjabloon');
  await page.locator('[data-ops-convention="p6CompletedPredecessorAtDataDate"]').check();
  await expect(page.locator('[data-ops-scheduling-profile-name]')).toHaveValue('Mijn sjabloon');
  await page.locator('[data-ops-scheduling-save-template]').click();
  await expect(page.locator('.ops-toast').filter({ hasText: /(Sjabloon „Mijn sjabloon” opgeslagen|Template “Mijn sjabloon” saved)/ })).toHaveCount(1);
  const storedNames = () => page.evaluate(() =>
    (JSON.parse(localStorage.getItem('ops-schedulingProfiles') ?? '[]') as { name: string }[]).map(p => p.name));
  expect(await storedNames()).toEqual(['Mijn sjabloon']);

  const deleteButton = page.locator('[data-ops-scheduling-delete-template]');
  await deleteButton.click();
  const confirm = page.getByText(/(Sjabloon „Mijn sjabloon” verwijderen\?|Delete template “Mijn sjabloon”\?)/);
  await expect(confirm).toBeVisible();
  await page.getByRole('button', { name: /^(Annuleren|Cancel)$/ }).click();
  await expect(confirm).toHaveCount(0);
  expect(await storedNames()).toEqual(['Mijn sjabloon']);
  await deleteButton.click();
  await page.getByRole('button', { name: /^(Verwijderen|Delete)$/ }).click();
  await expect(confirm).toHaveCount(0);
  expect(await storedNames()).toEqual([]);
  await expect(page.locator('[data-ops-scheduling-save-template]')).toBeVisible();

  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('vol', 'QuotaExceededError'); };
  });
  await page.locator('[data-ops-scheduling-save-template]').click();
  await expect(page.locator('.ops-toast').filter({ hasText: /(opslag van de app is vol|app storage is full)/ })).toHaveCount(1);
});
