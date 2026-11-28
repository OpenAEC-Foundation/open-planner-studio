import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseInstant, formatInstant, formatDate } from '@/utils/dateUtils';
import { seedScalarWorkTime, seedScalarBands } from '@/utils/shiftPresets';
import { deriveHoursPerDay } from '@/services/subdayIo';
import type { WorkCalendar, WorkTimeBands, Holiday } from '@/types/calendar';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (got !== want) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

type Band = { start: number; end: number };
const w5 = (b: Band[]): WorkTimeBands => ({ byWeekday: { 1: b, 2: b, 3: b, 4: b, 5: b, 6: [], 7: [] } });
const w7 = (b: Band[]): WorkTimeBands => ({ byWeekday: { 1: b, 2: b, 3: b, 4: b, 5: b, 6: b, 7: b } });

function cal(
  id: string,
  workTime?: WorkTimeBands,
  holidays: Holiday[] = [],
  hoursPerDay = 8,
  workDays: number[] = [1, 2, 3, 4, 5],
): WorkCalendar {
  return { id, name: id, description: id, workDays, workStartHour: 8, workEndHour: 16, hoursPerDay, holidays, workTime };
}

const engH8 = new CalendarEngine(cal('H8', w5([{ start: 480, end: 960 }])));
const engHbreak = new CalendarEngine(cal('Hbreak', w5([{ start: 480, end: 720 }, { start: 750, end: 990 }])));
const engNight = new CalendarEngine(cal('Night', w5([{ start: 1320, end: 1800 }])));
const eng247 = new CalendarEngine(cal('247', w7([{ start: 0, end: 1440 }]), [], 24, [1, 2, 3, 4, 5, 6, 7]));
const engH10 = new CalendarEngine(cal('H10', w5([{ start: 480, end: 1080 }]), [], 10));

const I = (s: string) => parseInstant(s);
const F = (d: Date) => formatInstant(d, 'hour');

eq('A1  H8 nWI(ma 00:00)=ma 08:00', F(engH8.nextWorkInstant(I('2026-07-06'))), '2026-07-06T08:00');
eq('A2  H8 +720m van ma 08:00=di 12:00', F(engH8.addWorkMinutes(I('2026-07-06T08:00'), 720)), '2026-07-07T12:00');
eq('A3  H8 nWI(di 12:00)=di 12:00', F(engH8.nextWorkInstant(I('2026-07-07T12:00'))), '2026-07-07T12:00');
eq('A4  H8 +240m van di 12:00=di 16:00', F(engH8.addWorkMinutes(I('2026-07-07T12:00'), 240)), '2026-07-07T16:00');
eq('A5  H8 -240m van di 16:00=di 12:00', F(engH8.subtractWorkMinutes(I('2026-07-07T16:00'), 240)), '2026-07-07T12:00');
eq('A6  H8 pWI(di 12:00)=di 12:00', F(engH8.prevWorkInstant(I('2026-07-07T12:00'))), '2026-07-07T12:00');
eq('A7  H8 -720m van di 12:00=ma 08:00', F(engH8.subtractWorkMinutes(I('2026-07-07T12:00'), 720)), '2026-07-06T08:00');
eq('A8  H8 isWork(ma 12:00)=true', engH8.isWorkInstant(I('2026-07-06T12:00')), true);
eq('A9  H8 isWork(ma 16:00)=false (band-eind excl.)', engH8.isWorkInstant(I('2026-07-06T16:00')), false);
eq('A10 H8 isWork(ma 07:59)=false (vóór start)', engH8.isWorkInstant(I('2026-07-06T07:59')), false);

eq('B1  H8 nWI(ma 16:00)=di 08:00', F(engH8.nextWorkInstant(I('2026-07-06T16:00'))), '2026-07-07T08:00');
eq('B2  H8 nWIAfter(ma 12:00)=di 08:00', F(engH8.nextWorkInstantAfter(I('2026-07-06T12:00'))), '2026-07-07T08:00');
eq('B3  H8 nWIAfter(ma 08:00)=di 08:00', F(engH8.nextWorkInstantAfter(I('2026-07-06T08:00'))), '2026-07-07T08:00');
eq('B4  H8 pWI(ma 08:00)=vr3 16:00', F(engH8.prevWorkInstant(I('2026-07-06T08:00'))), '2026-07-03T16:00');
eq('B5  H8 pWI(ma 16:00)=ma 16:00', F(engH8.prevWorkInstant(I('2026-07-06T16:00'))), '2026-07-06T16:00');
eq('B6  H8 pWIBefore(ma 16:00)=vr3 16:00', F(engH8.prevWorkInstantBefore(I('2026-07-06T16:00'))), '2026-07-03T16:00');
eq('B7  H8 pWIBefore(di 08:00)=ma 16:00', F(engH8.prevWorkInstantBefore(I('2026-07-07T08:00'))), '2026-07-06T16:00');
eq('B8  H8 -240m van di 08:00=ma 12:00', F(engH8.subtractWorkMinutes(I('2026-07-07T08:00'), 240)), '2026-07-06T12:00');

eq('C1  Hbreak +360m van ma 08:00=ma 14:30', F(engHbreak.addWorkMinutes(I('2026-07-06T08:00'), 360)), '2026-07-06T14:30');
eq('C2  Hbreak nWI(ma 12:00)=ma 12:30', F(engHbreak.nextWorkInstant(I('2026-07-06T12:00'))), '2026-07-06T12:30');
eq('C3  Hbreak isWork(ma 12:15)=false (lunch)', engHbreak.isWorkInstant(I('2026-07-06T12:15')), false);
eq('C4  Hbreak nWI(ma 12:15)=ma 12:30', F(engHbreak.nextWorkInstant(I('2026-07-06T12:15'))), '2026-07-06T12:30');
eq('C5  Hbreak +240m van ma 14:30=di 10:00', F(engHbreak.addWorkMinutes(I('2026-07-06T14:30'), 240)), '2026-07-07T10:00');
eq('C6  Hbreak -240m van di 10:00=ma 14:30', F(engHbreak.subtractWorkMinutes(I('2026-07-07T10:00'), 240)), '2026-07-06T14:30');
eq('C7  Hbreak -360m van ma 14:30=ma 08:00', F(engHbreak.subtractWorkMinutes(I('2026-07-06T14:30'), 360)), '2026-07-06T08:00');

eq('D1  Night nWI(ma 00:00)=ma 22:00', F(engNight.nextWorkInstant(I('2026-07-06'))), '2026-07-06T22:00');
eq('D2  Night +480m van ma 22:00=di 06:00', F(engNight.addWorkMinutes(I('2026-07-06T22:00'), 480)), '2026-07-07T06:00');
eq('D3  Night nWI(di 06:00)=di 22:00', F(engNight.nextWorkInstant(I('2026-07-07T06:00'))), '2026-07-07T22:00');
eq('D4  Night +240m van di 22:00=wo 02:00', F(engNight.addWorkMinutes(I('2026-07-07T22:00'), 240)), '2026-07-08T02:00');
eq('D5  Night isWork(di 02:00)=true (wrap-staart)', engNight.isWorkInstant(I('2026-07-07T02:00')), true);
eq('D6  Night isWork(di 12:00)=false', engNight.isWorkInstant(I('2026-07-07T12:00')), false);
eq('D7  Night pWI(di 22:00)=di 06:00', F(engNight.prevWorkInstant(I('2026-07-07T22:00'))), '2026-07-07T06:00');
eq('D8  Night -480m van di 06:00=ma 22:00', F(engNight.subtractWorkMinutes(I('2026-07-07T06:00'), 480)), '2026-07-06T22:00');
eq('D9  Night -240m van wo 02:00=di 22:00', F(engNight.subtractWorkMinutes(I('2026-07-08T02:00'), 240)), '2026-07-07T22:00');
eq('D10 Night nWI(za 06:00)=ma13 22:00', F(engNight.nextWorkInstant(I('2026-07-11T06:00'))), '2026-07-13T22:00');
eq('D11 Night +480m van vr 22:00=za 06:00', F(engNight.addWorkMinutes(I('2026-07-10T22:00'), 480)), '2026-07-11T06:00');

const engNightHol = new CalendarEngine(cal('NightHol', w5([{ start: 1320, end: 1800 }]),
  [{ name: 'HL', startDate: '2026-07-07', endDate: '2026-07-07' }]));
eq('E1  NightHol +480m van ma 22:00=di 06:00', F(engNightHol.addWorkMinutes(I('2026-07-06T22:00'), 480)), '2026-07-07T06:00');
eq('E2  NightHol isWork(di 02:00)=true (ma-staart)', engNightHol.isWorkInstant(I('2026-07-07T02:00')), true);
eq('E3  NightHol isWork(di 23:00)=false (di-shift vervalt)', engNightHol.isWorkInstant(I('2026-07-07T23:00')), false);
eq('E4  NightHol nWI(di 06:00)=wo 22:00', F(engNightHol.nextWorkInstant(I('2026-07-07T06:00'))), '2026-07-08T22:00');
eq('E5  NightHol nWI(di 22:00)=wo 22:00', F(engNightHol.nextWorkInstant(I('2026-07-07T22:00'))), '2026-07-08T22:00');

eq('F1  247 nWI(ma 00:00)=ma 00:00', F(eng247.nextWorkInstant(I('2026-07-06'))), '2026-07-06T00:00');
eq('F2  247 +1800m van ma 00:00=di 06:00', F(eng247.addWorkMinutes(I('2026-07-06'), 1800)), '2026-07-07T06:00');
eq('F3  247 nWI(di 06:00)=di 06:00', F(eng247.nextWorkInstant(I('2026-07-07T06:00'))), '2026-07-07T06:00');
eq('F4  247 +720m van di 06:00=di 18:00', F(eng247.addWorkMinutes(I('2026-07-07T06:00'), 720)), '2026-07-07T18:00');
eq('F5  247 -1800m van di 06:00=ma 00:00', F(eng247.subtractWorkMinutes(I('2026-07-07T06:00'), 1800)), '2026-07-06T00:00');
eq('F6  247 isWork(zo 12:00)=true', eng247.isWorkInstant(I('2026-07-12T12:00')), true);
eq('F7  247 +480m van za 20:00=zo 04:00', F(eng247.addWorkMinutes(I('2026-07-11T20:00'), 480)), '2026-07-12T04:00');

eq('G1  H8 hoursPerDay=8', engH8.hoursPerDay, 8);
eq('G2  Hbreak hoursPerDay=8 (240+240)', engHbreak.hoursPerDay, 8);
eq('G3  Night hoursPerDay=8 (480m)', engNight.hoursPerDay, 8);
eq('G4  247 hoursPerDay=24', eng247.hoursPerDay, 24);
eq('G5  H10 hoursPerDay=10', engH10.hoursPerDay, 10);
const engUneven = new CalendarEngine(cal('Uneven', { byWeekday: {
  1: [{ start: 480, end: 1020 }], 2: [{ start: 480, end: 1020 }], 3: [{ start: 480, end: 1020 }],
  4: [{ start: 480, end: 1020 }], 5: [{ start: 480, end: 720 }], 6: [], 7: [],
} }));
eq('G6  Uneven (ma-do 9u, vr 4u) hoursPerDay=9', engUneven.hoursPerDay, 9);
const engTie = new CalendarEngine(cal('Tie', { byWeekday: {
  1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 1020 }],
  4: [{ start: 480, end: 1020 }], 5: [], 6: [], 7: [],
} }));
eq('G7  Tie (2×8u,2×9u) hoursPerDay=9 (tie-break hoogste)', engTie.hoursPerDay, 9);

const memoCal = cal('Memo', w5([{ start: 480, end: 960 }]));
const engM1 = new CalendarEngine(memoCal);
const engM2 = new CalendarEngine(memoCal);
eq('H1  gedeelde cache-identiteit (===)', engM1.bandCacheRef() === engM2.bandCacheRef(), true);
eq('H2  begin-fills = 0 (constructor materialiseert niet)', engM1.materializationCount(), 0);
engM1.nextWorkInstant(I('2026-07-06T12:00'));
eq('H3  na eng1-werk: fills = 3 (za,zo,ma)', engM1.materializationCount(), 3);
eq('H4  eng2 ziet dezelfde gedeelde teller = 3', engM2.materializationCount(), 3);
engM2.nextWorkInstant(I('2026-07-06T12:00'));
eq('H5  herhaalde query: nog steeds 3 (gememoized)', engM2.materializationCount(), 3);

eq('J1  H8 signed +240 van ma 12:00=ma 16:00', F(engH8.addWorkingMinutesSigned(I('2026-07-06T12:00'), 240)), '2026-07-06T16:00');
eq('J2  H8 signed -240 van ma 12:00=ma 08:00', F(engH8.addWorkingMinutesSigned(I('2026-07-06T12:00'), -240)), '2026-07-06T08:00');
eq('J3  H8 signed 0 van ma 16:00=di 08:00 (normalisatie)', F(engH8.addWorkingMinutesSigned(I('2026-07-06T16:00'), 0)), '2026-07-07T08:00');
eq('J4  H8 between(ma 08:00,di 12:00)=720', engH8.workMinutesBetween(I('2026-07-06T08:00'), I('2026-07-07T12:00')), 720);
eq('J5  H8 between(di 12:00,ma 08:00)=-720', engH8.workMinutesBetween(I('2026-07-07T12:00'), I('2026-07-06T08:00')), -720);
eq('J6  H8 between(x,x)=0', engH8.workMinutesBetween(I('2026-07-06T10:00'), I('2026-07-06T10:00')), 0);
eq('J7  H8 scenario-6a S.ES=di 08:00', F(engH8.nextWorkInstant(engH8.addWorkingMinutesSigned(I('2026-07-06T12:00'), 240))), '2026-07-07T08:00');

const engDay = new CalendarEngine(cal('Day', undefined, [], 8));
eq('I1  scalaire kalender rekent op werkblokken', engDay.isHourMode, true);
eq('I2  Day hoursPerDay=8 (opgegeven)', engDay.hoursPerDay, 8);
eq('I3  scalaire kalender houdt ma 12:00 als werkmoment', F(engDay.nextWorkInstant(I('2026-07-06T12:00'))), '2026-07-06T12:00');
eq('I3b scalaire kalender heeft een bandcache', engDay.materializationCount() > 0, true);
eq('I4  Day addWorkDays(ma,5)=vr', formatDate(engDay.addWorkDays(I('2026-07-06'), 5)), '2026-07-10');
eq('I5  Day nextWorkDayAfter(vr)=ma13', formatDate(engDay.nextWorkDayAfter(I('2026-07-10'))), '2026-07-13');
eq('I6  Day subtractWorkDays(vr,5)=ma', formatDate(engDay.subtractWorkDays(I('2026-07-10'), 5)), '2026-07-06');
eq('I7  Day prevWorkDayBefore(ma13)=vr', formatDate(engDay.prevWorkDayBefore(I('2026-07-13'))), '2026-07-10');
eq('I8  Day isWorkDay(za)=false', engDay.isWorkDay(I('2026-07-11')), false);
eq('I9  Day isWorkDay(ma)=true', engDay.isWorkDay(I('2026-07-06')), true);
eq('I10 Day addWorkingDaysSigned(ma,3)=do', formatDate(engDay.addWorkingDaysSigned(I('2026-07-06'), 3)), '2026-07-09');

const seedDefault = seedScalarWorkTime([1, 2, 3, 4, 5], 7, 16, 8);
eq('L1  seed default(7-16,8u): deriveHoursPerDay=8 (regressiekern)', deriveHoursPerDay(seedDefault, 8), 8);
eq('L2  seed default ma = 2 banden (pauze-gat)', seedDefault.byWeekday[1].length, 2);
eq('L3  seed default band1 = 07:00-12:00', JSON.stringify(seedDefault.byWeekday[1][0]), JSON.stringify({ start: 420, end: 720 }));
eq('L4  seed default band2 = 13:00-16:00', JSON.stringify(seedDefault.byWeekday[1][1]), JSON.stringify({ start: 780, end: 960 }));
const seed816 = seedScalarWorkTime([1, 2, 3, 4, 5], 8, 16, 8);
eq('L5  seed(8-16,8u): één band', seed816.byWeekday[1].length, 1);
eq('L6  seed(8-16,8u): deriveHoursPerDay=8', deriveHoursPerDay(seed816, 8), 8);
const seed247 = seedScalarWorkTime([1, 2, 3, 4, 5, 6, 7], 0, 24, 24);
eq('L7  seed(0-24,24u): deriveHoursPerDay=24', deriveHoursPerDay(seed247, 24), 24);
eq('L8  seed(0-24,24u): één band [0,1440]', JSON.stringify(seed247.byWeekday[1]), JSON.stringify([{ start: 0, end: 1440 }]));
const bnd = seedScalarBands(360, 1080, 10);
eq('L9  seedScalarBands(6-18,10u) som=600m (=10u)', bnd.reduce((s, x) => s + (x.end - x.start), 0), 600);
const seed9175 = seedScalarBands(540, 1020, 7.5);
eq('L10 seed(9-17,7.5u) legt de 30m pauze direct na 12:00', JSON.stringify(seed9175), JSON.stringify([
  { start: 540, end: 720 }, { start: 750, end: 1020 },
]));

const engNoExc = new CalendarEngine(cal('NoExc'));
eq('M1  controle zonder uitzondering: workDaysBetween(ma6,za11)=5', engNoExc.workDaysBetween(I('2026-07-06'), I('2026-07-11')), 5);
eq('M2  controle zonder uitzondering: isWorkDay(za11)=false', engNoExc.isWorkDay(I('2026-07-11')), false);

const engWorkSat = new CalendarEngine({
  ...cal('WorkSat'),
  workingExceptions: [{ name: 'Werkende zaterdag', startDate: '2026-07-11', endDate: '2026-07-11' }],
});
eq('M3  WorkSat isWorkDay(za11)=true (uitzondering)', engWorkSat.isWorkDay(I('2026-07-11')), true);
eq('M4  WorkSat workDaysBetween(ma6,za11)=6 (5 gewone + 1 uitzondering, val-kuil-index)', engWorkSat.workDaysBetween(I('2026-07-06'), I('2026-07-11')), 6);
eq('M5  WorkSat addWorkDays(ma6,6)=za11 (6e werkdag = de werkende zaterdag)', formatDate(engWorkSat.addWorkDays(I('2026-07-06'), 6)), '2026-07-11');
eq('M6  WorkSat isWorkDay(zo12)=false (geen uitzondering op zondag)', engWorkSat.isWorkDay(I('2026-07-12')), false);
eq('M7  WorkSat workDaysBetween(ma6,zo12)=6 (za11 telt, zo12 niet)', engWorkSat.workDaysBetween(I('2026-07-06'), I('2026-07-12')), 6);

const engWorkSatBands = new CalendarEngine({
  ...cal('WorkSatBands', w5([{ start: 480, end: 960 }])),
  workingExceptions: [{
    name: 'Werkende zaterdag (halve dag)', startDate: '2026-07-11', endDate: '2026-07-11',
    bands: [{ start: 360, end: 720 }],
  }],
});
eq('M8  WorkSatBands workMinutesBetween(za11 00:00,zo12 00:00)=360 (override-band)', engWorkSatBands.workMinutesBetween(I('2026-07-11'), I('2026-07-12')), 360);
eq('M9  WorkSatBands isWork(za11 09:00)=true (binnen override-band)', engWorkSatBands.isWorkInstant(I('2026-07-11T09:00')), true);
eq('M10 WorkSatBands isWork(za11 13:00)=false (buiten override-band, band eindigt 12:00)', engWorkSatBands.isWorkInstant(I('2026-07-11T13:00')), false);

const w7H8 = w7([{ start: 480, end: 960 }]);
const engSatHolWorking = new CalendarEngine({
  ...cal('SatHolWorking', w7H8, [{ name: 'Zaterdag dicht (normaal)', startDate: '2026-07-11', endDate: '2026-07-11' }]),
  workingExceptions: [{ name: 'Toch open (precedentie, geen eigen banden)', startDate: '2026-07-11', endDate: '2026-07-11' }],
});
eq('M11 SatHolWorking workMinutesBetween(za11,zo12)=480 (uitzondering wint van holiday + fallback op standaardbanden)', engSatHolWorking.workMinutesBetween(I('2026-07-11'), I('2026-07-12')), 480);
const engSatHolPlain = new CalendarEngine(cal('SatHolPlain', w7H8, [{ name: 'Zaterdag dicht', startDate: '2026-07-11', endDate: '2026-07-11' }]));
eq('M12 controle SatHolPlain workMinutesBetween(za11,zo12)=0 (holiday onderdrukt zonder override)', engSatHolPlain.workMinutesBetween(I('2026-07-11'), I('2026-07-12')), 0);

const engHolOverridden = new CalendarEngine({
  ...cal('HolOverridden', undefined, [{ name: 'Verkeerd-aangemerkte vrije dag', startDate: '2026-07-06', endDate: '2026-07-06' }]),
  workingExceptions: [{ name: 'Toch werkend (precedentie)', startDate: '2026-07-06', endDate: '2026-07-06' }],
});
eq('M13 HolOverridden isWorkDay(ma6)=true (uitzondering wint van holiday)', engHolOverridden.isWorkDay(I('2026-07-06')), true);
eq('M14 HolOverridden isHoliday(2026-07-06)=false (uitzondering overrulet)', engHolOverridden.isHoliday('2026-07-06'), false);
eq('M15 HolOverridden workDaysBetween(ma6,ma6)=1 (HOOG-1: isWorkDay en workDaysBetween moeten het eens zijn)', engHolOverridden.workDaysBetween(I('2026-07-06'), I('2026-07-06')), 1);
eq('M16 HolOverridden workDaysBetween(ma6,di7)=2 (overruled ma6 + gewone werkdag di7, geen dubbele aftrek)', engHolOverridden.workDaysBetween(I('2026-07-06'), I('2026-07-07')), 2);
const engHolPlain = new CalendarEngine(cal('HolPlain', undefined, [{ name: 'Vrije dag', startDate: '2026-07-06', endDate: '2026-07-06' }]));
eq('M17 controle HolPlain isWorkDay(ma6)=false (holiday zonder override)', engHolPlain.isWorkDay(I('2026-07-06')), false);
eq('M18 controle HolPlain workDaysBetween(ma6,ma6)=0 (holiday zonder override telt niet)', engHolPlain.workDaysBetween(I('2026-07-06'), I('2026-07-06')), 0);

const engEmptyExc = new CalendarEngine({ ...cal('EmptyExc'), workingExceptions: [] });
eq('M19 lege workingExceptions-array = byte-identiek aan afwezig veld', engEmptyExc.workDaysBetween(I('2026-07-06'), I('2026-07-11')), 5);

const engWorkMonNormal = new CalendarEngine({
  ...cal('WorkMonNormal'),
  workingExceptions: [{ name: 'Overbodige uitzondering op een gewone werkdag', startDate: '2026-07-06', endDate: '2026-07-06' }],
});
eq('M20 WorkMonNormal workDaysBetween(ma6,ma6)=1 (geen dubbeltelling)', engWorkMonNormal.workDaysBetween(I('2026-07-06'), I('2026-07-06')), 1);
eq('M21 WorkMonNormal workDaysBetween(ma6,vr10)=5 (hele week, ongewijzigd)', engWorkMonNormal.workDaysBetween(I('2026-07-06'), I('2026-07-10')), 5);
eq('M22 WorkMonNormal workDaysBetween(zo5,ma6)=1 (zo5 telt niet, ma6 precies één keer)', engWorkMonNormal.workDaysBetween(I('2026-07-05'), I('2026-07-06')), 1);
eq('M23 WorkMonNormal addWorkDays(ma6,1)=ma6 (ongewijzigd)', formatDate(engWorkMonNormal.addWorkDays(I('2026-07-06'), 1)), '2026-07-06');
eq('M24 WorkMonNormal addWorkDays(ma6,5)=vr10 (ongewijzigd)', formatDate(engWorkMonNormal.addWorkDays(I('2026-07-06'), 5)), '2026-07-10');

const engWorkSatNoBands = new CalendarEngine({
  ...cal('WorkSatNoBands', w5([{ start: 480, end: 960 }])),
  workingExceptions: [{ name: 'Werkende zaterdag zonder eigen banden', startDate: '2026-07-11', endDate: '2026-07-11' }],
});
eq('M25 WorkSatNoBands workMinutesBetween(za11,zo12)=480 (valt terug op standaard-werkdagbanden, niet 0)', engWorkSatNoBands.workMinutesBetween(I('2026-07-11'), I('2026-07-12')), 480);
eq('M26 WorkSatNoBands workMinutesBetween(zo12,ma13)=0 (zondag blijft ongemoeid, geen lekkage van de fallback)', engWorkSatNoBands.workMinutesBetween(I('2026-07-12'), I('2026-07-13')), 0);

const engHolElsewhereExcElsewhere = new CalendarEngine({
  ...cal('HolElsewhereExcElsewhere', undefined, [{ name: 'Feestdag (di)', startDate: '2026-07-07', endDate: '2026-07-07' }]),
  workingExceptions: [{ name: 'Werkende zaterdag (elders)', startDate: '2026-07-11', endDate: '2026-07-11' }],
});
eq('M27 HolElsewhereExcElsewhere isWorkDay(di7)=false (holiday blijft holiday, ook met workingExceptions elders)', engHolElsewhereExcElsewhere.isWorkDay(I('2026-07-07')), false);
eq('M28 HolElsewhereExcElsewhere addWorkDays(ma6,4)=vr10 (di7 overgeslagen, niet do9)', formatDate(engHolElsewhereExcElsewhere.addWorkDays(I('2026-07-06'), 4)), '2026-07-10');
eq('M29 HolElsewhereExcElsewhere isWorkDay(za11)=true (de werkende uitzondering zelf werkt nog gewoon)', engHolElsewhereExcElsewhere.isWorkDay(I('2026-07-11')), true);

const engAsymmetric = new CalendarEngine({
  ...cal('Asymmetric', {
    byWeekday: {
      1: [{ start: 480, end: 720 }],
      2: [{ start: 480, end: 960 }],
      3: [{ start: 480, end: 960 }],
      4: [{ start: 480, end: 960 }],
      5: [{ start: 480, end: 960 }],
      6: [], 7: [],
    },
  }),
  workingExceptions: [{ name: 'Werkende zaterdag zonder eigen banden', startDate: '2026-07-11', endDate: '2026-07-11' }],
});
eq('M30 Asymmetric hoursPerDay=8 (modaal, controle)', engAsymmetric.hoursPerDay, 8);
eq('M31 Asymmetric workMinutesBetween(za11,zo12)=480 (modale standaardbanden, niet de eerste-dag 240m)', engAsymmetric.workMinutesBetween(I('2026-07-11'), I('2026-07-12')), 480);

const overlapCal: WorkCalendar = { ...cal('nacht met zaterdag', w5([{ start: 1320, end: 1800 }])),
  workingExceptions: [{ name: 'Zaterdag open', startDate: '2026-06-06', endDate: '2026-06-06',
    bands: [{ start: 0, end: 1440 }] }] };
const overlap = new CalendarEngine(overlapCal);
const sat = I('2026-06-06T00:00');
const sun = I('2026-06-07T00:00');
eq('462 zaterdag: precies 1440 minuten, geen dubbele nachtstaart', overlap.workMinutesBetween(sat, sun), 1440);
eq('462 vrijdag 22 tot zondag 00: 26 uur', overlap.workMinutesBetween(I('2026-06-05T22:00'), sun), 1560);
eq('462 vooruit 24 uur vanaf zaterdag 00', F(overlap.addWorkMinutes(sat, 1440)), '2026-06-07T00:00');
eq('462 achteruit 24 uur vanaf zondag 00', F(overlap.subtractWorkMinutes(sun, 1440)), '2026-06-06T00:00');
const intervals462 = overlap.workIntervalsBetween(sat, sun);
eq('462 gedeelde intervallen boeken ook precies 24 uur', intervals462.reduce((n, b) => n + (b.end.getTime() - b.start.getTime()) / 60000, 0), 1440);
eq('462 lange telling via de prefixsom: 22 nachten minus laatste staart plus 18 extra uur',
  overlap.workMinutesBetween(I('2026-06-01'), I('2026-07-01')), 11280);
eq('462 omgekeerd is de telling negatief', overlap.workMinutesBetween(sun, sat), -1440);

if (diffs.length === 0) {
  console.log(`OK  calendar-hours-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  calendar-hours-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
