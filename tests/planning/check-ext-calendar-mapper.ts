import { toExtCalendar, fromExtCalendar } from '@/extensions/extMappers';
import type { WorkCalendar } from '@/types/calendar';

let checks = 0;
let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}
function eq(name: string, got: unknown, want: unknown): void {
  assert(JSON.stringify(got) === JSON.stringify(want), `${name}: kreeg ${JSON.stringify(got)} ≠ verwacht ${JSON.stringify(want)}`);
}

const BASE: Omit<WorkCalendar, 'holidays' | 'workingExceptions'> = {
  id: 'cal-1', name: 'Test', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
};

console.log('-- ext-calendar-mapper: workingExceptions round-trip --');
{
  const cal: WorkCalendar = {
    ...BASE, holidays: [{ name: 'Feestdag', startDate: '2026-07-09', endDate: '2026-07-09' }],
    workingExceptions: [
      { name: 'Werkende zaterdag', startDate: '2026-07-11', endDate: '2026-07-11', bands: [{ start: 360, end: 720 }] },
      { name: 'Band-loze werkende zondag', startDate: '2026-07-12', endDate: '2026-07-12' },
    ],
  };
  const ext = toExtCalendar(cal);
  eq('toExtCalendar: 2 workingExceptions', ext.workingExceptions?.length, 2);
  eq('toExtCalendar: naam+datum+banden van de eerste', ext.workingExceptions?.[0], { name: 'Werkende zaterdag', startDate: '2026-07-11', endDate: '2026-07-11', bands: [{ start: 360, end: 720 }] });
  eq('toExtCalendar: band-loze uitzondering blijft band-loos (geen [] verzonnen)', ext.workingExceptions?.[1].bands, undefined);

  const back = fromExtCalendar(ext);
  eq('fromExtCalendar: workingExceptions komen exact terug', back.workingExceptions, cal.workingExceptions);
  eq('fromExtCalendar: holidays blijven ongemoeid', back.holidays, cal.holidays);
}

console.log('-- ext-calendar-mapper: byte-identiek zonder workingExceptions --');
{
  const cal: WorkCalendar = { ...BASE, holidays: [] };
  const ext = toExtCalendar(cal);
  assert(ext.workingExceptions === undefined, `toExtCalendar zonder workingExceptions: verwacht undefined, kreeg ${JSON.stringify(ext.workingExceptions)}`);
  const back = fromExtCalendar(ext);
  assert(back.workingExceptions === undefined, `fromExtCalendar zonder workingExceptions: verwacht undefined, kreeg ${JSON.stringify(back.workingExceptions)}`);
}

console.log('-- ext-calendar-mapper: toExtCalendar levert een losstaande kopie --');
{
  const cal: WorkCalendar = {
    ...BASE, holidays: [],
    workingExceptions: [{ name: 'Origineel', startDate: '2026-07-11', endDate: '2026-07-11', bands: [{ start: 360, end: 720 }] }],
  };
  const ext = toExtCalendar(cal);
  ext.workingExceptions![0].name = 'Gemuteerd door extensie';
  ext.workingExceptions![0].bands![0].start = 0;
  eq('interne cal.workingExceptions blijft ongemoeid na mutatie van de ext-kopie (naam)', cal.workingExceptions?.[0].name, 'Origineel');
  eq('interne cal.workingExceptions blijft ongemoeid na mutatie van de ext-kopie (band)', cal.workingExceptions?.[0].bands?.[0].start, 360);
}

if (fails > 0) {
  console.log(`\nXX ext-calendar-mapper: ${fails}/${checks} checks GEFAALD`);
  process.exit(1);
}
console.log(`\nOK  ext-calendar-mapper: alle checks groen (${checks})`);
