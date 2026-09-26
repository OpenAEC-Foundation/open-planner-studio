/**
 * Parservrije TASKRSRC-provenanceregels die de X6-producent en X9-archiefvalidator delen.
 * De volgorde is gedrag: resource vóór role vóór task, exact zoals P6-assignments worden gelezen.
 */

export type XerAssignmentSkipReason =
  | 'XER_ASSIGNMENT_RESOURCE_MISSING'
  | 'XER_ASSIGNMENT_ROLE_MISSING'
  | 'XER_ASSIGNMENT_TASK_MISSING';

export type XerAssignmentSkipExpectation = XerAssignmentSkipReason | 'LEGACY_TASK_UNKNOWN' | null;

export function xerAssignmentSourceId(
  cells: Readonly<Record<string, string>>,
  line: number,
): string {
  return cells.taskrsrc_id?.trim() || `line-${line}`;
}

export function deriveXerAssignmentSkipExpectation(
  cells: Readonly<Record<string, string>>,
  resourceSourceIds: ReadonlySet<string>,
  roleSourceIds: ReadonlySet<string>,
  taskSourceIds: ReadonlySet<string> | undefined,
): XerAssignmentSkipExpectation {
  const resourceSourceId = cells.rsrc_id?.trim() || undefined;
  const roleSourceId = cells.role_id?.trim() || undefined;
  if (resourceSourceId && !resourceSourceIds.has(resourceSourceId)) {
    return 'XER_ASSIGNMENT_RESOURCE_MISSING';
  }
  if (!resourceSourceId && !roleSourceIds.has(roleSourceId ?? '')) {
    return 'XER_ASSIGNMENT_ROLE_MISSING';
  }
  if (!taskSourceIds) return 'LEGACY_TASK_UNKNOWN';
  return taskSourceIds.has(cells.task_id?.trim() ?? '')
    ? null
    : 'XER_ASSIGNMENT_TASK_MISSING';
}
