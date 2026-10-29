// Uren per dag na eigen export en heropenen (P6 XML, MSPDI, `.mpp`). Fout gevonden bij de review van
// PR #363 (2026-10-15): `promoteHourCalendar` zette `hoursPerDay` altijd op de modale dagsom van de
// blokken. Een kalender met `hoursPerDay` 8 en blokken van 10 h opende na export met 10; de volgende
// export schreef 10, en een dagtaak van 5 d werd 4 d.
//
// Eigenaarsbesluit 2026-10-15 ("een dag", optie 2, PR #363): de opgeslagen uren per dag blijven bewaard
// en gaan ongewijzigd terug bij export; de werktijd (de blokken) rekent en toont. De lezers zetten de
// bestandswaarde daarom NA de promotie terug, zoals XER en IFC.
//
// De fixture maakt elk verschil zichtbaar: blokken 07:00–17:30 (werktijd 10,5 h) bij een bestandswaarde
// van 8. Een kalender zonder eigen waarde krijgt vóór de promotie einde − begin in hele uren (10) of de
// standaard 8; na de promotie volgt hij de blokken (10,5). Zo valt elke verwisseling op.
import './domStub';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { readXER } from '@/services/xer/xerReader';
import { readMPP } from '@/services/mpp/mppReader';
import { promoteCalendarsForHourMode } from '@/services/mpp/mppCalendars';
import { canonicalizeBands, registerCalendarBands } from '@/services/subdayIo';
import { parseOpenedFile } from '@/services/formatRegistry';
import { createAppStoreContext } from '@/state/appStore';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { effHoursPerDay } from '@/utils/taskDuration';
import type { Task } from '@/types/task';
import type { Baseline } from '@/types/baseline';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Project } from '@/types/project';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Sequence } from '@/types/sequence';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installDOMParser } from './xmldom-shim';

declare const process: { env: Record<string, string | undefined>; exit(code: number): never };

installDOMParser();

let checks = 0;
let fails = 0;
function eq(name: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    fails++;
    console.log(`   XX ${name}: kreeg ${JSON.stringify(got)} ≠ verwacht ${JSON.stringify(want)}`);
  }
}
function quiet<T>(fn: () => T): T {
  const log = console.log;
  const warn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try { return fn(); } finally { console.log = log; console.warn = warn; }
}

// ── Fixture ────────────────────────────────────────────────────────────────────────────────────
const START = 7 * 60;
const END = 17 * 60 + 30; // 07:00–17:30: 630 min werktijd, einde − begin in hele uren = 10
const BAND = [{ start: START, end: END }];
const WERKTIJD = 10.5;
const FILE_HPD = 8;
const weekBands = (): WorkTimeBands => {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (let d = 1; d <= 5; d++) byWeekday[d as 1] = [...BAND];
  return { byWeekday };
};
const CAL: WorkCalendar = {
  id: 'cal-proj', name: 'Lange dagen', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 7, workEndHour: 17, hoursPerDay: FILE_HPD, holidays: [], workTime: weekBands(),
};
const LIB: WorkCalendar = { ...CAL, id: 'cal-lib', name: 'Bibliotheek lange dagen', workTime: weekBands() };
const project: Project = {
  id: 'p', name: 'Uren per dag', description: '', startDate: '2026-07-06', endDate: '2026-12-31',
  calendarId: CAL.id, createdAt: '2026-07-06T00:00', modifiedAt: '2026-07-06T00:00', author: 'T', company: 'C',
};
const HOUR_MINUTES = 1870 * 60;
const mk = (name: string, unit: 'days' | 'hours', duration: number, minutes?: number, calendarId?: string): Task => ({
  id: `t-${name}`, name, description: '', wbsCode: name, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [],
  time: {
    durationType: 'WORKTIME', durationUnit: unit, scheduleDuration: duration,
    ...(minutes !== undefined ? { durationMinutes: minutes } : {}),
    scheduleStart: '2026-07-06T07:00', scheduleFinish: '2026-07-10T17:30',
    earlyStart: '2026-07-06T07:00', earlyFinish: '2026-07-10T17:30',
    lateStart: '2026-07-06T07:00', lateFinish: '2026-07-10T17:30',
    freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
  },
  resourceIds: [],
  ...(calendarId ? { calendarId } : {}),
});
const TASKS: Task[] = [mk('Dagtaak', 'days', 5), mk('Urentaak', 'hours', HOUR_MINUTES / (WERKTIJD * 60), HOUR_MINUTES)];
const LIB_TASK = mk('Dagtaak bibliotheek', 'days', 5, undefined, LIB.id);

type Format = {
  name: string;
  write: (cal: WorkCalendar, tasks: Task[], lib: WorkCalendar[], baselines?: Baseline[]) => string;
  read: (xml: string) => ImportResult;
  /** De geschreven uren per dag van de projectkalender, zoals ze in het bestand staan. */
  writtenHpd: (xml: string) => string | undefined;
  /** Wat de geschreven uren per dag moeten zijn bij `FILE_HPD`. */
  wantWritten: string;
  /** Zet de waarde uit het bestand op `raw` (`null` = weg). */
  setFileHpd: (xml: string, raw: string | null) => string;
  /** Voeg opgeslagen speling toe aan de urentaak: 105 werkuren = 10 werkdagen van 10,5 h. */
  addTotalFloat: (xml: string) => string;
};
const firstTag = (tag: string) => (xml: string) => xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];
const setTag = (tag: string) => (xml: string, raw: string | null) =>
  xml.replace(new RegExp(`<${tag}>[^<]*</${tag}>`, 'g'), raw === null ? '' : `<${tag}>${raw}</${tag}>`);
const insertInBlock = (block: string, name: string, extra: string) => (xml: string) =>
  xml.replace(new RegExp(`(<${block}>(?:(?!</${block}>)[\\s\\S])*<Name>${name}</Name>(?:(?!</${block}>)[\\s\\S])*)</${block}>`), `$1${extra}</${block}>`);

const P6: Format = {
  name: 'P6 XML',
  write: (cal, tasks, lib) => writeP6XML(project, cal, tasks, [], [], [], lib),
  read: readP6XML,
  writtenHpd: firstTag('HoursPerDay'),
  wantWritten: String(FILE_HPD),
  setFileHpd: setTag('HoursPerDay'),
  // Een vastlegging vraagt ook begin en einde; de eigen writer schrijft die P6-velden niet.
  addTotalFloat: insertInBlock('Activity', 'Urentaak',
    '<StartDate>2026-07-06T07:00:00</StartDate><FinishDate>2026-07-10T17:30:00</FinishDate><TotalFloat>105</TotalFloat>'),
};
const MSPDI: Format = {
  name: 'MSPDI',
  write: (cal, tasks, lib, baselines = []) => writeMSPDI(project, cal, tasks, [], [], [], lib, baselines, baselines[0]?.id ?? null),
  read: readMSPDI,
  writtenHpd: firstTag('MinutesPerDay'),
  wantWritten: String(FILE_HPD * 60),
  setFileHpd: setTag('MinutesPerDay'),
  // Tienden van een minuut: 105 h = 6300 min = 63000.
  addTotalFloat: insertInBlock('Task', 'Urentaak', '<TotalSlack>63000</TotalSlack>'),
};

function checkCalendar(label: string, cal: WorkCalendar | undefined, wantHpd: number): void {
  eq(`${label} hoursPerDay`, cal?.hoursPerDay, wantHpd);
  eq(`${label} blokken ma`, cal?.workTime?.byWeekday[1], BAND);
  eq(`${label} blokken vr`, cal?.workTime?.byWeekday[5], BAND);
}
function checkTasks(label: string, tasks: Task[], dayName: string): void {
  const day = tasks.find(t => t.name === dayName);
  const hour = tasks.find(t => t.name === 'Urentaak');
  eq(`${label} ${dayName}: dagen, 5 d`, [day?.time.durationUnit, day?.time.scheduleDuration], ['days', 5]);
  eq(`${label} urentaak: uren, minuten, dagengetal in werktijd (#363)`,
    [hour?.time.durationUnit, hour?.time.durationMinutes, hour?.time.scheduleDuration],
    ['hours', HOUR_MINUTES, HOUR_MINUTES / (WERKTIJD * 60)]);
}

// ── §1 Twee keer exporteren en heropenen ─────────────────────────────────────────────────────────
// P6 XML schrijft per kalender een eigen `HoursPerDay`: ook de bibliotheekkalender houdt 8.
// MSPDI kent alleen `<MinutesPerDay>` op projectniveau: een bibliotheekkalender heeft daar geen veld
// voor en volgt na heropenen de blokken. De dagtaak blijft toch 5 d: sinds F5a-2 (T13, §3.10) schrijft
// OPS een dag als de werktijd per dag (10,5 u) en leest hij hem zo terug.
function route(fmt: Format, libHpdAfter: number, libDayAfter: [number, number]): void {
  let cal = CAL;
  let lib = [LIB];
  let tasks = [...TASKS, LIB_TASK];
  for (let round = 1; round <= 2; round++) {
    const label = `§1 ${fmt.name} ronde ${round}`;
    const xml = quiet(() => fmt.write(cal, tasks, lib));
    eq(`${label} geschreven uren per dag`, fmt.writtenHpd(xml), fmt.wantWritten);
    const back = quiet(() => fmt.read(xml));
    checkCalendar(`${label} projectkalender`, back.calendar, FILE_HPD);
    checkTasks(label, back.tasks, 'Dagtaak');
    const backLib = back.resourceCalendars?.find(c => c.name === LIB.name);
    checkCalendar(`${label} bibliotheekkalender`, backLib, libHpdAfter);
    // De dagtaak op de bibliotheekkalender blijft 5 d, in beide formaten. Tot en met F5a-1 gaf MSPDI
    // 40 h ÷ 10,5 = 3,81 d (de geschreven 5 × 8 u gedeeld door de werktijd); T13 (F5a-2) lost dat op.
    eq(`${label} dagtaak op bibliotheekkalender`,
      back.tasks.find(t => t.name === LIB_TASK.name)?.time.scheduleDuration, libDayAfter[round - 1]);
    cal = back.calendar;
    lib = back.resourceCalendars ?? [];
    tasks = back.tasks;
  }
}
route(P6, FILE_HPD, [5, 5]);
route(MSPDI, WERKTIJD, [5, 5]);

// ── §2 Zonder eigen of met ongeldige waarde volgt de kalender de blokken ────────────────────────────
for (const fmt of [P6, MSPDI]) {
  const xml = quiet(() => fmt.write(CAL, TASKS, []));
  eq(`§2 ${fmt.name} zonder eigen waarde: de blokken (10,5)`,
    quiet(() => fmt.read(fmt.setFileHpd(xml, null))).calendar.hoursPerDay, WERKTIJD);
  eq(`§2 ${fmt.name} met waarde 0: de blokken (10,5)`,
    quiet(() => fmt.read(fmt.setFileHpd(xml, '0'))).calendar.hoursPerDay, WERKTIJD);
  // Een andere geldige waarde komt letterlijk terug (geen vaste 8 in de lezer).
  eq(`§2 ${fmt.name} met waarde 7,5: 7,5`,
    quiet(() => fmt.read(fmt.setFileHpd(xml, fmt === P6 ? '7.5' : '450'))).calendar.hoursPerDay, 7.5);
}

// ── §3 Opgeslagen speling op een uurkalender: in werktijd per dag, zoals XER ─────────────────────────
for (const fmt of [P6, MSPDI]) {
  const back = quiet(() => fmt.read(fmt.addTotalFloat(fmt.write(CAL, TASKS, []))));
  const hour = back.tasks.find(t => t.name === 'Urentaak');
  eq(`§3 ${fmt.name} opgeslagen speling 105 h = 10 werkdagen van 10,5 h (niet 13,125 van 8 h)`,
    hour ? back.recordedTimes?.[hour.id]?.totalFloat : 'geen taak', 10);
}

// ── §4 MSPDI-baseline: dag- en urentaak komen terug zoals ze gingen (samen met #363) ────────────────
{
  const baseline: Baseline = {
    id: 'b0', name: 'Basis', createdAt: '2026-07-01T00:00',
    tasks: TASKS.map(t => ({
      taskId: t.id, start: t.time.scheduleStart, finish: t.time.scheduleFinish,
      duration: t.time.scheduleDuration, isMilestone: false,
    })),
  } as Baseline;
  const back = quiet(() => MSPDI.read(MSPDI.write(CAL, TASKS, [], [baseline])));
  const durationOf = (name: string) => {
    const id = back.tasks.find(t => t.name === name)?.id;
    return back.baselines?.[0]?.tasks.find(b => b.taskId === id)?.duration;
  };
  eq('§4 MSPDI-baseline dagtaak 5 d', durationOf('Dagtaak'), 5);
  eq('§4 MSPDI-baseline urentaak in werktijd', durationOf('Urentaak'), HOUR_MINUTES / (WERKTIJD * 60));
}

// ── §5 De echte openroute (store, herberekenen) na export: samenloop met #363 ──────────────────────
const OPEN = { filePath: null, fileHandle: null, recompute: true, fit: false, linkedOpen: true } as const;
for (const fmt of [P6, MSPDI]) {
  const xml = quiet(() => fmt.write(CAL, TASKS, []));
  const parsed = await parseOpenedFile({ name: 'heropenen.xml', text: xml } as never);
  const ctx = createAppStoreContext();
  quiet(() => ctx.store.getState().applyOpenedImport(parsed, OPEN));
  const s = ctx.store.getState();
  eq(`§5 ${fmt.name} store: hoursPerDay 8, werktijd 10,5`, [s.calendar.hoursPerDay, effHoursPerDay(s.calendar)], [FILE_HPD, WERKTIJD]);
  checkTasks(`§5 ${fmt.name} store`, s.tasks, 'Dagtaak');
  // Een dagtaak van 5 d op deze kalender eindigt op de vijfde werkdag (vrijdag), niet een dag eerder.
  eq(`§5 ${fmt.name} store: dagtaak eindigt vrijdag`, s.tasks.find(t => t.name === 'Dagtaak')?.time.scheduleFinish.slice(0, 10), '2026-07-10');
}

// ── §6 `.mpp`: MINUTES_PER_DAY blijft na de promotie staan, net als MSPDI ──────────────────────────
{
  const register = (c: WorkCalendar) => {
    const { bands, deviates } = canonicalizeBands({ 1: BAND, 2: BAND, 3: BAND, 4: BAND, 5: BAND });
    registerCalendarBands(c, { canonical: bands, deviates });
  };
  const cal: WorkCalendar = { ...CAL, workTime: undefined, hoursPerDay: FILE_HPD };
  const other: WorkCalendar = { ...CAL, id: 'cal-other', workTime: undefined, hoursPerDay: 10 };
  register(cal);
  register(other);
  const promoted = promoteCalendarsForHourMode(
    new Map([[1, cal], [2, other]]), new Set([cal, other]), { calendar: cal, hoursPerDay: FILE_HPD },
  );
  eq('§6 .mpp-promotie: beide kalenders uurmodus', [promoted.has(cal), promoted.has(other)], [true, true]);
  eq('§6 .mpp-promotie: MINUTES_PER_DAY-kalender houdt 8, de andere volgt de blokken',
    [cal.hoursPerDay, other.hoursPerDay], [FILE_HPD, WERKTIJD]);
}
// Met corpus: drie MSPDI/.mpp-tweelingen geven dezelfde projectkalender en dezelfde speling.
const corpus = process.env.OPS_XER_CORPUS;
const twinDir = corpus ? join(corpus, 'mpxj/junit/data') : '';
if (corpus && existsSync(join(twinDir, 'mpp14timephased.mpp'))) {
  for (const [xml, mpp] of [['mspditimephased.xml', 'mpp14timephased.mpp'], ['baselines.xml', 'mpp14baselines.mpp'], ['mspdinulltasks.xml', 'mpp14nulltasks.mpp']]) {
    const a = quiet(() => readMSPDI(readFileSync(join(twinDir, xml), 'utf8')));
    const b = quiet(() => readMPP(new Uint8Array(readFileSync(join(twinDir, mpp)))));
    const tfOf = (r: ImportResult) => {
      const t = r.tasks.find(x => x.name === 'Task 1');
      return t ? r.recordedTimes?.[t.id]?.totalFloat : undefined;
    };
    eq(`§6 tweeling ${xml}/${mpp}: hoursPerDay gelijk`, a.calendar.hoursPerDay, b.calendar.hoursPerDay);
    // Speling alleen als beide bestanden hem dragen (mpp14nulltasks.mpp heeft er geen).
    if (tfOf(a) !== undefined && tfOf(b) !== undefined) {
      eq(`§6 tweeling ${xml}/${mpp}: speling Task 1 gelijk`, tfOf(a), tfOf(b));
    }
    eq(`§6 tweeling ${xml}: MinutesPerDay 450 blijft 7,5`, a.calendar.hoursPerDay, 7.5);
  }
} else {
  console.log('   .. §6 tweelingen overgeslagen: corpus niet aanwezig (OPS_XER_CORPUS)');
}

// ── §7 XER: de tweede promotie (uursignaal in TASK) houdt day_hr_cnt ───────────────────────────────
// Een kalender zonder klokblokken (lege clndr_data) promoveert pas in `xerReader` door een tijdstip in
// een taak. De lezer leidt daar blokken van 8 h af (08:00–16:00); `day_hr_cnt` 10 moet blijven staan,
// zoals bij de eerste promotie in `xerCalendarData.ts`.
{
  const xer = [
    'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date', '%R\tP1\tTweede promotie\tC1\t2026-08-03',
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tLeeg\tP1\tCA_Project\t10\t40\t',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tcomplete_pct_type\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date',
    '%R\tA\tP1\tC1\tA\tUren\tTT_Task\tTK_NotStart\tCP_Drtn\t0\t\t5\t5\t2026-08-03 09:00\t2026-08-03 14:00',
    '%E',
  ].join('\n');
  const r = quiet(() => readXER(new TextEncoder().encode(xer)));
  const c = isMultiDocumentImport(r) ? undefined : r.calendar;
  eq('§7 XER tweede promotie: testvoorwaarde uurkalender met afgeleide blokken 08:00–16:00',
    c?.workTime?.byWeekday[1], [{ start: 480, end: 960 }]);
  eq('§7 XER tweede promotie: day_hr_cnt 10 blijft', c?.hoursPerDay, 10);
}

// ── §8 MSPDI-toewijzing op een dagtaak: het werk rekent met de werktijd per dag ────────────────────
// Sinds F5a-2 (T14, §3.11) schrijft `mspdiWriter` `<Work>` als dagen × inzet × werktijd per dag
// (5 d × 10,5 u = 52,5 u; tot en met F5a-1 was dat 5 × `hoursPerDay` 8 = 40 u). De lezer rekent met
// dezelfde werktijd terug. Rekent hij anders, dan legt hij het werk vast als afwijkend werk, en groeit het
// werk niet meer mee als de gebruiker de duur verandert.
{
  const res = { id: 'r1', name: 'Timmerman', type: 'LABOR', description: '', maxUnits: 1 } as Resource;
  const asg: ResourceAssignment = { id: 'a1', taskId: 't-Dagtaak', resourceId: 'r1', unitsPerDay: 1 };
  const dayTask: Task = { ...mk('Dagtaak', 'days', 5), resourceIds: ['r1'] };
  const workHours = (xml: string) => {
    const m = xml.match(/<Assignment>[\s\S]*?<Work>PT(\d+)H(\d+)M/);
    return m ? `${m[1]}h${m[2]}m` : undefined;
  };
  const xml1 = quiet(() => writeMSPDI(project, CAL, [dayTask], [], [res], [asg], [], [], null));
  eq('§8 MSPDI-toewijzing: geschreven werk 52,5 u (testvoorwaarde)', workHours(xml1), '52h30m');
  const back = quiet(() => readMSPDI(xml1));
  const a = back.assignments?.[0];
  eq('§8 MSPDI-toewijzing: geen vastgelegd afwijkend werk na heropenen',
    [a?.unitsPerDay, a?.plannedWorkMinutes, a?.actualWorkMinutes, a?.remainingWorkMinutes], [1, undefined, undefined, undefined]);
  const t = back.tasks.find(x => x.name === 'Dagtaak');
  if (t) t.time.scheduleDuration = 10;
  const xml2 = quiet(() => writeMSPDI(project, back.calendar, back.tasks, [], back.resources ?? [], back.assignments ?? [], [], [], null));
  eq('§8 MSPDI-toewijzing: na 10 d groeit het werk mee naar 105 u', workHours(xml2), '105h0m');
}
// Een dagkalender (geen blokken, geen promotie) waarvan een ander programma `<MinutesPerDay>` naar 600
// (10 u) zette, naast werktijden van 8 u. `LinkLag` draagt 14400 tienden = 24 werkuur, en het record (T21)
// zegt `[3, 1440]`. Op deze kalender is een dag nu 10 u: 3 d zou 30 u zijn. De context past dus niet meer
// (review #585 r1, punt 2), het record telt niet, en de vertraging blijft 1440 minuten urenmaat.
{
  const dayCal: WorkCalendar = { ...CAL, id: 'cal-dag', workStartHour: 8, workEndHour: 16, workTime: undefined };
  const dayOnly = (name: string): Task => {
    const t = mk(name, 'days', 5);
    const d0 = '2026-07-06', d1 = '2026-07-10';
    return { ...t, time: { ...t.time, scheduleStart: d0, scheduleFinish: d1, earlyStart: d0, earlyFinish: d1, lateStart: d0, lateFinish: d1 } };
  };
  const seq: Sequence = { id: 's1', predecessorId: 't-Voor', successorId: 't-Na', type: 'FINISH_START', lagDays: 3 };
  const written = quiet(() => writeMSPDI({ ...project, calendarId: dayCal.id }, dayCal, [dayOnly('Voor'), dayOnly('Na')], [seq], [], [], [], [], null));
  eq('§8 MSPDI-dagkalender: testvoorwaarde LinkLag 14400 en MinutesPerDay 480',
    [written.match(/<LinkLag>([^<]*)</)?.[1], MSPDI.writtenHpd(written)], ['14400', '480']);
  const back = quiet(() => readMSPDI(MSPDI.setFileHpd(written, '600')));
  eq('§8 MSPDI-dagkalender: testvoorwaarde geen uurkalender; bestandswaarde 10 u', [!!back.calendar.workTime, back.calendar.hoursPerDay], [false, 10]);
  eq('§8 MSPDI-dagkalender: vertraging blijft 1440 minuten', [back.sequences[0]?.lagDays, back.sequences[0]?.lagMinutes], [0, 1440]);
}

if (fails > 0) {
  console.log(`XX  urenperdag-heropenen: ${fails}/${checks} checks rood`);
  process.exit(1);
}
console.log(`OK  urenperdag-heropenen: ${checks} checks groen`);
