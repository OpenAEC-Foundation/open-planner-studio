import { setConvention } from './p6SemanticsOff';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveProject } from '@/engine/scheduler/solveProject';
import { readXER } from '@/services/xer/xerReader';
import { activeImportResult, isMultiDocumentImport } from '@/services/importTypes';
import type { ProjectSchedulingOptions } from '@/types/project';
import { parseInstant } from '@/utils/dateUtils';
import { shownFinish, shownStart } from '@/utils/taskDates';
import type { Task } from '@/types/task';
import { explainP6CompletedDataDateWindow } from '@/engine/scheduler/p6CompletedTargetWindow';
import { explainP6CompletedLateRemainingWindowEligibilityResolved } from '@/engine/scheduler/p6CompletedRouteTrace';
import { solveOptionsFor } from '@/engine/scheduler/solveInput';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

type RelType = 'FS' | 'SS' | 'FF' | 'SF';
interface CaseCalendar { workDays: number[]; holidays?: string[] }
interface CaseActivity {
  code: string;
  durationDays: number;
  calendar: string;
  actualStart?: string;
  actualFinish?: string;
  remainingDuration?: number;
  constraint?: { type: string; date: string };
  constraint2?: { type: string };
}
interface EngineCase {
  id: string;
  dataDate: string;
  projectStart: string;
  calendars: Record<string, CaseCalendar>;
  activities: CaseActivity[];
  relationships: { from: string; to: string; type: RelType; lagDays: number }[];
}
const MONFRI: Record<string, CaseCalendar> = { MONFRI: { workDays: [1, 2, 3, 4, 5] } };
const CASES: EngineCase[] = [
  {
    id: '01-fs-chain', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 5, calendar: 'MONFRI' },
      { code: 'B', durationDays: 3, calendar: 'MONFRI' },
      { code: 'C', durationDays: 2, calendar: 'MONFRI' },
    ],
    relationships: [
      { from: 'A', to: 'B', type: 'FS', lagDays: 0 },
      { from: 'B', to: 'C', type: 'FS', lagDays: 0 },
    ],
  },
  {
    id: '02-ss-with-lag', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 10, calendar: 'MONFRI' },
      { code: 'B', durationDays: 4, calendar: 'MONFRI' },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'SS', lagDays: 5 }],
  },
  {
    id: '03-ff-with-lag', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 5, calendar: 'MONFRI' },
      { code: 'B', durationDays: 4, calendar: 'MONFRI' },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FF', lagDays: 3 }],
  },
  {
    id: '04-sf-edge-case', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 5, calendar: 'MONFRI' },
      { code: 'B', durationDays: 3, calendar: 'MONFRI' },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'SF', lagDays: 0 }],
  },
  {
    id: '05-negative-float', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 8, calendar: 'MONFRI' },
      { code: 'B', durationDays: 4, calendar: 'MONFRI', constraint: { type: 'CS_MEOB', date: '2026-01-12' } },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FS', lagDays: 0 }],
  },
  {
    id: '06-multiple-calendars', dataDate: '2026-01-05', projectStart: '2026-01-05',
    calendars: { MONFRI: { workDays: [1, 2, 3, 4, 5] }, SIXDAY: { workDays: [1, 2, 3, 4, 5, 6] } },
    activities: [
      { code: 'A', durationDays: 10, calendar: 'MONFRI' },
      { code: 'B', durationDays: 10, calendar: 'SIXDAY' },
    ],
    relationships: [],
  },
  {
    id: '07-ontario-holidays', dataDate: '2026-01-05', projectStart: '2026-01-05',
    calendars: {
      CA_ON: {
        workDays: [1, 2, 3, 4, 5],
        holidays: [
          '2026-01-01', '2026-02-16', '2026-04-03', '2026-05-18', '2026-07-01', '2026-08-03',
          '2026-09-07', '2026-10-12', '2026-12-25', '2026-12-28', '2027-01-01', '2027-02-15',
          '2027-03-26', '2027-05-24', '2027-07-01', '2027-08-02', '2027-09-06', '2027-10-11',
          '2027-12-27', '2027-12-28',
        ],
      },
    },
    activities: [{ code: 'A', durationDays: 90, calendar: 'CA_ON' }],
    relationships: [],
  },
  {
    id: '08-in-progress-retained-logic', dataDate: '2026-01-12', projectStart: '2026-01-05',
    calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 10, calendar: 'MONFRI', actualStart: '2026-01-06', remainingDuration: 7 },
      { code: 'B', durationDays: 5, calendar: 'MONFRI' },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FS', lagDays: 0 }],
  },
  {
    id: '09-completed-successor', dataDate: '2026-01-05', projectStart: '2025-12-01',
    calendars: MONFRI,
    activities: [
      {
        code: 'B', durationDays: 11, calendar: 'MONFRI',
        actualStart: '2025-12-15', actualFinish: '2025-12-30',
      },
      { code: 'A', durationDays: 5, calendar: 'MONFRI' },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FS', lagDays: 0 }],
  },
  {
    id: '10-out-of-sequence-progress', dataDate: '2026-01-12', projectStart: '2026-01-05',
    calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 10, calendar: 'MONFRI' },
      { code: 'B', durationDays: 5, calendar: 'MONFRI', actualStart: '2026-01-08', remainingDuration: 3 },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FS', lagDays: 0 }],
  },
  {
    id: '11-mandatory-start-finish', dataDate: '2026-01-05', projectStart: '2026-01-05',
    calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 5, calendar: 'MONFRI', constraint: { type: 'CS_MSO', date: '2026-01-12' } },
      { code: 'B', durationDays: 4, calendar: 'MONFRI', constraint: { type: 'CS_MEO', date: '2026-01-30' } },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FS', lagDays: 0 }],
  },
  {
    id: '12-snet-fnlt', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 5, calendar: 'MONFRI', constraint: { type: 'CS_MSOA', date: '2026-01-20' } },
      { code: 'B', durationDays: 5, calendar: 'MONFRI', constraint: { type: 'CS_MEOB', date: '2026-02-13' } },
    ],
    relationships: [{ from: 'A', to: 'B', type: 'FS', lagDays: 0 }],
  },
  {
    id: '13-alap', dataDate: '2026-01-05', projectStart: '2026-01-05', calendars: MONFRI,
    activities: [
      { code: 'A', durationDays: 5, calendar: 'MONFRI' },
      { code: 'B', durationDays: 5, calendar: 'MONFRI', constraint2: { type: 'CS_ALAP' } },
      { code: 'C', durationDays: 3, calendar: 'MONFRI', constraint: { type: 'CS_MEOB', date: '2026-02-28' } },
    ],
    relationships: [
      { from: 'A', to: 'B', type: 'FS', lagDays: 0 },
      { from: 'B', to: 'C', type: 'FS', lagDays: 0 },
    ],
  },
];

const HOURS_PER_DAY = 8;
const P6_EPOCH_UTC = Date.UTC(1899, 11, 30);

function p6DaySerial(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Math.round((Date.UTC(year!, month! - 1, day!) - P6_EPOCH_UTC) / 86_400_000);
}

function p6WeekdayIndex(isoWeekday: number): number {
  return isoWeekday === 7 ? 1 : isoWeekday + 1;
}

function calendarData(calendar: CaseCalendar): string {
  const days = [1, 2, 3, 4, 5, 6, 7].map(iso => {
    const index = p6WeekdayIndex(iso);
    const bands = calendar.workDays.includes(iso)
      ? '(0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())'
      : '';
    return `(0||${index}()(${bands}))`;
  }).join('');
  const exceptions = (calendar.holidays ?? [])
    .map(date => `(0||${p6DaySerial(date)}(d|${p6DaySerial(date)})())`).join('');
  return `(0||CalendarData()((0||DaysOfWeek()(${days}))(0||Exceptions()(${exceptions}))))`;
}

function statusCode(activity: CaseActivity): string {
  if (activity.actualFinish) return 'TK_Complete';
  if (activity.actualStart) return 'TK_Active';
  return 'TK_NotStart';
}

function remainingHours(activity: CaseActivity): number {
  if (activity.actualFinish) return 0;
  if (activity.remainingDuration !== undefined) return activity.remainingDuration * HOURS_PER_DAY;
  return activity.durationDays * HOURS_PER_DAY;
}

function caseBytes(item: EngineCase): Uint8Array {
  const calendarIds = Object.keys(item.calendars);
  const lines: string[] = [
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    ...calendarIds.map(id => {
      const calendar = item.calendars[id]!;
      const weekHours = calendar.workDays.length * HOURS_PER_DAY;
      return `%R\t${id}\t${id}\tCA_Base\t${HOURS_PER_DAY}\t${weekHours}\t${calendarData(calendar)}`;
    }),
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\tplan_end_date\trem_target_link_flag',
    `%R\tP\t${item.id}\t${calendarIds[0]}\t${item.dataDate} 00:00\t${item.projectStart} 08:00\t\tY`,
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code'
      + '\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date'
      + '\tact_start_date\tact_end_date\tcstr_type\tcstr_date\tcstr_type2',
    ...item.activities.map(activity => [
      '%R', activity.code, 'P', activity.calendar, activity.code, activity.code,
      'TT_Task', 'DT_FixedDrtn', statusCode(activity), 'CP_Drtn',
      String(activity.durationDays * HOURS_PER_DAY), String(remainingHours(activity)),
      `${item.projectStart} 08:00`, '',
      activity.actualStart ? `${activity.actualStart} 08:00` : '',
      activity.actualFinish ? `${activity.actualFinish} 17:00` : '',
      activity.constraint?.type ?? '',
      activity.constraint ? `${activity.constraint.date} 08:00` : '',
      activity.constraint2?.type ?? '',
    ].join('\t')),
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    ...item.relationships.map((relation, index) =>
      `%R\tR${index}\t${relation.to}\t${relation.from}\tP\tP\tPR_${relation.type}`
      + `\t${relation.lagDays * HOURS_PER_DAY}`),
    '%E',
  ];
  return new TextEncoder().encode(lines.join('\n'));
}

interface P6Row extends Record<string, string> {
  activity_code: string;
  ES_p6: string; EF_p6: string; LS_p6: string; LF_p6: string; TF_p6: string; FF_p6: string;
}
const oracle = JSON.parse(readFileSync(join(HERE, 'cases-p6-verified.json'), 'utf-8')) as {
  cases: { id: string; activities: P6Row[] }[];
};

function p6Instant(value: string): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/.exec(value);
  return match ? `${match[1]}T${match[2]}` : null;
}
function p6Number(value: string): number | null {
  return value === '' ? null : Number(value);
}

type Axis = 'es' | 'ef' | 'ls' | 'lf' | 'tf' | 'ff';
const AXES: readonly Axis[] = ['es', 'ef', 'ls', 'lf', 'tf', 'ff'];
const GATE_REASONS_PIN = ['missingExplicitTargetWindow'];
const GATE_REASON_CASE_09_B = 'missingExplicitTargetWindow';
const REAL_AS_READ_PIN = { cellen: 160, eens: 160 };
const REAL_WITHOUT_PROJECT_END_PIN = { cellen: 160, eens: 160 };
const REAL_PROJECT_RANGE_PIN = { start: '2026-01-05T08:00', end: '2026-01-05T08:00', flag: false };
const DEVIATING_CELLS_PIN: Record<string, Record<string, string[]>> = {};
const ACTUAL_CELLS_PIN: Record<string, Record<string, string[]>> = {
  '08-in-progress-retained-logic': { A: ['es', 'ls'] },
  '09-completed-successor': { B: ['es', 'ef', 'ls', 'lf'] },
  '10-out-of-sequence-progress': { B: ['es', 'ls'] },
};
const CASE_10_B_PIN = { es: '2026-01-26T08:00', ls: '2026-01-26T08:00' };
const CASE_08_PIN = {
  A: { es: '2026-01-12T08:00', ef: '2026-01-20T17:00', ls: '2026-01-12T08:00', lf: '2026-01-20T17:00', tf: 0, ff: 0 },
  B: { es: '2026-01-21T08:00', ef: '2026-01-27T17:00', ls: '2026-01-21T08:00', lf: '2026-01-27T17:00', tf: 0, ff: 0 },
};

interface Measured {
  es?: string; ef?: string; ls?: string; lf?: string; tf: number; ff: number;
  shownStart: string; shownFinish: string;
}

function measure(
  task: Task,
  solved: { earlyStart?: string; earlyFinish?: string; lateStart?: string; lateFinish?: string; totalFloat: number; freeFloat: number },
): Measured {
  const view: Task = {
    ...task,
    time: { ...task.time, earlyStart: solved.earlyStart ?? '', earlyFinish: solved.earlyFinish ?? '' },
  };
  return {
    es: solved.earlyStart, ef: solved.earlyFinish, ls: solved.lateStart, lf: solved.lateFinish,
    tf: solved.totalFloat, ff: solved.freeFloat,
    shownStart: shownStart(view), shownFinish: shownFinish(view),
  };
}

function isActualCell(raw: string): boolean {
  return / A$/.test(raw);
}

function oursForCell(ours: Measured, axis: Axis, raw: string): string | number | undefined {
  if (axis === 'tf' || axis === 'ff') return ours[axis];
  if (isActualCell(raw)) return axis === 'es' || axis === 'ls' ? ours.shownStart : ours.shownFinish;
  return ours[axis];
}

function solveCase(item: EngineCase): { measured: Map<string, Measured>; gate: Record<string, string> } {
  const imported = activeImportResult(readXER(caseBytes(item)));
  setConvention(imported, 'p6CompletedDataDateWindow', true);
  setConvention(imported, 'p6CompletedLoeActualFinish', true);
  const result = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: solveOptionsFor(imported.project).schedulingOptions,
    projectStartDate: imported.project.startDate,
    projectEndDate: imported.project.endDate,
  });
  if (result.error) throw new Error(`${item.id}: ${result.error}`);
  const measured = new Map<string, Measured>();
  for (const activity of item.activities) {
    const solved = result.tasks.get(activity.code);
    const task = imported.tasks.find(candidate => candidate.id === activity.code);
    if (!solved || !task) throw new Error(`${item.id}: taak ${activity.code} ontbreekt in de uitkomst`);
    measured.set(activity.code, measure(task, solved));
  }
  const dataDate = imported.project.statusDate ? parseInstant(imported.project.statusDate) : null;
  const gate: Record<string, string> = {};
  for (const task of imported.tasks) {
    gate[task.id] = explainP6CompletedDataDateWindow(
      task, dataDate, solveOptionsFor(imported.project).schedulingOptions,
    ).reason;
  }
  return { measured, gate };
}

const agreement: Record<string, Record<string, Record<string, boolean | null>>> = {};
const actualCells: Record<string, Record<string, string[]>> = {};
const gates: Record<string, Record<string, string>> = {};
for (const item of CASES) {
  const { measured, gate } = solveCase(item);
  gates[item.id] = gate;
  const oracleCase = oracle.cases.find(entry => entry.id === item.id);
  if (!oracleCase) throw new Error(`orakel mist casus ${item.id}`);
  agreement[item.id] = {};
  for (const row of oracleCase.activities) {
    const ours = measured.get(row.activity_code);
    if (!ours) throw new Error(`${item.id}: orakelactiviteit ${row.activity_code} niet gesolved`);
    const perAxis: Record<string, boolean | null> = {};
    for (const axis of AXES) {
      const raw = row[`${axis.toUpperCase()}_p6`]!;
      const want = axis === 'tf' || axis === 'ff' ? p6Number(raw) : p6Instant(raw);
      perAxis[axis] = want === null ? null : oursForCell(ours, axis, raw) === want;
      if (isActualCell(raw)) {
        ((actualCells[item.id] ??= {})[row.activity_code] ??= []).push(axis);
      }
    }
    agreement[item.id]![row.activity_code] = perAxis;
  }
}

eq('1 completed-statusdatumvenster blijft in alle dertien casussen gesloten — en om déze redenen',
  [...new Set(Object.values(gates).flatMap(entry => Object.values(entry)))].sort(),
  GATE_REASONS_PIN);

{
  const { measured, gate } = solveCase(CASES.find(item => item.id === '09-completed-successor')!);
  const a = measured.get('A')!;
  const b = measured.get('B')!;
  eq('2 casus 09: open voorganger A krijgt LS = ES en TF = 0, exact zoals P6 23.12 opnam', {
    es: a.es, ef: a.ef, ls: a.ls, lf: a.lf, tf: a.tf, ff: a.ff,
  }, {
    es: '2026-01-05T08:00', ef: '2026-01-09T17:00',
    ls: '2026-01-05T08:00', lf: '2026-01-09T17:00', tf: 0, ff: 0,
  });
  eq('2a casus 09: de voltooide opvolger B blijft op haar historische actual-venster',
    { es: b.es, ef: b.ef, ls: b.ls, lf: b.lf },
    {
      es: '2025-12-15T08:00', ef: '2025-12-30T17:00',
      ls: '2025-12-15T08:00', lf: '2025-12-30T17:00',
    });
  eq('2b casus 09: B komt niet door het completed-statusdatumvenster (poortreden zoals de bron die geeft)',
    gate.B, GATE_REASON_CASE_09_B);
}

{
  const calendar = calendarData({ workDays: [1, 2, 3, 4, 5] });
  const bytes = new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-01-05\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    `%R\tC1\tP6 5x8\tCA_Base\t8\t40\t${calendar}`,
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date\trem_target_link_flag',
    '%R\tP\tcasus 09 met targetvenster\tC1\t2026-01-05 00:00\t2025-12-01 08:00\tY',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code'
      + '\tcomplete_pct_type\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date'
      + '\ttarget_end_date\tact_start_date\tact_end_date',
    '%R\tA\tP\tC1\tA\tOpen voorganger\tTT_Task\tDT_FixedDUR2\tTK_NotStart\tCP_Drtn\t40\t40'
      + '\t2026-01-05 08:00\t2026-01-09 17:00\t\t',
    '%R\tB\tP\tC1\tB\tVoltooide opvolger\tTT_Task\tDT_FixedDUR2\tTK_Complete\tCP_Drtn\t88\t0'
      + '\t2025-12-15 08:00\t2025-12-30 17:00\t2025-12-15 08:00\t2025-12-30 17:00',
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR0\tB\tA\tP\tP\tPR_FS\t0',
    '%E',
  ].join('\n'));
  const imported = activeImportResult(readXER(bytes));
  setConvention(imported, 'p6CompletedDataDateWindow', true);
  setConvention(imported, 'p6CompletedLoeActualFinish', true);
  const dataDate = imported.project.statusDate ? parseInstant(imported.project.statusDate) : null;
  const b = imported.tasks.find(task => task.id === 'B')!;
  eq('3 dezelfde topologie MET targetvenster opent de poort wél', {
    window: explainP6CompletedDataDateWindow(b, dataDate, solveOptionsFor(imported.project).schedulingOptions).reason,
    shared: explainP6CompletedLateRemainingWindowEligibilityResolved(
      b, dataDate, solveOptionsFor(imported.project).schedulingOptions,
    ).eligible,
  }, { window: 'eligible', shared: true });
  const result = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: solveOptionsFor(imported.project).schedulingOptions,
    projectStartDate: imported.project.startDate,
    projectEndDate: imported.project.endDate,
  });
  if (result.error) throw new Error(result.error);
  const a = result.tasks.get('A')!;
  const solvedB = result.tasks.get('B')!;
  eq('3a met de poort open verschuift de late zijde van B naar het statusdatumvenster', {
    ls: solvedB.lateStart, lf: solvedB.lateFinish,
  }, { ls: '2026-01-05T08:00', lf: '2026-01-02T17:00' });
  eq('3b en A verliest daardoor haar nulfloat (zelfde topologie, andere bronvorm dan casus 09)',
    { ls: a.lateStart, lf: a.lateFinish, tf: a.totalFloat },
    { ls: '2025-12-29T08:00', lf: '2026-01-02T17:00', tf: -5 });
}

{
  const case09 = CASES.find(item => item.id === '09-completed-successor')!;
  const text = new TextDecoder().decode(caseBytes(case09));
  const taskRows = text.split('\n').filter(line => line.startsWith('%R\t') && line.includes('\tTT_Task\t'));
  eq('3b transcriptie draagt de bron-discriminatoren letterlijk', {
    durationTypes: [...new Set(taskRows.map(row => row.split('\t')[7]))],
    remTargetLink: text.includes('\tplan_end_date\trem_target_link_flag\n%R\tP\t09-completed-successor\tMONFRI\t2026-01-05 00:00\t2025-12-01 08:00\t\tY'),
    targetStarts: [...new Set(taskRows.map(row => row.split('\t')[12]))],
    targetEnds: [...new Set(taskRows.map(row => row.split('\t')[13]))],
  }, {
    durationTypes: ['DT_FixedDrtn'],
    remTargetLink: true,
    targetStarts: ['2025-12-01 08:00'],
    targetEnds: [''],
  });
}

const summary = Object.fromEntries(CASES.map(item => {
  const rows = Object.values(agreement[item.id]!);
  const cells = rows.flatMap(row => Object.values(row)).filter(value => value !== null);
  return [item.id, { cellen: cells.length, eens: cells.filter(Boolean).length }];
}));
eq('4 agreement met P6 23.12 per casus (karakterisering, geen doel)', summary, {
  '01-fs-chain': { cellen: 18, eens: 18 },
  '02-ss-with-lag': { cellen: 12, eens: 12 },
  '03-ff-with-lag': { cellen: 12, eens: 12 },
  '04-sf-edge-case': { cellen: 12, eens: 12 },
  '05-negative-float': { cellen: 12, eens: 12 },
  '06-multiple-calendars': { cellen: 12, eens: 12 },
  '07-ontario-holidays': { cellen: 6, eens: 6 },
  '08-in-progress-retained-logic': { cellen: 12, eens: 12 },
  '09-completed-successor': { cellen: 10, eens: 10 },
  '10-out-of-sequence-progress': { cellen: 12, eens: 12 },
  '11-mandatory-start-finish': { cellen: 12, eens: 12 },
  '12-snet-fnlt': { cellen: 12, eens: 12 },
  '13-alap': { cellen: 18, eens: 18 },
});

{
  eq('5 precies deze P6-cellen zijn een werkelijke datum (" A") en gaan tegen de getoonde datum',
    actualCells, ACTUAL_CELLS_PIN);
  const deviating = Object.fromEntries(Object.entries(agreement).map(([id, rows]) => [
    id,
    Object.fromEntries(Object.entries(rows).map(([code, axes]) => [
      code, Object.entries(axes).filter(([, value]) => value === false).map(([axis]) => axis),
    ]).filter(([, axes]) => (axes as string[]).length > 0)),
  ]).filter(([, rows]) => Object.keys(rows).length > 0));
  eq('5 geen enkele cel wijkt af van P6 23.12', deviating, DEVIATING_CELLS_PIN);
  const case10 = solveCase(CASES.find(item => item.id === '10-out-of-sequence-progress')!).measured;
  eq('5a casus 10: onze A is nu gelijk aan P6 (LS 2026-01-12T08:00, LF 2026-01-23T17:00, TF 0)',
    { ls: case10.get('A')!.ls, lf: case10.get('A')!.lf, tf: case10.get('A')!.tf },
    { ls: '2026-01-12T08:00', lf: '2026-01-23T17:00', tf: 0 });
  eq('5b casus 10: B rekent ES/LS op de reststart, toont de werkelijke start (P6: 2026-01-08T08:00 A)',
    { es: case10.get('B')!.es, ls: case10.get('B')!.ls, shownStart: case10.get('B')!.shownStart },
    { ...CASE_10_B_PIN, shownStart: '2026-01-08T08:00' });
  const case08 = solveCase(CASES.find(item => item.id === '08-in-progress-retained-logic')!).measured;
  eq('5c casus 08: de rekendatums van A en B (A rekent op de reststart)', {
    A: { es: case08.get('A')!.es, ef: case08.get('A')!.ef, ls: case08.get('A')!.ls, lf: case08.get('A')!.lf, tf: case08.get('A')!.tf, ff: case08.get('A')!.ff },
    B: { es: case08.get('B')!.es, ef: case08.get('B')!.ef, ls: case08.get('B')!.ls, lf: case08.get('B')!.lf, tf: case08.get('B')!.tf, ff: case08.get('B')!.ff },
  }, CASE_08_PIN);
  eq('5d casus 08: A toont de werkelijke start (P6: 2026-01-06T08:00 A)',
    case08.get('A')!.shownStart, '2026-01-06T08:00');
}

{
  const explicit = process.env.OPS_P6_COMPARISON;
  const fromCorpus = process.env.OPS_XER_CORPUS
    ? join(process.env.OPS_XER_CORPUS, 'cpp-cpm-engine', 'validation', 'p6-comparison')
    : undefined;
  const root = [explicit, fromCorpus].find(candidate =>
    candidate !== undefined && existsSync(join(candidate, 'cases')));
  if (!root) {
    console.log('OK  p6-verified-cases-engine: bron niet aanwezig (OPS_P6_COMPARISON/OPS_XER_CORPUS)'
      + ' — transcriptiepariteit overgeslagen');
  } else {
    const normalized = CASES.map(item => ({
      id: item.id,
      opts: { dataDate: item.dataDate, projectStart: item.projectStart, cal_map: item.calendars },
      activities: item.activities,
      relationships: item.relationships,
    }));
    const fromSource = CASES.map(item => {
      const raw = JSON.parse(
        readFileSync(join(root, 'cases', item.id, 'input.json'), 'utf-8'),
      ) as {
        activities: Array<Record<string, unknown>>;
        relationships: Array<Record<string, unknown>>;
        opts: {
          dataDate: string;
          projectStart: string;
          cal_map: Record<string, { work_days: number[]; holidays: string[] }>;
        };
      };
      return {
        id: item.id,
        opts: {
          dataDate: raw.opts.dataDate,
          projectStart: raw.opts.projectStart,
          cal_map: Object.fromEntries(Object.entries(raw.opts.cal_map).map(([id, calendar]) => [
            id,
            calendar.holidays.length > 0
              ? { workDays: calendar.work_days, holidays: calendar.holidays }
              : { workDays: calendar.work_days },
          ])),
        },
        activities: raw.activities.map(activity => ({
          code: activity.code as string,
          durationDays: activity.duration_days as number,
          calendar: activity.clndr_id as string,
          ...(activity.actual_start ? { actualStart: activity.actual_start as string } : {}),
          ...(activity.actual_finish ? { actualFinish: activity.actual_finish as string } : {}),
          ...(activity.remaining_duration !== undefined
            ? { remainingDuration: activity.remaining_duration as number } : {}),
          ...(activity.constraint ? { constraint: activity.constraint } : {}),
          ...(activity.constraint2 ? { constraint2: activity.constraint2 } : {}),
        })),
        relationships: raw.relationships.map(relation => ({
          from: relation.from_code as string,
          to: relation.to_code as string,
          type: relation.type as RelType,
          lagDays: relation.lag_days as number,
        })),
      };
    });
    eq('6 de handmatige invoertranscriptie is veld voor veld gelijk aan de publieke bron',
      normalized, fromSource);
  }
}

{
  const corpus = process.env.OPS_XER_CORPUS;
  const real = corpus ? join(corpus, 'cpp-cpm-engine', 'validation', 'p6-comparison', 'cases-import.xer') : undefined;
  if (!real || !existsSync(real)) {
    console.log('OK  p6-verified-cases-engine: cases-import.xer niet aanwezig (OPS_XER_CORPUS) — echte-bytes-run overgeslagen');
  } else {
    const opened = readXER(new Uint8Array(readFileSync(real)));
    const results = isMultiDocumentImport(opened) ? opened.results : [opened];
    eq('7 de echte export draagt dertien projecten', results.length, 13);
    const agreeReal = (overrides?: Partial<ProjectSchedulingOptions>) => {
      let cells = 0; let eens = 0;
      const perCase: Record<string, string> = {};
      for (const [index, item] of CASES.entries()) {
        const imported = results.find(candidate => candidate.project.name === `XV${String(index + 1).padStart(2, '0')}`)
          ?? results[index]!;
        const schedulingOptions = effectiveSchedulingOptions({
          schedulingProfile: imported.project.schedulingProfile,
          schedulingOptions: { ...imported.project.schedulingOptions, ...overrides },
        });
        const result = solveProject({
          tasks: imported.tasks, sequences: imported.sequences, calendar: imported.calendar,
          calendars: imported.resourceCalendars ?? [], dataDate: imported.project.statusDate,
          progressMode: imported.project.progressMode, schedulingOptions,
          projectStartDate: imported.project.startDate, projectEndDate: imported.project.endDate,
        });
        if (result.error) throw new Error(`${item.id} (echt): ${result.error}`);
        const oracleCase = oracle.cases.find(entry => entry.id === item.id)!;
        let caseCells = 0; let caseEens = 0;
        for (const row of oracleCase.activities) {
          const task = imported.tasks.find(candidate => candidate.wbsCode === row.activity_code);
          const solved = task ? result.tasks.get(task.id) : undefined;
          if (!task || !solved) throw new Error(`${item.id} (echt): activiteit ${row.activity_code} niet gesolved`);
          const ours = measure(task, solved);
          for (const axis of AXES) {
            const raw = row[`${axis.toUpperCase()}_p6`]!;
            const want = axis === 'tf' || axis === 'ff' ? p6Number(raw) : p6Instant(raw);
            if (want === null) continue;
            caseCells++;
            if (oursForCell(ours, axis, raw) === want) caseEens++;
          }
        }
        cells += caseCells; eens += caseEens;
        perCase[item.id] = `${caseEens}/${caseCells}`;
      }
      return { cells, eens, perCase };
    };
    const asRead = agreeReal();
    const withoutProjectEndFloat = agreeReal({ useProjectEndDateForFloat: false });
    eq('7a echte bytes, zoals gelezen (projecteinde-fout dicht sinds X12-brok 1)',
      { cellen: asRead.cells, eens: asRead.eens }, REAL_AS_READ_PIN);
    eq('7b echte bytes, met useProjectEndDateForFloat uit (het gat is precies die fout)',
      { cellen: withoutProjectEndFloat.cells, eens: withoutProjectEndFloat.eens }, REAL_WITHOUT_PROJECT_END_PIN);
    console.log(`.   p6-verified-cases-engine: echte bytes per casus zoals gelezen ${JSON.stringify(asRead.perCase)}`);
    console.log(`.   p6-verified-cases-engine: echte bytes per casus zonder projecteinde-float ${JSON.stringify(withoutProjectEndFloat.perCase)}`);
    const projectEnd = results[0]!.project.endDate;
    eq('7c de bron heeft geen enkel einde (plan_end_date en target_end_date leeg) ⇒ de optie staat uit (het projecteinde-veld stuurt de late pass niet meer)',
      { start: results[0]!.project.startDate, end: projectEnd, flag: results[0]!.project.schedulingOptions?.useProjectEndDateForFloat },
      REAL_PROJECT_RANGE_PIN);
  }
}

if (diffs.length > 0) {
  console.error(`P6 VERIFIED CASES ENGINE RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`P6 VERIFIED CASES ENGINE GREEN: ${checks} checks groen`);
