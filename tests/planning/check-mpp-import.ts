// Bron: MPXJ `PropsKey`, `FieldMap14` en `MPPUtility` als referentie voor de fixtures, en de MPXJ-junit-testbestanden voor de crawlcases (LGPL-2.1, github.com/joniles/mpxj).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CfbFile } from '@/services/mpp/cfb';
import { detectMppVariant, assertReadable, Props } from '@/services/mpp/mppContainer';
import {
  FixedMeta, FixedData, VarMeta12, Var2Data,
  getUnicodeString, getTimestamp, getGUID, getDuration, getDate, getTime, getDurationTimeUnits, getDouble,
  type MppTimeUnit,
} from '@/services/mpp/mppPrimitives';
import { MppUnsupportedError } from '@/services/mpp/errors';
import {
  SECTOR, HEADER,
  buildSyntheticCfb, buildDuplicateSiblingCfb, buildTwoRootStreamsCfb, buildNestedCfb,
  encodeCompObjFileFormat, encodePropsEntries, encodePropsSingleByteEntry,
  expectCfbError, expectMppError, bytesEqual, buildVarMetaBytes,
  buildCalFixedMetaBlob, buildCalFixedDataRecord, buildCalHoursBlock, concatBytes,
  type CfbTreeNode,
} from './mppFixtures';
import {
  readMPP, assignHierarchyAndWbs, clampOutlineLevel, MAX_OUTLINE_LEVEL,
  openMppProject, parseProjectProperties, readTasks, countScheduleNotes,
  buildAssignmentUidLinks, deriveSplitGapsForTasks, deriveTimephasedWindowsForTasks,
  deriveTimephasedContoursForTasks, mspTaskTypeFromRaw, decodeAssignmentWorkMinutes,
  type ReadTasksResult, type RawTaskScan,
} from '@/services/mpp/mppReader';
import { readCalendars, type CalendarReadResult } from '@/services/mpp/mppCalendars';
import { MAX_VAR_TEXT_BYTES, MAX_MANUAL_DURATION_TENTHS } from '@/services/mpp/limits';
import { formatInstant } from '@/utils/dateUtils';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { writeIFC, type WriteIFCInput } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { installDOMParser } from './xmldom-shim';
import type { Task, TaskSplitGap } from '@/types/task';
import type { Resource } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import {
  createTaskFieldMap, createResourceFieldMap, createAssignmentFieldMap,
  TaskFieldId, ResourceFieldId, AssignmentFieldId,
  fixedOffsetOf, fixed2OffsetOf, varDataKeyOf,
} from '@/services/mpp/fieldMap14';
import {
  decodeRegularTimephasedWork, decodeIrregularTimephasedWork, decodePlannedRegularTimephasedWork, hasAnyTimephasedData,
  deriveSplitGapsFromPeriods, deriveTaskSplitGaps, shiftPeriods,
  type TimephasedWorkPeriod, type TimephasedIrregularPeriod,
} from '@/services/mpp/mppTimephased';
import { readAssignmentTimephasedRaw } from '@/services/mpp/mppEntities';
import { solveProject } from '@/engine/scheduler/solveProject';
import { canonicalizeBands, promoteHourCalendar } from '@/services/subdayIo';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { opsSolveInput } from './legacySolveOptions';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { readMppCorpusEntry, resolveMppCrawlScopes } from './mppCorpus';

const crawlScopes = resolveMppCrawlScopes(process.env);

const diffs: string[] = [];
let checks = 0;
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};
let softChecksTotal = 0;

{
  let threw = false;
  let message = '';
  try {
    void new CfbFile(new Uint8Array(600));
  } catch (err) {
    threw = true;
    message = err instanceof Error ? err.message : String(err);
  }
  truthy('00 niet-CFB-bytes: constructor gooit', threw);
  truthy('00b niet-CFB-bytes: nette CFB-foutmelding', message.startsWith('CFB:'));
}

{
  const fullDayBands = canonicalizeBands({ 1: [{ start: 0, end: 1440 }], 2: [{ start: 0, end: 1440 }] });
  truthy(
    '[Z8 instrumentfix 1] volledige-dag-band (0..1440) ⇒ deviates === true (was false vóór de (b2)-fix)',
    fullDayBands.deviates === true,
  );
  truthy(
    '[Z8 instrumentfix 1] bandinhoud blijft ongewijzigd (0..1440, geen dubbele/verlengde band)',
    fullDayBands.bands.byWeekday[1].length === 1
    && fullDayBands.bands.byWeekday[1][0].start === 0 && fullDayBands.bands.byWeekday[1][0].end === 1440,
  );

  const normalBands = canonicalizeBands({ 1: [{ start: 480, end: 960 }] });
  truthy(
    '[Z8 instrumentfix 1, regressie-guard] normale 8u-band (08:00-16:00) ⇒ deviates blijft false',
    normalBands.deviates === false,
  );

  const almostFullDay = canonicalizeBands({ 1: [{ start: 0, end: 1439 }] });
  truthy(
    '[Z8 instrumentfix 1, grensgeval] band van 1439 min (net onder een volledige dag) ⇒ deviates blijft false',
    almostFullDay.deviates === false,
  );

  const cal24: WorkCalendar = {
    id: 'cal-24h-test', name: '24 Hours', description: '',
    workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24, hoursPerDay: 8, holidays: [],
  };
  const promoted = promoteHourCalendar(cal24, { canonical: fullDayBands.bands, deviates: fullDayBands.deviates }, false, false);
  truthy('[Z8 instrumentfix 1, integratie] promoteHourCalendar retourneert true zonder taak-signaal', promoted === true);
  truthy('[Z8 instrumentfix 1, integratie] cal.workTime gezet', !!cal24.workTime);
  truthy(`[Z8 instrumentfix 1, integratie] cal.hoursPerDay afgeleid op 24 (kreeg ${cal24.hoursPerDay})`, cal24.hoursPerDay === 24);

  function oldDiscriminatorDeviates(start: number, end: number): boolean {
    let e = end;
    if (e <= start) e += 1440;
    return e > 1440;
  }
  truthy(
    '[Z8 instrumentfix 1, mutatiebewijs] de OUDE (a)/(b)-discriminator alleen zou deviates=false geven voor 0..1440 (bewijst dat (b2) de doorslag geeft)',
    oldDiscriminatorDeviates(0, 1440) === false,
  );
}

const synthetic = buildSyntheticCfb();

{
  const cfb = new CfbFile(synthetic.bytes);
  const entryA = cfb.root.children.get('StreamA') ?? null;
  const entryB = cfb.root.children.get('StreamB') ?? null;
  truthy('I2 StreamA-entry gevonden (mini-stream-pad, size<4096)', entryA?.size === 4095);
  truthy('I2 StreamB-entry gevonden (gewone-FAT-pad, size===4096)', entryB?.size === 4096);

  const gotA = cfb.getStream(['StreamA']);
  const gotB = cfb.getStream(['StreamB']);
  truthy('I2 StreamA: getStream(...).length === entry.size', gotA?.length === entryA?.size);
  truthy('I2 StreamB: getStream(...).length === entry.size', gotB?.length === entryB?.size);
  truthy('I2 StreamA: byte-exacte round-trip', !!gotA && bytesEqual(gotA, synthetic.streamA));
  truthy('I2 StreamB: byte-exacte round-trip', !!gotB && bytesEqual(gotB, synthetic.streamB));
}

const TIME_LIMIT_MS = 2000;

expectCfbError(truthy, 'I2 afgekapt bestand', () => {
  const truncated = synthetic.bytes.slice(0, HEADER + SECTOR / 2);
  void new CfbFile(truncated);
});

expectCfbError(truthy, 'I2 verkeerde sectorShift/version-combinatie', () => {
  const bad = new Uint8Array(synthetic.bytes);
  new DataView(bad.buffer).setUint16(30, 10, true);
  void new CfbFile(bad);
});

expectCfbError(truthy, 'I2 cyclische FAT', () => {
  const cyclic = new Uint8Array(synthetic.bytes);
  new DataView(cyclic.buffer).setUint32(HEADER + 1 * 4, 1, true);
  void new CfbFile(cyclic);
});

expectCfbError(truthy, 'I2 sectornummer buiten bereik', () => {
  const oor = new Uint8Array(synthetic.bytes);
  const dirOff = HEADER + 1 * SECTOR;
  new DataView(oor.buffer).setUint32(dirOff + 256 + 116, 999999, true);
  const cfb = new CfbFile(oor);
  void cfb.getStream(['StreamB']);
});

{
  const selfRef = new Uint8Array(synthetic.bytes);
  const view = new DataView(selfRef.buffer);
  const dirOff = HEADER + 1 * SECTOR;
  view.setUint32(dirOff + 256 + 72, 3, true);
  const e3 = dirOff + 384;
  view.setUint8(e3 + 66, 1);
  view.setUint32(e3 + 68, 0xffffffff, true);
  view.setUint32(e3 + 72, 0xffffffff, true);
  view.setUint32(e3 + 76, 3, true);

  const start = Date.now();
  let threw = false;
  let message = '';
  try {
    const cfb = new CfbFile(selfRef);
    void cfb.root;
  } catch (err) {
    threw = true;
    message = err instanceof Error ? err.message : String(err);
  }
  const elapsedMs = Date.now() - start;
  truthy(`I2 self-referencing directory-child: binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`, elapsedMs < TIME_LIMIT_MS);
  truthy('I2 self-referencing directory-child: geen crash buiten het CFB-contract', !threw || message.startsWith('CFB:'));
}

expectCfbError(truthy, 'I2 DIFAT-zelflus + vijandig grote numFatSectors', () => {
  const cyclicDifat = new Uint8Array(synthetic.bytes);
  const view = new DataView(cyclicDifat.buffer);
  view.setUint32(44, 0xffffffff, true);
  view.setUint32(68, 2, true);
  view.setUint32(72, 1, true);
  const difatSectorOff = HEADER + 2 * SECTOR;
  for (let i = 0; i < 127; i++) view.setUint32(difatSectorOff + i * 4, 0xffffffff, true);
  view.setUint32(difatSectorOff + 127 * 4, 2, true);
  void new CfbFile(cyclicDifat);
});

{
  const levels = 30;
  const dupBytes = buildDuplicateSiblingCfb(levels);
  const start = Date.now();
  let threw = false;
  let dupCount = 0;
  try {
    const cfb = new CfbFile(dupBytes);
    for (let i = 1; i <= levels; i++) {
      if (cfb.root.children.get(`Dup${i}`)) dupCount++;
    }
  } catch {
    threw = true;
  }
  const elapsedMs = Date.now() - start;
  truthy(
    `I2 duplicaat-siblings (${levels} niveaus, left===right): binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms) — betrapt een teruggedraaide gedeelde visited-set`,
    elapsedMs < TIME_LIMIT_MS,
  );
  truthy('I2 duplicaat-siblings: constructie slaagt zonder te gooien', !threw);
  truthy(`I2 duplicaat-siblings: alle ${levels} niveaus precies één keer in de boom`, dupCount === levels);
}

{
  let threw = false;
  let message = '';
  try {
    detectMppVariant(new CfbFile(synthetic.bytes));
  } catch (err) {
    threw = true;
    message = err instanceof Error ? err.message : String(err);
  }
  truthy('T4 CFB zonder \\x01CompObj: detectMppVariant gooit', threw);
  truthy('T4 CFB zonder \\x01CompObj: geen CFB:-prefix (MPP-laagfout, geen containerfout)', !message.startsWith('CFB:'));
  truthy('T4 CFB zonder \\x01CompObj: herkenbare boodschap', message === 'Not a recognised MS Project MPP file');
}

const MPP_PASSWORD_FLAG_KEY = 893386752;
const MPP_PROTECTION_PASSWORD_HASH_KEY = 893386756;

{
  const compObj = encodeCompObjFileFormat('MSProject.MPP14');
  const props14 = encodePropsSingleByteEntry(MPP_PASSWORD_FLAG_KEY, 0);
  const cfbBytes = buildTwoRootStreamsCfb('\x01CompObj', compObj, 'Props14', props14);
  const cfb = new CfbFile(cfbBytes);
  truthy('T4 synthetisch MPP14 (vlag=0): detectMppVariant === MPP14', detectMppVariant(cfb) === 'MPP14');
  let threw = false;
  let message = '';
  try {
    assertReadable(cfb);
  } catch (err) {
    threw = true;
    message = err instanceof Error ? err.message : String(err);
  }
  truthy('T4 synthetisch MPP14 (vlag=0): assertReadable gooit niet', !threw);
  if (threw) diffs.push(`T4 synthetisch MPP14 (vlag=0): onverwachte fout: ${message}`);
}

{
  const compObj = encodeCompObjFileFormat('MSProject.MPP14');
  const props14 = encodePropsSingleByteEntry(MPP_PASSWORD_FLAG_KEY, 1);
  const cfbBytes = buildTwoRootStreamsCfb('\x01CompObj', compObj, 'Props14', props14);
  let threw = false;
  let message = '';
  try {
    const cfb = new CfbFile(cfbBytes);
    assertReadable(cfb);
  } catch (err) {
    threw = true;
    message = err instanceof Error ? err.message : String(err);
  }
  truthy('T4 synthetisch MPP14 (vlag=1, geen hash): assertReadable gooit niet', !threw);
  if (threw) diffs.push(`T4 synthetisch MPP14 (vlag=1, geen hash): onverwachte fout: ${message}`);
}

{
  const compObj = encodeCompObjFileFormat('MSProject.MPP14');
  const props14 = encodePropsEntries([
    { key: MPP_PASSWORD_FLAG_KEY, data: Uint8Array.of(1) },
    { key: MPP_PROTECTION_PASSWORD_HASH_KEY, data: new Uint8Array(16).fill(0xab) },
  ]);
  const cfbBytes = buildTwoRootStreamsCfb('\x01CompObj', compObj, 'Props14', props14);
  const cfb = new CfbFile(cfbBytes);
  let threw = false;
  let isMppUnsupported = false;
  let mppCode: string | undefined;
  try {
    assertReadable(cfb);
  } catch (err) {
    threw = true;
    isMppUnsupported = err instanceof MppUnsupportedError;
    mppCode = err instanceof MppUnsupportedError ? err.mppCode : undefined;
  }
  truthy('T4 synthetisch MPP14 (vlag=1, hash aanwezig): assertReadable gooit', threw);
  truthy('T4 synthetisch MPP14 (vlag=1, hash aanwezig): gooit MppUnsupportedError', isMppUnsupported);
  truthy("T4 synthetisch MPP14 (vlag=1, hash aanwezig): mppCode === 'MPP_ENCRYPTED'", mppCode === 'MPP_ENCRYPTED');
}

{
  const compObj = encodeCompObjFileFormat('MSProject.MPP12');
  const props14 = encodePropsSingleByteEntry(MPP_PASSWORD_FLAG_KEY, 0);
  const cfbBytes = buildTwoRootStreamsCfb('\x01CompObj', compObj, 'Props14', props14);
  const cfb = new CfbFile(cfbBytes);
  truthy('T4 synthetisch MPP12: detectMppVariant === MPP12', detectMppVariant(cfb) === 'MPP12');
  let mppCode: string | undefined;
  try {
    assertReadable(cfb);
  } catch (err) {
    mppCode = err instanceof MppUnsupportedError ? err.mppCode : undefined;
  }
  truthy("T4 synthetisch MPP12: assertReadable weigert met mppCode 'MPP_LEGACY'", mppCode === 'MPP_LEGACY');
}

expectMppError(truthy, 'I5 Props-stream <16 bytes', () => {
  void new Props(new Uint8Array(10), 'te-kort');
});

{
  const bytes = new Uint8Array(16 + 12 + 4);
  const view = new DataView(bytes.buffer);
  view.setUint16(12, 5, true);
  view.setInt32(16, 4, true);
  view.setInt32(20, 424242, true);
  view.setInt32(24, 0, true);
  view.setInt32(28, 777, true);

  let threw = false;
  let props: Props | null = null;
  try {
    props = new Props(bytes, 'over-claimed-header');
  } catch {
    threw = true;
  }
  truthy('I5 Props-header claimt meer entries dan aanwezig: construeert zonder te gooien', !threw);
  truthy('I5 Props-header claimt meer entries dan aanwezig: de ene aanwezige entry is wél gelezen', props?.getInt(424242) === 777);
}

{
  const compObj = encodeCompObjFileFormat('MSProject.MPP14');
  const cfbBytes = buildTwoRootStreamsCfb('\x01CompObj', compObj, 'NotProps14', Uint8Array.of(1));
  const cfb = new CfbFile(cfbBytes);
  let threw = false;
  let message = '';
  let isMppUnsupported = false;
  try {
    assertReadable(cfb);
  } catch (err) {
    threw = true;
    message = err instanceof Error ? err.message : String(err);
    isMppUnsupported = err instanceof MppUnsupportedError;
  }
  truthy('I5 ontbrekende root-Props14: assertReadable gooit', threw);
  truthy('I5 ontbrekende root-Props14: geen MppUnsupportedError (structurele fout)', !isMppUnsupported);
  truthy('I5 ontbrekende root-Props14: nette MPP:-foutmelding', message.startsWith('MPP:'));
}

{
  const truncated = encodeCompObjFileFormat('MSProject.MPP14').slice(0, 30);
  const props14 = encodePropsSingleByteEntry(MPP_PASSWORD_FLAG_KEY, 0);
  const cfbBytes = buildTwoRootStreamsCfb('\x01CompObj', truncated, 'Props14', props14);
  const cfb = new CfbFile(cfbBytes);
  let threw = false;
  let message = '';
  try {
    detectMppVariant(cfb);
  } catch (err) {
    threw = true;
    message = err instanceof Error ? err.message : String(err);
  }
  truthy('I5 afgekapt CompObj: detectMppVariant gooit', threw);
  truthy("I5 afgekapt CompObj: 'Not a recognised MS Project MPP file'", message === 'Not a recognised MS Project MPP file');
}

const FIXED_META_MAGIC = 0xfadfadba;

function buildFixedMetaBytes(itemCountClaim: number, itemSize: number, numItems: number): Uint8Array {
  const out = new Uint8Array(16 + numItems * itemSize);
  const view = new DataView(out.buffer);
  view.setUint32(0, FIXED_META_MAGIC, true);
  view.setInt32(8, itemCountClaim, true);
  for (let i = 0; i < numItems; i++) {
    for (let b = 0; b < itemSize; b++) out[16 + i * itemSize + b] = i;
  }
  return out;
}

{
  const bytes = buildFixedMetaBytes(3, 8, 3);
  const fm = FixedMeta.withItemSize(bytes, 8, 'I4-valid3');
  truthy('I4 FixedMeta.withItemSize geldig blok: getAdjustedItemCount === 3', fm.getAdjustedItemCount() === 3);
  truthy('I4 FixedMeta.withItemSize geldig blok: item 0 correct', fm.getByteArrayValue(0)?.[0] === 0);
  truthy('I4 FixedMeta.withItemSize geldig blok: item 2 correct', fm.getByteArrayValue(2)?.[0] === 2);
  truthy('I4 FixedMeta.withItemSize geldig blok: index buiten bereik geeft null', fm.getByteArrayValue(3) === null);
}

expectMppError(truthy, 'I4 FixedMeta.withItemSize foute magic', () => {
  const bytes = buildFixedMetaBytes(1, 8, 1);
  new DataView(bytes.buffer).setUint32(0, 0x12345678, true);
  FixedMeta.withItemSize(bytes, 8, 'I4-bad-magic');
});

expectMppError(truthy, 'I4 FixedMeta.withItemSize te klein', () => {
  FixedMeta.withItemSize(new Uint8Array(10), 8, 'I4-too-small');
});

expectMppError(truthy, 'I4 FixedMeta.withItemSize itemSize=0', () => {
  FixedMeta.withItemSize(buildFixedMetaBytes(1, 8, 1), 0, 'I4-zero-itemsize');
});

{
  const bytes = buildFixedMetaBytes(1000, 8, 3);
  const fm = FixedMeta.withItemSize(bytes, 8, 'I4-lying-header');
  truthy('I4 FixedMeta.withItemSize liegende header: getAdjustedItemCount === 3', fm.getAdjustedItemCount() === 3);
  truthy('I4 FixedMeta.withItemSize liegende header: getItemCount() geklemd (=== getAdjustedItemCount)', fm.getItemCount() === fm.getAdjustedItemCount());
}

{
  const bytes = buildFixedMetaBytes(3, 10, 3);
  const otherBlock = FixedData.withoutMeta(1, new Uint8Array(3));
  const fm = FixedMeta.withHeuristicItemSize(bytes, otherBlock, [5, 10, 15], 'I4-heuristic-match');
  truthy('I4 FixedMeta.withHeuristicItemSize passende kandidaat: adjustedItemCount === 3 (itemSize=10 gekozen)', fm.getAdjustedItemCount() === 3);
}

{
  const bytes = buildFixedMetaBytes(3, 10, 3);
  const otherBlock = FixedData.withoutMeta(1, new Uint8Array(3));
  const fm = FixedMeta.withHeuristicItemSize(bytes, otherBlock, [7, 11, 13], 'I4-heuristic-fallback');
  truthy('I4 FixedMeta.withHeuristicItemSize geen kandidaat past: valt terug op itemSizes[0]=7 (adjustedItemCount=floor(30/7)=4)', fm.getAdjustedItemCount() === 4);
}

function buildVar2DataBytes(items: { offset: number; payload: Uint8Array }[], totalLength: number): Uint8Array {
  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer);
  for (const it of items) {
    view.setInt32(it.offset, it.payload.length, true);
    out.set(it.payload, it.offset + 4);
  }
  return out;
}

function int32Payload(value: number): Uint8Array {
  const p = new Uint8Array(4);
  new DataView(p.buffer).setInt32(0, value, true);
  return p;
}

{
  const entries = [
    { uniqueId: 100, type: 1, offset: 0 },
    { uniqueId: 100, type: 2, offset: 10 },
    { uniqueId: 200, type: 1, offset: 20 },
    { uniqueId: 200, type: 2, offset: 30 },
  ];
  const meta = new VarMeta12(buildVarMetaBytes(entries), 'I4-roundtrip');
  const var2Bytes = buildVar2DataBytes(
    entries.map((e) => ({ offset: e.offset, payload: int32Payload(e.uniqueId * 10 + e.type) })),
    40,
  );
  const var2 = new Var2Data(meta, var2Bytes);
  truthy('I4 VarMeta12+Var2Data round-trip: (100,1)', var2.getInt(100, 1) === 100 * 10 + 1);
  truthy('I4 VarMeta12+Var2Data round-trip: (100,2)', var2.getInt(100, 2) === 100 * 10 + 2);
  truthy('I4 VarMeta12+Var2Data round-trip: (200,1)', var2.getInt(200, 1) === 200 * 10 + 1);
  truthy('I4 VarMeta12+Var2Data round-trip: (200,2)', var2.getInt(200, 2) === 200 * 10 + 2);
  truthy('I4 VarMeta12+Var2Data round-trip: onbekend (id,type) ⇒ 0', var2.getInt(999, 1) === 0);
}

{
  const meta = new VarMeta12(buildVarMetaBytes([{ uniqueId: 1, type: 1, offset: 0 }]), 'I4-null-var2');
  const var2 = new Var2Data(meta, null);
  truthy('I4 Var2Data(meta, null): getByteArray ⇒ null', var2.getByteArray(1, 1) === null);
  truthy('I4 Var2Data(meta, null): getInt ⇒ 0', var2.getInt(1, 1) === 0);
  truthy('I4 Var2Data(meta, null): getUnicodeString ⇒ null', var2.getUnicodeString(1, 1) === null);
}

for (const claim of [0x7fffffff, -1, 10_000_000]) {
  const start = Date.now();
  let ok = true;
  let meta: VarMeta12 | null = null;
  try {
    const bytes = buildVarMetaBytes([], claim);
    meta = new VarMeta12(bytes, `I4-C1-claim-${claim}`);
  } catch {
    ok = false;
  }
  const elapsedMs = Date.now() - start;
  truthy(`I4 VarMeta12 C1 (itemCount-claim=${claim}): binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`, elapsedMs < TIME_LIMIT_MS);
  truthy(`I4 VarMeta12 C1 (itemCount-claim=${claim}): construeert zonder te gooien`, ok);
  truthy(`I4 VarMeta12 C1 (itemCount-claim=${claim}): getItemCount() geklemd op 0`, meta?.getItemCount() === 0);
}

{
  const n = 400_000;
  const data = new Uint8Array(n * 2 + 2);
  const view = new DataView(data.buffer);
  for (let i = 0; i < n; i++) view.setUint16(i * 2, 0x41 + (i % 26), true);
  const start = Date.now();
  const s = getUnicodeString(data, 0);
  const elapsedMs = Date.now() - start;
  truthy('I4 getUnicodeString(400k code-units): lengte klopt', s.length === n);
  truthy('I4 getUnicodeString(400k code-units): eerste teken klopt', s[0] === 'A');
  truthy('I4 getUnicodeString(400k code-units): laatste teken klopt', s[n - 1] === String.fromCharCode(0x41 + ((n - 1) % 26)));
  truthy(`I4 getUnicodeString(400k code-units): binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`, elapsedMs < TIME_LIMIT_MS);
}

function timestampBytes(time: number, days: number): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint16(0, time, true);
  view.setUint16(2, days, true);
  return out;
}

truthy('I4 getTimestamp: days=0 (≤1) ⇒ null', getTimestamp(timestampBytes(0, 0), 0) === null);
truthy('I4 getTimestamp: days=1 (≤1) ⇒ null', getTimestamp(timestampBytes(0, 1), 0) === null);
truthy('I4 getTimestamp: days=65535 (NA) ⇒ null', getTimestamp(timestampBytes(0, 65535), 0) === null);
truthy('I4 getTimestamp: days<100 mét niet-nul secondedeel ⇒ null', getTimestamp(timestampBytes(1, 50), 0) === null);
truthy('I4 getTimestamp: days<100 mét NUL secondedeel ⇒ geen null (geen overmatige NA-heuristiek)', getTimestamp(timestampBytes(10, 50), 0) !== null);
truthy('I4 getTimestamp: days≥100 met normale tijd ⇒ geldig resultaat', getTimestamp(timestampBytes(10, 200), 0) !== null);

{
  truthy('I4 getGUID: alles-nul ⇒ null', getGUID(new Uint8Array(16), 0) === null);
  const bytes = Uint8Array.of(0x04, 0x03, 0x02, 0x01, 0x06, 0x05, 0x08, 0x07, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10);
  truthy('I4 getGUID: bekende mixed-endian-waarde', getGUID(bytes, 0) === '01020304-0506-0708-090a-0b0c0d0e0f10');
}

{
  const cases: Array<[MppTimeUnit, number, number]> = [
    ['minutes', 100, 10],
    ['elapsedMinutes', 100, 10],
    ['hours', 6000, 10],
    ['elapsedHours', 6000, 10],
    ['days', 48000, 10],
    ['elapsedDays', 144000, 10],
    ['weeks', 240000, 10],
    ['elapsedWeeks', 1008000, 10],
    ['months', 960000, 10],
    ['elapsedMonths', 4320000, 10],
    ['percent', 55, 55],
    ['elapsedPercent', 55, 55],
  ];
  for (const [unit, value, expected] of cases) {
    truthy(`I4 getDuration(${value}, '${unit}') === ${expected}`, getDuration(value, unit) === expected);
  }
}

function buildOffsetOnlyFixedMetaBytes(offsets: number[], label: string): FixedMeta {
  const metaItemSize = 8;
  const out = new Uint8Array(16 + offsets.length * metaItemSize);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0xfadfadba, true);
  view.setInt32(8, offsets.length, true);
  for (let i = 0; i < offsets.length; i++) view.setInt32(16 + i * metaItemSize + 4, offsets[i], true);
  return FixedMeta.withItemSize(out, metaItemSize, label);
}

{
  const meta = buildOffsetOnlyFixedMetaBytes([0, 8, 8, 24, 32], 'I5-getIndexFromOffset-meta');
  const payload = new Uint8Array(40);
  for (let i = 0; i < payload.length; i++) payload[i] = i;
  const fd = FixedData.fromMeta(meta, payload, 0, 0, 'I5-getIndexFromOffset');

  truthy('I5 FixedData.getIndexFromOffset: item 1 is een null-slot (duplicaat-offset ⇒ itemSize 0)', fd.getByteArrayValue(1) === null);
  truthy('I5 FixedData.getIndexFromOffset(0) === 0', fd.getIndexFromOffset(0) === 0);
  truthy('I5 FixedData.getIndexFromOffset(8) === 2 (item 2 claimt de gedeelde offset, niet de null-slot item 1)', fd.getIndexFromOffset(8) === 2);
  truthy('I5 FixedData.getIndexFromOffset(24) === 3', fd.getIndexFromOffset(24) === 3);
  truthy('I5 FixedData.getIndexFromOffset(32) === 4 (laatste item)', fd.getIndexFromOffset(32) === 4);
  truthy('I5 FixedData.getIndexFromOffset(999) === -1 (onbekend)', fd.getIndexFromOffset(999) === -1);
}

{
  const meta = buildOffsetOnlyFixedMetaBytes([0, 6, 12], 'I5-withItemSizeOverride-meta');
  const payload = new Uint8Array(18);
  for (let i = 0; i < payload.length; i++) payload[i] = i;
  const fd = FixedData.withItemSizeOverride(meta, 6, payload, 'I5-withItemSizeOverride');
  truthy('I5 FixedData.withItemSizeOverride: 3 items', fd.getItemCount() === 3);
  truthy('I5 FixedData.withItemSizeOverride: item 0 begint op byte 0', fd.getByteArrayValue(0)?.[0] === 0);
  truthy('I5 FixedData.withItemSizeOverride: item 1 begint op byte 6', fd.getByteArrayValue(1)?.[0] === 6);
  truthy('I5 FixedData.withItemSizeOverride: item 2 lengte === itemSize (6), niet "rest van blok"', fd.getByteArrayValue(2)?.length === 6);
}

{
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, 1, true);
  const d = getDate(bytes, 0);
  truthy('I5 getDate(1 dag): jaar/maand/dag kloppen', !!d && d.getUTCFullYear() === 1984 && d.getUTCMonth() === 0 && d.getUTCDate() === 1);
  const na = new Uint8Array(2);
  new DataView(na.buffer).setUint16(0, 65535, true);
  truthy('I5 getDate(65535) ⇒ null (NA-sentinel)', getDate(na, 0) === null);
}

{
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, 600, true);
  truthy('I5 getTime(600) === 3600s (1 uur)', getTime(bytes, 0) === 3600);
  const overflow = new Uint8Array(2);
  new DataView(overflow.buffer).setUint16(0, 8640 + 10, true);
  truthy('I5 getTime: modulo-24u-vangnet houdt het resultaat binnen één dag', getTime(overflow, 0) < 86400);
}

{
  truthy("I5 getDurationTimeUnits(7) === 'days'", getDurationTimeUnits(7) === 'days');
  truthy(
    "I5 getDurationTimeUnits(21, 'weeks') === 'weeks' (projectstandaard-terugval)",
    getDurationTimeUnits(21, 'weeks') === 'weeks',
  );
  truthy("I5 getDurationTimeUnits(21) zonder terugval === 'days' (default)", getDurationTimeUnits(21) === 'days');
  truthy("I5 getDurationTimeUnits(9999) (onbekende code) === 'days' (default)", getDurationTimeUnits(9999) === 'days');
}

function buildFieldMapEntryBytes(entries: { typeValue: number; dataBlockOffset: number; category: number }[]): Uint8Array {
  const out = new Uint8Array(entries.length * 28);
  const view = new DataView(out.buffer);
  entries.forEach((e, i) => {
    const base = i * 28;
    view.setUint16(base + 4, e.dataBlockOffset, true);
    view.setInt32(base + 12, e.typeValue, true);
    view.setUint16(base + 20, e.category, true);
  });
  return out;
}

const PROPSKEY_TASK_FIELD_MAP = 131092;
const PROPSKEY_RESOURCE_FIELD_MAP = 131093;
const PROPSKEY_ASSIGNMENT_FIELD_MAP = 131095;

{
  const fieldMapBytes = buildFieldMapEntryBytes([
    { typeValue: TaskFieldId.UniqueId, dataBlockOffset: 99, category: 3 },
    { typeValue: TaskFieldId.Name, dataBlockOffset: 65535, category: 8 },
    { typeValue: 24, dataBlockOffset: 0, category: 0x0b },
  ]);
  const props = new Props(encodePropsEntries([{ key: PROPSKEY_TASK_FIELD_MAP, data: fieldMapBytes }]), 'I4-fieldmap-fixed-var-meta');
  const table = createTaskFieldMap(props);

  truthy('I4 parseFieldMapBytes: FIXED_DATA-entry correct doorgegeven', fixedOffsetOf(table, TaskFieldId.UniqueId) === 99);
  truthy('I4 parseFieldMapBytes: VAR_DATA-entry correct doorgegeven', varDataKeyOf(table, TaskFieldId.Name) === TaskFieldId.Name);
  truthy(
    'I4 parseFieldMapBytes: META_DATA-entry (24) NIET in de tabel (geen fixed, geen var — a6e05f17-regressie)',
    fixedOffsetOf(table, 24) === null && varDataKeyOf(table, 24) === null,
  );
  truthy(
    'I4/I3 fieldMap: veld niet in de aanwezige field-map-bytes ⇒ GEEN terugval op defaults (alles-of-niets)',
    fixedOffsetOf(table, TaskFieldId.OutlineLevel) === null,
  );
  truthy('I4/I3 veldkaart aanwezig: geen terugval voor vaste kosten', fixedOffsetOf(table, TaskFieldId.FixedCost) === null);
}
{
  const resFieldMapBytes = buildFieldMapEntryBytes([
    { typeValue: ResourceFieldId.UniqueId, dataBlockOffset: 5, category: 3 },
    { typeValue: ResourceFieldId.Name, dataBlockOffset: 65535, category: 8 },
  ]);
  const resProps = new Props(encodePropsEntries([{ key: PROPSKEY_RESOURCE_FIELD_MAP, data: resFieldMapBytes }]), 'I4-resource-fieldmap');
  const resTable = createResourceFieldMap(resProps);
  truthy('I4 createResourceFieldMap: FIXED_DATA-entry correct', fixedOffsetOf(resTable, ResourceFieldId.UniqueId) === 5);
  truthy('I4 createResourceFieldMap: VAR_DATA-entry correct', varDataKeyOf(resTable, ResourceFieldId.Name) === ResourceFieldId.Name);
  for (const field of [ResourceFieldId.StandardRate, ResourceFieldId.OvertimeRate, ResourceFieldId.CostPerUse]) {
    truthy(`I4/I3 veldkaart aanwezig: geen terugval voor tariefveld ${field}`, fixedOffsetOf(resTable, field) === null);
  }
}
{
  const asgFieldMapBytes = buildFieldMapEntryBytes([
    { typeValue: AssignmentFieldId.TaskUniqueId, dataBlockOffset: 12, category: 3 },
    { typeValue: AssignmentFieldId.ResourceUniqueId, dataBlockOffset: 16, category: 3 },
  ]);
  const asgProps = new Props(encodePropsEntries([{ key: PROPSKEY_ASSIGNMENT_FIELD_MAP, data: asgFieldMapBytes }]), 'I4-assignment-fieldmap');
  const asgTable = createAssignmentFieldMap(asgProps);
  truthy('I4 createAssignmentFieldMap: eerste FIXED_DATA-entry correct', fixedOffsetOf(asgTable, AssignmentFieldId.TaskUniqueId) === 12);
  truthy('I4 createAssignmentFieldMap: tweede FIXED_DATA-entry correct', fixedOffsetOf(asgTable, AssignmentFieldId.ResourceUniqueId) === 16);
}

{
  const props = new Props(encodePropsEntries([]), 'I4-missing-fieldmap-key');
  const table = createTaskFieldMap(props);
  truthy('I4/I3 fieldMap: ontbrekende sleutel ⇒ defaulttabel (UniqueId@0)', fixedOffsetOf(table, TaskFieldId.UniqueId) === 0);
  truthy('I4/I3 fieldMap: ontbrekende sleutel ⇒ defaulttabel (Id@4)', fixedOffsetOf(table, TaskFieldId.Id) === 4);
  truthy('I4/I3 fieldMap: ontbrekende sleutel ⇒ defaulttabel (OutlineLevel@40)', fixedOffsetOf(table, TaskFieldId.OutlineLevel) === 40);
  truthy('I4/I3 fieldMap: ontbrekende sleutel ⇒ defaulttabel (Name var@14)', varDataKeyOf(table, TaskFieldId.Name) === TaskFieldId.Name);
  truthy('I4/I3 fieldMap: ontbrekende sleutel ⇒ defaulttabel (Type@94)', fixedOffsetOf(table, TaskFieldId.Type) === 94);
  truthy('I4/I3 ontbrekende taakveldkaart: FixedCost@158', fixedOffsetOf(table, TaskFieldId.FixedCost) === 158);
  const resourceTable = createResourceFieldMap(props);
  truthy('I4/I3 ontbrekende resourceveldkaart: StandardRate@28', fixedOffsetOf(resourceTable, ResourceFieldId.StandardRate) === 28);
  truthy('I4/I3 ontbrekende resourceveldkaart: OvertimeRate@36', fixedOffsetOf(resourceTable, ResourceFieldId.OvertimeRate) === 36);
  truthy('I4/I3 ontbrekende resourceveldkaart: CostPerUse@84', fixedOffsetOf(resourceTable, ResourceFieldId.CostPerUse) === 84);
}

{
  truthy('C1 clampOutlineLevel(0) === 1', clampOutlineLevel(0) === 1);
  truthy('C1 clampOutlineLevel(1) === 1', clampOutlineLevel(1) === 1);
  truthy(`C1 clampOutlineLevel(${MAX_OUTLINE_LEVEL}) === ${MAX_OUTLINE_LEVEL}`, clampOutlineLevel(MAX_OUTLINE_LEVEL) === MAX_OUTLINE_LEVEL);
  truthy(`C1 clampOutlineLevel(${MAX_OUTLINE_LEVEL + 1}) === ${MAX_OUTLINE_LEVEL} (klem)`, clampOutlineLevel(MAX_OUTLINE_LEVEL + 1) === MAX_OUTLINE_LEVEL);
  truthy('C1 clampOutlineLevel(65535) === MAX_OUTLINE_LEVEL (klem)', clampOutlineLevel(65535) === MAX_OUTLINE_LEVEL);
}

{
  const N = 20_000;
  interface Fixture {
    outlineLevel: number;
    storedWbs: string | null;
    task: { id: string; parentId: string | null; childIds: string[]; wbsCode: string };
  }
  const entries: Fixture[] = [];
  for (let i = 0; i < N; i++) {
    entries.push({
      outlineLevel: clampOutlineLevel((i % (MAX_OUTLINE_LEVEL + 50)) + 1),
      storedWbs: null,
      task: { id: `t${i}`, parentId: null, childIds: [], wbsCode: '' },
    });
  }
  const start = Date.now();
  assignHierarchyAndWbs(entries);
  const elapsedMs = Date.now() - start;
  truthy(
    `C1 assignHierarchyAndWbs(${N} taken, cyclisch tot voorbij MAX_OUTLINE_LEVEL): binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`,
    elapsedMs < TIME_LIMIT_MS,
  );
  truthy(
    `C1 assignHierarchyAndWbs: wbsCode-segmentaantal blijft ≤ MAX_OUTLINE_LEVEL (${MAX_OUTLINE_LEVEL})`,
    entries.every((e) => e.task.wbsCode.split('.').length <= MAX_OUTLINE_LEVEL),
  );
  truthy('C1 assignHierarchyAndWbs: elke taak kreeg een wbsCode', entries.every((e) => e.task.wbsCode.length > 0));
}

{
  const charCount = 200_000;
  const payload = new Uint8Array(charCount * 2);
  for (let i = 0; i < charCount; i++) {
    payload[i * 2] = 0x41;
    payload[i * 2 + 1] = 0x00;
  }
  const meta = new VarMeta12(buildVarMetaBytes([{ uniqueId: 1, type: 1, offset: 0 }]), 'I1-large-string-meta');
  const var2Bytes = buildVar2DataBytes([{ offset: 0, payload }], payload.length + 4);
  const var2 = new Var2Data(meta, var2Bytes);

  const start = Date.now();
  const s = var2.getUnicodeString(1, 1, MAX_VAR_TEXT_BYTES, 'I1-large-string');
  const elapsedMs = Date.now() - start;
  truthy(
    `I1 Var2Data.getUnicodeString(maxLength=${MAX_VAR_TEXT_BYTES}) op een 400.000-byte gedeelde string: binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`,
    elapsedMs < TIME_LIMIT_MS,
  );
  truthy(
    `I1 Var2Data.getUnicodeString: resultaat begrensd op MAX_VAR_TEXT_BYTES/2 = ${MAX_VAR_TEXT_BYTES / 2} tekens`,
    s !== null && s.length === MAX_VAR_TEXT_BYTES / 2,
  );
}

{
  const posInf = new Uint8Array(8);
  new DataView(posInf.buffer).setFloat64(0, Infinity, true);
  const negInf = new Uint8Array(8);
  new DataView(negInf.buffer).setFloat64(0, -Infinity, true);
  const nanBytes = new Uint8Array(8);
  new DataView(nanBytes.buffer).setFloat64(0, NaN, true);
  const finite = new Uint8Array(8);
  new DataView(finite.buffer).setFloat64(0, 12345.5, true);

  truthy('I2 getDouble(+Infinity) === 0 (geen Infinity-lek)', getDouble(posInf, 0, 'I2-pos-inf') === 0);
  truthy('I2 getDouble(-Infinity) === 0', getDouble(negInf, 0, 'I2-neg-inf') === 0);
  truthy('I2 getDouble(NaN) === 0 (bestaand gedrag, niet geregresseerd)', getDouble(nanBytes, 0, 'I2-nan') === 0);
  truthy('I2 getDouble(eindige waarde) blijft ongewijzigd', getDouble(finite, 0, 'I2-finite') === 12345.5);
}

{
  const PASSWORD_FLAG_KEY = 893386752;
  const PROJECT_START_DATE_KEY = 37748738;
  const PROJECT_FINISH_DATE_KEY = 37748739;
  const MINUTES_PER_DAY_KEY = 37748765;
  const TITLE_KEY = 37748744;

  function encodeUnicodeStringAscii(s: string): Uint8Array {
    const out = new Uint8Array(s.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
    return out;
  }

  function buildTaskFixedDataRecord(opts: {
    uniqueId: number; id: number; outlineLevel: number;
    durationRaw?: number; startDays: number; finishDays: number; calendarUniqueId?: number;
  }): Uint8Array {
    const out = new Uint8Array(130);
    const view = new DataView(out.buffer);
    view.setInt32(0, opts.uniqueId, true);
    view.setInt32(4, opts.id, true);
    view.setInt16(40, opts.outlineLevel, true);
    view.setInt32(42, opts.durationRaw ?? 4800, true);
    view.setInt16(56, 0, true);
    view.setUint16(64, 0, true);
    view.setUint16(66, opts.startDays, true);
    view.setUint16(68, 0, true);
    view.setUint16(70, opts.finishDays, true);
    view.setInt32(118, opts.calendarUniqueId ?? -1, true);
    return out;
  }

  function buildTaskFixedMetaRecord(opts: { offsetIntoFixedData: number; milestone?: boolean }): Uint8Array {
    const out = new Uint8Array(47);
    const view = new DataView(out.buffer);
    view.setInt32(0, 0, true);
    view.setInt32(4, opts.offsetIntoFixedData, true);
    if (opts.milestone) view.setInt32(8, 0x20, true);
    return out;
  }

  function buildFixedMetaBlob(items: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(16 + items.length * 47);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0xfadfadba, true);
    view.setInt32(8, items.length, true);
    items.forEach((item, i) => out.set(item, 16 + i * 47));
    return out;
  }

  const dummy = buildTaskFixedMetaRecord({ offsetIntoFixedData: 0 });
  const metaRoot = buildTaskFixedMetaRecord({ offsetIntoFixedData: 0 });
  const metaClampDeep1 = buildTaskFixedMetaRecord({ offsetIntoFixedData: 130 });
  const metaClampDeep2 = buildTaskFixedMetaRecord({ offsetIntoFixedData: 260 });
  const metaChild1 = buildTaskFixedMetaRecord({ offsetIntoFixedData: 390 });
  const metaChild2 = buildTaskFixedMetaRecord({ offsetIntoFixedData: 520 });
  const metaGrandchild = buildTaskFixedMetaRecord({ offsetIntoFixedData: 650, milestone: true });
  const fixedMetaBlob = buildFixedMetaBlob([dummy, dummy, dummy, metaRoot, metaClampDeep1, metaClampDeep2, metaChild1, metaChild2, metaGrandchild]);

  const dataRoot = buildTaskFixedDataRecord({ uniqueId: 10, id: 1, outlineLevel: 1, startDays: 15000, finishDays: 15010 });
  const dataClampDeep1 = buildTaskFixedDataRecord({ uniqueId: 14, id: 2, outlineLevel: 300, startDays: 15000, finishDays: 15001 });
  const dataClampDeep2 = buildTaskFixedDataRecord({ uniqueId: 15, id: 3, outlineLevel: 400, startDays: 15000, finishDays: 15001 });
  const dataChild1 = buildTaskFixedDataRecord({ uniqueId: 11, id: 4, outlineLevel: 2, startDays: 15000, finishDays: 15002, calendarUniqueId: 5 });
  const dataChild2 = buildTaskFixedDataRecord({ uniqueId: 12, id: 5, outlineLevel: 2, startDays: 15003, finishDays: 15008 });
  const dataGrandchild = buildTaskFixedDataRecord({ uniqueId: 13, id: 6, outlineLevel: 3, durationRaw: 0, startDays: 15008, finishDays: 15008 });
  const fixedDataBlob = new Uint8Array(6 * 130);
  [dataRoot, dataClampDeep1, dataClampDeep2, dataChild1, dataChild2, dataGrandchild].forEach((rec, i) => fixedDataBlob.set(rec, i * 130));

  const varMetaBytes = buildVarMetaBytes([
    { uniqueId: 10, type: 14, offset: 0 },
    { uniqueId: 14, type: 14, offset: 20 },
    { uniqueId: 15, type: 14, offset: 50 },
    { uniqueId: 11, type: 14, offset: 80 },
    { uniqueId: 12, type: 14, offset: 100 },
    { uniqueId: 13, type: 14, offset: 120 },
  ]);
  const var2DataBuf = new Uint8Array(150);
  const var2View = new DataView(var2DataBuf.buffer);
  const writeVar2 = (offset: number, s: string) => {
    const payload = encodeUnicodeStringAscii(s);
    var2View.setInt32(offset, payload.length, true);
    var2DataBuf.set(payload, offset + 4);
  };
  writeVar2(0, 'Root');
  writeVar2(20, 'ClampDeep1');
  writeVar2(50, 'ClampDeep2');
  writeVar2(80, 'Child1');
  writeVar2(100, 'Child2');
  writeVar2(120, 'Grandchild');

  const projectPropsBytes = encodePropsEntries([
    { key: PROJECT_START_DATE_KEY, data: timestampBytes(0, 15000) },
    { key: PROJECT_FINISH_DATE_KEY, data: timestampBytes(0, 15010) },
    { key: MINUTES_PER_DAY_KEY, data: int32Payload(480) },
    { key: TITLE_KEY, data: encodeUnicodeStringAscii('Fixture Project') },
  ]);

  const tree: Record<string, CfbTreeNode> = {
    '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
    Props14: { data: encodePropsSingleByteEntry(PASSWORD_FLAG_KEY, 0) },
    '   114': {
      children: {
        Props: { data: projectPropsBytes },
        TBkndTask: {
          children: {
            FixedMeta: { data: fixedMetaBlob },
            FixedData: { data: fixedDataBlob },
            VarMeta: { data: varMetaBytes },
            Var2Data: { data: var2DataBuf },
          },
        },
      },
    },
  };

  let result: ReturnType<typeof readMPP> | null = null;
  let threw: string | null = null;
  try {
    result = readMPP(buildNestedCfb(tree));
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`I4 end-to-end readMPP: gooit niet (${threw ?? ''})`, threw === null);

  if (result) {
    truthy('I4 end-to-end readMPP: project.name uit Props/TITLE', result.project.name === 'Fixture Project');
    truthy('I4 end-to-end readMPP: alleen bronkritiekgrens als projectoptie, MS Project-profiel',
      JSON.stringify(result.project.schedulingOptions) === JSON.stringify({ criticalDefinition: { mode: 'totalFloat', threshold: 0 } })
        && JSON.stringify(result.project.schedulingProfile) === JSON.stringify(builtInProfile('msproject')));
    truthy('I4 end-to-end readMPP: project en kalender krijgen nooit XER-provenance',
      result.project.schedulingProfile?.id === 'msproject' && result.calendar.p6Source === undefined);
    truthy('I4 end-to-end readMPP: hoursPerDay uit MINUTES_PER_DAY (480/60)', result.calendar.hoursPerDay === 8);
    truthy('I4 end-to-end readMPP: 6 taken', result.tasks.length === 6);

    const byName = new Map(result.tasks.map((t) => [t.name, t]));
    const root = byName.get('Root');
    const clampDeep1 = byName.get('ClampDeep1');
    const clampDeep2 = byName.get('ClampDeep2');
    const child1 = byName.get('Child1');
    const child2 = byName.get('Child2');
    const grandchild = byName.get('Grandchild');
    truthy(
      'I4 end-to-end readMPP: alle zes namen gevonden',
      !!root && !!clampDeep1 && !!clampDeep2 && !!child1 && !!child2 && !!grandchild,
    );

    if (root && clampDeep1 && clampDeep2 && child1 && child2 && grandchild) {
      truthy('I4 end-to-end readMPP: Root is wortel (parentId null)', root.parentId === null);
      truthy('I4 end-to-end readMPP: Root.wbsCode === "1"', root.wbsCode === '1');

      truthy('I4/C1 end-to-end readMPP: ClampDeep1.parentId === Root.id', clampDeep1.parentId === root.id);
      truthy('I4/C1 end-to-end readMPP: ClampDeep1.wbsCode === "1.1"', clampDeep1.wbsCode === '1.1');
      truthy('I4/C1 end-to-end readMPP: ClampDeep2.parentId === Root.id (NIET ClampDeep1 — bewijst de klem)', clampDeep2.parentId === root.id);
      truthy('I4/C1 end-to-end readMPP: ClampDeep2.wbsCode === "1.2" (zónder klem zou dit "1.1.1" zijn)', clampDeep2.wbsCode === '1.2');

      truthy('I4 end-to-end readMPP: Child1.parentId === Root.id', child1.parentId === root.id);
      truthy('I4 end-to-end readMPP: Child1.wbsCode === "1.3"', child1.wbsCode === '1.3');
      truthy('I4 end-to-end readMPP: Child2.parentId === Root.id', child2.parentId === root.id);
      truthy('I4 end-to-end readMPP: Child2.wbsCode === "1.4"', child2.wbsCode === '1.4');
      truthy(
        'I4 end-to-end readMPP: Root.childIds === [ClampDeep1, ClampDeep2, Child1, Child2] (ID-volgorde)',
        root.childIds.length === 4
          && root.childIds[0] === clampDeep1.id
          && root.childIds[1] === clampDeep2.id
          && root.childIds[2] === child1.id
          && root.childIds[3] === child2.id,
      );
      truthy('I4 end-to-end readMPP: Grandchild.parentId === Child2.id', grandchild.parentId === child2.id);
      truthy('I4 end-to-end readMPP: Grandchild.wbsCode === "1.4.1"', grandchild.wbsCode === '1.4.1');
      truthy('I4 end-to-end readMPP: Child2.childIds === [Grandchild]', child2.childIds.length === 1 && child2.childIds[0] === grandchild.id);
      truthy('I4 end-to-end readMPP: Grandchild.isMilestone === true (2010-milestone-tabel-terugval, 4a)', grandchild.isMilestone === true);
      truthy(
        'I4 end-to-end readMPP: Root/ClampDeep1/ClampDeep2/Child1/Child2 zijn GEEN milestone',
        !root.isMilestone && !clampDeep1.isMilestone && !clampDeep2.isMilestone && !child1.isMilestone && !child2.isMilestone,
      );
      truthy('I4 end-to-end readMPP: Root.scheduleDuration === 1 dag (4800 tienden-van-minuut @ 8u/dag)', root.time.scheduleDuration === 1);
    }
  }
}

{
  const PASSWORD_FLAG_KEY = 893386752;
  const PROJECT_START_DATE_KEY = 37748738;
  const PROJECT_FINISH_DATE_KEY = 37748739;
  const TITLE_KEY = 37748744;
  const DEFAULT_CALENDAR_NAME_KEY = 37748750;
  const STATUS_DATE_KEY = 37748805;

  function encodeUnicodeStringAscii(s: string): Uint8Array {
    const out = new Uint8Array(s.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
    return out;
  }

  function buildHourTaskFixedDataRecord(opts: {
    uniqueId: number; id: number; durationRaw: number;
    startTime: number; startDays: number; finishTime: number; finishDays: number;
    durationUnits?: number;
  }): Uint8Array {
    const out = new Uint8Array(130);
    const view = new DataView(out.buffer);
    view.setInt32(0, opts.uniqueId, true);
    view.setInt32(4, opts.id, true);
    view.setInt16(40, 1, true);
    view.setInt32(42, opts.durationRaw, true);
    view.setUint16(46, opts.durationUnits ?? 0, true);
    view.setInt16(56, 0, true);
    view.setUint16(64, opts.startTime, true);
    view.setUint16(66, opts.startDays, true);
    view.setUint16(68, opts.finishTime, true);
    view.setUint16(70, opts.finishDays, true);
    view.setInt32(118, -1, true);
    return out;
  }

  function buildTaskFixedMetaRecord(offsetIntoFixedData: number): Uint8Array {
    const out = new Uint8Array(47);
    new DataView(out.buffer).setInt32(4, offsetIntoFixedData, true);
    return out;
  }

  function buildFixedMetaBlob(items: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(16 + items.length * 47);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0xfadfadba, true);
    view.setInt32(8, items.length, true);
    items.forEach((item, i) => out.set(item, 16 + i * 47));
    return out;
  }

  const UNIFORM_8H_CAL_DAYS = [
    { defaultFlag: 0 as const },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const },
  ];

  function buildFixture(opts: {
    taskName: string; durationRaw: number; startTime: number; startDays: number; finishTime: number; finishDays: number;
    calendarDays?: { defaultFlag?: 0 | 1; bands?: { startMinutes: number; durationMinutes: number }[] }[];
    calendarName?: string;
    durationUnits?: number;
    statusDate?: { time: number; days: number };
  }): Uint8Array {
    const dummy = buildTaskFixedMetaRecord(0);
    const metaTask = buildTaskFixedMetaRecord(3 * 130);
    const fixedMetaBlob = buildFixedMetaBlob([dummy, dummy, dummy, metaTask]);

    const dataTask = buildHourTaskFixedDataRecord({
      uniqueId: 10, id: 1, durationRaw: opts.durationRaw,
      startTime: opts.startTime, startDays: opts.startDays, finishTime: opts.finishTime, finishDays: opts.finishDays,
      durationUnits: opts.durationUnits,
    });
    const fixedDataBlob = new Uint8Array(4 * 130);
    fixedDataBlob.set(dataTask, 3 * 130);

    const taskVarMetaBytes = buildVarMetaBytes([{ uniqueId: 10, type: 14, offset: 0 }]);
    const namePayload = encodeUnicodeStringAscii(opts.taskName);
    const taskVar2DataBuf = new Uint8Array(4 + namePayload.length);
    new DataView(taskVar2DataBuf.buffer).setInt32(0, namePayload.length, true);
    taskVar2DataBuf.set(namePayload, 4);

    const calendarName = opts.calendarName ?? 'Enkelband fixture';
    const hoursBlock = buildCalHoursBlock(opts.calendarDays ?? UNIFORM_8H_CAL_DAYS);
    const calFixedMetaBlob = buildCalFixedMetaBlob([0]);
    const calFixedDataBlob = buildCalFixedDataRecord(1, 1, -1);
    const CAL_NAME_OFF = 0, CAL_DATA_OFF = 100;
    const calVarMetaBytes = buildVarMetaBytes([
      { uniqueId: 1, type: 1, offset: CAL_NAME_OFF },
      { uniqueId: 1, type: 8, offset: CAL_DATA_OFF },
    ]);
    const calVar2DataBuf = new Uint8Array(700);
    const calVar2View = new DataView(calVar2DataBuf.buffer);
    const writeCalVar2 = (offset: number, payload: Uint8Array) => {
      calVar2View.setInt32(offset, payload.length, true);
      calVar2DataBuf.set(payload, offset + 4);
    };
    writeCalVar2(CAL_NAME_OFF, encodeUnicodeStringAscii(calendarName));
    writeCalVar2(CAL_DATA_OFF, hoursBlock);

    const projectPropsBytes = encodePropsEntries([
      { key: PROJECT_START_DATE_KEY, data: timestampBytes(0, 15000) },
      { key: PROJECT_FINISH_DATE_KEY, data: timestampBytes(0, 15010) },
      { key: TITLE_KEY, data: encodeUnicodeStringAscii('Uurmodus-fixture') },
      { key: DEFAULT_CALENDAR_NAME_KEY, data: encodeUnicodeStringAscii(calendarName) },
      ...(opts.statusDate ? [{ key: STATUS_DATE_KEY, data: timestampBytes(opts.statusDate.time, opts.statusDate.days) }] : []),
    ]);

    const tree: Record<string, CfbTreeNode> = {
      '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
      Props14: { data: encodePropsSingleByteEntry(PASSWORD_FLAG_KEY, 0) },
      '   114': {
        children: {
          Props: { data: projectPropsBytes },
          TBkndTask: {
            children: {
              FixedMeta: { data: fixedMetaBlob },
              FixedData: { data: fixedDataBlob },
              VarMeta: { data: taskVarMetaBytes },
              Var2Data: { data: taskVar2DataBuf },
            },
          },
          TBkndCal: {
            children: {
              FixedMeta: { data: calFixedMetaBlob },
              FixedData: { data: calFixedDataBlob },
              VarMeta: { data: calVarMetaBytes },
              Var2Data: { data: calVar2DataBuf },
            },
          },
        },
      },
    };
    return buildNestedCfb(tree);
  }

  {
    const bytes = buildFixture({ taskName: 'HourTask', durationRaw: 1200, startTime: 4800, startDays: 15000, finishTime: 6000, finishDays: 15000 });
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(bytes);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`uurmodus-fixture (uren-taak): readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy('uurmodus-fixture (uren-taak): 1 taak', result.tasks.length === 1);
      const task = result.tasks[0];
      truthy('uurmodus-fixture (uren-taak): projectkalender.workTime gezet (taak-signaal, GEEN eigen kalenderdeviatie)', !!result.calendar.workTime);
      truthy('uurmodus-fixture (uren-taak): expliciete taakeenheid is hours', task?.time.durationUnit === 'hours');
      truthy('uurmodus-fixture (uren-taak): durationMinutes === 120 (geen dag-afronding naar 0)', task?.time.durationMinutes === 120);
      truthy('uurmodus-fixture (uren-taak): scheduleDuration === 0.25 (120min / 8u), NIET 0', task?.time.scheduleDuration === 0.25);
      truthy('uurmodus-fixture (uren-taak): scheduleStart draagt een tijdcomponent ("T" aanwezig)', !!task?.time.scheduleStart.includes('T'));
      truthy('uurmodus-fixture (uren-taak): scheduleStart === 08:00', task?.time.scheduleStart.endsWith('T08:00'));
      truthy('uurmodus-fixture (uren-taak): scheduleFinish === 10:00', task?.time.scheduleFinish.endsWith('T10:00'));
    }
  }

  {
    const bytes = buildFixture({ taskName: 'DayTask', durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 4800, finishDays: 15001 });
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(bytes);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`uurmodus-fixture (dag-contrast): readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy('uurmodus-fixture (dag-contrast): 1 taak', result.tasks.length === 1);
      const task = result.tasks[0];
      truthy('uurmodus-fixture (dag-contrast): projectkalender.workTime NIET gezet (geen lek)', !result.calendar.workTime);
      truthy('uurmodus-fixture (dag-contrast): taakmaat is de urenmaat (T15)', task?.time.durationUnit === 'hours');
      truthy('uurmodus-fixture (dag-contrast): durationMinutes === 480 (de minuten uit het bestand)', task?.time.durationMinutes === 480);
      truthy('uurmodus-fixture (dag-contrast): scheduleDuration === 1 dag', task?.time.scheduleDuration === 1);
      truthy('uurmodus-fixture (dag-contrast): scheduleStart is dag-alleen (geen "T")', !task?.time.scheduleStart.includes('T'));
      truthy('uurmodus-fixture (dag-contrast): scheduleFinish is dag-alleen (geen "T")', !task?.time.scheduleFinish.includes('T'));
    }
  }

  {
    const MON_4H_TUE_FRI_8H_DAYS = [
      { defaultFlag: 0 as const },
      { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 240 }] },
      { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
      { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
      { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
      { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
      { defaultFlag: 0 as const },
    ];
    const bytes = buildFixture({
      taskName: 'ScalarVsPromotedTask', durationRaw: 2400,
      startTime: 4800, startDays: 15000, finishTime: 4800, finishDays: 15001,
      calendarDays: MON_4H_TUE_FRI_8H_DAYS, calendarName: 'Ongelijke dagen fixture',
    });
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(bytes);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`uurmodus-fixture (scalar-vs-promoted): readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy('uurmodus-fixture (scalar-vs-promoted): 1 taak', result.tasks.length === 1);
      const task = result.tasks[0];
      truthy(
        `uurmodus-fixture (scalar-vs-promoted): projectkalender.workTime NIET gezet (scalar hpd=4, 240%240===0) — hoursPerDay=${result.calendar.hoursPerDay}`,
        !result.calendar.workTime,
      );
      truthy('uurmodus-fixture (scalar-vs-promoted): durationMinutes === 240 (urenmaat, T15)', task?.time.durationMinutes === 240);
    }
  }

  {
    installDOMParser();

    const bytes = buildFixture({
      taskName: 'AnchorDivergenceTask', durationRaw: 4800,
      startTime: 5400, startDays: 15000, finishTime: 5400, finishDays: 15001,
      calendarDays: [
        { defaultFlag: 0 as const },
        { defaultFlag: 0 as const, bands: [{ startMinutes: 540, durationMinutes: 480 }] },
        { defaultFlag: 0 as const, bands: [{ startMinutes: 540, durationMinutes: 480 }] },
        { defaultFlag: 0 as const, bands: [{ startMinutes: 540, durationMinutes: 480 }] },
        { defaultFlag: 0 as const, bands: [{ startMinutes: 540, durationMinutes: 480 }] },
        { defaultFlag: 0 as const, bands: [{ startMinutes: 540, durationMinutes: 480 }] },
        { defaultFlag: 0 as const },
      ],
      calendarName: '09:00-kalender fixture',
    });
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(bytes);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`uurmodus-fixture (ankerdivergentie, mpp-kant): readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy('uurmodus-fixture (ankerdivergentie, mpp-kant): 1 taak', result.tasks.length === 1);
      truthy(
        'uurmodus-fixture (ankerdivergentie, mpp-kant): projectkalender.workTime NIET gezet (kalender-eigen anker 09:00 == taaktijden)',
        !result.calendar.workTime,
      );
      truthy('uurmodus-fixture (ankerdivergentie, mpp-kant): durationMinutes === 480 (urenmaat, T15)', result.tasks[0]?.time.durationMinutes === 480);
    }

    const mspdiXml = `<?xml version="1.0"?>
<Project xmlns="http://schemas.microsoft.com/project">
<Name>AnkerdivergentieFixture</Name>
<StartDate>2026-07-06T09:00:00</StartDate>
<FinishDate>2026-07-07T09:00:00</FinishDate>
<Calendars>
<Calendar>
<UID>1</UID>
<Name>09:00-kalender fixture</Name>
<WeekDays>
<WeekDay><DayType>2</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>09:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
<WeekDay><DayType>3</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>09:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
<WeekDay><DayType>4</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>09:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
<WeekDay><DayType>5</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>09:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
<WeekDay><DayType>6</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>09:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
</WeekDays>
</Calendar>
</Calendars>
<Tasks>
<Task><UID>1</UID><Name>AnchorDivergenceTask</Name><OutlineLevel>1</OutlineLevel><Start>2026-07-06T09:00:00</Start><Finish>2026-07-07T09:00:00</Finish><Duration>PT8H0M0S</Duration></Task>
</Tasks>
</Project>`;
    let xmlResult: ReturnType<typeof readMSPDI> | null = null;
    let xmlThrew: string | null = null;
    try {
      xmlResult = readMSPDI(mspdiXml);
    } catch (err) {
      xmlThrew = err instanceof Error ? err.message : String(err);
    }
    truthy(`uurmodus-fixture (ankerdivergentie, mspdi-kant): readMSPDI gooit niet (${xmlThrew ?? ''})`, xmlThrew === null);
    if (xmlResult) {
      truthy('uurmodus-fixture (ankerdivergentie, mspdi-kant): 1 taak', xmlResult.tasks.length === 1);
      truthy(
        'uurmodus-fixture (ankerdivergentie, mspdi-kant): projectkalender.workTime WEL gezet (MSPDI se vaste 08:00-anker ≠ 09:00)',
        !!xmlResult.calendar.workTime,
      );
      truthy(
        'uurmodus-fixture (ankerdivergentie, mspdi-kant): durationMinutes === 480 (uurmodus, ondanks identieke taakinhoud als de mpp-kant)',
        xmlResult.tasks[0]?.time.durationMinutes === 480,
      );
    }
  }

  {
    const bytes = buildFixture({
      taskName: 'ElapsedDayModeTask', durationRaw: 28800,
      startTime: 4800, startDays: 15000, finishTime: 4800, finishDays: 15001,
      durationUnits: 8,
    });
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(bytes);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`uurmodus-fixture (T10 dag-modus elapsed): readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy('uurmodus-fixture (T10 dag-modus elapsed): 1 taak', result.tasks.length === 1);
      const task = result.tasks[0];
      truthy('uurmodus-fixture (T10 dag-modus elapsed): projectkalender.workTime NIET gezet (dagmodus, geen lek)', !result.calendar.workTime);
      truthy(`uurmodus-fixture (T10 dag-modus elapsed): durationMinutes === 2880 klokminuten (kreeg ${task?.time.durationMinutes})`, task?.time.durationMinutes === 2880);
      truthy('uurmodus-fixture (T10 dag-modus elapsed): durationType === ELAPSEDTIME', task?.time.durationType === 'ELAPSEDTIME');
      truthy('uurmodus-fixture (T10 dag-modus elapsed): taakmaat is de urenmaat (T15)', task?.time.durationUnit === 'hours');
    }
  }

  {
    const bytes = buildFixture({
      taskName: 'HourTask', durationRaw: 1200, startTime: 4800, startDays: 15000, finishTime: 6000, finishDays: 15000,
      statusDate: { time: 10200, days: 15000 },
    });
    const result = readMPP(bytes);
    const want = '2025-01-24T17:00';
    truthy(`H4 readMPP: statusdatum mét tijd (kreeg ${result.project.statusDate})`, result.project.statusDate === want);
    const ifcBack = readIFC(writeIFC(result as WriteIFCInput)).project.statusDate;
    truthy(`H4 readMPP → opslaan (IFC) → openen: tijd blijft (kreeg ${ifcBack})`, ifcBack === want);
    installDOMParser();
    const mspdiBack = readMSPDI(writeMSPDI(
      result.project, result.calendar, result.tasks, result.sequences, result.resources, result.assignments,
      result.resourceCalendars ?? [],
    )).project.statusDate;
    truthy(`H4 readMPP → MSPDI-export → openen: tijd blijft (kreeg ${mspdiBack})`, mspdiBack === want);
  }
}

{
  installDOMParser();
  const STATUS_DATE_KEY = 37748805;
  const DAYS_2026_07_06 = 15528;
  const fromMpp = (time: number, days: number) => parseProjectProperties(
    new Props(encodePropsEntries([{ key: STATUS_DATE_KEY, data: timestampBytes(time, days) }]), 'H4-statusdatum'),
    undefined,
  ).project.statusDate;
  const fromMspdi = (xsd: string) => readMSPDI(
    `<?xml version="1.0"?>\n<Project xmlns="http://schemas.microsoft.com/project"><Name>H4</Name>`
    + `<StatusDate>${xsd}</StatusDate><Tasks/></Project>`,
  ).project.statusDate;

  const cases: [string, number, string, string][] = [
    ['17:00 (standaard eindtijd MS Project)', 10200, '2026-07-06T17:00:00', '2026-07-06T17:00'],
    ['17:35 (eigen eindtijd, zoals mpp14header.mpp)', 10550, '2026-07-06T17:35:00', '2026-07-06T17:35'],
    ['12:30', 7500, '2026-07-06T12:30:00', '2026-07-06T12:30'],
    ['23:59 (de datum schuift niet)', 14390, '2026-07-06T23:59:00', '2026-07-06T23:59'],
    ['00:00', 0, '2026-07-06T00:00:00', '2026-07-06T00:00'],
    ['08:00 (een echte tijd in een vreemd bestand, F5b I8)', 4800, '2026-07-06T08:00:00', '2026-07-06T08:00'],
  ];
  for (const [label, time, xsd, want] of cases) {
    const got = fromMpp(time, DAYS_2026_07_06);
    truthy(`H4 .mpp statusdatum ${label}: ${want} (kreeg ${got})`, got === want);
    const mspdi = fromMspdi(xsd);
    truthy(`H4 pariteit .mpp ↔ MSPDI ${label}: .mpp ${got}, MSPDI ${mspdi}`, got === mspdi);
  }
  truthy('H4 .mpp statusdatum NA (days=65535) ⇒ geen statusDate', fromMpp(10200, 65535) === undefined);
  truthy(
    'H4 .mpp zonder statusdatum-veld ⇒ geen statusDate',
    parseProjectProperties(new Props(encodePropsEntries([]), 'H4-geen-statusdatum'), undefined).project.statusDate === undefined,
  );

  const DATA = `${crawlScopes.root}/mpxj/junit/data`;
  for (const [file, want] of [['calendar-exception-precedence.mpp', '2023-05-01T17:00'], ['mpp14header.mpp', '2006-08-01T17:35']]) {
    const path = `${DATA}/${file}`;
    if (!existsSync(path)) {
      console.log(`OK  mpp-import: H4 ${file} niet aanwezig (${path}) — overgeslagen`);
      continue;
    }
    const result = readMPP(new Uint8Array(readFileSync(path)));
    truthy(`[H4 corpus] ${file}: statusdatum ${want} (kreeg ${result.project.statusDate})`, result.project.statusDate === want);
    const ifcBack = readIFC(writeIFC(result as WriteIFCInput)).project.statusDate;
    truthy(`[H4 corpus] ${file}: opslaan (IFC) + openen houdt ${want} (kreeg ${ifcBack})`, ifcBack === want);
  }
}

const CORPUS =
  process.env.OPS_MPP_CORPUS ??
  '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
const corpusPresent = existsSync(CORPUS);
const corpusFiles = corpusPresent ? readdirSync(CORPUS).filter((f) => f.toLowerCase().endsWith('.mpp')) : [];

function hashOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}

const corpusHashToFile = new Map<string, string>();
for (const file of corpusFiles) {
  try {
    corpusHashToFile.set(hashOf(new Uint8Array(readFileSync(join(CORPUS, file)))), file);
  } catch {
  }
}
function resolveCorpusFileByHash(hash: string): string | null {
  return corpusHashToFile.get(hash) ?? null;
}

if (!corpusPresent) {
  console.log('OK  mpp-import: corpus niet aanwezig (OPS_MPP_CORPUS) — corpuslus overgeslagen');
} else if (corpusFiles.length === 0) {
  console.log(`OK  mpp-import: corpusmap aanwezig maar geen .mpp-bestanden erin (${CORPUS}) — corpuslus overgeslagen`);
} else {
  const BACKEND_STORAGES = ['TBkndTask', 'TBkndRsc', 'TBkndAssn', 'TBkndCons', 'TBkndCal'];
  const REQUIRED_STREAMS = ['FixedMeta', 'FixedData', 'VarMeta'];

  for (const file of corpusFiles) {
    const path = join(CORPUS, file);
    let bytes: Uint8Array;
    let tag: string;
    try {
      bytes = new Uint8Array(readFileSync(path));
      tag = hashOf(bytes);
    } catch (err) {
      checks++;
      diffs.push(`[corpusbestand onleesbaar] ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    let cfb: CfbFile;
    try {
      cfb = new CfbFile(bytes);
    } catch (err) {
      checks++;
      diffs.push(`[${tag}] CFB-parse mislukte: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    truthy(`[${tag}] root heeft \\x01CompObj`, cfb.root.children.has('\x01CompObj'));

    const props114 = cfb.getStorage(['   114']);
    truthy(`[${tag}] storage '   114' bestaat`, props114 !== null);
    if (!props114) continue;

    const propsStream = cfb.getStream(['   114', 'Props']);
    truthy(`[${tag}] '   114'/Props is een stream`, propsStream !== null);
    truthy(`[${tag}] '   114'/Props heeft inhoud`, (propsStream?.length ?? 0) > 0);

    for (const storageName of BACKEND_STORAGES) {
      const storage = cfb.getStorage(['   114', storageName]);
      truthy(`[${tag}] '   114'/${storageName} bestaat als storage`, storage !== null);
      if (!storage) continue;
      for (const streamName of REQUIRED_STREAMS) {
        const has = storage.children.get(streamName)?.type === 'stream';
        truthy(`[${tag}] '   114'/${storageName}/${streamName} bestaat als stream`, has);
      }
      const hasVar2Data = storage.children.get('Var2Data')?.type === 'stream';
      console.log(
        `   . [${tag}] '   114'/${storageName}/Var2Data: ${hasVar2Data ? 'aanwezig' : 'afwezig (geen variabele velden)'}`,
      );
    }

    const taskFixedData = cfb.getStream(['   114', 'TBkndTask', 'FixedData']);
    truthy(`[${tag}] TBkndTask/FixedData levert bytes`, (taskFixedData?.length ?? 0) > 0);

    truthy(`[${tag}] onbekend pad geeft null`, cfb.getStream(['does-not-exist']) === null);

    try {
      const variant = detectMppVariant(cfb);
      truthy(`[${tag}] detectMppVariant === 'MPP14'`, variant === 'MPP14');
    } catch (err) {
      checks++;
      diffs.push(`[${tag}] detectMppVariant gooide onverwacht: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      assertReadable(cfb);
      truthy(`[${tag}] assertReadable gooit niet (onversleuteld MPP14)`, true);
    } catch (err) {
      truthy(`[${tag}] assertReadable gooit niet (onversleuteld MPP14)`, false);
      diffs.push(`[${tag}] assertReadable gooide onverwacht: ${err instanceof Error ? err.message : String(err)}`);
    }

    const taskFixedMetaBytes = cfb.getStream(['   114', 'TBkndTask', 'FixedMeta']);
    if (taskFixedMetaBytes && taskFixedData) {
      try {
        const taskFixedMeta = FixedMeta.withItemSize(taskFixedMetaBytes, 47, `${tag}/TBkndTask/FixedMeta`);
        const taskFixedDataParsed = FixedData.fromMeta(taskFixedMeta, taskFixedData, 0, 0, `${tag}/TBkndTask/FixedData`);
        truthy(
          `[${tag}] TBkndTask FixedData.getItemCount() > 0`,
          taskFixedDataParsed.getItemCount() > 0,
        );
      } catch (err) {
        checks++;
        diffs.push(`[${tag}] TBkndTask FixedMeta/FixedData parse mislukte: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      checks++;
      diffs.push(`[${tag}] TBkndTask/FixedMeta of TBkndTask/FixedData ontbreekt`);
    }
  }
}

if (corpusPresent) {
  installDOMParser();
  const EXPECTED_TASK_COUNTS: Record<string, number> = {
    '870d339f60603f71': 51,
    '787efb968ae72fe4': 134,
    'a69fec157074d056': 215,
  };

  interface FieldDiffBudget {
    start: number;
    finish: number;
    duration: number;
    outlineDepth: number;
    constraintDate: number;
  }
  const FIELD_DIFF_BUDGET: Record<string, FieldDiffBudget> = {
    '870d339f60603f71': { start: 12, finish: 12, duration: 8, outlineDepth: 5, constraintDate: 0 },
    '787efb968ae72fe4': { start: 95, finish: 96, duration: 14, outlineDepth: 2, constraintDate: 0 },
    'a69fec157074d056': { start: 55, finish: 54, duration: 28, outlineDepth: 5, constraintDate: 2 },
  };

  const WBS_SHAPE = /^\d+(\.\d+)*$/;

  function outlineDepth(byId: Map<string, Task>, task: Task): number {
    let depth = 1;
    let cur: Task | undefined = task;
    const seen = new Set<string>();
    while (cur?.parentId) {
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      const parent = byId.get(cur.parentId);
      if (!parent) break;
      depth++;
      cur = parent;
    }
    return depth;
  }

  for (const [hash, expectedCount] of Object.entries(EXPECTED_TASK_COUNTS)) {
    const file = resolveCorpusFileByHash(hash);
    if (!file) {
      console.log(`OK  mpp-import: T5 ${hash} niet in dit corpus (${CORPUS}) — overgeslagen`);
      continue;
    }
    const mppPath = join(CORPUS, file);
    const xmlPath = `${mppPath}.xml`;
    if (!existsSync(xmlPath)) {
      checks++;
      diffs.push(`[T5 ${hash}] .mpp aanwezig maar .mpp.xml ontbreekt`);
      continue;
    }

    let mppTasks: Task[];
    try {
      const result = readMPP(new Uint8Array(readFileSync(mppPath)));
      mppTasks = result.tasks;
    } catch (err) {
      checks++;
      diffs.push(`[T5 ${hash}] readMPP gooide onverwacht: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    let xmlTasks: Task[];
    try {
      const xmlResult = readMSPDI(readFileSync(xmlPath, 'utf-8'));
      xmlTasks = xmlResult.tasks;
    } catch (err) {
      checks++;
      diffs.push(`[T5 ${hash}] readMSPDI (ground truth) gooide onverwacht: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    truthy(`[T5 ${hash}] taakaantal === ${expectedCount}`, mppTasks.length === expectedCount);
    truthy(`[T5 ${hash}] taakaantal mpp === taakaantal MSPDI-ground-truth`, mppTasks.length === xmlTasks.length);

    const mppById = new Map(mppTasks.map((t) => [t.id, t]));
    const xmlById = new Map(xmlTasks.map((t) => [t.id, t]));

    const xmlByName = new Map<string, Task[]>();
    for (const t of xmlTasks) {
      const key = t.name.trim();
      const list = xmlByName.get(key);
      if (list) list.push(t);
      else xmlByName.set(key, [t]);
    }

    let matched = 0;
    const fieldDiffCount: FieldDiffBudget = { start: 0, finish: 0, duration: 0, outlineDepth: 0, constraintDate: 0 };
    const fieldDiagnostics: string[] = [];
    for (const mppTask of mppTasks) {
      const queue = xmlByName.get(mppTask.name.trim());
      const xmlTask = queue && queue.length > 0 ? queue.shift() : undefined;
      if (!xmlTask) {
        diffs.push(`[T5 ${hash}] taak "${mppTask.name}": geen gelijknamige taak in de MSPDI-ground-truth gevonden`);
        checks++;
        continue;
      }
      matched++;
      const label = `"${mppTask.name}"`;

      const bothHour = mppTask.time.durationMinutes != null && xmlTask.time.durationMinutes != null;
      const softChecks: [keyof FieldDiffBudget, string, boolean][] = [
        ['start', 'start (dag-prefix)', mppTask.time.scheduleStart.slice(0, 10) === xmlTask.time.scheduleStart.slice(0, 10)],
        ['finish', 'finish (dag-prefix)', mppTask.time.scheduleFinish.slice(0, 10) === xmlTask.time.scheduleFinish.slice(0, 10)],
        bothHour
          ? ['duration', 'duur in minuten', mppTask.time.durationMinutes === xmlTask.time.durationMinutes]
          : ['duration', 'duur in dagen', Math.round(mppTask.time.scheduleDuration) === Math.round(xmlTask.time.scheduleDuration)],
        ['outlineDepth', 'outline-diepte', outlineDepth(mppById, mppTask) === outlineDepth(xmlById, xmlTask)],
      ];
      softChecksTotal += softChecks.length;
      for (const [category, fieldLabel, ok] of softChecks) {
        if (!ok) {
          fieldDiffCount[category]++;
          fieldDiagnostics.push(`${label}: ${fieldLabel}`);
        }
      }

      const mppConstraintType = mppTask.constraint?.type ?? 'ASAP';
      const xmlConstraintType = xmlTask.constraint?.type ?? 'ASAP';
      if (mppConstraintType !== 'ASAP' && mppConstraintType !== 'ALAP') {
        softChecksTotal++;
        const ok = (mppTask.constraint?.date?.slice(0, 10) ?? '') === (xmlTask.constraint?.date?.slice(0, 10) ?? '');
        if (!ok) {
          fieldDiffCount.constraintDate++;
          fieldDiagnostics.push(`${label}: constraintdatum (dag-prefix)`);
        }
      }

      truthy(`[T5 ${hash}] ${label}: milestone-vlag`, mppTask.isMilestone === xmlTask.isMilestone);
      truthy(`[T5 ${hash}] ${label}: constrainttype`, mppConstraintType === xmlConstraintType);
      truthy(
        `[T5 ${hash}] ${label}: deadline (dag-prefix)`,
        (mppTask.deadline?.slice(0, 10) ?? '') === (xmlTask.deadline?.slice(0, 10) ?? ''),
      );
      truthy(`[T5 ${hash}] ${label}: wbsCode heeft de vorm "1" / "1.2" / "1.2.3.4"`, WBS_SHAPE.test(mppTask.wbsCode));
      truthy(
        `[T5 ${hash}] ${label}: wbsCode-segmentaantal === outline-diepte`,
        mppTask.wbsCode.split('.').length === outlineDepth(mppById, mppTask),
      );
      truthy(
        `[T5 ${hash}] ${label}: completion`,
        Math.round(mppTask.time.completion * 100) === Math.round(xmlTask.time.completion * 100),
      );
    }

    truthy(`[T5 ${hash}] alle taken op naam gematcht met de ground truth (${matched}/${mppTasks.length})`, matched === mppTasks.length);

    const budget: FieldDiffBudget = FIELD_DIFF_BUDGET[hash] ?? { start: 0, finish: 0, duration: 0, outlineDepth: 0, constraintDate: 0 };
    const budgetLabels: [keyof FieldDiffBudget, string][] = [
      ['start', 'start (dag-prefix)'],
      ['finish', 'finish (dag-prefix)'],
      ['duration', 'duur in dagen'],
      ['outlineDepth', 'outline-diepte'],
      ['constraintDate', 'constraintdatum (dag-prefix)'],
    ];
    for (const [category, categoryLabel] of budgetLabels) {
      truthy(
        `[T5 ${hash}] veldafwijkingen "${categoryLabel}" binnen bekende basislijn (${fieldDiffCount[category]}/${budget[category]}, documentversieverschil — zie moduleheader)`,
        fieldDiffCount[category] <= budget[category],
      );
    }

    const totalFieldDiffs = fieldDiffCount.start + fieldDiffCount.finish + fieldDiffCount.duration + fieldDiffCount.outlineDepth + fieldDiffCount.constraintDate;
    console.log(`   . [T5 ${hash}] ${matched}/${mppTasks.length} taken op naam gematcht; ${totalFieldDiffs} bekende veldafwijking(en) — start=${fieldDiffCount.start}/${budget.start} finish=${fieldDiffCount.finish}/${budget.finish} duur=${fieldDiffCount.duration}/${budget.duration} outline-diepte=${fieldDiffCount.outlineDepth}/${budget.outlineDepth} constraintdatum=${fieldDiffCount.constraintDate}/${budget.constraintDate}:`);
    for (const d of fieldDiagnostics) console.log(`      · ${d}`);
  }
}

if (corpusPresent) {
  const A69FEC_HASH = 'a69fec157074d056';
  const file = resolveCorpusFileByHash(A69FEC_HASH);
  if (file && existsSync(join(CORPUS, `${file}.xml`))) {
    const mppResult = readMPP(new Uint8Array(readFileSync(join(CORPUS, file))));
    const xmlResult = readMSPDI(readFileSync(join(CORPUS, `${file}.xml`), 'utf-8'));

    truthy(`[uurmodus ${A69FEC_HASH}] mpp projectkalender.workTime gezet`, !!mppResult.calendar.workTime);
    truthy(`[uurmodus ${A69FEC_HASH}] MSPDI-ground-truth projectkalender.workTime gezet`, !!xmlResult.calendar.workTime);

    const mppHourCount = mppResult.tasks.filter((t) => t.time.durationMinutes != null).length;
    const xmlHourCount = xmlResult.tasks.filter((t) => t.time.durationMinutes != null).length;
    truthy(`[uurmodus ${A69FEC_HASH}] mpp: alle taken in uur-modus (${mppHourCount}/${mppResult.tasks.length})`, mppHourCount === mppResult.tasks.length);
    truthy(`[uurmodus ${A69FEC_HASH}] MSPDI-ground-truth: alle taken in uur-modus (${xmlHourCount}/${xmlResult.tasks.length})`, xmlHourCount === xmlResult.tasks.length);

    const xmlByName = new Map<string, Task[]>();
    for (const t of xmlResult.tasks) {
      const key = t.name.trim();
      const list = xmlByName.get(key);
      if (list) list.push(t);
      else xmlByName.set(key, [t]);
    }
    let durationMinutesMatches = 0;
    let durationMinutesCompared = 0;
    for (const mt of mppResult.tasks) {
      const queue = xmlByName.get(mt.name.trim());
      const xt = queue && queue.length > 0 ? queue.shift() : undefined;
      if (!xt || mt.time.durationMinutes == null || xt.time.durationMinutes == null) continue;
      durationMinutesCompared++;
      if (mt.time.durationMinutes === xt.time.durationMinutes) durationMinutesMatches++;
    }
    const DURATION_MINUTES_DIFF_BUDGET = 28;
    truthy(
      `[uurmodus ${A69FEC_HASH}] durationMinutes naam-gematcht binnen budget (${durationMinutesCompared - durationMinutesMatches}/${DURATION_MINUTES_DIFF_BUDGET} afwijkingen op ${durationMinutesCompared} vergeleken)`,
      durationMinutesCompared - durationMinutesMatches <= DURATION_MINUTES_DIFF_BUDGET,
    );
    console.log(`   . [uurmodus ${A69FEC_HASH}] mpp ${mppHourCount}/${mppResult.tasks.length} uur-modus, xml ${xmlHourCount}/${xmlResult.tasks.length} uur-modus, durationMinutes ${durationMinutesMatches}/${durationMinutesCompared} exact gelijk`);
  } else {
    console.log(`OK  mpp-import: uurmodus-sectie (${A69FEC_HASH}) niet in dit corpus — overgeslagen`);
  }
}

{
  const DURATION_FIXTURE = process.env.OPS_MPP_DURATION_FIXTURE
    ?? '/home/nozzit/open-aec/voor claude/testdata-crawl/mpxj/junit/data/mpp14duration.mpp';
  if (!existsSync(DURATION_FIXTURE)) {
    console.log(`OK  mpp-import: T10 DurationUnits-leescase (${DURATION_FIXTURE}) niet aanwezig — overgeslagen`);
  } else {
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(new Uint8Array(readFileSync(DURATION_FIXTURE)));
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`[T10 mpp14duration] readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy('[T10 mpp14duration] 10 taken', result.tasks.length === 10);
      const byName = new Map(result.tasks.map((t) => [t.name, t]));

      const worktimeCases: Array<[string, number]> = [
        ['Task 1', 1], ['Task 2', 60], ['Task 3', 480], ['Task 4', 2400], ['Task 5', 9600],
      ];
      for (const [name, expectedMinutes] of worktimeCases) {
        const t = byName.get(name);
        truthy(`[T10 mpp14duration] ${name} gevonden`, !!t);
        if (t) {
          truthy(`[T10 mpp14duration] ${name}.durationType === WORKTIME`, t.time.durationType === 'WORKTIME');
          truthy(`[T10 mpp14duration] ${name}.durationMinutes === ${expectedMinutes}`, t.time.durationMinutes === expectedMinutes);
        }
      }

      const elapsedCases: Array<[string, number]> = [
        ['Task 6', 1], ['Task 7', 60], ['Task 8', 1440], ['Task 9', 10080], ['Task 10', 43200],
      ];
      for (const [name, expectedMinutes] of elapsedCases) {
        const t = byName.get(name);
        truthy(`[T10 mpp14duration] ${name} gevonden`, !!t);
        if (t) {
          truthy(`[T10 mpp14duration] ${name}.durationType === ELAPSEDTIME`, t.time.durationType === 'ELAPSEDTIME');
          truthy(`[T10 mpp14duration] ${name}.durationMinutes === ${expectedMinutes} (klok-tijd, geen dubbele hoursPerDay-deling)`, t.time.durationMinutes === expectedMinutes);
        }
      }
      console.log(`   . [T10 mpp14duration] ${result.tasks.length} taken: 5 WORKTIME + 5 ELAPSEDTIME correct gedecodeerd`);
    }
  }
}

{
  const REMAINING_FIXTURE = process.env.OPS_MPP_REMAINING_FIXTURE
    ?? '/home/nozzit/open-aec/voor claude/testdata-crawl/crawl-mpp/MSP2016_OzBuild/OzBuild Workshop 14 After Para 26.mpp';
  if (!existsSync(REMAINING_FIXTURE)) {
    console.log(`OK  mpp-import: T9-voortgangsafronding-leescase (${REMAINING_FIXTURE}) niet aanwezig — overgeslagen`);
  } else {
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(new Uint8Array(readFileSync(REMAINING_FIXTURE)));
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`[T9-voortgangsafronding] readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      const byName = new Map(result.tasks.map((t) => [t.name, t]));
      const identifySupplier = byName.get('Identify Supplier Components');
      truthy('[T9-voortgangsafronding] "Identify Supplier Components" gevonden', !!identifySupplier);
      if (identifySupplier) {
        truthy('[T9-voortgangsafronding] Identify Supplier Components is een BLAD (childIds.length === 0)', identifySupplier.childIds.length === 0);
        truthy('[T9-voortgangsafronding] Identify Supplier Components.completion === 0.33', Math.abs(identifySupplier.time.completion - 0.33) < 1e-9);
        truthy('[T9-voortgangsafronding] Identify Supplier Components.durationMinutes === 2880', identifySupplier.time.durationMinutes === 2880);
        truthy(
          `[T9-voortgangsafronding] Identify Supplier Components.remainingMinutes === 1920 (MSP's eigen restduur — de afgeleide vorm zou 1930 geven, kreeg ${identifySupplier.time.remainingMinutes})`,
          identifySupplier.time.remainingMinutes === 1920,
        );
      }
      console.log(`   . [T9-voortgangsafronding] REMAINING_DURATION correct gelezen (${result.tasks.length} taken totaal)`);
    }
  }
}

{
  const PASSWORD_FLAG_KEY = 893386752;
  const PROJECT_START_DATE_KEY = 37748738;
  const PROJECT_FINISH_DATE_KEY = 37748739;
  const TITLE_KEY = 37748744;
  const DEFAULT_CALENDAR_NAME_KEY = 37748750;

  function encodeUnicodeStringAscii(s: string): Uint8Array {
    const out = new Uint8Array(s.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
    return out;
  }

  function buildMsTaskFixedDataRecord(opts: {
    uniqueId: number; id: number; durationRaw: number;
    startTime: number; startDays: number; finishTime: number; finishDays: number;
    actualFinishTime?: number; actualFinishDays?: number;
  }): Uint8Array {
    const out = new Uint8Array(130);
    const view = new DataView(out.buffer);
    view.setInt32(0, opts.uniqueId, true);
    view.setInt32(4, opts.id, true);
    view.setInt16(40, 1, true);
    view.setInt32(42, opts.durationRaw, true);
    view.setInt16(56, 0, true);
    view.setUint16(64, opts.startTime, true);
    view.setUint16(66, opts.startDays, true);
    view.setUint16(68, opts.finishTime, true);
    view.setUint16(70, opts.finishDays, true);
    if (opts.actualFinishDays !== undefined) {
      view.setUint16(76, opts.actualFinishTime ?? 0, true);
      view.setUint16(78, opts.actualFinishDays, true);
    }
    view.setInt32(118, -1, true);
    return out;
  }

  function buildMsTaskFixedMetaRecord(offsetIntoFixedData: number, milestone: boolean): Uint8Array {
    const out = new Uint8Array(47);
    const view = new DataView(out.buffer);
    view.setInt32(4, offsetIntoFixedData, true);
    if (milestone) view.setInt32(8, 0x20, true);
    return out;
  }

  function buildFixedMetaBlob(items: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(16 + items.length * 47);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0xfadfadba, true);
    view.setInt32(8, items.length, true);
    items.forEach((item, i) => out.set(item, 16 + i * 47));
    return out;
  }

  const SINGLE_BAND_8H_CAL_DAYS = [
    { defaultFlag: 0 as const },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const },
  ];

  interface MsTaskSpec {
    name: string; uniqueId: number; id: number; milestone: boolean; durationRaw: number;
    startTime: number; startDays: number; finishTime: number; finishDays: number;
    actualFinishTime?: number; actualFinishDays?: number;
  }

  function buildMilestoneKindFixture(tasks: MsTaskSpec[], calendarDays = SINGLE_BAND_8H_CAL_DAYS): Uint8Array {
    const n = tasks.length;
    const dummy = buildMsTaskFixedMetaRecord(0, false);
    const metas = tasks.map((t, i) => buildMsTaskFixedMetaRecord((3 + i) * 130, t.milestone));
    const fixedMetaBlob = buildFixedMetaBlob([dummy, dummy, dummy, ...metas]);

    const fixedDataBlob = new Uint8Array((3 + n) * 130);
    tasks.forEach((t, i) => fixedDataBlob.set(buildMsTaskFixedDataRecord(t), (3 + i) * 130));

    let nameOffset = 0;
    const varMetaEntries: { uniqueId: number; type: number; offset: number }[] = [];
    const namePayloads: { offset: number; payload: Uint8Array }[] = [];
    for (const t of tasks) {
      varMetaEntries.push({ uniqueId: t.uniqueId, type: 14, offset: nameOffset });
      const payload = encodeUnicodeStringAscii(t.name);
      namePayloads.push({ offset: nameOffset, payload });
      nameOffset += 4 + payload.length;
    }
    const taskVarMetaBytes = buildVarMetaBytes(varMetaEntries);
    const taskVar2DataBuf = new Uint8Array(nameOffset);
    const taskVar2View = new DataView(taskVar2DataBuf.buffer);
    for (const { offset, payload } of namePayloads) {
      taskVar2View.setInt32(offset, payload.length, true);
      taskVar2DataBuf.set(payload, offset + 4);
    }

    const calendarName = 'T11 mijlpaal-fixture';
    const hoursBlock = buildCalHoursBlock(calendarDays);
    const calFixedMetaBlob = buildCalFixedMetaBlob([0]);
    const calFixedDataBlob = buildCalFixedDataRecord(1, 1, -1);
    const CAL_NAME_OFF = 0, CAL_DATA_OFF = 100;
    const calVarMetaBytes = buildVarMetaBytes([
      { uniqueId: 1, type: 1, offset: CAL_NAME_OFF },
      { uniqueId: 1, type: 8, offset: CAL_DATA_OFF },
    ]);
    const calVar2DataBuf = new Uint8Array(700);
    const calVar2View = new DataView(calVar2DataBuf.buffer);
    const writeCalVar2 = (offset: number, payload: Uint8Array) => {
      calVar2View.setInt32(offset, payload.length, true);
      calVar2DataBuf.set(payload, offset + 4);
    };
    writeCalVar2(CAL_NAME_OFF, encodeUnicodeStringAscii(calendarName));
    writeCalVar2(CAL_DATA_OFF, hoursBlock);

    const projectPropsBytes = encodePropsEntries([
      { key: PROJECT_START_DATE_KEY, data: timestampBytes(0, 15000) },
      { key: PROJECT_FINISH_DATE_KEY, data: timestampBytes(0, 15010) },
      { key: TITLE_KEY, data: encodeUnicodeStringAscii('T11-fixture') },
      { key: DEFAULT_CALENDAR_NAME_KEY, data: encodeUnicodeStringAscii(calendarName) },
    ]);

    const tree: Record<string, CfbTreeNode> = {
      '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
      Props14: { data: encodePropsSingleByteEntry(PASSWORD_FLAG_KEY, 0) },
      '   114': {
        children: {
          Props: { data: projectPropsBytes },
          TBkndTask: {
            children: {
              FixedMeta: { data: fixedMetaBlob },
              FixedData: { data: fixedDataBlob },
              VarMeta: { data: taskVarMetaBytes },
              Var2Data: { data: taskVar2DataBuf },
            },
          },
          TBkndCal: {
            children: {
              FixedMeta: { data: calFixedMetaBlob },
              FixedData: { data: calFixedDataBlob },
              VarMeta: { data: calVarMetaBytes },
              Var2Data: { data: calVar2DataBuf },
            },
          },
        },
      },
    };
    return buildNestedCfb(tree);
  }

  {
    const bytes = buildMilestoneKindFixture([
      { name: 'MilestoneBandEnd', uniqueId: 10, id: 1, milestone: true, durationRaw: 0, startTime: 9600, startDays: 15000, finishTime: 9600, finishDays: 15000 },
      { name: 'MilestoneBandStart', uniqueId: 11, id: 2, milestone: true, durationRaw: 0, startTime: 4800, startDays: 15000, finishTime: 4800, finishDays: 15000 },
      { name: 'MilestoneMidBand', uniqueId: 12, id: 3, milestone: true, durationRaw: 0, startTime: 7200, startDays: 15000, finishTime: 7200, finishDays: 15000 },
      { name: 'NonMilestoneBandEnd', uniqueId: 13, id: 4, milestone: false, durationRaw: 0, startTime: 9600, startDays: 15000, finishTime: 9600, finishDays: 15000 },
      { name: 'MilestoneWithDurationBandEnd', uniqueId: 14, id: 5, milestone: true, durationRaw: 4800, startTime: 9600, startDays: 15000, finishTime: 9600, finishDays: 15000 },
    ]);
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(bytes);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`[T11 synthetisch] readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy('[T11 synthetisch] 5 taken', result.tasks.length === 5);
      truthy('[T11 synthetisch] projectkalender in uur-modus (workTime gezet)', !!result.calendar.workTime);
      const byName = new Map(result.tasks.map((t) => [t.name, t]));
      const bandEnd = byName.get('MilestoneBandEnd');
      const bandStart = byName.get('MilestoneBandStart');
      const midBand = byName.get('MilestoneMidBand');
      const nonMilestone = byName.get('NonMilestoneBandEnd');
      const msWithDuration = byName.get('MilestoneWithDurationBandEnd');
      truthy('[T11 synthetisch] alle vijf taken gevonden', !!bandEnd && !!bandStart && !!midBand && !!nonMilestone && !!msWithDuration);
      if (bandEnd) truthy('[T11 synthetisch] anker exact op bandeinde (16:00) ⇒ milestoneKind === FINISH', bandEnd.milestoneKind === 'FINISH');
      if (bandStart) truthy('[T11 synthetisch] anker exact op bandbegin (08:00) ⇒ milestoneKind === START', bandStart.milestoneKind === 'START');
      if (midBand) truthy('[T11 synthetisch] anker midden in de band (12:00) ⇒ GEEN milestoneKind ("elders")', midBand.milestoneKind === undefined);
      if (nonMilestone) {
        truthy('[T11 synthetisch] niet-mijlpaal blijft isMilestone === false', nonMilestone.isMilestone === false);
        truthy('[T11 synthetisch] niet-mijlpaal krijgt NOOIT een milestoneKind, ook op een bandeinde', nonMilestone.milestoneKind === undefined);
      }
      if (msWithDuration) {
        truthy('[T15 synthetisch] mijlpaal-met-duur blijft isMilestone === true (weergavevlag, MSP-getrouw)', msWithDuration.isMilestone === true);
        truthy('[T15 synthetisch] mijlpaal-met-duur krijgt GEEN milestoneKind, ondanks bandeinde-anker (durationRaw ≠ 0)', msWithDuration.milestoneKind === undefined);
        truthy('[T15 synthetisch] mijlpaal-met-duur behoudt haar eigen duur (8u ⇒ scheduleDuration 1)', Math.abs(msWithDuration.time.scheduleDuration - 1) < 1e-9);
      }
    }
  }

  {
    const bytes = buildMilestoneKindFixture([
      { name: 'DayModeMilestone', uniqueId: 10, id: 1, milestone: true, durationRaw: 0, startTime: 4800, startDays: 15000, finishTime: 4800, finishDays: 15000 },
    ]);
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(bytes);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`[T11 dagmodus] readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy('[T11 dagmodus] 1 taak', result.tasks.length === 1);
      truthy('[T11 dagmodus] projectkalender.workTime NIET gezet (dag-modus)', !result.calendar.workTime);
      const task = result.tasks[0];
      truthy('[T11 dagmodus] taak is mijlpaal', task?.isMilestone === true);
      truthy('[T11 dagmodus] GEEN milestoneKind (afleiding geldt alleen in uur-modus)', task?.milestoneKind === undefined);
    }
  }

  for (const [clock, time] of [['11:00', 6600], ['00:00', 0]] as const) {
    const bytes = buildMilestoneKindFixture([
      { name: 'ActualMilestone', uniqueId: 10, id: 1, milestone: true, durationRaw: 0, startTime: 4800, startDays: 15000,
        finishTime: 4800, finishDays: 15000, actualFinishTime: time, actualFinishDays: 15000 },
    ]);
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(bytes);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`[werkelijk ${clock}] readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy(`[werkelijk ${clock}] de werkelijke tijd maakt de kalender een urenkalender`, !!result.calendar.workTime);
      const actual = result.tasks[0]?.time.actualFinish;
      truthy(`[werkelijk ${clock}] werkelijk einde houdt zijn tijd (${actual})`, actual === `2025-01-24T${clock}`);
    }
  }

  {
    const WRAP_MIDNIGHT_CAL_DAYS = [
      { defaultFlag: 0 as const },
      { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }, { startMinutes: 1200, durationMinutes: 240 }] },
      { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
      { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
      { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
      { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
      { defaultFlag: 0 as const },
    ];
    const bytes = buildMilestoneKindFixture(
      [{ name: 'MilestoneAfterMidnightWrap', uniqueId: 10, id: 1, milestone: true, durationRaw: 0, startTime: 0, startDays: 15004, finishTime: 0, finishDays: 15004 }],
      WRAP_MIDNIGHT_CAL_DAYS,
    );
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(bytes);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`[T11 wrap-middernacht] readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy('[T11 wrap-middernacht] 1 taak', result.tasks.length === 1);
      truthy('[T11 wrap-middernacht] projectkalender in uur-modus (maandag: 2 banden, discriminator a)', !!result.calendar.workTime);
      const task = result.tasks[0];
      truthy(
        `[T11 wrap-middernacht] anker di 00:00 na een ma 20:00-24:00-band ⇒ milestoneKind === FINISH (kreeg ${task?.milestoneKind})`,
        task?.milestoneKind === 'FINISH',
      );
    }
  }

  {
    const BASELINE_FIXTURE = process.env.OPS_MPP_BASELINE_FIXTURE
      ?? '/home/nozzit/open-aec/voor claude/testdata-crawl/mpxj/junit/data/mpp14baseline.mpp';
    if (!existsSync(BASELINE_FIXTURE)) {
      console.log(`OK  mpp-import: T11 mpp14baseline-leescase (${BASELINE_FIXTURE}) niet aanwezig — overgeslagen`);
    } else {
      let result: ReturnType<typeof readMPP> | null = null;
      let threw: string | null = null;
      try {
        result = readMPP(new Uint8Array(readFileSync(BASELINE_FIXTURE)));
      } catch (err) {
        threw = err instanceof Error ? err.message : String(err);
      }
      truthy(`[T11 mpp14baseline] readMPP gooit niet (${threw ?? ''})`, threw === null);
      if (result) {
        truthy('[T11 mpp14baseline] projectkalender in uur-modus', !!result.calendar.workTime);
        const complete = result.tasks.find((t) => t.name === 'Complete');
        truthy('[T11 mpp14baseline] mijlpaal "Complete" gevonden', !!complete);
        if (complete) {
          truthy('[T11 mpp14baseline] "Complete".isMilestone === true', complete.isMilestone === true);
          truthy(
            `[T11 mpp14baseline] "Complete".milestoneKind === FINISH (anker ${complete.time.scheduleFinish}, kreeg ${complete.milestoneKind})`,
            complete.milestoneKind === 'FINISH',
          );
        }
        console.log('   . [T11 mpp14baseline] mijlpaal "Complete" correct als FINISH gelezen');
      }
    }
  }
}

{
  const PASSWORD_FLAG_KEY = 893386752;
  const PROJECT_START_DATE_KEY = 37748738;
  const PROJECT_FINISH_DATE_KEY = 37748739;
  const TITLE_KEY = 37748744;
  const DEFAULT_CALENDAR_NAME_KEY = 37748750;
  const PROPSKEY_TASK_FIELD_MAP_T12 = 131092;
  const LEVELING_DELAY_TYPE_VALUE = 20;
  const LEVELING_DELAY_OFFSET = 126;

  function encodeUnicodeStringAscii(s: string): Uint8Array {
    const out = new Uint8Array(s.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
    return out;
  }

  interface T12TaskSpec {
    name: string; uniqueId: number; id: number; durationRaw: number;
    startTime: number; startDays: number; finishTime: number; finishDays: number;
    levelingDelayRaw?: number;
  }

  function buildT12TaskFixedDataRecord(t: T12TaskSpec): Uint8Array {
    const out = new Uint8Array(130);
    const view = new DataView(out.buffer);
    view.setInt32(0, t.uniqueId, true);
    view.setInt32(4, t.id, true);
    view.setInt16(40, 1, true);
    view.setInt32(42, t.durationRaw, true);
    view.setInt16(46, 7, true);
    view.setInt16(56, 0, true);
    view.setUint16(64, t.startTime, true);
    view.setUint16(66, t.startDays, true);
    view.setUint16(68, t.finishTime, true);
    view.setUint16(70, t.finishDays, true);
    view.setInt32(118, -1, true);
    view.setInt32(LEVELING_DELAY_OFFSET, t.levelingDelayRaw ?? 0, true);
    return out;
  }

  function buildT12TaskFixedMetaRecord(offsetIntoFixedData: number): Uint8Array {
    const out = new Uint8Array(47);
    const view = new DataView(out.buffer);
    view.setInt32(4, offsetIntoFixedData, true);
    return out;
  }

  function buildT12FixedMetaBlob(items: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(16 + items.length * 47);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0xfadfadba, true);
    view.setInt32(8, items.length, true);
    items.forEach((item, i) => out.set(item, 16 + i * 47));
    return out;
  }

  const T12_CAL_DAYS = [
    { defaultFlag: 0 as const },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const },
  ];

  function buildT12Fixture(tasks: T12TaskSpec[]): Uint8Array {
    const n = tasks.length;
    const dummy = buildT12TaskFixedMetaRecord(0);
    const metas = tasks.map((_t, i) => buildT12TaskFixedMetaRecord((3 + i) * 130));
    const fixedMetaBlob = buildT12FixedMetaBlob([dummy, dummy, dummy, ...metas]);

    const fixedDataBlob = new Uint8Array((3 + n) * 130);
    tasks.forEach((t, i) => fixedDataBlob.set(buildT12TaskFixedDataRecord(t), (3 + i) * 130));

    let nameOffset = 0;
    const varMetaEntries: { uniqueId: number; type: number; offset: number }[] = [];
    const namePayloads: { offset: number; payload: Uint8Array }[] = [];
    for (const t of tasks) {
      varMetaEntries.push({ uniqueId: t.uniqueId, type: TaskFieldId.Name, offset: nameOffset });
      const payload = encodeUnicodeStringAscii(t.name);
      namePayloads.push({ offset: nameOffset, payload });
      nameOffset += 4 + payload.length;
    }
    const taskVarMetaBytes = buildVarMetaBytes(varMetaEntries);
    const taskVar2DataBuf = new Uint8Array(Math.max(nameOffset, 1));
    const taskVar2View = new DataView(taskVar2DataBuf.buffer);
    for (const { offset, payload } of namePayloads) {
      taskVar2View.setInt32(offset, payload.length, true);
      taskVar2DataBuf.set(payload, offset + 4);
    }

    const fieldMapBytes = buildFieldMapEntryBytes([
      { typeValue: TaskFieldId.UniqueId, dataBlockOffset: 0, category: 3 },
      { typeValue: TaskFieldId.Id, dataBlockOffset: 4, category: 3 },
      { typeValue: TaskFieldId.OutlineLevel, dataBlockOffset: 40, category: 3 },
      { typeValue: TaskFieldId.ScheduledDuration, dataBlockOffset: 42, category: 3 },
      { typeValue: TaskFieldId.DurationUnits, dataBlockOffset: 46, category: 3 },
      { typeValue: TaskFieldId.ConstraintType, dataBlockOffset: 56, category: 3 },
      { typeValue: TaskFieldId.ScheduledStart, dataBlockOffset: 64, category: 3 },
      { typeValue: TaskFieldId.ScheduledFinish, dataBlockOffset: 68, category: 3 },
      { typeValue: TaskFieldId.ActualStart, dataBlockOffset: 72, category: 3 },
      { typeValue: TaskFieldId.ActualFinish, dataBlockOffset: 76, category: 3 },
      { typeValue: TaskFieldId.ConstraintDate, dataBlockOffset: 80, category: 3 },
      { typeValue: TaskFieldId.PercentComplete, dataBlockOffset: 90, category: 3 },
      { typeValue: TaskFieldId.CalendarUniqueId, dataBlockOffset: 118, category: 3 },
      { typeValue: TaskFieldId.Deadline, dataBlockOffset: 122, category: 3 },
      { typeValue: LEVELING_DELAY_TYPE_VALUE, dataBlockOffset: LEVELING_DELAY_OFFSET, category: 3 },
      { typeValue: TaskFieldId.Name, dataBlockOffset: 65535, category: 8 },
    ]);

    const calendarName = 'T12 span-fixture';
    const hoursBlock = buildCalHoursBlock(T12_CAL_DAYS);
    const calFixedMetaBlob = buildCalFixedMetaBlob([0]);
    const calFixedDataBlob = buildCalFixedDataRecord(1, 1, -1);
    const CAL_NAME_OFF = 0, CAL_DATA_OFF = 100;
    const calVarMetaBytes = buildVarMetaBytes([
      { uniqueId: 1, type: 1, offset: CAL_NAME_OFF },
      { uniqueId: 1, type: 8, offset: CAL_DATA_OFF },
    ]);
    const calVar2DataBuf = new Uint8Array(700);
    const calVar2View = new DataView(calVar2DataBuf.buffer);
    const writeCalVar2 = (offset: number, payload: Uint8Array) => {
      calVar2View.setInt32(offset, payload.length, true);
      calVar2DataBuf.set(payload, offset + 4);
    };
    writeCalVar2(CAL_NAME_OFF, encodeUnicodeStringAscii(calendarName));
    writeCalVar2(CAL_DATA_OFF, hoursBlock);

    const projectPropsBytes = encodePropsEntries([
      { key: PROJECT_START_DATE_KEY, data: timestampBytes(0, 15000) },
      { key: PROJECT_FINISH_DATE_KEY, data: timestampBytes(0, 15010) },
      { key: TITLE_KEY, data: encodeUnicodeStringAscii('T12-fixture') },
      { key: DEFAULT_CALENDAR_NAME_KEY, data: encodeUnicodeStringAscii(calendarName) },
      { key: PROPSKEY_TASK_FIELD_MAP_T12, data: fieldMapBytes },
    ]);

    const tree: Record<string, CfbTreeNode> = {
      '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
      Props14: { data: encodePropsSingleByteEntry(PASSWORD_FLAG_KEY, 0) },
      '   114': {
        children: {
          Props: { data: projectPropsBytes },
          TBkndTask: {
            children: {
              FixedMeta: { data: fixedMetaBlob },
              FixedData: { data: fixedDataBlob },
              VarMeta: { data: taskVarMetaBytes },
              Var2Data: { data: taskVar2DataBuf },
            },
          },
          TBkndCal: {
            children: {
              FixedMeta: { data: calFixedMetaBlob },
              FixedData: { data: calFixedDataBlob },
              VarMeta: { data: calVarMetaBytes },
              Var2Data: { data: calVar2DataBuf },
            },
          },
        },
      },
    };
    return buildNestedCfb(tree);
  }

  const readT12 = (bytes: Uint8Array) => {
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(bytes);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    return { result, threw };
  };

  {
    const { result, threw } = readT12(buildT12Fixture([
      { name: 'Clean', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000 },
    ]));
    truthy(`[T12 schoon] readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy('[T12 schoon] 1 taak', result.tasks.length === 1);
      truthy('[T12 schoon] GEEN sourceScheduleNotes (negatieve case)', result.sourceScheduleNotes === undefined);
    }
  }

  {
    const { result, threw } = readT12(buildT12Fixture([
      { name: 'Leveled', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000, levelingDelayRaw: 100 },
    ]));
    truthy(`[T12 leveled] readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy(
        `[T12 leveled] sourceScheduleNotes === {total:1, leveled:1, split:0, timephased:0} (kreeg ${JSON.stringify(result.sourceScheduleNotes)})`,
        result.sourceScheduleNotes?.total === 1 && result.sourceScheduleNotes.leveled === 1
          && result.sourceScheduleNotes.split === 0 && result.sourceScheduleNotes.timephased === 0,
      );
    }
  }

  {
    const { result, threw } = readT12(buildT12Fixture([
      { name: 'Leveled1', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000, levelingDelayRaw: 50 },
      { name: 'Leveled2', uniqueId: 11, id: 2, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000, levelingDelayRaw: 30 },
      { name: 'Clean2', uniqueId: 12, id: 3, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000 },
    ]));
    truthy(`[T12 meerdere taken] readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy('[T12 meerdere taken] 3 taken', result.tasks.length === 3);
      truthy(
        `[T12 meerdere taken] sourceScheduleNotes === {total:2, leveled:2, split:0, timephased:0} (kreeg ${JSON.stringify(result.sourceScheduleNotes)})`,
        result.sourceScheduleNotes?.total === 2 && result.sourceScheduleNotes.leveled === 2
          && result.sourceScheduleNotes.split === 0 && result.sourceScheduleNotes.timephased === 0,
      );
    }
  }

  function z16MakeTask(id: string, opts: {
    levelingDelayMinutes?: number;
    splitGaps?: TaskSplitGap[];
    timephasedFinishFloor?: string;
    timephasedDurationWalks?: { anchor: string; resourceCalendarId: string }[];
  } = {}): Task {
    return {
      id, name: id, description: '', wbsCode: '', taskType: 'USERDEFINED', status: 'NOT_STARTED',
      isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
      time: { ...createDefaultTaskTime('2026-01-01T08:00', 5) },
      ...(opts.levelingDelayMinutes != null ? { levelingDelayMinutes: opts.levelingDelayMinutes } : {}),
      ...(opts.splitGaps ? { splitGaps: opts.splitGaps } : {}),
      ...(opts.timephasedFinishFloor ? { timephasedFinishFloor: opts.timephasedFinishFloor } : {}),
      ...(opts.timephasedDurationWalks ? { timephasedDurationWalks: opts.timephasedDurationWalks } : {}),
    };
  }
  {
    const onlyLeveled = countScheduleNotes([z16MakeTask('t1', { levelingDelayMinutes: 30 })]);
    truthy(
      '[Z16 pure a] leveled-only ⇒ {total:1,leveled:1,split:0,timephased:0}',
      onlyLeveled.total === 1 && onlyLeveled.leveled === 1 && onlyLeveled.split === 0 && onlyLeveled.timephased === 0,
    );

    const onlySplit = countScheduleNotes([z16MakeTask('t1', { splitGaps: [{ afterMinutes: 240, gapMinutes: 120 }] })]);
    truthy(
      '[Z16 pure b] split-only ⇒ {total:1,leveled:0,split:1,timephased:0}',
      onlySplit.total === 1 && onlySplit.leveled === 0 && onlySplit.split === 1 && onlySplit.timephased === 0,
    );

    const onlyTimephasedFloor = countScheduleNotes([z16MakeTask('t1', { timephasedFinishFloor: '2026-01-05T17:00' })]);
    truthy(
      '[Z16 pure c] timephased-only (laag 3, finishFloor) ⇒ timephased:1, de andere twee 0',
      onlyTimephasedFloor.total === 1 && onlyTimephasedFloor.timephased === 1
        && onlyTimephasedFloor.leveled === 0 && onlyTimephasedFloor.split === 0,
    );

    const onlyTimephasedWalks = countScheduleNotes([
      z16MakeTask('t1', { timephasedDurationWalks: [{ anchor: '2026-01-01T23:00', resourceCalendarId: 'cal-1' }] }),
    ]);
    truthy(
      '[Z16 pure c2] timephased-only (laag 4, durationWalks) ⇒ timephased:1',
      onlyTimephasedWalks.timephased === 1 && onlyTimephasedWalks.total === 1,
    );

    const allThree = countScheduleNotes([z16MakeTask('t1', {
      levelingDelayMinutes: 10,
      splitGaps: [{ afterMinutes: 60, gapMinutes: 30 }],
      timephasedFinishFloor: '2026-01-05T17:00',
    })]);
    truthy(
      '[Z16 pure d] drie signalen op 1 taak ⇒ total:1 (VERENIGING, geen som van 3)',
      allThree.total === 1 && allThree.leveled === 1 && allThree.split === 1 && allThree.timephased === 1,
    );

    const mixed = countScheduleNotes([
      z16MakeTask('t1', { levelingDelayMinutes: 10 }),
      z16MakeTask('t2', { splitGaps: [{ afterMinutes: 60, gapMinutes: 30 }] }),
      z16MakeTask('t3'),
    ]);
    truthy('[Z16 pure e] 2 van 3 taken gemarkeerd ⇒ total:2', mixed.total === 2 && mixed.leveled === 1 && mixed.split === 1 && mixed.timephased === 0);

    const clean = countScheduleNotes([z16MakeTask('t1'), z16MakeTask('t2')]);
    truthy(
      '[Z16 pure f] geen signalen ⇒ {total:0,leveled:0,split:0,timephased:0}',
      clean.total === 0 && clean.leveled === 0 && clean.split === 0 && clean.timephased === 0,
    );

    const emptyGaps = countScheduleNotes([z16MakeTask('t1', { splitGaps: [] })]);
    truthy('[Z16 pure g] splitGaps:[] (leeg, niet undefined) telt NIET als split', emptyGaps.total === 0 && emptyGaps.split === 0);
  }

  {
    const T12_870D339F_HASH = '870d339f60603f71';
    const file870d339f = resolveCorpusFileByHash(T12_870D339F_HASH);
    if (!file870d339f) {
      console.log(`OK  mpp-import: T12/Z16 corpus-leescases (${T12_870D339F_HASH}) niet aanwezig — overgeslagen`);
    } else {
      {
        const { result, threw } = readT12(new Uint8Array(readFileSync(join(CORPUS, file870d339f))));
        truthy(`[T12 ${T12_870D339F_HASH}] readMPP gooit niet (${threw ?? ''})`, threw === null);
        if (result) {
          truthy(
            `[T12 ${T12_870D339F_HASH}] GEEN sourceScheduleNotes — negatieve case (acceptatiepunt 4, plan-§Z16)`,
            result.sourceScheduleNotes === undefined,
          );
        }
      }
      const T12_787EFB_HASH = '787efb968ae72fe4';
      const file787efb = resolveCorpusFileByHash(T12_787EFB_HASH);
      if (file787efb) {
        const { result, threw } = readT12(new Uint8Array(readFileSync(join(CORPUS, file787efb))));
        truthy(`[T12 ${T12_787EFB_HASH}] readMPP gooit niet (${threw ?? ''})`, threw === null);
        if (result) {
          truthy(
            `[T12/Z19 ${T12_787EFB_HASH}] sourceScheduleNotes === {total:12, leveled:0, split:0, timephased:12} (kreeg ${JSON.stringify(result.sourceScheduleNotes)})`,
            result.sourceScheduleNotes?.total === 12 && result.sourceScheduleNotes.leveled === 0
              && result.sourceScheduleNotes.split === 0 && result.sourceScheduleNotes.timephased === 12,
          );
        }
      }
      const T12_A69FEC_HASH = 'a69fec157074d056';
      const fileA69fec = resolveCorpusFileByHash(T12_A69FEC_HASH);
      if (fileA69fec) {
        const { result, threw } = readT12(new Uint8Array(readFileSync(join(CORPUS, fileA69fec))));
        truthy(`[T12 ${T12_A69FEC_HASH}] readMPP gooit niet (${threw ?? ''})`, threw === null);
        if (result) {
          truthy(
            `[Z16/Z19 ${T12_A69FEC_HASH}] sourceScheduleNotes === {total:16, leveled:10, split:0, timephased:6} (kreeg ${JSON.stringify(result.sourceScheduleNotes)})`,
            result.sourceScheduleNotes?.total === 16 && result.sourceScheduleNotes.leveled === 10
              && result.sourceScheduleNotes.split === 0 && result.sourceScheduleNotes.timephased === 6,
          );
        }
      }
    }
  }

  {
    const RESOURCE_FIXTURE = process.env.OPS_MPP_RESOURCE_FIXTURE
      ?? '/home/nozzit/open-aec/voor claude/testdata-crawl/mpxj/junit/data/mpp14resource.mpp';
    if (!existsSync(RESOURCE_FIXTURE)) {
      console.log(`OK  mpp-import: T12 mpp14resource-leescase (${RESOURCE_FIXTURE}) niet aanwezig — overgeslagen`);
    } else {
      const { result, threw } = readT12(new Uint8Array(readFileSync(RESOURCE_FIXTURE)));
      truthy(`[T12 mpp14resource] readMPP gooit niet (${threw ?? ''})`, threw === null);
      if (result) {
        truthy('[T12 mpp14resource] 3 taken (Task A, Contoured Task, Completed Task)', result.tasks.length === 3);
        const contoured = result.tasks.find((t) => t.name === 'Contoured Task');
        truthy('[T12 mpp14resource] "Contoured Task" gevonden', !!contoured);
        if (contoured) {
          truthy(
            `[T12 mpp14resource] "Contoured Task".scheduleDuration ≈ 3428 min (7,1417 dagen @ 480 min/dag, kreeg ${contoured.time.scheduleDuration})`,
            Math.abs(contoured.time.scheduleDuration - 3428 / 480) < 0.01,
          );
        }
        truthy(
          `[Z16/Z19 mpp14resource] sourceScheduleNotes === {total:2, leveled:0, split:0, timephased:2} (kreeg ${JSON.stringify(result.sourceScheduleNotes)})`,
          result.sourceScheduleNotes?.total === 2 && result.sourceScheduleNotes.leveled === 0
            && result.sourceScheduleNotes.split === 0 && result.sourceScheduleNotes.timephased === 2,
        );

        const cpm = solveProject(opsSolveInput({
          tasks: result.tasks, sequences: result.sequences, calendar: result.calendar,
          calendars: result.resourceCalendars ?? [],
        }));
        truthy('[T12 mpp14resource, Z8] solveProject zonder cyclus-fout', !cpm.error);
        const taskA = result.tasks.find((t) => t.name === 'Task A');
        truthy('[T12 mpp14resource, Z8] "Task A" gevonden', !!taskA);
        if (taskA) {
          truthy(
            `[T12 mpp14resource, Z19] "Task A" krijgt 3 timephasedDurationWalks (alle drie werkresources), elk 1440 werkminuten (kreeg ${JSON.stringify(taskA.timephasedDurationWalks)})`,
            Array.isArray(taskA.timephasedDurationWalks) && taskA.timephasedDurationWalks.length === 3
              && taskA.timephasedDurationWalks.every((w) => w.workMinutes === 1440),
          );
          truthy(
            `[T12 mpp14resource, Z19] "Task A".scheduleFinish === MSP's eigen 2006-08-30T08:00 (werkVERDELING, kreeg ${taskA.time.scheduleFinish})`,
            taskA.time.scheduleFinish === '2006-08-30T08:00',
          );
          truthy(
            `[T12 mpp14resource, Z19] "Task A".scheduleStart === MSP's eigen 2006-08-25T08:00 (startAnchor = het vroegste anker over alle toewijzingen: Wade/Jon om 08:00, niet Brian om 23:00 — kreeg ${taskA.time.scheduleStart})`,
            taskA.time.scheduleStart === '2006-08-25T08:00',
          );
          const taskANaiveWalk = {
            ...taskA, time: { ...taskA.time },
            timephasedDurationWalks: taskA.timephasedDurationWalks?.map((w) => ({ anchor: w.anchor, resourceCalendarId: w.resourceCalendarId })),
          };
          const cpmNaiveWalk = solveProject(opsSolveInput({
            tasks: [taskANaiveWalk, ...result.tasks.filter((t) => t.id !== taskA.id)],
            sequences: result.sequences, calendar: result.calendar, calendars: result.resourceCalendars ?? [],
          }));
          const naiveWalkFinish = cpmNaiveWalk.tasks.get(taskA.id)?.earlyFinish;
          truthy(
            `[T12 mpp14resource, Z19 mutatiebewijs] ZONDER per-toewijzing workMinutes (volle-duur-wandeling) wijkt "Task A".scheduleFinish af van MSP's antwoord (bewijst dat de apportionering de bepalende factor is, kreeg ${naiveWalkFinish})`,
            naiveWalkFinish !== '2006-08-30T08:00',
          );
        }
        if (contoured) {
          truthy(
            `[T12 mpp14resource, Z8] "Contoured Task".scheduleFinish === MSP's eigen 2006-09-08T09:08 (laag 3, gelezen venster uit een échte contour-periode, ONAFHANKELIJK van "Task A"'s afwijking, kreeg ${contoured.time.scheduleFinish})`,
            contoured.time.scheduleFinish === '2006-09-08T09:08',
          );
        }
      }
    }
  }
}

{
  const SEGMENTS_FIXTURES: readonly [envVar: string, defaultPath: string, expectedTotal: number][] = [
    [
      'OPS_MPP_SEGMENTS_FIXTURE',
      '/home/nozzit/open-aec/voor claude/testdata-crawl/mpxj/junit/data/mpp14timephasedsegments.mpp',
      11,
    ],
    [
      'OPS_MPP_SEGMENTSMANUAL_FIXTURE',
      '/home/nozzit/open-aec/voor claude/testdata-crawl/mpxj/junit/data/mpp14timephasedsegmentsmanual.mpp',
      12,
    ],
  ];
  for (const [envVar, defaultPath, expectedTotal] of SEGMENTS_FIXTURES) {
    const path = process.env[envVar] ?? defaultPath;
    const label = path.split('/').pop();
    if (!existsSync(path)) {
      console.log(`OK  mpp-import: Z19-L segments-leescase (${label}) niet aanwezig — overgeslagen`);
      continue;
    }
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(new Uint8Array(readFileSync(path)));
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`[Z19-L ${label}] readMPP gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy(
        `[Z19-L ${label}] sourceScheduleNotes.total === ${expectedTotal} (kreeg ${JSON.stringify(result.sourceScheduleNotes)})`,
        result.sourceScheduleNotes?.total === expectedTotal,
      );
      const seven = result.tasks.find((t) => t.name === 'Task Seven');
      const eight = result.tasks.find((t) => t.name === 'Task Eight');
      truthy(
        `[Z19-L ${label}] "Task Seven" draagt timephasedDurationWalks (laag 4, holiday-only-activering)`,
        !!seven?.timephasedDurationWalks && seven.timephasedDurationWalks.length === 1,
      );
      truthy(
        `[Z19-L ${label}] "Task Eight" draagt timephasedDurationWalks (laag 4, holiday-only-activering op de EIGEN taakkalender-override)`,
        !!eight?.timephasedDurationWalks && eight.timephasedDurationWalks.length === 1,
      );
    }
  }
}

{
  function buildPlannedSummaryOnlyBlockL3(totalWorkMinutes: number): Uint8Array {
    const out = new Uint8Array(24);
    const view = new DataView(out.buffer);
    view.setUint16(0, 0, true);
    view.setFloat64(16, totalWorkMinutes * 1000, true);
    return out;
  }

  const taskStart = new Date('2026-08-18T08:00:00.000Z');
  const raw = {
    actualRegularWork: null,
    remainingRegularWork: buildPlannedSummaryOnlyBlockL3(1440),
    actualOvertimeWork: null,
    actualIrregularWork: null,
  };

  const withNullFinish = decodeAssignmentWorkMinutes(raw, taskStart, null);
  truthy(
    `[Z19 L3] assignmentFinish===null gebruikt de terugval (60s na taskStart) i.p.v. leeg terug te geven — workMinutes===1440 (kreeg ${withNullFinish})`,
    withNullFinish === 1440,
  );

  const withArbitraryFinish = decodeAssignmentWorkMinutes(raw, taskStart, new Date('2099-01-01T00:00:00.000Z'));
  truthy(
    `[Z19 L3] workMinutes is ONAFHANKELIJK van welk (niet-null) ankerpunt wordt doorgegeven — zelfde 1440 met een willekeurig ver ankerpunt (kreeg ${withArbitraryFinish})`,
    withArbitraryFinish === 1440,
  );

  const zeroWork = decodeAssignmentWorkMinutes(
    { actualRegularWork: null, remainingRegularWork: buildPlannedSummaryOnlyBlockL3(0), actualOvertimeWork: null, actualIrregularWork: null },
    taskStart, null,
  );
  truthy('[Z19 L3] 0 gedecodeerd werk ⇒ null (niet apportioneerbaar), ook via de null-terugvaltak', zeroWork === null);
}

{
  function encodeUnicodeStringAscii(s: string): Uint8Array {
    const out = new Uint8Array(s.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
    return out;
  }

  const PROJECT_START_DATE_KEY = 37748738;
  const PROJECT_FINISH_DATE_KEY = 37748739;
  const TITLE_KEY = 37748744;
  const DEFAULT_CALENDAR_NAME_KEY = 37748750;
  const PROPSKEY_TASK_FIELD_MAP_Z2 = 131092;

  {
    const fieldMapBytes = buildFieldMapEntryBytes([
      { typeValue: TaskFieldId.UniqueId, dataBlockOffset: 0, category: 3 },
      { typeValue: TaskFieldId.Id, dataBlockOffset: 4, category: 3 },
      { typeValue: TaskFieldId.OutlineLevel, dataBlockOffset: 40, category: 3 },
      { typeValue: TaskFieldId.ScheduledDuration, dataBlockOffset: 42, category: 3 },
      { typeValue: TaskFieldId.DurationUnits, dataBlockOffset: 46, category: 3 },
      { typeValue: TaskFieldId.ConstraintType, dataBlockOffset: 56, category: 3 },
      { typeValue: TaskFieldId.LevelingDelay, dataBlockOffset: 58, category: 3 },
      { typeValue: TaskFieldId.LevelingDelayUnits, dataBlockOffset: 62, category: 3 },
      { typeValue: TaskFieldId.ScheduledStart, dataBlockOffset: 64, category: 3 },
      { typeValue: TaskFieldId.ScheduledFinish, dataBlockOffset: 68, category: 3 },
      { typeValue: TaskFieldId.CalendarUniqueId, dataBlockOffset: 118, category: 3 },
      { typeValue: TaskFieldId.Start, dataBlockOffset: 50, category: 3 },
      { typeValue: TaskFieldId.Finish, dataBlockOffset: 54, category: 3 },
      { typeValue: TaskFieldId.ManualDuration, dataBlockOffset: 58, category: 3 },
      { typeValue: TaskFieldId.ManualDurationUnits, dataBlockOffset: 62, category: 3 },
      { typeValue: TaskFieldId.Name, dataBlockOffset: 65535, category: 8 },
    ]);
    const props = new Props(encodePropsEntries([{ key: PROPSKEY_TASK_FIELD_MAP_Z2, data: fieldMapBytes }]), 'Z2-fieldmap-block1');
    const map = createTaskFieldMap(props);

    truthy('[Z2 veldmap] Start (1283) → fixed2@50', fixed2OffsetOf(map, TaskFieldId.Start) === 50);
    truthy('[Z2 veldmap] Finish (1284) → fixed2@54', fixed2OffsetOf(map, TaskFieldId.Finish) === 54);
    truthy('[Z2 veldmap] ManualDuration (1288) → fixed2@58', fixed2OffsetOf(map, TaskFieldId.ManualDuration) === 58);
    truthy('[Z2 veldmap] ManualDurationUnits (1289) → fixed2@62', fixed2OffsetOf(map, TaskFieldId.ManualDurationUnits) === 62);
    truthy('[Z2 veldmap] LevelingDelay (20) → fixed@58 (blok 0, NIET blok 1)', fixedOffsetOf(map, TaskFieldId.LevelingDelay) === 58);
    truthy('[Z2 veldmap] LevelingDelayUnits (178) → fixed@62 (blok 0)', fixedOffsetOf(map, TaskFieldId.LevelingDelayUnits) === 62);
    truthy('[Z2 veldmap] ScheduledStart (35) blijft blok 0 @64', fixedOffsetOf(map, TaskFieldId.ScheduledStart) === 64);
    truthy('[Z2 veldmap] Start (1283) NIET via fixedOffsetOf (blok 0)', fixedOffsetOf(map, TaskFieldId.Start) === null);
    truthy('[Z2 veldmap] ManualDuration (1288) NIET via fixedOffsetOf (blok 0)', fixedOffsetOf(map, TaskFieldId.ManualDuration) === null);
    truthy('[Z2 veldmap] LevelingDelay (20) NIET via fixed2OffsetOf (blok 1)', fixed2OffsetOf(map, TaskFieldId.LevelingDelay) === null);
  }

  const Z2_TASK_FIXED_DATA_SIZE = 130;
  const Z2_FIXED2_META_ITEM_SIZE = 92;

  interface Z2TaskSpec {
    name: string;
    uniqueId: number;
    id: number;
    durationRaw: number;
    startTime: number; startDays: number;
    finishTime: number; finishDays: number;
    manual?: boolean;
    manualMetaByte?: number;
    manualStartTime?: number; manualStartDays?: number;
    manualFinishTime?: number; manualFinishDays?: number;
    manualDurationRaw?: number;
    manualDurationUnitsRaw?: number;
    fixed2DataLength?: number;
    mspTaskTypeRaw?: number;
    effortDriven?: boolean;
  }

  function buildZ2TaskFixedDataRecord(t: Z2TaskSpec): Uint8Array {
    const out = new Uint8Array(Z2_TASK_FIXED_DATA_SIZE);
    const view = new DataView(out.buffer);
    view.setInt32(0, t.uniqueId, true);
    view.setInt32(4, t.id, true);
    view.setInt16(40, 1, true);
    view.setInt32(42, t.durationRaw, true);
    view.setInt16(46, 7, true);
    view.setInt16(56, 0, true);
    view.setUint16(64, t.startTime, true);
    view.setUint16(66, t.startDays, true);
    view.setUint16(68, t.finishTime, true);
    view.setUint16(70, t.finishDays, true);
    view.setInt32(118, -1, true);
    if (t.mspTaskTypeRaw !== undefined) view.setInt16(94, t.mspTaskTypeRaw, true);
    return out;
  }

  function buildZ2TaskFixedMetaRecord(offsetIntoFixedData: number, effortDriven?: boolean): Uint8Array {
    const out = new Uint8Array(47);
    new DataView(out.buffer).setInt32(4, offsetIntoFixedData, true);
    if (effortDriven) out[11] = 0x10;
    return out;
  }

  function buildZ2FixedMetaBlob(items: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(16 + items.length * 47);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0xfadfadba, true);
    view.setInt32(8, items.length, true);
    items.forEach((item, i) => out.set(item, 16 + i * 47));
    return out;
  }

  function buildZ2Fixed2MetaRecord(offsetIntoFixed2Data: number, manual: boolean, metaByteOverride?: number): Uint8Array {
    const out = new Uint8Array(Z2_FIXED2_META_ITEM_SIZE);
    const view = new DataView(out.buffer);
    view.setInt32(4, offsetIntoFixed2Data, true);
    out[8] = metaByteOverride !== undefined ? metaByteOverride : (manual ? 0x08 : 0x00);
    return out;
  }

  function buildZ2Fixed2MetaBlob(items: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(16 + items.length * Z2_FIXED2_META_ITEM_SIZE);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0xfadfadba, true);
    view.setInt32(8, items.length, true);
    items.forEach((item, i) => out.set(item, 16 + i * Z2_FIXED2_META_ITEM_SIZE));
    return out;
  }

  function buildZ2Fixed2DataRecord(t: Z2TaskSpec): Uint8Array {
    const length = t.fixed2DataLength ?? 70;
    const out = new Uint8Array(length);
    const view = new DataView(out.buffer);
    if (t.manualStartTime !== undefined && length >= 54) {
      view.setUint16(50, t.manualStartTime, true);
      view.setUint16(52, t.manualStartDays ?? 0, true);
    }
    if (t.manualFinishTime !== undefined && length >= 58) {
      view.setUint16(54, t.manualFinishTime, true);
      view.setUint16(56, t.manualFinishDays ?? 0, true);
    }
    if (t.manualDurationRaw !== undefined && length >= 62) {
      view.setInt32(58, t.manualDurationRaw, true);
    }
    if (t.manualDurationUnitsRaw !== undefined && length >= 64) {
      view.setInt16(62, t.manualDurationUnitsRaw, true);
    }
    return out;
  }

  const Z2_CAL_DAYS = [
    { defaultFlag: 0 as const },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const },
  ];

  function buildZ2Fixture(
    tasks: Z2TaskSpec[],
    opts: { includeFixed2?: boolean; corruptFixed2Meta?: boolean; applicationName?: string } = {},
  ): Uint8Array {
    const includeFixed2 = opts.includeFixed2 ?? true;
    const n = tasks.length;
    const dummyMeta = buildZ2TaskFixedMetaRecord(0);
    const metas = tasks.map((t, i) => buildZ2TaskFixedMetaRecord((3 + i) * Z2_TASK_FIXED_DATA_SIZE, t.effortDriven));
    const fixedMetaBlob = buildZ2FixedMetaBlob([dummyMeta, dummyMeta, dummyMeta, ...metas]);

    const fixedDataBlob = new Uint8Array((3 + n) * Z2_TASK_FIXED_DATA_SIZE);
    tasks.forEach((t, i) => fixedDataBlob.set(buildZ2TaskFixedDataRecord(t), (3 + i) * Z2_TASK_FIXED_DATA_SIZE));

    let fixed2MetaBlob: Uint8Array | undefined;
    let fixed2DataBlob: Uint8Array | undefined;
    if (includeFixed2) {
      const dummyFixed2Data = new Uint8Array(8);
      const fixed2Records = tasks.map((t) => buildZ2Fixed2DataRecord(t));
      const fixed2Offsets: number[] = [];
      let offset = 24;
      for (const rec of fixed2Records) { fixed2Offsets.push(offset); offset += rec.length; }
      fixed2DataBlob = new Uint8Array(offset);
      fixed2DataBlob.set(dummyFixed2Data, 0);
      fixed2DataBlob.set(dummyFixed2Data, 8);
      fixed2DataBlob.set(dummyFixed2Data, 16);
      fixed2Records.forEach((rec, i) => fixed2DataBlob!.set(rec, fixed2Offsets[i]));

      const dummyFixed2Meta = buildZ2Fixed2MetaRecord(0, false);
      const fixed2Metas = tasks.map((t, i) => buildZ2Fixed2MetaRecord(fixed2Offsets[i], !!t.manual, t.manualMetaByte));
      fixed2MetaBlob = buildZ2Fixed2MetaBlob([dummyFixed2Meta, dummyFixed2Meta, dummyFixed2Meta, ...fixed2Metas]);
      if (opts.corruptFixed2Meta) fixed2MetaBlob = new Uint8Array(4);
    }

    let nameOffset = 0;
    const varMetaEntries: { uniqueId: number; type: number; offset: number }[] = [];
    const namePayloads: { offset: number; payload: Uint8Array }[] = [];
    for (const t of tasks) {
      varMetaEntries.push({ uniqueId: t.uniqueId, type: TaskFieldId.Name, offset: nameOffset });
      const payload = encodeUnicodeStringAscii(t.name);
      namePayloads.push({ offset: nameOffset, payload });
      nameOffset += 4 + payload.length;
    }
    const taskVarMetaBytes = buildVarMetaBytes(varMetaEntries);
    const taskVar2DataBuf = new Uint8Array(Math.max(nameOffset, 1));
    const taskVar2View = new DataView(taskVar2DataBuf.buffer);
    for (const { offset, payload } of namePayloads) {
      taskVar2View.setInt32(offset, payload.length, true);
      taskVar2DataBuf.set(payload, offset + 4);
    }

    const fieldMapBytes = buildFieldMapEntryBytes([
      { typeValue: TaskFieldId.UniqueId, dataBlockOffset: 0, category: 3 },
      { typeValue: TaskFieldId.Id, dataBlockOffset: 4, category: 3 },
      { typeValue: TaskFieldId.OutlineLevel, dataBlockOffset: 40, category: 3 },
      { typeValue: TaskFieldId.ScheduledDuration, dataBlockOffset: 42, category: 3 },
      { typeValue: TaskFieldId.DurationUnits, dataBlockOffset: 46, category: 3 },
      { typeValue: TaskFieldId.ConstraintType, dataBlockOffset: 56, category: 3 },
      { typeValue: TaskFieldId.ScheduledStart, dataBlockOffset: 64, category: 3 },
      { typeValue: TaskFieldId.ScheduledFinish, dataBlockOffset: 68, category: 3 },
      { typeValue: TaskFieldId.Type, dataBlockOffset: 94, category: 3 },
      { typeValue: TaskFieldId.CalendarUniqueId, dataBlockOffset: 118, category: 3 },
      { typeValue: TaskFieldId.Start, dataBlockOffset: 50, category: 3 },
      { typeValue: TaskFieldId.Finish, dataBlockOffset: 54, category: 3 },
      { typeValue: TaskFieldId.ManualDuration, dataBlockOffset: 58, category: 3 },
      { typeValue: TaskFieldId.ManualDurationUnits, dataBlockOffset: 62, category: 3 },
      { typeValue: TaskFieldId.Name, dataBlockOffset: 65535, category: 8 },
    ]);

    const calendarName = 'Z2 fixture-kalender';
    const hoursBlock = buildCalHoursBlock(Z2_CAL_DAYS);
    const calFixedMetaBlob = buildCalFixedMetaBlob([0]);
    const calFixedDataBlob = buildCalFixedDataRecord(1, 1, -1);
    const CAL_NAME_OFF = 0, CAL_DATA_OFF = 100;
    const calVarMetaBytes = buildVarMetaBytes([
      { uniqueId: 1, type: 1, offset: CAL_NAME_OFF },
      { uniqueId: 1, type: 8, offset: CAL_DATA_OFF },
    ]);
    const calVar2DataBuf = new Uint8Array(700);
    const calVar2View = new DataView(calVar2DataBuf.buffer);
    const writeCalVar2 = (offset: number, payload: Uint8Array) => {
      calVar2View.setInt32(offset, payload.length, true);
      calVar2DataBuf.set(payload, offset + 4);
    };
    writeCalVar2(CAL_NAME_OFF, encodeUnicodeStringAscii(calendarName));
    writeCalVar2(CAL_DATA_OFF, hoursBlock);

    const projectPropsBytes = encodePropsEntries([
      { key: PROJECT_START_DATE_KEY, data: timestampBytes(0, 15000) },
      { key: PROJECT_FINISH_DATE_KEY, data: timestampBytes(0, 15010) },
      { key: TITLE_KEY, data: encodeUnicodeStringAscii('Z2-fixture') },
      { key: DEFAULT_CALENDAR_NAME_KEY, data: encodeUnicodeStringAscii(calendarName) },
      { key: PROPSKEY_TASK_FIELD_MAP_Z2, data: fieldMapBytes },
    ]);

    const taskChildren: Record<string, CfbTreeNode> = {
      FixedMeta: { data: fixedMetaBlob },
      FixedData: { data: fixedDataBlob },
      VarMeta: { data: taskVarMetaBytes },
      Var2Data: { data: taskVar2DataBuf },
    };
    if (fixed2MetaBlob && fixed2DataBlob) {
      taskChildren.Fixed2Meta = { data: fixed2MetaBlob };
      taskChildren.Fixed2Data = { data: fixed2DataBlob };
    }

    const tree: Record<string, CfbTreeNode> = {
      '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14', opts.applicationName) },
      Props14: { data: encodePropsSingleByteEntry(893386752, 0) },
      '   114': {
        children: {
          Props: { data: projectPropsBytes },
          TBkndTask: { children: taskChildren },
          TBkndCal: {
            children: {
              FixedMeta: { data: calFixedMetaBlob },
              FixedData: { data: calFixedDataBlob },
              VarMeta: { data: calVarMetaBytes },
              Var2Data: { data: calVar2DataBuf },
            },
          },
        },
      },
    };
    return buildNestedCfb(tree);
  }

  function scanZ2(bytes: Uint8Array): ReadTasksResult {
    const { cfb, projectProps, applicationVersion } = openMppProject(bytes);
    const { project, hoursPerDay, calendarHoursPerDayOverride } = parseProjectProperties(projectProps, undefined);
    const taskFieldMap = createTaskFieldMap(projectProps);
    const calResult = readCalendars(cfb, projectProps, applicationVersion, calendarHoursPerDayOverride);
    return readTasks({ cfb, taskFieldMap, hoursPerDay, statusDate: project.statusDate, applicationVersion, calResult });
  }

  function findRaw(result: ReadTasksResult, uniqueId: number): RawTaskScan | undefined {
    return result.rawScans.find((r) => r.uniqueId === uniqueId);
  }

  function expectedTimestamp(time: number, days: number): Date | null {
    return getTimestamp(timestampBytes(time, days), 0, 'Z2 expected timestamp');
  }

  {
    const bytes = buildZ2Fixture([
      { name: 'Auto', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000 },
      {
        name: 'Manual', uniqueId: 11, id: 2, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000,
        manual: true,
        manualStartTime: 4800, manualStartDays: 15003, manualFinishTime: 9600, manualFinishDays: 15005,
        manualDurationRaw: 28800, manualDurationUnitsRaw: 8,
      },
    ]);
    let result: ReadTasksResult | null = null;
    let threw: string | null = null;
    try { result = scanZ2(bytes); } catch (err) { threw = err instanceof Error ? err.message : String(err); }
    truthy(`[Z2 end-to-end] readTasks gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      truthy('[Z2 end-to-end] 2 taken', result.rawScans.length === 2);
      const auto = findRaw(result, 10);
      const manual = findRaw(result, 11);
      truthy('[Z2 end-to-end] Auto-taak gevonden', !!auto);
      truthy('[Z2 end-to-end] Manual-taak gevonden', !!manual);
      if (auto) {
        truthy('[Z2 end-to-end] Auto: taskMode === AUTO_SCHEDULED', auto.taskMode === 'AUTO_SCHEDULED');
        truthy('[Z2 end-to-end] Auto: manualStartTs === null (dagwaarde 0 ⇒ NA-conventie)', auto.manualStartTs === null);
        truthy('[Z2 end-to-end] Auto: manualFinishTs === null', auto.manualFinishTs === null);
        truthy('[Z2 end-to-end] Auto: manualDurationRaw === 0 (ongeschreven bytes, geen NA-sentinel voor duur)', auto.manualDurationRaw === 0);
        truthy('[Z2 end-to-end] Auto: manualDurationIsElapsed === false', auto.manualDurationIsElapsed === false);
      }
      if (manual) {
        truthy('[Z2 end-to-end] Manual: taskMode === MANUALLY_SCHEDULED', manual.taskMode === 'MANUALLY_SCHEDULED');
        const expStart = expectedTimestamp(4800, 15003);
        const expFinish = expectedTimestamp(9600, 15005);
        truthy(
          `[Z2 end-to-end] Manual: manualStartTs klopt (kreeg ${manual.manualStartTs?.toISOString()})`,
          !!manual.manualStartTs && !!expStart && manual.manualStartTs.getTime() === expStart.getTime(),
        );
        truthy(
          `[Z2 end-to-end] Manual: manualFinishTs klopt (kreeg ${manual.manualFinishTs?.toISOString()})`,
          !!manual.manualFinishTs && !!expFinish && manual.manualFinishTs.getTime() === expFinish.getTime(),
        );
        truthy(`[Z2 end-to-end] Manual: manualDurationRaw === 28800 (kreeg ${manual.manualDurationRaw})`, manual.manualDurationRaw === 28800);
        truthy('[Z2 end-to-end] Manual: manualDurationIsElapsed === true (code 8 = elapsedDays)', manual.manualDurationIsElapsed === true);
      }
      const manualTask = result.tasks.find((t) => t.name === 'Manual');
      const autoTask = result.tasks.find((t) => t.name === 'Auto');
      truthy('[Z2 end-to-end] gebouwde Manual-taak gevonden', !!manualTask);
      truthy('[Z2 end-to-end] gebouwde Auto-taak gevonden', !!autoTask);
      if (manualTask) {
        truthy(
          `[Z2 end-to-end] Manual: Task.time.scheduleStart komt uit MANUAL_START (dag 15003), NIET uit SCHEDULED_START (kreeg ${manualTask.time.scheduleStart})`,
          manualTask.time.scheduleStart === formatInstant(expectedTimestamp(4800, 15003)!, 'hour'),
        );
        truthy(
          `[Z2 end-to-end] Manual: Task.time.scheduleFinish komt uit MANUAL_FINISH (dag 15005), NIET uit SCHEDULED_FINISH (kreeg ${manualTask.time.scheduleFinish})`,
          manualTask.time.scheduleFinish === formatInstant(expectedTimestamp(9600, 15005)!, 'hour'),
        );
        truthy('[Z2 end-to-end] Manual: Task.manuallyScheduled === true (doorzetregel)', manualTask.manuallyScheduled === true);
      }
      if (autoTask) {
        truthy(
          `[Z2 end-to-end] Auto: Task.time.scheduleStart blijft SCHEDULED_START (dag 15000, ongewijzigd t.o.v. vóór Z9a) (kreeg ${autoTask.time.scheduleStart})`,
          autoTask.time.scheduleStart === formatInstant(expectedTimestamp(4800, 15000)!, 'hour'),
        );
        truthy('[Z2 end-to-end] Auto: Task.manuallyScheduled is falsy', !autoTask.manuallyScheduled);
      }
    }
  }

  {
    const bytes = buildZ2Fixture([
      {
        name: 'ManualNoOwnAnchor', uniqueId: 20, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000,
        manual: true,
      },
      {
        name: 'AutoWithStaleManualBytes', uniqueId: 21, id: 2, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000,
        manualStartTime: 4800, manualStartDays: 15010, manualFinishTime: 9600, manualFinishDays: 15012,
      },
    ]);
    const result = scanZ2(bytes);
    const noAnchor = result.rawScans.find((r) => r.uniqueId === 20);
    const staleAuto = result.rawScans.find((r) => r.uniqueId === 21);
    truthy('[Z2e terugval] ManualNoOwnAnchor: taskMode === MANUALLY_SCHEDULED', noAnchor?.taskMode === 'MANUALLY_SCHEDULED');
    truthy('[Z2e terugval] ManualNoOwnAnchor: manualStartTs === null (ongezet)', noAnchor?.manualStartTs === null);
    truthy('[Z2e terugval] AutoWithStaleManualBytes: taskMode === AUTO_SCHEDULED', staleAuto?.taskMode === 'AUTO_SCHEDULED');
    truthy(
      '[Z2e terugval] AutoWithStaleManualBytes: manualStartTs toch gelezen (dag 15010, ongeacht taskMode)',
      !!staleAuto?.manualStartTs && staleAuto.manualStartTs.getTime() === expectedTimestamp(4800, 15010)!.getTime(),
    );

    const noAnchorTask = result.tasks.find((t) => t.name === 'ManualNoOwnAnchor');
    const staleAutoTask = result.tasks.find((t) => t.name === 'AutoWithStaleManualBytes');
    truthy('[Z2e terugval] gebouwde ManualNoOwnAnchor-taak gevonden', !!noAnchorTask);
    truthy('[Z2e terugval] gebouwde AutoWithStaleManualBytes-taak gevonden', !!staleAutoTask);
    if (noAnchorTask) {
      truthy(
        `[Z2e terugval] MANUAL zonder eigen anker: scheduleStart valt terug op SCHEDULED_START (dag 15000) (kreeg ${noAnchorTask.time.scheduleStart})`,
        noAnchorTask.time.scheduleStart === formatInstant(expectedTimestamp(4800, 15000)!, 'hour'),
      );
      truthy('[Z2e terugval] MANUAL zonder eigen anker: Task.manuallyScheduled === true', noAnchorTask.manuallyScheduled === true);
    }
    if (staleAutoTask) {
      truthy(
        `[Z2e terugval] AUTO met toevallige manual-bytes: scheduleStart blijft SCHEDULED_START (dag 15000), manual-bytes genegeerd (kreeg ${staleAutoTask.time.scheduleStart})`,
        staleAutoTask.time.scheduleStart === formatInstant(expectedTimestamp(4800, 15000)!, 'hour'),
      );
      truthy('[Z2e terugval] AUTO met toevallige manual-bytes: Task.manuallyScheduled is falsy', !staleAutoTask.manuallyScheduled);
    }
  }

  {
    const HOSTILE_RAW = 2_000_000_000;
    const bytes = buildZ2Fixture([
      {
        name: 'HostileDuration', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000,
        manual: true, manualDurationRaw: HOSTILE_RAW, manualDurationUnitsRaw: 7,
      },
    ]);
    const result = scanZ2(bytes);
    const raw = findRaw(result, 10);
    truthy(
      `[Z2 clamp] manualDurationRaw geklemd op MAX_MANUAL_DURATION_TENTHS (kreeg ${raw?.manualDurationRaw})`,
      raw?.manualDurationRaw === MAX_MANUAL_DURATION_TENTHS,
    );
  }

  {
    const bytes2c = buildZ2Fixture(
      [{
        name: 'Modern0x80', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000,
        manualMetaByte: 0x80,
      }],
      { applicationName: 'Microsoft.Project 16.0' },
    );
    const raw2c = findRaw(scanZ2(bytes2c), 10);
    truthy(
      `[Z2 modern 0x80] taskMode === MANUALLY_SCHEDULED op een 2013+-fixture (kreeg ${raw2c?.taskMode})`,
      raw2c?.taskMode === 'MANUALLY_SCHEDULED',
    );

    const bytes2d = buildZ2Fixture(
      [{
        name: 'Modern0x08Only', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000,
        manualMetaByte: 0x08,
      }],
      { applicationName: 'Microsoft.Project 16.0' },
    );
    const raw2d = findRaw(scanZ2(bytes2d), 10);
    truthy(
      `[Z2 modern 0x08-only] taskMode === AUTO_SCHEDULED — het legacy-bit alléén telt niet op een 2013+-bestand (kreeg ${raw2d?.taskMode})`,
      raw2d?.taskMode === 'AUTO_SCHEDULED',
    );
  }

  {
    const bytesTT = buildZ2Fixture([
      {
        name: 'TypeDurationEffort', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000,
        mspTaskTypeRaw: 1, effortDriven: true,
      },
      {
        name: 'TypeOutOfRange', uniqueId: 11, id: 2, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000,
        mspTaskTypeRaw: 99,
      },
      {
        name: 'TypeUnitsNoEffort', uniqueId: 13, id: 4, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000,
        mspTaskTypeRaw: 0,
      },
    ]);
    const resultTT = scanZ2(bytesTT);
    const rawA = findRaw(resultTT, 10);
    const rawB = findRaw(resultTT, 11);
    truthy('[Z14b type] rauwe mspTaskTypeRaw === 1', rawA?.mspTaskTypeRaw === 1);
    truthy('[Z14b type] rauwe effortDrivenRaw === true', rawA?.effortDrivenRaw === true);

    const taskA = resultTT.tasks.find((t) => t.name === 'TypeDurationEffort');
    const taskB = resultTT.tasks.find((t) => t.name === 'TypeOutOfRange');
    const taskD = resultTT.tasks.find((t) => t.name === 'TypeUnitsNoEffort');
    truthy(`[Z14b type] TYPE=1 ⇒ Task.mspTaskType === 'FIXED_DURATION' (kreeg ${taskA?.mspTaskType})`, taskA?.mspTaskType === 'FIXED_DURATION');
    truthy(`[Z14b type] effortDriven-bit gezet ⇒ Task.effortDriven === true (kreeg ${taskA?.effortDriven})`, taskA?.effortDriven === true);
    truthy(`[Z14b type] TYPE=99 (buiten bereik) ⇒ MPXJ-terugval FIXED_WORK (kreeg ${taskB?.mspTaskType})`, taskB?.mspTaskType === 'FIXED_WORK');
    truthy('[Z14b type] rawB.mspTaskTypeRaw === 99 (de rauwe, ongeldige waarde blijft zichtbaar)', rawB?.mspTaskTypeRaw === 99);
    truthy(`[Z14b type] TYPE=0 ⇒ Task.mspTaskType === 'FIXED_UNITS' (kreeg ${taskD?.mspTaskType})`, taskD?.mspTaskType === 'FIXED_UNITS');
    truthy(`[Z14b type] geen effortDriven-bit ⇒ Task.effortDriven blijft ONGEZET, nooit false (kreeg ${taskD?.effortDriven})`, taskD?.effortDriven === undefined);
  }

  {
    const fieldMapNoType = buildFieldMapEntryBytes([
      { typeValue: TaskFieldId.UniqueId, dataBlockOffset: 0, category: 3 },
      { typeValue: TaskFieldId.ScheduledStart, dataBlockOffset: 64, category: 3 },
      { typeValue: TaskFieldId.CalendarUniqueId, dataBlockOffset: 118, category: 3 },
      { typeValue: TaskFieldId.Name, dataBlockOffset: 65535, category: 8 },
    ]);
    const propsNoType = new Props(
      encodePropsEntries([{ key: PROPSKEY_TASK_FIELD_MAP_Z2, data: fieldMapNoType }]),
      'Z14b-fieldmap-no-type',
    );
    truthy('[Z14b type] veldmap zonder TYPE-entry ⇒ fixedOffsetOf(Type) === null',
      fixedOffsetOf(createTaskFieldMap(propsNoType), TaskFieldId.Type) === null);
    truthy('[Z14b type] mspTaskTypeFromRaw(null) === undefined (het "afwezig"-onderscheid t.o.v. TYPE=99)',
      mspTaskTypeFromRaw(null) === undefined);
  }

  {
    const F4_CORPUS = process.env.OPS_MPP_CORPUS ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
    const F4_CRAWL = crawlScopes.root;

    function listMppFilesRecursiveF4(dir: string): string[] {
      const out: string[] = [];
      const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listMppFilesRecursiveF4(full));
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mpp')) out.push(full);
      }
      return out;
    }

    let filesFound = 0;
    let filesScanned = 0;
    let filesFailed = 0;
    let legacyRejected = 0;
    let tasksScanned = 0;
    let typeFieldPresent = 0;
    let fixedUnits = 0, fixedDuration = 0, fixedWork = 0;
    let effortDrivenCount = 0;
    for (const root of [F4_CORPUS, F4_CRAWL]) {
      if (!existsSync(root)) continue;
      for (const file of listMppFilesRecursiveF4(root)) {
        filesFound++;
        let tag = 'ongelezen bestand';
        try {
          const bytes = new Uint8Array(readFileSync(file));
          tag = hashOf(bytes);
          const entry = readMppCorpusEntry(bytes, scanZ2);
          if (entry.kind === 'legacy') {
            legacyRejected++;
            continue;
          }
          const result = entry.value;
          filesScanned++;
          for (const raw of result.rawScans) {
            tasksScanned++;
            if (raw.mspTaskTypeRaw !== null) {
              typeFieldPresent++;
              const decoded = mspTaskTypeFromRaw(raw.mspTaskTypeRaw);
              if (decoded === 'FIXED_UNITS') fixedUnits++;
              else if (decoded === 'FIXED_DURATION') fixedDuration++;
              else if (decoded === 'FIXED_WORK') fixedWork++;
            }
            if (raw.effortDrivenRaw) effortDrivenCount++;
          }
        } catch (err) {
          filesFailed++;
          checks++;
          diffs.push(`[F4 corpustelling ${tag}] onverwachte leesfout (${err instanceof Error ? err.name : typeof err})`);
        }
      }
    }
    truthy(`[F4 corpustelling] geen onverwachte leesfouten (${filesFailed})`, filesFailed === 0);
    if (filesFound === 0) {
      console.log(`OK  mpp-import: F4 corpusbrede task-type/effort-driven-telling (${F4_CORPUS} / ${F4_CRAWL}) niet aanwezig — overgeslagen`);
    } else {
      truthy(`[F4 corpustelling] minstens 1 bestand gescand (kreeg ${filesScanned})`, filesScanned > 0);
      truthy(`[F4 corpustelling] bestanden gescand === 216 (kreeg ${filesScanned})`, filesScanned === 216);
      truthy(`[F4 corpustelling] taken totaal === 3413 (kreeg ${tasksScanned})`, tasksScanned === 3413);
      truthy(`[F4 corpustelling] taken met TYPE-veld aanwezig === 3413 (kreeg ${typeFieldPresent})`, typeFieldPresent === 3413);
      truthy(`[F4 corpustelling] FIXED_UNITS === 3109 (kreeg ${fixedUnits})`, fixedUnits === 3109);
      truthy(`[F4 corpustelling] FIXED_DURATION === 303 (kreeg ${fixedDuration})`, fixedDuration === 303);
      truthy(`[F4 corpustelling] FIXED_WORK === 1 (kreeg ${fixedWork})`, fixedWork === 1);
      truthy(`[F4 corpustelling] EFFORT_DRIVEN === 216 (kreeg ${effortDrivenCount})`, effortDrivenCount === 216);
      console.log(
        `OK  mpp-import: F4 corpusbrede task-type/effort-driven-telling — ${filesScanned} bestand(en) gescand ` +
        `(${legacyRejected} bewust geweigerd legacy / ${filesFailed} onverwachte leesfouten), ${tasksScanned} taken totaal, ${typeFieldPresent} met TYPE-veld ` +
        `(${fixedUnits} FIXED_UNITS / ${fixedDuration} FIXED_DURATION / ${fixedWork} FIXED_WORK), ${effortDrivenCount} EFFORT_DRIVEN`,
      );
    }
  }

  {
    const bytes = buildZ2Fixture(
      [{ name: 'GeenFixed2', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000 }],
      { includeFixed2: false },
    );
    let result: ReadTasksResult | null = null;
    let threw: string | null = null;
    try { result = scanZ2(bytes); } catch (err) { threw = err instanceof Error ? err.message : String(err); }
    truthy(`[Z2 geen-Fixed2] readTasks gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      const raw = findRaw(result, 10);
      truthy('[Z2 geen-Fixed2] taak gevonden', !!raw);
      if (raw) {
        truthy('[Z2 geen-Fixed2] taskMode === AUTO_SCHEDULED (default zonder Fixed2Meta)', raw.taskMode === 'AUTO_SCHEDULED');
        truthy('[Z2 geen-Fixed2] manualStartTs === null', raw.manualStartTs === null);
        truthy('[Z2 geen-Fixed2] manualFinishTs === null', raw.manualFinishTs === null);
        truthy('[Z2 geen-Fixed2] manualDurationRaw === null', raw.manualDurationRaw === null);
        truthy('[Z2 geen-Fixed2] manualDurationIsElapsed === false', raw.manualDurationIsElapsed === false);
        truthy('[Z2 geen-Fixed2] naam ongewijzigd gelezen', raw.name === 'GeenFixed2');
        truthy('[Z2 geen-Fixed2] SCHEDULED_START ongewijzigd gelezen', raw.startTs?.getTime() === expectedTimestamp(4800, 15000)?.getTime());
      }
    }
  }

  {
    const bytes = buildZ2Fixture(
      [{ name: 'CorruptFixed2Meta', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000 }],
      { corruptFixed2Meta: true },
    );
    let result: ReadTasksResult | null = null;
    let threw: string | null = null;
    try { result = scanZ2(bytes); } catch (err) { threw = err instanceof Error ? err.message : String(err); }
    truthy(`[Z2 corrupt-Fixed2Meta] readTasks gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      const raw = findRaw(result, 10);
      truthy('[Z2 corrupt-Fixed2Meta] taak gevonden', !!raw);
      if (raw) {
        truthy('[Z2 corrupt-Fixed2Meta] taskMode === AUTO_SCHEDULED (catch ⇒ fixed2Meta blijft null)', raw.taskMode === 'AUTO_SCHEDULED');
        truthy('[Z2 corrupt-Fixed2Meta] manualStartTs === null', raw.manualStartTs === null);
        truthy('[Z2 corrupt-Fixed2Meta] manualDurationRaw === null', raw.manualDurationRaw === null);
        truthy('[Z2 corrupt-Fixed2Meta] naam ongewijzigd gelezen', raw.name === 'CorruptFixed2Meta');
      }
    }
  }

  {
    const bytes = buildZ2Fixture([
      {
        name: 'KortFixed2Data', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000,
        manual: true,
        manualStartTime: 4800, manualStartDays: 15003, manualFinishTime: 9600, manualFinishDays: 15005,
        manualDurationRaw: 28800, manualDurationUnitsRaw: 7,
        fixed2DataLength: 52,
      },
    ]);
    let result: ReadTasksResult | null = null;
    let threw: string | null = null;
    try { result = scanZ2(bytes); } catch (err) { threw = err instanceof Error ? err.message : String(err); }
    truthy(`[Z2 vijandig] readTasks gooit niet (${threw ?? ''})`, threw === null);
    if (result) {
      const raw = findRaw(result, 10);
      truthy('[Z2 vijandig] taak gevonden', !!raw);
      if (raw) {
        truthy('[Z2 vijandig] taskMode === MANUALLY_SCHEDULED (Fixed2Meta zelf ongemoeid)', raw.taskMode === 'MANUALLY_SCHEDULED');
        truthy('[Z2 vijandig] manualStartTs === null (record te kort voor offset 50)', raw.manualStartTs === null);
        truthy('[Z2 vijandig] manualFinishTs === null (record te kort voor offset 54)', raw.manualFinishTs === null);
        truthy('[Z2 vijandig] manualDurationRaw === null (record te kort voor offset 58)', raw.manualDurationRaw === null);
        truthy('[Z2 vijandig] manualDurationIsElapsed === false (record te kort voor offset 62)', raw.manualDurationIsElapsed === false);
      }
    }
  }

  {
    const Z2_CORPUS = process.env.OPS_MPP_CORPUS ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
    const Z2_CRAWL = crawlScopes.root;

    function listMppFilesRecursiveZ2(dir: string): string[] {
      const out: string[] = [];
      const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listMppFilesRecursiveZ2(full));
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mpp')) out.push(full);
      }
      return out;
    }

    let filesScanned = 0;
    let filesFailed = 0;
    let tasksScanned = 0;
    let manualTasks = 0;
    for (const root of [Z2_CORPUS, Z2_CRAWL]) {
      if (!existsSync(root)) continue;
      for (const file of listMppFilesRecursiveZ2(root)) {
        try {
          const result = scanZ2(new Uint8Array(readFileSync(file)));
          filesScanned++;
          tasksScanned += result.rawScans.length;
          manualTasks += result.rawScans.filter((r) => r.taskMode === 'MANUALLY_SCHEDULED').length;
        } catch {
          filesFailed++;
        }
      }
    }
    if (filesScanned === 0) {
      console.log(`OK  mpp-import: Z2 corpusbrede manual-taken-telling (${Z2_CORPUS} / ${Z2_CRAWL}) niet aanwezig — overgeslagen`);
    } else {
      truthy(`[Z2 corpustelling] minstens 1 bestand gescand (kreeg ${filesScanned})`, filesScanned > 0);
      console.log(
        `OK  mpp-import: Z2 corpusbrede manual-taken-telling — ${filesScanned} bestand(en) gescand ` +
        `(${filesFailed} onleesbaar/overgeslagen), ${tasksScanned} taken totaal, ${manualTasks} MANUALLY_SCHEDULED via déze lezer`,
      );
    }
  }
}

{
  const Z3_REFERENCE_START = new Date('2026-01-05T08:00:00.000Z');

  function buildRegularBlock(
    periods: { cumulativeWorkRaw: number; cumulativeElapsedRaw: number }[],
    opts: { headerCountClaim?: number; totalWorkMinutes?: number; totalElapsedMinutes?: number; finishTimeRaw?: number } = {},
  ): Uint8Array {
    const headerCount = opts.headerCountClaim ?? periods.length;
    const out = new Uint8Array(16 + 20 + periods.length * 20);
    const view = new DataView(out.buffer);
    view.setUint16(0, headerCount, true);
    view.setFloat64(16, (opts.totalWorkMinutes ?? 999) * 1000, true);
    view.setInt32(24, opts.finishTimeRaw ?? 2_000_000_000, true);
    view.setInt32(16 + 16, (opts.totalElapsedMinutes ?? 999) * 80, true);
    periods.forEach((p, i) => {
      const offset = 36 + i * 20;
      view.setFloat64(offset, p.cumulativeWorkRaw, true);
      view.setInt32(offset + 16, p.cumulativeElapsedRaw, true);
    });
    return out;
  }

  function buildRegularBlockMinutes(
    periods: { cumulativeWorkMinutes: number; cumulativeElapsedMinutes: number }[],
    opts: { headerCountClaim?: number } = {},
  ): Uint8Array {
    return buildRegularBlock(
      periods.map((p) => ({ cumulativeWorkRaw: p.cumulativeWorkMinutes * 1000, cumulativeElapsedRaw: p.cumulativeElapsedMinutes * 80 })),
      opts,
    );
  }

  function buildPlannedBlock(
    periods: { cumulativeWorkMinutes: number; cumulativeElapsedMinutes: number }[],
    opts: { headerCountClaim?: number } = {},
  ): Uint8Array {
    const headerCount = opts.headerCountClaim ?? periods.length;
    const out = new Uint8Array(16 + 28 + periods.length * 28);
    const view = new DataView(out.buffer);
    view.setUint16(0, headerCount, true);
    view.setFloat64(16, 999 * 1000, true);
    view.setInt32(16 + 24, 999 * 80, true);
    periods.forEach((p, i) => {
      const offset = 44 + i * 28;
      view.setFloat64(offset, p.cumulativeWorkMinutes * 1000, true);
      view.setInt32(offset + 24, p.cumulativeElapsedMinutes * 80, true);
    });
    return out;
  }

  function buildPlannedSummaryOnlyBlock(totalWorkMinutes: number): Uint8Array {
    const out = new Uint8Array(24);
    const view = new DataView(out.buffer);
    view.setUint16(0, 0, true);
    view.setFloat64(16, totalWorkMinutes * 1000, true);
    return out;
  }

  function buildIrregularBlock(records: { startTime: number; startDays: number; finishTime: number; finishDays: number }[], headerCountClaim?: number): Uint8Array {
    const headerCount = headerCountClaim ?? records.length;
    const out = new Uint8Array(16 + records.length * 8);
    const view = new DataView(out.buffer);
    view.setUint16(0, headerCount, true);
    records.forEach((r, i) => {
      const offset = 16 + i * 8;
      view.setUint16(offset, r.startTime, true);
      view.setUint16(offset + 2, r.startDays, true);
      view.setUint16(offset + 4, r.finishTime, true);
      view.setUint16(offset + 6, r.finishDays, true);
    });
    return out;
  }

  {
    const block = buildRegularBlockMinutes([
      { cumulativeWorkMinutes: 480, cumulativeElapsedMinutes: 480 },
      { cumulativeWorkMinutes: 960, cumulativeElapsedMinutes: 960 },
      { cumulativeWorkMinutes: 1440, cumulativeElapsedMinutes: 1440 },
    ]);
    const result = decodeRegularTimephasedWork(block, Z3_REFERENCE_START, 'Z3-1a');
    truthy('[Z3 1a] 3 periodes gedecodeerd', result.length === 3);
    const expected = [
      { startMin: 0, finishMin: 480, work: 480 },
      { startMin: 480, finishMin: 960, work: 480 },
      { startMin: 960, finishMin: 1440, work: 480 },
    ];
    expected.forEach((e, i) => {
      const entry = result[i];
      truthy(`[Z3 1a] periode ${i}: elapsedWorkMinutesStart`, !!entry && entry.elapsedWorkMinutesStart === e.startMin);
      truthy(`[Z3 1a] periode ${i}: elapsedWorkMinutesEnd`, !!entry && entry.elapsedWorkMinutesEnd === e.finishMin);
      truthy(`[Z3 1a] periode ${i}: workMinutes === ${e.work}`, !!entry && entry.workMinutes === e.work);
      truthy(`[Z3 1a] periode ${i}: approxStart`, !!entry && entry.approxStart.getTime() === Z3_REFERENCE_START.getTime() + e.startMin * 60_000);
      truthy(`[Z3 1a] periode ${i}: approxFinish`, !!entry && entry.approxFinish.getTime() === Z3_REFERENCE_START.getTime() + e.finishMin * 60_000);
    });
  }

  {
    const block = buildRegularBlockMinutes([
      { cumulativeWorkMinutes: 240, cumulativeElapsedMinutes: 240 },
      { cumulativeWorkMinutes: 240, cumulativeElapsedMinutes: 360 },
      { cumulativeWorkMinutes: 540, cumulativeElapsedMinutes: 660 },
    ]);
    const result = decodeRegularTimephasedWork(block, Z3_REFERENCE_START, 'Z3-1b');
    truthy('[Z3 1b] 3 periodes gedecodeerd (gat NIET weggefilterd)', result.length === 3);
    truthy('[Z3 1b] periode 0: workMinutes === 240', result[0]?.workMinutes === 240);
    truthy('[Z3 1b] periode 1 (GAT): workMinutes === 0', result[1]?.workMinutes === 0);
    truthy(
      '[Z3 1b] periode 1 (GAT): toch een reële werktijdspanne (120 min elapsed)',
      !!result[1] && result[1].elapsedWorkMinutesEnd - result[1].elapsedWorkMinutesStart === 120,
    );
    truthy('[Z3 1b] periode 2: workMinutes === 300', result[2]?.workMinutes === 300);
  }

  {
    const truncationBlock = buildRegularBlock([
      { cumulativeWorkRaw: 0.99, cumulativeElapsedRaw: 100 * 80 },
      { cumulativeWorkRaw: 9.32, cumulativeElapsedRaw: 200 * 80 },
    ]);
    const truncationResult = decodeRegularTimephasedWork(truncationBlock, Z3_REFERENCE_START, 'Z3-F3b-truncation');
    truthy(
      '[Z3 F3b] truncatie: workMinutes === 1/60 (getrunceerd verschil 9−0=9 → 0,54s → naar boven afgerond), NIET 0 (het ongetrunceerde verschil 8,33 zou naar beneden afronden)',
      truncationResult[1]?.workMinutes === 1 / 60,
    );

    const roundingNearZeroBlock = buildRegularBlock([
      { cumulativeWorkRaw: 8000, cumulativeElapsedRaw: 100 * 80 },
      { cumulativeWorkRaw: 8004, cumulativeElapsedRaw: 200 * 80 },
    ]);
    const roundingNearZeroResult = decodeRegularTimephasedWork(roundingNearZeroBlock, Z3_REFERENCE_START, 'Z3-F3b-rounding-nearzero');
    truthy(
      '[Z3 F3b] secondenafronding: klein reëel residu (0,004 min = 0,24s) komt uit als EXACT workMinutes === 0, niet als 0,004 (Z4 s gat-detectie hangt op exacte 0)',
      roundingNearZeroResult[1]?.workMinutes === 0,
    );

    const rawDelta = 480030;
    const expectedWorkMinutes = Math.round((rawDelta / 1000) * 60) / 60;
    const roundingBlock = buildRegularBlock([
      { cumulativeWorkRaw: 0, cumulativeElapsedRaw: 100 * 80 },
      { cumulativeWorkRaw: rawDelta, cumulativeElapsedRaw: 200 * 80 },
    ]);
    const roundingResult = decodeRegularTimephasedWork(roundingBlock, Z3_REFERENCE_START, 'Z3-F3b-rounding');
    truthy(
      `[Z3 F3b] rondingspariteit: workMinutes === ${expectedWorkMinutes} (afgerond op de seconde, niet ${rawDelta / 1000})`,
      roundingResult[1]?.workMinutes === expectedWorkMinutes,
    );
  }

  {
    const block = buildRegularBlock(
      [
        { cumulativeWorkRaw: 240_000, cumulativeElapsedRaw: 240 * 80 },
        { cumulativeWorkRaw: 300_000, cumulativeElapsedRaw: 2_000_000_000 },
      ],
      { finishTimeRaw: 240 * 80 },
    );
    const result = decodeRegularTimephasedWork(block, Z3_REFERENCE_START, 'Z3-F3a-finishtime');
    truthy('[Z3 F3a] periode 0 (binnen het plafond) blijft normaal: 1 periode gedecodeerd (periode 1 door de guard ontaard/overgeslagen)', result.length === 1);
    truthy('[Z3 F3a] periode 0: workMinutes === 240', result[0]?.workMinutes === 240);
    truthy('[Z3 F3a] periode 0: elapsedWorkMinutesEnd === 240 (niet 25.000.000 — de guard ving de corrupte periode 1 af)', result[0]?.elapsedWorkMinutesEnd === 240);
  }

  {
    const block = buildPlannedBlock([
      { cumulativeWorkMinutes: 480, cumulativeElapsedMinutes: 480 },
      { cumulativeWorkMinutes: 960, cumulativeElapsedMinutes: 960 },
      { cumulativeWorkMinutes: 1440, cumulativeElapsedMinutes: 1440 },
    ]);
    const result = decodePlannedRegularTimephasedWork(block, Z3_REFERENCE_START, undefined, 'Z3-F1-planned');
    truthy('[Z3 F1] 3 periodes gedecodeerd (28-byte-model)', result.length === 3);
    const expected = [
      { startMin: 0, finishMin: 480, work: 480 },
      { startMin: 480, finishMin: 960, work: 480 },
      { startMin: 960, finishMin: 1440, work: 480 },
    ];
    expected.forEach((e, i) => {
      const entry = result[i];
      truthy(`[Z3 F1] periode ${i}: elapsedWorkMinutesStart`, !!entry && entry.elapsedWorkMinutesStart === e.startMin);
      truthy(`[Z3 F1] periode ${i}: elapsedWorkMinutesEnd`, !!entry && entry.elapsedWorkMinutesEnd === e.finishMin);
      truthy(`[Z3 F1] periode ${i}: workMinutes === ${e.work}`, !!entry && entry.workMinutes === e.work);
    });

    const summaryOnly = buildPlannedSummaryOnlyBlock(600);
    const referenceFinish = new Date(Z3_REFERENCE_START.getTime() + 600 * 60_000);
    const withoutFinish = decodePlannedRegularTimephasedWork(summaryOnly, Z3_REFERENCE_START, undefined, 'Z3-F1-blockcount0-no-finish');
    truthy('[Z3 F1] blockCount===0 ZONDER referenceFinish ⇒ lege lijst (gedocumenteerde beperking, geen aanname)', withoutFinish.length === 0);
    const withFinish = decodePlannedRegularTimephasedWork(summaryOnly, Z3_REFERENCE_START, referenceFinish, 'Z3-F1-blockcount0-finish');
    truthy('[Z3 F1] blockCount===0 MET referenceFinish ⇒ 1 samenvattend record', withFinish.length === 1);
    truthy('[Z3 F1] blockCount===0: workMinutes === 600 (het totale werk)', withFinish[0]?.workMinutes === 600);
    truthy('[Z3 F1] blockCount===0: approxStart === referenceStart, approxFinish === referenceFinish', withFinish[0]?.approxStart.getTime() === Z3_REFERENCE_START.getTime() && withFinish[0]?.approxFinish.getTime() === referenceFinish.getTime());
  }

  {
    const rec1Start = getTimestamp(timestampBytes(0, 200), 0)!;
    const rec1Finish = getTimestamp(timestampBytes(600, 200), 0)!;
    const rec2Start = getTimestamp(timestampBytes(0, 205), 0)!;
    const rec2Finish = getTimestamp(timestampBytes(1200, 205), 0)!;
    truthy('[Z3 1c] fixture-voorwaarde: beide timestamp-paren geldig (geen NA)', !!rec1Start && !!rec1Finish && !!rec2Start && !!rec2Finish);

    const block = buildIrregularBlock([
      { startTime: 0, startDays: 200, finishTime: 600, finishDays: 200 },
      { startTime: 0, startDays: 205, finishTime: 1200, finishDays: 205 },
    ]);
    const result = decodeIrregularTimephasedWork(block, 'Z3-1c');
    truthy('[Z3 1c] 2 irreguliere periodes gedecodeerd', result.length === 2);
    truthy('[Z3 1c] periode 0: start/finish exact', !!result[0] && result[0].start.getTime() === rec1Start.getTime() && result[0].finish.getTime() === rec1Finish.getTime());
    truthy('[Z3 1c] periode 0: workMinutes === 60 (volledige tijdspanne)', result[0]?.workMinutes === 60);
    truthy('[Z3 1c] periode 1: start/finish exact', !!result[1] && result[1].start.getTime() === rec2Start.getTime() && result[1].finish.getTime() === rec2Finish.getTime());
    truthy('[Z3 1c] periode 1: workMinutes === 120', result[1]?.workMinutes === 120);
  }

  {
    const hostileRegular = buildRegularBlockMinutes(
      [
        { cumulativeWorkMinutes: 100, cumulativeElapsedMinutes: 100 },
        { cumulativeWorkMinutes: 150, cumulativeElapsedMinutes: 150 },
      ],
      { headerCountClaim: 50_000 },
    );
    const start = Date.now();
    let threwRegular = false;
    let regularResult: TimephasedWorkPeriod[] = [];
    try {
      regularResult = decodeRegularTimephasedWork(hostileRegular, Z3_REFERENCE_START, 'Z3-1d-regular');
    } catch {
      threwRegular = true;
    }
    const elapsedMs = Date.now() - start;
    truthy('[Z3 1d] hostile regulier: geen exceptie', !threwRegular);
    truthy('[Z3 1d] hostile regulier: geklemd naar de structureel mogelijke 2 records (niet 50.000)', regularResult.length === 2);
    truthy(`[Z3 1d] hostile regulier: binnen tijdslimiet (${elapsedMs}ms) — geen poging tot 50.000 iteraties`, elapsedMs < 500);

    const hostileIrregular = buildIrregularBlock(
      [{ startTime: 0, startDays: 200, finishTime: 600, finishDays: 200 }],
      40_000,
    );
    let threwIrregular = false;
    let irregularResult: TimephasedIrregularPeriod[] = [];
    try {
      irregularResult = decodeIrregularTimephasedWork(hostileIrregular, 'Z3-1d-irregular');
    } catch {
      threwIrregular = true;
    }
    truthy('[Z3 1d] hostile irregulier: geen exceptie', !threwIrregular);
    truthy('[Z3 1d] hostile irregulier: geklemd naar de structureel mogelijke 1 record (niet 40.000)', irregularResult.length === 1);

    const hostilePlanned = buildPlannedBlock(
      [
        { cumulativeWorkMinutes: 100, cumulativeElapsedMinutes: 100 },
        { cumulativeWorkMinutes: 150, cumulativeElapsedMinutes: 150 },
      ],
      { headerCountClaim: 40_000 },
    );
    let threwPlanned = false;
    let plannedResult: TimephasedWorkPeriod[] = [];
    try {
      plannedResult = decodePlannedRegularTimephasedWork(hostilePlanned, Z3_REFERENCE_START, undefined, 'Z3-1d-planned');
    } catch {
      threwPlanned = true;
    }
    truthy('[Z3 1d] hostile planned: geen exceptie', !threwPlanned);
    truthy('[Z3 1d] hostile planned: geklemd naar de structureel mogelijke 2 records (niet 40.000)', plannedResult.length === 2);
  }

  {
    truthy('[Z3 rood] data === null (regulier) ⇒ lege lijst, geen exceptie', decodeRegularTimephasedWork(null, Z3_REFERENCE_START).length === 0);
    truthy('[Z3 rood] data === null (irregulier) ⇒ lege lijst, geen exceptie', decodeIrregularTimephasedWork(null).length === 0);
    truthy('[Z3 rood] data === null (planned) ⇒ lege lijst, geen exceptie', decodePlannedRegularTimephasedWork(null, Z3_REFERENCE_START).length === 0);
    truthy('[Z3 rood] data te kort voor zelfs het totaal-record (regulier) ⇒ lege lijst', decodeRegularTimephasedWork(new Uint8Array(20), Z3_REFERENCE_START).length === 0);
    truthy('[Z3 rood] data te kort voor de header (irregulier) ⇒ lege lijst', decodeIrregularTimephasedWork(new Uint8Array(8)).length === 0);
    truthy('[Z3 rood] data te kort voor het summary-werkveld (planned) ⇒ lege lijst', decodePlannedRegularTimephasedWork(new Uint8Array(20), Z3_REFERENCE_START).length === 0);
  }

  {
    const asgFieldMapBytes = buildFieldMapEntryBytes([
      { typeValue: AssignmentFieldId.UniqueId, dataBlockOffset: 0, category: 3 },
      { typeValue: AssignmentFieldId.ActualRegularWork, dataBlockOffset: 65535, category: 8 },
      { typeValue: AssignmentFieldId.RemainingRegularWork, dataBlockOffset: 65535, category: 8 },
      { typeValue: AssignmentFieldId.ActualOvertimeWork, dataBlockOffset: 65535, category: 8 },
      { typeValue: AssignmentFieldId.ActualIrregularWork, dataBlockOffset: 65535, category: 8 },
    ]);
    const asgProps = new Props(encodePropsEntries([{ key: PROPSKEY_ASSIGNMENT_FIELD_MAP, data: asgFieldMapBytes }]), 'Z3-assignment-fieldmap');
    const asgFieldMap = createAssignmentFieldMap(asgProps);

    const actualRegularPayload = Uint8Array.of(1, 2, 3, 4);
    const remainingRegularPayload = Uint8Array.of(5, 6);
    const actualOvertimePayload = Uint8Array.of(7);
    const actualIrregularPayload = buildIrregularBlock([{ startTime: 0, startDays: 200, finishTime: 600, finishDays: 200 }]);

    const varMetaBytes = buildVarMetaBytes([
      { uniqueId: 10, type: AssignmentFieldId.ActualRegularWork, offset: 0 },
      { uniqueId: 10, type: AssignmentFieldId.RemainingRegularWork, offset: 4 + actualRegularPayload.length },
      { uniqueId: 10, type: AssignmentFieldId.ActualOvertimeWork, offset: 4 + actualRegularPayload.length + 4 + remainingRegularPayload.length },
      {
        uniqueId: 10,
        type: AssignmentFieldId.ActualIrregularWork,
        offset: 4 + actualRegularPayload.length + 4 + remainingRegularPayload.length + 4 + actualOvertimePayload.length,
      },
    ]);
    const var2DataBytes = buildVar2DataBytes(
      [
        { offset: 0, payload: actualRegularPayload },
        { offset: 4 + actualRegularPayload.length, payload: remainingRegularPayload },
        { offset: 4 + actualRegularPayload.length + 4 + remainingRegularPayload.length, payload: actualOvertimePayload },
        {
          offset: 4 + actualRegularPayload.length + 4 + remainingRegularPayload.length + 4 + actualOvertimePayload.length,
          payload: actualIrregularPayload,
        },
      ],
      4 + actualRegularPayload.length + 4 + remainingRegularPayload.length + 4 + actualOvertimePayload.length + 4 + actualIrregularPayload.length,
    );

    const cfb = new CfbFile(buildNestedCfb({
      '   114': {
        children: {
          TBkndAssn: {
            children: {
              VarMeta: { data: varMetaBytes },
              Var2Data: { data: var2DataBytes },
            },
          },
        },
      },
    }));

    const raw = readAssignmentTimephasedRaw(cfb, asgFieldMap);
    truthy('[Z3 raw] uid 10 aanwezig', raw.has(10));
    truthy('[Z3 raw] uid 20 (geen var-data) NIET aanwezig', !raw.has(20));
    const uid10 = raw.get(10);
    truthy('[Z3 raw] uid 10: actualRegularWork round-trip', !!uid10 && bytesEqual(uid10.actualRegularWork!, actualRegularPayload));
    truthy('[Z3 raw] uid 10: remainingRegularWork round-trip', !!uid10 && bytesEqual(uid10.remainingRegularWork!, remainingRegularPayload));
    truthy('[Z3 raw] uid 10: actualOvertimeWork round-trip', !!uid10 && bytesEqual(uid10.actualOvertimeWork!, actualOvertimePayload));
    truthy('[Z3 raw] uid 10: actualIrregularWork round-trip', !!uid10 && bytesEqual(uid10.actualIrregularWork!, actualIrregularPayload));
    truthy('[Z3 raw] uid 10: hasAnyTimephasedData === true', !!uid10 && hasAnyTimephasedData(uid10));

    const cfbMissing = new CfbFile(buildNestedCfb({ '   114': { children: {} } }));
    const rawMissing = readAssignmentTimephasedRaw(cfbMissing, asgFieldMap);
    truthy('[Z3 rood] TBkndAssn/VarMeta ontbreekt ⇒ lege map, geen exceptie', rawMissing.size === 0);

    const cfbNoVar2 = new CfbFile(buildNestedCfb({
      '   114': { children: { TBkndAssn: { children: { VarMeta: { data: varMetaBytes } } } } },
    }));
    const rawNoVar2 = readAssignmentTimephasedRaw(cfbNoVar2, asgFieldMap);
    truthy('[Z3 rood] Var2Data ontbreekt (VarMeta wel aanwezig) ⇒ lege map, geen exceptie', rawNoVar2.size === 0);

    const cfbCorruptVarMeta = new CfbFile(buildNestedCfb({
      '   114': { children: { TBkndAssn: { children: { VarMeta: { data: new Uint8Array(5) }, Var2Data: { data: var2DataBytes } } } } },
    }));
    const rawCorrupt = readAssignmentTimephasedRaw(cfbCorruptVarMeta, asgFieldMap);
    truthy('[Z3 rood] VarMeta te kort voor haar eigen header ⇒ try/catch vangt, lege map, geen exceptie', rawCorrupt.size === 0);
  }

  {
    const Z3_CORPUS = process.env.OPS_MPP_CORPUS ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
    const Z3_CRAWL = crawlScopes.root;

    function listMppFilesRecursiveZ3(dir: string): string[] {
      const out: string[] = [];
      const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listMppFilesRecursiveZ3(full));
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mpp')) out.push(full);
      }
      return out;
    }

    const knownTimephasedHashes = new Set<string>();
    try {
      const here = fileURLToPath(new URL('.', import.meta.url));
      const baseline = JSON.parse(readFileSync(join(here, 'mpp-fidelity-baseline.json'), 'utf8')) as {
        files: Record<string, { reason?: string }>;
      };
      for (const [hash, entry] of Object.entries(baseline.files)) {
        const reason = (entry.reason ?? '').toLowerCase();
        if (reason.includes('timephased') || reason.includes('contour')) knownTimephasedHashes.add(hash);
      }
    } catch {
    }

    let filesScanned = 0;
    let filesFailed = 0;
    let filesWithTimephasedData = 0;
    let assignmentsWithTimephasedData = 0;
    const foundHashes = new Set<string>();
    const perCategory = {
      actualRegularWork: { present: 0, decodedNonEmpty: 0 },
      actualOvertimeWork: { present: 0, decodedNonEmpty: 0 },
      actualIrregularWork: { present: 0, decodedNonEmpty: 0 },
      remainingRegularWork: { present: 0, decodedNonEmpty: 0 },
    };
    const decodeRef = new Date('2026-01-01T00:00:00.000Z');
    for (const root of [Z3_CORPUS, Z3_CRAWL]) {
      if (!existsSync(root)) continue;
      for (const file of listMppFilesRecursiveZ3(root)) {
        let bytes: Uint8Array;
        try {
          bytes = new Uint8Array(readFileSync(file));
        } catch {
          filesFailed++;
          continue;
        }
        const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
        try {
          const { cfb, projectProps } = openMppProject(bytes);
          const assignmentFieldMap = createAssignmentFieldMap(projectProps);
          const raw = readAssignmentTimephasedRaw(cfb, assignmentFieldMap);
          filesScanned++;
          let hasAny = false;
          for (const entry of raw.values()) {
            if (!hasAnyTimephasedData(entry)) continue;
            hasAny = true;
            assignmentsWithTimephasedData++;
            if (entry.actualRegularWork) {
              perCategory.actualRegularWork.present++;
              if (decodeRegularTimephasedWork(entry.actualRegularWork, decodeRef).length > 0) perCategory.actualRegularWork.decodedNonEmpty++;
            }
            if (entry.actualOvertimeWork) {
              perCategory.actualOvertimeWork.present++;
              if (decodeRegularTimephasedWork(entry.actualOvertimeWork, decodeRef).length > 0) perCategory.actualOvertimeWork.decodedNonEmpty++;
            }
            if (entry.actualIrregularWork) {
              perCategory.actualIrregularWork.present++;
              if (decodeIrregularTimephasedWork(entry.actualIrregularWork).length > 0) perCategory.actualIrregularWork.decodedNonEmpty++;
            }
            if (entry.remainingRegularWork) {
              perCategory.remainingRegularWork.present++;
              const dummyFinish = new Date(decodeRef.getTime() + 60 * 60_000);
              if (decodePlannedRegularTimephasedWork(entry.remainingRegularWork, decodeRef, dummyFinish).length > 0) perCategory.remainingRegularWork.decodedNonEmpty++;
            }
          }
          if (hasAny) {
            filesWithTimephasedData++;
            foundHashes.add(hash);
          }
        } catch {
          filesFailed++;
        }
      }
    }

    if (filesScanned === 0) {
      console.log(`OK  mpp-import: Z3 corpusbrede timephased-telling (${Z3_CORPUS} / ${Z3_CRAWL}) niet aanwezig — overgeslagen`);
    } else {
      truthy(`[Z3 corpustelling] minstens 1 bestand gescand (kreeg ${filesScanned})`, filesScanned > 0);
      truthy(
        `[Z3 F1-poort] remainingRegularWork decodeert nu ECHTE records voor de meerderheid (${perCategory.remainingRegularWork.decodedNonEmpty}/${perCategory.remainingRegularWork.present})`,
        perCategory.remainingRegularWork.present > 0
          && perCategory.remainingRegularWork.decodedNonEmpty / perCategory.remainingRegularWork.present > 0.5,
      );
      if (knownTimephasedHashes.size > 0) {
        const missing = [...knownTimephasedHashes].filter((h) => !foundHashes.has(h));
        truthy(
          `[Z3 overlap] alle ${knownTimephasedHashes.size} bekende timephased/contour-bestanden uit de fidelity-baseline dragen via déze lezer ook timephased-data`
          + (missing.length > 0 ? ` (${missing.length} MIST: ${missing.join(', ')})` : ''),
          missing.length === 0,
        );
      }
      console.log(
        `OK  mpp-import: Z3 corpusbrede timephased-telling — ${filesScanned} bestand(en) gescand (${filesFailed} onleesbaar/overgeslagen), `
        + `${filesWithTimephasedData} bestand(en) met ≥1 toewijzing met timephased-data (${assignmentsWithTimephasedData} toewijzingen totaal), `
        + `${knownTimephasedHashes.size} bekend uit de fidelity-baseline (overlap hierboven getoetst)`,
      );
      console.log(
        '   . [Z3 per-categorie] '
        + `actualRegularWork ${perCategory.actualRegularWork.present} aanwezig/${perCategory.actualRegularWork.decodedNonEmpty} gedecodeerd, `
        + `actualOvertimeWork ${perCategory.actualOvertimeWork.present}/${perCategory.actualOvertimeWork.decodedNonEmpty}, `
        + `actualIrregularWork ${perCategory.actualIrregularWork.present}/${perCategory.actualIrregularWork.decodedNonEmpty}, `
        + `remainingRegularWork ${perCategory.remainingRegularWork.present}/${perCategory.remainingRegularWork.decodedNonEmpty} (Format B, F1-fix)`,
      );
    }
  }
}

function z4Period(elapsedStart: number, elapsedEnd: number, workMinutes: number): TimephasedWorkPeriod {
  const base = new Date('2026-01-05T08:00:00.000Z');
  return {
    elapsedWorkMinutesStart: elapsedStart,
    elapsedWorkMinutesEnd: elapsedEnd,
    workMinutes,
    approxStart: new Date(base.getTime() + elapsedStart * 60_000),
    approxFinish: new Date(base.getTime() + elapsedEnd * 60_000),
  };
}

function z4GapsEqual(actual: readonly TaskSplitGap[], expected: readonly TaskSplitGap[]): boolean {
  if (actual.length !== expected.length) return false;
  return actual.every((g, i) => g.afterMinutes === expected[i].afterMinutes && g.gapMinutes === expected[i].gapMinutes);
}

function z4TimestampParts(date: Date): { time: number; days: number } {
  const MPP_EPOCH_UTC_MS = Date.UTC(1983, 11, 31);
  const MS_PER_DAY = 86_400_000;
  const diffMs = date.getTime() - MPP_EPOCH_UTC_MS;
  const days = Math.floor(diffMs / MS_PER_DAY);
  const time = Math.round((diffMs - days * MS_PER_DAY) / 6000);
  return { time, days };
}

const MONDAY_0800 = new Date('2026-01-05T08:00:00.000Z');
const TUESDAY_0800 = new Date('2026-01-06T08:00:00.000Z');
const WEDNESDAY_0800 = new Date('2026-01-07T08:00:00.000Z');

const Z4_CALENDAR: WorkCalendar = {
  id: 'z4-test-cal', name: 'Z4 testkalender', description: '',
  workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: {
    byWeekday: {
      1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }],
      4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [],
    },
  },
};

const Z4_CAL_RESULT: CalendarReadResult = {
  calendarByUniqueId: new Map(),
  projectCalendar: Z4_CALENDAR,
  resourceCalendars: [],
  resourceCalendarUniqueIdByResourceUniqueId: new Map(),
  ownHolidayCountByUniqueId: new Map(),
};

function z4MakeTask(id: string, scheduleStart: Date, childIds: string[] = []): Task {
  return {
    id, name: id, description: '', wbsCode: '', taskType: 'USERDEFINED', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds, resourceIds: [],
    time: { ...createDefaultTaskTime(scheduleStart.toISOString().slice(0, 16), 5) },
  };
}

{
  const a = deriveSplitGapsFromPeriods([z4Period(0, 480, 480), z4Period(480, 960, 0), z4Period(960, 1440, 480)]);
  truthy('[Z4 1a] twee segmenten met een gat ⇒ 1 TaskSplitGap', a.length === 1);
  truthy('[Z4 1a] afterMinutes/gapMinutes exact', z4GapsEqual(a, [{ afterMinutes: 480, gapMinutes: 480 }]));

  const b = deriveSplitGapsFromPeriods([
    z4Period(0, 240, 240), z4Period(240, 360, 0),
    z4Period(360, 600, 240), z4Period(600, 780, 0),
    z4Period(780, 1020, 240),
  ]);
  truthy('[Z4 1b] drie segmenten, twee gaten', z4GapsEqual(b, [
    { afterMinutes: 240, gapMinutes: 120 },
    { afterMinutes: 600, gapMinutes: 180 },
  ]));

  const c = deriveSplitGapsFromPeriods([z4Period(0, 480, 480), z4Period(480, 900, 420)]);
  truthy('[Z4 1c] aangrenzende werksegmenten zonder gat ⇒ lege lijst (geen fantoom-split)', c.length === 0);

  const gapsAssignment1 = deriveSplitGapsFromPeriods([z4Period(0, 480, 480), z4Period(480, 600, 0), z4Period(600, 1000, 400)]);
  const gapsAssignment2 = deriveSplitGapsFromPeriods([z4Period(0, 500, 500), z4Period(500, 600, 0), z4Period(600, 1000, 400)]);
  const taskGaps = deriveTaskSplitGaps([gapsAssignment1, gapsAssignment2]);
  truthy('[Z4 1d] doorsnede van twee verschillende toewijzingsgaten', z4GapsEqual(taskGaps, [{ afterMinutes: 500, gapMinutes: 100 }]));

  const gapsNoGaps = deriveSplitGapsFromPeriods([z4Period(0, 1000, 1000)]);
  truthy(
    '[Z4 1d] een volledig-doorwerkende toewijzing forceert de taakdoorsnede naar leeg',
    deriveTaskSplitGaps([gapsAssignment1, gapsNoGaps]).length === 0,
  );

  truthy('[Z4 1] enkele toewijzing ⇒ triviaal identiek aan haar eigen gaten', z4GapsEqual(deriveTaskSplitGaps([gapsAssignment1]), gapsAssignment1));
  truthy('[Z4 1] geen toewijzingen ⇒ lege lijst', deriveTaskSplitGaps([]).length === 0);
}

{
  const periods = [z4Period(0, 480, 480), z4Period(480, 600, 0)];
  const unshifted = shiftPeriods(periods, 0);
  truthy('[Z4 shift] shiftMinutes=0 ⇒ dezelfde array-referentie (geen onnodige kopie)', unshifted === periods);

  const shifted = shiftPeriods(periods, 100);
  truthy('[Z4 shift] elapsedWorkMinutesStart/End verschoven', shifted[0].elapsedWorkMinutesStart === 100 && shifted[0].elapsedWorkMinutesEnd === 580);
  truthy('[Z4 shift] tweede periode ook verschoven', shifted[1].elapsedWorkMinutesStart === 580 && shifted[1].elapsedWorkMinutesEnd === 700);
  truthy('[Z4 shift] workMinutes ONgewijzigd', shifted[0].workMinutes === 480 && shifted[1].workMinutes === 0);
  truthy('[Z4 shift] approxStart/Finish ONgewijzigd (blijft een BENADERING vanaf het oude anker)', shifted[0].approxStart.getTime() === periods[0].approxStart.getTime());
}

{
  function buildAssignmentMetaBytes(records: { deleted: boolean; offset: number }[]): Uint8Array {
    const out = new Uint8Array(16 + records.length * 34);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0xfadfadba, true);
    view.setInt32(8, records.length, true);
    records.forEach((r, i) => {
      const pos = 16 + i * 34;
      view.setUint8(pos, r.deleted ? 1 : 0);
      view.setInt32(pos + 4, r.offset, true);
    });
    return out;
  }
  function buildAssignmentDataRecord(uid: number, taskUid: number, start?: Date, resume?: Date): Uint8Array {
    const out = new Uint8Array(110);
    const view = new DataView(out.buffer);
    view.setInt32(0, uid, true);
    view.setInt32(4, taskUid, true);
    if (start) {
      const { time, days } = z4TimestampParts(start);
      view.setUint16(12, time, true);
      view.setUint16(14, days, true);
    }
    if (resume) {
      const { time, days } = z4TimestampParts(resume);
      view.setUint16(30, time, true);
      view.setUint16(32, days, true);
    }
    return out;
  }

  const asgFieldMapBytes = buildFieldMapEntryBytes([
    { typeValue: AssignmentFieldId.UniqueId, dataBlockOffset: 0, category: 3 },
    { typeValue: AssignmentFieldId.TaskUniqueId, dataBlockOffset: 4, category: 3 },
    { typeValue: AssignmentFieldId.Start, dataBlockOffset: 12, category: 3 },
    { typeValue: AssignmentFieldId.Resume, dataBlockOffset: 30, category: 3 },
  ]);
  const asgProps = new Props(encodePropsEntries([{ key: PROPSKEY_ASSIGNMENT_FIELD_MAP, data: asgFieldMapBytes }]), 'Z4-assignment-fieldmap');
  const asgFieldMap = createAssignmentFieldMap(asgProps);

  const metaBytes = buildAssignmentMetaBytes([{ deleted: false, offset: 0 }, { deleted: false, offset: 110 }, { deleted: true, offset: 220 }]);
  const dataBytes = concatBytes(
    buildAssignmentDataRecord(7, 101, MONDAY_0800, WEDNESDAY_0800),
    buildAssignmentDataRecord(8, 102),
    buildAssignmentDataRecord(9, 103, MONDAY_0800),
  );
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndAssn: { children: { FixedMeta: { data: metaBytes }, FixedData: { data: dataBytes } } } } },
  }));
  const taskIdByUniqueId = new Map<number, string>([[101, 'task-a'], [102, 'task-b']]);

  const links = buildAssignmentUidLinks(cfb, asgFieldMap, taskIdByUniqueId);
  truthy('[Z4 brug] uid 7 → task-a', links.get(7)?.taskId === 'task-a');
  truthy('[Z4 brug] uid 7: assignmentStart round-trip', links.get(7)?.assignmentStart?.getTime() === MONDAY_0800.getTime());
  truthy('[Z4 brug] uid 7: assignmentResume round-trip', links.get(7)?.assignmentResume?.getTime() === WEDNESDAY_0800.getTime());
  truthy('[Z4 brug] uid 8 → task-b', links.get(8)?.taskId === 'task-b');
  truthy('[Z4 brug] uid 8: geen start/resume-veld ⇒ null (byte-identiek precedent)', links.get(8)?.assignmentStart === null && links.get(8)?.assignmentResume === null);
  truthy('[Z4 brug] verwijderd record (uid 9) NIET meegenomen', !links.has(9));
  truthy('[Z4 brug] exact 2 links', links.size === 2);

  const cfbCorrupt = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndAssn: { children: { FixedMeta: { data: new Uint8Array(5) }, FixedData: { data: dataBytes } } } } },
  }));
  const linksCorrupt = buildAssignmentUidLinks(cfbCorrupt, asgFieldMap, taskIdByUniqueId);
  truthy('[Z4 rood] FixedMeta te kort voor haar eigen header ⇒ lege map, geen exceptie', linksCorrupt.size === 0);

  const cfbMissing = new CfbFile(buildNestedCfb({ '   114': { children: {} } }));
  truthy('[Z4 rood] TBkndAssn ontbreekt volledig ⇒ lege map', buildAssignmentUidLinks(cfbMissing, asgFieldMap, taskIdByUniqueId).size === 0);

  const hostileFieldMap = new Map(asgFieldMap);
  hostileFieldMap.set(AssignmentFieldId.Start, { location: 'fixed', fixedOffset: -1000000 });
  const linksHostileOffset = buildAssignmentUidLinks(cfb, hostileFieldMap, taskIdByUniqueId);
  truthy(
    '[Z4 verdedigingsdiepte] negatieve fixedOffset ⇒ dat veld wordt null, de rest van de link blijft intact',
    linksHostileOffset.get(7)?.taskId === 'task-a' && linksHostileOffset.get(7)?.assignmentStart === null,
  );
}

{
  const THURSDAY_0800 = new Date('2026-01-08T08:00:00.000Z');

  function z8MetaBytes(records: { deleted: boolean; offset: number }[]): Uint8Array {
    const out = new Uint8Array(16 + records.length * 34);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0xfadfadba, true);
    view.setInt32(8, records.length, true);
    records.forEach((r, i) => {
      const pos = 16 + i * 34;
      view.setUint8(pos, r.deleted ? 1 : 0);
      view.setInt32(pos + 4, r.offset, true);
    });
    return out;
  }
  function z8DataRecord(uid: number, taskUid: number, resourceUid: number, start?: Date, finish?: Date): Uint8Array {
    const out = new Uint8Array(110);
    const view = new DataView(out.buffer);
    view.setInt32(0, uid, true);
    view.setInt32(4, taskUid, true);
    view.setInt32(8, resourceUid, true);
    if (start) {
      const p = z4TimestampParts(start);
      view.setUint16(12, p.time, true);
      view.setUint16(14, p.days, true);
    }
    if (finish) {
      const p = z4TimestampParts(finish);
      view.setUint16(16, p.time, true);
      view.setUint16(18, p.days, true);
    }
    return out;
  }
  function z8RegularBlockOnePeriod(cumulativeWorkMinutes: number, cumulativeElapsedMinutes: number): Uint8Array {
    const out = new Uint8Array(16 + 20 + 20);
    const view = new DataView(out.buffer);
    view.setUint16(0, 1, true);
    view.setInt32(24, 2_000_000_000, true);
    const offset = 36;
    view.setFloat64(offset, cumulativeWorkMinutes * 1000, true);
    view.setInt32(offset + 16, cumulativeElapsedMinutes * 80, true);
    return out;
  }
  function z8FlatBlock(totalWorkMinutes: number): Uint8Array {
    const out = new Uint8Array(24);
    const view = new DataView(out.buffer);
    view.setUint16(0, 0, true);
    view.setFloat64(16, totalWorkMinutes * 1000, true);
    return out;
  }

  const asgFieldMapBytes = buildFieldMapEntryBytes([
    { typeValue: AssignmentFieldId.UniqueId, dataBlockOffset: 0, category: 3 },
    { typeValue: AssignmentFieldId.TaskUniqueId, dataBlockOffset: 4, category: 3 },
    { typeValue: AssignmentFieldId.ResourceUniqueId, dataBlockOffset: 8, category: 3 },
    { typeValue: AssignmentFieldId.Start, dataBlockOffset: 12, category: 3 },
    { typeValue: AssignmentFieldId.Finish, dataBlockOffset: 16, category: 3 },
    { typeValue: AssignmentFieldId.ActualRegularWork, dataBlockOffset: 65535, category: 8 },
    { typeValue: AssignmentFieldId.RemainingRegularWork, dataBlockOffset: 65535, category: 8 },
  ]);
  const asgProps = new Props(encodePropsEntries([{ key: PROPSKEY_ASSIGNMENT_FIELD_MAP, data: asgFieldMapBytes }]), 'Z8-assignment-fieldmap');
  const asgFieldMap = createAssignmentFieldMap(asgProps);

  const metaBytes = z8MetaBytes([
    { deleted: false, offset: 0 }, { deleted: false, offset: 110 },
    { deleted: false, offset: 220 }, { deleted: false, offset: 330 }, { deleted: false, offset: 440 },
  ]);
  const dataBytes = concatBytes(
    z8DataRecord(30, 301, 1, TUESDAY_0800, TUESDAY_0800),
    z8DataRecord(31, 301, 2, MONDAY_0800, WEDNESDAY_0800),
    z8DataRecord(32, 301, 3, TUESDAY_0800, THURSDAY_0800),
    z8DataRecord(40, 302, 4, MONDAY_0800, THURSDAY_0800),
    z8DataRecord(34, 304, 5, MONDAY_0800, THURSDAY_0800),
  );

  const actualPayload = z8RegularBlockOnePeriod(480, 480);
  const actualSlot = 4 + actualPayload.length;
  const varMetaBytes = buildVarMetaBytes([
    { uniqueId: 30, type: AssignmentFieldId.ActualRegularWork, offset: 0 },
    { uniqueId: 31, type: AssignmentFieldId.ActualRegularWork, offset: actualSlot },
    { uniqueId: 34, type: AssignmentFieldId.ActualRegularWork, offset: 2 * actualSlot },
  ]);
  const var2DataBytes = buildVar2DataBytes(
    [
      { offset: 0, payload: actualPayload },
      { offset: actualSlot, payload: actualPayload },
      { offset: 2 * actualSlot, payload: actualPayload },
    ],
    3 * actualSlot,
  );

  const cfb = new CfbFile(buildNestedCfb({
    '   114': {
      children: {
        TBkndAssn: {
          children: {
            FixedMeta: { data: metaBytes }, FixedData: { data: dataBytes },
            VarMeta: { data: varMetaBytes }, Var2Data: { data: var2DataBytes },
          },
        },
      },
    },
  }));
  const taskIdByUniqueId = new Map<number, string>([
    [301, 'task-x'], [302, 'task-y'], [303, 'task-z'], [304, 'task-w'],
  ]);
  const taskW = z4MakeTask('task-w', MONDAY_0800);
  taskW.time.completion = 0.6;
  const tasks: Task[] = [
    z4MakeTask('task-x', MONDAY_0800),
    z4MakeTask('task-y', MONDAY_0800, ['task-y-child']),
    z4MakeTask('task-z', MONDAY_0800),
    taskW,
  ];
  const noResources: Resource[] = [];
  const noResourceIds = new Map<number, string>();

  const windows = deriveTimephasedWindowsForTasks(
    cfb, asgFieldMap, taskIdByUniqueId, tasks, Z4_CAL_RESULT, noResourceIds, noResources,
  );

  truthy('[Z8 laag 3] task-x aanwezig', windows.has('task-x'));
  truthy(
    '[Z8 laag 3] task-x finishFloor === MAX(TUESDAY, WEDNESDAY) = WEDNESDAY (uid 32 se latere THURSDAY genegeerd — geen signaal)',
    windows.get('task-x')?.finishFloor?.getTime() === WEDNESDAY_0800.getTime(),
  );
  truthy(
    '[Z8 laag 3] task-x startAnchor === MIN(TUESDAY, MONDAY) = MONDAY',
    windows.get('task-x')?.startAnchor?.getTime() === MONDAY_0800.getTime(),
  );
  truthy('[Z8] task-y (samenvattingstaak) NIET in de resultaat-map, ondanks echte periode', !windows.has('task-y'));
  truthy('[Z8] task-z (geen enkel timephased-signaal) NIET in de resultaat-map — byte-identiek', !windows.has('task-z'));
  truthy('[Z8 laag 1/2] task-w (in-progress, completion=0.6) NIET in de resultaat-map ondanks echte periode', !windows.has('task-w'));
  truthy('[Z8] exact 1 taak in de resultaat-map (task-x)', windows.size === 1);

  const wrongMin = Math.min(TUESDAY_0800.getTime(), WEDNESDAY_0800.getTime());
  truthy(
    '[Z8 mutatiebewijs] MIN i.p.v. MAX zou WEDNESDAY missen (bewijst dat de MAX-assertie hierboven echt onderscheidend is)',
    wrongMin !== windows.get('task-x')?.finishFloor?.getTime(),
  );

  truthy(
    '[Z8 mutatiebewijs] zonder periodecriterium zou finishFloor op THURSDAY liggen — productie-uitkomst is dat NIET',
    windows.get('task-x')?.finishFloor?.getTime() !== THURSDAY_0800.getTime(),
  );

  {
    const nightCal: WorkCalendar = {
      id: 'z8-night-cal', name: 'Night Shift test', description: '',
      workDays: [1, 2, 3, 4, 5], workStartHour: 23, workEndHour: 7, hoursPerDay: 8, holidays: [],
      workTime: { byWeekday: { 1: [{ start: 1380, end: 1860 }], 2: [{ start: 1380, end: 1860 }], 3: [], 4: [], 5: [], 6: [], 7: [] } },
    };
    const calResultWithNight: CalendarReadResult = { ...Z4_CAL_RESULT, resourceCalendars: [nightCal] };
    const nightResource: Resource = {
      id: 'r-night', name: 'Night Resource', calendarId: 'z8-night-cal',
    } as Resource;

    const metaBytes4 = z8MetaBytes([{ deleted: false, offset: 0 }]);
    const dataBytes4 = z8DataRecord(50, 305, 6, MONDAY_0800, undefined);
    const varMetaBytes4 = buildVarMetaBytes([{ uniqueId: 50, type: AssignmentFieldId.RemainingRegularWork, offset: 0 }]);
    const flatPayload = z8FlatBlock(480);
    const var2DataBytes4 = buildVar2DataBytes([{ offset: 0, payload: flatPayload }], 4 + flatPayload.length);
    const cfb4 = new CfbFile(buildNestedCfb({
      '   114': {
        children: {
          TBkndAssn: {
            children: {
              FixedMeta: { data: metaBytes4 }, FixedData: { data: dataBytes4 },
              VarMeta: { data: varMetaBytes4 }, Var2Data: { data: var2DataBytes4 },
            },
          },
        },
      },
    }));
    const taskV = z4MakeTask('task-v', MONDAY_0800);
    const windows4 = deriveTimephasedWindowsForTasks(
      cfb4, asgFieldMap, new Map([[305, 'task-v']]), [taskV], calResultWithNight,
      new Map([[6, 'r-night']]), [nightResource],
    );
    truthy('[Z8 laag 4] task-v aanwezig (vlak record, afwijkende resourcekalender)', windows4.has('task-v'));
    truthy('[Z8 laag 4] task-v draagt GEEN finishFloor (geen gelezen antwoord, laag 3 vuurde niet)', windows4.get('task-v')?.finishFloor == null);
    truthy(
      '[Z8 laag 4] task-v draagt precies 1 durationWalks-item met de Night-kalender-id',
      windows4.get('task-v')?.durationWalks.length === 1
      && windows4.get('task-v')?.durationWalks[0]?.resourceCalendarId === 'z8-night-cal',
    );
    truthy(
      '[Z8 laag 4] anchor === MONDAY (AssignmentField.START)',
      windows4.get('task-v')?.durationWalks[0]?.anchor.getTime() === MONDAY_0800.getTime(),
    );

    const sameAsTaskCal: WorkCalendar = { ...Z4_CALENDAR, id: 'z8-same-as-task' };
    const calResultSame: CalendarReadResult = { ...Z4_CAL_RESULT, resourceCalendars: [sameAsTaskCal] };
    const sameResource: Resource = { id: 'r-same', name: 'Same Resource', calendarId: 'z8-same-as-task' } as Resource;
    const windowsSame = deriveTimephasedWindowsForTasks(
      cfb4, asgFieldMap, new Map([[305, 'task-v']]), [z4MakeTask('task-v', MONDAY_0800)], calResultSame,
      new Map([[6, 'r-same']]), [sameResource],
    );
    truthy(
      '[Z8 mutatiebewijs laag 4] structureel GELIJKE resourcekalender activeert laag 4 NIET (task-v afwezig)',
      !windowsSame.has('task-v'),
    );
  }

  {
    const holidayCal: WorkCalendar = {
      ...Z4_CALENDAR, id: 'z8-holiday-cal',
      holidays: [{ name: 'Test Holiday', startDate: '2026-01-06', endDate: '2026-01-06' }],
    };
    truthy(
      '[Z19-L voorwaarde] holidayCal se banden zijn STRUCTUREEL GELIJK aan Z4_CALENDAR (fixture test alleen de holiday-tak)',
      JSON.stringify(holidayCal.workTime?.byWeekday) === JSON.stringify(Z4_CALENDAR.workTime?.byWeekday),
    );
    const calResultWithHoliday: CalendarReadResult = { ...Z4_CAL_RESULT, resourceCalendars: [holidayCal] };
    const holidayResource: Resource = { id: 'r-holiday', name: 'Holiday Resource', calendarId: 'z8-holiday-cal' } as Resource;

    const metaBytesH = z8MetaBytes([{ deleted: false, offset: 0 }]);
    const dataBytesH = z8DataRecord(60, 306, 7, MONDAY_0800, undefined);
    const varMetaBytesH = buildVarMetaBytes([{ uniqueId: 60, type: AssignmentFieldId.RemainingRegularWork, offset: 0 }]);
    const flatPayloadH = z8FlatBlock(480);
    const var2DataBytesH = buildVar2DataBytes([{ offset: 0, payload: flatPayloadH }], 4 + flatPayloadH.length);
    const cfbH = new CfbFile(buildNestedCfb({
      '   114': {
        children: {
          TBkndAssn: {
            children: {
              FixedMeta: { data: metaBytesH }, FixedData: { data: dataBytesH },
              VarMeta: { data: varMetaBytesH }, Var2Data: { data: var2DataBytesH },
            },
          },
        },
      },
    }));
    const taskHoliday = z4MakeTask('task-holiday', MONDAY_0800);
    const windowsHoliday = deriveTimephasedWindowsForTasks(
      cfbH, asgFieldMap, new Map([[306, 'task-holiday']]), [taskHoliday], calResultWithHoliday,
      new Map([[7, 'r-holiday']]), [holidayResource],
    );
    truthy(
      '[Z19-L laag 4, holiday-only] task-holiday AANWEZIG (completion===0, bands gelijk, alleen holidays wijken af)',
      windowsHoliday.has('task-holiday'),
    );
    truthy(
      '[Z19-L laag 4, holiday-only] task-holiday draagt precies 1 durationWalks-item met de holiday-kalender-id',
      windowsHoliday.get('task-holiday')?.durationWalks.length === 1
      && windowsHoliday.get('task-holiday')?.durationWalks[0]?.resourceCalendarId === 'z8-holiday-cal',
    );

    const matchingHolidayCal: WorkCalendar = { ...Z4_CALENDAR, id: 'z8-matching-holiday-cal', holidays: [] };
    truthy(
      '[Z19-L voorwaarde 2] matchingHolidayCal is VOLLEDIG gelijk aan Z4_CALENDAR (bands ÉN holidays) — de negatieve mutatieproef test dus zuiver de holiday-tak',
      JSON.stringify(matchingHolidayCal.workTime?.byWeekday) === JSON.stringify(Z4_CALENDAR.workTime?.byWeekday)
      && JSON.stringify(matchingHolidayCal.holidays) === JSON.stringify(Z4_CALENDAR.holidays),
    );
    const calResultWithMatchingHoliday: CalendarReadResult = { ...Z4_CAL_RESULT, resourceCalendars: [matchingHolidayCal] };
    const matchingHolidayResource: Resource = { id: 'r-matching-holiday', name: 'Matching Holiday Resource', calendarId: 'z8-matching-holiday-cal' } as Resource;
    const windowsMatchingHoliday = deriveTimephasedWindowsForTasks(
      cfbH, asgFieldMap, new Map([[306, 'task-holiday']]), [z4MakeTask('task-holiday', MONDAY_0800)], calResultWithMatchingHoliday,
      new Map([[7, 'r-matching-holiday']]), [matchingHolidayResource],
    );
    truthy(
      '[Z19-L mutatiebewijs, via productiecode] met een resourcekalender wiens holidays ÓÓK gelijk zijn (geen enkel verschil meer) activeert laag 4 NIET — task-holiday afwezig',
      !windowsMatchingHoliday.has('task-holiday'),
    );
  }
}

{
  function buildAssignmentMetaBytes(count: number): Uint8Array {
    const out = new Uint8Array(16 + count * 34);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0xfadfadba, true);
    view.setInt32(8, count, true);
    for (let i = 0; i < count; i++) {
      view.setUint8(16 + i * 34, 0);
      view.setInt32(16 + i * 34 + 4, i * 110, true);
    }
    return out;
  }
  function buildAssignmentDataRecord(uid: number, taskUid: number, start?: Date, resume?: Date): Uint8Array {
    const out = new Uint8Array(110);
    const view = new DataView(out.buffer);
    view.setInt32(0, uid, true);
    view.setInt32(4, taskUid, true);
    if (start) {
      const { time, days } = z4TimestampParts(start);
      view.setUint16(12, time, true);
      view.setUint16(14, days, true);
    }
    if (resume) {
      const { time, days } = z4TimestampParts(resume);
      view.setUint16(30, time, true);
      view.setUint16(32, days, true);
    }
    return out;
  }
  function buildRegularBlockMinutes(periods: { cumulativeWorkMinutes: number; cumulativeElapsedMinutes: number }[]): Uint8Array {
    const out = new Uint8Array(16 + 20 + periods.length * 20);
    const view = new DataView(out.buffer);
    view.setUint16(0, periods.length, true);
    view.setFloat64(16, 999_000, true);
    view.setInt32(24, 2_000_000_000, true);
    view.setInt32(16 + 16, 999 * 80, true);
    periods.forEach((p, i) => {
      const offset = 36 + i * 20;
      view.setFloat64(offset, p.cumulativeWorkMinutes * 1000, true);
      view.setInt32(offset + 16, p.cumulativeElapsedMinutes * 80, true);
    });
    return out;
  }
  function buildPlannedBlock(periods: { cumulativeWorkMinutes: number; cumulativeElapsedMinutes: number }[]): Uint8Array {
    const out = new Uint8Array(16 + 28 + periods.length * 28);
    const view = new DataView(out.buffer);
    view.setUint16(0, periods.length, true);
    view.setFloat64(16, 999_000, true);
    view.setInt32(16 + 24, 999 * 80, true);
    periods.forEach((p, i) => {
      const offset = 44 + i * 28;
      view.setFloat64(offset, p.cumulativeWorkMinutes * 1000, true);
      view.setInt32(offset + 24, p.cumulativeElapsedMinutes * 80, true);
    });
    return out;
  }
  function buildPlannedSummaryOnlyBlock(totalWorkMinutes: number): Uint8Array {
    const out = new Uint8Array(24);
    const view = new DataView(out.buffer);
    view.setUint16(0, 0, true);
    view.setFloat64(16, totalWorkMinutes * 1000, true);
    return out;
  }

  const asgFieldMapBytes = buildFieldMapEntryBytes([
    { typeValue: AssignmentFieldId.UniqueId, dataBlockOffset: 0, category: 3 },
    { typeValue: AssignmentFieldId.TaskUniqueId, dataBlockOffset: 4, category: 3 },
    { typeValue: AssignmentFieldId.Start, dataBlockOffset: 12, category: 3 },
    { typeValue: AssignmentFieldId.Resume, dataBlockOffset: 30, category: 3 },
    { typeValue: AssignmentFieldId.ActualRegularWork, dataBlockOffset: 65535, category: 8 },
    { typeValue: AssignmentFieldId.RemainingRegularWork, dataBlockOffset: 65535, category: 8 },
  ]);
  const asgProps = new Props(encodePropsEntries([{ key: PROPSKEY_ASSIGNMENT_FIELD_MAP, data: asgFieldMapBytes }]), 'Z4-integration-fieldmap');
  const asgFieldMap = createAssignmentFieldMap(asgProps);

  const blockA_actual = buildRegularBlockMinutes([{ cumulativeWorkMinutes: 480, cumulativeElapsedMinutes: 480 }, { cumulativeWorkMinutes: 480, cumulativeElapsedMinutes: 960 }, { cumulativeWorkMinutes: 960, cumulativeElapsedMinutes: 1440 }]);
  const blockA_remaining = buildPlannedSummaryOnlyBlock(600);

  const blockB_actual = buildRegularBlockMinutes([{ cumulativeWorkMinutes: 240, cumulativeElapsedMinutes: 240 }, { cumulativeWorkMinutes: 240, cumulativeElapsedMinutes: 480 }, { cumulativeWorkMinutes: 480, cumulativeElapsedMinutes: 720 }]);

  const blockC_actual = buildRegularBlockMinutes([{ cumulativeWorkMinutes: 480, cumulativeElapsedMinutes: 480 }]);
  const blockC_remaining = buildPlannedBlock([{ cumulativeWorkMinutes: 240, cumulativeElapsedMinutes: 240 }]);

  const metaBytes = buildAssignmentMetaBytes(4);
  const dataBytes = concatBytes(
    buildAssignmentDataRecord(1, 101),
    buildAssignmentDataRecord(2, 102, TUESDAY_0800),
    buildAssignmentDataRecord(3, 103, MONDAY_0800, WEDNESDAY_0800),
    buildAssignmentDataRecord(4, 104),
  );
  const varMetaBytes = buildVarMetaBytes([
    { uniqueId: 1, type: AssignmentFieldId.ActualRegularWork, offset: 0 },
    { uniqueId: 1, type: AssignmentFieldId.RemainingRegularWork, offset: 4 + blockA_actual.length },
    { uniqueId: 2, type: AssignmentFieldId.ActualRegularWork, offset: 4 + blockA_actual.length + 4 + blockA_remaining.length },
    { uniqueId: 3, type: AssignmentFieldId.ActualRegularWork, offset: 4 + blockA_actual.length + 4 + blockA_remaining.length + 4 + blockB_actual.length },
    { uniqueId: 3, type: AssignmentFieldId.RemainingRegularWork, offset: 4 + blockA_actual.length + 4 + blockA_remaining.length + 4 + blockB_actual.length + 4 + blockC_actual.length },
    { uniqueId: 4, type: AssignmentFieldId.ActualRegularWork, offset: 4 + blockA_actual.length + 4 + blockA_remaining.length + 4 + blockB_actual.length + 4 + blockC_actual.length + 4 + blockC_remaining.length },
    {
      uniqueId: 4,
      type: AssignmentFieldId.RemainingRegularWork,
      offset: 4 + blockA_actual.length + 4 + blockA_remaining.length + 4 + blockB_actual.length + 4 + blockC_actual.length + 4 + blockC_remaining.length + 4 + blockA_actual.length,
    },
  ]);
  const totalVar2Len = 4 + blockA_actual.length + 4 + blockA_remaining.length + 4 + blockB_actual.length
    + 4 + blockC_actual.length + 4 + blockC_remaining.length + 4 + blockA_actual.length + 4 + blockA_remaining.length;
  const var2DataBytes = buildVar2DataBytes([
    { offset: 0, payload: blockA_actual },
    { offset: 4 + blockA_actual.length, payload: blockA_remaining },
    { offset: 4 + blockA_actual.length + 4 + blockA_remaining.length, payload: blockB_actual },
    { offset: 4 + blockA_actual.length + 4 + blockA_remaining.length + 4 + blockB_actual.length, payload: blockC_actual },
    { offset: 4 + blockA_actual.length + 4 + blockA_remaining.length + 4 + blockB_actual.length + 4 + blockC_actual.length, payload: blockC_remaining },
    { offset: 4 + blockA_actual.length + 4 + blockA_remaining.length + 4 + blockB_actual.length + 4 + blockC_actual.length + 4 + blockC_remaining.length, payload: blockA_actual },
    {
      offset: 4 + blockA_actual.length + 4 + blockA_remaining.length + 4 + blockB_actual.length + 4 + blockC_actual.length + 4 + blockC_remaining.length + 4 + blockA_actual.length,
      payload: blockA_remaining,
    },
  ], totalVar2Len);

  const cfb = new CfbFile(buildNestedCfb({
    '   114': {
      children: {
        TBkndAssn: {
          children: {
            FixedMeta: { data: metaBytes }, FixedData: { data: dataBytes },
            VarMeta: { data: varMetaBytes }, Var2Data: { data: var2DataBytes },
          },
        },
      },
    },
  }));

  const taskIdByUniqueId = new Map<number, string>([[101, 'task-A'], [102, 'task-B'], [103, 'task-C'], [104, 'task-D']]);
  const tasks: Task[] = [
    z4MakeTask('task-A', MONDAY_0800),
    z4MakeTask('task-B', MONDAY_0800),
    z4MakeTask('task-C', MONDAY_0800),
    z4MakeTask('task-D', MONDAY_0800, ['child-x']),
  ];

  const result = deriveSplitGapsForTasks(cfb, asgFieldMap, taskIdByUniqueId, tasks, Z4_CAL_RESULT);

  truthy(
    '[Z4 punt1] taak-A: het ECHTE gat in `actual` overleeft — het ongedeelde blockCount===0-blok bridget het niet',
    z4GapsEqual(result.get('task-A') ?? [], [{ afterMinutes: 480, gapMinutes: 480 }]),
  );
  truthy(
    '[Z4 punt3] taak-B: het gat is verschoven van de toewijzings-as (240) naar de taak-as (720 = 240+480)',
    z4GapsEqual(result.get('task-B') ?? [], [{ afterMinutes: 720, gapMinutes: 240 }]),
  );
  truthy(
    '[Z4 punt2] taak-C: `remaining` ankert op `assignmentResume` (960), niet op `assignmentStart` (0) — het rustgat tussen actual-eind (480) en resume (960) verschijnt',
    z4GapsEqual(result.get('task-C') ?? [], [{ afterMinutes: 480, gapMinutes: 480 }]),
  );
  truthy(
    '[Z4 punt4] taak-D (samenvattingstaak, childIds.length>0): GEEN splitGaps-item, ondanks IDENTIEKE bytes als taak-A',
    !result.has('task-D'),
  );

  const contours = deriveTimephasedContoursForTasks(cfb, asgFieldMap, taskIdByUniqueId, tasks, Z4_CAL_RESULT);
  const contourA = contours.get('task-A');
  const contourC = contours.get('task-C');
  truthy('[Z14b contours] taak-A heeft precies één toewijzings-contour', contourA?.length === 1);
  truthy('[Z14b contours] taak-A: 3 actual-periodes, 0 remaining-periodes (vlak samenvattingsrecord telt niet mee)',
    contourA?.[0]?.periods.filter(p => p.kind === 'actual').length === 3
    && contourA?.[0]?.periods.filter(p => p.kind === 'remaining').length === 0);
  truthy('[Z14b contours] taak-A: het ECHTE gat (workMinutes===0) staat in de rauwe periodes',
    !!contourA?.[0]?.periods.some(p => p.kind === 'actual' && p.afterMinutes === 480 && p.minutes === 480 && p.workMinutes === 0));
  truthy('[Z14b contours] taak-C heeft precies één toewijzings-contour', contourC?.length === 1);
  truthy('[Z14b contours] taak-C: minstens één ECHTE remaining-periode (blockCount>=1, geen vlak record)',
    !!contourC?.[0]?.periods.some(p => p.kind === 'remaining'));
  truthy('[Z14b contours] taak-D (samenvattingstaak): GEEN contour-item, spiegelt splitGaps', !contours.has('task-D'));
  truthy('[Z14b contours] resourceUid === null (deze fixture se veldmap draagt geen ResourceUniqueId)',
    contourA?.[0]?.resourceUid === null);

  {
    const withoutFinish = decodePlannedRegularTimephasedWork(blockA_remaining, MONDAY_0800);
    const withFinishBug = decodePlannedRegularTimephasedWork(blockA_remaining, MONDAY_0800, new Date(MONDAY_0800.getTime() + 3000 * 60_000));
    truthy('[Z4 punt1-bewijs] zonder referenceFinish (de fix): blockCount===0 levert niets', withoutFinish.length === 0);
    truthy('[Z4 punt1-bewijs] MET referenceFinish (het oude pad): blockCount===0 levert wél een record', withFinishBug.length === 1 && withFinishBug[0].workMinutes === 600);
    const actualPeriodsA = decodeRegularTimephasedWork(blockA_actual, MONDAY_0800);
    const buggyGapsA = deriveSplitGapsFromPeriods([...actualPeriodsA, ...withFinishBug]);
    const fixedGapsA = deriveSplitGapsFromPeriods([...actualPeriodsA, ...withoutFinish]);
    truthy('[Z4 punt1-bewijs] het oude pad verandert de gatenlijst t.o.v. de fix (het brug-effect)', JSON.stringify(buggyGapsA) !== JSON.stringify(fixedGapsA));

    const actualPeriodsC = decodeRegularTimephasedWork(blockC_actual, MONDAY_0800);
    const remainingPeriodsRawC = decodePlannedRegularTimephasedWork(blockC_remaining, MONDAY_0800);
    const naiveGapsC = deriveSplitGapsFromPeriods([...actualPeriodsC, ...remainingPeriodsRawC]);
    const fixedGapsC = deriveSplitGapsFromPeriods([...actualPeriodsC, ...shiftPeriods(remainingPeriodsRawC, 960)]);
    truthy('[Z4 punt2-bewijs] naïeve concatenatie (geen resume-verschuiving) mist het rustgat', !z4GapsEqual(naiveGapsC, [{ afterMinutes: 480, gapMinutes: 480 }]));
    truthy('[Z4 punt2-bewijs] MET resume-verschuiving verschijnt het echte rustgat', z4GapsEqual(fixedGapsC, [{ afterMinutes: 480, gapMinutes: 480 }]));
  }

  {
    const dayModeCalResult: CalendarReadResult = { ...Z4_CAL_RESULT, projectCalendar: { ...Z4_CALENDAR, workTime: undefined } };
    let threw: string | null = null;
    let dayModeResult: Map<string, TaskSplitGap[]> | null = null;
    try {
      dayModeResult = deriveSplitGapsForTasks(cfb, asgFieldMap, taskIdByUniqueId, tasks, dayModeCalResult);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    truthy(`[Z4-her-check A] dag-modus gooit niet (${threw ?? ''})`, threw === null);
    truthy(
      '[Z4-her-check A] F2: effectieve werkblokken geven dezelfde verschuiving als de expliciete blokken (T11)',
      z4GapsEqual(dayModeResult?.get('task-B') ?? [], [{ afterMinutes: 720, gapMinutes: 240 }]),
    );
  }
}

{
  const SPLITTASK_PATH = crawlScopes.root
    + '/mpxj/junit/data/mpp14splittask.mpp';
  if (!existsSync(SPLITTASK_PATH)) {
    console.log(`OK  mpp-import: Z4 mpp14splittask.mpp niet aanwezig (${SPLITTASK_PATH}) — overgeslagen`);
  } else {
    const result = readMPP(new Uint8Array(readFileSync(SPLITTASK_PATH)));
    const task1 = result.tasks.find((t) => t.name === 'Split Task 1');
    const task2 = result.tasks.find((t) => t.name === 'Split Task 2');
    truthy('[Z4 corpus] beide taken gevonden', !!task1 && !!task2);
    truthy(
      '[Z4 corpus] "Split Task 1": exact 1 gat, {afterMinutes:1920, gapMinutes:1440}',
      !!task1 && z4GapsEqual(task1.splitGaps ?? [], [{ afterMinutes: 1920, gapMinutes: 1440 }]),
    );
    truthy(
      '[Z4 corpus] "Split Task 2": exact 2 gaten, {1440,960} en {4800,1440}',
      !!task2 && z4GapsEqual(task2.splitGaps ?? [], [
        { afterMinutes: 1440, gapMinutes: 960 },
        { afterMinutes: 4800, gapMinutes: 1440 },
      ]),
    );
    const others = result.tasks.filter((t) => t !== task1 && t !== task2);
    truthy('[Z4 corpus] geen andere taken in dit bestand (2 taken totaal)', others.length === 0);
  }
}

{
  function encodeUnicodeStringAscii(s: string): Uint8Array {
    const out = new Uint8Array(s.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
    return out;
  }

  const LEVELING_DELAY_TYPE_VALUE = 20;
  const LEVELING_DELAY_UNITS_TYPE_VALUE = 178;
  const LEVELING_DELAY_OFFSET = 126;
  const LEVELING_DELAY_UNITS_OFFSET = 62;

  interface Z5TaskSpec {
    name: string; uniqueId: number; id: number; durationRaw: number;
    startTime: number; startDays: number; finishTime: number; finishDays: number;
    levelingDelayRaw?: number; levelingDelayUnits?: number;
  }

  function buildZ5TaskFixedDataRecord(t: Z5TaskSpec): Uint8Array {
    const out = new Uint8Array(130);
    const view = new DataView(out.buffer);
    view.setInt32(0, t.uniqueId, true);
    view.setInt32(4, t.id, true);
    view.setInt16(40, 1, true);
    view.setInt32(42, t.durationRaw, true);
    view.setInt16(46, 7, true);
    view.setInt16(56, 0, true);
    view.setInt16(LEVELING_DELAY_UNITS_OFFSET, t.levelingDelayUnits ?? 7, true);
    view.setUint16(64, t.startTime, true);
    view.setUint16(66, t.startDays, true);
    view.setUint16(68, t.finishTime, true);
    view.setUint16(70, t.finishDays, true);
    view.setInt32(118, -1, true);
    view.setInt32(LEVELING_DELAY_OFFSET, t.levelingDelayRaw ?? 0, true);
    return out;
  }

  function buildZ5TaskFixedMetaRecord(offsetIntoFixedData: number): Uint8Array {
    const out = new Uint8Array(47);
    const view = new DataView(out.buffer);
    view.setInt32(4, offsetIntoFixedData, true);
    return out;
  }

  function buildZ5FixedMetaBlob(items: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(16 + items.length * 47);
    const view = new DataView(out.buffer);
    view.setUint32(0, 0xfadfadba, true);
    view.setInt32(8, items.length, true);
    items.forEach((item, i) => out.set(item, 16 + i * 47));
    return out;
  }

  const Z5_CAL_DAYS = [
    { defaultFlag: 0 as const },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] },
    { defaultFlag: 0 as const },
  ];

  function buildZ5Fixture(tasks: Z5TaskSpec[]): Uint8Array {
    const n = tasks.length;
    const dummy = buildZ5TaskFixedMetaRecord(0);
    const metas = tasks.map((_t, i) => buildZ5TaskFixedMetaRecord((3 + i) * 130));
    const fixedMetaBlob = buildZ5FixedMetaBlob([dummy, dummy, dummy, ...metas]);

    const fixedDataBlob = new Uint8Array((3 + n) * 130);
    tasks.forEach((t, i) => fixedDataBlob.set(buildZ5TaskFixedDataRecord(t), (3 + i) * 130));

    let nameOffset = 0;
    const varMetaEntries: { uniqueId: number; type: number; offset: number }[] = [];
    const namePayloads: { offset: number; payload: Uint8Array }[] = [];
    for (const t of tasks) {
      varMetaEntries.push({ uniqueId: t.uniqueId, type: TaskFieldId.Name, offset: nameOffset });
      const payload = encodeUnicodeStringAscii(t.name);
      namePayloads.push({ offset: nameOffset, payload });
      nameOffset += 4 + payload.length;
    }
    const taskVarMetaBytes = buildVarMetaBytes(varMetaEntries);
    const taskVar2DataBuf = new Uint8Array(Math.max(nameOffset, 1));
    const taskVar2View = new DataView(taskVar2DataBuf.buffer);
    for (const { offset, payload } of namePayloads) {
      taskVar2View.setInt32(offset, payload.length, true);
      taskVar2DataBuf.set(payload, offset + 4);
    }

    const fieldMapBytes = buildFieldMapEntryBytes([
      { typeValue: TaskFieldId.UniqueId, dataBlockOffset: 0, category: 3 },
      { typeValue: TaskFieldId.Id, dataBlockOffset: 4, category: 3 },
      { typeValue: TaskFieldId.OutlineLevel, dataBlockOffset: 40, category: 3 },
      { typeValue: TaskFieldId.ScheduledDuration, dataBlockOffset: 42, category: 3 },
      { typeValue: TaskFieldId.DurationUnits, dataBlockOffset: 46, category: 3 },
      { typeValue: TaskFieldId.ConstraintType, dataBlockOffset: 56, category: 3 },
      { typeValue: LEVELING_DELAY_UNITS_TYPE_VALUE, dataBlockOffset: LEVELING_DELAY_UNITS_OFFSET, category: 3 },
      { typeValue: TaskFieldId.ScheduledStart, dataBlockOffset: 64, category: 3 },
      { typeValue: TaskFieldId.ScheduledFinish, dataBlockOffset: 68, category: 3 },
      { typeValue: TaskFieldId.CalendarUniqueId, dataBlockOffset: 118, category: 3 },
      { typeValue: LEVELING_DELAY_TYPE_VALUE, dataBlockOffset: LEVELING_DELAY_OFFSET, category: 3 },
      { typeValue: TaskFieldId.Name, dataBlockOffset: 65535, category: 8 },
    ]);

    const calendarName = 'Z5 leveling-fixture';
    const hoursBlock = buildCalHoursBlock(Z5_CAL_DAYS);
    const calFixedMetaBlob = buildCalFixedMetaBlob([0]);
    const calFixedDataBlob = buildCalFixedDataRecord(1, 1, -1);
    const CAL_NAME_OFF = 0, CAL_DATA_OFF = 100;
    const calVarMetaBytes = buildVarMetaBytes([
      { uniqueId: 1, type: 1, offset: CAL_NAME_OFF },
      { uniqueId: 1, type: 8, offset: CAL_DATA_OFF },
    ]);
    const calVar2DataBuf = new Uint8Array(700);
    const calVar2View = new DataView(calVar2DataBuf.buffer);
    const writeCalVar2 = (offset: number, payload: Uint8Array) => {
      calVar2View.setInt32(offset, payload.length, true);
      calVar2DataBuf.set(payload, offset + 4);
    };
    writeCalVar2(CAL_NAME_OFF, encodeUnicodeStringAscii(calendarName));
    writeCalVar2(CAL_DATA_OFF, hoursBlock);

    const projectPropsBytes = encodePropsEntries([
      { key: 37748738 , data: timestampBytes(0, 15000) },
      { key: 37748739 , data: timestampBytes(0, 15010) },
      { key: 37748744 , data: encodeUnicodeStringAscii('Z5-fixture') },
      { key: 37748750 , data: encodeUnicodeStringAscii(calendarName) },
      { key: PROPSKEY_TASK_FIELD_MAP, data: fieldMapBytes },
    ]);

    const tree: Record<string, CfbTreeNode> = {
      '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
      Props14: { data: encodePropsSingleByteEntry(893386752 , 0) },
      '   114': {
        children: {
          Props: { data: projectPropsBytes },
          TBkndTask: {
            children: {
              FixedMeta: { data: fixedMetaBlob },
              FixedData: { data: fixedDataBlob },
              VarMeta: { data: taskVarMetaBytes },
              Var2Data: { data: taskVar2DataBuf },
            },
          },
          TBkndCal: {
            children: {
              FixedMeta: { data: calFixedMetaBlob },
              FixedData: { data: calFixedDataBlob },
              VarMeta: { data: calVarMetaBytes },
              Var2Data: { data: calVar2DataBuf },
            },
          },
        },
      },
    };
    return buildNestedCfb(tree);
  }

  const readZ5 = (bytes: Uint8Array) => {
    let result: ReturnType<typeof readMPP> | null = null;
    let threw: string | null = null;
    try {
      result = readMPP(bytes);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    return { result, threw };
  };

  {
    const { result, threw } = readZ5(buildZ5Fixture([
      { name: 'Delayed', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000, levelingDelayRaw: 900, levelingDelayUnits: 7 },
    ]));
    truthy(`[Z5 1a] readMPP gooit niet (${threw ?? ''})`, threw === null);
    const task = result?.tasks.find((t) => t.name === 'Delayed');
    truthy('[Z5 1a] taak gevonden', !!task);
    truthy(`[Z5 1a] levelingDelayMinutes === 90 (kreeg ${task?.levelingDelayMinutes})`, task?.levelingDelayMinutes === 90);
    truthy('[Z5 1a] levelingDelayElapsed NIET gezet (WORKTIME)', task?.levelingDelayElapsed === undefined);
    truthy('[Z5 1a] Task.levelingDelay (hele dagen) blijft ONGEZET — Z6-motorwerk, niet Z5', task?.levelingDelay === undefined);
  }

  {
    const { result, threw } = readZ5(buildZ5Fixture([
      { name: 'DelayedElapsed', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000, levelingDelayRaw: 300, levelingDelayUnits: 8 },
    ]));
    truthy(`[Z5 1b] readMPP gooit niet (${threw ?? ''})`, threw === null);
    const task = result?.tasks.find((t) => t.name === 'DelayedElapsed');
    truthy(`[Z5 1b] levelingDelayMinutes === 30 (kreeg ${task?.levelingDelayMinutes})`, task?.levelingDelayMinutes === 30);
    truthy('[Z5 1b] levelingDelayElapsed === true', task?.levelingDelayElapsed === true);
  }

  {
    const { result, threw } = readZ5(buildZ5Fixture([
      { name: 'Clean', uniqueId: 10, id: 1, durationRaw: 4800, startTime: 4800, startDays: 15000, finishTime: 9600, finishDays: 15000 },
    ]));
    truthy(`[Z5 3] readMPP gooit niet (${threw ?? ''})`, threw === null);
    const task = result?.tasks.find((t) => t.name === 'Clean');
    truthy('[Z5 3] levelingDelayMinutes AFWEZIG', task?.levelingDelayMinutes === undefined);
    truthy('[Z5 3] levelingDelayElapsed AFWEZIG', task?.levelingDelayElapsed === undefined);
    truthy('[Z5 3] GEEN sourceScheduleNotes (T12-detectie ongewijzigd: leveled=0)', result?.sourceScheduleNotes === undefined);
  }
}

{
  const CRAWL = crawlScopes.smoke;
  if (!existsSync(CRAWL)) {
    console.log('OK  mpp-import: T9-crawl niet aanwezig (OPS_MPP_CRAWL_SMOKE of OPS_MPP_CRAWL/crawl-mpp) — crawlsectie overgeslagen');
  } else {
    function listMppFilesRecursive(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listMppFilesRecursive(full));
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mpp')) out.push(full);
      }
      return out;
    }
    const crawlFiles = listMppFilesRecursive(CRAWL);
    if (crawlFiles.length === 0) {
      console.log(`OK  mpp-import: T9-crawl-map aanwezig maar geen .mpp-bestanden erin (${CRAWL}) — crawlsectie overgeslagen`);
    } else {
      const CRAWL_TASK_COUNT_BASELINE = 788;
      const CRAWL_ZERO_TASK_FILES_BASELINE = 4;
      const SUSPECT_RATIO_BUDGET = 0.02;
      const CRAWL_HOUR_TASK_BASELINE = 788;

      let totalTasks = 0;
      let totalHourTasks = 0;
      let readFailures = 0;
      let filesWithZeroTasks = 0;
      let totalSuspect = 0;
      const zeroTaskFiles: string[] = [];
      for (const file of crawlFiles) {
        let result: ReturnType<typeof readMPP>;
        try {
          result = readMPP(new Uint8Array(readFileSync(file)));
        } catch (err) {
          readFailures++;
          checks++;
          diffs.push(`[T9-crawl] readMPP gooide onverwacht op ${file}: ${err instanceof Error ? err.message : String(err)}`);
          continue;
        }
        totalTasks += result.tasks.length;
        totalHourTasks += result.tasks.filter((t) => t.time.durationMinutes != null).length;
        if (result.tasks.length === 0) {
          filesWithZeroTasks++;
          zeroTaskFiles.push(file);
          continue;
        }

        const linkedTaskIds = new Set<string>();
        for (const seq of result.sequences) {
          linkedTaskIds.add(seq.predecessorId);
          linkedTaskIds.add(seq.successorId);
        }
        const suspect = result.tasks.filter(
          (t) => t.name.trim() === '' && t.time.scheduleDuration === 0 && !linkedTaskIds.has(t.id),
        );
        totalSuspect += suspect.length;
        const ratio = suspect.length / result.tasks.length;
        truthy(
          `[T9-crawl] ${file}: spooktaak-verdachten binnen budget (${suspect.length}/${result.tasks.length} = ${(ratio * 100).toFixed(1)}% ≤ ${SUSPECT_RATIO_BUDGET * 100}%)`,
          ratio <= SUSPECT_RATIO_BUDGET,
        );
      }
      truthy(`[T9-crawl] aantal bestanden exact op de gemeten basislijn (${crawlFiles.length}/49)`, crawlFiles.length === 49);
      truthy(`[T9-crawl] geen leesfouten over ${crawlFiles.length} bestanden`, readFailures === 0);
      truthy(
        `[T9-crawl] taakloze bestanden exact op de gemeten basislijn (${filesWithZeroTasks}/${CRAWL_ZERO_TASK_FILES_BASELINE}, zie de bevinding hierboven)`,
        filesWithZeroTasks === CRAWL_ZERO_TASK_FILES_BASELINE,
      );
      truthy(
        `[T9-crawl] totaal-taakaantal exact op de gemeten basislijn (${totalTasks}/${CRAWL_TASK_COUNT_BASELINE})`,
        totalTasks === CRAWL_TASK_COUNT_BASELINE,
      );
      truthy(
        `[T9-crawl] uurmodus-taakaantal (durationMinutes gezet) exact op de gemeten basislijn (${totalHourTasks}/${CRAWL_HOUR_TASK_BASELINE}, zie de toelichting hierboven)`,
        totalHourTasks === CRAWL_HOUR_TASK_BASELINE,
      );
      console.log(
        `   . [T9-crawl] ${crawlFiles.length} bestanden: totaal ${totalTasks} taken (basislijn ${CRAWL_TASK_COUNT_BASELINE}), `
        + `${totalHourTasks} in uur-modus (basislijn ${CRAWL_HOUR_TASK_BASELINE}), `
        + `${filesWithZeroTasks} taakloos (basislijn ${CRAWL_ZERO_TASK_FILES_BASELINE}: ${zeroTaskFiles.map((f) => f.split('/').pop()).join(', ') || '—'}), `
        + `${totalSuspect} spooktaak-verdachten totaal (budget ${SUSPECT_RATIO_BUDGET * 100}% per bestand)`,
      );
    }
  }
}

if (diffs.length === 0) {
  console.log(`OK  mpp-import: alle checks groen (${checks} hard + ${softChecksTotal} budget-gedekt soft, zie softChecksTotal)`);
  process.exit(0);
} else {
  console.log(`XX  mpp-import: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
