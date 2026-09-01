import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveProject } from '@/engine/scheduler/solveProject';
import { readXER } from '@/services/xer/xerReader';
import { activeImportResult } from '@/services/importTypes';
import { scanXerGroundTruth, XER_FIDELITY_AXES, type XerFidelityAxis } from './xerGroundTruth';
import { measureXerFidelity, type XerSolvedProject, type XerSolvedTask } from './xerFidelity';

const diffs: string[] = [];
let checks = 0;
const here = fileURLToPath(new URL('.', import.meta.url));
const baseline = JSON.parse(readFileSync(join(here, 'xer-product-fidelity-baseline.json'), 'utf8')) as {
  version: number;
  cellTransitions: {
    version: 1;
    files: Record<string, {
      previouslyExact: Array<[sourceProjectId: string, sourceTaskId: string, axis: XerFidelityAxis]>;
      improvements: Array<{
        cell: [sourceProjectId: string, sourceTaskId: string, axis: XerFidelityAxis];
        old: { bucket: 'diff'; value: string | number };
        current: { bucket: 'exact'; value: string | number };
      }>;
    }>;
  };
  files: Record<string, {
    tasks: number;
    projects: number;
    counters: ReturnType<typeof measureXerFidelity>['counters'];
    reason: string;
  }>;
};

type CellValue = string | number;
type CellBucket = 'exact' | 'diff' | 'missing';
interface MeasuredCell {
  fileSha256: string;
  sourceProjectId: string;
  sourceTaskId: string;
  axis: XerFidelityAxis;
  bucket: CellBucket;
  value: CellValue | undefined;
  oracle: CellValue;
}

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function solved(bytes: Uint8Array): XerSolvedProject {
  const imported = activeImportResult(readXER(bytes));
  const cpm = solveProject({
    tasks: imported.tasks,
    sequences: imported.sequences,
    calendar: imported.calendar,
    calendars: imported.resourceCalendars ?? [],
    dataDate: imported.project.statusDate,
    projectStartDate: imported.project.startDate,
  });
  if (cpm.error) throw new Error(cpm.error);
  const calendarById = new Map([
    [imported.calendar.id, imported.calendar],
    ...(imported.resourceCalendars ?? []).map(calendar => [calendar.id, calendar] as const),
  ]);
  return {
    projectId: imported.project.id,
    // Alleen echte TASK-activiteiten. PROJWBS-samenvattingen zijn expres geen fidelitybladen.
    tasks: imported.tasks.filter(task => task.p6ActivityType !== undefined).map(task => {
      const calendar = (task.calendarId ? calendarById.get(task.calendarId) : undefined) ?? imported.calendar;
      const minutesPerDay = calendar.hoursPerDay * 60;
      return {
        sourceTaskId: task.id,
        taskCode: task.wbsCode,
        earlyStart: task.time.earlyStart,
        earlyFinish: task.time.earlyFinish,
        lateStart: task.time.lateStart,
        lateFinish: task.time.lateFinish,
        totalFloatMinutes: task.time.totalFloat * minutesPerDay,
        freeFloatMinutes: task.time.freeFloat * minutesPerDay,
      };
    }),
  };
}

function solvedAxis(task: XerSolvedTask | undefined, axis: XerFidelityAxis): CellValue | undefined {
  if (!task) return undefined;
  switch (axis) {
    case 'es': return task.earlyStart;
    case 'ef': return task.earlyFinish;
    case 'ls': return task.lateStart;
    case 'lf': return task.lateFinish;
    case 'tf': return task.totalFloatMinutes;
    case 'ff': return task.freeFloatMinutes;
  }
}

function cellKey(
  fileSha256: string,
  cell: readonly [sourceProjectId: string, sourceTaskId: string, axis: XerFidelityAxis],
): string {
  return JSON.stringify([fileSha256, ...cell]);
}

function sortedCells(cells: ReadonlyArray<readonly [string, string, XerFidelityAxis]>): string[] {
  return cells.map(cell => JSON.stringify(cell)).sort();
}

const root = process.env.OPS_XER_CORPUS;
if (!root) {
  console.log('OK  xer-product-fidelity: corpus niet aanwezig (OPS_XER_CORPUS) — twee productpins overgeslagen');
} else if (!existsSync(root)) {
  diffs.push('OPS_XER_CORPUS wijst niet naar een bestaande corpusmap');
} else {
  const pins = [
    'crawl-xer/p6diff-baseline.xer',
    'crawl-xer-extra/p6difftool/sample-target.xer',
  ] as const;
  eq('productbaseline heeft precies de twee bindende openbare orakels', {
    version: baseline.version,
    labels: Object.keys(baseline.files).sort(),
  }, { version: 1, labels: [...pins].sort() });
  const measuredCells = new Map<string, MeasuredCell>();
  const measuredHashes: string[] = [];
  for (const label of pins) {
    const bytes = readFileSync(join(root, label));
    const fileSha256 = createHash('sha256').update(bytes).digest('hex');
    measuredHashes.push(fileSha256);
    const truth = scanXerGroundTruth(bytes);
    const ours = solved(bytes);
    const oursById = new Map(ours.tasks.map(task => [task.sourceTaskId, task]));
    for (const task of truth.tasks) {
      for (const axis of XER_FIDELITY_AXES) {
        const oracle = task.axes[axis];
        if (oracle === null) continue;
        const value = solvedAxis(oursById.get(task.taskId), axis);
        const cell: [string, string, XerFidelityAxis] = [task.projectId, task.taskId, axis];
        measuredCells.set(cellKey(fileSha256, cell), {
          fileSha256,
          sourceProjectId: task.projectId,
          sourceTaskId: task.taskId,
          axis,
          bucket: value === undefined ? 'missing' : value === oracle ? 'exact' : 'diff',
          value,
          oracle,
        });
      }
    }
    const measurement = measureXerFidelity(truth, [ours]);
    if (process.env.OPS_XER_FIDELITY_REPORT === 'detail') {
      console.log(`.   ${label}`);
      for (const task of truth.tasks) {
        const actual = oursById.get(task.taskId);
        console.log(`.   ${task.taskId} truth=${JSON.stringify(task.axes)} ours=${JSON.stringify(actual)}`);
      }
    }
    const expected = baseline.files[label];
    eq(`${label}: 8 echte activiteiten in één project`, {
      truthProjects: measurement.truthProjects,
      solvedProjects: measurement.solvedProjects,
      truthTasks: measurement.truthTasks,
      solvedTasks: measurement.solvedTasks,
      errors: measurement.errors,
    }, { truthProjects: 1, solvedProjects: 1, truthTasks: 8, solvedTasks: 8, errors: [] });
    eq(`${label}: eerste X4a-nulmeting pint uitsluitend de zes meetbare tellerparen`, {
      tasks: measurement.tasks,
      projects: measurement.truthProjects,
      counters: measurement.counters,
    }, { tasks: expected.tasks, projects: expected.projects, counters: expected.counters });
    eq(`${label}: iedere niet-nul-nulmeting heeft een expliciete scopeverklaring`,
      expected.reason.trim().length > 0, true);
  }

  const transitionFiles = Object.entries(baseline.cellTransitions.files).sort(([left], [right]) =>
    left.localeCompare(right));
  eq('celovergangscontract pint twee hash-orakels, 37 eerder exacte cellen en exact 16+1 verbeteringen', {
    version: baseline.cellTransitions.version,
    measuredHashes: measuredHashes.sort(),
    fileHashes: transitionFiles.map(([fileSha256]) => fileSha256),
    previouslyExact: transitionFiles.map(([, file]) => file.previouslyExact.length),
    improvements: transitionFiles.map(([, file]) => file.improvements.length),
    improvementAxes: transitionFiles.map(([, file]) =>
      [...new Set(file.improvements.map(improvement => improvement.cell[2]))].sort()),
    buckets: [...new Set(transitionFiles.flatMap(([, file]) => file.improvements.flatMap(improvement =>
      [improvement.old.bucket, improvement.current.bucket])))].sort(),
  }, {
    version: 1,
    measuredHashes: [
      '568c19375b4e0d674c75e6aea023c98772fb33e6896755f866e4641a56197300',
      'c872c9e704797d829205f3c5486e7c4cd5aec729143a63fbcf8b0ec8e8864a3c',
    ],
    fileHashes: [
      '568c19375b4e0d674c75e6aea023c98772fb33e6896755f866e4641a56197300',
      'c872c9e704797d829205f3c5486e7c4cd5aec729143a63fbcf8b0ec8e8864a3c',
    ],
    previouslyExact: [24, 13],
    improvements: [16, 1],
    improvementAxes: [['ef', 'es', 'lf', 'ls'], ['ef']],
    buckets: ['diff', 'exact'],
  });
  const actualTransitions = transitionFiles.flatMap(([fileSha256, file]) => file.improvements.map(improvement => {
    const measured = measuredCells.get(cellKey(fileSha256, improvement.cell));
    return {
      fileSha256,
      cell: improvement.cell,
      old: improvement.old,
      current: measured === undefined ? undefined : { bucket: measured.bucket, value: measured.value },
      oracle: measured?.oracle,
    };
  }));
  const expectedTransitions = transitionFiles.flatMap(([fileSha256, file]) => file.improvements.map(improvement => ({
    fileSha256,
    cell: improvement.cell,
    old: improvement.old,
    current: improvement.current,
    oracle: improvement.current.value,
  })));
  eq('celovergangscontract bindt iedere verbetering aan hash/project/task/as en oude/actuele waarde',
    actualTransitions, expectedTransitions);
  const exactSetResults = transitionFiles.map(([fileSha256, file]) => {
    const actual = [...measuredCells.values()]
      .filter(cell => cell.fileSha256 === fileSha256 && cell.bucket === 'exact')
      .map(cell => [cell.sourceProjectId, cell.sourceTaskId, cell.axis] as const);
    const expected = [
      ...file.previouslyExact,
      ...file.improvements.map(improvement => improvement.cell),
    ];
    return { fileSha256, actual: sortedCells(actual), expected: sortedCells(expected) };
  });
  eq('celovergangscontract laat geen eerder exacte cel verdwijnen en geen extra verbetering binnensluipen',
    exactSetResults.map(result => ({ fileSha256: result.fileSha256, exact: result.actual })),
    exactSetResults.map(result => ({ fileSha256: result.fileSha256, exact: result.expected })));

  // De vijf openbare bare-token-dragers bestaan uit twee X4b-meerprojectbestanden en precies
  // deze drie X4a-enkelprojectdragers. Dit is het echte-corpusdeel van het mutatiebewijs: de
  // kale FS/SS-tak uitschakelen verandert hun gerapporteerde fallback én dus deze telling.
  const bareRelationPins = {
    'P6-Viewer/XER Files/sample.xer': 10,
    'crawl-xer-extra/clause-epc/MER-1-2026_update_2026-05-01.xer': 119,
    'crawl-xer/MER-1-2026_epc.xer': 119,
  } as const;
  for (const [label, expectedBareRelations] of Object.entries(bareRelationPins)) {
    const imported = activeImportResult(readXER(readFileSync(join(root, label))));
    if (!imported.xer) throw new Error(`${label}: XER-metadata ontbreekt`);
    eq(`${label}: alle kale FS/SS-relaties bereiken de echte Sequence-set zonder terugval`, {
      relations: imported.sequences.length,
      fallbackRelations: imported.xer.enumFallbacks.filter(item => item.family === 'relation').length,
    }, { relations: expectedBareRelations, fallbackRelations: 0 });
  }
}

if (diffs.length > 0) {
  console.error(`XER-productfidelity: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK  XER-productfidelity: ${checks} pins groen`);
