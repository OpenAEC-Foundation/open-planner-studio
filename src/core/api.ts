export type CoreErrorCode =
  | 'INVALID_INPUT'
  | 'IFC_READ_FAILED'
  | 'NO_TASKS'
  | 'SCHEDULE_FAILED'
  | 'IFC_WRITE_FAILED';

export interface ScheduleWarning {
  code:
    | 'CONSTRAINT_VIOLATED'
    | 'DEADLINE_MISSED'
    | 'OUT_OF_SEQUENCE'
    | 'CALENDAR_CAPPED'
    | 'RELATION_IGNORED'
    | 'HAMMOCK_WITHOUT_FINISH_DRIVER'
    | 'XER_ARCHIVE_DROPPED'
    | 'MINUTE_MODEL_CONVERTED';
  ids: string[];
  detail?: string;
  maxShiftWorkdays?: number;
}

export interface ScheduleTaskSummary {
  id: string;
  name: string;
  wbs: string;
  parentId: string | null;
  summary: boolean;
  milestone: boolean;
  start: string;
  finish: string;
  lateStart: string;
  lateFinish: string;
  totalFloat: number;
  critical: boolean;
}

export interface ScheduleSummary {
  formatVersion: 1;
  project: {
    id: string;
    name: string;
    schedulingProfile: string;
    start: string;
    finish: string;
    durationWorkdays: number;
  };
  counts: {
    tasks: number;
    summaryTasks: number;
    milestones: number;
    relations: number;
    resources: number;
    assignments: number;
    criticalTasks: number;
  };
  tasks: ScheduleTaskSummary[];
  criticalPath: string[];
  warnings: ScheduleWarning[];
  foreignContent?: ForeignContentSummary;
}

export type IfcWriteRefusalReason = 'foreign' | 'model' | 'unreadable' | 'merge-needs-phase2';

export interface ForeignContentSummary {
  format: 'ifc';
  schema: string;
  objectCount: number;
}

export interface PlannerDocument {
  readonly openWarnings: ScheduleWarning[];
  schedule(): ScheduleSummary;
  toIfc(): string;
  toIfcBytes(): Promise<Uint8Array>;
}
