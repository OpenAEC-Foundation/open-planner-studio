// Issue #21 punt 5 (review §10.3): pure hulpfunctie die een sleep-gebaar van N GETOONDE
// kolommen vertaalt naar een datum. Geëxtraheerd uit `useBarDrag.ts` zodat de kern-rekenkunde
// headless testbaar is (`tests/planning/`) zonder de hook/DOM-listeners te hoeven simuleren.
//
// Onder werkdagen-as-compressie (`compressed`) is 1 getoonde kolom 1 WERKDAG: `colDelta`
// werkdagen verderop/eerder via `CalendarEngine.addWorkingDaysSigned` (bestaande, elders al
// zwaar geteste signed-offset — CPMSolver/relationMath gebruiken 'm voor lag/lead). Toggle uit
// (of de kalender heeft geen werkdagen — zie `isCompressedEffective`) ⇒ 1 kolom 1 KALENDERdag,
// ONGEWIJZIGD t.o.v. het bestaande gedrag (`addCalendarDays`) — byte-identiek pad.
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { addCalendarDays } from '@/utils/dateUtils';

export function shiftByDisplayedColumns(
  calendarEngine: CalendarEngine,
  date: Date,
  colDelta: number,
  compressed: boolean,
): Date {
  return compressed ? calendarEngine.addWorkingDaysSigned(date, colDelta) : addCalendarDays(date, colDelta);
}
