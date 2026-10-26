// Aanval na #600 (a01, BLOKKEERT): ALAP plaatst een niet-gestarte taak met haar opgeslagen duur
// binnen het late venster, in de maat van haar profiel.
//
// De fout: `applyAlap` telde de speling in hele kalenderdagen en verschoof begin en einde daarna los
// met `addWorkingDaysSigned`. Op een kalender met een korte dag (vr 08:00–14:00) gaf dat:
//  - OPS: A (1 d) op do 08:00–16:00 met nog 1 d / 360 min speling, terwijl vr 08:00–14:00 de hele
//    werkdag is en het late venster;
//  - P6 en MSP (1 d = 480 werkminuten): A op vr 08:00–16:00, een venster met maar 360 werkminuten,
//    terwijl het late einde ma 10:00 is;
//  - OPS 1,5 d: do 08:00 tot vr 12:00, gemeten 1,6667 d.
// Ook bleef bij een opvolger een dagdeel vrije speling liggen, en bij een losse START-mijlpaal
// (knownbug 273) ook.
//
// Wat deze batterij vastpint, onder OPS, P6 en MSP:
//  1. zonder opvolger: het ALAP-venster is het late venster (einde = late finish), met precies de
//     opgeslagen duur in de maat van het profiel (OPS: dagenmaat, P6/MSP: werkminuten);
//  2. met een opvolger: het einde valt op de laatste grens die de opvolger toestaat (vrije speling 0)
//     en de opvolger beweegt niet;
//  3. de uitvoerbaarheid: wie de taak zonder ALAP op haar ALAP-start zet, krijgt hetzelfde venster en
//     dezelfde opvolgers. Ook bij SS met een 24-uurslagkalender (knownbug 345), waar de
//     terugrekening een te late start belooft: dan blijft de taak staan in plaats van de opvolger
//     te vertragen;
//  4. een losse START-mijlpaal met ALAP staat op haar late start, zonder speling (knownbug 273);
//  5. de store neemt het venster over, zonder speling en zonder `scheduleStale`.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { solveProject } from '@/engine/scheduler/solveProject';
import { solveInputFor } from '@/engine/scheduler/solveInput';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { createAppStoreContext } from '@/state/appStore';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};
const near = (label: string, got: number, want: number) => {
  checks++;
  if (!(Math.abs(got - want) < 1e-9)) diffs.push(`${label}: verwacht ${want}, kreeg ${got}`);
};

const PROFILES = ['ops', 'p6', 'msproject'] as const;
type Profile = typeof PROFILES[number];

const BAND = [{ start: 480, end: 960 }];
const SHORT = [{ start: 480, end: 840 }];
const SCALAR: WorkCalendar = {
  id: 'c', name: '8u', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
/** Het rapportgeval: scalaire kalender ma–vr 08:00–16:00, werkende uitzondering vr 5 juni 08:00–14:00. */
const SHORT_FRIDAY_EXCEPTION: WorkCalendar = {
  ...SCALAR,
  workingExceptions: [{ name: 'Vrijdag kort', startDate: '2026-06-05', endDate: '2026-06-05', bands: SHORT }],
} as WorkCalendar;
/** Dezelfde week met eigen werkblokken: elke vrijdag 08:00–14:00. */
const SHORT_FRIDAY_BLOCKS: WorkCalendar = {
  ...SCALAR,
  workTime: { byWeekday: { 1: BAND, 2: BAND, 3: BAND, 4: BAND, 5: SHORT, 6: [], 7: [] } },
} as WorkCalendar;

function task(id: string, days: number, opts: { alap?: boolean; start?: string; unit?: 'days' | 'hours'; milestoneKind?: 'START' | 'FINISH' } = {}): Task {
  const start = opts.start ?? '2026-06-01T08:00';
  const unit = opts.unit ?? 'days';
  return {
    id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: days === 0, priority: 500, parentId: null, childIds: [], resourceIds: [],
    ...(opts.milestoneKind ? { milestoneKind: opts.milestoneKind } : {}),
    ...(opts.alap ? { constraint: { type: 'ALAP' } } : {}),
    time: {
      durationUnit: unit, durationType: 'WORKTIME', scheduleDuration: days,
      ...(unit === 'hours' ? { durationMinutes: days * 480 } : {}),
      scheduleStart: start, scheduleFinish: start, earlyStart: start, earlyFinish: start,
      lateStart: start, lateFinish: start, totalFloat: 0, freeFloat: 0, completion: 0, isCritical: false,
    },
  } as Task;
}
const fs = (p: string, s: string): Sequence => ({ id: `${p}-${s}`, predecessorId: p, successorId: s, type: 'FINISH_START', lagDays: 0 });

function run(profile: Profile, tasks: Task[], seqs: Sequence[], cal: WorkCalendar, lagCalendar?: string) {
  const project = {
    startDate: '2026-06-01', schedulingProfile: builtInProfile(profile),
    schedulingOptions: lagCalendar ? { lagCalendar } : {},
  } as Parameters<typeof solveInputFor>[0];
  const r = solveProject(solveInputFor(project, tasks, seqs, cal, [cal]));
  if (r.error) diffs.push(`${profile}: rekenfout ${r.error}`);
  return r;
}

/** De opgeslagen duur in de maat van het profiel: OPS telt dagen in de dagenmaat, P6/MSP werkminuten. */
function expectWindowHoldsDuration(label: string, profile: Profile, cal: WorkCalendar, es: string, ef: string, days: number) {
  const eng = new CalendarEngine(cal);
  const a = new Date(`${es}Z`);
  const b = new Date(`${ef}Z`);
  if (profile === 'ops') near(`${label}: duur in de dagenmaat`, eng.measuredWorkdaysBetween(a, b), days);
  else eq(`${label}: duur in werkminuten`, eng.workMinutesBetween(a, b), days * 480);
}

/** Uitvoerbaarheid: zet de taak zonder ALAP op haar ALAP-start; venster en opvolgers blijven gelijk. */
function expectFeasible(label: string, profile: Profile, tasks: Task[], seqs: Sequence[], cal: WorkCalendar, alapId: string, lagCalendar?: string) {
  const first = run(profile, tasks, seqs, cal, lagCalendar);
  const placed = first.tasks.get(alapId)!;
  const replay = tasks.map((t) => {
    if (t.id !== alapId) return t;
    const { constraint: _drop, ...rest } = t;
    void _drop;
    return { ...rest, time: { ...t.time, scheduleStart: placed.earlyStart, scheduleFinish: placed.earlyStart } } as Task;
  });
  const again = run(profile, replay, seqs, cal, lagCalendar);
  const windowOf = (r: typeof first, id: string) => [r.tasks.get(id)!.earlyStart, r.tasks.get(id)!.earlyFinish];
  for (const t of tasks) {
    eq(`${label}: ${t.id} gelijk na herberekening vanaf de ALAP-start`, windowOf(again, t.id), windowOf(first, t.id));
  }
}

// ── 1. Zonder opvolger: het late venster, met de opgeslagen duur ────────────────────────────────
for (const profile of PROFILES) {
  for (const [calName, cal] of [['uitzondering', SHORT_FRIDAY_EXCEPTION], ['eigen blokken', SHORT_FRIDAY_BLOCKS]] as const) {
    for (const days of [1, 1.5, 2]) {
      const label = `${profile} ${calName} A=${days} d`;
      const tasks = [task('A', days, { alap: true }), task('E', 5)];
      const r = run(profile, tasks, [], cal);
      const a = r.tasks.get('A')!;
      eq(`${label}: einde = late finish`, a.earlyFinish, a.lateFinish);
      eq(`${label}: start = late start`, a.earlyStart, a.lateStart);
      eq(`${label}: einde = einde van E`, a.earlyFinish, r.tasks.get('E')!.earlyFinish);
      eq(`${label}: speling (totaal, vrij) in minuten`, [a.totalFloatMinutes, a.freeFloatMinutes], [0, 0]);
      expectWindowHoldsDuration(label, profile, cal, a.earlyStart, a.earlyFinish, days);
      expectFeasible(label, profile, tasks, [], cal, 'A');
    }
  }
}
// De letterlijke vensters uit het rapport (scalaire kalender + uitzondering).
for (const profile of PROFILES) {
  const r = run(profile, [task('A', 1, { alap: true }), task('E', 5)], [], SHORT_FRIDAY_EXCEPTION);
  const a = r.tasks.get('A')!;
  eq(`${profile} rapport A=1 d`, [a.earlyStart, a.earlyFinish],
    profile === 'ops' ? ['2026-06-05T08:00', '2026-06-05T14:00'] : ['2026-06-05T08:00', '2026-06-08T10:00']);
}
{
  const r = run('ops', [task('A', 1.5, { alap: true }), task('E', 5)], [], SHORT_FRIDAY_EXCEPTION);
  const a = r.tasks.get('A')!;
  eq('ops rapport A=1,5 d', [a.earlyStart, a.earlyFinish], ['2026-06-04T12:00', '2026-06-05T14:00']);
}

// ── 2. Met een opvolger: einde op de grens die de opvolger toestaat ─────────────────────────────
for (const profile of PROFILES) {
  for (const [calName, cal] of [['uitzondering', SHORT_FRIDAY_EXCEPTION], ['eigen blokken', SHORT_FRIDAY_BLOCKS]] as const) {
    for (const days of [1, 1.5]) {
      const label = `${profile} ${calName} A=${days} d → B`;
      const tasks = [task('A', days, { alap: true }), task('E', 5), task('B', 1)];
      const seqs = [fs('A', 'B'), fs('E', 'B')];
      const r = run(profile, tasks, seqs, cal);
      const without = run(profile, [task('A', days), task('E', 5), task('B', 1)], seqs, cal);
      const a = r.tasks.get('A')!;
      eq(`${label}: einde = einde van E`, a.earlyFinish, r.tasks.get('E')!.earlyFinish);
      eq(`${label}: vrije speling in minuten`, a.freeFloatMinutes, 0);
      eq(`${label}: B beweegt niet`, [r.tasks.get('B')!.earlyStart, r.tasks.get('B')!.earlyFinish],
        [without.tasks.get('B')!.earlyStart, without.tasks.get('B')!.earlyFinish]);
      expectWindowHoldsDuration(label, profile, cal, a.earlyStart, a.earlyFinish, days);
      expectFeasible(label, profile, tasks, seqs, cal, 'A');
    }
  }
}
// Een dagdeel speling bij een opvolger (gewone kalender): X 2,5 d drijft B; A 1 d ALAP → B. Met hele
// dagen bleef A op di 08:00–16:00 staan, met 240 min vrije speling.
for (const profile of PROFILES) {
  const label = `${profile} dagdeel voor B`;
  const tasks = [task('A', 1, { alap: true }), task('X', 2.5), task('B', 1)];
  const seqs = [fs('A', 'B'), fs('X', 'B')];
  const r = run(profile, tasks, seqs, SCALAR);
  const a = r.tasks.get('A')!;
  eq(`${label}: A`, [a.earlyStart, a.earlyFinish], ['2026-06-02T12:00', '2026-06-03T12:00']);
  eq(`${label}: vrije speling in minuten`, a.freeFloatMinutes, 0);
  expectFeasible(label, profile, tasks, seqs, SCALAR, 'A');
}

// ── 3. SS met een 24-uurslagkalender (knownbug 345): ALAP vertraagt de opvolger niet ────────────
for (const profile of PROFILES) {
  const label = `${profile} SS+1,5 d 24-uurs`;
  const seqs: Sequence[] = [{ id: 's', predecessorId: 'A', successorId: 'B', type: 'START_START', lagDays: 1.5 }];
  const tasks = [task('A', 2, { alap: true }), task('B', 1, { unit: 'hours' })];
  const r = run(profile, tasks, seqs, SCALAR, '24hour');
  const without = run(profile, [task('A', 2), task('B', 1, { unit: 'hours' })], seqs, SCALAR, '24hour');
  eq(`${label}: B beweegt niet`, [r.tasks.get('B')!.earlyStart, r.tasks.get('B')!.earlyFinish],
    [without.tasks.get('B')!.earlyStart, without.tasks.get('B')!.earlyFinish]);
  checks++;
  if (!((r.tasks.get('A')!.freeFloatMinutes ?? 0) >= 0)) diffs.push(`${label}: negatieve vrije speling voor A`);
  expectFeasible(label, profile, tasks, seqs, SCALAR, 'A', '24hour');
}

// ── 4. Knownbug 273: losse START-mijlpaal met ALAP naast een taak van 3 d ───────────────────────
// Kalender 7–16 met een uur pauze (8 u per dag). Vóór de fix: M op wo 10:00 met 0,625 d (300 min)
// totale en vrije speling; de late start is wo 16:00.
{
  const CAL7: WorkCalendar = {
    id: 'c7', name: '7–16', description: '', workDays: [1, 2, 3, 4, 5], workStartHour: 7, workEndHour: 16, hoursPerDay: 8, holidays: [],
  };
  const BAND7 = [{ start: 420, end: 720 }, { start: 780, end: 960 }];
  const CAL7_BLOCKS = { ...CAL7, workTime: { byWeekday: { 1: BAND7, 2: BAND7, 3: BAND7, 4: BAND7, 5: BAND7, 6: [], 7: [] } } } as WorkCalendar;
  for (const profile of PROFILES) {
    for (const [calName, cal] of [['scalair', CAL7], ['eigen blokken', CAL7_BLOCKS]] as const) {
      const label = `${profile} ${calName} START-mijlpaal`;
      const tasks = [
        task('M', 0, { alap: true, start: '2026-06-01T10:00', milestoneKind: 'START' }),
        task('A', 3, { start: '2026-06-01T07:00' }),
      ];
      const r = run(profile, tasks, [], cal);
      const m = r.tasks.get('M')!;
      eq(`${label}: op de late start`, [m.earlyStart, m.earlyFinish], [m.lateStart, m.lateFinish]);
      eq(`${label}: op het einde van A`, m.earlyStart, r.tasks.get('A')!.earlyFinish);
      eq(`${label}: speling (totaal, vrij) in minuten`, [m.totalFloatMinutes, m.freeFloatMinutes], [0, 0]);
    }
  }
}

// ── 5. De store neemt het venster over ──────────────────────────────────────────────────────────
for (const profile of PROFILES) {
  const ctx = createAppStoreContext();
  ctx.store.setState((s) => {
    s.project.startDate = '2026-06-01';
    s.project.statusDate = undefined;
    s.project.schedulingProfile = builtInProfile(profile);
    s.project.schedulingOptions = {};
    s.calendar = SHORT_FRIDAY_EXCEPTION;
    s.calendars = [SHORT_FRIDAY_EXCEPTION];
    s.tasks = [task('A', 1, { alap: true }), task('E', 5)];
    s.sequences = [];
    s.resources = [];
    s.assignments = [];
  });
  ctx.store.getState().runCPM();
  const s = ctx.store.getState();
  const a = s.tasks.find((t) => t.id === 'A')!;
  eq(`${profile} store: geen fout, niet verouderd`, [s.cpmResult?.error ?? null, s.scheduleStale], [null, false]);
  eq(`${profile} store: venster van A`, [a.time.earlyStart, a.time.earlyFinish],
    profile === 'ops' ? ['2026-06-05T08:00', '2026-06-05T14:00'] : ['2026-06-05T08:00', '2026-06-08T10:00']);
  eq(`${profile} store: speling (totaal, vrij) in minuten`, [a.time.totalFloatMinutes, a.time.freeFloatMinutes], [0, 0]);
}

if (diffs.length === 0) {
  console.log(`OK  alap-maatplaatsing: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  alap-maatplaatsing: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
