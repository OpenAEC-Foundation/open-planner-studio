// Bron: MPXJ, © Jon Iles e.a., veldkennis van `MPP14Reader` en `FieldMap14` voor de taakscan geport naar TypeScript (LGPL-2.1, github.com/joniles/mpxj).
import { openMppProject } from '@/services/mpp/mppReader';
import {
  createTaskFieldMap, TaskFieldId, fixedOffsetOf, varDataKeyOf, type FieldMapTable,
} from '@/services/mpp/fieldMap14';
import {
  FixedData, FixedMeta, Var2Data, VarMeta12, getInt, getShort, getTimestamp, getDurationTimeUnits,
} from '@/services/mpp/mppPrimitives';
import type { Props } from '@/services/mpp/mppContainer';
import { MAX_VAR_TEXT_BYTES } from '@/services/mpp/limits';

const TASK_FIXED_META_ITEM_SIZE = 47;
const NULL_TASK_BLOCK_SIZE = 16;
const DELETED_TASK_FLAG = 0x02;
const FIRST_TASK_INDEX = 3;

function taskModeBitFlag(applicationVersion: number | null): { offset: number; mask: number } {
  const version = applicationVersion ?? 0;
  return version <= 14
    ? { offset: 8, mask: 0x08 }
    : { offset: 8, mask: 0x80 };
}

const TASK_MODE_BLOCK1_START_OFFSET_FALLBACK = 50;
const TASK_MODE_BLOCK1_FINISH_OFFSET_FALLBACK = 54;
const TASK_MODE_FIELD_START = 1283;
const TASK_MODE_FIELD_FINISH = 1284;
const PROPS_KEY_TASK_FIELD_MAP = 131092;
const PROPS_KEY_TASK_FIELD_MAP2 = 50331668;
const FIELD_MAP_ENTRY_SIZE = 28;
const NO_FIXED_OFFSET = 65535;
const META_DATA_CATEGORIES = new Set([0x0b, 0x64]);

function block1TaskStartFinishOffsets(props: Props): { start: number; finish: number } {
  const bytes = props.getByteArray(PROPS_KEY_TASK_FIELD_MAP) ?? props.getByteArray(PROPS_KEY_TASK_FIELD_MAP2);
  if (bytes) {
    let lastDataBlockOffset = 0;
    let dataBlockIndex = 0;
    let start: number | null = null;
    let finish: number | null = null;
    for (let pos = 0; pos + FIELD_MAP_ENTRY_SIZE <= bytes.length; pos += FIELD_MAP_ENTRY_SIZE) {
      const dataBlockOffset = getShort(bytes, pos + 4, 'groundTruth fieldMap dataBlockOffset');
      const typeValue = getInt(bytes, pos + 12, 'groundTruth fieldMap typeValue');
      const category = getShort(bytes, pos + 20, 'groundTruth fieldMap category');
      const index = typeValue & 0xffff;
      if (META_DATA_CATEGORIES.has(category)) continue;
      if (dataBlockOffset === NO_FIXED_OFFSET) continue;
      if (dataBlockOffset < lastDataBlockOffset) dataBlockIndex++;
      lastDataBlockOffset = dataBlockOffset;
      if (dataBlockIndex !== 1) continue;
      if (index === TASK_MODE_FIELD_START) start = dataBlockOffset;
      else if (index === TASK_MODE_FIELD_FINISH) finish = dataBlockOffset;
    }
    if (start !== null && finish !== null) return { start, finish };
  }
  return { start: TASK_MODE_BLOCK1_START_OFFSET_FALLBACK, finish: TASK_MODE_BLOCK1_FINISH_OFFSET_FALLBACK };
}

function resolveScheduleField(raw: Date | null, scheduled: Date | null, isManual: boolean): Date | null {
  const overrideWithScheduled = raw === null || (scheduled !== null && !isManual);
  return overrideWithScheduled ? scheduled : raw;
}

const TASK_FIXED2_META_ITEM_SIZE_CANDIDATES = [92, 93, 94, 95, 96];

export interface RawTask {
  uniqueId: number;
  id: number;
  name: string;
  start: Date | null;
  finish: Date | null;
  durationRaw: number;
  durUnit: string;
}

export function scanGroundTruthTasks(bytes: Uint8Array): { raws: RawTask[]; fieldMap: FieldMapTable } {
  const { cfb, projectProps, applicationVersion } = openMppProject(bytes);
  const fm = createTaskFieldMap(projectProps);
  const fixedMetaBytes = cfb.getStream(['   114', 'TBkndTask', 'FixedMeta'])!;
  const fixedDataBytes = cfb.getStream(['   114', 'TBkndTask', 'FixedData'])!;
  const varMetaBytes = cfb.getStream(['   114', 'TBkndTask', 'VarMeta'])!;
  const var2DataBytes = cfb.getStream(['   114', 'TBkndTask', 'Var2Data']);
  const fixedMeta = FixedMeta.withItemSize(fixedMetaBytes, TASK_FIXED_META_ITEM_SIZE, 'ground-truth/meta');
  const fixedData = FixedData.fromMeta(fixedMeta, fixedDataBytes, 0, 0, 'ground-truth/data');
  const varMeta = new VarMeta12(varMetaBytes, 'ground-truth/varmeta');
  const varData = new Var2Data(varMeta, var2DataBytes);

  const fixed2MetaBytes = cfb.getStream(['   114', 'TBkndTask', 'Fixed2Meta']);
  const fixed2DataBytes = cfb.getStream(['   114', 'TBkndTask', 'Fixed2Data']);
  let fixed2Meta: FixedMeta | null = null;
  let fixed2Data: FixedData | null = null;
  if (fixed2MetaBytes && fixed2DataBytes) {
    try {
      fixed2Meta = FixedMeta.withHeuristicItemSize(fixed2MetaBytes, fixedData, TASK_FIXED2_META_ITEM_SIZE_CANDIDATES, 'ground-truth/meta2');
      fixed2Data = FixedData.fromMeta(fixed2Meta, fixed2DataBytes, 0, 0, 'ground-truth/data2');
    } catch {
      fixed2Meta = null;
      fixed2Data = null;
    }
  }
  const { offset: tmOffset, mask: tmMask } = taskModeBitFlag(applicationVersion);
  const { start: manualStartOffset, finish: manualFinishOffset } = block1TaskStartFinishOffsets(projectProps);

  const offUid = fixedOffsetOf(fm, TaskFieldId.UniqueId)!;
  const offId = fixedOffsetOf(fm, TaskFieldId.Id)!;
  const offStart = fixedOffsetOf(fm, TaskFieldId.ScheduledStart)!;
  const offFinish = fixedOffsetOf(fm, TaskFieldId.ScheduledFinish)!;
  const offDur = fixedOffsetOf(fm, TaskFieldId.ScheduledDuration);
  const offDurUnits = fixedOffsetOf(fm, TaskFieldId.DurationUnits);
  const nameKey = varDataKeyOf(fm, TaskFieldId.Name)!;

  const byUid = new Map<number, number>();
  const deleted = new Set<number>();
  const count = fixedMeta.getAdjustedItemCount();
  for (let i = FIRST_TASK_INDEX; i < count; i++) {
    const data = fixedData.getByteArrayValue(i);
    if (!data) continue;
    const meta = fixedMeta.getByteArrayValue(i);
    if (!meta || meta.length < 4) continue;
    if ((getInt(meta, 0, 'f') & DELETED_TASK_FLAG) !== 0) {
      if (data.length >= 2) deleted.add(getShort(data, 0, 'd'));
      continue;
    }
    if (data.length === NULL_TASK_BLOCK_SIZE) continue;
    if (data.length < offUid + 4) continue;
    byUid.set(getInt(data, offUid, 'uid'), i);
  }
  for (const uid of deleted) if (byUid.has(uid) && !varMeta.containsKey(uid)) byUid.delete(uid);

  const raws: RawTask[] = [];
  for (const [uid, idx] of byUid) {
    if (uid === 0) continue;
    const data = fixedData.getByteArrayValue(idx)!;

    const metaItem2 = fixed2Meta ? fixed2Meta.getByteArrayValue(idx) : null;
    const isManual = !!metaItem2 && metaItem2.length >= tmOffset + 4
      && (getInt(metaItem2, tmOffset, 'tm') & tmMask) !== 0;
    const data2 = fixed2Data ? fixed2Data.getByteArrayValue(idx) : null;
    const scheduledStart = data.length >= offStart + 4 ? getTimestamp(data, offStart, 's') : null;
    const scheduledFinish = data.length >= offFinish + 4 ? getTimestamp(data, offFinish, 'f') : null;
    const rawStart = data2 && data2.length >= manualStartOffset + 4 ? getTimestamp(data2, manualStartOffset, 'ms') : null;
    const rawFinish = data2 && data2.length >= manualFinishOffset + 4 ? getTimestamp(data2, manualFinishOffset, 'mf') : null;

    raws.push({
      uniqueId: uid,
      id: data.length >= offId + 4 ? getInt(data, offId, 'id') : uid,
      name: varData.getUnicodeString(uid, nameKey, MAX_VAR_TEXT_BYTES, 'n') || 'Task',
      start: resolveScheduleField(rawStart, scheduledStart, isManual),
      finish: resolveScheduleField(rawFinish, scheduledFinish, isManual),
      durationRaw: offDur !== null && data.length >= offDur + 4 ? getInt(data, offDur, 'du') : 0,
      durUnit: offDurUnits !== null && data.length >= offDurUnits + 2 ? getDurationTimeUnits(getShort(data, offDurUnits, 'dun')) : '?',
    });
  }
  raws.sort((a, b) => a.id - b.id);
  return { raws, fieldMap: fm };
}
