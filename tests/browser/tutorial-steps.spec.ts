import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type ConsoleMessage } from '@playwright/test';
import { LANGS } from './tutorials/dsl';
import { TUTORIAL_SCRIPTS } from './tutorials';
import { runTutorial } from './tutorials/runner';
import { waitForOps } from './fixtures/ops';

// De stapscripts van de zeven tutorials (extensie `tutorials`), elk in nl en en, met echte
// browser-events vanaf de stand van de generator (ontwerp gebruikersdocumentatie §7.4): een hernoemde
// knop, een ander venster of een andere uitkomst maakt de tutorial hier rood, vóórdat een lezer een
// verouderde tutorial volgt. Elke tutorial eindigt exact op de eindstand van `gen:tutorial-project`.
//
// Dezelfde spec is de screenshotgenerator: met `OPS_DOCS_SCREENSHOTS_OUT=<map>` (zo zet
// `npm run gen:docs-screenshots` hem) legt hij na elke stap de uitsneden vast als WebP. Alleen licht thema.

const captureDir = process.env.OPS_DOCS_SCREENSHOTS_OUT || undefined;
// Hulp bij het schrijven van een script: alleen deze tutorials (komma-gescheiden id's), en een volledige
// schermafdruk na elke stap.
const only = process.env.OPS_TUTORIAL_ONLY?.split(',').filter(Boolean);
const debugDir = process.env.OPS_TUTORIAL_DEBUG_DIR || undefined;

// Elke tutorial×taal is een eigen test, zodat CI ze over de shards kan verdelen.
test.describe.configure({ mode: 'parallel' });
// Vaste maat: de uitsneden en de lintindeling hangen ervan af. 1050 hoog: alle 27 regels van het project
// passen in de takenlijst.
test.use({ viewport: { width: 1280, height: 1050 }, colorScheme: 'light', actionTimeout: 10_000 });

let stagesDir = '';
test.beforeAll(() => {
  // De standen komen uit dezelfde generator als de projectbestanden van de extensie (±2 s).
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

      // Een lezer die de app al kent: taal gekozen, licht thema, welkomst en tutorialvraag gehad.
      // Alleen bij de eerste lading (een herlaad houdt wat de app zelf schreef).
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
