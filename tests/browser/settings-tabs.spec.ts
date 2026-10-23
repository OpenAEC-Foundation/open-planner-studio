// U1: Instellingen kreeg drie tabs (Weergave/Planning/Geavanceerd i.p.v. de oude vier), met de
// sectie Project eruit. Dit is de ENE gedeelde `SettingsPanelContent`-component op drie ingangen
// (tandwiel-popup, Instellingen-ribbontab, Backstage → Instellingen) — deze test bewijst dat alle
// drie daadwerkelijk dezelfde tabs/sectiekoppen tonen ná echte klikken, niet alleen ná een
// store-fixture. Openen/sluiten/tab-wisselen en de verborgen schakelaars gaan via echte
// DOM-interacties; de brug zet alleen de herlaadfixture en leest de opgeslagen keuzes.
import { expect, test, waitForOps, waitForWelcomeDialog } from './fixtures/ops';
import type { Locator, Page } from '@playwright/test';
import type { FeatureFlag } from '@/utils/featureFlags';

const TAB_LABELS: RegExp[] = [
  /^(Appearance|Weergave)$/,
  /^Planning$/,
  /^(Advanced|Geavanceerd)$/,
];

// Exacte sectiekoppen (h3/h4) per tab, in de vaste volgorde uit AGENTS.md/de opdracht.
const SECTION_HEADINGS: RegExp[][] = [
  [
    /^(Theme|Thema)$/,
    /^(Language|Taal)$/,
    /^(Font|Lettertype)$/,
    /^(Text size|Tekengrootte)$/,
    /^(Date format|Datumnotatie)$/,
    /^(Time format|Tijdnotatie)$/,
    /^(Duration display|Duurweergave)$/,
    /^(Document switch style|Documentwissel-stijl)$/,
    /^Gantt$/,
    /^(Timeline axis|Tijd-as)$/,
    /^(Quarter-hour zoom|Kwartierzoom)$/,
    /^(Task bars at interruptions|Taakbalken bij onderbrekingen)$/,
    /^(Scroll & zoom|Scrollen & zoomen)$/,
  ],
  [
    /^(Construction mode|Bouwmodus)$/,
    /^(Hour planning|Urenplanning)$/,
    /^(Week starts on|Week begint op)$/,
    /^(Calculation|Berekenen)$/,
  ],
  [
    // Uitleg na het openen van een ander formaat dan IFC (FormatNoticeDialog), per formaat aan/uit.
    /^(Show an explanation after opening|Uitleg tonen na het openen van)$/,
    /^(MCP connection|MCP-koppeling)$/,
    /^(Debug terminal|Debug-terminal)$/,
    /^Benchmark$/,
    /^(Statistics|Statistieken)$/,
    /^(Tour|Rondleiding)$/,
    /^(Version|Versie)$/,
    // Issue #144: vervangen functies staan in een eigen, als zodanig gemarkeerd blok onderaan.
    /^(Legacy features|Legacy-functies)$/,
  ],
];

const PROJECT_SECTION_TEXT = /^(Project|Project information\.\.\.|Projectinformatie\.\.\.)$/;

/** Doorloopt alle drie de tabs binnen `container` en vergelijkt tabnamen + sectiekoppen. */
async function assertThreeTabsAndSections(container: Locator): Promise<void> {
  const tabs = container.locator('.settings-tab');
  await expect(tabs).toHaveCount(3);
  for (let i = 0; i < TAB_LABELS.length; i++) {
    await expect(tabs.nth(i)).toHaveText(TAB_LABELS[i]);
  }

  for (let i = 0; i < SECTION_HEADINGS.length; i++) {
    await tabs.nth(i).click();
    // Scopen op directe kinderen: de theme-kaartjes (Weergave → Thema) hebben zelf ook een <h4>
    // per kleurstaal, die géén sectiekop is en dus niet mag meetellen.
    if (i === 0) {
      await expect(container.getByText(
        /^(Alleen voor urentaken: balken opsplitsen rond pauzes en niet-werktijd\. Echte taakonderbrekingen blijven altijd zichtbaar\.|For hour tasks only: split bars around breaks and non-working time\. Actual task interruptions remain visible regardless of this setting\.)$/,
      )).toBeVisible();
    }
    const headings = container.locator('.settings-section-list > .settings-section > h3, .settings-section-list > h3.settings-subhead');
    await expect(headings).toHaveCount(SECTION_HEADINGS[i].length);
    for (let j = 0; j < SECTION_HEADINGS[i].length; j++) {
      await expect(headings.nth(j)).toHaveText(SECTION_HEADINGS[i][j]);
    }
  }

  // De sectie Project (issue-regel 1) is nergens meer te vinden — niet als tabnaam, niet als
  // sectiekop, niet als de oude snelkoppelingsknop "Projectinformatie...".
  await expect(container.getByText(PROJECT_SECTION_TEXT, { exact: true })).toHaveCount(0);
}

/** Alleen de IFC-blokkade krijgt een fixture; de demo komt uit het echte productregister. */
async function seedFeatureFlags(page: Page): Promise<void> {
  const flags: FeatureFlag[] = [
    { id: 'browser-ifc', nameKey: 'settings.version', writesNewIfcData: true },
  ];
  await page.evaluate(async fixtures => {
    const registryPath = '/src/utils/featureFlags.ts';
    const { FEATURE_FLAGS } = await import(/* @vite-ignore */ registryPath);
    FEATURE_FLAGS.push(...fixtures);
  }, flags);
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
  await waitForWelcomeDialog(page);
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false });
  });
  await seedFeatureFlags(page);
}

test('de drie instellingen-ingangen delen tabs en verborgen, bewaarde experimentele schakelaars', async ({ page, ops: _ops }) => {
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
  await assertThreeTabsAndSections(gearDialog);
  await gearDialog.locator('.modal-close-btn').click();
  await expect(gearDialog).toBeHidden();

  // 2) Instellingen-ribbontab → knop "Instellingen"/"Settings" in de Project-lintgroep.
  await page.locator('.ribbon-tab').filter({ hasText: /^(Settings|Instellingen)$/ }).click();
  await page.locator('.ribbon-content').getByRole('button', { name: /^(App settings|App-instellingen)$/, exact: true }).click();
  const ribbonDialog = page.locator('.settings-dialog');
  await expect(ribbonDialog).toBeVisible();
  await assertThreeTabsAndSections(ribbonDialog);
  await ribbonDialog.locator('.modal-close-btn').click();
  await expect(ribbonDialog).toBeHidden();

  // 3) Backstage (Bestand-tab) → navitem "Instellingen"/"Settings" — geen dialoog, direct in de body.
  await page.locator('.ribbon-tab--file').click();
  const backstage = page.locator('.backstage');
  await expect(backstage).toBeVisible();
  await backstage.locator('.backstage-nav-item').filter({ hasText: /^(App settings|App-instellingen)$/ }).click();
  await assertThreeTabsAndSections(backstage.locator('.backstage-main'));

  // Taalfixture: dezelfde zichtbare secties en de urentaakhint ook in het Nederlands.
  await page.evaluate(async () => {
    const localePath = '/src/i18n/config.ts';
    const { setLocale } = await import(/* @vite-ignore */ localePath);
    await setLocale('nl');
  });
  await assertThreeTabsAndSections(backstage.locator('.backstage-main'));

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
  await expect(experimental.getByRole('checkbox')).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('ops-experimentalSettingsVisible'))).toBe('true');
  await page.clock.resume();

  // Hetzelfde ontgrendelde blok staat in de tandwiel-popup, met de echte demo en de IFC-fixture.
  await backstage.locator('[data-ops-backstage-back]').click();
  await seedFeatureFlags(page);
  expect(await enabledDemo(page)).toBe(false);
  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  await gearDialog.getByRole('button', { name: TAB_LABELS[2] }).click();
  const gearExperimental = gearDialog.locator('[data-ops-experimental-settings]');
  const demo = gearExperimental.locator('[data-ops-feature-flag="demo-topbar-animation"]');
  await expect(gearExperimental).toBeVisible();
  await expect(demo).not.toBeChecked();
  await expect(gearExperimental.getByRole('checkbox')).toHaveCount(1);
  await expect(gearExperimental.locator('[data-ops-feature-flag="browser-ifc"]')).toHaveCount(0);
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
    await gearDialog.getByRole('button', { name: TAB_LABELS[0] }).click();
    await gearDialog.locator(`[data-ops-theme-card="${theme}"]`).click();
    await gearDialog.getByRole('button', { name: TAB_LABELS[2] }).click();
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
    await gearDialog.locator('.settings-tab').nth(2).click();
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
  await gearDialog.getByRole('button', { name: TAB_LABELS[2] }).click();
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
  await ribbonDialog.getByRole('button', { name: TAB_LABELS[2] }).click();
  await expect(ribbonDialog.locator('[data-ops-feature-flag="demo-topbar-animation"]')).toBeChecked();
  await ribbonDialog.locator('.modal-close-btn').click();
  await page.locator('.ribbon-tab--file').click();
  await backstage.locator('.backstage-nav-item').filter({ hasText: /^(App settings|App-instellingen)$/ }).click();
  await backstage.getByRole('button', { name: TAB_LABELS[2] }).click();
  await expect(backstage.locator('[data-ops-feature-flag="demo-topbar-animation"]')).toBeChecked();

  // Ook de ontgrendelde zichtbaarheid zelf overleeft herladen; geen tweede gebaar nodig.
  await reloadSettingsApp(page);
  await expect.poll(() => enabledDemo(page)).toBe(true);
  await expect(animation).toBeVisible();
  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  await gearDialog.getByRole('button', { name: TAB_LABELS[2] }).click();
  await expect(demo).toBeChecked();

  // Echt uitvinken verwijdert de laag direct en bewaart ook die keuze na herladen.
  await demo.uncheck();
  expect(await enabledDemo(page)).toBe(false);
  await expect(animation).toHaveCount(0);
  await reloadSettingsApp(page);
  await expect.poll(() => enabledDemo(page)).toBe(false);
  await expect(animation).toHaveCount(0);
  await page.getByTitle(/^(App settings|App-instellingen)$/, { exact: true }).click();
  await gearDialog.getByRole('button', { name: TAB_LABELS[2] }).click();
  await expect(demo).not.toBeChecked();
});
