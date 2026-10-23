// F2: taakdatums worden op D1/D2/D7-momenten vergeleken (§4.2); de echte handeling blijft gelijk.
// Het profielblok na de review van #169 (eigenaar, 2026-10-14), in de echte gebruikersflow:
//  1. een ingebouwd profiel is alleen-lezen (waarde als label, geen vinkje, geen "terug naar basis");
//  2. "Nieuw profiel" vraagt een naam in de app en maakt een bewerkbaar eigen profiel;
//  3. "Conventies van dit profiel" staat standaard ingeklapt;
//  4. de uitleg per conventie staat achter het i-icoon, met een tooltip bij hover en bij focus.
// Een .xer via de ribbonknop Openen en de bestandskiezer; daarna echte klikken en toetsen.
// `window.__OPS__` LEEST alleen de uitkomst, behalve één fixture: het oude-bestandgeval zet het profiel
// vóór het opslaan (zo'n afwijking is in de UI niet meer te maken) en opent het bestand daarna echt.
import { readFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';
import { LOCALE_CASES, chooseLocale } from './fixtures/locale';

// Schermbewijs (licht en donker) alleen als deze map is gezet.
const SHOTS = process.env.OPS_PROFIELBLOK_SHOTS;

// Statusdatum 2026-03-02, niet-gestarte taak gepland op 2026-01-05: onder P6 schuift hij naar de
// statusdatum; met A23 (`unstartedIgnoresStatusDate`) aan niet.
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

// Schermbewijs in het Nederlands (de eigenaar leest nl); de asserties accepteren nl en en.
async function dutchForShots(page: Page): Promise<void> {
  if (!SHOTS) return;
  await page.setViewportSize({ width: 1280, height: 1300 });
  await chooseLocale(page, LOCALE_CASES.find(l => l.code === 'nl')!);
}
async function shoot(page: Page, target: Locator, name: string, scrollToTop = false, maxHeight = 1300): Promise<void> {
  if (!SHOTS) return;
  // Meldingen weg (fixture), en alleen het zichtbare deel van het doel: een schermafbeelding van een
  // element buiten beeld wordt zwart.
  await page.evaluate(() => window.__OPS__!.store.setState(st => { st.ui.notifications = []; }));
  const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme);
  const viewport = page.viewportSize()!;
  if (scrollToTop) await target.evaluate(el => el.scrollIntoView({ block: 'start' }));
  const bottom = viewport.height - 40; // de statusbalk onderaan blijft buiten beeld
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

  // Ingeklapt: alleen de kop met het aantal regels, geen rijen.
  const toggle = page.locator('[data-ops-conventions-toggle]');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-ops-conventions-count]')).toHaveText('(28)');
  await expect(page.locator('[data-ops-convention-row]')).toHaveCount(0);
  await expect(page.locator('[data-ops-conventions-deviating]')).toHaveCount(0);
  await shoot(page, section, 'p6-ingeklapt', true);

  // Uitklappen: 28 regels, alleen-lezen — waarde als label, geen vinkje, geen "terug naar basis".
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-ops-convention-row]')).toHaveCount(28);
  await expect(page.locator('[data-ops-convention]')).toHaveCount(0);
  await expect(page.locator('input[type="checkbox"][data-ops-convention]')).toHaveCount(0);
  await expect(page.locator('[data-ops-convention-reset]')).toHaveCount(0);
  await expect(page.locator('[data-ops-convention-value]')).toHaveCount(28);
  await expect(page.locator('[data-ops-conventions-readonly-note]')).toBeVisible();
  const a19 = page.locator('[data-ops-convention-row="p6UseRemainingStartForProgress"]');
  await expect(a19.locator('[data-ops-convention-value]')).toHaveAttribute('data-value', 'on');
  await expect(a19.locator('[data-ops-convention-value]')).toHaveText(/^(aan|on)$/i);
  const a23 = page.locator('[data-ops-convention-row="unstartedIgnoresStatusDate"]');
  await expect(a23.locator('[data-ops-convention-value]')).toHaveAttribute('data-value', 'off');

  // Bij een ingebouwd profiel zegt AAN/UIT al de basis: geen "basis: …" zonder afwijking (review #350, punt 8).
  await expect(a19.locator('[data-ops-convention-base]')).toHaveCount(0);

  // Het i-icoon: de uitleg verschijnt meteen bij hover, zonder voorbereiding (ook als hover laat scrollen).
  const a19Info = a19.locator('[data-ops-convention-help]');
  const a19Help = await a19Info.getAttribute('title');
  expect(a19Help?.length ?? 0).toBeGreaterThan(20);
  // Alle uitlegteksten nu lezen, vóór een tooltip een title tijdelijk weghaalt.
  const infos = page.locator('[data-ops-convention-help]');
  const helps = await infos.evaluateAll(els => els.map(el => [el.getAttribute('data-ops-convention-help'), el.getAttribute('title')]));
  await a19Info.hover();
  await expect(tooltip(page)).toHaveText(a19Help!);
  await shoot(page, section, 'p6-uitgeklapt-tooltip');

  // Tab langs ALLE 27 i-iconen vanaf de kop van het deel, zonder voorbereiding: twee echte klikken op de
  // kop (dicht, open), de muis blijft daar staan, dan Tab. Elk icoon toont zijn eigen uitleg, ook als de
  // focus de lijst laat scrollen en de inhoud onder de muis wegschuift (review #350, punten 2 en 3).
  expect(helps).toHaveLength(28);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toBeFocused();
  for (const [id, help] of helps) {
    await page.keyboard.press('Tab');
    await expect(page.locator(`[data-ops-convention-help="${id}"]`)).toBeFocused();
    await expect(tooltip(page)).toHaveText(help!);
    // Chrome stuurt na een scroll pas iets later mouseout/mouseover onder de stilstaande muis: even
    // wachten, dan moet de tooltip er nog staan.
    await page.waitForTimeout(150);
    await expect(tooltip(page)).toHaveText(help!);
  }

  // Een tooltip die door focus kwam, blijft zolang zijn element de focus heeft: ook een hover over een
  // ander icoon vervangt hem niet (fixronde 2 punt 3).
  const lastHelp = helps[helps.length - 1]![1]!;
  // De muis over het icoon met focus en weer weg (mouse.move): de tooltip en aria-describedby blijven,
  // want de focus staat er nog (hercheck 2, mutant F1b op de focusbewaking in onOut).
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

  // Schermlezer (punt 6): direct na focus() — synchroon, vóór het bubbeltje er is — wijst
  // aria-describedby naar een element met de uitleg.
  const described = await a19Info.evaluate(el => {
    (el as HTMLElement).focus();
    const id = el.getAttribute('aria-describedby');
    return { id, text: id ? document.getElementById(id)?.textContent : null };
  });
  expect(described).toEqual({ id: 'ops-tooltip-description', text: a19Help });
  await expect(tooltip(page)).toHaveText(a19Help!);
  // Escape sluit alleen de tooltip: de focus blijft, Projectinfo blijft open, aria-describedby is weg
  // en het title-attribuut terug (mutanten T1 en T3).
  await page.keyboard.press('Escape');
  await expect(tooltip(page)).toHaveCount(0);
  await expect(a19Info).toBeFocused();
  await expect(section).toBeVisible();
  await expect(a19Info).not.toHaveAttribute('aria-describedby', /./);
  await expect(a19Info).toHaveAttribute('title', a19Help!);
  // Focus weg na opnieuw tonen ⇒ ook weg, zonder aria-describedby.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(tooltip(page)).toHaveText(a19Help!);
  await page.keyboard.press('Shift+Tab');
  await expect(tooltip(page)).not.toHaveText(a19Help!);
  await expect(a19Info).not.toHaveAttribute('aria-describedby', /./);
  await expect(a19Info).toHaveAttribute('title', a19Help!);

  // "Nieuw profiel": de naamvraag in de app, voorgevuld met "Kopie van Primavera P6". Annuleren doet niets.
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

  // Opnieuw, nu met een eigen naam: een lege naam kan niet, Enter maakt het profiel.
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
  // Het deel staat open, met vinkjes: dezelfde waarden als P6.
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('input[type="checkbox"][data-ops-convention]')).toHaveCount(28);
  await expect(page.locator('[data-ops-conventions-readonly-note]')).toHaveCount(0);
  await expect(page.locator('[data-ops-convention="p6UseRemainingStartForProgress"]')).toBeChecked();
  // Nog niets in de store: pas Toepassen telt.
  expect((await profileOf(page))?.id).toBe('p6');

  // A23 aanzetten (afwijking met "terug naar basis"), dan Toepassen ⇒ het project rekent met het eigen profiel.
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

  // Ctrl+Z: één stap terug naar Primavera P6 met de oude datum.
  await page.keyboard.press('Control+z');
  await expect.poll(() => profileOf(page).then(p => p?.id)).toBe('p6');
  await expect.poll(() => earlyStart(page)).toBe('2026-03-02');
});

// Fixture: een project met een P6-profiel dat een afwijking op het ingebouwde id draagt (A19 uit), zoals
// de migratie van een oud bestand dat geeft. Opslaan met Ctrl+S geeft het IFC; daarna echt openen.
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
  // Ook ingeklapt is de afwijking te zien in de kop.
  await expect(page.locator('[data-ops-conventions-deviating]')).toHaveText(/(afwijkend|changed): 1/);
  await page.locator('[data-ops-conventions-toggle]').click();
  const a19 = page.locator('[data-ops-convention-row="p6UseRemainingStartForProgress"]');
  await expect(a19).toHaveAttribute('data-ops-convention-deviates', 'true');
  await expect(a19.locator('[data-ops-convention-value]')).toHaveAttribute('data-value', 'off');
  await expect(a19.locator('[data-ops-convention-reset]')).toHaveCount(0);
  await expect(page.locator('[data-ops-convention]')).toHaveCount(0);
  await expect(page.locator('[data-ops-conventions-readonly-note]')).toContainText(/(ouder bestand|older file)/);

  // Toepassen zonder wijziging laat de afwijking staan (nooit stil weg).
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => profileOf(page)).toMatchObject({ id: 'p6', overrides: { p6UseRemainingStartForProgress: false } });

  // Nieuw profiel neemt de afwijking mee; daar is hij wel te wijzigen.
  await toProjectInfo(page);
  await page.locator('[data-ops-scheduling-new-profile]').click();
  await page.locator('[data-ops-new-profile-create]').click();
  await expect(page.locator('[data-ops-convention="p6UseRemainingStartForProgress"]')).not.toBeChecked();
  await expect(a19).toHaveAttribute('data-ops-convention-deviates', 'true');
  await expect(a19.locator('[data-ops-convention-reset]')).toBeVisible();

  // Review #350 punt 4: na Nieuw profiel staat het toegepaste "Primavera P6 (aangepast)" nog als eigen
  // regel in de lijst; die kiezen en toepassen geeft de afwijking terug, tot in de store.
  const modifiedOption = page.locator('[role="option"][data-value="modified"]');
  await select(page).click();
  await expect(modifiedOption).toHaveText(/^(Primavera P6 \(aangepast\)|Primavera P6 \(modified\))$/);
  await expect(page.locator('[role="option"][data-value="builtin:p6"]')).toHaveText('Primavera P6');
  await modifiedOption.click();
  await expect(page.locator('[data-ops-scheduling-bare-base-hint]')).toHaveCount(0);
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => profileOf(page)).toMatchObject({ id: 'p6', overrides: { p6UseRemainingStartForProgress: false } });

  // B14 (fixronde 2): P6 (aangepast) → Microsoft Project → Toepassen → Primavera P6 → Toepassen geeft de
  // afwijking terug, tot in de store. Een wissel naar een andere basis bewaart hem letterlijk.
  await toProjectInfo(page);
  await chooseProfile(page, 'builtin:msproject');
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => profileOf(page)).toMatchObject({ id: 'msproject', overrides: { p6UseRemainingStartForProgress: false } });
  await toProjectInfo(page);
  await chooseProfile(page, 'builtin:p6');
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => profileOf(page)).toMatchObject({ id: 'p6', overrides: { p6UseRemainingStartForProgress: false } });

  // De gewone regel "Primavera P6" naast "(aangepast)" (dezelfde basis) is de kale basis: dat zegt een
  // blok vóór Toepassen, en toepassen haalt de afwijking weg.
  await toProjectInfo(page);
  await chooseProfile(page, 'builtin:p6');
  await expect(page.locator('[data-ops-scheduling-bare-base-hint]')).toBeVisible();
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => profileOf(page).then(p => p?.overrides)).toEqual({});
  // Eén Ctrl+Z zet de afwijking terug.
  await page.keyboard.press('Control+z');
  await expect.poll(() => profileOf(page)).toMatchObject({ id: 'p6', overrides: { p6UseRemainingStartForProgress: false } });
});

// Het blok "afwijkende reken-opties" (eigenaar, 2026-10-14). Zoals Roads: een XER die kritiek rekent op
// het langste pad (`critical_path_type` = CT_DrivPath); de rest van de opties is de P6-standaard.
const ROADS_XER = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tcritical_path_type',
  '%R\tP1\tRoads\tC1\t2026-03-02\t2026-01-05\tCT_DrivPath',
  '%T\tSCHEDOPTIONS', '%F\tproj_id\tsched_use_expect_end_flag', '%R\tP1\tY',
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
  // Een nieuw project (OPS, geen opties) toont geen blok.
  await dutchForShots(page);
  await toProjectInfo(page);
  await expect(page.locator('[data-ops-scheduling-options]')).toBeVisible();
  await expect(page.locator('[data-ops-options-deviate-notice]')).toHaveCount(0);
  await expect(page.locator('[data-ops-scheduling-apply-defaults]')).toHaveCount(0);
  // Review #350 punt 1: eigen invoer in de velden laat geen blok verschijnen en verschuift niets.
  const nearCritical = page.locator('[data-ops-near-critical-enable]');
  // De plek t.o.v. het optiedeel (check() kan scrollen; de pagina-y zegt dan niets).
  const offset = () => nearCritical.evaluate(el =>
    el.getBoundingClientRect().top - el.closest('[data-ops-scheduling-options]')!.getBoundingClientRect().top);
  const yBefore = await offset();
  await nearCritical.check();
  await expect(page.locator('[data-ops-near-critical-threshold]')).toBeVisible();
  await expect(page.locator('[data-ops-options-deviate-notice]')).toHaveCount(0);
  expect(await offset()).toBe(yBefore);
  await page.locator('[data-ops-project-info-discard]').click();
  // Kies je in het formulier Primavera P6, dan wijken de toegepaste opties (geen) af van de P6-standaard:
  // het blok verschijnt, met een neutrale zin (de opties komen niet uit een bestand).
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
  await toProjectInfo(page);
  const lines = notice.locator('[data-ops-options-deviation]');
  // Onder P6 precies één regel: Kritiek-definitie, met de huidige waarde en de standaard. De bronoptie
  // (verwachte einddatums) telt niet mee.
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Primavera P6');
  await expect(lines).toHaveCount(1);
  await expect(lines.first()).toHaveAttribute('data-ops-options-deviation', 'criticalDefinition');
  await expect(lines.first()).toHaveText(/^(Kritiek-definitie: Langste pad \(standaard: totale speling ≤ 0 uur\)|Critical definition: Longest path \(default: total float ≤ 0 hours\))$/);
  // De opties komen uit een .xer (er is een bronoptie): het blok noemt het bestand.
  await expect(notice).toContainText(/(geopende bestand|opened file)/);
  await shoot(page, page.locator('[data-ops-scheduling-options]'), 'afwijkende-opties-p6', true);
  // Het blok vergelijkt de TOEGEPASTE opties: de kritiek-definitie in het formulier op de standaard
  // zetten laat het blok staan (geen verspringend formulier); Verwerpen zet de draft terug.
  const critSelect = page.getByRole('button', { name: /^(Kritiek-definitie|Critical definition)$/ });
  await critSelect.click();
  await page.getByRole('option', { name: /^(Totale speling ≤ drempel|Total float ≤ threshold)$/ }).click();
  // Fixronde 2 punt 4: wijken de opties in het formulier af van de toegepaste, dan wacht het blok (het
  // zou anders andere waarden noemen dan de velden). Verwerpen brengt het terug.
  await expect(notice).toHaveCount(0);
  await page.locator('[data-ops-project-info-discard]').click();
  await expect(lines).toHaveCount(1);

  // Een wissel naar Microsoft Project in het formulier vergelijkt meteen met die standaard.
  await chooseProfile(page, 'builtin:msproject');
  await expect(notice).toContainText('Microsoft Project');
  await expect.poll(() => lines.evaluateAll(els => els.map(el => el.getAttribute('data-ops-options-deviation'))))
    .toEqual(['criticalDefinition', 'totalFloatMode']);
  await expect(lines.nth(1)).toHaveText(/^(Speling-berekening: Finishspeling \(standaard: Automatisch\)|Float calculation: Finish float \(default: Automatic\))$/);
  await chooseProfile(page, 'builtin:p6');
  await expect(lines).toHaveCount(1);

  // Het kruisje verbergt het blok; terug naar de werkruimte en weer naar Projectinfo: het blijft weg.
  await notice.locator('[data-ops-options-deviate-dismiss]').click();
  await expect(notice).toHaveCount(0);
  await page.locator('[data-ops-backstage-back]').click();
  await toProjectInfo(page);
  await expect(notice).toHaveCount(0);
  // Een andere afwijking (de wissel naar MS Project geeft er een tweede) brengt het blok terug.
  await chooseProfile(page, 'builtin:msproject');
  await expect(notice).toBeVisible();
  await chooseProfile(page, 'builtin:p6');
  await expect(notice).toHaveCount(0);
  // De draft is weer gelijk aan het project: Terug vraagt niets.
  await expect(page.locator('[data-ops-project-info-unapplied]')).toHaveCount(0);
  await page.locator('[data-ops-backstage-back]').click();

  // Het bestand opnieuw openen (een nieuw document): het blok is terug. De knop zet de kritiek-definitie
  // in het formulier op de standaard, het blok verdwijnt, de bronoptie blijft; pas Toepassen rekent.
  await openFile(page, 'roads-opnieuw.xer', ROADS_XER);
  await expect.poll(() => options(page)).toEqual({ crit: 'longestPath', expect: true });
  await toProjectInfo(page);
  await expect(lines).toHaveCount(1);
  await notice.locator('[data-ops-scheduling-apply-defaults]').click();
  await expect(notice).toHaveCount(0);
  // Een profielwissel ná de knop: de draft-opties wijken nog af van de toegepaste, dus geen blok met
  // "Langste pad" naast een veld met "Totale speling" (fixronde 2 punt 4).
  await chooseProfile(page, 'builtin:msproject');
  await expect(notice).toHaveCount(0);
  await chooseProfile(page, 'builtin:p6');
  await expect(page.getByRole('button', { name: /^(Kritiek-definitie|Critical definition)$/ })).toHaveText(/(Totale speling ≤ drempel|Total float ≤ threshold)/);
  await expect(page.locator('[data-ops-scheduling-source-option="useExpectedFinishDates"]')).toBeVisible();
  expect(await options(page)).toEqual({ crit: 'longestPath', expect: true });
  await page.getByRole('button', { name: /^(Apply|Toepassen)$/ }).click();
  await expect.poll(() => options(page)).toEqual({ crit: 'totalFloat', expect: true });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  // Na Toepassen geldt de nieuwe toegepaste stand: geen afwijking meer, geen blok.
  await toProjectInfo(page);
  await expect(notice).toHaveCount(0);
  await page.locator('[data-ops-backstage-back]').click();
  // Eén undo-stap (B35).
  await page.keyboard.press('Control+z');
  await expect.poll(() => options(page)).toEqual({ crit: 'longestPath', expect: true });
});

// Review #350 punt 3 en mutant T2: in de layoutdialoog staat het i-icoon (een niet-focusbaar <span>) in
// het <label> van een onderdeel. Een klik toont de uitleg (mousedown sloot de hover-tooltip; alleen de
// klik toont hem weer) en zet het vinkje NIET om.
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

// Touchscreen: een tik op het i-icoon toont de uitleg; een tik ergens anders sluit hem.
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

// Fixronde 2 punt 2: de wizard Nieuw project neemt niets over van het actieve document, ook niet als dat
// een "Primavera P6 (aangepast)" uit een oud bestand is.
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

// Fixronde 2 punt 5: verdwijnt het element van een tooltip uit de DOM, dan ruimt de host de tooltip op en
// slikt hij de volgende Escape niet (die gaat naar Backstage). Het weghalen is een fixture (DOM). Een
// hover-tooltip, want bij een element met focus ruimt focusout al op.
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
