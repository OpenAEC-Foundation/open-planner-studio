import type { SchedulingOptions } from '@/types/project';

/**
 * Eindreview XER-etappe, bevinding 4 — het `OPS_SchedulingOptions`-JSON uit een IFC is BUITEN-
 * invoer: een willekeurig IFC-bestand kon vóór deze poort `p6Source: 'XER'`, alle p6-vlaggen en een
 * onzin-`criticalDefinition` (niet-bestaande `mode`, een string als `thresholdHours`) ongefilterd
 * in `project.schedulingOptions` zetten (`JSON.parse` + cast, probe gedraaid). Deze functie is de
 * saaie whitelist-/typevalidator: bekende sleutels, bekende enum-waarden, eindige getallen voor de
 * getallen, booleans voor de vlaggen. Alles wat daar niet aan voldoet wordt WEGGELATEN (het veld
 * blijft op zijn solver-default), nooit "gerepareerd" — een half geldig object mag geen ander
 * gedrag activeren dan het bestand letterlijk beschrijft.
 *
 * Wat deze poort bewust NIET doet: `p6Source: 'XER'` weigeren. Een uit XER geïmporteerd project
 * round-tript zijn P6-opties via ditzelfde pset (`ifcWriter.ts`, `writeSchedulingOptionsMeta`), dus
 * de IFC-lezer is — naast de XER-lezer — een legitieme schrijver van `p6Source`. De
 * `CPMSolver`-hardening op de sequences (X12, `p6StartAtPredecessorFinishBoundary` wordt gestript
 * zonder `p6Source`) beschermt tegen een LOSSE relatievlag zonder projectniveau-bron; ze beschermt
 * niet tegen een vervalst projectbestand, en beweert dat sinds deze bijstelling ook niet meer.
 *
 * Leesmigratie-vrij: sleutels die de app niet (meer) kent verdwijnen stil; dat is hetzelfde
 * gedrag als voorheen voor onbekende psets. Headless getest in `check-ifc-roundtrip.ts`.
 */
const BOOLEAN_KEYS = [
  'makeOpenEndedCritical', 'useExpectedFinishDates', 'preserveActualDatesInBackwardPass',
  'clampNegativeFreeFloat', 'p6ZeroDurationUsesPlannedBoundary', 'p6UseTaskPlannedStartFloor',
  'p6FinishMilestoneBoundaryWindow', 'p6PreserveActualInstants', 'p6UseRemainingStartForProgress',
  'p6PreserveZeroDurationConstraintInstants', 'useProjectEndDateForFloat', 'resumeFromActualElapsed',
  'unstartedIgnoresStatusDate', 'p6CompletedLateFromRemainingWindow',
] as const satisfies ReadonlyArray<keyof SchedulingOptions>;

const LAG_CALENDARS = ['predecessor', 'successor', '24hour', 'projectDefault'] as const;
const TOTAL_FLOAT_MODES = ['start', 'finish', 'smallest'] as const;
const CRITICAL_MODES = ['totalFloat', 'longestPath'] as const;
const FLOAT_PATH_METHODS = ['FREE_FLOAT', 'TOTAL_FLOAT'] as const;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Compile-time: elke sleutel van `SchedulingOptions` moet hieronder een tak hebben. */
type HandledKeys =
  | (typeof BOOLEAN_KEYS)[number]
  | 'p6Source' | 'lagCalendar' | 'criticalDefinition' | 'totalFloatMode'
  | 'nearCriticalThreshold' | 'floatPaths';
type MissingKeys = Exclude<keyof SchedulingOptions, HandledKeys>;
const _allKeysHandled: MissingKeys extends never ? true : MissingKeys = true;
void _allKeysHandled;

export function sanitizeSchedulingOptions(input: unknown): SchedulingOptions | undefined {
  if (!isRecord(input)) return undefined;
  const out: SchedulingOptions = {};
  // Sleutelvolgorde van de INVOER behouden: de round-trip-checks vergelijken via JSON.stringify,
  // en een geschreven blok moet na lezen byte-identiek terugkomen — de poort filtert, herordent niet.
  for (const key of Object.keys(input)) {
    const value = input[key];
    switch (key) {
      case 'p6Source': if (value === 'XER') out.p6Source = 'XER'; break;
      case 'lagCalendar': if (oneOf(value, LAG_CALENDARS)) out.lagCalendar = value; break;
      case 'totalFloatMode': if (oneOf(value, TOTAL_FLOAT_MODES)) out.totalFloatMode = value; break;
      case 'nearCriticalThreshold': if (isFiniteNumber(value)) out.nearCriticalThreshold = value; break;
      case 'criticalDefinition':
        if (isRecord(value) && oneOf(value.mode, CRITICAL_MODES)) {
          out.criticalDefinition = {
            mode: value.mode,
            ...(isFiniteNumber(value.threshold) ? { threshold: value.threshold } : {}),
            ...(isFiniteNumber(value.thresholdHours) ? { thresholdHours: value.thresholdHours } : {}),
          };
        }
        break;
      case 'floatPaths':
        if (isRecord(value) && typeof value.enabled === 'boolean'
          && oneOf(value.method, FLOAT_PATH_METHODS) && isFiniteNumber(value.maxPaths)) {
          out.floatPaths = { enabled: value.enabled, method: value.method, maxPaths: value.maxPaths };
        }
        break;
      default:
        if ((BOOLEAN_KEYS as readonly string[]).includes(key) && typeof value === 'boolean') {
          out[key as (typeof BOOLEAN_KEYS)[number]] = value;
        }
        // Onbekende sleutel: weglaten.
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
