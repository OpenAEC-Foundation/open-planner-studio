// Stap 1.5 (keuze 1 en het vangnet van keuze 6, Ethan 2026-11-03; `docs/relaties-tussen-projecten.md`):
// de balk bij een nieuwe versie van een bron, met echte klikken. De rekenregels (wat telt als wijziging,
// de gevolgen, Later en Accepteren in de store) staan in `tests/planning/check-external-source-update.ts`;
// hier de bedrading: openen geeft de balk, Bekijken opent het venster, Later haalt alles weg, een nieuwe
// versie geeft bij terugkeer naar het venster weer een balk, Accepteren zet de ankers en Ctrl+Z zet ze terug.
// Review #811: Enter op een knop doet wat die knop doet. Enter op het kruisje sluit alleen het venster, Enter
// op *Later* haalt de balk weg; geen van beide accepteert. Enter op *Accepteren* accepteert.
// Review #811 ronde 2: F5 terwijl het venster open staat ⇒ het voorstel volgt de nieuwe berekening.
//
// De fixtures zijn gewone IFC-bestanden van OPS: *Aannemer* heeft twee externe voorgangers naar
// `/projecten/Installateur.ifc` met ankers uit een oudere versie (`sourceVersion` 1 november 2026);
// *Installateur* heeft de auteur Anna de Vries. De dev-link `source=` laat de browser die bron uit de repo
// lezen, met de `Last-Modified` van de dev-server als versie (`docs/dev-link.md`).
import { utimesSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures/ops';

const DIR = 'tests/browser/fixtures/ifc/externe-bron';
const SOURCE_FILE = fileURLToPath(new URL('./fixtures/ifc/externe-bron/Installateur.ifc', import.meta.url));
const STRIP = '[data-ops-external-source-update]';
const DIALOG = '[data-ops-external-source-review-dialog]';

test('nieuwe versie van een bron: balk, Bekijken, Enter op het kruisje en op Later, opnieuw bij een volgende versie, Accepteren en undo', async ({ page, ops: _ops }) => {
  test.setTimeout(120_000);
  // Het bronbestand krijgt een verse wijzigingstijd, ook als de checkout ouder is.
  const now = new Date();
  utimesSync(SOURCE_FILE, now, now);
  await page.goto(`/?open=${DIR}/Aannemer.ifc&source=${DIR}/Installateur.ifc`);
  await expect.poll(() => page.evaluate(() => window.__OPS__?.store.getState().cpmResult?.projectEnd ?? ''), { timeout: 30_000 }).not.toBe('');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }));
  const anchors = () => page.evaluate(() => window.__OPS__!.store.getState().tasks
    .flatMap(task => (task.externalLinks ?? []).map(link => `${task.name}: ${link.anchorDate}`)));
  const oldAnchors = ['Afbouw: 2027-03-19T16:00', 'Terreinafwerking: 2027-03-03T16:00'];

  // Openen ⇒ de balk, met de auteur en twee koppelingen; het plan verandert niet vanzelf.
  const strip = page.locator(STRIP);
  await expect(strip).toHaveCount(1, { timeout: 15_000 });
  await expect(strip).toContainText('Installateur.ifc');
  await expect(strip).toContainText('Anna de Vries');
  expect(await anchors()).toEqual(oldAnchors);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().isDirty)).toBe(false);

  // Bekijken ⇒ het venster met beide koppelingen en de gevolgen.
  await page.locator('[data-ops-external-source-review]').click();
  const dialog = page.locator(DIALOG);
  await expect(dialog.locator('[data-ops-external-source-review-links] tbody tr')).toHaveCount(2);
  await expect(dialog.locator('[data-ops-external-source-review-effects] div')).toHaveCount(2);

  const appliedSteps = () => page.evaluate(() => window.__OPS__!.store.getState().historyEvents.filter(e => e.state === 'applied').length);
  const stepsBeforeKeys = await appliedSteps();

  // Enter op het kruisje ⇒ alleen het venster dicht; de balk blijft, het plan ongewijzigd.
  await dialog.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(strip).toHaveCount(1);
  expect(await anchors()).toEqual(oldAnchors);
  expect(await appliedSteps()).toBe(stepsBeforeKeys);

  // Enter op Later in het venster ⇒ venster en balk weg, plan ongewijzigd, geen stap in de geschiedenis.
  await page.locator('[data-ops-external-source-review]').click();
  await expect(dialog.locator('[data-ops-external-source-review-links] tbody tr')).toHaveCount(2);
  await dialog.locator('[data-ops-external-source-review-later]').focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(strip).toHaveCount(0);
  expect(await anchors()).toEqual(oldAnchors);
  expect(await appliedSteps()).toBe(stepsBeforeKeys);

  // Terug naar het venster met dezelfde versie ⇒ geen balk.
  await page.waitForTimeout(2_100);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(1_000);
  await expect(strip).toHaveCount(0);

  // Een volgende versie van de bron ⇒ bij terugkeer naar het venster weer de balk.
  const later = new Date(now.getTime() + 60_000);
  utimesSync(SOURCE_FILE, later, later);
  // Een focus binnen 2 s na de vorige controle telt niet (focus en zichtbaarheid vallen vaak samen).
  await page.waitForTimeout(2_100);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(strip).toHaveCount(1, { timeout: 15_000 });

  // F5 terwijl het venster open staat ⇒ het voorstel volgt de nieuwe berekening. Opzet (fixture): de bladtaak die
  // het laatst eindigt, duurt twee keer zo lang, zonder herberekening; het venster vergelijkt dan eerst met de
  // oude berekening.
  await page.evaluate(() => {
    const S = window.__OPS__!.store.getState();
    const last = S.tasks.filter(t => t.childIds.length === 0)
      .reduce((a, b) => ((b.time.earlyFinish ?? '') > (a.time.earlyFinish ?? '') ? b : a));
    S.updateTask(last.id, { time: { ...last.time, scheduleDuration: last.time.scheduleDuration * 2 } });
  });
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(true);
  const effectsText = () => dialog.locator('[data-ops-external-source-review-effects]').innerText();
  await page.locator('[data-ops-external-source-review]').click();
  await expect(dialog.locator('[data-ops-external-source-review-links] tbody tr')).toHaveCount(2);
  const staleEffects = await effectsText();
  await page.keyboard.press('F5');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  await expect.poll(effectsText).not.toBe(staleEffects);
  const recalculatedEffects = await effectsText();
  // Hetzelfde als een venster dat na de berekening opengaat.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.locator('[data-ops-external-source-review]').click();
  await expect(dialog.locator('[data-ops-external-source-review-links] tbody tr')).toHaveCount(2);
  await expect.poll(effectsText).toBe(recalculatedEffects);

  // Enter op Accepteren ⇒ de nieuwe ankers, één undo-stap, balk en venster weg.
  const steps = await appliedSteps();
  await dialog.locator('[data-ops-external-source-review-accept]').focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(strip).toHaveCount(0);
  expect(await anchors()).toEqual(['Afbouw: 2027-03-23T16:00', 'Terreinafwerking: 2027-03-05T16:00']);
  expect(await appliedSteps()).toBe(steps + 1);

  // Ctrl+Z ⇒ de oude ankers terug.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(anchors).toEqual(oldAnchors);
});

// Stap 1.8 (voorstel 5, keuze 4 en keuze 6): *Bronbestand kiezen…* in de browser zonder host. Een eigen blok:
// de beginstand is een koppeling die in de browser gekozen is, zonder pad, met een onthouden handvat; het
// blok hierboven werkt met een bron mét pad. `showOpenFilePicker` is vervangen door een stub die een echt
// handvat uit het private bestandssysteem van de browser (OPFS) geeft, met de inhoud van de fixture; zo kan
// OPS het handvat echt in IndexedDB bewaren. De klikken blijven echte klikken. De terugval met `<input>`
// loopt via het `filechooser`-event van Playwright.
test('bronbestand kiezen in de browser: koppelen zonder pad, balk bij een nieuwe versie, vernieuwen met toestemming en opnieuw kiezen', async ({ page, ops: _ops }) => {
  test.setTimeout(120_000);
  await page.goto(`/?open=${DIR}/Aannemer.ifc`);
  await expect.poll(() => page.evaluate(() => window.__OPS__?.store.getState().cpmResult?.projectEnd ?? ''), { timeout: 30_000 }).not.toBe('');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }));

  // De bron in OPFS, en de kiezer die dat handvat geeft. `lastModified` is de versie.
  const sourceText = await (await page.request.get(`/${DIR}/Installateur.ifc`)).text();
  const lastModified = await page.evaluate(async (text) => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('Installateur.ifc', { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    // De headless shell meldt de kiezer via `featurePolicy` als geblokkeerd; zoals in `ifc-schema.spec.ts`.
    Object.defineProperty(document, 'featurePolicy', { configurable: true, value: undefined });
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, writable: true, value: async () => [handle] });
    return (await handle.getFile()).lastModified;
  }, sourceText);

  // De eigen taak zonder externe relatie: Ruwbouw (de eerste bladtaak zonder koppeling).
  const ownTaskId = await page.evaluate(() => {
    const S = window.__OPS__!.store.getState();
    const task = S.tasks.find(t => t.childIds.length === 0 && !(t.externalLinks?.length))!;
    S.selectTask(task.id);
    return task.id;
  });
  const linkOf = () => page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.externalLinks?.[0] ?? null, ownTaskId);

  // Koppelen: Link ▾ → Add external relation… → Source file → Choose source file… → Add link.
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Add external relation…' }).click();
  const linkDialog = page.getByTestId('external-link-dialog');
  await linkDialog.getByRole('button', { name: 'Source file', exact: true }).click();
  await linkDialog.locator('[data-ops-external-source-choose]').click();
  await expect(linkDialog.locator('[data-ops-external-source-chosen]')).toHaveText('Installateur.ifc');
  await linkDialog.getByTestId('external-link-add').click();
  await expect(linkDialog).toHaveCount(0);
  const created = (await linkOf())!;
  expect(created.sourceRef.filePath).toBeUndefined();
  expect(created.sourceRef.projectName).toBe('Installateur');
  expect(created.sourceVersion).toBe(new Date(lastModified).toISOString());
  expect(typeof created.anchorReadAt).toBe('string');
  const freshAnchor = created.anchorDate;
  // Het handvat staat in IndexedDB onder het project-id van de bron.
  await expect.poll(() => page.evaluate(() => new Promise<string[]>((resolve) => {
    const req = indexedDB.open('ops-external-sources', 1);
    req.onsuccess = () => {
      const all = req.result.transaction('handles', 'readonly').objectStore('handles').getAllKeys();
      all.onsuccess = () => resolve(all.result.map(String));
      all.onerror = () => resolve([]);
    };
    req.onerror = () => resolve([]);
  }))).toEqual([created.sourceRef.projectId]);

  // Opzet (fixture): het anker komt uit een oudere versie. Bij terugkeer naar het venster ⇒ de balk.
  const makeOld = () => page.evaluate((id) => {
    const S = window.__OPS__!.store.getState();
    const task = S.tasks.find(t => t.id === id)!;
    const link = task.externalLinks![0];
    S.updateTask(id, { externalLinks: [{ ...link, anchorDate: '2027-01-04T07:00', sourceVersion: '2026-01-01T00:00:00.000Z' }] });
  }, ownTaskId);
  const focusWindow = async () => {
    await page.waitForTimeout(2_100);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  };
  await makeOld();
  await focusWindow();
  const strip = page.locator(`[data-ops-external-source-update="project:${created.sourceRef.projectId}"]`);
  await expect(strip).toHaveCount(1, { timeout: 15_000 });
  await expect(strip).toContainText('Installateur.ifc');
  // De koppelingen met pad (uit de fixture) leest de browser niet: alleen deze balk.
  await expect(page.locator(STRIP)).toHaveCount(1);

  // Bekijken → Accepteren ⇒ het anker uit de bron, alleen voor de koppeling zonder pad.
  await strip.locator('[data-ops-external-source-review]').click();
  const dialog = page.locator(DIALOG);
  await expect(dialog.locator('[data-ops-external-source-review-links] tbody tr')).toHaveCount(1);
  await dialog.locator('[data-ops-external-source-review-accept]').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(STRIP)).toHaveCount(0);
  expect((await linkOf())!.anchorDate).toBe(freshAnchor);
  expect((await linkOf())!.sourceRef.filePath).toBeUndefined();

  // Toestemming `prompt`: het vangnet vraagt niets en toont geen balk.
  await page.evaluate(() => {
    const w = window as unknown as { __permissionRequests: number };
    w.__permissionRequests = 0;
    const proto = FileSystemHandle.prototype as unknown as {
      queryPermission: () => Promise<PermissionState>;
      requestPermission: () => Promise<PermissionState>;
    };
    proto.queryPermission = async () => 'prompt';
    proto.requestPermission = async () => { w.__permissionRequests++; return 'granted'; };
  });
  const permissionRequests = () => page.evaluate(() => (window as unknown as { __permissionRequests: number }).__permissionRequests);
  await makeOld();
  await focusWindow();
  await page.waitForTimeout(1_500);
  await expect(page.locator(STRIP)).toHaveCount(0);
  expect(await permissionRequests()).toBe(0);

  // Alle externe relaties vernieuwen: de klik vraagt toestemming en leest de bron. De bron met pad leest de
  // browser niet; de uitslag zegt dat.
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Refresh all external relations' }).click();
  const status = page.locator('.ribbon-relation-menu-status');
  await expect(status).toContainText('1 source not read.');
  expect(await permissionRequests()).toBe(1);
  expect((await linkOf())!.anchorDate).toBe(freshAnchor);
  // Een bron met handvat kiest de planner niet opnieuw.
  await expect(page.locator('[data-ops-external-sources-choose]')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Een andere browser (geen kiezer, geen handvat): de bron is niet gelezen, de planner kiest het bestand opnieuw.
  await page.evaluate(async () => {
    delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
    await new Promise<void>((resolve) => {
      const req = indexedDB.open('ops-external-sources', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction('handles', 'readwrite');
        tx.objectStore('handles').clear();
        tx.oncomplete = () => resolve();
      };
    });
  });
  await makeOld();
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Refresh all external relations' }).click();
  await expect(status).toContainText('2 sources not read.');
  expect((await linkOf())!.anchorDate).toBe('2027-01-04T07:00');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-ops-external-sources-choose]').click();
  const chooser = await chooserPromise;
  expect(chooser.isMultiple()).toBe(true);
  await chooser.setFiles(SOURCE_FILE);
  await expect(status).toContainText('1 anchor(s) refreshed');
  expect((await linkOf())!.anchorDate).toBe(freshAnchor);
  await expect(page.locator('[data-ops-external-sources-choose]')).toHaveCount(0);
});
