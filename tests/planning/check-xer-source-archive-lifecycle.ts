// X9 — één archive-ref door documenttabs, duplicate, undo/redo en recovery.
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { readFileSync } from 'node:fs';
import { createXerSourceArchive, decodeXerSourceArchive, sha256Hex, XER_SOURCE_ARCHIVE_CHUNK_BYTES } from '@/services/xerSourceArchive';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { useAppStore } from '@/state/appStore';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultProject } from '@/state/defaults';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

declare const process: {
  exit(code: number): never;
  memoryUsage(): { heapUsed: number };
};

const failures: string[] = [];
let checks = 0;
const expect = (label: string, condition: boolean) => {
  checks += 1;
  if (!condition) failures.push(label);
};
const store = () => useAppStore.getState();

const heapBefore = process.memoryUsage().heapUsed;
const bytes = new Uint8Array(XER_SOURCE_ARCHIVE_CHUNK_BYTES * 3 + 17);
for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
const archive = createXerSourceArchive(bytes, {
  encoding: 'windows-1252', bom: 'none', newline: 'crlf',
  diagnostics: { typed: { tableReport: { issues: [{ code: 'XER_ROW_FIELD_COUNT_MISMATCH' }] } } },
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

const parsedSnapshots = thirteen.map(doc => readIFC(writeIFC(buildWriteIFCInput(doc.payload))));
const snapshots = parsedSnapshots.map((parsed, index) => {
  return recoveryInputFromParsed(parsed, { id: `recovered-${index}`, filePath: null, isDirty: true });
});
store().restoreDocuments(snapshots, snapshots[0]!.id);
const recovered = store().getOpenDocumentPayloads();
const recoveredArchives = recovered.map(doc => doc.payload.xerSourceArchive).filter((value): value is NonNullable<typeof value> => value !== null);
expect('6 recovery dedupliceert zelfstandige IFC-archieven tot één runtimeobject', new Set(recoveredArchives).size === 1);
expect('7 recovery behoudt byte-identieke bron, hash en typed diagnostics',
  recoveredArchives.length === 13
  && sha256Hex(decodeXerSourceArchive(recoveredArchives[0]!)) === sha256Hex(bytes)
  && JSON.stringify(recoveredArchives[0]!.diagnostics) === JSON.stringify(parsedSnapshots[0]!.xerSourceArchive?.diagnostics)
  && parsedSnapshots.every(parsed => JSON.stringify(parsed.xerSourceArchive?.diagnostics) === JSON.stringify(parsedSnapshots[0]!.xerSourceArchive?.diagnostics)));
const heapAfter = process.memoryUsage().heapUsed;
expect('8 heapmeting is beschikbaar zonder tijdsdrempel', Number.isFinite(heapBefore) && Number.isFinite(heapAfter));
console.log(`X9 archive lifecycle: heap-delta=${heapAfter - heapBefore} bytes; unique-runtime-archives=${new Set(recoveredArchives).size}`);

if (failures.length === 0) {
  console.log(`OK  xer-source-archive-lifecycle: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-source-archive-lifecycle: ${failures.length} afwijking(en)`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
