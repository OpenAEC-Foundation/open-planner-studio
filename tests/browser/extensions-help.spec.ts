import { expect, test, state } from './fixtures/ops';
import type { Locator, Page } from '@playwright/test';

// Extensie-API 1.4.0 (`api.help.*`) end-to-end: een test-extensie registreert een tutorial, opent
// een meegeleverd project en start het begeleidingspaneel. De extensie wordt geïnstalleerd via de
// dev-brug (`__OPS__.extensions.installFromCode`, net als extensions-storage.spec.ts) — dat is de
// fixture. Alles wat de gebruiker doet (Help openen, de projectlink, de lintknop die de begeleiding
// start, de knop Taak, Opnieuw/Toon mij/Volgende/Terug/Sluiten, uitschakelen in Extensies) gaat via
// echte klikken.

const EXT_ID = 'test-tutorials';

// 1×1 PNG, voor de afbeelding in een stap (komt als blob-URL uit de assets van de extensie).
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const MAIN_JS = `
module.exports = {
  onLoad(api) {
    api.help.registerArticles([{
      id: 'tut-test-eerste', kind: 'tutorial', order: 1,
      title: { nl: 'Testtutorial', en: 'Test tutorial' },
      body: {
        nl: '# Testtutorial\\n\\n[Open het startproject](project://start.ifc)',
        en: '# Test tutorial\\n\\n[Open the starting project](project://start.ifc)',
      },
    }]);
    api.ui.addRibbonButton({
      tab: 'start', group: 'Tutorials', label: 'Start guide',
      onClick: () => {
        const baseline = api.data.getTasks().length;
        api.help.startGuide({
          id: 'tut-test', title: { nl: 'Testbegeleiding', en: 'Test guide' },
          steps: [
            {
              id: 'taak',
              body: {
                nl: 'Klik op **Taak** in het lint.\\n\\n---\\n\\nDe nieuwe taak staat onderaan.',
                en: 'Click **Task** on the ribbon.\\n\\n---\\n\\nThe new task is at the bottom.',
              },
              anchor: 'ribbon:start:addTask',
              check: (a) => a.data.getTasks().length > baseline,
              prepare: (a) => { a.data.addTask({ name: 'Shown by the guide' }); },
              resetAsset: 'start.ifc',
            },
            {
              id: 'kijken',
              body: {
                nl: 'Bekijk de afbeelding.\\n\\n![Stapafbeelding](img/{lang}/stap.png)',
                en: 'Look at the picture.\\n\\n![Step picture](img/{lang}/stap.png)',
              },
            },
          ],
        });
      },
    });
    api.ui.addRibbonButton({
      tab: 'start', group: 'Tutorials', label: 'Say done',
      onClick: () => api.ui.showNotification('<b>Done!</b>'),
    });
  },
};
`;

async function installTestExtension(page: Page): Promise<void> {
  await page.evaluate(async ({ id, code, png }) => {
    const res = await fetch('/examples/showcase-verbouwing-eengezinswoning.ifc');
    const ifc = new Uint8Array(await res.arrayBuffer());
    const image = Uint8Array.from(atob(png), c => c.charCodeAt(0));
    await window.__OPS__!.extensions.installFromCode({
      id,
      name: 'Testtutorials',
      version: '1.0.0',
      apiVersion: '1.4',
      minAppVersion: '0.0.0',
      author: 'Browserfixture',
      description: '',
      category: 'Other',
      main: 'main.js',
      permissions: ['help', 'ribbon'],
    }, code, { 'start.ifc': ifc, 'img/en/stap.png': image, 'img/nl/stap.png': image });
  }, { id: EXT_ID, code: MAIN_JS, png: PNG_1X1 });
  await expect.poll(() => page.evaluate(id => window.__OPS__!.store.getState().installedExtensions[id]?.status, EXT_ID))
    .toBe('enabled');
}

async function openHelp(page: Page): Promise<void> {
  await page.locator('.ribbon-tab--file').click();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.locator('.help-panel')).toBeVisible();
}

const panel = (page: Page) => page.locator('[data-ops-guide-panel]');
const action = (page: Page, name: string) => panel(page).locator(`[data-ops-guide-action="${name}"]`);

/** Omsluit de markering het element (6 px marge, zie TourSpotlight)? */
async function expectSpotlightAround(page: Page, target: Locator): Promise<void> {
  await expect(page.locator('[data-ops-tour-spotlight]')).toBeVisible();
  await expect.poll(async () => {
    const ring = await page.locator('[data-ops-tour-spotlight]').boundingBox();
    const box = await target.boundingBox();
    if (!ring || !box) return false;
    return Math.abs(ring.x - (box.x - 6)) < 2 && Math.abs(ring.y - (box.y - 6)) < 2
      && Math.abs(ring.width - (box.width + 12)) < 2 && Math.abs(ring.height - (box.height + 12)) < 2;
  }).toBe(true);
}

test('help-API: tutorial in Help, meegeleverd project openen, begeleiding met controle, opruimen bij uitschakelen', async ({ page, ops: _ops }) => {
  test.setTimeout(60_000);
  await installTestExtension(page);

  // Eigen werk in het actieve document: dat mag de projectlink niet overschrijven. (Een leeg,
  // ongewijzigd tabblad zou hergebruikt worden — zelfde regel als een voorbeeld openen.)
  await page.locator('[data-tour-anchor="ribbon:start:addTask"]').click();
  await expect.poll(async () => (await state(page)).tasks.length).toBe(1);
  const ownWork = await state(page);

  // ── Artikel onder Tutorials, en de projectlink opent een NIEUW document ──
  await openHelp(page);
  const tutorials = page.locator('[data-help-section="kind-tutorial"]');
  await expect(tutorials.locator('.help-toc-item')).toHaveText(['1.Test tutorial']);
  await tutorials.getByRole('button', { name: /Test tutorial/ }).click();
  const before = await state(page);
  await page.locator('.help-article-body [data-help-project="start.ifc"]').click();
  await expect.poll(async () => (await state(page)).documentIds.length).toBe(before.documentIds.length + 1);
  const opened = await state(page);
  expect(opened.activeDocumentId).not.toBe(before.activeDocumentId);
  expect(opened.tasks.length).toBeGreaterThan(0);
  expect(opened.documentIds).toContain(ownWork.activeDocumentId);
  // Zoals een voorbeeld: vanuit Help terug naar het project (Start-tab).
  await expect(page.locator('.help-panel')).toHaveCount(0);
  await expect(page.locator('[data-tour-anchor="ribbon-tab:start"]')).toHaveClass(/active/);

  // ── Begeleiding starten via de lintknop van de extensie ──
  await page.getByRole('button', { name: 'Start guide', exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-step', 'taak');
  await expect(panel(page).locator('[data-ops-guide-progress]')).toHaveText('Step 1 of 2');
  await expect(panel(page).locator('[data-ops-guide-task]')).toContainText('Click Task on the ribbon.');
  await expect(panel(page).locator('[data-ops-guide-waiting]')).toBeVisible();
  await expect(panel(page).locator('[data-ops-guide-explanation]')).toHaveCount(0);
  await expect(action(page, 'next')).toBeDisabled();
  await expect(action(page, 'back')).toBeDisabled();

  // Het anker (lintknop Taak) is gemarkeerd — en niet modaal: de knop blijft klikbaar.
  const addTask = page.locator('[data-tour-anchor="ribbon:start:addTask"]');
  await expectSpotlightAround(page, addTask);

  // Op een ander tabblad wijst de markering de tab aan waar de knop staat.
  await page.locator('[data-tour-anchor="ribbon-tab:planning"]').click();
  await expect(addTask).toHaveCount(0);
  await expectSpotlightAround(page, page.locator('[data-tour-anchor="ribbon-tab:start"]'));
  await page.locator('[data-tour-anchor="ribbon-tab:start"]').click();

  // De echte handeling: Taak in het lint ⇒ de controle slaagt.
  const tasksBefore = (await state(page)).tasks.length;
  await addTask.click();
  await expect.poll(async () => (await state(page)).tasks.length).toBe(tasksBefore + 1);
  await expect(panel(page)).toHaveAttribute('data-ops-guide-done', 'true');
  await expect(panel(page).locator('[data-ops-guide-done-badge]')).toBeVisible();
  await expect(panel(page).locator('[data-ops-guide-explanation]')).toContainText('The new task is at the bottom.');
  await expect(action(page, 'next')).toBeEnabled();
  await expect(action(page, 'next')).toHaveText('Next');
  await expect(page.locator('[data-ops-tour-spotlight]')).toHaveCount(0);

  // Opnieuw: de beginstand als nieuw document; de stap is weer open.
  const docsBeforeReset = (await state(page)).documentIds.length;
  await action(page, 'reset').click();
  await expect.poll(async () => (await state(page)).documentIds.length).toBe(docsBeforeReset + 1);
  await expect(panel(page)).toHaveAttribute('data-ops-guide-done', 'false');
  await expect(action(page, 'next')).toBeDisabled();

  // Toon mij: de extensie zet de stap klaar ⇒ gedaan.
  await action(page, 'showMe').click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-done', 'true');
  expect((await state(page)).tasks.some(t => t.name === 'Shown by the guide')).toBe(true);

  // Volgende: stap zonder controle, met een afbeelding uit de assets.
  await action(page, 'next').click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-step', 'kijken');
  await expect(panel(page).locator('[data-ops-guide-progress]')).toHaveText('Step 2 of 2');
  await expect(action(page, 'next')).toBeEnabled();
  await expect(action(page, 'next')).toHaveText('Finish');
  const img = panel(page).locator('img.help-image');
  await expect(img).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(1);

  // Terug en Sluiten.
  await action(page, 'back').click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-step', 'taak');
  await action(page, 'close').click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator('[data-ops-tour-spotlight]')).toHaveCount(0);

  // ── Uitschakelen ruimt alles op: paneel, artikel, lintknop ──
  await page.getByRole('button', { name: 'Start guide', exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await page.locator('.ribbon-tab--file').click();
  await page.getByRole('button', { name: /^(Extensions|Extensies)$/ }).click();
  const card = page.getByTestId('extension-ready-card').filter({ hasText: 'Testtutorials' });
  await card.locator('.ext-toggle').click();
  await expect.poll(() => page.evaluate(id => window.__OPS__!.store.getState().installedExtensions[id]?.status, EXT_ID))
    .toBe('disabled');
  await expect(panel(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.locator('[data-help-section="kind-tutorial"] [data-help-install-tutorials]')).toBeVisible();
  await expect(page.locator('[data-help-article="tut-test-eerste"]')).toHaveCount(0);
  await page.locator('[data-tour-anchor="ribbon-tab:start"]').click();
  await expect(page.getByRole('button', { name: 'Start guide', exact: true })).toHaveCount(0);
});

test('ui.showNotification: de melding van een extensie is zichtbaar, met naam en als platte tekst', async ({ page, ops: _ops }) => {
  await installTestExtension(page);
  await page.getByRole('button', { name: 'Say done', exact: true }).click();
  const toast = page.locator('.ops-toast .ops-toast-message');
  await expect(toast).toHaveText('Extension Testtutorials: <b>Done!</b>');
  await expect(toast.locator('b')).toHaveCount(0);
});

test('generieke lintankers: tab, groep, knop en component-item', async ({ page, ops: _ops }) => {
  await expect(page.locator('[data-tour-anchor="ribbon-tab:file"]')).toHaveCount(1);
  await expect(page.locator('[data-tour-anchor="ribbon-tab:start"]')).toHaveCount(1);
  await expect(page.locator('[data-tour-anchor="ribbon-group:start:tasks"]')).toBeVisible();
  await expect(page.locator('button[data-tour-anchor="ribbon:start:addTask"]')).toBeVisible();
  // Component-item (dropdown met eigen DOM): het anker staat op de elementen van het component.
  await expect(page.locator('[data-tour-anchor="ribbon:start:milestone"]').first()).toBeVisible();
  // Een gewone knop ná een component-item houdt zijn eigen anker (erft niet dat van het component).
  await expect(page.locator('button[data-tour-anchor="ribbon:start:splitTask"]')).toHaveCount(1);
  await expect(page.locator('[data-tour-anchor="ribbon:start:relation"]')).not.toHaveCount(0);
  await expect(page.locator('[data-tour-anchor="ribbon:start:relation"] [data-ops-ribbon-item="splitTask"], [data-tour-anchor="ribbon:start:relation"][data-ops-ribbon-item="splitTask"]')).toHaveCount(0);
  await page.locator('[data-tour-anchor="ribbon-tab:beeld"]').click();
  await expect(page.locator('button[data-tour-anchor="ribbon:beeld:toggleResourceAccent"]')).toHaveCount(1);
  await expect(page.locator('[data-tour-anchor="ribbon:beeld:screenColors"]').first()).toBeAttached();
  await page.locator('[data-tour-anchor="ribbon-tab:start"]').click();
  await page.locator('[data-tour-anchor="ribbon-tab:planning"]').click();
  await expect(page.locator('[data-tour-anchor="ribbon:start:addTask"]')).toHaveCount(0);
  await expect(page.locator('[data-tour-anchor="ribbon:planning:calendar"]')).toBeVisible();
  await expect(page.locator('[data-tour-anchor="status-bar"]')).toBeVisible();
});
