import { IFC_TO_RESOURCE_TYPE } from './ifcConstants';
import {
  IFC_REL_AGGREGATES_SLOTS, IFC_REL_ASSIGNS_TO_CONTROL_SLOTS, IFC_REL_ASSIGNS_TO_PROCESS_SLOTS, IFC_REL_DECLARES_SLOTS,
  IFC_REL_DEFINES_BY_PROPERTIES_SLOTS, IFC_REL_NESTS_SLOTS, relationPositions,
} from './ifcRelationSlots';
import { IFC_RESOURCE_SLOTS, LEGACY_OPS_RESOURCE_ARITY, resourceSlots } from './ifcResourceSlots';
import { IFC_LAG_TIME_SLOTS, IFC_SEQUENCE_SLOTS, SEQUENCE_SLOT, lagTimeSlots } from './ifcSequenceSlots';
import { ABSENT_SLOT, type SlotPositions, type SlotSpec } from './ifcSlotSoort';
import { IFC_TASK_SLOTS, IFC_TASKTIME_SLOTS, LEGACY_TASK_ARITY, TASKTIME_SLOT, taskSlots } from './ifcTaskSlots';
import {
  IFC_BASELINE_SCHEDULE_SLOTS, IFC_CALENDAR_SLOTS, IFC_LIVE_SCHEDULE_SLOTS, IFC_WORK_PLAN_SLOTS, LEGACY_OPS_WORK_CALENDAR_ARITY,
  LEGACY_OPS_WORK_CONTROL_ARITY, isBaselineWorkControl, workCalendarSlots, workControlSlots,
} from './ifcWorkControlSlots';

export interface IfcSlotTable {
  readonly naam: string;
  readonly entities: readonly string[];
  readonly slots: readonly SlotSpec[];
  positions(args: readonly string[]): SlotPositions<string>;
  readonly appliesTo?: (args: readonly string[]) => boolean;
  readonly legacyArity?: number;
  readonly domainOf?: (entity: string) => string | undefined;
}

export const IFC_SLOT_TABLES: readonly IfcSlotTable[] = [
  { naam: 'IfcTask', entities: ['IFCTASK'], slots: IFC_TASK_SLOTS, positions: taskSlots, legacyArity: LEGACY_TASK_ARITY },
  { naam: 'IfcTaskTime', entities: ['IFCTASKTIME'], slots: IFC_TASKTIME_SLOTS, positions: () => TASKTIME_SLOT },
  {
    naam: 'IfcWorkPlan', entities: ['IFCWORKPLAN'], slots: IFC_WORK_PLAN_SLOTS, positions: workControlSlots,
    legacyArity: LEGACY_OPS_WORK_CONTROL_ARITY,
  },
  {
    naam: 'IfcWorkSchedule (live)', entities: ['IFCWORKSCHEDULE'], slots: IFC_LIVE_SCHEDULE_SLOTS, positions: workControlSlots,
    appliesTo: args => !isBaselineWorkControl(args), legacyArity: LEGACY_OPS_WORK_CONTROL_ARITY,
  },
  {
    naam: 'IfcWorkSchedule (baseline)', entities: ['IFCWORKSCHEDULE'], slots: IFC_BASELINE_SCHEDULE_SLOTS,
    positions: workControlSlots, appliesTo: isBaselineWorkControl, legacyArity: LEGACY_OPS_WORK_CONTROL_ARITY,
  },
  {
    naam: 'IfcWorkCalendar', entities: ['IFCWORKCALENDAR'], slots: IFC_CALENDAR_SLOTS, positions: workCalendarSlots,
    legacyArity: LEGACY_OPS_WORK_CALENDAR_ARITY,
  },
  {
    naam: 'resources', entities: Object.keys(IFC_TO_RESOURCE_TYPE), slots: IFC_RESOURCE_SLOTS, positions: resourceSlots,
    legacyArity: LEGACY_OPS_RESOURCE_ARITY, domainOf: entity => IFC_TO_RESOURCE_TYPE[entity],
  },
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

const TABLES_BY_NAME: ReadonlyMap<string, IfcSlotTable> = new Map(IFC_SLOT_TABLES.map(table => [table.naam, table]));

export function slotTableNamed(naam: string): IfcSlotTable | undefined {
  return TABLES_BY_NAME.get(naam);
}

export function slotTablesHaveOwnerHistory(entity: string): boolean {
  return TABLES_BY_ENTITY.get(entity)?.every(table => table.slots.some(slot => slot.key === 'ownerHistory')) ?? false;
}

export function slotTableOf(entity: string, args: readonly string[]): IfcSlotTable | undefined {
  return TABLES_BY_ENTITY.get(entity)?.find(table => table.appliesTo?.(args) ?? true);
}

const inSchemaPlaces = (table: IfcSlotTable, positions: SlotPositions<string>) =>
  table.slots.every((slot, index) => positions[slot.key] === index);

export function knownLayout(table: IfcSlotTable, args: readonly string[]): boolean {
  return args.length === table.slots.length || args.length === table.legacyArity;
}

export function schemaArgsOf(table: IfcSlotTable, args: readonly string[]): number[] {
  const positions = table.positions(args);
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

export function sameDomainEntity(table: IfcSlotTable, a: string, b: string): boolean {
  return a === b || (table.domainOf !== undefined && table.domainOf(a) !== undefined && table.domainOf(a) === table.domainOf(b));
}

export interface RelationRoles {
  readonly relating: number;
  readonly related: number;
  readonly members: boolean;
}

const ROLES_BY_ENTITY: ReadonlyMap<string, RelationRoles> = (() => {
  const roles = new Map<string, RelationRoles>();
  for (const table of IFC_SLOT_TABLES) {
    const relating = table.slots.findIndex(slot => slot.rol === 'relating');
    const related = table.slots.findIndex(slot => slot.rol === 'lid' || slot.rol === 'leden');
    if (relating < 0 || related < 0) continue;
    for (const entity of table.entities) roles.set(entity, { relating, related, members: table.slots[related].rol === 'leden' });
  }
  return roles;
})();

export function relationRoles(entity: string): RelationRoles | undefined {
  return ROLES_BY_ENTITY.get(entity);
}
