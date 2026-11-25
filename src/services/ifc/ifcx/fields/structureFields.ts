import type { ActivityCodeType, CustomFieldDef, CustomFieldType, CustomFieldValue } from '@/types/structure';
import type { CustomTaskType, Task } from '@/types/task';
import { arrayOf, BOOLEAN, objectOf, REAL, TEXT, type IfcxField, type IfcxMember, type IfcxValue } from '../fieldTable';
import { copyAs, enumOfTable, optional, passthroughField, required } from './passthroughFields';
import type { DocumentReadTarget, DocumentWriteSource } from './documentFields';
import type { TaskReadTarget, TaskWriteSource } from './taskFields';

export interface PlanningStructure {
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  customTaskTypes: CustomTaskType[];
}

type DocumentField = IfcxField<DocumentWriteSource, DocumentReadTarget>;
type TaskField = IfcxField<TaskWriteSource, TaskReadTarget>;

const CUSTOM_FIELD_TYPES = {
  text: true, number: true, integer: true, cost: true, date: true, boolean: true,
} satisfies Record<CustomFieldType, true>;

const CODE_VALUE = objectOf({
  id: required(TEXT), code: required(TEXT), description: optional(TEXT), color: optional(TEXT),
} satisfies Record<keyof ActivityCodeType['values'][number], IfcxMember>);

const CODE_TYPES = arrayOf(objectOf({
  id: required(TEXT), name: required(TEXT), values: required(arrayOf(CODE_VALUE)),
} satisfies Record<keyof ActivityCodeType, IfcxMember>));

const FIELD_DEFS = arrayOf(objectOf({
  id: required(TEXT), name: required(TEXT), type: required(enumOfTable(CUSTOM_FIELD_TYPES)),
} satisfies Record<keyof CustomFieldDef, IfcxMember>));

const TASK_TYPES = arrayOf(objectOf({
  id: required(TEXT), name: required(TEXT), color: required(TEXT),
} satisfies Record<keyof CustomTaskType, IfcxMember>));

function structureList<K extends keyof PlanningStructure>(key: K, value: IfcxValue): DocumentField {
  return {
    key, value, optional: true,
    write: source => (source.structure[key].length > 0 ? copyAs(value, source.structure[key]) : undefined),
    read: (stored, target) => { target.structure[key] = (stored === undefined ? [] : copyAs(value, stored)) as PlanningStructure[K]; },
  };
}

export const STRUCTURE_DOCUMENT_FIELDS: readonly DocumentField[] = [
  structureList('activityCodeTypes', CODE_TYPES),
  structureList('customFieldDefs', FIELD_DEFS),
  structureList('customTaskTypes', TASK_TYPES),
];

export function emptyStructure(): PlanningStructure {
  return { activityCodeTypes: [], customFieldDefs: [], customTaskTypes: [] };
}

interface StoredCode { readonly type: string; readonly value: string }
interface StoredFieldValue { readonly field: string; readonly text?: string; readonly number?: number; readonly boolean?: boolean }

const TASK_CODES = arrayOf(objectOf({ type: required(TEXT), value: required(TEXT) }));
const TASK_FIELD_VALUES = arrayOf(objectOf({
  field: required(TEXT), text: optional(TEXT), number: optional(REAL), boolean: optional(BOOLEAN),
}));

function storedFieldValue(field: string, value: CustomFieldValue): StoredFieldValue {
  if (typeof value === 'string') return { field, text: value };
  if (typeof value === 'number') return { field, number: value };
  return { field, boolean: value };
}

export const STRUCTURE_TASK_FIELDS: readonly TaskField[] = [
  passthroughField<TaskWriteSource, TaskReadTarget, string>(
    'customTaskTypeId', TEXT, source => source.task.customTaskTypeId, (target, stored) => { target.task.customTaskTypeId = stored; },
  ),
  {
    key: 'activityCodes', value: TASK_CODES, optional: true,
    write: source => {
      const codes = source.task.activityCodes;
      return codes === undefined ? undefined : Object.entries(codes).map(([type, value]): StoredCode => ({ type, value }));
    },
    read: (stored, target) => {
      if (stored !== undefined) target.task.activityCodes = Object.fromEntries((stored as StoredCode[]).map(code => [code.type, code.value]));
    },
  },
  {
    key: 'customFields', value: TASK_FIELD_VALUES, optional: true,
    write: source => {
      const fields = source.task.customFields;
      return fields === undefined ? undefined : Object.entries(fields).map(([field, value]) => storedFieldValue(field, value));
    },
    read: (stored, target) => {
      if (stored === undefined) return;
      target.task.customFields = Object.fromEntries((stored as StoredFieldValue[])
        .map(item => [item.field, (item.text ?? item.number ?? item.boolean) as CustomFieldValue]));
    },
  },
];

export const STRUCTURE_TASK_KEYS_CARRIED = STRUCTURE_TASK_FIELDS.map(field => field.key as keyof Task);
