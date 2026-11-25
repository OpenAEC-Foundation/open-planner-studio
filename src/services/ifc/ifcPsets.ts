import type {
  Task, ConstraintType, TaskSplitGap, TaskTimephasedContour, TimephasedContourPeriod, MspTaskType, WorkRule,
  P6CompletePctType, P6DurationType, P6ActivityType,
} from '@/types/task';
import { WORK_RULES } from '@/types/workRule';
import { hasValidP6SuspendResume } from '@/utils/p6SuspendResume';
import { importStatusDate } from '@/services/importDates';
import { storedExternalLinks } from '@/engine/externalLinks';
import {
  DAY_MEASURE_DURATIONS_PROP, DAY_MEASURE_DURATION_KEYS, DAY_MEASURE_LAGS_PROP, EXACT_FLOAT_KEYS, EXACT_FLOAT_PROP,
  EXACT_MINUTE_LAGS_PROP, EXACT_MINUTES_KEYS, EXACT_MINUTES_PROP, parseDayMeasureDurations, parseExactFloat, parseExactMinutes,
  type DayMeasureDurationRecords, type ExactFloatRecords, type ExactMinutesRecords,
} from './dayMeasureIo';

export const PSET = {
  TaskIdentity: 'OPS_TaskIdentity',
  Constraints: 'OPS_Constraints',
  ExternalLink: 'OPS_ExternalLink',
  Hammock: 'OPS_Hammock',
  Milestone: 'OPS_Milestone',
  Leveling: 'OPS_Leveling',
  TaskNotes: 'OPS_TaskNotes',
  TaskAppearance: 'OPS_TaskAppearance',
  Analysis: 'OPS_Analysis',
  Splits: 'OPS_TaskSplits',
  Manual: 'OPS_ManualScheduling',
  Resume: 'OPS_Resume',
  Window: 'OPS_TimephasedWindow',
  DurationWalks: 'OPS_TimephasedDurationWalks',
  Contours: 'OPS_TimephasedContours',
  MspTaskType: 'OPS_MspTaskType',
  WorkRule: 'OPS_WorkRule',
  P6Progress: 'OPS_P6Progress',
  Summary: 'OPS_Summary',
  ProjectSettings: 'OPS_ProjectSettings',
  StructureMeta: 'OPS_StructureMeta',
  TaskTypes: 'OPS_TaskTypes',
  CustomFields: 'OPS_CustomFields',
  ActivityCodes: 'OPS_ActivityCodes',
  Resource: 'OPS_Resource',
  Assignments: 'OPS_Assignments',
  Timephased: 'OPS_Timephased',
  Baselines: 'OPS_Baselines',
  SchedulingOptions: 'OPS_SchedulingOptions',
  SchedulingProfile: 'OPS_SchedulingProfile',
  ImportProvenance: 'OPS_ImportProvenance',
  XerSourceArchive: 'OPS_XerSourceArchive',
  XerDocument: 'OPS_XerDocument',
  RecoveryForeignSource: 'OPS_RecoveryForeignSource',
  Sequences: 'OPS_Sequences',
  Calendar: 'OPS_Calendar',
  Library: 'OPS_Library',
  Project: 'OPS_Project',
} as const;

function propNames<const N extends string>(...names: N[]): { readonly [K in N]: K } {
  const out: Record<string, string> = {};
  for (const name of names) out[name] = name;
  return Object.freeze(out) as { readonly [K in N]: K };
}

export const PROP = {
  TaskIdentity: propNames('InternalTaskId'),
  Constraints: propNames('ConstraintType', 'ConstraintDate', 'Hard', 'ConstraintType2', 'ConstraintDate2', 'Deadline'),
  ExternalLink: propNames('Links'),
  Hammock: propNames('IsHammock'),
  Milestone: propNames('AtDayEnd', 'MilestoneKind', 'Mandatory'),
  Leveling: propNames('LevelingDelay', 'LevelingDelayMinutes', 'LevelingDelayElapsed'),
  TaskNotes: propNames('Notes'),
  TaskAppearance: propNames('Color'),
  Analysis: propNames('InterferingFloat', 'IsNearCritical', 'FloatPath', EXACT_FLOAT_PROP),
  Splits: propNames('Splits'),
  Manual: propNames('ManuallyScheduled'),
  Resume: propNames('Resume', 'Stop'),
  Window: propNames('FinishFloor', 'StartAnchor'),
  DurationWalks: propNames('DurationWalks'),
  Contours: propNames('Contours'),
  MspTaskType: propNames('MspTaskType', 'EffortDriven'),
  WorkRule: propNames('WorkRule', DAY_MEASURE_DURATIONS_PROP, EXACT_MINUTES_PROP),
  P6Progress: propNames(
    'ProjectId', 'TaskId', 'ExplicitTargetWindow', 'CompletePctType', 'ExpectedFinish', 'DurationType', 'ActivityType',
    'SuspendResume',
  ),
  Summary: propNames('IsSummary'),
  ProjectSettings: propNames(
    'InternalProjectId', 'wbsAutoNumber', 'DefaultTaskDurationUnit', 'DefaultWorkRule', 'StatusDate', 'ProgressMode',
    'ProjectStartDate', 'ProjectEndDate', 'CreatedAt', 'ModifiedAt', 'CompanyId', 'CompanyName', 'IfcSchemaConfirmed',
    'IfcSchemaUnconfirmed', 'P6ProjectCode', 'DependentProjectsFolder', 'AnchorsFromOpenDocuments',
    'ProjectName', 'ProjectDescription', 'Author', 'Organization',
  ),
  StructureMeta: propNames('structure'),
  TaskTypes: propNames('TaskTypes'),
  CustomFields: propNames(),
  ActivityCodes: propNames(),
  Resource: propNames('MaxUnits', 'CostPerHour', 'UnitOfMeasure', 'Color', 'AvailabilitySteps', 'ParentGuid', 'LibraryOrigin'),
  Assignments: propNames(),
  Timephased: propNames('Windows'),
  Baselines: propNames('Baselines', 'ActiveBaselineId', 'ComparedBaselineIds', 'TaskGuids'),
  SchedulingOptions: propNames('SchedulingOptions'),
  SchedulingProfile: propNames('SchedulingProfile'),
  ImportProvenance: propNames('UnchangedSinceImport', 'SourceFormat'),
  XerSourceArchive: propNames(
    'SchemaVersion', 'Format', 'StorageFormat', 'ByteLength', 'Sha256', 'Encoding', 'Bom', 'Newline', 'ByteChunkSize',
    'ByteChunkCount', 'DiagnosticsByteLength', 'DiagnosticsSha256', 'DiagnosticsChunkCount',
  ),
  XerDocument: propNames('ArchiveSha256', 'SourceProjectId'),
  RecoveryForeignSource: propNames('Sha256', 'ByteLength', 'SourcePath', 'SourceSiteFileId'),
  Sequences: propNames('P6StartAtPredecessorFinishBoundarySequenceGuids', DAY_MEASURE_LAGS_PROP, EXACT_MINUTE_LAGS_PROP),
  Calendar: propNames(
    'LiteralTimes', 'RuleSetId', 'Region', 'BreakChoice', 'GeneratedFromYear', 'GeneratedToYear', 'LibraryOrigin',
    'HoursPerDay', 'WorkStartHour', 'WorkEndHour', 'SimpleBreakStart', 'SimpleBreakDuration', 'IsHourCalendar',
    'WorkingExceptionKeysV1', 'WorkingExceptionIds', 'P6Source', 'P6NonWorkPenaltyDates', 'P6NonWorkPenaltyDatesState',
  ),
  Library: propNames('pool'),
  Project: propNames('TimeModel'),
} as const satisfies { readonly [K in keyof typeof PSET]: Readonly<Record<string, string>> };

export const XER_ARCHIVE_CHUNK = { bytes: 'ByteChunk', diagnostics: 'DiagnosticsChunk' } as const;
export type XerArchiveChunkPrefix = typeof XER_ARCHIVE_CHUNK[keyof typeof XER_ARCHIVE_CHUNK];
export function xerArchiveChunkName(prefix: XerArchiveChunkPrefix, index: number): string {
  return `${prefix}${String(index).padStart(6, '0')}`;
}
export function isXerArchiveChunkName(name: string, prefix?: XerArchiveChunkPrefix): boolean {
  return (prefix ? [prefix] : Object.values(XER_ARCHIVE_CHUNK)).some(p =>
    name.length === p.length + 6 && name.startsWith(p) && /^\d{6}$/.test(name.slice(p.length)));
}

const propList = (names: Readonly<Record<string, string>>): readonly string[] => Object.freeze(Object.values(names));

export function ifcStr(s: string): string {
  if (!s) return '$';
  return `'${encodeStepText(s)}'`;
}

export function asciiJson(json: string): string {
  return json.replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function ifcJson(value: unknown): string {
  const json: string | undefined = JSON.stringify(value);
  return ifcStr(json === undefined ? '' : asciiJson(json));
}

const IFC_DATE_FORM = /^(\d{4})-(\d{2})-(\d{2})$/;
const IFC_DATE_TIME_FORM = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d$/;

function isCalendarDate(m: RegExpExecArray): boolean {
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export function ifcDateValue(value: string): string {
  const date = IFC_DATE_FORM.exec(value);
  if (date && isCalendarDate(date)) return `IFCDATE(${ifcStr(value)})`;
  const dateTime = IFC_DATE_TIME_FORM.exec(value);
  if (dateTime && isCalendarDate(dateTime)) return `IFCDATETIME(${ifcStr(`${value}:00`)})`;
  return `IFCTEXT(${value ? ifcStr(value) : "''"})`;
}

export function readIfcDate(rawArg: string, value: string, legacy: (v: string) => string = (v) => v): string {
  return /^IFCDATETIME\s*\(/i.test(rawArg.trim()) ? importStatusDate(value) : legacy(value);
}

export const OPS_APP_VERSION = '0.2';
export const OPS_LEGACY_LITERAL_APP_VERSION = '0.1';

const STEP_PLAIN = /^[\x20-\x26\x28-\x5B\x5D-\x7E]*$/;
const hex = (n: number, width: number) => n.toString(16).toUpperCase().padStart(width, '0');

export function encodeStepText(s: string): string {
  if (STEP_PLAIN.test(s)) return s;
  const parts: string[] = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c >= 0x20 && c <= 0x7E) {
      if (c === 0x27) { parts.push("''"); i++; continue; }
      if (c === 0x5C) { parts.push('\\\\'); i++; continue; }
      let j = i + 1;
      while (j < n) {
        const d = s.charCodeAt(j);
        if (d < 0x20 || d > 0x7E || d === 0x27 || d === 0x5C) break;
        j++;
      }
      parts.push(s.slice(i, j));
      i = j;
      continue;
    }
    const cp = s.codePointAt(i)!;
    if (cp > 0xFFFF) {
      let run = '\\X4\\';
      while (i < n) {
        const q = s.codePointAt(i)!;
        if (q <= 0xFFFF) break;
        run += hex(q, 8);
        i += 2;
      }
      parts.push(run + '\\X0\\');
    } else {
      let run = '\\X2\\';
      while (i < n) {
        const q = s.charCodeAt(i);
        if (q >= 0x20 && q <= 0x7E) break;
        if (q >= 0xD800 && q <= 0xDBFF && i + 1 < n) {
          const lo = s.charCodeAt(i + 1);
          if (lo >= 0xDC00 && lo <= 0xDFFF) break;
        }
        run += hex(q, 4);
        i++;
      }
      parts.push(run + '\\X0\\');
    }
  }
  return parts.join('');
}
export function ifcBool(b: boolean): string {
  return b ? '.T.' : '.F.';
}

export function stepReal(n: number): string | undefined {
  if (!Number.isFinite(n)) return undefined;
  const [mantissa, exponent] = String(n).split('e');
  const withPoint = mantissa.includes('.') ? mantissa : `${mantissa}.`;
  return exponent === undefined ? withPoint : `${withPoint}E${exponent}`;
}

export function ifcTypedReal(type: 'IFCREAL' | 'IFCMONETARYMEASURE', n: number): string {
  const real = stepReal(n);
  return real === undefined ? '$' : `${type}(${real})`;
}

export interface PropSpec {
  name: string;
  value: string;
}

export interface ReadProp {
  name: string;
  value: unknown;
  raw: string;
}

export interface PerTaskWriteOptions {
  atDayEnd?: boolean;
  dayMeasureDurations?: DayMeasureDurationRecords;
  exactFloat?: ExactFloatRecords;
  exactMinutes?: ExactMinutesRecords;
}

export interface PerTaskPset {
  name: string;
  psetSeed: string;
  relSeed: string;
  readProps: readonly string[];
  write(task: Task, options?: PerTaskWriteOptions): PropSpec[] | null;
  apply(task: Task, props: ReadProp[]): void;
}

const CONSTRAINT_VALID: ConstraintType[] = ['ASAP', 'ALAP', 'SNET', 'SNLT', 'FNET', 'FNLT', 'MSO', 'MFO'];

const milestonesAtDayEnd = new WeakSet<Task>();
export const milestoneWasAtDayEnd = (task: Task): boolean => milestonesAtDayEnd.has(task);

const dayMeasureDurationsRead = new WeakMap<Task, DayMeasureDurationRecords>();
const exactFloatRead = new WeakMap<Task, ExactFloatRecords>();
const exactMinutesRead = new WeakMap<Task, ExactMinutesRecords>();
export const readDayMeasureDurations = (task: Task): DayMeasureDurationRecords | undefined => dayMeasureDurationsRead.get(task);
export const readExactFloat = (task: Task): ExactFloatRecords | undefined => exactFloatRead.get(task);
export const readExactMinutes = (task: Task): ExactMinutesRecords | undefined => exactMinutesRead.get(task);

function recordsJson<K extends string>(keys: readonly K[], records: Partial<Record<K, unknown>>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (records[key] !== undefined) out[key] = records[key];
  return Object.keys(out).length > 0 ? out : null;
}

export const PER_TASK_PSETS: PerTaskPset[] = [
  {
    name: PSET.TaskIdentity, psetSeed: 'pset_tid_', relSeed: 'rel_tid_',
    readProps: propList(PROP.TaskIdentity),
    write(task) {
      return [{ name: PROP.TaskIdentity.InternalTaskId, value: `IFCTEXT(${ifcStr(task.id)})` }];
    },
    apply() {
    },
  },
  {
    name: PSET.Constraints, psetSeed: 'pset_cst_', relSeed: 'rel_cst_',
    readProps: propList(PROP.Constraints),
    write(task) {
      const props: PropSpec[] = [];
      const c = task.constraint;
      if (c && c.type !== 'ASAP') {
        props.push({ name: PROP.Constraints.ConstraintType, value: `IFCLABEL(${ifcStr(c.type)})` });
        if (c.date) props.push({ name: PROP.Constraints.ConstraintDate, value: ifcDateValue(c.date) });
        if (c.hard) props.push({ name: PROP.Constraints.Hard, value: 'IFCBOOLEAN(.T.)' });
      }
      const c2 = task.constraint2;
      if (c2 && c2.type !== 'ASAP') {
        props.push({ name: PROP.Constraints.ConstraintType2, value: `IFCLABEL(${ifcStr(c2.type)})` });
        if (c2.date) props.push({ name: PROP.Constraints.ConstraintDate2, value: ifcDateValue(c2.date) });
      }
      if (task.deadline) props.push({ name: PROP.Constraints.Deadline, value: ifcDateValue(task.deadline) });
      return props;
    },
    apply(task, props) {
      let ctype: string | undefined; let cdate: string | undefined; let hard = false;
      let ctype2: string | undefined; let cdate2: string | undefined;
      for (const { name, value, raw } of props) {
        if (name === PROP.Constraints.Hard) { if (value === true) hard = true; continue; }
        if (typeof value !== 'string') continue;
        if (name === PROP.Constraints.ConstraintType) ctype = value;
        else if (name === PROP.Constraints.ConstraintDate) cdate = readIfcDate(raw, value);
        else if (name === PROP.Constraints.ConstraintType2) ctype2 = value;
        else if (name === PROP.Constraints.ConstraintDate2) cdate2 = readIfcDate(raw, value);
        else if (name === PROP.Constraints.Deadline) task.deadline = readIfcDate(raw, value);
      }
      if (ctype && CONSTRAINT_VALID.includes(ctype as ConstraintType)) {
        task.constraint = {
          type: ctype as ConstraintType,
          ...(cdate ? { date: cdate } : {}),
          ...(hard ? { hard: true } : {}),
        };
      }
      if (ctype2 && CONSTRAINT_VALID.includes(ctype2 as ConstraintType)) {
        task.constraint2 = { type: ctype2 as ConstraintType, ...(cdate2 ? { date: cdate2 } : {}) };
      }
    },
  },
  {
    name: PSET.ExternalLink, psetSeed: 'pset_extl_', relSeed: 'rel_extl_',
    readProps: propList(PROP.ExternalLink),
    write(task) {
      const links = task.externalLinks;
      if (!links || links.length === 0) return null;
      return [{ name: PROP.ExternalLink.Links, value: `IFCTEXT(${ifcJson(links)})` }];
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name !== PROP.ExternalLink.Links || typeof value !== 'string' || !value) continue;
        try {
          const links = storedExternalLinks(JSON.parse(value));
          if (links) task.externalLinks = links;
        } catch { }
      }
    },
  },
  {
    name: PSET.Hammock, psetSeed: 'pset_hmk_', relSeed: 'rel_hmk_',
    readProps: propList(PROP.Hammock),
    write(task) {
      return task.isHammock ? [{ name: PROP.Hammock.IsHammock, value: 'IFCBOOLEAN(.T.)' }] : null;
    },
    apply(task, props) {
      for (const { name, value } of props) if (name === PROP.Hammock.IsHammock && value === true) task.isHammock = true;
    },
  },
  {
    name: PSET.Milestone, psetSeed: 'pset_ms_', relSeed: 'rel_ms_',
    readProps: propList(PROP.Milestone),
    write(task, options) {
      if (!task.isMilestone) return null;
      const props: PropSpec[] = [];
      if (options?.atDayEnd) props.push({ name: PROP.Milestone.AtDayEnd, value: 'IFCBOOLEAN(.T.)' });
      if (task.milestoneKind === 'START' || task.milestoneKind === 'FINISH') {
        props.push({ name: PROP.Milestone.MilestoneKind, value: `IFCLABEL(${ifcStr(task.milestoneKind)})` });
      }
      if (task.mandatory) props.push({ name: PROP.Milestone.Mandatory, value: 'IFCBOOLEAN(.T.)' });
      return props;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name === PROP.Milestone.MilestoneKind && (value === 'START' || value === 'FINISH')) task.milestoneKind = value;
        else if (name === PROP.Milestone.AtDayEnd && value === true) milestonesAtDayEnd.add(task);
        else if (name === PROP.Milestone.Mandatory && value === true) task.mandatory = true;
      }
    },
  },
  {
    name: PSET.Leveling, psetSeed: 'pset_lvl_', relSeed: 'rel_lvl_',
    readProps: propList(PROP.Leveling),
    write(task) {
      const props: PropSpec[] = [];
      if (task.levelingDelay) props.push({ name: PROP.Leveling.LevelingDelay, value: `IFCINTEGER(${Math.round(task.levelingDelay)})` });
      if (task.levelingDelayMinutes != null) {
        props.push({ name: PROP.Leveling.LevelingDelayMinutes, value: `IFCINTEGER(${Math.round(task.levelingDelayMinutes)})` });
      }
      if (task.levelingDelayElapsed) props.push({ name: PROP.Leveling.LevelingDelayElapsed, value: 'IFCBOOLEAN(.T.)' });
      return props.length > 0 ? props : null;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name === PROP.Leveling.LevelingDelay) {
          if (typeof value === 'number' && Number.isFinite(value)) task.levelingDelay = Math.round(value);
        } else if (name === PROP.Leveling.LevelingDelayMinutes) {
          if (typeof value === 'number' && Number.isFinite(value)) task.levelingDelayMinutes = Math.round(value);
        } else if (name === PROP.Leveling.LevelingDelayElapsed) {
          if (value === true) task.levelingDelayElapsed = true;
        }
      }
    },
  },
  {
    name: PSET.TaskNotes, psetSeed: 'pset_notes_', relSeed: 'rel_notes_',
    readProps: propList(PROP.TaskNotes),
    write(task) {
      const notes = task.notes;
      if (!notes || notes.length === 0) return null;
      return [{ name: PROP.TaskNotes.Notes, value: `IFCTEXT(${ifcJson(notes)})` }];
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name !== PROP.TaskNotes.Notes || typeof value !== 'string' || !value) continue;
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0) task.notes = parsed;
        } catch { }
      }
    },
  },
  {
    name: PSET.TaskAppearance, psetSeed: 'pset_appear_', relSeed: 'rel_appear_',
    readProps: propList(PROP.TaskAppearance),
    write(task) {
      return task.color ? [{ name: PROP.TaskAppearance.Color, value: `IFCTEXT(${ifcStr(task.color)})` }] : null;
    },
    apply(task, props) {
      for (const { name, value } of props) if (name === PROP.TaskAppearance.Color && typeof value === 'string' && value) task.color = value;
    },
  },
  {
    name: PSET.Analysis, psetSeed: 'pset_ana_', relSeed: 'rel_ana_',
    readProps: propList(PROP.Analysis),
    write(_task, options) {
      const floats = options?.exactFloat && recordsJson(EXACT_FLOAT_KEYS, options.exactFloat);
      return floats ? [{ name: EXACT_FLOAT_PROP, value: `IFCTEXT(${ifcJson(floats)})` }] : null;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name === PROP.Analysis.InterferingFloat && typeof value === 'number') task.time.interferingFloat = value;
        else if (name === PROP.Analysis.IsNearCritical && typeof value === 'boolean') task.time.isNearCritical = value;
        else if (name === PROP.Analysis.FloatPath && typeof value === 'number') task.time.floatPath = Math.round(value);
        else if (name === EXACT_FLOAT_PROP) {
          const floats = parseExactFloat(value);
          if (floats) exactFloatRead.set(task, floats);
        }
      }
    },
  },
  {
    name: PSET.Splits, psetSeed: 'pset_splits_', relSeed: 'rel_splits_',
    readProps: propList(PROP.Splits),
    write(task) {
      const gaps = task.splitGaps;
      if (!gaps || gaps.length === 0) return null;
      return [{ name: PROP.Splits.Splits, value: `IFCTEXT(${ifcJson(gaps)})` }];
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name !== PROP.Splits.Splits || typeof value !== 'string' || !value) continue;
        try {
          const parsed: unknown = JSON.parse(value);
          const isValidGap = (g: unknown): g is TaskSplitGap =>
            !!g && typeof g === 'object'
            && typeof (g as TaskSplitGap).afterMinutes === 'number'
            && typeof (g as TaskSplitGap).gapMinutes === 'number';
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidGap)) {
            task.splitGaps = parsed.map(g => g.source === 'leveling' || g.source === 'user'
              ? { afterMinutes: g.afterMinutes, gapMinutes: g.gapMinutes, source: g.source }
              : { afterMinutes: g.afterMinutes, gapMinutes: g.gapMinutes });
          }
        } catch { }
      }
    },
  },
  {
    name: PSET.Manual, psetSeed: 'pset_man_', relSeed: 'rel_man_',
    readProps: propList(PROP.Manual),
    write(task) {
      return task.manuallyScheduled ? [{ name: PROP.Manual.ManuallyScheduled, value: 'IFCBOOLEAN(.T.)' }] : null;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name === PROP.Manual.ManuallyScheduled) { if (value === true) task.manuallyScheduled = true; }
      }
    },
  },
  {
    name: PSET.Resume, psetSeed: 'pset_resume_', relSeed: 'rel_resume_',
    readProps: propList(PROP.Resume),
    write(task) {
      const t = task.time;
      const props: PropSpec[] = [];
      if (t.resume) props.push({ name: PROP.Resume.Resume, value: `IFCTEXT(${ifcStr(t.resume)})` });
      if (t.stop) props.push({ name: PROP.Resume.Stop, value: `IFCTEXT(${ifcStr(t.stop)})` });
      return props.length > 0 ? props : null;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name === PROP.Resume.Resume && typeof value === 'string' && value) task.time.resume = value;
        else if (name === PROP.Resume.Stop && typeof value === 'string' && value) task.time.stop = value;
      }
    },
  },
  {
    name: PSET.Window, psetSeed: 'pset_win_', relSeed: 'rel_win_',
    readProps: propList(PROP.Window),
    write(task) {
      const props: PropSpec[] = [];
      if (task.timephasedFinishFloor) props.push({ name: PROP.Window.FinishFloor, value: `IFCTEXT(${ifcStr(task.timephasedFinishFloor)})` });
      if (task.timephasedStartAnchor) props.push({ name: PROP.Window.StartAnchor, value: `IFCTEXT(${ifcStr(task.timephasedStartAnchor)})` });
      return props.length > 0 ? props : null;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name === PROP.Window.FinishFloor && typeof value === 'string' && value) task.timephasedFinishFloor = value;
        else if (name === PROP.Window.StartAnchor && typeof value === 'string' && value) task.timephasedStartAnchor = value;
      }
    },
  },
  {
    name: PSET.Contours, psetSeed: 'pset_contours_', relSeed: 'rel_contours_',
    readProps: propList(PROP.Contours),
    write(task) {
      const contours = task.timephasedContours;
      if (!contours || contours.length === 0) return null;
      return [{ name: PROP.Contours.Contours, value: `IFCTEXT(${ifcJson(contours)})` }];
    },
    apply(task, props) {
      const isValidPeriod = (p: unknown): p is TimephasedContourPeriod =>
        !!p && typeof p === 'object'
        && typeof (p as TimephasedContourPeriod).afterMinutes === 'number'
        && typeof (p as TimephasedContourPeriod).minutes === 'number'
        && typeof (p as TimephasedContourPeriod).workMinutes === 'number'
        && ((p as TimephasedContourPeriod).kind === 'actual' || (p as TimephasedContourPeriod).kind === 'remaining');
      const isValidContour = (c: unknown): c is TaskTimephasedContour =>
        !!c && typeof c === 'object'
        && (typeof (c as TaskTimephasedContour).resourceUid === 'number' || (c as TaskTimephasedContour).resourceUid === null)
        && ((c as TaskTimephasedContour).resourceId === undefined || typeof (c as TaskTimephasedContour).resourceId === 'string')
        && Array.isArray((c as TaskTimephasedContour).periods)
        && (c as TaskTimephasedContour).periods.every(isValidPeriod);
      for (const { name, value } of props) {
        if (name !== PROP.Contours.Contours || typeof value !== 'string' || !value) continue;
        try {
          const parsed: unknown = JSON.parse(value);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidContour)) {
            task.timephasedContours = parsed;
          }
        } catch { }
      }
    },
  },
  {
    name: PSET.MspTaskType, psetSeed: 'pset_mtt_', relSeed: 'rel_mtt_',
    readProps: propList(PROP.MspTaskType),
    write(task) {
      const props: PropSpec[] = [];
      if (task.mspTaskType) props.push({ name: PROP.MspTaskType.MspTaskType, value: `IFCLABEL(${ifcStr(task.mspTaskType)})` });
      if (task.effortDriven) props.push({ name: PROP.MspTaskType.EffortDriven, value: 'IFCBOOLEAN(.T.)' });
      return props.length > 0 ? props : null;
    },
    apply(task, props) {
      const valid: readonly MspTaskType[] = ['FIXED_UNITS', 'FIXED_DURATION', 'FIXED_WORK'];
      for (const { name, value } of props) {
        if (name === PROP.MspTaskType.EffortDriven) { if (value === true) task.effortDriven = true; continue; }
        if (name === PROP.MspTaskType.MspTaskType && typeof value === 'string' && (valid as readonly string[]).includes(value)) {
          task.mspTaskType = value as MspTaskType;
        }
      }
    },
  },
  {
    name: PSET.P6Progress, psetSeed: 'pset_p6prog_', relSeed: 'rel_p6prog_',
    readProps: propList(PROP.P6Progress),
    write(task) {
      const props: PropSpec[] = [];
      if (task.p6ProjectId) props.push({ name: PROP.P6Progress.ProjectId, value: `IFCTEXT(${ifcStr(task.p6ProjectId)})` });
      if (task.p6TaskId) props.push({ name: PROP.P6Progress.TaskId, value: `IFCTEXT(${ifcStr(task.p6TaskId)})` });
      if (task.p6ExplicitTargetWindow === true) props.push({ name: PROP.P6Progress.ExplicitTargetWindow, value: 'IFCBOOLEAN(.T.)' });
      if (task.p6CompletePctType) props.push({ name: PROP.P6Progress.CompletePctType, value: `IFCLABEL(${ifcStr(task.p6CompletePctType)})` });
      if (task.p6ExpectedFinish) props.push({ name: PROP.P6Progress.ExpectedFinish, value: `IFCTEXT(${ifcStr(task.p6ExpectedFinish)})` });
      if (task.p6DurationType) props.push({ name: PROP.P6Progress.DurationType, value: `IFCLABEL(${ifcStr(task.p6DurationType)})` });
      if (task.p6ActivityType) props.push({ name: PROP.P6Progress.ActivityType, value: `IFCLABEL(${ifcStr(task.p6ActivityType)})` });
      if (task.p6SuspendResume === false) props.push({ name: PROP.P6Progress.SuspendResume, value: 'IFCBOOLEAN(.F.)' });
      else if (hasValidP6SuspendResume(task)) props.push({ name: PROP.P6Progress.SuspendResume, value: 'IFCBOOLEAN(.T.)' });
      return props.length > 0 ? props : null;
    },
    apply(task, props) {
      const completePctTypes: readonly P6CompletePctType[] = ['CP_Drtn', 'CP_Phys', 'CP_Units'];
      const durationTypes: readonly P6DurationType[] = ['DT_FixedDrtn', 'DT_FixedDUR2', 'DT_FixedRate', 'DT_FixedQty'];
      const activityTypes: readonly P6ActivityType[] = ['TT_Task', 'TT_Rsrc', 'TT_LOE', 'TT_Mile', 'TT_FinMile', 'TT_WBS'];
      for (const { name, value } of props) {
        if (name === PROP.P6Progress.ExplicitTargetWindow) { if (value === true) task.p6ExplicitTargetWindow = true; continue; }
        if (name === PROP.P6Progress.SuspendResume) { if (typeof value === 'boolean') task.p6SuspendResume = value; continue; }
        if (typeof value !== 'string' || !value) continue;
        if (name === PROP.P6Progress.ProjectId) task.p6ProjectId = value;
        else if (name === PROP.P6Progress.TaskId) task.p6TaskId = value;
        else if (name === PROP.P6Progress.ExpectedFinish) task.p6ExpectedFinish = value;
        else if (name === PROP.P6Progress.DurationType && (durationTypes as readonly string[]).includes(value)) task.p6DurationType = value as P6DurationType;
        else if (name === PROP.P6Progress.ActivityType && (activityTypes as readonly string[]).includes(value)) task.p6ActivityType = value as P6ActivityType;
        else if (name === PROP.P6Progress.CompletePctType && (completePctTypes as readonly string[]).includes(value)) {
          task.p6CompletePctType = value as P6CompletePctType;
        }
      }
    },
  },
  {
    name: PSET.Summary, psetSeed: 'pset_sum_', relSeed: 'rel_sum_',
    readProps: propList(PROP.Summary),
    write(task) {
      return task.isSummary === true
        ? [{ name: PROP.Summary.IsSummary, value: 'IFCBOOLEAN(.T.)' }]
        : null;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name === PROP.Summary.IsSummary && value === true) task.isSummary = true;
      }
    },
  },
  {
    name: PSET.WorkRule, psetSeed: 'pset_wrl_', relSeed: 'rel_wrl_',
    readProps: propList(PROP.WorkRule),
    write(task, options) {
      const props: PropSpec[] = [];
      if (task.workRule) props.push({ name: PROP.WorkRule.WorkRule, value: `IFCLABEL(${ifcStr(task.workRule)})` });
      const records = options?.dayMeasureDurations && recordsJson(DAY_MEASURE_DURATION_KEYS, options.dayMeasureDurations);
      if (records) props.push({ name: DAY_MEASURE_DURATIONS_PROP, value: `IFCTEXT(${ifcJson(records)})` });
      const exact = options?.exactMinutes && recordsJson(EXACT_MINUTES_KEYS, options.exactMinutes);
      if (exact) props.push({ name: EXACT_MINUTES_PROP, value: `IFCTEXT(${ifcJson(exact)})` });
      return props.length > 0 ? props : null;
    },
    apply(task, props) {
      for (const { name, value } of props) {
        if (name === PROP.WorkRule.WorkRule && typeof value === 'string' && (WORK_RULES as readonly string[]).includes(value)) {
          task.workRule = value as WorkRule;
        } else if (name === DAY_MEASURE_DURATIONS_PROP) {
          const records = parseDayMeasureDurations(value);
          if (records) dayMeasureDurationsRead.set(task, records);
        } else if (name === EXACT_MINUTES_PROP) {
          const records = parseExactMinutes(value);
          if (records) exactMinutesRead.set(task, records);
        }
      }
    },
  },
];

export const PER_TASK_PSET_BY_NAME: Map<string, PerTaskPset> =
  new Map(PER_TASK_PSETS.map(d => [d.name, d]));

export const OWN_PSET_PROPERTY_NAMES: Readonly<Record<string, readonly string[]>> = Object.freeze(Object.fromEntries(
  (Object.keys(PROP) as (keyof typeof PROP)[])
    .filter(key => !PER_TASK_PSET_BY_NAME.has(PSET[key]))
    .map(key => [PSET[key], propList(PROP[key])]),
));

export const ACTIVITY_CODE_ID_SUFFIX = ' #id';

export const OWN_TEMPLATE_NAMES: readonly string[] = [PSET.CustomFields, PSET.ActivityCodes];
