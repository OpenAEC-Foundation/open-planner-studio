// Opslag via de site (issue #309) als echte gebruikershandeling: Ctrl+O, Ctrl+S, klikken in de
// dialogen en in Recent. De SITE is hier een nep-host die `page.addInitScript` vóór de app op
// `window.openaecHost` zet, precies zoals een echte site dat doet. Hij bewaart zijn bestanden in
// `sessionStorage`, zodat ze een herlaadbeurt overleven, en telt elke aanroep. De brug
// (`window.__OPS__`) leest alleen state en maakt een document gewijzigd; openen en opslaan zelf
// gaan altijd via toetsen en klikken.
//
// De iframe-tests zetten de host op de PARENT (een same-origin pagina met de tool in een iframe),
// zoals een site dat doet die de tool insluit. Objecten gaan dan tussen twee vensters heen en weer.
//
// Zonder host (laatste test) moet alles blijven zoals het was: geen site-dialoog, de gewone
// bestandskiezer en download.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Frame, Page } from '@playwright/test';
import { expect, test, waitForOps, waitForWelcomeCheck } from './fixtures/ops';

const HOST_KEY = 'ops-test-site-host';
const IFC = readFileSync(resolve(process.cwd(), 'public/examples/showcase-verbouwing-eengezinswoning.ifc'), 'utf8');

interface HostFile { id: string; name: string; versions: { version: string; data: string; author: string }[] }
interface HostCall {
  fn: 'list' | 'open' | 'save' | 'versions';
  id?: string | null;
  version?: string | null;
  name?: string;
  baseVersion?: string | null;
  type?: string;
  extensions?: string[] | null;
  /** Alleen in de iframe-opzet: kwam de Blob van `save` uit het venster van de host of uit een ander? */
  realm?: 'host' | 'other';
}

/** Eén bestand `Planning.ifc` (id `p1`) met twee versies. */
const SEED: HostFile[] = [{
  id: 'p1',
  name: 'Planning.ifc',
  versions: [
    { version: '1', data: IFC, author: 'Anna' },
    { version: '2', data: IFC, author: 'Bram' },
  ],
}];

/**
 * De nep-host. Draait in de pagina, vóór de app, bij elke (her)laadbeurt. `onlyTop`: alleen in het
 * bovenste venster (de iframe-opzet), zodat de tool in de iframe de host op `window.parent` vindt.
 * Een ontbrekend bestand geeft `code: 'not-found'`; `failOpen` in de opslag laat `open` met een
 * andere fout falen.
 */
async function installSiteHost(
  page: Page,
  seed: HostFile[],
  options: { initialFileId?: string; lateMs?: number; onlyTop?: boolean } = {},
): Promise<void> {
  await page.addInitScript(({ key, seedFiles, initialFileId, lateMs, onlyTop }) => {
    if (onlyTop && window !== window.top) return;
    interface V { version: string; data: string; author: string }
    interface F { id: string; name: string; versions: V[] }
    interface Db { files: F[]; seq: number; calls: Record<string, unknown>[]; failOpen?: string }
    const read = (): Db => {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) as Db : { files: seedFiles, seq: 0, calls: [] };
    };
    const write = (db: Db) => sessionStorage.setItem(key, JSON.stringify(db));
    const log = (call: Record<string, unknown>) => { const db = read(); db.calls.push(call); write(db); };
    const latest = (f: F) => f.versions[f.versions.length - 1];
    const info = (f: F, v: V = latest(f)) => ({ id: f.id, name: f.name, version: v.version });
    const find = (db: Db, id: string): F => {
      const f = db.files.find((x) => x.id === id);
      if (!f) throw Object.assign(new Error(`Bestand ${id} bestaat niet op de site.`), { code: 'not-found' });
      return f;
    };
    const storage = {
      async list(query?: { extensions?: string[] }) {
        log({ fn: 'list', extensions: query?.extensions ?? null });
        return read().files.map((f) => info(f));
      },
      async open(id: string, version?: string) {
        log({ fn: 'open', id, version: version ?? null });
        const failOpen = read().failOpen;
        if (failOpen) throw Object.assign(new Error(failOpen), { code: 'unavailable' });
        const f = find(read(), id);
        const v = version === undefined ? latest(f) : f.versions.find((x) => x.version === version);
        if (!v) throw new Error(`Versie ${version} bestaat niet.`);
        return { file: info(f, v), data: new Blob([v.data]) };
      },
      async save(request: { id?: string; name: string; data: Blob; baseVersion?: string }) {
        const text = await request.data.text();
        log({
          fn: 'save', id: request.id ?? null, name: request.name, baseVersion: request.baseVersion ?? null, type: request.data.type,
          ...(onlyTop ? { realm: request.data instanceof Blob ? 'host' : 'other' } : {}),
        });
        const db = read();
        if (request.id === undefined) {
          db.seq += 1;
          const created: F = { id: `nieuw-${db.seq}`, name: request.name, versions: [{ version: '1', data: text, author: 'Test' }] };
          db.files.push(created);
          write(db);
          return info(created);
        }
        const f = find(db, request.id);
        if (request.baseVersion !== undefined && request.baseVersion !== latest(f).version) {
          throw Object.assign(new Error(`Op de site staat al versie ${latest(f).version}.`), { code: 'conflict' });
        }
        f.versions.push({ version: String(f.versions.length + 1), data: text, author: 'Test' });
        write(db);
        return info(f);
      },
      async versions(id: string) {
        log({ fn: 'versions', id });
        return [...find(read(), id).versions].reverse().map((v) => ({ version: v.version, author: v.author }));
      },
    };
    const host = { storage, ...(initialFileId ? { initialFileId } : {}) };
    if (lateMs === undefined) {
      (window as unknown as { openaecHost: unknown }).openaecHost = host;
      return;
    }
    // Een site die de host pas later zet, meldt dat met `openaec-host-ready` (zie siteHost.ts).
    setTimeout(() => {
      (window as unknown as { openaecHost: unknown }).openaecHost = host;
      window.dispatchEvent(new Event('openaec-host-ready'));
    }, lateMs);
  }, { key: HOST_KEY, seedFiles: seed, initialFileId: options.initialFileId, lateMs: options.lateMs, onlyTop: !!options.onlyTop });
}

/** Pas de opslag van de host aan (testscenario's: storing, bestand weg, kapotte versie). */
async function editHost(page: Page, change: 'fail-open' | 'heal-open' | 'delete-p1' | 'push-broken' | 'pop'): Promise<void> {
  await page.evaluate(({ key, what }) => {
    const db = JSON.parse(sessionStorage.getItem(key)!) as { files: HostFile[]; failOpen?: string };
    const p1 = db.files.find((f) => f.id === 'p1');
    if (what === 'fail-open') db.failOpen = 'Netwerkfout: de site antwoordt niet.';
    if (what === 'heal-open') delete db.failOpen;
    if (what === 'delete-p1') db.files = db.files.filter((f) => f.id !== 'p1');
    if (what === 'push-broken') p1!.versions.push({ version: String(p1!.versions.length + 1), data: 'GEEN IFC', author: 'Kapot' });
    if (what === 'pop') p1!.versions.pop();
    sessionStorage.setItem(key, JSON.stringify(db));
  }, { key: HOST_KEY, what: change });
}

/** Testscenario "iemand anders slaat op": een nieuwe versie direct in de opslag van de host. */
async function otherUserSaves(page: Page, id: string): Promise<void> {
  await page.evaluate(({ key, fileId }) => {
    const db = JSON.parse(sessionStorage.getItem(key)!) as { files: HostFile[] };
    const f = db.files.find((x) => x.id === fileId)!;
    f.versions.push({ version: String(f.versions.length + 1), data: f.versions[f.versions.length - 1].data, author: 'Collega' });
    sessionStorage.setItem(key, JSON.stringify(db));
  }, { key: HOST_KEY, fileId: id });
}

async function hostCalls(page: Page): Promise<HostCall[]> {
  return page.evaluate((key) => (JSON.parse(sessionStorage.getItem(key) ?? '{"calls":[]}') as { calls: HostCall[] }).calls, HOST_KEY);
}
const saves = async (page: Page) => (await hostCalls(page)).filter((c) => c.fn === 'save');

/** De pagina of de iframe waarin de tool draait. */
type Tool = Page | Frame;

async function doc(tool: Tool) {
  return tool.evaluate(() => {
    const s = window.__OPS__!.store.getState();
    return {
      activeDocumentId: s.activeDocumentId,
      documentCount: s.documents.length,
      siteFileId: s.siteFileId,
      siteFileVersion: s.siteFileVersion,
      filePath: s.filePath,
      isDirty: s.isDirty,
      tasks: s.tasks.length,
    };
  });
}

const lastNotification = (tool: Tool) => tool.evaluate(() => {
  const n = window.__OPS__!.store.getState().ui.notifications.at(-1);
  return n ? { messageKey: n.messageKey, detail: n.detail ?? null, name: (n.params?.name as string | undefined) ?? null } : null;
});

/** Maak het actieve document gewijzigd (fixture, niet de handeling onder test). */
async function makeDirty(tool: Tool, name: string): Promise<void> {
  await tool.evaluate((taskName) => { window.__OPS__!.store.getState().addTask({ name: taskName }); }, name);
  await expect.poll(() => doc(tool).then((d) => d.isDirty)).toBe(true);
}

/** Aantal records in de crashherstel-database (web). */
async function recoveryRecords(page: Page): Promise<number> {
  return page.evaluate(() => new Promise<number>((done) => {
    const request = indexedDB.open('ops-recovery');
    request.onerror = () => done(0);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('records')) { db.close(); done(0); return; }
      const count = db.transaction('records', 'readonly').objectStore('records').count();
      count.onsuccess = () => { db.close(); done(count.result); };
      count.onerror = () => { db.close(); done(0); };
    };
  }));
}

/**
 * Na een herlaadbeurt: wacht op het herstelvenster of het einde van de welkomstcontrole (die komt pas
 * na de herstelcontrole). Een herstelvenster beantwoorden we met "niet herstellen". Met een host draait
 * de tool ingebed: geen welkomstvenster (#716).
 */
async function settleAfterReload(page: Page): Promise<void> {
  await waitForOps(page);
  const recovery = page.locator('[data-ops-recovery-dialog]');
  const welcomeChecked = () => page.evaluate(() => window.__OPS__!.log.snapshot().some((e) => e.channel === 'welkomst'));
  await expect.poll(async () => await recovery.count() > 0 || await welcomeChecked(), { timeout: 15_000 }).toBe(true);
  if (await recovery.count() > 0) {
    await recovery.getByRole('button', { name: /^(Don't restore|Niet herstellen)$/ }).click();
    await expect(recovery).toHaveCount(0);
  }
  expect(await waitForWelcomeCheck(page)).toBe('welkomstcontrole: overgeslagen (ingebed)');
}

const openDialog = (tool: Tool) => tool.locator('[data-ops-site-open-dialog]');
const saveDialog = (tool: Tool) => tool.locator('[data-ops-site-save-dialog]');

/** Ctrl+O → "Openen van de site" → klik op het bestand (zonder te wachten op het resultaat). */
async function clickOpenFromSite(page: Page, id: string): Promise<void> {
  await page.keyboard.press('Control+o');
  await expect(openDialog(page)).toBeVisible();
  await openDialog(page).locator(`[data-ops-site-file="${id}"] [data-ops-site-file-open]`).click();
  await expect(openDialog(page)).toHaveCount(0);
}

/** Ctrl+O → "Openen van de site" → klik op het bestand, en wacht tot het geopend is. */
async function openFromSiteDialog(page: Page, id: string): Promise<void> {
  await clickOpenFromSite(page, id);
  await expect.poll(() => doc(page).then((d) => d.siteFileId)).toBe(id);
}

const recentItem = (page: Page) => page.locator('.backstage-recent-item').filter({ hasText: 'Planning.ifc' });

const siteTest = test.extend({
  page: async ({ page }, use) => {
    await installSiteHost(page, SEED);
    await use(page);
  },
});

siteTest('openen van de site, Ctrl+S schrijft zonder dialoog, en Recent heropent na herladen', async ({ page, ops: _ops }) => {
  await openFromSiteDialog(page, 'p1');
  const opened = await doc(page);
  expect(opened.filePath).toBe('Planning.ifc');
  expect(opened.tasks).toBeGreaterThan(0);
  // `list` kan in DEV twee keer komen (React StrictMode draait het effect dubbel); het telt dat
  // hij de open-extensies meekreeg en dat er precies één bestand gelezen is.
  const calls = await hostCalls(page);
  expect(calls.filter((c) => c.fn === 'list').every((c) => c.extensions?.includes('ifc'))).toBe(true);
  expect(calls.filter((c) => c.fn === 'list').length).toBeGreaterThan(0);
  expect(calls.filter((c) => c.fn === 'open')).toEqual([{ fn: 'open', id: 'p1', version: null }]);

  await makeDirty(page, 'Extra werk');
  await page.keyboard.press('Control+s');
  await expect.poll(() => saves(page).then((s) => s.length)).toBe(1);
  expect((await saves(page))[0]).toEqual({
    fn: 'save', id: 'p1', name: 'Planning.ifc', baseVersion: '2', type: 'application/x-step',
  });
  await expect(saveDialog(page)).toHaveCount(0);
  await expect.poll(() => doc(page).then((d) => d.isDirty)).toBe(false);

  // Nog een keer: de basis is nu de net geschreven versie 3.
  await makeDirty(page, 'Nog meer werk');
  await page.keyboard.press('Control+s');
  await expect.poll(() => saves(page).then((s) => s.length)).toBe(2);
  expect((await saves(page))[1].baseVersion).toBe('3');
  await expect(saveDialog(page)).toHaveCount(0);

  // Recent toont het site-bestand met het label "Op de site".
  await page.locator('.ribbon-tab--file').click();
  const recent = page.locator('.backstage-recent-item').filter({ hasText: 'Planning.ifc' });
  await expect(recent).toHaveCount(1);
  await expect(recent.locator('[data-ops-recent-site]')).toHaveText(/^(On the site|Op de site)$/);

  // Herladen. Recent moet het bestand heropenen, dus geen crashherstel: komt dat venster (de
  // auto-save kan tussendoor een kopie hebben gemaakt), dan kiezen we "niet herstellen".
  page.on('dialog', (d) => { void d.accept(); });
  await page.reload();
  await settleAfterReload(page);
  expect((await doc(page)).siteFileId).toBeNull();

  const opensBefore = (await hostCalls(page)).filter((c) => c.fn === 'open').length;
  await page.locator('.ribbon-tab--file').click();
  const recentAfterReload = page.locator('.backstage-recent-item').filter({ hasText: 'Planning.ifc' });
  await expect(recentAfterReload).toHaveCount(1);
  await recentAfterReload.click();
  await expect.poll(() => doc(page).then((d) => d.siteFileId)).toBe('p1');
  const opens = (await hostCalls(page)).filter((c) => c.fn === 'open');
  expect(opens.length).toBe(opensBefore + 1);
  expect(opens.at(-1)).toEqual({ fn: 'open', id: 'p1', version: null });

  // Na heropenen weer Ctrl+S: naar hetzelfde bestand, met de nieuwste versie (4) als basis.
  await makeDirty(page, 'Na herladen');
  await page.keyboard.press('Control+s');
  await expect.poll(() => saves(page).then((s) => s.length)).toBe(3);
  expect((await saves(page))[2]).toMatchObject({ id: 'p1', baseVersion: '4' });
});

siteTest('nieuw document: Ctrl+S vraagt een naam en maakt een nieuw bestand op de site', async ({ page, ops: _ops }) => {
  await page.evaluate(() => window.__OPS__!.store.getState().setProject({ name: 'Nieuwbouw school' }));
  await makeDirty(page, 'Fundering');

  await page.keyboard.press('Control+s');
  await expect(saveDialog(page)).toBeVisible();
  const nameField = saveDialog(page).locator('[data-ops-site-save-name]');
  await expect(nameField).toBeFocused();
  await expect(nameField).toHaveValue('Nieuwbouw school.ifc');
  // De naam zonder `.ifc` is geselecteerd: typen vervangt hem.
  await page.keyboard.type('School Noord');
  await expect(nameField).toHaveValue('School Noord.ifc');
  // Ctrl+S in het naamveld start geen tweede opslagronde.
  await page.keyboard.press('Control+s');
  await saveDialog(page).locator('[data-ops-site-save-confirm]').click();
  await expect(saveDialog(page)).toHaveCount(0);

  await expect.poll(() => saves(page).then((s) => s.length)).toBe(1);
  expect((await saves(page))[0]).toEqual({
    fn: 'save', id: null, name: 'School Noord.ifc', baseVersion: null, type: 'application/x-step',
  });
  await expect.poll(() => doc(page)).toMatchObject({ siteFileId: 'nieuw-1', filePath: 'School Noord.ifc', isDirty: false });

  // Daarna is de site het doel: Ctrl+S schrijft zonder vraag een nieuwe versie.
  await makeDirty(page, 'Ruwbouw');
  await page.keyboard.press('Control+s');
  await expect.poll(() => saves(page).then((s) => s.length)).toBe(2);
  expect((await saves(page))[1]).toMatchObject({ id: 'nieuw-1', baseVersion: '1' });
  await expect(saveDialog(page)).toHaveCount(0);
});

siteTest('sluiten met Opslaan: de site-vraag ligt boven de sluitvraag en het tabblad sluit na opslaan', async ({ page, ops: _ops }) => {
  // Twee documenten, zodat het sluiten van het actieve tabblad de app niet leeg achterlaat.
  await page.evaluate(() => window.__OPS__!.store.getState().setProject({ name: 'Eerste' }));
  await page.evaluate(() => window.__OPS__!.store.getState().newDocument());
  await page.evaluate(() => window.__OPS__!.store.getState().setProject({ name: 'Te sluiten' }));
  await makeDirty(page, 'Werk');
  const closing = await page.evaluate(() => window.__OPS__!.store.getState().activeDocumentId);

  await page.locator('.ops-tab-group').filter({ has: page.locator(`[data-ops-tab="${closing}"]`) }).locator('.ops-tab-close').click();
  const close = page.locator('[data-ops-close-dialog]');
  await expect(close).toBeVisible();
  await close.locator('[data-ops-close-choice="save"]').click();
  await expect(saveDialog(page)).toBeVisible();
  await expect(saveDialog(page).locator('[data-ops-site-save-name]')).toHaveValue('Te sluiten.ifc');
  await saveDialog(page).locator('[data-ops-site-save-confirm]').click();

  await expect(saveDialog(page)).toHaveCount(0);
  await expect(close).toHaveCount(0);
  await expect.poll(() => saves(page).then((s) => s.length)).toBe(1);
  expect((await saves(page))[0]).toMatchObject({ id: null, name: 'Te sluiten.ifc' });
  await expect.poll(() => page.evaluate((id) => window.__OPS__!.store.getState().documents.some((d) => d.id === id), closing)).toBe(false);
});

// AutoSave op de nepklok (testaudit 2026-10-20: dit kostte 13 s echte wachttijd). De klok gaat aan vóór het
// laden van de app (deze fixture draait vóór `ops` navigeert), dus ook een al ingeplande AutoSave-ronde staat
// op de nepklok; tot de test hem stilzet loopt hij gewoon mee met de echte tijd.
const siteClockTest = siteTest.extend({
  page: async ({ page }, use) => {
    await page.clock.install();
    await use(page);
  },
});

/** isDirty van een (ook niet-actief) document. */
const dirtyOf = (page: Page, id: string) => page.evaluate((docId) => window.__OPS__!.store.getState()
  .getOpenDocumentPayloads().find((d) => d.id === docId)?.payload.isDirty, id);

siteClockTest('AutoSave: voor een site-bestand grijs met eigen uitleg, en de timer schrijft nooit naar de site', async ({ page, ops: _ops }) => {
  const toggle = page.locator('[data-ops-autosave]');
  await openFromSiteDialog(page, 'p1');
  // Besluit #309: automatisch opslaan naar de site bestaat niet (elke ronde zou een nieuwe versie maken).
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(toggle).toHaveAttribute('title', /^(On the site, Save \(Ctrl\+S\) stores a new version\.|Op de site slaat Opslaan \(Ctrl\+S\) een nieuwe versie op\.)/);
  await toggle.click({ force: true });
  expect(await page.evaluate(() => window.__OPS__!.store.getState().autoSaveToFile)).toBe(false);

  // Ook met de vlag aan (alleen als fixture te zetten) schrijft de timer niets naar de site.
  await page.evaluate(() => window.__OPS__!.store.getState().setAutoSaveToFile(true));
  await makeDirty(page, 'Niet automatisch');
  const siteDoc = (await doc(page)).activeDocumentId;

  // Controle dat de AutoSave-ronde echt voorbijkomt: een tweede document met een (fixture-)FSA-handle en
  // AutoSave aan. Dezelfde timer schrijft dat document wel weg (het wordt schoon); zonder die controle zou
  // "geen site-save" ook groen zijn als de timer nooit liep.
  const controlDoc = await page.evaluate(() => {
    const store = window.__OPS__!.store;
    const id = store.getState().newDocument();
    store.setState({
      filePath: 'klokcontrole.ifc',
      fileHandle: {
        queryPermission: async () => 'granted',
        createWritable: async () => ({ write: async () => {}, close: async () => {} }),
      },
    } as never);
    store.getState().setAutoSaveToFile(true);
    store.getState().addTask({ name: 'Klokcontrole' });
    return id;
  });
  await expect.poll(() => dirtyOf(page, controlDoc)).toBe(true);
  await page.locator(`[data-testid="document-tab"][data-ops-tab="${siteDoc}"]`).click();
  await expect.poll(() => doc(page).then((d) => d.activeDocumentId)).toBe(siteDoc);

  // Klok stil (sprong van 500 ms; `pauseAt` mag niet naar het verleden), dan precies 13 s vooruit. Daarna
  // laat de poll alleen de async schrijfronde afronden; de echte tijd zet geen timer meer verder (review PR #399).
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 500);
  await page.clock.runFor(13_000);
  await expect.poll(() => dirtyOf(page, controlDoc)).toBe(false);
  expect(await saves(page)).toEqual([]);
  expect((await doc(page)).isDirty).toBe(true);
  expect(await dirtyOf(page, siteDoc)).toBe(true);
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

siteTest('twee tabbladen op één site-bestand: elk zijn eigen basis, ook na een mislukte heropening', async ({ page, ops }) => {
  ops.acceptError('Opslaan op de site mislukt');
  ops.acceptError('Failed to open file');
  // Tab A rust op versie 2 en wordt gewijzigd.
  await openFromSiteDialog(page, 'p1');
  const tabA = await doc(page);
  expect(tabA.siteFileVersion).toBe('2');
  await makeDirty(page, 'Werk in A');

  // Een collega slaat versie 3 op; daarna opent de gebruiker het bestand opnieuw, in tab B.
  await otherUserSaves(page, 'p1');
  await clickOpenFromSite(page, 'p1');
  await expect.poll(() => doc(page).then((d) => d.activeDocumentId)).not.toBe(tabA.activeDocumentId);
  const tabB = await doc(page);
  expect(tabB).toMatchObject({ siteFileId: 'p1', siteFileVersion: '3', documentCount: 2 });

  // Een heropening die bij het lezen van het bestand faalt, verschuift ook niets.
  await editHost(page, 'push-broken');
  await clickOpenFromSite(page, 'p1');
  await expect.poll(() => lastNotification(page).then((n) => n?.messageKey)).toBe('notifications.openFailed');
  await editHost(page, 'pop');

  // Terug naar tab A: Ctrl+S stuurt A's eigen basis (2) mee en botst met het werk van de collega.
  await page.locator(`[data-testid="document-tab"][data-ops-tab="${tabA.activeDocumentId}"]`).click();
  await expect.poll(() => doc(page).then((d) => d.activeDocumentId)).toBe(tabA.activeDocumentId);
  expect((await doc(page)).siteFileVersion).toBe('2');
  await page.keyboard.press('Control+s');
  await expect.poll(() => saves(page).then((s) => s.length)).toBe(1);
  expect((await saves(page))[0]).toMatchObject({ id: 'p1', baseVersion: '2' });
  await expect.poll(() => lastNotification(page).then((n) => n?.messageKey)).toBe('notifications.siteSaveConflict');
  expect(await doc(page)).toMatchObject({ isDirty: true, siteFileVersion: '2' });

  // Tab B rust op versie 3 en slaagt.
  await page.locator(`[data-testid="document-tab"][data-ops-tab="${tabB.activeDocumentId}"]`).click();
  await expect.poll(() => doc(page).then((d) => d.activeDocumentId)).toBe(tabB.activeDocumentId);
  await makeDirty(page, 'Werk in B');
  await page.keyboard.press('Control+s');
  await expect.poll(() => saves(page).then((s) => s.length)).toBe(2);
  expect((await saves(page))[1]).toMatchObject({ id: 'p1', baseVersion: '3' });
  await expect.poll(() => doc(page)).toMatchObject({ isDirty: false, siteFileVersion: '4' });
});

siteTest('Recent: een storing laat het bestand staan; alleen "bestaat niet" haalt het weg', async ({ page, ops }) => {
  ops.acceptError('Openen van de site mislukt');
  await openFromSiteDialog(page, 'p1');

  // Storing bij de site: melding met de tekst van de site, en het bestand blijft in Recent.
  await editHost(page, 'fail-open');
  await page.locator('.ribbon-tab--file').click();
  await recentItem(page).click();
  const failToast = page.locator('.ops-toast[role="alert"]').filter({ hasText: 'Netwerkfout: de site antwoordt niet.' });
  await expect(failToast).toBeVisible();
  expect(await lastNotification(page)).toMatchObject({ messageKey: 'notifications.openFailed', detail: 'Netwerkfout: de site antwoordt niet.' });
  await page.locator('.ribbon-tab--file').click();
  await expect(recentItem(page)).toHaveCount(1);

  // Het bestand is weg op de site (code 'not-found'): melding, en het gaat uit Recent.
  await editHost(page, 'heal-open');
  await editHost(page, 'delete-p1');
  await recentItem(page).click();
  const goneToast = page.locator('.ops-toast[role="alert"]').filter({ hasText: 'Planning.ifc' });
  await expect(goneToast).toBeVisible();
  expect(await lastNotification(page)).toMatchObject({ messageKey: 'notifications.siteFileGone', name: 'Planning.ifc' });
  await page.locator('.ribbon-tab--file').click();
  await expect(recentItem(page)).toHaveCount(0);
});

siteTest('conflict: iemand anders sloeg op; eigen melding en het document blijft gewijzigd', async ({ page, ops }) => {
  ops.acceptError('Opslaan op de site mislukt');
  await openFromSiteDialog(page, 'p1');
  await makeDirty(page, 'Mijn wijziging');
  await otherUserSaves(page, 'p1');

  await page.keyboard.press('Control+s');
  await expect.poll(() => saves(page).then((s) => s.length)).toBe(1);
  expect((await saves(page))[0]).toMatchObject({ id: 'p1', baseVersion: '2' });

  const toast = page.locator('.ops-toast[role="alert"]').filter({ hasText: 'Planning.ifc' });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Op de site staat al versie 3.');
  expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.notifications.at(-1)?.messageKey))
    .toBe('notifications.siteSaveConflict');
  expect(await doc(page)).toMatchObject({ siteFileId: 'p1', isDirty: true });
  await expect(saveDialog(page)).toHaveCount(0);
});

siteTest('oudere versie opent als kopie zonder doel; Ctrl+S vraagt dan een naam', async ({ page, ops: _ops }) => {
  await page.keyboard.press('Control+o');
  await expect(openDialog(page)).toBeVisible();
  const file = openDialog(page).locator('[data-ops-site-file="p1"]');
  await file.locator('[data-ops-site-versions-toggle]').click();
  const versions = file.locator('[data-ops-site-versions]');
  await expect(versions.locator('[data-ops-site-version]')).toHaveCount(2);
  await versions.locator('[data-ops-site-version="1"] [data-ops-site-version-open]').click();
  await expect(openDialog(page)).toHaveCount(0);

  await expect.poll(() => doc(page).then((d) => d.tasks)).toBeGreaterThan(0);
  const copy = await doc(page);
  expect(copy.siteFileId).toBeNull();
  expect(copy.filePath).toMatch(/^Planning \((version|versie) 1\)\.ifc$/);
  expect((await hostCalls(page)).filter((c) => c.fn === 'open')).toEqual([{ fn: 'open', id: 'p1', version: '1' }]);

  // Geen doel: Ctrl+S overschrijft de nieuwste versie niet, maar vraagt een naam.
  await makeDirty(page, 'Op de kopie');
  await page.keyboard.press('Control+s');
  await expect(saveDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(saveDialog(page)).toHaveCount(0);
  expect(await saves(page)).toEqual([]);
  expect((await doc(page)).isDirty).toBe(true);

  // Niet in Recent: de kopie is geen site-bestand.
  await page.locator('.ribbon-tab--file').click();
  await expect(page.locator('.backstage-recent-list, .backstage-empty').first()).toBeVisible();
  await expect(page.locator('[data-ops-recent-site]')).toHaveCount(0);
});

siteTest('"Van deze pc…" in de open-dialoog opent de gewone bestandskiezer', async ({ page, ops: _ops }) => {
  await page.keyboard.press('Control+o');
  await expect(openDialog(page)).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await openDialog(page).locator('[data-ops-site-open-local]').click();
  await chooser;
  await expect(openDialog(page)).toHaveCount(0);
  expect((await hostCalls(page)).filter((c) => c.fn === 'open')).toEqual([]);
});

siteTest('herstel na een crash houdt het site-doel en de basisversie', async ({ page, ops: _ops }) => {
  await openFromSiteDialog(page, 'p1');
  await makeDirty(page, 'Niet opgeslagen');
  await expect.poll(() => recoveryRecords(page), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.evaluate(() => localStorage.setItem('ops-welcomeSeen', 'true'));
  page.on('dialog', (d) => { void d.accept(); });
  await page.reload();
  await waitForOps(page);

  const recovery = page.locator('[data-ops-recovery-dialog]');
  await expect(recovery).toBeVisible({ timeout: 15_000 });
  await recovery.getByRole('button', { name: /^(Restore|Herstellen)$/ }).click();
  await expect(recovery).toHaveCount(0);
  await expect.poll(() => doc(page)).toMatchObject({ siteFileId: 'p1', isDirty: true });

  // Ctrl+S schrijft weer naar de site, met de versie van vóór de crash als basis (geen dialoog).
  await page.keyboard.press('Control+s');
  await expect.poll(() => saves(page).then((s) => s.length)).toBe(1);
  expect((await saves(page))[0]).toMatchObject({ id: 'p1', name: 'Planning.ifc', baseVersion: '2' });
  await expect(saveDialog(page)).toHaveCount(0);
  await expect.poll(() => doc(page).then((d) => d.isDirty)).toBe(false);
});

/**
 * De tool in een same-origin iframe, met de host op de parent. De parentpagina komt via `page.route`
 * van hetzelfde adres als de dev-server; de nep-host staat alleen in het bovenste venster.
 */
async function openToolInIframe(page: Page, options: { initialFileId?: string; lateMs?: number }): Promise<Frame> {
  await installSiteHost(page, SEED, { ...options, onlyTop: true });
  await page.route('**/site-host-test.html', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body style="margin:0"><iframe id="tool" src="/" style="border:0;width:100vw;height:100vh"></iframe></body></html>',
  }));
  await page.goto('/site-host-test.html');
  await expect.poll(() => page.frames().length).toBe(2);
  const frame = page.frames().find((f) => f !== page.mainFrame())!;
  await expect.poll(() => frame.evaluate(() => window.__OPS__ !== undefined), { timeout: 15_000 }).toBe(true);
  expect(await frame.evaluate(() => 'openaecHost' in window)).toBe(false);
  // De host op de parent maakt de tool ook ingebed: geen welkomstvenster (#716). Komt de host pas ná de
  // welkomstcontrole (`lateMs`), dan staat het venster al open, zoals het contract zegt; sluit het dan.
  const outcome = await waitForWelcomeCheck(frame);
  if (options.lateMs === undefined) expect(outcome).toBe('welkomstcontrole: overgeslagen (ingebed)');
  else await frame.evaluate(() => window.__OPS__!.store.getState().setUI({ showWelcomeDialog: false, showTourOverlay: false }));
  return frame;
}

/**
 * Zoals in de SuperCloud-werkplek (issue #582): daar draait de tool in een sandbox-iframe zonder
 * `allow-same-origin`, en weigert de browser IndexedDB met een `SecurityError`. Alleen in de iframe;
 * de host op de parent houdt zijn eigen opslag.
 */
async function refuseIndexedDbInIframe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window === window.top) return;
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value: () => { throw new DOMException('The user denied permission to access the database.', 'SecurityError'); },
    });
  });
}

/** Meldingen over crashherstel of auto-save in het meldingenkanaal van de tool. */
const recoveryNotices = (tool: Tool) => tool.evaluate(() => window.__OPS__!.store.getState().ui.notifications
  .map((n) => n.messageKey).filter((key) => /recovery|autoSave/i.test(key)));

for (const [label, lateMs] of [['meteen', undefined], ['pas na het laden', 3_000]] as const) {
  test(`iframe: host op de parent (${label}) — startbestand, openen en opslaan over twee vensters`, async ({ page }) => {
    // De iframe weigert IndexedDB, zoals in de werkplek. Crashherstel gaat dan stil uit: één
    // consoleregel, geen melding; openen en opslaan via de host werken gewoon.
    const recoveryOff: string[] = [];
    page.on('console', (message) => { if (message.text().includes('Crashherstel staat uit')) recoveryOff.push(message.text()); });
    await refuseIndexedDbInIframe(page);
    const frame = await openToolInIframe(page, { initialFileId: 'p1', lateMs });
    // Het startbestand komt van de parent; de inhoud is een Blob uit het venster van de parent.
    await expect.poll(() => doc(frame).then((d) => d.siteFileId), { timeout: 20_000 }).toBe('p1');
    expect(await doc(frame)).toMatchObject({ filePath: 'Planning.ifc', siteFileVersion: '2' });
    expect((await doc(frame)).tasks).toBeGreaterThan(0);

    // "Openen van de site" in de iframe toont de lijst van de parent.
    await frame.locator('.ribbon-tab--file').waitFor();
    await frame.locator('.title-bar').click({ position: { x: 600, y: 10 } });
    await page.keyboard.press('Control+o');
    await expect(openDialog(frame)).toBeVisible();
    await expect(openDialog(frame).locator('[data-ops-site-file="p1"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(openDialog(frame)).toHaveCount(0);

    // Ctrl+S: de Blob van de tool komt uit een ánder venster dan de host; de host leest hem toch.
    await makeDirty(frame, 'Vanuit de iframe');
    await page.keyboard.press('Control+s');
    await expect.poll(() => saves(page).then((s) => s.length)).toBe(1);
    expect((await saves(page))[0]).toEqual({
      fn: 'save', id: 'p1', name: 'Planning.ifc', baseVersion: '2', type: 'application/x-step', realm: 'other',
    });
    await expect.poll(() => doc(frame)).toMatchObject({ isDirty: false, siteFileVersion: '3' });

    // De eerste crashherstelronde loopt meteen na de eerste wijziging; de site-opslag hierboven is
    // pas daarna klaar. Nog een wijziging en nog een opslag: ook die ronde blijft stil.
    await makeDirty(frame, 'Nog een wijziging');
    await page.keyboard.press('Control+s');
    await expect.poll(() => saves(page).then((s) => s.length)).toBe(2);
    await expect.poll(() => doc(frame)).toMatchObject({ isDirty: false, siteFileVersion: '4' });
    expect(recoveryOff).toHaveLength(1);
    expect(await recoveryNotices(frame)).toEqual([]);
  });
}

/** Wacht tot de tool in de (nieuwe) iframe klaar is en sluit het welkomstvenster. */
async function readyToolFrame(page: Page, previous: Frame | null): Promise<Frame> {
  await expect.poll(() => page.frames().some((f) => f !== page.mainFrame() && f !== previous && !f.isDetached())).toBe(true);
  const frame = page.frames().find((f) => f !== page.mainFrame() && f !== previous && !f.isDetached())!;
  await expect.poll(() => frame.evaluate(() => window.__OPS__ !== undefined).catch(() => false), { timeout: 15_000 }).toBe(true);
  await waitForWelcomeCheck(frame);
  return frame;
}

test('iframe: geen luisteraar blijft op de parent achter (iframe weg, of startbestand gevonden)', async ({ page }) => {
  // Een luisteraar op de PARENT verdwijnt niet vanzelf met de iframe: de pagina van de site leeft door
  // en zou via de closure de hele oude app vasthouden. Tel de luisteraars via het DevTools-protocol.
  const first = await openToolInIframe(page, {});
  const cdp = await page.context().newCDPSession(page);
  const readyListeners = async (): Promise<number> => {
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'window' });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
    return listeners.filter((l) => l.type === 'openaec-host-ready').length;
  };
  // Zonder startbestand wacht de tool op het event, ook op de parent.
  await expect.poll(readyListeners).toBe(1);

  // De site haalt de iframe weg (bijv. navigatie in Frappe desk): de luisteraar moet mee weg.
  await page.evaluate(() => document.getElementById('tool')!.remove());
  await expect.poll(readyListeners).toBe(0);

  // Een nieuwe iframe; daarna meldt de site alsnog een startbestand.
  await page.evaluate(() => {
    const iframe = document.createElement('iframe');
    iframe.id = 'tool';
    iframe.src = '/';
    iframe.style.cssText = 'border:0;width:100vw;height:100vh';
    document.body.appendChild(iframe);
  });
  const second = await readyToolFrame(page, first);
  await expect.poll(readyListeners).toBe(1);
  await page.evaluate(() => {
    (window as unknown as { openaecHost: { initialFileId?: string } }).openaecHost.initialFileId = 'p1';
    window.dispatchEvent(new Event('openaec-host-ready'));
  });
  await expect.poll(() => doc(second).then((d) => d.siteFileId), { timeout: 20_000 }).toBe('p1');
  // Gevonden ⇒ afgemeld; precies één `open` van het startbestand.
  await expect.poll(readyListeners).toBe(0);
  expect((await hostCalls(page)).filter((c) => c.fn === 'open' && c.id === 'p1')).toHaveLength(1);
});

for (const [label, lateMs] of [['meteen', undefined], ['pas na het laden', 3_000]] as const) {
  test(`startbestand van de host (${label}) opent als site-bestand`, async ({ page }) => {
    await installSiteHost(page, SEED, { initialFileId: 'p1', lateMs });
    await page.goto('/');
    await waitForOps(page);
    await expect.poll(() => doc(page).then((d) => d.siteFileId), { timeout: 20_000 }).toBe('p1');
    expect((await doc(page)).filePath).toBe('Planning.ifc');
    expect((await hostCalls(page)).filter((c) => c.fn === 'open')).toEqual([{ fn: 'open', id: 'p1', version: null }]);
  });
}

test('zonder site: Ctrl+O en Ctrl+S gaan als vanouds naar bestandskiezer en download', async ({ page, ops: _ops }) => {
  expect(await page.evaluate(() => 'openaecHost' in window)).toBe(false);

  // Firefox/Safari-capabilityroute in Chromium: geen herbruikbare handles of site-host.
  await page.evaluate(() => {
    Reflect.deleteProperty(window, 'showOpenFilePicker');
    Reflect.deleteProperty(window, 'showSaveFilePicker');
  });
  expect(await page.evaluate(() => 'showOpenFilePicker' in window)).toBe(false);
  for (const locale of ['nl', 'en']) {
    await page.evaluate(async lang => {
      const localePath = '/src/i18n/config.ts';
      const { setLocale } = await import(/* @vite-ignore */ localePath);
      await setLocale(lang);
    }, locale);
    await page.locator('.ribbon-tab--file').click();
    await page.locator('.backstage-nav-item').filter({ hasText: /^Recent$/ }).click();
    await expect(page.locator('.backstage-title')).toHaveText(locale === 'nl' ? 'Recente projecten' : 'Recent projects');
    await expect(page.locator('[data-ops-recent-unavailable]')).toHaveText(locale === 'nl'
      ? 'Deze browser kan eerder geopende lokale bestanden niet opnieuw openen vanuit Recent. Gebruik Openen om je projectbestand opnieuw te kiezen.'
      : 'This browser cannot reopen local files from Recent. Use Open to choose your project file again.');
    await expect(page.locator('.backstage-recent-item')).toHaveCount(0);
    await page.locator('[data-ops-backstage-back]').click();
  }

  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Control+o');
  await chooser;
  await expect(openDialog(page)).toHaveCount(0);

  await page.evaluate(() => window.__OPS__!.store.getState().setProject({ name: 'Lokaal plan' }));
  await makeDirty(page, 'Taak');
  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  expect((await download).suggestedFilename()).toBe('Lokaal plan.ifc');
  await expect(saveDialog(page)).toHaveCount(0);
  expect((await doc(page)).siteFileId).toBeNull();
});
