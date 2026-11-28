// Bron: MPXJ, © Jon Iles e.a., structuurkennis en veldconstanten geport naar TypeScript (LGPL-2.1, github.com/joniles/mpxj).

export const MAX_VAR_TEXT_BYTES = 65_536;

export const MAX_EXCEPTION_BAND_PERIODS = 5;

export const MAX_REMAINING_DURATION_TENTHS = 525_960_000;

export function clampRemainingDurationTenths(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(raw, 0), MAX_REMAINING_DURATION_TENTHS);
}

export const MAX_MANUAL_DURATION_TENTHS = 525_960_000;

export function clampManualDurationTenths(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(raw, 0), MAX_MANUAL_DURATION_TENTHS);
}

export const MAX_LEVELING_DELAY_TENTHS = 525_960_000;

export function clampLevelingDelayTenths(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(raw, 0), MAX_LEVELING_DELAY_TENTHS);
}

export const MAX_TIMEPHASED_REGULAR_RECORDS = 20_000;

export function clampTimephasedRegularRecordCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(count, 0), MAX_TIMEPHASED_REGULAR_RECORDS);
}

export const MAX_TIMEPHASED_IRREGULAR_RECORDS = 5_000;

export const MAX_TIMEPHASED_PLANNED_RECORDS = 20_000;

export function clampTimephasedPlannedRecordCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(count, 0), MAX_TIMEPHASED_PLANNED_RECORDS);
}

export function clampTimephasedIrregularRecordCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(count, 0), MAX_TIMEPHASED_IRREGULAR_RECORDS);
}
