/**
 * Harde voorwaarden voor de nivelleermotor. Puur, format-neutraal (geen import uit een lezer), nog
 * door niets in de motor gelezen:
 *
 * 1. `resolveLevelingResources` — de resourcelijst van `SchedulingOptions.leveling` kan ids dragen zonder
 *    resource (verwijderd na import, of een IFC-id die niet terug te mappen was). De motor leest de lijst
 *    UITSLUITEND via deze functie: hangende ids vallen eruit en worden teruggegeven om te melden, nooit stil.
 * 2. `levelingPriorityQuantity` — een prioriteitssleutel noemt LETTERLIJK een P6-kolom (`early_start_date`,
 *    `total_float_hr_cnt`, …). Een deel daarvan is opgeslagen P6-rekenuitvoer (bak 4) of verboden
 *    bronuitvoer (bak 2). De motor mag zo'n naam nooit als "lees deze bronwaarde" opvatten: de gesloten
 *    tabel hieronder vertaalt de naam naar een EIGEN berekende of invoergrootheid van OPS. Een naam die
 *    niet in de tabel staat heeft geen betekenis (⇒ melden, sleutel overslaan) — er is geen terugval naar
 *    de bronkolom. `tests/planning/check-leveling-input.ts` voert elke bak-2/4-kolomnaam als sleutel.
 */
import type { LevelingPriorityKey, LevelingSettings, LevelingResourceSetting } from '@/types/project';

/** Wat een prioriteitssleutel in OPS betekent: altijd een grootheid uit de EIGEN solve of de taakinvoer. */
export type LevelingQuantity =
  | 'earlyStart' | 'earlyFinish' | 'lateStart' | 'lateFinish' | 'totalFloat' | 'freeFloat' // eigen CPM-uitkomst
  | 'activityPriority' | 'activityId' | 'originalDuration' | 'remainingDuration';          // taakinvoer

export const LEVELING_QUANTITIES: readonly LevelingQuantity[] = [
  'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'totalFloat', 'freeFloat',
  'activityPriority', 'activityId', 'originalDuration', 'remainingDuration',
];

/** Gesloten: P6-kolomnaam ⇒ eigen grootheid. De zes bak-4-namen wijzen naar de EIGEN berekende waarde,
 *  nooit naar de opgeslagen P6-uitvoer. Uitbreiden = een bewuste regel hier plus een case in de check. */
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

/** De eigen grootheid achter een P6-kolomnaam, of `undefined` (geen betekenis ⇒ melden, overslaan). */
export function levelingPriorityQuantity(field: string): LevelingQuantity | undefined {
  return P6_PRIORITY_FIELD_QUANTITY.get(field);
}

/** De prioriteitslijst als eigen grootheden, in bronvolgorde; onbekende sleutels apart om te melden. */
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

/** De resourcelijst zonder hangende ids; de hangende ids komen terug om te melden (nooit stil). */
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

/**
 * Draagt het blok precies de P6-dialoogdefaults ("Level Resources": keep scheduled dates aan, level all
 * resources aan, prioriteit Activity Priority ↑, geen resourcelijst)? Zo'n blok zegt niets wat een
 * ontvanger zonder blok niet al zou aannemen; een export die het weglaat verliest dan niets en hoeft het
 * niet te melden (de MSPDI-exportmelding blijft zo signaal, geen ruis). Een afwezige vlag telt als niet
 * default: onbekend is geen default.
 */
export function isP6DialogDefaultLeveling(leveling: LevelingSettings): boolean {
  return leveling.preserveScheduledDates === true && leveling.levelAllResources === true
    && leveling.priority?.length === 1 && leveling.priority[0]!.field === 'priority_type'
    && leveling.priority[0]!.direction === 'ASC'
    && (leveling.resources === undefined || leveling.resources.length === 0);
}
