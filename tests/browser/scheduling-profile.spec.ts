// Rekenprofielen in de echte gebruikersflow (spec v3.1 §8; plan taak D6). Een .xer via de ribbonknop
// Openen en de bestandskiezer; daarna alleen echte klikken. `window.__OPS__` wordt uitsluitend gebruikt
// om de uitkomst te LEZEN (patroon `recorded-dates.spec.ts`).
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

// Statusdatum (last_recalc_date) 2026-03-02, niet-gestarte taak gepland op 2026-01-05: onder P6 schuift
// hij naar de statusdatum, onder MS Project (A23) niet ⇒ de wissel verschuift precies één taak.
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

    // Eén melding voor het bestand, met de profielregel en de actieknop.
    const toast = page.locator('.ops-toast').filter({ hasText: /Primavera P6/ });
    await expect(toast).toHaveCount(1);
    await toast.locator('[data-ops-notification-action="openBackstageSection"]').click();

    // De actie opent Backstage → Projectinfo met het profielblok.
    const select = page.locator('[data-ops-scheduling-profile-select]');
    await expect(select).toHaveValue('builtin:p6');
    // Een XER draagt de kritiekdrempel in uren (thresholdHours): de eenheid staat ZICHTBAAR bij het veld.
    await expect(page.locator('[data-ops-crit-threshold-unit]')).toHaveText(/(uren, per taakkalender|hours, per task calendar)/);

    // Wisselen naar MS Project en toepassen ⇒ herberekend, één taak verschoven, melding met de telling.
    await select.selectOption('builtin:msproject');
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
    await expect.poll(() => profileOf(page)).toEqual({ id: 'msproject', baseId: 'msproject', name: '' });
    await expect.poll(() => earlyStart(page)).toBe('2026-01-05');
    await expect(page.locator('.ops-toast').filter({ hasText: /is 1 taak verschoven|1 task moved/ })).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);

    // Een conventie wijzigen op een ingebouwd profiel maakt "Kopie van Microsoft Project".
    await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
    await page.getByRole('button', { name: /^(Project info|Projectinfo)$/ }).first().click();
    await expect(select).toHaveValue('builtin:msproject');
    await page.locator('[data-ops-convention="clampNegativeFreeFloat"]').check();
    await expect(select).toHaveValue('current');
    const nameField = page.locator('[data-ops-scheduling-profile-name]');
    await expect(nameField).toHaveValue(/^(Kopie van|Copy of) Microsoft Project$/);
    // Het naamveld is te wissen; leeg is nog niet geldig: melding erbij, sjabloon opslaan uit.
    await nameField.fill('');
    await expect(page.locator('[data-ops-scheduling-profile-name-required]')).toBeVisible();
    await expect(page.locator('[data-ops-scheduling-save-template]')).toBeDisabled();
    // Her-check eindreview: met een lege naam is Toepassen uit — anders zou de metadata wel worden
    // opgeslagen en de conventiewijziging stil verdwijnen.
    const applyButton = page.getByRole('button', { name: /^(Apply|Toepassen)$/ });
    await expect(applyButton).toBeDisabled();
    // Gebruikstest I5 punt 2: toets voor toets typen, met een spatie in het midden én tijdelijk achteraan.
    await nameField.pressSequentially('Mijn P6-variant ');
    await expect(nameField).toHaveValue('Mijn P6-variant ');
    await expect(page.locator('[data-ops-scheduling-profile-name-required]')).toHaveCount(0);
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
    await expect.poll(() => profileOf(page).then(p => p?.name)).toBe('Mijn P6-variant');

    // Dezelfde regel in de dialoog (Instellingen → Projectinfo), waar Enter de primaire actie is:
    // naam wissen + projectnaam wijzigen + Enter ⇒ dialoog blijft open, niets opgeslagen.
    const projectNameBefore = await page.evaluate(() => window.__OPS__!.store.getState().project.name);
    await page.locator('button.ribbon-tab').filter({ hasText: /^(Settings|Instellingen)$/ }).click();
    await page.locator('button.ribbon-btn').filter({ hasText: /^(Project info|Projectinfo)$/ }).click();
    const dialog = page.locator('[data-ops-project-dialog="info"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('input').first().fill('Nieuwe projectnaam');
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

// Gebruikstest I5: een XER die opent in "datums zoals opgeslagen" (vastgelegde vroege datums wijken af
// van onze herberekening — zelfde orakel-fixture als recorded-dates.spec.ts). Toepassen zonder wijziging
// laat de modus en de strook staan; een profielwissel is ÉÉN undo-stap, en één Ctrl+Z zet profiel,
// datums en de modus (met strook) samen terug.
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
      await page.getByRole('button', { name: /^(Project info|Projectinfo)$/ }).first().click();
    };
    // Toepassen zonder iets te wijzigen: geen undo-stap, niet vuil, modus + strook blijven.
    await toBackstageInfo();
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
    await expect(strip).toBeVisible();
    expect(await snapshot()).toEqual(opened);

    // Wissel naar MS Project: één undo-stap, modus verlaten.
    await toBackstageInfo();
    await page.locator('[data-ops-scheduling-profile-select]').selectOption('builtin:msproject');
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
    await expect.poll(() => snapshot().then(s => [s.profile, s.mode, s.undo])).toEqual(['msproject', false, opened.undo + 1]);
    await expect(strip).toHaveCount(0);

    // Eén Ctrl+Z: profiel, datums en de modus met strook in één keer terug.
    await page.keyboard.press('Control+z');
    await expect(strip).toBeVisible();
    const undone = await snapshot();
    expect([undone.profile, undone.mode, undone.stale, undone.start]).toEqual([opened.profile, true, false, opened.start]);
  });

// Projectoptie `startToStartLagFrom` (P6 "Calculate Start-to-Start lag from", de variant van C6): een
// XER met `sched_lag_early_start_flag` = N opent op "Werkelijke start"; de keuze is in Projectinfo met
// echte klikken te wijzigen en landt na Toepassen in de projectopties. Onder een profiel zonder C6
// (MS Project) of zonder A19 (`rem_target_link_flag` = Y hieronder zet A19 aan) is het veld
// uitgeschakeld: daar doet de optie niets.
const SS_LAG_XER = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
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
  await page.getByRole('button', { name: /^(Project info|Projectinfo)$/ }).first().click();
  const ssLag = page.getByRole('button', { name: /^(SS-lag van een lopende voorganger rekenen vanaf|Calculate SS lag from an in-progress predecessor from)$/ });
  await expect(ssLag).toHaveText(/(Werkelijke start|Actual start)/);
  await expect(ssLag).toBeEnabled();
  await ssLag.click();
  await page.getByRole('option', { name: /^(Vroege start|Early start)/ }).click();
  await expect(ssLag).toHaveText(/(Vroege start|Early start)/);
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(option).toBe('earlyStart');

  // De motor eist C6 én A19: met A19 uit (C6 aan) is het veld uitgeschakeld, met een tooltip die A19 noemt.
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
  await page.getByRole('button', { name: /^(Project info|Projectinfo)$/ }).first().click();
  await expect(ssLag).toBeEnabled();
  await page.locator('[data-ops-convention="p6UseRemainingStartForProgress"]').uncheck();
  await expect(page.locator('[data-ops-convention="p6InProgressStartLagElapsed"]')).toBeChecked();
  await expect(ssLag).toBeDisabled();
  // De reden staat zichtbaar in een blok onder het veld (gebruikstest B8), niet alleen in een tooltip.
  const a19Label = (await page.locator('[data-ops-convention-row="p6UseRemainingStartForProgress"] [data-ops-convention-label]').innerText()).trim();
  await expect(page.locator('[data-ops-ss-lag-needs-convention]')).toContainText(a19Label);
  await page.locator('[data-ops-convention="p6UseRemainingStartForProgress"]').check();
  await expect(ssLag).toBeEnabled();

  // Onder MS Project staat C6 uit: het veld is uitgeschakeld (de waarde blijft staan).
  await page.locator('[data-ops-scheduling-profile-select]').selectOption('builtin:msproject');
  await expect(ssLag).toBeDisabled();
});

// Gebruikstest 24-09, bevinding B1: P6 → OPS → P6 gaf het profiel terug maar niet de datums — de solve
// schreef in uur-modus `scheduleFinish` terug, en de P6-conventies lazen die uitvoer daarna als het
// geplande bronvenster. Eindmijlpaal M1 stond dan op start 27-03, einde vóór de start, en Bereken
// herstelde het niet. Dezelfde fixture als `tests/planning/check-profile-switch-dates.ts` (daar staat de
// handafleiding: de wissel verschuift A1, A4 en M1, heen én terug).
const WORKWEEK = `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7]
  .map(n => `(0||${n}()(${n >= 2 && n <= 6 ? '(0||0(s|08:00|f|17:00)())' : ''}))`).join('')}))(0||Exceptions()())))`;
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

  const shiftedToast = page.locator('.ops-toast').filter({ hasText: /zijn 3 taken verschoven|3 tasks moved/ });
  // De tweede melding vouwt samen met de eerste (dedupe, "×2"); lees de telling en de herhaling uit.
  const shiftedNotice = () => page.evaluate(() => {
    const n = window.__OPS__!.store.getState().ui.notifications
      .find(x => x.messageKey === 'notifications.schedulingProfileShifted');
    return n ? [n.params?.count, n.count] : null;
  });
  const applyProfile = async (choice: string) => {
    await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
    await page.getByRole('button', { name: /^(Project info|Projectinfo)$/ }).first().click();
    await page.locator('[data-ops-scheduling-profile-select]').selectOption(choice);
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  };

  // Heen: drie taken verschoven, M1 eerder (een gewoon venster).
  await applyProfile('builtin:ops');
  await expect.poll(() => profileOf(page).then(p => p?.baseId)).toBe('ops');
  await expect.poll(m1).toEqual(['2026-03-20T12:00', '2026-03-20T12:00']);
  await expect(shiftedToast).toHaveCount(1);
  expect(await shiftedNotice()).toEqual([3, 1]);

  // Terug: hetzelfde profiel, dezelfde drie taken terug, en elk tijdveld gelijk aan de verse opening.
  await applyProfile('builtin:p6');
  await expect.poll(() => profileOf(page)).toEqual({ id: 'p6', baseId: 'p6', name: '' });
  await expect.poll(times).toBe(fresh);
  await expect(shiftedToast).toHaveCount(1);
  expect(await shiftedNotice()).toEqual([3, 2]);

  // Bereken verandert daarna niets meer.
  const calculate = page.locator('button.ribbon-btn').filter({ hasText: /^(Calculate|Bereken)$/ });
  await expect(calculate).toHaveCount(1);
  await calculate.click();
  expect(await times()).toBe(fresh);
  await expect.poll(m1).toEqual(['2026-03-27T17:00', '2026-03-27T17:00']);
});

// UI-voorstel conventiegroepen: de 26 conventies staan per thema, met de basiswaarde van het profiel,
// "terug naar basis" bij een afwijking, "per bestand" bij A19 en een uitklapbare uitleg per regel. De
// conventies die in elk ingebouwd profiel uit staan, staan in een eigen laatste groep; de P6-opties die
// alleen uit het bestand komen, staan alleen-lezen onderaan (B10).
test('rekenprofiel: conventies per thema met basiswaarde, terug naar basis en uitleg', async ({ page, ops: _ops }) => {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name: 'groepen.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(SS_LAG_XER) });
  await expect.poll(() => profileOf(page)).toEqual({ id: 'p6', baseId: 'p6', name: '' });
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
  await page.getByRole('button', { name: /^(Project info|Projectinfo)$/ }).first().click();

  // Alle 26 regels staan er, verdeeld over de groepen; A19 onder voortgang, C1 bij "alleen eigen profielen".
  await expect(page.locator('[data-ops-convention-row]')).toHaveCount(26);
  const a19 = page.locator('[data-ops-convention-group="completedWork"] [data-ops-convention-row="p6UseRemainingStartForProgress"]');
  await expect(a19).toHaveCount(1);
  await expect(page.locator('[data-ops-convention-group="ownProfilesOnly"] [data-ops-convention-row="p6CompletedPredecessorAtDataDate"]')).toHaveCount(1);
  await expect(page.locator('[data-ops-convention-group="msproject"] [data-ops-convention-row]')).toHaveCount(2);

  // A19 komt uit het bestand: per bestand gemarkeerd, basis uit, afwijkend.
  await expect(a19.locator('[data-ops-convention-per-file]')).toBeVisible();
  await expect(a19.locator('[data-ops-convention-base]')).toHaveText(/(basis|base): (uit|off)/);
  await expect(a19).toHaveAttribute('data-ops-convention-deviates', 'true');
  await expect(page.locator('[data-ops-convention-group="completedWork"] [data-ops-convention-group-deviating]')).toBeVisible();

  // Uitleg uitklappen en weer inklappen.
  await a19.locator('[data-ops-convention-help-toggle]').click();
  await expect(a19.locator('[data-ops-convention-help]')).toBeVisible();
  await a19.locator('[data-ops-convention-help-toggle]').click();
  await expect(a19.locator('[data-ops-convention-help]')).toHaveCount(0);

  // Terug naar basis: A19 uit, het profiel blijft het ingebouwde P6 (geen kopie), zonder "(aangepast)".
  await a19.locator('[data-ops-convention-reset]').click();
  await expect(page.locator('[data-ops-convention="p6UseRemainingStartForProgress"]')).not.toBeChecked();
  await expect(a19.locator('[data-ops-convention-reset]')).toHaveCount(0);
  const select = page.locator('[data-ops-scheduling-profile-select]');
  await expect(select).toHaveValue('builtin:p6');
  await expect(select.locator('option:checked')).toHaveText('Primavera P6');

  // Een gewone afwijking maakt een kopie en krijgt een eigen "terug naar basis".
  await page.locator('[data-ops-convention="clampNegativeFreeFloat"]').uncheck();
  await expect(page.locator('[data-ops-convention-row="clampNegativeFreeFloat"] [data-ops-convention-reset]')).toBeVisible();

  // De P6-opties uit het bestand staan alleen-lezen onderaan.
  await expect(page.locator('[data-ops-scheduling-source-option="useExpectedFinishDates"]')).toBeVisible();
});
