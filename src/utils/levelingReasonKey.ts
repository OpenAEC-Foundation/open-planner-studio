import type { LevelingReason } from '@/engine/scheduler/ResourceLeveler';

export const LEVELING_REASON_KEY = {
  CALENDAR_MISMATCH:    'resource.leveling.reason.calendarMismatch',
  INSUFFICIENT_CAPACITY:'resource.leveling.reason.insufficientCapacity',
  INTRINSIC_OVERRUN:    'resource.leveling.intrinsicOverrun',
  CEILING_TOO_TIGHT:    'resource.leveling.reason.ceilingTooTight',
  CEILING_UNREACHABLE:  'resource.leveling.reason.ceilingUnreachable',
  NO_WINDOW_IN_HORIZON: 'resource.leveling.reason.noWindowInHorizon',
  RESIDUAL_FULL:        'resource.leveling.reason.residualFull',
} as const satisfies Record<LevelingReason, string>;
