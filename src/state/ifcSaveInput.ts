import { projectForIfcExport } from '@/services/ifc/ifcSchemaQuestion';
import { buildWriteIFCInput, type IFCSaveSource, type IFCWriteInput, type IFCWriteMode } from '@/services/documentData';
import { savedCustomTaskTypes } from '@/services/taskTypes/customTaskTypeRules';

export { buildWriteIFCInput, type IFCSaveSource, type IFCWriteInput, type IFCWriteMode } from '@/services/documentData';

export function buildExportIFCInput(src: IFCSaveSource, mode: IFCWriteMode): IFCWriteInput {
  const input = buildWriteIFCInput(src, mode);
  return { ...input, project: projectForIfcExport(input.project) };
}

const IFC_SAVE_KEYS = [
  'project', 'calendar', 'tasks', 'sequences', 'resources', 'assignments',
  'activityCodeTypes', 'customFieldDefs', 'customTaskTypes', 'calendars', 'baselines', 'activeBaselineId', 'comparedBaselineIds',
  'xerImportMetadata', 'xerSourceArchive', 'xerSourceProjectId', 'importPristine',
  'recordedDates', 'datesAsRecorded', 'minuteModelPending', 'ifcGlobalIds', 'ifcLiteralCalendarIds', 'foreignSourceMark',
  'ifcSource', 'ifcxReferences',
] as const;

type MissingSaveKey = Exclude<keyof IFCSaveSource, typeof IFC_SAVE_KEYS[number]>;
type ExtraSaveKey = Exclude<typeof IFC_SAVE_KEYS[number], keyof IFCSaveSource>;
const _assertSaveKeysComplete: MissingSaveKey extends never ? true : ['IFC_SAVE_KEYS mist:', MissingSaveKey] = true;
const _assertSaveKeysNoExtras: ExtraSaveKey extends never ? true : ['IFC_SAVE_KEYS bevat onbekende sleutels:', ExtraSaveKey] = true;
void _assertSaveKeysComplete;
void _assertSaveKeysNoExtras;

const IFC_DIRTY_KEYS = IFC_SAVE_KEYS.filter(
  (key): key is Exclude<typeof IFC_SAVE_KEYS[number], 'ifcSource'> => key !== 'ifcSource',
);
type DirtyKey = Exclude<keyof IFCSaveSource, 'ifcSource'>;
type MissingDirtyKey = Exclude<DirtyKey, typeof IFC_DIRTY_KEYS[number]>;
type ExtraDirtyKey = Exclude<typeof IFC_DIRTY_KEYS[number], DirtyKey>;
const _assertDirtyKeysComplete: MissingDirtyKey extends never ? true : ['IFC_DIRTY_KEYS mist:', MissingDirtyKey] = true;
const _assertDirtyKeysNoExtras: ExtraDirtyKey extends never ? true : ['IFC_DIRTY_KEYS bevat onbekende sleutels:', ExtraDirtyKey] = true;
void _assertDirtyKeysComplete;
void _assertDirtyKeysNoExtras;

export function sameIFCSource(a: IFCSaveSource, b: IFCSaveSource): boolean {
  return IFC_DIRTY_KEYS.every((k) => a[k] === b[k]
    || (k === 'customTaskTypes' && a.tasks === b.tasks && sameSavedCustomTaskTypes(a, b)));
}

export function unchangedSaveFields(source: IFCSaveSource): (current: IFCSaveSource) => boolean {
  const fields = IFC_SAVE_KEYS.map(key => {
    const value = source[key];
    return value && typeof value === 'object' ? new WeakSet<object>([value]) : value;
  });
  return current => IFC_SAVE_KEYS.every((key, i) => {
    const value = current[key], field = fields[i];
    return field instanceof WeakSet ? !!value && typeof value === 'object' && field.has(value) : field === value;
  });
}

function sameSavedCustomTaskTypes(a: IFCSaveSource, b: IFCSaveSource): boolean {
  return JSON.stringify(savedCustomTaskTypes(a.tasks, a.customTaskTypes))
    === JSON.stringify(savedCustomTaskTypes(b.tasks, b.customTaskTypes));
}
