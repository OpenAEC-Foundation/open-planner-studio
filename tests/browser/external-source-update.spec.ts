// Stap 1.5 (keuze 1 en het vangnet van keuze 6, Ethan 2026-11-03; `docs/relaties-tussen-projecten.md`):
// de balk bij een nieuwe versie van een bron, met echte klikken. De rekenregels (wat telt als wijziging,
// de gevolgen, Later en Accepteren in de store) staan in `tests/planning/check-external-source-update.ts`;
// hier de bedrading: openen geeft de balk, Bekijken opent het venster, Later haalt alles weg, een nieuwe
// versie geeft bij terugkeer naar het venster weer een balk, Accepteren zet de ankers en Ctrl+Z zet ze terug.
// Review #811: Enter op een knop doet wat die knop doet. Enter op het kruisje sluit alleen het venster, Enter
// op *Later* haalt de balk weg; geen van beide accepteert. Enter op *Accepteren* accepteert.
// Review #811 ronde 2: F5 terwijl het venster open staat ⇒ het voorstel volgt de nieuwe berekening.
//
// Stap 1.11 (keuze 7 en keuze 3 zonder cloud): de andere kant. In het bronproject *Installateur* zoekt de
// planner de afhankelijke projecten met een echte klik in het menu *Relatie*; het resultaat staat bij de
// taak, en Ctrl+S vraagt eerst als ankers te krap worden. De mapkiezer zelf (`showDirectoryPicker`) is een
// stub met *Aannemer.ifc* uit de fixtures; de regels staan in `tests/planning/check-dependent-projects.ts`.
//
// De fixtures zijn gewone IFC-bestanden van OPS: *Aannemer* heeft twee externe voorgangers naar
// `/projecten/Installateur.ifc` met ankers uit een oudere versie (`sourceVersion` 1 november 2026);
// *Installateur* heeft de auteur Anna de Vries. De dev-link `source=` laat de browser die bron uit de repo
// lezen, met de `Last-Modified` van de dev-server als versie (`docs/dev-link.md`).
import { readFileSync, utimesSync } from 'node:fs';
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

// Stap 1.9 (§6.1–6.3 in `docs/relaties-tussen-projecten.md`): een bron in dezelfde map op de site. Een eigen blok:
// de beginstand is de app op de nep-site (`?fakeSite=1`), met het eigen project als startbestand. De nep-site
// krijgt vooraf twee projecten: *Aannemer* (het eigen project) en *Installateur* (de bron). Een nieuwe versie van
// de bron slaat de test op via de host, zoals een andere planner dat op de site doet. De klikken blijven echte
// klikken.
test('bron op de site: koppelen aan een project op de site, balk bij een nieuwe versie, vernieuwen en een bron die weg is', async ({ page, ops }) => {
  test.setTimeout(120_000);
  // Aan het eind is de bron weg van de site: de app logt dat lezen mislukte en telt de bron als niet gelezen.
  ops.acceptError(/parseExternalSiteSource: kon de bron op de site niet lezen: site-installateur/);
  const own = await (await page.request.get(`/${DIR}/Aannemer.ifc`)).text();
  const source = await (await page.request.get(`/${DIR}/Installateur.ifc`)).text();
  // De nep-site vullen vóór hij start (zonder `fakeSite` opent de app die database niet).
  await page.goto('/');
  await page.evaluate(async ({ own, source }) => {
    const now = Date.now();
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('ops-fake-site', 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('files')) req.result.createObjectStore('files', { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      const files = tx.objectStore('files');
      files.clear();
      files.put({ id: 'site-aannemer', name: 'Aannemer.ifc', versions: [{ version: '1', modified: new Date(now).toISOString(), author: 'Nep-site', data: own }] });
      files.put({ id: 'site-installateur', name: 'Installateur.ifc', versions: [{ version: '1', modified: new Date(now - 86_400_000).toISOString(), author: 'Nep-site', data: source }] });
      // Een tweede bron in dezelfde map (review #859 ronde 1: een snelle wissel van bron).
      files.put({ id: 'site-tweede', name: 'Tweede.ifc', versions: [{ version: '1', modified: new Date(now - 2 * 86_400_000).toISOString(), author: 'Nep-site', data: source }] });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { own, source });
  // Het nieuwste bestand (Aannemer) is het startbestand.
  await page.goto('/?fakeSite=1&fakeSiteInitial=1');
  await expect.poll(() => page.evaluate(() => window.__OPS__?.store.getState().siteFileId ?? null), { timeout: 30_000 }).toBe('site-aannemer');
  await expect.poll(() => page.evaluate(() => window.__OPS__?.store.getState().cpmResult?.projectEnd ?? ''), { timeout: 30_000 }).not.toBe('');

  const ownTaskId = await page.evaluate(() => {
    const S = window.__OPS__!.store.getState();
    const task = S.tasks.find(t => t.childIds.length === 0 && !(t.externalLinks?.length))!;
    S.selectTask(task.id);
    return task.id;
  });
  const linkOf = () => page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.externalLinks?.[0] ?? null, ownTaskId);

  // Koppelen: Link ▾ → Add external relation… → Project on the site → Installateur.ifc → Add link.
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Add external relation…' }).click();
  const linkDialog = page.getByTestId('external-link-dialog');
  await linkDialog.getByRole('button', { name: 'Project on the site', exact: true }).click();
  const picker = linkDialog.locator('[data-ops-external-site-source]');
  await expect(picker).toBeEnabled();
  // Het eigen project staat niet in de lijst; *Bronbestand kiezen…* is er met een site niet.
  await expect(picker.locator('option')).toHaveText(['—', 'Installateur.ifc', 'Tweede.ifc']);
  await expect(linkDialog.locator('[data-ops-external-source-choose]')).toHaveCount(0);
  const addButton = linkDialog.getByTestId('external-link-add');
  await picker.selectOption({ label: 'Installateur.ifc' });
  await expect(addButton).toBeEnabled();
  // Review #859 ronde 1: de planner kiest snel een andere bron en die lezing duurt. Zolang de nieuwe bron niet
  // gelezen is, kan hij niets toevoegen: anders zou de koppeling de vorige bron, taak en het vorige anker krijgen.
  // De nep-site houdt `open` voor Tweede.ifc vast tot de test hem loslaat.
  await page.evaluate(() => {
    const storage = (window.openaecHost as { storage: { open: (id: string, version?: string) => Promise<unknown> } }).storage;
    const open = storage.open.bind(storage);
    const w = window as unknown as { __releaseSiteOpen?: () => void };
    const gate = new Promise<void>((resolve) => { w.__releaseSiteOpen = resolve; });
    storage.open = async (id, version) => {
      if (id === 'site-tweede') await gate;
      return open(id, version);
    };
  });
  await picker.selectOption({ label: 'Tweede.ifc' });
  await expect(addButton).toBeDisabled();
  await page.keyboard.press('Enter');
  await expect(linkDialog).toHaveCount(1);
  expect(await linkOf()).toBeNull();
  await page.evaluate(() => (window as unknown as { __releaseSiteOpen: () => void }).__releaseSiteOpen());
  await expect(addButton).toBeEnabled();
  // Terug naar Installateur.ifc; de rest van de route werkt met die bron.
  await picker.selectOption({ label: 'Installateur.ifc' });
  await expect(addButton).toBeEnabled();
  await addButton.click();
  await expect(linkDialog).toHaveCount(0);
  const created = (await linkOf())!;
  expect(created.sourceRef.siteFileId).toBe('site-installateur');
  expect(created.sourceRef.filePath).toBeUndefined();
  expect(created.sourceRef.projectName).toBe('Installateur');
  expect(created.sourceVersion).toBe('1');
  expect(typeof created.anchorReadAt).toBe('string');
  const freshAnchor = created.anchorDate;
  // De bron is alleen gelezen, niet als document geopend.
  expect(await page.evaluate(() => window.__OPS__!.store.getState().documents.length)).toBe(1);

  // Opzet: het anker komt uit een oudere versie; een andere planner slaat versie 2 van de bron op.
  const makeOld = () => page.evaluate((id) => {
    const S = window.__OPS__!.store.getState();
    const link = S.tasks.find(t => t.id === id)!.externalLinks![0];
    S.updateTask(id, { externalLinks: [{ ...link, anchorDate: '2027-01-04T07:00' }] });
  }, ownTaskId);
  const focusWindow = async () => {
    await page.waitForTimeout(2_100);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  };
  await makeOld();
  await page.evaluate(async (text) => {
    const host = window.openaecHost as { storage: { save: (r: { id: string; name: string; data: Blob; baseVersion: string }) => Promise<unknown> } };
    await host.storage.save({ id: 'site-installateur', name: 'Installateur.ifc', data: new Blob([text]), baseVersion: '1' });
  }, source);
  await focusWindow();
  const strip = page.locator('[data-ops-external-source-update="site:site-installateur"]');
  await expect(strip).toHaveCount(1, { timeout: 15_000 });
  await expect(strip).toContainText('Installateur.ifc has a new version on the site (version 2, saved by Nep-site).');
  // De koppelingen met pad (uit de fixture) leest de browser niet: alleen deze balk.
  await expect(page.locator(STRIP)).toHaveCount(1);

  // Bekijken → Accepteren ⇒ het anker en de versie uit de site, alleen voor deze koppeling.
  await strip.locator('[data-ops-external-source-review]').click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toContainText('Version 2 on the site, saved by Nep-site.');
  await expect(dialog.locator('[data-ops-external-source-review-links] tbody tr')).toHaveCount(1);
  await dialog.locator('[data-ops-external-source-review-accept]').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(STRIP)).toHaveCount(0);
  expect(await linkOf()).toMatchObject({ anchorDate: freshAnchor, sourceVersion: '2', sourceRef: { siteFileId: 'site-installateur' } });

  // Alle externe relaties vernieuwen leest de site; de bron met pad niet. Geen *Bronbestanden kiezen…* op een site.
  await makeOld();
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Refresh all external relations' }).click();
  const status = page.locator('.ribbon-relation-menu-status');
  await expect(status).toContainText('1 anchor(s) refreshed');
  await expect(status).toContainText('1 source not read.');
  expect((await linkOf())!.anchorDate).toBe(freshAnchor);
  await expect(page.locator('[data-ops-external-sources-choose]')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // De bron is weg van de site (`not-found`): niet gelezen, geteld, en het anker blijft.
  await makeOld();
  await page.evaluate(() => new Promise<void>((resolve) => {
    const req = indexedDB.open('ops-fake-site', 1);
    req.onsuccess = () => {
      const tx = req.result.transaction('files', 'readwrite');
      tx.objectStore('files').delete('site-installateur');
      tx.oncomplete = () => { req.result.close(); resolve(); };
    };
  }));
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Refresh all external relations' }).click();
  await expect(status).toContainText('2 sources not read.');
  expect((await linkOf())!.anchorDate).toBe('2027-01-04T07:00');
});

test('bronproject: afhankelijke projecten zoeken, het resultaat bij de taak en de vraag vóór opslaan', async ({ page, ops: _ops }) => {
  test.setTimeout(90_000);
  const aannemer = readFileSync(fileURLToPath(new URL('./fixtures/ifc/externe-bron/Aannemer.ifc', import.meta.url)), 'utf8');
  await page.goto(`/?open=${DIR}/Installateur.ifc`);
  await expect.poll(() => page.evaluate(() => window.__OPS__?.store.getState().cpmResult?.projectEnd ?? ''), { timeout: 30_000 }).not.toBe('');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }));
  // Fixture: de mapkiezer geeft een map "Zuidas" met Aannemer.ifc. De klikken op de knoppen blijven echt.
  await page.evaluate((text) => {
    const w = window as unknown as Record<string, unknown>;
    const file = { kind: 'file', name: 'Aannemer.ifc', getFile: async () => new File([text], 'Aannemer.ifc') };
    const dir = {
      kind: 'directory', name: 'Zuidas',
      values: async function* () { yield file; yield { kind: 'directory', name: 'archief' }; },
      queryPermission: async () => 'granted',
    };
    w.showDirectoryPicker = async () => dir;
  }, aannemer);
  // Opslaan zonder bestandshandvat gaat in deze browser als download; zo zien we of er opgeslagen is.
  let downloads = 0;
  page.on('download', () => { downloads++; });

  // Echte klik: Relatie ▾ › Afhankelijke projecten zoeken… ⇒ een melding met 1 project en 2 koppelingen.
  await page.getByRole('button', { name: 'Link', exact: true }).first().click();
  await page.getByRole('menuitem', { name: 'Find dependent projects…' }).click();
  await expect(page.getByText('Dependent projects: 1. Links to this project: 2.')).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => window.__OPS__!.store.getState().isDirty)).toBe(false);

  // Het resultaat staat bij de taak (eigenschappenpaneel), alleen-lezen.
  await page.evaluate(() => {
    const S = window.__OPS__!.store.getState();
    S.selectTask(S.tasks.find(t => t.name === 'Installatie')!.id);
  });
  const section = page.locator('[data-ops-dependents]');
  await expect(section).toHaveCount(1);
  await expect(section).toContainText('Aannemer');
  await expect(section).toContainText('Afbouw');
  await expect(section).toContainText('Successor there');
  await expect(section).toContainText('uses 2027-03-19 16:00');

  // Ctrl+S ⇒ eerst de vraag: beide ankers worden later (onze taken zijn hun voorgangers).
  const warning = page.locator('[data-ops-dependent-anchor-warning]');
  await page.keyboard.press('ControlOrMeta+s');
  await expect(warning.locator('[data-ops-dependent-anchor-row]')).toHaveCount(2);
  await expect(warning).toContainText('2027-03-19 16:00 → 2027-03-23 16:00');
  // Annuleren ⇒ niets opgeslagen.
  await warning.locator('[data-ops-dependent-anchor-choice="cancel"]').click();
  await expect(warning).toHaveCount(0);
  await page.waitForTimeout(1_000);
  expect(downloads).toBe(0);
  // Toch opslaan ⇒ de app slaat op.
  await page.keyboard.press('ControlOrMeta+s');
  await warning.locator('[data-ops-dependent-anchor-choice="save"]').click();
  await expect(warning).toHaveCount(0);
  await expect.poll(() => downloads).toBe(1);
});

// Stap 1.7 (keuze 5, vorm 1; §7.1 en §9 in `docs/relaties-tussen-projecten.md`): de bron staat ook als document open,
// met niet-opgeslagen wijzigingen. Een eigen blok: de beginstand zijn twee documenten in de app (het eigen project
// en de bron), en de route wisselt van document. De bron komt uit OPFS, zoals in het blok van stap 1.8; de kiezer
// geeft dat handvat zowel bij *Bronbestand kiezen…* als bij *Openen*. De klikken en toetsen blijven echt; alleen de
// wijziging in de bron is een fixture.
test('bron ook geopend met niet-opgeslagen wijzigingen: melding, anker uit het bestand, rekenen met het geopende document en undo', async ({ page, ops: _ops }) => {
  test.setTimeout(120_000);
  await page.goto(`/?open=${DIR}/Aannemer.ifc`);
  await expect.poll(() => page.evaluate(() => window.__OPS__?.store.getState().cpmResult?.projectEnd ?? ''), { timeout: 30_000 }).not.toBe('');
  await page.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }));
  const sourceText = await (await page.request.get(`/${DIR}/Installateur.ifc`)).text();
  await page.evaluate(async (text) => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('Installateur.ifc', { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    Object.defineProperty(document, 'featurePolicy', { configurable: true, value: undefined });
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, writable: true, value: async () => [handle] });
  }, sourceText);
  const ownDocumentId = await page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId);
  const ownTaskId = await page.evaluate(() => {
    const S = window.__OPS__!.store.getState();
    const task = S.tasks.find(t => t.childIds.length === 0 && !(t.externalLinks?.length))!;
    S.selectTask(task.id);
    return task.id;
  });
  const linkOf = () => page.evaluate((id) => window.__OPS__!.store.getState().tasks.find(t => t.id === id)!.externalLinks?.[0] ?? null, ownTaskId);

  // Koppelen aan Installateur.ifc (zonder pad, zoals in de browser).
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Add external relation…' }).click();
  const linkDialog = page.getByTestId('external-link-dialog');
  await linkDialog.getByRole('button', { name: 'Source file', exact: true }).click();
  await linkDialog.locator('[data-ops-external-source-choose]').click();
  await expect(linkDialog.locator('[data-ops-external-source-chosen]')).toHaveText('Installateur.ifc');
  await linkDialog.getByTestId('external-link-add').click();
  await expect(linkDialog).toHaveCount(0);
  const created = (await linkOf())!;
  const savedAnchor = created.anchorDate;
  expect(created.sourceVersion).toBeTruthy();

  // Installateur.ifc ook openen (Ctrl+O, dezelfde kiezer) ⇒ een tweede document.
  await page.keyboard.press('ControlOrMeta+o');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().documents.length), { timeout: 15_000 }).toBe(2);
  const sourceDocumentId = await page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId);
  expect(sourceDocumentId).not.toBe(ownDocumentId);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().project.name)).toBe('Installateur');

  // Schoon geopend ⇒ vernieuwen zoals altijd, zonder melding.
  const tab = (id: string) => page.locator(`[data-testid="document-tab"][data-ops-tab="${id}"]`);
  const notice = page.locator('.ops-toast').filter({ hasText: 'Installateur.ifc has unsaved changes; the anchor comes from the saved version.' });
  await tab(ownDocumentId).click();
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Refresh all external relations' }).click();
  await expect(page.locator('.ribbon-relation-menu-status')).toContainText('1 anchor(s) refreshed');
  await page.waitForTimeout(500);
  await expect(notice).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Fixture: in de bron duurt de brontaak twee keer zo lang, niet opgeslagen en niet herberekend.
  await tab(sourceDocumentId).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().project.name)).toBe('Installateur');
  await page.evaluate((taskId) => {
    const S = window.__OPS__!.store.getState();
    const task = S.tasks.find(t => t.id === taskId)!;
    S.updateTask(taskId, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration * 2 } });
  }, created.sourceRef.taskId);
  const sourceState = () => page.evaluate((id) => {
    const S = window.__OPS__!.store.getState();
    const payload = S.activeDocumentId === id ? S : S.documents.find(d => d.id === id)!.payload!;
    return { dirty: payload.isDirty, stale: payload.scheduleStale, tasks: JSON.stringify(payload.tasks.map(t => [t.id, t.time])) };
  }, sourceDocumentId);
  const sourceBefore = await sourceState();
  expect(sourceBefore.dirty).toBe(true);

  // Vernieuwen ⇒ het anker uit het opgeslagen bestand en de melding met de knop. Review #860, punt 3: de stapel
  // is al vol (fixture: drie blijvende meldingen); de keuze wacht en verschijnt na het kruisje bij een andere.
  await tab(ownDocumentId).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId)).toBe(ownDocumentId);
  await page.evaluate(() => {
    const S = window.__OPS__!.store.getState();
    for (const n of S.ui.notifications) S.dismissNotification(n.id);
    for (const name of ['A.ifc', 'B.ifc', 'C.ifc']) {
      S.notify({ severity: 'error', messageKey: 'notifications.openFailed', detail: name, dedupeKey: `vul-${name}` });
    }
  });
  await expect(page.locator('.ops-toast')).toHaveCount(3);
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Refresh all external relations' }).click();
  await expect(page.locator('.ribbon-relation-menu-status')).toContainText('1 anchor(s) refreshed');
  await page.keyboard.press('Escape');
  await expect(notice).toHaveCount(0);
  await page.locator('.ops-toast').first().getByRole('button', { name: 'Close notification' }).click();
  await expect(notice).toHaveCount(1, { timeout: 15_000 });
  await page.evaluate(() => {
    const S = window.__OPS__!.store.getState();
    for (const n of S.ui.notifications) if (n.dedupeKey?.startsWith('vul-')) S.dismissNotification(n.id);
  });
  expect((await linkOf())!.anchorDate).toBe(savedAnchor);

  // De knop ⇒ het anker uit het geopende document, zonder versie, als één stap; de bron verandert niet.
  const appliedSteps = () => page.evaluate(() => window.__OPS__!.store.getState().historyEvents.filter(e => e.state === 'applied').length);
  const steps = await appliedSteps();
  await notice.locator('[data-ops-notification-action="refreshFromOpenDocument"]').click();
  await expect(page.locator('.ops-toast').filter({ hasText: 'The links to Installateur.ifc have been refreshed from the open document' })).toHaveCount(1, { timeout: 15_000 });
  await expect(notice).toHaveCount(0);
  const used = (await linkOf())!;
  expect(used.anchorDate > savedAnchor).toBe(true);
  expect(used.sourceVersion).toBeUndefined();
  expect(typeof used.anchorReadAt).toBe('string');
  expect(await appliedSteps()).toBe(steps + 1);
  expect(await page.evaluate(() => window.__OPS__!.store.getState().scheduleStale)).toBe(false);
  expect(await sourceState()).toEqual(sourceBefore);

  // Ctrl+Z ⇒ het anker uit het opgeslagen bestand terug; Ctrl+Y ⇒ weer dat uit het geopende document.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => (await linkOf())!.anchorDate).toBe(savedAnchor);
  await page.keyboard.press('ControlOrMeta+y');
  await expect.poll(async () => (await linkOf())!.anchorDate).toBe(used.anchorDate);

  // Review #860, punt 1: heen en terug naar het brontabblad zonder op te slaan ⇒ geen balk met de oude versie.
  await tab(sourceDocumentId).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().project.name)).toBe('Installateur');
  await tab(ownDocumentId).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId)).toBe(ownDocumentId);
  await page.waitForTimeout(2_000);
  await expect(page.locator(STRIP)).toHaveCount(0);
  expect((await linkOf())!.anchorDate).toBe(used.anchorDate);

  // De bron opslaan (Ctrl+S, in hetzelfde OPFS-bestand) en terug naar het eigen project ⇒ de balk bij die versie,
  // ook al blijft het anker gelijk. *Accepteren* zet de echte versie.
  await tab(sourceDocumentId).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().project.name)).toBe('Installateur');
  await page.keyboard.press('ControlOrMeta+s');
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().isDirty), { timeout: 15_000 }).toBe(false);
  const savedVersion = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const file = await (await root.getFileHandle('Installateur.ifc')).getFile();
    return new Date(file.lastModified).toISOString();
  });
  await tab(ownDocumentId).click();
  const strip = page.locator(`[data-ops-external-source-update="project:${created.sourceRef.projectId}"]`);
  await expect(strip).toHaveCount(1, { timeout: 15_000 });
  await expect(strip).toContainText('1 link changes.');
  await strip.locator('[data-ops-external-source-review]').click();
  const dialog = page.locator(DIALOG);
  await expect(dialog.locator('[data-ops-external-source-review-links] tbody tr')).toHaveCount(1);
  await expect(dialog.locator('[data-ops-external-source-review-version-only]')).toHaveCount(1);
  await dialog.locator('[data-ops-external-source-review-accept]').click();
  await expect(dialog).toHaveCount(0);
  await expect(strip).toHaveCount(0);
  const accepted = (await linkOf())!;
  expect([accepted.anchorDate, accepted.sourceVersion]).toEqual([used.anchorDate, savedVersion]);

  // Review #860, punt 2: een browser zonder onthouden handvat. De bron is weer gewijzigd (fixture); vernieuwen
  // leest haar niet; *Bronbestanden kiezen…* leest het gekozen bestand en geeft dan de melding met de knop.
  const chosenText = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    return (await (await root.getFileHandle('Installateur.ifc')).getFile()).text();
  });
  await tab(sourceDocumentId).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().project.name)).toBe('Installateur');
  await page.evaluate((taskId) => {
    const S = window.__OPS__!.store.getState();
    const task = S.tasks.find(t => t.id === taskId)!;
    S.updateTask(taskId, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration * 1.5 } });
  }, created.sourceRef.taskId);
  await tab(ownDocumentId).click();
  await expect.poll(() => page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId)).toBe(ownDocumentId);
  await page.evaluate(async () => {
    delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
    await new Promise<void>((resolve) => {
      const req = indexedDB.open('ops-external-sources', 1);
      req.onsuccess = () => {
        const tx = req.result.transaction('handles', 'readwrite');
        tx.objectStore('handles').clear();
        tx.oncomplete = () => { req.result.close(); resolve(); };
      };
    });
  });
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Refresh all external relations' }).click();
  await expect(page.locator('.ribbon-relation-menu-status')).toContainText('2 sources not read.');
  await expect(notice).toHaveCount(0);
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-ops-external-sources-choose]').click();
  await (await chooserPromise).setFiles({ name: 'Installateur.ifc', mimeType: 'application/octet-stream', buffer: Buffer.from(chosenText) });
  await expect(page.locator('.ribbon-relation-menu-status')).toContainText('1 anchor(s) refreshed');
  await page.keyboard.press('Escape');
  await expect(notice).toHaveCount(1, { timeout: 15_000 });
  expect((await linkOf())!.anchorDate).toBe(used.anchorDate);
  await notice.locator('[data-ops-notification-action="refreshFromOpenDocument"]').click();
  await expect.poll(async () => (await linkOf())!.anchorDate > used.anchorDate).toBe(true);
  expect((await linkOf())!.sourceVersion).toBeUndefined();
});
