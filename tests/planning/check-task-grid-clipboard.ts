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
    context, dateNotation: 'dmy',
  };
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
  eq('Gelijke undefined-writes uit lege optionele cellen dedupliceren ook',
    emptyOptional.ok ? emptyOptional.value.writes.length : emptyOptional.errors, 1);
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
    ['datumtijd', taskColumnId('task.time.scheduleStart'), '31-12-2026 08:45', '2026-12-31T08:45'],
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
  eq('Assignmentplanner blijft eveneens als atomische write in PasteIntent behouden',
    assignmentClear.ok ? assignmentClear.value.writes : assignmentClear.errors,
    [{ kind: 'assignment-set', taskId: first.id, tokens: [] }]);

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

if (diffs.length > 0) {
  console.error(`FAIL task-grid-clipboard: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  task-grid-clipboard: ${checks}/${checks}`);
}
