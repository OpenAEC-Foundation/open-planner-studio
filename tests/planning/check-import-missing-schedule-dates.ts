// Import/export-audit, vervolg op bevinding 6: een ONTBREKENDE geplande start in een ingelezen bestand
// werd in elke lezer de leesdatum ("vandaag"). Een wortel-taak gebruikt zijn eigen start als anker in
// de forward pass, dus hij verhuisde naar vandaag — en een voltooide taak zonder actuals werd "vandaag
// gedaan". Nu (één gedeelde regel, `resolveMissingScheduleDates` in services/importDates.ts, vóór
// `normalizeImportedProgress`):
//   - ontbrekende start ⇒ de projectstart (zoals `addTask`); ontbreekt die ook ⇒ de vroegste
//     AANWEZIGE taakstart; pas bij een project zonder enige datum ⇒ vandaag;
//   - ontbrekende finish ⇒ start + duur waar dat eenduidig is (nul-duur, of hele werkdagen op de
//     effectieve kalender); anders blijft de plaatshouder van de lezer staan.
// Per lezer getoetst: CSV, MSPDI, P6, IFC en MPP. Ankerjaar 2015 zodat "vandaag" nooit toevallig
// klopt. Draait via run.sh. Exit 0 = alles groen.

import { installDOMParser } from './xmldom-shim';
import { useAppStore } from '@/state/appStore';
import { readCSV } from '@/services/csv/csvReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { readMPP } from '@/services/mpp/mppReader';
import { readXER } from '@/services/xer/xerReader';
import { xerImportNotice } from '@/state/slices/fileSlice';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';
import { MPP_NA, minimalMpp14Bytes as mppBytes } from './mppFixtures';

installDOMParser();

const S = () => useAppStore.getState();
const THIS_YEAR = new Date().getFullYear().toString();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq(label: string, got: unknown, want: unknown): void {
  ok(`${label} (kreeg ${JSON.stringify(got)}, verwacht ${JSON.stringify(want)})`,
    JSON.stringify(got) === JSON.stringify(want));
}
const byName = (tasks: readonly Task[], name: string): Task => {
  const t = tasks.find(x => x.name === name);
  if (!t) throw new Error(`taak ${name} ontbreekt`);
  return t;
};
const dates = (t: Task) => ({
  start: t.time.scheduleStart.slice(0, 10), finish: t.time.scheduleFinish.slice(0, 10),
  earlyStart: t.time.earlyStart.slice(0, 10), earlyFinish: t.time.earlyFinish.slice(0, 10),
});

/** Gedeelde verwachtingen voor een lezer: B (3 werkdagen, voltooid zonder actuals) en M (mijlpaal)
 *  droegen geen geplande start/finish; A wel. */
function expectResolved(tag: string, parsed: ImportResult, anchor: string, bFinish: string): void {
  const b = byName(parsed.tasks, 'B');
  const m = byName(parsed.tasks, 'M');
  eq(`${tag}: B zonder start/finish ⇒ start = anker, finish = start + 3 werkdagen (early spiegelt)`,
    dates(b), { start: anchor, finish: bFinish, earlyStart: anchor, earlyFinish: bFinish });
  eq(`${tag}: mijlpaal M zonder datums ⇒ start = finish = anker`,
    [m.time.scheduleStart.slice(0, 10), m.time.scheduleFinish.slice(0, 10)], [anchor, anchor]);
  eq(`${tag}: B op 100 % zonder actuals ⇒ AS/AF uit de opgeloste datums (niet vandaag)`,
    [b.time.actualStart?.slice(0, 10), b.time.actualFinish?.slice(0, 10)], [anchor, bFinish]);
  ok(`${tag}: geen enkele geplande datum is "vandaag" (${JSON.stringify(parsed.tasks.map(dates))})`,
    !parsed.tasks.some(t => t.time.scheduleStart.startsWith(THIS_YEAR) || t.time.scheduleFinish.startsWith(THIS_YEAR)));
}

// ── Bronproject in de store: projectstart ma 5-1-2015, A (5 d) start wo 7-1, B (3 d), M (mijlpaal). ──
S().newProject();
S().setProject({ startDate: '2015-01-05' });
S().addTask({ name: 'A', time: createDefaultTaskTime('2015-01-07', 5) });
const idB = S().addTask({ name: 'B', time: createDefaultTaskTime('2015-01-05', 3) });
S().addTask({ name: 'M', time: createDefaultTaskTime('2015-01-05', 0) });
S().runCPM();
// B op 100 % zonder actuals (zoals updateTask/een extern bestand hem achterlaat).
S().updateTask(idB, { time: { ...byName(S().tasks, 'B').time, completion: 1 } });
const src = S();

// ── 1. CSV: lege Start/Finish-cellen; CSV kent geen projectstart ⇒ vroegste aanwezige start (A). ──
{
  const csv = [
    'WBS;Name;Duration;Start;Finish;Completion (%)',
    '1;A;5;2015-01-07;2015-01-13;0',
    '2;B;3;;;100',
    '3;M;0;;;0',
  ].join('\r\n');
  const parsed = readCSV(csv);
  expectResolved('1 CSV', parsed, '2015-01-07', '2015-01-09');
  eq('1 CSV: projectstart = vroegste aanwezige taakstart, niet vandaag', parsed.project.startDate, '2015-01-07');
}

// ── 2. MSPDI: <Start>/<Finish> van B en M weg. ─────────────────────────────────────────────────────
/** Verwijder in het blok `<tag>…<Name>naam</Name>…</tag>` de genoemde elementen. */
function stripInBlock(xml: string, tag: string, name: string, elements: string[]): string {
  const re = new RegExp(`<${tag}>(?:(?!</${tag}>)[\\s\\S])*?<Name>${name}</Name>[\\s\\S]*?</${tag}>`);
  const m = xml.match(re);
  if (!m) throw new Error(`geen <${tag}> met naam ${name}`);
  let block = m[0];
  for (const el of elements) block = block.replace(new RegExp(`\\s*<${el}>[^<]*</${el}>`, 'g'), '');
  return xml.replace(m[0], block);
}
{
  let xml = writeMSPDI(src.project, src.calendar, src.tasks, src.sequences, src.resources, src.assignments, src.calendars);
  for (const n of ['B', 'M']) xml = stripInBlock(xml, 'Task', n, ['Start', 'Finish', 'ActualStart', 'ActualFinish']);
  expectResolved('2 MSPDI (projectstart in bestand)', readMSPDI(xml), '2015-01-05', '2015-01-07');
  const zonderProjectStart = xml.replace(/<StartDate>[^<]*<\/StartDate>/, '');
  const parsed = readMSPDI(zonderProjectStart);
  expectResolved('2 MSPDI (zonder projectstart)', parsed, '2015-01-07', '2015-01-09');
  eq('2 MSPDI zonder projectstart: projectstart = vroegste aanwezige taakstart', parsed.project.startDate, '2015-01-07');
}

// ── 3. P6: <PlannedStartDate>/<PlannedFinishDate> van B en M weg. ─────────────────────────────────
{
  let xml = writeP6XML(src.project, src.calendar, src.tasks, src.sequences, src.resources, src.assignments, src.calendars);
  for (const n of ['B', 'M']) {
    xml = stripInBlock(xml, 'Activity', n, [
      'PlannedStartDate', 'PlannedFinishDate', 'StartDate', 'FinishDate', 'ActualStartDate', 'ActualFinishDate',
    ]);
  }
  expectResolved('3 P6 (projectstart in bestand)', readP6XML(xml), '2015-01-05', '2015-01-07');
  // Projectniveau: het eerste <PlannedStartDate> vóór de eerste <Activity> is dat van <Project>.
  const firstActivity = xml.indexOf('<Activity>');
  const head = xml.slice(0, firstActivity).replace(/<PlannedStartDate>[^<]*<\/PlannedStartDate>/, '');
  const parsed = readP6XML(head + xml.slice(firstActivity));
  expectResolved('3 P6 (zonder projectstart)', parsed, '2015-01-07', '2015-01-09');
  eq('3 P6 zonder projectstart: projectstart = vroegste aanwezige taakstart', parsed.project.startDate, '2015-01-07');
}

// ── 4. IFC: ScheduleStart/-Finish (en de rekenslots) van B en M op `$`. ───────────────────────────
function splitArgs(inner: string): string[] {
  const out: string[] = [];
  let depth = 0, quoted = false, cur = '';
  for (const ch of inner) {
    if (ch === "'") quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && depth === 0 && ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}
function blankTaskTimeSlots(ifc: string, name: string, slots: number[]): string {
  const lines = ifc.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#\d+=IFCTASKTIME\()(.*)(\);\s*)$/);
    if (!m) continue;
    const args = splitArgs(m[2]);
    if (args[0] !== `'${name} Time'`) continue;
    for (const s of slots) args[s] = '$';
    lines[i] = `${m[1]}${args.join(',')}${m[3]}`;
    return lines.join('\n');
  }
  throw new Error(`geen IFCTASKTIME voor ${name}`);
}
{
  let ifc = writeIFC(buildWriteIFCInput(src));
  // 5 ScheduleStart, 6 ScheduleFinish, 7-10 Early/Late, 16/17 ActualStart/-Finish.
  for (const n of ['B', 'M']) ifc = blankTaskTimeSlots(ifc, n, [5, 6, 7, 8, 9, 10, 16, 17]);
  const parsed = readIFC(ifc);
  expectResolved('4 IFC', parsed, '2015-01-05', '2015-01-07');
  eq('4 IFC: projectstart uit het bestand blijft', parsed.project.startDate, '2015-01-05');
}

// ── 5. MPP: één taak met een lege (null) ScheduledStart/-Finish. ──────────────────────────────────
{
  // Referentie: dezelfde taak MET datums, zodat de verwachting uit de lezer zelf komt (geen eigen
  // MPP-epoch-rekenwerk in de test). 11328 = ma 5-1-2015 in MPP-dagen.
  const withDates = readMPP(mppBytes({ startDays: 11328, finishDays: 11330, projectStartDays: 11328 }));
  const ref = byName(withDates.tasks, 'B');
  eq('5 MPP referentie: projectstart en taakdatums zoals bedoeld',
    [withDates.project.startDate, ref.time.scheduleStart.slice(0, 10), ref.time.scheduleFinish.slice(0, 10)],
    ['2015-01-05', '2015-01-05', '2015-01-07']);
  const parsed = readMPP(mppBytes({ startDays: MPP_NA, finishDays: MPP_NA, projectStartDays: 11328 }));
  const b = byName(parsed.tasks, 'B');
  eq('5 MPP: lege ScheduledStart/-Finish ⇒ projectstart, finish = start + 3 werkdagen',
    [b.time.scheduleStart.slice(0, 10), b.time.scheduleFinish.slice(0, 10)], ['2015-01-05', '2015-01-07']);
}

// ── 6. XER: TASK zonder target_start_date (review PR #109, N1). Vroeger 1970-01-01 + projectstart
// 1970, zonder melding. Nu de gedeelde regel: anker = statusdatum (last_recalc_date, of data_date als
// die kolom ontbreekt), anders PROJECT.plan_start_date, anders de vroegste aanwezige taakstart. ──
{
  const CAL = '(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(s|08:00|f|16:00)())))(0||3()((0||0(s|08:00|f|16:00)())))(0||4()((0||0(s|08:00|f|16:00)())))(0||5()((0||0(s|08:00|f|16:00)())))(0||6()((0||0(s|08:00|f|16:00)())))(0||7()())))(0||Exceptions()())))';
  const xer = (projectFields: string[], projectValues: string[], otherStart: string): Uint8Array => new TextEncoder().encode([
    'ERMHDR\t23.12\t2015-01-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t${CAL}`,
    '%T\tPROJECT',
    `%F\tproj_id\tproj_short_name\tclndr_id\t${projectFields.join('\t')}`,
    `%R\tP1\tPRJ\tC1\t${projectValues.join('\t')}`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tT1\tP1\tC1\tA100\tZonder start\tTT_Task\tDT_FixedDrtn\tTK_NotStart\t24\t24\t\t',
    `%R\tT2\tP1\tC1\tA200\tNormaal\tTT_Task\tDT_FixedDrtn\tTK_NotStart\t24\t24\t${otherStart} 08:00\t${otherStart} 16:00`,
    '%E',
  ].join('\r\n'));
  const open = (bytes: Uint8Array): ImportResult => {
    const opened = readXER(bytes);
    return 'kind' in opened ? opened.results[0] : opened;
  };
  const check = (tag: string, parsed: ImportResult, anchor: string) => {
    const t1 = byName(parsed.tasks, 'Zonder start');
    eq(`${tag}: taak zonder target_start_date ⇒ start = anker`, t1.time.scheduleStart.slice(0, 10), anchor);
    ok(`${tag}: nergens 1970 (${JSON.stringify(parsed.tasks.map(dates))}, project ${parsed.project.startDate})`,
      !parsed.tasks.some(t => t.time.scheduleStart.startsWith('1970') || t.time.scheduleFinish.startsWith('1970'))
      && !parsed.project.startDate.startsWith('1970'));
    eq(`${tag}: projectstart = vroegste start, niet 1970`, parsed.project.startDate.slice(0, 10),
      [anchor, byName(parsed.tasks, 'Normaal').time.scheduleStart.slice(0, 10)].sort()[0]);
    eq(`${tag}: de melding telt één vervangen start`, parsed.xerMissingPlannedStarts, 1);
  };
  check('6a XER alleen plan_start_date', open(xer(['plan_start_date'], ['2015-01-05 08:00'], '2015-01-12')), '2015-01-05');
  check('6b XER alleen data_date', open(xer(['data_date', 'plan_start_date'], ['2015-01-07 08:00', ''], '2015-01-12')), '2015-01-07');
  check('6c XER last_recalc_date wint van plan_start_date', open(xer(['last_recalc_date', 'plan_start_date'], ['2015-01-08 08:00', '2015-01-05 08:00'], '2015-01-12')), '2015-01-08');
  check('6d XER zonder projectdatums ⇒ vroegste aanwezige start', open(xer(['plan_end_date'], [''], '2015-01-14')), '2015-01-14');
  const complete = open(xer(['plan_start_date'], ['2015-01-05 08:00'], '2015-01-12'));
  ok('6e XER: taak mét start telt niet mee', byName(complete.tasks, 'Normaal').time.scheduleStart.startsWith('2015-01-12'));
  eq('6f XER-openingsmelding noemt de vervangen start',
    xerImportNotice([complete])?.detailLines?.find(line => line.messageKey === 'notifications.xerImportMissingPlannedStarts'),
    { messageKey: 'notifications.xerImportMissingPlannedStarts', params: { count: 1 } });
}

if (diffs.length === 0) {
  console.log(`OK  import-missing-schedule-dates: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  import-missing-schedule-dates: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
