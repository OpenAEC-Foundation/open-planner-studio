import type { LevelingReason } from '@/engine/scheduler/ResourceLeveler';

/**
 * `LevelingReason` → i18n-sleutel. Eén mapping voor de nivelleerdialoog, zodat elke code een eigen
 * uitleg krijgt (een horizon-uitputting is geen "onvoldoende capaciteit").
 *
 * `INTRINSIC_OVERRUN` wijst bewust naar de BESTAANDE sleutel `resource.leveling.intrinsicOverrun`
 * (niet naar een nieuwe `reason.intrinsicOverrun`) — die sleutel bestaat al in alle veertien locales
 * en draagt de interpolatie (resource/peak/capacity) die `LevelingDialog.tsx` er apart bij geeft;
 * verplaatsen zou veertien bestanden een key-rename opleggen zonder functionele winst.
 *
 * Het `satisfies Record<LevelingReason, string>` is de poort: een nieuw lid in de taxonomie zonder
 * sleutel geeft een COMPILE-fout in plaats van een stilzwijgend lege uitleg.
 */
export const LEVELING_REASON_KEY = {
  CALENDAR_MISMATCH:    'resource.leveling.reason.calendarMismatch',
  INSUFFICIENT_CAPACITY:'resource.leveling.reason.insufficientCapacity',
  INTRINSIC_OVERRUN:    'resource.leveling.intrinsicOverrun',
  CEILING_TOO_TIGHT:    'resource.leveling.reason.ceilingTooTight',
  CEILING_UNREACHABLE:  'resource.leveling.reason.ceilingUnreachable',
  NO_WINDOW_IN_HORIZON: 'resource.leveling.reason.noWindowInHorizon',
  RESIDUAL_FULL:        'resource.leveling.reason.residualFull',
} as const satisfies Record<LevelingReason, string>;
