import { expect, test } from '@playwright/test';
import { waitForOps } from './fixtures/ops';

test('de ontwikkelapp start met de zelftestbrug', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#root > div')).toBeVisible();
  await expect.poll(() => page.evaluate(() => '__OPS__' in window)).toBe(true);
});

// Issue #895: geen half getekende eerste weergave en geen lege vlakte bij Bestand. Een
// MutationObserver kijkt bij elke DOM-wijziging (vóór de browser tekent) wat er staat: het bewaarde
// uiterlijk moet er al zijn zodra de app iets in `#root` zet, en na de klik op Bestand mag er geen
// moment zijn zonder werkruimte én zonder Backstage.
test('de eerste weergave heeft het bewaarde uiterlijk en Bestand opent zonder lege vlakte', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ops-uiFontScale', '125');
    localStorage.setItem('ops-uiFontFamily', '"system"');
    localStorage.setItem('ops-welcomeSeen', 'true');
    const w = window as unknown as {
      __firstFrame?: { scale: string; family: string } | null;
      __watchFile?: boolean;
      __blankFrames?: number;
    };
    w.__firstFrame = null;
    w.__blankFrames = 0;
    new MutationObserver(() => {
      if (!document.getElementById('root')?.firstElementChild) return;
      const style = document.documentElement.style;
      w.__firstFrame ??= {
        scale: style.getPropertyValue('--ui-font-scale').trim(),
        family: style.getPropertyValue('--font-body').trim(),
      };
      if (w.__watchFile && !document.querySelector('.ui-workspace, .backstage')) w.__blankFrames! += 1;
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/');
  await waitForOps(page);

  const firstFrame = await page.evaluate(() => (window as unknown as { __firstFrame: unknown }).__firstFrame);
  expect(firstFrame, 'schaal en lettertype staan er al bij de eerste weergave').toEqual({
    scale: '1.25',
    family: expect.stringMatching(/system-ui/),
  });

  await page.evaluate(() => { (window as unknown as { __watchFile: boolean }).__watchFile = true; });
  await page.locator('.ribbon-tab--file').click();
  await expect(page.locator('[data-ops-backstage-back]')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __blankFrames: number }).__blankFrames),
    'geen moment zonder werkruimte en zonder Backstage').toBe(0);
});

// Issue #895: mislukt de start, dan een zichtbaar foutscherm met details en Opnieuw laden, geen leeg
// venster. De app-bundel laadt hier niet (de echte faalroute in `main.tsx`); de tweede keer wel.
test('een mislukte start toont het foutscherm, en Opnieuw laden start de app', async ({ page }) => {
  let block = true;
  await page.route(/\/src\/App\.tsx/, route => (block ? route.abort() : route.fallback()));
  await page.addInitScript(() => localStorage.setItem('ops-locale', 'nl'));
  await page.goto('/');
  const screen = page.locator('#ops-fatal-error');
  await expect(screen.getByRole('heading', { name: 'Er ging iets mis' })).toBeVisible();
  await expect(screen.locator('pre')).toContainText(/App\.tsx/);
  await expect(screen.getByRole('button', { name: 'Opnieuw laden' })).toBeFocused();

  block = false;
  await screen.getByRole('button', { name: 'Opnieuw laden' }).click();
  await waitForOps(page);
  await expect(page.locator('#ops-fatal-error')).toHaveCount(0);
});
