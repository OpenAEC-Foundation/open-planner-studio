// Thema "Systeem": de app volgt `prefers-color-scheme` van het OS/de browser.
//
// Twee dingen die alleen een echte browser kan aantonen en die de headless batterij
// (`tests/planning/check-system-theme.ts`) dus niet dekt:
//  1. een LIVE systeemwissel bereikt zowel de DOM-chrome (`data-theme`) als de Canvas-2D-laag;
//  2. bij het opstarten staat het juiste thema er al vóór de eerste paint — de pre-paint-spiegel
//     in index.html, die anders precies bij de systeemvolger de flits van issue #61 terugbrengt.
//
// De systeemwissel is een echte omgevingswijziging (`page.emulateMedia`), geen store-fixture; de
// themakeuze zelf is een echte klik op de themakaart.
import type { Page } from '@playwright/test';
import { expect, seedProject, test } from './fixtures/ops';

const SEED = [{ name: 'Systeemthema-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 }];

function paintCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__OPS__!.gantt.paintCount('primary'));
}

function documentTheme(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

function canvasDataUrl(page: Page): Promise<string> {
  return page.locator('[data-testid="gantt-primary-canvas"]').evaluate(
    (canvas: HTMLCanvasElement) => canvas.toDataURL(),
  );
}

async function chooseSystemTheme(page: Page): Promise<void> {
  // Het openen mag fixturematig; de geteste gebruikershandeling is de echte klik op de schakelaar.
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const settings = page.getByRole('dialog');
  await expect(settings).toBeVisible();
  await settings.locator('[data-ops-follow-system-theme]').check();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme)).toBe('system');
  // De drie themakaarten zijn geen keuze meer zolang de schakelaar aanstaat.
  for (const id of ['dark', 'light', 'high-contrast']) {
    await expect(settings.locator(`[data-ops-theme-card="${id}"]`)).toBeDisabled();
  }
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: false }));
  await expect(settings).toBeHidden();
}

test('een systeemwissel stuurt zowel de DOM-chrome als het Gantt-canvas', async ({ page, ops: _ops }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await seedProject(page, SEED);
  await expect(page.getByTestId('gantt-primary-canvas')).toBeVisible();
  await chooseSystemTheme(page);

  await expect.poll(() => documentTheme(page)).toBe('light');
  await page.evaluate(async () => { await document.fonts.ready; });
  const beforePaint = await paintCount(page);
  const beforeCanvas = await canvasDataUrl(page);

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => documentTheme(page)).toBe('dark');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.systemPrefersDark)).toBe(true);
  // De voorkeur zelf blijft 'system'; alleen de resolutie beweegt mee.
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme)).toBe('system');
  await expect.poll(() => paintCount(page)).toBeGreaterThan(beforePaint);
  await expect.poll(() => canvasDataUrl(page)).not.toBe(beforeCanvas);

  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => documentTheme(page)).toBe('light');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.systemPrefersDark)).toBe(false);
});

test('de schakelaar uitzetten houdt het thema dat op het scherm staat', async ({ page, ops: _ops }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await seedProject(page, SEED);
  await chooseSystemTheme(page);
  await expect.poll(() => documentTheme(page)).toBe('dark');

  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const settings = page.getByRole('dialog');
  await settings.locator('[data-ops-follow-system-theme]').uncheck();

  // Geen sprong: de voorkeur wordt het thema dat het systeem zojuist opleverde, en de kaarten
  // zijn weer kiesbaar met precies díé kaart gemarkeerd.
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme)).toBe('dark');
  expect(await documentTheme(page)).toBe('dark');
  await expect(settings.locator('[data-ops-theme-card="dark"]')).toBeEnabled();
  await expect(settings.locator('[data-ops-theme-card="dark"]')).toHaveAttribute('aria-pressed', 'true');

  // En daarna volgt hij het systeem niet meer.
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.systemPrefersDark)).toBe(false);
  expect(await documentTheme(page)).toBe('dark');
});

test('een expliciet gekozen thema negeert de systeemwissel', async ({ page, ops: _ops }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const settings = page.getByRole('dialog');
  await expect(settings).toBeVisible();
  await settings.locator('[data-ops-theme-card="light"]').click();
  await expect.poll(() => documentTheme(page)).toBe('light');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.systemPrefersDark)).toBe(true);
  expect(await documentTheme(page)).toBe('light');
});

test('bij het opstarten staat het systeemthema er vóór de eerste paint', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    localStorage.setItem('ops-theme', 'system');
    localStorage.setItem('ops-welcomeSeen', 'true');
  });
  await page.emulateMedia({ colorScheme: 'dark' });

  // Registreer élke waarde die `data-theme` ooit heeft gehad, vanaf documentcreatie. Zou de
  // pre-paint-spiegel de systeemvoorkeur niet kennen, dan staat er eerst 'dark' zonder reden of
  // — bij een licht systeem — 'light' vóór React: precies de flits die dit voorkomt.
  await page.addInitScript(() => {
    const trail: (string | null)[] = [];
    (window as unknown as { __themeTrail: (string | null)[] }).__themeTrail = trail;
    // Op dit moment bestaat `<html>` nog niet (het initscript draait bij documentcreatie), dus
    // observeren we het document zelf met `subtree` en lezen we het attribuut pas als er iets is.
    const push = () => {
      const root: HTMLElement | null = document.documentElement;
      if (root) trail.push(root.getAttribute('data-theme'));
    };
    push();
    new MutationObserver(push).observe(document, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-theme'],
    });
  });

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__OPS__ !== undefined), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => documentTheme(page)).toBe('dark');

  const trail = await page.evaluate(
    () => (window as unknown as { __themeTrail: (string | null)[] }).__themeTrail,
  );
  // `null` = het attribuut bestond nog niet (de observer start vóór het pre-paint-script).
  // De eerste eis maakt de tweede pas zinvol: een leeg spoor zou de filtercheck vacuüm groen maken.
  expect(trail).toContain('dark');
  expect(trail.filter(value => value !== null && value !== 'dark')).toEqual([]);
});
