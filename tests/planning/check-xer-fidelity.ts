import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildXerTargetBaseline,
  measureXerFidelity,
  validateXerBaselinePins,
  xerSchemaFingerprint,
} from './xerFidelity';
import type { XerCorpusManifest, XerCorpusRole } from './xerFidelity';
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
  presentAxes: { es: true, ef: true, ls: true, lf: true, tf: true, ff: true },
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
  presentAxes: { es: true, ef: true, ls: true, lf: true, tf: false, ff: true },
});
eq('1d geldige fixture heeft geen stille scannerfouten',
  (truth as unknown as { errors: string[] }).errors, []);

const commaFixture = Buffer.from([
  'ERMHDR\t23.12\t2026-04-01\tProject\tadmin\tAdmin\tDB\tProject Management\tEUR',
  '%T\tCURRTYPE',
  '%F\tcurr_short_name\tdecimal_symbol\tdigit_group_symbol\tdecimal_symbol_type\tdigit_group_symbol_type',
  '%R\tUSD\t.\t,\tPERIOD\tCOMMA',
  '%R\tEUR\t,\t.\tCOMMA\tPERIOD',
  '%T\tTASK',
  `%F\t${header.join('\t')}`,
  '%R\tP1\tC\tC\tComma\tTK_Complete\t2026-04-01 08:00\t2026-04-02 17:00\t\t\t\t\t1,25\t0,5\tY',
  '%E',
].join('\n'));
const commaTruth = scanXerGroundTruth(commaFixture) as unknown as {
  tasks: Array<Record<string, unknown>>;
  errors: string[];
};

// Breuk die dit vangt: Number(value) gebruiken zonder CURRTYPE en completed-aanwezigheid op de
// lege early/late-broncellen baseren in plaats van op de effectieve actuals.
eq('1e CURRTYPE-kommafloat blijft meetbaar in afgeronde minuten', commaTruth.tasks[0], {
  projectId: 'P1',
  taskId: 'C',
  taskCode: 'C',
  statusCode: 'TK_Complete',
  axes: {
    es: '2026-04-01T08:00', ef: '2026-04-02T17:00',
    ls: '2026-04-01T08:00', lf: '2026-04-02T17:00',
    tf: 75, ff: 30,
  },
  drivingPath: true,
  presentAxes: { es: true, ef: true, ls: true, lf: true, tf: true, ff: true },
});
eq('1f geldige kommafixture heeft geen parsefouten', commaTruth.errors, []);

const brokenTruth = scanXerGroundTruth(Buffer.from([
  'ERMHDR\t23.12',
  '%T\tTASK',
  `%F\t${header.join('\t')}`,
  '%R\tP1\tBAD\tBAD\tBroken\tTK_NotStart\t\t\t2026-02-30 08:00\t\t\t\t1.2x\t\t',
  '%R\tP1\tNO_STATUS\tNO_STATUS\tNo status\t\t\t\t\t\t\t\t\t\t',
  '%R\tP1\t\tNO_ID\tNo id\tTK_NotStart\t\t\t\t\t\t\t\t\t',
  '%E',
].join('\n')));
eq('1g niet-lege kapotte waarden en ontbrekende identiteit zijn fataal zichtbaar', brokenTruth.errors, [
  'TASK BAD/early_start_date: ongeldige datum "2026-02-30 08:00"',
  'TASK BAD/total_float_hr_cnt: ongeldig getal "1.2x"',
  'TASK rij 3/task_id: ontbrekende waarde',
]);
const brokenMeasurement = measureXerFidelity(brokenTruth, [{
  projectId: 'P1',
  tasks: [
    { sourceTaskId: 'BAD', taskCode: 'BAD' },
    { sourceTaskId: 'NO_STATUS', taskCode: 'NO_STATUS' },
  ],
}]);
eq('1h scannerfouten zijn gate-fataal bij verder exacte uitlijning', {
  errors: brokenMeasurement.errors,
  gatePassed: brokenMeasurement.gatePassed,
}, { errors: brokenTruth.errors, gatePassed: false });

const sourceDateVariants = scanXerGroundTruth(Buffer.from([
  'ERMHDR\t23.12',
  '%T\tTASK',
  `%F\t${header.join('\t')}`,
  '%R\tP1\tDATE_ONLY\tDATE_ONLY\tDate only\tTK_Complete\t2026-04-01\t2026-04-02\t\t\t\t\t\t\t',
  '%R\tP1\tNO_STATUS\tNO_STATUS\tNo status\t\t\t\t2026-04-03\t2026-04-04\t2026-04-05\t2026-04-06\t1\t0\t',
  '%R\tP1\tZERO\tZERO\tP6 zero sentinel\tTK_NotStart\t\t\t0\t0\t0\t0\t\t\t',
  '%E',
].join('\n')));

// Bronsemantiek en vergelijksemantiek zijn bewust verschillend: XER staat een geldige datum
// zonder tijd toe en bedoelt dan middernacht. Een toekomstige OPS-adapter moet daarentegen altijd
// de volledige minuutstring teruggeven; check 2d hieronder bewaakt die strengere uitvoergrens.
eq('1i geldige bron-datum zonder tijd canonicaliseert naar middernacht', sourceDateVariants.tasks[0].axes, {
  es: '2026-04-01T00:00', ef: '2026-04-02T00:00',
  ls: '2026-04-01T00:00', lf: '2026-04-02T00:00',
  tf: null, ff: null,
});
eq('1j ontbrekende status valt terug op de niet-voltooide early/late-assen', sourceDateVariants.tasks[1].axes, {
  es: '2026-04-03T00:00', ef: '2026-04-04T00:00',
  ls: '2026-04-05T00:00', lf: '2026-04-06T00:00',
  tf: 60, ff: 0,
});
eq('1k P6 nul-datumsentinel is afwezig en geen ongeldige niet-lege orakelwaarde', {
  axes: sourceDateVariants.tasks[2].axes,
  presentAxes: sourceDateVariants.tasks[2].presentAxes,
  errors: sourceDateVariants.errors,
}, {
  axes: { es: null, ef: null, ls: null, lf: null, tf: null, ff: null },
  presentAxes: { es: false, ef: false, ls: false, lf: false, tf: false, ff: false },
  errors: [],
});

const duplicateTruthIds = scanXerGroundTruth(Buffer.from([
  'ERMHDR\t23.12',
  '%T\tTASK',
  `%F\t${header.join('\t')}`,
  '%R\tP1\tDUP\tA\tFirst\tTK_NotStart\t\t\t2026-04-01 08:00\t\t\t\t\t\t',
  '%R\tP1\tDUP\tB\tSecond\tTK_NotStart\t\t\t2026-04-02 08:00\t\t\t\t\t\t',
  '%E',
].join('\n')));
eq('1l dubbele bron-taak-id binnen een project is fataal', duplicateTruthIds.errors, [
  'TASK rij 2: dubbele task_id P1/DUP',
]);

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

const nullAdapter = measureXerFidelity(truth, [
  { projectId: 'P1', tasks: [{ sourceTaskId: '1', taskCode: 'A' }] },
  { projectId: 'P2', tasks: [{ sourceTaskId: '2', taskCode: 'B' }] },
]);
eq('2d een correct uitgelijnde null-adapter is op iedere meetbare as rood', {
  counters: nullAdapter.counters,
  errors: nullAdapter.errors,
  gatePassed: nullAdapter.gatePassed,
}, {
  counters: {
    es: { deviations: 2, measurable: 2 }, ef: { deviations: 2, measurable: 2 },
    ls: { deviations: 2, measurable: 2 }, lf: { deviations: 2, measurable: 2 },
    tf: { deviations: 1, measurable: 1 }, ff: { deviations: 2, measurable: 2 },
  },
  errors: [],
  gatePassed: false,
});

const midnightTruth = scanXerGroundTruth(Buffer.from([
  'ERMHDR\t23.12',
  '%T\tTASK',
  `%F\t${header.join('\t')}`,
  '%R\tP1\tMID\tMID\tMidnight\tTK_NotStart\t\t\t2026-03-01 00:00\t\t\t\t\t\t',
  '%E',
].join('\n')));
const measureMidnight = (earlyStart: string) => measureXerFidelity(midnightTruth, [{
  projectId: 'P1',
  tasks: [{ sourceTaskId: 'MID', taskCode: 'MID', earlyStart }],
}]).counters.es;

// Breuk die dit vangt: XER-datums via MPP's bewuste date-only/middernacht-uitweg vergelijken,
// of alleen de eerste zestien tekens bekijken en trailing rommel daardoor exact noemen.
eq('2e XER date-only is niet minuut-exact tegen middernacht', measureMidnight('2026-03-01'), {
  deviations: 1, measurable: 1,
});
eq('2f XER-minuut met trailing tekst is niet geldig of exact',
  measureMidnight('2026-03-01T00:00 rommel'), { deviations: 1, measurable: 1 });

const misaligned = measureXerFidelity(midnightTruth, [
  {
    projectId: 'P1',
    tasks: [
      { sourceTaskId: 'MID', taskCode: 'WRONG', earlyStart: '2026-03-01T00:00' },
      { sourceTaskId: 'EXTRA', taskCode: 'EXTRA' },
    ],
  },
  { projectId: 'P2', tasks: [{ sourceTaskId: 'OTHER', taskCode: 'OTHER' }] },
]);
const misalignedShape = misaligned as unknown as {
  truthProjects: number;
  solvedProjects: number;
  truthTasks: number;
  solvedTasks: number;
  gatePassed: boolean;
};

// Breuk die dit vangt: alleen op task-id waarden vergelijken en extra projecten/taken negeren.
eq('2f uitlijning rapporteert verkeerde code plus extra taak en project', misaligned.errors, [
  'onverwacht opgelost project-id: P2',
  'project P1: onverwachte opgeloste taak-id: EXTRA',
  'project P1/taak MID: taskCode verwacht MID, kreeg WRONG',
]);
eq('2g waarheid- en opgelostaantallen blijven afzonderlijk zichtbaar', {
  truthProjects: misalignedShape.truthProjects,
  solvedProjects: misalignedShape.solvedProjects,
  truthTasks: misalignedShape.truthTasks,
  solvedTasks: misalignedShape.solvedTasks,
}, { truthProjects: 1, solvedProjects: 2, truthTasks: 1, solvedTasks: 3 });
eq('2h uitlijnfouten maken de bestandsmeting gate-fataal', misalignedShape.gatePassed, false);

const missing = measureXerFidelity(midnightTruth, [{ projectId: 'P1', tasks: [] }]);
eq('2i ontbrekende taak is een uitlijnfout', missing.errors, [
  'project P1: ontbrekende opgeloste taak-id: MID',
]);

const duplicateIds = measureXerFidelity(midnightTruth, [
  { projectId: 'P1', tasks: [{ sourceTaskId: 'MID', taskCode: 'MID' }, { sourceTaskId: 'MID', taskCode: 'MID' }] },
  { projectId: 'P1', tasks: [{ sourceTaskId: 'MID', taskCode: 'MID' }] },
]);
eq('2j dubbele project- en taak-id zijn beide fataal', duplicateIds.errors, [
  'dubbele opgeloste project-id: P1',
  'project P1: dubbele opgeloste taak-id: MID',
]);

function schemaTruth(projectIds: readonly string[], driving: 'Y' | 'N', taskId = 'S') {
  return scanXerGroundTruth(Buffer.from([
    'ERMHDR\t23.12',
    '%T\tPROJECT',
    '%F\tproj_id',
    ...projectIds.map(projectId => `%R\t${projectId}`),
    '%T\tTASK',
    `%F\t${header.join('\t')}`,
    `%R\tP1\t${taskId}\tSCODE\tSchema\tTK_NotStart\t\t\t2026-05-01 08:00\t2026-05-01 17:00\t2026-05-02 08:00\t2026-05-02 17:00\t1\t0\t${driving}`,
    '%E',
  ].join('\n')));
}
const schemaP1 = schemaTruth(['P1'], 'Y');
const schemaP1P2 = schemaTruth(['P1', 'P2'], 'Y');
const schemaDrivingOnly = schemaTruth(['P1'], 'N');
const schemaOtherTaskId = schemaTruth(['P1'], 'Y', 'OTHER');

// Breuken die dit vangt: PROJECT-rijen negeren of de zevende rapportage-as indirect de
// zesassige steekproef laten splitsen.
eq('2k grondwaarheid leest de echte PROJECT-set inclusief leeg project',
  [...schemaP1P2.projects], ['P1', 'P2']);
eq('2l extra PROJECT-rij verandert de zesassige schemafingerprint',
  xerSchemaFingerprint(schemaP1) === xerSchemaFingerprint(schemaP1P2), false);
eq('2m alleen driving_path_flag verandert de gatefingerprint niet',
  xerSchemaFingerprint(schemaP1), xerSchemaFingerprint(schemaDrivingOnly));
eq('2n andere taakidentiteit verandert de gatefingerprint',
  xerSchemaFingerprint(schemaP1) === xerSchemaFingerprint(schemaOtherTaskId), false);

const byteDuplicate = Buffer.from(bytes);
const schemaDuplicate = Buffer.from(fixture.split('\r\n').join('\n'), 'latin1');
const noOracle = Buffer.from([
  '%T\tTASK',
  '%F\tproj_id\ttask_id\ttask_code\tstatus_code\tact_start_date\tact_end_date\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\ttotal_float_hr_cnt\tfree_float_hr_cnt\tdriving_path_flag',
  '%R\tP3\t3\tC\tTK_NotStart\t\t\t\t\t\t\t\t\t',
].join('\n'));
const pseudoOracle = Buffer.from(fixture.replace('Alpha', 'Pseudo Alpha'), 'latin1');
const unitFiles = [
  { label: 'a/original.xer', bytes },
  { label: 'b/byte-copy.xer', bytes: byteDuplicate },
  { label: 'c/schema-copy.xer', bytes: schemaDuplicate },
  { label: 'd/no-oracle.xer', bytes: noOracle },
  { label: 'e/pseudo-with-six-axes.xer', bytes: pseudoOracle },
] as const;
const unitManifest: XerCorpusManifest = {
  version: 1,
  policy: 'synthetische manifestfixture',
  files: Object.fromEntries(unitFiles.map(file => {
    const included = !file.label.startsWith('d/') && !file.label.startsWith('e/');
    const excludedRole: XerCorpusRole = file.label.startsWith('e/') ? 'pseudo-xer' : 'reference-only';
    return [file.label, {
      sha256: createHash('sha256').update(file.bytes).digest('hex'),
      source: 'synthetische testfixture',
      role: (included ? 'oracle' : excludedRole) as XerCorpusRole,
      included,
      ...(included ? {} : { exclusionReason: 'geen poortas' }),
    }];
  })),
};
const built = buildXerTargetBaseline(unitFiles, unitManifest);

// Breuken die dit vangt: alleen bytehash dedupliceren, schemahash op bestandsbytes baseren,
// niet-orakelbestanden laten meetellen of multi-projectcijfers niet per bestand sommeren.
eq('3 twee deduplagen laten één uniek orakelbestand over', built.stats, {
  scannedFiles: 5,
  manifestFiles: 5,
  includedFiles: 3,
  excludedFiles: 2,
  byteUniqueFiles: 4,
  byteDuplicateFiles: 1,
  fourDateTasks: 8,
  sixAxisTasks: 4,
  drivingPathTasks: 8,
  partialOnlyByteUniqueFiles: 0,
  partialOnlyAxisCells: 0,
  byteUniqueOracleFiles: 2,
  schemaDuplicateFiles: 1,
  uniqueOracleFiles: 1,
  byteUniqueOracleTasks: 4,
  uniqueOracleTasks: 2,
  selectedMeasurable: { es: 2, ef: 2, ls: 2, lf: 2, tf: 1, ff: 2 },
});
eq('3a manifestselectie en synthetische bestanden leveren geen selectiefout', built.errors, []);
const entries = Object.values(built.baseline.files);
eq('3b pseudo-XER met zes ogenschijnlijke assen blijft op herkomst buiten de baseline',
  entries.some(entry => entry.label === 'e/pseudo-with-six-axes.xer'), false);
eq('3c baseline pint per bestand de projectsom en beide tellers per as', entries.map(entry => ({
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
eq('3d niet-nul-pin zonder reason wordt geweigerd', validateXerBaselinePins(nonZeroWithoutReason), [
  'baseline-entry 1: niet-nul afwijking vereist een niet-lege reason',
]);
Object.values(nonZeroWithoutReason.files)[0].reason = 'bewust gemeten verschil';
eq('3e niet-nul-pin met reason is welgevormd', validateXerBaselinePins(nonZeroWithoutReason), []);

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
  const manifest = JSON.parse(readFileSync(join(HERE, 'xer-corpus-manifest.json'), 'utf-8')) as XerCorpusManifest;
  const corpus = buildXerTargetBaseline(corpusFiles, manifest);
  eq('C0 corpusmanifest past exact op bytes, herkomstselectie en parserfouten', corpus.errors, []);

  // Bindende ankers uit het goedgekeurde brief. Deze cijfers worden opnieuw uit de bytes gemeten;
  // de implementatie gebruikt ze nergens om taken of bestanden te selecteren.
  eq('C1 volledige crawl', corpus.stats.scannedFiles, 93);
  eq('C2 unieke bestanden na byte-dedup', corpus.stats.byteUniqueFiles, 84);
  eq('C3 taken met vier effectieve datumassen', corpus.stats.fourDateTasks, 18_504);
  eq('C4 taken met alle zes effectieve assen', corpus.stats.sixAxisTasks, 17_954);
  eq('C4a de eerder gemiste scheve dekking blijft volledig zichtbaar', {
    files: corpus.stats.partialOnlyByteUniqueFiles,
    cells: corpus.stats.partialOnlyAxisCells,
  }, { files: 29, cells: 2_088 });
  eq('C5 herkomstgeselecteerde orakelbestanden na byte-dedup', corpus.stats.byteUniqueOracleFiles, 36);
  eq('C6 meetbare orakeltaken na byte-dedup', corpus.stats.byteUniqueOracleTasks, 18_194);
  eq('C7 unieke orakelbestanden na beide deduplagen', corpus.stats.uniqueOracleFiles, 34);
  eq('C8 meetbare orakeltaken na beide deduplagen', corpus.stats.uniqueOracleTasks, 13_963);
  eq('C8a twee inhoudsduplicaten na byte-dedup', corpus.stats.schemaDuplicateFiles, 2);
  eq('C8b geselecteerde meetbaarheid wordt per as uit de bytes herleid', corpus.stats.selectedMeasurable, {
    es: 13_935, ef: 13_941, ls: 13_833, lf: 13_825, tf: 13_677, ff: 13_322,
  });

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
