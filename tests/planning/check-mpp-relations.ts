// Bron: MPXJ `ConstraintFactory` als referentie voor de recordindeling van de relatiefixtures (LGPL-2.1, github.com/joniles/mpxj).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { CfbFile } from '@/services/mpp/cfb';
import { readMPP } from '@/services/mpp/mppReader';
import { readRelations, readResources, readAssignments, type ReadResourcesResult } from '@/services/mpp/mppEntities';
import type { CalendarReadResult } from '@/services/mpp/mppCalendars';
import { DEFAULT_RESOURCE_FIELDS, DEFAULT_ASSIGNMENT_FIELDS, ResourceFieldId, type FieldMapTable } from '@/services/mpp/fieldMap14';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { installDOMParser } from './xmldom-shim';
import { readMppCorpusEntry, resolveMppCrawlScopes } from './mppCorpus';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment } from '@/types/resource';
import {
  buildNestedCfb, encodeCompObjFileFormat, encodePropsEntries, encodePropsSingleByteEntry,
  concatBytes, buildVarMetaBytes, type CfbTreeNode,
} from './mppFixtures';

const diffs: string[] = [];
let checks = 0;
let softChecksRelationsTotal = 0;
let softChecksResourcesTotal = 0;
let softChecksAssignmentsTotal = 0;
const truthy = (label: string, cond: boolean) => {
  checks++;
  if (!cond) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

const TIME_LIMIT_MS = 2000;

const FIXED_META_MAGIC = 0xfadfadba;
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

function timestampBytes(time: number, days: number): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint16(0, time, true);
  view.setUint16(2, days, true);
  return out;
}

function int32Payload(value: number): Uint8Array {
  const p = new Uint8Array(4);
  new DataView(p.buffer).setInt32(0, value, true);
  return p;
}

function buildTaskFixedDataRecord(opts: { uniqueId: number; id: number; startDays: number; finishDays: number }): Uint8Array {
  const out = new Uint8Array(130);
  const view = new DataView(out.buffer);
  view.setInt32(0, opts.uniqueId, true);
  view.setInt32(4, opts.id, true);
  view.setInt16(40, 1, true);
  view.setInt32(42, 4800, true);
  view.setInt16(56, 0, true);
  view.setUint16(64, 0, true);
  view.setUint16(66, opts.startDays, true);
  view.setUint16(68, 0, true);
  view.setUint16(70, opts.finishDays, true);
  view.setInt32(118, -1, true);
  return out;
}
function buildTaskFixedMetaRecord(offsetIntoFixedData: number): Uint8Array {
  const out = new Uint8Array(47);
  new DataView(out.buffer).setInt32(4, offsetIntoFixedData, true);
  return out;
}
function buildTaskFixedMetaBlob(records: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(16 + records.length * 47);
  const view = new DataView(out.buffer);
  view.setUint32(0, FIXED_META_MAGIC, true);
  view.setInt32(8, records.length, true);
  records.forEach((r, i) => out.set(r, 16 + i * 47));
  return out;
}

function buildConsFixedMetaBlob(offsets: number[], itemCountClaim = offsets.length, magic = FIXED_META_MAGIC): Uint8Array {
  const out = new Uint8Array(16 + offsets.length * 10);
  const view = new DataView(out.buffer);
  view.setUint32(0, magic, true);
  view.setInt32(8, itemCountClaim, true);
  offsets.forEach((offsetIntoFixedData, i) => {
    view.setInt16(16 + i * 10, 0, true);
    view.setInt32(16 + i * 10 + 4, offsetIntoFixedData, true);
  });
  return out;
}
function buildConsFixedDataRecord(opts: {
  uniqueId: number; predecessorTaskUid: number; successorTaskUid: number;
  relationType: number; durationUnits: number; duration: number;
}): Uint8Array {
  const out = new Uint8Array(20);
  const view = new DataView(out.buffer);
  view.setInt32(0, opts.uniqueId, true);
  view.setInt32(4, opts.predecessorTaskUid, true);
  view.setInt32(8, opts.successorTaskUid, true);
  view.setInt16(12, opts.relationType, true);
  view.setInt16(14, opts.durationUnits, true);
  view.setInt32(16, opts.duration, true);
  return out;
}

const RSC_RECORD_SIZE = 60;
function buildRscFixedMetaRecord(opts: { offsetIntoFixedData: number; isWork: boolean; applicationVersion?: number | null }): Uint8Array {
  const out = new Uint8Array(37);
  const view = new DataView(out.buffer);
  view.setInt32(4, opts.offsetIntoFixedData, true);
  if (opts.isWork) {
    if ((opts.applicationVersion ?? 0) > 14) out[12] = 0x10;
    else out[9] = 0x02;
  }
  return out;
}
function buildRscFixedMetaBlob(records: Uint8Array[], magic = FIXED_META_MAGIC): Uint8Array {
  const out = new Uint8Array(16 + records.length * 37);
  const view = new DataView(out.buffer);
  view.setUint32(0, magic, true);
  view.setInt32(8, records.length, true);
  records.forEach((r, i) => out.set(r, 16 + i * 37));
  return out;
}
function buildRscFixedDataRecord(opts: { uniqueId: number; maxUnitsRaw: number }): Uint8Array {
  const out = new Uint8Array(RSC_RECORD_SIZE);
  const view = new DataView(out.buffer);
  view.setInt32(0, opts.uniqueId, true);
  view.setFloat64(44, opts.maxUnitsRaw, true);
  return out;
}

function buildRsc2MetaRecord(opts: { isCost: boolean }): Uint8Array {
  const out = new Uint8Array(50);
  if (opts.isCost) out[8] = 0x10;
  return out;
}
function buildRsc2MetaBlob(records: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(16 + records.length * 50);
  const view = new DataView(out.buffer);
  view.setUint32(0, FIXED_META_MAGIC, true);
  view.setInt32(8, records.length, true);
  records.forEach((r, i) => out.set(r, 16 + i * 50));
  return out;
}

const ASSN_ITEM_SIZE = 110;
function buildAssnFixedMetaRecord(offsetIntoFixedData: number): Uint8Array {
  const out = new Uint8Array(34);
  out[0] = 0;
  new DataView(out.buffer).setInt32(4, offsetIntoFixedData, true);
  return out;
}
function buildAssnFixedMetaBlob(records: Uint8Array[], magic = FIXED_META_MAGIC): Uint8Array {
  const out = new Uint8Array(16 + records.length * 34);
  const view = new DataView(out.buffer);
  view.setUint32(0, magic, true);
  view.setInt32(8, records.length, true);
  records.forEach((r, i) => out.set(r, 16 + i * 34));
  return out;
}
function buildAssnFixedDataItem(opts: { uniqueId: number; taskUid: number; resourceUid: number; unitsRaw: number }): Uint8Array {
  const out = new Uint8Array(ASSN_ITEM_SIZE);
  const view = new DataView(out.buffer);
  view.setInt32(0, opts.uniqueId, true);
  view.setInt32(4, opts.taskUid, true);
  view.setInt32(8, opts.resourceUid, true);
  view.setFloat64(46, opts.unitsRaw, true);
  return out;
}

const emptyCalResult: CalendarReadResult = {
  calendarByUniqueId: new Map(),
  projectCalendar: createDefaultCalendar(),
  resourceCalendars: [],
  resourceCalendarUniqueIdByResourceUniqueId: new Map(),
  ownHolidayCountByUniqueId: new Map(),
};

{
  const dummy = buildTaskFixedMetaRecord(0);
  const metaA = buildTaskFixedMetaRecord(3 * 130);
  const metaB = buildTaskFixedMetaRecord(4 * 130);
  const metaC = buildTaskFixedMetaRecord(5 * 130);
  const taskFixedMetaBlob = buildTaskFixedMetaBlob([dummy, dummy, dummy, metaA, metaB, metaC]);

  const dataA = buildTaskFixedDataRecord({ uniqueId: 10, id: 1, startDays: 15000, finishDays: 15001 });
  const dataB = buildTaskFixedDataRecord({ uniqueId: 11, id: 2, startDays: 15002, finishDays: 15003 });
  const dataC = buildTaskFixedDataRecord({ uniqueId: 12, id: 3, startDays: 15004, finishDays: 15005 });
  const taskFixedDataBlob = new Uint8Array(6 * 130);
  taskFixedDataBlob.set(dataA, 3 * 130);
  taskFixedDataBlob.set(dataB, 4 * 130);
  taskFixedDataBlob.set(dataC, 5 * 130);

  const taskVarMetaBytes = buildVarMetaBytes([
    { uniqueId: 10, type: 14, offset: 0 },
    { uniqueId: 11, type: 14, offset: 20 },
    { uniqueId: 12, type: 14, offset: 40 },
  ]);
  const taskVar2DataBuf = new Uint8Array(60);
  const tv2 = new DataView(taskVar2DataBuf.buffer);
  const writeTaskName = (offset: number, s: string) => {
    const payload = encodeUnicodeStringAscii(s);
    tv2.setInt32(offset, payload.length, true);
    taskVar2DataBuf.set(payload, offset + 4);
  };
  writeTaskName(0, 'A');
  writeTaskName(20, 'B');
  writeTaskName(40, 'C');

  const consFixedMetaBlob = buildConsFixedMetaBlob([0, 20]);
  const consFixedDataBlob = concatBytes(
    buildConsFixedDataRecord({ uniqueId: 100, predecessorTaskUid: 10, successorTaskUid: 11, relationType: 1, durationUnits: 7, duration: 9600 }),
    buildConsFixedDataRecord({ uniqueId: 101, predecessorTaskUid: 11, successorTaskUid: 12, relationType: 3, durationUnits: 8, duration: 14400 }),
  );

  const rscFixedMetaBlob = buildRscFixedMetaBlob([
    buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: false }),
    buildRscFixedMetaRecord({ offsetIntoFixedData: RSC_RECORD_SIZE, isWork: true }),
  ]);
  const rscFixedDataBlob = concatBytes(
    buildRscFixedDataRecord({ uniqueId: 0, maxUnitsRaw: 0 }),
    buildRscFixedDataRecord({ uniqueId: 5, maxUnitsRaw: 10000 }),
  );
  const RSC_NAME0_OFF = 0, RSC_NAME5_OFF = 40;
  const rscVarMetaBytes = buildVarMetaBytes([
    { uniqueId: 0, type: 1, offset: RSC_NAME0_OFF },
    { uniqueId: 5, type: 1, offset: RSC_NAME5_OFF },
  ]);
  const rscVar2DataBuf = new Uint8Array(120);
  const rv2 = new DataView(rscVar2DataBuf.buffer);
  const writeRscName = (offset: number, s: string) => {
    const payload = encodeUnicodeStringAscii(s);
    rv2.setInt32(offset, payload.length, true);
    rscVar2DataBuf.set(payload, offset + 4);
  };
  writeRscName(RSC_NAME0_OFF, 'Onbenoemd');
  writeRscName(RSC_NAME5_OFF, 'Alice');

  const assnFixedMetaBlob = buildAssnFixedMetaBlob([
    buildAssnFixedMetaRecord(0),
    buildAssnFixedMetaRecord(ASSN_ITEM_SIZE),
  ]);
  const assnFixedDataBlob = concatBytes(
    buildAssnFixedDataItem({ uniqueId: 200, taskUid: 10, resourceUid: 0, unitsRaw: 10000 }),
    buildAssnFixedDataItem({ uniqueId: 201, taskUid: 11, resourceUid: 5, unitsRaw: 5000 }),
  );
  const assnVarMetaBytes = buildVarMetaBytes([
    { uniqueId: 200, offset: 0, type: 0 },
    { uniqueId: 201, offset: 0, type: 0 },
  ]);

  const projectPropsBytes = encodePropsEntries([
    { key: PROJECT_START_DATE_KEY, data: timestampBytes(0, 15000) },
    { key: PROJECT_FINISH_DATE_KEY, data: timestampBytes(0, 15010) },
    { key: MINUTES_PER_DAY_KEY, data: int32Payload(480) },
    { key: TITLE_KEY, data: encodeUnicodeStringAscii('T7 Fixture Project') },
  ]);

  const tree: Record<string, CfbTreeNode> = {
    '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
    Props14: { data: encodePropsSingleByteEntry(PASSWORD_FLAG_KEY, 0) },
    '   114': {
      children: {
        Props: { data: projectPropsBytes },
        TBkndTask: {
          children: {
            FixedMeta: { data: taskFixedMetaBlob },
            FixedData: { data: taskFixedDataBlob },
            VarMeta: { data: taskVarMetaBytes },
            Var2Data: { data: taskVar2DataBuf },
          },
        },
        TBkndCons: {
          children: { FixedMeta: { data: consFixedMetaBlob }, FixedData: { data: consFixedDataBlob } },
        },
        TBkndRsc: {
          children: {
            FixedMeta: { data: rscFixedMetaBlob },
            FixedData: { data: rscFixedDataBlob },
            VarMeta: { data: rscVarMetaBytes },
            Var2Data: { data: rscVar2DataBuf },
          },
        },
        TBkndAssn: {
          children: { FixedMeta: { data: assnFixedMetaBlob }, FixedData: { data: assnFixedDataBlob }, VarMeta: { data: assnVarMetaBytes } },
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
  truthy(`I4/T7 end-to-end readMPP: gooit niet (${threw ?? ''})`, threw === null);

  if (result) {
    truthy('I4/T7 end-to-end readMPP: 3 taken', result.tasks.length === 3);
    truthy('I4/T7 end-to-end readMPP: 2 relaties', result.sequences.length === 2);
    truthy('I4/T7 end-to-end readMPP: 2 resources', result.resources.length === 2);
    truthy('I4/T7 end-to-end readMPP: 2 assignments', result.assignments.length === 2);

    const taskByName = new Map(result.tasks.map((t) => [t.name, t]));
    const a = taskByName.get('A'), b = taskByName.get('B'), c = taskByName.get('C');
    truthy('I4/T7 end-to-end readMPP: A/B/C gevonden', !!a && !!b && !!c);

    if (a && b && c) {
      const seqAB = result.sequences.find((s) => s.predecessorId === a.id && s.successorId === b.id);
      const seqBC = result.sequences.find((s) => s.predecessorId === b.id && s.successorId === c.id);
      truthy('I4/T7 end-to-end readMPP: relatie A→B gevonden', !!seqAB);
      truthy('I4/T7 end-to-end readMPP: relatie B→C gevonden', !!seqBC);
      if (seqAB) {
        truthy('I4/T7 end-to-end readMPP: A→B type === FINISH_START', seqAB.type === 'FINISH_START');
        truthy('I4/T7 end-to-end readMPP: A→B lagMinutes === 960 (WORKTIME, 9600 tienden-van-minuut)', seqAB.lagMinutes === 960);
        truthy('I4/T7 end-to-end readMPP: A→B lagDays === 0 (urenmaat, geen dagen)', seqAB.lagDays === 0);
        truthy('I4/T7 end-to-end readMPP: A→B lagUnit is WORKTIME (undefined = default)', seqAB.lagUnit === undefined);
      }
      if (seqBC) {
        truthy('I4/T7 end-to-end readMPP: B→C type === START_START', seqBC.type === 'START_START');
        truthy('I4/T7 end-to-end readMPP: B→C lagDays === 1 (ELAPSED, 14400 tienden-van-minuut/10/60/24)', seqBC.lagDays === 1);
        truthy('I4/T7 end-to-end readMPP: B→C lagUnit === ELAPSEDTIME', seqBC.lagUnit === 'ELAPSEDTIME');
      }

      const unassigned = result.resources[0];
      const alice = result.resources.find((r) => r.name === 'Alice');
      truthy('I4/T7 end-to-end readMPP: resource uniqueID 0 gevonden — 0 is een geldige uniqueID', !!unassigned);
      truthy('I4/T7 end-to-end readMPP: resource "Alice" gevonden', !!alice);
      if (unassigned) {
        truthy('I4/T7-B3 uniqueID-0-resource: naam === default label "Unassigned" (raw "Onbenoemd" GENEGEERD)', unassigned.name === 'Unassigned');
        truthy('I4/T7-B3 uniqueID-0-resource: type === LABOR (raw isWork:false GENEGEERD)', unassigned.type === 'LABOR');
        truthy('I4/T7-B3 uniqueID-0-resource: maxUnits === 1 (raw maxUnitsRaw:0 GENEGEERD)', unassigned.maxUnits === 1);
      }
      if (alice) {
        truthy('I4/T7 end-to-end readMPP: "Alice".type === LABOR (WORK-bit gezet)', alice.type === 'LABOR');
        truthy('I4/T7 end-to-end readMPP: "Alice".maxUnits === 1 (100%, dubbele /100 t.o.v. MPXJ se percent-schaal)', alice.maxUnits === 1);
      }

      if (unassigned && alice) {
        const assnA = result.assignments.find((asg) => asg.taskId === a.id && asg.resourceId === unassigned.id);
        const assnB = result.assignments.find((asg) => asg.taskId === b.id && asg.resourceId === alice.id);
        truthy('I4/T7 end-to-end readMPP: assignment A↔uid-0-resource gevonden', !!assnA);
        truthy('I4/T7 end-to-end readMPP: assignment B↔Alice gevonden', !!assnB);
        if (assnA) truthy('I4/T7 end-to-end readMPP: A↔uid-0-resource unitsPerDay === 1 (100%)', assnA.unitsPerDay === 1);
        if (assnB) truthy('I4/T7 end-to-end readMPP: B↔Alice unitsPerDay === 0.5 (50% — synthetisch: corpus draagt alleen 0/1, zie moduleheader)', assnB.unitsPerDay === 0.5);
      }
    }
  }
}

{
  const taskIdByUniqueId = new Map<number, string>([[10, 'task-A']]);
  const fixedMeta = buildConsFixedMetaBlob([0, 20, 40]);
  const fixedData = concatBytes(
    buildConsFixedDataRecord({ uniqueId: 1, predecessorTaskUid: 10, successorTaskUid: 999, relationType: 1, durationUnits: 7, duration: 0 }),
    buildConsFixedDataRecord({ uniqueId: 2, predecessorTaskUid: 10, successorTaskUid: 10, relationType: 1, durationUnits: 7, duration: 0 }),
    buildConsFixedDataRecord({ uniqueId: 3, predecessorTaskUid: 0, successorTaskUid: 10, relationType: 1, durationUnits: 7, duration: 0 }),
  );
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCons: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData } } } } },
  }));
  const sequences = readRelations(cfb, null, taskIdByUniqueId);
  truthy(
    'T7-hostile relatie naar onbestaande/circulaire/projectsamenvattingstaak: alle drie overgeslagen (0 relaties)',
    sequences.length === 0,
  );
}

{
  const RECORD_COUNT = 50;
  const taskIdByUniqueId = new Map<number, string>();
  for (let i = 1; i <= RECORD_COUNT + 1; i++) taskIdByUniqueId.set(i, `task-${i}`);
  const offsets = Array.from({ length: RECORD_COUNT }, (_, i) => i * 20);
  const fixedMeta = buildConsFixedMetaBlob(offsets, 5_000_000);
  const records = Array.from({ length: RECORD_COUNT }, (_, i) =>
    buildConsFixedDataRecord({ uniqueId: i + 1, predecessorTaskUid: i + 1, successorTaskUid: i + 2, relationType: 1, durationUnits: 7, duration: 0 }));
  const fixedData = concatBytes(...records);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCons: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData } } } } },
  }));

  const start = Date.now();
  let sequences: Sequence[] = [];
  let threw: string | null = null;
  try {
    sequences = readRelations(cfb, null, taskIdByUniqueId);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  const elapsedMs = Date.now() - start;
  truthy(`T7-hostile extreem record-aantal (headerclaim=5.000.000, buffer=${RECORD_COUNT}): binnen tijdslimiet (${elapsedMs}ms < ${TIME_LIMIT_MS}ms)`, elapsedMs < TIME_LIMIT_MS);
  truthy(`T7-hostile extreem record-aantal: gooit niet (${threw ?? ''})`, threw === null);
  truthy(
    `T7-hostile extreem record-aantal: precies de ${RECORD_COUNT} echte relaties gelezen (niet de headerclaim, niet minder)`,
    sequences.length === RECORD_COUNT,
  );
}

const RESOURCE_DEFAULT_FIELD_MAP: FieldMapTable = new Map(Object.entries(DEFAULT_RESOURCE_FIELDS).map(([k, v]) => [Number(k), v]));
const ASSIGNMENT_DEFAULT_FIELD_MAP: FieldMapTable = new Map(Object.entries(DEFAULT_ASSIGNMENT_FIELDS).map(([k, v]) => [Number(k), v]));

for (const layout of [
  { applicationVersion: null, uniqueIdOffset: 0, maxUnitsOffset: 44, minRecordSize: 52 },
  { applicationVersion: 14, uniqueIdOffset: 0, maxUnitsOffset: 44, minRecordSize: 52 },
  { applicationVersion: 15, uniqueIdOffset: 4, maxUnitsOffset: 48, minRecordSize: 56 },
  { applicationVersion: 16, uniqueIdOffset: 4, maxUnitsOffset: 48, minRecordSize: 56 },
  { applicationVersion: 16, uniqueIdOffset: 0, maxUnitsOffset: 72, minRecordSize: 80 },
]) {
  const { applicationVersion, uniqueIdOffset, maxUnitsOffset, minRecordSize } = layout;
  const label = `T7 knownbug119 versie=${applicationVersion ?? 'onbekend'} uid@${uniqueIdOffset} units@${maxUnitsOffset}`;
  const fieldMap = new Map(RESOURCE_DEFAULT_FIELD_MAP);
  fieldMap.set(ResourceFieldId.UniqueId, { location: 'fixed', fixedOffset: uniqueIdOffset });
  fieldMap.set(ResourceFieldId.MaxUnits, { location: 'fixed', fixedOffset: maxUnitsOffset });
  const records = [
    { uid: 0, size: 16, isWork: false, isCost: false, units: 0 },
    { uid: 7, size: 16, isWork: false, isCost: false, units: 0 },
    { uid: 7, size: minRecordSize, isWork: true, isCost: false, units: 2500 },
    { uid: 7, size: minRecordSize, isWork: false, isCost: true, units: 9000 },
    { uid: 8, size: 16, isWork: false, isCost: false, units: 0 },
    { uid: 9, size: minRecordSize - 1, isWork: true, isCost: false, units: 0 },
    { uid: 10, size: minRecordSize, isWork: false, isCost: false, units: 12500 },
    { uid: 11, size: minRecordSize, isWork: false, isCost: true, units: 0 },
  ];
  let offset = 0;
  const metaRecords = records.map(record => {
    const meta = buildRscFixedMetaRecord({ offsetIntoFixedData: offset, isWork: record.isWork, applicationVersion });
    offset += record.size;
    return meta;
  });
  const dataRecords = records.map(record => {
    const data = new Uint8Array(record.size);
    const view = new DataView(data.buffer);
    view.setInt32(uniqueIdOffset, record.uid, true);
    if (record.size >= maxUnitsOffset + 8) view.setFloat64(maxUnitsOffset, record.units, true);
    return data;
  });
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndRsc: { children: {
      FixedMeta: { data: buildRscFixedMetaBlob(metaRecords) },
      FixedData: { data: concatBytes(...dataRecords) },
      Fixed2Meta: { data: buildRsc2MetaBlob(records.map(record => buildRsc2MetaRecord({ isCost: record.isCost }))) },
      VarMeta: { data: buildVarMetaBytes([0, 7, 8, 9, 10, 11].map(uniqueId => ({ uniqueId, type: 99, offset: 0 }))) },
    } } } },
  }));
  const calendar = createDefaultCalendar();
  const calResult: CalendarReadResult = {
    ...emptyCalResult,
    calendarByUniqueId: new Map([[42, calendar]]),
    resourceCalendarUniqueIdByResourceUniqueId: new Map([[0, 42], [7, 42]]),
  };
  const result = readResources(cfb, fieldMap, applicationVersion, calResult);
  const byUid = (uid: number) => result.resources.find(resource => resource.id === result.resourceIdByUniqueId.get(uid));
  truthy(`${label}: precies vier resources en UID-koppelingen`, result.resources.length === 4 && result.resourceIdByUniqueId.size === 4);
  truthy(`${label}: volledig werkrecord levert LABOR`, byUid(7)?.type === 'LABOR');
  truthy(`${label}: eerste volledige record levert maxUnits 0.25`, byUid(7)?.maxUnits === 0.25);
  truthy(`${label}: kalenderkoppeling van de echte resource blijft`, byUid(7)?.calendarId === calendar.id);
  truthy(`${label}: losse 16-byte plaatshouder valt weg`, !result.resourceIdByUniqueId.has(8));
  truthy(`${label}: record één byte onder de minimumlengte valt weg`, !result.resourceIdByUniqueId.has(9));
  truthy(`${label}: echt materiaal op de lengtegrens blijft`, byUid(10)?.type === 'MATERIAL' && byUid(10)?.maxUnits === 1.25);
  truthy(`${label}: kostenresource gebruikt Fixed2Meta van de juiste index`, byUid(11)?.type === 'LABOR' && byUid(11)?.maxUnits === 0);
  truthy(`${label}: costResourceIds bevat precies de kostenresource (uid 11)`,
    result.costResourceIds.size === 1 && result.costResourceIds.has(byUid(11)?.id ?? '')
    && !result.costResourceIds.has(byUid(7)?.id ?? '') && !result.costResourceIds.has(byUid(0)?.id ?? ''));
  truthy(`${label}: korte UID-0-sentinel behoudt naam, type en inzet`, byUid(0)?.name === 'Unassigned' && byUid(0)?.type === 'LABOR' && byUid(0)?.maxUnits === 1);
  truthy(`${label}: korte UID-0-sentinel behoudt kalenderkoppeling`, byUid(0)?.calendarId === calendar.id);
}

for (const [uniqueIdOffset, size] of [[0, 2], [18, 20]]) {
  const fieldMap = new Map(RESOURCE_DEFAULT_FIELD_MAP);
  fieldMap.set(ResourceFieldId.UniqueId, { location: 'fixed', fixedOffset: uniqueIdOffset });
  fieldMap.delete(ResourceFieldId.MaxUnits);
  const data = new Uint8Array(size);
  new DataView(data.buffer).setUint16(uniqueIdOffset, 12, true);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndRsc: { children: {
      FixedMeta: { data: buildRscFixedMetaBlob([buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: true })]) },
      FixedData: { data },
      VarMeta: { data: buildVarMetaBytes([{ uniqueId: 12, type: 99, offset: 0 }]) },
    } } } },
  }));
  const result = readResources(cfb, fieldMap, null, emptyCalResult);
  truthy(`T7 knownbug119 zonder MAX_UNITS uid@${uniqueIdOffset}: minimaal record blijft geldig`,
    result.resources.length === 1 && result.resources[0]?.type === 'LABOR' && result.resources[0]?.maxUnits === 1
    && result.resourceIdByUniqueId.get(12) === result.resources[0]?.id);
}

{
  const fixedMeta = buildRscFixedMetaBlob([buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: true })]);
  const fixedData = buildRscFixedDataRecord({ uniqueId: 7, maxUnitsRaw: 10000 });
  const varMeta = buildVarMetaBytes([{ uniqueId: 7, type: 1, offset: 0 }]);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndRsc: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));

  let result: ReadResourcesResult | null = null;
  let threw: string | null = null;
  try {
    result = readResources(cfb, RESOURCE_DEFAULT_FIELD_MAP, null, emptyCalResult);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`T7-hostile ontbrekende Var2Data op TBkndRsc: gooit niet (${threw ?? ''})`, threw === null);
  truthy('T7-hostile ontbrekende Var2Data op TBkndRsc: resource toch gematerialiseerd (1)', result?.resources.length === 1);
  truthy(
    'T7-hostile ontbrekende Var2Data op TBkndRsc: naam valt terug op "Resource" (geen var-data om te lezen)',
    result?.resources[0]?.name === 'Resource',
  );
}

{
  const fixedMeta = buildRscFixedMetaBlob([
    buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: false }),
    buildRscFixedMetaRecord({ offsetIntoFixedData: RSC_RECORD_SIZE, isWork: false }),
  ]);
  const fixedData = concatBytes(
    buildRscFixedDataRecord({ uniqueId: 1, maxUnitsRaw: 10000 }),
    buildRscFixedDataRecord({ uniqueId: 2, maxUnitsRaw: 10000 }),
  );
  const fixed2Meta = buildRsc2MetaBlob([
    buildRsc2MetaRecord({ isCost: true }),
    buildRsc2MetaRecord({ isCost: false }),
  ]);
  const varMeta = buildVarMetaBytes([
    { uniqueId: 1, type: 99, offset: 0 },
    { uniqueId: 2, type: 99, offset: 0 },
  ]);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': {
      children: {
        TBkndRsc: {
          children: {
            FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData },
            Fixed2Meta: { data: fixed2Meta }, VarMeta: { data: varMeta },
          },
        },
      },
    },
  }));

  const result = readResources(cfb, RESOURCE_DEFAULT_FIELD_MAP, null, emptyCalResult);
  const byUid1 = result.resources.find((r) => result.resourceIdByUniqueId.get(1) === r.id);
  const byUid2 = result.resources.find((r) => result.resourceIdByUniqueId.get(2) === r.id);
  truthy('T7-spec-review-B7 Fixed2Meta COST-bit: 2 resources gelezen', result.resources.length === 2);
  truthy('T7-spec-review-B7 Fixed2Meta COST-bit gezet (uid=1) ⇒ type LABOR (Cost → LABOR, spiegelt mspdiReader)', byUid1?.type === 'LABOR');
  truthy('T7-spec-review-B7 Fixed2Meta COST-bit NIET gezet (uid=2) ⇒ type MATERIAL', byUid2?.type === 'MATERIAL');
  truthy('187 costResourceIds bevat de kostenresource (uid=1)', !!byUid1 && result.costResourceIds.has(byUid1.id));
  truthy('187 costResourceIds bevat het materiaal (uid=2) niet', !!byUid2 && !result.costResourceIds.has(byUid2.id) && result.costResourceIds.size === 1);
}

{
  const fixedMeta = buildRscFixedMetaBlob([buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: false })]);
  const fixedData = buildRscFixedDataRecord({ uniqueId: 3, maxUnitsRaw: 10000 });
  const varMeta = buildVarMetaBytes([{ uniqueId: 3, type: 99, offset: 0 }]);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndRsc: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));

  let result: ReadResourcesResult | null = null;
  let threw: string | null = null;
  try {
    result = readResources(cfb, RESOURCE_DEFAULT_FIELD_MAP, null, emptyCalResult);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`T7-spec-review-B7 Fixed2Meta afwezig: gooit niet (${threw ?? ''})`, threw === null);
  truthy('T7-spec-review-B7 Fixed2Meta afwezig: 1 resource gelezen', result?.resources.length === 1);
  truthy('T7-spec-review-B7 Fixed2Meta afwezig: type valt terug op MATERIAL (WORK-bit-only-gedrag)', result?.resources[0]?.type === 'MATERIAL');
}

{
  const taskIdByUniqueId = new Map<number, string>([[10, 'task-A'], [11, 'task-B'], [12, 'task-C']]);
  const fixedMeta = buildConsFixedMetaBlob([0, 20]);
  const fixedData = concatBytes(
    buildConsFixedDataRecord({ uniqueId: 1, predecessorTaskUid: 10, successorTaskUid: 11, relationType: 1, durationUnits: 19, duration: 500 }),
    buildConsFixedDataRecord({ uniqueId: 2, predecessorTaskUid: 11, successorTaskUid: 12, relationType: 1, durationUnits: 20, duration: 800 }),
  );
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCons: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData } } } } },
  }));
  const sequences = readRelations(cfb, null, taskIdByUniqueId);
  truthy('T7-spec-review-B2 percent-lag: 2 relaties gelezen', sequences.length === 2);
  const percentSeq = sequences.find((s) => s.predecessorId === 'task-A');
  const elapsedPercentSeq = sequences.find((s) => s.predecessorId === 'task-B');
  truthy('T7-spec-review-B2 percent-lag (code 19): lagPercent === 50 (rawLag 500 / 10)', percentSeq?.lagPercent === 50);
  truthy('T7-spec-review-B2 percent-lag (code 19): geen lagUnit (WORKTIME-default)', percentSeq?.lagUnit === undefined);
  truthy('T7-spec-review-B2 elapsedPercent-lag (code 20): lagPercent === 80 (rawLag 800 / 10)', elapsedPercentSeq?.lagPercent === 80);
  truthy('T7-spec-review-B2 elapsedPercent-lag (code 20): lagUnit === ELAPSEDTIME', elapsedPercentSeq?.lagUnit === 'ELAPSEDTIME');
}

{
  const taskIdByUniqueId = new Map<number, string>([[10, 'task-A'], [11, 'task-B'], [12, 'task-C'], [13, 'task-D']]);
  const fixedMeta = buildConsFixedMetaBlob([0, 20, 40]);
  const fixedData = concatBytes(
    buildConsFixedDataRecord({ uniqueId: 1, predecessorTaskUid: 10, successorTaskUid: 11, relationType: 1, durationUnits: 6, duration: 7200 }),
    buildConsFixedDataRecord({ uniqueId: 2, predecessorTaskUid: 11, successorTaskUid: 12, relationType: 1, durationUnits: 4, duration: 900 }),
    buildConsFixedDataRecord({ uniqueId: 3, predecessorTaskUid: 12, successorTaskUid: 13, relationType: 1, durationUnits: 8, duration: 28800 }),
  );
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCons: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData } } } } },
  }));
  for (const [label, sequences] of [['elke opvolger', readRelations(cfb, null, taskIdByUniqueId)]] as const) {
    const bySucc = (id: string) => sequences.find((s) => s.successorId === id);
    const ehr = bySucc('task-B');
    const emin = bySucc('task-C');
    const ed = bySucc('task-D');
    truthy(`audit-4 ${label}: 3 relaties gelezen`, sequences.length === 3);
    truthy(`audit-4 ${label} "12 ehr" (code 6): lagMinutes 720 (kreeg ${ehr?.lagMinutes})`, ehr?.lagMinutes === 720);
    truthy(`audit-4 ${label} "12 ehr" (code 6): lagDays 0 (kreeg ${ehr?.lagDays})`, ehr?.lagDays === 0);
    truthy(`audit-4 ${label} "12 ehr" (code 6): lagUnit ELAPSEDTIME`, ehr?.lagUnit === 'ELAPSEDTIME');
    truthy(`audit-4 ${label} "90 emin" (code 4): lagMinutes 90 (kreeg ${emin?.lagMinutes})`, emin?.lagMinutes === 90);
    truthy(`audit-4 ${label} "90 emin" (code 4): lagUnit ELAPSEDTIME`, emin?.lagUnit === 'ELAPSEDTIME');
    truthy(`audit-4 ${label} "2 edays" (code 8) ongewijzigd: lagDays 2 (kreeg ${ed?.lagDays})`, ed?.lagDays === 2);
    truthy(`audit-4 ${label} "2 edays" (code 8) ongewijzigd: geen lagMinutes`, ed?.lagMinutes === undefined);
    truthy(`audit-4 ${label} "2 edays" (code 8) ongewijzigd: lagUnit ELAPSEDTIME`, ed?.lagUnit === 'ELAPSEDTIME');
  }
}

{
  const taskIdByUniqueId = new Map<number, string>([[10, 'task-A'], [11, 'task-B'], [12, 'task-C'], [13, 'task-D']]);
  const fixedMeta = buildConsFixedMetaBlob([0, 20, 40]);
  const fixedData = concatBytes(
    buildConsFixedDataRecord({ uniqueId: 1, predecessorTaskUid: 10, successorTaskUid: 11, relationType: 1, durationUnits: 7, duration: 1800 }),
    buildConsFixedDataRecord({ uniqueId: 2, predecessorTaskUid: 11, successorTaskUid: 12, relationType: 1, durationUnits: 5, duration: -1800 }),
    buildConsFixedDataRecord({ uniqueId: 3, predecessorTaskUid: 12, successorTaskUid: 13, relationType: 1, durationUnits: 8, duration: 21600 }),
  );
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCons: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData } } } } },
  }));
  const sequences = readRelations(cfb, null, taskIdByUniqueId);
  const bySucc = (id: string) => sequences.find((s) => s.successorId === id);
  const lag = (s: Sequence | undefined) => s && [s.lagDays, s.lagMinutes ?? null, s.lagUnit ?? null];
  truthy('351: 3 relaties gelezen', sequences.length === 3);
  const plus = lag(bySucc('task-B'));
  truthy(`351 werk-lag +1800 tienden (eenheid dagen): lagMinutes 180, geen dagen (kreeg ${JSON.stringify(plus)})`,
    JSON.stringify(plus) === JSON.stringify([0, 180, null]));
  const lead = lag(bySucc('task-C'));
  truthy(`351 werk-lead −1800 tienden (eenheid uren): lagMinutes −180, de lead blijft (kreeg ${JSON.stringify(lead)})`,
    JSON.stringify(lead) === JSON.stringify([0, -180, null]));
  const elapsed = lag(bySucc('task-D'));
  truthy(`351 lag 21600 tienden in verstreken dagen: 1,5 kalenderdag, niet 2 (kreeg ${JSON.stringify(elapsed)})`,
    JSON.stringify(elapsed) === JSON.stringify([1.5, null, 'ELAPSEDTIME']));
}

{
  const cfb = new CfbFile(buildNestedCfb({ '   114': { children: {} } }));
  truthy('T7 readRelations op ontbrekende TBkndCons: lege array', readRelations(cfb, null, new Map()).length === 0);
  truthy('T7 readResources op ontbrekende TBkndRsc: lege array', readResources(cfb, new Map(), null, emptyCalResult).resources.length === 0);
  truthy('T7 readAssignments op ontbrekende TBkndAssn: lege array', readAssignments(cfb, new Map(), new Map(), new Map()).length === 0);

  const first = readResources(cfb, new Map(), null, emptyCalResult);
  const second = readResources(cfb, new Map(), null, emptyCalResult);
  truthy('T7-kwaliteitsreview-I1 readResources: twee lege lezingen delen NIET dezelfde array-instantie', first.resources !== second.resources);
  truthy('T7-kwaliteitsreview-I1 readResources: twee lege lezingen delen NIET dezelfde Map-instantie', first.resourceIdByUniqueId !== second.resourceIdByUniqueId);
}

const BAD_MAGIC = 0xdeadbeef;
{
  const fixedMeta = buildConsFixedMetaBlob([0], 1, BAD_MAGIC);
  const fixedData = buildConsFixedDataRecord({ uniqueId: 1, predecessorTaskUid: 10, successorTaskUid: 11, relationType: 1, durationUnits: 7, duration: 0 });
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCons: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData } } } } },
  }));
  let sequences: Sequence[] = [];
  let threw: string | null = null;
  try {
    sequences = readRelations(cfb, null, new Map([[10, 'a'], [11, 'b']]));
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`T7-kwaliteitsreview-I3 readRelations-wrapper (fout FixedMeta-magic): gooit niet (${threw ?? ''})`, threw === null);
  truthy('T7-kwaliteitsreview-I3 readRelations-wrapper: lege array (fallback)', sequences.length === 0);
}
{
  const fixedMeta = buildRscFixedMetaBlob([buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: true })], BAD_MAGIC);
  const fixedData = buildRscFixedDataRecord({ uniqueId: 1, maxUnitsRaw: 10000 });
  const varMeta = buildVarMetaBytes([{ uniqueId: 1, type: 99, offset: 0 }]);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndRsc: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));
  let result: ReadResourcesResult | null = null;
  let threw: string | null = null;
  try {
    result = readResources(cfb, RESOURCE_DEFAULT_FIELD_MAP, null, emptyCalResult);
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`T7-kwaliteitsreview-I3 readResources-wrapper (fout FixedMeta-magic): gooit niet (${threw ?? ''})`, threw === null);
  truthy('T7-kwaliteitsreview-I3 readResources-wrapper: lege resourcelijst (fallback)', result?.resources.length === 0);
}
{
  const fixedMeta = buildAssnFixedMetaBlob([buildAssnFixedMetaRecord(0)], BAD_MAGIC);
  const fixedData = buildAssnFixedDataItem({ uniqueId: 1, taskUid: 10, resourceUid: 5, unitsRaw: 10000 });
  const varMeta = buildVarMetaBytes([{ uniqueId: 1, type: 99, offset: 0 }]);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndAssn: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));
  let assignments: ResourceAssignment[] = [];
  let threw: string | null = null;
  try {
    assignments = readAssignments(cfb, ASSIGNMENT_DEFAULT_FIELD_MAP, new Map([[10, 'task']]), new Map([[5, 'res']]));
  } catch (err) {
    threw = err instanceof Error ? err.message : String(err);
  }
  truthy(`T7-kwaliteitsreview-I3 readAssignments-wrapper (fout FixedMeta-magic): gooit niet (${threw ?? ''})`, threw === null);
  truthy('T7-kwaliteitsreview-I3 readAssignments-wrapper: lege array (fallback)', assignments.length === 0);
}

{
  const fixedMeta = buildRscFixedMetaBlob([buildRscFixedMetaRecord({ offsetIntoFixedData: 0, isWork: true })]);
  const fixedData = buildRscFixedDataRecord({ uniqueId: 1, maxUnitsRaw: Infinity });
  const varMeta = buildVarMetaBytes([{ uniqueId: 1, type: 99, offset: 0 }]);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndRsc: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));
  const result = readResources(cfb, RESOURCE_DEFAULT_FIELD_MAP, null, emptyCalResult);
  truthy('T7-kwaliteitsreview-I2 readResources: 1 resource gelezen', result.resources.length === 1);
  truthy('T7-kwaliteitsreview-I2 readResources: maxUnits eindig (Infinity-double ⇒ 0, geen Infinity-lek)', Number.isFinite(result.resources[0]?.maxUnits));
  truthy('T7-kwaliteitsreview-I2 readResources: maxUnits === 0', result.resources[0]?.maxUnits === 0);
}
{
  const fixedMeta = buildAssnFixedMetaBlob([buildAssnFixedMetaRecord(0)]);
  const fixedData = buildAssnFixedDataItem({ uniqueId: 1, taskUid: 10, resourceUid: 5, unitsRaw: -Infinity });
  const varMeta = buildVarMetaBytes([{ uniqueId: 1, type: 99, offset: 0 }]);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndAssn: { children: { FixedMeta: { data: fixedMeta }, FixedData: { data: fixedData }, VarMeta: { data: varMeta } } } } },
  }));
  const assignments = readAssignments(cfb, ASSIGNMENT_DEFAULT_FIELD_MAP, new Map([[10, 'task']]), new Map([[5, 'res']]));
  truthy('T7-kwaliteitsreview-I2 readAssignments: 1 assignment gelezen', assignments.length === 1);
  truthy('T7-kwaliteitsreview-I2 readAssignments: unitsPerDay eindig (-Infinity-double ⇒ 0)', Number.isFinite(assignments[0]?.unitsPerDay));
  truthy('T7-kwaliteitsreview-I2 readAssignments: unitsPerDay === 0', assignments[0]?.unitsPerDay === 0);
}

const CORPUS = process.env.OPS_MPP_CORPUS ?? '/home/nozzit/open-aec/voor claude/test bestanden voor file implementation';
const corpusPresent = existsSync(CORPUS);
const corpusFiles = corpusPresent ? readdirSync(CORPUS).filter((f) => f.toLowerCase().endsWith('.mpp')) : [];

function hashOfT7(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}
const corpusHashToFileT7 = new Map<string, string>();
for (const file of corpusFiles) {
  try {
    corpusHashToFileT7.set(hashOfT7(new Uint8Array(readFileSync(join(CORPUS, file)))), file);
  } catch {
  }
}
function resolveT7FileByHash(hash: string): string | null {
  return corpusHashToFileT7.get(hash) ?? null;
}

if (!corpusPresent) {
  console.log('OK  mpp-relations: corpus niet aanwezig (OPS_MPP_CORPUS) — corpuslus overgeslagen');
} else if (corpusFiles.length === 0) {
  console.log(`OK  mpp-relations: corpusmap aanwezig maar geen .mpp-bestanden erin (${CORPUS}) — corpuslus overgeslagen`);
} else {
  installDOMParser();

  const EXPECTED_COUNTS: Record<string, { relations: number; resources: number; assignments: number }> = {
    '870d339f60603f71': { relations: 105, resources: 9, assignments: 32 },
    '787efb968ae72fe4': { relations: 120, resources: 7, assignments: 125 },
    'a69fec157074d056': { relations: 239, resources: 5, assignments: 173 },
  };

  const RESOURCE_TYPE_MISMATCH_BUDGET: Record<string, number> = {
    '870d339f60603f71': 6,
    '787efb968ae72fe4': 0,
    'a69fec157074d056': 0,
  };

  function taskNameById(tasks: Task[]): Map<string, string> {
    return new Map(tasks.map((t) => [t.id, t.name.trim()]));
  }
  function resNameById(resources: Resource[]): Map<string, string> {
    return new Map(resources.map((r) => [r.id, r.name.trim()]));
  }

  for (const [hash, expected] of Object.entries(EXPECTED_COUNTS)) {
    const file = resolveT7FileByHash(hash);
    if (!file) {
      console.log(`OK  mpp-relations: T7 ${hash} niet in dit corpus (${CORPUS}) — overgeslagen`);
      continue;
    }
    const mppPath = join(CORPUS, file);
    const xmlPath = `${mppPath}.xml`;
    if (!existsSync(xmlPath)) {
      checks++;
      diffs.push(`[T7 ${hash}] .mpp aanwezig maar .mpp.xml ontbreekt`);
      continue;
    }

    let mpp: ReturnType<typeof readMPP>;
    let xml: ReturnType<typeof readMSPDI>;
    try {
      mpp = readMPP(new Uint8Array(readFileSync(mppPath)));
      xml = readMSPDI(readFileSync(xmlPath, 'utf-8'));
    } catch (err) {
      checks++;
      diffs.push(`[T7 ${hash}] readMPP/readMSPDI gooide onverwacht: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    truthy(`[T7 ${hash}] relatie-aantal >= gemeten basislijn (${mpp.sequences.length}/${expected.relations})`, mpp.sequences.length >= expected.relations);
    truthy(`[T7 ${hash}] resource-aantal === gemeten basislijn (${mpp.resources.length}/${expected.resources})`, mpp.resources.length === expected.resources);
    truthy(`[T7 ${hash}] assignment-aantal === gemeten basislijn (${mpp.assignments.length}/${expected.assignments})`, mpp.assignments.length === expected.assignments);

    const mppTaskName = taskNameById(mpp.tasks);
    const xmlTaskName = taskNameById(xml.tasks);
    const relKey = (seq: Sequence, names: Map<string, string>): string | null => {
      const p = names.get(seq.predecessorId);
      const s = names.get(seq.successorId);
      return p && s ? `${p} -> ${s}` : null;
    };
    const xmlRelByKey = new Map<string, Sequence[]>();
    for (const seq of xml.sequences) {
      const k = relKey(seq, xmlTaskName);
      if (!k) continue;
      const arr = xmlRelByKey.get(k) ?? [];
      arr.push(seq);
      xmlRelByKey.set(k, arr);
    }
    let relMatched = 0, relTypeOk = 0, relLagOk = 0;
    const relDiag: string[] = [];
    for (const seq of mpp.sequences) {
      const k = relKey(seq, mppTaskName);
      if (!k) continue;
      const queue = xmlRelByKey.get(k);
      const xseq = queue && queue.length > 0 ? queue.shift() : undefined;
      if (!xseq) continue;
      relMatched++;
      if (seq.type === xseq.type) relTypeOk++;
      else relDiag.push(`${k}: type mpp=${seq.type} xml=${xseq.type}`);
      const lagOk = (seq.lagDays ?? 0) === (xseq.lagDays ?? 0) && (seq.lagUnit ?? 'WORKTIME') === (xseq.lagUnit ?? 'WORKTIME');
      if (lagOk) relLagOk++;
      else relDiag.push(`${k}: lag mpp=(${seq.lagDays},${seq.lagUnit ?? 'WORKTIME'}) xml=(${xseq.lagDays},${xseq.lagUnit ?? 'WORKTIME'})`);
    }
    truthy(`[T7 ${hash}] relaties: alle op naam gematchte paren hebben gelijk type (${relTypeOk}/${relMatched})`, relTypeOk === relMatched);
    truthy(`[T7 ${hash}] relaties: alle op naam gematchte paren hebben gelijke lag (${relLagOk}/${relMatched})`, relLagOk === relMatched);

    const ourUnassigned = mpp.resources[0];
    const isOurUnassignedSentinel = !!ourUnassigned
      && ourUnassigned.name === 'Unassigned' && ourUnassigned.type === 'LABOR' && ourUnassigned.maxUnits === 1;
    truthy(`[T7 ${hash}] uid-0-plaatshouderresource materialiseert als de vaste sentinelvorm (mpp.resources[0])`, isOurUnassignedSentinel);
    const xmlUnassigned = xml.resources.find((r) => r.name.trim() === 'Niet toegekend');
    truthy(`[T7 ${hash}] MSPDI-ground-truth draagt zelf ook een "Niet toegekend"-plaatshouder`, !!xmlUnassigned);
    if (isOurUnassignedSentinel && xmlUnassigned && ourUnassigned) {
      truthy(`[T7 ${hash}] uid-0-plaatshouder: type gelijk aan XML se "Niet toegekend"`, ourUnassigned.type === xmlUnassigned.type);
      truthy(`[T7 ${hash}] uid-0-plaatshouder: maxUnits gelijk aan XML se "Niet toegekend"`, ourUnassigned.maxUnits === xmlUnassigned.maxUnits);
    }

    const restMppResources = isOurUnassignedSentinel ? mpp.resources.slice(1) : mpp.resources;
    const xmlResourcesByName = new Map(xml.resources.filter((r) => r.name.trim() !== 'Niet toegekend').map((r) => [r.name.trim(), r]));
    let resMatched = 0, maxUnitsOk = 0, typeMismatches = 0;
    const resDiag: string[] = [];
    for (const r of restMppResources) {
      const xr = xmlResourcesByName.get(r.name.trim());
      if (!xr) {
        resDiag.push(`resource "${r.name}" niet gevonden in MSPDI-ground-truth`);
        continue;
      }
      resMatched++;
      if (Math.abs(r.maxUnits - xr.maxUnits) < 0.001) maxUnitsOk++;
      else resDiag.push(`resource "${r.name}": maxUnits mpp=${r.maxUnits} xml=${xr.maxUnits}`);
      if (r.type === xr.type) {
      } else {
        typeMismatches++;
        resDiag.push(`resource "${r.name}": type mpp=${r.type} xml=${xr.type}`);
      }
    }
    truthy(`[T7 ${hash}] resources: alle niet-plaatshouder-resources op naam gematcht (${resMatched}/${restMppResources.length})`, resMatched === restMppResources.length);
    truthy(`[T7 ${hash}] resources: maxUnits gelijk voor alle gematchte paren (${maxUnitsOk}/${resMatched})`, maxUnitsOk === resMatched);
    const typeBudget = RESOURCE_TYPE_MISMATCH_BUDGET[hash] ?? 0;
    truthy(
      `[T7 ${hash}] resources: type-afwijkingen binnen de gemeten basislijn (${typeMismatches}/${typeBudget}, documentversieverschil — zie B5-toelichting)`,
      typeMismatches <= typeBudget,
    );

    const mppResName = resNameById(mpp.resources);
    const xmlResName = resNameById(xml.resources);
    const asgnKey = (a: ResourceAssignment, taskNames: Map<string, string>, resNames: Map<string, string>): string | null => {
      const t = taskNames.get(a.taskId);
      const r = resNames.get(a.resourceId);
      return t && r ? `${t} :: ${r}` : null;
    };
    const xmlAsgnByKey = new Map<string, ResourceAssignment[]>();
    for (const a of xml.assignments) {
      const k = asgnKey(a, xmlTaskName, xmlResName);
      if (!k) continue;
      const arr = xmlAsgnByKey.get(k) ?? [];
      arr.push(a);
      xmlAsgnByKey.set(k, arr);
    }
    let asgnMatched = 0, unitsOk = 0;
    const asgnDiag: string[] = [];
    for (const a of mpp.assignments) {
      const k = asgnKey(a, mppTaskName, mppResName);
      if (!k) continue;
      const queue = xmlAsgnByKey.get(k);
      const xa = queue && queue.length > 0 ? queue.shift() : undefined;
      if (!xa) continue;
      asgnMatched++;
      if (Math.abs(a.unitsPerDay - xa.unitsPerDay) < 0.001) unitsOk++;
      else asgnDiag.push(`${k}: units mpp=${a.unitsPerDay} xml=${xa.unitsPerDay}`);
    }
    truthy(`[T7 ${hash}] assignments: alle op naam gematchte paren hebben gelijke units (${unitsOk}/${asgnMatched})`, unitsOk === asgnMatched);
    truthy(`[T7 ${hash}] assignments: alle assignments zijn op naam gematcht (${asgnMatched}/${mpp.assignments.length})`, asgnMatched === mpp.assignments.length);

    softChecksRelationsTotal += relMatched * 2;
    softChecksResourcesTotal += resMatched + maxUnitsOk;
    softChecksAssignmentsTotal += unitsOk;
    console.log(
      `   . [T7 ${hash}] relaties=${mpp.sequences.length} (${relMatched} gematcht, ${relTypeOk} type-ok, ${relLagOk} lag-ok) `
      + `resources=${mpp.resources.length} (${resMatched} niet-plaatshouder naam-ok, ${maxUnitsOk} maxUnits-ok, ${typeMismatches}/${typeBudget} type-afwijkingen) `
      + `assignments=${mpp.assignments.length} (${asgnMatched} gematcht, ${unitsOk} units-ok):`,
    );
    if (process.env.OPS_MPP_DIAG === 'detail') {
      for (const d of [...relDiag, ...resDiag, ...asgnDiag]) console.log(`      · ${d}`);
    } else if (relDiag.length + resDiag.length + asgnDiag.length > 0) {
      console.log(`      · ${relDiag.length + resDiag.length + asgnDiag.length} detailregel(s) verborgen — zet OPS_MPP_DIAG=detail om ze te tonen (corpusinhoud)`);
    }
  }
}

{
  const CRAWL = resolveMppCrawlScopes(process.env).smoke;
  if (!existsSync(CRAWL)) {
    console.log('OK  mpp-relations: T7-crawl niet aanwezig (OPS_MPP_CRAWL_SMOKE of OPS_MPP_CRAWL/crawl-mpp) — crawlsectie overgeslagen');
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
      console.log(`OK  mpp-relations: T7-crawl-map aanwezig maar geen .mpp-bestanden erin (${CRAWL}) — crawlsectie overgeslagen`);
    } else {
      const CRAWL_RELATIONS_BASELINE = 604;
      const CRAWL_RESOURCES_BASELINE = 175;
      const CRAWL_ASSIGNMENTS_BASELINE = 320;
      const CRAWL_LABOR_BASELINE = 157;
      const CRAWL_MATERIAL_BASELINE = 18;

      let totalRelations = 0, totalResources = 0, totalAssignments = 0, totalLabor = 0, totalMaterial = 0, readFailures = 0;
      let supportedFiles = 0;
      const legacyRejected = { MPP8: 0, MPP9: 0, MPP12: 0 };
      for (const file of crawlFiles) {
        try {
          const entry = readMppCorpusEntry(new Uint8Array(readFileSync(file)), readMPP);
          if (entry.kind === 'legacy') {
            legacyRejected[entry.variant]++;
            continue;
          }
          const r = entry.value;
          supportedFiles++;
          totalRelations += r.sequences.length;
          totalResources += r.resources.length;
          totalAssignments += r.assignments.length;
          for (const res of r.resources) {
            if (res.type === 'LABOR') totalLabor++;
            else if (res.type === 'MATERIAL') totalMaterial++;
          }
        } catch (err) {
          readFailures++;
          checks++;
          diffs.push(`[T7-crawl] readMPP gooide onverwacht op ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      const legacyFiles = legacyRejected.MPP8 + legacyRejected.MPP9 + legacyRejected.MPP12;
      truthy(`[T7-crawl] alle bestanden verantwoord (${supportedFiles} ondersteund / ${legacyFiles} bewust geweigerd / ${readFailures} leesfouten)`,
        supportedFiles + legacyFiles + readFailures === crawlFiles.length);
      truthy(`[T7-crawl] minstens één ondersteund bestand (${supportedFiles})`, supportedFiles > 0);
      truthy(`[T7-crawl] geen onverwachte leesfouten over ${crawlFiles.length} bestanden`, readFailures === 0);
      truthy(`[T7-crawl] totaal relaties > 0 (${totalRelations})`, totalRelations > 0);
      truthy(`[T7-crawl] totaal resources > 0 (${totalResources})`, totalResources > 0);
      truthy(`[T7-crawl] totaal assignments > 0 (${totalAssignments})`, totalAssignments > 0);
      truthy(`[T7-crawl] relaties op/boven de gemeten basislijn (${totalRelations}/${CRAWL_RELATIONS_BASELINE})`, totalRelations >= CRAWL_RELATIONS_BASELINE);
      truthy(`[T7-crawl] resources op/boven de gemeten basislijn (${totalResources}/${CRAWL_RESOURCES_BASELINE})`, totalResources >= CRAWL_RESOURCES_BASELINE);
      truthy(`[T7-crawl] assignments op/boven de gemeten basislijn (${totalAssignments}/${CRAWL_ASSIGNMENTS_BASELINE})`, totalAssignments >= CRAWL_ASSIGNMENTS_BASELINE);
      truthy(`[T7-crawl] resourcetype LABOR op/boven de gemeten basislijn (${totalLabor}/${CRAWL_LABOR_BASELINE})`, totalLabor >= CRAWL_LABOR_BASELINE);
      truthy(`[T7-crawl] resourcetype MATERIAL op/boven de gemeten basislijn (${totalMaterial}/${CRAWL_MATERIAL_BASELINE})`, totalMaterial >= CRAWL_MATERIAL_BASELINE);
      console.log(
        `   . [T7-crawl] ${crawlFiles.length} bestanden: ${supportedFiles} ondersteund, `
        + `bewust geweigerd MPP8=${legacyRejected.MPP8}/MPP9=${legacyRejected.MPP9}/MPP12=${legacyRejected.MPP12}, `
        + `${readFailures} onverwachte leesfouten; relaties=${totalRelations} (basislijn ${CRAWL_RELATIONS_BASELINE}), `
        + `resources=${totalResources} (basislijn ${CRAWL_RESOURCES_BASELINE}, LABOR=${totalLabor}/${CRAWL_LABOR_BASELINE} MATERIAL=${totalMaterial}/${CRAWL_MATERIAL_BASELINE}), `
        + `assignments=${totalAssignments} (basislijn ${CRAWL_ASSIGNMENTS_BASELINE})`,
      );
    }
  }
}

if (diffs.length === 0) {
  console.log(
    `OK  mpp-relations: alle checks groen (${checks} hard + ${softChecksRelationsTotal} relatie-paar-tellingen `
    + `+ ${softChecksResourcesTotal} resource-paar-tellingen + ${softChecksAssignmentsTotal} assignment-paar-tellingen)`,
  );
  process.exit(0);
} else {
  console.log(`XX  mpp-relations: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
