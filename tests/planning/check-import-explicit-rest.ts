import './domStub';
import { installDOMParser } from './xmldom-shim';
import { useAppStore } from '@/state/appStore';
import { createAppStore } from '@/state/appStoreFactory';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { freshPayload, payloadFromImport, type DocumentPayload } from '@/state/documentContract';
import { prepareLoadedPayload } from '@/state/documentActivation';
import { formatRemainingDurationText } from '@/utils/taskDuration';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import { readMPP } from '@/services/mpp/mppReader';
import { readXER } from '@/services/xer/xerReader';
import { readP6XML } from '@/services/p6/p6xmlReader';
import { readMSPDI } from '@/services/msproject/mspdiReader';
import { writeMSPDI } from '@/services/msproject/mspdiWriter';
import { writeP6XML } from '@/services/p6/p6xmlWriter';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import type { Task } from '@/types/task';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import {
  buildCalFixedDataRecord, buildCalFixedMetaBlob, buildCalHoursBlock, buildNestedCfb, buildVarMetaBytes,
  encodeCompObjFileFormat, encodePropsEntries, encodePropsSingleByteEntry, mppTimestampBytes,
} from './mppFixtures';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: kreeg ${JSON.stringify(got)} ≠ verwacht ${JSON.stringify(want)}`);
}

const MPP_EPOCH_DAY = Math.round((Date.UTC(2026, 5, 1) - Date.UTC(1983, 11, 31)) / 86400000);
const utf16 = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
  return out;
};
const int32 = (n: number): Uint8Array => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setInt32(0, n, true);
  return out;
};

interface MppTask {
  name: string;
  duration: number;
  rest: number;
  pct: number;
  start: [number, number];
  finish: [number, number];
  actualStart?: [number, number];
  actualFinish?: [number, number];
}
const RUNNING: MppTask = {
  name: 'Lopend zes dagen', duration: 28800, rest: 19200, pct: 33, start: [480, 0], finish: [480, 8], actualStart: [480, 0],
};

function mpp(tasks: MppTask[]): Uint8Array {
  const slots = 3 + tasks.length;
  const meta = new Uint8Array(16 + slots * 47);
  const mv = new DataView(meta.buffer);
  mv.setUint32(0, 0xfadfadba, true);
  mv.setInt32(8, slots, true);
  const fixed = new Uint8Array(slots * 130);
  const names: Uint8Array[] = [];
  const varMeta: { uniqueId: number; type: number; offset: number }[] = [];
  let varSize = 0;
  tasks.forEach((task, j) => {
    const offset = (3 + j) * 130;
    mv.setInt32(16 + (3 + j) * 47 + 4, offset, true);
    const v = new DataView(fixed.buffer, offset, 130);
    v.setInt32(0, 10 + j, true);
    v.setInt32(4, j + 1, true);
    v.setInt16(40, 1, true);
    v.setInt32(42, task.duration, true);
    v.setUint16(46, 0, true);
    v.setInt32(52, task.rest, true);
    for (const n of [8, 12, 16, 20, 64, 68, 72, 76, 80, 106, 110, 122]) {
      v.setUint16(n, 65535, true);
      v.setUint16(n + 2, 65535, true);
    }
    const stamp = (at: number, moment: [number, number] | undefined) => {
      if (!moment) return;
      v.setUint16(at, moment[0] * 10, true);
      v.setUint16(at + 2, MPP_EPOCH_DAY + moment[1], true);
    };
    stamp(64, task.start);
    stamp(68, task.finish);
    stamp(72, task.actualStart);
    stamp(76, task.actualFinish);
    v.setInt16(90, task.pct, true);
    v.setInt32(118, -1, true);
    const name = utf16(task.name);
    const field = new Uint8Array(4 + name.length);
    new DataView(field.buffer).setInt32(0, name.length, true);
    field.set(name, 4);
    varMeta.push({ uniqueId: 10 + j, type: 14, offset: varSize });
    varSize += field.length;
    names.push(field);
  });
  const var2 = new Uint8Array(varSize);
  let at = 0;
  for (const field of names) { var2.set(field, at); at += field.length; }

  const calName = 'A07 kalender';
  const hours = buildCalHoursBlock([0, 1, 2, 3, 4, 5, 6].map(d => (d === 0 || d === 6
    ? { defaultFlag: 0 as const }
    : { defaultFlag: 0 as const, bands: [{ startMinutes: 480, durationMinutes: 480 }] })));
  const calVar = new Uint8Array(104 + hours.length);
  new DataView(calVar.buffer).setInt32(0, utf16(calName).length, true);
  calVar.set(utf16(calName), 4);
  new DataView(calVar.buffer).setInt32(100, hours.length, true);
  calVar.set(hours, 104);

  const props = encodePropsEntries([
    { key: 37748738, data: mppTimestampBytes(4800, MPP_EPOCH_DAY) },
    { key: 37748739, data: mppTimestampBytes(4800, MPP_EPOCH_DAY + 30) },
    { key: 37748744, data: utf16('A07') },
    { key: 37748765, data: int32(480) },
    { key: 37748756, data: int32(0) },
    { key: 37748750, data: utf16(calName) },
    { key: 37748805, data: mppTimestampBytes(4800, MPP_EPOCH_DAY + 2) },
  ]);
  return buildNestedCfb({
    '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
    Props14: { data: encodePropsSingleByteEntry(893386752, 0) },
    '   114': {
      children: {
        Props: { data: props },
        TBkndTask: {
          children: {
            FixedMeta: { data: meta },
            FixedData: { data: fixed },
            VarMeta: { data: buildVarMetaBytes(varMeta) },
            Var2Data: { data: var2 },
          },
        },
        TBkndCal: {
          children: {
            FixedMeta: { data: buildCalFixedMetaBlob([0]) },
            FixedData: { data: buildCalFixedDataRecord(1, 1, -1) },
            VarMeta: { data: buildVarMetaBytes([{ uniqueId: 1, type: 1, offset: 0 }, { uniqueId: 1, type: 8, offset: 100 }]) },
            Var2Data: { data: calVar },
          },
        },
      },
    },
  });
}
const runningMpp = (over: Partial<MppTask> = {}): Uint8Array => mpp([{ ...RUNNING, ...over }]);

function solved(imported: ImportResult): ImportResult {
  const { project, tasks, sequences, calendar, resourceCalendars } = imported;
  const result = solveProject(solveInputFor(project, tasks, sequences, calendar, resourceCalendars ?? []));
  if (result.error) throw new Error(`solve faalde: ${result.error}`);
  return imported;
}
const reopen = (imported: ImportResult): ImportResult => readIFC(writeIFC(imported));
const leaf = (r: { tasks: Task[] }): Task => r.tasks.find(t => t.childIds.length === 0)!;

{
  const imported = readMPP(runningMpp());
  const t = leaf(imported);
  eq('MPP: voorwaarde lopend, urenmaat (F5b), 6 d, 33 %',
    [t.status, t.time.durationUnit, t.time.scheduleDuration, t.time.completion], ['STARTED', 'hours', 6, 0.33]);
  eq('MPP: bronrest 19200 tienden = 1920 min = 4 d blijft staan (niet 6 × 0,67 = 1930 min = 4,02 d)',
    [t.time.remainingMinutes, t.time.remainingTime], [1920, 4]);
  const d = solved(imported);
  eq('MPP: einde na F5 volgt de bronrest (ma 8 juni 16:00, niet di 9 juni 08:10)', leaf(d).time.earlyFinish, '2026-06-08T16:00');
  const back = reopen(d);
  eq('MPP → IFC → heropenen: nog 4 d rest', leaf(back).time.remainingTime, 4);
  eq('MPP → IFC → heropenen: zelfde einde na F5', leaf(solved(back)).time.earlyFinish, '2026-06-08T16:00');
}

{
  const t = leaf(readMPP(runningMpp({ duration: 33600, rest: 12000, pct: 64 })));
  eq('MPP: gebroken bronrest 2,5 d = 1200 min blijft staan (niet 2,52 d, niet 3 d)',
    [t.time.durationUnit, t.time.scheduleDuration, t.time.durationMinutes, t.time.remainingMinutes, t.time.remainingTime],
    ['hours', 7, 3360, 1200, 2.5]);
}

function xer(dateOnly: boolean): ImportResult {
  const fields = ['task_id', 'proj_id', 'clndr_id', 'task_code', 'task_name', 'task_type', 'duration_type', 'status_code',
    'complete_pct_type', 'complete_pct', 'phys_complete_pct', 'target_drtn_hr_cnt', 'remain_drtn_hr_cnt',
    'target_start_date', 'target_end_date', 'act_start_date', 'act_end_date'];
  const at = (date: string, clock: string) => (dateOnly ? date : `${date} ${clock}`);
  const rows: Record<string, string | number>[] = [
    { complete_pct_type: 'CP_Drtn', complete_pct: 25 },
    { complete_pct_type: 'CP_Phys', phys_complete_pct: 75 },
    { complete_pct_type: 'CP_Units', complete_pct: 50 },
  ];
  const lines = [
    'ERMHDR\t23.12\t2026-06-01\t\t\t\t\t\tEUR',
    '%T\tPROJECT', '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date', '%R\tP1\tA07\tC1\t2026-06-03 16:00',
    '%T\tCALENDAR', '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data', '%R\tC1\tA07\tCA_Project\t8\t40\t',
    '%T\tTASK', `%F\t${fields.join('\t')}`,
    ...rows.map((over, j) => {
      const row: Record<string, string | number> = {
        task_id: `T${j}`, proj_id: 'P1', clndr_id: 'C1', task_code: `T${j}`, task_name: `T${j}`, task_type: 'TT_Task',
        duration_type: 'DT_FixedDUR2', status_code: 'TK_Active', complete_pct_type: 'CP_Phys', complete_pct: 33,
        phys_complete_pct: 33, target_drtn_hr_cnt: 48, remain_drtn_hr_cnt: 32,
        target_start_date: at('2026-06-01', '08:00'), target_end_date: at('2026-06-08', '16:00'),
        act_start_date: at('2026-06-01', '08:00'), ...over,
      };
      return `%R\t${fields.map(f => row[f] ?? '').join('\t')}`;
    }),
    '%E',
  ];
  const result = readXER(new TextEncoder().encode(lines.join('\n')));
  if (isMultiDocumentImport(result)) throw new Error('de enkelprojectfixture gaf meerdere documenten');
  return result;
}
{
  const imported = xer(true);
  const minutes = (r: { tasks: Task[] }) => r.tasks.map(t => [t.time.durationUnit, t.time.completion, t.time.remainingMinutes]);
  eq('XER zonder kloktijd: direct na lezen 2160 / 1920 / 1920 min rest (4,5 / 4 / 4 d)', minutes(imported),
    [['hours', 0.25, 2160], ['hours', 0.75, 1920], ['hours', 0.5, 1920]]);
  const back = reopen(solved(imported));
  const rest = (r: { tasks: Task[] }) => r.tasks.map(t => [t.time.durationUnit, t.time.completion, t.time.remainingMinutes, t.time.remainingTime]);
  eq('XER zonder kloktijd → IFC → heropenen: CP_Phys houdt 32 u = 4 d (niet 1,5 d), CP_Units 4 d (niet 3 d)', rest(back),
    [['hours', 0.25, 2160, 4.5], ['hours', 0.75, 1920, 4], ['hours', 0.5, 1920, 4]]);
}
{
  const back = reopen(solved(xer(false)));
  eq('XER urenmaat → IFC → heropenen: restminuten 2160 / 1920 / 1920',
    back.tasks.map(t => [t.time.durationUnit, t.time.remainingMinutes]), [['hours', 2160], ['hours', 1920], ['hours', 1920]]);
}

{
  const S = () => useAppStore.getState();
  S().loadState(readMPP(runningMpp()));
  const id = leaf({ tasks: S().tasks }).id;
  const task = () => S().tasks.find(t => t.id === id)!;
  eq('store: geladen MPP-taak houdt de bronrest 4 d', task().time.remainingTime, 4);
  S().setTaskProgress(id, 0.5);
  eq('store: 50 % in de app ⇒ rest 6 × 0,5 = 3 d (afgeleid, B3)', [task().time.completion, task().time.remainingTime], [0.5, 3]);
  S().setTaskProgress(id, 0.33);
  eq('store: terug naar 33 % ⇒ rest 2880 × 0,67 = 1930 min (afgeleid, niet de oude bronrest 1920)',
    [task().time.remainingMinutes, task().time.remainingTime], [1930, 1930 / 480]);
}

{
  const S = () => useAppStore.getState();
  const restAfterSave = () => readIFC(writeIFC(buildWriteIFCInput(S(), 'planOnly'))).tasks
    .filter(t => t.childIds.length === 0).map(t => t.time.remainingTime);
  S().openAsDocument(readMPP(runningMpp()), { name: 'a07-rest.mpp', ref: null });
  eq('app: MPP openen → opslaan → heropenen houdt 4 d', restAfterSave(), [4]);
  S().openAsDocument(xer(true), { name: 'a07-xer-date.xer', ref: null });
  eq('app: XER dagenmaat openen → opslaan → heropenen houdt 4,5 / 4 / 4 d', restAfterSave(), [4.5, 4, 4]);
}

{
  const withMarker = writeIFC(solved(readMPP(runningMpp())));
  const legacy = withMarker.replace("IFCPROPERTYSINGLEVALUE('TimeModel'", "IFCPROPERTYSINGLEVALUE('Onbekend'");
  eq('zonder markering: voorwaarde (het bestand had de markering, de kopie niet)',
    [readIFC(withMarker).timeModel, readIFC(legacy).timeModel], ['MINUTES-1', undefined]);
  eq('zonder markering: de expliciete rest 4 d blijft 4 d (niet 4,02 d)', leaf(readIFC(legacy)).time.remainingTime, 4);
  const app = createAppStore();
  app.getState().openAsDocument(readIFC(legacy), { name: 'zonder-markering.ifc', ref: null });
  app.getState().runCPM();
  eq('zonder markering: na openen en F5 einde ma 8 juni 16:00', leaf(app.getState()).time.earlyFinish, '2026-06-08T16:00');
  eq('zonder markering: openen → opslaan → heropenen houdt 4 d',
    leaf(readIFC(writeIFC(buildWriteIFCInput(app.getState(), 'planOnly')))).time.remainingTime, 4);
}

{
  const q = readMPP(mpp([
    { name: 'Vast werk nog dagen', duration: 14400, rest: 14400, pct: 0, start: [480, 2], finish: [480, 6] },
    { ...RUNNING, name: 'Lopend expliciete rest' },
  ]));
  for (const task of q.tasks) {
    const t = task.time;
    t.durationUnit = 'days';
    if (t.remainingMinutes != null) t.remainingTime = t.remainingMinutes / 480;
    delete t.durationMinutes;
    delete t.remainingMinutes;
  }
  eq('B1a/B5: voorwaarde (twee dagtaken van 3 en 6 d, rest 3 en 4 d)',
    q.tasks.map(t => [t.time.durationUnit, t.time.scheduleDuration, t.time.remainingTime]), [['days', 3, 3], ['days', 6, 4]]);
  q.tasks[0].workRule = 'FIXED_WORK';
  q.tasks[1].workRule = 'FIXED_DURATION_RATE';
  const app = createAppStore();
  app.getState().openAsDocument(readIFC(writeIFC(q)), { name: 'B1a.ifc', ref: null });
  const rest = (r: { tasks: Task[] }) => r.tasks.find(t => t.name === 'Lopend expliciete rest')?.time.remainingTime;
  eq('B1a/B5: voorwaarde (omzetting gesloten, één undo-stap, vast werk in uren)',
    [app.getState().minuteModelPending, app.getState().historyEvents.length, app.getState().tasks[0].time.durationUnit],
    [false, 1, 'hours']);
  eq('B1a/B5: na openen 4 d rest', rest(app.getState()), 4);
  app.getState().undo();
  const saved = writeIFC(buildWriteIFCInput(app.getState(), 'planOnly'));
  eq('B1a/B5 → Ctrl+Z: voorwaarde (omzetting open, bestand zonder markering)',
    [app.getState().minuteModelPending, readIFC(saved).timeModel], [true, undefined]);
  eq('B1a/B5 → Ctrl+Z → opslaan → heropenen houdt 4 d (niet 4,02 d)', rest(readIFC(saved)), 4);
}

{
  const imported = readMPP(runningMpp({ name: 'Voltooid met bronrest', pct: 100, actualFinish: [900, 1] }));
  const state = (t: Task) => [t.status, t.time.durationUnit, t.time.remainingMinutes, t.time.remainingTime];
  eq('voltooid: urentaak krijgt rest 0 (niet 1920 min)', state(leaf(imported)), ['COMPLETED', 'hours', 0, 0]);
  eq('voltooid → IFC → heropenen: rest 0', state(leaf(reopen(solved(imported)))), ['COMPLETED', 'hours', 0, 0]);
}

{
  const LONG = [{ start: 420, end: 885 }];
  const SHORT = [{ start: 420, end: 720 }];
  const p: DocumentPayload = freshPayload();
  p.calendar = {
    ...p.calendar, workStartHour: 7, workEndHour: 14.75, hoursPerDay: 7.75, holidays: [],
    workTime: { byWeekday: { 1: LONG, 2: LONG, 3: LONG, 4: LONG, 5: SHORT, 6: [], 7: [] } },
  };
  p.calendars = [p.calendar];
  p.project = { ...p.project, startDate: '2026-06-01', statusDate: '2026-06-05' };
  p.tasks = [{
    id: 'C', name: 'C', description: '', wbsCode: 'C', taskType: 'CONSTRUCTION', status: 'STARTED', isMilestone: false,
    priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: {
      ...createDefaultTaskTime('2026-06-01', 3), scheduleStart: '2026-06-01T07:00', scheduleFinish: '2026-06-04T14:45',
      earlyStart: '2026-06-01T07:00', earlyFinish: '2026-06-04T14:45', actualStart: '2026-06-01T07:00',
      completion: 13 / 18, remainingTime: 5 / 6,
    },
  }];
  const record = (ifc: string) => ifc.match(/"RemainingTime":\[([^,\]]+),(\d+)\]/)?.slice(1, 3).map(Number);
  const restDurations = (ifc: string) => ifc.match(/'PT6H\d+M0S'/g) ?? [];
  let ifc = writeIFC(buildWriteIFCInput(prepareLoadedPayload(p, { recompute: true }), 'planOnly'));
  for (const round of [1, 2, 3]) {
    eq(`357 export ${round}: de rest is 388 min (5/6 × 465), ook in het record`,
      [restDurations(ifc), record(ifc)?.[1]], [["'PT6H28M0S'"], 388]);
    const back = readIFC(ifc);
    eq(`357 heropenen ${round}: de rest is de waarde uit het record, niet 3 × 5/18`,
      back.tasks[0].time.remainingTime, record(ifc)?.[0]);
    ifc = writeIFC(buildWriteIFCInput(payloadFromImport(back, null), 'planOnly'));
  }
}

installDOMParser();
type Point = [string, number | undefined, number | undefined, string | null];
function threePoints(imported: ImportResult, name: string): Point[] {
  const state = (t: Task): Point => [t.status, t.time.remainingMinutes, t.time.remainingTime, t.time.actualFinish ?? null];
  const read = state(leaf(imported));
  const app = createAppStore();
  app.getState().openAsDocument(imported, { name, ref: null });
  const opened = state(leaf(app.getState()));
  const back = state(leaf(readIFC(writeIFC(buildWriteIFCInput(app.getState(), 'planOnly')))));
  return [read, opened, back];
}
const thrice = <T,>(want: T): T[] => [want, want, want];

function p6xml(over: { status?: string; actualFinish?: string; restHours?: number } = {}): ImportResult {
  const finish = over.actualFinish ? `<ActualFinishDate>${over.actualFinish}</ActualFinishDate>` : '';
  return readP6XML(`<?xml version="1.0"?><APIBusinessObjects><Project><ObjectId>1</ObjectId><Name>P</Name>`
    + '<PlannedStartDate>2026-06-01T08:00:00</PlannedStartDate><DataDate>2026-06-03T08:00:00</DataDate>'
    + '<Activity><ObjectId>1</ObjectId><Id>X</Id><Name>Lopend, fysiek 100 procent</Name>'
    + `<PlannedDuration>48</PlannedDuration><RemainingDuration>${over.restHours ?? 32}</RemainingDuration>`
    + '<PlannedStartDate>2026-06-01T09:15:00</PlannedStartDate><PlannedFinishDate>2026-06-08T15:15:00</PlannedFinishDate>'
    + `<Status>${over.status ?? 'In Progress'}</Status><ActualStartDate>2026-06-01T09:15:00</ActualStartDate>${finish}`
    + '<PercentCompleteType>Physical</PercentCompleteType><PhysicalPercentComplete>1</PhysicalPercentComplete>'
    + '</Activity></Project></APIBusinessObjects>');
}
{
  const imported = p6xml();
  eq('P6 XML lopend 100 %: voorwaarde urenmaat, 2880 min, 100 %',
    [leaf(imported).time.durationUnit, leaf(imported).time.durationMinutes, leaf(imported).time.completion], ['hours', 2880, 1]);
  eq('P6 XML lopend 100 %: STARTED, 1920 restminuten, geen werkelijk einde (lezen, openen, IFC heropenen)',
    threePoints(imported, 'p6-physical100.xml').map(p => [p[0], p[1], p[3]]), thrice(['STARTED', 1920, null]));
  eq('P6 XML status Completed (geen werkelijk einde): voltooid met rest 0',
    threePoints(p6xml({ status: 'Completed' }), 'p6-completed.xml').map(p => [p[0], p[1]]), thrice(['COMPLETED', 0]));
  eq('P6 XML In Progress mét werkelijk einde: voltooid met rest 0 (het werkelijke einde wint)',
    threePoints(p6xml({ actualFinish: '2026-06-02T15:00:00' }), 'p6-af.xml').map(p => [p[0], p[1]]), thrice(['COMPLETED', 0]));
}

function mspdi(over: { actualFinish?: string; rest?: string } = {}): ImportResult {
  const day = (d: number) => `<WeekDay><DayType>${d}</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime>`
    + '<FromTime>08:00:00</FromTime><ToTime>16:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>';
  const finish = over.actualFinish ? `<ActualFinish>${over.actualFinish}</ActualFinish>` : '';
  return readMSPDI('<?xml version="1.0"?><Project><StartDate>2026-06-01T08:00:00</StartDate>'
    + '<StatusDate>2026-06-03T08:00:00</StatusDate><CalendarUID>1</CalendarUID><Calendars><Calendar><UID>1</UID>'
    + `<Name>A07</Name><WeekDays>${[2, 3, 4, 5, 6].map(day).join('')}</WeekDays></Calendar></Calendars><Tasks>`
    + '<Task><UID>1</UID><ID>1</ID><Name>Lopend op 100 procent</Name><OutlineLevel>1</OutlineLevel>'
    + '<Duration>PT48H0M0S</Duration><Start>2026-06-01T09:15:00</Start><Finish>2026-06-09T09:15:00</Finish>'
    + `<PercentComplete>100</PercentComplete><ActualStart>2026-06-01T09:15:00</ActualStart>${finish}`
    + `<RemainingDuration>${over.rest ?? 'PT32H0M0S'}</RemainingDuration></Task></Tasks></Project>`);
}
{
  const imported = mspdi();
  eq('MSPDI 100 % zonder werkelijk einde: voorwaarde urenmaat, 2880 min, 100 %',
    [leaf(imported).time.durationUnit, leaf(imported).time.durationMinutes, leaf(imported).time.completion], ['hours', 2880, 1]);
  eq('MSPDI 100 % zonder werkelijk einde met rest: STARTED, 1920 restminuten (lezen, openen, IFC heropenen)',
    threePoints(imported, 'lopend100.xml').map(p => [p[0], p[1], p[3]]), thrice(['STARTED', 1920, null]));
  eq('MSPDI 100 % mét werkelijk einde: voltooid met rest 0',
    threePoints(mspdi({ actualFinish: '2026-06-02T15:00:00' }), 'af.xml').map(p => [p[0], p[1]]), thrice(['COMPLETED', 0]));
  eq('MSPDI 100 % zonder werkelijk einde met rest 0: voltooid met rest 0',
    threePoints(mspdi({ rest: 'PT0H0M0S' }), 'rest0.xml').map(p => [p[0], p[1]]), thrice(['COMPLETED', 0]));
}

{
  eq('MPP op een dagkalender 100 % zonder werkelijk einde met 4 d rest: STARTED, 1920 min (lezen, openen, IFC heropenen)',
    threePoints(readMPP(runningMpp({ name: 'Lopend 100', pct: 100 })), 'lopend100.mpp').map(p => [p[0], p[1], p[3]]),
    thrice(['STARTED', 1920, null]));
  eq('MPP urenmaat 100 % zonder werkelijk einde met 1920 min rest: STARTED, 1920 min',
    threePoints(readMPP(runningMpp({ name: 'Lopend 100 uur', pct: 100, actualStart: [555, 0] })), 'lopend100u.mpp')
      .map(p => [p[0], p[1], p[3]]), thrice(['STARTED', 1920, null]));
  eq('MPP 100 % zonder werkelijk einde met rest 0: voltooid met rest 0',
    threePoints(readMPP(runningMpp({ name: 'Klaar zonder einde', pct: 100, rest: 0 })), 'rest0.mpp').map(p => [p[0], p[2]]),
    thrice(['COMPLETED', 0]));
}

for (const [name, imported] of [
  ['P6 XML', p6xml()], ['MSPDI', mspdi()],
  ['MPP', readMPP(runningMpp({ name: 'Restweergave', pct: 100, actualStart: [555, 0] }))],
] as const) {
  const app = createAppStore();
  app.getState().openAsDocument(imported, { name, ref: null });
  const check = (stage: string) => {
    const t = leaf(app.getState());
    eq(`387 ${name} ${stage}: lopend met bronrest`, [t.status, t.time.completion, t.time.remainingMinutes, t.time.actualFinish ?? null],
      ['STARTED', 1, 1920, null]);
    eq(`387 ${name} ${stage}: zichtbare rest`, formatRemainingDurationText(t), '32h');
  };
  check('openen');
  app.getState().runCPM();
  check('berekenen');
  for (let round = 1; round <= 2; round++) {
    const back = readIFC(writeIFC(buildWriteIFCInput(app.getState(), 'planOnly')));
    app.getState().openAsDocument(back, { name: `${name}-${round}.ifc`, ref: null });
    check(`IFC ${round}`);
  }
}

{
  const viaP6 = (q: ImportResult) => readP6XML(writeP6XML(q.project, q.calendar, q.tasks, q.sequences, [], [], q.resourceCalendars ?? []));
  const viaMs = (q: ImportResult) => readMSPDI(writeMSPDI(q.project, q.calendar, q.tasks, q.sequences, [], [], q.resourceCalendars ?? []));
  const state = (r: ImportResult) => [leaf(r).status, leaf(r).time.remainingMinutes, leaf(r).time.actualFinish ?? null];
  eq('OPS → P6 XML → OPS: lopend op 100 % houdt 1920 min en geen werkelijk einde', state(viaP6(p6xml())), ['STARTED', 1920, null]);
  const p6Status = (q: ImportResult) => writeP6XML(q.project, q.calendar, q.tasks, q.sequences, [], [], q.resourceCalendars ?? [])
    .match(/<Status>([^<]*)<\/Status>/g)?.filter(x => x !== '<Status>Active</Status>' && x !== '<Status>Planned</Status>');
  eq('P6-XML-export: lopend op 100 % ⇒ In Progress, voltooid ⇒ Completed',
    [p6Status(p6xml()), p6Status(p6xml({ status: 'Completed' }))], [['<Status>In Progress</Status>'], ['<Status>Completed</Status>']]);
  const exportP6 = (q: ImportResult) => writeP6XML(q.project, q.calendar, q.tasks, q.sequences, [], [], q.resourceCalendars ?? []);
  const zero = p6xml({ restHours: 0 });
  eq('381 bron loopt op 100 % met nul rest', state(zero), ['STARTED', 0, null]);
  eq('381 eigen P6-export houdt lopend bij nul rest: lezen, openen en IFC',
    threePoints(viaP6(zero), 'eigen-p6-rest0.xml').map(p => [p[0], p[1], p[3]]), thrice(['STARTED', 0, null]));
  const oldExport = exportP6(p6xml()).replace('<Status>In Progress</Status>', '<Status>Completed</Status>');
  eq('381 oude OPS-export met Completed en positieve rest blijft lopend', state(readP6XML(oldExport)), ['STARTED', 1920, null]);
  const actualEnd = exportP6(zero).replace('<Status>In Progress</Status>',
    '<Status>In Progress</Status><ActualFinishDate>2026-06-02T15:00:00</ActualFinishDate>');
  eq('381 eigen export: werkelijk einde wint ook van In Progress met nul rest', state(readP6XML(actualEnd)),
    ['COMPLETED', 0, '2026-06-02T15:00']);
  eq('OPS → MSPDI → OPS: lopend op 100 % houdt 1920 min en geen werkelijk einde', state(viaMs(p6xml())), ['STARTED', 1920, null]);
  const done = p6xml({ status: 'Completed' });
  eq('OPS → P6 XML → OPS: voltooid blijft voltooid met rest 0', state(viaP6(done)).slice(0, 2), ['COMPLETED', 0]);
  eq('OPS → MSPDI → OPS: voltooid blijft voltooid met rest 0', state(viaMs(done)).slice(0, 2), ['COMPLETED', 0]);
}

if (diffs.length === 0) {
  console.log(`OK  import-explicit-rest: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  import-explicit-rest: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
