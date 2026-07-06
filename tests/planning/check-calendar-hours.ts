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

if (diffs.length === 0) {
  console.log(`OK  calendar-hours-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  calendar-hours-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
