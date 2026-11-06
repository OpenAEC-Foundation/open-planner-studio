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
const FR_COMMON = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/fr/common.json'), 'utf8')) as { baseline: { dialog: { name: string; title: string } } };
const DE_COMMON = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/de/common.json'), 'utf8')) as { baseline: { dialog: { name: string; title: string } } };
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Waar de nephost zijn instellingen bewaart (sessionStorage overleeft herladen): één hostsleutel per
 *  `ops-`-sleutel. */
const HOST_SETTINGS_STORE = 'test-host-settings';

test('welkomstdialoog past taal, thema en automatisch berekenen live toe en bewaart ze', async ({ page, ops: _ops }) => {
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
    const read = (): Record<string, unknown> => JSON.parse(sessionStorage.getItem(store) ?? '{}') as Record<string, unknown>;
    const write = (all: Record<string, unknown>) => sessionStorage.setItem(store, JSON.stringify(all));
    const file = { id: 'welcome-host', name: 'Planning.ifc', version: '1' };
    (window as unknown as { openaecHost: unknown }).openaecHost = {
      taal: 'fr',
      thema: 'dark',
      initialFileId: file.id,
      storage: {
        list: async () => [file],
        open: async () => ({ file, data: ifc }),
        save: async () => { throw new Error('niet in deze test'); },
        versions: async () => [{ version: '1' }],
      },
      settings: {
        // `test-host-hold`: de host antwoordt pas na `window.__testReleaseHost()` (een trage host).
        get: (key: string) => {
          if (sessionStorage.getItem('test-host-hold') !== 'true') return Promise.resolve(read()[key] ?? null);
          const w = window as unknown as { __testHeld?: (() => void)[]; __testReleaseHost?: () => void };
          w.__testHeld ??= [];
          w.__testReleaseHost = () => { for (const release of w.__testHeld!.splice(0)) release(); };
          return new Promise((resolve) => { w.__testHeld!.push(() => resolve(read()[key] ?? null)); });
        },
        set: async (key: string, value: unknown) => { write({ ...read(), [key]: value }); return null; },
        delete: async (key: string) => { const all = read(); delete all[key]; write(all); return null; },
      },
    };
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
  // Een trage host (review #827 ronde 2): de app start na de time-out en de gebruiker werkt al, terwijl
  // de host nog niet antwoordde. Een klik op Spelingsband in die tijd blijft staan en gaat daarna naar de
  // host; een bewaarde werksoort die pas daarna binnenkomt, is er meteen, en een nieuwe werksoort wist hem
  // niet.
  await page.evaluate((store) => {
    const all = JSON.parse(sessionStorage.getItem(store) ?? '{}') as Record<string, string>;
    all['ops-personalTaskTypes'] = JSON.stringify([{ id: 'bewaard', name: 'Bewaard type' }]);
    // Spelingsband staat bij de host aan; lokaal is hij na herladen weg (init-script), dus de standaard (aan)
    // geldt tot de host antwoordt, en de klik zet hem uit.
    all['ops-showFloatBand'] = 'true';
    sessionStorage.setItem(store, JSON.stringify(all));
    sessionStorage.setItem('test-host-hold', 'true');
  }, HOST_SETTINGS_STORE);
  await page.reload();
  await waitForOps(page);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().siteFileId), { timeout: 20_000 }).toBe('welcome-host');
  expect(await page.evaluate(() => localStorage.getItem('ops-personalTaskTypes')), 'de host antwoordde nog niet').toBeNull();
  await page.locator('[data-ops-ribbon-tab="beeld"]').click();
  const floatBandSlow = page.getByRole('button', { name: new RegExp(`^${FLOAT_BAND_FR}`) });
  const hostFloatBand = (await hostSettings())['ops-showFloatBand'];
  await floatBandSlow.click();
  const clicked = await page.evaluate(() => window.__OPS__!.store.getState().ui.showFloatBand);
  expect([hostFloatBand, clicked], 'de klik zet uit wat de host aan heeft').toEqual(['true', false]);
  // Het werksoortveld van een taak toont de (nog lege) eigen lijst: de cache is geladen.
  const taskId = await page.evaluate(() => {
    const store = window.__OPS__!.store.getState();
    const id = store.tasks[0].id;
    store.selectTask(id);
    store.setUI({ showPropertiesPanel: true, rightPanelCollapsed: false });
    return id;
  });
  const taskTypeField = page.locator('[data-ops-task-type]');
  await taskTypeField.getByRole('button').click();
  await expect(page.getByRole('listbox')).not.toContainText('Bewaard type');
  await page.keyboard.press('Escape');

  // De host antwoordt.
  await page.evaluate(() => {
    sessionStorage.removeItem('test-host-hold');
    (window as unknown as { __testReleaseHost?: () => void }).__testReleaseHost?.();
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ops-personalTaskTypes')))
    .toBe(JSON.stringify([{ id: 'bewaard', name: 'Bewaard type' }]));
  expect(await page.evaluate(() => [window.__OPS__!.store.getState().ui.showFloatBand, localStorage.getItem('ops-showFloatBand')]),
    'de klik blijft staan').toEqual([clicked, String(clicked)]);
  await expect.poll(() => hostSettings().then((all) => all['ops-showFloatBand'])).toBe(String(clicked));

  // Werksoort → Nieuwe werksoort… → naam → Enter (de dialoog bevestigt met Enter).
  await taskTypeField.getByRole('button').click();
  await expect(page.getByRole('listbox')).toContainText('Bewaard type');
  const options = page.getByRole('listbox').getByRole('option');
  await options.nth((await options.count()) - 2).click();
  const newTypeDialog = page.locator('[data-ops-new-task-type-dialog]');
  await expect(newTypeDialog).toBeVisible();
  await newTypeDialog.getByRole('textbox').fill('Nieuw type');
  await page.keyboard.press('Enter');
  await expect(newTypeDialog).toBeHidden();
  await expect.poll(() => hostSettings().then((all) =>
    (JSON.parse(all['ops-personalTaskTypes'] ?? '[]') as { name: string }[]).map((t) => t.name).sort()))
    .toEqual(['Bewaard type', 'Nieuw type']);
  expect(await page.evaluate((id) => window.__OPS__!.store.getState().tasks.find((t) => t.id === id)?.taskType, taskId)).toBe('USERDEFINED');

  // Negatieve controle: dezelfde werkende opslag, maar zonder host komt welkom terug, in de bewaarde taal.
  await page.evaluate(() => localStorage.setItem('test-no-host', 'true'));
  await page.reload();
  await waitForOps(page);
  await expect(dialog).toBeVisible();
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
