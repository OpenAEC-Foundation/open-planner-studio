// Issue #27 etappe 2, T10: de voortgangsimportdialoog als echte gebruikershandeling — kiezen,
// (indien nodig) de datumvolgorde-vraag (E5), de verplichte preview met handmatige koppelkiezer
// (T7/E3), bevestigen + undo, de drie instappunten (T8/E2) en de documentwissel-blokkade (T6/E4).
//
// BESTANDSKIEZER-ROUTE (plan, "het bestandskiezer-probleem"): de primaire route is
// `page.addInitScript`/`page.evaluate` die `window.showOpenFilePicker` weghaalt, gecombineerd met
// `page.waitForEvent('filechooser')`-interceptie op de echte `<input type="file">` die
// `openViaInput` (src/services/fileAccess/webBackend.ts) aanmaakt. Die route is HIER GEKOZEN en
// werkt aantoonbaar: `tests/browser/hook-synchronization.spec.ts` gebruikt exact hetzelfde
// `filechooser`-patroon voor `PoolImportDialog` in dezelfde headless-omgeving, zónder ook maar de
// `showOpenFilePicker`-verwijdering nodig te hebben — deze Playwright/Chromium-headless-shell heeft
// de File System Access-API sowieso niet, dus `openFileDialogWeb` valt al vanzelf op `openViaInput`
// terug. De `delete window.showOpenFilePicker` hieronder is dus verdedigend or nihil (documenteert
// de aanname expliciet in plaats van er stilzwijgend op te leunen) en NIET de gedocumenteerde
// terugvalroute uit het plan — die (een `window.__OPS__`-fixture die het sheet rechtstreeks in de
// dialoogstate zet) was niet nodig, want `input.click()` op een niet-aan-de-DOM-gehangen element
// vuurt gewoon een `filechooser`-event: Playwright onderschept dat op window-niveau, niet via een
// DOM-observer op het input-element zelf.
import type { Page } from '@playwright/test';
import { expect, seedProject, state, test } from './fixtures/ops';

const DIALOG = '[data-ops-progress-import-dialog]';

const CHOOSE_FILE = /^(Choose file…|Bestand kiezen…)$/;
const CANCEL = /^(Cancel|Annuleren)$/;
const APPLY = /^(Apply|Toepassen)$/;
const CLOSE = /^(Close|Sluiten)$/;
const CLEAR_LINK = /^(Clear link|Koppeling wissen)$/;
const NEEDS_LINK_HEADING = /^(Waiting for a link|Wacht op koppeling)$/;
const PICKER_PLACEHOLDER = /^(Choose a task…|Kies een taak…)$/;
const PROGRESS_IMPORT_BUTTON = /^(Update progress from a spreadsheet|Voortgang bijwerken uit een blad)$/;

function dialog(page: Page) {
  return page.locator(DIALOG);
}

/** Rijcontainer in de preview/dateOrder-lijsten: elke rij (wacht-op-koppeling, betwijfeld, gewoon)
 *  deelt dezelfde `rounded-[10px]`-kaartklasse in `ProgressImportDialog.tsx`; de tellersbalk gebruikt
 *  diezelfde klasse ook, dus filteren op de `#<rijnummer> —`-tekst (ANKERED aan het begin, zodat rij 2
 *  niet ook rij 20 vangt) is nodig om de kaart uniek te maken. */
function rowByNumber(page: Page, rowNumber: number) {
  return page.locator('div[class*="rounded-[10px]"]').filter({ hasText: new RegExp(`^#${rowNumber} —`) });
}

async function openViaBackstage(page: Page): Promise<void> {
  // Instappunt 1 (E2/A10): Backstage → Importeren-kaart. Tabwissel via de store (zoals ook
  // ribbon-time-scale.spec.ts doet) — de geteste handeling is de ECHTE muisklik op de kaart zelf.
  await page.evaluate(() => {
    window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'file', backstageSection: 'import' });
  });
  await page.locator('[data-ops-progress-import-card]').click();
  await expect(dialog(page)).toBeVisible();
}

async function chooseCsv(page: Page, csv: string, name = 'voortgang.csv'): Promise<void> {
  await page.evaluate(() => {
    delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
  });
  const chooserPromise = page.waitForEvent('filechooser');
  await dialog(page).getByRole('button', { name: CHOOSE_FILE }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
}

async function taskTime(page: Page, taskId: string) {
  return page.evaluate((id) => {
    const t = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
    return {
      completion: t.time.completion,
      actualStart: t.time.actualStart,
      actualFinish: t.time.actualFinish,
    };
  }, taskId);
}

async function taskInfo(page: Page, taskId: string) {
  return page.evaluate((id) => {
    const t = window.__OPS__!.store.getState().tasks.find(task => task.id === id)!;
    return { id: t.id, wbsCode: t.wbsCode, name: t.name };
  }, taskId);
}

test('preview toont wijzigingen en weigeringen, annuleren laat het document ongemoeid', async ({ page, ops: _ops }) => {
  const [idA] = await seedProject(page, [
    { name: 'Cancel-taak A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);

  await openViaBackstage(page);
  await chooseCsv(page, [
    'OPS Task ID;Completion (%)',
    `${idA};40`,
    'niet-bestaand-id;40',
    '',
  ].join('\r\n'));

  // Eén rij verandert (id-match), één rij is geweigerd (unmatched) — beide zichtbaar vóór bevestiging.
  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeEnabled();
  await expect(page.getByText(NEEDS_LINK_HEADING)).toBeVisible();

  await dialog(page).getByRole('button', { name: CANCEL }).click();
  await expect(dialog(page)).toBeHidden();

  const after = await taskTime(page, idA);
  expect(after.completion).toBe(0);
});

test('bevestigen past het blad toe en één Ctrl+Z draait het hele blad terug', async ({ page, ops: _ops }) => {
  const [idA, idB] = await seedProject(page, [
    { name: 'Apply-taak A', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
    { name: 'Apply-taak B', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);

  await openViaBackstage(page);
  await chooseCsv(page, [
    'OPS Task ID;Completion (%)',
    `${idA};40`,
    `${idB};70`,
    '',
  ].join('\r\n'));

  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeEnabled();
  await dialog(page).getByRole('button', { name: APPLY }).click();
  await expect(dialog(page).getByRole('button', { name: CLOSE })).toBeVisible();

  const afterA = await taskTime(page, idA);
  const afterB = await taskTime(page, idB);
  expect(afterA.completion).toBe(0.4);
  expect(afterB.completion).toBe(0.7);

  await dialog(page).getByRole('button', { name: CLOSE }).click();
  await expect(dialog(page)).toBeHidden();

  // Eén Ctrl+Z herstelt het HELE blad (twee taken), niet slechts één rij.
  await page.keyboard.press('Control+z');
  await expect.poll(() => taskTime(page, idA).then(t => t.completion)).toBe(0);
  const undoneB = await taskTime(page, idB);
  expect(undoneB.completion).toBe(0);
});

test('een losse rij handmatig koppelen laat hem meedraaien', async ({ page, ops: _ops }) => {
  const [idA] = await seedProject(page, [
    { name: 'Koppel-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const info = await taskInfo(page, idA);

  await openViaBackstage(page);
  await chooseCsv(page, [
    'OPS Task ID;Completion (%)',
    'onbekend-id;55',
    '',
  ].join('\r\n'));

  await expect(page.getByText(NEEDS_LINK_HEADING)).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeDisabled();

  await rowByNumber(page, 2).getByRole('button', { name: PICKER_PLACEHOLDER }).click();
  await page.getByRole('option', { name: new RegExp(info.name) }).click();

  // De handmatig gekoppelde rij draait nu gewoon mee: de bevestigknop komt vrij en de wijziging
  // wordt daadwerkelijk toegepast op de gekozen taak.
  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeEnabled();
  await dialog(page).getByRole('button', { name: APPLY }).click();
  await expect(dialog(page).getByRole('button', { name: CLOSE })).toBeVisible();

  const after = await taskTime(page, idA);
  expect(after.completion).toBe(0.55);
});

test('een al gekoppelde taak is niet nog eens kiesbaar', async ({ page, ops: _ops }) => {
  const [idA] = await seedProject(page, [
    { name: 'Enige-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const info = await taskInfo(page, idA);

  await openViaBackstage(page);
  await chooseCsv(page, [
    'OPS Task ID;Completion (%)',
    'onbekend-1;40',
    'onbekend-2;60',
    '',
  ].join('\r\n'));

  await rowByNumber(page, 2).getByRole('button', { name: PICKER_PLACEHOLDER }).click();
  await page.getByRole('option', { name: new RegExp(info.name) }).click();

  await rowByNumber(page, 3).getByRole('button', { name: PICKER_PLACEHOLDER }).click();
  const takenOption = page.getByRole('option', { name: new RegExp(info.name) });
  await expect(takenOption).toBeVisible();
  await expect(takenOption).toHaveAttribute('aria-disabled', 'true');
});

test('een bestand met alleen dubbelzinnige datums vraagt de volgorde', async ({ page, ops: _ops }) => {
  const [idA] = await seedProject(page, [
    { name: 'Datumtaak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const info = await taskInfo(page, idA);

  await openViaBackstage(page);
  // Geen "OPS Task ID"-kolom (WBS-koppeling i.p.v. id) — zonder id-match levert de ijkpuntregel
  // (A5.2, kalibratie) sowieso nul kandidaten, dus dit bestand kan NOOIT anders dan `ambiguous`
  // uitkomen zolang er minstens één niet-ISO datum met beide componenten ≤ 12 in staat.
  await chooseCsv(page, [
    'WBS;Actual Start',
    `${info.wbsCode};3-4-2026`,
    '',
  ].join('\r\n'));

  await expect(page.getByText('3-4-2026')).toBeVisible();
  const optionButtons = dialog(page).locator('button[class*="self-start"]');
  await expect(optionButtons).toHaveCount(2);
});

test('de keuze werkt door in de preview', async ({ page, ops: _ops }) => {
  const [idA] = await seedProject(page, [
    { name: 'Datumtaak2', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  const info = await taskInfo(page, idA);

  await openViaBackstage(page);
  await chooseCsv(page, [
    'WBS;Actual Start',
    `${info.wbsCode};3-4-2026`,
    '',
  ].join('\r\n'));

  const optionButtons = dialog(page).locator('button[class*="self-start"]');
  await expect(optionButtons).toHaveCount(2);
  // Knop A = dmy (dag-eerst: 3 april 2026), knop B = mdy (maand-eerst: 3 = maart, 4 = dag → 4 maart
  // 2026) — render-volgorde in ProgressImportDialog.tsx. Kies B, zodat de test bewijst dat de KEUZE
  // het verschil maakt, niet toevallig de standaardlezing.
  await optionButtons.nth(1).click();

  await expect(dialog(page).getByRole('button', { name: APPLY })).toBeEnabled();
  await dialog(page).getByRole('button', { name: APPLY }).click();
  await expect(dialog(page).getByRole('button', { name: CLOSE })).toBeVisible();

  const after = await taskTime(page, idA);
  expect(after.actualStart).toBe('2026-03-04');
});

test('de Tabel-tabknop opent dezelfde dialoog', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Tabel-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'table' }));
  await page.getByRole('button', { name: PROGRESS_IMPORT_BUTTON }).click();
  await expect(dialog(page)).toBeVisible();
});

test('de knop staat niet op de Start-tab', async ({ page, ops: _ops }) => {
  await seedProject(page, [
    { name: 'Start-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ]);
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ activeRibbonTab: 'start' }));
  await expect(page.getByRole('button', { name: PROGRESS_IMPORT_BUTTON })).toHaveCount(0);
});

test('wisselen is onmogelijk zolang de dialoog openstaat', async ({ page, ops: _ops }) => {
  const [taskA] = await seedProject(page, [
    { name: 'Doc1-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Document 1');
  const doc1Id = (await state(page)).activeDocumentId;
  const info = await taskInfo(page, taskA);

  // Beide documenten bestaan al VOORDAT de dialoog opengaat — `newDocument()`/`switchDocument()`
  // hier zijn testopzet, geen geteste handeling; anders zou `resetDocumentScopedUI` de dialoog
  // sluiten vóórdat er iets te blokkeren valt.
  const doc2Id = await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  await seedProject(page, [
    { name: 'Doc2-taak', start: '2026-09-07', finish: '2026-09-18', durationDays: 10 },
  ], 'Document 2');

  await page.evaluate((id) => window.__OPS__!.store.getState().switchDocument(id), doc1Id);
  await expect.poll(() => state(page).then(s => s.activeDocumentId)).toBe(doc1Id);

  await openViaBackstage(page);
  await chooseCsv(page, [
    'OPS Task ID;Completion (%)',
    'onbekend-doc1;40',
    '',
  ].join('\r\n'));

  await expect(page.getByText(NEEDS_LINK_HEADING)).toBeVisible();
  await rowByNumber(page, 2).getByRole('button', { name: PICKER_PLACEHOLDER }).click();
  await page.getByRole('option', { name: new RegExp(info.name) }).click();
  await expect(rowByNumber(page, 2).getByRole('button', { name: CLEAR_LINK })).toBeVisible();

  // Route 1 (E4): een echte muisklik op het tabblad van document 2. De gedeelde `Dialog` rendert
  // `fixed inset-0 … z-50` over de volle viewport, dus het tabblad ligt daaronder — Playwright's
  // eigen actionability-check ("receives pointer events") wijst dit doel af vóórdat er ooit een
  // klik gedispatcht wordt. We bewijzen de blokkade door te assert'en dat de klikpoging faalt, in
  // plaats van een `force`-klik te gebruiken die die check zou omzeilen.
  const docTab2 = page.locator(`[data-testid="document-tab"][data-ops-tab="${doc2Id}"]`);
  await expect(docTab2.click({ timeout: 2000 })).rejects.toThrow();

  // Route 2 (E4): Control+2 — de `when: () => !hasBlockingDialogOpen()`-guard op
  // `documentSwitchShortcuts` (shortcutRegistry.ts) moet dit weigeren.
  await page.keyboard.press('Control+2');

  await expect.poll(() => state(page).then(s => s.activeDocumentId)).toBe(doc1Id);
  await expect(dialog(page)).toBeVisible();
  await expect(rowByNumber(page, 2).getByRole('button', { name: CLEAR_LINK })).toBeVisible();
});
