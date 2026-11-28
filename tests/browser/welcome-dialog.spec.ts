import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test, waitForOps, waitForWelcomeCheck } from './fixtures/ops';

const IFC = readFileSync(resolve(process.cwd(), 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');
const FLOAT_BAND_FR = (JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/fr/menu.json'), 'utf8')) as {
  ribbon: { toggleFloatBand: string };
}).ribbon.toggleFloatBand;
const FR_MENU = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/fr/menu.json'), 'utf8')) as { ribbon: { manageBaselines: string } };
const FR_COMMON = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/fr/common.json'), 'utf8')) as {
  baseline: { dialog: { name: string; title: string } }; settings: { language: string };
  notifications: { settingsLoadedLateReverted: string };
  settingsDelay: { title: string; body: string };
};
const DE_COMMON = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/de/common.json'), 'utf8')) as { baseline: { dialog: { name: string; title: string } } };
const NL_COMMON = JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/nl/common.json'), 'utf8')) as {
  notifications: { hostThemeUntilRestart: string };
};
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HOST_SETTINGS_STORE = 'test-host-settings';
const themeNotices = (page: Page) => page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
  .filter((n) => n.messageKey === 'notifications.hostThemeUntilRestart').map((n) => n.count));

test('welkomstdialoog past taal, thema en automatisch berekenen live toe en bewaart ze', async ({ page, ops: _ops }) => {
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
  expect(await themeNotices(page), 'zonder host geen themamelding').toEqual([]);

  await dialog.getByRole('button', { name: /^(Language|Taal)$/ }).click();
  await page.getByRole('option', { name: /Nederlands/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  expect(await page.evaluate(() => localStorage.getItem('ops-locale'))).toBe('nl');
  await expect(dialog.getByRole('button', { name: 'Taal', exact: true })).toBeVisible();

  await page.addInitScript(({ ifc, store }) => {
    localStorage.removeItem('ops-welcomeSeen');
    if (localStorage.getItem('test-no-host') === 'true') return;
    localStorage.removeItem('ops-showFloatBand');
    localStorage.removeItem('ops-personalTaskTypes');
    const read = (): Record<string, unknown> => JSON.parse(sessionStorage.getItem(store) ?? '{}') as Record<string, unknown>;
    const write = (all: Record<string, unknown>) => sessionStorage.setItem(store, JSON.stringify(all));
    const logWrite = (entry: string) => sessionStorage.setItem('test-host-writes',
      JSON.stringify([...(JSON.parse(sessionStorage.getItem('test-host-writes') ?? '[]') as string[]), entry]));
    const file = { id: 'welcome-host', name: 'Planning.ifc', version: '1' };
    const holder = window as unknown as { __testHeld: (() => void)[]; __testReleaseHost: () => void };
    holder.__testHeld = [];
    holder.__testReleaseHost = () => { for (const release of holder.__testHeld.splice(0)) release(); };
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
    await expect(page.locator('html'), round).toHaveAttribute('lang', 'fr');
    expect(await page.evaluate(() => localStorage.getItem('ops-locale')), round).toBe('nl');
    await expect(page.locator('html'), round).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => [window.__OPS__!.store.getState().ui.uiTheme, localStorage.getItem('ops-theme')]), round)
      .toEqual(['dark', 'light']);

    const floatBand = page.getByRole('button', { name: new RegExp(`^${FLOAT_BAND_FR}`) });
    if (round === 'host') {
      await page.locator('[data-ops-ribbon-tab="beeld"]').click();
      const before = await page.evaluate(() => window.__OPS__!.store.getState().ui.showFloatBand);
      await floatBand.click();
      floatBandChoice = !before;
      expect(await page.evaluate(() => localStorage.getItem('ops-showFloatBand'))).toBe(String(floatBandChoice));
      await expect.poll(() => hostSettings().then((all) => all['ops-showFloatBand'])).toBe(String(floatBandChoice));
      expect(await hostSettings()).toMatchObject({ 'ops-theme': 'light', 'ops-locale': 'nl' });
      expect(Object.keys(await hostSettings())).not.toContain('ops-mcpToken');

      await page.locator('[data-ops-ribbon-tab="planning"]').click();
      await page.getByRole('button', { name: new RegExp(`^${escapeRegExp(FR_MENU.ribbon.manageBaselines)}`) }).first().click();
      const baselineDialog = page.getByRole('dialog');
      await expect(baselineDialog).toHaveCount(1);
      const baselineName = baselineDialog.getByRole('textbox', { name: FR_COMMON.baseline.dialog.name, exact: true }).last();
      await expect(baselineName).toHaveValue(/^Référence \d+ — /);
      await baselineName.fill('Contractfase vóór aanbesteding');

      await page.evaluate(() => {
        const host = (window as unknown as { openaecHost: { taal: string; thema: string } }).openaecHost;
        host.taal = 'de-AT';
        host.thema = 'light';
        window.dispatchEvent(new Event('openaec-host-preferences'));
      });
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      expect(await themeNotices(page), 'een hostwissel geeft geen themamelding').toEqual([]);
      await expect(baselineDialog.getByText(DE_COMMON.baseline.dialog.title, { exact: true }).first()).toBeVisible();
      await expect(baselineDialog.getByRole('textbox', { name: DE_COMMON.baseline.dialog.name, exact: true }).last())
        .toHaveValue('Contractfase vóór aanbesteding');
      await page.keyboard.press('Escape');
      expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.showBaselineDialog)).toBe(false);
      expect(await page.evaluate(() => [localStorage.getItem('ops-locale'), localStorage.getItem('ops-theme')]))
        .toEqual(['nl', 'light']);
    } else {
      await page.locator('[data-ops-ribbon-tab="beeld"]').click();
      expect(await page.evaluate(() => [window.__OPS__!.store.getState().ui.showFloatBand, localStorage.getItem('ops-showFloatBand')]))
        .toEqual([floatBandChoice, String(floatBandChoice)]);
      await expect.poll(() => floatBand.evaluate(el => el.classList.contains('active'))).toBe(floatBandChoice);
    }
  }
  const KEPT = JSON.stringify([{ id: 'bewaard', name: 'Bewaard type' }]);
  await page.evaluate(({ store, kept }) => {
    const all = JSON.parse(sessionStorage.getItem(store) ?? '{}') as Record<string, string>;
    all['ops-personalTaskTypes'] = kept;
    all['ops-showFloatBand'] = 'false';
    sessionStorage.setItem(store, JSON.stringify(all));
  }, { store: HOST_SETTINGS_STORE, kept: KEPT });
  const notices = (key: string) => page.evaluate((messageKey) => window.__OPS__!.store.getState().ui.notifications
    .filter((n) => n.messageKey === messageKey).map((n) => n.count), key);
  const lateNotices = async () => [
    ...(await notices('notifications.settingsLoadedLate')).map(() => 'geladen'),
    ...(await notices('notifications.settingsLoadedLateReverted')).map(() => 'geladen, teruggezet'),
  ];
  const hostWrites = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('test-host-writes') ?? '[]') as string[]);
  const delayDialog = page.locator('[data-ops-settings-delay-dialog]');
  const taskTypeField = page.locator('[data-ops-task-type]');
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

  const hostBefore = await hostSettings();
  await page.evaluate(() => {
    sessionStorage.setItem('test-host-hold', 'true');
    sessionStorage.removeItem('test-host-writes');
  });
  await page.reload();
  await waitForOps(page);
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().siteFileId), { timeout: 20_000 }).toBe('welcome-host');
  await expect(delayDialog).toBeVisible();
  await expect(delayDialog).toContainText(FR_COMMON.settingsDelay.title);
  await expect(delayDialog).toContainText(FR_COMMON.settingsDelay.body);
  await delayDialog.locator('[data-ops-settings-delay-ok]').click();
  await expect(delayDialog).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.getItem('ops-personalTaskTypes'), window.__OPS__!.store.getState().ui.showFloatBand]))
    .toEqual([null, true]);

  const list = await openTaskTypes();
  await expect(list).not.toContainText('Bewaard type');
  const options = list.getByRole('option');
  await options.nth((await options.count()) - 2).click();
  await expect(newTypeDialog).toBeVisible();
  await newTypeDialog.getByRole('textbox').fill('Sessietype');
  await page.keyboard.press('Enter');
  await expect(newTypeDialog).toBeHidden();
  expect(await storedTypeNames()).toEqual(['Sessietype']);
  await page.evaluate(() => {
    const seen = new Set<string>();
    (window as unknown as { __testThemeNotices: Set<string> }).__testThemeNotices = seen;
    const record = (state: { ui: { notifications: { id: string; messageKey: string; count: number }[] } }) => {
      for (const n of state.ui.notifications) if (n.messageKey === 'notifications.hostThemeUntilRestart') seen.add(`${n.id}:${n.count}`);
    };
    record(window.__OPS__!.store.getState());
    window.__OPS__!.store.subscribe(record);
  });
  const seenThemeNotices = () => page.evaluate(() =>
    [...(window as unknown as { __testThemeNotices: Set<string> }).__testThemeNotices].map((entry) => Number(entry.split(':')[1])));
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const settingsDialog = page.getByRole('dialog');
  await settingsDialog.locator('[data-ops-theme-card="dark"]').click();
  expect(await themeNotices(page), 'hetzelfde thema: geen themamelding').toEqual([]);
  await settingsDialog.locator('[data-ops-theme-card="high-contrast"]').click();
  await expect.poll(() => themeNotices(page)).toEqual([1]);
  await settingsDialog.locator('[data-ops-theme-card="light"]').click();
  expect(await themeNotices(page), 'geen tweede themamelding').toEqual([1]);
  await settingsDialog.getByRole('button', { name: FR_COMMON.settings.language, exact: true }).click();
  await page.getByRole('option', { name: /Nederlands/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('.ops-toast', { hasText: NL_COMMON.notifications.hostThemeUntilRestart })).toHaveCount(1);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => [localStorage.getItem('ops-theme'), localStorage.getItem('ops-locale')]),
    'lokaal staat al wat de host bewaart').toEqual([hostBefore['ops-theme'], hostBefore['ops-locale']]);
  await page.waitForTimeout(1_000);
  expect(await hostWrites(), 'geen enkele set/delete naar de host tijdens het wachten').toEqual([]);
  expect(await hostSettings(), 'de host is onaangeroerd').toEqual(hostBefore);

  await page.evaluate(() => (window as unknown as { __testReleaseHost: () => void }).__testReleaseHost());
  await expect.poll(lateNotices, { message: 'één melding, met "teruggezet"' }).toEqual(['geladen, teruggezet']);
  await expect(page.locator('.ops-toast', { hasText: FR_COMMON.notifications.settingsLoadedLateReverted })).toHaveCount(1);
  await expect(delayDialog).toHaveCount(0);
  expect(await storedTypeNames(), 'de bewaarde persoonlijke werksoorten terug, de nieuwe weg').toEqual(['Bewaard type']);
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
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => [
    window.__OPS__!.store.getState().ui.uiTheme,
    localStorage.getItem('ops-theme'),
    localStorage.getItem('ops-locale'),
    window.__OPS__!.store.getState().ui.showFloatBand,
  ])).toEqual(['dark', hostBefore['ops-theme'], hostBefore['ops-locale'], false]);
  expect(await seenThemeNotices(), 'na het late antwoord nog steeds één themamelding').toEqual([1]);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  await page.getByRole('dialog').locator('[data-ops-theme-card="light"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Escape');
  expect(await seenThemeNotices(), 'een volgende wissel geeft geen tweede themamelding').toEqual([1]);
  await page.locator('[data-ops-ribbon-tab="beeld"]').click();
  await expect.poll(() => floatBandSlow.evaluate(el => el.classList.contains('active')), { message: 'Spelingsband volgt de host' }).toBe(false);
  await floatBandSlow.click();
  await expect.poll(() => hostSettings().then((all) => all['ops-showFloatBand'])).toBe('true');
  expect((await hostWrites()).filter((entry) => entry.startsWith('delete')), 'geen enkele delete').toEqual([]);
  expect((await hostSettings())['ops-personalTaskTypes'], 'de bewaarde werksoorten bij de host').toBe(KEPT);
  await page.evaluate(() => sessionStorage.removeItem('test-host-hold'));

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
  await appWanted;
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
  const lateList = await openTaskTypes();
  await expect(lateList).toContainText('Bewaard type');
  const lateOptions = lateList.getByRole('option');
  await lateOptions.nth((await lateOptions.count()) - 2).click();
  await expect(newTypeDialog).toBeVisible();
  await newTypeDialog.getByRole('textbox').fill('Nieuw tijdens start');
  await page.keyboard.press('Enter');
  await expect(newTypeDialog).toBeHidden();
  await expect.poll(() => hostSettings().then((all) => (JSON.parse(all['ops-personalTaskTypes'] ?? '[]') as { name: string }[])
    .map((t) => t.name).sort())).toEqual(['Bewaard type', 'Nieuw tijdens start']);
  await page.evaluate(() => window.dispatchEvent(new Event('openaec-host-ready')));
  await page.waitForTimeout(1_000);
  expect(await lateNotices(), 'nog steeds één melding').toEqual(['geladen']);
  expect((await hostWrites()).filter((entry) => entry.startsWith('delete')), 'geen enkele delete').toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.evaluate(() => sessionStorage.removeItem('test-late-host'));

  await page.evaluate(() => localStorage.setItem('test-no-host', 'true'));
  await page.reload();
  await waitForOps(page);
  await expect(dialog).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  expect(await waitForWelcomeCheck(page)).toBe('welkomstcontrole: getoond');
});

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
