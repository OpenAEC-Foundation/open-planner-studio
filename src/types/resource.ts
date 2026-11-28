import type { LibraryOrigin } from '@/types/library';

export function isValidUnits(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export type ResourceType = 'LABOR' | 'EQUIPMENT' | 'MATERIAL' | 'SUBCONTRACTOR' | 'CREW' | 'COST';

export const RESOURCE_TYPES: readonly ResourceType[] = ['LABOR', 'EQUIPMENT', 'MATERIAL', 'SUBCONTRACTOR', 'CREW', 'COST'];

export function isCostResource(r: Pick<Resource, 'type'> | undefined | null): boolean {
  return r?.type === 'COST';
}

export function resourceDrivesDuration(r: Pick<Resource, 'type'> | undefined | null): boolean {
  return r ? r.type !== 'MATERIAL' && r.type !== 'COST' : true;
}

export function resourceHasLoad(r: Pick<Resource, 'type'> | undefined | null): boolean {
  return !isCostResource(r);
}

export function costResourceIds(resources: readonly Pick<Resource, 'id' | 'type'>[]): Set<string> {
  const ids = new Set<string>();
  for (const r of resources) if (isCostResource(r)) ids.add(r.id);
  return ids;
}

export function contourSiblings<A extends Pick<ResourceAssignment, 'resourceId'>>(
  assignments: readonly A[],
  costIds: ReadonlySet<string>,
): A[] {
  return costIds.size === 0 ? [...assignments] : assignments.filter(a => !costIds.has(a.resourceId));
}

export function resourceIsLevelable(r: Pick<Resource, 'type'>): boolean {
  return r.type !== 'MATERIAL' && r.type !== 'COST';
}

export function isValidCostAmount(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export const COST_RESOURCE_CLEARED_FIELDS = ['costPerHour', 'calendarId', 'availabilitySteps', 'unitOfMeasure', 'parentId'] as const;

export function clearCostResourceFields(r: Resource): void {
  for (const k of COST_RESOURCE_CLEARED_FIELDS) delete r[k];
  delete r.availability;
  r.maxUnits = 1;
}

export const COST_ASSIGNMENT_WORK_FIELDS = [
  'plannedUnitsPerDay', 'curve', 'curveValues', 'workWindowStart', 'workWindowFinish',
  'plannedWorkMinutes', 'actualWorkMinutes', 'remainingWorkMinutes',
] as const;

export function normalizeAssignmentForResource(a: ResourceAssignment, resource: Pick<Resource, 'type'> | undefined): void {
  if (isCostResource(resource)) {
    for (const k of COST_ASSIGNMENT_WORK_FIELDS) delete a[k];
    a.unitsPerDay = 1;
    if (a.costAmount !== undefined && !isValidCostAmount(a.costAmount)) delete a.costAmount;
  } else if (resource && a.costAmount !== undefined) {
    delete a.costAmount;
  }
}

export interface AvailabilityStep {
  from: string;
  maxUnits: number;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  description: string;
  costPerHour?: number;
  /** @deprecated */
  availability?: number;
  maxUnits: number;
  calendarId?: string;
  availabilitySteps?: AvailabilityStep[];
  unitOfMeasure?: string;
  parentId?: string;
  color?: string;
  libraryOrigin?: LibraryOrigin;
}

export type ResourceCurve = 'UNIFORM' | 'FRONT_LOADED' | 'BACK_LOADED' | 'BELL' | 'EARLY_PEAK' | 'LATE_PEAK' | 'DOUBLE_PEAK' | 'TURTLE';

export const RESOURCE_CURVES: readonly ResourceCurve[] = [
  'UNIFORM', 'FRONT_LOADED', 'BACK_LOADED', 'BELL', 'EARLY_PEAK', 'LATE_PEAK', 'DOUBLE_PEAK', 'TURTLE',
];

export function isResourceCurve(v: unknown): v is ResourceCurve {
  return typeof v === 'string' && (RESOURCE_CURVES as readonly string[]).includes(v);
}

export interface ResourceAssignment {
  id: string;
  taskId: string;
  resourceId: string;
  unitsPerDay: number;
  plannedUnitsPerDay?: number;
  curve?: ResourceCurve;
  curveValues?: number[];
  workWindowStart?: string;
  workWindowFinish?: string;
  plannedWorkMinutes?: number;
  actualWorkMinutes?: number;
  remainingWorkMinutes?: number;
  costAmount?: number;
}
