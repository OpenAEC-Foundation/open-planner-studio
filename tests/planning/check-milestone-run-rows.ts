// Issue #868 deel A — mijlpalen op één regel (besluit Ethan 14-11-2026, "alles ja").
//
// Een REEKS is twee of meer nulduurmijlpalen direct achter elkaar onder dezelfde ouder (of bovenaan).
// Een gewone taak, een mijlpaal met duur of een fase ertussen breekt de reeks. De reeks klapt in zoals
// een fase: het id van de eerste mijlpaal staat dan in `ui.collapsedTaskIds` (per document onthouden,
// niet in het bestand) en de rijenlijst toont één rij `kind: 'milestones'` met alle mijlpalen.
// Uitgeklapt draagt de eerste mijlpaal `runSize` (voor het pijltje). Bij filteren, groeperen of
// sorteren staan reeksen altijd uitgeklapt. Inklappen/Uitklappen (alles) nemen de reeksen mee.
//
// Draait via run.sh. Exit 0 = alles groen.

import './domStub';
import { useAppStore } from '@/state/appStore';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { resolveDropTarget } from '@/engine/view/dropTarget';
import { effectiveCalendarOf, effHoursPerDay } from '@/utils/taskDuration';
import { firstRowIndexByTask, milestoneRunHeads, uniqueTaskIds, type ViewRow } from '@/engine/view/visibleRows';
import type { TaskTime } from '@/types/task';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
}

const zero = { durationUnit: 'days', scheduleDuration: 0 } as TaskTime;
const days = (n: number) => ({ durationUnit: 'days', scheduleDuration: n } as TaskTime);

S().newProject();
const P = S().addTask({ name: 'Ruwbouw' });
const A = S().addTask({ name: 'Fundering', parentId: P, time: days(5) });
const M1 = S().addTask({ name: 'Start ruwbouw', parentId: P, isMilestone: true, time: zero });
const M2 = S().addTask({ name: 'Keuring wapening', parentId: P, isMilestone: true, time: zero });
const M3 = S().addTask({ name: 'Betonstort', parentId: P, isMilestone: true, time: zero });
const B = S().addTask({ name: 'Kolommen', parentId: P, time: days(3) });
const M4 = S().addTask({ name: 'Los', parentId: P, isMilestone: true, time: zero });
const T1 = S().addTask({ name: 'Oplevering', isMilestone: true, time: zero });
const T2 = S().addTask({ name: 'Nazorg klaar', isMilestone: true, time: zero });
const MD = S().addTask({ name: 'Mijlpaal met duur', isMilestone: true, time: days(2) });
const T3 = S().addTask({ name: 'Eind', isMilestone: true, time: zero });

const shape = (rows: readonly ViewRow[]) => rows.map(r =>
  r.kind === 'milestones' ? `[${r.tasks.map(t => t.name).join('|')}]@${r.depth}`
    : r.kind === 'task' ? `${r.task.name}${r.runSize ? `(${r.runSize})` : ''}` : `#${r.label}`);

// ── Reeksen herkennen ──
eq('koppen van reeksen: onder de fase en bovenaan', milestoneRunHeads(S().tasks).sort(), [M1, T1].sort());

// ── Uitgeklapt: alle rijen, de kop draagt het aantal ──
eq('uitgeklapt', shape(S().viewRows),
  ['Ruwbouw', 'Fundering', 'Start ruwbouw(3)', 'Keuring wapening', 'Betonstort', 'Kolommen', 'Los',
    'Oplevering(2)', 'Nazorg klaar', 'Mijlpaal met duur', 'Eind']);

// ── Eén reeks inklappen ──
S().toggleCollapse(M1);
eq('reeks onder de fase ingeklapt', shape(S().viewRows),
  ['Ruwbouw', 'Fundering', '[Start ruwbouw|Keuring wapening|Betonstort]@1', 'Kolommen', 'Los',
    'Oplevering(2)', 'Nazorg klaar', 'Mijlpaal met duur', 'Eind']);
const runRow = S().viewRows[2];
eq('rij-sleutel van de reeks', runRow.rowKey, `milestones:${M1}`);
const idx = firstRowIndexByTask(S().viewRows);
eq('elke mijlpaal van de reeks hoort bij de reeksrij', [idx.get(M1), idx.get(M2), idx.get(M3)], [2, 2, 2]);
eq('de reeksrij telt mee in de taakselectie', uniqueTaskIds([runRow]), [M1, M2, M3]);

// ── Fase ingeklapt: de reeks verdwijnt mee ──
S().toggleCollapse(P);
eq('fase ingeklapt', shape(S().viewRows),
  ['Ruwbouw', 'Oplevering(2)', 'Nazorg klaar', 'Mijlpaal met duur', 'Eind']);
S().toggleCollapse(P);

// ── Alles inklappen en uitklappen nemen de reeksen mee ──
S().expandTasks();
eq('alles uitklappen klapt ook de reeks uit', S().ui.collapsedTaskIds, []);
S().collapseTasks();
eq('alles inklappen: fase en beide reekskoppen', [...S().ui.collapsedTaskIds].sort(), [P, M1, T1].sort());
S().expandTasks([P]);
eq('na fase uitklappen staan de reeksen nog in', shape(S().viewRows),
  ['Ruwbouw', 'Fundering', '[Start ruwbouw|Keuring wapening|Betonstort]@1', 'Kolommen', 'Los',
    '[Oplevering|Nazorg klaar]@0', 'Mijlpaal met duur', 'Eind']);
S().collapseTasks([T1, A]); // T1 is al in, A is een blad: niets nieuws
eq('inklappen met een doellijst accepteert reekskoppen, geen bladen', [...S().ui.collapsedTaskIds].sort(), [M1, T1].sort());

// ── Inklappen/Uitklappen met een gekozen mijlpaal uit een reeks: de reeks doet mee ──
S().expandTasks();
S().collapseTasks([M2]);
eq('inklappen met een mijlpaal midden in de reeks klapt de reeks in', S().ui.collapsedTaskIds, [M1]);
S().expandTasks([M3]);
eq('uitklappen met een mijlpaal uit de reeks klapt de reeks uit', S().ui.collapsedTaskIds, []);
S().collapseTasks([M1, T1]);

// ── Een verborgen mijlpaal tonen klapt zijn reeks uit ──
S().expandAncestorsOf(M3);
eq('expandAncestorsOf klapt de eigen reeks uit', S().ui.collapsedTaskIds.includes(M1), false);

// ── Bij sorteren, filteren of groeperen: altijd uitgeklapt ──
S().collapseTasks([M1]);
S().setSort([{ field: { src: 'builtin', key: 'name' }, dir: 'asc' }]);
eq('gesorteerd: geen reeksrij', S().viewRows.some(r => r.kind === 'milestones'), false);
eq('gesorteerd: geen pijltje', S().viewRows.some(r => r.kind === 'task' && r.runSize !== undefined), false);
S().setSort([]);
eq('zonder sortering weer ingeklapt', S().viewRows.some(r => r.kind === 'milestones'), true);

// ── Tabelcellen van de ingeklapte regel (punt 5): Start = vroegste, Einde = laatste, rest leeg ──
{
  S().setSort([]);
  S().expandTasks();
  S().addSequence({ predecessorId: A, successorId: M1, type: 'FINISH_START', lagDays: 0 });
  S().addSequence({ predecessorId: A, successorId: M2, type: 'FINISH_START', lagDays: 6 });
  S().addSequence({ predecessorId: A, successorId: M3, type: 'FINISH_START', lagDays: 3 });
  S().runCPM();
  const s0 = S();
  const adapterFor = () => {
    const s = S();
    return createTaskGridAdapter({
      projectId: s.project.id, tasks: s.tasks, sequences: s.sequences, cpmResult: s.cpmResult,
      assignments: s.assignments, resources: s.resources, baselines: s.baselines,
      activityCodeTypes: s.activityCodeTypes, customFieldDefs: s.customFieldDefs, customTaskTypes: s.customTaskTypes,
      scheduleStale: s.scheduleStale, wbsAutoNumber: false,
      effectiveHoursPerDay: t => effHoursPerDay(effectiveCalendarOf(t, s.calendar, s.calendars)),
      labelForColumn: k => k, labelForText: k => k,
      dateNotation: 'dmy', numberLocale: 'nl',
      surfaceId: 'full-task-grid', rows: s.viewRows, selectedTaskIds: s.selectedTaskIds,
    });
  };
  const open = adapterFor();
  const own = (id: string, col: string) => open.getCell(id, taskColumnId(col))?.text;
  const startM1 = own(M1, 'task.time.start');
  const finishM2 = own(M2, 'task.time.finish');
  void s0;
  eq('opzet: eigen Start van M1 en Einde van M2 zijn datums, en verschillen', [/^\d{2}-\d{2}-\d{4}/.test(startM1 ?? ''), /^\d{2}-\d{2}-\d{4}/.test(finishM2 ?? ''), startM1 !== finishM2], [true, true, true]);
  S().collapseTasks([M1]);
  const adapter = adapterFor();
  const key = `milestones:${M1}`;
  const cell = (col: string) => adapter.getCell(key, taskColumnId(col));
  eq('Start van de regel = vroegste mijlpaal (M1)', cell('task.time.start')?.text, startM1);
  eq('Einde van de regel = laatste mijlpaal (M2, lag 6)', cell('task.time.finish')?.text, finishM2);
  eq('Start en Einde zijn alleen-lezen', [cell('task.time.start')?.readOnly, cell('task.time.finish')?.readOnly], [true, true]);
  eq('Duur is leeg', cell('task.time.scheduleDuration')?.text, '');
  eq('de rij kent de mijlpalen van de reeks', adapter.rowMetaByKey.get(key)?.kind, 'milestones');
}

// ── Neerzetten rond een ingeklapte regel (punt 8): vóór de eerste of ná de laatste mijlpaal ──
{
  S().expandTasks();
  S().collapseTasks([M1, T1]);
  const rows = S().viewRows;
  const byId = new Map(S().tasks.map(t => [t.id, t]));
  const runIdx = rows.findIndex(r => r.rowKey === `milestones:${M1}`);
  const rootIdx = rows.findIndex(r => r.rowKey === `milestones:${T1}`);
  eq('vóór de reeks onder de fase', resolveDropTarget(rows, runIdx, 'before', byId), { parentId: P, childIndex: 1 });
  eq('ná de reeks onder de fase', resolveDropTarget(rows, runIdx, 'after', byId), { parentId: P, childIndex: 4 });
  eq('niet ín de reeks', resolveDropTarget(rows, runIdx, 'nest', byId), null);
  const rootOrder = S().tasks.filter(t => !t.parentId).map(t => t.id);
  eq('ná de reeks bovenaan telt alle mijlpalen mee', resolveDropTarget(rows, rootIdx, 'after', byId),
    { parentId: null, childIndex: rootOrder.indexOf(T2) + 1 });
  // Een gesleepte reeks (kop M1) die vóór B neerkomt: de kop telt mee in de compensatie.
  const bIdx = rows.findIndex(r => r.kind === 'task' && r.task.id === B);
  eq('reeks onder B neerzetten', resolveDropTarget(rows, bIdx, 'after', byId, M1), { parentId: P, childIndex: 4 });
  S().moveTasksTo([M1, M2, M3], { parentId: P, childIndex: 4 });
  eq('na verhuizen van de reeks achter Kolommen', byId.get(P) && S().tasks.find(t => t.id === P)!.childIds.map(id => S().tasks.find(t => t.id === id)!.name),
    ['Fundering', 'Kolommen', 'Start ruwbouw', 'Keuring wapening', 'Betonstort', 'Los']);
}

void B; void M4; void T2; void MD; void T3;

if (diffs.length) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`check-milestone-run-rows: ${diffs.length} van ${checks} checks ROOD`);
  process.exit(1);
}
console.log(`check-milestone-run-rows: alle ${checks} checks groen`);
