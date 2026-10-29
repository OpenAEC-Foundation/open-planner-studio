import { expect, test } from './fixtures/ops';
import type { Page } from '@playwright/test';
import type { DownloadEvent } from '@tauri-apps/plugin-updater';
import { completeTour, freshStart, startTourFromWelcome, tutorialOffer } from './fixtures/onboarding';

type UpdaterStep = 'download' | 'recovery' | 'install' | 'relaunch';

declare global {
  interface Window {
    openedReleaseUrls?: string[];
    updaterProbe: {
      kind: 'aur' | 'snap' | 'native' | 'deb';
      delayed: boolean;
      detections: Array<() => void>;
      calls: string[];
      installDone: boolean;
      downloadEvent?: (event: DownloadEvent) => void;
      steps: Partial<Record<UpdaterStep, { resolve: () => void; reject: (reason: Error) => void }>>;
    };
  }
}

/**
 * De dialoog bevraagt de GitHub Releases-API voor de releasevergelijking (grootteverschil, tijd
 * tussen releases). Onbevoegd is die API op een gedeelde CI-runner rate-limited (403) en achter
 * een sandboxproxy niet vertrouwd (ERR_CERT_AUTHORITY_INVALID); beide geven een console.error die
 * de harness als fout telt, terwijl deze tests niets uit die vergelijking asserteren. Antwoord
 * daarom deterministisch met een lege lijst — de pure functies erachter zijn headless getest in
 * tests/planning/check-just-updated.ts.
 */
async function stubReleasesApi(page: Page): Promise<void> {
  await page.route('https://api.github.com/repos/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function selectLocale(page: Page, option: string, expectedLocale: string): Promise<void> {
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const settings = page.locator('.settings-dialog');
  await expect(settings).toBeVisible();
  // Taal zit sinds U1 op de Weergave-tab (tab 0, standaard al actief) samen met andere Selects,
  // dus scopen op de aria-label i.p.v. de eerste listbox-knop op de tab.
  await settings.locator('.settings-tab').nth(0).click();
  await settings.getByRole('button', { name: /^(Language|Taal)$/, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(expectedLocale);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: false }));
}

test('update-highlights volgen de app-ready route en houden externe link open', async ({ page, ops: _ops }) => {
  await stubReleasesApi(page);
  await page.evaluate(() => {
    window.openedReleaseUrls = [];
    window.open = ((url?: string | URL) => {
      window.openedReleaseUrls!.push(String(url));
      return window;
    }) as typeof window.open;
  });
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ justUpdated: { from: '2026.8.0', to: '2026.8.1' } }));
  const dialog = page.locator('[data-ops-just-updated-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("You've been updated!", { exact: true })).toBeVisible();
  await expect(dialog.locator('pre')).toHaveCount(0);
  await expect(dialog.locator('article')).toHaveCount(5);
  await expect(dialog.getByRole('button', { name: 'Read the guide' })).toHaveCount(1);
  await expect(dialog.locator('article').nth(0).getByRole('button', { name: 'Read the guide' })).toHaveCount(1);
  await expect(dialog.locator('article').nth(1).getByRole('button')).toHaveCount(0);
  await expect(dialog.locator('article').nth(2).getByRole('button')).toHaveCount(0);
  await expect(dialog.locator('article').nth(3).getByRole('button')).toHaveCount(0);
  await expect(dialog.locator('article').nth(4).getByRole('button')).toHaveCount(0);
  await page.getByText('See full release notes').click({ noWaitAfter: true });
  await expect.poll(() => page.evaluate(() => window.openedReleaseUrls ?? [])).toEqual(['https://github.com/OpenAEC-Foundation/open-planner-studio/wiki/Changelog']);
  await expect(dialog).toBeVisible();
  await page.evaluate(() => { window.open = (() => null) as typeof window.open; });
  await page.getByText('See full release notes').click({ noWaitAfter: true });
  await expect(dialog.getByRole('alert')).toHaveText('The release notes could not be opened.');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('update-highlights werken smal, licht/donker en RTL', async ({ page, ops: _ops }) => {
  await stubReleasesApi(page);
  await page.setViewportSize({ width: 390, height: 420 });
  await selectLocale(page, 'NL — Nederlands', 'nl');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ uiTheme: 'light', justUpdated: { from: null, to: '2026.8.1' } }));
  const dialog = page.locator('[data-ops-just-updated-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Importeer met de datums uit je planning')).toBeVisible();
  await expect(dialog.getByText('RESOURCEBIBLIOTHEKEN', { exact: true })).toBeVisible();
  await expect(dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).resolves.toBe(true);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ justUpdated: null }));
  await expect(dialog).toHaveCount(0);
  await selectLocale(page, 'AR — العربية', 'ar');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ uiTheme: 'dark', justUpdated: { from: null, to: '2026.8.1' } }));
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('إشغال مكتبة الموارد')).toBeVisible();
  await expect(dialog.getByText('الموارد', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  await expect(dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).resolves.toBe(true);
});

// Besluit eigenaar 2026-10-19: vanaf 2026.10.0 hebben de hoogtepunten alle 28 UI-talen; oudere
// blokken houden hun veertien en vallen voor een nieuwere taal terug op Engels.
test('update-highlights: nieuwe taal toont 2026.10.0, een ouder blok valt terug op Engels', async ({ page, ops: _ops }) => {
  await stubReleasesApi(page);
  await selectLocale(page, 'SV — Svenska', 'sv');
  const dialog = page.locator('[data-ops-just-updated-dialog]');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ justUpdated: { from: null, to: '2026.10.0' } }));
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Öppna Primavera P6-filer')).toBeVisible();
  await expect(dialog.locator('article')).toHaveCount(5);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ justUpdated: null }));
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ justUpdated: { from: null, to: '2026.9.0' } }));
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Edit faster in one shared task grid')).toBeVisible();
});

// Eerste start met een bestaande `ops-lastVersion` maar zonder `ops-welcomeSeen` (bv. opslag
// gedeeltelijk gewist): "Net bijgewerkt" wacht op de hele eerste-startervaring (`isOnboardingActive`)
// — eerst welkom, rondleiding en tutorialvraag, pas daarna de updatehoogtepunten. De detectie zelf
// (`useUpdateCheck`) is Tauri-only en headless getest in check-just-updated.ts; hier zet de dev-brug
// haar uitkomst, direct na het laden, nog vóór de welkomst open is.
test('"Net bijgewerkt" pas na welkomst, rondleiding en tutorialvraag', async ({ page, ops: _ops }) => {
  await stubReleasesApi(page);
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }));
  const justUpdated = page.locator('[data-ops-just-updated-dialog]');
  await freshStart(page, {
    seed: { 'ops-lastVersion': JSON.stringify('2026.8.0') },
    afterLoad: async p => {
      await p.evaluate(() => window.__OPS__!.store.getState().setUI({ justUpdated: { from: '2026.8.0', to: '2026.8.1' } }));
    },
  });
  await expect(justUpdated).toHaveCount(0);

  await startTourFromWelcome(page);
  await completeTour(page, async () => { await expect(justUpdated).toHaveCount(0); });
  await expect(tutorialOffer(page)).toBeVisible();
  await expect(justUpdated).toHaveCount(0);

  await tutorialOffer(page).getByRole('button', { name: /^(No|Nee)$/ }).click();
  await expect(tutorialOffer(page)).toHaveCount(0);
  await expect(justUpdated).toBeVisible();
});

// Andere route dan de highlights hierboven: een beschikbare update installeren. De desktop-API's
// krijgen testdoubles; de echte UpdateDialog en updaterService blijven draaien in de browser.
test('bijwerken toont voortgang, installatie en herstart; AUR en Snap blijven bij pakketbeheer', async ({ page, ops: _ops }) => {
  const dialog = page.getByRole('dialog').filter({ hasText: /Software[- ]update/ });
  const install = dialog.getByRole('button', { name: /^(Download & install|Downloaden & installeren)$/ });
  const closeButtons = dialog.getByRole('button', { name: /^(Close|Sluiten)$/ });
  const progress = dialog.getByRole('progressbar');
  // Zonder desktop-API blijft de bestaande webroute een no-op.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showUpdateDialog: true }));
  await expect(dialog.getByText("You're running the latest version", { exact: true })).toBeVisible();
  await expect(install).toHaveCount(0);
  await closeButtons.last().click();
  await page.addInitScript(() => {
    window.updaterProbe = { kind: 'aur', delayed: true, detections: [], calls: [], installDone: false, steps: {} };
  });
  const doubles: Record<string, string> = {
    platform: 'export const isTauri = () => true;',
    gates: `export function waitFor(step) {
      window.updaterProbe.calls.push(step);
      return new Promise((resolve, reject) => {
        window.updaterProbe.steps[step] = { resolve, reject };
      });
    }`,
    recovery: `import { waitFor } from '/__updater_probe__/gates.js';
      export const flushRecoveryNow = () => waitFor('recovery');`,
    core: `export async function invoke() {
      const probe = window.updaterProbe;
      if (!probe.delayed) return probe.kind;
      return new Promise(resolve => probe.detections.push(() => resolve(probe.kind)));
    }`,
    updater: `import { waitFor } from '/__updater_probe__/gates.js';
    export async function check() {
      return {
        version: '2099.1.0', body: 'Test release',
        download: async (onEvent) => {
          window.updaterProbe.downloadEvent = onEvent;
          await waitFor('download');
        },
        install: () => waitFor('install'),
      };
    }`,
    process: `import { waitFor } from '/__updater_probe__/gates.js';
      export const relaunch = () => waitFor('relaunch');`,
  };
  await page.route('**/__updater_probe__/*.js', route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!.replace('.js', '');
    return route.fulfill({ contentType: 'text/javascript', body: doubles[name] });
  });
  await page.route('**/src/services/updater/updaterService.ts*', async route => {
    const response = await route.fetch();
    let body = await response.text();
    // Alleen de externe afhankelijkheden van deze service vervangen; de app blijft een webbuild.
    for (const [pattern, name] of [
      [/(["'])\/src\/utils\/platform\.ts(?:\?[^"']*)?\1/g, 'platform'],
      [/(["'])\/src\/services\/recovery\/recoveryFlush\.ts(?:\?[^"']*)?\1/g, 'recovery'],
      [/(["'])[^"']*@tauri-apps_api_core[^"']*\1/g, 'core'],
      [/(["'])[^"']*@tauri-apps_plugin-updater[^"']*\1/g, 'updater'],
      [/(["'])[^"']*@tauri-apps_plugin-process[^"']*\1/g, 'process'],
    ] as const) {
      body = body.replace(pattern, `"/__updater_probe__/${name}.js"`);
    }
    await route.fulfill({ response, body });
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!window.__OPS__)).toBe(true);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({
    showWelcomeDialog: false, showTourOverlay: false, showUpdateDialog: true,
  }));
  await expect(dialog.getByText('A new version is available', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.updaterProbe.detections.length)).toBeGreaterThan(0);
  const detections = await page.evaluate(() => window.updaterProbe.detections.length);
  // De updatecheck is al klaar, de Arch-detectie nog niet: er is geen installeerknop.
  await expect(install).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.updaterProbe.calls)).toEqual([]);

  // Onafhankelijke servicecontrole: ook een rechtstreekse aanroep moet op detectie wachten.
  await page.evaluate(async () => {
    const moduleUrl = '/src/services/updater/updaterService.ts';
    const service = await import(moduleUrl) as typeof import('@/services/updater/updaterService');
    void service.downloadAndInstall().then(() => { window.updaterProbe.installDone = true; });
  });
  await expect.poll(() => page.evaluate(expected => (
    window.updaterProbe.installDone || window.updaterProbe.detections.length === expected
  ), detections + 1)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.updaterProbe.calls)).toEqual([]);
  await page.evaluate(() => {
    window.updaterProbe.delayed = false;
    window.updaterProbe.detections.forEach(resolve => resolve());
  });
  await expect.poll(() => page.evaluate(() => window.updaterProbe.installDone)).toBe(true);
  await expect(dialog.getByText('Update through your package manager (for example yay -Syu).')).toBeVisible();
  await expect(install).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.updaterProbe.calls)).toEqual([]);

  const sendDownloadEvent = async (event: DownloadEvent) => {
    await expect.poll(() => page.evaluate(() => !!window.updaterProbe.steps.download)).toBe(true);
    await page.evaluate(event => window.updaterProbe.downloadEvent!(event), event);
  };
  const completeStep = async (step: UpdaterStep, error?: string) => {
    await expect.poll(() => page.evaluate(step => !!window.updaterProbe.steps[step], step)).toBe(true);
    await page.evaluate(({ step, error }) => {
      const pending = window.updaterProbe.steps[step]!;
      if (error) pending.reject(new Error(error));
      else pending.resolve();
    }, { step, error });
  };
  const expectLocked = async () => {
    for (const button of await dialog.getByRole('button').all()) await expect(button).toBeDisabled();
    await page.keyboard.press('Escape');
    await dialog.locator('..').click({ position: { x: 1, y: 1 } });
    await expect(dialog).toBeVisible();
  };
  const expectPhase = async (label: string) => {
    await expect(dialog.getByRole('status')).toHaveText(label);
    await expect(progress).toHaveCount(0);
    await expect(dialog.getByText(/^\d+%$/)).toHaveCount(0);
    await expect(dialog.getByText(/^(Checking…|Bezig met controleren…)$/)).toHaveCount(0);
    await expectLocked();
  };

  // Snap houdt dezelfde blokkade; een bekende native installatie hoeft geen tijdslimiet af te wachten.
  for (const kind of ['snap', 'native'] as const) {
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
    await page.evaluate(kind => {
      window.updaterProbe.kind = kind;
      window.__OPS__!.store.getState().setUI({ showUpdateDialog: true });
    }, kind);
    await expect(dialog.getByText('A new version is available', { exact: true })).toBeVisible();
    if (kind === 'snap') {
      await expect(dialog.getByText(/automatically via the Snap Store/)).toBeVisible();
      await expect(install).toHaveCount(0);
      await page.evaluate(async () => {
        const moduleUrl = '/src/services/updater/updaterService.ts';
        const service = await import(moduleUrl) as typeof import('@/services/updater/updaterService');
        await service.downloadAndInstall();
      });
      await expect.poll(() => page.evaluate(() => window.updaterProbe.calls)).toEqual([]);
    } else {
      await install.click();
      await sendDownloadEvent({ event: 'Started', data: { contentLength: 1000 } });
      await sendDownloadEvent({ event: 'Progress', data: { chunkLength: 250 } });
      await expect(progress).toHaveAttribute('aria-valuenow', '25');
      await expect(dialog.getByText('25%', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Downloading…', { exact: true })).toBeVisible();
      await expectLocked();
      await sendDownloadEvent({ event: 'Progress', data: { chunkLength: 750 } });
      await expect(progress).toHaveAttribute('aria-valuenow', '100');
      await expect(dialog.getByText('100%', { exact: true })).toBeVisible();
      // Finished is alleen het einde van de bytes; de handtekeningcontrole kan nog mislukken.
      await sendDownloadEvent({ event: 'Finished' });
      await expectPhase('Preparing installation…');
      await expect.poll(() => page.evaluate(() => window.updaterProbe.calls)).toEqual(['download']);
      await completeStep('download');
      await expect.poll(() => page.evaluate(() => window.updaterProbe.calls)).toEqual(['download', 'recovery']);
      await expectPhase('Preparing installation…');
      await completeStep('recovery');
      await expectPhase('Installing…');
      await expect.poll(() => page.evaluate(() => window.updaterProbe.calls)).toEqual(['download', 'recovery', 'install']);
      await completeStep('install');
      await expectPhase('Restarting…');
      await expect.poll(() => page.evaluate(() => window.updaterProbe.calls)).toEqual(['download', 'recovery', 'install', 'relaunch']);
      await completeStep('relaunch', 'Test restart failure');
      await expect(dialog.getByText('Test restart failure', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('status')).toHaveCount(0);
      await expect(closeButtons.first()).toBeEnabled();
      await expect(closeButtons.last()).toBeEnabled();
    }
  }

  // Een mislukte herstart laat opnieuw controleren toe. Zonder contentLength geen verzonnen 0%.
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(install).toBeVisible();
  await page.evaluate(() => { window.updaterProbe.calls = []; window.updaterProbe.steps = {}; });
  await install.click();
  await sendDownloadEvent({ event: 'Started', data: {} });
  await sendDownloadEvent({ event: 'Progress', data: { chunkLength: 250 } });
  await expect(progress).toBeVisible();
  await expect(progress).not.toHaveAttribute('aria-valuenow');
  await expect(dialog.getByText(/^\d+%$/)).toHaveCount(0);
  await sendDownloadEvent({ event: 'Finished' });
  await expectPhase('Preparing installation…');
  await completeStep('download', 'Test signature failure');
  await expect(dialog.getByText('Test signature failure', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.updaterProbe.calls)).toEqual(['download']);
  await expect(dialog.getByRole('status')).toHaveCount(0);
  // Knownbug 203: een afgewezen herstelronde mag nooit installeren of herstarten.
  // Dit loopt door de echte service en dialoog, niet een gekopieerde beslisregel.
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(install).toBeEnabled();
  await page.evaluate(() => { window.updaterProbe.calls = []; window.updaterProbe.steps = {}; });
  await install.click();
  await sendDownloadEvent({ event: 'Started', data: {} });
  await sendDownloadEvent({ event: 'Finished' });
  await completeStep('download');
  await expectPhase('Preparing installation…');
  await completeStep('recovery', 'Test recovery flush failure');
  await expect(dialog.getByText('Test recovery flush failure', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.updaterProbe.calls)).toEqual(['download', 'recovery']);
  await expect(dialog.getByRole('status')).toHaveCount(0);
  await expect(closeButtons.first()).toBeEnabled();
  await expect(closeButtons.last()).toBeEnabled();

  // Na de fout opnieuw via dezelfde knop: een geslaagde flush staat installatie weer toe.
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(install).toBeEnabled();
  await page.evaluate(() => { window.updaterProbe.calls = []; window.updaterProbe.steps = {}; });
  await install.click();
  await sendDownloadEvent({ event: 'Started', data: {} });
  await sendDownloadEvent({ event: 'Finished' });
  await completeStep('download');
  await completeStep('recovery');
  await expectPhase('Installing…');
  await expect.poll(() => page.evaluate(() => window.updaterProbe.calls)).toEqual(['download', 'recovery', 'install']);
  await completeStep('install', 'Test retry installation failure');
  await expect(dialog.getByText('Test retry installation failure', { exact: true })).toBeVisible();
  await closeButtons.last().click();
  await expect(dialog).toHaveCount(0);

  // Dezelfde installatie in het Nederlands; .deb houdt zijn handmatige terugval na een fout.
  await selectLocale(page, 'NL — Nederlands', 'nl');
  await page.evaluate(() => {
    window.updaterProbe.kind = 'deb';
    window.updaterProbe.calls = [];
    window.updaterProbe.steps = {};
    window.__OPS__!.store.getState().setUI({ showUpdateDialog: true });
  });
  await install.click();
  await sendDownloadEvent({ event: 'Started', data: {} });
  await sendDownloadEvent({ event: 'Finished' });
  await expectPhase('Installatie voorbereiden…');
  await completeStep('download');
  await completeStep('recovery');
  await expectPhase('Bezig met installeren…');
  await completeStep('install', 'Test installation failure');
  await expect(dialog.getByText('Er ging iets mis bij het bijwerken', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Test installation failure', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.updaterProbe.calls)).toEqual(['download', 'recovery', 'install']);
  await expect(dialog.getByRole('status')).toHaveCount(0);
  await expect(dialog.getByText('Installatiecommando', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Commando kopiëren', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Open downloadpagina', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Opnieuw proberen', exact: true }).click();
  await expect(install).toBeEnabled();
  await closeButtons.last().click();
  await expect(dialog).toHaveCount(0);
});
