// Objecten op de site (`records` op `window.openaecHost`, OpenAEC SuperCloud) — headless, met een nephost.
//
// Wat hier vastligt:
//   A. `siteHostRecords`: alleen een object met `projects`, `list`, `save` en `delete`; het eigen
//      venster vóór de parent; een gooiende getter telt als niets; Tauri nooit.
//   B. `tasksToRecords`: samenvattingstaken gaan niet mee, de sleutel is het GlobalId van de taak, de
//      datums zijn de berekende dagen (ook in de urenmaat) met de ingevoerde als terugval, en de
//      voortgang is een heel percentage tussen 0 en 100.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
type AnyRecord = Record<string, unknown>;
const g = globalThis as unknown as AnyRecord;

const win: AnyRecord = { location: { search: '', hash: '' } };
win.parent = win;
g.window = win;

const { siteHostRecords, siteRecordsAvailable, isSiteHostRecords, tasksToRecords, TASK_RECORD_KIND } =
  await import('@/services/fileAccess/siteHostRecords');
type Task = import('@/types/task').Task;

let failures = 0;
function check(name: string, cond: boolean): void {
  if (cond) console.log(`ok ${name}`);
  else { failures++; console.error(`XX ${name}`); }
}
function eq(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(`${name} (kreeg ${a}, verwacht ${e})`, a === e);
}

function setHosts(own?: unknown, parent?: unknown): void {
  delete win.openaecHost;
  delete win.__TAURI_INTERNALS__;
  if (own !== undefined) win.openaecHost = own;
  win.parent = parent === undefined ? win : { openaecHost: parent };
}

const records = (label: string) => ({
  label,
  projects: async () => [],
  list: async () => [],
  save: async () => [],
  delete: async () => 0,
});

// ── A. De host ──────────────────────────────────────────────────────────────────────────────────────
setHosts();
check('A1 zonder host geen records', siteHostRecords() === null && !siteRecordsAvailable());
setHosts({ records: records('eigen') }, { records: records('parent') });
eq('A2 het eigen venster wint van de parent', (siteHostRecords() as unknown as { label: string }).label, 'eigen');
setHosts({ taal: 'nl' }, { records: records('parent') });
eq('A3 anders de parent', (siteHostRecords() as unknown as { label: string }).label, 'parent');
const { delete: _weg, ...drie } = records('half');
setHosts({ records: drie });
check('A4 drie van de vier functies telt niet', siteHostRecords() === null && !isSiteHostRecords(drie));
setHosts({ get records() { throw new Error('vreemd venster'); } }, { records: records('parent') });
eq('A5 een gooiende getter telt als niets', (siteHostRecords() as unknown as { label: string }).label, 'parent');
setHosts({ records: records('eigen') });
win.__TAURI_INTERNALS__ = {};
check('A6 desktop (Tauri) heeft nooit records', siteHostRecords() === null);
setHosts();

// ── B. Taken als records ────────────────────────────────────────────────────────────────────────────
function task(id: string, over: Omit<Partial<Task>, 'time'> & { time?: Partial<Task['time']> } = {}): Task {
  const { time, ...rest } = over;
  return {
    id, name: `Taak ${id}`, wbsCode: id, isMilestone: false, parentId: null, childIds: [],
    ...rest,
    time: { scheduleStart: '2026-12-01', scheduleFinish: '2026-12-05', earlyStart: '2026-12-02', earlyFinish: '2026-12-08', completion: 0, ...time },
  } as unknown as Task;
}

const tasks = [
  task('1', { name: 'Ruwbouw', childIds: ['2', '3'] }),
  task('2', { name: 'Fundering', parentId: '1', time: { completion: 0.256 } }),
  task('3', { name: 'Oplevering', parentId: '1', isMilestone: true, time: { earlyStart: '2026-12-10T08:00', earlyFinish: '2026-12-10T08:00', completion: 1.4 } }),
  task('4', { name: 'Nog niet berekend', time: { earlyStart: '', earlyFinish: '', completion: -1 } }),
  task('5', { name: 'Samenvatting zonder kinderen', isSummary: true }),
];
const made = tasksToRecords(tasks, (id) => `guid-${id}`);
eq('B1 samenvattingstaken gaan niet mee', made.map((r) => r.key), ['guid-2', 'guid-3', 'guid-4']);
check('B2 elke taak is van de soort taak', made.every((r) => r.kind === TASK_RECORD_KIND && TASK_RECORD_KIND === 'taak'));
eq('B3 titel, berekende datums en voortgang in procenten', made[0], {
  kind: 'taak', key: 'guid-2', title: 'Fundering',
  data: { wbs: '2', start: '2026-12-02', end: '2026-12-08', progress: 26, milestone: false },
  task: { start: '2026-12-02', end: '2026-12-08', progress: 26 },
});
eq('B4 de urenmaat geeft de dag, voortgang hoogstens 100', made[1].task, { start: '2026-12-10', end: '2026-12-10', progress: 100 });
check('B5 een mijlpaal is gemarkeerd', (made[1].data as { milestone: boolean }).milestone === true);
eq('B6 zonder berekening de ingevoerde datums, voortgang minstens 0', made[2].task, { start: '2026-12-01', end: '2026-12-05', progress: 0 });
eq('B7 een lege planning geeft niets', tasksToRecords([], () => 'x'), []);

if (failures > 0) {
  console.error(`\nTOTAAL: ${failures} afwijking(en)`);
  process.exitCode = 1;
}
