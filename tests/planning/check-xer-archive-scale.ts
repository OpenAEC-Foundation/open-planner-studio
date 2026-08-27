// X9 reviewronde 1 — relatieve schaalproef op 1/8/32 decoded chunks, zonder tijdsdrempel.
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import type { XerImportMetadata } from '@/services/importTypes';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import {
  createEmptyXerArchiveDiagnostics,
  createEmptyXerArchiveDocumentView,
  createEmptyXerArchiveReadModel,
  createXerSourceArchive,
  decodeXerSourceArchive,
  sha256Hex,
  XER_SOURCE_ARCHIVE_CHUNK_BYTES,
} from '@/services/xerSourceArchive';
import { createDefaultProject } from '@/state/defaults';

declare const process: { exit(code: number): never; memoryUsage(): { heapUsed: number } };
const failures: string[] = [];
let checks = 0;
const expect = (label: string, condition: boolean) => {
  checks += 1;
  if (!condition) failures.push(label);
};
const project = createDefaultProject();
const calendar = createDefaultCalendar();
project.id = 'x9-scale';
project.calendarId = calendar.id;
const xer = createEmptyXerArchiveDocumentView('P-SCALE');

const measurements = [1, 8, 32].map(chunkCount => {
  const bytes = new Uint8Array(chunkCount * XER_SOURCE_ARCHIVE_CHUNK_BYTES);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 17 + chunkCount) % 251;
  const diagnostics = {
    ...createEmptyXerArchiveDiagnostics(),
    documentViews: { 'P-SCALE': xer },
  };
  const readModel = createEmptyXerArchiveReadModel();
  const { resources: resourceView, ...documentFields } = xer;
  const documentMetadata: XerImportMetadata = {
    ...documentFields,
    ...(resourceView
      ? { resources: { ...resourceView, catalog: readModel.resourceCatalog } }
      : {}),
    metadata: { catalog: readModel.metadataCatalog },
  };
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  const archive = createXerSourceArchive(bytes, {
    encoding: 'windows-1252', bom: 'none', newline: 'crlf', diagnostics,
    readModel,
  });
  const ifc = writeIFC({
    project, calendar, tasks: [], sequences: [], resources: [], assignments: [],
    xerSourceArchive: archive, xer: documentMetadata,
  });
  const read = readIFC(ifc);
  const elapsedMs = performance.now() - started;
  const heapDelta = process.memoryUsage().heapUsed - heapBefore;
  expect(`${chunkCount} chunks: count en decoded byteLength zijn exact`,
    archive.byteChunks.length === chunkCount
    && read.xerSourceArchive?.byteChunks.length === chunkCount
    && read.xerSourceArchive?.byteLength === bytes.length);
  expect(`${chunkCount} chunks: SHA en gedecodeerde bytes blijven exact`,
    read.xerSourceArchive !== undefined
    && sha256Hex(decodeXerSourceArchive(read.xerSourceArchive)) === sha256Hex(bytes));
  expect(`${chunkCount} chunks: heap- en tijdmeting zijn eindige observaties`,
    Number.isFinite(heapDelta) && Number.isFinite(elapsedMs) && elapsedMs >= 0);
  return { chunkCount, sourceBytes: bytes.length, ifcChars: ifc.length, elapsedMs, heapDelta };
});

expect('relatieve IFC-omvang groeit mee van 1 naar 8 naar 32 chunks',
  measurements[1]!.ifcChars > measurements[0]!.ifcChars * 6
  && measurements[2]!.ifcChars > measurements[1]!.ifcChars * 3);
console.log(`X9 archive scale: ${measurements.map(item =>
  `${item.chunkCount}c source=${item.sourceBytes} ifc=${item.ifcChars} time=${item.elapsedMs.toFixed(1)}ms heap=${item.heapDelta}`
).join(' | ')}`);

if (failures.length === 0) {
  console.log(`OK  xer-archive-scale: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-archive-scale: ${failures.length} afwijking(en) van ${checks}`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
