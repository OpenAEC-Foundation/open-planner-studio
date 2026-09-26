/**
 * Asintentie voor `useTableRowDrag`s kandidaatfase. Alleen |dy| >= ROW_DRAG_THRESHOLD volstaat
 * voor de canvas-Gantt (waar een sleep in de rijgutter begint, niet op selecteerbare tekst), maar
 * in de DOM-tabel begint de mousedown middenin een celwaarde: wie een stukje van een taaknaam
 * selecteert (mousedown + horizontaal slepen) haalt al snel een paar pixels verticale ruis mee en
 * zou dan ONTERECHT een rijsleep starten.
 *
 * Daarom promoveert de rijsleep
 * alleen als de beweging OVERWEGEND verticaal is (|dy| >= |dx|), naast de bestaande drempel op |dy|
 * zelf. Een zuiver horizontale of licht diagonale sleep (tekstselectie, een klik met wat trilling)
 * blijft dus candidate totdat de muis loslaat, ongeacht hoe ver dx gaat — pas zodra de verticale
 * component de horizontale inhaalt én de drempel haalt, wordt het een echte rijsleep.
 */
export function shouldPromoteToRowDrag(dx: number, dy: number, threshold: number): boolean {
  return Math.abs(dy) >= threshold && Math.abs(dy) >= Math.abs(dx);
}
