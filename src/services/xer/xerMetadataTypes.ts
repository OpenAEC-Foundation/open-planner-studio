import type { ActivityCodeType, CustomFieldDef, CustomFieldValue } from '@/types/structure';
import type { Task } from '@/types/task';
import type { XerRow } from './xerTables';
import type { XerReadonly } from './xerResourceTypes';

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
  | 'XER_NOTE_DANGLING_MEMO_TYPE'
  | 'XER_NOTE_DANGLING_TASK'
  | 'XER_NOTE_AMBIGUOUS_TASK';

export interface XerMetadataIssue {
  code: XerMetadataIssueCode;
  table: 'ACTVTYPE' | 'ACTVCODE' | 'TASKACTV' | 'UDFTYPE' | 'UDFVALUE' | 'TASK' | 'TASKNOTE' | 'TASKMEMO';
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
interface XerMetadataCatalogShape {
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  taskProjections: XerMetadataTaskProjection[];
  /** Diep bevroren projectindex; materialisatie bezoekt uitsluitend deze projectgroep. */
  taskProjectionsByProject: Record<string, XerMetadataTaskProjection[]>;
  issues: XerMetadataIssue[];
  issueCounts: Record<XerMetadataIssueCode, number>;
  sourceData: {
    ACTVTYPE: XerRow[];
    ACTVCODE: XerRow[];
    TASKACTV: XerRow[];
    UDFTYPE: XerRow[];
    UDFVALUE: XerRow[];
    MEMOTYPE: XerRow[];
    TASKNOTE: XerRow[];
    TASKMEMO: XerRow[];
    TASK_NOTES: XerRow[];
    deferredUdfValues: XerRow[];
    unknownUdfTypes: XerRow[];
  };
}

/** X6's ene canonieke recursieve readonly-grens, nu over de volledige X8-catalogusgrafiek. */
export type XerMetadataCatalog = XerReadonly<XerMetadataCatalogShape>;

export interface XerMetadataProjectView {
  activityCodeTypes: ActivityCodeType[];
  customFieldDefs: CustomFieldDef[];
  taskMetadata: ReadonlyMap<string, XerTaskMetadata>;
  /** Deterministische complexiteitspin: exact het aantal bezochte projecties uit de projectindex. */
  visitedTaskProjectionCount: number;
}
