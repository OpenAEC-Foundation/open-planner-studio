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
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showSettingsDialog: true }));
  const settings = page.getByRole('dialog');
  await expect(settings).toBeVisible();
  await settings.locator('[data-ops-follow-system-theme]').check();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme)).toBe('system');
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

  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.uiTheme)).toBe('dark');
  expect(await documentTheme(page)).toBe('dark');
  await expect(settings.locator('[data-ops-theme-card="dark"]')).toBeEnabled();
  await expect(settings.locator('[data-ops-theme-card="dark"]')).toHaveAttribute('aria-pressed', 'true');

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
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-oa-theme'))).toBe('light');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().ui.systemPrefersDark)).toBe(true);
  expect(await documentTheme(page)).toBe('light');
});

test('bij het opstarten staat het systeemthema er vóór de eerste paint', async ({ page, ops: _ops }) => {
  await page.evaluate(() => {
    localStorage.setItem('ops-theme', 'system');
    localStorage.setItem('ops-welcomeSeen', 'true');
  });
  await page.emulateMedia({ colorScheme: 'light' });

  await page.addInitScript(() => {
    const trail: (string | null)[] = [];
    (window as unknown as { __themeTrail: (string | null)[] }).__themeTrail = trail;
    const push = () => {
      const root: HTMLElement | null = document.documentElement;
      if (root) trail.push(`${root.getAttribute('data-theme')}|${root.getAttribute('data-oa-theme')}`);
    };
    push();
    new MutationObserver(push).observe(document, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-theme', 'data-oa-theme'],
    });
  });

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__OPS__ !== undefined), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => documentTheme(page)).toBe('light');

  const trail = await page.evaluate(
    () => (window as unknown as { __themeTrail: (string | null)[] }).__themeTrail,
  );
  expect(trail).toContain('light|light');
  expect(trail.filter(value => value !== 'null|null' && value !== 'light|light')).toEqual([]);
});
