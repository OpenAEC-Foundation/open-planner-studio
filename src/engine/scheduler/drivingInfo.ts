import type { CPMResult } from './CPMSolver';

/**
 * De gedeelde driving-informatie voor Gantt, rapport, taakpaneel, tabel, trace en MCP:
 * `undefined` = onbekend; een (eventueel lege) lijst = geldig berekend.
 * Gantt en rapport tekenen bij onbekend alle relaties neutraal doorgetrokken;
 * bij een bekende lijst worden niet-genoemde relaties gestreept.
 *
 * Geen informatie is er bij: nog niets berekend, een mislukte berekening (`error`), en de
 * reconstructie "Datums zoals opgeslagen" (`drivingUnknown`). Dat laatste onderscheid ontbrak:
 * de reconstructie gaf een lege lijst en de renderer streepte daardoor ELKE relatie — tegen zijn
 * eigen regel in, en op rehab-2.xer de duurste canvasbewerking (prestatiemeting 2026-10-07, N4).
 */
export function knownDrivingSequenceIds<Ids extends readonly string[]>(
  cpm: (Pick<CPMResult, 'drivingUnknown' | 'error'> & { drivingSequenceIds: Ids }) | null | undefined,
): Ids | undefined {
  if (!cpm || cpm.error || cpm.drivingUnknown) return undefined;
  return cpm.drivingSequenceIds;
}
