import type { Task, TaskTime, TaskTimeComputed, TaskTimeInput } from '@/types/task';
import { ifcStr, ifcBool, stepReal } from './ifcPsets';
import { DEFAULT_PRIORITY } from './ifcConstants';
import { isSummaryTask } from '@/utils/taskHierarchy';
import { wholeFloatDays } from './dayMeasureIo';
import {
  ABSENT_SLOT, OWNER_HISTORY_SOORTEN, slotIndex, type SlotPositions, type WriteSlot,
} from './ifcSlotSoort';

export function ifcDurationExact(days: number): string {
  if (days < 0) return `'-P0Y0M${-days}D'`;
  return `'P0Y0M${days}D'`;
}

export interface TaskTimeWriteCtx {
  task: Task;
  dt: (iso: string) => string;
  ifcDuration: (days: number) => string;
  schedDurArg: string;
  statusTimeArg: string;
  actualDurationArg: string;
  actualStartArg: string;
  actualFinishArg: string;
  remainingArg: string;
  exactFloat?: ReadonlySet<'freeFloat' | 'totalFloat'>;
  withheld?: ReadonlySet<WithheldTaskTimeField>;
}

export type WithheldTaskTimeField =
  | 'earlyStart' | 'earlyFinish' | 'lateStart' | 'lateFinish' | 'totalFloat' | 'freeFloat' | 'isCritical';

const unlessWithheld = (w: TaskTimeWriteCtx, key: WithheldTaskTimeField, value: () => string): string =>
  w.withheld?.has(key) ? '$' : value();

export interface TaskTimeReadHelpers {
  parseDate: (arg: string | undefined) => string;
  parseDur: (arg: string | undefined) => number;
  optDate: (arg: string | undefined) => string | undefined;
  optDur: (arg: string | undefined) => number | undefined;
}

export interface TaskTimeSlot<K extends string = string> extends WriteSlot<TaskTimeWriteCtx, K> {
  read?(t: TaskTime, arg: string | undefined, p: TaskTimeReadHelpers): void;
}

const TASKTIME_TABLE = [
  { key: 'name', soort: 'afgeleid', write: (w) => ifcStr(w.task.name + ' Time') },
  { key: 'dataOrigin', soort: 'constant', write: () => '.PREDICTED.' },
  { key: 'userDefinedDataOrigin', soort: 'constant', write: () => '$' },
  {
    key: 'durationType', soort: 'domein',
    write: (w) => `.${w.task.time.durationType}.`,
    read: (t, arg) => { t.durationType = arg?.includes('ELAPSED') ? 'ELAPSEDTIME' : 'WORKTIME'; },
  },
  {
    key: 'scheduleDuration', soort: 'domein',
    write: (w) => w.schedDurArg,
    read: (t, arg, p) => { t.scheduleDuration = p.parseDur(arg); },
  },
  {
    key: 'scheduleStart', soort: 'domein',
    write: (w) => w.dt(w.task.time.scheduleStart),
    read: (t, arg, p) => { t.scheduleStart = p.parseDate(arg); },
  },
  {
    key: 'scheduleFinish', soort: 'domein',
    write: (w) => w.dt(w.task.time.scheduleFinish),
    read: (t, arg, p) => { t.scheduleFinish = p.parseDate(arg); },
  },
  {
    key: 'earlyStart', soort: 'domein',
    write: (w) => unlessWithheld(w, 'earlyStart', () => w.dt(w.task.time.earlyStart)),
    read: (t, arg, p) => { t.earlyStart = p.parseDate(arg); },
  },
  {
    key: 'earlyFinish', soort: 'domein',
    write: (w) => unlessWithheld(w, 'earlyFinish', () => w.dt(w.task.time.earlyFinish)),
    read: (t, arg, p) => { t.earlyFinish = p.parseDate(arg); },
  },
  {
    key: 'lateStart', soort: 'domein',
    write: (w) => unlessWithheld(w, 'lateStart', () => w.dt(w.task.time.lateStart)),
    read: (t, arg, p) => { t.lateStart = p.parseDate(arg); },
  },
  {
    key: 'lateFinish', soort: 'domein',
    write: (w) => unlessWithheld(w, 'lateFinish', () => w.dt(w.task.time.lateFinish)),
    read: (t, arg, p) => { t.lateFinish = p.parseDate(arg); },
  },
  {
    key: 'freeFloat', soort: 'domein',
    write: (w) => unlessWithheld(w, 'freeFloat', () => (w.exactFloat?.has('freeFloat') ? ifcDurationExact(w.task.time.freeFloat)
      : w.ifcDuration(wholeFloatDays(w.task.time.freeFloat)))),
    read: (t, arg, p) => { t.freeFloat = p.parseDur(arg); },
  },
  {
    key: 'totalFloat', soort: 'domein',
    write: (w) => unlessWithheld(w, 'totalFloat', () => (w.exactFloat?.has('totalFloat') ? ifcDurationExact(w.task.time.totalFloat)
      : w.ifcDuration(wholeFloatDays(w.task.time.totalFloat)))),
    read: (t, arg, p) => { t.totalFloat = p.parseDur(arg); },
  },
  {
    key: 'isCritical', soort: 'domein',
    write: (w) => unlessWithheld(w, 'isCritical', () => ifcBool(w.task.time.isCritical)),
    read: (t, arg) => { t.isCritical = arg?.includes('T') || false; },
  },
  { key: 'statusTime', soort: 'afgeleid', write: (w) => w.statusTimeArg },
  {
    key: 'actualDuration', soort: 'domein',
    write: (w) => w.actualDurationArg,
    read: (t, arg, p) => { t.actualDuration = p.optDur(arg); },
  },
  {
    key: 'actualStart', soort: 'domein',
    write: (w) => w.actualStartArg,
    read: (t, arg, p) => { t.actualStart = p.optDate(arg); },
  },
  {
    key: 'actualFinish', soort: 'domein',
    write: (w) => w.actualFinishArg,
    read: (t, arg, p) => { t.actualFinish = p.optDate(arg); },
  },
  {
    key: 'remainingTime', soort: 'domein',
    write: (w) => w.remainingArg,
    read: (t, arg, p) => { t.remainingTime = p.optDur(arg); },
  },
  {
    key: 'completion', soort: 'domein',
    write: (w) => ifcCompletionReal(w.task.time.completion ?? 0),
    read: (t, arg) => { t.completion = parseFloat(arg || '0') || 0; },
  },
] as const satisfies readonly TaskTimeSlot[];

export type TaskTimeSlotKey = (typeof TASKTIME_TABLE)[number]['key'];

export const IFC_TASKTIME_SLOTS: readonly TaskTimeSlot<TaskTimeSlotKey>[] = TASKTIME_TABLE;

export function ifcCompletionReal(value: number): string {
  if (!(value > 0) || !Number.isFinite(value)) return '$';
  const fixed = value.toFixed(2);
  if (Number(fixed) === value && !/e/i.test(fixed)) return fixed;
  return stepReal(value)!;
}

export const RECORDED_SLOT_KEYS = [
  'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'freeFloat', 'totalFloat', 'isCritical',
] as const satisfies readonly (keyof TaskTimeComputed)[];

export type RecordedSlotKey = typeof RECORDED_SLOT_KEYS[number];

type _Expect<T extends true> = T;
type _IsNever<T> = [T] extends [never] ? true : false;
const _assertAlleRekenslots: _Expect<_IsNever<Exclude<keyof TaskTimeComputed, RecordedSlotKey>>> = true;
void _assertAlleRekenslots;

export const RECORDED_INPUT_SLOT_KEYS = ['scheduleStart', 'scheduleFinish'] as const satisfies readonly (keyof TaskTimeInput)[];

export type RecordedInputSlotKey = typeof RECORDED_INPUT_SLOT_KEYS[number];

export type RecordedFieldKey = RecordedSlotKey | RecordedInputSlotKey;

export const ALL_RECORDED_SLOT_KEYS: readonly RecordedFieldKey[] = [...RECORDED_SLOT_KEYS, ...RECORDED_INPUT_SLOT_KEYS];

export interface TaskWriteCtx {
  task: Task;
  ownerHistId: number;
  guidArg: string;
  taskTimeId: number;
  customTaskTypeLabel?: string;
}

export const IFC_TASK_STATUS_RUNNING = 'STARTED';

function isRunningAtFullCompletion(task: Task): boolean {
  return !isSummaryTask(task)
    && task.status === 'STARTED' && task.time.completion >= 1 && !task.time.actualFinish;
}

export type TaskSlot<K extends string = string> = WriteSlot<TaskWriteCtx, K>;

const TASK_TABLE = [
  { key: 'globalId', soort: 'domein', write: (w) => w.guidArg },
  { key: 'ownerHistory', ...OWNER_HISTORY_SOORTEN, write: (w) => `#${w.ownerHistId}` },
  { key: 'name', soort: 'domein', write: (w) => ifcStr(w.task.name) === '$' ? "''" : ifcStr(w.task.name) },
  { key: 'description', soort: 'domein', write: (w) => ifcStr(w.task.description) },
  { key: 'objectType', soort: 'afgeleid', volgt: 'predefinedType', write: (w) => w.task.customTaskTypeId || w.task.taskType === 'USERDEFINED' ? ifcStr(w.customTaskTypeLabel || 'USERDEFINED') : '$' },
  { key: 'identification', soort: 'domein', write: (w) => ifcStr(w.task.wbsCode) },
  { key: 'longDescription', soort: 'constant', write: () => '$' },
  { key: 'status', soort: 'domein', write: (w) => (isRunningAtFullCompletion(w.task) ? ifcStr(IFC_TASK_STATUS_RUNNING) : '$') },
  { key: 'workMethod', soort: 'constant', write: () => '$' },
  { key: 'isMilestone', soort: 'domein', write: (w) => ifcBool(w.task.isMilestone) },
  { key: 'priority', soort: 'domein', write: (w) => (w.task.priority !== DEFAULT_PRIORITY ? String(Math.round(w.task.priority)) : '$') },
  { key: 'taskTime', soort: 'verwijzing', write: (w) => `#${w.taskTimeId}` },
  { key: 'predefinedType', soort: 'domein', write: (w) => `.${w.task.customTaskTypeId ? 'USERDEFINED' : w.task.taskType}.` },
] as const satisfies readonly TaskSlot[];

export type TaskSlotKey = (typeof TASK_TABLE)[number]['key'];

export const IFC_TASK_SLOTS: readonly TaskSlot<TaskSlotKey>[] = TASK_TABLE;

export const TASKTIME_SLOT = slotIndex(IFC_TASKTIME_SLOTS);

export const TASK_SLOT = slotIndex(IFC_TASK_SLOTS);

export const LEGACY_TASK_ARITY = 12;

const LEGACY_TASK_SLOT: SlotPositions<TaskSlotKey> = {
  ...TASK_SLOT,
  workMethod: ABSENT_SLOT,
  isMilestone: TASK_SLOT.isMilestone - 1,
  priority: TASK_SLOT.priority - 1,
  taskTime: TASK_SLOT.taskTime - 1,
  predefinedType: TASK_SLOT.predefinedType - 1,
};

export function taskSlots(args: readonly string[]): SlotPositions<TaskSlotKey> {
  return args.length === LEGACY_TASK_ARITY ? LEGACY_TASK_SLOT : TASK_SLOT;
}
