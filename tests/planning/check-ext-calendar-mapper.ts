/**
 * Extensie-kalendermapper × werkende uitzonderingen (fase 3.8, T13 — §T2-afwijking, LAAG-7-afnemer).
 *
 * ACHTERGROND. `src/extensions/extMappers.ts` is de ENIGE grenslaag tussen het interne domeinmodel
 * (`WorkCalendar`) en het publieke extensiecontract (`ExtCalendar`, `extTypes.ts`) — een extensie die
 * een kalender leest (`toExtCalendar`), iets ONGERELATEERDS wijzigt en teruggeeft (`fromExtCalendar`,
 * bv. via `api.data.setCalendar`) round-trippet altijd via deze twee functies. Vóór deze taak had
 * `ExtCalendar` geen `workingExceptions`-veld — zo'n round-trip wiste een bestaande werkende
 * uitzondering dus stilzwijgend, ook al veranderde de extensie er zelf niets aan.
 *
 * Deze check bewaakt: (1) het veld bestaat en round-trippet exact (naam/datums/banden), (2) een
 * kalender ZONDER workingExceptions blijft `undefined` (geen `[]`-lek, byte-identiek anker), en
 * (3) `toExtCalendar` levert een MUTEERBARE kopie — een extensie die de teruggegeven array/banden
 * muteert mag de interne store nooit raken (zelfde garantie als voor `holidays`/`workTime`).
 */
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

// ── 1. Round-trip met banden + band-loze uitzondering ──────────────────────────────────────────
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

// ── 2. Byte-identiek-anker: geen workingExceptions ⇒ blijft undefined (geen []-lek) ────────────
console.log('-- ext-calendar-mapper: byte-identiek zonder workingExceptions --');
{
  const cal: WorkCalendar = { ...BASE, holidays: [] };
  const ext = toExtCalendar(cal);
  assert(ext.workingExceptions === undefined, `toExtCalendar zonder workingExceptions: verwacht undefined, kreeg ${JSON.stringify(ext.workingExceptions)}`);
  const back = fromExtCalendar(ext);
  assert(back.workingExceptions === undefined, `fromExtCalendar zonder workingExceptions: verwacht undefined, kreeg ${JSON.stringify(back.workingExceptions)}`);
}

// ── 3. Muteerbaarheids-garantie: de teruggegeven kopie is losgekoppeld van de interne store-vorm ─
console.log('-- ext-calendar-mapper: toExtCalendar levert een losstaande kopie --');
{
  const cal: WorkCalendar = {
    ...BASE, holidays: [],
    workingExceptions: [{ name: 'Origineel', startDate: '2026-07-11', endDate: '2026-07-11', bands: [{ start: 360, end: 720 }] }],
  };
  const ext = toExtCalendar(cal);
  // Muteer de EXT-kopie — mag de interne `cal` niet raken.
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
