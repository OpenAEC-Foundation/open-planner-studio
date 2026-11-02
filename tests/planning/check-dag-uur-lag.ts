// Audit 2026-09-26 — dag-voorganger → uur-opvolger met een lange lag (backward pass).
//
// De late finish van de dag-voorganger werd gezocht met een dag-voor-dag-scan van hoogstens 400
// kalenderdagen terug vanaf de opvolger. Een lag groter dan dat bereik (≈ 280 werkdagen) vond niets
// en viel terug op de snap ZÓNDER lag: A kreeg een late finish vlak vóór B en honderden dagen
// onterechte speling, het kritieke pad verdween. Nu een monotone (galopperend + binaire) zoektocht:
// binnen het oude bereik exact dezelfde dag, daarbuiten het juiste antwoord.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { createAppStoreContext } from '@/state/appStoreFactory';
import { builtInProfile } from '@/engine/scheduler/conventions/registry';
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

const CAL: WorkCalendar = {
  id: 'c', name: 'c', description: 'c', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
  holidays: [{ name: 'kerst', startDate: '2026-12-24', endDate: '2027-01-01' }],
};
function mk(id: string, dur: number, hours = false): Task {
  const time = createDefaultTaskTime('2026-06-01', dur) as Task['time'];
  if (hours) { time.durationUnit = 'hours'; time.durationMinutes = 480; }
  return {
    id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], time, resourceIds: [],
  } as Task;
}
const opts = { schedulingOptions: effectiveSchedulingOptions({}) };

for (const type of ['FINISH_START', 'START_START'] as const) {
  for (const lag of [0, 7, 250, 280, 300, 400, 401, 1000]) {
    const seqs: Sequence[] = [{ id: 's', predecessorId: 'A', successorId: 'B', type, lagDays: lag }];
    const r = new CPMSolver([mk('A', 5), mk('B', 1, true)], seqs, CAL, [], opts).solve();
    const a = r.tasks.get('A')!;
    eq(`${type} lag ${lag}: A blijft kritiek (tf 0)`, a.totalFloat, 0);
    eq(`${type} lag ${lag}: late finish A = vroege finish A`, a.lateFinish, a.earlyFinish);
  }
}

// Knownbug 346: een procentlag weegt de voorganger op diens eigen kalender.
// A = één dag van 8 uur; B heeft dagen van 10 uur. 50% van A blijft 4 uur.
for (const profile of ['p6', 'msproject'] as const) {
  for (const hours of [false, true]) {
    for (const lagCalendar of ['predecessor', 'successor', 'projectDefault'] as const) {
      const { store } = createAppStoreContext();
      const S = () => store.getState();
      const calendar = (id: string, end: number): WorkCalendar => {
        const bands = [{ start: 480, end }];
        return { ...CAL, id, holidays: [], workEndHour: end / 60, workTime: { byWeekday: {
          1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [],
        } } };
      };
      store.setState(s => {
        s.calendar = calendar('project', 960);
        s.calendars = [calendar('acht', 960), calendar('tien', 1080)];
        s.project.startDate = '2026-06-01T08:00';
        s.project.schedulingProfile = builtInProfile(profile);
        s.project.schedulingOptions = { lagCalendar };
      });
      const a = S().addTask({ ...mk('A', 1, hours), calendarId: 'acht' });
      const b = S().addTask({ ...mk('B', 1, true), calendarId: 'tien' });
      S().addSequence({ predecessorId: a, successorId: b, type: 'START_START', lagDays: 0, lagPercent: 50 });
      S().runCPM();
      const label = `346 ${profile} ${hours ? 'uren' : 'dagen'} ${lagCalendar}`;
      eq(`${label}: berekening zonder fout`, S().cpmResult?.error, undefined);
      const result = () => S().tasks.find(t => t.id === b)!.time;
      eq(`${label}: B start na 240 minuten`, result().earlyStart, '2026-06-01T12:00');
      eq(`${label}: terugrekening houdt hetzelfde startvenster`, result().lateStart, result().earlyStart);
      S().runCPM();
      eq(`${label}: tweede F5 blijft gelijk`, result().earlyStart, '2026-06-01T12:00');
    }
  }
}

if (diffs.length === 0) {
  console.log(`OK  dag-uur-lag: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  dag-uur-lag: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
