// Een ongewijzigde datum in de tabel laat het moment staan (aanval a08 na #600, BLOKKEERT 1).
//
// De tabel toont een datum volgens B4: zonder tijd op een dagrand. Die tekst was ook de bewerk- en
// kopieertekst. Bij bevestigen las de store de kale datum met één vaste kant, en dat gaf soms een ander
// moment dan de cel had:
//  - kalendertijd-taak van 1 d, handmatig, ma 1 jun 00:00 tot di 2 jun 00:00. Gepland einde toont
//    "01-06-2026"; Enter zonder wijziging schreef ma 1 jun 00:00 (D3-exclusief), de hele dag was weg;
//  - P6: FINISH-mijlpaal op 07:00 ging naar 16:00, START-mijlpaal op 16:00 naar 07:00 (D7).
// Nu: een ongewijzigde datum geeft het opgeslagen moment terug (`parseGridEditorText`), en een nieuwe
// einddatum zonder tijd is het einde van die dag zoals de tabel het toont (`normalizeTaskDateInput`).
// Een nieuwe datum zonder tijd bij een mijlpaal houdt D7 (open besluit van de eigenaar; hier vastgepind
// zodat een wijziging bewust gebeurt).
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { createTaskGridAdapter } from '@/engine/taskGrid/taskGridAdapter';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';
import { parseGridEditorText } from '@/engine/taskGrid/editors';
import { commitTaskCellEditorValue } from '@/components/task-grid/TaskCellEditor';
import { profileCountsWorkdays } from '@/utils/taskDuration';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readIFC } from '@/services/ifc/ifcReader';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';

declare const process: { exit(code: number): never };

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) diffs.push(`${label}: verwacht ${b}, kreeg ${a}`);
}

// De standaardkalender van B4: ma–vr 07:00–12:00 + 13:00–16:00.
const blocks = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
const standard: WorkCalendar = {
  id: 'std', name: 'Standaard', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16,
  hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: { 1: blocks, 2: blocks, 3: blocks, 4: blocks, 5: blocks, 6: [], 7: [] } },
};

type Profile = 'ops' | 'p6' | 'msproject';

function fixture(profile: Profile) {
  const ctx = createAppStoreContext();
  const S = ctx.store.getState;
  S().setCalendar(standard);
  S().setProject({ startDate: '2026-06-01', schedulingProfile: builtInProfile(profile) });
  const of = (id: string) => S().tasks.find(t => t.id === id)!;
  const adapter = () => createTaskGridAdapter({
    projectId: S().project.id, tasks: S().tasks,
    rows: S().tasks.map(task => ({ kind: 'task', rowKey: task.id, task, depth: 0, dimmed: false })),
    sequences: S().sequences, assignments: S().assignments, resources: S().resources, baselines: S().baselines,
    activityCodeTypes: [], customFieldDefs: [], scheduleStale: S().scheduleStale, wbsAutoNumber: false,
    surfaceId: 'full-task-grid', selectedTaskIds: [], labelForColumn: k => k,
    effectiveCalendar: () => standard, effectiveHoursPerDay: () => 8, dateNotation: 'dmy', timeNotation: '24h',
    workdayDurationMeasure: profileCountsWorkdays(S().project), numberLocale: 'nl',
    callbacks: { onCommitEdit: (_target, intents) => S().runGridMutation(intents) },
  });
  const cell = (id: string, column: string) => adapter().getCell(id, taskColumnId(column))!;
  /** De echte rastercommit; zonder `text` de bewerktekst van de cel, ongewijzigd. */
  const commit = (id: string, column: string, text?: string) => {
    const a = adapter();
    const columnId = taskColumnId(column);
    const editText = text ?? a.getCell(id, columnId)!.editText;
    return commitTaskCellEditorValue({ adapter: a, cell: { rowKey: id, columnId }, text: editText, messageForError: k => k });
  };
  return { S, of, adapter, cell, commit };
}

/** Wat van een taak telt voor "er verandert niets": de tijden en de beperkingen. */
const snapshot = (t: Task) => JSON.stringify({ time: t.time, constraint: t.constraint, constraint2: t.constraint2, deadline: t.deadline });

// ── 1. Kalendertijd-taak, handmatig gepland: Gepland einde en Einde ongewijzigd bevestigen ─────────
for (const profile of ['ops', 'p6', 'msproject'] as const) {
  const f = fixture(profile);
  const id = f.S().addTask({ name: 'Kalendertijd handmatig' });
  f.S().updateTask(id, { manuallyScheduled: true, time: {
    ...f.of(id).time, durationType: 'ELAPSEDTIME', durationUnit: 'days', scheduleDuration: 1,
    scheduleStart: '2026-06-01T00:00', scheduleFinish: '2026-06-02T00:00',
  } });
  f.S().runCPM();
  const before = snapshot(f.of(id));
  eq(`${profile} 1a opzet: einde di 2 jun 00:00`, [f.of(id).time.scheduleFinish, f.of(id).time.earlyFinish], ['2026-06-02T00:00', '2026-06-02T00:00']);
  const shown = f.cell(id, 'task.time.scheduleFinish');
  eq(`${profile} 1b B4: Gepland einde toont en bewerkt "01-06-2026"`, [shown.text, shown.editText, shown.copyText], ['01-06-2026', '01-06-2026', '01-06-2026']);
  eq(`${profile} 1c Enter zonder wijziging op Gepland einde: ok`, f.commit(id, 'task.time.scheduleFinish'), { ok: true });
  eq(`${profile} 1d Gepland einde: niets veranderd`, snapshot(f.of(id)), before);
  eq(`${profile} 1e Enter zonder wijziging op Einde: ok`, f.commit(id, 'task.time.finish'), { ok: true });
  eq(`${profile} 1f Einde: niets veranderd`, snapshot(f.of(id)), before);
  f.S().runCPM();
  eq(`${profile} 1g na herberekenen: de hele dag staat er nog`, [f.of(id).time.earlyStart, f.of(id).time.earlyFinish], ['2026-06-01T00:00', '2026-06-02T00:00']);
  const reopened = readIFC(writeIFC(buildWriteIFCInput(f.S()))).tasks.find(t => t.name === 'Kalendertijd handmatig')!;
  eq(`${profile} 1h na IFC opslaan en lezen: einde di 2 jun 00:00`, reopened.time.scheduleFinish, '2026-06-02T00:00');

  // De gedeelde leesfunctie (bewerken én plakken): de getoonde tekst geeft het opgeslagen moment terug.
  const a = f.adapter();
  const descriptor = a.descriptorsById.get(taskColumnId('task.time.scheduleFinish'))!;
  eq(`${profile} 1i plakken: "01-06-2026" leest terug als het opgeslagen moment`,
    parseGridEditorText(descriptor, '01-06-2026', f.of(id), a.context, 'dmy'), { ok: true, value: '2026-06-02T00:00' });

  // ── 2. Een nieuwe einddatum zonder tijd: het einde van die dag zoals de tabel het toont (B4) ──────
  eq(`${profile} 2a "03-06-2026" typen in Gepland einde: ok`, f.commit(id, 'task.time.scheduleFinish', '03-06-2026'), { ok: true });
  eq(`${profile} 2b einde wo 3 jun 24:00 = do 4 jun 00:00`, f.of(id).time.scheduleFinish, '2026-06-04T00:00');
  eq(`${profile} 2c de cel toont wat er getypt is`, f.cell(id, 'task.time.scheduleFinish').text, '03-06-2026');
  eq(`${profile} 2d een tijd typen blijft dat moment`, f.commit(id, 'task.time.scheduleFinish', '03-06-2026 12:00'), { ok: true });
  eq(`${profile} 2e einde wo 3 jun 12:00`, f.of(id).time.scheduleFinish, '2026-06-03T12:00');
}

// ── 3. P6: een mijlpaal op de andere dagrand dan zijn soort ─────────────────────────────────────────
for (const kind of ['START', 'FINISH'] as const) {
  const f = fixture('p6');
  const at = kind === 'START' ? '2026-06-01T16:00' : '2026-06-01T07:00';
  const id = f.S().addTask({ name: 'Mijlpaal', isMilestone: true, milestoneKind: kind });
  f.S().updateTask(id, { time: { ...f.of(id).time, scheduleDuration: 0, scheduleStart: at, earlyStart: at, earlyFinish: at } });
  f.S().runCPM();
  const before = snapshot(f.of(id));
  eq(`p6 ${kind} 3a opzet: mijlpaal op ${at}`, f.of(id).time.earlyStart, at);
  eq(`p6 ${kind} 3b B4: Start toont en bewerkt "01-06-2026"`, [f.cell(id, 'task.time.start').text, f.cell(id, 'task.time.start').editText], ['01-06-2026', '01-06-2026']);
  eq(`p6 ${kind} 3c Enter zonder wijziging op Start: ok`, f.commit(id, 'task.time.start'), { ok: true });
  eq(`p6 ${kind} 3d niets veranderd (geen beperking, geen ander moment)`, snapshot(f.of(id)), before);
  eq(`p6 ${kind} 3e Enter zonder wijziging op Gepland begin: ok`, f.commit(id, 'task.time.scheduleStart'), { ok: true });
  eq(`p6 ${kind} 3f niets veranderd`, snapshot(f.of(id)), before);
  f.S().runCPM();
  eq(`p6 ${kind} 3g na herberekenen: hetzelfde moment`, f.of(id).time.earlyStart, at);
  // De datum opnieuw typen is ook "ongewijzigd": de cel toonde precies die datum.
  eq(`p6 ${kind} 3h "1-6-2026" typen: ok`, f.commit(id, 'task.time.start', '1-6-2026'), { ok: true });
  eq(`p6 ${kind} 3i niets veranderd`, snapshot(f.of(id)), before);

  // Een NIEUWE datum zonder tijd houdt D7 (open besluit): FINISH ⇒ einde van de werkdag, START ⇒ begin.
  eq(`p6 ${kind} 3j "02-06-2026" typen op Gepland begin: ok`, f.commit(id, 'task.time.scheduleStart', '02-06-2026'), { ok: true });
  eq(`p6 ${kind} 3k nieuwe datum volgt D7`, f.of(id).time.scheduleStart, kind === 'FINISH' ? '2026-06-02T16:00' : '2026-06-02T07:00');
}

// ── 4. OPS: een losse mijlpaal zonder soort staat aan het einde van de werkdag (B6) ─────────────────
// Vastgepind, geen reproductie: vóór de fix las de invoer "01-06-2026" hier als 07:00 (D7 zonder soort),
// maar 07:00 is de projectstart, dus de getypte start gaf geen anker. Nu komt 16:00 zelf terug.
{
  const f = fixture('ops');
  const id = f.S().addTask({ name: 'Losse mijlpaal', isMilestone: true });
  f.S().updateTask(id, { time: { ...f.of(id).time, scheduleDuration: 0 } });
  f.S().runCPM();
  const at = f.of(id).time.earlyStart;
  const before = snapshot(f.of(id));
  eq('ops 4a opzet: losse mijlpaal op ma 1 jun 16:00 (B6)', at, '2026-06-01T16:00');
  eq('ops 4b B4: Start toont "01-06-2026"', f.cell(id, 'task.time.start').text, '01-06-2026');
  eq('ops 4c Enter zonder wijziging op Start: ok', f.commit(id, 'task.time.start'), { ok: true });
  eq('ops 4d niets veranderd (geen beperking op 07:00)', snapshot(f.of(id)), before);
  f.S().runCPM();
  eq('ops 4e na herberekenen: hetzelfde moment', f.of(id).time.earlyStart, at);
}

// ── 5. Een gewone taak en een beperking: ongewijzigd blijft ongewijzigd ─────────────────────────────
{
  const f = fixture('ops');
  const id = f.S().addTask({ name: 'Dagtaak' });
  f.S().runCPM();
  const before = snapshot(f.of(id));
  eq('ops 5a Start toont "01-06-2026"', f.cell(id, 'task.time.start').text, '01-06-2026');
  eq('ops 5b Enter zonder wijziging op Start: ok', f.commit(id, 'task.time.start'), { ok: true });
  eq('ops 5c niets veranderd', snapshot(f.of(id)), before);

  const elapsed = f.S().addTask({ name: 'Kalendertijd met FNET' });
  f.S().updateTask(elapsed, {
    time: { ...f.of(elapsed).time, durationType: 'ELAPSEDTIME', durationUnit: 'days', scheduleDuration: 1 },
    constraint: { type: 'FNET', date: '2026-06-03T00:00' },
  });
  f.S().runCPM();
  const withConstraint = snapshot(f.of(elapsed));
  eq('ops 5d FNET di 2 jun 24:00 toont "02-06-2026"', f.cell(elapsed, 'task.constraint.date').text, '02-06-2026');
  eq('ops 5e Enter zonder wijziging op de beperkingsdatum: ok', f.commit(elapsed, 'task.constraint.date'), { ok: true });
  eq('ops 5f niets veranderd', snapshot(f.of(elapsed)), withConstraint);
}

if (diffs.length) {
  console.error(`FAIL raster-datum-ongewijzigd: ${diffs.length}/${checks}`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK  raster-datum-ongewijzigd: ${checks}/${checks}`);
process.exit(0);
