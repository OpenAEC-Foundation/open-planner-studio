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

if (diffs.length) {
  console.error(`FAIL task-cell-editor: ${diffs.length}/${checks}`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK  task-cell-editor: ${checks}/${checks}`);
process.exit(0);
