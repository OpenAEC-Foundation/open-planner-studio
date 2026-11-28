import type { LevelingPriorityKey, LevelingSettings, LevelingResourceSetting } from '@/types/project';

export type LevelingQuantity =
  | 'earlyStart' | 'earlyFinish' | 'lateStart' | 'lateFinish' | 'totalFloat' | 'freeFloat'
  | 'activityPriority' | 'activityId' | 'originalDuration' | 'remainingDuration';

export const LEVELING_QUANTITIES: readonly LevelingQuantity[] = [
  'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'totalFloat', 'freeFloat',
  'activityPriority', 'activityId', 'originalDuration', 'remainingDuration',
];

const P6_PRIORITY_FIELD_QUANTITY: ReadonlyMap<string, LevelingQuantity> = new Map<string, LevelingQuantity>([
  ['early_start_date', 'earlyStart'],
  ['early_end_date', 'earlyFinish'],
  ['late_start_date', 'lateStart'],
  ['late_end_date', 'lateFinish'],
  ['total_float_hr_cnt', 'totalFloat'],
  ['free_float_hr_cnt', 'freeFloat'],
  ['priority_type', 'activityPriority'],
  ['task_code', 'activityId'],
  ['target_drtn_hr_cnt', 'originalDuration'],
  ['remain_drtn_hr_cnt', 'remainingDuration'],
]);

export function levelingPriorityQuantity(field: string): LevelingQuantity | undefined {
  return P6_PRIORITY_FIELD_QUANTITY.get(field);
}

export function resolveLevelingPriority(priority: readonly LevelingPriorityKey[] | undefined): {
  keys: Array<{ quantity: LevelingQuantity; direction: LevelingPriorityKey['direction'] }>;
  unmapped: string[];
} {
  const keys: Array<{ quantity: LevelingQuantity; direction: LevelingPriorityKey['direction'] }> = [];
  const unmapped: string[] = [];
  for (const key of priority ?? []) {
    const quantity = levelingPriorityQuantity(key.field);
    if (quantity) keys.push({ quantity, direction: key.direction });
    else unmapped.push(key.field);
  }
  return { keys, unmapped };
}

export function resolveLevelingResources(
  leveling: Pick<LevelingSettings, 'resources'> | undefined, existingResourceIds: ReadonlySet<string>,
): { resources: LevelingResourceSetting[]; dangling: string[] } {
  const resources: LevelingResourceSetting[] = [];
  const dangling: string[] = [];
  for (const entry of leveling?.resources ?? []) {
    if (existingResourceIds.has(entry.resourceId)) resources.push(entry);
    else dangling.push(entry.resourceId);
  }
  return { resources, dangling };
}

export function isP6DialogDefaultLeveling(leveling: LevelingSettings): boolean {
  return leveling.preserveScheduledDates === true && leveling.levelAllResources === true
    && leveling.priority?.length === 1 && leveling.priority[0]!.field === 'priority_type'
    && leveling.priority[0]!.direction === 'ASC'
    && (leveling.resources === undefined || leveling.resources.length === 0);
}
