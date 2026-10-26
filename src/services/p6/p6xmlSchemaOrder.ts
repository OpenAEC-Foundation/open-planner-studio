// Elementvolgorde van Primavera P6 XML (PMXML) voor precies de elementen die `p6xmlWriter` schrijft.
//
// Het Oracle-schema (P6 EPPM API BusinessObjects) definieert elk type als `xs:sequence`: de volgorde
// van de kindelementen ligt vast, en P6 valideert zijn import tegen dat schema. De volgordes hieronder
// zijn deelverzamelingen (alleen wat wij schrijven, in schemavolgorde) van de `propOrder` in de door
// JAXB gegenereerde schemaklassen van MPXJ (`org.mpxj.primavera.schema`, schema V25.12):
// APIBusinessObjects, ProjectType, CalendarType (+ StandardWorkWeek/StandardWorkHours/
// HolidayOrExceptions/HolidayOrException), WorkTimeType, ResourceCurveType (+ Values),
// ResourceType, ResourceRateType, UDFTypeType, UDFAssignmentType, NotebookTopicType, WBSType,
// ActivityType, ActivityNoteType, RelationshipType en ResourceAssignmentType.
// Gecontroleerd (2026-10-12) met een structuurcontrole over die klassen: onze export en echte
// P6-exports uit het corpus.
//
// `renderP6Xml` sorteert de kinderen van elk element op deze tabel. Een kind zonder plek in de
// tabel is een programmeerfout en geeft een exception (de round-trip-checks vangen dat).

import { escapeXml } from '@/services/xmlInterchange';

/** Schemagrenzen (Oracle P6 API, `xs:maxLength`) voor velden die de writer vult. */
export const P6_ID_MAX_LENGTH = 40;

/**
 * `xs:maxLength` per element en veld, uit het schema (MPXJ `org.mpxj.primavera.schema`, V25.12):
 * ActivityType Id 40 / Name 120, WBSType Code 40 / Name 100, ProjectType Id 40 / Name 100,
 * ResourceType Id 255 / Name 255, ResourceCurveType Name 60. `renderP6Xml` kapt langere tekst af
 * en telt dat (de ENIGE telling: de exportmelding gebruikt hem); een P6-import weigert anders het
 * hele bestand.
 */
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
    'ActivityDefaultCalendarObjectId', 'DataDate', 'Description', 'Id', 'MustFinishByDate', 'Name', 'ObjectId',
    'PlannedStartDate', 'Status',
    // Een project-UDF (`UDFAssignmentType`) na de gewone velden, vóór WBS en activiteiten: zo staat hij in
    // echte P6-exports (corpus `pmxml-samples/UploadScheduleP6.xml`, `EC00850_V2.xml`).
    'UDF',
    'WBS', 'Activity', 'ResourceAssignment', 'ActivityNote', 'Relationship',
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
    'ActualFinishDate', 'ActualStartDate', 'CalendarObjectId', 'DurationType', 'Id', 'Name', 'ObjectId',
    'PercentCompleteType', 'PhysicalPercentComplete', 'PlannedDuration', 'PlannedFinishDate', 'PlannedStartDate',
    'PrimaryConstraintDate', 'PrimaryConstraintType', 'ProjectObjectId', 'RemainingDuration',
    'SecondaryConstraintDate', 'SecondaryConstraintType', 'Status', 'Type', 'WBSObjectId', 'UDF',
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

/** Eén XML-element: tekst (al als ruwe tekst, wordt hier ge-escaped), kinderen, of `xsi:nil`. */
export interface P6Node {
  tag: string;
  text?: string;
  nil?: boolean;
  children?: P6Node[];
}

/** Bladelement met tekst; `undefined`/leeg ⇒ geen element (golden rule: niets verzinnen). */
export function leaf(tag: string, value: string | number | undefined | null): P6Node[] {
  if (value === undefined || value === null || value === '') return [];
  return [{ tag, text: String(value) }];
}

export function node(tag: string, children: P6Node[]): P6Node {
  return { tag, children };
}

/** Kinderen in schemavolgorde (stabiel: gelijke tags houden hun volgorde). */
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

/** Velden die uniek moeten blijven na het inkorten: P6 weigert twee activiteiten met hetzelfde Id. */
const UNIQUE_FIELDS: ReadonlySet<string> = new Set(['Activity.Id']);

/** Alle teksten van een veld (`Ouder.Tag`) in de boom, vóór het inkorten. */
function collectTexts(root: P6Node, key: string, parent = '', out = new Set<string>()): Set<string> {
  if (root.children) for (const child of root.children) collectTexts(child, key, root.tag, out);
  else if (`${parent}.${root.tag}` === key && root.text !== undefined) out.add(root.text);
  return out;
}

/**
 * Inkorten tot de schemagrens. Voor een uniek veld (`Activity.Id`): botst de ingekorte waarde met
 * een andere Id, dan krijgt hij een volgnummer (`-2`, `-3` …) binnen de grens.
 */
function truncateUnique(text: string, max: number, used: Set<string>): string {
  let candidate = text.slice(0, max);
  for (let n = 2; used.has(candidate); n++) {
    const suffix = `-${n}`;
    candidate = text.slice(0, max - suffix.length) + suffix;
  }
  used.add(candidate);
  return candidate;
}

/** Serialiseer een boom met inspringing van twee spaties per niveau. */
export function renderP6Xml(root: P6Node, rootAttributes: string): string {
  return renderP6XmlWithReport(root, rootAttributes).xml;
}

/** Als `renderP6Xml`, plus het aantal velden dat tot de schemagrens is ingekort. */
export function renderP6XmlWithReport(root: P6Node, rootAttributes: string): { xml: string; truncated: number } {
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
  return { xml: lines.join('\n'), truncated };
}
