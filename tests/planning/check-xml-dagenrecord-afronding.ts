// Aanval a06 na #600: een eigen dagenrecord in MSPDI en P6 XML blijft geldig na de afronding op zes decimalen,
// en de standaardvelden houden de minuten uit de bron.
//
// Kalender ma–do 07:00–14:45 (465 min), vr 07:00–12:00 (300 min). Lopende taak C: dagenmaat, duur 3 d, rest
// 5/6 d, begonnen ma 1 juni 2026 07:00, completion 13/18, statusdatum vr 5 juni. Taak D: 5/6 d. Relaties
// A→B FS +5/6 d en B→D FS −1/6 d.
// Fout 1 (aanval): de writer schreef het record [0.833333, 388] (388 = round(5/6 × 465)). De lezer rekent
// 0,833333 × 465 = 387,4998 → 387, wees het eigen record af en maakte van C een urenmaat-taak; de lag kwam
// terug als lagMinutes 388.
// Fout 2 (review r1): de eerste fix rekende de minuten uit 0,833333 en schreef 387 in het standaardveld; een
// taak of lag van 5/6 d werd een minuut korter. Nu draagt het record dagen die precies de bronminuten
// verklaren (`recordDayValue`).
//
// Wat deze check vastlegt, voor beide formaten:
//  (1) de standaardvelden (MSPDI `Duration`/`RemainingDuration`/`LinkLag`, P6 `PlannedDuration`/
//      `RemainingDuration`/`Lag`) dragen de minuten uit de bron, voor alle taken en lags; elk dagenrecord
//      verklaart zijn eigen minuten (record[1] = round(record[0] × 465));
//  (2) na één en na twee rondgangen: C en D houden de dagenmaat, de lags blijven dagenmaat; de export is
//      stabiel na één rondgang;
//  (3) na inlezen en doorrekenen eindigt elke taak op hetzelfde moment als vóór de rondgang;
//  (4) een echt gewijzigde kalender (14:45 → 15:45 in het bestand) wijst de records nog steeds af.
// En voor IFC: een tweede export schrijft dezelfde duren, restduren en lags als de eerste, ook voor C.
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
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
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
const NEG_LAG = -1 / 6;
/** De minuten uit de bron: dagen × 465, op de hele minuut. */
const src = (days: number) => Math.round(days * 465);

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
  }, mk('D', REST)];
  p.sequences = [
    { id: 'AB', predecessorId: 'A', successorId: 'B', type: 'FINISH_START', lagDays: REST },
    { id: 'BD', predecessorId: 'B', successorId: 'D', type: 'FINISH_START', lagDays: NEG_LAG },
  ];
  return p;
}

interface Format {
  name: string;
  write: (q: DocumentPayload) => string;
  read: (xml: string) => ImportResult;
  /** De kalender in het bestand één uur langer per lange dag. */
  changeCalendar: (xml: string) => string;
  /** De standaardvelden in minuten: duur en rest per taaknaam, en de lags (op volgorde van grootte). */
  standard: (xml: string) => { duration: Record<string, number>; remaining: Record<string, number>; lags: number[] };
}
const isoMinutes = (iso: string | undefined) => {
  const m = iso?.match(/^PT(\d+)H(\d+)M(\d+(?:\.\d+)?)S$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60 : NaN;
};
const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1];
function standardFields(xml: string, blockTag: string, toMinutes: (raw: string | undefined) => number, lagTag: string, lagToMinutes: (raw: string) => number) {
  const duration: Record<string, number> = {};
  const remaining: Record<string, number> = {};
  for (const block of xml.split(`<${blockTag}>`).slice(1)) {
    const name = tag(block, 'Name');
    if (!name || !['A', 'B', 'C', 'D'].includes(name)) continue;
    duration[name] = toMinutes(tag(block, blockTag === 'Task' ? 'Duration' : 'PlannedDuration'));
    remaining[name] = toMinutes(tag(block, 'RemainingDuration'));
  }
  const lags = [...xml.matchAll(new RegExp(`<${lagTag}>(-?[\\d.]+)</${lagTag}>`, 'g'))].map(m => lagToMinutes(m[1])).sort((a, b) => a - b);
  return { duration, remaining, lags };
}
const FORMATS: Format[] = [
  {
    name: 'MSPDI',
    write: q => writeMSPDI(q.project, q.calendar, q.tasks, q.sequences, q.resources, q.assignments, q.calendars, q.baselines, q.activeBaselineId, q.customTaskTypes),
    read: readMSPDI,
    changeCalendar: xml => xml.split('<ToTime>14:45:00</ToTime>').join('<ToTime>15:45:00</ToTime>'),
    standard: xml => standardFields(xml, 'Task', isoMinutes, 'LinkLag', raw => Number(raw) / 10),
  },
  {
    name: 'P6 XML',
    write: q => writeP6XML(q.project, q.calendar, q.tasks, q.sequences, q.resources, q.assignments, q.calendars, q.customTaskTypes),
    read: readP6XML,
    changeCalendar: xml => xml.split('<Finish>14:44:00</Finish>').join('<Finish>15:44:00</Finish>'),
    standard: xml => standardFields(xml, 'Activity', raw => Number(raw) * 60, 'Lag', raw => Number(raw) * 60),
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

  // (1) De standaardvelden dragen de bronminuten; elk dagenrecord verklaart zijn eigen minuten.
  const std = fmt.standard(xml1);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  eq(`${L} standaardduur A B C D (min)`, ['A', 'B', 'C', 'D'].map(n => round(std.duration[n])), [src(3), src(1), src(3), src(REST)]);
  eq(`${L} standaardrest C (min)`, round(std.remaining.C), src(REST));
  eq(`${L} standaardlags (min)`, std.lags.map(round), [src(NEG_LAG), src(REST)]);
  const recordPairs = [...xml1.matchAll(/\[(-?[\d.]+),(-?\d+)\]/g)].map(m => [Number(m[1]), Number(m[2])]);
  ok(`${L} dagenrecords gevonden voor duur, rest en lags`, recordPairs.length >= 4);
  for (const [days, minutes] of recordPairs) eq(`${L} record [${days}, ${minutes}] verklaart zijn minuten`, Math.round(days * 465), minutes);

  // (2) Eén en twee rondgangen: dagenmaat blijft dagenmaat, ook voor de lag.
  const first = quiet(() => fmt.read(xml1));
  const loaded = payloadFromImport(first, null);
  const xml2 = quiet(() => fmt.write(loaded));
  const second = quiet(() => fmt.read(xml2));
  for (const [label, result] of [['ronde 1', first], ['ronde 2', second]] as const) {
    const c = taskC(result.tasks);
    eq(`${L} ${label}: C durationUnit`, c?.time.durationUnit, 'days');
    eq(`${L} ${label}: C scheduleDuration`, c?.time.scheduleDuration, 3);
    eq(`${L} ${label}: C durationMinutes`, c?.time.durationMinutes, undefined);
    ok(`${L} ${label}: C remainingTime ≈ 5/6, kreeg ${c?.time.remainingTime}`, near(c?.time.remainingTime, REST));
    eq(`${L} ${label}: C remainingMinutes`, c?.time.remainingMinutes, undefined);
    const d = result.tasks.find(t => t.name === 'D');
    eq(`${L} ${label}: D durationUnit`, d?.time.durationUnit, 'days');
    ok(`${L} ${label}: D scheduleDuration ≈ 5/6, kreeg ${d?.time.scheduleDuration}`, near(d?.time.scheduleDuration, REST));
    const lags = result.sequences.map(seq => seq.lagDays).sort((a, b) => a - b);
    ok(`${L} ${label}: lagDays ≈ [−1/6, 5/6], kreeg ${JSON.stringify(lags)}`, lags.length === 2 && near(lags[0], NEG_LAG) && near(lags[1], REST));
    eq(`${L} ${label}: lagMinutes`, result.sequences.map(seq => seq.lagMinutes), [undefined, undefined]);
  }
  const xml3 = quiet(() => fmt.write(payloadFromImport(second, null)));
  // De project-id van P6 XML is per import nieuw; die telt niet mee.
  const sameId = (xml: string) => xml.replace(/<Id>OPS:proj-[^<]*<\/Id>/g, '<Id>OPS:proj</Id>');
  eq(`${L} derde export gelijk aan de tweede (stabiel na één rondgang)`, sameId(xml3) === sameId(xml2), true);

  // (3) Het einde van elke taak na doorrekenen blijft gelijk.
  loaded.project = { ...loaded.project, schedulingProfile: source.project.schedulingProfile };
  const solved = quiet(() => prepareLoadedPayload(loaded, { recompute: true }));
  ok(`${L} oorspronkelijk einde van C is vr 5 juni 11:10, kreeg ${originalFinish}`, originalFinish === '2026-06-05T11:10');
  const finishes = (tasks: Task[]) => Object.fromEntries(tasks.map(t => [t.name, t.time.earlyFinish]));
  eq(`${L} einde van A B C D na inlezen en doorrekenen`, finishes(solved.tasks), finishes(original.tasks));

  // (4) Een echt gewijzigde kalender: de afwijzing blijft werken.
  const changedXml = fmt.changeCalendar(xml1);
  ok(`${L} kalender in het bestand gewijzigd`, changedXml !== xml1);
  const changed = quiet(() => fmt.read(changedXml));
  const c = taskC(changed.tasks);
  eq(`${L} gewijzigde kalender: C durationUnit`, c?.time.durationUnit, 'hours');
  eq(`${L} gewijzigde kalender: C durationMinutes (uit het bestand)`, c?.time.durationMinutes, 3 * 465);
  for (const lag of changed.sequences) ok(`${L} gewijzigde kalender: lag in urenmaat, kreeg ${JSON.stringify(lag)}`, typeof lag.lagMinutes === 'number');
}

// IFC (review r1): de eerste export schreef PT6H28M0S met [0.833333,388]; de lezer nam 0.833333 over en een
// tweede export schreef PT6H27M0S. Nu blijven duren en lags gelijk, ook de rest van de lopende taak C: de
// IFC-lezer houdt de rest uit het record (knownbug 357 is gesloten in #663).
{
  const original = quiet(() => prepareLoadedPayload(payload(), { recompute: true }));
  const ifc1 = quiet(() => writeIFC(buildWriteIFCInput(original)));
  const ifc2 = quiet(() => writeIFC(buildWriteIFCInput(payloadFromImport(quiet(() => readIFC(ifc1)), null))));
  const times = (ifc: string) => [...ifc.matchAll(/IFC(?:TASKTIME|LAGTIME)\(('[^']*'|\$)[^\n]*/g)]
    .map(m => m[0].replace(/#\d+/g, '#')).sort();
  const first = times(ifc1);
  ok('[IFC] taaktijden en lags gevonden', first.length >= 5);
  ok('[IFC] de taaktijd van C doet mee', first.some(line => line.startsWith("IFCTASKTIME('C Time'")));
  ok('[IFC] eerste export draagt PT6H28M0S voor 5/6 d', ifc1.includes("PT6H28M0S"));
  eq('[IFC] tweede export: dezelfde duren en lags', times(ifc2), first);
}

if (errors.length > 0) {
  for (const e of errors) console.log(`XX xml-dagenrecord-afronding: ${e}`);
  process.exitCode = 1;
} else {
  console.log(`OK xml-dagenrecord-afronding: ${checks} controles groen`);
}
