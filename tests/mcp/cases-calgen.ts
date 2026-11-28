import { test, assert, assertEq, run } from './harness';
import { resolveCalendarHolidays } from '@/services/mcp/calendarGenerate';
import {
  materializeHolidays,
  computeGenerateSpan,
  type HolidayGenParams,
} from '@/engine/calendar/generateCalendarHolidays';
import type { Holiday, WorkCalendar } from '@/types/calendar';

const SPAN = { projectStart: '2026-01-01', projectEnd: '2026-12-31' };
const NL: HolidayGenParams = { country: 'NL', region: undefined, bouwvak: 'geen' };

test('a — alleen generate: byte-gelijk aan materializeHolidays, generation gezet, becameLiteral=false', () => {
  const { from, to } = computeGenerateSpan(SPAN.projectStart, SPAN.projectEnd);
  const direct = materializeHolidays(NL, from, to);
  const res = resolveCalendarHolidays({ generate: NL }, SPAN);
  assertEq(res.holidays, direct.holidays, 'holidays niet byte-gelijk aan directe materialisatie');
  assertEq(res.generation, direct.generation, 'generation-metadata niet byte-gelijk');
  assert(res.generation != null, 'generation moet gezet zijn bij zuiver generator-pad');
  assertEq(res.becameLiteral, false, 'becameLiteral moet false zijn zonder rawHolidays');
});

test('b — generate + raw: samengevoegd, generation weggelaten, becameLiteral=true', () => {
  const { from, to } = computeGenerateSpan(SPAN.projectStart, SPAN.projectEnd);
  const direct = materializeHolidays(NL, from, to);
  const vorstverlet: Holiday = { name: 'Vorstverlet', startDate: '2026-02-10', endDate: '2026-02-12' };
  const res = resolveCalendarHolidays({ generate: NL, rawHolidays: [vorstverlet] }, SPAN);
  assertEq(res.generation, undefined, 'generation moet weg zijn bij rauwe toevoeging');
  assertEq(res.becameLiteral, true, 'becameLiteral moet true zijn');
  assertEq(res.holidays.length, direct.holidays.length + 1, 'merge moet precies één rauwe dag toevoegen');
  assert(
    res.holidays.some((h) => h.name === 'Vorstverlet' && h.startDate === '2026-02-10'),
    'vorstverletdag ontbreekt in het resultaat',
  );
});

test('c — alleen raw op generatie-kalender: behoud bestaande + raw, generation weg, becameLiteral=true', () => {
  const { from, to } = computeGenerateSpan(SPAN.projectStart, SPAN.projectEnd);
  const base = materializeHolidays(NL, from, to);
  const existing: Pick<WorkCalendar, 'holidays' | 'generation'> = {
    holidays: base.holidays,
    generation: base.generation,
  };
  const vorstverlet: Holiday = { name: 'Vorstverlet', startDate: '2026-02-10', endDate: '2026-02-12' };
  const res = resolveCalendarHolidays({ rawHolidays: [vorstverlet] }, SPAN, existing);
  assertEq(res.generation, undefined, 'generation moet vervallen door rauwe toevoeging');
  assertEq(res.becameLiteral, true, 'becameLiteral moet true zijn (er was generatie te verliezen)');
  assertEq(res.holidays.length, base.holidays.length + 1, 'bestaande holidays moeten behouden blijven + 1 raw');
  assert(res.holidays.some((h) => h.name === 'Vorstverlet'), 'rauwe dag ontbreekt');
});

test('d — alleen raw op letterlijke kalender: gewoon mergen, becameLiteral=false', () => {
  const existingLit: Holiday[] = [{ name: 'Bedrijfsuitje', startDate: '2026-06-01', endDate: '2026-06-01' }];
  const existing: Pick<WorkCalendar, 'holidays' | 'generation'> = { holidays: existingLit };
  const raw: Holiday = { name: 'Vorstverlet', startDate: '2026-02-10', endDate: '2026-02-12' };
  const res = resolveCalendarHolidays({ rawHolidays: [raw] }, SPAN, existing);
  assertEq(res.generation, undefined, 'geen generation op een letterlijke kalender');
  assertEq(res.becameLiteral, false, 'becameLiteral moet false zijn (er viel niets te verliezen)');
  assertEq(res.holidays.length, 2, 'beide holidays aanwezig');
  assert(res.holidays.some((h) => h.name === 'Bedrijfsuitje'), 'bestaande letterlijke dag ontbreekt');
  assert(res.holidays.some((h) => h.name === 'Vorstverlet'), 'rauwe dag ontbreekt');
});

test('dedup — raw met identiek datumbereik als een gegenereerde dag levert geen duplicaat', () => {
  const { from, to } = computeGenerateSpan(SPAN.projectStart, SPAN.projectEnd);
  const gen = materializeHolidays(NL, from, to);
  assert(gen.holidays.length > 0, 'testvoorwaarde: er moeten gegenereerde dagen zijn');
  const target = gen.holidays[0];
  const overlap: Holiday = { name: 'ANDERE-NAAM-ZELFDE-BEREIK', startDate: target.startDate, endDate: target.endDate };
  const res = resolveCalendarHolidays({ generate: NL, rawHolidays: [overlap] }, SPAN);
  assertEq(res.holidays.length, gen.holidays.length, 'dedup faalde: lengte veranderde t.o.v. pure generatie');
  const matches = res.holidays.filter(
    (h) => h.startDate === target.startDate && h.endDate === target.endDate,
  );
  assertEq(matches.length, 1, 'er mag precies één entry voor dat datumbereik zijn');
  assertEq(res.becameLiteral, true, 'raw toevoegen maakt de kalender letterlijk, ook bij volledige dedup');
});

test('no-op — geen generate en geen raw: holidays + generation behouden, becameLiteral=false', () => {
  const { from, to } = computeGenerateSpan(SPAN.projectStart, SPAN.projectEnd);
  const base = materializeHolidays(NL, from, to);
  const existing: Pick<WorkCalendar, 'holidays' | 'generation'> = {
    holidays: base.holidays,
    generation: base.generation,
  };
  const res = resolveCalendarHolidays({}, SPAN, existing);
  assertEq(res.holidays, base.holidays, 'holidays moeten ONGEWIJZIGD terugkomen');
  assertEq(res.generation, base.generation, 'generation moet behouden blijven (geen stil verval)');
  assertEq(res.becameLiteral, false, 'er is niets letterlijk geworden');
  const leeg = resolveCalendarHolidays({}, SPAN);
  assertEq(leeg.holidays, [], 'zonder bestaande kalender: lege holiday-lijst');
  assertEq(leeg.generation, undefined, 'zonder bestaande kalender: geen generation');
  assertEq(leeg.becameLiteral, false, 'becameLiteral blijft false');
});

await run();
