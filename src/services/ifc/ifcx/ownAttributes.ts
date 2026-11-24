import { ifc5ValueDescription, membersOf, objectOf, type IfcxValue } from './fieldTable';
import { ATTRIBUTE, type IfcxAttributeName } from './profile';
import { SCHEDULE_FIELDS } from './fields/documentFields';
import {
  CALENDAR_GROUPS, DOCUMENT_GROUPS, opsFields, planningFields, SEQUENCE_GROUPS, TASK_GROUPS,
} from './fieldGroups';

export const OWN_ATTRIBUTE_VALUES: ReadonlyMap<IfcxAttributeName, IfcxValue> = new Map<IfcxAttributeName, IfcxValue>([
  [ATTRIBUTE.workplan, objectOf(membersOf(planningFields(DOCUMENT_GROUPS)))],
  [ATTRIBUTE.schedule, objectOf(membersOf(SCHEDULE_FIELDS))],
  [ATTRIBUTE.calendar, objectOf(membersOf(planningFields(CALENDAR_GROUPS)))],
  [ATTRIBUTE.activity, objectOf(membersOf(planningFields(TASK_GROUPS)))],
  [ATTRIBUTE.sequence, objectOf(membersOf(planningFields(SEQUENCE_GROUPS)))],
  [ATTRIBUTE.document, objectOf(membersOf(opsFields(DOCUMENT_GROUPS)))],
  [ATTRIBUTE.opsCalendar, objectOf(membersOf(opsFields(CALENDAR_GROUPS)))],
  [ATTRIBUTE.opsTask, objectOf(membersOf(opsFields(TASK_GROUPS)))],
  [ATTRIBUTE.opsSequence, objectOf(membersOf(opsFields(SEQUENCE_GROUPS)))],
]);

export function isOwnAttributeName(name: string): name is IfcxAttributeName {
  return OWN_ATTRIBUTE_VALUES.has(name as IfcxAttributeName);
}

export function ownSchemas(used: ReadonlySet<string>): Record<string, { value: Record<string, unknown> }> {
  const schemas: Record<string, { value: Record<string, unknown> }> = {};
  for (const [name, value] of OWN_ATTRIBUTE_VALUES) if (used.has(name)) schemas[name] = { value: ifc5ValueDescription(value) };
  return schemas;
}
