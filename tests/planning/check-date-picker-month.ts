/**
 * De rekenkern van de eigen datumkiezer bij het gedeelde datumveld (#904) — pure functies, dus headless.
 *
 * Wat hier vastligt (het gedrag in de browser test `tests/browser/date-picker.spec.ts`):
 *  - het maandraster: altijd zes weken, beginnend op de ingestelde eerste weekdag (`ui.weekStartDay`, dezelfde
 *    instelling als de Gantt), met de weeknummers van de Gantt (`getWeekNumberFor`);
 *  - de toetsen in het raster (pijltjes, Home/End, PageUp/PageDown, met Shift een jaar), ook van rechts naar links;
 *  - de koppen en dagnamen in de taal van de app, op de Gregoriaanse kalender met Latijnse cijfers.
 */
import {
  addMonthsClamped,
  datePickerKeyTarget,
  datePickerLabels,
  monthGrid,
  monthOf,
} from '@/utils/datePickerMonth';

let failures = 0;
function check(name: string, cond: boolean): void {
  if (!cond) {
    failures++;
    console.log(`   XX ${name}`);
  } else {
    console.log(`   OK ${name}`);
  }
}
const eq = (name: string, actual: unknown, expected: unknown) =>
  check(`${name} (kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)})`,
    JSON.stringify(actual) === JSON.stringify(expected));

console.log('── maandraster ──');
{
  // November 2026 begint op zondag 1 november.
  const mon = monthGrid(2026, 11, 'monday');
  eq('altijd zes weken (maandag)', mon.length, 6);
  check('elke week zeven dagen', mon.every(w => w.days.length === 7));
  eq('eerste cel: maandag 26 oktober', mon[0].days[0].iso, '2026-10-26');
  eq('1 november staat op de zevende plek', mon[0].days[6].iso, '2026-11-01');
  check('26 oktober valt buiten de maand', !mon[0].days[0].inMonth);
  check('1 november valt erbinnen', mon[0].days[6].inMonth);
  eq('laatste cel: zondag 6 december', mon[5].days[6].iso, '2026-12-06');
  eq('ISO-weeknummers zoals de Gantt', mon.map(w => w.weekNumber), [44, 45, 46, 47, 48, 49]);
  eq('ISO-weekdag van de eerste kolom', mon[0].days[0].isoWeekday, 1);

  const sun = monthGrid(2026, 11, 'sunday');
  eq('zes weken (zondag)', sun.length, 6);
  eq('eerste cel: zondag 1 november', sun[0].days[0].iso, '2026-11-01');
  eq('ISO-weekdag van de eerste kolom (zondag)', sun[0].days[0].isoWeekday, 7);
  eq('weeknummers met zondag als eerste dag', sun[0].weekNumber, 45);

  // Februari 2027 begint op maandag: de eerste cel is dan de 1e zelf, geen dag van januari.
  const feb = monthGrid(2027, 2, 'monday');
  eq('februari 2027 begint op de 1e', feb[0].days[0].iso, '2027-02-01');
  eq('weeknummer 1 januari 2027 (week 53 van 2026)', monthGrid(2027, 1, 'monday')[0].weekNumber, 53);
  // Schrikkeljaar.
  check('29 februari 2028 bestaat in het raster',
    monthGrid(2028, 2, 'monday').some(w => w.days.some(d => d.iso === '2028-02-29' && d.inMonth)));
}

console.log('── maanden optellen ──');
{
  eq('31 januari + 1 maand = 28 februari', addMonthsClamped('2027-01-31', 1), '2027-02-28');
  eq('31 maart − 1 maand = 29 februari (schrikkel)', addMonthsClamped('2028-03-31', -1), '2028-02-29');
  eq('15 december + 1 = 15 januari volgend jaar', addMonthsClamped('2026-12-15', 1), '2027-01-15');
  eq('29 februari + 12 maanden = 28 februari', addMonthsClamped('2028-02-29', 12), '2029-02-28');
  eq('monthOf', monthOf('2026-11-14'), { year: 2026, month: 11 });
}

console.log('── toetsen in het raster ──');
{
  const k = (key: string, iso: string, opts: { shift?: boolean; rtl?: boolean; weekStartDay?: 'monday' | 'sunday' } = {}) =>
    datePickerKeyTarget(iso, key, { shift: opts.shift ?? false, rtl: opts.rtl ?? false, weekStartDay: opts.weekStartDay ?? 'monday' });
  // 2026-11-18 is een woensdag.
  eq('pijl rechts = dag later', k('ArrowRight', '2026-11-18'), '2026-11-19');
  eq('pijl links = dag eerder', k('ArrowLeft', '2026-11-18'), '2026-11-17');
  eq('pijl omhoog = week eerder', k('ArrowUp', '2026-11-18'), '2026-11-11');
  eq('pijl omlaag = week later', k('ArrowDown', '2026-11-18'), '2026-11-25');
  eq('pijl rechts over de maandgrens', k('ArrowRight', '2026-11-30'), '2026-12-01');
  eq('rechts-naar-links: pijl links = dag later', k('ArrowLeft', '2026-11-18', { rtl: true }), '2026-11-19');
  eq('rechts-naar-links: pijl rechts = dag eerder', k('ArrowRight', '2026-11-18', { rtl: true }), '2026-11-17');
  eq('Home = begin van de week (maandag)', k('Home', '2026-11-18'), '2026-11-16');
  eq('End = einde van de week (zondag)', k('End', '2026-11-18'), '2026-11-22');
  eq('Home met zondag als eerste dag', k('Home', '2026-11-18', { weekStartDay: 'sunday' }), '2026-11-15');
  eq('End met zondag als eerste dag', k('End', '2026-11-18', { weekStartDay: 'sunday' }), '2026-11-21');
  eq('Home op een zondag (maandag als eerste dag)', k('Home', '2026-11-22'), '2026-11-16');
  eq('PageDown = maand later', k('PageDown', '2026-01-31'), '2026-02-28');
  eq('PageUp = maand eerder', k('PageUp', '2026-03-31'), '2026-02-28');
  eq('Shift+PageDown = jaar later', k('PageDown', '2028-02-29', { shift: true }), '2029-02-28');
  eq('Shift+PageUp = jaar eerder', k('PageUp', '2026-11-18', { shift: true }), '2025-11-18');
  eq('andere toets: niets', k('a', '2026-11-18'), null);
  eq('Enter is geen verplaatsing', k('Enter', '2026-11-18'), null);
}

console.log('── teksten in de taal van de app ──');
{
  const nl = datePickerLabels('nl');
  eq('maandkop nl', nl.monthTitle(2026, 11), 'november 2026');
  eq('dag voluit nl', nl.dayLabel('2026-11-18'), 'woensdag 18 november 2026');
  const en = datePickerLabels('en');
  eq('maandkop en', en.monthTitle(2026, 11), 'November 2026');
  const de = datePickerLabels('de');
  eq('maandkop de', de.monthTitle(2026, 3), 'März 2026');
  // Perzisch: Intl kiest zonder dwang de Solar-Hijri-kalender en Perzische cijfers (zie `gregorianDateFormat`).
  const fa = datePickerLabels('fa');
  check(`maandkop fa staat op 2026 in Latijnse cijfers (kreeg ${fa.monthTitle(2026, 11)})`, fa.monthTitle(2026, 11).includes('2026'));
  const ar = datePickerLabels('ar');
  check(`maandkop ar staat op 2026 in Latijnse cijfers (kreeg ${ar.monthTitle(2026, 11)})`, ar.monthTitle(2026, 11).includes('2026'));
  const unknown = datePickerLabels('xx-onbekend');
  eq('onbekende taal valt terug op Engels', unknown.monthTitle(2026, 11), 'November 2026');
  eq('dagnummer in Latijnse cijfers (fa)', fa.dayNumber('2026-11-08'), '8');
}

if (failures > 0) {
  console.log(`XX datumkiezer-raster: ${failures} fout(en)`);
  process.exit(1);
}
console.log('OK datumkiezer-raster: alles groen');
