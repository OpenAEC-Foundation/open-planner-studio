export const IFCX_VERSION = 'ifcx_alpha';
export const IFCX_DATA_VERSION = '1.0.0';
export const OPS_PROFILE_VERSION = '1.0.0';
export const CANADIAN_CALENDAR_PROFILE_VERSION = '1.1.0';
export const OPS_PROFILE_MAJOR = 1;
export const OWN_HEADER_ID_PREFIX = 'urn:openaec:planner:';
export const DEFAULT_HEADER_AUTHOR = 'Open Planner Studio';

export const PLANNING_NAMESPACE = 'openaec::planning::';
export const OPS_NAMESPACE = 'openaec::ops::';

export const ATTRIBUTE = {
  workplan: 'openaec::planning::workplan',
  schedule: 'openaec::planning::schedule',
  calendar: 'openaec::planning::calendar',
  activity: 'openaec::planning::activity',
  sequence: 'openaec::planning::sequence',
  resource: 'openaec::planning::resource',
  assignment: 'openaec::planning::assignment',
  baseline: 'openaec::planning::baseline',
  document: 'openaec::ops::document',
  opsCalendar: 'openaec::ops::calendar',
  opsTask: 'openaec::ops::task',
  opsSequence: 'openaec::ops::sequence',
  opsResource: 'openaec::ops::resource',
  opsAssignment: 'openaec::ops::assignment',
  opsBaseline: 'openaec::ops::baseline',
} as const;

export type IfcxAttributeName = typeof ATTRIBUTE[keyof typeof ATTRIBUTE];
