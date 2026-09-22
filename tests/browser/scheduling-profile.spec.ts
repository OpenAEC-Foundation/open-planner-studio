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
    await expect(page.locator('.ops-toast').filter({ hasText: /verschoof 1 taak|moved 1 task/ })).toHaveCount(1);
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
    await nameField.fill('Mijn profiel ');
    await expect(nameField).toHaveValue('Mijn profiel ');
    await expect(page.locator('[data-ops-scheduling-profile-name-required]')).toHaveCount(0);
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
    await expect.poll(() => profileOf(page).then(p => p?.name)).toBe('Mijn profiel');

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
    })).toEqual([projectNameBefore, 'Mijn profiel', undefined]);
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
