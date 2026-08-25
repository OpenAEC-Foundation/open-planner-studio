import type { TaskColumnId } from '@/types/taskGrid';

export type BaselineTaskColumnField =
  | 'start'
  | 'finish'
  | 'duration'
  | 'varianceStart'
  | 'varianceFinish'
  | 'varianceDuration'
  | 'isMilestone'
  | 'milestoneKind';

export type DynamicTaskColumnIdParts =
  | { kind: 'activity-code'; projectId: string; typeId: string }
  | { kind: 'custom-field'; projectId: string; defId: string }
  | { kind: 'baseline'; projectId: string; baselineId: string; field: BaselineTaskColumnField };

const BASELINE_FIELDS = new Set<BaselineTaskColumnField>([
  'start', 'finish', 'duration', 'varianceStart', 'varianceFinish', 'varianceDuration',
  'isMilestone', 'milestoneKind',
]);

/** Eén canonieke RFC-3986-segmentencoding. encodeURIComponent laat !'()* ongemoeid; die tekens
 * worden hier alsnog encoded zodat quotes en alle scheidingstekens nooit betekenis lekken. */
export function encodeTaskColumnIdSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, char =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function decodeSegment(segment: string): string | null {
  if (!segment) return null;
  try {
    const decoded = decodeURIComponent(segment);
    return encodeTaskColumnIdSegment(decoded) === segment ? decoded : null;
  } catch {
    return null;
  }
}

export function taskColumnId(value: string): TaskColumnId {
  return value as TaskColumnId;
}

export function activityCodeColumnId(projectId: string, typeId: string): TaskColumnId {
  return taskColumnId(`activity-code:${encodeTaskColumnIdSegment(projectId)}:${encodeTaskColumnIdSegment(typeId)}`);
}

export function customFieldColumnId(projectId: string, defId: string): TaskColumnId {
  return taskColumnId(`custom-field:${encodeTaskColumnIdSegment(projectId)}:${encodeTaskColumnIdSegment(defId)}`);
}

export function baselineColumnId(
  projectId: string,
  baselineId: string,
  field: BaselineTaskColumnField,
): TaskColumnId {
  return taskColumnId(`baseline:${encodeTaskColumnIdSegment(projectId)}:${encodeTaskColumnIdSegment(baselineId)}:${field}`);
}

/** Strikte decoder: alleen de drie bekende families, exact het juiste aantal segmenten en de
 * canonieke percentencoding worden geaccepteerd. */
export function decodeDynamicTaskColumnId(id: string): DynamicTaskColumnIdParts | null {
  const parts = id.split(':');
  if (parts[0] === 'activity-code' && parts.length === 3) {
    const projectId = decodeSegment(parts[1]);
    const typeId = decodeSegment(parts[2]);
    return projectId !== null && typeId !== null
      ? { kind: 'activity-code', projectId, typeId }
      : null;
  }
  if (parts[0] === 'custom-field' && parts.length === 3) {
    const projectId = decodeSegment(parts[1]);
    const defId = decodeSegment(parts[2]);
    return projectId !== null && defId !== null
      ? { kind: 'custom-field', projectId, defId }
      : null;
  }
  if (parts[0] === 'baseline' && parts.length === 4) {
    const projectId = decodeSegment(parts[1]);
    const baselineId = decodeSegment(parts[2]);
    const field = parts[3] as BaselineTaskColumnField;
    return projectId !== null && baselineId !== null && BASELINE_FIELDS.has(field)
      ? { kind: 'baseline', projectId, baselineId, field }
      : null;
  }
  return null;
}
