// workDeviation.ts — het ENE criterium "opgeslagen restwerk wijkt af van inzet × restduur".
//
// Twee lezers delen het: het waarschuwingsteken naast *Werk (rest)* (`assignmentWorkDeviation.ts`)
// en de melding wanneer een duurbewerking zo'n afwijkend restwerk herschrijft
// (`settleDurationEdit` in `workRuleApply.ts`). Eigen bladmodule zonder imports, zodat beide hem
// kunnen gebruiken zonder kringimport.

/**
 * Wijkt het opgeslagen restwerk af van het afgeleide (inzet × restduur)? Tolerantie 1 % van de
 * grootste van de twee, en minstens één minuut — tegen afronding (hele werkdagen, hele minuten,
 * inzet op vier decimalen).
 */
export function storedWorkDeviates(storedMinutes: number, derivedMinutes: number): boolean {
  return Math.abs(storedMinutes - derivedMinutes) > Math.max(1, 0.01 * Math.max(storedMinutes, derivedMinutes));
}
