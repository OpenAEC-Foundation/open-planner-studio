// Werk- en inzetkolommen van het taakraster (releasecheck, Roads_Project_TEC.xer): uren en inzet
// staan in de getalnotatie van de taal (nl "617,14", en "617.14"), met hoogstens twee decimalen en
// zonder overbodige nullen. Invoer met komma breekt de "naam: uren; naam: uren"-scheiding niet, en
// de getoonde (afgeronde) tekst onveranderd terugschrijven laat de exacte opgeslagen waarde staan.
// Kopiëren: de mensentekst volgt de taal, het machine-deel (tokens) blijft exact.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { TaskCellEditor } from '@/components/task-grid/TaskCellEditor';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import type { TaskAssignmentToken } from '@/types/taskGrid';
import type { ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const UNITS = 1.71428571428571;
const task = {
  id: 't-1', name: 'Tekenwerk', description: '', wbsCode: '1', taskType: 'CONSTRUCTION',
  status: 'NOT_STARTED', isMilestone: false, priority: 500, parentId: null, childIds: [],
  resourceIds: [], activityCodes: {}, customFields: {},
  time: {
    durationType: 'WORKTIME', durationUnit: 'days', scheduleDuration: 10,
    scheduleStart: '2026-01-01', scheduleFinish: '2026-01-14',
    earlyStart: '2026-01-01', earlyFinish: '2026-01-14',
    lateStart: '2026-01-01', lateFinish: '2026-01-14',
    freeFloat: 0, totalFloat: 0, isCritical: true, completion: 0,
  },
} as Task;
const assignments: ResourceAssignment[] = [
  {
    id: 'a-1', taskId: task.id, resourceId: 'r-1', unitsPerDay: UNITS, plannedUnitsPerDay: 2.5,
    plannedWorkMinutes: 37028.57, actualWorkMinutes: 1600, remainingWorkMinutes: 37028.57,
  },
  { id: 'a-2', taskId: task.id, resourceId: 'r-2', unitsPerDay: 0.5, remainingWorkMinutes: 14400 },
];

function adapterFor(numberLocale: string | undefined) {
  return createTaskGridAdapter({
    surfaceId: 'full-task-grid', projectId: 'p-1',
    rows: [{ kind: 'task', rowKey: 'occ-1', task, depth: 0, dimmed: false }],
    tasks: [task], sequences: [], baselines: [], activityCodeTypes: [], customFieldDefs: [],
    resources: [
      { id: 'r-1', name: 'Draughtman', type: 'LABOR', description: '', maxUnits: 2 },
      { id: 'r-2', name: 'Ploeg, Noord', type: 'LABOR', description: '', maxUnits: 2 },
    ],
    assignments,
    scheduleStale: false, wbsAutoNumber: false, selectedTaskIds: [], labelForColumn: key => key,
    taskTypesUnlocked: true,
    ...(numberLocale ? { numberLocale } : {}),
    callbacks: {
      onCommitEdit: () => ({ ok: true, value: undefined }),
    },
  });
}

const col = (id: string) => taskColumnId(id);
const cellText = (locale: string | undefined, id: string) => adapterFor(locale).getCell('occ-1', col(id))?.text;

// ── Weergave ────────────────────────────────────────────────────────────────────────────────
eq('nl inzet: komma, twee decimalen', cellText('nl', 'assignment.unitsPerDay'), 'Draughtman: 1,71; Ploeg, Noord: 0,5');
eq('en inzet: punt, twee decimalen', cellText('en', 'assignment.unitsPerDay'), 'Draughtman: 1.71; Ploeg, Noord: 0.5');
eq('nl begroot werk (uren)', cellText('nl', 'assignment.plannedWork'), 'Draughtman: 617,14');
eq('en begroot werk (uren)', cellText('en', 'assignment.plannedWork'), 'Draughtman: 617.14');
eq('nl verricht werk: geen overbodige nullen', cellText('nl', 'assignment.actualWork'), 'Draughtman: 26,67');
eq('nl resterend werk: "240", niet "240,00"', cellText('nl', 'assignment.remainingWork'), 'Draughtman: 617,14; Ploeg, Noord: 240');
eq('en resterend werk', cellText('en', 'assignment.remainingWork'), 'Draughtman: 617.14; Ploeg, Noord: 240');
eq('nl begrote inzet', cellText('nl', 'assignment.plannedUnits'), 'Draughtman: 2,5');
eq('zonder taal: neutrale punt-notatie', cellText(undefined, 'assignment.unitsPerDay'), 'Draughtman: 1.71; Ploeg, Noord: 0.5');
eq('bewerktekst inzet blijft exact (tekstroute rondt niet stil af)',
  adapterFor('nl').getCell('occ-1', col('assignment.unitsPerDay'))?.editText, `Draughtman: ${UNITS}; Ploeg, Noord: 0.5`);

// ── Kopiëren: mensentekst in de taal, tokens exact ─────────────────────────────────────────
const copyNl = adapterFor('nl').getCell('occ-1', col('assignment.unitsPerDay'))!.copyText;
const marker = '⁣ops-assignment:';
const [visible, encoded] = copyNl.split(marker);
eq('kopie nl: zichtbare tekst met komma', visible, 'Draughtman: 1,71; Ploeg, Noord: 0,5');
eq('kopie nl: tokens dragen de exacte inzet',
  (JSON.parse(decodeURIComponent(encoded)) as TaskAssignmentToken[]).map(token => token.unitsPerDay), [UNITS, 0.5]);
const copyWork = adapterFor('nl').getCell('occ-1', col('assignment.remainingWork'))!.copyText;
eq('kopie werk nl: tokens dragen de exacte minuten',
  (JSON.parse(decodeURIComponent(copyWork.split(marker)[1])) as TaskAssignmentToken[]).map(token => token.remainingWorkMinutes),
  [37028.57, 14400]);

// ── Plakken binnen de app blijft exact ─────────────────────────────────────────────────────
const pasteResult = adapterFor('nl').planEdit('occ-1', col('assignment.unitsPerDay'), copyNl);
eq('plakken van eigen kopie: tokens exact',
  pasteResult.ok ? (pasteResult.value[0] as unknown as { tokens: TaskAssignmentToken[] }).tokens.map(token => token.unitsPerDay) : pasteResult,
  [UNITS, 0.5]);

// ── Tekstinvoer met komma ──────────────────────────────────────────────────────────────────
function plannedTokens(locale: string, id: string, text: string): unknown {
  const result = adapterFor(locale).planEdit('occ-1', col(id), text);
  return result.ok ? (result.value[0] as unknown as { tokens: TaskAssignmentToken[] }).tokens : result.errors.map(e => e.code);
}
eq('nl inzet "2,5": komma is decimaalteken, scheiding blijft ";"',
  (plannedTokens('nl', 'assignment.unitsPerDay', 'Draughtman: 2,5; Ploeg, Noord: 0,75') as TaskAssignmentToken[]).map(t => t.unitsPerDay),
  [2.5, 0.75]);
eq('nl inzet: de getoonde tekst onveranderd ⇒ exacte inzet blijft',
  (plannedTokens('nl', 'assignment.unitsPerDay', 'Draughtman: 1,71; Ploeg, Noord: 0,5') as TaskAssignmentToken[]).map(t => t.unitsPerDay),
  [UNITS, 0.5]);
eq('en inzet: de getoonde tekst onveranderd ⇒ exacte inzet blijft',
  (plannedTokens('en', 'assignment.unitsPerDay', 'Draughtman: 1.71; Ploeg, Noord: 0.5') as TaskAssignmentToken[]).map(t => t.unitsPerDay),
  [UNITS, 0.5]);
eq('nl werk "300,5" ⇒ 18030 minuten',
  (plannedTokens('nl', 'assignment.remainingWork', 'Draughtman: 300,5') as TaskAssignmentToken[]).map(t => t.remainingWorkMinutes),
  [18030, 14400]);
eq('nl werk: de getoonde tekst onveranderd ⇒ exacte minuten blijven',
  (plannedTokens('nl', 'assignment.remainingWork', 'Draughtman: 617,14; Ploeg, Noord: 240') as TaskAssignmentToken[]).map(t => t.remainingWorkMinutes),
  [37028.57, 14400]);
eq('nl inzet "1,2,3" is geen getal', plannedTokens('nl', 'assignment.unitsPerDay', 'Draughtman: 1,2,3'), ['assignmentUnits']);

// ── Cel-editor: tekstvelden in de taal; bevestigen zonder wijziging is exact ───────────────
const unitsMarkup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter: adapterFor('nl'), cell: { rowKey: 'occ-1', columnId: col('assignment.unitsPerDay') },
  label: 'Eenh./dag', messageForError: key => key, onCancel: () => undefined, onFocusCell: () => undefined,
}));
eq('cel-editor inzet nl toont "1,71" en "0,5" in tekstvelden',
  [...unitsMarkup.matchAll(/data-assignment-number="units"[^>]*value="([^"]*)"/g)].map(m => m[1]), ['1,71', '0,5']);
const workMarkup = renderToStaticMarkup(createElement(TaskCellEditor, {
  adapter: adapterFor('nl'), cell: { rowKey: 'occ-1', columnId: col('assignment.remainingWork') },
  label: 'Werk', messageForError: key => key, onCancel: () => undefined, onFocusCell: () => undefined,
}));
eq('cel-editor werk nl toont "617,14" en "240"',
  [...workMarkup.matchAll(/data-assignment-number="work"[^>]*value="([^"]*)"/g)].map(m => m[1]), ['617,14', '240']);

if (diffs.length) {
  for (const d of diffs) console.log(`XX  ${d}`);
  console.log(`check-work-decimals: ${diffs.length} van ${checks} afwijkingen`);
  process.exit(1);
}
console.log(`OK  check-work-decimals: ${checks} checks groen`);
process.exit(0);
