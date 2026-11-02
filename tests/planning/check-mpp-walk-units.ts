// MPP-wandeling per toewijzing (laag 4, >1 toewijzing) met de inzet erbij — knownbug 187, corpusvrij.
//
// De regel (`mppReader.ts`'s `deriveTimephasedWindowsForTasks`, `workTriangle.ts`'s
// `assignmentRemainingMinutes`): elke toewijzing die de duur STUURT wandelt haar werktijd, werk ÷ inzet
// (regel 2 van de werkdriehoek; MS Project "Duration = Work / Units"), afgerond op 0,1 min; materiaal
// en MS Project-kostenresources sturen de duur niet en wandelen niet mee. De vier fixtures spiegelen de
// corpusgevallen uit het onderzoek naar 187 (publiek MPXJ-/OzBuild-materiaal, crawlmap):
//   A. `timephased-cost-rollup.mpp` "Task 8": twee werkresources op 12,5% met elk 300 min werk, met de
//      drijvendekommafout uit het bestand (inzet 1249,9998779296875, werk 299999,96875). MSP: einde na
//      2400 werkminuten (vr 17:00). Zonder inzet: ma 14:00; zonder afronding: vr 16:59.
//   B. OzBuild Workshop 17/18 "Create Technical Specification": een werkresource (inzet 1, 2400 min) en
//      een KOSTENresource (inzet 0,0006, werk 30 min). MSP rekt niet op: einde vr 17:00. Werk ÷ inzet
//      voor de kostenresource zou 50 000 min geven.
//   C. Materiaal (knownbug 426): een materiaaltoewijzing waarvan werk ÷ inzet langer is dan de
//      werkresource mag het einde niet bepalen.
//   D. Een werkresource zonder bruikbare inzet (0): de hele taak valt terug op laag 5, geen gok.
// Daarna rekent `solveProject` de walks door (zelfde invoervorm als `readMPP` ze op de taak zet).
import { CfbFile } from '@/services/mpp/cfb';
import { Props } from '@/services/mpp/mppContainer';
import { AssignmentFieldId, createAssignmentFieldMap } from '@/services/mpp/fieldMap14';
import { deriveTimephasedWindowsForTasks } from '@/services/mpp/mppReader';
import type { CalendarReadResult } from '@/services/mpp/mppCalendars';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { assignmentRemainingMinutes } from '@/engine/work/workTriangle';
import { formatInstant } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import type { Resource } from '@/types/resource';
import type { WorkCalendar } from '@/types/calendar';
import { buildNestedCfb, buildVarMetaBytes, concatBytes, encodePropsEntries } from './mppFixtures';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

// ── Bytefixtures (zelfde vorm als de Z8-sectie in check-mpp-import.ts) ───────────────────────────
const PROPSKEY_ASSIGNMENT_FIELD_MAP = 131095; // PropsKey.java, zie fieldMap14.ts
const UNITS_OFFSET = 46; // FieldMap14.java getDefaultAssignmentData: ASSIGNMENT_UNITS blok 0 offset 46

function fieldMapEntryBytes(entries: { typeValue: number; dataBlockOffset: number; category: number }[]): Uint8Array {
  const out = new Uint8Array(entries.length * 28);
  const view = new DataView(out.buffer);
  entries.forEach((e, i) => {
    view.setUint16(i * 28 + 4, e.dataBlockOffset, true);
    view.setInt32(i * 28 + 12, e.typeValue, true);
    view.setUint16(i * 28 + 20, e.category, true);
  });
  return out;
}
function metaBytes(count: number): Uint8Array {
  const out = new Uint8Array(16 + count * 34);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0xfadfadba, true);
  view.setInt32(8, count, true);
  for (let i = 0; i < count; i++) view.setInt32(16 + i * 34 + 4, i * 110, true);
  return out;
}
function timestampParts(date: Date): { time: number; days: number } {
  const diffMs = date.getTime() - Date.UTC(1983, 11, 31);
  const days = Math.floor(diffMs / 86_400_000);
  return { time: Math.round((diffMs - days * 86_400_000) / 6000), days };
}
function dataRecord(uid: number, taskUid: number, resourceUid: number, start: Date, finish: Date, rawUnits: number): Uint8Array {
  const out = new Uint8Array(110);
  const view = new DataView(out.buffer);
  view.setInt32(0, uid, true);
  view.setInt32(4, taskUid, true);
  view.setInt32(8, resourceUid, true);
  const s = timestampParts(start);
  view.setUint16(12, s.time, true);
  view.setUint16(14, s.days, true);
  const f = timestampParts(finish);
  view.setUint16(16, f.time, true);
  view.setUint16(18, f.days, true);
  view.setFloat64(UNITS_OFFSET, rawUnits, true);
  return out;
}
/** Vlak resterend-werkblok (`blockCount` 0), totaalwerk in duizendsten van een minuut op offset 16. */
function flatBlock(rawWork: number): Uint8Array {
  const out = new Uint8Array(24);
  new DataView(out.buffer).setFloat64(16, rawWork, true);
  return out;
}
function var2Data(payloads: Uint8Array[]): { bytes: Uint8Array; offsets: number[] } {
  const offsets: number[] = [];
  let total = 0;
  for (const p of payloads) { offsets.push(total); total += 4 + p.length; }
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  payloads.forEach((p, i) => { view.setInt32(offsets[i], p.length, true); out.set(p, offsets[i] + 4); });
  return { bytes: out, offsets };
}

const asgFieldMap = createAssignmentFieldMap(new Props(encodePropsEntries([{
  key: PROPSKEY_ASSIGNMENT_FIELD_MAP,
  data: fieldMapEntryBytes([
    { typeValue: AssignmentFieldId.UniqueId, dataBlockOffset: 0, category: 3 },
    { typeValue: AssignmentFieldId.TaskUniqueId, dataBlockOffset: 4, category: 3 },
    { typeValue: AssignmentFieldId.ResourceUniqueId, dataBlockOffset: 8, category: 3 },
    { typeValue: AssignmentFieldId.Start, dataBlockOffset: 12, category: 3 },
    { typeValue: AssignmentFieldId.Finish, dataBlockOffset: 16, category: 3 },
    { typeValue: AssignmentFieldId.Units, dataBlockOffset: UNITS_OFFSET, category: 3 },
    { typeValue: AssignmentFieldId.RemainingRegularWork, dataBlockOffset: 65535, category: 8 },
  ]),
}]), 'walk-units-fieldmap'));

// ── Kalenders, resources en taken ──────────────────────────────────────────────────────────────
// ma 2026-01-05 08:00; ma–vr 08:00–12:00 + 13:00–17:00 (MSP Standard, zoals in de corpusbestanden).
const MONDAY_0800 = new Date('2026-01-05T08:00:00.000Z');
const FRIDAY_1700 = new Date('2026-01-09T17:00:00.000Z');
const bands = [{ start: 480, end: 720 }, { start: 780, end: 1020 }];
function standardCal(id: string): WorkCalendar {
  return {
    id, name: id, description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 17, hoursPerDay: 8,
    holidays: [], workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] } },
  };
}
const projectCal = standardCal('cal-project');
// Elke resource een eigen kalenderobject (zoals de `.mpp`-lezer), inhoud gelijk aan de projectkalender:
// laag 4 komt hier uit "meer dan één toewijzing", niet uit een kalenderverschil (zoals "Task 8").
const resourceCals = ['cal-a', 'cal-b', 'cal-cost', 'cal-mat'].map(standardCal);
const calResult: CalendarReadResult = {
  calendarByUniqueId: new Map(), projectCalendar: projectCal, resourceCalendars: resourceCals,
  resourceCalendarUniqueIdByResourceUniqueId: new Map(), ownHolidayCountByUniqueId: new Map(),
};
const res = (id: string, type: Resource['type'], calendarId: string): Resource =>
  ({ id, name: id, type, description: '', maxUnits: 1, calendarId });
const resources: Resource[] = [
  res('r-a', 'LABOR', 'cal-a'), res('r-b', 'LABOR', 'cal-b'),
  res('r-cost', 'LABOR', 'cal-cost'), // MSP-kostenresource: in OPS LABOR (ResourceType kent geen COST)
  res('r-mat', 'MATERIAL', 'cal-mat'),
];
const resourceIdByUid = new Map<number, string>([[1, 'r-a'], [2, 'r-b'], [3, 'r-cost'], [4, 'r-mat']]);
const costResourceIds = new Set(['r-cost']);

function makeTask(id: string, durationMinutes: number): Task {
  return {
    id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    mspTaskType: 'FIXED_UNITS', workRule: 'FIXED_RATE',
    time: {
      durationType: 'WORKTIME', durationUnit: 'hours', scheduleDuration: durationMinutes / 480, durationMinutes,
      scheduleStart: '2026-01-05T08:00', scheduleFinish: '2026-01-09T17:00',
      earlyStart: '2026-01-05T08:00', earlyFinish: '2026-01-09T17:00',
      lateStart: '2026-01-05T08:00', lateFinish: '2026-01-09T17:00',
      freeFloat: 0, totalFloat: 0, isCritical: false, remainingMinutes: durationMinutes, completion: 0,
    },
  } as Task;
}

// Toewijzingen: [uid, taskUid, resourceUid, ruwe inzet (procent × 100), ruw werk (min × 1000)].
const ASSIGNMENTS: [number, number, number, number, number][] = [
  // A — "Task 8": 2 × 12,5% met 300 min werk, de ruwe waarden uit het bestand.
  [10, 501, 1, 1249.9998779296875, 299999.96875],
  [11, 501, 2, 1249.9998779296875, 299999.96875],
  // B — OzBuild "Create Technical Specification": werkresource + kostenresource (ruwe inzet 6).
  [20, 502, 1, 10000, 2_400_000],
  [21, 502, 3, 6, 30_000],
  // C — werkresource 960 min + materiaal (inzet 2, "werk" 4800 ⇒ werk ÷ inzet 2400 > 960).
  [30, 503, 1, 10000, 960_000],
  [31, 503, 4, 20000, 4_800_000],
  // D — twee werkresources, één met inzet 0 (ruw < 0,1 ⇒ 0, MPXJ FieldMap.java DataType.UNITS).
  [40, 504, 1, 10000, 960_000],
  [41, 504, 2, 0, 480_000],
];
const v2 = var2Data(ASSIGNMENTS.map(([, , , , work]) => flatBlock(work)));
const cfb = new CfbFile(buildNestedCfb({
  '   114': {
    children: {
      TBkndAssn: {
        children: {
          FixedMeta: { data: metaBytes(ASSIGNMENTS.length) },
          FixedData: { data: concatBytes(...ASSIGNMENTS.map(([uid, taskUid, resUid, units]) => dataRecord(uid, taskUid, resUid, MONDAY_0800, FRIDAY_1700, units))) },
          VarMeta: { data: buildVarMetaBytes(ASSIGNMENTS.map(([uid], i) => ({ uniqueId: uid, type: AssignmentFieldId.RemainingRegularWork, offset: v2.offsets[i] }))) },
          Var2Data: { data: v2.bytes },
        },
      },
    },
  },
}));

const tasks = [makeTask('t-units', 2400), makeTask('t-cost', 2400), makeTask('t-material', 960), makeTask('t-zero-units', 960)];
const taskIdByUid = new Map<number, string>([[501, 't-units'], [502, 't-cost'], [503, 't-material'], [504, 't-zero-units']]);
const windows = deriveTimephasedWindowsForTasks(cfb, asgFieldMap, taskIdByUid, tasks, calResult, resourceIdByUid, resources, costResourceIds);
const walksOf = (id: string) => windows.get(id)?.durationWalks.map((w) => ({
  anchor: formatInstant(w.anchor, 'hour'), cal: w.resourceCalendarId, minutes: w.workMinutes,
})) ?? null;

// ── De walks zelf ──────────────────────────────────────────────────────────────────────────────
eq('A "Task 8": twee walks, elk 300 min werk ÷ 12,5% = 2400 werkminuten (afgerond op 0,1 min)', walksOf('t-units'), [
  { anchor: '2026-01-05T08:00', cal: 'cal-a', minutes: 2400 },
  { anchor: '2026-01-05T08:00', cal: 'cal-b', minutes: 2400 },
]);
eq('B OzBuild: de kostenresource wandelt niet mee; alleen de werkresource (2400 min)', walksOf('t-cost'), [
  { anchor: '2026-01-05T08:00', cal: 'cal-a', minutes: 2400 },
]);
eq('C materiaal (426): de materiaaltoewijzing wandelt niet mee; alleen de werkresource (960 min)', walksOf('t-material'), [
  { anchor: '2026-01-05T08:00', cal: 'cal-a', minutes: 960 },
]);
eq('D werkresource met inzet 0: geen walks (laag 5, geen gedeeltelijke gok)', windows.has('t-zero-units'), false);

// De term per toewijzing is die van de werkdriehoek (regel 2), niet een losse deling hier.
eq('driehoek: assignmentRemainingMinutes(300 min werk, 12,5%) = 2400',
  assignmentRemainingMinutes({ id: 'x', unitsPerDay: 0.125, remainingWorkMinutes: 300, drivesDuration: true }, 0), 2400);
eq('driehoek: een toewijzing die de duur niet stuurt geeft null',
  assignmentRemainingMinutes({ id: 'x', unitsPerDay: 3, remainingWorkMinutes: 180, drivesDuration: false }, 0), null);
eq('driehoek: inzet 0 geeft null',
  assignmentRemainingMinutes({ id: 'x', unitsPerDay: 0, remainingWorkMinutes: 480, drivesDuration: true }, 0), null);

// ── Doorrekenen: dezelfde invoervorm als `readMPP` (formatInstant 'hour') ─────────────────────────
for (const task of tasks) {
  const window = windows.get(task.id);
  if (!window || window.durationWalks.length === 0) continue;
  task.timephasedStartAnchor = formatInstant(window.startAnchor!, 'hour');
  task.timephasedDurationWalks = window.durationWalks.map((w) => ({
    anchor: formatInstant(w.anchor, 'hour'), resourceCalendarId: w.resourceCalendarId,
    ...(w.workMinutes !== undefined ? { workMinutes: w.workMinutes } : {}),
  }));
}
const project = {
  statusDate: undefined, progressMode: undefined, startDate: '2026-01-05T08:00', endDate: undefined,
  schedulingProfile: builtInProfile('msproject'), schedulingOptions: undefined,
} as unknown as Parameters<typeof solveOptionsFor>[0];
const cpm = solveProject({
  tasks, sequences: [], calendar: projectCal, calendars: resourceCals, ...solveOptionsFor(project),
});
eq('solveProject zonder fout', cpm.error ?? null, null);
const finishOf = (id: string) => tasks.find((t) => t.id === id)?.time.earlyFinish;
eq('A "Task 8" eindigt na 2400 werkminuten, zoals MSP (vr 17:00; zonder inzet ma 14:00)', finishOf('t-units'), '2026-01-09T17:00');
eq('B OzBuild eindigt op vr 17:00 zoals MSP (geen oprekking door de kostenresource)', finishOf('t-cost'), '2026-01-09T17:00');
eq('C materiaal bepaalt het einde niet: 960 werkminuten ⇒ di 2026-01-06 17:00', finishOf('t-material'), '2026-01-06T17:00');

if (diffs.length === 0) {
  console.log(`OK  mpp-walk-units: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  mpp-walk-units: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
