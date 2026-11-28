import './domStub';
import { installDOMParser } from './xmldom-shim';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { readCalendars, promoteCalendarsForHourMode } from '@/services/mpp/mppCalendars';
import { Props } from '@/services/mpp/mppContainer';
import { CfbFile } from '@/services/mpp/cfb';
import {
  buildNestedCfb, encodePropsEntries, buildCalFixedMetaBlob, buildCalFixedDataRecord, buildCalHoursBlock,
  buildVarMetaBytes,
} from './mppFixtures';
import { createAppStoreContext } from '@/state/appStore';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import {
  calendarScalarBreakIssue, inferredSimpleBreak, makeBands, scalarTimesValid,
} from '@/utils/effectiveWorkTime';
import { shiftPresetPatch } from '@/utils/shiftPresets';
import { withRepairedFirstBlockScalar, workDayTogglePatch, workDaysSetPatch } from '@/services/subdayIo';
import { parseOpenedFile } from '@/services/formatRegistry';
import { applyCalendarUpdate, bumpPool, classifyCalendarOnOpen, normalizePoolShape } from '@/services/library/libraryOps';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorkCalendar } from '@/types/calendar';
import type { Company, CompanyPool } from '@/types/library';

installDOMParser();

const failures: string[] = [];
let checks = 0;
function same(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
const scalar = (c: WorkCalendar) => ({ start: c.workStartHour, end: c.workEndHour, hpd: c.hoursPerDay });
const MSP_DAY = [{ start: 480, end: 720 }, { start: 780, end: 1020 }];

const wt = (from: string, to: string) => `<WorkingTime><FromTime>${from}</FromTime><ToTime>${to}</ToTime></WorkingTime>`;
function weekDays(times: string): string {
  return [1, 2, 3, 4, 5, 6, 7].map(n => {
    const work = n >= 2 && n <= 6;
    return `<WeekDay><DayType>${n}</DayType><DayWorking>${work ? 1 : 0}</DayWorking>${work ? `<WorkingTimes>${times}</WorkingTimes>` : ''}</WeekDay>`;
  }).join('');
}
const TWO_BLOCKS = wt('08:00:00', '12:00:00') + wt('13:00:00', '17:00:00');
function mspdi(opts: { minutesPerDay?: number; projectTimes?: string; resourceTimes?: string }): string {
  const projectTimes = opts.projectTimes ?? TWO_BLOCKS;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>Werkdag</Name><StartDate>2026-01-05T08:00:00</StartDate>
${opts.minutesPerDay ? `<MinutesPerDay>${opts.minutesPerDay}</MinutesPerDay>` : ''}<CalendarUID>1</CalendarUID>
<Calendars>
<Calendar><UID>1</UID><Name>Standard</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays>${weekDays(projectTimes)}</WeekDays></Calendar>
${opts.resourceTimes ? `<Calendar><UID>2</UID><Name>Ploeg</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays>${weekDays(opts.resourceTimes)}</WeekDays></Calendar>` : ''}
</Calendars>
<Tasks><Task><UID>1</UID><ID>1</ID><Name>Taak</Name><OutlineLevel>1</OutlineLevel><Start>2026-01-05T08:00:00</Start><Finish>2026-01-09T17:00:00</Finish><Duration>PT40H0M0S</Duration></Task></Tasks>
</Project>`;
}
{
  const withMpd = readMSPDI(mspdi({ minutesPerDay: 480, resourceTimes: TWO_BLOCKS }));
  same('§1 MSPDI projectkalender (MinutesPerDay 480): 8/17, hpd 8', scalar(withMpd.calendar), { start: 8, end: 17, hpd: 8 });
  same('§1 MSPDI projectkalender: blokken blijven 08–12 + 13–17', withMpd.calendar.workTime?.byWeekday[1], MSP_DAY);
  const res = (withMpd.resourceCalendars ?? []).find(c => c.name === 'Ploeg');
  same('§1 MSPDI resourcekalender: 8/17, hpd 8', res && scalar(res), { start: 8, end: 17, hpd: 8 });

  const noMpd = readMSPDI(mspdi({}));
  same('§1 MSPDI zonder MinutesPerDay: 8/17, hpd 8', scalar(noMpd.calendar), { start: 8, end: 17, hpd: 8 });

  const reversed = readMSPDI(mspdi({ projectTimes: wt('13:00:00', '17:00:00') + wt('08:00:00', '12:00:00') }));
  same('§1 MSPDI blokken in omgekeerde volgorde: 8/17', scalar(reversed.calendar), { start: 8, end: 17, hpd: 8 });

  const single = readMSPDI(mspdi({ projectTimes: wt('07:00:00', '16:00:00') }));
  same('§1 MSPDI één blok 07–16: ongewijzigd 7/16, hpd 9', scalar(single.calendar), { start: 7, end: 16, hpd: 9 });
}

{
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>Lag</Name><StartDate>2026-01-05T08:00:00</StartDate><CalendarUID>1</CalendarUID>
<Calendars>
<Calendar><UID>1</UID><Name>Standard</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays>${weekDays(TWO_BLOCKS)}</WeekDays></Calendar>
<Calendar><UID>2</UID><Name>Dag</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays>${weekDays(wt('08:00:00', '16:00:00'))}</WeekDays></Calendar>
</Calendars>
<Tasks>
<Task><UID>1</UID><ID>1</ID><Name>A</Name><OutlineLevel>1</OutlineLevel><Start>2026-01-05T08:00:00</Start><Finish>2026-01-06T17:00:00</Finish><Duration>PT16H0M0S</Duration></Task>
<Task><UID>2</UID><ID>2</ID><Name>B</Name><OutlineLevel>1</OutlineLevel><CalendarUID>2</CalendarUID><Start>2026-01-08T08:00:00</Start><Finish>2026-01-09T08:00:00</Finish><Duration>PT8H0M0S</Duration>
<PredecessorLink><PredecessorUID>1</PredecessorUID><Type>1</Type><LinkLag>24000</LinkLag><LagFormat>7</LagFormat></PredecessorLink></Task>
</Tasks></Project>`;
  const r = readMSPDI(xml);
  same('§1b MSPDI-lag zonder MinutesPerDay: 40 h blijft 2400 minuten',
    r.sequences.map(s => [s.lagDays, s.lagMinutes ?? null]), [[0, 2400]]);
}

function encodeUnicodeStringAscii(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
  return out;
}
function mppCalendar(bands: { startMinutes: number; durationMinutes: number }[]) {
  const hoursBlock = buildCalHoursBlock([
    { defaultFlag: 0 },
    ...Array.from({ length: 5 }, () => ({ defaultFlag: 0 as const, bands })),
    { defaultFlag: 0 },
  ]);
  const varMeta = buildVarMetaBytes([{ uniqueId: 1, type: 1, offset: 0 }, { uniqueId: 1, type: 8, offset: 40 }]);
  const namePayload = encodeUnicodeStringAscii('Standard');
  const var2Data = new Uint8Array(40 + 4 + hoursBlock.length);
  const view = new DataView(var2Data.buffer);
  view.setInt32(0, namePayload.length, true);
  var2Data.set(namePayload, 4);
  view.setInt32(40, hoursBlock.length, true);
  var2Data.set(hoursBlock, 44);
  const cfb = new CfbFile(buildNestedCfb({
    '   114': { children: { TBkndCal: { children: {
      FixedMeta: { data: buildCalFixedMetaBlob([0]) }, FixedData: { data: buildCalFixedDataRecord(1, -1, -1) },
      VarMeta: { data: varMeta }, Var2Data: { data: var2Data },
    } } } },
  }));
  return readCalendars(cfb, new Props(encodePropsEntries([]), 'werkdag-einde'), null);
}
{
  const result = mppCalendar([{ startMinutes: 780, durationMinutes: 240 }, { startMinutes: 480, durationMinutes: 240 }]);
  const cal = result.calendarByUniqueId.get(1)!;
  same('§2 .mpp vóór promotie: 8/17, tussenwaarde hpd netto 8', scalar(cal), { start: 8, end: 17, hpd: 8 });
  promoteCalendarsForHourMode(result.calendarByUniqueId, new Set());
  same('§2 .mpp ná promotie: 8/17, hpd 8, blokken 08–12 + 13–17', [scalar(cal), cal.workTime?.byWeekday[1]],
    [{ start: 8, end: 17, hpd: 8 }, MSP_DAY]);

  const single = mppCalendar([{ startMinutes: 420, durationMinutes: 540 }]).calendarByUniqueId.get(1)!;
  same('§2 .mpp één blok 07–16: ongewijzigd 7/16, hpd 9', scalar(single), { start: 7, end: 16, hpd: 9 });
}

function ifcWith(patch: Partial<WorkCalendar>, hourTask = false): string {
  const store = createAppStoreContext().store;
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01' });
  S().setCalendar({ ...S().calendar, ...patch });
  S().addTask({ name: 'Dagtaak', time: createDefaultTaskTime('2026-06-01', 2) });
  if (hourTask) S().addTask({ name: 'Urentaak', time: createDefaultTaskTime('2026-06-01', 10, 'hours', S().calendar) });
  S().runCPM();
  return writeIFC(buildWriteIFCInput(S(), 'planOnly'));
}
const hourCal = (start: number, end: number): Partial<WorkCalendar> => ({
  workTime: makeBands([1, 2, 3, 4, 5], MSP_DAY), workDays: [1, 2, 3, 4, 5],
  workStartHour: start, workEndHour: end, hoursPerDay: 8,
});
{
  const oldIfc = ifcWith(hourCal(8, 12));
  same('§3a oud bestand draagt geen WorkStartHour/WorkEndHour', ['WorkStartHour', 'WorkEndHour'].filter(n => oldIfc.includes(n)), []);
  same('§3a oud bestand (alleen periodes) ⇒ 8/17, hpd 8', scalar(readIFC(oldIfc).calendar), { start: 8, end: 17, hpd: 8 });

  const am = "IFCTIMEPERIOD('08:00:00','12:00:00')", pm = "IFCTIMEPERIOD('13:00:00','17:00:00')";
  same('§3b fixture: beide periodes staan in het bestand', [oldIfc.includes(am), oldIfc.includes(pm)], [true, true]);
  const swapped = oldIfc.replace(am, '@AM@').replace(pm, am).replace('@AM@', pm);
  same('§3b periodes in omgekeerde volgorde ⇒ 8/17', scalar(readIFC(swapped).calendar), { start: 8, end: 17, hpd: 8 });

  const threeShift = ifcWith(shiftPresetPatch('three-shift'))
    .replace(/'WorkStartHour'/g, "'GeenEigenschap1'").replace(/'WorkEndHour'/g, "'GeenEigenschap2'");
  same('§3c fixture: drie periodes met een nachtblok', threeShift.includes("IFCTIMEPERIOD('22:00:00','06:00:00')"), true);
  const ts = readIFC(threeShift).calendar;
  same('§3c drieploegen zonder eigenschappen ⇒ 6/24, hpd 24', scalar(ts), { start: 6, end: 24, hpd: 24 });
  same('§3c drieploegen met eigenschappen ⇒ 0/24', scalar(readIFC(ifcWith(shiftPresetPatch('three-shift'))).calendar),
    { start: 0, end: 24, hpd: 24 });

  const halfDay: Partial<WorkCalendar> = { workTime: undefined, workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 12, hoursPerDay: 4 };
  same('§3d dagkalender 08–12 blijft 8/12, hpd 4', scalar(readIFC(ifcWith(halfDay)).calendar), { start: 8, end: 12, hpd: 4 });
  const halfDayHour = readIFC(ifcWith(halfDay, true)).calendar;
  same('§3d dagkalender 08–12 met urentaak blijft scalair 8/12, hpd 4', [scalar(halfDayHour), halfDayHour.workTime ?? null],
    [{ start: 8, end: 12, hpd: 4 }, null]);
  const night = readIFC(ifcWith(shiftPresetPatch('night'))).calendar;
  same('§3d één nachtblok 22–06 houdt 22/6', [night.workStartHour, night.workEndHour], [22, 6]);

  const scalarDay: Partial<WorkCalendar> = { workTime: undefined, workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 17, hoursPerDay: 8 };
  const scalarIfc = ifcWith(scalarDay, true);
  same('§3e fixture: scalaire kalender met gematerialiseerde blokken en IsHourCalendar .F.',
    [scalarIfc.includes(pm), scalarIfc.includes("'IsHourCalendar',$,IFCBOOLEAN(.F.)")], [true, true]);
  const scalarRead = readIFC(scalarIfc).calendar;
  same('§3e scalaire dagkalender 08–17 blijft 8/17 scalair', [scalar(scalarRead), scalarRead.workTime ?? null],
    [{ start: 8, end: 17, hpd: 8 }, null]);
  const contradictory = ifcWith({ ...scalarDay, hoursPerDay: 9, simpleBreakStartMinute: 720, simpleBreakDurationMinutes: 60 }, true);
  same('§3e fixture: tegenstrijdige scalaire kalender zonder HoursPerDay, met IsHourCalendar .F. en twee periodes',
    [contradictory.includes("'HoursPerDay'"), contradictory.includes("'IsHourCalendar',$,IFCBOOLEAN(.F.)"), contradictory.includes(pm)],
    [false, true, true]);
  same('§3e .F. met pauzevelden en hpd = einde − begin houdt hpd 9 (geen netto)', readIFC(contradictory).calendar.hoursPerDay, 9);

  const HERE = fileURLToPath(new URL('.', import.meta.url));
  const tussen = readIFC(readFileSync(join(HERE, 'fixtures', 'werkdag-einde-tussenwaarde.ifc'), 'utf8'));
  const a = tussen.tasks.find(t => t.name === 'A')!;
  same('§3f tussenwaarde netto: PT72H ⇒ 9 dagen (actualDuration, freeFloat)', [a.time.actualDuration, a.time.freeFloat], [9, 9]);
}

{
  const cal = readMSPDI(mspdi({ minutesPerDay: 480 })).calendar;
  same('§4 dialoog: begin 08:00, einde 17:00, netto 8 h',
    { start: cal.workStartHour, end: cal.workEndHour, net: cal.hoursPerDay }, { start: 8, end: 17, net: 8 });
  same('§4 dialoog: geen foutmelding bij openen', calendarScalarBreakIssue(cal) ?? null, null);

  const legacy: WorkCalendar = { ...cal, workTime: undefined, workStartHour: 8, workEndHour: 17, hoursPerDay: 8 };
  same('§4 zonder blokken: legacy 12:00 van 60 min', inferredSimpleBreak(legacy), { startMinute: 720, durationMinutes: 60 });
  same('§4 scalarTimesValid: dagkalender Begin 07:00 geldig', scalarTimesValid(legacy, { workStartHour: 7 }), true);
  same('§4 scalarTimesValid: dagkalender Einde 12:00 (pauze valt erbuiten) ongeldig', scalarTimesValid(legacy, { workEndHour: 12 }), false);
}

{
  const HERE = fileURLToPath(new URL('.', import.meta.url));
  const ifc = readFileSync(join(HERE, 'fixtures', 'werkdag-einde-main-bibliotheek.ifc'), 'utf8');
  const fx = JSON.parse(readFileSync(join(HERE, 'fixtures', 'werkdag-einde-main-bibliotheek.json'), 'utf8')) as {
    pool: CompanyPool; companies: Company[];
  };
  const rawPool = fx.pool;
  const cid = rawPool.companyId;
  same('§5 fixture: poolkalender 8/12, bestand zonder WorkEndHour',
    [rawPool.calendars[0].workStartHour, rawPool.calendars[0].workEndHour, ifc.includes('WorkEndHour')], [8, 12, false]);

  const opened = readIFC(ifc).calendar;
  same('§5 heropend: projectkalender 8/17 met herkomst', [opened.workStartHour, opened.workEndHour, !!opened.libraryOrigin], [8, 17, true]);
  same('§5 ruwe pool (buiten de laadroute): in-sync', classifyCalendarOnOpen(opened, rawPool), 'in-sync');
  const loaded = normalizePoolShape(cid, structuredClone(rawPool), fx.companies);
  same('§5 geladen pool (normalizePoolShape) herstelt naar 8/17', loaded.calendars[0].workEndHour, 17);
  same('§5 geladen pool: in-sync', classifyCalendarOnOpen(opened, loaded), 'in-sync');

  const ctx = createAppStoreContext();
  ctx.store.setState({ companies: fx.companies, pools: { [cid]: structuredClone(rawPool) } });
  ctx.store.getState().applyOpenedImport(await parseOpenedFile({ name: 'oud.ifc', text: ifc }), {
    filePath: null, recompute: true, linkedOpen: true,
  });
  same('§5 openroute: kalender 8/17 en geen afwijkingsdialoog',
    [ctx.store.getState().calendar.workEndHour, ctx.store.getState().ui.showLibraryLinkDialog ?? false], [17, false]);

  const moved = bumpPool({ ...rawPool, calendars: rawPool.calendars.map(c => ({ ...c, description: 'bijgewerkt' })) });
  same('§5 bibliotheek bewoog: behind', classifyCalendarOnOpen(opened, moved), 'behind');
  const refreshed = applyCalendarUpdate(opened, moved);
  same('§5 verversen: omschrijving uit de bibliotheek, einde blijft 17', [refreshed.description, refreshed.workEndHour], ['bijgewerkt', 17]);
  same('§5 lokaal bewerkte kopie (andere naam) blijft deviated', classifyCalendarOnOpen({ ...opened, name: 'Eigen' }, moved), 'deviated');
}

{
  const ctx = createAppStoreContext();
  const S = () => ctx.store.getState();
  S().applyLoadedProject(readMSPDI(mspdi({ minutesPerDay: 480 })), { filePath: null, recompute: true });
  const finish = () => S().tasks.find(t => t.name === 'Taak')!.time.earlyFinish;
  same('§6 uitgangspunt: taak van 5 dagen eindigt vrijdag 9 jan 17:00', finish(), '2026-01-09T17:00');

  const off = workDayTogglePatch(S().calendar, 5);
  same('§6 vrijdag uit: werkdagen ma–do, vrijdagblokken leeg, hpd 8', [off.workDays, off.workTime?.byWeekday[5], off.hoursPerDay],
    [[1, 2, 3, 4], [], 8]);
  S().setCalendar({ ...S().calendar, ...off });
  S().runCPM();
  same('§6 vrijdag uit: taak eindigt maandag 12 jan 17:00', finish(), '2026-01-12T17:00');
  const reopened = readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly'))).calendar;
  same('§6 vrijdag uit: na opslaan en heropenen geen vrijdag', [reopened.workDays, reopened.workTime?.byWeekday[5] ?? []], [[1, 2, 3, 4], []]);

  const on = workDayTogglePatch(S().calendar, 5);
  same('§6 vrijdag weer aan: blokken 08–12 + 13–17 terug', [on.workDays, on.workTime?.byWeekday[5]], [[1, 2, 3, 4, 5], MSP_DAY]);
  S().setCalendar({ ...S().calendar, ...on });
  S().runCPM();
  same('§6 vrijdag weer aan: taak eindigt weer vrijdag 9 jan 17:00', finish(), '2026-01-09T17:00');

  same('§6 zaterdag aan: blokken van de eerste werkdag', workDayTogglePatch(S().calendar, 6).workTime?.byWeekday[6], MSP_DAY);
  same('§6 dagkalender: alleen workDays',
    workDayTogglePatch({ workDays: [1, 2, 3, 4, 5], hoursPerDay: 8, workStartHour: 7, workEndHour: 16 }, 5), { workDays: [1, 2, 3, 4] });
}

{
  const shortFri = [{ start: 480, end: 720 }, { start: 780, end: 900 }];
  const opened: WorkCalendar = {
    ...readMSPDI(mspdi({ minutesPerDay: 480 })).calendar,
  };
  opened.workTime = { byWeekday: { ...opened.workTime!.byWeekday, 5: shortFri } };
  const off = { ...opened, ...workDayTogglePatch(opened, 5, opened) };
  const on = workDayTogglePatch(off, 5, opened);
  same('§6b korte vrijdag uit en weer aan: 08–12 + 13–15 terug', on.workTime?.byWeekday[5], shortFri);
  same('§6b zaterdag aan (had geen blokken): blokken van de eerste werkdag', workDayTogglePatch(off, 6, opened).workTime?.byWeekday[6], MSP_DAY);
}

{
  const empty: WorkCalendar = {
    ...readMSPDI(mspdi({ minutesPerDay: 480 })).calendar,
    workDays: [], workTime: makeBands([], []), workStartHour: 7, workEndHour: 16, hoursPerDay: 8,
  };
  const on = workDayTogglePatch(empty, 1);
  same('§6c geen enkel blok: maandag aan ⇒ 07–12 + 13–16, hpd 8', [on.workDays, on.workTime?.byWeekday[1], on.hoursPerDay],
    [[1], [{ start: 420, end: 720 }, { start: 780, end: 960 }], 8]);
}

{
  const allDay = [{ start: 0, end: 1440 }];
  const cont = { ...readMSPDI(mspdi({ minutesPerDay: 480 })).calendar, ...shiftPresetPatch('continuous') };
  const p = workDaysSetPatch(cont, [1, 2, 3, 4, 5]);
  same('§6d 24/7 ⇒ Ma–vr: werkdagen, za/zo leeg, ma 00–24, hpd 24',
    [p.workDays, p.workTime?.byWeekday[6], p.workTime?.byWeekday[7], p.workTime?.byWeekday[1], p.hoursPerDay],
    [[1, 2, 3, 4, 5], [], [], allDay, 24]);
  const shortFri = [{ start: 480, end: 720 }, { start: 780, end: 900 }];
  const opened = readMSPDI(mspdi({ minutesPerDay: 480 })).calendar;
  const withShortFri = { ...opened, workTime: { byWeekday: { ...opened.workTime!.byWeekday, 5: shortFri } } };
  same('§6d ma–vr al aan: niets verandert, korte vrijdag blijft', workDaysSetPatch(withShortFri, [1, 2, 3, 4, 5]).workTime,
    withShortFri.workTime);
  const onlyMon = { ...opened, ...workDaysSetPatch(opened, [1]) };
  same('§6d alleen maandag over', [onlyMon.workDays, onlyMon.workTime?.byWeekday[5]], [[1], []]);
  const back = workDaysSetPatch(onlyMon, [1, 2, 3, 4, 5], withShortFri);
  same('§6d terug naar ma–vr: vrijdag krijgt zijn eigen (korte) blokken, di die van maandag',
    [back.workDays, back.workTime?.byWeekday[5], back.workTime?.byWeekday[2]], [[1, 2, 3, 4, 5], shortFri, MSP_DAY]);
  const weekendDay = [{ start: 360, end: 1080 }];
  const weekend: WorkCalendar = { ...opened, workDays: [6, 7], workStartHour: 7, workEndHour: 16, hoursPerDay: 12,
    workTime: makeBands([6, 7], weekendDay) };
  const fromWeekend = workDaysSetPatch(weekend, [1, 2, 3, 4, 5]);
  same('§6d weekend ⇒ Ma–vr: ma en vr krijgen 06–18 van zondag, za leeg, hpd 12',
    [fromWeekend.workDays, fromWeekend.workTime?.byWeekday[1], fromWeekend.workTime?.byWeekday[5], fromWeekend.workTime?.byWeekday[6], fromWeekend.hoursPerDay],
    [[1, 2, 3, 4, 5], weekendDay, weekendDay, [], 12]);
  const mixed: WorkCalendar = { ...opened, workDays: [1, 6, 7], hoursPerDay: 10,
    workTime: { byWeekday: { ...makeBands([6, 7], [{ start: 480, end: 1080 }]).byWeekday, 1: MSP_DAY } } };
  same('§6d modale uren wisselen: alleen ma over ⇒ hpd 8', workDaysSetPatch(mixed, [1]).hoursPerDay, 8);

  same('§6d dagkalender: alleen workDays',
    workDaysSetPatch({ workDays: [1, 2, 3, 4, 5, 6, 7], hoursPerDay: 8, workStartHour: 7, workEndHour: 16 }, [1, 2, 3, 4, 5]),
    { workDays: [1, 2, 3, 4, 5] });
}

{
  const opened = readMSPDI(mspdi({ minutesPerDay: 480 })).calendar;
  const STANDARD_DAY = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
  for (const [label, scalar] of [
    ['nachtscalar 22→06', { workStartHour: 22, workEndHour: 6, hoursPerDay: 8 }],
    ['netto 10 h in 9 h spanne', { workStartHour: 7, workEndHour: 16, hoursPerDay: 10 }],
  ] as const) {
    const empty: WorkCalendar = { ...opened, ...scalar, workDays: [], workTime: makeBands([], []),
      simpleBreakStartMinute: undefined, simpleBreakDurationMinutes: undefined };
    const p = workDaysSetPatch(empty, [1, 2, 3, 4, 5]);
    same(`§6e ${label}: ma–vr krijgen de standaardwerkdag, hpd 8`,
      [p.workDays, [1, 2, 3, 4, 5].map(d => p.workTime?.byWeekday[d as 1]), p.hoursPerDay],
      [[1, 2, 3, 4, 5], Array(5).fill(STANDARD_DAY), 8]);
  }
}

{
  const sun = wt('09:00:00', '13:00:00') + wt('14:00:00', '18:00:00');
  const days = [1, 2, 3, 4, 5, 6, 7].map(n => {
    const times = n === 1 ? sun : n >= 2 && n <= 6 ? TWO_BLOCKS : '';
    return `<WeekDay><DayType>${n}</DayType><DayWorking>${times ? 1 : 0}</DayWorking>${times ? `<WorkingTimes>${times}</WorkingTimes>` : ''}</WeekDay>`;
  }).join('');
  const cal = readMSPDI(mspdi({ minutesPerDay: 480 }).replace(weekDays(TWO_BLOCKS), days)).calendar;
  const SUN_DAY = [{ start: 540, end: 780 }, { start: 840, end: 1080 }];
  same('§7 fixture: zondag en maandag hebben verschillende blokken', [cal.workTime?.byWeekday[7], cal.workTime?.byWeekday[1]], [SUN_DAY, MSP_DAY]);
  same('§7 lezer: scalar van zondag 9/18', [cal.workStartHour, cal.workEndHour], [9, 18]);
  same('§7 bibliotheekherstel: oude scalar 9/13 (eerste zondagblok) ⇒ 9/18',
    withRepairedFirstBlockScalar({ ...cal, workEndHour: 13 }).workEndHour, 18);
  const sat = workDayTogglePatch(cal, 6);
  same('§7 zaterdag aan: blokken van zondag (eerste werkdag)', sat.workTime?.byWeekday[6], SUN_DAY);
}

if (failures.length > 0) {
  for (const f of failures) console.log(`XX ${f}`);
  console.log(`\n${failures.length}/${checks} werkdag-einde-checks mislukt.`);
  process.exitCode = 1;
} else {
  console.log(`OK  werkdag-einde: ${checks} checks groen.`);
}
