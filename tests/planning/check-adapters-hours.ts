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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Task, ConstraintType } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import type { Project } from '@/types/project';
import type { Resource, ResourceAssignment } from '@/types/resource';
import { installDOMParser } from './xmldom-shim';

installDOMParser();

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
}

{
  const p = readIFC(writeIFC(project, H8, tasks, sequences, resources, assignments, [], [], lib));
  roundTrip('IFC', p.tasks, p.sequences, p.calendar, p.resourceCalendars, true);
}
{
  const p = readP6XML(writeP6XML(project, H8, tasks, sequences, resources, assignments, lib));
  roundTrip('P6', p.tasks, p.sequences, p.calendar, p.resourceCalendars, false);
}
{
  const p = readMSPDI(writeMSPDI(project, H8, tasks, sequences, resources, assignments, lib));
  roundTrip('MSPDI', p.tasks, p.sequences, p.calendar, p.resourceCalendars, false);
}

// ── Dag-bestand-discriminator (geen uur-lek + identieke leaf-schedule) ──────
{
  const src = readFileSync(join(process.cwd(), 'examples', '03-kantoorgebouw-zuidas.ifc'), 'utf8');
  const M = readIFC(src);
  const startOf = (t: Task) => (t.time.earlyStart || t.time.scheduleStart).substring(0, 10);
  const digest = (ts: Task[]) => ts.filter(t => t.childIds.length === 0)
    .map(t => `${t.name}|${t.time.scheduleDuration}|${startOf(t)}`).sort().join('\n');
  const base = digest(M.tasks);
  const p6 = readP6XML(writeP6XML(M.project, M.calendar, M.tasks, M.sequences, M.resources, M.assignments, M.resourceCalendars));
  const msp = readMSPDI(writeMSPDI(M.project, M.calendar, M.tasks, M.sequences, M.resources, M.assignments, M.resourceCalendars));
  eq('P6-example leaf-schedule', digest(p6.tasks), base);
  eq('MSPDI-example leaf-schedule', digest(msp.tasks), base);
  assert([p6.calendar, ...p6.resourceCalendars].every(c => !c.workTime), 'P6-example: geen workTime-lek');
  assert(p6.tasks.every(t => t.time.durationMinutes == null), 'P6-example: geen durationMinutes-lek');
  assert([msp.calendar, ...msp.resourceCalendars].every(c => !c.workTime), 'MSPDI-example: geen workTime-lek');
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
    if (fmt === 'IFC') return readIFC(writeIFC(dayProj, dayCal, tk, [], [], [], [], [], [])).tasks.find(t => t.name === 'X')!;
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
    // P6: soft MSO/MFO behoudt semantiek (geen degradatie).
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
    const ifcBack = readIFC(writeIFC(proj2, dayCal, tk, [], [], [], [], [], [])).project.schedulingOptions;
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

if (fails === 0) {
  console.log(`OK  adapters-hours: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  adapters-hours: ${fails}/${checks} checks GEFAALD`);
  process.exit(1);
}
