import type { CPMResult } from './CPMSolver';

/**
 * De driving-relaties zoals Gantt en rapport ze mogen tekenen: `undefined` = geen informatie ⇒
 * alles neutraal doorgetrokken; een (eventueel lege) lijst = berekend ⇒ niet-genoemde relaties
 * gestreept.
 *
 * Geen informatie is er bij: nog niets berekend, een mislukte berekening (`error`), en de
 * reconstructie "Datums zoals opgeslagen" (`drivingUnknown`). Dat laatste onderscheid ontbrak:
 * de reconstructie gaf een lege lijst en de renderer streepte daardoor ELKE relatie — tegen zijn
 * eigen regel in, en op rehab-2.xer de duurste canvasbewerking (prestatiemeting 2026-10-07, N4).
 */
export function knownDrivingSequenceIds(cpm: CPMResult | null | undefined): string[] | undefined {
  if (!cpm || cpm.error || cpm.drivingUnknown) return undefined;
  return cpm.drivingSequenceIds;
}
