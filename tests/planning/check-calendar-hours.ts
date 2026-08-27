// CalendarEngine uur-modus-checks (fase 2.8b, golf 1, ontwerpdoc §4 + §9).
// Onafhankelijk narekenen — ELKE verwachting met de hand stap-voor-stap uitgerekend tegen de
// referentiekalenders (§9) en de aangescherpte grens-conventies (§4.1):
//   band = [start, end);  nextWorkInstant(t)=t als t∈[start,end) anders volgende bandstart;
//   prevWorkInstant(t)=t als t∈(start,end] anders laatste band-eind ≤ t; strikte varianten "After"/"Before".
//
// Referentiedagen (geverifieerd, §9): ma 6, di 7, wo 8, do 9, vr 10, za 11, zo 12 juli 2026; ma 13 juli.
// Minuten-vanaf-middernacht: 00:00=0, 02:00=120, 06:00=360, 08:00=480, 12:00=720, 12:30=750,
//   14:30=870, 16:00=960, 16:30=990, 17:00=1020, 18:00=1080, 20:00=1200, 22:00=1320, 06:00(wrap)=1800.
//
// Draait via run.sh (esbuild-bundel, zoals check-datetime.ts). Exit 0 = alles groen.
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

// ── Referentiekalenders (§9) ─────────────────────────────────────────────────
const engH8 = new CalendarEngine(cal('H8', w5([{ start: 480, end: 960 }])));                          // ma-vr 08:00-16:00
const engHbreak = new CalendarEngine(cal('Hbreak', w5([{ start: 480, end: 720 }, { start: 750, end: 990 }]))); // 08-12 + 12:30-16:30
const engNight = new CalendarEngine(cal('Night', w5([{ start: 1320, end: 1800 }])));                  // ma-vr 22:00→06:00 (wrap)
const eng247 = new CalendarEngine(cal('247', w7([{ start: 0, end: 1440 }]), [], 24, [1, 2, 3, 4, 5, 6, 7]));
const engH10 = new CalendarEngine(cal('H10', w5([{ start: 480, end: 1080 }]), [], 10));               // ma-vr 08:00-18:00 (10u)

const I = (s: string) => parseInstant(s);
const F = (d: Date) => formatInstant(d, 'hour');

// ═══════════════════════════════════════════════════════════════════════════
// A) H8 — scenario 1 (forward + backward): FS+0 binnen-dag-koppeling.
//    A(12u=720m), B(4u=240m), A→FS+0 B. Projectstart ma 6 00:00.
// ═══════════════════════════════════════════════════════════════════════════
// A.ES = nWI(ma 00:00): ma 00:00 niet in [480,960) ⇒ eerstvolgende bandstart = ma 08:00.
eq('A1  H8 nWI(ma 00:00)=ma 08:00', F(engH8.nextWorkInstant(I('2026-07-06'))), '2026-07-06T08:00');
// A.EF = addWorkMinutes(ma 08:00, 720): ma 08-16 = 480 (rest 240) → di 08:00 +240 = di 12:00.
eq('A2  H8 +720m van ma 08:00=di 12:00', F(engH8.addWorkMinutes(I('2026-07-06T08:00'), 720)), '2026-07-07T12:00');
// B.ES = nWI(di 12:00) = di 12:00 (in band).
eq('A3  H8 nWI(di 12:00)=di 12:00', F(engH8.nextWorkInstant(I('2026-07-07T12:00'))), '2026-07-07T12:00');
// B.EF = addWorkMinutes(di 12:00, 240) = di 16:00 (band-eind, legitiem).
eq('A4  H8 +240m van di 12:00=di 16:00', F(engH8.addWorkMinutes(I('2026-07-07T12:00'), 240)), '2026-07-07T16:00');
// Backward B: subtractWorkMinutes(di 16:00, 240) = di 12:00.
eq('A5  H8 -240m van di 16:00=di 12:00', F(engH8.subtractWorkMinutes(I('2026-07-07T16:00'), 240)), '2026-07-07T12:00');
// Backward A.LF = pWI(B.LS di 12:00) = di 12:00 (in (480,960]).
eq('A6  H8 pWI(di 12:00)=di 12:00', F(engH8.prevWorkInstant(I('2026-07-07T12:00'))), '2026-07-07T12:00');
// Backward A.LS = subtractWorkMinutes(di 12:00, 720): di 12-08 = 240 (rest 480) → ma 16-08 = 480 ⇒ ma 08:00.
eq('A7  H8 -720m van di 12:00=ma 08:00', F(engH8.subtractWorkMinutes(I('2026-07-07T12:00'), 720)), '2026-07-06T08:00');
// isWorkInstant-randen.
eq('A8  H8 isWork(ma 12:00)=true', engH8.isWorkInstant(I('2026-07-06T12:00')), true);
eq('A9  H8 isWork(ma 16:00)=false (band-eind excl.)', engH8.isWorkInstant(I('2026-07-06T16:00')), false);
eq('A10 H8 isWork(ma 07:59)=false (vóór start)', engH8.isWorkInstant(I('2026-07-06T07:59')), false);

// ═══════════════════════════════════════════════════════════════════════════
// B) H8 — grens-conventies (§4.1, Bevinding 4).
// ═══════════════════════════════════════════════════════════════════════════
// nWI op band-eind ⇒ volgende bandstart (di 08:00).
eq('B1  H8 nWI(ma 16:00)=di 08:00', F(engH8.nextWorkInstant(I('2026-07-06T16:00'))), '2026-07-07T08:00');
// nWIAfter(ma 12:00): eerste bandstart strikt > 12:00 = di 08:00.
eq('B2  H8 nWIAfter(ma 12:00)=di 08:00', F(engH8.nextWorkInstantAfter(I('2026-07-06T12:00'))), '2026-07-07T08:00');
// nWIAfter op bandstart zelf (ma 08:00): strikt > ⇒ di 08:00.
eq('B3  H8 nWIAfter(ma 08:00)=di 08:00', F(engH8.nextWorkInstantAfter(I('2026-07-06T08:00'))), '2026-07-07T08:00');
// pWI op bandstart (ma 08:00): niet in (480,960] ⇒ laatste band-eind ≤ = vr 3 juli 16:00.
eq('B4  H8 pWI(ma 08:00)=vr3 16:00', F(engH8.prevWorkInstant(I('2026-07-06T08:00'))), '2026-07-03T16:00');
// pWI op band-eind (ma 16:00): legitieme finish ⇒ ma 16:00.
eq('B5  H8 pWI(ma 16:00)=ma 16:00', F(engH8.prevWorkInstant(I('2026-07-06T16:00'))), '2026-07-06T16:00');
// pWIBefore(ma 16:00): laatste band-eind STRIKT < ma 16:00 = vr 3 juli 16:00.
eq('B6  H8 pWIBefore(ma 16:00)=vr3 16:00', F(engH8.prevWorkInstantBefore(I('2026-07-06T16:00'))), '2026-07-03T16:00');
// pWIBefore(di 08:00): laatste band-eind < di 08:00 = ma 16:00.
eq('B7  H8 pWIBefore(di 08:00)=ma 16:00', F(engH8.prevWorkInstantBefore(I('2026-07-07T08:00'))), '2026-07-06T16:00');
// subtract vanaf bandstart (di 08:00, 240m): pWI(di 08:00)=ma 16:00, -240 = ma 12:00.
eq('B8  H8 -240m van di 08:00=ma 12:00', F(engH8.subtractWorkMinutes(I('2026-07-07T08:00'), 240)), '2026-07-06T12:00');

// ═══════════════════════════════════════════════════════════════════════════
// C) H-break — scenario 3 (lunchpauze). A(6u=360m), B(4u=240m).
// ═══════════════════════════════════════════════════════════════════════════
// A.EF: 360m van ma 08:00: band1 08-12 = 240 (rest 120); lunch overslaan; band2 12:30 +120 = ma 14:30.
eq('C1  Hbreak +360m van ma 08:00=ma 14:30', F(engHbreak.addWorkMinutes(I('2026-07-06T08:00'), 360)), '2026-07-06T14:30');
// nWI(ma 12:00): 12:00 = band1-eind ⇒ volgende bandstart = ma 12:30.
eq('C2  Hbreak nWI(ma 12:00)=ma 12:30', F(engHbreak.nextWorkInstant(I('2026-07-06T12:00'))), '2026-07-06T12:30');
// Lunchgat 12:00-12:30 is niet-werkend.
eq('C3  Hbreak isWork(ma 12:15)=false (lunch)', engHbreak.isWorkInstant(I('2026-07-06T12:15')), false);
// nWI middenin lunch ⇒ volgende bandstart.
eq('C4  Hbreak nWI(ma 12:15)=ma 12:30', F(engHbreak.nextWorkInstant(I('2026-07-06T12:15'))), '2026-07-06T12:30');
// B.EF: 240m van ma 14:30: 14:30-16:30 = 120 (rest 120); di band1 08:00 +120 = di 10:00.
eq('C5  Hbreak +240m van ma 14:30=di 10:00', F(engHbreak.addWorkMinutes(I('2026-07-06T14:30'), 240)), '2026-07-07T10:00');
// Backward B.LS: -240m van di 10:00: di 10-08 = 120 (rest 120); ma band2 16:30→14:30 = 120 ⇒ ma 14:30.
eq('C6  Hbreak -240m van di 10:00=ma 14:30', F(engHbreak.subtractWorkMinutes(I('2026-07-07T10:00'), 240)), '2026-07-06T14:30');
// Backward A.LS: -360m van ma 14:30: 14:30→12:30 = 120 (rest 240); lunch; band1 12:00→08:00 = 240 ⇒ ma 08:00.
eq('C7  Hbreak -360m van ma 14:30=ma 08:00', F(engHbreak.subtractWorkMinutes(I('2026-07-06T14:30'), 360)), '2026-07-06T08:00');

// ═══════════════════════════════════════════════════════════════════════════
// D) Night — scenario 4 (ploeg over middernacht) + weekend-gat.
//    Werk-intervallen: ma 22:00→di 06:00, di 22:00→wo 06:00, … A(8u=480m), B(4u=240m).
// ═══════════════════════════════════════════════════════════════════════════
// A.ES = nWI(ma 00:00) = ma's shiftstart 22:00.
eq('D1  Night nWI(ma 00:00)=ma 22:00', F(engNight.nextWorkInstant(I('2026-07-06'))), '2026-07-06T22:00');
// A.EF: 480m van ma 22:00: 22-24 = 120 + di 00-06 = 360 ⇒ di 06:00 (middernacht gekruist).
eq('D2  Night +480m van ma 22:00=di 06:00', F(engNight.addWorkMinutes(I('2026-07-06T22:00'), 480)), '2026-07-07T06:00');
// B.ES = nWI(di 06:00): di 06:00 = shift-eind ⇒ volgende bandstart = di 22:00.
eq('D3  Night nWI(di 06:00)=di 22:00', F(engNight.nextWorkInstant(I('2026-07-07T06:00'))), '2026-07-07T22:00');
// B.EF: di 22:00 + 240m = wo 02:00.
eq('D4  Night +240m van di 22:00=wo 02:00', F(engNight.addWorkMinutes(I('2026-07-07T22:00'), 240)), '2026-07-08T02:00');
// Staart van ma-wrap: di 02:00 valt in [ma 22:00, di 06:00).
eq('D5  Night isWork(di 02:00)=true (wrap-staart)', engNight.isWorkInstant(I('2026-07-07T02:00')), true);
// Tussen shifts (di 12:00) = niet-werkend.
eq('D6  Night isWork(di 12:00)=false', engNight.isWorkInstant(I('2026-07-07T12:00')), false);
// Backward A.LF = pWI(di 22:00): di 22:00 = bandstart ⇒ laatste band-eind ≤ = di 06:00.
eq('D7  Night pWI(di 22:00)=di 06:00', F(engNight.prevWorkInstant(I('2026-07-07T22:00'))), '2026-07-07T06:00');
// Backward A.LS: -480m van di 06:00: 06:00→00:00 = 360; ma 24:00→22:00 = 120 ⇒ ma 22:00.
eq('D8  Night -480m van di 06:00=ma 22:00', F(engNight.subtractWorkMinutes(I('2026-07-07T06:00'), 480)), '2026-07-06T22:00');
// Backward B.LS: -240m van wo 02:00 = di 22:00.
eq('D9  Night -240m van wo 02:00=di 22:00', F(engNight.subtractWorkMinutes(I('2026-07-08T02:00'), 240)), '2026-07-07T22:00');
// Weekend-gat: vr-shift eindigt za 06:00; nWI(za 06:00) = ma 13 juli 22:00 (za/zo geen banden).
eq('D10 Night nWI(za 06:00)=ma13 22:00', F(engNight.nextWorkInstant(I('2026-07-11T06:00'))), '2026-07-13T22:00');
// vr-nacht loopt door tot za 06:00 (staart bij vrijdag).
eq('D11 Night +480m van vr 22:00=za 06:00', F(engNight.addWorkMinutes(I('2026-07-10T22:00'), 480)), '2026-07-11T06:00');

// ═══════════════════════════════════════════════════════════════════════════
// E) Night + holiday op DINSDAG (Bevinding 9: holiday onderdrukt alleen de shift die díé dag START).
// ═══════════════════════════════════════════════════════════════════════════
const engNightHol = new CalendarEngine(cal('NightHol', w5([{ start: 1320, end: 1800 }]),
  [{ name: 'HL', startDate: '2026-07-07', endDate: '2026-07-07' }]));
// Ma-shift loopt door tot di 06:00 (start op maandag, NIET onderdrukt).
eq('E1  NightHol +480m van ma 22:00=di 06:00', F(engNightHol.addWorkMinutes(I('2026-07-06T22:00'), 480)), '2026-07-07T06:00');
// Ma-staart in di-ochtend blijft werkend.
eq('E2  NightHol isWork(di 02:00)=true (ma-staart)', engNightHol.isWorkInstant(I('2026-07-07T02:00')), true);
// Di-eigen shift (start op di = holiday) vervalt.
eq('E3  NightHol isWork(di 23:00)=false (di-shift vervalt)', engNightHol.isWorkInstant(I('2026-07-07T23:00')), false);
// FS+0-opvolger na di 06:00: di-shift weg ⇒ volgende start = wo 22:00.
eq('E4  NightHol nWI(di 06:00)=wo 22:00', F(engNightHol.nextWorkInstant(I('2026-07-07T06:00'))), '2026-07-08T22:00');
// Op het onderdrukte di 22:00-moment ⇒ ook wo 22:00.
eq('E5  NightHol nWI(di 22:00)=wo 22:00', F(engNightHol.nextWorkInstant(I('2026-07-07T22:00'))), '2026-07-08T22:00');

// ═══════════════════════════════════════════════════════════════════════════
// F) 24/7 — scenario 5 (echt 24-uurs, geen gaten). A(30u=1800m), B(12u=720m).
// ═══════════════════════════════════════════════════════════════════════════
eq('F1  247 nWI(ma 00:00)=ma 00:00', F(eng247.nextWorkInstant(I('2026-07-06'))), '2026-07-06T00:00');
// A.EF: 1800m van ma 00:00 = 1440 (ma→di 00:00) + 360 ⇒ di 06:00.
eq('F2  247 +1800m van ma 00:00=di 06:00', F(eng247.addWorkMinutes(I('2026-07-06'), 1800)), '2026-07-07T06:00');
eq('F3  247 nWI(di 06:00)=di 06:00', F(eng247.nextWorkInstant(I('2026-07-07T06:00'))), '2026-07-07T06:00');
// B.EF: di 06:00 + 720m = di 18:00.
eq('F4  247 +720m van di 06:00=di 18:00', F(eng247.addWorkMinutes(I('2026-07-07T06:00'), 720)), '2026-07-07T18:00');
// Backward A.LS: -1800m van di 06:00 = ma 00:00.
eq('F5  247 -1800m van di 06:00=ma 00:00', F(eng247.subtractWorkMinutes(I('2026-07-07T06:00'), 1800)), '2026-07-06T00:00');
// Altijd werkend, ook weekend.
eq('F6  247 isWork(zo 12:00)=true', eng247.isWorkInstant(I('2026-07-12T12:00')), true);
// Naadloze middernacht-kruising zonder gat: za 20:00 + 480m = zo 04:00.
eq('F7  247 +480m van za 20:00=zo 04:00', F(eng247.addWorkMinutes(I('2026-07-11T20:00'), 480)), '2026-07-12T04:00');

// ═══════════════════════════════════════════════════════════════════════════
// G) Afgeleide hoursPerDay = modale band-som (§3.2, Bevinding 8), tie-break HOOGSTE.
// ═══════════════════════════════════════════════════════════════════════════
eq('G1  H8 hoursPerDay=8', engH8.hoursPerDay, 8);
eq('G2  Hbreak hoursPerDay=8 (240+240)', engHbreak.hoursPerDay, 8);
eq('G3  Night hoursPerDay=8 (480m)', engNight.hoursPerDay, 8);
eq('G4  247 hoursPerDay=24', eng247.hoursPerDay, 24);
eq('G5  H10 hoursPerDay=10', engH10.hoursPerDay, 10);
// ma-do 9u (540m), vr 4u (240m) ⇒ modaal 9.
const engUneven = new CalendarEngine(cal('Uneven', { byWeekday: {
  1: [{ start: 480, end: 1020 }], 2: [{ start: 480, end: 1020 }], 3: [{ start: 480, end: 1020 }],
  4: [{ start: 480, end: 1020 }], 5: [{ start: 480, end: 720 }], 6: [], 7: [],
} }));
eq('G6  Uneven (ma-do 9u, vr 4u) hoursPerDay=9', engUneven.hoursPerDay, 9);
// Tie: ma-di 8u, wo-do 9u (8 verschijnt EERST) ⇒ tie-break hoogste = 9.
const engTie = new CalendarEngine(cal('Tie', { byWeekday: {
  1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 1020 }],
  4: [{ start: 480, end: 1020 }], 5: [], 6: [], 7: [],
} }));
eq('G7  Tie (2×8u,2×9u) hoursPerDay=9 (tie-break hoogste)', engTie.hoursPerDay, 9);

// ═══════════════════════════════════════════════════════════════════════════
// H) Memoization gedeeld op het KALENDER-OBJECT (§5.6) — observeerbaar.
//    Twee engines op HETZELFDE object delen band-cache-identiteit + fills-teller.
// ═══════════════════════════════════════════════════════════════════════════
const memoCal = cal('Memo', w5([{ start: 480, end: 960 }]));
const engM1 = new CalendarEngine(memoCal);
const engM2 = new CalendarEngine(memoCal);
eq('H1  gedeelde cache-identiteit (===)', engM1.bandCacheRef() === engM2.bandCacheRef(), true);
eq('H2  begin-fills = 0 (constructor materialiseert niet)', engM1.materializationCount(), 0);
// nWI(ma 12:00): findContaining scant k=-2..0 ⇒ materialiseert za, zo, ma = 3 dag-misses.
engM1.nextWorkInstant(I('2026-07-06T12:00'));
eq('H3  na eng1-werk: fills = 3 (za,zo,ma)', engM1.materializationCount(), 3);
eq('H4  eng2 ziet dezelfde gedeelde teller = 3', engM2.materializationCount(), 3);
// Zelfde query op eng2: dagen al gecached ⇒ geen nieuwe fills.
engM2.nextWorkInstant(I('2026-07-06T12:00'));
eq('H5  herhaalde query: nog steeds 3 (gememoized)', engM2.materializationCount(), 3);

// ═══════════════════════════════════════════════════════════════════════════
// J) Signed offset / workMinutesBetween / lag (§4.2, §5.5, scenario 6a).
// ═══════════════════════════════════════════════════════════════════════════
// +240m signed van ma 12:00 = ma 16:00.
eq('J1  H8 signed +240 van ma 12:00=ma 16:00', F(engH8.addWorkingMinutesSigned(I('2026-07-06T12:00'), 240)), '2026-07-06T16:00');
// -240m signed van ma 12:00 = ma 08:00.
eq('J2  H8 signed -240 van ma 12:00=ma 08:00', F(engH8.addWorkingMinutesSigned(I('2026-07-06T12:00'), -240)), '2026-07-06T08:00');
// m=0 normaliseert naar nWI(ma 16:00) = di 08:00.
eq('J3  H8 signed 0 van ma 16:00=di 08:00 (normalisatie)', F(engH8.addWorkingMinutesSigned(I('2026-07-06T16:00'), 0)), '2026-07-07T08:00');
// workMinutesBetween(ma 08:00, di 12:00) = ma 480 + di 240 = 720.
eq('J4  H8 between(ma 08:00,di 12:00)=720', engH8.workMinutesBetween(I('2026-07-06T08:00'), I('2026-07-07T12:00')), 720);
// Omgekeerd = -720 (getekend).
eq('J5  H8 between(di 12:00,ma 08:00)=-720', engH8.workMinutesBetween(I('2026-07-07T12:00'), I('2026-07-06T08:00')), -720);
// Gelijk = 0.
eq('J6  H8 between(x,x)=0', engH8.workMinutesBetween(I('2026-07-06T10:00'), I('2026-07-06T10:00')), 0);
// Scenario 6a: FS+4u WORKTIME. lag-basis nWI(P.EF ma 12:00)=ma 12:00; +240 (pred) = ma 16:00; succ-snap nWI = di 08:00.
eq('J7  H8 scenario-6a S.ES=di 08:00', F(engH8.nextWorkInstant(engH8.addWorkingMinutesSigned(I('2026-07-06T12:00'), 240))), '2026-07-07T08:00');

// ═══════════════════════════════════════════════════════════════════════════
// K) Cross-modus-primitieven (§4.3, scenario 7) — engine-hulpfuncties (golf 2 bedraadt ze).
// ═══════════════════════════════════════════════════════════════════════════
const engDay = new CalendarEngine(cal('Day', undefined, [], 8)); // dag-kalender (geen workTime)
// Dag-voorganger: predDoneAt(D.EF di) = (di + 1 dag) @ 00:00 = wo 00:00.
eq('K1  Day predDoneAt(di)=wo 00:00', F(engDay.predDoneAt(I('2026-07-07'))), '2026-07-08T00:00');
// Uur-opvolger consumeert: availableStart(wo 00:00) = nWI(wo 00:00) = wo 08:00.
eq('K2  H8 availableStart(wo 00:00)=wo 08:00', F(engH8.availableStart(I('2026-07-08T00:00'))), '2026-07-08T08:00');
// Uur-voorganger: predDoneAt(ma 12:00) = de instant zelf.
eq('K3  H8 predDoneAt(ma 12:00)=ma 12:00', F(engH8.predDoneAt(I('2026-07-06T12:00'))), '2026-07-06T12:00');
// ceilToWorkDay mid-dag ⇒ volgende dag.
eq('K4  Day ceilToWorkDay(ma 12:00)=di 00:00', F(engDay.ceilToWorkDay(I('2026-07-06T12:00'))), '2026-07-07T00:00');
// ceilToWorkDay exact middernacht ⇒ zelfde dag.
eq('K5  Day ceilToWorkDay(ma 00:00)=ma 00:00', F(engDay.ceilToWorkDay(I('2026-07-06'))), '2026-07-06T00:00');
// Dag-opvolger: availableStart(ma 12:00) = nextWorkDay(ceil(ma 12:00)=di) = di.
eq('K6  Day availableStart(ma 12:00)=di 00:00', F(engDay.availableStart(I('2026-07-06T12:00'))), '2026-07-07T00:00');

// ═══════════════════════════════════════════════════════════════════════════
// I) DAG-MODUS-REGRESSIE — de bevroren dag-lussen geven de historisch-correcte antwoorden.
// ═══════════════════════════════════════════════════════════════════════════
eq('I1  Day isHourMode=false', engDay.isHourMode, false);
eq('I2  Day hoursPerDay=8 (opgegeven)', engDay.hoursPerDay, 8);
eq('I3  Day geen band-cache (0)', engDay.materializationCount(), 0);
// addWorkDays(ma,5): ma=dag1..vr=dag5 ⇒ vr 10.
eq('I4  Day addWorkDays(ma,5)=vr', formatDate(engDay.addWorkDays(I('2026-07-06'), 5)), '2026-07-10');
// nextWorkDayAfter(vr) slaat weekend over ⇒ ma 13.
eq('I5  Day nextWorkDayAfter(vr)=ma13', formatDate(engDay.nextWorkDayAfter(I('2026-07-10'))), '2026-07-13');
// subtractWorkDays(vr,5) ⇒ ma 6.
eq('I6  Day subtractWorkDays(vr,5)=ma', formatDate(engDay.subtractWorkDays(I('2026-07-10'), 5)), '2026-07-06');
// prevWorkDayBefore(ma13) ⇒ vr 10.
eq('I7  Day prevWorkDayBefore(ma13)=vr', formatDate(engDay.prevWorkDayBefore(I('2026-07-13'))), '2026-07-10');
eq('I8  Day isWorkDay(za)=false', engDay.isWorkDay(I('2026-07-11')), false);
eq('I9  Day isWorkDay(ma)=true', engDay.isWorkDay(I('2026-07-06')), true);
// addWorkingDaysSigned(ma,3): zuivere offset ⇒ do 9.
eq('I10 Day addWorkingDaysSigned(ma,3)=do', formatDate(engDay.addWorkingDaysSigned(I('2026-07-06'), 3)), '2026-07-09');

// ═══════════════════════════════════════════════════════════════════════════
// L) Banden-seed uit het scalar-dag-model (QA-fix golf, §2.3) — de band-som moet EXACT
//    `hoursPerDay × 60` zijn, zodat het openen+toepassen van de banden-editor op een dag-kalender
//    de afgeleide hoursPerDay NIET corrumpeert (de default 07:00-16:00/8u = 9 klokuren, 8 netto).
// ═══════════════════════════════════════════════════════════════════════════
const seedDefault = seedScalarWorkTime([1, 2, 3, 4, 5], 7, 16, 8);
// REGRESSIEKERN: ongewijzigd openen+toepassen houdt hoursPerDay op 8 (níét 9).
eq('L1  seed default(7-16,8u): deriveHoursPerDay=8 (regressiekern)', deriveHoursPerDay(seedDefault, 8), 8);
// De impliciete pauze wordt als gat rond het middaguur gematerialiseerd: 07:00-12:00 + 13:00-16:00.
eq('L2  seed default ma = 2 banden (pauze-gat)', seedDefault.byWeekday[1].length, 2);
eq('L3  seed default band1 = 07:00-12:00', JSON.stringify(seedDefault.byWeekday[1][0]), JSON.stringify({ start: 420, end: 720 }));
eq('L4  seed default band2 = 13:00-16:00', JSON.stringify(seedDefault.byWeekday[1][1]), JSON.stringify({ start: 780, end: 960 }));
// spanne == netto (08:00-16:00 op 8u) ⇒ één band, byte-identiek gedrag.
const seed816 = seedScalarWorkTime([1, 2, 3, 4, 5], 8, 16, 8);
eq('L5  seed(8-16,8u): één band', seed816.byWeekday[1].length, 1);
eq('L6  seed(8-16,8u): deriveHoursPerDay=8', deriveHoursPerDay(seed816, 8), 8);
// 24/7-scalar (0-24 op 24u) ⇒ één band [0,1440], hoursPerDay=24.
const seed247 = seedScalarWorkTime([1, 2, 3, 4, 5, 6, 7], 0, 24, 24);
eq('L7  seed(0-24,24u): deriveHoursPerDay=24', deriveHoursPerDay(seed247, 24), 24);
eq('L8  seed(0-24,24u): één band [0,1440]', JSON.stringify(seed247.byWeekday[1]), JSON.stringify([{ start: 0, end: 1440 }]));
// seedScalarBands direct: 06:00-18:00 op 10u (12 klokuren, 10 netto ⇒ 2u pauze rond 12:00) ⇒ som 600m.
const bnd = seedScalarBands(360, 1080, 10);
eq('L9  seedScalarBands(6-18,10u) som=600m (=10u)', bnd.reduce((s, x) => s + (x.end - x.start), 0), 600);

// ═══════════════════════════════════════════════════════════════════════════
// M) Fase 3.8 (T2, MSP-pariteit) — werkende uitzonderingen (`WorkCalendar.workingExceptions`).
//    Referentiedag: za 11 juli 2026 (normaal niet-werkend op Cal-MF, ma-vr).
//    Bewijst: (a) een werkende zaterdag in dag-modus telt als EXTRA werkdag (de val-kuil-index
//    `workingExceptionOnNonWorkWeekdayIdxSorted` in `workDaysBetween`), (b) een override-band op een
//    uurkalender geeft de juiste `workMinutesBetween`, (c) een werkende uitzondering PRECEDEERT boven
//    een holiday op dezelfde datum — zowel in dag- als uur-modus, én in `isHoliday`.
// ═══════════════════════════════════════════════════════════════════════════

// M1-M2 (controle, zonder uitzondering): za 11 telt normaal niet mee.
const engNoExc = new CalendarEngine(cal('NoExc'));
eq('M1  controle zonder uitzondering: workDaysBetween(ma6,za11)=5', engNoExc.workDaysBetween(I('2026-07-06'), I('2026-07-11')), 5);
eq('M2  controle zonder uitzondering: isWorkDay(za11)=false', engNoExc.isWorkDay(I('2026-07-11')), false);

// M3-M7 (a): werkende zaterdag in DAG-modus — één werkdag EXTRA (de val-kuil-index).
const engWorkSat = new CalendarEngine({
  ...cal('WorkSat'),
  workingExceptions: [{ name: 'Werkende zaterdag', startDate: '2026-07-11', endDate: '2026-07-11' }],
});
eq('M3  WorkSat isWorkDay(za11)=true (uitzondering)', engWorkSat.isWorkDay(I('2026-07-11')), true);
eq('M4  WorkSat workDaysBetween(ma6,za11)=6 (5 gewone + 1 uitzondering, val-kuil-index)', engWorkSat.workDaysBetween(I('2026-07-06'), I('2026-07-11')), 6);
eq('M5  WorkSat addWorkDays(ma6,6)=za11 (6e werkdag = de werkende zaterdag)', formatDate(engWorkSat.addWorkDays(I('2026-07-06'), 6)), '2026-07-11');
// zo 12 blijft niet-werkend (alleen za11 is uitzondering) — bewijst dat de index niet te breed telt.
eq('M6  WorkSat isWorkDay(zo12)=false (geen uitzondering op zondag)', engWorkSat.isWorkDay(I('2026-07-12')), false);
eq('M7  WorkSat workDaysBetween(ma6,zo12)=6 (za11 telt, zo12 niet)', engWorkSat.workDaysBetween(I('2026-07-06'), I('2026-07-12')), 6);

// M8-M10 (b): werkende uitzondering met AFWIJKENDE banden (06:00-12:00=360m) op een UURkalender.
const engWorkSatBands = new CalendarEngine({
  ...cal('WorkSatBands', w5([{ start: 480, end: 960 }])), // ma-vr 08:00-16:00 (H8-vorm)
  workingExceptions: [{
    name: 'Werkende zaterdag (halve dag)', startDate: '2026-07-11', endDate: '2026-07-11',
    bands: [{ start: 360, end: 720 }], // 06:00-12:00
  }],
});
eq('M8  WorkSatBands workMinutesBetween(za11 00:00,zo12 00:00)=360 (override-band)', engWorkSatBands.workMinutesBetween(I('2026-07-11'), I('2026-07-12')), 360);
eq('M9  WorkSatBands isWork(za11 09:00)=true (binnen override-band)', engWorkSatBands.isWorkInstant(I('2026-07-11T09:00')), true);
eq('M10 WorkSatBands isWork(za11 13:00)=false (buiten override-band, band eindigt 12:00)', engWorkSatBands.isWorkInstant(I('2026-07-11T13:00')), false);

// M11-M12 (c, UUR-modus): een werkende uitzondering ZONDER eigen banden op een dag die ook een holiday
// is — precedentie (de uitzondering wint) + fallback op de gewone weekdag-banden (§T2-ontwerp: "leeg =
// de weekdag-standaardbanden gelden"). w7-kalender zodat zaterdag al standaardbanden heeft (anders is
// een `0`-uitkomst dubbelzinnig tussen "precedentie werkt niet" en "zaterdag heeft toch geen banden").
const w7H8 = w7([{ start: 480, end: 960 }]); // alle 7 dagen 08:00-16:00
const engSatHolWorking = new CalendarEngine({
  ...cal('SatHolWorking', w7H8, [{ name: 'Zaterdag dicht (normaal)', startDate: '2026-07-11', endDate: '2026-07-11' }]),
  workingExceptions: [{ name: 'Toch open (precedentie, geen eigen banden)', startDate: '2026-07-11', endDate: '2026-07-11' }],
});
eq('M11 SatHolWorking workMinutesBetween(za11,zo12)=480 (uitzondering wint van holiday + fallback op standaardbanden)', engSatHolWorking.workMinutesBetween(I('2026-07-11'), I('2026-07-12')), 480);
// Controle: dezelfde kalender ZONDER de werkende uitzondering (alleen de holiday) — za11 blijft dicht.
const engSatHolPlain = new CalendarEngine(cal('SatHolPlain', w7H8, [{ name: 'Zaterdag dicht', startDate: '2026-07-11', endDate: '2026-07-11' }]));
eq('M12 controle SatHolPlain workMinutesBetween(za11,zo12)=0 (holiday onderdrukt zonder override)', engSatHolPlain.workMinutesBetween(I('2026-07-11'), I('2026-07-12')), 0);

// M13-M18 (c, DAG-modus): dezelfde precedentie voor `isWorkDay`/`isHoliday`/`workDaysBetween` — een
// maandag die zowel holiday als werkende uitzondering is, telt als werkend en is GEEN holiday meer.
// M15-M16 (review-bevinding HOOG-1): vóór de constructor-fix (buildWorkingExceptions() vóór
// holidayWorkdayIdxSorted + de `!workingExceptionDaySet.has(idx)`-filter) zei `isWorkDay`=true maar
// telde `workDaysBetween` deze dag NIET — `countWorkWeekdays` telde hem als gewone werk-weekdag, maar
// `countHolidayWorkdaysInRange` trok hem daarna alsnog af omdat hij ook in `holidays` stond. Dat gaf
// end-to-end een kritieke taak met totalFloat −1 (§CPM: workDaysBetween voedt de duur-/floatberekening).
const engHolOverridden = new CalendarEngine({
  ...cal('HolOverridden', undefined, [{ name: 'Verkeerd-aangemerkte vrije dag', startDate: '2026-07-06', endDate: '2026-07-06' }]),
  workingExceptions: [{ name: 'Toch werkend (precedentie)', startDate: '2026-07-06', endDate: '2026-07-06' }],
});
eq('M13 HolOverridden isWorkDay(ma6)=true (uitzondering wint van holiday)', engHolOverridden.isWorkDay(I('2026-07-06')), true);
eq('M14 HolOverridden isHoliday(2026-07-06)=false (uitzondering overrulet)', engHolOverridden.isHoliday('2026-07-06'), false);
eq('M15 HolOverridden workDaysBetween(ma6,ma6)=1 (HOOG-1: isWorkDay en workDaysBetween moeten het eens zijn)', engHolOverridden.workDaysBetween(I('2026-07-06'), I('2026-07-06')), 1);
eq('M16 HolOverridden workDaysBetween(ma6,di7)=2 (overruled ma6 + gewone werkdag di7, geen dubbele aftrek)', engHolOverridden.workDaysBetween(I('2026-07-06'), I('2026-07-07')), 2);
// Controle: dezelfde kalender ZONDER de uitzondering (alleen de holiday) — ma6 blijft gewoon vrij, ook
// in `workDaysBetween` (het contrast dat aantoont dat de holiday-aftrek zélf nog gewoon werkt).
const engHolPlain = new CalendarEngine(cal('HolPlain', undefined, [{ name: 'Vrije dag', startDate: '2026-07-06', endDate: '2026-07-06' }]));
eq('M17 controle HolPlain isWorkDay(ma6)=false (holiday zonder override)', engHolPlain.isWorkDay(I('2026-07-06')), false);
eq('M18 controle HolPlain workDaysBetween(ma6,ma6)=0 (holiday zonder override telt niet)', engHolPlain.workDaysBetween(I('2026-07-06'), I('2026-07-06')), 0);

// M19: een LEGE workingExceptions-array gedraagt zich identiek aan een AFWEZIG veld (byte-identiek-anker
// voor deze taak — de A-L-secties hierboven bewijzen ditzelfde impliciet voor alle 92 bestaande checks).
const engEmptyExc = new CalendarEngine({ ...cal('EmptyExc'), workingExceptions: [] });
eq('M19 lege workingExceptions-array = byte-identiek aan afwezig veld', engEmptyExc.workDaysBetween(I('2026-07-06'), I('2026-07-11')), 5);

// M20-M24 (review-bevinding MIDDEN-3, plan-case c "uitzondering op een gewone werkdag verandert
// niets"): een werkende uitzondering op maandag (2026-07-06, AL een gewone werkdag, GEEN holiday) mag
// noch de dagteling noch `addWorkDays` beïnvloeden. Bewijst tegelijk de anti-dubbeltel-garantie van
// `workingExceptionOnNonWorkWeekdayIdxSorted` (de `!workDayMask[dow]`-filter in de constructor): zónder
// die filter zou maandag hier TWEE keer meetellen (eenmaal via `countWorkWeekdays`, eenmaal via de
// uitzondering-index) — zie de mutatiebewijzen onderaan.
const engWorkMonNormal = new CalendarEngine({
  ...cal('WorkMonNormal'),
  workingExceptions: [{ name: 'Overbodige uitzondering op een gewone werkdag', startDate: '2026-07-06', endDate: '2026-07-06' }],
});
eq('M20 WorkMonNormal workDaysBetween(ma6,ma6)=1 (geen dubbeltelling)', engWorkMonNormal.workDaysBetween(I('2026-07-06'), I('2026-07-06')), 1);
eq('M21 WorkMonNormal workDaysBetween(ma6,vr10)=5 (hele week, ongewijzigd)', engWorkMonNormal.workDaysBetween(I('2026-07-06'), I('2026-07-10')), 5);
eq('M22 WorkMonNormal workDaysBetween(zo5,ma6)=1 (zo5 telt niet, ma6 precies één keer)', engWorkMonNormal.workDaysBetween(I('2026-07-05'), I('2026-07-06')), 1);
eq('M23 WorkMonNormal addWorkDays(ma6,1)=ma6 (ongewijzigd)', formatDate(engWorkMonNormal.addWorkDays(I('2026-07-06'), 1)), '2026-07-06');
eq('M24 WorkMonNormal addWorkDays(ma6,5)=vr10 (ongewijzigd)', formatDate(engWorkMonNormal.addWorkDays(I('2026-07-06'), 5)), '2026-07-10');

// M25-M26 (review-bevinding MIDDEN-2, orkestratorbesluit): een BAND-LOZE werkende uitzondering op een
// dag ZONDER eigen weekdagbanden (zaterdag in een ma-vr-uurkalender, `byWeekday[6]=[]`) valt terug op de
// STANDAARD-werkdagbanden van de kalender (08:00-16:00) — niet op de lege weekdag-eigen banden. Zonder
// die fallback zou `isWorkDay`-achtig "werkend" zijn maar `workMinutesBetween`=0 geven: dag- en uurmodus
// zouden elkaar tegenspreken en ResourceLoad/workdayAxis een werkdag zonder capaciteit zien.
const engWorkSatNoBands = new CalendarEngine({
  ...cal('WorkSatNoBands', w5([{ start: 480, end: 960 }])), // ma-vr 08:00-16:00, za/zo leeg
  workingExceptions: [{ name: 'Werkende zaterdag zonder eigen banden', startDate: '2026-07-11', endDate: '2026-07-11' }],
});
eq('M25 WorkSatNoBands workMinutesBetween(za11,zo12)=480 (valt terug op standaard-werkdagbanden, niet 0)', engWorkSatNoBands.workMinutesBetween(I('2026-07-11'), I('2026-07-12')), 480);
eq('M26 WorkSatNoBands workMinutesBetween(zo12,ma13)=0 (zondag blijft ongemoeid, geen lekkage van de fallback)', engWorkSatNoBands.workMinutesBetween(I('2026-07-12'), I('2026-07-13')), 0);

// M27-M29 (her-review-bevinding MIDDEN-A): een REALISTISCHE T3-kalender heeft een holiday ÉN een
// werkende uitzondering, maar op VERSCHILLENDE datums. Vóór deze fix bestond `isWorkDay` uit twee bijna-
// identieke takken (met/zonder uitzonderingen), elk met een eigen holiday-check — de reviewer haalde
// de holiday-check alleen uit de "met uitzonderingen"-tak weg en 118/118 bleef groen, omdat geen enkele
// bestaande case een holiday test op een kalender die ELDERS ook `workingExceptions` heeft. Dat brak
// `addWorkDays`: de feestdag werd stil een werkdag zodra de kalender ook maar één werkende uitzondering
// had, ongeacht de datum ervan.
const engHolElsewhereExcElsewhere = new CalendarEngine({
  ...cal('HolElsewhereExcElsewhere', undefined, [{ name: 'Feestdag (di)', startDate: '2026-07-07', endDate: '2026-07-07' }]),
  workingExceptions: [{ name: 'Werkende zaterdag (elders)', startDate: '2026-07-11', endDate: '2026-07-11' }],
});
eq('M27 HolElsewhereExcElsewhere isWorkDay(di7)=false (holiday blijft holiday, ook met workingExceptions elders)', engHolElsewhereExcElsewhere.isWorkDay(I('2026-07-07')), false);
eq('M28 HolElsewhereExcElsewhere addWorkDays(ma6,4)=vr10 (di7 overgeslagen, niet do9)', formatDate(engHolElsewhereExcElsewhere.addWorkDays(I('2026-07-06'), 4)), '2026-07-10');
eq('M29 HolElsewhereExcElsewhere isWorkDay(za11)=true (de werkende uitzondering zelf werkt nog gewoon)', engHolElsewhereExcElsewhere.isWorkDay(I('2026-07-11')), true);

// M30-M31 (her-review-bevinding LAAG-9): `computeStandardWorkdayBands` moet DEZELFDE "normale werkdag"
// aanwijzen als `hoursPerDay` (`computeDerivedHoursPerDay`, modaal). Op een ASYMMETRISCHE kalender
// (ma 4u, di-vr 8u) wees de eerste-werkdag-met-banden-regel voorheen maandag (240m) aan, terwijl
// `hoursPerDay`=8 (modaal, 4 van de 5 werkdagen) — een band-loze werkende zaterdag kreeg dan 240m i.p.v.
// de verwachte 480m: `hoursPerDay` en de fallback spraken elkaar tegen.
const engAsymmetric = new CalendarEngine({
  ...cal('Asymmetric', {
    byWeekday: {
      1: [{ start: 480, end: 720 }],  // ma 08:00-12:00 = 4u
      2: [{ start: 480, end: 960 }],  // di 08:00-16:00 = 8u
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

if (diffs.length === 0) {
  console.log(`OK  calendar-hours-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  calendar-hours-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
