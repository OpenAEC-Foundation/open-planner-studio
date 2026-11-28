import { readFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';
import { LOCALE_CASES, chooseLocale } from './fixtures/locale';

const SHOTS = process.env.OPS_PROFIELBLOK_SHOTS;

const XER = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tProfielblok\tC1\t2026-03-02\t2026-01-05',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tC1\tA1\tNiet gestart\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
  '%E',
].join('\n');

async function openFile(page: Page, name: string, content: string): Promise<void> {
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooser = page.waitForEvent('filechooser');
  await openButton.click();
  await (await chooser).setFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(content) });
}
async function toProjectInfo(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(File|Bestand)$/ }).first().click();
  await page.getByRole('button', { name: /^(Project settings|Projectinstellingen)$/ }).first().click();
  await expect(page.locator('[data-ops-scheduling-profile-section]')).toBeVisible();
}
const profileOf = (page: Page) => page.evaluate(() => {
  const p = window.__OPS__!.store.getState().project.schedulingProfile;
  return p ? { id: p.id, baseId: p.baseId, name: p.name, overrides: p.overrides } : null;
});
const earlyStart = (page: Page) => page.evaluate(() =>
  window.__OPS__!.store.getState().tasks.find(task => task.wbsCode === 'A1')?.time.earlyStart?.slice(0, 10));
const tooltip = (page: Page) => page.locator('.ops-tooltip[role="tooltip"]');
const select = (page: Page) => page.locator('[data-ops-scheduling-profile-select] .ops-select__trigger');

async function dutchForShots(page: Page): Promise<void> {
  if (!SHOTS) return;
  await page.setViewportSize({ width: 1280, height: 1300 });
  await chooseLocale(page, LOCALE_CASES.find(l => l.code === 'nl')!);
}
async function shoot(page: Page, target: Locator, name: string, scrollToTop = false, maxHeight = 1300): Promise<void> {
  if (!SHOTS) return;
  await page.evaluate(() => window.__OPS__!.store.setState(st => { st.ui.notifications = []; }));
  const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme);
  const viewport = page.viewportSize()!;
  if (scrollToTop) await target.evaluate(el => el.scrollIntoView({ block: 'start' }));
  const bottom = viewport.height - 40;
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), theme);
    await page.waitForTimeout(300);
    const b = (await target.boundingBox())!;
    const top = Math.max(b.y, 0);
    const clip = { x: Math.max(b.x, 0), y: top, width: Math.min(b.width, viewport.width), height: Math.min(b.y + b.height, bottom, top + maxHeight) - top };
    await page.screenshot({ path: `${SHOTS}/${name}-${theme === 'light' ? 'licht' : 'donker'}.png`, clip });
  }
  await page.evaluate(t => window.__OPS__!.store.getState().setUI({ uiTheme: t }), before);
}

test('profielblok: P6 ingeklapt en alleen-lezen, Nieuw profiel bewerkt en rekent, Ctrl+Z zet terug', async ({ page, ops: _ops }) => {
  await dutchForShots(page);
  await openFile(page, 'profielblok.xer', XER);
  await expect.poll(() => profileOf(page).then(p => p?.id)).toBe('p6');
  await expect.poll(() => earlyStart(page)).toBe('2026-03-02');
  await toProjectInfo(page);
  const section = page.locator('[data-ops-scheduling-profile-section]');

  const toggle = page.locator('[data-ops-conventions-toggle]');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-ops-conventions-count]')).toHaveText('(29)');
  await expect(page.locator('[data-ops-convention-row]')).toHaveCount(0);
  await expect(page.locator('[data-ops-conventions-deviating]')).toHaveCount(0);
  await shoot(page, section, 'p6-ingeklapt', true);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-ops-convention-row]')).toHaveCount(29);
  await expect(page.locator('[data-ops-convention]')).toHaveCount(0);
  await expect(page.locator('input[type="checkbox"][data-ops-convention]')).toHaveCount(0);
  await expect(page.locator('[data-ops-convention-reset]')).toHaveCount(0);
  await expect(page.locator('[data-ops-convention-value]')).toHaveCount(29);
  await expect(page.locator('[data-ops-conventions-readonly-note]')).toBeVisible();
  const a19 = page.locator('[data-ops-convention-row="p6UseRemainingStartForProgress"]');
  await expect(a19.locator('[data-ops-convention-value]')).toHaveAttribute('data-value', 'on');
  await expect(a19.locator('[data-ops-convention-value]')).toHaveText(/^(aan|on)$/i);
  const a23 = page.locator('[data-ops-convention-row="unstartedIgnoresStatusDate"]');
  await expect(a23.locator('[data-ops-convention-value]')).toHaveAttribute('data-value', 'off');

  await expect(a19.locator('[data-ops-convention-base]')).toHaveCount(0);

  const a19Info = a19.locator('[data-ops-convention-help]');
  const a19Help = await a19Info.getAttribute('title');
  expect(a19Help?.length ?? 0).toBeGreaterThan(20);
  const infos = page.locator('[data-ops-convention-help]');
  const helps = await infos.evaluateAll(els => els.map(el => [el.getAttribute('data-ops-convention-help'), el.getAttribute('title')]));
  await a19Info.hover();
  await expect(tooltip(page)).toHaveText(a19Help!);
  await shoot(page, section, 'p6-uitgeklapt-tooltip');

  expect(helps).toHaveLength(29);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toBeFocused();
  for (const [id, help] of helps) {
    await page.keyboard.press('Tab');
    await expect(page.locator(`[data-ops-convention-help="${id}"]`)).toBeFocused();
    await expect(tooltip(page)).toHaveText(help!);
    await page.waitForTimeout(150);
    await expect(tooltip(page)).toHaveText(help!);
  }

  const lastHelp = helps[helps.length - 1]![1]!;
  const lastInfo = infos.last();
  await expect(lastInfo).toBeFocused();
  const lastBox = (await lastInfo.boundingBox())!;
  await page.mouse.move(lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2);
  await page.mouse.move(lastBox.x + lastBox.width / 2, lastBox.y - 40);
  await page.waitForTimeout(150);
  await expect(lastInfo).toBeFocused();
  await expect(tooltip(page)).toHaveText(lastHelp);
  await expect(lastInfo).toHaveAttribute('aria-describedby', 'ops-tooltip-description');
  await infos.first().hover();
  await page.waitForTimeout(150);
  await expect(tooltip(page)).toHaveText(lastHelp);

  const described = await a19Info.evaluate(el => {
    (el as HTMLElement).focus();
    const id = el.getAttribute('aria-describedby');
    return { id, text: id ? document.getElementById(id)?.textContent : null };
  });
  expect(described).toEqual({ id: 'ops-tooltip-description', text: a19Help });
  await expect(tooltip(page)).toHaveText(a19Help!);
  await page.keyboard.press('Escape');
  await expect(tooltip(page)).toHaveCount(0);
  await expect(a19Info).toBeFocused();
  await expect(section).toBeVisible();
  await expect(a19Info).not.toHaveAttribute('aria-describedby', /./);
  await expect(a19Info).toHaveAttribute('title', a19Help!);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(tooltip(page)).toHaveText(a19Help!);
  await page.keyboard.press('Shift+Tab');
  await expect(tooltip(page)).not.toHaveText(a19Help!);
  await expect(a19Info).not.toHaveAttribute('aria-describedby', /./);
  await expect(a19Info).toHaveAttribute('title', a19Help!);

  await page.locator('[data-ops-scheduling-new-profile]').click();
  const dialog = page.locator('[data-ops-new-profile-dialog]');
  await expect(dialog).toBeVisible();
  const nameField = dialog.locator('[data-ops-new-profile-name]');
  await expect(nameField).toHaveValue(/^(Kopie van|Copy of) Primavera P6$/);
  await expect(nameField).toBeFocused();
  await dialog.locator('[data-ops-new-profile-cancel]').click();
  await expect(dialog).toHaveCount(0);
  await expect(select(page)).toHaveAttribute('data-value', 'builtin:p6');
  await expect(page.locator('[data-ops-convention]')).toHaveCount(0);

  await page.locator('[data-ops-scheduling-new-profile]').click();
  await nameField.fill('');
  await expect(dialog.locator('[data-ops-new-profile-create]')).toBeDisabled();
  await expect(dialog.locator('[data-ops-new-profile-name-required]')).toBeVisible();
  await nameField.pressSequentially('Aannemer zonder statusdatum');
  await nameField.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(select(page)).toHaveAttribute('data-value', 'current');
  await expect(select(page)).toHaveText('Aannemer zonder statusdatum');
  await expect(page.locator('[data-ops-scheduling-profile-name]')).toHaveValue('Aannemer zonder statusdatum');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('input[type="checkbox"][data-ops-convention]')).toHaveCount(29);
  await expect(page.locator('[data-ops-conventions-readonly-note]')).toHaveCount(0);
  await expect(page.locator('[data-ops-convention="p6UseRemainingStartForProgress"]')).toBeChecked();
  expect((await profileOf(page))?.id).toBe('p6');

  await page.locator('[data-ops-convention="unstartedIgnoresStatusDate"]').check();
  await expect(a23).toHaveAttribute('data-ops-convention-deviates', 'true');
  await expect(a23.locator('[data-ops-convention-reset]')).toBeVisible();
  await expect(page.locator('[data-ops-conventions-deviating]')).toHaveText(/(afwijkend|changed): 1/);
  await shoot(page, section, 'eigen-profiel-bewerken', true, 760);
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => profileOf(page)).toMatchObject({
    baseId: 'p6', name: 'Aannemer zonder statusdatum', overrides: { unstartedIgnoresStatusDate: true },
  });
  expect((await profileOf(page))?.id.startsWith('prof')).toBe(true);
  await expect.poll(() => earlyStart(page)).toBe('2026-01-05');

  await page.keyboard.press('Control+z');
  await expect.poll(() => profileOf(page).then(p => p?.id)).toBe('p6');
  await expect.poll(() => earlyStart(page)).toBe('2026-03-02');
});

async function openOldIfc(page: Page): Promise<void> {
  await openFile(page, 'oud.xer', XER);
  await expect.poll(() => profileOf(page).then(p => p?.id)).toBe('p6');
  await page.evaluate(() => {
    const s = window.__OPS__!.store;
    s.setState(draft => {
      draft.project.schedulingProfile = { baseId: 'p6', id: 'p6', name: '', overrides: { p6UseRemainingStartForProgress: false } };
    });
  });
  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const ifc = await readFile((await (await download).path())!, 'utf8');
  expect(ifc).toContain('OPS_SchedulingProfile');
  await page.evaluate(() => { window.__OPS__!.store.getState().newDocument(); });
  await openFile(page, 'oud-profiel.ifc', ifc);
  await expect.poll(() => profileOf(page)).toMatchObject({ id: 'p6', overrides: { p6UseRemainingStartForProgress: false } });
}

test('profielblok: een afwijking uit een oud bestand staat alleen-lezen en gaat mee naar Nieuw profiel', async ({ page, ops: _ops }) => {
  await openOldIfc(page);

  await toProjectInfo(page);
  await expect(select(page)).toHaveText(/^(Primavera P6 \(aangepast\)|Primavera P6 \(modified\))$/);
  await expect(page.locator('[data-ops-conventions-deviating]')).toHaveText(/(afwijkend|changed): 1/);
  await page.locator('[data-ops-conventions-toggle]').click();
  const a19 = page.locator('[data-ops-convention-row="p6UseRemainingStartForProgress"]');
  await expect(a19).toHaveAttribute('data-ops-convention-deviates', 'true');
  await expect(a19.locator('[data-ops-convention-value]')).toHaveAttribute('data-value', 'off');
  await expect(a19.locator('[data-ops-convention-reset]')).toHaveCount(0);
  await expect(page.locator('[data-ops-convention]')).toHaveCount(0);
  await expect(page.locator('[data-ops-conventions-readonly-note]')).toContainText(/(ouder bestand|older file)/);

  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => profileOf(page)).toMatchObject({ id: 'p6', overrides: { p6UseRemainingStartForProgress: false } });

  await toProjectInfo(page);
  await page.locator('[data-ops-scheduling-new-profile]').click();
  await page.locator('[data-ops-new-profile-create]').click();
  await expect(page.locator('[data-ops-convention="p6UseRemainingStartForProgress"]')).not.toBeChecked();
  await expect(a19).toHaveAttribute('data-ops-convention-deviates', 'true');
  await expect(a19.locator('[data-ops-convention-reset]')).toBeVisible();

  const modifiedOption = page.locator('[role="option"][data-value="modified"]');
  await select(page).click();
  await expect(modifiedOption).toHaveText(/^(Primavera P6 \(aangepast\)|Primavera P6 \(modified\))$/);
  await expect(page.locator('[role="option"][data-value="builtin:p6"]')).toHaveText('Primavera P6');
  await modifiedOption.click();
  await expect(page.locator('[data-ops-scheduling-bare-base-hint]')).toHaveCount(0);
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => profileOf(page)).toMatchObject({ id: 'p6', overrides: { p6UseRemainingStartForProgress: false } });

  await toProjectInfo(page);
  await chooseProfile(page, 'builtin:msproject');
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => profileOf(page)).toMatchObject({ id: 'msproject', overrides: { p6UseRemainingStartForProgress: false } });
  await toProjectInfo(page);
  await chooseProfile(page, 'builtin:p6');
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => profileOf(page)).toMatchObject({ id: 'p6', overrides: { p6UseRemainingStartForProgress: false } });

  await toProjectInfo(page);
  await chooseProfile(page, 'builtin:p6');
  await expect(page.locator('[data-ops-scheduling-bare-base-hint]')).toBeVisible();
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => profileOf(page).then(p => p?.overrides)).toEqual({});
  await page.keyboard.press('Control+z');
  await expect.poll(() => profileOf(page)).toMatchObject({ id: 'p6', overrides: { p6UseRemainingStartForProgress: false } });
});

const ROADS_XER = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tcritical_path_type',
  '%R\tP1\tRoads\tC1\t2026-03-02\t2026-01-05\tCT_DrivPath',
  '%T\tSCHEDOPTIONS', '%F\tproj_id\tsched_use_expect_end_flag\tsched_calendar_on_relationship_lag',
  '%R\tP1\tY\tRCAL_PREDECESSOR',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
  '%R\tT1\tP1\tC1\tA1\tNiet gestart\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
  '%E',
].join('\n');
const options = (page: Page) => page.evaluate(() => {
  const o = window.__OPS__!.store.getState().project.schedulingOptions;
  return { crit: o?.criticalDefinition?.mode, expect: o?.useExpectedFinishDates };
});
async function chooseProfile(page: Page, value: string): Promise<void> {
  await select(page).click();
  await page.locator(`[role="option"][data-value="${value}"]`).click();
}

test('profielblok: afwijkende reken-opties tonen een blok met kruisje en een knop naar de standaard', async ({ page, ops: _ops }) => {
  await dutchForShots(page);
  await toProjectInfo(page);
  await expect(page.locator('[data-ops-scheduling-options]')).toBeVisible();
  await expect(page.locator('[data-ops-options-deviate-notice]')).toHaveCount(0);
  await expect(page.locator('[data-ops-scheduling-apply-defaults]')).toHaveCount(0);
  const nearCritical = page.locator('[data-ops-near-critical-enable]');
  const offset = () => nearCritical.evaluate(el =>
    el.getBoundingClientRect().top - el.closest('[data-ops-scheduling-options]')!.getBoundingClientRect().top);
  const yBefore = await offset();
  await nearCritical.check();
  await expect(page.locator('[data-ops-near-critical-threshold]')).toBeVisible();
  await expect(page.locator('[data-ops-options-deviate-notice]')).toHaveCount(0);
  expect(await offset()).toBe(yBefore);
  await page.locator('[data-ops-project-info-discard]').click();
  await chooseProfile(page, 'builtin:p6');
  const notice = page.locator('[data-ops-options-deviate-notice]');
  await expect(notice).toBeVisible();
  await expect(notice.locator('[data-ops-options-deviation]')).toHaveCount(1);
  await expect(notice.locator('[data-ops-options-deviation]')).toHaveAttribute('data-ops-options-deviation', 'totalFloatMode');
  await expect(notice).not.toContainText(/(bestand|file)/);
  await page.locator('[data-ops-project-info-discard]').click();
  await expect(notice).toHaveCount(0);
  await page.locator('[data-ops-backstage-back]').click();

  await openFile(page, 'roads.xer', ROADS_XER);
  await expect.poll(() => options(page)).toEqual({ crit: 'longestPath', expect: true });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().project.schedulingOptions?.lagCalendar))
    .toBe('predecessor');
  await toProjectInfo(page);
  const lines = notice.locator('[data-ops-options-deviation]');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Primavera P6');
  await expect(lines).toHaveCount(1);
  await expect(lines.first()).toHaveAttribute('data-ops-options-deviation', 'criticalDefinition');
  await expect(lines.first()).toHaveText(/^(Kritiek-definitie: Langste pad \(standaard: totale speling ≤ 0 uur\)|Critical definition: Longest path \(default: total float ≤ 0 hours\))$/);
  await expect(notice).toContainText(/(geopende bestand|opened file)/);
  await shoot(page, page.locator('[data-ops-scheduling-options]'), 'afwijkende-opties-p6', true);
  const critSelect = page.getByRole('button', { name: /^(Kritiek-definitie|Critical definition)$/ });
  await critSelect.click();
  await page.getByRole('option', { name: /^(Totale speling ≤ drempel|Total float ≤ threshold)$/ }).click();
  await expect(notice).toHaveCount(0);
  await page.locator('[data-ops-project-info-discard]').click();
  await expect(lines).toHaveCount(1);

  await chooseProfile(page, 'builtin:msproject');
  await expect(notice).toContainText('Microsoft Project');
  await expect.poll(() => lines.evaluateAll(els => els.map(el => el.getAttribute('data-ops-options-deviation'))))
    .toEqual(['criticalDefinition', 'totalFloatMode']);
  await expect(lines.nth(1)).toHaveText(/^(Speling-berekening: Finishspeling \(standaard: Automatisch\)|Float calculation: Finish float \(default: Automatic\))$/);
  await chooseProfile(page, 'builtin:p6');
  await expect(lines).toHaveCount(1);

  await notice.locator('[data-ops-options-deviate-dismiss]').click();
  await expect(notice).toHaveCount(0);
  await page.locator('[data-ops-backstage-back]').click();
  await toProjectInfo(page);
  await expect(notice).toHaveCount(0);
  await chooseProfile(page, 'builtin:msproject');
  await expect(notice).toBeVisible();
  await chooseProfile(page, 'builtin:p6');
  await expect(notice).toHaveCount(0);
  await expect(page.locator('[data-ops-project-info-unapplied]')).toHaveCount(0);
  await page.locator('[data-ops-backstage-back]').click();

  await openFile(page, 'roads-opnieuw.xer', ROADS_XER);
  await expect.poll(() => options(page)).toEqual({ crit: 'longestPath', expect: true });
  await toProjectInfo(page);
  await expect(lines).toHaveCount(1);
  await notice.locator('[data-ops-scheduling-apply-defaults]').click();
  await expect(notice).toHaveCount(0);
  await chooseProfile(page, 'builtin:msproject');
  await expect(notice).toHaveCount(0);
  await chooseProfile(page, 'builtin:p6');
  await expect(page.getByRole('button', { name: /^(Kritiek-definitie|Critical definition)$/ })).toHaveText(/(Totale speling ≤ drempel|Total float ≤ threshold)/);
  await expect(page.locator('[data-ops-scheduling-source-option="useExpectedFinishDates"]')).toBeVisible();
  expect(await options(page)).toEqual({ crit: 'longestPath', expect: true });
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => options(page)).toEqual({ crit: 'totalFloat', expect: true });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  await toProjectInfo(page);
  await expect(notice).toHaveCount(0);
  await page.locator('[data-ops-backstage-back]').click();
  await page.keyboard.press('Control+z');
  await expect.poll(() => options(page)).toEqual({ crit: 'longestPath', expect: true });
});

test('i-icoon in een label: een klik toont de uitleg en laat het vinkje staan', async ({ page, ops: _ops }) => {
  await page.getByRole('button', { name: /^(View|Beeld)$/ }).click();
  await page.getByRole('button', { name: /^(New layout|Nieuwe layout)$/ }).click();
  const dialog = page.locator('[data-ops-layout-dialog]');
  const row = dialog.locator('[data-ops-layout-part-row="columns"]');
  const box = row.locator('[data-ops-layout-part="columns"]');
  const before = await box.isChecked();
  const info = row.locator('[data-tooltip-instant]');
  const help = await info.getAttribute('title');
  expect(help?.length ?? 0).toBeGreaterThan(5);
  await info.click();
  await expect(tooltip(page)).toHaveText(help!);
  expect(await box.isChecked()).toBe(before);
  await info.click();
  await expect(tooltip(page)).toHaveText(help!);
  expect(await box.isChecked()).toBe(before);
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('profielblok: een tik op het i-icoon toont de uitleg', async ({ page, ops: _ops }) => {
    await openFile(page, 'tik.xer', XER);
    await expect.poll(() => profileOf(page).then(p => p?.id)).toBe('p6');
    await toProjectInfo(page);
    await page.locator('[data-ops-conventions-toggle]').tap();
    const info = page.locator('[data-ops-convention-help="p6UseRemainingStartForProgress"]');
    const help = await info.getAttribute('title');
    await info.tap();
    await expect(tooltip(page)).toHaveText(help!);
    await page.locator('[data-ops-scheduling-title]').tap();
    await expect(tooltip(page)).toHaveCount(0);
  });
});

test('wizard: geen "(aangepast)" en geen afwijkingen uit het actieve document', async ({ page, ops: _ops }) => {
  await openOldIfc(page);
  await page.locator('[data-ops-tabstrip] .ops-tabstrip-add').click();
  await page.locator('[data-ops-new-project-choice]').click();
  const dialog = page.locator('[data-ops-project-dialog="new"]');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-ops-scheduling-profile-select] .ops-select__trigger').click();
  await expect(page.locator('[role="option"][data-value="modified"]')).toHaveCount(0);
  await page.locator('[role="option"][data-value="builtin:p6"]').click();
  await dialog.locator('input').first().fill('Wizardproject');
  await dialog.locator('[data-ops-project-primary]').click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().project.name)).toBe('Wizardproject');
  expect(await profileOf(page)).toMatchObject({ id: 'p6', overrides: {} });
});

test('tooltip: weg met zijn element, en Escape gaat daarna gewoon door', async ({ page, ops: _ops }) => {
  await openFile(page, 'weg.xer', XER);
  await toProjectInfo(page);
  const toggle = page.locator('[data-ops-conventions-toggle]');
  await toggle.click();
  const first = page.locator('[data-ops-convention-help]').first();
  await first.hover();
  await expect(tooltip(page)).toHaveCount(1);
  await expect(first).not.toBeFocused();
  await first.evaluate(el => el.remove());
  await expect(tooltip(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-ops-scheduling-profile-section]')).toHaveCount(0);
});
