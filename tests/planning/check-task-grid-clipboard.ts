import { useAppStore } from '@/state/appStore';
import { buildTaskColumnRegistry } from '@/engine/taskGrid/taskColumnRegistry';
import { buildTaskRelationIndex } from '@/engine/taskGrid/relationIndex';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { createTaskGridRowIndex } from '@/engine/taskGrid/rowIndex';
import { createEmptyGridSelection, updateGridSelection } from '@/engine/taskGrid/selection';
import {
  copyTaskGridSelection,
  parseTaskGridTsv,
  planTaskGridClear,
  planTaskGridPaste,
  serializeTaskGridTsv,
  type TaskGridClipboardEnvironment,
} from '@/engine/taskGrid/clipboard';
import {
  formatGridDate,
  formatGridDateTime,
  parseGridDate,
  parseGridDateTime,
} from '@/engine/taskGrid/editors';
import type { Task } from '@/types/task';
import type { TaskColumnContext, TaskColumnId } from '@/types/taskGrid';
import type { ViewRow } from '@/engine/view/visibleRows';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, value: boolean): void {
  checks++;
  if (!value) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
}

// Excel-TSV: rechthoek, quoting en regeleinden moeten bytegetrouw roundtrippen.
{
  const matrix = [
    ['', 'a\tb', 'regel 1\nregel 2'],
    ['"tekst"', 'cr\rinhoud', ''],
    ['', '', ''],
  ];
  const serialized = serializeTaskGridTsv(matrix);
  eq('TSV schrijft CRLF buiten quotes', serialized.includes('\r\n'), true);
  eq('TSV quote tab en verdubbelt quotes', serialized.includes('"a\tb"') && serialized.includes('"""tekst"""'), true);
  const parsed = parseTaskGridTsv(serialized);
  eq('TSV roundtrip met tabs/newlines/quotes/trailing lege rij', parsed.ok ? parsed.value : parsed.errors, matrix);
  eq('TSV accepteert LF als rijgrens', parseTaskGridTsv('a\tb\nc\td'), { ok: true, value: [['a', 'b'], ['c', 'd']] });
  eq('TSV behoudt CRLF binnen quotes', parseTaskGridTsv('"a\r\nb"\tc'), { ok: true, value: [['a\r\nb', 'c']] });
  eq('TSV behoudt twee trailing lege rijen', parseTaskGridTsv('a\r\n\r\n'), { ok: true, value: [['a'], [''], ['']] });
  const twoByThree = [['a', '', 'c'], ['d', 'e', 'f']];
  eq('TSV roundtript een exacte 2x3-rechthoek', parseTaskGridTsv(serializeTaskGridTsv(twoByThree)), {
    ok: true, value: twoByThree,
  });
  eq('Ongesloten quote weigert hele TSV', parseTaskGridTsv('"open'), {
    ok: false, errors: [{ code: 'tsvQuote', messageKey: 'taskGrid.validation.tsvQuote', value: '"open' }],
  });
  eq('Ragged TSV weigert rechthoek', parseTaskGridTsv('a\tb\r\nc'), {
    ok: false, errors: [{ code: 'tsvRectangle', messageKey: 'taskGrid.validation.tsvRectangle', value: 'c' }],
  });
}

// Persoonlijke datumweergave blijft aan de rand; de planningswaarde is ISO.
eq('Datum dmy naar ISO', parseGridDate('31-12-2026', 'dmy'), '2026-12-31');
eq('Datum mdy naar ISO', parseGridDate('12/31/2026', 'mdy'), '2026-12-31');
eq('Datum ymd naar ISO', parseGridDate('2026.12.31', 'ymd'), '2026-12-31');
eq('Niet-bestaande persoonlijke datum weigert', parseGridDate('31-02-2026', 'dmy'), null);
eq('Datumtijd dmy naar ISO-minuut', parseGridDateTime('31-12-2026 08:45', 'dmy'), '2026-12-31T08:45');
eq('Datumtijd met ongeldige tijd weigert', parseGridDateTime('31-12-2026 24:00', 'dmy'), null);
eq('ISO-datum naar mdy-weergave', formatGridDate('2026-12-31', 'mdy'), '12-31-2026');
eq('ISO-datumtijd naar dmy-weergave', formatGridDateTime('2026-12-31T08:45', 'dmy'), '31-12-2026 08:45');

const S = () => useAppStore.getState();
S().newProject();
const firstId = S().addTask({ name: 'Eerste' });
const secondId = S().addTask({ name: 'Tweede' });
const firstBase = S().tasks.find(task => task.id === firstId)!;
const secondBase = S().tasks.find(task => task.id === secondId)!;
const first: Task = {
  ...firstBase,
  description: 'A\tB',
  time: { ...firstBase.time, totalFloat: 2, scheduleStart: '2026-12-31T08:45' },
};
const second: Task = { ...secondBase, description: 'Regel 1\nRegel 2' };
const descriptors = buildTaskColumnRegistry({
  projectId: S().project.id, activityCodeTypes: [], customFieldDefs: [], baselines: [],
});
const context: TaskColumnContext = {
  projectId: S().project.id,
  tasksById: new Map([[first.id, first], [second.id, second]]),
  relationIndex: buildTaskRelationIndex([first, second], []),
  assignmentsByTaskId: new Map(), resourcesById: new Map(), baselinesById: new Map(),
  scheduleStale: true, effectiveHoursPerDay: () => 8,
};
const descriptorMap = new Map(descriptors.map(descriptor => [descriptor.id, descriptor]));
const taskRow = (task: Task, rowKey = task.id): ViewRow => ({
  kind: 'task', rowKey, task, depth: 0, dimmed: false,
});
const groupRow: ViewRow = {
  kind: 'group', rowKey: 'groep', key: 'groep', label: 'Band', count: 2,
  depth: 0, levelIndex: 0, collapsed: false,
};
const columns = [taskColumnId('task.name'), taskColumnId('task.description')];

function environment(
  rows: readonly ViewRow[],
  visibleColumns: readonly TaskColumnId[],
  start: { rowKey: string; columnId: TaskColumnId },
  end = start,
): TaskGridClipboardEnvironment {
  const rowIndex = createTaskGridRowIndex(rows);
  let selection = updateGridSelection(createEmptyGridSelection(), start, rowIndex, visibleColumns, 'replace');
  if (end.rowKey !== start.rowKey || end.columnId !== start.columnId) {
    selection = updateGridSelection(selection, end, rowIndex, visibleColumns, 'extend');
  }
  return {
    selection, rowIndex, columns: visibleColumns, descriptors: descriptorMap,
    context, dateNotation: 'dmy', booleanLabels: { true: 'Oui', false: 'Non' },
  };
}

function liveEnvironment(
  taskId: string,
  visibleColumns: readonly TaskColumnId[],
): TaskGridClipboardEnvironment {
  const state = S();
  const task = state.tasks.find(candidate => candidate.id === taskId)!;
  const liveDescriptors = buildTaskColumnRegistry({
    projectId: state.project.id,
    activityCodeTypes: state.activityCodeTypes,
    customFieldDefs: state.customFieldDefs,
    baselines: state.baselines,
  });
  const assignmentsByTaskId = new Map<string, typeof state.assignments>();
  for (const assignment of state.assignments) {
    const current = assignmentsByTaskId.get(assignment.taskId);
    if (current) current.push(assignment);
    else assignmentsByTaskId.set(assignment.taskId, [assignment]);
  }
  const liveContext: TaskColumnContext = {
    projectId: state.project.id,
    tasksById: new Map(state.tasks.map(candidate => [candidate.id, candidate])),
    relationIndex: buildTaskRelationIndex(state.tasks, state.sequences, state.cpmResult),
    assignmentsByTaskId,
    resourcesById: new Map(state.resources.map(resource => [resource.id, resource])),
    baselinesById: new Map(state.baselines.map(baseline => [baseline.id, baseline])),
    scheduleStale: state.scheduleStale,
    wbsAutoNumber: state.project.wbsAutoNumber === true,
    effectiveHoursPerDay: () => 8,
  };
  const rows = [taskRow(task)];
  const rowIndex = createTaskGridRowIndex(rows);
  const start = { rowKey: task.id, columnId: visibleColumns[0] };
  const end = { rowKey: task.id, columnId: visibleColumns[visibleColumns.length - 1] };
  let selection = updateGridSelection(createEmptyGridSelection(), start, rowIndex, visibleColumns, 'replace');
  if (visibleColumns.length > 1) selection = updateGridSelection(selection, end, rowIndex, visibleColumns, 'extend');
  return {
    selection,
    rowIndex,
    columns: visibleColumns,
    descriptors: new Map(liveDescriptors.map(descriptor => [descriptor.id, descriptor])),
    context: liveContext,
    dateNotation: 'dmy',
    booleanLabels: { true: 'Oui', false: 'Non' },
  };
}

function planAndCommitPaste(
  taskId: string,
  visibleColumns: readonly TaskColumnId[],
  text: string,
): { planned: boolean; committed: boolean } {
  const planned = planTaskGridPaste(text, liveEnvironment(taskId, visibleColumns));
  if (!planned.ok) return { planned: false, committed: false };
  return { planned: true, committed: S().runGridMutation([planned.value]).ok };
}

// Kopie volgt visuele volgorde; groepskop levert geen lege TSV-rij.
{
  const env = environment(
    [taskRow(first), groupRow, taskRow(second)], columns,
    { rowKey: first.id, columnId: columns[0] },
    { rowKey: second.id, columnId: columns[1] },
  );
  const copied = copyTaskGridSelection(env);
  eq('Kopie slaat groepskop over en quote tekstinhoud', copied.ok ? copied.value : copied.errors,
    'Eerste\t"A\tB"\r\nTweede\t"Regel 1\nRegel 2"');
}

// Mapping: alleen 1×1 vult; grotere matrices moeten passen of exact matchen.
{
  const range = environment(
    [taskRow(first), taskRow(second)], columns,
    { rowKey: first.id, columnId: columns[0] },
    { rowKey: second.id, columnId: columns[1] },
  );
  const filled = planTaskGridPaste('x', range);
  eq('1x1 vult grotere 2x2-selectie', filled.ok ? filled.value.writes.length : filled.errors, 4);
  const exact = planTaskGridPaste('Naam 1\tOmschrijving 1\r\nNaam 2\tOmschrijving 2', range);
  eq('2x2 plakt exact op 2x2-selectie', exact.ok ? exact.value.writes.length : exact.errors, 4);
  const mismatch = planTaskGridPaste('a\tb\tc\r\nd\te\tf', range);
  eq('2x3 mag niet tilen of afkappen op 2x2-selectie', mismatch.ok, false);

  const fromActive = environment(
    [taskRow(first), taskRow(second)], columns,
    { rowKey: first.id, columnId: columns[0] },
  );
  eq('Grotere bron plakt eenmaal vanaf active als hij past',
    planTaskGridPaste('n1\td1\r\nn2\td2', fromActive).ok, true);
  const atEdge = environment(
    [taskRow(first), taskRow(second)], columns,
    { rowKey: second.id, columnId: columns[1] },
  );
  eq('Grotere bron buiten beschikbare taakcellen weigert volledig',
    planTaskGridPaste('n1\td1\r\nn2\td2', atEdge).ok, false);
}

// Duplicate occurrences: dezelfde write dedupliceert, verschillende waarden blokkeren alles.
{
  const duplicateRows = [taskRow(first, 'band-a/eerste'), taskRow(first, 'band-b/eerste')];
  const oneColumn = [taskColumnId('task.description')];
  const env = environment(
    duplicateRows, oneColumn,
    { rowKey: duplicateRows[0].rowKey, columnId: oneColumn[0] },
    { rowKey: duplicateRows[1].rowKey, columnId: oneColumn[0] },
  );
  const equal = planTaskGridPaste('zelfde\r\nzelfde', env);
  eq('Gelijke duplicate-occurrencewrites dedupliceren', equal.ok ? equal.value.writes.length : equal.errors, 1);
  const conflict = planTaskGridPaste('links\r\nrechts', env);
  eq('Tegenstrijdige duplicate-occurrencewrites weigeren alles', conflict.ok, false);
  eq('Conflict noemt eerste doeladres en bronwaarde', conflict.ok ? null : conflict.errors[0], {
    code: 'conflictingDuplicate', messageKey: 'taskGrid.validation.conflictingDuplicate',
    taskId: first.id, rowKey: 'band-b/eerste', columnId: oneColumn[0], value: 'rechts',
  });

  const optionalDate = taskColumnId('task.constraint.date');
  const emptyOptional = planTaskGridPaste('\r\n', environment(
    duplicateRows, [optionalDate],
    { rowKey: duplicateRows[0].rowKey, columnId: optionalDate },
    { rowKey: duplicateRows[1].rowKey, columnId: optionalDate },
  ));
  eq('Gelijke undefined-writes uit lege optionele cellen verdwijnen als gezamenlijke no-op',
    emptyOptional.ok ? emptyOptional.value.writes.length : emptyOptional.errors, 0);
}

// Registryparsers en read-only gelden vóór er één PasteIntent ontstaat.
{
  const rows = [taskRow(first)];
  const parsedCases: Array<[string, TaskColumnId, string, unknown]> = [
    ['tekst', taskColumnId('task.description'), 'letterlijk', 'letterlijk'],
    ['percentage', taskColumnId('task.time.completion'), '25%', 0.25],
    ['boolean', taskColumnId('task.isMilestone'), 'ja', true],
    ['enum', taskColumnId('task.taskType'), 'installation', 'INSTALLATION'],
    ['datum', taskColumnId('task.constraint.date'), '31-12-2026', '2026-12-31'],
    ['datumtijd', taskColumnId('task.time.scheduleStart'), '30-12-2026 08:45', '2026-12-30T08:45'],
    ['duur', taskColumnId('task.time.scheduleDuration'), '2d 4u', 1200],
    ['leeg', taskColumnId('task.description'), '', ''],
  ];
  for (const [label, columnId, source, expected] of parsedCases) {
    const env = environment(rows, [columnId], { rowKey: first.id, columnId });
    const planned = planTaskGridPaste(source, env);
    eq(`${label} wordt vóór PasteIntent naar interne waarde geparsed`,
      planned.ok && planned.value.writes[0]?.kind === 'cell-edit'
        ? planned.value.writes[0].value
        : planned.ok ? planned.value.writes : planned.errors,
      expected);
  }

  const localizedBoolean = taskColumnId('task.isMilestone');
  const localizedBooleanEnv = environment(rows, [localizedBoolean], {
    rowKey: first.id, columnId: localizedBoolean,
  });
  eq('Gelokaliseerde boolean wordt in dezelfde taal gekopieerd',
    copyTaskGridSelection(localizedBooleanEnv), { ok: true, value: 'Non' });
  const localizedBooleanPaste = planTaskGridPaste('Oui', localizedBooleanEnv);
  eq('Gelokaliseerde boolean wordt vanuit het klembord teruggeparsed',
    localizedBooleanPaste.ok && localizedBooleanPaste.value.writes[0]?.kind === 'cell-edit'
      ? localizedBooleanPaste.value.writes[0].value
      : localizedBooleanPaste,
    true);

  const predecessors = taskColumnId('relation.predecessors');
  const relationEnv = environment(rows, [predecessors], { rowKey: first.id, columnId: predecessors });
  const relationPaste = planTaskGridPaste('1.2 FS+2d', relationEnv);
  eq('Niet-celplanner blijft als atomische write in PasteIntent behouden',
    relationPaste.ok ? relationPaste.value.writes : relationPaste.errors,
    [{
      kind: 'relation-set', taskId: first.id, direction: 'predecessor', value: [{
        kind: 'internal', wbsCode: '1.2', relType: 'FS', lagText: '+2d',
        source: { index: 0, start: 0, end: 9, text: '1.2 FS+2d' },
      }],
    }]);

  const resources = taskColumnId('assignment.resources');
  const assignmentEnv = environment(rows, [resources], { rowKey: first.id, columnId: resources });
  const assignmentClear = planTaskGridPaste('', assignmentEnv);
  eq('Lege assignment op een al lege taak verdwijnt als no-op vóór PasteIntent',
    assignmentClear.ok ? assignmentClear.value.writes : assignmentClear.errors,
    []);

  const computed = taskColumnId('task.time.totalFloat');
  const computedEnv = environment(rows, [computed], { rowKey: first.id, columnId: computed });
  eq('Verouderde berekende cel kopieert canonieke waarde',
    copyTaskGridSelection(computedEnv), { ok: true, value: '2' });
  const calculatedPaste = planTaskGridPaste('3', computedEnv);
  eq('Berekende cel weigert paste', calculatedPaste.ok, false);
  eq('Read-onlyfout bevat exact doeladres en bronwaarde', calculatedPaste.ok ? null : calculatedPaste.errors[0], {
    code: 'readOnly', messageKey: 'taskGrid.validation.readOnly', taskId: first.id,
    rowKey: first.id, columnId: computed, value: '3',
  });
}

// Delete/Backspace gebruikt dezelfde atomaire lege-planner.
{
  const mixed = environment(
    [taskRow(first)], columns,
    { rowKey: first.id, columnId: columns[0] },
    { rowKey: first.id, columnId: columns[1] },
  );
  eq('Niet-leegbare naam blokkeert clear van hele gemengde selectie', planTaskGridClear(mixed).ok, false);
  const descriptions = environment(
    [taskRow(first), taskRow(second)], [columns[1]],
    { rowKey: first.id, columnId: columns[1] },
    { rowKey: second.id, columnId: columns[1] },
  );
  const cleared = planTaskGridClear(descriptions);
  ok('Clear van schrijfbare beschrijvingen plant één PasteIntent', cleared.ok);
  eq('Clear plant twee lege waarden', cleared.ok
    ? cleared.value.writes.map(write => write.kind === 'cell-edit' ? write.value : write)
    : cleared.errors, ['', '']);
}

// Productieketen: dynamisch schrijfbare cellen worden tegen de gezamenlijke paste-eindtoestand
// beoordeeld. Deze regressies lopen bewust via planTaskGridPaste én de echte storetransactie.
{
  S().newProject();
  const ordinaryNoop = S().addTask({ name: 'Ongewijzigd doel' });
  S().setWbsAutoNumber(true);
  const noopCases = [
    {
      label: 'auto-WBS en naam',
      columns: [taskColumnId('task.wbsCode'), taskColumnId('task.name')],
    },
    {
      label: 'mijlpaalmetadata zonder mijlpaalkolom',
      columns: [taskColumnId('task.milestoneKind'), taskColumnId('task.mandatory')],
    },
    {
      label: 'harde pin zonder constrainttypekolom',
      columns: [taskColumnId('task.constraint.hard')],
    },
  ];
  for (const noopCase of noopCases) {
    const env = liveEnvironment(ordinaryNoop, noopCase.columns);
    const copied = copyTaskGridSelection(env);
    const planned = copied.ok ? planTaskGridPaste(copied.value, env) : copied;
    eq(`${noopCase.label}: ongewijzigde conditionele cellen plannen nul writes`,
      planned.ok ? planned.value.writes.length : planned.errors, 0);
    const beforeHistory = S().historyEvents.length;
    const committed = planned.ok ? S().runGridMutation([planned.value]) : planned;
    eq(`${noopCase.label}: no-op paste commit zonder fout`, committed.ok, true);
    eq(`${noopCase.label}: no-op paste maakt geen historyevent`,
      S().historyEvents.length, beforeHistory);
  }

  const changedMetadata = planTaskGridPaste(
    'START',
    liveEnvironment(ordinaryNoop, [taskColumnId('task.milestoneKind')]),
  );
  const changedMetadataCommit = changedMetadata.ok
    ? S().runGridMutation([changedMetadata.value])
    : changedMetadata;
  eq('Mijlpaalmetadata mag zichzelf zonder controller niet schrijfbaar maken',
    changedMetadataCommit.ok, false);
  eq('Zelf-openende mijlpaalmetadata blijft readOnly',
    changedMetadataCommit.ok ? null : changedMetadataCommit.errors[0]?.code, 'readOnly');

  S().newProject();
  const milestoneTask = S().addTask({ name: 'Wordt mijlpaal' });
  const milestoneColumns = [
    taskColumnId('task.isMilestone'),
    taskColumnId('task.milestoneKind'),
    taskColumnId('task.mandatory'),
  ];
  eq('Gewone taak → mijlpaal plant en commit via de echte clipboardketen',
    planAndCommitPaste(milestoneTask, milestoneColumns, 'Oui\tSTART\tOui'),
    { planned: true, committed: true });
  eq('Clipboardketen levert de gezamenlijke mijlpaaleindtoestand', (() => {
    const task = S().tasks.find(candidate => candidate.id === milestoneTask)!;
    return [task.isMilestone, task.milestoneKind, task.mandatory, task.time.scheduleDuration];
  })(), [true, 'START', true, 0]);

  for (const reverse of [false, true]) {
    S().newProject();
    const taskId = S().addTask({ name: `Volledige mijlpaalrij ${reverse}` });
    const columns = reverse ? [
      taskColumnId('task.mandatory'),
      taskColumnId('task.milestoneKind'),
      taskColumnId('task.isMilestone'),
      taskColumnId('assignment.resources'),
      taskColumnId('task.isHammock'),
      taskColumnId('task.time.scheduleDuration'),
    ] : [
      taskColumnId('task.time.scheduleDuration'),
      taskColumnId('task.isHammock'),
      taskColumnId('assignment.resources'),
      taskColumnId('task.isMilestone'),
      taskColumnId('task.milestoneKind'),
      taskColumnId('task.mandatory'),
    ];
    const text = reverse
      ? 'Oui\tSTART\tOui\t\tNon\t0d'
      : '0d\tNon\t\tOui\tSTART\tOui';
    eq(`Volledige mijlpaalrij met duur, hammock en lege assignments ${reverse}`,
      planAndCommitPaste(taskId, columns, text), { planned: true, committed: true });
    const task = S().tasks.find(candidate => candidate.id === taskId)!;
    eq(`Volledige mijlpaalrij eindtoestand ${reverse}`,
      [task.isMilestone, task.milestoneKind, task.mandatory, task.isHammock ?? false,
        task.time.scheduleDuration, S().assignments.filter(item => item.taskId === taskId).length],
      [true, 'START', true, false, 0, 0]);
  }

  for (const reverse of [false, true]) {
    S().newProject();
    const taskId = S().addTask({ name: `Constraint ${reverse}` });
    const columns = reverse
      ? [taskColumnId('task.constraint.hard'), taskColumnId('task.constraint.type')]
      : [taskColumnId('task.constraint.type'), taskColumnId('task.constraint.hard')];
    const text = reverse ? 'Oui\tMSO' : 'MSO\tOui';
    eq(`Constrainttype + hard commit onafhankelijk van kolomvolgorde ${reverse}`,
      planAndCommitPaste(taskId, columns, text), { planned: true, committed: true });
    eq(`Constrainttype + hard gezamenlijke eindtoestand ${reverse}`,
      S().tasks.find(candidate => candidate.id === taskId)?.constraint,
      { type: 'MSO', date: S().tasks.find(candidate => candidate.id === taskId)?.time.scheduleStart, hard: true });
  }

  const constraintOrders = [
    ['type', 'date', 'hard'], ['type', 'hard', 'date'],
    ['date', 'type', 'hard'], ['date', 'hard', 'type'],
    ['hard', 'type', 'date'], ['hard', 'date', 'type'],
  ] as const;
  for (const [index, order] of constraintOrders.entries()) {
    S().newProject();
    const taskId = S().addTask({ name: `Volledige constraint ${index}` });
    const values = { type: 'MSO', date: '27-08-2026', hard: 'Oui' };
    const ids = {
      type: taskColumnId('task.constraint.type'),
      date: taskColumnId('task.constraint.date'),
      hard: taskColumnId('task.constraint.hard'),
    };
    eq(`Constraint type/datum/hard permutatie ${index} commit`,
      planAndCommitPaste(taskId, order.map(key => ids[key]), order.map(key => values[key]).join('\t')),
      { planned: true, committed: true });
    eq(`Constraint type/datum/hard permutatie ${index} eindtoestand`,
      S().tasks.find(candidate => candidate.id === taskId)?.constraint,
      { type: 'MSO', date: '2026-08-27', hard: true });
  }

  for (const reverse of [false, true]) {
    S().newProject();
    const taskId = S().addTask({ name: `Mijlpaal naar hammockveld ${reverse}`, isMilestone: true });
    const columns = reverse
      ? [taskColumnId('task.isHammock'), taskColumnId('task.isMilestone')]
      : [taskColumnId('task.isMilestone'), taskColumnId('task.isHammock')];
    eq(`Mijlpaal uit + hammock uit commit onafhankelijk van kolomvolgorde ${reverse}`,
      planAndCommitPaste(taskId, columns, 'Non\tNon'), { planned: true, committed: true });
    const task = S().tasks.find(candidate => candidate.id === taskId)!;
    eq(`Mijlpaal/hammock eindtoestand ${reverse}`,
      [task.isMilestone, task.isHammock ?? false], [false, false]);
  }

  // Ook de hangmatschakelaar is een controller: duur en assignments zijn in de gezamenlijke
  // eindtoestand alleen schrijfbaar vóór respectievelijk ná die overgang.
  for (const reverse of [false, true]) {
    S().newProject();
    const taskId = S().addTask({ name: `Hangmat uit met duur ${reverse}`, isHammock: true });
    const columns = reverse
      ? [taskColumnId('task.time.scheduleDuration'), taskColumnId('task.isHammock')]
      : [taskColumnId('task.isHammock'), taskColumnId('task.time.scheduleDuration')];
    const text = reverse ? '5d\tNon' : 'Non\t5d';
    eq(`Hangmat uit + duur commit onafhankelijk van kolomvolgorde ${reverse}`,
      planAndCommitPaste(taskId, columns, text), { planned: true, committed: true });
    const task = S().tasks.find(candidate => candidate.id === taskId)!;
    eq(`Hangmat uit + duur eindtoestand ${reverse}`,
      [task.isHammock ?? false, task.time.scheduleDuration], [false, 5]);
  }

  for (const reverse of [false, true]) {
    S().newProject();
    const resourceId = S().addResource({
      name: `Hangmatploeg ${reverse}`, type: 'LABOR', description: '', maxUnits: 4,
    });
    const taskId = S().addTask({ name: `Hangmat aan zonder resources ${reverse}` });
    S().assignResource(taskId, resourceId, 1);
    const columns = reverse
      ? [taskColumnId('task.isHammock'), taskColumnId('assignment.resources')]
      : [taskColumnId('assignment.resources'), taskColumnId('task.isHammock')];
    const text = reverse ? 'Oui\t' : '\tOui';
    eq(`Resources leeg + hangmat aan commit onafhankelijk van kolomvolgorde ${reverse}`,
      planAndCommitPaste(taskId, columns, text), { planned: true, committed: true });
    const task = S().tasks.find(candidate => candidate.id === taskId)!;
    eq(`Resources leeg + hangmat aan eindtoestand ${reverse}`,
      [task.isHammock ?? false, S().assignments.filter(item => item.taskId === taskId).length],
      [true, 0]);
  }

  S().newProject();
  const resourceId = S().addResource({ name: 'Ploeg', type: 'LABOR', description: '', maxUnits: 4 });
  const sourceTaskId = S().addTask({ name: 'Bron met assignment' });
  const emptyTargetId = S().addTask({ name: 'Leeg doel' });
  S().assignResource(sourceTaskId, resourceId, 2, 'BELL');
  const assignmentColumns = [
    taskColumnId('assignment.resources'),
    taskColumnId('assignment.unitsPerDay'),
    taskColumnId('assignment.curve'),
  ];
  const copiedAssignments = copyTaskGridSelection(liveEnvironment(sourceTaskId, assignmentColumns));
  const assignmentPaste = copiedAssignments.ok
    ? planAndCommitPaste(emptyTargetId, assignmentColumns, copiedAssignments.value)
    : { planned: false, committed: false };
  eq('Resources + units + curve plakken naar lege taak doorloopt de echte keten',
    assignmentPaste, { planned: true, committed: true });
  eq('Assignment-eindtoestand bewaart resource, tempo en curve',
    S().assignments.filter(assignment => assignment.taskId === emptyTargetId)
      .map(assignment => [assignment.resourceId, assignment.unitsPerDay, assignment.curve]),
    [[resourceId, 2, 'BELL']]);

  const existingTargetId = S().addTask({ name: 'Bestaand doel' });
  S().assignResource(existingTargetId, resourceId, 0.5);
  const existingPaste = copiedAssignments.ok
    ? planAndCommitPaste(existingTargetId, assignmentColumns, copiedAssignments.value)
    : { planned: false, committed: false };
  eq('Resources + units + curve vervangen een bestaande assignment als één eindtoestand',
    existingPaste, { planned: true, committed: true });
  eq('Bestaande assignment krijgt bronwaarden zonder bron-id over te nemen',
    S().assignments.filter(assignment => assignment.taskId === existingTargetId)
      .map(assignment => [assignment.resourceId, assignment.unitsPerDay, assignment.curve]),
    [[resourceId, 2, 'BELL']]);

  // Units en curve zijn afgeleide editors van bestaand assignmentlidmaatschap. Zonder een
  // resources-write in dezelfde transactie mogen zij een lege taak nooit stil een assignment
  // geven, ook niet wanneer hun rijke klembordpayload alle bronvelden bevat.
  for (const column of [taskColumnId('assignment.unitsPerDay'), taskColumnId('assignment.curve')]) {
    const emptyId = S().addTask({ name: `Leeg doel voor ${column}` });
    const copied = copyTaskGridSelection(liveEnvironment(sourceTaskId, [column]));
    const before = JSON.stringify({
      task: S().tasks.find(task => task.id === emptyId),
      assignments: S().assignments,
      history: S().historyEvents,
    });
    const planned = copied.ok ? planTaskGridPaste(copied.value, liveEnvironment(emptyId, [column])) : copied;
    const committed = planned.ok ? S().runGridMutation([planned.value]) : planned;
    eq(`${column} alleen naar lege taak wordt geweigerd`, committed.ok, false);
    eq(`${column} alleen rolt taak, assignments en history byte-identiek terug`, JSON.stringify({
      task: S().tasks.find(task => task.id === emptyId),
      assignments: S().assignments,
      history: S().historyEvents,
    }), before);
  }

  // Iedere visuele volgorde van de drie assignmentkolommen gebruikt dezelfde volledige payload.
  const assignmentOrders = [
    assignmentColumns,
    [assignmentColumns[0], assignmentColumns[2], assignmentColumns[1]],
    [assignmentColumns[1], assignmentColumns[0], assignmentColumns[2]],
    [assignmentColumns[1], assignmentColumns[2], assignmentColumns[0]],
    [assignmentColumns[2], assignmentColumns[0], assignmentColumns[1]],
    [assignmentColumns[2], assignmentColumns[1], assignmentColumns[0]],
  ];
  for (const [index, order] of assignmentOrders.entries()) {
    const targetId = S().addTask({ name: `Assignmentvolgorde ${index}` });
    const copied = copyTaskGridSelection(liveEnvironment(sourceTaskId, order));
    const result = copied.ok
      ? planAndCommitPaste(targetId, order, copied.value)
      : { planned: false, committed: false };
    eq(`Assignmentkolomvolgorde ${index} commit`, result, { planned: true, committed: true });
    eq(`Assignmentkolomvolgorde ${index} eindtoestand`,
      S().assignments.filter(assignment => assignment.taskId === targetId)
        .map(assignment => [assignment.resourceId, assignment.unitsPerDay, assignment.curve]),
      [[resourceId, 2, 'BELL']]);
  }

  // Een tegenstrijdige eindtoestand (mijlpaal mét assignment) wordt volledig teruggerold.
  const conflictingTarget = S().addTask({ name: 'Atomair conflict' });
  const beforeConflict = JSON.stringify({
    task: S().tasks.find(candidate => candidate.id === conflictingTarget),
    assignments: S().assignments,
  });
  const assignmentCell = copiedAssignments.ok ? copiedAssignments.value.split('\t')[0] : '';
  const conflictColumns = [taskColumnId('task.isMilestone'), taskColumnId('assignment.resources')];
  const conflict = planTaskGridPaste(`Oui\t${assignmentCell}`, liveEnvironment(conflictingTarget, conflictColumns));
  const committedConflict = conflict.ok ? S().runGridMutation([conflict.value]) : null;
  eq('Tegenstrijdige mijlpaal + assignment wordt door de transactielaag geweigerd',
    committedConflict?.ok, false);
  eq('Tegenstrijdige samengestelde paste rolt taak en assignments volledig terug',
    JSON.stringify({
      task: S().tasks.find(candidate => candidate.id === conflictingTarget),
      assignments: S().assignments,
    }), beforeConflict);
}

if (diffs.length > 0) {
  console.error(`FAIL task-grid-clipboard: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  task-grid-clipboard: ${checks}/${checks}`);
}
