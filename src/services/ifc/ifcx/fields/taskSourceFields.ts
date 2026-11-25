import type { MspTaskType, P6ActivityType, P6CompletePctType, P6DurationType, Task } from '@/types/task';
import { BOOLEAN, TEXT, type IfcxField } from '../fieldTable';
import { enumOfTable } from './passthroughFields';
import { taskField } from './taskScheduleFields';
import type { TaskReadTarget, TaskWriteSource } from './taskFields';

type TaskField = IfcxField<TaskWriteSource, TaskReadTarget>;

const MSP_TASK_TYPES = { FIXED_UNITS: true, FIXED_DURATION: true, FIXED_WORK: true } satisfies Record<MspTaskType, true>;
const P6_DURATION_TYPES = { DT_FixedDrtn: true, DT_FixedDUR2: true, DT_FixedRate: true, DT_FixedQty: true } satisfies Record<P6DurationType, true>;
const P6_ACTIVITY_TYPES = {
  TT_Task: true, TT_Rsrc: true, TT_LOE: true, TT_Mile: true, TT_FinMile: true, TT_WBS: true,
} satisfies Record<P6ActivityType, true>;
const P6_COMPLETE_PCT_TYPES = { CP_Drtn: true, CP_Phys: true, CP_Units: true } satisfies Record<P6CompletePctType, true>;

export const TASK_SOURCE_FIELDS: readonly TaskField[] = [
  taskField('mspTaskType', enumOfTable(MSP_TASK_TYPES)),
  taskField('effortDriven', BOOLEAN),
  taskField('p6DurationType', enumOfTable(P6_DURATION_TYPES)),
  taskField('p6ActivityType', enumOfTable(P6_ACTIVITY_TYPES)),
  taskField('p6ProjectId', TEXT),
  taskField('p6TaskId', TEXT),
  taskField('p6ExplicitTargetWindow', BOOLEAN),
  taskField('p6CompletePctType', enumOfTable(P6_COMPLETE_PCT_TYPES)),
  taskField('p6ExpectedFinish', TEXT),
  taskField('p6SuspendResume', BOOLEAN),
];

export const TASK_SOURCE_KEYS_CARRIED = TASK_SOURCE_FIELDS.map(field => field.key as keyof Task);
