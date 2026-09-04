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

function typeError(label: string, fn: () => unknown, message: string): void {
  checks++;
  try {
    fn();
    diffs.push(`${label}: verwacht TypeError`);
  } catch (error) {
    if (!(error instanceof TypeError) || error.message !== message) {
      diffs.push(`${label}: verwacht TypeError ${JSON.stringify(message)}, kreeg ${String(error)}`);
    }
  }
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
eq('percent-encoded losse UTF-16-surrogaat wordt geweigerd',
  decodeDynamicTaskColumnId('activity-code:project:%ED%A0%80'), null);
typeError('activity-code weigert leeg segment', () => activityCodeColumnId('', 'type'),
  'TaskColumnId-segment mag niet leeg zijn');
typeError('custom-field weigert leeg segment', () => customFieldColumnId('project', ''),
  'TaskColumnId-segment mag niet leeg zijn');
typeError('baseline weigert leeg segment', () => baselineColumnId('project', '', 'start'),
  'TaskColumnId-segment mag niet leeg zijn');
typeError('activity-code weigert losse UTF-16-surrogaat', () => activityCodeColumnId('project', '\uD800'),
  'TaskColumnId-segment bevat een losse UTF-16-surrogaat');
typeError('custom-field weigert losse UTF-16-surrogaat', () => customFieldColumnId('\uDC00', 'veld'),
  'TaskColumnId-segment bevat een losse UTF-16-surrogaat');
typeError('baseline weigert losse UTF-16-surrogaat', () => baselineColumnId('project', '\uD800', 'start'),
  'TaskColumnId-segment bevat een losse UTF-16-surrogaat');

const task = {
  id: 't-1', name: 'Taak', description: '', wbsCode: '1', taskType: 'CONSTRUCTION',
  status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [],
  resourceIds: ['r-1', 'r-2', 'r-3'], splitGaps: [{ gapMinutes: 60, afterMinutes: 120 }],
  activityCodes: { 'fase:1': 'v-2' }, customFields: { 'cf:1': 'Inhoud' },
  externalLinks: [{
    id: 'ext-1', direction: 'predecessor', relType: 'FS', lagDays: 0,
    anchorDate: '2025-12-30', sourceRef: { projectId: 'bron:1', taskId: 'bron-taak', taskName: 'Bron' },
    sourceMissing: true,
  }],
  timephasedContours: [{ resourceUid: 7, periods: [{ kind: 'remaining', workMinutes: 30, minutes: 60, afterMinutes: 0 }] }],
  notes: [{ done: false, text: 'B', id: 'n-1' }],
  time: {
    durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 1, scheduleStart: '2026-01-01', scheduleFinish: '2026-01-01',
    earlyStart: '2026-01-01', earlyFinish: '2026-01-01', lateStart: '2026-01-01', lateFinish: '2026-01-01',
    freeFloat: 0, totalFloat: 0, isCritical: true, completion: 0,
  },
} as Task;
const sequence: Sequence = {
  id: 's-1', predecessorId: 'other', successorId: task.id,
  type: 'FINISH_START', lagDays: 0,
};
const otherTask = {
  ...task, id: 'other', name: 'Voorganger', wbsCode: '0.9', resourceIds: [], externalLinks: [],
} as Task;
const assignment: ResourceAssignment = {
  id: 'a-1', taskId: task.id, resourceId: 'r-1', unitsPerDay: 1,
  workWindowStart: '2026-01-01', workWindowFinish: '2026-01-05',
};
const assignment2: ResourceAssignment = {
  id: 'a-2', taskId: task.id, resourceId: 'r-2', unitsPerDay: 0.5, curve: 'FRONT_LOADED',
};
const assignment3: ResourceAssignment = {
  id: 'a-3', taskId: task.id, resourceId: 'r-3', unitsPerDay: 2,
};
const resource: Resource = {
  id: 'r-1', name: 'Dubbele ploeg', type: 'CREW', description: '', maxUnits: 1,
};
const resource2: Resource = {
  id: 'r-2', name: 'Dubbele ploeg', type: 'CREW', description: '', maxUnits: 1,
};
const resource3: Resource = {
  id: 'r-3', name: 'Ploeg, Noord; nacht', type: 'CREW', description: '', maxUnits: 2,
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
  tasksById: new Map([[task.id, task], [otherTask.id, otherTask]]),
  relationIndex: buildTaskRelationIndex([otherTask, task], [sequence], {
    drivingSequenceIds: ['s-1'],
    sequenceFreeFloat: { 's-1': 0 },
    truncatedLeadSequenceIds: ['s-1'],
    outOfSequenceSequenceIds: ['s-1'],
    droppedSequenceIds: ['s-1'],
  }),
  assignmentsByTaskId: new Map([[task.id, [assignment, assignment2, assignment3]]]),
  resourcesById: new Map([
    [resource.id, resource], [resource2.id, resource2], [resource3.id, resource3],
  ]),
  baselinesById: new Map([[baseline.id, baseline]]),
  scheduleStale: false,
  labelForText: (key, values) => ({
    'relations.warnDropped': 'niet meegerekend',
    'relations.warnTruncatedLead': 'lead afgekapt',
    'relations.warnLeadExceedsDuration': 'lead groter dan voorgangerduur',
    'relations.warnOutOfSequence': 'buiten volgorde',
    'relations.warnSourceMissing': 'bron ontbreekt',
    'taskGrid.summary.activityCodeAssignments': `${values?.count} codetoewijzingen`,
    'taskGrid.summary.customFields': `${values?.count} eigen velden`,
    'taskGrid.summary.internalRelations': `${values?.count} interne relaties`,
    'taskGrid.summary.externalRelations': `${values?.count} externe relaties`,
    'taskGrid.summary.baselineMissing': 'Niet aanwezig in deze baseline',
  }[key] ?? key),
  signedWorkDaysBetween: () => 42,
};
const registry = buildTaskColumnRegistry({
  projectId: ctx.projectId,
  activityCodeTypes: [{
    id: 'fase:1', name: 'Fase', values: [{ id: 'v-1', code: 'A' }, { id: 'v-2', code: 'A' }],
  }],
  customFieldDefs: [{ id: 'cf:1', name: 'Eigen veld', type: 'text' }],
  customTaskTypes: [{ id: 'custom-installation', name: 'Speciale installatie' }],
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
eq('ene relationIndex draagt driving, vrije speling en waarschuwingen per sequence-id',
  ctx.relationIndex.analysisBySequenceId.get('s-1'), {
    driving: true, freeFloat: 0, warnings: ['dropped', 'truncated-lead', 'out-of-sequence'],
  });
eq('ene relationIndex draagt sourceMissing als externe waarschuwing',
  ctx.relationIndex.warningsByExternalLinkId.get('ext-1'), ['source-missing']);
eq('ene relationIndex bouwt trace-input tijdens dezelfde sequencepass', {
  predecessors: ctx.relationIndex.tracePredecessorsByTaskId.get(task.id),
  successors: ctx.relationIndex.traceSuccessorsByTaskId.get('other'),
}, {
  predecessors: [{ otherTaskId: 'other', sequenceId: 's-1', driving: true }],
  successors: [{ otherTaskId: task.id, sequenceId: 's-1', driving: true }],
});

eq('categorievolgorde is exact', TASK_COLUMN_CATEGORY_ORDER,
  ['task', 'planning', 'constraints', 'relations', 'resources', 'progress', 'computed', 'baseline', 'custom', 'technical']);
ok('registry zelf staat in dezelfde vaste categorievolgorde', registry.every((column, index) =>
  index === 0 || TASK_COLUMN_CATEGORY_ORDER.indexOf(registry[index - 1].category)
    <= TASK_COLUMN_CATEGORY_ORDER.indexOf(column.category)));
eq('registry-ids zijn uniek', new Set(registry.map(column => column.id)).size, registry.length);
const relationDriving = registry.find(column => column.id === 'relation.driving')!;
const relationFreeFloat = registry.find(column => column.id === 'relation.freeFloat')!;
const relationWarnings = registry.find(column => column.id === 'relation.warnings')!;
eq('relation.driving is apart, read-only en plannerafgeleid', {
  exists: !!relationDriving, readOnly: relationDriving?.readOnly, derived: relationDriving?.scheduleDerived,
  value: relationDriving?.format(relationDriving.read(task, ctx), task, ctx),
}, { exists: true, readOnly: true, derived: true, value: '← 0.9' });
eq('relation.freeFloat is een aparte read-only kolom per betrokken WBS',
  relationFreeFloat.format(relationFreeFloat.read(task, ctx), task, ctx), '← 0.9: 0d');
eq('relation.warnings is een aparte read-only kolom met alle indexmeldingen',
  relationWarnings.format(relationWarnings.read(task, ctx), task, ctx),
  '← 0.9: niet meegerekend, lead afgekapt, buiten volgorde; ← Bron: bron ontbreekt');
ok('vaste naamkolom bestaat', registry.some(column => column.id === 'task.name'));
const customTaskType = registry.find(column => column.id === 'task.customTaskTypeId')!;
eq('projecttaaktypekolom biedt de stabiele id met de projectnaam aan', customTaskType.editorOptions, [
  { value: '', label: '—' },
  { value: 'custom-installation', label: 'Speciale installatie' },
]);
const durationUnit = registry.find(column => column.id === 'task.time.durationUnit')!;
eq('duureenheid is een gewone bewaakte enumcel, niet een berekende kolom', {
  editorKind: durationUnit.editorKind,
  readOnly: typeof durationUnit.readOnly === 'function'
    ? durationUnit.readOnly(task, ctx)
    : durationUnit.readOnly,
  value: durationUnit.read(task, ctx),
}, { editorKind: 'enum', readOnly: false, value: 'days' });
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

const otherProjectCtx: TaskColumnContext = { ...ctx, projectId: 'ander-project' };
const activityCode = registry.find(column => column.id === activityCodeColumnId(ctx.projectId, 'fase:1'))!;
const customField = registry.find(column => column.id === customFieldColumnId(ctx.projectId, 'cf:1'))!;
ok('activity-codekolom is alleen in het eigen project beschikbaar',
  activityCode.available(ctx) && !activityCode.available(otherProjectCtx));
ok('custom-fieldkolom is alleen in het eigen project beschikbaar',
  customField.available(ctx) && !customField.available(otherProjectCtx));

const taskWithoutBaseline = { ...task, id: 't-zonder-baseline' } as Task;
const missingBaselineValue = baselineStart.read(taskWithoutBaseline, ctx);
eq('ontbrekende baselinetaak toont een liggend streepje',
  baselineStart.format(missingBaselineValue, taskWithoutBaseline, ctx), '—');
eq('ontbrekende baselinetaak kopieert leeg', baselineStart.copy(taskWithoutBaseline, ctx), '');
eq('ontbrekende baselinetaak legt de lege cel uit',
  baselineStart.tooltip?.(missingBaselineValue, taskWithoutBaseline, ctx),
  'Niet aanwezig in deze baseline');

const expectedAssignmentTokens = [
  { assignmentId: 'a-1', resourceId: 'r-1', unitsPerDay: 1 },
  { assignmentId: 'a-2', curve: 'FRONT_LOADED', resourceId: 'r-2', unitsPerDay: 0.5 },
  { assignmentId: 'a-3', resourceId: 'r-3', unitsPerDay: 2 },
];
for (const id of ['assignment.resources', 'assignment.unitsPerDay', 'assignment.curve']) {
  const column = registry.find(candidate => candidate.id === id)!;
  const copied = column.copy(task, ctx);
  ok(`${id}: zichtbare labels blijven in het klembord staan`, copied.startsWith(
    id === 'assignment.resources' ? 'Dubbele ploeg, Dubbele ploeg, Ploeg, Noord; nacht' : 'Dubbele ploeg:',
  ));
  const parsed = column.parse!(copied, task, ctx);
  ok(`${id}: id-dragende klembordinhoud parseert`, parsed.ok);
  if (!parsed.ok) continue;
  const validated = column.validate!(parsed.value, task, ctx);
  ok(`${id}: id-dragende klembordinhoud valideert`, validated.ok);
  if (!validated.ok) continue;
  const planned = column.planWrite!(validated.value, task, ctx);
  eq(`${id}: writer plant exact één volledige assignment-set op ids`, planned.ok ? planned.value : planned, [{
    kind: 'assignment-set', taskId: task.id, columnId: column.id, tokens: expectedAssignmentTokens,
  }]);
}

const assignedResources = registry.find(column => column.id === 'assignment.resources')!;
eq('Assignmenteditor blijft gesloten op summary en mijlpaal', [
  (assignedResources.readOnly as (task: Task, ctx: TaskColumnContext) => boolean)(
    { ...task, childIds: ['kind'] }, ctx,
  ),
  (assignedResources.readOnly as (task: Task, ctx: TaskColumnContext) => boolean)(
    { ...task, isMilestone: true }, ctx,
  ),
], [true, true]);
const workWindowStart = registry.find(column => column.id === 'assignment.workWindowStart')!;
eq('Werkvenster toont resource-label en volledige waarde in plaats van alleen een telling',
  workWindowStart.format(workWindowStart.read(task, ctx), task, ctx),
  'Dubbele ploeg: 2026-01-01');
eq('Werkvenster blijft canoniek en volledig kopieerbaar',
  workWindowStart.copy(task, ctx),
  canonicalGridJson([
    { assignmentId: 'a-1', workWindowStart: '2026-01-01' },
    { assignmentId: 'a-2' },
    { assignmentId: 'a-3' },
  ]));
const ambiguousResource = assignedResources.parse!('Dubbele ploeg', task, ctx);
eq('een handmatig dubbel resourcelabel wordt gericht geweigerd',
  ambiguousResource.ok ? null : ambiguousResource.errors[0].code, 'assignmentAmbiguous');
const mismatchedAssignment = assignedResources.validate!([{
  assignmentId: 'a-1', resourceId: 'r-2', unitsPerDay: 1,
}], task, ctx);
eq('een assignment-id mag niet naar een andere resource verschuiven',
  mismatchedAssignment.ok ? null : mismatchedAssignment.errors[0].code, 'assignmentIdentity');
const duplicateAssignmentResource = assignedResources.validate!([
  { assignmentId: 'a-1', resourceId: 'r-1', unitsPerDay: 1 },
  { resourceId: 'r-1', unitsPerDay: 2 },
], task, ctx);
eq('een resource mag maar één keer in de volledige assignment-set staan',
  duplicateAssignmentResource.ok ? null : duplicateAssignmentResource.errors[0].code,
  'assignmentDuplicateResource');
const zeroAssignmentUnits = assignedResources.validate!([{
  assignmentId: 'a-1', resourceId: 'r-1', unitsPerDay: 0,
}], task, ctx);
eq('assignmenttokens weigeren nul eenheden',
  zeroAssignmentUnits.ok ? null : zeroAssignmentUnits.errors[0].code, 'assignments');

const emptyAssignmentCtx: TaskColumnContext = {
  ...ctx, assignmentsByTaskId: new Map([[task.id, []]]),
};
eq('een lege assignmentcel kopieert echt leeg', assignedResources.copy(task, emptyAssignmentCtx), '');
const parsedEmptyAssignments = assignedResources.parse!('', task, emptyAssignmentCtx);
eq('een lege assignmentcel plant een lege volledige set', parsedEmptyAssignments.ok
  ? assignedResources.planWrite!(parsedEmptyAssignments.value, task, emptyAssignmentCtx)
  : parsedEmptyAssignments, {
  ok: true, value: [{ kind: 'assignment-set', taskId: task.id, columnId: assignedResources.id, tokens: [] }],
});

const activityCopy = activityCode.copy(task, ctx);
const parsedActivity = activityCode.parse!(activityCopy, task, ctx);
const validatedActivity = parsedActivity.ok
  ? activityCode.validate!(parsedActivity.value, task, ctx)
  : parsedActivity;
const plannedActivity = validatedActivity.ok
  ? activityCode.planWrite!(validatedActivity.value, task, ctx)
  : validatedActivity;
eq('dubbele activity-code behoudt via klembord exact waarde-id v-2',
  plannedActivity.ok ? plannedActivity.value : plannedActivity, [{
    kind: 'cell-edit', taskId: task.id, columnId: activityCodeColumnId(ctx.projectId, 'fase:1'),
    route: 'activity-code', value: 'v-2',
  }]);
const ambiguousCodeParsed = activityCode.parse!('A', task, ctx);
const ambiguousCode = ambiguousCodeParsed.ok
  ? activityCode.validate!(ambiguousCodeParsed.value, task, ctx)
  : ambiguousCodeParsed;
eq('een handmatig dubbele activity-code wordt gericht geweigerd',
  ambiguousCode.ok ? null : ambiguousCode.errors[0].code, 'activityCodeAmbiguous');

const routeCases: readonly [string, unknown, string][] = [
  ['task.name', 'Nieuwe naam', 'task-field'],
  ['task.time.scheduleStart', '2026-01-02', 'task-schedule'],
  ['task.status', 'STARTED', 'task-progress'],
  ['task.isMilestone', true, 'task-milestone'],
  ['task.constraint.type', 'ASAP', 'task-constraint'],
  ['task.isHammock', true, 'task-hammock'],
  [activityCode.id, 'v-2', 'activity-code'],
  [customField.id, 'Inhoud', 'custom-field'],
];
for (const [id, value, route] of routeCases) {
  const column = registry.find(candidate => candidate.id === id)!;
  const planned = column.planWrite!(value, task, ctx);
  const intent = planned.ok ? planned.value[0] : undefined;
  eq(`${id}: gebruikt de expliciete bewaakte schrijfroute`,
    intent?.kind === 'cell-edit' ? intent.route : null, route);
}

const wbs = registry.find(column => column.id === 'task.wbsCode')!;
const autoNumberCtx: TaskColumnContext = { ...ctx, wbsAutoNumber: true };
eq('WBS is conditioneel read-only bij autonummering',
  typeof wbs.readOnly === 'function' && wbs.readOnly(task, autoNumberCtx), true);
const blockedWbs = wbs.planWrite!('2', task, autoNumberCtx);
eq('conditioneel read-only WBS plant geen intent',
  blockedWbs.ok ? null : blockedWbs.errors[0].code, 'readOnly');

const duration = registry.find(column => column.id === 'task.time.scheduleDuration')!;
const translatedDurationCtx: TaskColumnContext = {
  ...ctx,
  labelForText: key => key === 'duration.suffixDay' ? 'T' : key,
};
eq('duurweergave vertaalt de suffix zonder de canonieke kopieervorm te wijzigen', {
  display: duration.format(duration.read(task, translatedDurationCtx), task, translatedDurationCtx),
  copy: duration.copy(task, translatedDurationCtx),
}, { display: '1T', copy: '1d' });
const hammockTask = { ...task, isHammock: true } as Task;
eq('duur is conditioneel read-only voor een hammock',
  typeof duration.readOnly === 'function' && duration.readOnly(hammockTask, ctx), true);
const blockedDuration = duration.planWrite!(2, hammockTask, ctx);
eq('conditioneel read-only hammockduur plant geen intent',
  blockedDuration.ok ? null : blockedDuration.errors[0].code, 'readOnly');

function isReadOnly(column: TaskColumnDescriptor): boolean {
  return typeof column.readOnly === 'function' ? column.readOnly(task, ctx) : column.readOnly;
}
for (const column of registry) {
  if (column.readOnly === true) {
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
        if (isReadOnly(column)) {
          ok(`${column.id}: conditioneel read-only plant geen intent`,
            planned?.ok === false && planned.errors[0]?.code === 'readOnly');
        } else {
          ok(`${column.id}: writer plant minstens één echte intent`, !!planned?.ok && planned.value.length > 0);
        }
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
