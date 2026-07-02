export type SequenceType =
  | 'FINISH_START'
  | 'FINISH_FINISH'
  | 'START_START'
  | 'START_FINISH';

/**
 * Lag-eenheid, benoemd naar IfcTaskDurationEnum zodat de IFC-round-trip 1-op-1 is:
 * WORKTIME = werkdagen op de projectkalender (default), ELAPSEDTIME = kalenderdagen (24/7,
 * bv. uitharden van beton dat in het weekend doorloopt).
 */
export type LagUnit = 'WORKTIME' | 'ELAPSEDTIME';

export interface Sequence {
  id: string;
  predecessorId: string;
  successorId: string;
  type: SequenceType;
  /** Vaste lag in dagen (positief = uitloop, negatief = lead). Genegeerd wanneer lagPercent gezet is. */
  lagDays: number;
  /** Lag-eenheid; ontbreekt = WORKTIME (werkdagen) — bestaand gedrag, migratieloos. */
  lagUnit?: LagUnit;
  /**
   * Procentuele lag: percentage van de duur van de VOORGANGER (bv. 50 = "SS+50%"),
   * per CPM-run opnieuw geëvalueerd uit de actuele duur (MS Project-semantiek) en
   * afgerond op hele dagen (Math.round; de engine is dag-granulair). Sluit lagDays uit.
   */
  lagPercent?: number;
}

export const SEQUENCE_LABELS: Record<SequenceType, string> = {
  FINISH_START: 'ES (Eind-Start)',
  FINISH_FINISH: 'EE (Eind-Eind)',
  START_START: 'SS (Start-Start)',
  START_FINISH: 'SE (Start-Eind)',
};

/** Korte internationale afkortingen (FS/SS/FF/SF) voor dropdowns in relatie-editors. */
export const SEQUENCE_TYPE_OPTIONS: { value: SequenceType; label: string }[] = [
  { value: 'FINISH_START', label: 'FS' },
  { value: 'START_START', label: 'SS' },
  { value: 'FINISH_FINISH', label: 'FF' },
  { value: 'START_FINISH', label: 'SF' },
];
