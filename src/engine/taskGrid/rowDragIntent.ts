/**
 * Browserreview, observatie 2: `useTableRowDrag`s kandidaatfase promoveerde tot nu toe zuiver op
 * |dy| >= ROW_DRAG_THRESHOLD — prima voor de canvas-Gantt (waar een sleep in de rijgutter begint,
 * niet op selecteerbare tekst), maar in de DOM-tabel begint de mousedown middenin een celwaarde.
 * Een gebruiker die een stukje van een taaknaam wil selecteren (mousedown + horizontaal slepen)
 * haalt al snel een paar pixels verticale ruis mee, en promoveerde dan ONTERECHT tot een rijsleep
 * — de tekstselectie kwam nooit tot stand, precies zoals de vertical-only-drag in de Gantt zelf
 * geen last heeft van horizontale muisruis omdat daar niets valt te selecteren.
 *
 * Deze functie voegt een asintentie toe die in `useTableRowDrag` ontbrak: de rijsleep promoveert
 * alleen als de beweging OVERWEGEND verticaal is (|dy| >= |dx|), naast de bestaande drempel op |dy|
 * zelf. Een zuiver horizontale of licht diagonale sleep (tekstselectie, een klik met wat trilling)
 * blijft dus candidate totdat de muis loslaat, ongeacht hoe ver dx gaat — pas zodra de verticale
 * component de horizontale inhaalt én de drempel haalt, wordt het een echte rijsleep.
 */
export function shouldPromoteToRowDrag(dx: number, dy: number, threshold: number): boolean {
  return Math.abs(dy) >= threshold && Math.abs(dy) >= Math.abs(dx);
}
