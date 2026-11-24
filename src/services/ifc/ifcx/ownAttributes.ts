import { ifc5ValueDescription, membersOf, objectOf, type IfcxValue } from './fieldTable';
import { ATTRIBUTE, type IfcxAttributeName } from './profile';
import { SCHEDULE_FIELDS } from './fields/documentFields';
import {
  ASSIGNMENT_AREA, BASELINE_AREA, CALENDAR_AREA, DOCUMENT_AREA, RESOURCE_AREA, SEQUENCE_AREA, TASK_AREA,
} from './fieldGroups';

export const OWN_ATTRIBUTE_VALUES: ReadonlyMap<IfcxAttributeName, IfcxValue> = new Map<IfcxAttributeName, IfcxValue>([
  [ATTRIBUTE.workplan, objectOf(membersOf(DOCUMENT_AREA.planning))],
  [ATTRIBUTE.schedule, objectOf(membersOf(SCHEDULE_FIELDS))],
  [ATTRIBUTE.calendar, objectOf(membersOf(CALENDAR_AREA.planning))],
  [ATTRIBUTE.activity, objectOf(membersOf(TASK_AREA.planning))],
  [ATTRIBUTE.sequence, objectOf(membersOf(SEQUENCE_AREA.planning))],
  [ATTRIBUTE.resource, objectOf(membersOf(RESOURCE_AREA.planning))],
  [ATTRIBUTE.assignment, objectOf(membersOf(ASSIGNMENT_AREA.planning))],
  [ATTRIBUTE.baseline, objectOf(membersOf(BASELINE_AREA.planning))],
  [ATTRIBUTE.document, objectOf(membersOf(DOCUMENT_AREA.ops))],
  [ATTRIBUTE.opsCalendar, objectOf(membersOf(CALENDAR_AREA.ops))],
  [ATTRIBUTE.opsTask, objectOf(membersOf(TASK_AREA.ops))],
  [ATTRIBUTE.opsSequence, objectOf(membersOf(SEQUENCE_AREA.ops))],
  [ATTRIBUTE.opsResource, objectOf(membersOf(RESOURCE_AREA.ops))],
  [ATTRIBUTE.opsAssignment, objectOf(membersOf(ASSIGNMENT_AREA.ops))],
  [ATTRIBUTE.opsBaseline, objectOf(membersOf(BASELINE_AREA.ops))],
]);

export function isOwnAttributeName(name: string): name is IfcxAttributeName {
  return OWN_ATTRIBUTE_VALUES.has(name as IfcxAttributeName);
}

export function ownSchemas(used: ReadonlySet<string>): Record<string, { value: Record<string, unknown> }> {
  const schemas: Record<string, { value: Record<string, unknown> }> = {};
  for (const [name, value] of OWN_ATTRIBUTE_VALUES) if (used.has(name)) schemas[name] = { value: ifc5ValueDescription(value) };
  return schemas;
}
