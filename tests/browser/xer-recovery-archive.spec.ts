// Crashherstel met het XER-bronarchief "één keer geschreven" (eigenaarsbesluit plan (9); ontwerp
// `docs/superpowers/plans/2026-10-07-xer-archief-eenmalig.md`). ECHTE IndexedDB en echte
// gebruikershandelingen: een .xer met twee projecten via de ribbonknop Openen en de bestandskiezer, een
// taaknaam wijzigen in de tabel, herladen, en Herstellen in het herstelvenster. `window.__OPS__` en
// IndexedDB worden alleen GELEZEN. Het tweede geval zet vóór de app-start een oude (v1) database met
// een leesbare snapshot met ingebed archief én een onleesbare kopie — en bewijst
// dat de upgrade naar v3 die snapshot nog herstelt.
import type { Locator, Page } from '@playwright/test';
import { expect, test, waitForOps } from './fixtures/ops';

// main.tsx installeert de brug via een losse dynamische import. Een zichtbare herstelmelding
// bewijst niet dat die klaar is: na iedere app-navigatie wachten vóór store-observaties.

const TASK_HEADER = [
  'task_id', 'proj_id', 'clndr_id', 'task_code', 'task_name', 'task_type', 'duration_type',
  'status_code', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt', 'target_start_date', 'target_end_date',
].join('\t');

/** Klein, synthetisch XER met twee projecten ⇒ twee documenten die één bronarchief delen. */
const XER_TWO_PROJECTS = [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tStandaard 8u\tCA_Base\t8\t40\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
  '%R\tP1\tHerstelAlfa\tC1\t2026-01-01\t2026-01-05',
  '%R\tP2\tHerstelBeta\tC1\t2026-01-01\t2026-01-05',
  '%T\tTASK',
  `%F\t${TASK_HEADER}`,
  '%R\tT1\tP1\tC1\tA1\tFundering\tTT_Task\tDT_FixedDUR\tTK_NotStart\t40\t40\t2026-01-05\t2026-01-09',
  '%R\tT2\tP2\tC1\tB1\tGevel\tTT_Task\tDT_FixedDUR\tTK_NotStart\t16\t16\t2026-01-05\t2026-01-06',
  '%E',
].join('\n');

const RENAMED = 'Fundering hersteld';

function taskCell(page: Page, taskId: string, columnId: string): Locator {
  return page.locator(
    `[data-task-grid-surface-id="full-task-grid"] [data-grid-data-row="true"][data-grid-row-key="${taskId}"]`
      + ` [data-grid-data-cell="true"][data-grid-column-id="${columnId}"]`,
  );
}

interface RecoveryDbView {
  version: number;
  stores: string[];
  blobs: number;
  manifestRefs: (string | null)[];
  snapshotHasName: boolean;
}

/** Leest de echte IndexedDB `ops-recovery` (zonder versie: geen upgrade vanuit de test). */
function readRecoveryDb(page: Page, needle: string): Promise<RecoveryDbView> {
  return page.evaluate((name) => new Promise<RecoveryDbView>((resolve) => {
    const empty: RecoveryDbView = { version: 0, stores: [], blobs: 0, manifestRefs: [], snapshotHasName: false };
    const request = indexedDB.open('ops-recovery');
    request.onerror = () => resolve(empty);
    request.onsuccess = () => {
      const db = request.result;
      const stores = [...db.objectStoreNames];
      if (!stores.includes('records')) { db.close(); resolve({ ...empty, version: db.version, stores }); return; }
      const names = stores.includes('xer-archives') ? ['records', 'xer-archives'] : ['records'];
      const tx = db.transaction(names, 'readonly');
      const all = tx.objectStore('records').getAll();
      all.onsuccess = () => {
        const records = all.result as Array<{ kind: string; ifc?: string; documents?: Array<{ xerArchive?: string }> }>;
        const manifestRefs = records.filter(r => r.kind === 'manifest')
          .flatMap(r => (r.documents ?? []).map(d => d.xerArchive ?? null));
        const snapshotHasName = records.some(r => r.kind === 'doc' && typeof r.ifc === 'string' && r.ifc.includes(name));
        if (!stores.includes('xer-archives')) {
          db.close();
          resolve({ version: db.version, stores, blobs: 0, manifestRefs, snapshotHasName });
          return;
        }
        const count = tx.objectStore('xer-archives').count();
        count.onsuccess = () => {
          db.close();
          resolve({ version: db.version, stores, blobs: count.result, manifestRefs, snapshotHasName });
        };
      };
      all.onerror = () => { db.close(); resolve(empty); };
    };
  }), needle);
}

/** Wat de gebruiker na herstel open heeft: per document de taaknamen en de archiefstaat (alleen lezen). */
function openDocuments(page: Page) {
  return page.evaluate(() => window.__OPS__!.store.getState().getOpenDocumentPayloads().map(({ payload }) => ({
    project: payload.project.name,
    tasks: payload.tasks.map(t => t.name),
    archiveSha: payload.xerSourceArchive?.sha256 ?? null,
    sourceProjectId: payload.xerSourceProjectId ?? null,
    archiveIssue: payload.xerArchiveIssue?.code ?? null,
  })));
}

async function acceptRecovery(page: Page): Promise<void> {
  const dialog = page.locator('[data-ops-recovery-dialog]');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole('button', { name: /^(Restore|Herstellen)$/ }).click();
  await expect(dialog).toHaveCount(0);
}

test('crashherstel: een XER met twee projecten komt terug mét archief, uit één gedeelde blob', async ({ page, ops: _ops }) => {
  test.setTimeout(90_000);
  const workers: string[] = [];
  page.on('worker', worker => workers.push(worker.url()));
  // Alleen observeren: echte worker, berichten en IndexedDB; de gebruikersroute blijft ongewijzigd.
  await page.evaluate(() => {
    const requests: Array<{ inputKeys: string[]; archiveKeys: string[] }> = [];
    Object.assign(window, { __recoveryWorkerRequests: requests });
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (value: unknown, ...rest: unknown[]) {
      const message = value as { snapshot?: { input: object; archive?: object } };
      if (message?.snapshot) requests.push({
        inputKeys: Object.keys(message.snapshot.input), archiveKeys: Object.keys(message.snapshot.archive ?? {}),
      });
      Reflect.apply(post, this, [value, ...rest]);
    };
  });
  // (1) Openen via de echte bestandsroute.
  const openButton = page.locator('button.ribbon-btn').filter({ hasText: /^(Open|Openen)$/ });
  await expect(openButton).toHaveCount(1);
  const chooserPromise = page.waitForEvent('filechooser');
  await openButton.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'herstel-twee.xer', mimeType: 'application/octet-stream', buffer: Buffer.from(XER_TWO_PROJECTS) });
  await expect.poll(() => openDocuments(page).then(docs => docs.length)).toBe(2);
  const opened = await openDocuments(page);
  expect(opened.every(doc => doc.archiveSha !== null)).toBe(true);
  expect(new Set(opened.map(doc => doc.archiveSha)).size).toBe(1);

  // (2) Een taaknaam wijzigen in de tabel van het actieve document (Alfa of Beta, wat actief is).
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  await expect(page.locator('[data-task-grid-surface-id="full-task-grid"] [role="grid"]')).toBeVisible();
  const taskId = await page.evaluate(() => window.__OPS__!.store.getState().tasks[0]!.id);
  const cell = taskCell(page, taskId, 'task.name');
  await cell.click();
  await expect(cell).toBeFocused();
  await page.keyboard.press('Enter');
  const input = cell.locator('input');
  await expect(input).toBeFocused();
  await input.fill(RENAMED);
  await page.keyboard.press('Enter');
  await expect(cell).toHaveText(RENAMED);

  // (3) De auto-save-tick (throttle 10 s) afwachten in de echte IndexedDB: de snapshot draagt de
  // nieuwe naam, beide manifestregels verwijzen naar hetzelfde archief en er is precies één blob.
  await expect.poll(() => readRecoveryDb(page, RENAMED), { timeout: 30_000, intervals: [500] }).toMatchObject({
    version: 3, blobs: 1, snapshotHasName: true,
  });
  expect(workers.some(url => url.includes('recoverySnapshot.worker'))).toBe(true);
  const requests = await page.evaluate(() => (window as unknown as {
    __recoveryWorkerRequests: Array<{ inputKeys: string[]; archiveKeys: string[] }>;
  }).__recoveryWorkerRequests);
  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests) {
    expect(request.archiveKeys.sort()).toEqual(['byteLength', 'format', 'selectorValid', 'sha256']);
    expect(request.inputKeys).not.toContain('xerSourceArchive');
    expect(request.inputKeys).not.toContain('xer');
    expect(request.inputKeys).not.toContain('fileHandle');
    expect(request.inputKeys).not.toContain('siteFileId');
  }
  const db = await readRecoveryDb(page, RENAMED);
  expect(db.stores.sort()).toEqual(['records', 'xer-archives']);
  expect(db.manifestRefs).toHaveLength(2);
  expect(new Set(db.manifestRefs)).toEqual(new Set([opened[0]!.archiveSha]));

  // (4) Herladen, zoals na een crash; (5) herstellen via het echte herstelvenster.
  await page.evaluate(() => localStorage.setItem('ops-welcomeSeen', 'true'));
  page.on('dialog', d => { void d.accept(); });
  await page.reload();
  await waitForOps(page);
  await acceptRecovery(page);

  // (6) Beide documenten zijn terug, mét het gedeelde archief en zonder archiefmelding; de wijziging ook.
  await expect.poll(() => openDocuments(page).then(docs => docs.length)).toBe(2);
  const restored = await openDocuments(page);
  expect(restored.map(doc => doc.archiveSha)).toEqual([opened[0]!.archiveSha, opened[0]!.archiveSha]);
  expect(restored.map(doc => doc.archiveIssue)).toEqual([null, null]);
  expect(restored.map(doc => doc.sourceProjectId).sort()).toEqual(['P1', 'P2']);
  expect(restored.flatMap(doc => doc.tasks)).toContain(RENAMED);
});

test('crashherstel: oude v1-snapshot herstelt en onleesbare kopie blijft bewaard na nieuwe auto-save', async ({ page, ops }) => {
  test.setTimeout(90_000);
  // Zelfde herstelroute ook zonder Web Worker (bijvoorbeeld een beperkte webview).
  await page.addInitScript(() => { Object.defineProperty(window, 'Worker', { value: undefined, configurable: true }); });
  // Fixture, vóór de app-start: de app is door de `ops`-fixture al geladen en heeft `ops-recovery` op v3
  // gezet. Daarom eerst weg van de app naar een statisch bestand, de database wissen, en daar een v1-
  // database neerzetten met de snapshot die een vorige versie schreef: IFC met INGEBED archief (schema 2),
  // gemaakt met de eigen lezer/writer via de dev-server. Daarna pas de app openen.
  await page.goto('/icon.png');
  const sessionId = 'oude-sessie-v1';
  ops.acceptError('Failed to read recovery document: doc-corrupt');
  await page.evaluate(async ({ xer, sid }) => {
    // Paden als variabele: de dev-server (Vite) levert de bronmodules; de testtypecheck kent ze niet.
    const readerPath = '/src/services/xer/xerReader.ts';
    const writerPath = '/src/services/ifc/ifcWriter.ts';
    const { readXER } = (await import(/* @vite-ignore */ readerPath)) as { readXER: (bytes: Uint8Array) => unknown };
    const { writeIFC } = (await import(/* @vite-ignore */ writerPath)) as { writeIFC: (input: unknown) => string };
    const opened = readXER(new TextEncoder().encode(xer)) as { results?: unknown[] };
    const first = opened.results ? opened.results[0] : opened;
    const ifc = writeIFC(first);
    if (!ifc.includes('ByteChunk000000')) throw new Error('fixture: de oude snapshot moet het archief ingebed dragen');
    await new Promise<void>((resolve, reject) => {
      const del = indexedDB.deleteDatabase('ops-recovery');
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
    });
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ops-recovery', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('records', { keyPath: 'id' }); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('records', 'readwrite');
        const store = tx.objectStore('records');
        const now = Date.now();
        store.put({ id: `${sid}::doc::doc-oud`, kind: 'doc', sessionId: sid, docId: 'doc-oud', ifc, addedAt: now });
        store.put({ id: `${sid}::doc::doc-corrupt`, kind: 'doc', sessionId: sid, docId: 'doc-corrupt', ifc: 'BROKEN_RECOVERY_FIXTURE', addedAt: now });
        store.put({
          id: `${sid}::manifest`, kind: 'manifest', sessionId: sid, version: 4, activeDocumentId: 'doc-oud',
          documents: [
            { id: 'doc-oud', ifc: `${sid}::doc::doc-oud`, filePath: null, isDirty: true, datesAsRecorded: false },
            { id: 'doc-corrupt', ifc: `${sid}::doc::doc-corrupt`, filePath: null, isDirty: true, datesAsRecorded: false },
          ],
          addedAt: now,
        });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
    sessionStorage.setItem('ops-recovery-session', sid);
    localStorage.setItem('ops-welcomeSeen', 'true');
  }, { xer: XER_TWO_PROJECTS, sid: sessionId });

  await page.goto('/');
  await waitForOps(page);
  await acceptRecovery(page);
  await expect.poll(() => openDocuments(page).then(docs => docs.length)).toBe(1);
  const [restored] = await openDocuments(page);
  expect(restored!.project).toContain('HerstelAlfa');
  expect(restored!.archiveSha).toMatch(/^[0-9a-f]{64}$/);
  expect(restored!.archiveIssue).toBeNull();
  expect(restored!.sourceProjectId).toBe('P1');
  // De database is geüpgraded naar v3 met archiefstore en kind-index.
  const db = await readRecoveryDb(page, 'Fundering');
  expect(db.version).toBe(3);
  expect(db.stores.sort()).toEqual(['records', 'xer-archives']);

  // Niet alleen direct na Herstellen kijken: ook de eerstvolgende echte auto-save
  // moet de onleesbare kopie bewaren. Bewerk daarom het herstelde document via de tabel.
  const edited = 'Herstel na gedeeltelijk herstel';
  await page.getByRole('button', { name: /^(Table|Tabel)$/ }).click();
  const taskId = await page.evaluate(() => window.__OPS__!.store.getState().tasks[0]!.id);
  const cell = taskCell(page, taskId, 'task.name');
  await cell.click();
  await page.keyboard.press('Enter');
  await cell.locator('input').fill(edited);
  await page.keyboard.press('Enter');
  await expect.poll(() => readRecoveryDb(page, edited), { timeout: 30_000, intervals: [500] })
    .toMatchObject({ snapshotHasName: true });
  expect((await readRecoveryDb(page, 'BROKEN_RECOVERY_FIXTURE')).snapshotHasName).toBe(true);

  // Na het veiligstellen van de gezonde projecten blijft alleen een onleesbare kopie over.
  // Fixture vóór de start; bewaren/verwerpen gebeurt vervolgens met echte gebruikershandelingen.
  for (const locale of ['nl', 'en']) {
    await page.goto('/icon.png');
    await page.evaluate(async ({ sid, locale }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('ops-recovery');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['records', 'xer-archives'], 'readwrite');
          const records = tx.objectStore('records');
          records.clear();
          tx.objectStore('xer-archives').clear();
          records.put({ id: sid + '::doc::doc-corrupt', kind: 'doc', sessionId: sid,
            docId: 'doc-corrupt', ifc: 'BROKEN_RECOVERY_FIXTURE', addedAt: Date.now() });
          records.put({ id: sid + '::manifest', kind: 'manifest', sessionId: sid,
            version: 4, activeDocumentId: 'doc-corrupt', addedAt: Date.now(),
            documents: [{ id: 'doc-corrupt', ifc: sid + '::doc::doc-corrupt',
              filePath: null, isDirty: true, datesAsRecorded: false }] });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
      });
      sessionStorage.setItem('ops-recovery-session', sid);
      sessionStorage.removeItem('ops-recovery-session:held');
      localStorage.setItem('ops-locale', locale);
    }, { sid: 'alleen-onleesbaar-' + locale, locale });
    await page.goto('/');
    await waitForOps(page);
    const dialog = page.locator('[data-ops-recovery-dialog]');
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole('button', { name: /^(Herstellen|Restore)$/ })).toHaveCount(0);
    const keepName = locale === 'nl' ? 'Kopieën bewaren' : 'Keep copies';
    const discardName = locale === 'nl' ? 'Kopieën verwijderen' : 'Delete copies';
    await expect(dialog.getByText(locale === 'nl'
      ? /Verwijderen kan niet ongedaan worden gemaakt/
      : /Deletion cannot be undone/)).toBeVisible();
    if (locale === 'nl') await dialog.getByRole('button', { name: keepName, exact: true }).click();
    else await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect((await readRecoveryDb(page, 'BROKEN_RECOVERY_FIXTURE')).snapshotHasName).toBe(true);
    await page.reload();
    await waitForOps(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    if (locale === 'nl') {
      // Ook Enter kiest standaard de veilige uitweg, nooit verwijderen.
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      expect((await readRecoveryDb(page, 'BROKEN_RECOVERY_FIXTURE')).snapshotHasName).toBe(true);
      await page.reload();
      await waitForOps(page);
      await expect(dialog).toBeVisible({ timeout: 15_000 });
    }
    await dialog.getByRole('button', { name: discardName, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => readRecoveryDb(page, 'BROKEN_RECOVERY_FIXTURE'))
      .toMatchObject({ snapshotHasName: false });
    await page.reload();
    await waitForOps(page);
    await expect(dialog).toHaveCount(0);
  }

  // Knownbug 96: dezelfde opstartroute met leesbare IFC onder een geweigerd manifest.
  // Alleen de fixture en observatie via IndexedDB; bewerken en melding sluiten via echte UI.
  await page.clock.install();
  await page.addInitScript(() => {
    const observed = Object.assign(window, { __manifestWriteAttempts: 0 });
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, stores: string | string[], mode?: IDBTransactionMode, options?: IDBTransactionOptions) {
      if (this.name === 'ops-recovery' && mode === 'readwrite') {
        observed.__manifestWriteAttempts++;
      }
      return transaction.call(this, stores, mode, options);
    };
  });
  const recoveryBytes = () => page.evaluate(() => new Promise<string>((resolve, reject) => {
    const request = indexedDB.open('ops-recovery');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['records', 'xer-archives'], 'readonly');
      const records = tx.objectStore('records').getAll();
      const blobs = tx.objectStore('xer-archives').getAll();
      tx.oncomplete = () => {
        resolve(JSON.stringify([records.result, blobs.result.map((b: { id: string; bytes: Uint8Array }) =>
          ({ ...b, bytes: [...b.bytes] }))], (_key, value: unknown) => {
          // Alleen de waarneming coderen, niet de fixture: hole ≠ undefined/null in IndexedDB.
          if (Array.isArray(value) && Object.keys(value).length < value.length) {
            return { type: 'sparse-array', length: value.length, entries: Object.entries(value) };
          }
          return value;
        }));
        db.close();
      };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
  for (const { locale, shape } of [
    { locale: 'nl', shape: 'unknown' }, { locale: 'en', shape: 'invalid-version' },
    { locale: 'en', shape: 'sparse-documents' }, { locale: 'en', shape: 'sparse-docIds' },
  ]) {
    await page.goto('/icon.png');
    await page.evaluate(async ({ xer, locale, shape }) => {
      const sid = 'geweigerd-manifest-' + locale + (shape.startsWith('sparse-') ? '-' + shape : '');
      const readerPath = '/src/services/xer/xerReader.ts';
      const writerPath = '/src/services/ifc/ifcWriter.ts';
      const { readXER } = (await import(/* @vite-ignore */ readerPath)) as { readXER: (bytes: Uint8Array) => { results: unknown[] } };
      const { writeIFC } = (await import(/* @vite-ignore */ writerPath)) as { writeIFC: (input: unknown) => string };
      const ifc = writeIFC(readXER(new TextEncoder().encode(xer)).results[0]);
      // NL begint met de bestaande DB v2 zonder index. De app moet zelf upgraden en ALLE bytes
      // bewaren, inclusief een gezond canoniek manifest naast een onbekende afwijkende kandidaat.
      if (locale === 'nl') await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('ops-recovery');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('ops-recovery', locale === 'nl' ? 2 : 3);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('records', { keyPath: 'id' });
          request.result.createObjectStore('xer-archives', { keyPath: 'id' });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['records', 'xer-archives'], 'readwrite');
          const records = tx.objectStore('records');
          records.clear(); tx.objectStore('xer-archives').clear();
          records.put({ id: sid + '::doc::doc-oud', kind: 'doc', sessionId: sid,
            docId: 'doc-oud', ifc, addedAt: 1 });
          const manifest = { id: sid + '::manifest', kind: 'manifest', sessionId: sid,
            version: locale === 'nl' ? 5 : '5', activeDocumentId: 'doc-oud', addedAt: 1,
            documents: [{ id: 'doc-oud', ifc: sid + '::doc::doc-oud', filePath: 'oud.ifc',
              isDirty: true, datesAsRecorded: true, siteFileId: 'oude-site', siteFileVersion: 'oude-basis' }] };
          // Native IndexedDB structured clone: de hole blijft afwezig, zonder JSON-normalisatie.
          if (shape === 'sparse-documents') {
            manifest.version = 5;
            manifest.documents.length++;
            records.put(manifest);
          } else if (shape === 'sparse-docIds') {
            const docIds = ['doc-oud'];
            docIds.length++;
            records.put({ id: manifest.id, kind: manifest.kind, sessionId: sid,
              activeDocumentId: 'doc-oud', addedAt: 1, docIds });
          } else records.put(manifest);
          if (locale === 'nl') records.put({ ...manifest, id: sid + '::manifest-v6', version: 99 });
          tx.objectStore('xer-archives').put({ id: 'onbekende-blob', bytes: new Uint8Array([0, 255, 42]), addedAt: 1 });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
      });
      sessionStorage.setItem('ops-recovery-session', sid);
      sessionStorage.removeItem('ops-recovery-session:held');
      localStorage.setItem('ops-locale', locale);
    }, { xer: XER_TWO_PROJECTS, locale, shape });
    const before = await recoveryBytes();
    if (shape.startsWith('sparse-')) {
      // De native read moet nog precies de afwezige tweede positie tonen, geen ingevulde null.
      expect(before).toContain('"type":"sparse-array","length":2,"entries":[["0",');
    }
    const sidBefore = await page.evaluate(() => sessionStorage.getItem('ops-recovery-session'));
    await page.goto('/');
    await waitForOps(page);
    const warning = page.getByRole('alert').filter({ hasText: locale === 'nl'
      ? 'De herstelgegevens hebben een onbekende versie of een ongeldige indeling.'
      : 'The recovery data has an unknown version or an invalid structure.' });
    await expect(warning).toBeVisible();
    await expect(page.locator('[data-ops-recovery-dialog]')).toHaveCount(0);
    expect(await recoveryBytes()).toBe(before);
    if (locale === 'nl') {
      const upgraded = await page.evaluate(() => new Promise((resolve, reject) => {
        const request = indexedDB.open('ops-recovery');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const index = db.transaction('records', 'readonly').objectStore('records').index('kind');
          const manifests = index.getAll('manifest');
          manifests.onsuccess = () => {
            resolve({ version: db.version, keyPath: index.keyPath, unique: index.unique,
              ids: manifests.result.map((record: { id: string }) => record.id).sort() });
            db.close();
          };
          manifests.onerror = () => { db.close(); reject(manifests.error); };
        };
      }));
      expect(upgraded).toEqual({ version: 3, keyPath: 'kind', unique: false, ids: [
        'geweigerd-manifest-nl::manifest', 'geweigerd-manifest-nl::manifest-v6',
      ] });
    }
    const documentState = () => page.evaluate(() => {
      const state = window.__OPS__!.store.getState();
      return { tasks: state.tasks.length, filePath: state.filePath, siteFileId: state.siteFileId,
        siteFileVersion: state.siteFileVersion, documents: state.documents.length };
    });
    expect(await documentState()).toEqual({ tasks: 0, filePath: null, siteFileId: null, siteFileVersion: null, documents: 1 });
    const attempts = () => page.evaluate(() => {
      const value: unknown = Reflect.get(window, '__manifestWriteAttempts');
      if (typeof value !== 'number') throw new Error('De herstelobservatie is niet geïnstalleerd.');
      return value;
    });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500));
    // Zonder selectie heet de knop 'onderaan'; een klik kan de selectie en dus de naam wijzigen.
    expect(await page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([]);
    const addTask = page.locator('button[data-ops-ribbon-item="addTask"]');
    await expect(addTask).toHaveAccessibleName(locale === 'nl'
      ? 'Nieuwe taak onderaan de lijst' : 'New task at the bottom of the list');
    let previousAttempts = await attempts();
    await addTask.click();
    await page.clock.runFor(10_000);
    await expect.poll(attempts).toBeGreaterThan(previousAttempts);
    expect(await recoveryBytes()).toBe(before);
    expect(await documentState()).toEqual({ tasks: 1, filePath: null, siteFileId: null, siteFileVersion: null, documents: 1 });
    expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
      .filter(n => n.messageKey === 'notifications.recoveryManifestBlocked').map(n => n.count))).toEqual([1]);
    await warning.locator('[data-ops-toast-close]').click();
    previousAttempts = await attempts();
    await addTask.click();
    await page.clock.runFor(10_000);
    await expect.poll(attempts).toBeGreaterThan(previousAttempts);
    await expect(warning).toHaveCount(0);
    expect(await recoveryBytes()).toBe(before);
    expect(await page.evaluate(() => sessionStorage.getItem('ops-recovery-session'))).toBe(sidBefore);
    expect(await documentState()).toEqual({ tasks: 2, filePath: null, siteFileId: null, siteFileVersion: null, documents: 1 });
    await page.clock.resume();
  }

  // R2: een ECHTE v2-verbinding weigert versionchange. Gezonde data mag dan geen lege read worden
  // en na het sluiten van de blocker ook niet alsnog door de nieuwe lege sessie worden overschreven.
  const previousData: unknown = JSON.parse(await recoveryBytes());
  if (!Array.isArray(previousData) || !Array.isArray(previousData[0])) throw new Error('Herstelfixture ontbreekt.');
  const snapshot: unknown = previousData[0].find((record: unknown) =>
    record !== null && typeof record === 'object' && typeof Reflect.get(record, 'ifc') === 'string');
  const ifc: unknown = snapshot && typeof snapshot === 'object' ? Reflect.get(snapshot, 'ifc') : undefined;
  if (typeof ifc !== 'string') throw new Error('Leesbare IFC-fixture ontbreekt.');
  await page.goto('/icon.png');
  const blocker = await page.context().newPage();
  try {
    await blocker.goto('/icon.png');
    await blocker.evaluate(async (ifc) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('ops-recovery');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('ops-recovery', 2);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('records', { keyPath: 'id' });
          request.result.createObjectStore('xer-archives', { keyPath: 'id' });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const observed = Object.assign(window, { __blockedRecoveryDb: db, __recoveryVersionChanges: 0 });
          db.onversionchange = () => { observed.__recoveryVersionChanges++; }; // bewust NIET sluiten
          const tx = db.transaction(['records', 'xer-archives'], 'readwrite');
          tx.objectStore('records').put({ id: 'blocked-upgrade::doc::oud', kind: 'doc', sessionId: 'blocked-upgrade',
            docId: 'oud', ifc, addedAt: 1 });
          tx.objectStore('records').put({ id: 'blocked-upgrade::manifest', kind: 'manifest', sessionId: 'blocked-upgrade',
            version: 5, activeDocumentId: 'oud', addedAt: 1,
            documents: [{ id: 'oud', ifc: 'blocked-upgrade::doc::oud', filePath: 'bestaand.ifc', isDirty: false, datesAsRecorded: true }] });
          tx.objectStore('xer-archives').put({ id: 'bewaarde-blob', bytes: new Uint8Array([0, 255, 42]), addedAt: 1 });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
    }, ifc);
    // Lezen via de blokkadeverbinding zelf: een nieuwe openaanvraag zou achter de upgrade wachten.
    const blockedBytes = () => blocker.evaluate(() => new Promise<string>((resolve, reject) => {
      const db: unknown = Reflect.get(window, '__blockedRecoveryDb');
      if (!(db instanceof IDBDatabase)) throw new Error('Blokkadeverbinding ontbreekt.');
      const tx = db.transaction(['records', 'xer-archives'], 'readonly');
      const records = tx.objectStore('records').getAll();
      const blobs = tx.objectStore('xer-archives').getAll();
      tx.oncomplete = () => resolve(JSON.stringify([records.result, blobs.result.map((b: { id: string; bytes: Uint8Array }) =>
        ({ ...b, bytes: [...b.bytes] }))]));
      tx.onerror = () => reject(tx.error);
    }));
    const before = await blockedBytes();
    await page.evaluate(() => {
      sessionStorage.setItem('ops-recovery-session', 'blocked-upgrade');
      sessionStorage.removeItem('ops-recovery-session:held');
      localStorage.setItem('ops-locale', 'en');
      localStorage.removeItem('ops-welcomeSeen');
    });
    await page.addInitScript(() => {
      const events: string[] = [];
      Object.assign(window, { __recoveryOpenEvents: events });
      const open = indexedDB.open;
      indexedDB.open = function (this: IDBFactory, name: string, version?: number) {
        const request = version === undefined ? open.call(this, name) : open.call(this, name, version);
        if (name === 'ops-recovery' && version === 3) {
          for (const event of ['blocked', 'upgradeneeded', 'error', 'success']) {
            request.addEventListener(event, () => events.push(event));
          }
        }
        return request;
      };
    });
    await page.goto('/');
    await waitForOps(page);
    const warning = page.getByRole('alert').filter({ hasText: 'Recovery storage is temporarily blocked by another open connection.' });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Save your work yourself');
    await expect(page.locator('[data-ops-recovery-dialog]')).toHaveCount(0);
    // Welkom wacht op recoveryResolved: deze echte opstartstap bewijst dat finish() bereikt is.
    await expect(page.locator('[data-ops-welcome-dialog]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-ops-welcome-dialog]')).toHaveCount(0);
    expect(await blocker.evaluate(() => Reflect.get(window, '__recoveryVersionChanges'))).toBe(1);
    const openEvents = () => page.evaluate(() => Reflect.get(window, '__recoveryOpenEvents'));
    expect(await openEvents()).toEqual(['blocked']);
    expect(await blockedBytes()).toBe(before);
    const refusedOperations = () => page.evaluate(async () => {
      const path = '/src/services/recovery/recoveryStore.ts';
      const recovery: typeof import('@/services/recovery/recoveryStore') = await import(/* @vite-ignore */ path);
      const errors: string[] = [];
      for (const action of [
        () => recovery.loadRecovery(), () => recovery.clearRecovery(), () => recovery.holdRecoveryForLater(),
        () => recovery.saveRecovery(recovery.fullRecoverySave('nieuw', [{ id: 'nieuw', ifc: 'nieuwe bron',
          filePath: null, isDirty: true, datesAsRecorded: false }])),
      ]) {
        try { await action(); errors.push('onverwacht geslaagd'); }
        catch (error) { errors.push(error instanceof Error ? error.name : 'ongetypeerde fout'); }
      }
      return errors;
    });
    expect(await refusedOperations()).toEqual(Array(4).fill('IndexedDbUpgradeBlockedError'));
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 500));
    expect(await page.evaluate(() => window.__OPS__!.store.getState().selectedTaskIds)).toEqual([]);
    const addTask = page.locator('button[data-ops-ribbon-item="addTask"]');
    await expect(addTask).toHaveAccessibleName('New task at the bottom of the list');
    await addTask.click();
    await page.clock.runFor(10_000);
    await expect(warning).toBeVisible(); // error-melding verloopt niet zoals een info-toast
    expect(await blockedBytes()).toBe(before);
    await blocker.evaluate(() => {
      const db: unknown = Reflect.get(window, '__blockedRecoveryDb');
      if (!(db instanceof IDBDatabase)) throw new Error('Blokkadeverbinding ontbreekt.');
      db.close();
    });
    await expect.poll(openEvents).toEqual(['blocked', 'upgradeneeded', 'error']);
    expect((await readRecoveryDb(page, 'Fundering')).version).toBe(2); // late upgrade is afgebroken
    expect(await refusedOperations()).toEqual(Array(4).fill('IndexedDbUpgradeBlockedError'));
    await addTask.click();
    await page.clock.runFor(10_000);
    expect(await recoveryBytes()).toBe(before);
    expect(await page.evaluate(() => window.__OPS__!.store.getState().ui.notifications
      .filter(n => n.messageKey === 'notifications.recoveryStorageBlocked').map(n => n.count))).toEqual([1]);
    await warning.locator('[data-ops-toast-close]').click();
    await addTask.click();
    await page.clock.runFor(10_000);
    await expect(warning).toHaveCount(0);
    expect(await recoveryBytes()).toBe(before);
    expect(await openEvents()).toEqual(['blocked', 'upgradeneeded', 'error']);
    expect(await page.evaluate(() => {
      const state = window.__OPS__!.store.getState();
      return { tasks: state.tasks.length, filePath: state.filePath, siteFileId: state.siteFileId,
        documents: state.documents.length, session: sessionStorage.getItem('ops-recovery-session') };
    })).toEqual({ tasks: 3, filePath: null, siteFileId: null, documents: 1, session: 'blocked-upgrade' });
    await page.clock.resume();
    // Alleen een nieuwe paginastart probeert opnieuw; gezond v2-herstel en de v3-index blijven werken.
    page.once('dialog', dialog => { void dialog.accept(); });
    await page.reload();
    await waitForOps(page);
    await acceptRecovery(page);
    expect((await readRecoveryDb(page, 'Fundering')).version).toBe(3);
    expect((await openDocuments(page)).flatMap(doc => doc.tasks)).toEqual(['Fundering']);
    await expect(page.getByRole('alert').filter({ hasText: 'Recovery storage is temporarily blocked' })).toHaveCount(0);
  } finally {
    await blocker.close();
  }

});
