// De welkomstdialoog is een eigen mini-laag bovenop dezelfde instellingen als SettingsPanelContent:
// taal, thema en automatisch berekenen worden met echte klikken gekozen en moeten live in de store
// én in de opslag landen, precies zoals vanuit de instellingen. De storebrug opent alleen de
// dialoog en leest de uitkomst.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, waitForOps, waitForWelcomeCheck } from './fixtures/ops';

const IFC = readFileSync(resolve(process.cwd(), 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
/** De knop "Spelingsband" in het Frans: de host hieronder zet de taal op `fr`. */
const FLOAT_BAND_FR = (JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/fr/menu.json'), 'utf8')) as {
  ribbon: { toggleFloatBand: string };
}).ribbon.toggleFloatBand;
/** Teksten van de baselinedialoog in het Frans (start) en Duits (na de live wissel). */
const FR_MENU = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/fr/menu.json'), 'utf8')) as { ribbon: { manageBaselines: string } };
const FR_COMMON = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/fr/common.json'), 'utf8')) as {
  baseline: { dialog: { name: string; title: string } }; settings: { language: string };
};
/** Pop-up en melding in het Engels: zonder Franse vertaling toont de app het Engels. */
const EN_COMMON = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/en/common.json'), 'utf8')) as {
  notifications: { settingsLoadedLate: string; settingsLoadedLateReverted: string };
  settingsDelay: { title: string; body: string };
};
const DE_COMMON = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/de/common.json'), 'utf8')) as { baseline: { dialog: { name: string; title: string } } };
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Waar de nephost zijn instellingen bewaart (sessionStorage overleeft herladen): één hostsleutel per
 *  `ops-`-sleutel. */
const HOST_SETTINGS_STORE = 'test-host-settings';

test('welkomstdialoog past taal, thema en automatisch berekenen live toe en bewaart ze', async ({ page, ops: _ops }) => {
  // Meer tijd dan de standaard 30 s: de rondes met een trage host wachten bewust 1,5 s en ruim 5 s op de
  // host, en de ronde met een host tijdens het laden herlaadt nog een keer.
  test.setTimeout(120_000);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: true, uiTheme: 'dark' }));
  const dialog = page.locator('[data-ops-welcome-dialog]');
  await expect(dialog).toBeVisible();

  const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.autoCalcCPM);
  await dialog.getByRole('checkbox', { name: /^(Calculate automatically|Automatisch berekenen)/ }).click();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.autoCalcCPM)).toBe(!before);
  expect(await page.evaluate(() => localStorage.getItem('ops-autoCalcCPM'))).toBe(String(!before));

  await dialog.getByRole('button', { name: /^(Theme|Thema)$/ }).click();
  await page.getByRole('option', { name: /^(Light|Licht)$/ }).click();
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme)).toBe('light');
  expect(await page.evaluate(() => localStorage.getItem('ops-theme'))).toBe('light');

  await dialog.getByRole('button', { name: /^(Language|Taal)$/ }).click();
  await page.getByRole('option', { name: /Nederlands/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  expect(await page.evaluate(() => localStorage.getItem('ops-locale'))).toBe('nl');
  await expect(dialog.getByRole('button', { name: 'Taal', exact: true })).toBeVisible();

  // Ingebed (#716): bij werkende opslag is de host alleen genoeg, zonder `skipWelcome`. Niet een
  // opslagweigering of een eerder gezien venster beslist. Herladen doorloopt de echte bootstrap, zonder
  // setUI-ingreep. Er is dus ook geen taalvraag: de taal komt van de host.
  // #818: de host geeft ook `thema` en `settings`. Zoals in een frame van de SuperCloud is de
  // instelling `ops-showFloatBand` na herladen lokaal weg; alleen de host heeft hem nog.
  await page.addInitScript(({ ifc, store }) => {
    localStorage.removeItem('ops-welcomeSeen');
    if (localStorage.getItem('test-no-host') === 'true') return;
    localStorage.removeItem('ops-showFloatBand');
    localStorage.removeItem('ops-personalTaskTypes');
    const read = (): Record<string, unknown> => JSON.parse(sessionStorage.getItem(store) ?? '{}') as Record<string, unknown>;
    const write = (all: Record<string, unknown>) => sessionStorage.setItem(store, JSON.stringify(all));
    /** Elke `set`/`delete` die de app doet, in volgorde (de test leest en wist deze lijst). */
    const logWrite = (entry: string) => sessionStorage.setItem('test-host-writes',
      JSON.stringify([...(JSON.parse(sessionStorage.getItem('test-host-writes') ?? '[]') as string[]), entry]));
    const file = { id: 'welcome-host', name: 'Planning.ifc', version: '1' };
    // `test-host-hold`: de host houdt elke lezing vast tot `window.__testReleaseHost()` (een host die
    // pas na de time-out antwoordt, op een moment dat de test kiest).
    const holder = window as unknown as { __testHeld: (() => void)[]; __testReleaseHost: () => void };
    holder.__testHeld = [];
    holder.__testReleaseHost = () => { for (const release of holder.__testHeld.splice(0)) release(); };
    // `test-late-host`: de host komt pas met `window.__testInstallHost()` (een host die verschijnt terwijl
    // de app laadt), met `taal: 'de'` en `thema: 'light'`.
    const late = sessionStorage.getItem('test-late-host') === 'true';
    const install = () => { (window as unknown as { openaecHost: unknown }).openaecHost = {
      taal: late ? 'de' : 'fr',
      thema: late ? 'light' : 'dark',
      initialFileId: file.id,
      storage: {
        list: async () => [file],
        open: async () => ({ file, data: ifc }),
        save: async () => { throw new Error('niet in deze test'); },
        versions: async () => [{ version: '1' }],
      },
      settings: {
        // `test-host-delay`: de host antwoordt pas na zoveel ms (een trage host). Bij het eerste antwoord
        // noteert hij of de app al gerenderd was (`__testRootAtAnswer`, aantal kinderen van #root).
        get: (key: string) => {
          if (sessionStorage.getItem('test-host-hold') === 'true') {
            return new Promise((resolve) => { holder.__testHeld.push(() => resolve(read()[key] ?? null)); });
          }
          const delay = Number(sessionStorage.getItem('test-host-delay') ?? '0');
          if (!delay) return Promise.resolve(read()[key] ?? null);
          return new Promise((resolve) => setTimeout(() => {
            const w = window as unknown as { __testRootAtAnswer?: number };
            w.__testRootAtAnswer ??= document.getElementById('root')?.childElementCount ?? -1;
            resolve(read()[key] ?? null);
          }, delay));
        },
        set: async (key: string, value: unknown) => { logWrite(`set ${key}`); write({ ...read(), [key]: value }); return null; },
        delete: async (key: string) => { logWrite(`delete ${key}`); const all = read(); delete all[key]; write(all); return null; },
      },
    }; };
    if (late) (window as unknown as { __testInstallHost: () => void }).__testInstallHost = install;
    else install();
  }, { ifc: IFC, store: HOST_SETTINGS_STORE });
  const hostSettings = () => page.evaluate((store) =>
    JSON.parse(sessionStorage.getItem(store) ?? '{}') as Record<string, string>, HOST_SETTINGS_STORE);
  let floatBandChoice: boolean | null = null;
  for (const round of ['host', 'host na herladen']) {
    await page.reload();
    await waitForOps(page);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().siteFileId), { timeout: 20_000, message: round })
      .toBe('welcome-host');
    expect(await page.evaluate(() => {
      localStorage.setItem('test-storage-probe', 'werkt');
      const result = localStorage.getItem('test-storage-probe');
      localStorage.removeItem('test-storage-probe');
      return [result, localStorage.getItem('ops-welcomeSeen')];
    }), round).toEqual(['werkt', null]);
    await expect(dialog, round).toHaveCount(0);
    expect(await waitForWelcomeCheck(page), round).toBe('welkomstcontrole: overgeslagen (ingebed)');
    expect(await page.evaluate(() => {
      const ui = window.__OPS__!.store.getState().ui;
      return [ui.welcomePending, ui.showTourOverlay, ui.showTutorialOffer];
    }), round).toEqual([false, false, false]);
    // De taal van de host wint van de bewaarde keuze (hierboven `nl`) en wordt niet bewaard.
    await expect(page.locator('html'), round).toHaveAttribute('lang', 'fr');
    expect(await page.evaluate(() => localStorage.getItem('ops-locale')), round).toBe('nl');
    // Het thema van de host (#818) wint ook van de bewaarde keuze (hierboven `light`), zonder flits: het
    // pre-paint-script en de store zeggen hetzelfde. Ook dat wordt niet bewaard.
    await expect(page.locator('html'), round).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => [window.__OPS__!.store.getState().ui.uiTheme, localStorage.getItem('ops-theme')]), round)
      .toEqual(['dark', 'light']);

    const floatBand = page.getByRole('button', { name: new RegExp(`^${FLOAT_BAND_FR}`) });
    if (round === 'host') {
      // Een echte klik op Spelingsband: de instelling gaat gebundeld naar `settings` van de host.
      await page.locator('[data-ops-ribbon-tab="beeld"]').click();
      const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.showFloatBand);
      await floatBand.click();
      floatBandChoice = !before;
      expect(await page.evaluate(() => localStorage.getItem('ops-showFloatBand'))).toBe(String(floatBandChoice));
      await expect.poll(() => hostSettings().then((all) => all['ops-showFloatBand'])).toBe(String(floatBandChoice));
      // Bewaarde keuzes van eerder in deze test gaan ook mee; het geheime MCP-token nooit.
      expect(await hostSettings()).toMatchObject({ 'ops-theme': 'light', 'ops-locale': 'nl' });
      expect(Object.keys(await hostSettings())).not.toContain('ops-mcpToken');

      // Een ingevulde baselinenaam overleeft een taalwissel van de host (review #827, punt 4): echte
      // klikken via Planning → Baselines beheren, dan typen, dan wisselt de host van Frans naar Duits.
      await page.locator('[data-ops-ribbon-tab="planning"]').click();
      await page.getByRole('button', { name: new RegExp(`^${escapeRegExp(FR_MENU.ribbon.manageBaselines)}`) }).first().click();
      // Het enige modale venster: de baselinedialoog (het taakpaneel heeft ook een veld "Nom").
      const baselineDialog = page.getByRole('dialog');
      await expect(baselineDialog).toHaveCount(1);
      // Het veld voor een nieuwe baseline staat ná de lijst (het bestand heeft er al een, met hetzelfde label).
      const baselineName = baselineDialog.getByRole('textbox', { name: FR_COMMON.baseline.dialog.name, exact: true }).last();
      await expect(baselineName).toHaveValue(/^Référence \d+ — /);
      await baselineName.fill('Contractfase vóór aanbesteding');

      // Live wissel (#818): de host verandert taal en thema op hetzelfde object en meldt dat.
      await page.evaluate(() => {
        const host = (window as unknown as { openaecHost: { taal: string; thema: string } }).openaecHost;
        host.taal = 'de-AT';
        host.thema = 'light';
        window.dispatchEvent(new Event('openaec-host-preferences'));
      });
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      // De dialoog is nu Duits, maar de getypte naam staat er nog.
      await expect(baselineDialog.getByText(DE_COMMON.baseline.dialog.title, { exact: true }).first()).toBeVisible();
      await expect(baselineDialog.getByRole('textbox', { name: DE_COMMON.baseline.dialog.name, exact: true }).last())
        .toHaveValue('Contractfase vóór aanbesteding');
      await page.keyboard.press('Escape');
      expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showBaselineDialog)).toBe(false);
      expect(await page.evaluate(() => [localStorage.getItem('ops-locale'), localStorage.getItem('ops-theme')]))
        .toEqual(['nl', 'light']);
    } else {
      // Na herladen was de instelling lokaal weg (zie het init-script); de host gaf hem terug.
      await page.locator('[data-ops-ribbon-tab="beeld"]').click();
      expect(await page.evaluate(() => [window.__OPS__!.store.getState().ui.showFloatBand, localStorage.getItem('ops-showFloatBand')]))
        .toEqual([floatBandChoice, String(floatBandChoice)]);
      await expect.poll(() => floatBand.evaluate(el => el.classList.contains('active'))).toBe(floatBandChoice);
    }
  }
  // Een trage host (#818). De start wacht op de host, hoogstens 5 s (`HYDRATE_TIMEOUT_MS`). Binnen de
  // grens start de app pas na het antwoord, met de bewaarde waarden. Daarboven (besluit van Ethan,
  // 7 november 2026): de app start met de standaardinstellingen en toont een pop-up, wacht op de
  // achtergrond verder zonder iets naar de host te schrijven, en past een laat antwoord live toe. De
  // bewaarde instellingen winnen van wat de gebruiker intussen deed; een korte melding zegt dat.
  const KEPT = JSON.stringify([{ id: 'bewaard', name: 'Bewaard type' }]);
  await page.evaluate(({ store, kept }) => {
    const all = JSON.parse(sessionStorage.getItem(store) ?? '{}') as Record<string, string>;
    all['ops-personalTaskTypes'] = kept;
    // Spelingsband staat standaard aan; de host bewaart hem uit.
    all['ops-showFloatBand'] = 'false';
    sessionStorage.setItem(store, JSON.stringify(all));
  }, { store: HOST_SETTINGS_STORE, kept: KEPT });
  /** Per meldingssleutel het aantal (`count`) van elke melding in de store. */
  const notices = (key: string) => page.evaluate((messageKey) => window.__OPS__!.store.getState().ui.notifications
    .filter((n) => n.messageKey === messageKey).map((n) => n.count), key);
  const lateNotices = async () => [
    ...(await notices('notifications.settingsLoadedLate')).map(() => 'geladen'),
    ...(await notices('notifications.settingsLoadedLateReverted')).map(() => 'geladen, teruggezet'),
  ];
  const hostWrites = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('test-host-writes') ?? '[]') as string[]);
  const delayDialog = page.locator('[data-ops-settings-delay-dialog]');
  const taskTypeField = page.locator('[data-ops-task-type]');
  /** Selecteer de eerste taak en open het werksoortveld in het eigenschappenpaneel. */
  const openTaskTypes = async () => {
    await page.evaluate(() => {
      const store = window.__OPS__!.store.getState();
      store.selectTask(store.tasks[0].id);
      store.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    });
    await taskTypeField.getByRole('button').click();
    return page.getByRole('listbox');
  };
  const storedTypeNames = async () => (JSON.parse(await page.evaluate(() => localStorage.getItem('ops-personalTaskTypes') ?? '[]')) as { name: string }[])
    .map((t) => t.name);
  const floatBandSlow = page.getByRole('button', { name: new RegExp(`^${FLOAT_BAND_FR}`) });
  const newTypeDialog = page.locator('[data-ops-new-task-type-dialog]');

  // Binnen de grens: de host antwoordt na 1,5 s.
  await page.evaluate(() => sessionStorage.setItem('test-host-delay', '1500'));
  await page.reload();
  await waitForOps(page);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().siteFileId), { timeout: 20_000 }).toBe('welcome-host');
  expect(await page.evaluate(() => (window as unknown as { __testRootAtAnswer?: number }).__testRootAtAnswer),
    'de app rendert pas na het antwoord van de host').toBe(0);
  expect(await page.evaluate(() => [localStorage.getItem('ops-personalTaskTypes'), window.__OPS__!.store.getState().ui.showFloatBand]))
    .toEqual([KEPT, false]);
  await page.locator('[data-ops-ribbon-tab="beeld"]').click();
  await expect.poll(() => floatBandSlow.evaluate(el => el.classList.contains('active'))).toBe(false);
  await expect(await openTaskTypes()).toContainText('Bewaard type');
  await page.keyboard.press('Escape');
  await expect(delayDialog, 'binnen de grens geen pop-up').toHaveCount(0);
  expect(await lateNotices(), 'binnen de grens geen melding').toEqual([]);
  await page.evaluate(() => sessionStorage.removeItem('test-host-delay'));

  // Boven de grens: de host houdt de lezing vast tot de test hem vrijgeeft.
  const hostBefore = await hostSettings();
  await page.evaluate(() => {
    sessionStorage.setItem('test-host-hold', 'true');
    sessionStorage.removeItem('test-host-writes');
  });
  await page.reload();
  await waitForOps(page);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().siteFileId), { timeout: 20_000 }).toBe('welcome-host');
  // De pop-up, in gewone taal, en weg met OK.
  await expect(delayDialog).toBeVisible();
  await expect(delayDialog).toContainText(EN_COMMON.settingsDelay.title);
  await expect(delayDialog).toContainText(EN_COMMON.settingsDelay.body);
  await delayDialog.locator('[data-ops-settings-delay-ok]').click();
  await expect(delayDialog).toHaveCount(0);
  // De sessie draait op de standaardinstellingen: Spelingsband staat aan, geen eigen werksoorten.
  expect(await page.evaluate(() => [localStorage.getItem('ops-personalTaskTypes'), window.__OPS__!.store.getState().ui.showFloatBand]))
    .toEqual([null, true]);

  // De gebruiker werkt door, met echte klikken: een nieuwe werksoort, thema en taal.
  const list = await openTaskTypes();
  await expect(list).not.toContainText('Bewaard type');
  const options = list.getByRole('option');
  await options.nth((await options.count()) - 2).click(); // Nieuwe werksoort…
  await expect(newTypeDialog).toBeVisible();
  await newTypeDialog.getByRole('textbox').fill('Sessietype');
  await page.keyboard.press('Enter');
  await expect(newTypeDialog).toBeHidden();
  expect(await storedTypeNames()).toEqual(['Sessietype']);
  // Het instellingenvenster openen mag via de brug; de keuzes zelf zijn echte klikken.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const settingsDialog = page.getByRole('dialog');
  await settingsDialog.locator('[data-ops-theme-card="high-contrast"]').click();
  await settingsDialog.getByRole('button', { name: FR_COMMON.settings.language, exact: true }).click();
  await page.getByRole('option', { name: /English/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.keyboard.press('Escape');
  // Langer dan de bundeltijd (400 ms): tijdens het wachten geen enkele set/delete naar de host.
  await page.waitForTimeout(1_000);
  expect(await hostWrites(), 'geen enkele set/delete naar de host tijdens het wachten').toEqual([]);
  expect(await hostSettings(), 'de host is onaangeroerd').toEqual(hostBefore);

  // De host antwoordt alsnog. De bewaarde instellingen winnen, live, zonder herladen.
  await page.evaluate(() => (window as unknown as { __testReleaseHost: () => void }).__testReleaseHost());
  await expect.poll(lateNotices, { message: 'één melding, met "teruggezet"' }).toEqual(['geladen, teruggezet']);
  await expect(page.locator('.ops-toast', { hasText: EN_COMMON.notifications.settingsLoadedLateReverted })).toHaveCount(1);
  await expect(delayDialog).toHaveCount(0);
  expect(await storedTypeNames(), 'de bewaarde persoonlijke werksoorten terug, de nieuwe weg').toEqual(['Bewaard type']);
  // De keuzelijst per groep. "Sessietype" gaat uit de persoonlijke werksoorten (die van de host winnen),
  // maar blijft bij "Uit dit project": de taak kreeg hem bij het aanmaken, dus hij staat in het document
  // (`ensureProjectTaskType`). Dat is documentdata en geen instelling; het late antwoord raakt het
  // document niet, anders verdween er werk uit de planning.
  const lateTypes = await openTaskTypes();
  await expect(lateTypes).toContainText('Bewaard type');
  const typeGroups = await lateTypes.getByRole('option').evaluateAll((elements) => {
    const groups: Record<string, string[]> = {};
    let group = '';
    for (const element of elements) {
      const value = element.getAttribute('data-value') ?? '';
      if (value.startsWith('__ops_task_type_')) group = value;
      else if (value.startsWith('custom:')) (groups[group] ??= []).push(element.textContent?.trim() ?? '');
    }
    return groups;
  });
  expect(typeGroups, 'persoonlijk: alleen de bewaarde; project: de werksoort van de taak blijft').toEqual({
    __ops_task_type_group_personal__: ['Bewaard type'],
    __ops_task_type_group_project__: ['Sessietype'],
  });
  expect(await page.evaluate(() => window.__OPS__!.store.getState().customTaskTypes.map((t) => t.name)),
    'de werksoort staat nog in het document').toContain('Sessietype');
  await page.keyboard.press('Escape');
  // Thema en taal: de host geeft `thema: dark` en `taal: fr`, en die winnen zoals bij een gewone start.
  // Lokaal staan weer de bewaarde keuzes.
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => [
    window.__OPS__!.store.getState().ui.uiTheme,
    localStorage.getItem('ops-theme'),
    localStorage.getItem('ops-locale'),
    window.__OPS__!.store.getState().ui.showFloatBand,
  ])).toEqual(['dark', hostBefore['ops-theme'], hostBefore['ops-locale'], false]);
  await page.locator('[data-ops-ribbon-tab="beeld"]').click();
  await expect.poll(() => floatBandSlow.evaluate(el => el.classList.contains('active')), { message: 'Spelingsband volgt de host' }).toBe(false);
  // Daarna staat het bewaren aan: een klik op Spelingsband komt bij de host aan. Nooit een delete.
  await floatBandSlow.click();
  await expect.poll(() => hostSettings().then((all) => all['ops-showFloatBand'])).toBe('true');
  expect((await hostWrites()).filter((entry) => entry.startsWith('delete')), 'geen enkele delete').toEqual([]);
  expect((await hostSettings())['ops-personalTaskTypes'], 'de bewaarde werksoorten bij de host').toBe(KEPT);
  await page.evaluate(() => sessionStorage.removeItem('test-host-hold'));

  // Een host die verschijnt terwijl `App` laadt (review #827 ronde 4): na de lezing in `main.tsx` (nog
  // geen host), vóór de React-mount. Zijn `openaec-host-ready` mist dus de luisteraar. De mount haalt
  // het in: de taal (`de`) en het thema (`light`) van de host, en zijn instellingen als een laat
  // antwoord. Hij antwoordt meteen, dus geen pop-up; wel de melding, zonder "teruggezet".
  let releaseApp!: () => void;
  const appHeld = new Promise<void>((resolve) => { releaseApp = resolve; });
  let appRequested!: () => void;
  const appWanted = new Promise<void>((resolve) => { appRequested = resolve; });
  const APP_MODULE = /\/src\/App\.tsx(\?|$)/;
  await page.route(APP_MODULE, async (route) => { appRequested(); await appHeld; await route.continue(); });
  await page.evaluate(() => {
    sessionStorage.setItem('test-late-host', 'true');
    sessionStorage.removeItem('test-host-writes');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await appWanted; // de lezing is voorbij: `main.tsx` vraagt `App` op
  await page.evaluate(() => {
    (window as unknown as { __testInstallHost: () => void }).__testInstallHost();
    window.dispatchEvent(new Event('openaec-host-ready'));
  });
  releaseApp();
  await waitForOps(page);
  await page.unroute(APP_MODULE);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().siteFileId), { timeout: 20_000 }).toBe('welcome-host');
  await expect.poll(lateNotices).toEqual(['geladen']);
  await expect(delayDialog).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  // De bewaarde werksoorten zijn er; een nieuwe via echte klikken gaat nu ook naar de host.
  const lateList = await openTaskTypes();
  await expect(lateList).toContainText('Bewaard type');
  const lateOptions = lateList.getByRole('option');
  await lateOptions.nth((await lateOptions.count()) - 2).click(); // Neue Vorgangsart… / Nieuwe werksoort…
  await expect(newTypeDialog).toBeVisible();
  await newTypeDialog.getByRole('textbox').fill('Nieuw tijdens start');
  await page.keyboard.press('Enter');
  await expect(newTypeDialog).toBeHidden();
  await expect.poll(() => hostSettings().then((all) => (JSON.parse(all['ops-personalTaskTypes'] ?? '[]') as { name: string }[])
    .map((t) => t.name).sort())).toEqual(['Bewaard type', 'Nieuw tijdens start']);
  // Een tweede ready-event verandert niets.
  await page.evaluate(() => window.dispatchEvent(new Event('openaec-host-ready')));
  await page.waitForTimeout(1_000);
  expect(await lateNotices(), 'nog steeds één melding').toEqual(['geladen']);
  expect((await hostWrites()).filter((entry) => entry.startsWith('delete')), 'geen enkele delete').toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.evaluate(() => sessionStorage.removeItem('test-late-host'));

  // Negatieve controle: dezelfde werkende opslag, maar zonder host komt welkom terug, in de bewaarde taal.
  await page.evaluate(() => localStorage.setItem('test-no-host', 'true'));
  await page.reload();
  await waitForOps(page);
  await expect(dialog).toBeVisible();
  // De bewaarde taal: Nederlands. De keuze Engels tijdens het wachten hierboven is teruggezet.
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  expect(await waitForWelcomeCheck(page)).toBe('welkomstcontrole: getoond');
});

// SuperCloud-werkplek (#582, #583, #706): de tool draait in een sandbox zonder `allow-same-origin`
// (CSP `sandbox allow-scripts allow-modals`), dus in een ECHTE opaque origin. Hier krijgt het document
// zelf die CSP-header, zoals in de werkplek; de browser weigert dan zelf localStorage, sessionStorage
// en IndexedDB. Een opaque origin haalt modules op met CORS, dus elk antwoord van de dev-server krijgt
// `Access-Control-Allow-Origin: *`. De host zet GEEN `skipWelcome`, net als de werkplek: de host
// maakt de tool ingebed (#716), en zonder localStorage sloeg hij het venster al over (#706). De host
// geeft `taal: 'de'` mee; de app start in die taal (#716). Bewust zonder de `ops`-fixture, want die wacht
// juist op de welkomst en schrijft localStorage. Het startbestand van de host is het ijkpunt:
// `useSiteInitialFile` opent het in dezelfde ronde als de welkomstcheck (na de herstelcontrole).
// Staat het er, dan is die check voorbij en had een welkomstvenster al moeten verschijnen. Een
// onafgevangen fout faalt de test.
test('werkplek in een opaque origin: de app start, geen welkomstvenster en geen herstelmelding, ook niet na herladen', async ({ page }) => {
  await page.route('**/*', async (route) => {
    const response = await route.fetch();
    const headers: Record<string, string> = { ...response.headers(), 'access-control-allow-origin': '*' };
    if (route.request().resourceType() === 'document') headers['content-security-policy'] = 'sandbox allow-scripts allow-modals';
    await route.fulfill({ response, headers });
  });
  await page.addInitScript((ifc) => {
    const file = { id: 'p1', name: 'Planning.ifc', version: '1' };
    (window as unknown as { openaecHost: unknown }).openaecHost = {
      taal: 'de',
      initialFileId: 'p1',
      storage: {
        list: async () => [file],
        open: async () => ({ file, data: ifc }),
        save: async () => { throw new Error('niet in deze test'); },
        versions: async () => [{ version: '1' }],
      },
    };
  }, IFC);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  const recoveryOff: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Crashherstel staat uit')) recoveryOff.push(message.text());
    if (message.type() === 'error') console.log(`[opaque origin] console.error: ${message.text()}`);
  });
  const welcome = page.locator('[data-ops-welcome-dialog]');
  for (const round of ['eerste start', 'na herladen']) {
    recoveryOff.length = 0;
    if (round === 'eerste start') await page.goto('/'); else await page.reload();
    await waitForOps(page);
    // Echt een opaque origin: de browser zelf weigert de opslag.
    expect(await page.evaluate(() => {
      const refused = (read: () => unknown) => { try { read(); return 'werkt'; } catch (error) { return (error as Error).name; } };
      return { origin: self.origin, localStorage: refused(() => localStorage), sessionStorage: refused(() => sessionStorage) };
    }), round).toEqual({ origin: 'null', localStorage: 'SecurityError', sessionStorage: 'SecurityError' });
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().siteFileId), { timeout: 20_000, message: round })
      .toBe('p1');
    await expect(welcome, round).toHaveCount(0);
    expect(await waitForWelcomeCheck(page), round).toBe('welkomstcontrole: overgeslagen (ingebed)');
    await expect(page.locator('html'), round).toHaveAttribute('lang', 'de');
    const ui = await page.evaluate(() => {
      const u = window.__OPS__!.store.getState().ui;
      return { welcomePending: u.welcomePending, showTourOverlay: u.showTourOverlay, showTutorialOffer: u.showTutorialOffer };
    });
    expect(ui, round).toEqual({ welcomePending: false, showTourOverlay: false, showTutorialOffer: false });
    // 407: een echte invoerhandeling, daarna de geregistreerde herstelronde afwachten via dezelfde
    // flush als de updater. Geen vaste 2 s-slaap die korter is dan de 10 s-throttle.
    const count = await page.evaluate(() => window.__OPS__!.store.getState().tasks.length);
    await page.locator('[data-task-grid-surface-id="gantt-task-grid"] [data-grid-row-key][data-grid-column-id="task.name"]').first().click();
    await page.keyboard.press('Insert');
    await page.keyboard.type('In de werkplek');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => {
      const tasks = window.__OPS__!.store.getState().tasks;
      return [tasks.length, tasks.some(task => task.name === 'In de werkplek')];
    }), { message: round }).toEqual([count + 1, true]);
    await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().isDirty), { message: round }).toBe(true);
    await page.evaluate(async () => {
      const path = '/src/services/recovery/recoveryFlush.ts';
      const recovery = await import(/* @vite-ignore */ path) as { flushRecoveryNow: () => Promise<void> };
      await recovery.flushRecoveryNow();
      await recovery.flushRecoveryNow();
    });
    expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.notifications.map((n) => n.messageKey)), round).toEqual([]);
    expect(recoveryOff, round).toHaveLength(1);
  }
  expect(pageErrors, 'onafgevangen fouten in een opaque origin').toEqual([]);
});
