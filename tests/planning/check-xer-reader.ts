import { readXER, type XerReadResult } from '@/services/xer/xerReader';
import { XerImportError } from '@/services/xer/xerTables';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function ok(label: string, value: unknown): void {
  eq(label, Boolean(value), true);
}

function bytes(lines: readonly string[]): Uint8Array {
  return new TextEncoder().encode(lines.join('\n'));
}

function read(lines: readonly string[]): XerReadResult {
  return readXER(bytes(lines));
}

const fixture = [
  'ERMHDR\t23.12\t2026-04-01\t\t\t\t\t\tEUR',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tDagploeg\tP1\tCA_Project\t8\t40\t',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tdef_duration_type\tplan_start_date\tplan_end_date',
  '%R\tP1\tBrugrenovatie\tC1\t2026-04-02 09:30\tdt_fixeddur2\t2099-01-01 00:00\t2099-12-31 00:00',
  '%T\tPROJWBS',
  '%F\twbs_id\tproj_id\tparent_wbs_id\tseq_num\twbs_short_name\twbs_name',
  '%R\tW-CHILD\tP1\tW-ROOT\t20\t1.1\tOnderbouw',
  '%R\tW-ROOT\tP1\t\t10\t1\tBrug',
  '%R\tW-SIB\tP1\tW-ROOT\t30\t1.2\tBovenbouw',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\tpriority_type\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tcstr_type\tcstr_date\tcstr_type2\tcstr_date2\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\tplan_start_date\tplan_end_date',
  '%R\tT1\tP1\tW-CHILD\tC1\tA100\tStartsein\ttt_mile\tDT_FixedDUR2\ttk_notstart\tPT_Normal\t0\t0\t0\t2026-04-06 08:00\t2026-04-06 08:00\t\t\t\t\t\t\t2099-01-01 00:00\t2099-01-02 00:00\t2099-01-03 00:00\t2099-01-04 00:00\t2099-01-05 00:00\t2099-01-06 00:00',
  '%R\tT2\tP1\tW-CHILD\tC1\tA200\tFundering\tTT_LOE\tDT_FixedDrtn\tTK_Active\tPT_High\t25\t16\t12\t2026-04-06 08:00\t2026-04-07 16:00\t2026-04-06 08:00\t\tCS_MANSTART\t2026-04-06 08:00\tCS_MEOB\t2026-04-08 16:00\t2099-02-01 00:00\t2099-02-02 00:00\t2099-02-03 00:00\t2099-02-04 00:00\t2099-02-05 00:00\t2099-02-06 00:00',
  '%R\tT3\tP1\tW-SIB\tC1\tA300\tLigger\tTT_Rsrc\tDT_FixedQty\tTK_Complete\tPT_Top\t100\t8\t0\t2026-04-08 08:00\t2026-04-08 16:00\t2026-04-08 08:00\t2026-04-08 16:00\tCS_MANFINISH\t2026-04-08 16:00\t\t\t2099-03-01 00:00\t2099-03-02 00:00\t2099-03-03 00:00\t2099-03-04 00:00\t2099-03-05 00:00\t2099-03-06 00:00',
  '%R\tT4\tP1\tW-SIB\tC1\tA400\tControle\tTT_WBS\tDT_FixedRate\tTK_NotStart\tPT_Normal\t0\t8\t8\t2026-04-09 08:00\t2026-04-09 16:00\t\t\tCS_MSOA\t2026-04-09 08:00\tCS_MEOA\t2026-04-10 08:00\t2099-04-01 00:00\t2099-04-02 00:00\t2099-04-03 00:00\t2099-04-04 00:00\t2099-04-05 00:00\t2099-04-06 00:00',
  '%R\tT5\tP1\tW-SIB\tC1\tA500\tOnbekende bronwaarden\tTT_Alien\tDT_Alien\tTK_Alien\tPT_Alien\t0\t8\t8\t2026-04-10 08:00\t2026-04-10 16:00\t\t\tCS_Alien\t2026-04-10 08:00\t\t\t2099-05-01 00:00\t2099-05-02 00:00\t2099-05-03 00:00\t2099-05-04 00:00\t2099-05-05 00:00\t2099-05-06 00:00',
  '%T\tTASKPRED',
  '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  '%R\tR1\tT2\tT1\tP1\tP1\tPR_FS\t1.5',
  '%R\tR2\tT3\tT2\tP1\tP1\tss\t-2',
  '%R\tR3\tT4\tT3\tP1\tP1\tPR_FF\t0',
  '%R\tR4\tT5\tT4\tP1\tP1\tPR_SF\t0.25',
  '%R\tR5\tT5\tEXT-7\tP1\tP-EXT\tFS\t4',
  '%E',
] as const;

const result = read(fixture);
eq('1 PROJECT-identiteit, statusdatum, projectkalender en header-valuta', {
  id: result.project.id,
  name: result.project.name,
  statusDate: result.project.statusDate,
  calendarId: result.project.calendarId,
  currency: result.xer.defaultCurrencyCode,
}, {
  id: 'P1',
  name: 'Brugrenovatie',
  statusDate: '2026-04-02T09:30',
  calendarId: 'C1',
  currency: 'EUR',
});
eq('2 projectdatumbereik komt uit input-TASK-velden, nooit uit PROJECT plan/output', {
  start: result.project.startDate,
  end: result.project.endDate,
}, { start: '2026-04-06T08:00', end: '2026-04-10T16:00' });
eq('3 PROJECT-kalender blijft de hoofdkalender', {
  id: result.calendar.id,
  hourMode: result.calendar.workTime !== undefined,
}, { id: 'C1', hourMode: true });

const byId = new Map(result.tasks.map(task => [task.id, task]));
eq('4 WBS-rijen worden exact één samenvattingstaak, vóór activiteiten en stabiel gesorteerd',
  result.tasks.slice(0, 3).map(task => ({ id: task.id, parent: task.parentId, children: task.childIds })),
  [
    { id: 'xer-wbs:P1:W-ROOT', parent: null, children: ['xer-wbs:P1:W-CHILD', 'xer-wbs:P1:W-SIB'] },
    { id: 'xer-wbs:P1:W-CHILD', parent: 'xer-wbs:P1:W-ROOT', children: ['T1', 'T2'] },
    { id: 'xer-wbs:P1:W-SIB', parent: 'xer-wbs:P1:W-ROOT', children: ['T3', 'T4', 'T5'] },
  ]);
eq('5 er ontstaan geen extra fidelity-bladtaken voor WBS', {
  total: result.tasks.length,
  activities: result.tasks.filter(task => task.p6ActivityType !== undefined).length,
  summaries: result.tasks.filter(task => task.id.startsWith('xer-wbs:')).length,
}, { total: 8, activities: 5, summaries: 3 });
eq('6 bekende activity/duration enums zijn case-insensitief en canoniek bewaard', [
  [byId.get('T1')?.p6ActivityType, byId.get('T1')?.p6DurationType],
  [byId.get('T2')?.p6ActivityType, byId.get('T2')?.p6DurationType],
], [['TT_Mile', 'DT_FixedDUR2'], ['TT_LOE', 'DT_FixedDrtn']]);
eq('7 activity type leidt alleen de afgesproken operationele vlaggen af', {
  startMilestone: [byId.get('T1')?.isMilestone, byId.get('T1')?.milestoneKind],
  loe: byId.get('T2')?.isHammock,
  resourceDependent: byId.get('T3')?.p6ActivityType,
  wbsActivity: byId.get('T4')?.p6ActivityType,
}, {
  startMilestone: [true, 'START'],
  loe: true,
  resourceDependent: 'TT_Rsrc',
  wbsActivity: 'TT_WBS',
});
eq('8 onbekende tokens vallen gedocumenteerd terug en worden per veld gerapporteerd', {
  activity: byId.get('T5')?.p6ActivityType,
  duration: byId.get('T5')?.p6DurationType,
  status: byId.get('T5')?.status,
  priority: byId.get('T5')?.priority,
  fallbacks: result.xer.enumFallbacks.map(item => [item.family, item.token, item.fallback]),
}, {
  activity: 'TT_Task',
  duration: 'DT_FixedDUR2',
  status: 'NOT_STARTED',
  priority: 500,
  fallbacks: [
    ['activityType', 'TT_Alien', 'TT_Task'],
    ['durationType', 'DT_Alien', 'DT_FixedDUR2'],
    ['status', 'TK_Alien', 'NOT_STARTED'],
    ['priority', 'PT_Alien', '500'],
    ['constraint', 'CS_Alien', 'ASAP'],
  ],
});
eq('9 P6-status, completion, actuals en bronduur worden zonder X7-semantiek gelezen', {
  t2: [byId.get('T2')?.status, byId.get('T2')?.time.completion, byId.get('T2')?.time.actualStart,
    byId.get('T2')?.time.durationMinutes, byId.get('T2')?.time.remainingMinutes],
  t3: [byId.get('T3')?.status, byId.get('T3')?.time.completion, byId.get('T3')?.time.actualFinish],
}, {
  t2: ['STARTED', 0.25, '2026-04-06T08:00', 960, 720],
  t3: ['COMPLETED', 1, '2026-04-08T16:00'],
});
eq('10 productielezer negeert P6-output- en planvelden', {
  t2Start: byId.get('T2')?.time.scheduleStart,
  t2Finish: byId.get('T2')?.time.scheduleFinish,
  t2Early: byId.get('T2')?.time.earlyStart,
  t2Late: byId.get('T2')?.time.lateFinish,
}, {
  t2Start: '2026-04-06T08:00',
  t2Finish: '2026-04-07T16:00',
  t2Early: '2026-04-06T08:00',
  t2Late: '2026-04-07T16:00',
});
eq('11 mandatory constraints zijn hard; secundaire constraints blijven soft', {
  t2: [byId.get('T2')?.constraint, byId.get('T2')?.constraint2],
  t3: byId.get('T3')?.constraint,
  t4: [byId.get('T4')?.constraint, byId.get('T4')?.constraint2],
}, {
  t2: [
    { type: 'MSO', date: '2026-04-06T08:00', hard: true },
    { type: 'FNLT', date: '2026-04-08T16:00' },
  ],
  t3: { type: 'MFO', date: '2026-04-08T16:00', hard: true },
  t4: [
    { type: 'SNET', date: '2026-04-09T08:00' },
    { type: 'FNET', date: '2026-04-10T08:00' },
  ],
});
eq('12 alle vier PR-relaties plus kale SS worden gemapt en lag blijft integer minuten',
  result.sequences.map(sequence => [sequence.id, sequence.type, sequence.lagMinutes]), [
    ['R1', 'FINISH_START', 90],
    ['R2', 'START_START', -120],
    ['R3', 'FINISH_FINISH', 0],
    ['R4', 'START_FINISH', 15],
  ]);
eq('13 externe relatie is uitsluitend brondata en geen solver-Sequence', {
  sequenceIds: result.sequences.map(sequence => sequence.id),
  external: result.xer.externalRelations,
}, {
  sequenceIds: ['R1', 'R2', 'R3', 'R4'],
  external: [{
    id: 'R5',
    localProjectId: 'P1',
    localTaskId: 'T5',
    externalProjectId: 'P-EXT',
    externalTaskId: 'EXT-7',
    direction: 'predecessor',
    type: 'FS',
    lagMinutes: 240,
  }],
});

function typedError(label: string, lines: readonly string[], code: string): void {
  let got = 'NO_ERROR';
  try {
    read(lines);
  } catch (error) {
    got = error instanceof XerImportError ? error.xerCode : String(error);
  }
  eq(label, got, code);
}

typedError('14 meer dan één PROJECT wordt begrensd geweigerd', [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tUSD',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name',
  '%R\tP1\tEen',
  '%R\tP2\tTwee',
  '%E',
], 'XER_SINGLE_PROJECT_REQUIRED');

typedError('15 project zonder TASK wordt expliciet geweigerd', [
  'ERMHDR\t23.12\t2026-01-01\t\t\t\t\t\tUSD',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name',
  '%R\tP1\tLeeg',
  '%E',
], 'XER_EMPTY_PROJECT');

ok('16 XER-resultaat levert lege resourcevelden binnen het gedeelde importcontract',
  result.resources.length === 0 && result.assignments.length === 0);

if (diffs.length > 0) {
  console.error(`XER-reader: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-reader: ${checks} corpusloze project/taak/WBS/relatie/constraint-checks`);
