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
eq('02 zonder profiel: vijftien conventies uit', CONVENTION_KEYS.map(k => o.schedulingOptions[k]), CONVENTION_KEYS.map(() => false));
eq('03 projectopties komen mee', o.schedulingOptions.lagCalendar, 'successor');
eq('04 p6-profiel zet B1 aan',
  solveOptionsFor({ ...project, schedulingProfile: builtInProfile('p6') }).schedulingOptions.p6RelationFinishBoundary, true);
const stray = {
  ...project, schedulingProfile: builtInProfile('ops'),
  schedulingOptions: { clampNegativeFreeFloat: true } as unknown as ProjectSchedulingOptions,
};
eq('05 profiel wint van een verdwaalde conventiesleutel in de opties', solveOptionsFor(stray).schedulingOptions.clampNegativeFreeFloat, false);
// TIJDELIJK(rekenprofielen): tot C3 dragen verse XER-imports hun p6Source nog in de opties.
const legacy = { ...project, schedulingOptions: { p6Source: 'XER' } as unknown as ProjectSchedulingOptions };
eq('06 TIJDELIJK legacy p6Source ⇒ B-vlaggen aan', solveOptionsFor(legacy).schedulingOptions.p6OpenLoeTargetSpan, true);
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

if (diffs.length === 0) console.log(`OK: solver-invoer — ${checks} checks groen`);
else { console.log(`XX solver-invoer — ${diffs.length} van ${checks} checks rood:`); for (const d of diffs) console.log(`  - ${d}`); process.exit(1); }
