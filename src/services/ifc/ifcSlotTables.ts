import { IFC_TO_RESOURCE_TYPE } from './ifcConstants';
import {
  IFC_REL_AGGREGATES_SLOTS, IFC_REL_ASSIGNS_TO_CONTROL_SLOTS, IFC_REL_ASSIGNS_TO_PROCESS_SLOTS, IFC_REL_DECLARES_SLOTS,
  IFC_REL_DEFINES_BY_PROPERTIES_SLOTS, IFC_REL_NESTS_SLOTS, relationPositions,
} from './ifcRelationSlots';
import { IFC_RESOURCE_SLOTS, resourceSlots } from './ifcResourceSlots';
import { IFC_LAG_TIME_SLOTS, IFC_SEQUENCE_SLOTS, SEQUENCE_SLOT, lagTimeSlots } from './ifcSequenceSlots';
import { ABSENT_SLOT, type SlotPositions, type SlotSpec } from './ifcSlotSoort';
import { IFC_TASK_SLOTS, IFC_TASKTIME_SLOTS, TASKTIME_SLOT, taskSlots } from './ifcTaskSlots';
import {
  IFC_BASELINE_SCHEDULE_SLOTS, IFC_CALENDAR_SLOTS, IFC_LIVE_SCHEDULE_SLOTS, IFC_WORK_PLAN_SLOTS,
  isBaselineWorkControl, workCalendarSlots, workControlSlots,
} from './ifcWorkControlSlots';

export interface IfcSlotTable {
  readonly naam: string;
  readonly entities: readonly string[];
  readonly slots: readonly SlotSpec[];
  positions(args: readonly string[]): SlotPositions<string>;
  readonly appliesTo?: (args: readonly string[]) => boolean;
}

export const IFC_SLOT_TABLES: readonly IfcSlotTable[] = [
  { naam: 'IfcTask', entities: ['IFCTASK'], slots: IFC_TASK_SLOTS, positions: taskSlots },
  { naam: 'IfcTaskTime', entities: ['IFCTASKTIME'], slots: IFC_TASKTIME_SLOTS, positions: () => TASKTIME_SLOT },
  { naam: 'IfcWorkPlan', entities: ['IFCWORKPLAN'], slots: IFC_WORK_PLAN_SLOTS, positions: workControlSlots },
  {
    naam: 'IfcWorkSchedule (live)', entities: ['IFCWORKSCHEDULE'], slots: IFC_LIVE_SCHEDULE_SLOTS, positions: workControlSlots,
    appliesTo: args => !isBaselineWorkControl(args),
  },
  {
    naam: 'IfcWorkSchedule (baseline)', entities: ['IFCWORKSCHEDULE'], slots: IFC_BASELINE_SCHEDULE_SLOTS,
    positions: workControlSlots, appliesTo: isBaselineWorkControl,
  },
  { naam: 'IfcWorkCalendar', entities: ['IFCWORKCALENDAR'], slots: IFC_CALENDAR_SLOTS, positions: workCalendarSlots },
  { naam: 'resources', entities: Object.keys(IFC_TO_RESOURCE_TYPE), slots: IFC_RESOURCE_SLOTS, positions: resourceSlots },
  { naam: 'IfcRelSequence', entities: ['IFCRELSEQUENCE'], slots: IFC_SEQUENCE_SLOTS, positions: () => SEQUENCE_SLOT },
  { naam: 'IfcLagTime', entities: ['IFCLAGTIME'], slots: IFC_LAG_TIME_SLOTS, positions: lagTimeSlots },
  { naam: 'IfcRelNests', entities: ['IFCRELNESTS'], slots: IFC_REL_NESTS_SLOTS, positions: relationPositions(IFC_REL_NESTS_SLOTS) },
  {
    naam: 'IfcRelAggregates', entities: ['IFCRELAGGREGATES'], slots: IFC_REL_AGGREGATES_SLOTS,
    positions: relationPositions(IFC_REL_AGGREGATES_SLOTS),
  },
  {
    naam: 'IfcRelAssignsToControl', entities: ['IFCRELASSIGNSTOCONTROL'], slots: IFC_REL_ASSIGNS_TO_CONTROL_SLOTS,
    positions: relationPositions(IFC_REL_ASSIGNS_TO_CONTROL_SLOTS),
  },
  {
    naam: 'IfcRelAssignsToProcess', entities: ['IFCRELASSIGNSTOPROCESS'], slots: IFC_REL_ASSIGNS_TO_PROCESS_SLOTS,
    positions: relationPositions(IFC_REL_ASSIGNS_TO_PROCESS_SLOTS),
  },
  {
    naam: 'IfcRelDeclares', entities: ['IFCRELDECLARES'], slots: IFC_REL_DECLARES_SLOTS,
    positions: relationPositions(IFC_REL_DECLARES_SLOTS),
  },
  {
    naam: 'IfcRelDefinesByProperties', entities: ['IFCRELDEFINESBYPROPERTIES'], slots: IFC_REL_DEFINES_BY_PROPERTIES_SLOTS,
    positions: relationPositions(IFC_REL_DEFINES_BY_PROPERTIES_SLOTS),
  },
];

const TABLES_BY_ENTITY: ReadonlyMap<string, readonly IfcSlotTable[]> = (() => {
  const byEntity = new Map<string, IfcSlotTable[]>();
  for (const table of IFC_SLOT_TABLES) {
    for (const entity of table.entities) {
      const tables = byEntity.get(entity);
      if (tables) tables.push(table); else byEntity.set(entity, [table]);
    }
  }
  return byEntity;
})();

export function slotTablesHaveOwnerHistory(entity: string): boolean {
  return TABLES_BY_ENTITY.get(entity)?.every(table => table.slots.some(slot => slot.key === 'ownerHistory')) ?? false;
}

export function slotTableOf(entity: string, args: readonly string[]): IfcSlotTable | undefined {
  return TABLES_BY_ENTITY.get(entity)?.find(table => table.appliesTo?.(args) ?? true);
}

const inSchemaPlaces = (table: IfcSlotTable, positions: SlotPositions<string>) =>
  table.slots.every((slot, index) => positions[slot.key] === index);

export function schemaArgsOf(table: IfcSlotTable, args: readonly string[]): number[] | undefined {
  const positions = table.positions(args);
  const schemaPlaces = inSchemaPlaces(table, positions);
  if (schemaPlaces && args.length !== table.slots.length) return undefined;
  const schemaArg = args.map(() => ABSENT_SLOT);
  table.slots.forEach((slot, index) => {
    const at = positions[slot.key];
    if (at !== ABSENT_SLOT && at < args.length) schemaArg[at] = index;
  });
  return schemaArg;
}

export function inSchemaLayout(table: IfcSlotTable, args: readonly string[]): boolean {
  return args.length === table.slots.length && inSchemaPlaces(table, table.positions(args));
}
