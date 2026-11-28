export interface XerFidelityAxisCounts {
  deviations: number;
  measurable: number;
}

export interface XerFidelityCounters {
  es: XerFidelityAxisCounts;
  ef: XerFidelityAxisCounts;
  ls: XerFidelityAxisCounts;
  lf: XerFidelityAxisCounts;
  tf: XerFidelityAxisCounts;
  ff: XerFidelityAxisCounts;
}

export interface XerScannerPrecisionFacts {
  dateSecondCells: { es: number; ef: number; ls: number; lf: number };
  dateNonZeroSubminuteCells: { es: number; ef: number; ls: number; lf: number };
  floatFractionalMinuteCells: { tf: number; ff: number };
}

export function emptyAxisCounts(): XerFidelityAxisCounts {
  return { deviations: 0, measurable: 0 };
}

export function emptyCounters(): XerFidelityCounters {
  return {
    es: emptyAxisCounts(), ef: emptyAxisCounts(),
    ls: emptyAxisCounts(), lf: emptyAxisCounts(),
    tf: emptyAxisCounts(), ff: emptyAxisCounts(),
  };
}

export interface XerFidelityBaselineEntry {
  label: string;
  tasks: number;
  projects: number;
  counters: XerFidelityCounters;
  precision?: XerScannerPrecisionFacts;
  schemaFingerprint?: string;
  reason?: string;
}

export interface XerFidelityBaseline {
  files: Record<string, XerFidelityBaselineEntry>;
}

export function createEmptyXerFidelityBaseline(): XerFidelityBaseline {
  return { files: {} };
}
