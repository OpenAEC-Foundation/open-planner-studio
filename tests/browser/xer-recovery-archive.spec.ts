// Crashherstel met het XER-bronarchief "één keer geschreven" (eigenaarsbesluit plan (9); ontwerp
// `docs/superpowers/plans/2026-10-07-xer-archief-eenmalig.md`). ECHTE IndexedDB en echte
// gebruikershandelingen: een .xer met twee projecten via de ribbonknop Openen en de bestandskiezer, een
// taaknaam wijzigen in de tabel, herladen, en Herstellen in het herstelvenster. `window.__OPS__` en
// IndexedDB worden alleen GELEZEN. Het tweede geval zet vóór de app-start een oude (v1) database met
// een snapshot waarin het archief nog ingebed zit — zoals een vorige versie hem achterliet — en bewijst
// dat de upgrade naar v2 die snapshot nog herstelt.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures/ops';

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
    version: 2, blobs: 1, snapshotHasName: true,
  });
  const db = await readRecoveryDb(page, RENAMED);
  expect(db.stores.sort()).toEqual(['records', 'xer-archives']);
  expect(db.manifestRefs).toHaveLength(2);
  expect(new Set(db.manifestRefs)).toEqual(new Set([opened[0]!.archiveSha]));

  // (4) Herladen, zoals na een crash; (5) herstellen via het echte herstelvenster.
  await page.evaluate(() => localStorage.setItem('ops-welcomeSeen', 'true'));
  page.on('dialog', d => { void d.accept(); });
  await page.reload();
  await acceptRecovery(page);

  // (6) Beide documenten zijn terug, mét het gedeelde archief en zonder archiefmelding; de wijziging ook.
  await expect.poll(() => openDocuments(page).then(docs => docs.length)).toBe(2);
  const restored = await openDocuments(page);
  expect(restored.map(doc => doc.archiveSha)).toEqual([opened[0]!.archiveSha, opened[0]!.archiveSha]);
  expect(restored.map(doc => doc.archiveIssue)).toEqual([null, null]);
  expect(restored.map(doc => doc.sourceProjectId).sort()).toEqual(['P1', 'P2']);
  expect(restored.flatMap(doc => doc.tasks)).toContain(RENAMED);
});

test('crashherstel: een oude v1-database met ingebed archief wordt na de upgrade nog hersteld', async ({ page, ops: _ops }) => {
  test.setTimeout(90_000);
  // Fixture, vóór de app-start: de app is door de `ops`-fixture al geladen en heeft `ops-recovery` op v2
  // gezet. Daarom eerst weg van de app naar een statisch bestand, de database wissen, en daar een v1-
  // database neerzetten met de snapshot die een vorige versie schreef: IFC met INGEBED archief (schema 2),
  // gemaakt met de eigen lezer/writer via de dev-server. Daarna pas de app openen.
  await page.goto('/icon.png');
  const sessionId = 'oude-sessie-v1';
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
        store.put({
          id: `${sid}::manifest`, kind: 'manifest', sessionId: sid, version: 4, activeDocumentId: 'doc-oud',
          documents: [{ id: 'doc-oud', ifc: `${sid}::doc::doc-oud`, filePath: null, isDirty: true, datesAsRecorded: false }],
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
  await acceptRecovery(page);
  await expect.poll(() => openDocuments(page).then(docs => docs.length)).toBe(1);
  const [restored] = await openDocuments(page);
  expect(restored!.project).toContain('HerstelAlfa');
  expect(restored!.archiveSha).toMatch(/^[0-9a-f]{64}$/);
  expect(restored!.archiveIssue).toBeNull();
  expect(restored!.sourceProjectId).toBe('P1');
  // De database is geüpgraded naar v2 met de archiefstore ernaast.
  const db = await readRecoveryDb(page, 'Fundering');
  expect(db.version).toBe(2);
  expect(db.stores.sort()).toEqual(['records', 'xer-archives']);
});
