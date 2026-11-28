import type { WorkCalendar } from '@/types/calendar';
import { ifcStr } from './ifcPsets';
import {
  ABSENT_SLOT, OWNER_HISTORY_SOORTEN, slotIndex, type SlotPositions, type SlotSoorten, type WriteSlot,
} from './ifcSlotSoort';

export interface WorkControlWriteCtx {
  guid: string;
  ownerHistId: number;
  name: string;
  description: string;
  creationDateArg: string;
  startTimeArg: string;
  finishTimeArg: string;
  predefinedType: 'PLANNED' | 'BASELINE';
}

type WorkControlRolSoorten = Readonly<Record<'globalId' | 'name' | 'description', SlotSoorten>>;

function workControlTable(rol: WorkControlRolSoorten) {
  return [
    { key: 'globalId', ...rol.globalId, write: (w) => ifcStr(w.guid) },
    { key: 'ownerHistory', ...OWNER_HISTORY_SOORTEN, write: (w) => `#${w.ownerHistId}` },
    { key: 'name', ...rol.name, write: (w) => ifcStr(w.name) },
    { key: 'description', ...rol.description, write: (w) => ifcStr(w.description) },
    { key: 'objectType', soort: 'constant', write: () => '$' },
    { key: 'identification', soort: 'constant', write: () => '$' },
    { key: 'creationDate', soort: 'afgeleid', write: (w) => w.creationDateArg },
    { key: 'creators', soort: 'constant', bronverwijzing: true, write: () => '$' },
    { key: 'purpose', soort: 'constant', write: () => '$' },
    { key: 'duration', soort: 'constant', write: () => '$' },
    { key: 'totalFloat', soort: 'constant', write: () => '$' },
    { key: 'startTime', soort: 'afgeleid', write: (w) => w.startTimeArg },
    { key: 'finishTime', soort: 'afgeleid', write: (w) => w.finishTimeArg },
    { key: 'predefinedType', soort: 'constant', write: (w) => `.${w.predefinedType}.` },
  ] as const satisfies readonly WriteSlot<WorkControlWriteCtx>[];
}

export type WorkControlSlotKey = ReturnType<typeof workControlTable>[number]['key'];

type WorkControlSlot = WriteSlot<WorkControlWriteCtx, WorkControlSlotKey>;

export const IFC_WORK_PLAN_SLOTS: readonly WorkControlSlot[] = workControlTable({
  globalId: { soort: 'domein' },
  name: { soort: 'afgeleid', soortVreemd: 'constant' },
  description: { soort: 'domein' },
});

export const IFC_LIVE_SCHEDULE_SLOTS: readonly WorkControlSlot[] = workControlTable({
  globalId: { soort: 'domein' },
  name: { soort: 'constant' },
  description: { soort: 'constant' },
});

export const IFC_BASELINE_SCHEDULE_SLOTS: readonly WorkControlSlot[] = workControlTable({
  globalId: { soort: 'afgeleid' },
  name: { soort: 'afgeleid' },
  description: { soort: 'constant' },
});

export interface CalendarWriteCtx {
  calendar: WorkCalendar;
  ownerHistId: number;
  guidArg: string;
  workingTimesArg: string;
  exceptionTimesArg: string;
}

function shiftToPredefinedType(shift: WorkCalendar['shift']): string {
  switch (shift) {
    case 'SECOND': return '.SECONDSHIFT.';
    case 'THIRD': return '.THIRDSHIFT.';
    case 'USERDEFINED': return '.USERDEFINED.';
    default: return '.FIRSTSHIFT.';
  }
}

const CALENDAR_TABLE = [
  { key: 'globalId', soort: 'domein', write: (w) => w.guidArg },
  { key: 'ownerHistory', ...OWNER_HISTORY_SOORTEN, write: (w) => `#${w.ownerHistId}` },
  { key: 'name', soort: 'domein', write: (w) => ifcStr(w.calendar.name) },
  { key: 'description', soort: 'domein', write: (w) => ifcStr(w.calendar.description) },
  {
    key: 'objectType', soort: 'afgeleid', volgt: 'predefinedType',
    write: (w) => (w.calendar.shift === 'USERDEFINED' ? ifcStr('USERDEFINED') : '$'),
  },
  { key: 'identification', soort: 'constant', write: () => '$' },
  { key: 'workingTimes', soort: 'verwijzing', write: (w) => w.workingTimesArg },
  { key: 'exceptionTimes', soort: 'verwijzing', write: (w) => w.exceptionTimesArg },
  { key: 'predefinedType', soort: 'domein', write: (w) => shiftToPredefinedType(w.calendar.shift) },
] as const satisfies readonly WriteSlot<CalendarWriteCtx>[];

export type CalendarSlotKey = (typeof CALENDAR_TABLE)[number]['key'];

export const IFC_CALENDAR_SLOTS: readonly WriteSlot<CalendarWriteCtx, CalendarSlotKey>[] = CALENDAR_TABLE;

export const WORK_CONTROL_ARITY = IFC_WORK_PLAN_SLOTS.length;
export const LEGACY_OPS_WORK_CONTROL_ARITY = 15;
export const WORK_CALENDAR_ARITY = IFC_CALENDAR_SLOTS.length;
export const LEGACY_OPS_WORK_CALENDAR_ARITY = 8;

export type WorkControlSlots = SlotPositions<WorkControlSlotKey>;

export type WorkCalendarSlots = SlotPositions<CalendarSlotKey>;

export const WORK_CONTROL_SLOT: WorkControlSlots = slotIndex(IFC_WORK_PLAN_SLOTS);
const WORK_CONTROL_LEGACY_OPS: WorkControlSlots = { ...WORK_CONTROL_SLOT, startTime: 12, finishTime: 13, predefinedType: 14 };
const WORK_CONTROL_AFTER_MERGE_PROJECTS: WorkControlSlots = { ...WORK_CONTROL_LEGACY_OPS, predefinedType: ABSENT_SLOT };
const isStepEnum = (arg: string | undefined): boolean => /^\.[A-Z0-9_]+\.$/i.test((arg ?? '').trim());
export const CALENDAR_SLOT: WorkCalendarSlots = slotIndex(IFC_CALENDAR_SLOTS);
const WORK_CALENDAR_LEGACY_OPS: WorkCalendarSlots = {
  ...CALENDAR_SLOT, identification: ABSENT_SLOT, workingTimes: 5, exceptionTimes: 6, predefinedType: 7,
};

export function workControlSlots(args: readonly string[]): WorkControlSlots {
  if (args.length === LEGACY_OPS_WORK_CONTROL_ARITY && isStepEnum(args[WORK_CONTROL_SLOT.predefinedType])
    && !isStepEnum(args[WORK_CONTROL_LEGACY_OPS.predefinedType])) {
    return WORK_CONTROL_SLOT;
  }
  if (args.length >= LEGACY_OPS_WORK_CONTROL_ARITY) return WORK_CONTROL_LEGACY_OPS;
  if (args.length === WORK_CONTROL_ARITY && (args[WORK_CONTROL_SLOT.predefinedType] ?? '').trim().startsWith("'")) {
    return WORK_CONTROL_AFTER_MERGE_PROJECTS;
  }
  return WORK_CONTROL_SLOT;
}

export function isBaselineWorkControl(args: readonly string[]): boolean {
  return (args[workControlSlots(args).predefinedType] || '').includes('BASELINE');
}

export function workCalendarSlots(args: readonly string[]): WorkCalendarSlots {
  if (args.length <= LEGACY_OPS_WORK_CALENDAR_ARITY) return WORK_CALENDAR_LEGACY_OPS;
  if (args.length === WORK_CALENDAR_ARITY && (args[CALENDAR_SLOT.identification] ?? '').trim().startsWith('(')) {
    return WORK_CALENDAR_LEGACY_OPS;
  }
  return CALENDAR_SLOT;
}
