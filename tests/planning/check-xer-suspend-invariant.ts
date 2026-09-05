import { solveProject } from '@/engine/scheduler/solveProject';
import { isMultiDocumentImport, type ImportResult } from '@/services/importTypes';
import { readXerArchiveIFC as readIFC } from './xerArchiveTestReader';
import { writeIFC } from '@/services/ifc/ifcWriter';
import { readXER } from '@/services/xer/xerReader';
import { createAppStore } from '@/state/appStore';
import { recoveryInputFromParsed } from '@/state/documentContract';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import type { Task } from '@/types/task';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown): void => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const xer = [
  'ERMHDR\t23.12\t2026-08-01\t\t\t\t\t\tEUR',
  '%T\tPROJECT',
  '%F\tproj_id\tproj_short_name\tclndr_id\tlast_recalc_date',
  '%R\tP1\tInvariant\tC1\t2026-08-10 08:00',
  '%T\tCALENDAR',
  '%F\tclndr_id\tclndr_name\tproj_id\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
  '%R\tC1\tWerkweek\tP1\tCA_Project\t8\t40\t',
  '%T\tTASK',
  '%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tcomplete_pct_type\tcomplete_pct\tphys_complete_pct\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tsuspend_date\tresume_date\texpect_end_date',
  '%R\tINV\tP1\tC1\tINV\tInvariant\tTT_Task\tTK_Active\tCP_Phys\t\t75\t8\t2\t2026-08-03 08:00\t2026-08-03 16:00\t2026-08-03 08:00\t\t2026-08-04 15:30\t2026-08-20 08:00\t',
  '%E',
];
const opened = readXER(new TextEncoder().encode(xer.join('\n')));
if (isMultiDocumentImport(opened)) throw new Error('invariantfixture gaf meerdere documenten');
const source: ImportResult = opened;

function solveFinish(imported: ImportResult): string | undefined {
  const sourceTask = imported.tasks.find(candidate => candidate.wbsCode === 'INV')!;
  const task = structuredClone(sourceTask);
  const result = solveProject({
    tasks: [task],
    sequences: [],
    calendar: imported.calendar,
    calendars: [imported.calendar, ...(imported.resourceCalendars ?? [])],
    dataDate: imported.project.statusDate,
    progressMode: imported.project.progressMode,
    schedulingOptions: imported.project.schedulingOptions,
    projectStartDate: imported.project.startDate,
  });
  return result.tasks.get(task.id)?.earlyFinish;
}

eq('geldig ongewijzigd XER-paar houdt P6-semantiek', {
  flag: opened.tasks[0]?.p6SuspendResume,
  finish: solveFinish(opened),
}, { flag: true, finish: '2026-08-20T10:00' });

function storeWithSource() {
  const store = createAppStore();
  store.setState({
    project: source.project,
    calendar: source.calendar,
    tasks: structuredClone(source.tasks),
    sequences: structuredClone(source.sequences),
    resources: structuredClone(source.resources ?? []),
    assignments: structuredClone(source.assignments ?? []),
    calendars: structuredClone(source.resourceCalendars ?? []),
    activityCodeTypes: structuredClone(source.activityCodeTypes ?? []),
    customFieldDefs: structuredClone(source.customFieldDefs ?? []),
  });
  return store;
}

const looseStore = storeWithSource();
const looseBefore = looseStore.getState().tasks.find(task => task.wbsCode === 'INV')!;
looseStore.getState().updateTask(looseBefore.id, {
  time: { ...looseBefore.time, stop: undefined },
});
const looseEdited = looseStore.getState().tasks.find(task => task.wbsCode === 'INV')!;
eq('updateTask naar losse resume wist onmiddellijk de semantische vlag maar bewaart raw resume', {
  stop: looseEdited.time.stop,
  resume: looseEdited.time.resume,
  flag: looseEdited.p6SuspendResume,
}, { stop: undefined, resume: '2026-08-20T08:00', flag: undefined });

const looseParsed = readIFC(writeIFC(buildWriteIFCInput(looseStore.getState())));
const recoveryStore = createAppStore();
recoveryStore.getState().restoreDocuments([
  recoveryInputFromParsed(looseParsed, { id: 'x7-recovery', filePath: '/tmp/x7-recovery.ifc', isDirty: true }),
], 'x7-recovery');
const recovered = recoveryStore.getState();
const recoveredTask = recovered.tasks.find(task => task.wbsCode === 'INV')!;
const recoveredImport: ImportResult = {
  project: recovered.project,
  calendar: recovered.calendar,
  tasks: recovered.tasks,
  sequences: recovered.sequences,
  resources: recovered.resources,
  assignments: recovered.assignments,
  resourceCalendars: recovered.calendars,
  activityCodeTypes: recovered.activityCodeTypes,
  customFieldDefs: recovered.customFieldDefs,
};
eq('losse resume blijft na IFC/recovery raw data zonder P6-route', {
  stop: recoveredTask.time.stop,
  resume: recoveredTask.time.resume,
  flag: recoveredTask.p6SuspendResume,
  finish: solveFinish(recoveredImport),
}, {
  stop: undefined,
  resume: '2026-08-20T08:00',
  flag: undefined,
  finish: '2026-08-10T10:00',
});

const reverseStore = storeWithSource();
const reverseBefore = reverseStore.getState().tasks.find(task => task.wbsCode === 'INV')!;
reverseStore.getState().updateTask(reverseBefore.id, {
  time: { ...reverseBefore.time, stop: '2026-08-21T08:00' },
});
const reverseEdited = reverseStore.getState().tasks.find(task => task.wbsCode === 'INV')!;
eq('updateTask naar omgekeerd paar wist de semantische vlag maar bewaart beide raw datums', {
  stop: reverseEdited.time.stop,
  resume: reverseEdited.time.resume,
  flag: reverseEdited.p6SuspendResume,
}, { stop: '2026-08-21T08:00', resume: '2026-08-20T08:00', flag: undefined });

const staleSolverInput = structuredClone(opened);
const staleSolverTask = staleSolverInput.tasks.find(task => task.wbsCode === 'INV')!;
staleSolverTask.time.stop = '2026-08-21T08:00';
staleSolverTask.p6SuspendResume = true;
eq('solverpredicate weigert stale true bij een omgekeerd paar', solveFinish(staleSolverInput),
  '2026-08-10T10:00');

const staleWriterInput = structuredClone(opened);
const staleWriterTask = staleWriterInput.tasks.find(task => task.wbsCode === 'INV')!;
staleWriterTask.time.stop = '2026-08-21T08:00';
staleWriterTask.p6SuspendResume = true;
const gatedIfc = writeIFC(staleWriterInput);
eq('IFC-writergate serialiseert stale true niet', gatedIfc.includes("'SuspendResume'"), false);
const gatedReloadTask = readIFC(gatedIfc).tasks.find(task => task.wbsCode === 'INV')!;
eq('IFC-writergate bewaart omgekeerde raw datums maar niet de vlag', {
  stop: gatedReloadTask.time.stop,
  resume: gatedReloadTask.time.resume,
  flag: gatedReloadTask.p6SuspendResume,
}, { stop: '2026-08-21T08:00', resume: '2026-08-20T08:00', flag: undefined });

const validIfc = writeIFC(opened);
const staleIfc = validIfc.replace('2026-08-04T15:30', '2026-08-21T08:00');
if (staleIfc === validIfc) throw new Error('stale-IFC-fixture kon de Stop-datum niet muteren');
const staleReload = readIFC(staleIfc);
const staleTask = staleReload.tasks.find(task => task.wbsCode === 'INV')!;
eq('IFC-reader herstelt een stale true niet bij een omgekeerd raw paar', {
  stop: staleTask.time.stop,
  resume: staleTask.time.resume,
  flag: staleTask.p6SuspendResume,
}, { stop: '2026-08-21T08:00', resume: '2026-08-20T08:00', flag: undefined });

const validReload = readIFC(validIfc);
eq('geldig onveranderd paar round-tript exact en houdt P6-semantiek', {
  flag: validReload.tasks.find(task => task.wbsCode === 'INV')?.p6SuspendResume,
  finish: solveFinish(validReload),
}, { flag: true, finish: '2026-08-20T10:00' });

// Compilebewijs: de echte updateTask-route accepteert een volledige TaskTime; extensions lopen
// via exact deze route. MCP laat stop/resume niet toe en heeft dus geen schrijfpad om hier te testen.
void (looseEdited satisfies Task);

if (diffs.length > 0) {
  console.error(`XER-X7-suspendinvariant: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(`XX  ${diff}`);
  process.exit(1);
}
console.log(`OK XER-X7-suspendinvariant: ${checks} checks groen`);
