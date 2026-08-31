import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { XerGroundTruth, XerGroundTruthTask } from './xerGroundTruth';
import type { XerCorpusManifest, XerSolvedProject, XerSolvedTask } from './xerFidelity';
import { scanXerGroundTruth } from './xerGroundTruth';
import {
  evaluateXerTaskReplay,
  shouldRejectXerTaskReplay,
  type XerReplayPredicateLog,
} from './xerTaskReplay';
import {
  dropFinishMilestoneBoundaryCandidate,
  replayXerProductBeforeOracle,
  syntheticZeroRegressionCandidate,
} from './xerTaskReplayProduct';
import {
  corpusReplayExitCode,
  runXerTaskReplayCorpus,
  XER_TASK_REPLAY_MEMORY_MODEL,
} from './xerTaskReplayCorpus';

const diffs: string[] = [];
let checks = 0;
const planningDirectory = join(process.cwd(), 'tests', 'planning');

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const corpusRoot = process.env.OPS_XER_CORPUS;
if (!corpusRoot) {
  console.log('XER TASK REPLAY: publiek corpus niet aanwezig; permanente corpusloze fixtures uitgevoerd');
} else if (!existsSync(corpusRoot)) {
  diffs.push('OPS_XER_CORPUS wijst niet naar een bestaande corpusmap');
} else {
  const manifest = JSON.parse(readFileSync(join(planningDirectory, 'xer-corpus-manifest.json'), 'utf8')) as XerCorpusManifest;
  const pin = JSON.parse(readFileSync(join(planningDirectory, 'xer-task-replay-public-pin.json'), 'utf8')) as {
    version: number;
    manifestEntries: number;
    selectedEntries: number;
    projects: number;
    tasks: number;
    candidates: Record<string, {
      aggregate: ReturnType<typeof runXerTaskReplayCorpus>['aggregate'];
      rejected: boolean;
      exitCode: number;
      memoryModel: typeof XER_TASK_REPLAY_MEMORY_MODEL;
    }>;
  };
  eq('task replay: openbare instrumentpin heeft schema 1', pin.version, 1);
  for (const candidate of [syntheticZeroRegressionCandidate, dropFinishMilestoneBoundaryCandidate]) {
    const summary = runXerTaskReplayCorpus({ corpusRoot, manifest, candidate });
    eq(`task replay: openbare pin voor ${candidate.id}`, {
      manifestEntries: summary.manifestEntries,
      selectedEntries: summary.selectedEntries,
      projects: summary.projects,
      tasks: summary.tasks,
      aggregate: summary.aggregate,
      rejected: summary.rejected,
      exitCode: corpusReplayExitCode(summary),
      memoryModel: summary.memoryModel,
    }, {
      manifestEntries: pin.manifestEntries,
      selectedEntries: pin.selectedEntries,
      projects: pin.projects,
      tasks: pin.tasks,
      ...pin.candidates[candidate.id],
    });
  }
}

function throws(label: string, run: () => unknown, pattern: RegExp): void {
  checks++;
  try {
    run();
    diffs.push(`${label}: verwacht harde fout ${pattern}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!pattern.test(message)) diffs.push(`${label}: onverwachte fout ${JSON.stringify(message)}`);
  }
}

const axes = (overrides: Partial<XerGroundTruthTask['axes']> = {}): XerGroundTruthTask['axes'] => ({
  es: '2026-01-05T08:00',
  ef: '2026-01-05T16:00',
  ls: '2026-01-05T08:00',
  lf: '2026-01-05T16:00',
  tf: 0,
  ff: 0,
  ...overrides,
});

eq(
  'task replay: productcounterfactual start altijd vanaf een verse source/importclone',
  dropFinishMilestoneBoundaryCandidate.replayFrom,
  'source',
);
eq(
  'task replay: geheugenmodel blijft structureel één manifestentry en één solveclone tegelijk',
  XER_TASK_REPLAY_MEMORY_MODEL,
  'one-manifest-entry-and-one-project-solve-clone-at-a-time',
);

function truth(projectId = 'P1', taskCode = 'A100'): XerGroundTruth {
  return {
    encoding: 'utf-8',
    projects: new Set([projectId]),
    tasks: [{
      projectId,
      taskId: 'T1',
      taskCode,
      statusCode: 'TK_NotStart',
      axes: axes(),
      rawDateSeconds: { es: null, ef: null, ls: null, lf: null },
      drivingPath: null,
      presentAxes: { es: true, ef: true, ls: true, lf: true, tf: true, ff: true },
    }],
    errors: [],
    numberFormatIssues: [],
    precision: {
      dateSecondCells: { es: 0, ef: 0, ls: 0, lf: 0 },
      dateNonZeroSubminuteCells: { es: 0, ef: 0, ls: 0, lf: 0 },
      floatFractionalMinuteCells: { tf: 0, ff: 0 },
    },
  };
}

{
  const fixture = (poisonedOracle: boolean) => new TextEncoder().encode([
    'ERMHDR\t23.12\t2026-04-01\t\t\t\t\t\tEUR',
    '%T\tCALENDAR',
    '%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tStandard 5x8\tCA_Base\t8\t40\t',
    '%T\tPROJECT',
    '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date\tplan_start_date',
    '%R\tP\tReplayfixture\tC1\t2026-04-01 08:00\t2026-04-01 08:00',
    '%T\tTASK',
    '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tduration_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt',
    `%R\t1\tP\tC1\tA100\tVoorganger\tTT_Task\tDT_FixedDUR\tTK_NotStart\t8\t8\t2026-04-01 08:00\t2026-04-01 17:00\t${poisonedOracle ? '2099-01-01 23:59\t2099-01-02 23:59\t2099-01-03 23:59\t2099-01-04 23:59\t999\t998' : '2026-04-01 08:00\t2026-04-01 17:00\t2026-04-01 08:00\t2026-04-01 17:00\t0\t0'}`,
    `%R\t2\tP\tC1\tA200\tContracteinde\tTT_FinMile\tDT_FixedDUR\tTK_NotStart\t0\t0\t2026-04-02 08:01\t2026-04-02 08:01\t${poisonedOracle ? '2099-02-01 23:59\t2099-02-02 23:59\t2099-02-03 23:59\t2099-02-04 23:59\t997\t996' : '2026-04-02 08:00\t2026-04-01 17:00\t2026-04-02 08:00\t2026-04-01 17:00\t0\t8'}`,
    `%R\t3\tP\tC1\tA300\tLater projecteinde\tTT_FinMile\tDT_FixedDUR\tTK_NotStart\t0\t0\t2026-04-10 08:01\t2026-04-10 08:01\t${poisonedOracle ? '2099-03-01 23:59\t2099-03-02 23:59\t2099-03-03 23:59\t2099-03-04 23:59\t995\t994' : '2026-04-10 08:00\t2026-04-09 17:00\t2026-04-10 08:00\t2026-04-09 17:00\t0\t0'}`,
    '%T\tTASKPRED',
    '%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
    '%R\tR1\t2\t1\tP\tP\tPR_FS\t0',
    '%E',
  ].join('\n'));
  const normalBytes = fixture(false);
  const poisonedBytes = fixture(true);
  const lifecycle: Array<{
    projectId: string;
    phase: 'baseline' | 'counterfactual';
    inputOrigin: 'fresh-source-clone' | 'baseline-solved-clone';
    activeSolveClones: number;
  }> = [];
  replayXerProductBeforeOracle(normalBytes, dropFinishMilestoneBoundaryCandidate, {
    onLifecycleEvent: event => lifecycle.push(event),
  });
  eq('task replay: finish-boundary counterfactual blijft lifecycle-vers vanaf bronimport', lifecycle, [
    { projectId: 'P', phase: 'baseline', inputOrigin: 'fresh-source-clone', activeSolveClones: 1 },
    { projectId: 'P', phase: 'counterfactual', inputOrigin: 'fresh-source-clone', activeSolveClones: 1 },
  ]);
  const normalProduct = replayXerProductBeforeOracle(normalBytes, dropFinishMilestoneBoundaryCandidate);
  const poisonedProduct = replayXerProductBeforeOracle(poisonedBytes, dropFinishMilestoneBoundaryCandidate);
  eq('task replay: raw oracle kan echte predicate en beide solverroutes niet beïnvloeden', {
    predicate: poisonedProduct.predicate,
    baseline: poisonedProduct.baseline,
    counterfactual: poisonedProduct.counterfactual,
  }, {
    predicate: normalProduct.predicate,
    baseline: normalProduct.baseline,
    counterfactual: normalProduct.counterfactual,
  });

  const zero = replayXerProductBeforeOracle(normalBytes, syntheticZeroRegressionCandidate);
  const zeroResult = evaluateXerTaskReplay({
    oracle: scanXerGroundTruth(normalBytes),
    baseline: zero.baseline,
    counterfactual: zero.counterfactual,
    predicate: zero.predicate,
  });
  eq('task replay: synthetische nul-regressiecandidate blijft op alle assen onveranderd', {
    aggregate: zeroResult.aggregate,
    rejected: shouldRejectXerTaskReplay(zeroResult),
    sequentialSolves: zero.projectsSolvedSequentially,
  }, {
    aggregate: {
      es: { improved: 0, regressed: 0, unchanged: 3 },
      ef: { improved: 0, regressed: 0, unchanged: 3 },
      ls: { improved: 0, regressed: 0, unchanged: 3 },
      lf: { improved: 0, regressed: 0, unchanged: 3 },
      tf: { improved: 0, regressed: 0, unchanged: 3 },
      ff: { improved: 0, regressed: 0, unchanged: 3 },
      overall: { improved: 0, regressed: 0, unchanged: 3 },
    },
    rejected: false,
    sequentialSolves: 2,
  });
}

function solved(projectId = 'P1', taskCode = 'A100', overrides: Partial<XerSolvedTask> = {}): XerSolvedProject {
  return {
    projectId,
    tasks: [{
      sourceTaskId: 'T1',
      taskCode,
      earlyStart: '2026-01-06T08:00',
      earlyFinish: '2026-01-06T16:00',
      lateStart: '2026-01-05T08:00',
      lateFinish: '2026-01-05T16:00',
      totalFloatMinutes: 0,
      freeFloatMinutes: 0,
      ...overrides,
    }],
  };
}

const predicate: XerReplayPredicateLog[] = [{
  projectId: 'P1', taskCode: 'A100', matched: true, source: { activityType: 'TT_FinMile' },
}];

{
  const result = evaluateXerTaskReplay({
    oracle: truth(),
    baseline: [solved()],
    counterfactual: [solved('P1', 'A100', {
      earlyStart: '2026-01-05T08:00', earlyFinish: '2026-01-05T16:00',
    })],
    predicate,
  });
  eq('task replay: ES/EF kunnen verbeteren zonder nevenas te veranderen', result.tasks[0]?.axes, {
    es: { oracle: '2026-01-05T08:00', baseline: '2026-01-06T08:00', counterfactual: '2026-01-05T08:00', classification: 'improved' },
    ef: { oracle: '2026-01-05T16:00', baseline: '2026-01-06T16:00', counterfactual: '2026-01-05T16:00', classification: 'improved' },
    ls: { oracle: '2026-01-05T08:00', baseline: '2026-01-05T08:00', counterfactual: '2026-01-05T08:00', classification: 'unchanged' },
    lf: { oracle: '2026-01-05T16:00', baseline: '2026-01-05T16:00', counterfactual: '2026-01-05T16:00', classification: 'unchanged' },
    tf: { oracle: 0, baseline: 0, counterfactual: 0, classification: 'unchanged' },
    ff: { oracle: 0, baseline: 0, counterfactual: 0, classification: 'unchanged' },
  });
  eq('task replay: nul regressies blijft groen', {
    aggregate: result.aggregate,
    rejected: shouldRejectXerTaskReplay(result),
  }, {
    aggregate: {
      es: { improved: 1, regressed: 0, unchanged: 0 },
      ef: { improved: 1, regressed: 0, unchanged: 0 },
      ls: { improved: 0, regressed: 0, unchanged: 1 },
      lf: { improved: 0, regressed: 0, unchanged: 1 },
      tf: { improved: 0, regressed: 0, unchanged: 1 },
      ff: { improved: 0, regressed: 0, unchanged: 1 },
      overall: { improved: 1, regressed: 0, unchanged: 0 },
    },
    rejected: false,
  });
}

{
  const result = evaluateXerTaskReplay({
    oracle: truth(),
    baseline: [solved()],
    counterfactual: [solved('P1', 'A100', {
      earlyStart: '2026-01-05T08:00',
      lateStart: '2026-01-06T08:00',
      totalFloatMinutes: 480,
    })],
    predicate,
  });
  eq('task replay: ES-winst met LS/TF-regressie wordt afgewezen', {
    classifications: {
      es: result.tasks[0]?.axes.es.classification,
      ls: result.tasks[0]?.axes.ls.classification,
      tf: result.tasks[0]?.axes.tf.classification,
      overall: result.tasks[0]?.overall,
    },
    rejected: shouldRejectXerTaskReplay(result),
  }, {
    classifications: { es: 'improved', ls: 'regressed', tf: 'regressed', overall: 'regressed' },
    rejected: true,
  });
}

{
  const baseline = [solved()];
  const counterfactual = [solved('P1', 'A100', { earlyStart: '2026-01-05T08:00' })];
  const first = evaluateXerTaskReplay({ oracle: truth(), baseline, counterfactual, predicate });
  const poisonedOracle = truth();
  poisonedOracle.tasks[0]!.axes = axes({ es: '2099-12-31T23:59', tf: 999999 });
  const second = evaluateXerTaskReplay({ oracle: poisonedOracle, baseline, counterfactual, predicate });
  eq('task replay: raw oracle kan predicate of solverroute niet beïnvloeden', {
    firstPredicate: first.predicate,
    secondPredicate: second.predicate,
    baselineSame: first.tasks[0]?.axes.es.baseline === second.tasks[0]?.axes.es.baseline,
    counterfactualSame: first.tasks[0]?.axes.es.counterfactual === second.tasks[0]?.axes.es.counterfactual,
  }, {
    firstPredicate: predicate,
    secondPredicate: predicate,
    baselineSame: true,
    counterfactualSame: true,
  });
}

{
  const base = solved();
  const cf = solved();
  throws('task replay: ontbrekend project is hard rood', () => evaluateXerTaskReplay({
    oracle: truth(), baseline: [], counterfactual: [cf], predicate,
  }), /ontbrekend baselineproject P1/);
  throws('task replay: extra project is hard rood', () => evaluateXerTaskReplay({
    oracle: truth(), baseline: [base, solved('P2')], counterfactual: [cf], predicate,
  }), /extra baselineproject P2/);
  throws('task replay: dubbel project is hard rood', () => evaluateXerTaskReplay({
    oracle: truth(), baseline: [base, base], counterfactual: [cf], predicate,
  }), /dubbel baselineproject P1/);
  throws('task replay: dubbel counterfactualproject is hard rood', () => evaluateXerTaskReplay({
    oracle: truth(), baseline: [base], counterfactual: [cf, cf], predicate,
  }), /dubbel counterfactualproject P1/);
  throws('task replay: ontbrekende taakcode is hard rood', () => evaluateXerTaskReplay({
    oracle: truth(), baseline: [base], counterfactual: [{ projectId: 'P1', tasks: [] }], predicate,
  }), /ontbrekende counterfactualtaak P1\/A100/);
  throws('task replay: extra taakcode is hard rood', () => evaluateXerTaskReplay({
    oracle: truth(), baseline: [{ ...base, tasks: [...base.tasks, { ...base.tasks[0]!, sourceTaskId: 'T2', taskCode: 'A200' }] }],
    counterfactual: [cf], predicate,
  }), /extra baselinetaak P1\/A200/);
  throws('task replay: dubbele taakcode is hard rood', () => evaluateXerTaskReplay({
    oracle: truth(), baseline: [{ ...base, tasks: [...base.tasks, base.tasks[0]!] }], counterfactual: [cf], predicate,
  }), /dubbele baselinetaak P1\/A100/);
  throws('task replay: verkeerde baseline sourceTaskId is hard rood bij gelijke projectId en taskCode', () => evaluateXerTaskReplay({
    oracle: truth(),
    baseline: [solved('P1', 'A100', { sourceTaskId: 'VERKEERD' })],
    counterfactual: [cf],
    predicate,
  }), /baseline bron-taak-id voor P1\/A100 verwacht T1, kreeg VERKEERD/);
  throws('task replay: verkeerde counterfactual sourceTaskId is hard rood bij gelijke projectId en taskCode', () => evaluateXerTaskReplay({
    oracle: truth(),
    baseline: [base],
    counterfactual: [solved('P1', 'A100', { sourceTaskId: 'VERKEERD' })],
    predicate,
  }), /counterfactual bron-taak-id voor P1\/A100 verwacht T1, kreeg VERKEERD/);
  throws('task replay: ontbrekende predicate-identiteit is hard rood', () => evaluateXerTaskReplay({
    oracle: truth(), baseline: [base], counterfactual: [cf], predicate: [],
  }), /ontbrekende predicate P1\/A100/);
  throws('task replay: extra predicate-identiteit is hard rood', () => evaluateXerTaskReplay({
    oracle: truth(), baseline: [base], counterfactual: [cf],
    predicate: [...predicate, { projectId: 'P1', taskCode: 'A200', matched: false, source: {} }],
  }), /extra predicate P1\/A200/);
  throws('task replay: dubbele predicate-identiteit is hard rood', () => evaluateXerTaskReplay({
    oracle: truth(), baseline: [base], counterfactual: [cf], predicate: [...predicate, ...predicate],
  }), /dubbele predicate P1\/A100/);
}

if (diffs.length > 0) {
  console.error(`XER TASK REPLAY RED: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX ${diff}`);
  process.exit(1);
}
console.log(`XER TASK REPLAY GREEN: ${checks} checks groen`);
