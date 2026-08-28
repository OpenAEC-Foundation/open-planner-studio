import fs from 'node:fs';
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
  labelForBoolean: value => value ? 'WAAR' : 'ONWAAR',
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
// Browserreview, observatie 5: geen kaal native <select> meer (dat toonde bij het starten van
// bewerken geen uitgeklapte lijst — pijltjes cyclen alleen de waarde). `Select`
// (src/components/common/Select.tsx) met `autoOpen` vervangt 'm; `aria-expanded="true"` op de
// trigger bewijst dat de editor meteen UITGEKLAPT start i.p.v. pas na een tweede interactie. De
// eigenlijke optielijst rendert via een portal naar `document.body`, dat in deze Node-testomgeving
// (geen jsdom) niet bestaat — `Select` slaat de portal dan bewust over (zie de SSR-guard in
// Select.tsx), dus die lijst is hier niet los te controleren; dat gebeurt live in de browser.
ok('Enumdescriptor rendert Select (geen kaal native <select> meer), al uitgeklapt',
  !enumMarkup.includes('<select')
    && enumMarkup.includes('data-task-editor-kind="enum"')
    && enumMarkup.includes('ops-select__trigger')
    && enumMarkup.includes('aria-expanded="true"'));
ok('Enumdropdown toont de huidige waarde via de descriptoropties', enumMarkup.includes('OPTIE:CONSTRUCTION'));
const booleanMarkup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter,
  cell: { rowKey: 'occ-1', columnId: taskColumnId('task.isMilestone') },
  label: 'Mijlpaal',
  messageForError,
  onCancel: () => undefined,
  onFocusCell: () => undefined,
}));
ok('Booleandescriptor rendert Select (geen kaal native <select> meer), al uitgeklapt',
  !booleanMarkup.includes('<select')
    && booleanMarkup.includes('data-task-editor-kind="boolean"')
    && booleanMarkup.includes('ops-select__trigger')
    && booleanMarkup.includes('aria-expanded="true"'));
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
const dateMarkup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter,
  cell: { rowKey: 'occ-1', columnId: taskColumnId('task.deadline') },
  label: 'Start',
  calendarPickerLabel: 'Kies startdatum',
  messageForError,
  onCancel: () => undefined,
  onFocusCell: () => undefined,
}));
ok('Datumeditor combineert persoonlijke tekstinvoer met een echte kalenderkiezer',
  dateMarkup.includes('data-task-editor-kind="date"')
    && dateMarkup.includes('data-task-editor-picker="date"')
    && dateMarkup.includes('type="date"')
    && dateMarkup.includes('aria-label="Kies startdatum"'));

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
ok('Resourcekolom toont alleen lidmaatschap en geen units/curvebesturing',
  assignmentMarkup.includes('aria-label="remove Ploeg Noord"')
    && !assignmentMarkup.includes('type="number"')
    && !assignmentMarkup.includes('<option value="BELL"'));
const unitsMarkup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter: assignmentAdapter,
  cell: { rowKey: 'occ-1', columnId: taskColumnId('assignment.unitsPerDay') },
  label: 'Units', messageForError, onCancel: () => undefined, onFocusCell: () => undefined,
}));
ok('Unitskolom toont alleen units en geen membership- of curvebesturing',
  unitsMarkup.includes('type="number"')
    && !unitsMarkup.includes('role="combobox"')
    && !unitsMarkup.includes('<option value="BELL"'));
const curveMarkup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter: assignmentAdapter,
  cell: { rowKey: 'occ-1', columnId: taskColumnId('assignment.curve') },
  label: 'Curve', messageForError, onCancel: () => undefined, onFocusCell: () => undefined,
}));
ok('Curvekolom toont alleen curve en geen membership- of unitsbesturing',
  curveMarkup.includes('<option value="BELL" selected="">BELL</option>')
    && !curveMarkup.includes('role="combobox"')
    && !curveMarkup.includes('type="number"'));
const editorSource = fs.readFileSync('src/components/task-grid/TaskCellEditor.tsx', 'utf8');
ok('Assignment-updaters bewaren native eventwaarden voordat React de updater uitvoert',
  editorSource.includes('const unitsPerDay = event.currentTarget.valueAsNumber;')
    && editorSource.includes('const curve = event.currentTarget.value as ResourceCurve;')
    && !/setAssignmentTokens\([\s\S]{0,300}event\.currentTarget/.test(editorSource));
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
  kind: 'assignment-set', taskId: 't-1', columnId: taskColumnId('assignment.resources'), tokens: [
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
// De interactieve editor staat sinds de clipping-fix in een document.body-portal. Een statische
// serverrender heeft geen layout-effect en rendert daarom bewust alleen het celanker; de concrete
// WBS/type/lag/externe besturing wordt structureel in check-relation-cell-editor gecontroleerd.
ok('Relatiecel routeert naar de eigen portal-tokeneditor zonder de relationele waarde te verliezen',
  relationMarkup.includes('task-grid-relation-editor-anchor')
    && relationAdapter.descriptorsById.get(relationCell.columnId)?.editorKind === 'relations'
    && relationAdapter.getCell(relationCell.rowKey, relationCell.columnId)?.editText === '1.2 FS+2d');
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
