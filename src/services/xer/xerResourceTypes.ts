import type { Resource, ResourceAssignment } from '@/types/resource';
import type { XerRow } from './xerTables';

/**
 * Catalogusweergave zonder tweede type-eiland: behoudt tuplevormen en maakt
 * elke laag van de gedeelde bestandsbrede grafiek readonly. De gewone Xer*-typen
 * hieronder blijven juist de mutable per-projectprojectie beschrijven.
 */
export type XerReadonly<T> = T extends readonly unknown[]
  ? { readonly [Key in keyof T]: XerReadonly<T[Key]> }
  : T extends object
    ? { readonly [Key in keyof T]: XerReadonly<T[Key]> }
    : T;

/** Dezelfde parserrij, readonly aangeboden: volledige XER-brondata zonder tweede celobject. */
export type XerSourceRow = Readonly<{
  line: XerRow['line'];
  cells: Readonly<XerRow['cells']>;
}>;

export interface XerResourceReadContext {
  projectId: string;
  projectCalendarId: string;
  projectHoursPerDay: number;
  availableCalendarIds: ReadonlySet<string>;
  calendarHoursPerDay: ReadonlyMap<string, number>;
  taskIds: ReadonlySet<string>;
  /** Taaktypes-etappe (spec §4.3/§4.4): geplande werkminuten per activiteit, voor de
   *  "afwezig ⇒ afgeleid"-toets van de TASKRSRC-werkhoeveelheden. Optioneel: zonder deze kaart
   *  worden geen werkvelden gezet (byte-identiek voor bestaande aanroepers). */
  taskWorkMinutes?: ReadonlyMap<string, number>;
}

export interface XerEntityIdentity {
  kind: 'RESOURCE' | 'ROLE';
  sourceId: string;
  internalId: string;
  line: number;
}

export interface XerResourceSource {
  readonly rawRow: XerSourceRow;
  sourceId: string;
  internalId: string;
  line: number;
  rawType: string;
  parentSourceId?: string;
  calendarSourceId?: string;
  defaultRoleSourceId?: string;
  unitSourceId?: string;
}

export interface XerRoleSource {
  readonly rawRow: XerSourceRow;
  sourceId: string;
  internalId: string;
  line: number;
  name: string;
  shortName: string;
  description: string;
  parentSourceId?: string;
}

export interface XerResourceRateSource {
  readonly rawRow: XerSourceRow;
  sourceId: string;
  internalId: string;
  entity: XerAssignmentEntitySource;
  line: number;
  effectiveDate?: string;
  maxUnitsPerTime: number | null;
  costs: [number | null, number | null, number | null, number | null, number | null];
}

export type XerCurvePoints<T> = [
  T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T,
];

export interface XerResourceCurveSource {
  readonly rawRow: XerSourceRow;
  sourceId: string;
  internalId: string;
  line: number;
  name: string;
  rawPoints: XerCurvePoints<string>;
  numericPoints?: XerCurvePoints<number>;
}

export type XerAssignmentUnitScale = 'DIRECT_FRACTION' | 'MATERIAL_PER_HOUR';

export interface XerAssignmentEntitySource {
  kind: 'RESOURCE' | 'ROLE';
  sourceId: string;
  internalId: string;
}

export interface XerAssignmentQuantitiesSource {
  remaining?: number;
  target?: number;
  actualRegular?: number;
  actualOvertime?: number;
  thisPeriod?: number;
  remainingPerHour?: number;
  targetPerHour?: number;
}

export interface XerAssignmentCostsSource {
  perQuantity?: number;
  target?: number;
  remaining?: number;
  actualRegular?: number;
  actualOvertime?: number;
  thisPeriod?: number;
}

export interface XerTaskResourceSource {
  readonly rawRow: XerSourceRow;
  sourceId: string;
  internalId: string;
  taskSourceId: string;
  projectSourceId?: string;
  line: number;
  entity: XerAssignmentEntitySource;
  assignedRole?: XerAssignmentEntitySource;
  unitScale: XerAssignmentUnitScale;
  quantities: XerAssignmentQuantitiesSource;
  curveSourceId?: string;
  rawCurves: { target?: string; remaining?: string; actual?: string };
  costs: XerAssignmentCostsSource;
  rateType?: string;
  costSourceType?: string;
  rawResourceType?: string;
}

export type XerResourceIssueCode =
  | 'XER_RESOURCE_CALENDAR_MISSING'
  | 'XER_RESOURCE_NONLABOR_FALLBACK'
  | 'XER_RESOURCE_TYPE_FALLBACK'
  | 'XER_RESOURCE_PARENT_MISSING'
  | 'XER_RESOURCE_DEFAULT_ROLE_MISSING'
  | 'XER_ROLE_PARENT_MISSING'
  | 'XER_RESOURCE_RATE_OWNER_MISSING'
  | 'XER_ROLE_RATE_OWNER_MISSING'
  | 'XER_CURVE_INVALID_POINTS'
  | 'XER_ASSIGNMENT_CURVE_MISSING'
  | 'XER_ASSIGNMENT_RESOURCE_MISSING'
  | 'XER_ASSIGNMENT_ROLE_MISSING'
  | 'XER_ASSIGNMENT_ASSIGNED_ROLE_MISSING'
  | 'XER_ASSIGNMENT_TASK_MISSING';

export interface XerResourceIssue {
  code: XerResourceIssueCode;
  table: 'RSRC' | 'ROLES' | 'RSRCRATE' | 'ROLERATE' | 'RSRCCURVDATA' | 'TASKRSRC';
  line: number;
  sourceId: string;
  fallback: 'PROJECT_CALENDAR' | 'EQUIPMENT' | 'LABOR' | 'UNIFORM' | 'SKIPPED' | 'RELATION_OMITTED';
}

export interface XerResourceReadResult {
  resources: Resource[];
  assignments: ResourceAssignment[];
  identities: XerEntityIdentity[];
  sources: {
    resources: XerResourceSource[];
    roles: XerRoleSource[];
    rates: XerResourceRateSource[];
    curves: XerResourceCurveSource[];
    assignments: XerTaskResourceSource[];
  };
  issues: XerResourceIssue[];
}
