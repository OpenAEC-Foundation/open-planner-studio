import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solveProject } from '@/engine/scheduler/solveProject';
import { readXER } from '@/services/xer/xerReader';
import { activeImportResult } from '@/services/importTypes';
import { scanXerGroundTruth } from './xerGroundTruth';
import { measureXerFidelity, type XerSolvedProject } from './xerFidelity';

const diffs: string[] = [];
let checks = 0;
const here = fileURLToPath(new URL('.', import.meta.url));
const baseline = JSON.parse(readFileSync(join(here, 'xer-product-fidelity-baseline.json'), 'utf8')) as {
  version: number;
  files: Record<string, {
    tasks: number;
    projects: number;
    counters: ReturnType<typeof measureXerFidelity>['counters'];
    reason: string;
  }>;
};

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
        totalFloatMinutes: Math.round(task.time.totalFloat * minutesPerDay),
        freeFloatMinutes: Math.round(task.time.freeFloat * minutesPerDay),
      };
    }),
  };
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
  for (const label of pins) {
    const bytes = readFileSync(join(root, label));
    const truth = scanXerGroundTruth(bytes);
    const ours = solved(bytes);
    const measurement = measureXerFidelity(truth, [ours]);
    if (process.env.OPS_XER_FIDELITY_REPORT === 'detail') {
      const oursById = new Map(ours.tasks.map(task => [task.sourceTaskId, task]));
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
