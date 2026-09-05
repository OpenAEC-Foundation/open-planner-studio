// X9 — één archive-ref door documenttabs, duplicate, undo/redo en recovery.
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { readFileSync } from 'node:fs';
import {
  createEmptyXerArchiveDiagnostics,
  createEmptyXerArchiveReadModel,
  createXerSourceArchive,
  decodeXerSourceArchive,
  sha256Hex,
  withXerArchiveDocumentView,
  XER_SOURCE_ARCHIVE_CHUNK_BYTES,
} from '@/services/xerSourceArchive';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { useAppStore } from '@/state/appStore';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultProject } from '@/state/defaults';
import { isMultiDocumentImport } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { clearRecovery, fullRecoverySave, loadRecovery, saveRecovery } from '@/services/recovery/recoveryStore';

declare const process: {
  exit(code: number): never;
  resourceUsage(): { maxRSS: number };
};

const failures: string[] = [];
let checks = 0;
const expect = (label: string, condition: boolean) => {
  checks += 1;
  if (!condition) failures.push(label);
};
const store = () => useAppStore.getState();

// Browser-API is de enige niet-headless rand. Deze minimale IDB-dubbel bewaart echte records en
// transacties; saveRecovery/loadRecovery/clearRecovery zelf draaien ongewijzigd door hun publieke grens.
const idbRecords = new Map<string, unknown>();
const fakeDb = {
  objectStoreNames: { contains: () => true },
  createObjectStore: () => undefined,
  close: () => undefined,
  onversionchange: null as (() => void) | null,
  transaction: (_store: string, _mode: string) => {
    const tx = {
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      error: null,
      objectStore: () => ({
        getAll: () => {
          const request = { result: [] as unknown[], error: null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
          queueMicrotask(() => { request.result = [...idbRecords.values()]; request.onsuccess?.(); });
          return request;
        },
        put: (value: { id: string }) => {
          idbRecords.set(value.id, structuredClone(value));
          queueMicrotask(() => tx.oncomplete?.());
        },
        delete: (id: string) => {
          idbRecords.delete(id);
          queueMicrotask(() => tx.oncomplete?.());
        },
      }),
    };
    return tx;
  },
};
const fakeIndexedDb = {
  open: () => {
    const request = {
      result: fakeDb,
      error: null,
      onupgradeneeded: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess?.(); });
    return request;
  },
};
(globalThis as unknown as { window: object }).window = {};
(globalThis as unknown as { indexedDB: unknown }).indexedDB = fakeIndexedDb;

const bytes = new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP-X9\tX9 lifecycle\tC\t2032-01-05 08:00',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC\tStandaard\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code',
  '%R\tT-X9\tP-X9\tX9-1\tX9 taak\tC\t2032-01-05 08:00\t2032-01-05 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart',
  '%T\tUNKNOWN',
  '%F\tpayload',
  `%R\t${'x'.repeat(XER_SOURCE_ARCHIVE_CHUNK_BYTES * 3 + 17)}`,
  '%E',
].join('\r\n'));
const opened = readXER(bytes);
if (isMultiDocumentImport(opened) || !opened.xerSourceArchive) {
  throw new Error('X9-lifecyclefixture moet één geldig XER-bronarchief opleveren');
}
const sourceArchive = opened.xerSourceArchive;
const baseArchive = createXerSourceArchive(bytes, {
  encoding: sourceArchive.encoding,
  bom: sourceArchive.bom,
  newline: sourceArchive.newline,
  diagnostics: { ...sourceArchive.diagnostics, opaqueExtensions: { fixture: { typed: true } } },
  readModel: sourceArchive.readModel,
});
const project = createDefaultProject();
project.id = 'x9-lifecycle'; project.name = 'X9 lifecycle';
const calendar = createDefaultCalendar();
project.calendarId = calendar.id;
const xer = {
  sourceProjectId: 'P-X9',
  defaultCurrencyCode: 'EUR',
  tableReport: { encoding: 'windows-1252' as const, endMarkerSeen: true, issues: [], unknownTables: [] },
  calendarIssues: [], enumFallbacks: [],
  scheduleOptions: { source: 'xer-defaults' as const, retainedSource: {}, fallbacks: [], diagnostics: [], sourceArchive: { rows: [], unmatchedScheduleOptionsRowIndexes: [], diagnostics: [] }, sourceRowIndexes: [], sourceRows: [] },
  externalRelations: [], externalLinks: [],
  report: { projectsSeen: 1, documentsOpened: 1, emptyProjectsSkipped: 0, baselineProjectsExcluded: 0, baselinesMaterialized: 0, danglingBaselineReferences: 0, externalLinksPreserved: 0, baselineExclusionReverted: false, baselineFallbackReasons: [] },
};
const archive = withXerArchiveDocumentView(baseArchive, xer);

store().newProject();
store().applyOpenedImport({
  project, calendar,
  tasks: [{ id: 'x9-task', name: 'X9 taak', parentId: null, childIds: [], time: createDefaultTaskTime('2032-01-05', 1) } as unknown as Task],
  sequences: [], resources: [], assignments: [], xerSourceArchive: archive, xer,
}, { filePath: null, fileHandle: null, recompute: false, fit: false, hourDataNotice: false, linkedOpen: false });
for (let index = 0; index < 11; index += 1) store().duplicateDocument();
const twelve = store().getOpenDocumentPayloads();
store().duplicateDocument();
const thirteen = store().getOpenDocumentPayloads();
expect('1 twaalf documenten plus een duplicate zijn geopend', twelve.length === 12 && thirteen.length === 13);
expect('2 alle tabs delen exact één archiefobject', new Set(thirteen.map(doc => doc.payload.xerSourceArchive)).size === 1);
expect('3 ook de base64-chunkarray is één gedeelde ref', thirteen.every(doc => doc.payload.xerSourceArchive?.byteChunks === archive.byteChunks));
expect('3a documentcontract houdt de gedeelde archive-ref expliciet buiten undo-snapshots',
  readFileSync(new URL('../../src/state/documentContract.ts', import.meta.url), 'utf8')
    .includes("field({ key: 'xerSourceArchive', get: (s) => s.xerSourceArchive, set: (s, v) => { s.xerSourceArchive = v; }, fresh: () => null, snapshot: 'none'"));

for (let index = 0; index < 100; index += 1) store().setProject({ description: `wijziging-${index}` });
for (let index = 0; index < 100; index += 1) store().undo();
expect('4 honderd undo-stappen veranderen de snapshot-none archive-ref niet',
  store().xerSourceArchive === archive && store().project.description !== 'wijziging-99');
store().redo();
expect('5 redo verandert evenmin de archive-ref', store().xerSourceArchive === archive);

const serializedSnapshots = thirteen.map(doc => writeIFC(buildWriteIFCInput(doc.payload)));
await clearRecovery();
await saveRecovery(fullRecoverySave(thirteen[0]!.id, thirteen.map((doc, index) => ({
  id: doc.id,
  ifc: serializedSnapshots[index]!,
  filePath: null,
  isDirty: true,
}))));
const loadedRecovery = await loadRecovery();
expect('5a publieke headless recovery-backend bewaart alle zelfstandige IFC-snapshots',
  loadedRecovery.docs.length === 13 && loadedRecovery.activeDocumentId === thirteen[0]!.id);
const parsedSnapshots = loadedRecovery.docs.map(doc => readIFC(doc.ifc));
const snapshots = parsedSnapshots.map((parsed, index) => {
  return recoveryInputFromParsed(parsed, { id: loadedRecovery.docs[index]!.id, filePath: null, isDirty: true });
});
store().restoreDocuments(snapshots, snapshots[0]!.id);
const recovered = store().getOpenDocumentPayloads();
const recoveredArchives = recovered.map(doc => doc.payload.xerSourceArchive).filter((value): value is NonNullable<typeof value> => value !== null);
expect('6 recovery dedupliceert zelfstandige IFC-archieven tot één runtimeobject', new Set(recoveredArchives).size === 1);
expect('7 recovery behoudt byte-identieke bron, hash en éénzelfde bronafgeleide diagnosticsgraaf',
  recoveredArchives.length === 13
  && sha256Hex(decodeXerSourceArchive(recoveredArchives[0]!)) === sha256Hex(bytes)
  && parsedSnapshots.every(parsed => JSON.stringify(parsed.xerSourceArchive?.diagnostics) === JSON.stringify(parsedSnapshots[0]!.xerSourceArchive?.diagnostics)));
await clearRecovery();
expect('7a publieke recovery-cleargrens verwijdert de headless records', (await loadRecovery()).docs.length === 0);
const peakRssKiB = process.resourceUsage().maxRSS;
expect('8 OS-gemeten peak RSS is beschikbaar zonder tijdsdrempel', Number.isFinite(peakRssKiB) && peakRssKiB > 0);
console.log(`X9 archive lifecycle: peak-rss=${peakRssKiB}KiB; unique-runtime-archives=${new Set(recoveredArchives).size}`);

const collisionArchive = withXerArchiveDocumentView(createXerSourceArchive(bytes, {
  encoding: archive.encoding,
  bom: archive.bom,
  newline: archive.newline,
  diagnostics: { ...createEmptyXerArchiveDiagnostics(), opaqueExtensions: { fixture: { typed: false } } },
  readModel: createEmptyXerArchiveReadModel(),
}), xer);
expect('9 collisionfixture heeft bewust dezelfde snelle hash+lengtesleutel maar andere metadata',
  collisionArchive.sha256 === archive.sha256
  && collisionArchive.byteLength === archive.byteLength
  && JSON.stringify(collisionArchive.diagnostics) !== JSON.stringify(archive.diagnostics));
store().restoreDocuments([
  { ...snapshots[0]!, id: 'collision-a', xerSourceArchive: archive },
  { ...snapshots[1]!, id: 'collision-b', xerSourceArchive: collisionArchive },
], 'collision-a');
const collisionDocs = store().getOpenDocumentPayloads();
expect('10 recovery deelt een hash+lengte-hit pas na inhoudelijke manifest/chunk/metadatavergelijking',
  collisionDocs[0]?.payload.xerSourceArchive !== collisionDocs[1]?.payload.xerSourceArchive);

if (failures.length === 0) {
  console.log(`OK  xer-source-archive-lifecycle: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-source-archive-lifecycle: ${failures.length} afwijking(en)`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
