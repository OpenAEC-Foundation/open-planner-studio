// Bron: MPXJ, © Jon Iles e.a., structuurkennis en veldconstanten geport naar TypeScript (LGPL-2.1, github.com/joniles/mpxj).
import type { Sequence } from '@/types/sequence';
import type { Resource, ResourceAssignment, ResourceType } from '@/types/resource';
import type { ImportLabels } from '@/services/importTypes';
import { generateId } from '@/utils/id';
import { mspTypeToSequenceType } from '@/services/msproject/mspdiReader';
import type { CfbFile } from './cfb';
import {
  FixedData, FixedMeta, Var2Data, VarMeta12,
  getDouble, getDuration, getDurationTimeUnits, getInt, getShort,
} from './mppPrimitives';
import {
  AssignmentFieldId, ResourceFieldId,
  fixedOffsetOf, varDataKeyOf, type FieldMapTable,
} from './fieldMap14';
import type { CalendarReadResult } from './mppCalendars';
import { MAX_VAR_TEXT_BYTES } from './limits';
import type { AssignmentTimephasedRaw } from './mppTimephased';
import { selectAssignmentRecords } from './mppRecords';

const CONS_FIXED_META_ITEM_SIZE = 10;
const CONS_FIXED_DATA_ITEM_SIZE = 20;

type SequenceLagFields = Pick<Sequence, 'lagDays'> & Partial<Pick<Sequence, 'lagMinutes' | 'lagUnit' | 'lagPercent'>>;

function mppLagToSequenceFields(rawLag: number, unitCode: number): SequenceLagFields {
  if (rawLag === -1) return { lagDays: 0 };
  const unit = getDurationTimeUnits(unitCode);
  if (unit === 'percent' || unit === 'elapsedPercent') {
    const fields: SequenceLagFields = { lagDays: 0, lagPercent: rawLag / 10 };
    if (unit === 'elapsedPercent') fields.lagUnit = 'ELAPSEDTIME';
    return fields;
  }
  if (unit === 'elapsedDays') return { lagDays: getDuration(rawLag, 'elapsedDays'), lagUnit: 'ELAPSEDTIME' };
  if (unit.startsWith('elapsed')) return { lagDays: 0, lagMinutes: rawLag / 10, lagUnit: 'ELAPSEDTIME' };
  return { lagDays: 0, lagMinutes: rawLag / 10 };
}

export function readRelations(
  cfb: CfbFile,
  applicationVersion: number | null,
  taskIdByUniqueId: ReadonlyMap<number, string>,
): Sequence[] {
  try {
    return readRelationsUnsafe(cfb, applicationVersion, taskIdByUniqueId);
  } catch {
    return [];
  }
}

function readRelationsUnsafe(
  cfb: CfbFile,
  applicationVersion: number | null,
  taskIdByUniqueId: ReadonlyMap<number, string>,
): Sequence[] {
  const label = '"   114"/TBkndCons';
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndCons', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndCons', 'FixedData']);
  if (!fixedMetaBytes || !fixedDataBytes) return [];

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, CONS_FIXED_META_ITEM_SIZE, `${label}/FixedMeta`);
  const fixedData = FixedData.withItemSizeOverride(fixedMeta, CONS_FIXED_DATA_ITEM_SIZE, fixedDataBytes, `${label}/FixedData`);

  const project15 = (applicationVersion ?? 0) > 14;
  const durationOffset = project15 ? 14 : 16;
  const durationUnitsOffset = project15 ? 18 : 14;

  const sequences: Sequence[] = [];
  const itemCount = fixedMeta.getItemCount();
  for (let index = 0; index < itemCount; index++) {
    const metaItem = fixedMeta.getByteArrayValue(index);
    if (!metaItem || metaItem.length < 8) continue;
    if (getShort(metaItem, 0, `${label}/FixedMeta deleted-flag`) !== 0) continue;

    const dataOffset = getInt(metaItem, 4, `${label}/FixedMeta offset`);
    const dataIndex = fixedData.getIndexFromOffset(dataOffset);
    if (dataIndex === -1) continue;
    const data = fixedData.getByteArrayValue(dataIndex);
    if (!data || data.length < 14) continue;

    const predecessorUid = getInt(data, 4, `${label}/FixedData taskId1`);
    const successorUid = getInt(data, 8, `${label}/FixedData taskId2`);
    if (predecessorUid === 0 || successorUid === 0) continue;
    if (predecessorUid === successorUid) continue;

    const predecessorId = taskIdByUniqueId.get(predecessorUid);
    const successorId = taskIdByUniqueId.get(successorUid);
    if (!predecessorId || !successorId) continue;

    const relationTypeRaw = getShort(data, 12, `${label}/FixedData type`);
    const type = mspTypeToSequenceType(relationTypeRaw);

    const lagRaw = data.length >= durationOffset + 4 ? getInt(data, durationOffset, `${label}/FixedData lag`) : -1;
    const lagUnitsRaw = data.length >= durationUnitsOffset + 2 ? getShort(data, durationUnitsOffset, `${label}/FixedData lagUnits`) : 0;

    sequences.push({
      id: generateId('seq'),
      predecessorId,
      successorId,
      type,
      ...mppLagToSequenceFields(lagRaw, lagUnitsRaw),
    });
  }
  return sequences;
}

const RESOURCE_FIXED_META_ITEM_SIZE = 37;
const RESOURCE_FIXED2_META_ITEM_SIZES = [50, 51];

function resourceTypeBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  const version = applicationVersion ?? 0;
  return version > 14
    ? { offset: 12, mask: 0x10 }
    : { offset: 9, mask: 0x02 };
}

function isFixed2MetaCostBit(fixed2Meta: FixedMeta | null, index: number): boolean {
  const item = fixed2Meta?.getByteArrayValue(index) ?? null;
  return !!item && item.length > 8 && (item[8] & 0x10) !== 0;
}

export interface ReadResourcesResult {
  resources: Resource[];
  resourceIdByUniqueId: Map<number, string>;
  costResourceIds: Set<string>;
}

function emptyResourcesResult(): ReadResourcesResult {
  return { resources: [], resourceIdByUniqueId: new Map(), costResourceIds: new Set() };
}

export function readResources(
  cfb: CfbFile,
  resourceFieldMap: FieldMapTable,
  applicationVersion: number | null,
  calResult: CalendarReadResult,
  labels?: ImportLabels,
): ReadResourcesResult {
  try {
    return readResourcesUnsafe(cfb, resourceFieldMap, applicationVersion, calResult, labels);
  } catch {
    return emptyResourcesResult();
  }
}

function readResourcesUnsafe(
  cfb: CfbFile,
  resourceFieldMap: FieldMapTable,
  applicationVersion: number | null,
  calResult: CalendarReadResult,
  labels: ImportLabels | undefined,
): ReadResourcesResult {
  const label = '"   114"/TBkndRsc';
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndRsc', 'FixedMeta']);
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndRsc', 'FixedData']);
  const varMetaBytes = cfb.getStream(['   114', 'TBkndRsc', 'VarMeta']);
  if (!fixedMetaBytes || !fixedDataBytes || !varMetaBytes) return emptyResourcesResult();
  const var2DataBytes = cfb.getStream(['   114', 'TBkndRsc', 'Var2Data']);

  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, RESOURCE_FIXED_META_ITEM_SIZE, `${label}/FixedMeta`);
  const fixedData = FixedData.fromMeta(fixedMeta, fixedDataBytes, 0, 0, `${label}/FixedData`);
  const varMeta = new VarMeta12(varMetaBytes, `${label}/VarMeta`);
  const varData = new Var2Data(varMeta, var2DataBytes);

  const fixed2MetaBytes = cfb.getStream(['   114', 'TBkndRsc', 'Fixed2Meta']);
  let fixed2Meta: FixedMeta | null = null;
  if (fixed2MetaBytes) {
    try {
      fixed2Meta = FixedMeta.withHeuristicItemSize(fixed2MetaBytes, fixedData, RESOURCE_FIXED2_META_ITEM_SIZES, `${label}/Fixed2Meta`);
    } catch {
      fixed2Meta = null;
    }
  }

  const uniqueIdOffset = fixedOffsetOf(resourceFieldMap, ResourceFieldId.UniqueId);
  const nameKey = varDataKeyOf(resourceFieldMap, ResourceFieldId.Name);
  const maxUnitsOffset = fixedOffsetOf(resourceFieldMap, ResourceFieldId.MaxUnits);
  if (uniqueIdOffset === null || nameKey === null) return emptyResourcesResult();

  const minFixedDataSize = Math.max(uniqueIdOffset + 2, maxUnitsOffset === null ? 0 : maxUnitsOffset + 8);
  const { offset: typeOffset, mask: typeMask } = resourceTypeBitFlag(applicationVersion);
  const indexByShortUid = new Map<number, number>();
  const itemCount = fixedMeta.getAdjustedItemCount();
  for (let index = 0; index < itemCount; index++) {
    const data = fixedData.getByteArrayValue(index);
    if (!data || data.length < uniqueIdOffset + 2) continue;
    const shortUid = getShort(data, uniqueIdOffset, `${label}/FixedData uniqueId (short, spiegelt MPXJ)`);
    if (shortUid !== 0 && data.length < minFixedDataSize) continue;
    if (!indexByShortUid.has(shortUid)) indexByShortUid.set(shortUid, index);
  }

  const resources: Resource[] = [];
  const resourceIdByUniqueId = new Map<number, string>();
  const costResourceIds = new Set<string>();
  for (const uniqueId of varMeta.getUniqueIdentifierArray()) {
    const index = indexByShortUid.get(uniqueId);
    if (index === undefined) continue;
    const data = fixedData.getByteArrayValue(index);
    if (!data) continue;

    const isUnassignedPlaceholder = uniqueId === 0;

    const name = isUnassignedPlaceholder
      ? (labels?.unassignedResource || 'Unassigned')
      : varData.getUnicodeString(uniqueId, nameKey, MAX_VAR_TEXT_BYTES, `${label}/name[uid=${uniqueId}]`) || 'Resource';

    let type: ResourceType;
    let isCost = false;
    if (isUnassignedPlaceholder) {
      type = 'LABOR';
    } else {
      const metaItem = fixedMeta.getByteArrayValue(index);
      const isWork = !!metaItem && metaItem.length > typeOffset && (metaItem[typeOffset] & typeMask) !== 0;
      isCost = !isWork && isFixed2MetaCostBit(fixed2Meta, index);
      type = isWork || isCost ? 'LABOR' : 'MATERIAL';
    }

    let maxUnits = 1;
    if (!isUnassignedPlaceholder && maxUnitsOffset !== null && data.length >= maxUnitsOffset + 8) {
      const rawUnits = getDouble(data, maxUnitsOffset, `${label}/FixedData maxUnits`);
      maxUnits = (Math.abs(rawUnits) < 0.1 ? 0 : rawUnits) / 100 / 100;
    }

    const resource: Resource = { id: generateId('res'), name, type, description: '', maxUnits };
    const calUid = calResult.resourceCalendarUniqueIdByResourceUniqueId.get(uniqueId);
    if (calUid !== undefined) {
      const cal = calResult.calendarByUniqueId.get(calUid);
      if (cal) resource.calendarId = cal.id;
    }

    resources.push(resource);
    resourceIdByUniqueId.set(uniqueId, resource.id);
    if (isCost) costResourceIds.add(resource.id);
  }
  return { resources, resourceIdByUniqueId, costResourceIds };
}

export function readAssignments(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  resourceIdByUniqueId: ReadonlyMap<number, string>,
): ResourceAssignment[] {
  try {
    return readAssignmentsUnsafe(cfb, assignmentFieldMap, taskIdByUniqueId, resourceIdByUniqueId);
  } catch {
    return [];
  }
}

function readAssignmentsUnsafe(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
  taskIdByUniqueId: ReadonlyMap<number, string>,
  resourceIdByUniqueId: ReadonlyMap<number, string>,
): ResourceAssignment[] {
  const label = '"   114"/TBkndAssn';
  const uniqueIdOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.UniqueId);
  const taskUidOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.TaskUniqueId);
  const resourceUidOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.ResourceUniqueId);
  const unitsOffset = fixedOffsetOf(assignmentFieldMap, AssignmentFieldId.Units);
  if (uniqueIdOffset === null || taskUidOffset === null || resourceUidOffset === null) return [];
  const selected = selectAssignmentRecords(cfb, uniqueIdOffset);
  if (!selected) return [];

  const assignments: ResourceAssignment[] = [];
  for (const { data } of selected.records) {
    if (data.length < taskUidOffset + 4 || data.length < resourceUidOffset + 4) continue;
    const taskUid = getInt(data, taskUidOffset, `${label}/FixedData taskUid`);
    const resourceUid = getInt(data, resourceUidOffset, `${label}/FixedData resourceUid`);
    const taskId = taskIdByUniqueId.get(taskUid);
    const resourceId = resourceIdByUniqueId.get(resourceUid);
    if (!taskId || !resourceId) continue;

    const unitsPerDay = decodeAssignmentUnits(data, unitsOffset) ?? 1;

    assignments.push({ id: generateId('asgn'), taskId, resourceId, unitsPerDay });
  }
  return assignments;
}

export function decodeAssignmentUnits(data: Uint8Array, unitsOffset: number | null): number | null {
  if (unitsOffset === null || data.length < unitsOffset + 8) return null;
  const rawUnits = getDouble(data, unitsOffset, '"   114"/TBkndAssn/FixedData units');
  return (Math.abs(rawUnits) < 0.1 ? 0 : rawUnits) / 100 / 100;
}

export function readAssignmentTimephasedRaw(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
): Map<number, AssignmentTimephasedRaw> {
  try {
    return readAssignmentTimephasedRawUnsafe(cfb, assignmentFieldMap);
  } catch {
    return new Map();
  }
}

function readAssignmentTimephasedRawUnsafe(
  cfb: CfbFile,
  assignmentFieldMap: FieldMapTable,
): Map<number, AssignmentTimephasedRaw> {
  const label = '"   114"/TBkndAssn';
  const varMetaBytes = cfb.getStream(['   114', 'TBkndAssn', 'VarMeta']);
  if (!varMetaBytes) return new Map();
  const var2DataBytes = cfb.getStream(['   114', 'TBkndAssn', 'Var2Data']);

  const varMeta = new VarMeta12(varMetaBytes, `${label}/VarMeta`);
  const varData = new Var2Data(varMeta, var2DataBytes);

  const actualRegularKey = varDataKeyOf(assignmentFieldMap, AssignmentFieldId.ActualRegularWork);
  const remainingRegularKey = varDataKeyOf(assignmentFieldMap, AssignmentFieldId.RemainingRegularWork);
  const actualOvertimeKey = varDataKeyOf(assignmentFieldMap, AssignmentFieldId.ActualOvertimeWork);
  const actualIrregularKey = varDataKeyOf(assignmentFieldMap, AssignmentFieldId.ActualIrregularWork);

  const result = new Map<number, AssignmentTimephasedRaw>();
  for (const uniqueId of varMeta.getUniqueIdentifierArray()) {
    const raw: AssignmentTimephasedRaw = {
      actualRegularWork: actualRegularKey === null ? null : varData.getByteArray(uniqueId, actualRegularKey),
      remainingRegularWork: remainingRegularKey === null ? null : varData.getByteArray(uniqueId, remainingRegularKey),
      actualOvertimeWork: actualOvertimeKey === null ? null : varData.getByteArray(uniqueId, actualOvertimeKey),
      actualIrregularWork: actualIrregularKey === null ? null : varData.getByteArray(uniqueId, actualIrregularKey),
    };
    if (raw.actualRegularWork || raw.remainingRegularWork || raw.actualOvertimeWork || raw.actualIrregularWork) {
      result.set(uniqueId, raw);
    }
  }
  return result;
}
