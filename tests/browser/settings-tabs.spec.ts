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
  planning: ['constructionMode', 'autoCalc', 'taskTypes', 'mixedDayHour', 'dissolveSummaryMode'],
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

/**
 * Elke zichtbare knop- en labeltekst in een instelling vindt die instelling via de zoekbalk. Zo valt
 * een eigen bediening die haar teksten niet aan de zoekindex geeft meteen op (review #942).
 */
async function assertVisibleTextsFindTheirSetting(dialog: Locator): Promise<void> {
  const search = dialog.locator('[data-ops-settings-search]');
  for (const g of Object.keys(GROUP_SETTINGS)) {
    await search.fill('');
    await group(dialog, g).click();
    const rows = await dialog.locator('[data-ops-setting]').evaluateAll(els => els.map(el => ({
      id: el.getAttribute('data-ops-setting')!,
      // Bij een kaart met plaatje telt de naam eronder, niet de tekst in het plaatje.
      texts: [...el.querySelectorAll<HTMLElement>('button:not(.settings-visual-card), label, .settings-visual-card-label')]
        .filter(e => e.offsetParent !== null)
        .map(e => e.innerText.replace(/\s+/g, ' ').trim())
        // Aan/Uit onder een schakelaar is geen naam om op te zoeken.
        .filter(text => text !== '' && !/^(On|Off)$/.test(text)),
    })));
    for (const { id, texts } of rows) {
      for (const text of texts) {
        await search.fill(text);
        await expect(dialog.locator(`[data-ops-setting="${id}"]`), `zoeken op "${text}"`).toBeVisible();
      }
    }
  }
  await search.fill('');
  await group(dialog, 'appearance').click();
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
  await expect(dialog.locator('[data-ops-setting="modifierMap"] fieldset button').first()).toBeDisabled();
  await expect(dialog.locator('[data-ops-setting="modifierMap"] .settings-unavailable-reason')).toBeVisible();
  await assertVisibleTextsFindTheirSetting(dialog);
  await search.click();
  // Ook keuzes binnen een eigen bediening: de schakelaar onder Thema en de namen van de talen.
  await search.fill('follow system');
  await expect(dialog.locator('[data-ops-setting="theme"]')).toBeVisible();
  await search.fill('Nederlands');
  await expectRows(dialog, ['language']);
  // En de veld- en toetsnamen van Muiswiel per toets (uitgegrijsd zolang Toetsen niet gekozen is).
  await search.fill('Ctrl + scroll');
  await expect(dialog.locator('[data-ops-setting="modifierMap"]')).toBeVisible();
  await search.fill('horizontal');
  await expect(dialog.locator('[data-ops-setting="modifierMap"]')).toBeVisible();
  await search.fill('qqqzzz');
  await expect(dialog.locator('[data-ops-settings-empty]')).toBeVisible();
  // Escape wist eerst de zoekterm; de dialoog blijft open en toont weer de groep.
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
  await expect(dialog).toBeVisible();
  await expect(group(dialog, 'appearance')).toHaveAttribute('aria-current', 'page');
  // "/" ergens in het paneel springt naar de zoekbalk, ook vanaf een vinkje; Ctrl+F ook vanaf de
  // sluitknop in de kop van de dialoog.
  await group(dialog, 'timeline').click();
  await page.keyboard.press('/');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await dialog.locator('[data-ops-setting="quarterHourZoom"]').getByRole('checkbox').focus();
  await page.keyboard.press('/');
  await expect(search).toBeFocused();
  await dialog.locator('.modal-close-btn').focus();
  await page.keyboard.press('Control+f');
  await expect(search).toBeFocused();

  // Een gewijzigde instelling krijgt een stip (alleen bij de instelling, niet bij haar groep) en telt
  // mee in het filter. De fixture zet de formaatuitleg al uit (`ops-formatNoticeHidden`), dus die telt vanaf het begin mee.
  const filter = dialog.locator('[data-ops-settings-changed-only]');
  await expect(filter).toHaveText(/\(1\)$/);
  const compress = dialog.locator('[data-ops-setting="compressNonWorkdays"]');
  await compress.getByRole('button', { name: /^(On|Aan)$/ }).click();
  await expect(compress.getByRole('checkbox')).toBeChecked();
  await expect(compress).toHaveAttribute('data-ops-setting-changed', 'true');
  await expect(compress.locator('.settings-changed-dot')).toBeVisible();
  await expect(group(dialog, 'timeline').locator('.settings-changed-dot')).toHaveCount(0);
  await expect(filter).toHaveText(/\(2\)$/);
  await filter.click();
  await expect(filter).toHaveAttribute('aria-pressed', 'true');
  await expectRows(dialog, ['compressNonWorkdays', 'formatNotices']);
  await compress.locator('[data-ops-setting-reset="compressNonWorkdays"]').click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.compressNonWorkdays)).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('ops-compressNonWorkdays'))).toBe('false');
  await expectRows(dialog, ['formatNotices']);
  await expect(filter).toHaveText(/\(1\)$/);
  await filter.click();

  // Het thema telt ook mee: zonder bewaarde keuze start de app Donker.
  await group(dialog, 'appearance').click();
  const theme = dialog.locator('[data-ops-setting="theme"]');
  await expect(theme).not.toHaveAttribute('data-ops-setting-changed', 'true');
  await theme.locator('[data-ops-theme-card="light"]').click();
  await expect(theme).toHaveAttribute('data-ops-setting-changed', 'true');
  await expect(filter).toHaveText(/\(2\)$/);
  await theme.locator('[data-ops-setting-reset="theme"]').click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme)).toBe('dark');
  expect(await page.evaluate(() => localStorage.getItem('ops-theme'))).toBe('dark');
  await expect(filter).toHaveText(/\(1\)$/);

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
  // Het oplichten stopt; de rij blijft in beeld tot je een andere groep kiest.
  await expect(division).not.toHaveClass(/is-highlighted/, { timeout: 5_000 });
  await expect(division).toBeVisible();
  await group(dialog, 'appearance').click();
  await group(dialog, 'timeline').click();
  await expect(division).toHaveCount(0);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.settingsFocusId)).toBeNull();

  // Een link naar het vergrendelde blok Experimenteel toont het niet, maar landt op het versienummer.
  await page.evaluate(async () => {
    const path = '/src/components/settings/openSettingsAt.ts';
    const { openSettingsAt } = await import(/* @vite-ignore */ path);
    openSettingsAt('experimental');
  });
  await expect(group(dialog, 'about')).toHaveAttribute('aria-current', 'page');
  await expect(dialog.locator('[data-ops-setting="version"]')).toHaveClass(/is-highlighted/);
  await expect(dialog.locator('[data-ops-setting="experimental"]')).toHaveCount(0);
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
  // Lange route: drie ingangen, twee talen en een zoekopdracht per zichtbare tekst van elke instelling.
  test.setTimeout(120_000);
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
  // Ctrl+F werkt ook als de focus nog op de navigatie van Backstage staat. Eerst wachten tot het
  // paneel er staat: in CI drukte de test soms vóór het paneel geladen was (geen gebruikersgeval).
  const backstageSearch = backstage.locator('[data-ops-settings-search]');
  await expect(backstageSearch).toBeVisible();
  await expect(backstage.locator('.backstage-nav-item').filter({ hasText: /^(App settings|App-instellingen)$/ })).toBeFocused();
  await page.keyboard.press('Control+f');
  await expect(backstageSearch).toBeFocused();
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
  // Knownbug 1131 stap 2: de handle uit OPFS is een echte bestandshandle van Chromium. Ctrl+S op het eigen bestand
  // met een gebouwmodel weigert niet meer vóór de merge; ongewijzigd schrijft de app de bronbytes zelf terug.
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
    // #804 stap 4: de opslagworker (nog door geen opslagroute gebruikt) laadt als echte Vite-worker en rekent voor dit
    // document hetzelfde als de hoofdthread: de merge byte voor byte, de gewone writer op de schrijftijd na.
    const parity = await page.evaluate(async () => {
      const paths = ['/src/state/prepareIfcOutput.ts', '/src/state/ifcSaveInput.ts', '/src/services/ifc/saveWorker/ifcSaveWorker.ts'];
      const [{ prepareIfcOutput }, { buildWriteIFCInput }, { createIfcSaveWorker, defaultCreateIfcSaveWorker }] =
        await Promise.all(paths.map(path => import(/* @vite-ignore */ path)));
      let started = false, answers = 0;
      const saveWorker = createIfcSaveWorker({ createWorker: () => {
        const port = defaultCreateIfcSaveWorker() as Worker;
        port.addEventListener('message', (event: MessageEvent) => { if ('started' in event.data) started = true; else answers++; });
        return port;
      } });
      const state = window.__OPS__!.store.getState();
      const input = buildWriteIFCInput(state, 'merge');
      const viaWorker = await prepareIfcOutput(state, input, undefined, saveWorker.compute);
      const main = await prepareIfcOutput(state, input);
      saveWorker.dispose();
      const hex = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)),
        b => b.toString(16).padStart(2, '0')).join('');
      // Alleen de schrijftijd gelijkmaken, zoals check-recovery-worker.ts: kop en owner history.
      const timeless = (ifc: string) => {
        const stamp = /^FILE_NAME\('[^']*','([^']*)'/m.exec(ifc)?.[1];
        return new TextEncoder().encode((stamp ? ifc.split(`'${stamp}'`).join("'<tijd>'") : ifc)
          .replace(/^(#\d+=IFCOWNERHISTORY\((?:[^,]*,){7})\d+\)/m, '$1<tijd>)'));
      };
      return {
        started, answers, merge: !!main.prepared, sourceIntact: !state.ifcSource || await hex(state.ifcSource.bytes) === state.ifcSource.sha256,
        worker: main.prepared ? [viaWorker.prepared?.sha256, await hex(viaWorker.prepared.bytes)] : [!!viaWorker.bytes, await hex(timeless(new TextDecoder().decode(viaWorker.bytes)))],
        main: main.prepared ? [main.prepared.sha256, main.prepared.sha256] : [true, await hex(timeless(main.content))],
      };
    });
    expect(parity, fixture.path).toEqual({ ...parity, started: true, answers: 1, merge: fixture.foreign, sourceIntact: true });
    expect(parity.worker, fixture.path).toEqual(parity.main);
    await page.keyboard.press('Control+s');
    if (fixture.foreign) {
      await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().isDirty)).toBe(false);
      expect(await page.evaluate(async () => (await window.__OPS__!.store.getState().fileHandle!.getFile()).text())).toBe(text);
      expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
        .filter(n => n.messageKey === 'notifications.ifcForeignReplaceBlocked'))).toEqual([]);
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
      // Knownbug 1131 stap 2: Ctrl+S na de bewerking schrijft het volledige bestand via de echte handle. Teruglezen via
      // dezelfde handle en heropenen via de bestandskiezer: de nieuwe duur, het vreemde deel byte voor byte.
      await page.keyboard.press('Control+s');
      await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().isDirty)).toBe(false);
      const saved = await page.evaluate(async () => {
        const state = window.__OPS__!.store.getState();
        const file = await state.fileHandle!.getFile();
        return { text: await file.text(), name: file.name, source: state.ifcSource!.sha256, mark: state.foreignSourceMark!.sha256,
          refusals: state.ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey) };
      });
      expect(saved.refusals).toEqual([]);
      expect(saved.text).not.toBe(text);
      expect(saved.text).toContain('IFCWALL(');
      expect(saved.source).toBe(saved.mark);
      // Eerst wachten tot het heropende document actief is: het bewerkte document heeft dezelfde duur.
      const savedDocument = await page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId);
      const savedChooser = page.waitForEvent('filechooser');
      await page.keyboard.press('Control+o');
      await (await savedChooser).setFiles({ name: saved.name, mimeType: 'application/octet-stream', buffer: Buffer.from(saved.text) });
      await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId)).not.toBe(savedDocument);
      await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ifcSource?.foreign)).toBe(true);
      await expect.poll(() => page.evaluate(id => window.__OPS__!.store.getState().tasks.find(t => t.id === id)?.time.scheduleDuration, task.id)).toBe(task.duration + 1);
      expect(await page.evaluate(() => {
        const source = window.__OPS__!.store.getState().ifcSource!;
        return Array.from(source.classes, (kind, i) => ({ kind, i })).filter(c => c.kind > 1).map(({ i }) => ({
          id: source.chunkIds[i], bytes: btoa(String.fromCharCode(...source.bytes.subarray(source.chunkStarts[i], source.chunkStarts[i + 1]))),
        }));
      })).toEqual(task.foreign);
      // De eerdere meldingen eerst echt sluiten: zij kunnen de exportkaart bedekken.
      while (await page.locator('[data-ops-toast-close]').count()) {
        await page.locator('[data-ops-toast-close]').last().click();
      }
      // #804 PR 13: Exporteren → IFC zonder gebouwmodel. Echte klikken: vinkje, kaart, de vraag; Enter en Escape
      // annuleren (Annuleren heeft de focus), Exporteren geeft een download met alleen de planning. Het document blijft
      // zoals het was; het volledig heropenen van zo'n bestand staat in check-ifc-document-save.ts.
      const beforePlanOnly = await page.evaluate(() => {
        const state = window.__OPS__!.store.getState();
        return { id: state.activeDocumentId, path: state.filePath, dirty: state.isDirty, sha256: state.ifcSource!.sha256 };
      });
      await page.getByRole('button', { name: /^(File|Bestand)$/ }).click();
      await page.locator('.backstage-sidebar').getByRole('button', { name: /^(Export|Exporteren)$/ }).click();
      await page.locator('[data-ops-export-without-model]').check();
      let planOnlyDownloads = 0;
      const countDownload = () => { planOnlyDownloads++; };
      page.on('download', countDownload);
      const ifcCard = page.locator('.backstage-export-card').filter({ has: page.getByRole('heading', { name: /^IFC/ }) }).first();
      const question = page.locator('[data-ops-plan-only-question="export"]');
      for (const key of ['Enter', 'Escape']) {
        await ifcCard.click();
        await expect(question).toBeVisible();
        await expect(question.getByRole('button', { name: /^(Cancel|Annuleren)$/ })).toBeFocused();
        await page.keyboard.press(key);
        await expect(question).toHaveCount(0);
      }
      expect(planOnlyDownloads).toBe(0);
      expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.notifications.filter(n => n.refusal))).toEqual([]);
      const planOnlyEvent = page.waitForEvent('download');
      await ifcCard.click();
      await question.getByRole('button', { name: /^(Export|Exporteren)$/ }).click();
      const planOnly = await readFile((await (await planOnlyEvent).path())!, 'utf8');
      page.off('download', countDownload);
      expect(planOnly).toContain('IFCTASK(');
      expect(planOnly).not.toContain('IFCWALL(');
      expect(planOnly).not.toContain('IFCBUILDINGSTOREY(');
      expect(await page.evaluate(() => {
        const state = window.__OPS__!.store.getState();
        return { id: state.activeDocumentId, path: state.filePath, dirty: state.isDirty, sha256: state.ifcSource!.sha256 };
      })).toEqual(beforePlanOnly);
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
    if (!fixture.foreign) {
      // Zonder gebouwmodel is er geen keuze "Zonder gebouwmodel" op de exportkaart.
      await page.getByRole('button', { name: /^(File|Bestand)$/ }).click();
      await page.locator('.backstage-sidebar').getByRole('button', { name: /^(Export|Exporteren)$/ }).click();
      await expect(page.locator('.backstage-export-card').first()).toBeVisible();
      await expect(page.locator('[data-ops-export-without-model]')).toHaveCount(0);
    }

  }

});
