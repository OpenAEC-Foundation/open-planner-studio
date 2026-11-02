// Een externe relatie op een fase (verzameltaak) geldt voor elke bladtaak eronder, net als een
// gewone relatie op een fase (`expandSummaryRelations`, MS Project-semantiek). De solver kent
// alleen bladtaken; vroeger telde een externe voorganger of opvolger op een fase daardoor niet mee,
// terwijl de app hem wel liet toevoegen (Relatie ▾ › Externe relatie toevoegen… vraagt alleen één
// geselecteerde taak).
//
// De check vergelijkt per richting en relatietype "koppeling op de fase" met "dezelfde koppeling
// op elke bladtaak": de datums en de speling van de bladtaken moeten gelijk zijn. Daarnaast: het
// nivelleerpad, het voorbeeld van "project verplaatsen" en het logica-rapport zien hetzelfde.
import { solveProject } from '@/engine/scheduler/solveProject';
import { leafTasksForSolve } from '@/engine/scheduler/expandSummaryRelations';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { buildLogicIndex } from '@/engine/reports/logicIndex';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { ExternalLink, Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { ReportContext } from '@/engine/reports/reportCommon';

let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
};

const calendar: WorkCalendar = {
  id: 'cal-default', name: 'Werkweek', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime('2026-06-01', 2, 'days'), ...extra,
});
const link = (direction: ExternalLink['direction'], relType: ExternalLink['relType']): ExternalLink => ({
  id: `ext-${direction}-${relType}`, direction, relType, lagDays: 1, sourceMissing: true,
  // Een voorganger duwt (anker ná de projectstart); een opvolger begrenst (anker vóór het
  // natuurlijke einde, zodat er negatieve speling ontstaat).
  anchorDate: direction === 'predecessor' ? '2026-06-10T16:00' : '2026-06-03T08:00',
  sourceRef: { projectId: 'bron', taskId: 'extern' },
});

/** Fase F met de bladtaken A (2 d) en B (3 d) onder een tussenfase G, plus een losse taak C. */
function project(where: 'phase' | 'leaves', l: ExternalLink): Task[] {
  const onPhase = where === 'phase' ? { externalLinks: [l] } : {};
  const onLeaf = where === 'leaves' ? { externalLinks: [l] } : {};
  return [
    task('F', { childIds: ['A', 'G'], ...onPhase }),
    task('A', { parentId: 'F', ...onLeaf }),
    task('G', { parentId: 'F', childIds: ['B'] }),
    task('B', { parentId: 'G', time: createDefaultTaskTime('2026-06-01', 3, 'days'), ...onLeaf }),
    task('C'),
  ];
}
const dates = (tasks: Task[]) => Object.fromEntries(tasks.map(t => [t.id, [
  t.time.earlyStart, t.time.earlyFinish, t.time.lateStart, t.time.lateFinish, t.time.totalFloatMinutes,
]]));

for (const base of ['ops', 'p6', 'msproject'] as const) {
  const schedulingOptions = effectiveSchedulingOptions({
    schedulingProfile: { baseId: base, id: base, name: '', overrides: {} },
  });
  for (const direction of ['predecessor', 'successor'] as const) {
    for (const relType of ['FS', 'SS', 'FF', 'SF'] as const) {
      const l = link(direction, relType);
      const solve = (where: 'phase' | 'leaves') => {
        const tasks = project(where, l);
        const result = solveProject({
          tasks, sequences: [], calendar, calendars: [], schedulingOptions, projectStartDate: '2026-06-01',
        });
        if (result.error) throw new Error(result.error);
        return dates(tasks);
      };
      const onPhase = solve('phase');
      const onLeaves = solve('leaves');
      const key = `${base}/${direction}/${relType}`;
      eq(`${key}: bladtaak A rekent met de koppeling van de fase`, onPhase.A, onLeaves.A);
      eq(`${key}: bladtaak B onder de tussenfase rekent ermee`, onPhase.B, onLeaves.B);
      eq(`${key}: de fase rolt dezelfde datums op`, onPhase.F, onLeaves.F);
      eq(`${key}: de losse taak C blijft ongemoeid`, onPhase.C, solve('leaves').C);
    }
  }
}

// De koppeling van de fase verandert de taakobjecten niet: de bladtaken dragen haar niet.
{
  const tasks = project('phase', link('predecessor', 'FS'));
  const leaves = leafTasksForSolve(tasks);
  eq('leaf-1 de solver krijgt alleen de bladtaken', leaves.map(t => t.id), ['A', 'B', 'C']);
  eq('leaf-2 A en B krijgen de koppeling van de fase', leaves.map(t => t.externalLinks?.length ?? 0), [1, 1, 0]);
  eq('leaf-3 het originele taakobject van A blijft zonder koppeling', tasks[1].externalLinks, undefined);
  eq('leaf-4 een blad zonder geërfde koppeling blijft hetzelfde object', leaves[2] === tasks[4], true);
  const solveTasks = project('phase', link('predecessor', 'FS'));
  solveProject({
    tasks: solveTasks, sequences: [], calendar, calendars: [],
    schedulingOptions: effectiveSchedulingOptions({}), projectStartDate: '2026-06-01',
  });
  eq('leaf-5 na de berekening draagt de bladtaak nog steeds geen kopie', solveTasks[1].externalLinks, undefined);
}

// Het logica-rapport (planningsgezondheid) telt een geërfde externe voorganger als voorganger.
{
  const tasks = project('phase', link('predecessor', 'FS'));
  const index = buildLogicIndex({ tasks, sequences: [] } as unknown as ReportContext);
  eq('logic-1 A en B hebben een voorganger (van de fase)', ['A', 'B', 'C'].map(id => index.hasPred.has(id)), [true, true, false]);
  const succ = buildLogicIndex({ tasks: project('phase', link('successor', 'FS')), sequences: [] } as unknown as ReportContext);
  eq('logic-2 A en B hebben een opvolger (van de fase)', ['A', 'B', 'C'].map(id => succ.hasSucc.has(id)), [true, true, false]);
}

if (failures.length) {
  console.error(`XX external-summary: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK external-summary: ${checks}/${checks}`);
