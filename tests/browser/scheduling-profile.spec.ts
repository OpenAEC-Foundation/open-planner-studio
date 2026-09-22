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
    await expect(page.locator('[data-ops-scheduling-profile-name]')).toHaveValue(/^(Kopie van|Copy of) Microsoft Project$/);
    await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
    await expect.poll(() => profileOf(page).then(p => [p?.baseId, p?.id.startsWith('prof')]))
      .toEqual(['msproject', true]);
  });
