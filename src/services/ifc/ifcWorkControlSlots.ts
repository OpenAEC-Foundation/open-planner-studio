/**
 * Posities van de slots die de lezer gebruikt in `IfcWorkPlan`/`IfcWorkSchedule` (beide
 * `IfcWorkControl`) en `IfcWorkCalendar`, per lay-out (issue #292).
 *
 * Het schema (IFC4, IFC4X3 en IFC4X3_ADD2 zijn hier gelijk):
 *   - IfcWorkPlan/IfcWorkSchedule, 14 attributen: GlobalId, OwnerHistory, Name, Description, ObjectType,
 *     Identification, CreationDate, Creators, Purpose, Duration, TotalFloat, StartTime (11),
 *     FinishTime (12), PredefinedType (13).
 *   - IfcWorkCalendar, 9 attributen: GlobalId, OwnerHistory, Name, Description, ObjectType,
 *     Identification, WorkingTimes (6), ExceptionTimes (7), PredefinedType (8).
 *
 * Oudere OPS-versies schreven beide verkeerd: het werkplan en de werkschema's met 15 argumenten (één `$`
 * te veel vóór StartTime, dus StartTime op 12, FinishTime op 13 en PredefinedType op 14) en de
 * kalender met 8 (Identification ontbrak, dus WorkingTimes op 5, ExceptionTimes op 6 en
 * PredefinedType op 7). De lezer kiest de lay-out op de ARGUMENTEN van de entiteit zelf, niet op de
 * appversie: zo leest hij die oude bestanden zoals altijd, en een schemaconform bestand (de huidige
 * writer, of een ander pakket) op de juiste plek.
 *
 * Eén geval heeft het schema-aantal maar de oude indeling: IfcOpenShell (MergeProjects, 0.9.0) leest
 * een oud bestand met het schema en schrijft het schema-aantal, maar laat de waarden op hun oude plek.
 * De kalender krijgt dan 9 argumenten met de werkweek (een lijst) op Identification (5); het werkplan
 * en de werkschema's krijgen 14 argumenten met de einddatum (tekst) op PredefinedType (13). Beide zijn
 * nooit schemageldig: Identification is een `IfcIdentifier` (tekst), PredefinedType een enumeratie
 * (`.X.`) of `$`. Daaraan herkent de lezer de oude indeling. Het oude PredefinedType zelf is dan al weg
 * (IfcOpenShell laat het vallen); die slot is leeg, zoals in een bestand zonder type.
 *
 * IFC2X3 telt voor IfcWorkPlan/IfcWorkSchedule ook 15 argumenten, maar met een andere inhoud:
 * StartTime (11) en FinishTime (12) zijn daar verwijzingen (IfcDateTimeSelect), WorkControlType (13) is
 * de enumeratie en UserDefinedControlType (14) een tekst of `$`. De lezer herkent die vorm aan de
 * enumeratie op 13 zonder enumeratie op 14. Een verwijzing is geen datum; dat bewaakt de lezer zelf
 * (alleen een stringliteral telt als tijd).
 */

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

/** Het argumentaantal van IfcWorkPlan/IfcWorkSchedule volgens het schema. */
export const WORK_CONTROL_ARITY = IFC_WORK_PLAN_SLOTS.length;
/** Het argumentaantal dat oudere OPS-versies voor IfcWorkPlan/IfcWorkSchedule schreven. */
export const LEGACY_OPS_WORK_CONTROL_ARITY = 15;
/** Het argumentaantal van IfcWorkCalendar volgens het schema. */
export const WORK_CALENDAR_ARITY = IFC_CALENDAR_SLOTS.length;
/** Het argumentaantal dat oudere OPS-versies voor IfcWorkCalendar schreven. */
export const LEGACY_OPS_WORK_CALENDAR_ARITY = 8;

export type WorkControlSlots = SlotPositions<WorkControlSlotKey>;

export type WorkCalendarSlots = SlotPositions<CalendarSlotKey>;

/** De slots van het schema. IFC2X3 heeft dezelfde posities (StartTime 11, FinishTime 12, de
 *  enumeratie WorkControlType op 13); alleen het argumentaantal (15) en de inhoud verschillen. */
export const WORK_CONTROL_SLOT: WorkControlSlots = slotIndex(IFC_WORK_PLAN_SLOTS);
const WORK_CONTROL_LEGACY_OPS: WorkControlSlots = { ...WORK_CONTROL_SLOT, startTime: 12, finishTime: 13, predefinedType: 14 };
/** Een STEP-enumeratie als `.BASELINE.`. */
const isStepEnum = (arg: string | undefined): boolean => /^\.[A-Z0-9_]+\.$/i.test((arg ?? '').trim());
export const CALENDAR_SLOT: WorkCalendarSlots = slotIndex(IFC_CALENDAR_SLOTS);
const WORK_CALENDAR_LEGACY_OPS: WorkCalendarSlots = {
  ...CALENDAR_SLOT, identification: ABSENT_SLOT, workingTimes: 5, exceptionTimes: 6, predefinedType: 7,
};

/** Slotposities van een IfcWorkPlan/IfcWorkSchedule met deze argumenten. Oude OPS-lay-out bij 15 of
 *  meer argumenten (zo las de lezer elk bestand vóór #292), en bij 14 argumenten met tekst op
 *  PredefinedType (13): een oud bestand na MergeProjects. IFC2X3 bij 15 argumenten met de enumeratie op
 *  13 en niet op 14. Anders het schema. */
export function workControlSlots(args: readonly string[]): WorkControlSlots {
  if (args.length === LEGACY_OPS_WORK_CONTROL_ARITY && isStepEnum(args[WORK_CONTROL_SLOT.predefinedType])
    && !isStepEnum(args[WORK_CONTROL_LEGACY_OPS.predefinedType])) {
    return WORK_CONTROL_SLOT; // IFC2X3: zelfde posities als het schema
  }
  if (args.length >= LEGACY_OPS_WORK_CONTROL_ARITY) return WORK_CONTROL_LEGACY_OPS;
  if (args.length === WORK_CONTROL_ARITY && (args[WORK_CONTROL_SLOT.predefinedType] ?? '').trim().startsWith("'")) {
    return WORK_CONTROL_LEGACY_OPS;
  }
  return WORK_CONTROL_SLOT;
}

/** Slotposities van een IfcWorkCalendar met deze argumenten. Oude OPS-lay-out bij 8 of minder
 *  argumenten (zo las de lezer elk bestand vóór #292), en bij 9 argumenten met een lijst op
 *  Identification (5): een oud bestand na MergeProjects. Anders het schema. */
export function workCalendarSlots(args: readonly string[]): WorkCalendarSlots {
  if (args.length <= LEGACY_OPS_WORK_CALENDAR_ARITY) return WORK_CALENDAR_LEGACY_OPS;
  if (args.length === WORK_CALENDAR_ARITY && (args[CALENDAR_SLOT.identification] ?? '').trim().startsWith('(')) {
    return WORK_CALENDAR_LEGACY_OPS;
  }
  return CALENDAR_SLOT;
}
