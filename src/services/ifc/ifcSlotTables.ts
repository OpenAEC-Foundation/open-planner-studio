import { IFC_TO_RESOURCE_TYPE } from './ifcConstants';
import { IFC_RESOURCE_SLOTS, resourceSlots } from './ifcResourceSlots';
import { IFC_LAG_TIME_SLOTS, IFC_SEQUENCE_SLOTS, SEQUENCE_SLOT, lagTimeSlots } from './ifcSequenceSlots';
import type { SlotPositions, SlotSpec } from './ifcSlotSoort';
import { IFC_TASK_SLOTS, IFC_TASKTIME_SLOTS, TASKTIME_SLOT, taskSlots } from './ifcTaskSlots';
import {
  IFC_BASELINE_SCHEDULE_SLOTS, IFC_CALENDAR_SLOTS, IFC_LIVE_SCHEDULE_SLOTS, IFC_WORK_PLAN_SLOTS,
  workCalendarSlots, workControlSlots,
} from './ifcWorkControlSlots';

export interface IfcSlotTable {
  readonly naam: string;
  readonly entities: readonly string[];
  readonly slots: readonly SlotSpec[];
  positions(args: readonly string[]): SlotPositions<string>;
}

export const IFC_SLOT_TABLES: readonly IfcSlotTable[] = [
  { naam: 'IfcTask', entities: ['IFCTASK'], slots: IFC_TASK_SLOTS, positions: taskSlots },
  { naam: 'IfcTaskTime', entities: ['IFCTASKTIME'], slots: IFC_TASKTIME_SLOTS, positions: () => TASKTIME_SLOT },
  { naam: 'IfcWorkPlan', entities: ['IFCWORKPLAN'], slots: IFC_WORK_PLAN_SLOTS, positions: workControlSlots },
  { naam: 'IfcWorkSchedule (live)', entities: ['IFCWORKSCHEDULE'], slots: IFC_LIVE_SCHEDULE_SLOTS, positions: workControlSlots },
  {
    naam: 'IfcWorkSchedule (baseline)', entities: ['IFCWORKSCHEDULE'], slots: IFC_BASELINE_SCHEDULE_SLOTS,
    positions: workControlSlots,
  },
  { naam: 'IfcWorkCalendar', entities: ['IFCWORKCALENDAR'], slots: IFC_CALENDAR_SLOTS, positions: workCalendarSlots },
  { naam: 'resources', entities: Object.keys(IFC_TO_RESOURCE_TYPE), slots: IFC_RESOURCE_SLOTS, positions: resourceSlots },
  { naam: 'IfcRelSequence', entities: ['IFCRELSEQUENCE'], slots: IFC_SEQUENCE_SLOTS, positions: () => SEQUENCE_SLOT },
  { naam: 'IfcLagTime', entities: ['IFCLAGTIME'], slots: IFC_LAG_TIME_SLOTS, positions: lagTimeSlots },
];
