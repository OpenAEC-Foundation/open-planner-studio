import { Buffer } from 'node:buffer';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildXerTargetBaseline,
  measureXerFidelity,
  validateXerBaselinePins,
} from './xerFidelity';
import { scanXerGroundTruth } from './xerGroundTruth';
import type { XerFidelityBaseline } from './xerFidelityTypes';

const diffs: string[] = [];
let checks = 0;
const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPORT = process.env.OPS_XER_FIDELITY_REPORT;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const header = [
  'proj_id', 'task_id', 'task_code', 'task_name', 'status_code',
  'act_start_date', 'act_end_date',
  'early_start_date', 'early_end_date', 'late_start_date', 'late_end_date',
  'total_float_hr_cnt', 'free_float_hr_cnt', 'driving_path_flag',
];
const fixture = [
  'ERMHDR\t8.4',
  '%T\tTASK',
  `%F\t${header.join('\t')}`,
  '%R\tP1\t1\tA\tAlpha\tTK_NotStart\t\t\t2026-01-05 08:00\t2026-01-05 17:00\t2026-01-06 08:00\t2026-01-06 17:00\t1.25\t0.5\tY',
  // Completed gebruikt de actuals voor alle vier datumassen. De Windows-1252-é dwingt de eigen
  // encodingfallback af; de latere productielezer of diens tokenizer komt hier niet aan te pas.
  '%R\tP2\t2\tB\tCaf\u00e9\tTK_Complete\t2026-02-02 09:15:30\t2026-02-03 16:45:00\t2099-01-01\t2099-01-02\t2099-01-03\t2099-01-04\t\t-0.125\tN',
  '%E',
].join('\r\n');
const bytes = Buffer.from(fixture, 'latin1');
const truth = scanXerGroundTruth(bytes);

// Breuken die dit vangt: delen van tokenizer/veldkaart met de productielezer, UTF-8-only decoderen,
// of completed-taken tegen de opgeslagen early/late-uitvoer meten in plaats van tegen actuals.
eq('1 scanner kiest Windows-1252 zelfstandig', truth.encoding, 'windows-1252');
eq('1a scanner leest beide projecten', [...truth.projects], ['P1', 'P2']);
eq('1b scanner leest taakidentiteit en zeven rapportageassen', truth.tasks[0], {
  projectId: 'P1',
  taskId: '1',
  taskCode: 'A',
  statusCode: 'TK_NotStart',
  axes: {
    es: '2026-01-05T08:00', ef: '2026-01-05T17:00',
    ls: '2026-01-06T08:00', lf: '2026-01-06T17:00',
    tf: 75, ff: 30,
  },
  drivingPath: true,
  storedAxes: { es: true, ef: true, ls: true, lf: true, tf: true, ff: true },
});
eq('1c completed gebruikt actuals en rondt fractionele float naar minuten', truth.tasks[1], {
  projectId: 'P2',
  taskId: '2',
  taskCode: 'B',
  statusCode: 'TK_Complete',
  axes: {
    es: '2026-02-02T09:15', ef: '2026-02-03T16:45',
    ls: '2026-02-02T09:15', lf: '2026-02-03T16:45',
    tf: null, ff: -7,
  },
  drivingPath: false,
  storedAxes: { es: true, ef: true, ls: true, lf: true, tf: false, ff: true },
});

const measured = measureXerFidelity(truth, [
  {
    projectId: 'P1',
    tasks: [{
      sourceTaskId: '1', taskCode: 'A',
      earlyStart: '2026-01-05T08:00', earlyFinish: '2026-01-05T17:00',
      lateStart: '2026-01-06T08:00', lateFinish: '2026-01-06T17:01',
      totalFloatMinutes: 75, freeFloatMinutes: 30, drivingPath: false,
    }],
  },
  {
    projectId: 'P2',
    tasks: [{
      sourceTaskId: '2', taskCode: 'B',
      earlyStart: '2026-02-02T09:15', earlyFinish: '2026-02-03T16:45',
      lateStart: '2026-02-02T09:15', lateFinish: '2026-02-03T16:45',
      totalFloatMinutes: 123, freeFloatMinutes: -7, drivingPath: false,
    }],
  },
]);

// Breuken die dit vangt: alles-of-niets-taaktelling over een multi-projectbestand, bestandssom die
// alleen het laatste project bevat, float in uren i.p.v. minuten, of driving path stil in de nulpoort.
eq('2 per-project meten en daarna per bestand optellen', measured.projects.map(project => ({
  projectId: project.projectId,
  tasks: project.tasks,
  lf: project.counters.lf,
})), [
  { projectId: 'P1', tasks: 1, lf: { deviations: 1, measurable: 1 } },
  { projectId: 'P2', tasks: 1, lf: { deviations: 0, measurable: 1 } },
]);
eq('2a bestandssom bewaart zes onafhankelijke tellerparen', measured.counters, {
  es: { deviations: 0, measurable: 2 },
  ef: { deviations: 0, measurable: 2 },
  ls: { deviations: 0, measurable: 2 },
  lf: { deviations: 1, measurable: 2 },
  tf: { deviations: 0, measurable: 1 },
  ff: { deviations: 0, measurable: 2 },
});
eq('2b driving path is zevende rapportage-as buiten counters', measured.drivingPath, {
  deviations: 1,
  measurable: 2,
});
eq('2c multi-projectbestand strandt niet op één globale taakuitlijning', measured.errors, []);

const byteDuplicate = Buffer.from(bytes);
const schemaDuplicate = Buffer.from(fixture.split('\r\n').join('\n'), 'latin1');
const noOracle = Buffer.from([
  '%T\tTASK',
  '%F\tproj_id\ttask_id\ttask_code\tstatus_code\tact_start_date\tact_end_date\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt\tdriving_path_flag',
  '%R\tP3\t3\tC\tTK_NotStart\t\t\t\t\t\t\t\t\t',
].join('\n'));
const built = buildXerTargetBaseline([
  { label: 'a/original.xer', bytes },
  { label: 'b/byte-copy.xer', bytes: byteDuplicate },
  { label: 'c/schema-copy.xer', bytes: schemaDuplicate },
  { label: 'd/no-oracle.xer', bytes: noOracle },
]);

// Breuken die dit vangt: alleen bytehash dedupliceren, schemahash op bestandsbytes baseren,
// niet-orakelbestanden laten meetellen of multi-projectcijfers niet per bestand sommeren.
eq('3 twee deduplagen laten één uniek orakelbestand over', built.stats, {
  scannedFiles: 4,
  byteUniqueFiles: 3,
  byteDuplicateFiles: 1,
  fourDateTasks: 6,
  sixAxisTasks: 3,
  drivingPathTasks: 6,
  byteUniqueOracleFiles: 2,
  schemaDuplicateFiles: 1,
  uniqueOracleFiles: 1,
  byteUniqueOracleTasks: 2,
  uniqueOracleTasks: 1,
});
const entries = Object.values(built.baseline.files);
eq('3a baseline pint per bestand de projectsom en beide tellers per as', entries.map(entry => ({
  label: entry.label,
  tasks: entry.tasks,
  projects: entry.projects,
  counters: entry.counters,
})), [{
  label: 'a/original.xer',
  tasks: 2,
  projects: 2,
  counters: {
    es: { deviations: 0, measurable: 2 }, ef: { deviations: 0, measurable: 2 },
    ls: { deviations: 0, measurable: 2 }, lf: { deviations: 0, measurable: 2 },
    tf: { deviations: 0, measurable: 1 }, ff: { deviations: 0, measurable: 2 },
  },
}]);

const nonZeroWithoutReason = structuredClone(built.baseline);
Object.values(nonZeroWithoutReason.files)[0].counters.es.deviations = 1;
eq('3b niet-nul-pin zonder reason wordt geweigerd', validateXerBaselinePins(nonZeroWithoutReason), [
  'baseline-entry 1: niet-nul afwijking vereist een niet-lege reason',
]);
Object.values(nonZeroWithoutReason.files)[0].reason = 'bewust gemeten verschil';
eq('3c niet-nul-pin met reason is welgevormd', validateXerBaselinePins(nonZeroWithoutReason), []);

function listXerFilesRecursive(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listXerFilesRecursive(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xer')) files.push(full);
  }
  return files;
}

if (REPORT !== undefined && REPORT !== 'detail' && REPORT !== 'baseline') {
  diffs.push(`OPS_XER_FIDELITY_REPORT kent alleen 'detail' of 'baseline' (kreeg ${JSON.stringify(REPORT)})`);
}

const corpusRoot = process.env.OPS_XER_CORPUS;
if (!corpusRoot) {
  console.log('OK  xer-fidelity: corpus niet aanwezig (OPS_XER_CORPUS) — corpuslus overgeslagen');
} else if (!existsSync(corpusRoot)) {
  diffs.push('OPS_XER_CORPUS wijst niet naar een bestaande corpusmap');
} else {
  const corpusFiles = listXerFilesRecursive(corpusRoot).map(path => ({
    label: relative(corpusRoot, path).split('\\').join('/'),
    bytes: readFileSync(path),
  }));
  const corpus = buildXerTargetBaseline(corpusFiles);

  // Bindende ankers uit het goedgekeurde brief. Deze cijfers worden opnieuw uit de bytes gemeten;
  // de implementatie gebruikt ze nergens om taken of bestanden te selecteren.
  eq('C1 volledige crawl', corpus.stats.scannedFiles, 93);
  eq('C2 unieke bestanden na byte-dedup', corpus.stats.byteUniqueFiles, 84);
  eq('C3 taken met vier datumassen', corpus.stats.fourDateTasks, 18_489);
  eq('C4 taken met alle zes assen', corpus.stats.sixAxisTasks, 17_963);
  eq('C5 unieke orakelbestanden na byte-dedup', corpus.stats.byteUniqueOracleFiles, 23);
  eq('C6 orakeltaken na byte-dedup', corpus.stats.byteUniqueOracleTasks, 17_600);
  eq('C7 unieke orakelbestanden na beide deduplagen', corpus.stats.uniqueOracleFiles, 22);
  eq('C8 orakeltaken na beide deduplagen', corpus.stats.uniqueOracleTasks, 13_383);
  eq('C8a precies één inhoudsduplicaat na byte-dedup', corpus.stats.schemaDuplicateFiles, 1);

  const baselinePath = join(HERE, 'xer-fidelity-baseline.json');
  const committed = JSON.parse(readFileSync(baselinePath, 'utf-8')) as XerFidelityBaseline;
  if (REPORT !== 'baseline') {
    eq('C9 committe baseline is exact de opnieuw gemeten per-bestandssom', committed, corpus.baseline);
    eq('C10 reason-verplichting op committe baseline', validateXerBaselinePins(committed), []);
  }

  console.log(
    `.   xer-fidelity: ${corpus.stats.scannedFiles} bestanden; byte-uniek ${corpus.stats.byteUniqueFiles}; `
    + `orakel ${corpus.stats.byteUniqueOracleFiles}→${corpus.stats.uniqueOracleFiles} bestanden, `
    + `${corpus.stats.byteUniqueOracleTasks}→${corpus.stats.uniqueOracleTasks} taken; `
    + `driving_path_flag meetbaar ${corpus.stats.drivingPathTasks} (rapportage, buiten nulpoort)`,
  );

  if (REPORT === 'detail') {
    for (const [hash, entry] of Object.entries(corpus.baseline.files)) {
      console.log(`.   ${hash} ${entry.label}: ${entry.projects} project(en), ${entry.tasks} taken, ${JSON.stringify(entry.counters)}`);
    }
  }
  if (REPORT === 'baseline') {
    console.log(JSON.stringify(corpus.baseline, null, 2));
  }
}

if (diffs.length === 0) {
  console.log(`OK  xer-fidelity: ${checks} checks groen`);
} else {
  console.log(`XX  xer-fidelity: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}
