import type { Task } from '@/types/task';

export interface RawDateCell {
  rowNumber: number;
  field: 'actualStart' | 'actualFinish' | 'start' | 'finish';
  raw: string;
  taskId?: string;
}

export interface RawProgressRow {
  rowNumber: number;
  taskId?: string;
  wbsCode?: string;
  name?: string;
  rawCompletion?: string;
  rawActualStart?: string;
  rawActualFinish?: string;
  rawExportState?: string;
}

export type ProgressFileIssue =
  | 'tooLarge' | 'tooManyRows' | 'noKeyColumn' | 'noProgressColumns' | 'unreadable'
  | 'encrypted'
  | 'csvNotSupported';

export interface ProgressSheet {
  fileIssue?: ProgressFileIssue;
  rawRows: readonly RawProgressRow[];
  detectionCells: readonly RawDateCell[];
}

export type DateOrder = 'dmy' | 'mdy';
export type DateOrderDetection =
  | { order: DateOrder; evidence: 'noAmbiguity' | 'outOfRange' | 'calibration' | 'contradictoryNoSample' }
  | { order: 'ambiguous'; sample: string; sampleAlternatives: [dmyIso: string, mdyIso: string] };

export interface ProgressExportState {
  exportedAt: string;
  completion: number;
  actualStart?: string;
  actualFinish?: string;
  plannedStart?: string;
  plannedFinish?: string;
}

export interface ProgressRow {
  rowNumber: number;
  taskId?: string;
  wbsCode?: string;
  name?: string;
  completion?: { kind: 'value'; value: number } | { kind: 'unreadable'; raw: string }
    | { kind: 'outOfRange'; raw: string };
  actualStart?: { kind: 'value'; iso: string } | { kind: 'unreadable'; raw: string };
  actualFinish?: { kind: 'value'; iso: string } | { kind: 'unreadable'; raw: string };
  exportState?: ProgressExportState;
}

export type ProgressOverrides = ReadonlyMap<number, string>;

export type ProgressConflictChoice = 'app' | 'sheet';
export type ProgressConflictChoices = ReadonlyMap<number, ProgressConflictChoice>;

export type ProgressMatchKind = 'id' | 'wbs' | 'manual';

export type ProgressRowReason =
  | 'unmatched' | 'ambiguousWbs' | 'duplicateRow' | 'summaryTask'
  | 'unreadableDate' | 'unreadableNumber'
  | 'percentOutOfRange'
  | 'actualAfterStatusDate' | 'actualFinishBeforeStart' | 'conflictingProgressInputs'
  | 'actualStartRequired'
  | 'rejected';

export type ProgressField = 'completion' | 'actualStart' | 'actualFinish';

export interface ProgressFieldChange {
  field: ProgressField;
  before: string | number | undefined;
  after: string | number | undefined;
}

export interface ProgressFieldConflict {
  field: ProgressField;
  exported: string | number | undefined;
  app: string | number | undefined;
  sheet: string | number | undefined;
}

export interface ProgressFieldKept {
  field: ProgressField;
  exported: string | number | undefined;
  app: string | number | undefined;
}

export interface ProgressPlannedShift {
  field: 'start' | 'finish';
  exported: string;
  current: string;
}

export interface ProgressPlanRow {
  rowNumber: number;
  outcome: 'apply' | 'noop' | 'refused' | 'unresolved';
  reason?: ProgressRowReason;
  plannerCode?: string;
  match?: ProgressMatchKind;
  needsConfirmation?: boolean;
  taskId?: string;
  taskLabel?: string;
  changes: readonly ProgressFieldChange[];
  plannedTask?: Task;
  conflicts?: readonly ProgressFieldConflict[];
  conflictChoice?: ProgressConflictChoice;
  keptApp?: readonly ProgressFieldKept[];
  plannedShifts?: readonly ProgressPlannedShift[];
}

export interface ProgressImportPlan {
  rows: readonly ProgressPlanRow[];
  appliedCount: number;
  noopCount: number;
  refusedCount: number;
  needsLinkCount: number;
  needsConfirmationCount: number;
  ignoredOverrideRows: readonly number[];
  untouchedTaskCount: number;
  conflictCount: number;
  unresolvedConflictCount: number;
  appNewerCount: number;
  plannedShiftCount: number;
  withoutExportStateCount: number;
  exportedAt?: string;
}

export interface ProgressImportLimits {
  readonly maxBytes: number;
  readonly maxRows: number;
  readonly maxCellChars: number;
  readonly maxIdChars: number;
  readonly maxWbsChars: number;
}

export const PROGRESS_IMPORT_LIMITS = {
  maxBytes: 16 * 1024 * 1024,
  maxRows: 50_000,
  maxCellChars: 4096,
  maxIdChars: 256,
  maxWbsChars: 128,
} as const;

export const MIN_CALIBRATION_HITS = 3;
export const CALIBRATION_RATIO = 3;
