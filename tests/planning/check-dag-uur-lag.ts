// Audit 2026-09-26 — dag-voorganger → uur-opvolger met een lange lag (backward pass).
//
// De late finish van de dag-voorganger werd gezocht met een dag-voor-dag-scan van hoogstens 400
// kalenderdagen terug vanaf de opvolger. Een lag groter dan dat bereik (≈ 280 werkdagen) vond niets
// en viel terug op de snap ZÓNDER lag: A kreeg een late finish vlak vóór B en honderden dagen
// onterechte speling, het kritieke pad verdween. Nu een monotone (galopperend + binaire) zoektocht:
// binnen het oude bereik exact dezelfde dag, daarbuiten het juiste antwoord.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
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

if (diffs.length === 0) {
  console.log(`OK  dag-uur-lag: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  dag-uur-lag: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
