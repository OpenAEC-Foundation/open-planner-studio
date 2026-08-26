import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import {
  TaskCellEditor,
  commitTaskCellEditorValue,
} from '@/components/task-grid/TaskCellEditor';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import type { GridIntent } from '@/types/taskGrid';
import type { Task } from '@/types/task';
import { buildRelationCellItems } from '@/engine/taskGrid/relationCell';
import { taskRelations } from '@/engine/taskGrid/relationIndex';

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

const task = {
  id: 't-1', name: 'Fundering', description: '', wbsCode: '1', taskType: 'CONSTRUCTION',
  status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [],
  resourceIds: [], activityCodes: {}, customFields: {},
  time: {
    durationType: 'WORKTIME', scheduleDuration: 1,
    scheduleStart: '2026-01-01', scheduleFinish: '2026-01-01',
    earlyStart: '2026-01-01', earlyFinish: '2026-01-01',
    lateStart: '2026-01-01', lateFinish: '2026-01-01',
    freeFloat: 0, totalFloat: 0, isCritical: true, completion: 0,
  },
} as Task;
let allowPrepare = true;
let committed: readonly GridIntent[] | null = null;
const adapter = createTaskGridAdapter({
  surfaceId: 'full-task-grid', projectId: 'p-1',
  rows: [{ kind: 'task', rowKey: 'occ-1', task, depth: 0, dimmed: false }],
  tasks: [task], sequences: [], assignments: [], resources: [], baselines: [],
  activityCodeTypes: [], customFieldDefs: [], scheduleStale: false, wbsAutoNumber: false,
  selectedTaskIds: [], labelForColumn: key => key,
  calendarOptions: [{ value: 'cal-bouw', label: 'Bouwkalender' }],
  callbacks: {
    onPrepareEdit: () => allowPrepare,
    onCommitEdit: (_target, intents) => {
      committed = intents;
      return { ok: true, value: undefined };
    },
  },
});
const cell = { rowKey: 'occ-1', columnId: taskColumnId('task.name') };
const messageForError = (key: string) => `VERTAALD:${key}`;

const success = commitTaskCellEditorValue({ adapter, cell, text: 'Nieuwe naam', messageForError });
eq('Editor plant en commit uitsluitend domeinintents', success, { ok: true });
eq('Commitcallback ontvangt geen Zustand-actienaam', committed, [{
  kind: 'cell-edit', taskId: 't-1', columnId: 'task.name', route: 'task-field', value: 'Nieuwe naam',
}]);

allowPrepare = false;
committed = null;
const blocked = commitTaskCellEditorValue({ adapter, cell, text: 'Geblokkeerd', messageForError });
eq('Afgewezen prepare houdt de editor open met gerichte fout', blocked, {
  ok: false,
  error: { id: 'task-grid-error-occ-1-task.name', message: 'VERTAALD:taskGrid.validation.prepareRejected' },
});
eq('Afgewezen prepare commit niets', committed, null);

allowPrepare = true;
const invalid = commitTaskCellEditorValue({
  adapter,
  cell: { rowKey: 'occ-1', columnId: taskColumnId('task.priority') },
  text: 'geen getal',
  messageForError,
});
eq('Descriptorfout wordt dezelfde zichtbare editorfout', invalid, {
  ok: false,
  error: { id: 'task-grid-error-occ-1-task.priority', message: 'VERTAALD:taskGrid.validation.number' },
});

const markup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter,
  cell,
  label: 'Taaknaam',
  messageForError,
  onCancel: () => undefined,
  onFocusCell: () => undefined,
}));
ok('Editor gebruikt de canonieke kopieerwaarde als startwaarde', markup.includes('value="Fundering"'));
ok('Editor heeft een toegankelijke kolomnaam', markup.includes('aria-label="Taaknaam"'));
const enumMarkup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter,
  cell: { rowKey: 'occ-1', columnId: taskColumnId('task.taskType') },
  label: 'Taaktype',
  messageForError,
  labelForOption: (_key: string, value: string) => `OPTIE:${value}`,
  onCancel: () => undefined,
  onFocusCell: () => undefined,
}));
ok('Enumdescriptor rendert een echte dropdown',
  enumMarkup.includes('<select') && enumMarkup.includes('data-task-editor-kind="enum"'));
ok('Enumdropdown gebruikt de descriptoropties', enumMarkup.includes('OPTIE:CONSTRUCTION'));
const booleanMarkup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter,
  cell: { rowKey: 'occ-1', columnId: taskColumnId('task.isMilestone') },
  label: 'Mijlpaal',
  messageForError,
  labelForOption: (key: string, value: string) => key === 'boolean.true'
    ? 'WAAR'
    : key === 'boolean.false' ? 'ONWAAR' : value,
  onCancel: () => undefined,
  onFocusCell: () => undefined,
}));
ok('Booleandescriptor rendert een drie-toestandenkeuze',
  booleanMarkup.includes('data-task-editor-kind="boolean"')
    && /<option value="true"[^>]*>WAAR<\/option>/.test(booleanMarkup)
    && /<option value="false"[^>]*>ONWAAR<\/option>/.test(booleanMarkup));
const autocompleteMarkup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter,
  cell: { rowKey: 'occ-1', columnId: taskColumnId('task.calendarId') },
  label: 'Kalender',
  messageForError,
  onCancel: () => undefined,
  onFocusCell: () => undefined,
}));
ok('Autocomplete-editor koppelt een echte suggestielijst',
  autocompleteMarkup.includes('data-task-editor-kind="autocomplete"')
    && autocompleteMarkup.includes('<datalist')
    && autocompleteMarkup.includes('Bouwkalender'));

let assignmentCommit: readonly GridIntent[] | null = null;
const assignmentAdapter = createTaskGridAdapter({
  surfaceId: 'full-task-grid', projectId: 'p-1',
  rows: [{ kind: 'task', rowKey: 'occ-1', task, depth: 0, dimmed: false }],
  tasks: [task], sequences: [], baselines: [], activityCodeTypes: [], customFieldDefs: [],
  resources: [
    { id: 'res-1', name: 'Ploeg Noord', type: 'LABOR', description: '', maxUnits: 2 },
    { id: 'res-2', name: 'Ploeg Zuid', type: 'LABOR', description: '', maxUnits: 2 },
  ],
  assignments: [{
    id: 'asgn-1', taskId: task.id, resourceId: 'res-1', unitsPerDay: 1.5, curve: 'BELL',
  }],
  scheduleStale: false, wbsAutoNumber: false, selectedTaskIds: [], labelForColumn: key => key,
  callbacks: {
    onCommitEdit: (_target, intents) => {
      assignmentCommit = intents;
      return { ok: true, value: undefined };
    },
  },
});
const assignmentCell = { rowKey: 'occ-1', columnId: taskColumnId('assignment.resources') };
const assignmentMarkup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter: assignmentAdapter,
  cell: assignmentCell,
  label: 'Toegewezen resources',
  messageForError,
  labelForOption: (_key: string, value: string) => value,
  onCancel: () => undefined,
  onFocusCell: () => undefined,
}));
ok('Assignmentcel opent een inline tokeneditor en geen los paneel',
  assignmentMarkup.includes('data-task-editor-kind="assignment-tokens"')
    && assignmentMarkup.includes('data-assignment-resource-id="res-1"')
    && assignmentMarkup.includes('role="combobox"')
    && !assignmentMarkup.includes('ops-assignment'));
ok('Assignmenttoken toont units, curve en verwijdering binnen dezelfde editor',
  assignmentMarkup.includes('value="1.5"')
    && assignmentMarkup.includes('<option value="BELL" selected="">BELL</option>')
    && assignmentMarkup.includes('aria-label="remove Ploeg Noord"'));
const directAssignment = commitTaskCellEditorValue({
  adapter: assignmentAdapter,
  cell: assignmentCell,
  text: '',
  directValue: [
    { assignmentId: 'asgn-1', resourceId: 'res-1', unitsPerDay: 2, curve: 'BELL' },
    { resourceId: 'res-2', unitsPerDay: 1 },
  ],
  messageForError,
});
eq('Gestructureerde editorcommit slaat de verliesrijke tekstparser over', directAssignment, { ok: true });
eq('Gestructureerde editorcommit levert één volledige assignment-set', assignmentCommit, [{
  kind: 'assignment-set', taskId: 't-1', tokens: [
    { assignmentId: 'asgn-1', resourceId: 'res-1', unitsPerDay: 2, curve: 'BELL' },
    { resourceId: 'res-2', unitsPerDay: 1 },
  ],
}]);

const otherTask = {
  ...task, id: 't-2', wbsCode: '1.2', name: 'Beton storten', time: { ...task.time },
} as Task;
let relationCommit: readonly GridIntent[] | null = null;
const relationAdapter = createTaskGridAdapter({
  surfaceId: 'full-task-grid', projectId: 'p-1',
  rows: [{ kind: 'task', rowKey: 'occ-1', task, depth: 0, dimmed: false }],
  tasks: [task, otherTask],
  sequences: [{ id: 'seq-1', predecessorId: otherTask.id, successorId: task.id, type: 'FINISH_START', lagDays: 2 }],
  assignments: [], resources: [], baselines: [], activityCodeTypes: [], customFieldDefs: [],
  scheduleStale: false, wbsAutoNumber: false, selectedTaskIds: [], labelForColumn: key => key,
  callbacks: {
    onCommitEdit: (_target, intents) => {
      relationCommit = intents;
      return { ok: true, value: undefined };
    },
  },
});
const relationCell = { rowKey: 'occ-1', columnId: taskColumnId('relation.predecessors') };
const relationMarkup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter: relationAdapter,
  cell: relationCell,
  label: 'Voorgangers',
  messageForError,
  onCancel: () => undefined,
  onFocusCell: () => undefined,
}));
ok('Relatiecel opent de eigen tokeneditor met WBS, type, lag en externe route',
  relationMarkup.includes('data-task-editor-kind="relations"')
    && relationMarkup.includes('1.2 Beton storten')
    && relationMarkup.includes('<option value="FS" selected="">FS</option>')
    && relationMarkup.includes('value="+2d"')
    && relationMarkup.includes('Externe relatie toevoegen'));
const rawRelationMarkup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter: relationAdapter,
  cell: relationCell,
  label: 'Voorgangers',
  initialText: '1',
  messageForError,
  onCancel: () => undefined,
  onFocusCell: () => undefined,
}));
ok('Direct typen gebruikt volledige tekstvervanging zonder verborgen relatie-idmetadata',
  rawRelationMarkup.includes('data-task-editor-kind="relations-raw"')
    && rawRelationMarkup.includes('value="1"')
    && !rawRelationMarkup.includes('data-task-editor-kind="relations"'));
const relationItems = buildRelationCellItems({
  ownerTaskId: task.id,
  direction: 'predecessor',
  entries: taskRelations(relationAdapter.context.relationIndex, task.id, 'predecessor'),
  context: relationAdapter.context,
});
eq('Gestructureerde relatiecommit bewaart sequence-idmetadata buiten de zichtbare tekst',
  commitTaskCellEditorValue({
    adapter: relationAdapter,
    cell: relationCell,
    text: '',
    directValue: relationItems.map(item => item.parsedToken),
    messageForError,
  }), { ok: true });
eq('Relatie-editor levert één volledige gewenste relatie-set', relationCommit, [{
  kind: 'relation-set', taskId: task.id, direction: 'predecessor',
  value: relationItems.map(item => item.parsedToken),
}]);

if (diffs.length) {
  console.error(`FAIL task-cell-editor: ${diffs.length}/${checks}`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK  task-cell-editor: ${checks}/${checks}`);
process.exit(0);
