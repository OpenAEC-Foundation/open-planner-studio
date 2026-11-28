export interface ExtProject {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  calendarId: string;
  createdAt: string;
  modifiedAt: string;
  author: string;
  company: string;
  wbsAutoNumber?: boolean;
  statusDate?: string;
  progressMode?: 'RETAINED_LOGIC' | 'PROGRESS_OVERRIDE';
  defaultTaskDurationUnit?: 'days' | 'hours';
  defaultWorkRule?: 'FIXED_DURATION_RATE' | 'FIXED_DURATION_WORK' | 'FIXED_WORK' | 'FIXED_RATE';
  schedulingOptions?: ExtSchedulingOptions;
  schedulingProfile?: ExtSchedulingProfile;
}

export interface ExtSchedulingProfile {
  id: string;
  baseId: 'p6' | 'msproject' | 'ops';
  name: string;
  conventions: Record<string, boolean>;
}

export interface ExtSchedulingOptions {
  lagCalendar?: 'predecessor' | 'successor' | '24hour' | 'projectDefault';
  criticalDefinition?: { mode: 'totalFloat' | 'longestPath'; threshold?: number };
  totalFloatMode?: 'start' | 'finish' | 'smallest';
  makeOpenEndedCritical?: boolean;
  nearCriticalThreshold?: number;
  floatPaths?: { enabled: boolean; method: 'FREE_FLOAT' | 'TOTAL_FLOAT'; maxPaths: number };
}

export interface ExtWorkTimeBands {
  byWeekday: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, { start: number; end: number }[]>;
}

export interface ExtHoliday {
  name: string;
  startDate: string;
  endDate: string;
}

export interface ExtWorkingException {
  name: string;
  startDate: string;
  endDate: string;
  bands?: { start: number; end: number }[];
}

export interface ExtCalendar {
  id: string;
  name: string;
  description: string;
  workDays: number[];
  workStartHour: number;
  workEndHour: number;
  hoursPerDay: number;
  simpleBreakStartMinute?: number;
  simpleBreakDurationMinutes?: number;
  holidays: ExtHoliday[];
  workTime?: ExtWorkTimeBands;
  shift?: 'FIRST' | 'SECOND' | 'THIRD' | 'USERDEFINED';
  workingExceptions?: ExtWorkingException[];
  p6Source?: 'XER';
  p6NonWorkPenaltyDates?: string[];
}

export interface ExtTaskTime {
  durationType: 'WORKTIME' | 'ELAPSEDTIME';
  durationUnit?: 'days' | 'hours';
  scheduleDuration: number;
  durationMinutes?: number;
  scheduleStart: string;
  scheduleFinish: string;

  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  freeFloat: number;
  totalFloat: number;
  isCritical: boolean;
  interferingFloat?: number;
  isNearCritical?: boolean;
  floatPath?: number;

  actualStart?: string;
  actualFinish?: string;
  actualDuration?: number;
  remainingTime?: number;
  remainingMinutes?: number;
  completion: number;
  resume?: string;
  stop?: string;
}

export interface ExtTaskConstraint {
  type: 'ASAP' | 'ALAP' | 'SNET' | 'SNLT' | 'FNET' | 'FNLT' | 'MSO' | 'MFO';
  date?: string;
  hard?: boolean;
}

export interface ExtExternalLink {
  id: string;
  direction: 'predecessor' | 'successor';
  relType: 'FS' | 'SS' | 'FF' | 'SF';
  lagDays?: number;
  lagMinutes?: number;
  anchorDate: string;
  sourceRef: { projectId: string; projectName?: string; taskId: string; taskName?: string; filePath?: string };
  sourceMissing: boolean;
}

export interface ExtTaskNote {
  id: string;
  text: string;
  done: boolean;
}

export interface ExtTask {
  id: string;
  name: string;
  description: string;
  wbsCode: string;
  taskType:
    | 'CONSTRUCTION'
    | 'INSTALLATION'
    | 'DEMOLITION'
    | 'LOGISTIC'
    | 'ATTENDANCE'
    | 'MOVE'
    | 'RENOVATION'
    | 'MAINTENANCE'
    | 'USERDEFINED';
  customTaskType?: { id: string; name?: string };
  status: 'NOT_STARTED' | 'STARTED' | 'COMPLETED';
  isMilestone: boolean;
  milestoneKind?: 'START' | 'FINISH';
  mandatory?: boolean;
  priority: number;
  levelingDelay?: number;
  levelingDelayMinutes?: number;
  levelingDelayElapsed?: boolean;
  splitGaps?: { afterMinutes: number; gapMinutes: number }[];
  manuallyScheduled?: boolean;
  mspTaskType?: 'FIXED_UNITS' | 'FIXED_DURATION' | 'FIXED_WORK';
  effortDriven?: boolean;
  workRule?: 'FIXED_DURATION_RATE' | 'FIXED_DURATION_WORK' | 'FIXED_WORK' | 'FIXED_RATE';
  p6DurationType?: 'DT_FixedDrtn' | 'DT_FixedDUR2' | 'DT_FixedRate' | 'DT_FixedQty';
  p6ActivityType?: 'TT_Task' | 'TT_Rsrc' | 'TT_LOE' | 'TT_Mile' | 'TT_FinMile' | 'TT_WBS';
  p6ProjectId?: string;
  p6TaskId?: string;
  p6ExplicitTargetWindow?: boolean;
  p6CompletePctType?: 'CP_Drtn' | 'CP_Phys' | 'CP_Units';
  p6ExpectedFinish?: string;
  p6SuspendResume?: boolean;
  timephasedContours?: { resourceUid: number | null; resourceId?: string; periods: { afterMinutes: number; minutes: number; workMinutes: number; kind: 'actual' | 'remaining' }[] }[];
  timephasedFinishFloor?: string;
  timephasedStartAnchor?: string;
  timephasedDurationWalks?: { anchor: string; resourceCalendarId: string; workMinutes?: number }[];
  parentId: string | null;
  childIds: string[];
  isSummary?: boolean;
  time: ExtTaskTime;
  resourceIds: string[];
  color?: string;
  activityCodes?: Record<string, string>;
  customFields?: Record<string, string | number | boolean>;
  constraint?: ExtTaskConstraint;
  constraint2?: ExtTaskConstraint;
  isHammock?: boolean;
  externalLinks?: ExtExternalLink[];
  deadline?: string;
  calendarId?: string;
  notes?: ExtTaskNote[];
}

export interface ExtSequence {
  id: string;
  predecessorId: string;
  successorId: string;
  type: 'FINISH_START' | 'FINISH_FINISH' | 'START_START' | 'START_FINISH';
  lagDays: number;
  lagMinutes?: number;
  lagUnit?: 'WORKTIME' | 'ELAPSEDTIME';
  lagPercent?: number;
  readonly p6StartAtPredecessorFinishBoundary?: boolean;
}

export interface ExtAvailabilityStep {
  from: string;
  maxUnits: number;
}

export interface ExtResource {
  id: string;
  name: string;
  type: 'LABOR' | 'EQUIPMENT' | 'MATERIAL' | 'SUBCONTRACTOR' | 'CREW' | 'COST';
  description: string;
  costPerHour?: number;
  maxUnits: number;
  calendarId?: string;
  availabilitySteps?: ExtAvailabilityStep[];
  unitOfMeasure?: string;
  parentId?: string;
  color?: string;
}

export interface ExtAssignment {
  id: string;
  taskId: string;
  resourceId: string;
  unitsPerDay: number;
  curve?: 'UNIFORM' | 'FRONT_LOADED' | 'BACK_LOADED' | 'BELL' | 'EARLY_PEAK' | 'LATE_PEAK' | 'DOUBLE_PEAK' | 'TURTLE';
  workWindowStart?: string;
  workWindowFinish?: string;
  curveValues?: number[];
  plannedWorkMinutes?: number;
  actualWorkMinutes?: number;
  remainingWorkMinutes?: number;
  costAmount?: number;
}

export type ExtRibbonTab =
  | 'file' | 'start' | 'planning' | 'resources' | 'relations'
  | 'beeld' | 'instellingen' | 'table' | 'ifc' | 'report' | 'ai';

export interface ExtFontProvider {
  id: string;
  covers(codepoint: number): boolean;
  getRegularBytes(): Promise<Uint8Array>;
  getBoldBytes?(): Promise<Uint8Array>;
}

export const EXT_IMPORT_SOURCE_PAGE_SIZE_MAX = 500;

export type ExtImportSourceCollection =
  | 'scheduleOptionsSourceRows'
  | 'resourceCatalogResources'
  | 'resourceCatalogIdentities'
  | 'resourceCatalogResourceRows'
  | 'resourceCatalogRoleRows'
  | 'resourceCatalogRateRows'
  | 'resourceCatalogCurveRows'
  | 'resourceCatalogAssignmentRows'
  | 'resourceCatalogIssues'
  | 'metadataActivityCodeTypes'
  | 'metadataCustomFieldDefs'
  | 'metadataTaskProjections'
  | 'metadataIssues'
  | 'metadataSourceActvtypeRows'
  | 'metadataSourceActvcodeRows'
  | 'metadataSourceTaskactvRows'
  | 'metadataSourceUdfTypeRows'
  | 'metadataSourceUdfValueRows'
  | 'metadataSourceMemotypeRows'
  | 'metadataSourceTasknoteRows'
  | 'metadataSourceTaskmemoRows'
  | 'metadataSourceTaskNotesRows'
  | 'metadataSourceDeferredUdfValueRows'
  | 'metadataSourceUnknownUdfTypeRows'
  | 'taskSourceRows';

export type ExtImportSourceRecord = Readonly<Record<string, unknown>>;

export interface ExtImportSourcePageOptions {
  offset?: number;
  limit?: number;
  expectedSourceProjectId?: string;
}

export interface ExtImportSourceCatalogPage {
  collection: ExtImportSourceCollection;
  sourceProjectId: string;
  offset: number;
  limit: number;
  total: number;
  items: readonly ExtImportSourceRecord[];
}

export interface ExtImportSourceArchiveSummary {
  schemaVersion: number;
  byteLength: number;
  sha256: string;
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252' | 'windows-1251' | 'windows-1253' | 'windows-1256';
  bom: 'utf-8' | 'utf-16le' | 'utf-16be' | 'none';
  newline: 'crlf' | 'lf' | 'cr' | 'mixed' | 'none';
  chunkSize: number;
  chunkCount: number;
}

export interface ExtImportSourceNumberFormat {
  decimal: '.' | ',';
  group: '.' | ',' | null;
  source: 'currtype' | 'default';
  currencyCode: string;
}

export interface ExtImportSourceReport {
  projectsSeen: number;
  documentsOpened: number;
  emptyProjectsSkipped: number;
  baselineProjectsExcluded: number;
  baselinesMaterialized: number;
  danglingBaselineReferences: number;
  externalLinksPreserved: number;
  baselineExclusionReverted: boolean;
  baselineFallbackReasons: readonly ('self-reference' | 'cycle' | 'all-projects-baselines')[];
}

export interface ExtImportSourceDiagnosticsSummary {
  file: {
    tableReport: {
      encoding: ExtImportSourceArchiveSummary['encoding'];
      endMarkerSeen: boolean;
      issueCount: number;
      unknownTableCount: number;
      unknownFieldCount: number;
    };
    scheduleOptionsDiagnosticCount: number;
    relationResolutionIssueCount: number;
    resourceCatalogIssueCount: number;
    metadataCatalogIssueCount: number;
  };
  document: {
    calendarIssueCount: number;
    enumFallbackCount: number;
    scheduleOptionsFallbackCount: number;
    scheduleOptionsDiagnosticCount: number;
    externalRelationCount: number;
    externalLinkCount: number;
    resourceAssignmentCount: number;
    resourceIssueCount: number;
  };
}

export interface ExtImportSourceScheduleOptionsSummary {
  source: 'schedoptions' | 'xer-defaults';
  retainedSource: Readonly<Record<string, boolean | undefined>>;
  fallbackCount: number;
  diagnosticCount: number;
  sourceRowCount: number;
  unmatchedSourceRowCount: number;
}

export interface ExtImportSourceCatalogCounts {
  scheduleOptions: {
    sourceRows: number;
    unmatchedRows: number;
    diagnostics: number;
  };
  resources: {
    resources: number;
    identities: number;
    rows: {
      resources: number;
      roles: number;
      rates: number;
      curves: number;
      assignments: number;
    };
    issues: number;
  };
  metadata: {
    activityCodeTypes: number;
    customFieldDefs: number;
    taskProjections: number;
    currentProjectTaskProjections: number;
    issues: number;
    issueCounts: Readonly<Record<string, number>>;
    sourceData: Readonly<Record<string, number>>;
  };
  taskSourceRows: {
    projectCount: number;
    totalRows: number;
    currentProjectRows: number;
  };
}

export interface ExtImportSourceIssue {
  code: 'schema-version' | 'hash-mismatch' | 'truncated' | 'bytes-missing' | 'metadata-invalid' | 'structure';
}

export interface ExtImportSourceInfo {
  sourceFormat: 'primavera-p6-xer';
  sourceProjectId: string;
  selector: { kind: 'sourceProjectId'; value: string };
  archive: ExtImportSourceArchiveSummary;
  numberFormat: ExtImportSourceNumberFormat;
  diagnostics: ExtImportSourceDiagnosticsSummary;
  importReport: ExtImportSourceReport;
  scheduleOptions: ExtImportSourceScheduleOptionsSummary;
  catalogs: ExtImportSourceCatalogCounts;
}

export interface ExtImportResult {
  project: ExtProject;
  calendar: ExtCalendar;
  tasks: ExtTask[];
  sequences: ExtSequence[];
  resources: ExtResource[];
  assignments: ExtAssignment[];
  customTaskTypes?: { id: string; name: string }[];
}
