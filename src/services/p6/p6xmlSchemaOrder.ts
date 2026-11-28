import { escapeXml, replaceInvalidXmlChars } from '@/services/xmlInterchange';

export const P6_ID_MAX_LENGTH = 40;

export const P6_MAX_LENGTH = {
  Activity: { Id: P6_ID_MAX_LENGTH, Name: 120 },
  WBS: { Code: P6_ID_MAX_LENGTH, Name: 100 },
  Project: { Id: P6_ID_MAX_LENGTH, Name: 100 },
  Resource: { Id: 255, Name: 255 },
  ResourceCurve: { Name: 60 },
} as const;
const MAX_LENGTH: Readonly<Record<string, Readonly<Record<string, number>>>> = P6_MAX_LENGTH;

const ORDER: Readonly<Record<string, readonly string[]>> = {
  APIBusinessObjects: ['UDFType', 'NotebookTopic', 'Calendar', 'ResourceCurve', 'Resource', 'ResourceRate', 'Project'],
  Project: [
    'ActivityDefaultCalendarObjectId', 'ActivityDefaultDurationType', 'CriticalActivityFloatLimit', 'CriticalActivityPathType',
    'DataDate', 'Description', 'Id', 'MustFinishByDate', 'Name', 'ObjectId',
    'PlannedStartDate', 'Status',
    'UDF',
    'WBS', 'Activity', 'ResourceAssignment', 'ActivityNote', 'Relationship',
    'ScheduleOptions',
  ],
  ScheduleOptions: [
    'CalculateFloatBasedOnFinishDate', 'ComputeTotalFloatType', 'MakeOpenEndedActivitiesCritical',
    'MaximumMultipleFloatPaths', 'MultipleFloatPathsEnabled', 'MultipleFloatPathsUseTotalFloat',
    'OutOfSequenceScheduleType', 'ProjectObjectId', 'RelationshipLagCalendar', 'StartToStartLagCalculationType',
    'UseExpectedFinishDates',
  ],
  Calendar: ['HoursPerDay', 'HoursPerMonth', 'HoursPerWeek', 'HoursPerYear', 'Name', 'ObjectId', 'Type', 'StandardWorkWeek', 'HolidayOrExceptions'],
  StandardWorkWeek: ['StandardWorkHours'],
  StandardWorkHours: ['DayOfWeek', 'WorkTime'],
  HolidayOrExceptions: ['HolidayOrException'],
  HolidayOrException: ['Date', 'WorkTime'],
  WorkTime: ['Start', 'Finish'],
  ResourceCurve: ['Name', 'ObjectId', 'Values'],
  Values: Array.from({ length: 21 }, (_, i) => `Value${i * 5}`),
  Resource: ['CalendarObjectId', 'Id', 'MaxUnitsPerTime', 'Name', 'ObjectId', 'ParentObjectId', 'ResourceType', 'UnitOfMeasureAbbreviation'],
  ResourceRate: ['EffectiveDate', 'ObjectId', 'PricePerUnit', 'ResourceObjectId'],
  UDFType: ['DataType', 'ObjectId', 'SubjectArea', 'Title'],
  UDF: ['TypeObjectId', 'TextValue'],
  NotebookTopic: ['AvailableForActivity', 'AvailableForEPS', 'AvailableForProject', 'AvailableForWBS', 'Name', 'ObjectId'],
  WBS: ['Code', 'Name', 'ObjectId', 'ParentObjectId', 'ProjectObjectId', 'SequenceNumber'],
  Activity: [
    'ActualFinishDate', 'ActualStartDate', 'CalendarObjectId', 'DurationPercentComplete', 'DurationType',
    'ExpectedFinishDate', 'Id', 'Name', 'ObjectId',
    'PercentCompleteType', 'PhysicalPercentComplete', 'PlannedDuration', 'PlannedFinishDate', 'PlannedStartDate',
    'PrimaryConstraintDate', 'PrimaryConstraintType', 'ProjectObjectId', 'RemainingDuration',
    'SecondaryConstraintDate', 'SecondaryConstraintType', 'Status', 'Type', 'UnitsPercentComplete', 'WBSObjectId', 'UDF',
  ],
  ActivityNote: ['ActivityObjectId', 'Note', 'NotebookTopicObjectId', 'ObjectId', 'ProjectObjectId'],
  Relationship: [
    'Lag', 'ObjectId', 'PredecessorActivityObjectId', 'PredecessorProjectObjectId',
    'SuccessorActivityObjectId', 'SuccessorProjectObjectId', 'Type',
  ],
  ResourceAssignment: [
    'ActivityObjectId', 'ActualCurve', 'ActualStartDate', 'ActualUnits', 'ObjectId', 'PlannedCurve',
    'PlannedFinishDate', 'PlannedStartDate', 'PlannedUnits', 'PlannedUnitsPerTime', 'ProjectObjectId',
    'RemainingCurve', 'RemainingStartDate', 'RemainingUnits', 'RemainingUnitsPerTime', 'ResourceCurveObjectId',
    'ResourceObjectId',
  ],
};

export interface P6Node {
  tag: string;
  text?: string;
  nil?: boolean;
  children?: P6Node[];
}

export function leaf(tag: string, value: string | number | undefined | null): P6Node[] {
  if (value === undefined || value === null || value === '') return [];
  return [{ tag, text: String(value) }];
}

export function node(tag: string, children: P6Node[]): P6Node {
  return { tag, children };
}

export function orderedChildren(parent: string, children: readonly P6Node[]): P6Node[] {
  const order = ORDER[parent];
  if (!order) throw new Error(`P6-XML: geen schemavolgorde voor <${parent}>`);
  const indexOf = (tag: string): number => {
    const i = order.indexOf(tag);
    if (i < 0) throw new Error(`P6-XML: <${tag}> heeft geen plek in de schemavolgorde van <${parent}>`);
    return i;
  };
  return children
    .map((child, position) => ({ child, position, rank: indexOf(child.tag) }))
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map(entry => entry.child);
}

const UNIQUE_FIELDS: ReadonlySet<string> = new Set(['Activity.Id']);

function collectTexts(root: P6Node, key: string, parent = '', out = new Set<string>()): Set<string> {
  if (root.children) for (const child of root.children) collectTexts(child, key, root.tag, out);
  else if (`${parent}.${root.tag}` === key && root.text !== undefined) out.add(root.text);
  return out;
}

function truncateUnique(text: string, max: number, used: Set<string>): string {
  let candidate = text.slice(0, max);
  for (let n = 2; used.has(candidate); n++) {
    const suffix = `-${n}`;
    candidate = text.slice(0, max - suffix.length) + suffix;
  }
  used.add(candidate);
  return candidate;
}

export function renderP6Xml(root: P6Node, rootAttributes: string): string {
  return renderP6XmlWithReport(root, rootAttributes).xml;
}

export function renderP6XmlWithReport(
  root: P6Node,
  rootAttributes: string,
): { xml: string; truncated: number; invalidXmlChars: number } {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'];
  let truncated = 0;
  const used = new Map<string, Set<string>>();
  for (const key of UNIQUE_FIELDS) {
    const [parentTag, tag] = key.split('.');
    const max = MAX_LENGTH[parentTag]?.[tag] ?? Infinity;
    used.set(key, new Set([...collectTexts(root, key)].filter(t => t.length <= max)));
  }
  const render = (n: P6Node, depth: number, attrs = '', parent = ''): void => {
    const pad = '  '.repeat(depth);
    if (n.nil) { lines.push(`${pad}<${n.tag} xsi:nil="true" />`); return; }
    if (n.children) {
      lines.push(`${pad}<${n.tag}${attrs}>`);
      for (const child of orderedChildren(n.tag, n.children)) render(child, depth + 1, '', n.tag);
      lines.push(`${pad}</${n.tag}>`);
      return;
    }
    const max = MAX_LENGTH[parent]?.[n.tag];
    let text = n.text ?? '';
    if (max !== undefined && text.length > max) {
      const usedSet = used.get(`${parent}.${n.tag}`);
      text = usedSet ? truncateUnique(text, max, usedSet) : text.slice(0, max);
      truncated++;
    }
    lines.push(`${pad}<${n.tag}>${escapeXml(text)}</${n.tag}>`);
  };
  render(root, 0, rootAttributes ? ` ${rootAttributes}` : '');
  const { xml, replaced } = replaceInvalidXmlChars(lines.join('\n'));
  return { xml, truncated, invalidXmlChars: replaced };
}
