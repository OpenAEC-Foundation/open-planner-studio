import type { ActivityCodeType, CustomFieldDef, CustomFieldValue } from '@/types/structure';
import type { Task } from '@/types/task';
import type { XerRow } from './xerTables';

export type XerMetadataIssueCode =
  | 'XER_ACTIVITY_CODE_MISSING_TYPE_ID'
  | 'XER_ACTIVITY_CODE_MISSING_VALUE_ID'
  | 'XER_ACTIVITY_CODE_DUPLICATE_TYPE_ID'
  | 'XER_ACTIVITY_CODE_DUPLICATE_VALUE_ID'
  | 'XER_ACTIVITY_CODE_DUPLICATE_LINK'
  | 'XER_ACTIVITY_CODE_DANGLING_TYPE_PARENT'
  | 'XER_ACTIVITY_CODE_DANGLING_VALUE_PARENT'
  | 'XER_ACTIVITY_CODE_DANGLING_TASK'
  | 'XER_ACTIVITY_CODE_DANGLING_TYPE'
  | 'XER_ACTIVITY_CODE_DANGLING_VALUE'
  | 'XER_UDF_MISSING_TYPE_ID'
  | 'XER_UDF_DUPLICATE_TYPE_ID'
  | 'XER_UDF_DUPLICATE_VALUE'
  | 'XER_UDF_DANGLING_TYPE'
  | 'XER_UDF_DANGLING_ENTITY'
  | 'XER_UDF_AMBIGUOUS_TASK'
  | 'XER_UDF_UNKNOWN_DATA_TYPE'
  | 'XER_UDF_INVALID_VALUE'
  | 'XER_UDF_DEFERRED_ENTITY'
  | 'XER_NOTE_DUPLICATE_MEMO_ID'
  | 'XER_NOTE_DANGLING_TASK'
  | 'XER_NOTE_AMBIGUOUS_TASK';

export interface XerMetadataIssue {
  code: XerMetadataIssueCode;
  table: 'ACTVTYPE' | 'ACTVCODE' | 'TASKACTV' | 'UDFTYPE' | 'UDFVALUE' | 'TASK' | 'TASKMEMO';
  line: number;
  lines?: number[];
}

export interface XerTaskMetadata {
  activityCodes?: Record<string, string>;
  customFields?: Record<string, CustomFieldValue>;
  notes?: NonNullable<Task['notes']>;
}

export interface XerMetadataTaskProjection extends XerTaskMetadata {
  projectId: string;
  taskId: string;
}

/**
 * Eén immutable, bestandsbreed X8-catalogusobject. De raw tabellen zijn rechtstreeks de reeds
 * bevroren X2-rijarrays: geen tweede celkopie, ook niet voor rehab-2's TASKACTV-massa. X9 wordt
 * eigenaar van de uiteindelijke byte-archivering; X8 bewaart hier de huidige broninformatie.
 */
export interface XerMetadataCatalog {
  readonly activityCodeTypes: readonly ActivityCodeType[];
  readonly customFieldDefs: readonly CustomFieldDef[];
  readonly taskProjections: readonly XerMetadataTaskProjection[];
  readonly issues: readonly XerMetadataIssue[];
  readonly issueCounts: Readonly<Record<XerMetadataIssueCode, number>>;
  readonly sourceData: {
    readonly ACTVTYPE: readonly XerRow[];
    readonly ACTVCODE: readonly XerRow[];
    readonly TASKACTV: readonly XerRow[];
    readonly UDFTYPE: readonly XerRow[];
    readonly UDFVALUE: readonly XerRow[];
    readonly MEMOTYPE: readonly XerRow[];
    readonly TASKMEMO: readonly XerRow[];
    readonly TASK_NOTES: readonly XerRow[];
    readonly deferredUdfValues: readonly XerRow[];
    readonly unknownUdfTypes: readonly XerRow[];
  };
}

export interface XerMetadataProjectView {
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  taskMetadata: ReadonlyMap<string, XerTaskMetadata>;
}
