// Aanval a06 na #600: een eigen dagenrecord in MSPDI en P6 XML blijft geldig na de afronding op zes decimalen.
//
// Kalender ma–do 07:00–14:45 (465 min), vr 07:00–12:00 (300 min). Lopende taak C: dagenmaat, duur 3 d, rest
// 5/6 d, begonnen ma 1 juni 2026 07:00, completion 13/18, statusdatum vr 5 juni. Relatie A→B: FS 5/6 d.
// De fout: de writer rekende de minuten uit de ongeronde dagen (5/6 × 465 = 387,5 → 388) en schreef het record
// [0.833333, 388]. De lezer rekent 0,833333 × 465 = 387,4998 → 387, wees het eigen record af en maakte van C
// een urenmaat-taak (durationMinutes 1395); de lag kwam terug als lagMinutes 388.
//
// Wat deze check vastlegt, voor beide formaten:
//  (1) record en standaardveld kloppen bij elkaar (record[1] = round(record[0] × 465));
//  (2) na één en na twee rondgangen: C houdt de dagenmaat (duur 3 d, rest 0,833333 d), de lag blijft
//      dagenmaat (lagDays 0,833333, geen lagMinutes), en de export is stabiel na één rondgang;
//  (3) na doorrekenen eindigt C op hetzelfde moment als vóór de rondgang;
//  (4) een echt gewijzigde kalender (14:45 → 15:45 in het bestand) wijst het record nog steeds af: C wordt
//      urenmaat met de minuten uit het bestand, de lag wordt urenmaat.
//
// Draait via run.sh (esbuild-bundel). Alleen de exitcode telt.
import './domStub';
import { installDOMParser } from './xmldom-shim';
import { freshPayload, payloadFromImport, type DocumentPayload } from '@/state/documentContract';
import { prepareLoadedPayload } from '@/state/documentActivation';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { ImportResult } from '@/services/importTypes';
import type { Task } from '@/types/task';

installDOMParser();
let checks = 0;
const errors: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) errors.push(label);
}
/** De writers melden verliezen via console.warn; die horen niet bij deze check. */
function quiet<T>(fn: () => T): T {
  const warn = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = warn; }
}

const LONG = [{ start: 420, end: 885 }];
const SHORT = [{ start: 420, end: 720 }];
const REST = 5 / 6;
const STORED_REST = 0.833333;

function payload(): DocumentPayload {
  const p = freshPayload();
  p.calendar = {
    ...p.calendar, workStartHour: 7, workEndHour: 14.75, hoursPerDay: 7.75, holidays: [],
    workTime: { byWeekday: { 1: LONG, 2: LONG, 3: LONG, 4: LONG, 5: SHORT, 6: [], 7: [] } },
  };
  p.calendars = [p.calendar];
  p.project = { ...p.project, startDate: '2026-06-01', statusDate: '2026-06-05' };
  const mk = (id: string, days: number): Task => ({
    id, name: id, description: '', wbsCode: id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED', isMilestone: false,
    priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      ...createDefaultTaskTime('2026-06-01', days), scheduleStart: '2026-06-01T07:00', scheduleFinish: '2026-06-04T14:45',
      earlyStart: '2026-06-01T07:00', earlyFinish: '2026-06-04T14:45',
    },
  });
  const c = mk('C', 3);
  p.tasks = [mk('A', 3), mk('B', 1), {
    ...c, status: 'STARTED',
    time: { ...c.time, actualStart: '2026-06-01T07:00', completion: 13 / 18, remainingTime: REST },
  }];
  p.sequences = [{ id: 'AB', predecessorId: 'A', successorId: 'B', type: 'FINISH_START', lagDays: REST }];
  return p;
}

interface Format {
  name: string;
  write: (q: DocumentPayload) => string;
  read: (xml: string) => ImportResult;
  /** De kalender in het bestand één uur langer per lange dag. */
  changeCalendar: (xml: string) => string;
}
const FORMATS: Format[] = [
  {
    name: 'MSPDI',
    write: q => writeMSPDI(q.project, q.calendar, q.tasks, q.sequences, q.resources, q.assignments, q.calendars, q.baselines, q.activeBaselineId, q.customTaskTypes),
    read: readMSPDI,
    changeCalendar: xml => xml.split('<ToTime>14:45:00</ToTime>').join('<ToTime>15:45:00</ToTime>'),
  },
  {
    name: 'P6 XML',
    write: q => writeP6XML(q.project, q.calendar, q.tasks, q.sequences, q.resources, q.assignments, q.calendars, q.customTaskTypes),
    read: readP6XML,
    changeCalendar: xml => xml.split('<Finish>14:44:00</Finish>').join('<Finish>15:44:00</Finish>'),
  },
];

const near = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 1e-9;
const taskC = (tasks: Task[]) => tasks.find(t => t.name === 'C');

for (const fmt of FORMATS) {
  const L = `[${fmt.name}]`;
  const source = payload();
  const original = quiet(() => prepareLoadedPayload(source, { recompute: true }));
  const originalFinish = taskC(original.tasks)?.time.earlyFinish;
  const xml1 = quiet(() => fmt.write(original));

  // (1) Elk geschreven dagenrecord past bij het eigen standaardveld: record[1] = round(record[0] × 465).
  const recordPairs = [...xml1.matchAll(/\[(0\.833333),(\d+)\]/g)].map(m => [Number(m[1]), Number(m[2])]);
  ok(`${L} records [0.833333, …] gevonden voor rest en lag`, recordPairs.length >= 2);
  for (const [days, minutes] of recordPairs) eq(`${L} record [${days}, ${minutes}] past bij 465 min/dag`, minutes, Math.round(days * 465));

  // (2) Eén en twee rondgangen: dagenmaat blijft dagenmaat, ook voor de lag.
  const first = quiet(() => fmt.read(xml1));
  const loaded = payloadFromImport(first, null);
  const xml2 = quiet(() => fmt.write(loaded));
  const second = quiet(() => fmt.read(xml2));
  for (const [round, result] of [['ronde 1', first], ['ronde 2', second]] as const) {
    const c = taskC(result.tasks);
    eq(`${L} ${round}: C durationUnit`, c?.time.durationUnit, 'days');
    eq(`${L} ${round}: C scheduleDuration`, c?.time.scheduleDuration, 3);
    eq(`${L} ${round}: C durationMinutes`, c?.time.durationMinutes, undefined);
    ok(`${L} ${round}: C remainingTime ≈ ${STORED_REST}, kreeg ${c?.time.remainingTime}`, near(c?.time.remainingTime, STORED_REST));
    eq(`${L} ${round}: C remainingMinutes`, c?.time.remainingMinutes, undefined);
    const lag = result.sequences[0];
    ok(`${L} ${round}: lagDays ≈ ${STORED_REST}, kreeg ${lag?.lagDays}`, near(lag?.lagDays, STORED_REST));
    eq(`${L} ${round}: lagMinutes`, lag?.lagMinutes, undefined);
  }
  const xml3 = quiet(() => fmt.write(payloadFromImport(second, null)));
  // De project-id van P6 XML is per import nieuw; die telt niet mee.
  const sameId = (xml: string) => xml.replace(/<Id>OPS:proj-[^<]*<\/Id>/g, '<Id>OPS:proj</Id>');
  eq(`${L} derde export gelijk aan de tweede (stabiel na één rondgang)`, sameId(xml3) === sameId(xml2), true);
  for (const record of ['[0.833333,387]']) ok(`${L} tweede export draagt ${record}`, xml2.includes(record));

  // (3) Het einde van C na doorrekenen blijft gelijk.
  loaded.project = { ...loaded.project, schedulingProfile: source.project.schedulingProfile };
  const solved = quiet(() => prepareLoadedPayload(loaded, { recompute: true }));
  ok(`${L} oorspronkelijk einde van C bekend`, typeof originalFinish === 'string');
  eq(`${L} einde van C na inlezen en doorrekenen`, taskC(solved.tasks)?.time.earlyFinish, originalFinish);

  // (4) Een echt gewijzigde kalender: de afwijzing blijft werken.
  const changedXml = fmt.changeCalendar(xml1);
  ok(`${L} kalender in het bestand gewijzigd`, changedXml !== xml1);
  const changed = quiet(() => fmt.read(changedXml));
  const c = taskC(changed.tasks);
  eq(`${L} gewijzigde kalender: C durationUnit`, c?.time.durationUnit, 'hours');
  eq(`${L} gewijzigde kalender: C durationMinutes (uit het bestand)`, c?.time.durationMinutes, 3 * 465);
  const lag = changed.sequences[0];
  ok(`${L} gewijzigde kalender: lag in urenmaat, kreeg ${JSON.stringify(lag)}`, typeof lag?.lagMinutes === 'number');
}

if (errors.length > 0) {
  for (const e of errors) console.log(`XX xml-dagenrecord-afronding: ${e}`);
  process.exitCode = 1;
} else {
  console.log(`OK xml-dagenrecord-afronding: ${checks} controles groen`);
}
