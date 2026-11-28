import { expect, test, seedProject, state } from './fixtures/ops';
import type { Locator, Page } from '@playwright/test';

const EXT_ID = 'test-tutorials';

const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_2X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAADklEQVR4nGP4z8AAQv8BD/kD/YURmXYAAAAASUVORK5CYII=';

const ARTICLE_IMAGES_JS = `
module.exports = {
  onLoad(api) {
    api.help.registerArticles([{
      id: 'tut-test-beelden', kind: 'tutorial', order: 1,
      title: { nl: 'Beelden', en: 'Pictures' },
      body: {
        nl: '# Beelden\\n\\n![Stapbeeld](img/{lang}/stap.png)\\n\\n![Extern beeld](https://example.com/extern.png)',
        en: '# Pictures\\n\\n![Step picture](img/{lang}/stap.png)\\n\\n![External picture](https://example.com/extern.png)',
      },
    }]);
  },
};
`;

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
      tab: 'start', group: 'Tutorials', label: 'Read selection',
      onClick: () => api.ui.showNotification('Selection: ' + JSON.stringify(api.data.getSelectedTaskIds())),
    });
    api.ui.addRibbonButton({
      tab: 'start', group: 'Tutorials', label: 'Say done',
      onClick: () => api.ui.showNotification('<b>Done!</b>'),
    });
  },
};
`;

async function installTestExtension(
  page: Page,
  mainCode = MAIN_JS,
  images: Record<string, string> = { 'img/en/stap.png': PNG_1X1, 'img/nl/stap.png': PNG_1X1 },
): Promise<void> {
  await page.evaluate(async ({ id, code, pngs }) => {
    const res = await fetch('/examples/showcase-verbouwing-eengezinswoning.ifc');
    const ifc = new Uint8Array(await res.arrayBuffer());
    const assets: Record<string, Uint8Array> = { 'start.ifc': ifc };
    for (const [name, b64] of Object.entries(pngs)) assets[name] = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
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
    }, code, assets);
  }, { id: EXT_ID, code: mainCode, pngs: images });
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

test('help-API: tutorial in Help, meegeleverd project openen, begeleiding met controle, opruimen bij uitschakelen', async ({ page, ops: _ops }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1600, height: 950 });
  await installTestExtension(page);

  await page.locator('[data-tour-anchor="ribbon:start:addTask"]').click();
  await expect.poll(async () => (await state(page)).tasks.length).toBe(1);
  const ownWork = await state(page);
  await page.getByRole('button', { name: 'Read selection', exact: true }).click();
  const selectionToast = page.locator('.ops-toast-message').filter({ hasText: 'Selection:' });
  await expect(selectionToast).toContainText('Selection: ' + JSON.stringify(ownWork.selectedTaskIds));
  expect(ownWork.selectedTaskIds).toHaveLength(1);
  await page.locator('.ops-toast').filter({ hasText: 'Selection:' }).locator('[data-ops-toast-close]').click();

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
  await expect(page.locator('.help-panel')).toHaveCount(0);
  await expect(page.locator('[data-tour-anchor="ribbon-tab:start"]')).toHaveClass(/active/);

  await page.getByRole('button', { name: 'Read selection', exact: true }).click();
  await expect(selectionToast).toContainText('Selection: ' + JSON.stringify(opened.selectedTaskIds));
  expect(opened.selectedTaskIds).toEqual([]);
  await page.locator('.ops-toast').filter({ hasText: 'Selection:' }).locator('[data-ops-toast-close]').click();

  await page.getByRole('button', { name: 'Start guide', exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-step', 'taak');
  await expect(panel(page).locator('[data-ops-guide-progress]')).toHaveText('Step 1 of 2');
  await expect(panel(page).locator('[data-ops-guide-task]')).toContainText('Click Task on the ribbon.');
  await expect(panel(page).locator('[data-ops-guide-waiting]')).toBeVisible();
  await expect(panel(page).locator('[data-ops-guide-explanation]')).toHaveCount(0);
  await expect(action(page, 'next')).toBeDisabled();
  await expect(action(page, 'back')).toBeDisabled();

  const addTask = page.locator('[data-tour-anchor="ribbon:start:addTask"]');
  await expect(addTask).toBeVisible();
  await expect(page.locator('[data-ops-tour-spotlight]')).toHaveCount(0);

  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) window.__OPS__!.store.getState().notify({
      severity: 'error', messageKey: 'notifications.openFailed', dedupeKey: `guide-overlap-${i}`,
      detail: 'Langere testmelding om de begeleidingsknoppen onderaan zichtbaar te bewaken.',
    });
  });
  const expectGuideUncovered = async () => {
    await expect.poll(() => panel(page).evaluate(el => {
      const panelBox = el.getBoundingClientRect();
      const panelZ = Number(getComputedStyle(el).zIndex);
      return [...document.querySelectorAll<HTMLElement>('.ops-toast')].every(toast => {
        const box = toast.getBoundingClientRect();
        const z = Number(getComputedStyle(toast.closest('.ops-toast-stack')!).zIndex);
        return z < panelZ || box.right <= panelBox.left || box.left >= panelBox.right
          || box.bottom <= panelBox.top || box.top >= panelBox.bottom;
      });
    })).toBe(true);
  };
  await expect(page.locator('.ops-toast')).toHaveCount(3);
  await expectGuideUncovered();
  await page.getByRole('button', { name: 'Planning', exact: true }).first().click();
  await page.getByRole('button', { name: 'Manage baselines…', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectGuideUncovered();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('[data-tour-anchor="ribbon-tab:start"]').click();

  const head = panel(page).locator('[data-ops-guide-drag]');
  const panelBefore = await panel(page).boundingBox();
  const grip = await head.boundingBox();
  if (!panelBefore || !grip) throw new Error('paneel niet gemeten');
  await page.mouse.move(grip.x + 20, grip.y + 10);
  await page.mouse.down();
  await page.mouse.move(grip.x - 280, grip.y - 190, { steps: 8 });
  await page.mouse.up();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-side', 'free');
  const moved = await panel(page).boundingBox();
  if (!moved) throw new Error('paneel niet gemeten');
  expect(Math.abs(moved.x - (panelBefore.x - 300))).toBeLessThan(2);
  expect(Math.abs(moved.y - (panelBefore.y - 200))).toBeLessThan(2);
  await expectGuideUncovered();

  const tasksBefore = (await state(page)).tasks.length;
  await addTask.click();
  await expect.poll(async () => (await state(page)).tasks.length).toBe(tasksBefore + 1);
  await expect(panel(page)).toHaveAttribute('data-ops-guide-done', 'true');
  await expect(panel(page).locator('[data-ops-guide-done-badge]')).toBeVisible();
  await expect(panel(page).locator('[data-ops-guide-explanation]')).toContainText('The new task is at the bottom.');
  await expect(action(page, 'next')).toBeEnabled();
  await expect(action(page, 'next')).toHaveText('Next');
  await expect(page.locator('[data-ops-tour-spotlight]')).toHaveCount(0);

  const docsBeforeReset = (await state(page)).documentIds.length;
  await action(page, 'reset').click();
  await expect.poll(async () => (await state(page)).documentIds.length).toBe(docsBeforeReset + 1);
  await expect(panel(page)).toHaveAttribute('data-ops-guide-done', 'false');
  await expect(action(page, 'next')).toBeDisabled();

  await action(page, 'showMe').click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-done', 'true');
  expect((await state(page)).tasks.some(t => t.name === 'Shown by the guide')).toBe(true);

  await action(page, 'next').click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-step', 'kijken');
  await expect(panel(page).locator('[data-ops-guide-progress]')).toHaveText('Step 2 of 2');
  await expect(action(page, 'next')).toBeEnabled();
  await expect(action(page, 'next')).toHaveText('Finish');
  const img = panel(page).locator('img.help-image');
  await expect(img).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(1);

  await action(page, 'back').click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-step', 'taak');
  await action(page, 'close').click();
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator('[data-ops-tour-spotlight]')).toHaveCount(0);

  await expect(page.locator('.ops-toast-stack')).toHaveAttribute('data-ops-toast-placement', 'default');

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

test('help-API: een tutorialartikel toont afbeeldingen alleen uit de eigen assets, in de docstaal', async ({ page, ops: _ops }) => {
  const external: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname === 'example.com') external.push(url.href);
  });
  await installTestExtension(page, ARTICLE_IMAGES_JS, { 'img/en/stap.png': PNG_1X1, 'img/nl/stap.png': PNG_2X1 });

  await openHelp(page);
  await page.locator('[data-help-section="kind-tutorial"]').getByRole('button', { name: /Pictures/ }).click();
  const body = page.locator('.help-article-body');

  const own = body.locator('img.help-image[alt="Step picture"]');
  await expect(own).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => own.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(1);
  await expect(body.locator('.help-image-placeholder', { hasText: 'External picture' })).toBeVisible();
  await expect(body.locator('img')).toHaveCount(1);
  expect(await body.locator('img').evaluateAll(els => els.map(el => new URL((el as HTMLImageElement).src).protocol))).toEqual(['blob:']);

  await page.locator('#help-docslang').selectOption('nl');
  const ownNl = body.locator('img.help-image[alt="Stapbeeld"]');
  await expect(ownNl).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => ownNl.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(2);
  await expect(body.locator('.help-image-placeholder', { hasText: 'Extern beeld' })).toBeVisible();
  expect(external).toEqual([]);
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
  await expect(page.locator('[data-tour-anchor="ribbon:start:milestone"]').first()).toBeVisible();
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

test('lintanker van een component-item blijft staan na een bezoek aan Bestand', async ({ page, ops: _ops }) => {
  await seedProject(page, [{ name: 'Metselwerk', start: '2026-03-02', finish: '2026-03-13' }]);
  const assign = page.locator('[data-tour-anchor="ribbon:resources:resourceAssign"]');
  await page.locator('[data-tour-anchor="ribbon-tab:resources"]').click();
  await expect(assign.first()).toBeVisible();
  await page.locator('[data-tour-anchor="ribbon-tab:file"]').click();
  await expect(assign).toHaveCount(0);
  await page.locator('[data-tour-anchor="ribbon-tab:resources"]').click();
  await page.locator('[data-grid-column-id="task.name"]', { hasText: 'Metselwerk' }).first().click();
  await expect.poll(() => state(page).then(s => s.selectedTaskIds.length)).toBe(1);
  await expect(assign.first()).toBeVisible();
  await expect(assign.locator('button:not([disabled])').or(assign.and(page.locator('button:not([disabled])'))).first()).toBeVisible();
});

async function overlapping(a: Locator, b: Locator): Promise<boolean> {
  const p = await a.boundingBox();
  const q = await b.boundingBox();
  if (!p || !q) return false;
  return p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
}

test('begeleidingspaneel: klapt in voor een venster dat het anders bedekt, en zelf in en uit', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installTestExtension(page);
  await page.getByRole('button', { name: 'Start guide', exact: true }).click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-compact', 'false');
  await expect(panel(page)).toHaveAttribute('data-ops-guide-side', 'end');

  await action(page, 'collapse').click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-compact', 'true');
  await expect(panel(page).locator('[data-ops-guide-task]')).toHaveCount(0);
  await expect(panel(page).locator('[data-ops-guide-progress]')).toHaveText('Step 1 of 2');
  await action(page, 'expand').click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-compact', 'false');
  await expect(panel(page).locator('[data-ops-guide-task]')).toContainText('Click Task on the ribbon.');

  await page.locator('[data-tour-anchor="ribbon-tab:planning"]').click();
  await page.locator('[data-tour-anchor="ribbon:planning:calendar"]').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-compact', 'true');
  expect(await overlapping(panel(page), dialog), 'het knopje ligt naast het venster').toBe(false);
  await action(page, 'expand').click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-compact', 'false');
  await action(page, 'collapse').click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-compact', 'true');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(panel(page)).toHaveAttribute('data-ops-guide-compact', 'false');
  await expect(panel(page)).toHaveAttribute('data-ops-guide-side', 'end');
});

test('begeleidingspaneel: wijkt uit voor het anker en keert daarna terug', async ({ page, ops: _ops }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installTestExtension(page, MAIN_JS.replace("anchor: 'ribbon:start:addTask'", "anchor: 'properties-panel'"));
  const rail = page.locator('[data-tour-anchor="properties-panel"]');
  await expect(rail).toBeVisible();
  await page.getByRole('button', { name: 'Start guide', exact: true }).click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-side', 'start');
  expect(await overlapping(panel(page), rail), 'het paneel ligt niet over het anker').toBe(false);
  await expect(page.locator('[data-ops-tour-spotlight]')).toHaveCount(0);
  await action(page, 'showMe').click();
  await expect(panel(page)).toHaveAttribute('data-ops-guide-done', 'true');
  await expect(panel(page)).toHaveAttribute('data-ops-guide-side', 'end');
});
