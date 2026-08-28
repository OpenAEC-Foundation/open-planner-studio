// Adapter-uur-precisie-checks (fase 2.8b golf 4, ontwerpdoc §7). Permanent bewaakt via
// `bash tests/planning/run.sh`. Twee bewijzen:
//   1. UUR-ROUND-TRIP per formaat (IFC/P6/MSPDI): een uur-project (H8-band-projectkalender +
//      nachtploeg (wrap) + split-shift + taak 20u + lag 4u + taak-kalender-toewijzing) → schrijven →
//      lezen → `durationMinutes`/banden/echte-tijden/`lagMinutes` moeten exact terugkomen.
//   2. DAG-BESTAND-DISCRIMINATOR: een echt dag-example (IFC) → export naar P6/MSPDI → import: geen
//      `workTime`/`durationMinutes`-lek en identieke leaf-schedule (bewijst dat de discriminator een
//      dag-bestand dag houdt).
// De P6/MSPDI-readers gebruiken de browser-`DOMParser`; in Node leveren we die via een minimale shim.
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeCSV } from '@/services/csv/csvWriter';
import { readCSV } from '@/services/csv/csvReader';
import { MAX_TOTAL_HOLIDAY_SLOTS, MAX_RECURRENCE_DATES, MAX_CALENDAR_EXCEPTIONS } from '@/services/calendarRecurrence';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Task, ConstraintType } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Project } from '@/types/project';
import type { Resource, ResourceAssignment } from '@/types/resource';
import { installDOMParser } from './xmldom-shim';

installDOMParser();

// `import.meta.url`-relatief i.p.v. `process.cwd()` (review-bevinding): dit bestand draait via
// `bash tests/planning/run.sh`, dat NOOIT naar de repo-root `cd`'t — de child-`node`'s cwd is dus
// gewoon die van de AANROEPER. Vanaf een andere cwd (of tijdens twee gelijktijdige runs waarvan
// er één elders zit) las de oude `join(process.cwd(), 'examples', ...)` een niet-bestaand pad:
// een kale `ENOENT`-stacktrace zonder `XX`-regel, precies het soort onverklaarde "flake" dat
// eerder in deze suite is gerapporteerd. `HERE` is het bestandspad zelf, tijdzone/cwd-onafhankelijk.
const HERE = fileURLToPath(new URL('.', import.meta.url));

let checks = 0;
let fails = 0;
function assert(cond: boolean, msg: string): void {
  checks++;
  if (!cond) { fails++; console.log(`   XX ${msg}`); }
}
function eq(name: string, got: unknown, want: unknown): void {
  assert(JSON.stringify(got) === JSON.stringify(want), `${name}: kreeg ${JSON.stringify(got)} ≠ verwacht ${JSON.stringify(want)}`);
}

// ── Uur-model ────────────────────────────────────────────────────────────
const weekBands = (list: [number, number][]): WorkTimeBands['byWeekday'] => {
  const bw = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (let d = 1; d <= 5; d++) bw[d as 1] = list.map(([s, e]) => ({ start: s, end: e }));
  return bw;
};
const H8: WorkCalendar = {
  id: 'cal-h8', name: 'H8', description: 'ma-vr 08-16', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime: { byWeekday: weekBands([[480, 960]]) },
};
const NIGHT: WorkCalendar = {
  id: 'cal-night', name: 'Nachtploeg', description: 'ma-vr 22-06', workDays: [1, 2, 3, 4, 5],
  workStartHour: 22, workEndHour: 6, hoursPerDay: 8, holidays: [], workTime: { byWeekday: weekBands([[1320, 1800]]) }, shift: 'THIRD',
};
const BREAK: WorkCalendar = {
  id: 'cal-break', name: 'Pauze', description: 'split-shift', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [], workTime: { byWeekday: weekBands([[480, 720], [750, 990]]) }, shift: 'SECOND',
};
const project: Project = {
  id: 'p', name: 'Uur', description: '', startDate: '2026-07-06', endDate: '2026-07-31',
  calendarId: 'cal-h8', createdAt: '2026-07-06T00:00', modifiedAt: '2026-07-06T00:00', author: 'T', company: 'C',
};
const mk = (id: string, name: string, wbs: string, start: string, finish: string, minutes: number, calId?: string): Task => ({
  id, name, description: '', wbsCode: wbs, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
  priority: 500, parentId: null, childIds: [],
  time: {
    durationType: 'WORKTIME', scheduleDuration: minutes / 480, durationMinutes: minutes,
    scheduleStart: start, scheduleFinish: finish, earlyStart: start, earlyFinish: finish,
    lateStart: start, lateFinish: finish, freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
  },
  resourceIds: [], ...(calId ? { calendarId: calId } : {}),
});
const tasks = [
  mk('t-a', 'Metselen', '1', '2026-07-06T08:00', '2026-07-08T12:00', 1200),
  mk('t-b', 'Nachtwerk', '2', '2026-07-13T22:00', '2026-07-14T06:00', 480, 'cal-night'),
  mk('t-c', 'Afbouw', '3', '2026-07-20T08:00', '2026-07-21T10:30', 600, 'cal-break'),
];
const sequences: Sequence[] = [
  { id: 's1', predecessorId: 't-a', successorId: 't-b', type: 'FINISH_START', lagDays: 0, lagMinutes: 240 },
  { id: 's2', predecessorId: 't-b', successorId: 't-c', type: 'FINISH_START', lagDays: 0 },
];
const resources: Resource[] = [{ id: 'r', name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 1 }];
const assignments: ResourceAssignment[] = [{ id: 'a', taskId: 't-a', resourceId: 'r', unitsPerDay: 1 }];
const lib = [NIGHT, BREAK];

function roundTrip(label: string, tk: Task[], seq: Sequence[], cal: WorkCalendar, rcals: WorkCalendar[], supportsShift: boolean): void {
  const byName = new Map(tk.map(t => [t.name, t]));
  const calByName = new Map<string, WorkCalendar>([[cal.name, cal], ...rcals.map(c => [c.name, c] as const)]);
  eq(`${label} H8.bands`, cal.workTime?.byWeekday[1], [{ start: 480, end: 960 }]);
  eq(`${label} H8.hoursPerDay`, cal.hoursPerDay, 8);
  eq(`${label} Nacht.bands(wrap)`, calByName.get('Nachtploeg')?.workTime?.byWeekday[1], [{ start: 1320, end: 1800 }]);
  eq(`${label} Pauze.bands(split)`, calByName.get('Pauze')?.workTime?.byWeekday[1], [{ start: 480, end: 720 }, { start: 750, end: 990 }]);
  if (supportsShift) {
    eq(`${label} Nacht.shift`, calByName.get('Nachtploeg')?.shift, 'THIRD');
    eq(`${label} Pauze.shift`, calByName.get('Pauze')?.shift, 'SECOND');
  }
  eq(`${label} A.durationMinutes`, byName.get('Metselen')?.time.durationMinutes, 1200);
  eq(`${label} A.start`, byName.get('Metselen')?.time.scheduleStart, '2026-07-06T08:00');
  eq(`${label} B.durationMinutes`, byName.get('Nachtwerk')?.time.durationMinutes, 480);
  eq(`${label} B.start(22:00)`, byName.get('Nachtwerk')?.time.scheduleStart, '2026-07-13T22:00');
  eq(`${label} C.durationMinutes`, byName.get('Afbouw')?.time.durationMinutes, 600);
  const s1 = seq.find(s => tk.find(t => t.id === s.predecessorId)?.name === 'Metselen');
  eq(`${label} lag A→B lagMinutes`, s1?.lagMinutes, 240);
  // Bugfix B1 (gebruikstest 2026-08): een minuut-precieze lag (240 min = 4u, geen heel aantal
  // werkdagen) mag NOOIT via een uur→dag-afronding in `lagDays` lekken — dat gaf voorheen bij IFC
  // `lagDays: 1` (ceil(4/8)) náást de correcte `lagMinutes: 240`, zichtbaar in de UI als misleidend
  // "+1d" terwijl de CPM-datums (die lagMinutes gebruiken) gewoon klopten.
  eq(`${label} lag A→B lagDays (geen uur→dag-afronding)`, s1?.lagDays, 0);
}

{
  const p = readIFC(writeIFC({ project, calendar: H8, tasks, sequences, resources, assignments, resourceCalendars: lib }));
  roundTrip('IFC', p.tasks, p.sequences, p.calendar, p.resourceCalendars ?? [], true);
}
{
  const p = readP6XML(writeP6XML(project, H8, tasks, sequences, resources, assignments, lib));
  roundTrip('P6', p.tasks, p.sequences, p.calendar, p.resourceCalendars ?? [], false);
  eq('P6XML zonder bronwaarde introduceert geen schedulingOptions', p.project.schedulingOptions, undefined);
}
{
  const p = readMSPDI(writeMSPDI(project, H8, tasks, sequences, resources, assignments, lib));
  roundTrip('MSPDI', p.tasks, p.sequences, p.calendar, p.resourceCalendars ?? [], false);
  eq('MSPDI zonder CriticalSlackLimit introduceert geen schedulingOptions',
    p.project.schedulingOptions, undefined);
  eq('MSPDI introduceert geen XER-project- of kalenderprovenance',
    [p.project.schedulingOptions?.p6Source, p.calendar.p6Source], [undefined, undefined]);
}

// ── Review-follow-up (2026-08, op bugfix B1): GEMENGDE ISO-duur uit een VREEMD bestand ─────────────
// Onze eigen schrijver emitteert nooit een dag-component vóór de `T` (`minutesToIsoDuration` schrijft
// altijd kaal `PT{h}H{m}M0S`); `P1DT2H0M0S` is de vorm die een ANDER tool zou kunnen schrijven. Vóór
// deze follow-up verdween bij zo'n gemengde vorm stilzwijgend óf het dag-deel (nieuwe B1-volgorde:
// lagMinutes eerst) óf het uur-deel (oude volgorde: parseDurationDays zag alleen de D). De keuze nu:
// dag- én uurdeel samen in `lagMinutes`, kalendertijd-interpretatie (1D = 1440 min) — onderbouwing in
// `isoDurationLeadingDaysMinutes` (ifcReader.ts). Bewijst ook dat de twee bestaande (pure) vormen
// (kaal-uur, kaal-dag) ONGEWIJZIGD blijven.
{
  const dayCalMix: WorkCalendar = {
    id: 'cal-mix', name: 'Mix', description: 'ma-vr', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  };
  const projMix: Project = {
    id: 'p-mix', name: 'Mix', description: '', startDate: '2026-06-01', endDate: '2026-06-30',
    calendarId: 'cal-mix', createdAt: '2026-06-01T00:00', modifiedAt: '2026-06-01T00:00', author: 'T', company: 'C',
  };
  const D = '2026-06-08';
  const mkMix = (id: string, name: string, wbs: string): Task => ({
    id, name, description: '', wbsCode: wbs, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [],
    time: {
      durationType: 'WORKTIME', scheduleDuration: 2, scheduleStart: D, scheduleFinish: '2026-06-09',
      earlyStart: D, earlyFinish: '2026-06-09', lateStart: D, lateFinish: '2026-06-09',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    resourceIds: [],
  });
  const mixTasks = [mkMix('mix-a', 'Mix-A', '1'), mkMix('mix-b', 'Mix-B', '2')];
  const mixSeq: Sequence[] = [{ id: 'mix-s', predecessorId: 'mix-a', successorId: 'mix-b', type: 'FINISH_START', lagDays: 0, lagMinutes: 30 }];
  const ifc = writeIFC({ project: projMix, calendar: dayCalMix, tasks: mixTasks, sequences: mixSeq, resources: [], assignments: [] });
  const needle = "IFCDURATION('PT0H30M0S')";
  assert(ifc.includes(needle), 'setup: eigen schrijver emitteert PT0H30M0S voor lagMinutes 30');

  // (a) Hand-getampeerde GEMENGDE vorm: dag- én uurdeel moeten SAMEN landen, geen stil verlies.
  const mixedBack = readIFC(ifc.replace(needle, "IFCDURATION('P1DT2H0M0S')")).sequences[0];
  eq('gemengd P1DT2H0M0S: lagMinutes = 1D(1440)+2H(120)', mixedBack?.lagMinutes, 1560);
  eq('gemengd P1DT2H0M0S: lagDays blijft 0 (geen dubbeltelling)', mixedBack?.lagDays, 0);

  // (b) Bestaande vorm 1 (ongewijzigd): kaal uur, geen dag-component.
  const pureHourBack = readIFC(ifc).sequences[0];
  eq('bestaande vorm ongewijzigd: PT0H30M0S ⇒ lagMinutes 30', pureHourBack?.lagMinutes, 30);
  eq('bestaande vorm ongewijzigd: PT0H30M0S ⇒ lagDays 0', pureHourBack?.lagDays, 0);

  // (c) Bestaande vorm 2 (ongewijzigd): kaal dag, geen `T` — puur het oude `parseDurationDays`-pad.
  const pureDayBack = readIFC(ifc.replace(needle, "IFCDURATION('P3D')")).sequences[0];
  eq('bestaande vorm ongewijzigd: P3D ⇒ lagDays 3', pureDayBack?.lagDays, 3);
  eq('bestaande vorm ongewijzigd: P3D ⇒ lagMinutes undefined', pureDayBack?.lagMinutes, undefined);
}

// ── Dag-bestand-discriminator (geen uur-lek + identieke leaf-schedule) ──────
{
  const src = readFileSync(join(HERE, '..', '..', 'examples', '03-kantoorgebouw-zuidas.ifc'), 'utf8');
  const M = readIFC(src);
  const startOf = (t: Task) => (t.time.earlyStart || t.time.scheduleStart).substring(0, 10);
  const digest = (ts: Task[]) => ts.filter(t => t.childIds.length === 0)
    .map(t => `${t.name}|${t.time.scheduleDuration}|${startOf(t)}`).sort().join('\n');
  const base = digest(M.tasks);
  const p6 = readP6XML(writeP6XML(M.project, M.calendar, M.tasks, M.sequences, M.resources, M.assignments, M.resourceCalendars));
  const msp = readMSPDI(writeMSPDI(M.project, M.calendar, M.tasks, M.sequences, M.resources, M.assignments, M.resourceCalendars));
  eq('P6-example leaf-schedule', digest(p6.tasks), base);
  eq('MSPDI-example leaf-schedule', digest(msp.tasks), base);
  assert([p6.calendar, ...(p6.resourceCalendars ?? [])].every(c => !c.workTime), 'P6-example: geen workTime-lek');
  assert(p6.tasks.every(t => t.time.durationMinutes == null), 'P6-example: geen durationMinutes-lek');
  assert([msp.calendar, ...(msp.resourceCalendars ?? [])].every(c => !c.workTime), 'MSPDI-example: geen workTime-lek');
  assert(msp.tasks.every(t => t.time.durationMinutes == null), 'MSPDI-example: geen durationMinutes-lek');
}

// ══ Fase 2.9 golf 6 — constraint-round-trip + hard/secundair + custom psets ═════════════════════
// Permanent bewaakt: mapping-tabellen béíde richtingen (writer emitteert de juiste code, reader
// leest 'm terug), de soft↔hard-val (soft MSO→SNET op MSPDI), hard-round-trip, en de pset-round-trips
// (OPS_Hammock/OPS_SchedulingOptions/secundaire constraint). Los van de uur-checks hierboven.
{
  const dayCal: WorkCalendar = {
    id: 'cal-d', name: 'Dag', description: 'ma-vr', workDays: [1, 2, 3, 4, 5],
    workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
  };
  const dayProj: Project = {
    id: 'p-d', name: 'Dag', description: '', startDate: '2026-06-01', endDate: '2026-06-30',
    calendarId: 'cal-d', createdAt: '2026-06-01T00:00', modifiedAt: '2026-06-01T00:00', author: 'T', company: 'C',
  };
  const D = '2026-06-08';
  const mkT = (extra: Partial<Task>): Task[] => [{
    id: 'x', name: 'X', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [],
    time: {
      durationType: 'WORKTIME', scheduleDuration: 2, scheduleStart: D, scheduleFinish: '2026-06-09',
      earlyStart: D, earlyFinish: '2026-06-09', lateStart: D, lateFinish: '2026-06-09',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    resourceIds: [], ...extra,
  }];
  const readT = (fmt: 'IFC' | 'P6' | 'MSPDI', tk: Task[]): Task => {
    if (fmt === 'IFC') return readIFC(writeIFC({ project: dayProj, calendar: dayCal, tasks: tk, sequences: [], resources: [], assignments: [] })).tasks.find(t => t.name === 'X')!;
    if (fmt === 'P6') return readP6XML(writeP6XML(dayProj, dayCal, tk, [], [], [])).tasks.find(t => t.name === 'X')!;
    return readMSPDI(writeMSPDI(dayProj, dayCal, tk, [], [], [])).tasks.find(t => t.name === 'X')!;
  };
  const withWarns = <T>(fn: () => T): { out: T; warns: string[] } => {
    const warns: string[] = []; const orig = console.warn;
    console.warn = (...a: unknown[]) => { warns.push(a.join(' ')); };
    try { return { out: fn(), warns }; } finally { console.warn = orig; }
  };

  // (a) P6 mapping-tabel béíde richtingen: writer emitteert de CS_*-code, reader leest 'm terug.
  const P6_MAP: [ConstraintType, string, boolean][] = [
    ['ALAP', 'CS_ALAP', false], ['SNET', 'CS_MSOA', false], ['SNLT', 'CS_MSOB', false],
    ['FNET', 'CS_MEOA', false], ['FNLT', 'CS_MEOB', false], ['MSO', 'CS_MSO', false],
    ['MFO', 'CS_MEO', false], ['MSO', 'CS_MANDSTART', true], ['MFO', 'CS_MANDFIN', true],
  ];
  for (const [type, code, hard] of P6_MAP) {
    const tk = mkT({ constraint: { type, ...(type === 'ALAP' ? {} : { date: D }), ...(hard ? { hard: true } : {}) } });
    const xml = writeP6XML(dayProj, dayCal, tk, [], [], []);
    assert(xml.includes(`<PrimaryConstraintType>${code}</PrimaryConstraintType>`), `P6 writer ${type}${hard ? '(hard)' : ''} → ${code}`);
    const back = readT('P6', tk).constraint;
    eq(`P6 rt ${type}${hard ? '(hard)' : ''} type`, back?.type, type);
    eq(`P6 rt ${type}${hard ? '(hard)' : ''} hard`, back?.hard ?? false, hard);
  }

  // (b) MSPDI mapping-tabel béíde richtingen (soft SNET/SNLT/FNET/FNLT + hard MSO/MFO).
  const MSP_MAP: [ConstraintType, number, boolean][] = [
    ['ALAP', 1, false], ['SNET', 4, false], ['SNLT', 5, false], ['FNET', 6, false],
    ['FNLT', 7, false], ['MSO', 2, true], ['MFO', 3, true],
  ];
  for (const [type, code, hard] of MSP_MAP) {
    const tk = mkT({ constraint: { type, ...(type === 'ALAP' ? {} : { date: D }), ...(hard ? { hard: true } : {}) } });
    const xml = writeMSPDI(dayProj, dayCal, tk, [], [], []);
    assert(xml.includes(`<ConstraintType>${code}</ConstraintType>`), `MSPDI writer ${type}${hard ? '(hard)' : ''} → ${code}`);
    const back = readT('MSPDI', tk).constraint;
    eq(`MSPDI rt ${type}${hard ? '(hard)' : ''} type`, back?.type, type);
    eq(`MSPDI rt ${type}${hard ? '(hard)' : ''} hard`, back?.hard ?? false, hard);
  }

  // (c) De soft↔hard-VAL: soft MSO/MFO mag op MSPDI NIET naar code 2/3 (hard) — degradeert naar
  //     SNET(4)/FNET(6) mét warn; op P6 blijft soft MSO/MFO exact (CS_MSO/CS_MEO).
  for (const [type, mspCode, p6Code] of [['MSO', 4, 'CS_MSO'], ['MFO', 6, 'CS_MEO']] as const) {
    const tk = mkT({ constraint: { type, date: D } });
    const { out: mspXml, warns } = withWarns(() => writeMSPDI(dayProj, dayCal, tk, [], [], []));
    assert(mspXml.includes(`<ConstraintType>${mspCode}</ConstraintType>`), `MSPDI soft ${type} → code ${mspCode} (NIET hard 2/3)`);
    assert(!mspXml.includes('<ConstraintType>2</ConstraintType>') && !mspXml.includes('<ConstraintType>3</ConstraintType>'), `MSPDI soft ${type} niet naar 2/3`);
    assert(warns.some(w => w.includes('gedegradeerd')), `MSPDI soft ${type} → semantiek-verlies-warn`);
    eq(`MSPDI soft ${type} leest terug als soft ${type === 'MSO' ? 'SNET' : 'FNET'}`, withWarns(() => readT('MSPDI', tk)).out.constraint?.type, type === 'MSO' ? 'SNET' : 'FNET');
    // P6: soft MSO/MFO behoudt semantiek (geen degradatie) — zowel in de GESCHREVEN code als
    // teruggelezen. De code-assertie ontbrak: `p6Code` stond wel in de tabel maar werd nooit
    // gebruikt, dus een writer die stil naar CS_MANDSTART/CS_MANDFIN (hard) zou zakken bleef
    // ongezien zolang de reader het type maar terugvond.
    const p6Xml = writeP6XML(dayProj, dayCal, tk, [], [], []);
    assert(p6Xml.includes(`<PrimaryConstraintType>${p6Code}</PrimaryConstraintType>`), `P6 soft ${type} → ${p6Code}`);
    const p6Back = readT('P6', tk).constraint;
    eq(`P6 soft ${type} behoudt type`, p6Back?.type, type);
    eq(`P6 soft ${type} blijft soft`, p6Back?.hard ?? false, false);
  }

  // (d) Hard-round-trip incl. datum, alle drie de formaten (IFC/P6/MSPDI).
  for (const fmt of ['IFC', 'P6', 'MSPDI'] as const) {
    const tk = mkT({ constraint: { type: 'MSO', date: D, hard: true } });
    const back = readT(fmt, tk).constraint;
    eq(`${fmt} hard MSO type`, back?.type, 'MSO');
    eq(`${fmt} hard MSO hard`, back?.hard, true);
    eq(`${fmt} hard MSO date`, back?.date, D);
  }

  // (e) Secundaire constraint: IFC + P6 round-trippen 'm (native); MSPDI laat 'm vallen + warn.
  {
    const tk = mkT({ constraint: { type: 'SNET', date: '2026-06-03' }, constraint2: { type: 'FNLT', date: D } });
    for (const fmt of ['IFC', 'P6'] as const) {
      const c2 = readT(fmt, tk).constraint2;
      eq(`${fmt} secundair type`, c2?.type, 'FNLT');
      eq(`${fmt} secundair date`, c2?.date, D);
      eq(`${fmt} secundair niet-hard`, c2?.hard ?? false, false);
    }
    const { out: mspTk, warns } = withWarns(() => readMSPDI(writeMSPDI(dayProj, dayCal, tk, [], [], [])).tasks.find(t => t.name === 'X')!);
    eq('MSPDI secundair valt weg', mspTk.constraint2 ?? null, null);
    eq('MSPDI primair blijft', mspTk.constraint?.type, 'SNET');
    assert(warns.some(w => w.includes('secundaire constraint')), 'MSPDI secundair → weggelaten-warn');
  }

  // (f) OPS_Hammock-pset: IFC round-trippt isHammock; P6/MSPDI laten 'm vallen (gewone taak) + warn.
  {
    const tk = mkT({ isHammock: true });
    eq('IFC hammock round-trip', readT('IFC', tk).isHammock, true);
    const { out: p6Tk, warns: pw } = withWarns(() => readP6XML(writeP6XML(dayProj, dayCal, tk, [], [], [])).tasks.find(t => t.name === 'X')!);
    eq('P6 hammock valt weg (gewone taak)', p6Tk.isHammock ?? false, false);
    assert(pw.some(w => w.includes('hammock')), 'P6 hammock → warn');
    const { out: mspTk, warns: mw } = withWarns(() => readMSPDI(writeMSPDI(dayProj, dayCal, tk, [], [], [])).tasks.find(t => t.name === 'X')!);
    eq('MSPDI hammock valt weg (gewone taak)', mspTk.isHammock ?? false, false);
    assert(mw.some(w => w.includes('hammock')), 'MSPDI hammock → warn');
  }

  // (g) OPS_SchedulingOptions-pset: IFC round-trippt het VOLLE blok; MSPDI alleen
  //     criticalDefinition.threshold via CriticalSlackLimit (rest weggelaten + warn); P6 niets + warn.
  {
    const so = {
      criticalDefinition: { mode: 'totalFloat' as const, threshold: 2 },
      lagCalendar: 'successor' as const,
      floatPaths: { enabled: true, method: 'FREE_FLOAT' as const, maxPaths: 10 },
    };
    const proj2: Project = { ...dayProj, schedulingOptions: so };
    const tk = mkT({});
    const ifcBack = readIFC(writeIFC({ project: proj2, calendar: dayCal, tasks: tk, sequences: [], resources: [], assignments: [] })).project.schedulingOptions;
    eq('IFC schedulingOptions volledig round-trip', ifcBack, so);
    const { out: mspBack, warns: mw } = withWarns(() => readMSPDI(writeMSPDI(proj2, dayCal, tk, [], [], [])).project.schedulingOptions);
    eq('MSPDI CriticalSlackLimit → threshold', mspBack?.criticalDefinition, { mode: 'totalFloat', threshold: 2 });
    eq('MSPDI lagCalendar/floatPaths weg', [mspBack?.lagCalendar, mspBack?.floatPaths], [undefined, undefined]);
    assert(mw.some(w => w.includes('lagCalendar')), 'MSPDI schedulingOptions-verlies-warn');
    const { out: p6Back, warns: pw } = withWarns(() => readP6XML(writeP6XML(proj2, dayCal, tk, [], [], [])).project.schedulingOptions);
    eq('P6 schedulingOptions niet uitdrukbaar', p6Back ?? null, null);
    assert(pw.some(w => w.includes('scheduling-opties')), 'P6 schedulingOptions-verlies-warn');
  }
}

// ══ T4 (fase 3.8, MSP-pariteit, baan K) — MSPDI-uitzonderingssemantiek ═══════════════════════════
// mspdiReader.ts leest sinds T4 dezelfde uitzonderingssemantiek uit <Exception> als mppCalendars.ts
// (T3) uit het 92-byte MPP-blok: DayWorking=1 + <WorkingTimes> → WorkingException met banden;
// <Type> (recurrent) wordt geëxpandeerd via T3's `expandRecurrence`/`resolveContributions`
// (rechtstreeks hergebruikt, geen tweede expansie). writeMSPDI schreef dit tot en met T12 niet
// (alleen de READER, buiten T4's scope) — T13 (§T2-afwijking, LAAG-7-afnemer) haalt dat in, zie
// sectie (h) hieronder. Fixtures (a)-(g) zijn hand-gebouwde MSPDI-XML-strings (lazen dus altijd al
// via de echte lezer, maar niet via writeMSPDI geproduceerd) — wél binnen het schema zoals
// MSPDIWriter.java het daadwerkelijk emitteert (geverifieerd tegen de MPXJ-bron, zie mspdiReader.ts's
// importtoelichting); (h) draait wél de ECHTE writeMSPDI+readMSPDI-round-trip.
{
  const weekdayXml = (dayType: number): string => `<WeekDay><DayType>${dayType}</DayType><DayWorking>1</DayWorking>` +
    `<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>`;
  // MSP-dagtype: 1=zo..7=za — 2..6 = ma..vr (spiegelt de bestaande DayType-conversie in applyCalendarBody).
  const monVriWeekDays = [2, 3, 4, 5, 6].map(weekdayXml).join('');
  const mkDoc = (exceptionsXml: string, tasksXml = ''): string => `<?xml version="1.0"?>
<Project>
  <StartDate>2026-01-01T00:00:00</StartDate>
  <FinishDate>2026-12-31T00:00:00</FinishDate>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>T4-test</Name>
      <WeekDays>${monVriWeekDays}</WeekDays>
      <Exceptions>${exceptionsXml}</Exceptions>
    </Calendar>
  </Calendars>
  ${tasksXml}
</Project>`;

  // (a) DayWorking=1 + <WorkingTimes> (niet-recurrent) → WorkingException met banden, GEEN holiday.
  //     Plan-§T4-acceptatie 1. 2026-01-10 is een zaterdag (niet-werk-weekdag) — de uitzondering maakt
  //     'm werkend met eigen 06:00-12:00-banden i.p.v. de standaard 08:00-17:00.
  {
    const xml = mkDoc(
      '<Exception><Name>Werkende zaterdag</Name><DayWorking>1</DayWorking>' +
      '<TimePeriod><FromDate>2026-01-10T00:00:00</FromDate><ToDate>2026-01-10T00:00:00</ToDate></TimePeriod>' +
      '<WorkingTimes><WorkingTime><FromTime>06:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime></WorkingTimes></Exception>',
    );
    const cal = readMSPDI(xml).calendar;
    eq('T4 DayWorking=1: 0 holidays', cal.holidays.length, 0);
    assert((cal.workingExceptions ?? []).length === 1, 'T4 DayWorking=1: 1 workingException');
    const w = (cal.workingExceptions ?? [])[0];
    eq('T4 DayWorking=1: datum', [w?.startDate, w?.endDate], ['2026-01-10', '2026-01-10']);
    eq('T4 DayWorking=1: banden 06:00-12:00', w?.bands, [{ start: 360, end: 720 }]);
  }

  // (b) Recurrente uitzondering (<Type>) wordt geëxpandeerd — plan-§T4-acceptatie "recurrente
  //     exceptie wordt geëxpandeerd". Type=2 = YEARLY-absoluut (RECURRENCE_TYPES, hergebruikt van
  //     mppCalendars.ts); MonthDay=1/Month=0 (→ monthNumber=1) = "elk jaar 1 januari". Venster
  //     2020-01-01..2022-12-31 — zelfde fixture-wiskunde als T3's directe expandRecurrence-test in
  //     check-mpp-calendars.ts (3 datums: 2020/2021/2022, telkens 1 januari), hier via de MSPDI-
  //     leeskant bewezen i.p.v. rechtstreeks op expandRecurrence.
  {
    const xml = mkDoc(
      '<Exception><Name>Nieuwjaar</Name><DayWorking>0</DayWorking>' +
      '<TimePeriod><FromDate>2020-01-01T00:00:00</FromDate><ToDate>2022-12-31T00:00:00</ToDate></TimePeriod>' +
      '<Type>2</Type><MonthDay>1</MonthDay><Month>0</Month></Exception>',
    );
    const cal = readMSPDI(xml).calendar;
    assert(cal.holidays.length === 3, `T4 YEARLY-recurrentie: 3 holidays (kreeg ${cal.holidays.length})`);
    const dates = cal.holidays.map((h) => h.startDate).sort();
    eq('T4 YEARLY-recurrentie: exacte datums', dates, ['2020-01-01', '2021-01-01', '2022-01-01']);
  }

  // (c) Precedentie: recurrente WERKENDE uitzondering (elk jaar 1 januari) + niet-recurrente
  //     FEESTDAG op dezelfde datum, LATER in het document → de niet-recurrente laag wint over de
  //     recurrente, ONGEACHT working/holiday-richting (T3's precedentie is symmetrisch: niet-
  //     recurrent > elke recurrente groep). Spiegelt check-mpp-calendars.ts's "MET niet-recurrente
  //     laag"-precedentietest, hier met omgekeerde working/holiday-rollen voor variatie.
  {
    const xml = mkDoc(
      '<Exception><Name>Jaarlijkse werkdag</Name><DayWorking>1</DayWorking>' +
      '<TimePeriod><FromDate>2020-01-01T00:00:00</FromDate><ToDate>2020-12-31T00:00:00</ToDate></TimePeriod>' +
      '<Type>2</Type><MonthDay>1</MonthDay><Month>0</Month>' +
      '<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime></WorkingTimes></Exception>' +
      '<Exception><Name>Override-feestdag</Name><DayWorking>0</DayWorking>' +
      '<TimePeriod><FromDate>2020-01-01T00:00:00</FromDate><ToDate>2020-01-01T00:00:00</ToDate></TimePeriod></Exception>',
    );
    const cal = readMSPDI(xml).calendar;
    const holidayHit = cal.holidays.some((h) => h.startDate <= '2020-01-01' && '2020-01-01' <= h.endDate);
    const workingHit = (cal.workingExceptions ?? []).some((w) => w.startDate <= '2020-01-01' && '2020-01-01' <= w.endDate);
    assert(Number(holidayHit) + Number(workingHit) === 1, 'T4 precedentie: 2020-01-01 in precies één van de twee arrays');
    assert(holidayHit && !workingHit, 'T4 precedentie: niet-recurrent (feestdag) wint over recurrent (werkend)');
  }

  // (d) T11-spiegel: MSPDI-kant van milestoneKind (§9/O6-vervolg) — een UUR-modus-mijlpaal krijgt
  //     'FINISH' wanneer het anker op een bandeinde landt, 'START' op een bandbegin; een gewone taak
  //     blijft ongemoeid. 2026-01-06 = dinsdag, 2026-01-07 = woensdag (beide ma-vr-werkdagen op de
  //     08:00-17:00-kalender hierboven). Task 1's 17:00-anker triggert het (c)-uurmodus-signaal voor
  //     de HELE kalender (MSP_TIME_ANCHOR='08:00:00' — 17:00 is geen anker-tijd), dus task 2 en 3
  //     (op dezelfde kalender) draaien automatisch ook in uurmodus.
  {
    const tasksXml = `<Tasks>
      <Task><UID>1</UID><Name>MijlpaalFinish</Name><OutlineLevel>1</OutlineLevel><Milestone>1</Milestone>
        <Duration>PT0H0M0S</Duration><Start>2026-01-06T17:00:00</Start><Finish>2026-01-06T17:00:00</Finish></Task>
      <Task><UID>2</UID><Name>MijlpaalStart</Name><OutlineLevel>1</OutlineLevel><Milestone>1</Milestone>
        <Duration>PT0H0M0S</Duration><Start>2026-01-07T08:00:00</Start><Finish>2026-01-07T08:00:00</Finish></Task>
      <Task><UID>3</UID><Name>GewoneTaak</Name><OutlineLevel>1</OutlineLevel><Milestone>0</Milestone>
        <Duration>PT8H0M0S</Duration><Start>2026-01-06T08:00:00</Start><Finish>2026-01-06T17:00:00</Finish></Task>
    </Tasks>`;
    const xml = mkDoc('', tasksXml);
    const tasks = readMSPDI(xml).tasks;
    const byName = new Map(tasks.map((t) => [t.name, t]));
    eq('T4 milestoneKind: bandeinde (17:00) → FINISH', byName.get('MijlpaalFinish')?.milestoneKind, 'FINISH');
    eq('T4 milestoneKind: bandbegin (08:00) → START', byName.get('MijlpaalStart')?.milestoneKind, 'START');
    eq('T4 milestoneKind: gewone taak blijft ongezet', byName.get('GewoneTaak')?.milestoneKind, undefined);
  }

  // (d2) H2 (Opus-review T15-iteratie-2) — MSPDI-spiegel van de mppReader.ts-guard: een taak met
  //      `Milestone=1` ÉN een reële duur (MSP-legitiem, "mijlpaal-met-duur", zie
  //      `CPMSolver.isZeroDurationMilestone`) krijgt GEEN `milestoneKind`, ook al landt haar anker
  //      exact op een bandgrens — anders zou een latere opvolger via `snapSuccessorEarlyStart` de
  //      FINISH-mijlpaal-landing toepassen op een taak die voor de planning geen mijlpaal is.
  {
    const tasksXml = `<Tasks>
      <Task><UID>1</UID><Name>MijlpaalMetDuur</Name><OutlineLevel>1</OutlineLevel><Milestone>1</Milestone>
        <Duration>PT8H0M0S</Duration><Start>2026-01-06T17:00:00</Start><Finish>2026-01-07T17:00:00</Finish></Task>
    </Tasks>`;
    const xml = mkDoc('', tasksXml);
    const task = readMSPDI(xml).tasks.find((t) => t.name === 'MijlpaalMetDuur');
    eq('H2 MSPDI: mijlpaal-met-duur (PT8H) blijft isMilestone===true', task?.isMilestone, true);
    eq('H2 MSPDI: mijlpaal-met-duur krijgt GEEN milestoneKind ondanks bandeinde-anker (17:00)', task?.milestoneKind, undefined);
  }

  // (e) SPEC-REVIEW-FIX (should-fix): Fixture-F-analogon (mppReader.ts/check-mpp-import.ts, T11-
  //     reviewfix c0c2cd27) — een band die EXACT om middernacht eindigt (20:00-24:00, geen theoretisch
  //     randgeval: `applyCalendarBody` bouwt zo'n band zonder clamp). Maandag draagt twee banden
  //     (08:00-16:00 + 20:00-24:00 — discriminator (a) garandeert uurmodus via het niet-anker-anker
  //     00:00 zelf), mijlpaal-anker op dinsdag 00:00 ⇒ moet 'FINISH' zijn (de wrap-staart van maandags
  //     tweede band). Vóór de fix gaf de MSPDI-kant hier `undefined` (strikte `b.end > 1440` i.p.v.
  //     mppReader.ts's `>= 1440`) — een pariteitsregressie tussen de twee MS-Project-lezers.
  {
    const xml = `<?xml version="1.0"?>
<Project>
  <StartDate>2026-01-01T00:00:00</StartDate>
  <FinishDate>2026-12-31T00:00:00</FinishDate>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>WrapMiddernacht</Name>
      <WeekDays>
        <WeekDay><DayType>2</DayType><DayWorking>1</DayWorking><WorkingTimes>
          <WorkingTime><FromTime>08:00:00</FromTime><ToTime>16:00:00</ToTime></WorkingTime>
          <WorkingTime><FromTime>20:00:00</FromTime><ToTime>24:00:00</ToTime></WorkingTime>
        </WorkingTimes></WeekDay>
      </WeekDays>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task><UID>1</UID><Name>WrapMijlpaal</Name><OutlineLevel>1</OutlineLevel><Milestone>1</Milestone>
      <Duration>PT0H0M0S</Duration><Start>2026-01-06T00:00:00</Start><Finish>2026-01-06T00:00:00</Finish></Task>
  </Tasks>
</Project>`;
    // 2026-01-06 is een dinsdag; de wrap-staart van maandag (2026-01-05) 20:00-24:00 landt daar op 00:00.
    const task = readMSPDI(xml).tasks.find((t) => t.name === 'WrapMijlpaal');
    eq('T4 wrap-middernacht: anker di 00:00 na een ma 20:00-24:00-band ⇒ milestoneKind === FINISH', task?.milestoneKind, 'FINISH');
  }

  // (f) SPEC-REVIEW-FIX (blokkerend): budget-klem TIJDENS de opbouw (niet pas in resolveContributions
  //     erna) — verkleinde versie van de reviewer-DoS-repro (445 KB XML → 5192 ms/478 MB vóór de fix).
  //     `MAX_CALENDAR_EXCEPTIONS` (2000, de ECHTE per-kalender-bovengrens) NIET-OVERLAPPENDE WEEKLY-
  //     alle-dagen-uitzonderingen, elk over een 11-jaars-venster (> MAX_RECURRENCE_DATES dagen) — elke
  //     record expandeert dus tot PRECIES MAX_RECURRENCE_DATES (3660) datums, gegarandeerd door
  //     `expandRecurrence`'s eigen per-record-klem. Met het gedeelde budget (`MAX_TOTAL_HOLIDAY_
  //     SLOTS`, 100.000) passen daar `Math.floor(100000/3660)=27` VOLLE records in (98.820 dagen) + 1
  //     gedeeltelijke record (100.000-98.820=1.180 dagen) = 28 records met output; de overige 1972
  //     dragen NIETS bij. Niet-overlappend (elk venster staat ver genoeg uit elkaar) ⇒ EXACTE,
  //     voorspelbare tellingen (spiegelt check-mpp-calendars.ts se precieze-telling-stijl), losstaand
  //     van de latere precedentie-/overlap-mechaniek.
  //
  //     GROOTTE-KEUZE (gemeten, niet aangenomen): een eerdere, kleinere fixture (200 records) bleek
  //     GEEN betrouwbare regressiewacht — `resolveContributions`'s EIGEN vaste basiskosten (~260ms
  //     Date/string-werk voor de 100.000 (record,datum)-paren, ONAFHANKELIJK van hoeveel EXTRA records
  //     `buildContributions` zou moeten negeren) domineerden bij 200 records zozeer dat de MUTATIE
  //     hieronder (budget-klem-tijdens-opbouw genegeerd) 830ms gaf — nog steeds < 1000ms, dus GEEN rode
  //     regel. Bij `MAX_CALENDAR_EXCEPTIONS` (2000, de werkelijke bestandsgrens — geen willekeurige
  //     keuze) is het verschil overtuigend: FIXED 311ms, GEMUTEERD (budget genegeerd in
  //     `buildContributions`, ongewijzigde `resolveContributions`) 2408ms — exact het "safe-maar-traag"
  //     patroon van de reviewer-bevinding, ruim aan weerszijden van de 1s-grens.
  {
    const recordCount = MAX_CALENDAR_EXCEPTIONS;
    const spacingYears = 11; // > 3660/365.25 ≈ 10,02 jaar — garandeert de MAX_RECURRENCE_DATES-klem per record
    const excXml = Array.from({ length: recordCount }, (_, i) => {
      const fromYear = 2000 + i * spacingYears;
      const toYear = fromYear + spacingYears;
      return `<Exception><DayWorking>0</DayWorking>` +
        `<TimePeriod><FromDate>${fromYear}-01-01T00:00:00</FromDate><ToDate>${toYear}-01-01T00:00:00</ToDate></TimePeriod>` +
        `<Type>6</Type><DaysOfWeek>127</DaysOfWeek><Period>1</Period></Exception>`;
    }).join('');
    const xml = `<?xml version="1.0"?>
<Project>
  <StartDate>2000-01-01T00:00:00</StartDate>
  <FinishDate>2200-01-01T00:00:00</FinishDate>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>BudgetKlem</Name>
      <WeekDays>${[2, 3, 4, 5, 6].map((d) => `<WeekDay><DayType>${d}</DayType><DayWorking>1</DayWorking>` +
        `<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>`).join('')}</WeekDays>
      <Exceptions>${excXml}</Exceptions>
    </Calendar>
  </Calendars>
</Project>`;

    const fullRecords = Math.floor(MAX_TOTAL_HOLIDAY_SLOTS / MAX_RECURRENCE_DATES);
    const remainderDays = MAX_TOTAL_HOLIDAY_SLOTS - fullRecords * MAX_RECURRENCE_DATES;
    const expectedRecordsWithOutput = fullRecords + (remainderDays > 0 ? 1 : 0);

    const start = Date.now();
    const cal = readMSPDI(xml).calendar;
    const elapsedMs = Date.now() - start;

    assert(
      cal.holidays.length === expectedRecordsWithOutput,
      `T4 budget-klem-tijdens-opbouw: ${expectedRecordsWithOutput} holiday-bereiken (kreeg ${cal.holidays.length}) — ${recordCount - expectedRecordsWithOutput} records boven het budget droegen terecht niets bij`,
    );
    const totalDays = cal.holidays.reduce((sum, h) => {
      const days = Math.round((new Date(h.endDate).getTime() - new Date(h.startDate).getTime()) / 86_400_000) + 1;
      return sum + days;
    }, 0);
    assert(
      totalDays === MAX_TOTAL_HOLIDAY_SLOTS,
      `T4 budget-klem-tijdens-opbouw: totaal ${MAX_TOTAL_HOLIDAY_SLOTS} dagen gematerialiseerd (kreeg ${totalDays}) — het gedeelde HolidayBudget is exact opgebruikt, geen dag meer`,
    );
    // MARGE-HERZIENING (her-check-slotpuntje, geen nieuwe review nodig): 1000ms had ASYMMETRISCHE
    // marge — op een ~3× tragere CI-runner komt het CORRECTE pad (~313ms lokaal × 3 ≈ 940ms) vlak
    // tegen de grens aan, terwijl het GEMUTEERDE pad (~2400ms lokaal × 3 ≈ 7200ms) er ruim boven
    // blijft. Bij 1000ms was het risico dus VALS-ROOD op correcte code op een trage runner, niet
    // gemiste mutatiedetectie. 2000ms herstelt de marge aan de CORRECTE kant (313ms × 3 ≈ 940ms blijft
    // ruim onder 2000ms) zonder de mutatiedetectie te verzwakken (2400ms × 3 ≈ 7200ms blijft ver
    // erboven) — de her-check bevestigde de fix opnieuw op 389ms (was 5192ms zonder de klem).
    assert(
      elapsedMs < 2000,
      `T4 budget-klem-tijdens-opbouw: readMSPDI(${recordCount} WEEKLY-records) < 2000ms (kreeg ${elapsedMs}ms) — de budget-klem moet TIJDENS de opbouw ingrijpen, niet pas erna (reviewer-DoS-repro: 445 KB XML → 5192 ms zonder deze klem)`,
    );
  }

  // (g) SPEC-REVIEW-FIX (blokkerend, multiplier): bovengrens op het AANTAL `<Calendar>`-elementen
  //     (`MAX_MSPDI_CALENDARS`) — spiegelt check-mpp-calendars.ts se stijl van exacte tellingen tegen
  //     een hostile fixture. 1200 resource-kalenders (> MAX_MSPDI_CALENDARS=1024) → precies 1024
  //     gematerialiseerd, de rest genegeerd, binnen een royale tijdslimiet.
  {
    const calCount = 1200;
    const calsXml = Array.from({ length: calCount }, (_, i) =>
      `<Calendar><UID>${i + 2}</UID><Name>Res${i}</Name></Calendar>`, // UID 1 = projectkalender, dus +2
    ).join('');
    const xml = `<?xml version="1.0"?>
<Project>
  <StartDate>2026-01-01T00:00:00</StartDate>
  <FinishDate>2026-12-31T00:00:00</FinishDate>
  <Calendars>
    <Calendar><UID>1</UID><Name>Project</Name></Calendar>
    ${calsXml}
  </Calendars>
</Project>`;
    const start = Date.now();
    const result = readMSPDI(xml);
    const elapsedMs = Date.now() - start;
    assert(
      (result.resourceCalendars ?? []).length === 1024,
      `T4 kalender-aantal-klem: 1024 resourcekalenders gematerialiseerd (kreeg ${(result.resourceCalendars ?? []).length}) van ${calCount} aangeboden`,
    );
    assert(elapsedMs < 1000, `T4 kalender-aantal-klem: readMSPDI(${calCount} <Calendar>-elementen) < 1000ms (kreeg ${elapsedMs}ms)`);
  }

  // (h) T13 (§T2-afwijking, LAAG-7-afnemer): writeMSPDI schreef workingExceptions vóór deze taak
  //     STIL NIET mee (alleen `cal.holidays` ging naar `<Exceptions>`) — de "writeMSPDI schrijft dit
  //     nog niet"-opmerking in de moduleheader hierboven gold dus tot T13. Round-trip via de ECHTE
  //     schrijver+lezer (i.p.v. hand-gebouwde XML zoals (a)-(g)): workingExceptions met eigen banden
  //     én een band-loze workingException moeten allebei exact terugkomen; holidays blijven intact.
  {
    const calWithExc: WorkCalendar = {
      ...H8,
      id: 'cal-h8-exc', name: 'H8-met-uitzonderingen',
      holidays: [{ name: 'Feestdag', startDate: '2026-07-09', endDate: '2026-07-09' }],
      workingExceptions: [
        { name: 'Werkende zaterdag', startDate: '2026-07-11', endDate: '2026-07-11', bands: [{ start: 360, end: 720 }] },
        { name: 'Band-loze werkende zondag', startDate: '2026-07-12', endDate: '2026-07-12' },
      ],
    };
    const p = readMSPDI(writeMSPDI(project, calWithExc, tasks, sequences, resources, assignments, []));
    const cal = p.calendar;
    eq('T13 MSPDI-workingExceptions-roundtrip: holidays intact', cal.holidays.map((h) => h.startDate), ['2026-07-09']);
    const byDate = new Map((cal.workingExceptions ?? []).map((w) => [w.startDate, w]));
    assert(byDate.size === 2, `T13 MSPDI-workingExceptions-roundtrip: 2 workingExceptions terug (kreeg ${byDate.size})`);
    eq('T13 MSPDI-workingExceptions-roundtrip: banden van de werkende zaterdag', byDate.get('2026-07-11')?.bands, [{ start: 360, end: 720 }]);
    // Band-loze uitzondering: de schrijver laat <WorkingTimes> weg (geen banden om te schrijven); de
    // lezer se fallback-keten (types/calendar.ts's WorkingException.bands-doc) levert dan `undefined`
    // of een lege array terug — beide zijn "geen eigen banden", dus vergelijk op falsy/leeg i.p.v. op
    // een specifieke vorm (dat zou een implementatiedetail van de lezer vastpinnen, niet het contract).
    const sundayBands = byDate.get('2026-07-12')?.bands;
    assert(!sundayBands || sundayBands.length === 0, `T13 MSPDI-workingExceptions-roundtrip: band-loze uitzondering blijft band-loos (kreeg ${JSON.stringify(sundayBands)})`);

    // (i) T13 (zelfde afwijking): P6-XML kent structureel GEEN DayWorking-vlag op HolidayOrException
    //     (geverifieerd tegen p6xmlReader.ts's parseP6HolidayOrExceptions — leest elk element
    //     onvoorwaardelijk als niet-werkend) — workingExceptions kunnen daar dus niet veilig heen.
    //     writeP6XML moet dat NIET stilzwijgend laten liggen: één console.warn met het juiste aantal,
    //     en geen enkel <HolidayOrException>-element voor de werkende uitzonderingen zelf (die zouden
    //     bij re-import als HOLIDAY (niet-werkend) misgelezen worden — erger dan weglaten).
    const warns: string[] = [];
    const origWarn = console.warn;
    console.warn = (...a: unknown[]) => { warns.push(a.join(' ')); };
    let p6xml: string;
    try { p6xml = writeP6XML(project, calWithExc, tasks, sequences, resources, assignments, []); }
    finally { console.warn = origWarn; }
    assert(
      warns.some((w) => w.includes('2 werkende kalenderuitzondering')),
      `T13 P6-workingExceptions-warn: verwacht een warn met "2 werkende kalenderuitzondering", kreeg [${warns.join(' | ')}]`,
    );
    assert(!p6xml.includes('Werkende zaterdag'), 'T13 P6-workingExceptions-warn: de werkende uitzondering zelf komt niet als <HolidayOrException> in de XML (zou als holiday misgelezen worden)');
    assert(p6xml.includes('Feestdag'), 'T13 P6-workingExceptions-warn: de ECHTE holiday blijft gewoon staan');
  }
}

// ── H5 (eindreview T16c): ELAPSEDTIME-taakduur-export — round-trip-bewijs voor de weggelaten-met-
// warn-fallback op MSPDI/P6/CSV. Geen van de drie lezers begrijpt task-level "24/7"-duur (alleen
// relatie-LAG kent al een elapsed-notatie), dus native schrijven zonder dat de lezer het teruglas
// zou een `.mpp → export → herimport`-cyclus de 24/7-semantiek stil laten omklappen naar
// werktijd-duur — de conservatieve keuze is dan ook weggelaten-met-warn i.p.v. een halve
// round-trip die zich als vol voordoet. Deze case bewijst BEIDE kanten: (a) de warn vuurt met het
// juiste aantal wanneer er een ELAPSEDTIME-taak in zit, en NIET wanneer alle taken WORKTIME zijn;
// (b) de herimport laat zien dat de taak inderdaad als WORKTIME terugkomt (de eerlijke, gemeten
// realiteit die de warn-tekst beschrijft — "geëxporteerd als gewone werktijd-duur").
{
  const projE: Project = {
    id: 'p-elapsed', name: 'Elapsed', description: '', startDate: '2026-07-06', endDate: '2026-07-31',
    calendarId: 'cal-h8', createdAt: '2026-07-06T00:00', modifiedAt: '2026-07-06T00:00', author: 'T', company: 'C',
  };
  const worktimeTask: Task = {
    id: 'e-work', name: 'Gewone taak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [],
    time: {
      durationType: 'WORKTIME', scheduleDuration: 2, durationMinutes: 960,
      scheduleStart: '2026-07-06T08:00', scheduleFinish: '2026-07-07T16:00',
      earlyStart: '2026-07-06T08:00', earlyFinish: '2026-07-07T16:00',
      lateStart: '2026-07-06T08:00', lateFinish: '2026-07-07T16:00',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    resourceIds: [],
  };
  const elapsedTask: Task = {
    id: 'e-elapsed', name: 'Storttijd beton (24/7)', description: '', wbsCode: '2', taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [],
    time: {
      // 3 elapsed dagen = 3×1440 klok-minuten (T8-conventie, mppReader.ts's isElapsedDuration-tak).
      durationType: 'ELAPSEDTIME', scheduleDuration: 3, durationMinutes: 4320,
      scheduleStart: '2026-07-08T08:00', scheduleFinish: '2026-07-11T08:00',
      earlyStart: '2026-07-08T08:00', earlyFinish: '2026-07-11T08:00',
      lateStart: '2026-07-08T08:00', lateFinish: '2026-07-11T08:00',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    resourceIds: [],
  };

  function withWarnings<T>(fn: () => T): { out: T; warns: string[] } {
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (...a: unknown[]) => { warns.push(a.join(' ')); };
    try { return { out: fn(), warns }; } finally { console.warn = orig; }
  }

  // (a) Contrast: alleen WORKTIME-taken ⇒ geen enkele ELAPSEDTIME-warn op de drie exporters.
  {
    const { warns: wM } = withWarnings(() => writeMSPDI(projE, H8, [worktimeTask], [], [], []));
    const { warns: wP } = withWarnings(() => writeP6XML(projE, H8, [worktimeTask], [], [], [], []));
    const { warns: wC } = withWarnings(() => writeCSV(projE, H8, [worktimeTask], [], [], []));
    assert(!wM.some(w => w.includes('ELAPSEDTIME')), `H5-contrast MSPDI: geen ELAPSEDTIME-warn zonder elapsed-taak, kreeg [${wM.join(' | ')}]`);
    assert(!wP.some(w => w.includes('ELAPSEDTIME')), `H5-contrast P6: geen ELAPSEDTIME-warn zonder elapsed-taak, kreeg [${wP.join(' | ')}]`);
    assert(!wC.some(w => w.includes('ELAPSEDTIME')), `H5-contrast CSV: geen ELAPSEDTIME-warn zonder elapsed-taak, kreeg [${wC.join(' | ')}]`);
  }

  // (b) Eén ELAPSEDTIME-taak naast één WORKTIME-taak ⇒ precies 1 taak geteld in de warn, op alle
  //     drie de exporters, en de herimport bewijst de daadwerkelijke (lossy) omklap naar WORKTIME.
  const mixedTasks = [worktimeTask, elapsedTask];
  {
    const { out: mspdiXml, warns: wM } = withWarnings(() => writeMSPDI(projE, H8, mixedTasks, [], [], []));
    assert(
      wM.some(w => w.includes('MSPDI-export: 1 taak/taken met ELAPSEDTIME-duur')),
      `H5 MSPDI-warn: verwacht "1 taak/taken met ELAPSEDTIME-duur", kreeg [${wM.join(' | ')}]`,
    );
    const backM = readMSPDI(mspdiXml);
    const elapsedBackM = backM.tasks.find(t => t.name === 'Storttijd beton (24/7)');
    assert(!!elapsedBackM, 'H5 MSPDI-round-trip: elapsed-taak komt terug (op naam)');
    eq('H5 MSPDI-round-trip: durationType valt terug op WORKTIME (eerlijk, geen valse native-claim)', elapsedBackM?.time.durationType, 'WORKTIME');

    const { out: p6Xml, warns: wP } = withWarnings(() => writeP6XML(projE, H8, mixedTasks, [], [], [], []));
    assert(
      wP.some(w => w.includes('P6-export: 1 taak/taken met ELAPSEDTIME-duur')),
      `H5 P6-warn: verwacht "1 taak/taken met ELAPSEDTIME-duur", kreeg [${wP.join(' | ')}]`,
    );
    const backP = readP6XML(p6Xml);
    const elapsedBackP = backP.tasks.find(t => t.name === 'Storttijd beton (24/7)');
    assert(!!elapsedBackP, 'H5 P6-round-trip: elapsed-taak komt terug (op naam)');
    eq('H5 P6-round-trip: durationType valt terug op WORKTIME', elapsedBackP?.time.durationType, 'WORKTIME');

    const { out: csvText, warns: wC } = withWarnings(() => writeCSV(projE, H8, mixedTasks, [], [], []));
    assert(
      wC.some(w => w.includes('CSV-export: 1 taak/taken met ELAPSEDTIME-duur')),
      `H5 CSV-warn: verwacht "1 taak/taken met ELAPSEDTIME-duur", kreeg [${wC.join(' | ')}]`,
    );
    const backC = readCSV(csvText);
    const elapsedBackC = backC.tasks.find(t => t.name === 'Storttijd beton (24/7)');
    assert(!!elapsedBackC, 'H5 CSV-round-trip: elapsed-taak komt terug (op naam)');
    eq('H5 CSV-round-trip: durationType valt terug op WORKTIME', elapsedBackC?.time.durationType, 'WORKTIME');
  }
}

// ── Z14 (etappe "nul afwijkingen") — de vier nieuwe exportrand-warns (manuallyScheduled,
// levelingDelayMinutes, splits+timephased-venster, resume/stop) op MSPDI/P6, exact het H5-
// ELAPSEDTIME-patroon hierboven: (a) contrast — geen enkele van de vier warns zonder de
// bijbehorende data; (b) precies het juiste aantal wanneer de data er wél is. CSV kent geen warn
// (vaste 14-koloms `headers`, zie csvWriter.ts) — hier bewezen: de header blijft ONGEWIJZIGD, ook
// met een taak die alle nieuwe velden draagt (geen 15e kolom, geen warn-concept van toepassing).
{
  // Lokale herhaling van de `withWarnings`-helper hierboven (blok-scoped `function`-declaratie in
  // het H5-blok, hier niet zichtbaar) — zelfde vorm, geen gedeelde toestand nodig.
  function withWarnings<T>(fn: () => T): { out: T; warns: string[] } {
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (...a: unknown[]) => { warns.push(a.join(' ')); };
    try { return { out: fn(), warns }; } finally { console.warn = orig; }
  }

  const projZ: Project = {
    id: 'p-z14', name: 'Z14-export', description: '', startDate: '2026-07-06', endDate: '2026-07-31',
    calendarId: 'cal-h8', createdAt: '2026-07-06T00:00', modifiedAt: '2026-07-06T00:00', author: 'T', company: 'C',
  };
  const plainTask: Task = {
    id: 'z-plain', name: 'Gewone taak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [],
    time: {
      durationType: 'WORKTIME', scheduleDuration: 2,
      scheduleStart: '2026-07-06', scheduleFinish: '2026-07-07',
      earlyStart: '2026-07-06', earlyFinish: '2026-07-07',
      lateStart: '2026-07-06', lateFinish: '2026-07-07',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
    },
    resourceIds: [],
  };
  const richTask: Task = {
    id: 'z-rich', name: 'Rijke taak', description: '', wbsCode: '2', taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [],
    manuallyScheduled: true,
    levelingDelayMinutes: 30,
    splitGaps: [{ afterMinutes: 60, gapMinutes: 30 }],
    time: {
      durationType: 'WORKTIME', scheduleDuration: 2,
      scheduleStart: '2026-07-08', scheduleFinish: '2026-07-09',
      earlyStart: '2026-07-08', earlyFinish: '2026-07-09',
      lateStart: '2026-07-08', lateFinish: '2026-07-09',
      freeFloat: 0, totalFloat: 0, isCritical: false, completion: 0,
      resume: '2026-07-08', stop: '2026-07-08',
    },
    resourceIds: [],
  };
  const zAssignments: ResourceAssignment[] = [
    { id: 'z-a1', taskId: 'z-rich', resourceId: 'r-none', unitsPerDay: 1, workWindowStart: '2026-07-08', workWindowFinish: '2026-07-08' },
  ];

  // (a) Contrast: alleen de gewone taak, geen assignments ⇒ geen van de vier nieuwe warns.
  {
    const { warns: wM } = withWarnings(() => writeMSPDI(projZ, H8, [plainTask], [], [], []));
    const { warns: wP } = withWarnings(() => writeP6XML(projZ, H8, [plainTask], [], [], [], []));
    for (const [label, warns] of [['MSPDI', wM], ['P6', wP]] as const) {
      assert(!warns.some(w => w.includes('handmatig gepland')), `Z14-contrast ${label}: geen manuallyScheduled-warn zonder data, kreeg [${warns.join(' | ')}]`);
      assert(!warns.some(w => w.includes('sub-dag-nivelleervertraging')), `Z14-contrast ${label}: geen levelingDelayMinutes-warn zonder data, kreeg [${warns.join(' | ')}]`);
      assert(!warns.some(w => w.includes('TimephasedData') || w.includes('gesplitste taak')), `Z14-contrast ${label}: geen splits/timephased-warn zonder data, kreeg [${warns.join(' | ')}]`);
      assert(!warns.some(w => w.includes('resume/stop')), `Z14-contrast ${label}: geen resume/stop-warn zonder data, kreeg [${warns.join(' | ')}]`);
    }
  }

  // (b) De rijke taak + gecontoureerde toewijzing ⇒ alle vier warns vuren met het juiste aantal.
  {
    const zTasks = [plainTask, richTask];
    const { warns: wM } = withWarnings(() => writeMSPDI(projZ, H8, zTasks, [], [], zAssignments));
    assert(wM.some(w => w.includes('MSPDI-export: 1 handmatig geplande taak/taken')), `Z14 MSPDI manuallyScheduled-warn: kreeg [${wM.join(' | ')}]`);
    assert(wM.some(w => w.includes('MSPDI-export: 1 taak/taken met sub-dag-nivelleervertraging')), `Z14 MSPDI levelingDelayMinutes-warn: kreeg [${wM.join(' | ')}]`);
    assert(wM.some(w => w.includes('MSPDI-export: 1 gesplitste taak/taken en 1 gecontoureerde toewijzing')), `Z14 MSPDI splits/timephased-warn: kreeg [${wM.join(' | ')}]`);
    assert(wM.some(w => w.includes('MSPDI-export: 1 taak/taken met resume/stop')), `Z14 MSPDI resume/stop-warn: kreeg [${wM.join(' | ')}]`);

    const { warns: wP } = withWarnings(() => writeP6XML(projZ, H8, zTasks, [], [], zAssignments, []));
    assert(wP.some(w => w.includes('P6-export: 1 handmatig geplande taak/taken')), `Z14 P6 manuallyScheduled-warn: kreeg [${wP.join(' | ')}]`);
    assert(wP.some(w => w.includes('P6-export: 1 taak/taken met sub-dag-nivelleervertraging')), `Z14 P6 levelingDelayMinutes-warn: kreeg [${wP.join(' | ')}]`);
    assert(wP.some(w => w.includes('P6-export: 1 gesplitste taak/taken en 1 gecontoureerde toewijzing')), `Z14 P6 splits/timephased-warn: kreeg [${wP.join(' | ')}]`);
    assert(wP.some(w => w.includes('P6-export: 1 taak/taken met resume/stop')), `Z14 P6 resume/stop-warn: kreeg [${wP.join(' | ')}]`);

    // CSV: vaste 14 kolommen, geen warn — de rijke taak mag de kolomstructuur niet veranderen.
    const { out: csvText, warns: wC } = withWarnings(() => writeCSV(projZ, H8, zTasks, [], [], zAssignments));
    assert(wC.length === 0, `Z14 CSV: geen enkele warn voor de nieuwe velden, kreeg [${wC.join(' | ')}]`);
    const header = csvText.replace(/^﻿/, '').split('\r\n')[0];
    assert(header.split(';').length === 14, `Z14 CSV: header blijft 14 kolommen, kreeg ${header.split(';').length} (${header})`);
  }
}

if (fails === 0) {
  console.log(`OK  adapters-hours: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  adapters-hours: ${fails}/${checks} checks GEFAALD`);
  process.exit(1);
}
