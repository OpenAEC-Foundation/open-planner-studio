// X9 reviewronde 1 — relatieve schaalproef op 1/8/32 decoded chunks, zonder tijdsdrempel.
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import {
  decodeXerSourceArchive,
  sha256Hex,
  XER_SOURCE_ARCHIVE_CHUNK_BYTES,
} from '@/services/xerSourceArchive';
import { isMultiDocumentImport } from '@/services/importTypes';
import { readXER } from '@/services/xer/xerReader';

declare const process: { exit(code: number): never; resourceUsage(): { maxRSS: number } };
const failures: string[] = [];
let checks = 0;
const expect = (label: string, condition: boolean) => {
  checks += 1;
  if (!condition) failures.push(label);
};
const measurements = [1, 8, 32].map(chunkCount => {
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
    '%R\tP-SCALE\tSchaal\tC\t2026-08-01 08:00',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC\tStandaard\t8\t40\t',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\ttask_code\ttask_name\tclndr_id\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\ttask_type\tduration_type\tstatus_code',
    '%R\tT-SCALE\tP-SCALE\tS-1\tSchaaltaak\tC\t2026-08-01 08:00\t2026-08-01 16:00\t8\tTT_Task\tDT_FixedDUR2\tTK_NotStart',
    '%T\tUNKNOWN',
    '%F\tpayload',
    `%R\t${'x'.repeat(chunkCount * XER_SOURCE_ARCHIVE_CHUNK_BYTES)}`,
    '%E',
  ].join('\r\n'));
  const opened = readXER(bytes);
  if (isMultiDocumentImport(opened) || !opened.xerSourceArchive) {
    throw new Error('Schaalfixture moet één geldig XER-bronarchief opleveren');
  }
  const started = performance.now();
  const archive = opened.xerSourceArchive;
  const ifc = writeIFC(opened);
  const read = readIFC(ifc);
  const elapsedMs = performance.now() - started;
  // Deze afzonderlijke check draait in een vers Node-proces. maxRSS is dus de OS-gemeten piek
  // van de volledige round-trip, niet een eindstand of een misleidende heapdelta.
  const peakRssKiB = process.resourceUsage().maxRSS;
  expect(`${chunkCount} chunks: count en decoded byteLength zijn exact`,
    archive.byteChunks.length >= chunkCount
    && read.xerSourceArchive?.byteChunks.length === archive.byteChunks.length
    && read.xerSourceArchive?.byteLength === bytes.length);
  expect(`${chunkCount} chunks: SHA en gedecodeerde bytes blijven exact`,
    read.xerSourceArchive !== undefined
    && sha256Hex(decodeXerSourceArchive(read.xerSourceArchive)) === sha256Hex(bytes));
  expect(`${chunkCount} chunks: echte tijd en OS-gemeten peak RSS zijn eindige observaties`,
    Number.isFinite(peakRssKiB) && peakRssKiB > 0 && Number.isFinite(elapsedMs) && elapsedMs >= 0);
  return { chunkCount, sourceBytes: bytes.length, ifcChars: ifc.length, elapsedMs, peakRssKiB };
});

expect('relatieve IFC-omvang groeit mee van 1 naar 8 naar 32 chunks',
  measurements[1]!.ifcChars > measurements[0]!.ifcChars * 6
  && measurements[2]!.ifcChars > measurements[1]!.ifcChars * 3);
console.log(`X9 archive scale: ${measurements.map(item =>
  `${item.chunkCount}c source=${item.sourceBytes} ifc=${item.ifcChars} time=${item.elapsedMs.toFixed(1)}ms peak-rss=${item.peakRssKiB}KiB`
).join(' | ')}`);

if (failures.length === 0) {
  console.log(`OK  xer-archive-scale: alle checks groen (${checks})`);
  process.exit(0);
}
console.log(`XX  xer-archive-scale: ${failures.length} afwijking(en) van ${checks}`);
for (const failure of failures) console.log(`   - ${failure}`);
process.exit(1);
