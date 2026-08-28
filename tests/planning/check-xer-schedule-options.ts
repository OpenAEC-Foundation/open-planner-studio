import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { createDefaultProject } from '@/state/defaults';
import {
  deriveXerScheduleOptions as deriveIndexedXerScheduleOptions,
  indexXerScheduleOptions,
  XER_SCHEDOPTIONS_COLUMN_DISPOSITIONS,
  XER_SCHEDULING_DEFAULTS,
} from '@/services/xer/xerScheduleOptions';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { parseXerTables } from '@/services/xer/xerTables';
import type { WorkCalendar } from '@/types/calendar';
import type { Sequence } from '@/types/sequence';
import type { Task } from '@/types/task';
import { createDefaultTaskTime } from '@/utils/taskDefaults';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function deriveXerScheduleOptions(
  tables: ReturnType<typeof parseXerTables>,
  projectId: string,
  context: { hoursPerDay?: number; taskCount?: number } = {},
) {
  return deriveIndexedXerScheduleOptions(indexXerScheduleOptions(tables), projectId, context);
}

function legacyResult(result: ReturnType<typeof deriveIndexedXerScheduleOptions>) {
  const { sourceArchive: _archive, sourceRowIndexes: _indexes, diagnostics: _diagnostics, ...legacy } = result;
  return legacy;
}

const predecessorCalendar: WorkCalendar = {
  id: 'pred',
  name: 'pred',
  description: '',
  workDays: [1, 2, 3, 4, 5],
  workStartHour: 8,
  workEndHour: 16,
  hoursPerDay: 8,
  holidays: [],
};

const successorCalendar: WorkCalendar = {
  ...predecessorCalendar,
  id: 'succ',
  name: 'succ',
  workDays: [1, 2, 3, 4, 5, 6],
};

function task(id: string, duration: number, calendarId: string): Task {
  return {
    id,
    name: id,
    description: '',
    wbsCode: '',
    taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED',
    isMilestone: false,
    priority: 500,
    parentId: null,
    childIds: [],
    time: createDefaultTaskTime('2026-06-01', duration),
    resourceIds: [],
    calendarId,
  };
}

const P6_DAY_BANDS = [{ start: 480, end: 720 }, { start: 780, end: 1020 }];

function p6Calendar(id: string, workDays: number[]): WorkCalendar {
  return {
    id,
    name: id,
    description: '',
    workDays,
    workStartHour: 8,
    workEndHour: 17,
    hoursPerDay: 8,
    holidays: [],
    workTime: {
      byWeekday: {
        1: workDays.includes(1) ? P6_DAY_BANDS : [],
        2: workDays.includes(2) ? P6_DAY_BANDS : [],
        3: workDays.includes(3) ? P6_DAY_BANDS : [],
        4: workDays.includes(4) ? P6_DAY_BANDS : [],
        5: workDays.includes(5) ? P6_DAY_BANDS : [],
        6: workDays.includes(6) ? P6_DAY_BANDS : [],
        7: workDays.includes(7) ? P6_DAY_BANDS : [],
      },
    },
  };
}

function p6Task(id: string, durationDays: number, calendarId: string, start: string): Task {
  const result = task(id, durationDays, calendarId);
  result.time = createDefaultTaskTime(start, durationDays);
  result.time.durationMinutes = durationDays * 8 * 60;
  return result;
}

function axes(result: ReturnType<CPMSolver['solve']>, id: string): unknown {
  const value = result.tasks.get(id);
  return value && {
    es: value.earlyStart,
    ef: value.earlyFinish,
    ls: value.lateStart,
    lf: value.lateFinish,
    tf: value.totalFloat,
    ff: value.freeFloat,
  };
}

const tasks = [task('P', 4, 'pred'), task('S', 1, 'succ')];
const sequences: Sequence[] = [{
  id: 'R',
  predecessorId: 'P',
  successorId: 'S',
  type: 'FINISH_START',
  lagDays: 1,
}];

const successorLag = new CPMSolver(
  tasks,
  sequences,
  predecessorCalendar,
  [successorCalendar],
  { schedulingOptions: { lagCalendar: 'successor' } },
).solve();

eq(
  'successor-lag gebruikt de zesdaagse opvolgerkalender',
  successorLag.tasks.get('S')?.earlyStart,
  '2026-06-06',
);

const predLagCalendar: WorkCalendar = {
  ...predecessorCalendar,
  id: 'lag-pred',
  name: 'lag-pred',
  holidays: [
    { name: 'x', startDate: '2026-06-02', endDate: '2026-06-03' },
  ],
};
const succLagCalendar: WorkCalendar = {
  ...predecessorCalendar,
  id: 'lag-succ',
  name: 'lag-succ',
  holidays: [{ name: 'x', startDate: '2026-06-02', endDate: '2026-06-02' }],
};
const projectLagCalendar: WorkCalendar = {
  ...predecessorCalendar,
  id: 'lag-project',
  name: 'lag-project',
  holidays: [{ name: 'x', startDate: '2026-06-02', endDate: '2026-06-04' }],
};
const lagTasks = [task('LP', 1, 'lag-pred'), task('LS', 1, 'lag-succ')];
const lagSequences: Sequence[] = [{
  id: 'LR',
  predecessorId: 'LP',
  successorId: 'LS',
  type: 'START_START',
  lagDays: 3,
}];
function solveLag(lagCalendar: 'predecessor' | 'successor' | 'projectDefault' | '24hour'): string | undefined {
  return new CPMSolver(
    lagTasks,
    lagSequences,
    projectLagCalendar,
    [predLagCalendar, succLagCalendar],
    { schedulingOptions: { lagCalendar } },
  ).solve().tasks.get('LS')?.earlyStart;
}
eq('vier lagkalenders kiezen ieder hun eigen bron', {
  predecessor: solveLag('predecessor'),
  successor: solveLag('successor'),
  projectDefault: solveLag('projectDefault'),
  '24hour': solveLag('24hour'),
}, {
  predecessor: '2026-06-08',
  successor: '2026-06-05',
  projectDefault: '2026-06-09',
  '24hour': '2026-06-04',
});

const elapsedTail = task('ELAPSED-END', 10, 'lag-project');
const elapsedTasks = [...lagTasks, elapsedTail];
const elapsedSequence: Sequence[] = [{
  ...lagSequences[0],
  id: 'ELAPSED-R',
  lagUnit: 'ELAPSEDTIME',
}];
function solveElapsedLag(lagCalendar: 'predecessor' | 'successor' | 'projectDefault' | '24hour'): unknown {
  const result = new CPMSolver(
    elapsedTasks,
    elapsedSequence,
    projectLagCalendar,
    [predLagCalendar, succLagCalendar],
    { schedulingOptions: { lagCalendar } },
  ).solve();
  return axes(result, 'LP');
}
const elapsedPredecessor = solveElapsedLag('predecessor');
eq('ELAPSEDTIME-lag is onafhankelijk van de gekozen werkkalender', {
  predecessor: elapsedPredecessor,
  successor: solveElapsedLag('successor'),
  projectDefault: solveElapsedLag('projectDefault'),
  '24hour': solveElapsedLag('24hour'),
}, {
  predecessor: elapsedPredecessor,
  successor: elapsedPredecessor,
  projectDefault: elapsedPredecessor,
  '24hour': elapsedPredecessor,
});

const crossModePredCalendar: WorkCalendar = {
  ...predLagCalendar,
  id: 'cross-pred',
  name: 'cross-pred',
};
const crossModeSuccCalendar: WorkCalendar = {
  ...p6Calendar('cross-succ', [1, 2, 3, 4, 5, 6]),
  holidays: [{ name: 'x', startDate: '2026-06-03', endDate: '2026-06-03' }],
};
const crossModeProjectCalendar: WorkCalendar = {
  ...projectLagCalendar,
  id: 'cross-project',
  name: 'cross-project',
};
const crossModeTasks = [
  task('CROSS-P', 2, 'cross-pred'),
  p6Task('CROSS-S', 1, 'cross-succ', '2026-06-01'),
];
const crossModeSequences: Sequence[] = [{
  id: 'CROSS-R',
  predecessorId: 'CROSS-P',
  successorId: 'CROSS-S',
  type: 'FINISH_START',
  lagDays: 0,
  lagMinutes: 8 * 60,
}];
function solveCrossModeLag(
  lagCalendar: 'predecessor' | 'successor' | 'projectDefault' | '24hour',
): unknown {
  const result = new CPMSolver(
    crossModeTasks,
    crossModeSequences,
    crossModeProjectCalendar,
    [crossModePredCalendar, crossModeSuccCalendar],
    { schedulingOptions: { lagCalendar } },
  ).solve();
  return {
    predecessor: axes(result, 'CROSS-P'),
    successor: axes(result, 'CROSS-S'),
  };
}
for (const lagCalendar of ['predecessor', 'successor', 'projectDefault', '24hour'] as const) {
  const solved = solveCrossModeLag(lagCalendar) as {
    predecessor: { es: string; ef: string; ls: string; lf: string; tf: number; ff: number };
    successor: { es: string; ef: string; ls: string; lf: string; tf: number; ff: number };
  };
  eq(`cross-modus ${lagCalendar}: forward/backward blijven elkaars inverse`, {
    predecessor: {
      ls: solved.predecessor.ls,
      lf: solved.predecessor.lf,
      tf: solved.predecessor.tf,
    },
    successor: {
      ls: solved.successor.ls,
      lf: solved.successor.lf,
      tf: solved.successor.tf,
    },
  }, {
    predecessor: {
      ls: solved.predecessor.es,
      lf: solved.predecessor.ef,
      tf: 0,
    },
    successor: {
      ls: solved.successor.es,
      lf: solved.successor.ef,
      tf: 0,
    },
  });
}

const endProjectCalendar: WorkCalendar = {
  ...predecessorCalendar,
  id: 'end-project',
  name: 'end-project',
};
const sixDayCalendar: WorkCalendar = {
  ...predecessorCalendar,
  id: 'six-day',
  name: 'six-day',
  workDays: [1, 2, 3, 4, 5, 6],
};
const endTasks = [task('LONG', 6, 'six-day'), task('SHORT', 1, 'end-project')];
const ordinaryEnd = new CPMSolver(endTasks, [], endProjectCalendar, [sixDayCalendar]).solve();
eq('één project gebruikt één gemeenschappelijk projecteinde zonder taakkalender-snap',
  ordinaryEnd.tasks.get('SHORT')?.lateFinish, '2026-06-06');

function sourceWithoutXerFloatValue(options?: {
  resumeFromActualElapsed?: boolean;
  unstartedIgnoresStatusDate?: boolean;
}): unknown {
  return [...new CPMSolver(
    endTasks,
    [],
    endProjectCalendar,
    [sixDayCalendar],
    { schedulingOptions: options },
  ).solve().tasks];
}
eq('afwezige XER-floatbron houdt verse/MPP/MSPDI/P6XML-uitvoer byte-identiek', {
  fresh: sourceWithoutXerFloatValue(createDefaultProject().schedulingOptions),
  mpp: sourceWithoutXerFloatValue({
    resumeFromActualElapsed: true,
    unstartedIgnoresStatusDate: true,
  }),
  mspdi: sourceWithoutXerFloatValue(undefined),
  p6xml: sourceWithoutXerFloatValue(undefined),
}, {
  fresh: [...ordinaryEnd.tasks],
  mpp: [...ordinaryEnd.tasks],
  mspdi: [...ordinaryEnd.tasks],
  p6xml: [...ordinaryEnd.tasks],
});

const explicitInertEnd = new CPMSolver(
  endTasks,
  [],
  endProjectCalendar,
  [sixDayCalendar],
  {
    schedulingOptions: {
      useExpectedFinishDates: false,
      preserveActualDatesInBackwardPass: false,
      clampNegativeFreeFloat: false,
    },
  },
).solve();
eq('expliciet uitgeschakelde XER-bronvlaggen laten niet-XER-solvergedrag byte-identiek',
  [...explicitInertEnd.tasks], [...ordinaryEnd.tasks]);
eq('een vers OPS-project krijgt geen stille XER-defaults',
  createDefaultProject().schedulingOptions, undefined);

// Drie onafhankelijk in P6 geverifieerde brongevallen. Alleen taak-/kalenderinvoer gaat de solver
// in: de orakeldatums worden uitsluitend hieronder als verwachtingen gebruikt.
const p6MonFri = p6Calendar('p6-monfri', [1, 2, 3, 4, 5]);
const p6SixDay = p6Calendar('p6-sixday', [1, 2, 3, 4, 5, 6]);
const p6MultiCalendar = new CPMSolver(
  [
    p6Task('A', 10, 'p6-monfri', '2026-01-05T08:00'),
    p6Task('B', 10, 'p6-sixday', '2026-01-05T08:00'),
  ],
  [],
  p6MonFri,
  [p6SixDay],
  { schedulingOptions: { totalFloatMode: 'finish' } },
).solve();
eq('P6-geval 06: meerdere kalenders, alle zes datum-/floatassen', {
  A: axes(p6MultiCalendar, 'A'),
  B: axes(p6MultiCalendar, 'B'),
}, {
  A: { es: '2026-01-05T08:00', ef: '2026-01-16T17:00', ls: '2026-01-05T08:00', lf: '2026-01-16T17:00', tf: 0, ff: 0 },
  B: { es: '2026-01-05T08:00', ef: '2026-01-15T17:00', ls: '2026-01-06T08:00', lf: '2026-01-16T17:00', tf: 1, ff: 1 },
});

const retainedA = p6Task('A', 10, 'p6-monfri', '2026-01-05T08:00');
retainedA.time.actualStart = '2026-01-06T08:00';
retainedA.time.completion = 0.3;
retainedA.time.remainingMinutes = 7 * 8 * 60;
const p6Retained = new CPMSolver(
  [retainedA, p6Task('B', 5, 'p6-monfri', '2026-01-05T08:00')],
  [{ id: 'P6-08-R', predecessorId: 'A', successorId: 'B', type: 'FINISH_START', lagDays: 0 }],
  p6MonFri,
  [],
  {
    dataDate: '2026-01-12',
    progressMode: 'RETAINED_LOGIC',
    schedulingOptions: { totalFloatMode: 'finish', preserveActualDatesInBackwardPass: true },
  },
).solve();
eq('P6-geval 08: retained logic plant restwerk vanaf de statusdatum', {
  A: axes(p6Retained, 'A'),
  B: axes(p6Retained, 'B'),
}, {
  A: { es: '2026-01-06T08:00', ef: '2026-01-20T17:00', ls: '2026-01-06T08:00', lf: '2026-01-20T17:00', tf: 0, ff: 0 },
  B: { es: '2026-01-21T08:00', ef: '2026-01-27T17:00', ls: '2026-01-21T08:00', lf: '2026-01-27T17:00', tf: 0, ff: 0 },
});

const completedB = p6Task('B', 11, 'p6-monfri', '2025-12-15T08:00');
completedB.time.actualStart = '2025-12-15T08:00';
completedB.time.actualFinish = '2025-12-30T17:00';
completedB.time.completion = 1;
const p6CompletedSuccessor = new CPMSolver(
  [completedB, p6Task('A', 5, 'p6-monfri', '2026-01-05T08:00')],
  [{ id: 'P6-09-R', predecessorId: 'A', successorId: 'B', type: 'FINISH_START', lagDays: 0 }],
  p6MonFri,
  [],
  {
    dataDate: '2026-01-05',
    progressMode: 'RETAINED_LOGIC',
    projectStartDate: '2025-12-01',
    schedulingOptions: { totalFloatMode: 'finish', preserveActualDatesInBackwardPass: true },
  },
).solve();
eq('P6-geval 09: voltooide opvolger trekt de voorganger niet historisch terug', {
  A: axes(p6CompletedSuccessor, 'A'),
  B: axes(p6CompletedSuccessor, 'B'),
}, {
  A: { es: '2026-01-05T08:00', ef: '2026-01-09T17:00', ls: '2026-01-05T08:00', lf: '2026-01-09T17:00', tf: 0, ff: 0 },
  B: { es: '2025-12-15T08:00', ef: '2025-12-30T17:00', ls: '2025-12-15T08:00', lf: '2025-12-30T17:00', tf: 0, ff: 0 },
});

const negativeA = p6Task('A', 8, 'p6-monfri', '2026-01-05T08:00');
const negativeB = p6Task('B', 4, 'p6-monfri', '2026-01-05T08:00');
negativeB.constraint = { type: 'FNLT', date: '2026-01-12T08:00' };
const p6NegativeFloat = new CPMSolver(
  [negativeA, negativeB],
  [{ id: 'P6-05-R', predecessorId: 'A', successorId: 'B', type: 'FINISH_START', lagDays: 0 }],
  p6MonFri,
  [],
  {
    dataDate: '2026-01-05T08:00',
    progressMode: 'RETAINED_LOGIC',
    projectStartDate: '2026-01-05T08:00',
    schedulingOptions: { totalFloatMode: 'finish', clampNegativeFreeFloat: true },
  },
).solve();
eq('P6-geval 05: finish-float bewaart de negatieve float op beide ketentaken', {
  A: axes(p6NegativeFloat, 'A'),
  B: axes(p6NegativeFloat, 'B'),
}, {
  A: { es: '2026-01-05T08:00', ef: '2026-01-14T17:00', ls: '2025-12-25T08:00', lf: '2026-01-05T17:00', tf: -7, ff: 0 },
  B: { es: '2026-01-15T08:00', ef: '2026-01-20T17:00', ls: '2026-01-06T08:00', lf: '2026-01-09T17:00', tf: -7, ff: 0 },
});

const completedPred = task('CP', 5, 'pred');
completedPred.time.actualStart = '2026-06-01';
completedPred.time.actualFinish = '2026-06-05';
completedPred.time.completion = 1;
const outOfSequenceSucc = task('IP', 2, 'pred');
outOfSequenceSucc.time.actualStart = '2026-06-01';
outOfSequenceSucc.time.completion = 0.5;
outOfSequenceSucc.time.remainingTime = 1;
const completedFloat = new CPMSolver(
  [completedPred, outOfSequenceSucc],
  [{ id: 'CP-IP', predecessorId: 'CP', successorId: 'IP', type: 'FINISH_START', lagDays: 0 }],
  predecessorCalendar,
  [],
  {
    dataDate: '2026-06-01',
    progressMode: 'RETAINED_LOGIC',
    schedulingOptions: { preserveActualDatesInBackwardPass: true },
  },
).solve().tasks.get('CP');
eq('P6-voltooide activiteit rapporteert geen float, ook niet bij out-of-sequence-actuals', {
  tf: completedFloat?.totalFloat,
  ff: completedFloat?.freeFloat,
}, { tf: 0, ff: 0 });

const running = p6Task('RUNNING', 4, 'p6-monfri', '2026-07-06T08:00');
running.status = 'STARTED';
running.time.completion = 0.5;
running.time.actualStart = '2026-07-06T08:00';
const runningDriver = p6Task('RUNNING-DRIVER', 10, 'p6-monfri', '2026-07-06T08:00');
function solveRunningFloat(mode: 'start' | 'finish' | 'smallest'): unknown {
  const solved = new CPMSolver(
    [running, runningDriver],
    [],
    p6MonFri,
    [],
    {
      dataDate: '2026-07-08',
      progressMode: 'RETAINED_LOGIC',
      schedulingOptions: { totalFloatMode: mode, preserveActualDatesInBackwardPass: true },
    },
  ).solve().tasks.get('RUNNING');
  return solved && {
    earlyStart: solved.earlyStart,
    lateStart: solved.lateStart,
    earlyFinish: solved.earlyFinish,
    lateFinish: solved.lateFinish,
    totalFloat: solved.totalFloat,
  };
}
eq('lopende taak gebruikt per expliciete modus echt LS-ES, LF-EF of de kleinste', {
  start: solveRunningFloat('start'),
  finish: solveRunningFloat('finish'),
  smallest: solveRunningFloat('smallest'),
}, {
  start: {
    earlyStart: '2026-07-06T08:00',
    lateStart: '2026-07-06T08:00',
    earlyFinish: '2026-07-09T17:00',
    lateFinish: '2026-07-21T17:00',
    totalFloat: 0,
  },
  finish: {
    earlyStart: '2026-07-06T08:00',
    lateStart: '2026-07-06T08:00',
    earlyFinish: '2026-07-09T17:00',
    lateFinish: '2026-07-21T17:00',
    totalFloat: 8,
  },
  smallest: {
    earlyStart: '2026-07-06T08:00',
    lateStart: '2026-07-06T08:00',
    earlyFinish: '2026-07-09T17:00',
    lateFinish: '2026-07-21T17:00',
    totalFloat: 0,
  },
});

function xer(projectFields: readonly string[], projectValues: readonly string[], schedule?: {
  fields: readonly string[];
  values: readonly string[];
}): Uint8Array {
  const lines = [
    'ERMHDR\t23.12\t2026-06-01\t\t\t\t\t\tEUR',
    '%T\tPROJECT',
    `%F\t${projectFields.join('\t')}`,
    `%R\t${projectValues.join('\t')}`,
  ];
  if (schedule) {
    lines.push(
      '%T\tSCHEDOPTIONS',
      `%F\t${schedule.fields.join('\t')}`,
      `%R\t${schedule.values.join('\t')}`,
    );
  }
  lines.push('%E');
  return new TextEncoder().encode(lines.join('\n'));
}

function projectEndSource(value: 'Y' | 'N') {
  return deriveXerScheduleOptions(parseXerTables(xer(
    ['proj_id'],
    ['P1'],
    {
      fields: ['proj_id', 'sched_use_project_end_date_for_float'],
      values: ['P1', value],
    },
  )), 'P1');
}
const projectEndTrue = projectEndSource('Y');
const projectEndFalse = projectEndSource('N');
eq('projecteindevlag blijft expliciet als TODO-bronwaarde bewaard', {
  trueValue: projectEndTrue.retainedSource,
  falseValue: projectEndFalse.retainedSource,
  disposition: XER_SCHEDOPTIONS_COLUMN_DISPOSITIONS.find(
    item => item.field === 'sched_use_project_end_date_for_float',
  ),
}, {
  trueValue: { sched_use_project_end_date_for_float: true },
  falseValue: { sched_use_project_end_date_for_float: false },
  disposition: {
    field: 'sched_use_project_end_date_for_float',
    status: 'todo',
    reason: 'Meerdere gelijktijdig geplande projecten ontbreken; X5 bewaart de bronwaarde zonder solversturing.',
  },
});
const projectEndTrueSolve = new CPMSolver(
  endTasks,
  [],
  endProjectCalendar,
  [sixDayCalendar],
  { schedulingOptions: projectEndTrue.schedulingOptions },
).solve();
const projectEndFalseSolve = new CPMSolver(
  endTasks,
  [],
  endProjectCalendar,
  [sixDayCalendar],
  { schedulingOptions: projectEndFalse.schedulingOptions },
).solve();
eq('projecteindevlag true/false verandert binnen één project geen enkele taakdatum', {
  trueResult: [...projectEndTrueSolve.tasks],
  falseResult: [...projectEndFalseSolve.tasks],
}, {
  trueResult: [...ordinaryEnd.tasks],
  falseResult: [...ordinaryEnd.tasks],
});

const withoutTable = deriveXerScheduleOptions(parseXerTables(xer(
  ['proj_id', 'critical_path_type', 'critical_drtn_hr_cnt'],
  ['P1', 'CT_TotFloat', '16'],
)), 'P1', { hoursPerDay: 8, taskCount: 9 });

const hostileIndex = indexXerScheduleOptions(parseXerTables(new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-08-25\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tcritical_path_type\tcritical_drtn_hr_cnt',
  '%R\tP1\tCT_TotFloat\t8',
  '%R\tP2\tCT_TotFloat\t0',
  '%T\tSCHEDOPTIONS',
  '%F\tproj_id\tsched_float_type\tsched_retained_logic\tsched_progress_override',
  '%R\tP1\tFT_SS\tN\tY',
  '%R\tP1\tFT_FF\tY\tN',
  '%R\tORPHAN\tFT_MIN\tN\tY',
  '%E',
].join('\n'))));
const duplicateResult = deriveIndexedXerScheduleOptions(hostileIndex, 'P1');
const unaffectedResult = deriveIndexedXerScheduleOptions(hostileIndex, 'P2');
eq('hostile bronarchief bewaart iedere raw rij eenmaal en diagnosticeert duplicate/unmatched', {
  rows: hostileIndex.sourceArchive.rows.map(row => [row.table, row.line, row.cells.proj_id]),
  unmatched: hostileIndex.sourceArchive.unmatchedScheduleOptionsRowIndexes,
  duplicates: hostileIndex.sourceArchive.diagnostics,
  duplicateSource: duplicateResult.source,
  duplicateOptions: duplicateResult.schedulingOptions,
  duplicateDiagnostics: duplicateResult.diagnostics,
  unaffectedSource: unaffectedResult.source,
}, {
  rows: [
    ['PROJECT', 4, 'P1'],
    ['PROJECT', 5, 'P2'],
    ['SCHEDOPTIONS', 8, 'P1'],
    ['SCHEDOPTIONS', 9, 'P1'],
    ['SCHEDOPTIONS', 10, 'ORPHAN'],
  ],
  unmatched: [4],
  duplicates: [{
    code: 'XER_DUPLICATE_SCHEDOPTIONS_PROJ_ID',
    projectId: 'P1',
    rowIndexes: [2, 3],
    lines: [8, 9],
  }],
  duplicateSource: 'xer-defaults',
  duplicateOptions: {
    lagCalendar: 'predecessor',
    criticalDefinition: { mode: 'totalFloat', thresholdHours: 8 },
    totalFloatMode: 'finish',
    makeOpenEndedCritical: false,
    useExpectedFinishDates: true,
    preserveActualDatesInBackwardPass: true,
    clampNegativeFreeFloat: true,
  },
  duplicateDiagnostics: [{
    code: 'XER_DUPLICATE_SCHEDOPTIONS_PROJ_ID',
    projectId: 'P1',
    rowIndexes: [2, 3],
    lines: [8, 9],
  }],
  unaffectedSource: 'xer-defaults',
});

const LINEAR_PROJECTS = 4_000;
const linearProjectRows = Array.from({ length: LINEAR_PROJECTS }, (_, index) =>
  `%R\tP${index}\tCT_TotFloat\t${index % 9}`).join('\n');
const linearScheduleRows = Array.from({ length: LINEAR_PROJECTS }, (_, index) =>
  `%R\tP${index}\t${index % 2 === 0 ? 'FT_SS' : 'FT_FF'}`).join('\n');
// X6 maakt parserrijen terecht immutable. Deze instrumentatietest meet uitsluitend property-reads
// en krijgt daarom een lokale, mutable meetkopie — nooit de runtime-bron die readers delen.
const linearTables = structuredClone(parseXerTables(new TextEncoder().encode([
  'ERMHDR\t23.12\t2026-08-25\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tcritical_path_type\tcritical_drtn_hr_cnt',
  linearProjectRows,
  '%T\tSCHEDOPTIONS',
  '%F\tproj_id\tsched_float_type',
  linearScheduleRows,
  '%E',
].join('\n'))));
let projIdReads = 0;
for (const tableName of ['PROJECT', 'SCHEDOPTIONS']) {
  for (const row of linearTables.tables.get(tableName)?.rows ?? []) {
    const value = row.cells.proj_id;
    Object.defineProperty(row.cells, 'proj_id', {
      enumerable: true,
      get: () => { projIdReads++; return value; },
    });
  }
}
const linearIndex = indexXerScheduleOptions(linearTables);
let deriveArchiveProjectIdReads = 0;
for (const row of linearIndex.sourceArchive.rows) {
  const value = row.cells.proj_id;
  Object.defineProperty(row.cells, 'proj_id', {
    enumerable: true,
    get: () => { deriveArchiveProjectIdReads++; return value; },
  });
}
for (let index = 0; index < LINEAR_PROJECTS; index++) {
  deriveIndexedXerScheduleOptions(linearIndex, `P${index}`);
}
eq('PROJECT en SCHEDOPTIONS worden eenmaal lineair geïndexeerd; afleiding is O(1)',
  { indexProjectIdReads: projIdReads, deriveArchiveProjectIdReads },
  { indexProjectIdReads: LINEAR_PROJECTS * 2, deriveArchiveProjectIdReads: 0 });

eq('expliciete XER-defaultset is brongebonden en compleet', legacyResult(withoutTable), {
  source: 'xer-defaults',
  progressMode: 'RETAINED_LOGIC',
  schedulingOptions: {
    lagCalendar: 'predecessor',
    criticalDefinition: { mode: 'totalFloat', thresholdHours: 16 },
    totalFloatMode: 'finish',
    makeOpenEndedCritical: false,
    useExpectedFinishDates: true,
    preserveActualDatesInBackwardPass: true,
    clampNegativeFreeFloat: true,
  },
  retainedSource: {},
  fallbacks: [],
  sourceRows: [{
    table: 'PROJECT',
    line: 4,
    cells: {
      proj_id: 'P1',
      critical_path_type: 'CT_TotFloat',
      critical_drtn_hr_cnt: '16',
    },
  }],
});
eq('geexporteerde defaults blijven de ongewijzigde nul-drempel leveren', XER_SCHEDULING_DEFAULTS, {
  progressMode: 'RETAINED_LOGIC',
  schedulingOptions: {
    lagCalendar: 'predecessor',
    criticalDefinition: { mode: 'totalFloat', thresholdHours: 0 },
    totalFloatMode: 'finish',
    makeOpenEndedCritical: false,
    useExpectedFinishDates: true,
    preserveActualDatesInBackwardPass: true,
    clampNegativeFreeFloat: true,
  },
});
eq('default 1/8: finish-float', XER_SCHEDULING_DEFAULTS.schedulingOptions.totalFloatMode, 'finish');
eq('default 2/8: retained logic', XER_SCHEDULING_DEFAULTS.progressMode, 'RETAINED_LOGIC');
eq('default 3/8: kritiek op totale float met nul uur als P6-bronwaarde',
  XER_SCHEDULING_DEFAULTS.schedulingOptions.criticalDefinition,
  { mode: 'totalFloat', thresholdHours: 0 });
eq('default 4/8: open eindes niet automatisch kritiek',
  XER_SCHEDULING_DEFAULTS.schedulingOptions.makeOpenEndedCritical, false);
eq('default 5/8: relatielag op de voorgangerskalender',
  XER_SCHEDULING_DEFAULTS.schedulingOptions.lagCalendar, 'predecessor');
eq('default 6/8: verwachte einddatums als bewaard bronbeleid (solverconsumptie volgt in X7)',
  XER_SCHEDULING_DEFAULTS.schedulingOptions.useExpectedFinishDates, true);
eq('default 7/8: P6-actuals blijven feiten in de backward-pass',
  XER_SCHEDULING_DEFAULTS.schedulingOptions.preserveActualDatesInBackwardPass, true);
eq('default 8/8: P6-vrije-float wordt niet negatief',
  XER_SCHEDULING_DEFAULTS.schedulingOptions.clampNegativeFreeFloat, true);

const fourHourBands = [{ start: 480, end: 720 }];
const fourHourCalendar: WorkCalendar = {
  ...p6Calendar('p6-four-hour', [1, 2, 3, 4, 5]),
  workEndHour: 12,
  hoursPerDay: 4,
  workTime: {
    byWeekday: {
      1: fourHourBands,
      2: fourHourBands,
      3: fourHourBands,
      4: fourHourBands,
      5: fourHourBands,
      6: [],
      7: [],
    },
  },
};
const thresholdTask = p6Task('THRESHOLD-4H', 1, fourHourCalendar.id, '2026-01-05T08:00');
thresholdTask.time.durationMinutes = 4 * 60;
const thresholdDriver = p6Task('THRESHOLD-DRIVER', 3, p6MonFri.id, '2026-01-05T08:00');
const thresholdSource = deriveXerScheduleOptions(parseXerTables(xer(
  ['proj_id', 'critical_path_type', 'critical_drtn_hr_cnt'],
  ['P1', 'CT_TotFloat', '8'],
)), 'P1', { hoursPerDay: 8, taskCount: 2 });
const thresholdSolve = new CPMSolver(
  [thresholdDriver, thresholdTask],
  [],
  p6MonFri,
  [fourHourCalendar],
  { schedulingOptions: thresholdSource.schedulingOptions },
).solve().tasks.get(thresholdTask.id);
eq('P6-drempeluren vergelijken tegen floaturen van de effectieve 4h-taakkalender', {
  mapped: thresholdSource.schedulingOptions.criticalDefinition,
  totalFloatTaskDays: thresholdSolve?.totalFloat,
  totalFloatHours: thresholdSolve && thresholdSolve.totalFloat * fourHourCalendar.hoursPerDay,
  isCritical: thresholdSolve?.isCritical,
}, {
  mapped: { mode: 'totalFloat', thresholdHours: 8 },
  totalFloatTaskDays: 2,
  totalFloatHours: 8,
  isCritical: true,
});

const defaultLagSolve = new CPMSolver(
  lagTasks,
  lagSequences,
  projectLagCalendar,
  [predLagCalendar, succLagCalendar],
  {
    progressMode: withoutTable.progressMode,
    schedulingOptions: withoutTable.schedulingOptions,
  },
).solve();
eq('XER-default gebruikt aantoonbaar de voorgangerskalender in een multi-kalendernet',
  defaultLagSolve.tasks.get('LS')?.earlyStart, '2026-06-08');

const mapped = deriveXerScheduleOptions(parseXerTables(xer(
  ['proj_id', 'critical_path_type', 'critical_drtn_hr_cnt'],
  ['P1', 'ct_drivpath', '0'],
  {
    fields: [
      'proj_id',
      'sched_calendar_on_relationship_lag',
      'sched_float_type',
      'sched_retained_logic',
      'sched_progress_override',
      'sched_open_critical_flag',
      'sched_use_project_end_date_for_float',
      'sched_use_expect_end_flag',
      'enable_multiple_longest_path_calc',
      'use_total_float',
      'limit_multiple_longest_path_calc',
      'max_multiple_longest_path',
    ],
    values: ['P1', 'RCAL_SUCCESSOR', 'ft_ss', 'N', 'y', 'Y', 'n', 'N', 'Y', 'Y', 'Y', '3'],
  },
)), 'P1', { hoursPerDay: 8, taskCount: 9 });

eq('bekende enums en vlaggen worden case-insensitief naar bestaande opties gemapt', legacyResult(mapped), {
  source: 'schedoptions',
  progressMode: 'PROGRESS_OVERRIDE',
  schedulingOptions: {
    lagCalendar: 'successor',
    criticalDefinition: { mode: 'longestPath' },
    totalFloatMode: 'start',
    makeOpenEndedCritical: true,
    useExpectedFinishDates: false,
    preserveActualDatesInBackwardPass: true,
    clampNegativeFreeFloat: true,
    floatPaths: { enabled: true, method: 'TOTAL_FLOAT', maxPaths: 3 },
  },
  retainedSource: { sched_use_project_end_date_for_float: false },
  fallbacks: [],
  sourceRows: [
    {
      table: 'PROJECT',
      line: 4,
      cells: {
        proj_id: 'P1',
        critical_path_type: 'ct_drivpath',
        critical_drtn_hr_cnt: '0',
      },
    },
    {
      table: 'SCHEDOPTIONS',
      line: 7,
      cells: {
        proj_id: 'P1',
        sched_calendar_on_relationship_lag: 'RCAL_SUCCESSOR',
        sched_float_type: 'ft_ss',
        sched_retained_logic: 'N',
        sched_progress_override: 'y',
        sched_open_critical_flag: 'Y',
        sched_use_project_end_date_for_float: 'n',
        sched_use_expect_end_flag: 'N',
        enable_multiple_longest_path_calc: 'Y',
        use_total_float: 'Y',
        limit_multiple_longest_path_calc: 'Y',
        max_multiple_longest_path: '3',
      },
    },
  ],
});

const mixedCaseLag = deriveXerScheduleOptions(parseXerTables(xer(
  ['proj_id'],
  ['P1'],
  {
    fields: ['proj_id', 'sched_calendar_on_relationship_lag'],
    values: ['P1', 'rcal_Successor'],
  },
)), 'P1');
eq('RCAL_SUCCESSOR en rcal_Successor zijn dezelfde bekende enumwaarde', {
  upper: mapped.schedulingOptions.lagCalendar,
  mixed: mixedCaseLag.schedulingOptions.lagCalendar,
  mixedFallbacks: mixedCaseLag.fallbacks,
}, {
  upper: 'successor',
  mixed: 'successor',
  mixedFallbacks: [],
});

const allLagTokens = Object.fromEntries([
  ['rcal_Predecessor', 'predecessor'],
  ['RCAL_SUCCESSOR', 'successor'],
  ['rcal_24Hour', '24hour'],
  ['RCAL_PROJDEFAULT', 'projectDefault'],
].map(([token, expected]) => {
  const result = deriveXerScheduleOptions(parseXerTables(xer(
    ['proj_id'],
    ['P1'],
    {
      fields: ['proj_id', 'sched_calendar_on_relationship_lag'],
      values: ['P1', token],
    },
  )), 'P1');
  return [token, { value: result.schedulingOptions.lagCalendar, fallbacks: result.fallbacks, expected }];
}));
eq('alle vier P6-lagkalendertokens worden case-insensitief zonder fallback gedecodeerd',
  allLagTokens, {
    rcal_Predecessor: { value: 'predecessor', fallbacks: [], expected: 'predecessor' },
    RCAL_SUCCESSOR: { value: 'successor', fallbacks: [], expected: 'successor' },
    rcal_24Hour: { value: '24hour', fallbacks: [], expected: '24hour' },
    RCAL_PROJDEFAULT: { value: 'projectDefault', fallbacks: [], expected: 'projectDefault' },
  });

const unknownFloat = deriveXerScheduleOptions(parseXerTables(xer(
  ['proj_id'],
  ['P1'],
  {
    fields: ['proj_id', 'sched_float_type'],
    values: ['P1', 'ST_TotalFloat'],
  },
)), 'P1');
eq('onbekend dialecttoken valt naar finish terug en wordt zichtbaar gerapporteerd', {
  totalFloatMode: unknownFloat.schedulingOptions.totalFloatMode,
  fallbacks: unknownFloat.fallbacks,
}, {
  totalFloatMode: 'finish',
  fallbacks: [{
    field: 'sched_float_type',
    token: 'ST_TotalFloat',
    fallback: 'finish',
    line: 7,
  }],
});

const actualDatesMode = deriveXerScheduleOptions(parseXerTables(xer(
  ['proj_id'],
  ['P1'],
  {
    fields: ['proj_id', 'sched_retained_logic', 'sched_progress_override'],
    values: ['P1', 'N', 'N'],
  },
)), 'P1');
eq('niet-ondersteunde P6 Actual Dates-modus valt nooit stil terug', {
  progressMode: actualDatesMode.progressMode,
  fallbacks: actualDatesMode.fallbacks,
}, {
  progressMode: 'RETAINED_LOGIC',
  fallbacks: [{
    field: 'sched_retained_logic/sched_progress_override',
    token: 'N/N',
    fallback: 'RETAINED_LOGIC',
    line: 7,
  }],
});

const ifcProject = {
  ...createDefaultProject(),
  id: 'P6-IFC',
  schedulingOptions: withoutTable.schedulingOptions,
};
const ifcRoundTrip = readIFC(writeIFC({
  project: ifcProject,
  calendar: predecessorCalendar,
  tasks: [],
  sequences: [],
  resources: [],
  assignments: [],
}));
eq('X5-bronvlaggen round-trippen verliesloos via OPS_SchedulingOptions in IFC',
  ifcRoundTrip.project.schedulingOptions, withoutTable.schedulingOptions);

const expectedColumns = [
  'enable_multiple_longest_path_calc',
  'key_activity_for_multiple_longest_paths',
  'level_all_rsrc_flag',
  'level_float_thrs_cnt',
  'level_keep_sched_date_flag',
  'level_outer_assign_flag',
  'level_outer_assign_priority',
  'level_over_alloc_pct',
  'level_within_float_flag',
  'levelprioritylist',
  'limit_multiple_longest_path_calc',
  'max_multiple_longest_path',
  'proj_id',
  'sched_calendar_on_relationship_lag',
  'sched_float_type',
  'sched_lag_early_start_flag',
  'sched_open_critical_flag',
  'sched_outer_depend_type',
  'sched_progress_override',
  'sched_retained_logic',
  'sched_setplantoforecast',
  'sched_use_expect_end_flag',
  'sched_use_project_end_date_for_float',
  'schedhash',
  'schedoptions_id',
  'use_total_float',
  'use_total_float_multiple_longest_paths',
] as const;
eq('iedere kolom uit de echte 27-kolommenunion heeft exact één bestemming',
  XER_SCHEDOPTIONS_COLUMN_DISPOSITIONS.map(item => item.field).sort(),
  [...expectedColumns].sort());
eq('iedere kolomstatus is gemapt, gemotiveerd genegeerd of expliciet TODO',
  XER_SCHEDOPTIONS_COLUMN_DISPOSITIONS.every(item =>
    item.status === 'mapped' || item.status === 'ignored' || item.status === 'todo'), true);
eq('genegeerde en TODO-kolommen hebben nooit een lege reden',
  XER_SCHEDOPTIONS_COLUMN_DISPOSITIONS
    .filter(item => item.status !== 'mapped')
    .every(item => item.reason.trim().length > 0), true);

if (diffs.length > 0) {
  console.error(`XER-SCHEDOPTIONS: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-SCHEDOPTIONS: ${checks} checks groen`);
