export const IFCX_VERSION = 'ifcx_alpha';
export const IFCX_DATA_VERSION = '1.0.0';
export const OPS_PROFILE_VERSION = '1.0.0';
export const OPS_PROFILE_MAJOR = 1;
export const OWN_HEADER_ID_PREFIX = 'urn:openaec:planner:';
export const DEFAULT_HEADER_AUTHOR = 'Open Planner Studio';
export const OPS_NAME_UUID_NAMESPACE = 'fd4e93a2-de83-56ee-929c-defaa450b626';

export const PLANNING_NAMESPACE = 'openaec::planning::';
export const OPS_NAMESPACE = 'openaec::ops::';

export const ATTRIBUTE = {
  workplan: 'openaec::planning::workplan',
  schedule: 'openaec::planning::schedule',
  calendar: 'openaec::planning::calendar',
  activity: 'openaec::planning::activity',
  sequence: 'openaec::planning::sequence',
  document: 'openaec::ops::document',
  opsCalendar: 'openaec::ops::calendar',
  opsTask: 'openaec::ops::task',
  opsSequence: 'openaec::ops::sequence',
} as const;

export type IfcxAttributeName = typeof ATTRIBUTE[keyof typeof ATTRIBUTE];
