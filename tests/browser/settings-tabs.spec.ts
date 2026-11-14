// Het instellingenpaneel is ÉÉN gedeelde `SettingsPanelContent`-component op drie ingangen
// (tandwiel-popup, Instellingen-ribbontab, Backstage → Instellingen), opgebouwd uit één lijst
// (`settingsCatalog.tsx`): links de groepen, rechts de instellingen, bovenaan zoeken en "Alleen
// gewijzigd". Deze test bewijst dat alle drie de ingangen dezelfde groepen en instellingen tonen ná
// echte klikken, en loopt zoeken, terugzetten, het filter en de directe link door. Openen, sluiten,
// groep wisselen en de verborgen schakelaars gaan via echte DOM-interacties; de brug zet alleen
// fixtures en leest de opgeslagen keuzes.
import { expect, test, waitForOps, waitForWelcomeDialog } from './fixtures/ops';
import type { Locator, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const GROUP_LABELS: Record<string, RegExp> = {
  appearance: /^(Appearance|Uiterlijk)$/,
  notation: /^(Formats|Notatie)$/,
  timeline: /^(Timeline|Tijdlijn)$/,
  workspace: /^(Workspace|Werkruimte)$/,
  planning: /^(Scheduling|Planning)$/,
  notices: /^(Notices|Meldingen)$/,
  advanced: /^(Advanced|Geavanceerd)$/,
  about: /^(About|Over de app)$/,
};

// De instellingen per groep, in de vaste volgorde. Schermverdeling en Muiswiel per toets horen bij
// Tijdlijn maar staan pas in beeld bij hun scrollmodus; Experimenteel pas na ontgrendelen.
const GROUP_SETTINGS: Record<string, string[]> = {
  appearance: ['theme', 'language', 'fontFamily', 'fontScale'],
  notation: ['dateNotation', 'timeNotation', 'durationDisplay', 'weekStartDay'],
  timeline: ['compressNonWorkdays', 'quarterHourZoom', 'barSplitMode', 'scrollMode'],
  workspace: ['documentChrome', 'ribbonWheel', 'autoFitColumns'],
  planning: ['constructionMode', 'autoCalc', 'taskTypes', 'mixedDayHour'],
  notices: ['formatNotices'],
  advanced: ['aiMode', 'aiAutostart', 'debugTerminal', 'classicViewControls'],
  about: ['version', 'tour', 'stats', 'benchmark'],
};

const PROJECT_SECTION_TEXT = /^(Project|Project information\.\.\.|Projectinformatie\.\.\.)$/;

const group = (container: Locator, id: string) => container.locator(`[data-ops-settings-group="${id}"]`);
const rows = (container: Locator) => container.locator('[data-ops-setting]');

async function expectRows(container: Locator, ids: string[]): Promise<void> {
  await expect(rows(container)).toHaveCount(ids.length);
  for (let i = 0; i < ids.length; i++) {
    await expect(rows(container).nth(i)).toHaveAttribute('data-ops-setting', ids[i]);
  }
}

/** Doorloopt alle groepen binnen `container` en vergelijkt groepsnamen en instellingen. */
async function assertGroupsAndSettings(container: Locator): Promise<void> {
  const nav = container.locator('.settings-tab');
  const ids = Object.keys(GROUP_LABELS);
  await expect(nav).toHaveCount(ids.length);
  for (let i = 0; i < ids.length; i++) {
    await expect(nav.nth(i)).toHaveAttribute('data-ops-settings-group', ids[i]);
    await expect(nav.nth(i)).toHaveText(GROUP_LABELS[ids[i]]);
  }

  for (const id of ids) {
    await group(container, id).click();
    await expect(group(container, id)).toHaveAttribute('aria-current', 'page');
    await expect(container.locator('.settings-group-title')).toHaveText(GROUP_LABELS[id]);
    if (id === 'notation') {
      // B9: Duurweergave is grijs in het OPS-profiel, met de reden eronder; onder P6 kies je weer.
      const durationRow = container.locator('[data-ops-setting="durationDisplay"]');
      const hours = durationRow.getByRole('button', { name: /^(Always hours|Altijd uren)$/ });
      const page = container.page();
      await page.evaluate(() => window.__OPS__!.store.getState().setProject({
        schedulingProfile: { baseId: 'ops', id: 'ops', name: '', overrides: {} },
      }));
      await expect(hours).toBeDisabled();
      if (await container.locator('.modal-close-btn').count()) {
        for (const uiTheme of ['light', 'dark'] as const) {
          await page.evaluate(theme => window.__OPS__!.store.getState().setUI({ uiTheme: theme }), uiTheme);
          await durationRow.screenshot({ path: `artifacts/uren-f4a/duurweergave-ops-${uiTheme}.png` });
        }
      }
      await expect(durationRow.getByText(/^(In the OPS profile, each task shows its own unit\.|In het OPS-profiel toont elke taak zijn eigen maat\.)$/)).toBeVisible();
      await page.evaluate(() => window.__OPS__!.store.getState().setProject({
        schedulingProfile: { baseId: 'p6', id: 'p6', name: '', overrides: {} },
      }));
      await expect(hours).toBeEnabled();
      await hours.click();
      await expect(hours).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.durationDisplay)).toBe('hours');
      // Terug naar de standaard, zodat elke ingang met dezelfde stand begint.
      await durationRow.locator('[data-ops-setting-reset="durationDisplay"]').click();
      await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.durationDisplay)).toBe('auto');
    }
    await expectRows(container, GROUP_SETTINGS[id]);
  }

  // De sectie Project (issue-regel 1) is nergens meer te vinden — niet als groep, niet als
  // instelling, niet als de oude snelkoppelingsknop "Projectinformatie...".
  await expect(container.getByText(PROJECT_SECTION_TEXT, { exact: true })).toHaveCount(0);
}

/** Zoeken, "Alleen gewijzigd", terugzetten en de directe link, in de tandwiel-popup. */
async function assertSearchChangedAndDeepLink(dialog: Locator): Promise<void> {
  const page = dialog.page();
  const search = dialog.locator('[data-ops-settings-search]');
  // De dialoog zet de cursor meteen in de zoekbalk.
  await expect(search).toBeFocused();

  // Op naam, op een zoekwoord uit MS Project/P6 en zonder treffer.
  await search.fill('weekend');
  await expectRows(dialog, ['compressNonWorkdays']);
  await expect(dialog.locator('.settings-tab[aria-current]')).toHaveCount(0);
  await search.fill('task type');
  await expectRows(dialog, ['taskTypes']);
  // Een instelling die nu niets doet, staat bij zoeken uitgegrijsd in beeld, met de reden.
  await search.fill('Ctrl');
  await expect(dialog.locator('[data-ops-setting="modifierMap"] fieldset')).toBeDisabled();
  await expect(dialog.locator('[data-ops-setting="modifierMap"] .settings-unavailable-reason')).toBeVisible();
  await search.fill('qqqzzz');
  await expect(dialog.locator('[data-ops-settings-empty]')).toBeVisible();
  // Escape wist eerst de zoekterm; de dialoog blijft open en toont weer de groep.
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
  await expect(dialog).toBeVisible();
  await expect(group(dialog, 'appearance')).toHaveAttribute('aria-current', 'page');
  // "/" ergens in het paneel springt naar de zoekbalk.
  await group(dialog, 'timeline').click();
  await page.keyboard.press('/');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');

  // Een gewijzigde instelling krijgt een stip, ook bij haar groep, en telt mee in het filter.
  const filter = dialog.locator('[data-ops-settings-changed-only]');
  await expect(filter).toBeDisabled();
  const compress = dialog.locator('[data-ops-setting="compressNonWorkdays"]');
  await compress.getByRole('button', { name: /^(On|Aan)$/ }).click();
  await expect(compress.getByRole('checkbox')).toBeChecked();
  await expect(compress).toHaveAttribute('data-ops-setting-changed', 'true');
  await expect(group(dialog, 'timeline').locator('.settings-changed-dot')).toBeVisible();
  await expect(filter).toHaveText(/\(1\)$/);
  await filter.click();
  await expect(filter).toHaveAttribute('aria-pressed', 'true');
  await expectRows(dialog, ['compressNonWorkdays']);
  await compress.locator('[data-ops-setting-reset="compressNonWorkdays"]').click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.compressNonWorkdays)).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('ops-compressNonWorkdays'))).toBe('false');
  await expect(dialog.locator('[data-ops-settings-empty]')).toBeVisible();
  await filter.click();
  await expect(group(dialog, 'timeline').locator('.settings-changed-dot')).toHaveCount(0);

  // Directe link: opent op de groep, ook op een instelling die bij de huidige modus verborgen is,
  // en laat hem oplichten met de focus erin.
  await group(dialog, 'appearance').click();
  await page.evaluate(async () => {
    const path = '/src/components/settings/openSettingsAt.ts';
    const { openSettingsAt } = await import(/* @vite-ignore */ path);
    openSettingsAt('positionDivision');
  });
  const division = dialog.locator('[data-ops-setting="positionDivision"]');
  await expect(group(dialog, 'timeline')).toHaveAttribute('aria-current', 'page');
  await expect(division).toHaveClass(/is-highlighted/);
  await expect(division).toBeInViewport();
  // Schermverdeling doet in de modus Zoom + slepen niets: de rij zelf krijgt de focus.
  await expect(division).toBeFocused();
  await expect(division).not.toHaveClass(/is-highlighted/, { timeout: 5_000 });
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.settingsFocusId)).toBeNull();
}

/** Lees via dezelfde functie als de titelbalk, zonder de geteste actie te vervangen. */
async function enabledDemo(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const registryPath = '/src/utils/featureFlags.ts';
    const { isFeatureEnabled } = await import(/* @vite-ignore */ registryPath);
    return isFeatureEnabled(window.__OPS__!.store.getState().ui.featureFlags, 'demo-topbar-animation');
  });
}

async function reloadSettingsApp(page: Page): Promise<void> {
  await page.reload();
  await waitForOps(page);
  // `assertGroupsAndSettings` wisselt het rekenprofiel (het document is dan gewijzigd), dus na de
  // herlaad kan eerst het herstelvenster komen; de welkomst wacht daarop. Zelfde aanpak als
  // `settleAfterReload` in site-storage.spec.ts.
  const recovery = page.locator('[data-ops-recovery-dialog]');
  const welcome = page.locator('[data-ops-welcome-dialog]');
  await expect(recovery.or(welcome).first()).toBeAttached({ timeout: 15_000 });
  if (await recovery.count() > 0) {
    await recovery.getByRole('button', { name: /^(Don't restore|Niet herstellen)$/ }).click();
    await expect(recovery).toHaveCount(0);
  }
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false });
  });
}

test('de drie instellingen-ingangen delen groepen, zoeken en verborgen, bewaarde experimentele schakelaars', async ({ page, ops: _ops }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const titleBar = page.locator('.title-bar');
  const animation = titleBar.locator('[data-ops-topbar-animation]');
  expect(await enabledDemo(page)).toBe(false);
  await expect(animation).toHaveCount(0);
  await page.evaluate(async () => {
    const localePath = '/src/i18n/config.ts';
    const { setLocale } = await import(/* @vite-ignore */ localePath);
    await setLocale('en');
  });
  // 1) Tandwiel-popup (⚙) in de titelbalk.
  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  const gearDialog = page.locator('.settings-dialog');
  await expect(gearDialog).toBeVisible();
  await assertSearchChangedAndDeepLink(gearDialog);
  await assertGroupsAndSettings(gearDialog);
  await gearDialog.locator('.modal-close-btn').click();
  await expect(gearDialog).toBeHidden();

  // 2) Instellingen-ribbontab → knop "Instellingen"/"Settings" in de Project-lintgroep.
  await page.locator('.ribbon-tab').filter({ hasText: /^(Settings|Instellingen)$/ }).click();
  await page.locator('.ribbon-content').getByRole('button', { name: /^(App settings|App-instellingen)$/, exact: true }).click();
  const ribbonDialog = page.locator('.settings-dialog');
  await expect(ribbonDialog).toBeVisible();
  await assertGroupsAndSettings(ribbonDialog);
  await ribbonDialog.locator('.modal-close-btn').click();
  await expect(ribbonDialog).toBeHidden();

  // 3) Backstage (Bestand-tab) → navitem "Instellingen"/"Settings" — geen dialoog, direct in de body.
  await page.locator('.ribbon-tab--file').click();
  const backstage = page.locator('.backstage');
  await expect(backstage).toBeVisible();
  await backstage.locator('.backstage-nav-item').filter({ hasText: /^(App settings|App-instellingen)$/ }).click();
  await assertGroupsAndSettings(backstage.locator('.backstage-main'));

  // Taalfixture: dezelfde groepen en instellingen ook in het Nederlands.
  await page.evaluate(async () => {
    const localePath = '/src/i18n/config.ts';
    const { setLocale } = await import(/* @vite-ignore */ localePath);
    await setLocale('nl');
  });
  await assertGroupsAndSettings(backstage.locator('.backstage-main'));

  // Verborgen bediening: één losse klik en zelfs 6 s langzaam klikken (> 0,5 s ertussen)
  // ontgrendelen niet. De stilgezette Playwright-klok voorkomt echte wachttijd en grensflaky's.
  const backstageSettings = backstage.locator('.backstage-main');
  const version = backstageSettings.locator('[data-ops-settings-version]');
  const experimental = backstageSettings.locator('[data-ops-experimental-settings]');
  await version.scrollIntoViewIfNeeded();
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500));
  await version.click();
  await expect(experimental).toHaveCount(0);
  for (let i = 0; i < 12; i++) {
    await page.clock.runFor(501);
    await version.click();
  }
  await expect(experimental).toHaveCount(0);
  // Ook veel clicks zonder vijf seconden verstreken tijd zijn onvoldoende.
  await version.click({ clickCount: 12 });
  await expect(experimental).toHaveCount(0);

  // VERVOLG #549: focusverlies na 2 s breekt de reeks af. Focus en activering keren
  // al na 100 ms terug: alleen onBlur kan resetten, niet de pauzegrens van 500 ms.
  await page.clock.runFor(501);
  await version.click();
  for (let i = 0; i < 4; i++) {
    await page.clock.runFor(500);
    await version.click();
  }
  const beforeBlur = await page.evaluate(() => performance.now());
  await page.keyboard.press('Tab');
  await expect(version).not.toBeFocused();
  await page.clock.runFor(100);
  await page.keyboard.press('Shift+Tab');
  await expect(version).toBeFocused();
  await version.click();
  expect(await page.evaluate(() => performance.now()) - beforeBlur).toBe(100);
  // Precies 0,5 s is toegestaan. Vanaf de terugkeer zijn opnieuw volle 5 s nodig.
  for (let i = 0; i < 9; i++) {
    await page.clock.runFor(500);
    await version.click();
  }
  await expect(experimental).toHaveCount(0);
  await page.clock.runFor(500);
  await version.click();
  await expect(experimental).toBeVisible();
  await expect(experimental).toContainText('Demo: animatie in de bovenbalk');
  // Elke echte flag is kiesbaar, ook ifcForeignContent met de technische IFC-markering.
  await expect(experimental.getByRole('checkbox')).toHaveCount(2);
  expect(await page.evaluate(() => localStorage.getItem('ops-experimentalSettingsVisible'))).toBe('true');
  await page.clock.resume();

  // Hetzelfde ontgrendelde blok staat in de tandwiel-popup, met alle echte flags.
  await backstage.locator('[data-ops-backstage-back]').click();
  expect(await enabledDemo(page)).toBe(false);
  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  await group(gearDialog, 'about').click();
  const gearExperimental = gearDialog.locator('[data-ops-experimental-settings]');
  const demo = gearExperimental.locator('[data-ops-feature-flag="demo-topbar-animation"]');
  await expect(gearExperimental).toBeVisible();
  await expect(demo).not.toBeChecked();
  await expect(gearExperimental.getByRole('checkbox')).toHaveCount(2);
  await expect(gearExperimental.locator('[data-ops-feature-flag="ifcForeignContent"]')).not.toBeChecked();
  await demo.check();
  expect(await enabledDemo(page)).toBe(true);
  await expect(animation).toBeVisible();
  await expect(animation).toHaveAttribute('aria-hidden', 'true');
  await expect(animation).toHaveCSS('pointer-events', 'none');
  await expect(titleBar).toHaveAttribute('data-tauri-drag-region', 'true');
  await expect(titleBar).toHaveCSS('-webkit-app-region', 'drag');
  await expect.poll(() => animation.evaluate(el => getComputedStyle(el, '::before').animationName))
    .toBe('title-bar-demo-sweep');

  // Echte themakeuze: het nieuwe blok past in zowel Light als Dark, met de bestaande kleurrollen.
  for (const theme of ['light', 'dark']) {
    await group(gearDialog, 'appearance').click();
    await gearDialog.locator(`[data-ops-theme-card="${theme}"]`).click();
    await group(gearDialog, 'about').click();
    await expect(demo).toBeChecked();
    await expect(animation).toBeVisible();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => animation.evaluate(el => getComputedStyle(el, '::before').animationName))
      .toBe('none');
    await gearExperimental.scrollIntoViewIfNeeded();
    expect(await gearDialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/experimental-settings-${theme}.png` });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => animation.evaluate(el => getComputedStyle(el, '::before').animationName))
      .toBe('title-bar-demo-sweep');
  }

  // Beide RTL-talen spiegelen de glans. Ook dan blijft de echte titelbalkknop bereikbaar.
  for (const locale of ['ar', 'fa']) {
    await page.evaluate(async language => {
      const localePath = '/src/i18n/config.ts';
      const { setLocale } = await import(/* @vite-ignore */ localePath);
      await setLocale(language);
    }, locale);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(animation).toHaveCSS('--demo-sweep-end', '-300%');
    await gearDialog.locator('.modal-close-btn').click();
    await expect(gearDialog).toBeHidden();
    await titleBar.locator('.quick-access-btn').last().click();
    await expect(gearDialog).toBeVisible();
    await group(gearDialog, 'about').click();
    await expect(demo).toBeChecked();
  }
  await page.evaluate(async () => {
    const localePath = '/src/i18n/config.ts';
    const { setLocale } = await import(/* @vite-ignore */ localePath);
    await setLocale('nl');
  });
  await expect(animation).toHaveCSS('--demo-sweep-end', '300%');

  // Verbergen bewaart de keuzes en verbergt ook na een echte reload.
  await gearExperimental.getByRole('button', { name: /^(Hide|Verbergen)$/ }).click();
  await expect(gearExperimental).toHaveCount(0);
  expect(await enabledDemo(page)).toBe(true);
  await expect(animation).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ops-experimentalSettingsVisible'))).toBe('false');
  await reloadSettingsApp(page);
  await expect.poll(() => enabledDemo(page)).toBe(true);
  await expect(animation).toBeVisible();
  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  await group(gearDialog, 'about').click();
  await expect(gearExperimental).toHaveCount(0);

  // Via echte Tab/Shift+Tab naar het versienummer. Enter blijft ingedrukt: volgende down-events
  // zijn native repeat-events. Er is geen synthetische dispatchEvent of store-ontgrendeling.
  const gearVersion = gearDialog.locator('[data-ops-settings-version]');
  await gearVersion.click();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(gearVersion).toBeFocused();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500));
  await page.keyboard.down('Enter');
  for (let i = 0; i < 9; i++) {
    await page.clock.runFor(500);
    await page.keyboard.down('Enter');
  }
  await expect(gearExperimental).toHaveCount(0);
  await page.clock.runFor(500);
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await expect(gearExperimental).toBeVisible();
  await expect(demo).toBeChecked();
  await page.clock.resume();
  await gearDialog.locator('.modal-close-btn').click();

  // De lint-ingang en Backstage delen de zichtbaarheid en de aangevinkte keuze.
  await page.locator('.ribbon-tab').filter({ hasText: /^(Settings|Instellingen)$/ }).click();
  await page.locator('.ribbon-content').getByRole('button', { name: /^(App settings|App-instellingen)$/, exact: true }).click();
  await group(ribbonDialog, 'about').click();
  await expect(ribbonDialog.locator('[data-ops-feature-flag="demo-topbar-animation"]')).toBeChecked();
  await ribbonDialog.locator('.modal-close-btn').click();
  await page.locator('.ribbon-tab--file').click();
  await backstage.locator('.backstage-nav-item').filter({ hasText: /^(App settings|App-instellingen)$/ }).click();
  await group(backstage, 'about').click();
  await expect(backstage.locator('[data-ops-feature-flag="demo-topbar-animation"]')).toBeChecked();

  // Ook de ontgrendelde zichtbaarheid zelf overleeft herladen; geen tweede gebaar nodig.
  await reloadSettingsApp(page);
  await expect.poll(() => enabledDemo(page)).toBe(true);
  await expect(animation).toBeVisible();
  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  await group(gearDialog, 'about').click();
  await expect(demo).toBeChecked();

  // Echt uitvinken verwijdert de laag direct en bewaart ook die keuze na herladen.
  await demo.uncheck();
  expect(await enabledDemo(page)).toBe(false);
  await expect(animation).toHaveCount(0);
  await reloadSettingsApp(page);
  await expect.poll(() => enabledDemo(page)).toBe(false);
  await expect(animation).toHaveCount(0);
  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  await group(gearDialog, 'about').click();
  await expect(demo).not.toBeChecked();
  // De echte IFC-schakelaar bestuurt de bytes-route; schrijven blijft door de bestaande guard begrensd.
  const ifcToggle = gearExperimental.locator('[data-ops-feature-flag="ifcForeignContent"]');
  await expect(ifcToggle).not.toBeChecked();
  await ifcToggle.check();
  await expect(ifcToggle).toBeChecked();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.featureFlags.ifcForeignContent)).toBe(true);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ops-featureFlags') ?? '{}').ifcForeignContent)).toBe(true);
  await gearDialog.locator('.modal-close-btn').click();

  // De brug zet alleen een geopende bestandsfixture. Ctrl+S is de echte gebruikershandeling.
  // De eigen planning wordt na openen niet bewerkt: ook dan moet de doelcontrole schrijven toelaten.
  for (const fixture of [
    { path: 'tests/fixtures/ifc-foreign/bonsai-4d.ifc', foreign: true },
    { path: 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc', foreign: true },
    { path: 'public/examples/03-kantoorgebouw-zuidas.ifc', foreign: false },
  ]) {
    const text = await readFile(fixture.path, 'utf8');
    const before = await page.evaluate(async ({ text, name }) => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(name, { create: true });
      const writer = await handle.createWritable();
      await writer.write(text);
      await writer.close();
      await window.__OPS__!.store.getState().openOpenedFile({
        name, content: '', bytes: new TextEncoder().encode(text), ref: { kind: 'handle', handle },
      });
      const state = window.__OPS__!.store.getState();
      const guardPath = '/src/state/ifcForeignGuard.ts';
      const { ifcSaveBlocked } = await import(/* @vite-ignore */ guardPath);
      return {
        foreign: state.ifcSource?.foreign, blocked: ifcSaveBlocked(state), dirty: state.isDirty,
        tasks: JSON.stringify(state.tasks), modified: (await handle.getFile()).lastModified,
      };
    }, { text, name: fixture.path.split('/').pop()! });
    expect(before.foreign, fixture.path).toBe(fixture.foreign);
    expect(before.blocked, fixture.path).toBe(fixture.foreign);
    if (!fixture.foreign) expect(before.dirty, fixture.path).toBe(false);
    await page.keyboard.press('Control+s');
    if (fixture.foreign) {
      await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
        .filter(n => n.messageKey === 'notifications.ifcForeignReplaceBlocked' || n.messageKey === 'notifications.ifcForeignMergeRefused').length)).toBeGreaterThan(0);
      expect(await page.evaluate(async () => (await window.__OPS__!.store.getState().fileHandle!.getFile()).text())).toBe(text);
    } else {
      await expect.poll(() => page.evaluate(async () =>
        (await window.__OPS__!.store.getState().fileHandle!.getFile()).lastModified)).toBeGreaterThan(before.modified);
      expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.notifications.filter(n => n.refusal))).toEqual([]);
    }
    expect(await page.evaluate(() => JSON.stringify(window.__OPS__!.store.getState().tasks))).toBe(before.tasks);
    if (fixture.path.endsWith('eigen-plus-model.ifc')) {
      // De fixture en selectie via de brug; duur bewerken, Opslaan als en heropenen via echte bediening.
      const task = await page.evaluate(() => {
        const state = window.__OPS__!.store.getState();
        const task = state.tasks.find(t => !t.childIds.length && !t.isMilestone)!;
        state.selectTask(task.id);
        state.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
        const source = state.ifcSource!;
        const foreign = Array.from(source.classes, (kind, i) => ({ kind, i })).filter(c => c.kind > 1).map(({ i }) => ({
          id: source.chunkIds[i],
          bytes: btoa(String.fromCharCode(...source.bytes.subarray(source.chunkStarts[i], source.chunkStarts[i + 1]))),
        }));
        return { id: task.id, duration: task.time.scheduleDuration, foreign };
      });
      const duration = page.locator('[data-ops-task-duration] [data-ops-duration-value]').first();
      await expect(duration).toBeVisible();
      await duration.fill(String(task.duration + 1));
      await duration.press('Enter');
      await expect.poll(() => page.evaluate(id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration, task.id)).toBe(task.duration + 1);
      await page.keyboard.press('F5');
      // De eerdere Ctrl+S-weigeringen en openingsmeldingen eerst echt sluiten: zij kunnen de exportkaart bedekken.
      while (await page.locator('[data-ops-toast-close]').count()) {
        await page.locator('[data-ops-toast-close]').last().click();
      }
      // Eerst de echte IFC-export: volledig downloaden en heropenen, zonder documentcommit.
      const beforeExport = await page.evaluate(() => {
        const state = window.__OPS__!.store.getState();
        return { path: state.filePath, dirty: state.isDirty, sha256: state.ifcSource!.sha256 };
      });
      await page.getByRole('button', { name: /^(File|Bestand)$/ }).click();
      await page.locator('.backstage-sidebar').getByRole('button', { name: /^(Export|Exporteren)$/ }).click();
      const exportedEvent = page.waitForEvent('download');
      await page.locator('.backstage-export-card').filter({ has: page.getByRole('heading', { name: /^IFC/ }) }).first().click();
      const exported = await exportedEvent;
      expect(await page.evaluate(() => {
        const state = window.__OPS__!.store.getState();
        return { path: state.filePath, dirty: state.isDirty, sha256: state.ifcSource!.sha256 };
      })).toEqual(beforeExport);
      const exportChooser = page.waitForEvent('filechooser');
      await page.keyboard.press('Control+o');
      await (await exportChooser).setFiles({ name: exported.suggestedFilename(), mimeType: 'application/octet-stream',
        buffer: await readFile((await exported.path())!) });
      await expect.poll(() => page.evaluate(id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)?.time.scheduleDuration, task.id)).toBe(task.duration + 1);
      const exportChunks = await page.evaluate(() => {
        const source = window.__OPS__!.store.getState().ifcSource!;
        return Array.from(source.classes, (kind, i) => ({ kind, i })).filter(c => c.kind > 1).map(({ i }) => ({
          id: source.chunkIds[i], bytes: btoa(String.fromCharCode(...source.bytes.subarray(source.chunkStarts[i], source.chunkStarts[i + 1]))),
        }));
      });
      expect(exportChunks).toEqual(task.foreign);
      const downloadEvent = page.waitForEvent('download');
      await page.keyboard.press('Control+Shift+s');
      const download = await downloadEvent;
      const downloadedPath = (await download.path())!;
      const chooserEvent = page.waitForEvent('filechooser');
      await page.keyboard.press('Control+o');
      await (await chooserEvent).setFiles({ name: download.suggestedFilename(), mimeType: 'application/octet-stream', buffer: await readFile(downloadedPath) });
      await expect.poll(() => page.evaluate(id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)?.time.scheduleDuration, task.id)).toBe(task.duration + 1);
      const reopened = await page.evaluate(() => {
        const source = window.__OPS__!.store.getState().ifcSource!;
        return { foreign: source.foreign, chunks: Array.from(source.classes, (kind, i) => ({ kind, i }))
          .filter(c => c.kind > 1).map(({ i }) => ({ id: source.chunkIds[i],
            bytes: btoa(String.fromCharCode(...source.bytes.subarray(source.chunkStarts[i], source.chunkStarts[i + 1]))),
          })) };
      });
      expect(reopened.foreign).toBe(true);
      expect(reopened.chunks).toEqual(task.foreign);
    }

  }

});
