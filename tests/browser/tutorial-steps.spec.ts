import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type ConsoleMessage } from '@playwright/test';
import { LANGS } from './tutorials/dsl';
import { TUTORIAL_SCRIPTS } from './tutorials';
import { runTutorial } from './tutorials/runner';
import { waitForOps } from './fixtures/ops';

const captureDir = process.env.OPS_DOCS_SCREENSHOTS_OUT || undefined;
const only = process.env.OPS_TUTORIAL_ONLY?.split(',').filter(Boolean);
const debugDir = process.env.OPS_TUTORIAL_DEBUG_DIR || undefined;

test.describe.configure({ mode: 'parallel' });
test.use({ viewport: { width: 1280, height: 1050 }, colorScheme: 'light', actionTimeout: 10_000 });

let stagesDir = '';
test.beforeAll(() => {
  stagesDir = mkdtempSync(join(tmpdir(), 'ops-tutorial-stages-'));
  execFileSync(process.execPath, ['scripts/run-ts.mjs', 'scripts/generate-tutorial-project.ts', '--out', stagesDir], { stdio: 'pipe' });
});
test.afterAll(() => {
  if (stagesDir) rmSync(stagesDir, { recursive: true, force: true });
});

for (const script of TUTORIAL_SCRIPTS) {
  if (only && !only.includes(script.id)) continue;
  for (const lang of LANGS) {
    test(`tutorial ${script.id} (${lang}): de stappen werken in de app`, async ({ page }) => {
      test.setTimeout(240_000);
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(`pageerror: ${e.stack ?? e.message}`));
      page.on('console', (m: ConsoleMessage) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

      await page.addInitScript((locale: string) => {
        if (sessionStorage.getItem('ops-tutorial-steps-seeded')) return;
        sessionStorage.setItem('ops-tutorial-steps-seeded', '1');
        localStorage.clear();
        localStorage.setItem('ops-locale', locale);
        localStorage.setItem('ops-theme', 'light');
        localStorage.setItem('ops-welcomeSeen', 'true');
        localStorage.setItem('ops-tutorialOfferAnswered', 'true');
      }, lang);
      await page.goto('/');
      await waitForOps(page);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

      await runTutorial(page, script, { lang, stagesDir, captureDir, debugDir });

      expect(errors, 'geen browserfouten tijdens de tutorial').toEqual([]);
    });
  }
}
