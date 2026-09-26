export type SequenceType =
  | 'FINISH_START'
  | 'FINISH_FINISH'
  | 'START_START'
  | 'START_FINISH';

/**
 * Lag-eenheid, benoemd naar IfcTaskDurationEnum zodat de IFC-round-trip 1-op-1 is:
 * WORKTIME = werktijd in de lagkalender (default; zie `SchedulingOptions.lagCalendar`),
 * ELAPSEDTIME = kalendertijd (24/7, bv. uitharden van beton dat in het weekend doorloopt).
 */
export type LagUnit = 'WORKTIME' | 'ELAPSEDTIME';

export interface Sequence {
  id: string;
  predecessorId: string;
  successorId: string;
  type: SequenceType;
  /** Vaste lag in dagen (positief = uitloop, negatief = lead). Genegeerd wanneer lagPercent gezet is. */
  lagDays: number;
  /** Vaste lag in integer MINUTEN. Aanwezig ⇒ bron van waarheid; afwezig ⇒ `lagDays` (dagen) is de
   *  bron. */
  lagMinutes?: number;
  /** Lag-eenheid; ontbreekt = WORKTIME. */
  lagUnit?: LagUnit;
  /** XER/P6-bronsemantiek: een nul-lag FS waarvan de expliciete geplande opvolgerstart exact op
   *  het geplande voorgangereinde én een kalenderbandeinde ligt, behoudt die finishgrens als
   *  startrepresentatie. Andere importformaten laten dit veld weg en houden hun bestaande snap. */
  p6StartAtPredecessorFinishBoundary?: boolean;
  /**
   * Procentuele lag: percentage van de duur van de VOORGANGER (bv. 50 = "SS+50%"),
   * per CPM-run opnieuw geëvalueerd uit de actuele duur (MS Project-semantiek) en
   * afgerond (Math.round) op hele dagen in dagmodus, op hele minuten in uurmodus. Sluit lagDays uit.
   */
  lagPercent?: number;
}

/** Korte internationale afkortingen (FS/SS/FF/SF) voor dropdowns in relatie-editors. */
export const SEQUENCE_TYPE_OPTIONS: { value: SequenceType; label: string }[] = [
  { value: 'FINISH_START', label: 'FS' },
  { value: 'START_START', label: 'SS' },
  { value: 'FINISH_FINISH', label: 'FF' },
  { value: 'START_FINISH', label: 'SF' },
];
