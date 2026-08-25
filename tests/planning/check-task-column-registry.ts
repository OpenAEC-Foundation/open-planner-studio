import type { Baseline } from '@/types/baseline';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Sequence } from '@/types/sequence';
import type { Task } from '@/types/task';
import type { TaskColumnContext, TaskColumnDescriptor } from '@/types/taskGrid';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  activityCodeColumnId,
  baselineColumnId,
  customFieldColumnId,
  decodeDynamicTaskColumnId,
} from '@/engine/taskGrid/fieldIds';
import { buildTaskRelationIndex } from '@/engine/taskGrid/relationIndex';
import {
  TASK_COLUMN_CATEGORY_ORDER,
  buildTaskColumnRegistry,
  canonicalGridJson,
} from '@/engine/taskGrid/taskColumnRegistry';

const diffs: string[] = [];
let checks = 0;

function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

const hostile = ['project:1', '100%', 'pad/met/slash', `dubbel\"en'enkel`, '日本語 🧱'];
for (const projectId of hostile) {
  for (const fieldId of hostile) {
    const activityId = activityCodeColumnId(projectId, fieldId);
    eq(`activity-code roundtrip ${projectId}/${fieldId}`, decodeDynamicTaskColumnId(activityId), {
      kind: 'activity-code', projectId, typeId: fieldId,
    });
    const customId = customFieldColumnId(projectId, fieldId);
    eq(`custom-field roundtrip ${projectId}/${fieldId}`, decodeDynamicTaskColumnId(customId), {
      kind: 'custom-field', projectId, defId: fieldId,
    });
    const baselineId = baselineColumnId(projectId, fieldId, 'varianceFinish');
    eq(`baseline roundtrip ${projectId}/${fieldId}`, decodeDynamicTaskColumnId(baselineId), {
      kind: 'baseline', projectId, baselineId: fieldId, field: 'varianceFinish',
    });
  }
}

ok('segmentgrenzen botsen niet',
  activityCodeColumnId('a:b', 'c') !== activityCodeColumnId('a', 'b:c'));
ok('quotes worden percent-encoded', !activityCodeColumnId(`a'b`, 'c\"d').includes("'")
  && !activityCodeColumnId(`a'b`, 'c\"d').includes('\"'));
eq('ongeldige percentcode wordt geweigerd', decodeDynamicTaskColumnId('activity-code:a:%ZZ'), null);
eq('niet-canonieke ongecodeerde dubbele punt wordt geweigerd',
  decodeDynamicTaskColumnId('activity-code:a:b:c'), null);
eq('onbekende baselinesuffix wordt geweigerd',
  decodeDynamicTaskColumnId('baseline:a:b:nope'), null);

const task = {
  id: 't-1', name: 'Taak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION',
  status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [],
  resourceIds: ['r-1'], splitGaps: [{ gapMinutes: 60, afterMinutes: 120 }],
  externalLinks: [{
    id: 'ext-1', direction: 'predecessor', relType: 'FS', lagDays: 0,
    anchorDate: '2025-12-30', sourceRef: { projectId: 'bron:1', taskId: 'bron-taak', taskName: 'Bron' },
    sourceMissing: false,
  }],
  timephasedContours: [{ resourceUid: 7, periods: [{ kind: 'remaining', workMinutes: 30, minutes: 60, afterMinutes: 0 }] }],
  notes: [{ done: false, text: 'B', id: 'n-1' }],
  time: {
    durationType: 'WORKTIME', scheduleDuration: 1, scheduleStart: '2026-01-01', scheduleFinish: '2026-01-01',
    earlyStart: '2026-01-01', earlyFinish: '2026-01-01', lateStart: '2026-01-01', lateFinish: '2026-01-01',
    freeFloat: 0, totalFloat: 0, isCritical: true, completion: 0,
  },
} as Task;
const sequence: Sequence = {
  id: 's-1', predecessorId: 'other', successorId: task.id,
  type: 'FINISH_START', lagDays: 0,
};
const assignment: ResourceAssignment = {
  id: 'a-1', taskId: task.id, resourceId: 'r-1', unitsPerDay: 1,
};
const resource: Resource = {
  id: 'r-1', name: 'Ploeg A', type: 'CREW', description: '', maxUnits: 1,
};
let baselineTasksReads = 0;
const baselineTaskRows: Baseline['tasks'] = [
  { taskId: task.id, start: '2025-12-31', finish: '2025-12-31', duration: 1, isMilestone: false },
];
const baseline: Baseline = {
  id: 'base:1', name: 'Contract', createdAt: '2026-01-01T00:00:00Z', projectEnd: '2026-01-01', projectDuration: 1,
  get tasks() { baselineTasksReads++; return baselineTaskRows; },
};
const ctx: TaskColumnContext = {
  projectId: 'project:1',
  tasksById: new Map([[task.id, task]]),
  relationIndex: buildTaskRelationIndex([task], [sequence]),
  assignmentsByTaskId: new Map([[task.id, [assignment]]]),
  resourcesById: new Map([[resource.id, resource]]),
  baselinesById: new Map([[baseline.id, baseline]]),
  scheduleStale: false,
  signedWorkDaysBetween: () => 42,
};
const registry = buildTaskColumnRegistry({
  projectId: ctx.projectId,
  activityCodeTypes: [{ id: 'fase:1', name: 'Fase', values: [{ id: 'v-1', code: 'A' }] }],
  customFieldDefs: [{ id: 'cf:1', name: 'Eigen veld', type: 'text' }],
  baselines: [baseline],
});

eq('ene relationIndex combineert interne en externe voorgangers',
  ctx.relationIndex.predecessorsByTaskId.get(task.id)?.map(item => item.kind), ['internal', 'external']);
eq('ene relationIndex houdt de technische bronnen apart zonder opnieuw te scannen',
  {
    internal: ctx.relationIndex.internalByTaskId.get(task.id)?.length,
    external: ctx.relationIndex.externalByTaskId.get(task.id)?.length,
  },
  { internal: 1, external: 1 });

eq('categorievolgorde is exact', TASK_COLUMN_CATEGORY_ORDER,
  ['task', 'planning', 'constraints', 'relations', 'resources', 'progress', 'computed', 'baseline', 'custom', 'technical']);
ok('registry zelf staat in dezelfde vaste categorievolgorde', registry.every((column, index) =>
  index === 0 || TASK_COLUMN_CATEGORY_ORDER.indexOf(registry[index - 1].category)
    <= TASK_COLUMN_CATEGORY_ORDER.indexOf(column.category)));
eq('registry-ids zijn uniek', new Set(registry.map(column => column.id)).size, registry.length);
ok('vaste naamkolom bestaat', registry.some(column => column.id === 'task.name'));
ok('activity-codegenerator bevat project-id', registry.some(column => column.id === activityCodeColumnId(ctx.projectId, 'fase:1')));
ok('custom-fieldgenerator bevat project-id', registry.some(column => column.id === customFieldColumnId(ctx.projectId, 'cf:1')));
eq('iedere baseline levert acht kolommen', registry.filter(column => decodeDynamicTaskColumnId(column.id)?.kind === 'baseline').length, 8);
const baselineStart = registry.find(column => column.id === baselineColumnId(ctx.projectId, baseline.id, 'start'))!;
const baselineVariance = registry.find(column => column.id === baselineColumnId(ctx.projectId, baseline.id, 'varianceStart'))!;
eq('baselinekolom leest via de vooraf gebouwde taakindex', baselineStart.read(task, ctx), '2025-12-31');
eq('baselineafwijking gebruikt de aangeleverde projectkalenderroute', baselineVariance.read(task, ctx), 42);
baselineStart.copy(task, ctx);
baselineStart.autoFitText(task, ctx);
eq('Baseline.tasks wordt exact één keer per registrybouw geïndexeerd en nooit per cel', baselineTasksReads, 1);

function isReadOnly(column: TaskColumnDescriptor): boolean {
  return typeof column.readOnly === 'function' ? column.readOnly(task, ctx) : column.readOnly;
}
for (const column of registry) {
  if (isReadOnly(column)) {
    ok(`${column.id}: read-only gebruikt editor none`, column.editorKind === 'none');
    ok(`${column.id}: read-only heeft geen parser`, column.parse === undefined);
    ok(`${column.id}: read-only heeft geen validator`, column.validate === undefined);
    ok(`${column.id}: read-only heeft geen writer`, column.planWrite === undefined);
  } else {
    ok(`${column.id}: schrijfbaar heeft parser`, typeof column.parse === 'function');
    ok(`${column.id}: schrijfbaar heeft validator`, typeof column.validate === 'function');
    ok(`${column.id}: schrijfbaar heeft writer`, typeof column.planWrite === 'function');
    const parsed = column.parse?.(column.copy(task, ctx), task, ctx);
    if (parsed?.ok) {
      const validated = column.validate?.(parsed.value, task, ctx);
      if (validated?.ok) {
        const planned = column.planWrite?.(validated.value, task, ctx);
        ok(`${column.id}: writer plant minstens één echte intent`, !!planned?.ok && planned.value.length > 0);
      }
    }
  }
}

eq('canonieke JSON sorteert objectsleutels recursief en bewaart arrayvolgorde',
  canonicalGridJson({ z: [{ b: 2, a: 1 }], a: true }),
  '{"a":true,"z":[{"a":1,"b":2}]}');
const contour = registry.find(column => column.id === 'task.timephasedContours');
ok('complex contourveld is read-only', !!contour && isReadOnly(contour));
eq('complex contourveld kopieert verliesloos en canoniek', contour?.copy(task, ctx), canonicalGridJson(task.timephasedContours));

const taskGridDir = fileURLToPath(new URL('../../src/engine/taskGrid/', import.meta.url));
for (const file of readdirSync(taskGridDir).filter(name => name.endsWith('.ts'))) {
  const source = readFileSync(`${taskGridDir}/${file}`, 'utf8');
  ok(`${file}: taskGrid-engine importeert geen Zustand/store`, !/['"]@\/state\//.test(source));
  ok(`${file}: geen per-cell full-array fallback`,
    !/(?:sequences|assignments|externalLinks)\s*\.\s*filter\s*\(/.test(source));
}

if (diffs.length) {
  console.error(`XX task-column-registry: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK task-column-registry: ${checks}/${checks} checks groen`);
