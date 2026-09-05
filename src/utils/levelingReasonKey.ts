import type { LevelingReason } from '@/engine/scheduler/ResourceLeveler';
import type { DistributionBlockReason } from '@/services/library/distribute';

/**
 * `LevelingReason` → i18n-sleutel. Eén mapping voor de nivelleerdialoog én de B1c-verdeeldialoog;
 * vóór B1c-etappe-3 stond dit als een if/else-keten in `LevelingDialog.tsx` die drie van de zeven
 * codes kende en de rest ZONDER uitleg liet — een horizon-uitputting las daar als "onvoldoende
 * capaciteit".
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

/** `DistributionBlockReason` → i18n-sleutel; zelfde `satisfies`-poort. */
export const DISTRIBUTION_BLOCK_KEY = {
  UNCOUNTED_DOCUMENT: 'resource.distribution.blocked.uncounted',
  MATERIAL_ITEM:      'resource.distribution.blocked.material',
  NO_DEMAND:           'resource.distribution.blocked.noDemand',
} as const satisfies Record<DistributionBlockReason, string>;
