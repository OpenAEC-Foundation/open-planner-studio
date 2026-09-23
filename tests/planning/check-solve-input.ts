// Solver-invoer (rekenprofielen, spec v3.1 §3.1/§3.2; plan taak C1, C5 breidt uit). Exit 0 = groen.
//
// Wat hier bewezen wordt: (1) solveOptionsFor neemt de vijf projectvelden letterlijk over en levert
// EffectiveSchedulingOptions (conventies uit het profiel, als LAATSTE gespreid); (2) compile-time: een
// kale projectoptie-set is geen geldige CPMOptions, en het veld is verplicht. Mutatiebewijs (C1):
// `schedulingOptions?:` optioneel ⇒ de tweede @ts-expect-error is ongebruikt ⇒ typecheck rood;
// het veld verbreed tot `SchedulingOptions` ⇒ de eerste is ongebruikt ⇒ typecheck rood.
import { solveOptionsFor, solveInputFor } from '@/engine/scheduler/solveInput';
import { CONVENTION_KEYS, builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import type { EffectiveSchedulingOptions, ProjectSchedulingOptions } from '@/types/project';
import type { CPMOptions } from '@/engine/scheduler/CPMSolver';
import type { SolveProjectInput } from '@/engine/scheduler/solveProject';
import { createDefaultProject } from '@/state/defaults';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { prepareLoadedPayload } from '@/state/documentActivation';
import { freshPayload } from '@/state/documentContract';
import { solveProject, cloneTasksForSolve } from '@/engine/scheduler/solveProject';
import { ephemeralSolve, occupancySolveInputFor } from '@/services/library/occupancy';
import { createAppStoreContext } from '@/state/appStore';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const project = {
  ...createDefaultProject(),
  startDate: '2026-06-01', endDate: '2026-12-31', statusDate: '2026-07-01',
  progressMode: 'PROGRESS_OVERRIDE' as const,
  schedulingOptions: { lagCalendar: 'successor' as const },
};
const o = solveOptionsFor(project);
eq('01 vijf projectvelden letterlijk', [o.dataDate, o.progressMode, o.projectStartDate, o.projectEndDate],
  ['2026-07-01', 'PROGRESS_OVERRIDE', '2026-06-01', '2026-12-31']);
eq('02 zonder profiel: eenentwintig conventies uit', CONVENTION_KEYS.map(k => o.schedulingOptions[k]), CONVENTION_KEYS.map(() => false));
eq('03 projectopties komen mee', o.schedulingOptions.lagCalendar, 'successor');
eq('04 p6-profiel zet B1 aan',
  solveOptionsFor({ ...project, schedulingProfile: builtInProfile('p6') }).schedulingOptions.p6RelationFinishBoundary, true);
const stray = {
  ...project, schedulingProfile: builtInProfile('ops'),
  schedulingOptions: { clampNegativeFreeFloat: true } as unknown as ProjectSchedulingOptions,
};
eq('05 profiel wint van een verdwaalde conventiesleutel in de opties', solveOptionsFor(stray).schedulingOptions.clampNegativeFreeFloat, false);
const cal = createDefaultCalendar();
const input: SolveProjectInput = solveInputFor(project, [], [], cal, [cal]);
eq('07 solveInputFor = invoerlijsten + solveOptionsFor', [input.projectStartDate, input.calendar === cal, input.schedulingOptions.lagCalendar],
  ['2026-06-01', true, 'successor']);

// Compile-time bewijs (npm run typecheck): een kale projectoptie-set is GEEN solverinvoer.
// @ts-expect-error — CPMOptions.schedulingOptions eist EffectiveSchedulingOptions (conventies verplicht)
const bad: CPMOptions = { schedulingOptions: { lagCalendar: 'successor' } as ProjectSchedulingOptions };
// @ts-expect-error — en het veld is verplicht: wie geen opties meegeeft, compileert niet
const missing: CPMOptions = {};
const good: CPMOptions = { schedulingOptions: effectiveSchedulingOptions({}) satisfies EffectiveSchedulingOptions };
void bad; void missing; void good;

// ── C5: benoemde gedragswijziging — laadpad en bezetting rekenen met dezelfde invoer als F5 ─────────
// Verwachtingen komen uit F5/solveInputFor zelf (geen hard-gecodeerde datums). Mutatiebewijs: vóór
// C5 (toen laadpad en bezetting projectEndDate/projectStartDate nog op undefined zetten) zijn
// C5-01 en C5-03 rood; C5-02/C5-04 bewijzen dat de fixture het verschil kan zien.
{
  const cal5 = createDefaultCalendar();
  const task = {
    id: 'a', name: 'A', description: '', wbsCode: '1', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
    time: createDefaultTaskTime('2026-06-01', 5),
  } as Task;
  const base = freshPayload();
  const payload = {
    ...base,
    project: { ...base.project, calendarId: cal5.id, startDate: '2026-06-01', endDate: '2026-06-30',
      schedulingOptions: { useProjectEndDateForFloat: true } },
    calendar: cal5, calendars: [cal5], tasks: [task], sequences: [], cpmResult: null,
  };
  const loaded = prepareLoadedPayload(payload, { recompute: true });
  const direct = solveProject(solveInputFor(payload.project, cloneTasksForSolve([task]), [], cal5, [cal5]));
  eq('C5-01 laadpad rekent met het projecteinde-anker zoals F5',
    loaded.cpmResult?.tasks.get('a')?.lateFinish, direct.tasks.get('a')?.lateFinish);
  eq('C5-02 dat anker doet er in deze fixture toe (LF ≠ EF)',
    direct.tasks.get('a')?.lateFinish !== direct.tasks.get('a')?.earlyFinish, true);
}
{
  const ctx = createAppStoreContext();
  const S = () => ctx.store.getState();
  S().newProject();
  S().setProject({ startDate: '2026-06-01' });
  const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-05-04', 2) });
  const b = S().addTask({ name: 'B', time: createDefaultTaskTime('2026-05-04', 2) });
  S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 } as Omit<Sequence, 'id'>);
  S().runCPM();
  const f5 = S().tasks.find(t => t.id === b)?.time.earlyStart ?? '';
  const solved = ephemeralSolve({
    docId: 'd', title: '', scheduleStale: true, companyId: null, resources: [], assignments: [],
    tasks: S().tasks, calendar: S().calendar, calendars: S().calendars,
    solveInput: occupancySolveInputFor({ tasks: S().tasks, sequences: S().sequences, project: S().project }),
  });
  eq('C5-03 bezetting rekent met de projectstart-vloer zoals F5', solved?.find(t => t.id === b)?.time.earlyStart, f5);
  eq('C5-04 die vloer doet er in deze fixture toe', f5 >= '2026-06-01', true);
}

if (diffs.length === 0) console.log(`OK: solver-invoer — ${checks} checks groen`);
else { console.log(`XX solver-invoer — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
