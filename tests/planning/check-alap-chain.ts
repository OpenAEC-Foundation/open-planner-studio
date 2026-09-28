// Audit 2026-09-26 — ALAP-keten (eigenaarsbesluit: alle rekenprofielen).
//
// `applyAlap` liep de taken in voorwaartse volgorde. Een ALAP-voorganger mat haar vrije speling dan
// tegen een nog niet verschoven ALAP-opvolger: van A→B→einde kwam alleen B laat, A bleef vooraan
// staan. MS Project en P6 zetten de hele keten laat. Nu opvolgers eerst: elke schakel sluit aan.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Project } from '@/types/project';
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
  id: 'c', name: 'c', description: 'c', workDays: [1, 2, 3, 4, 5], workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
function mk(id: string, dur: number, alap = false): Task {
  return {
    id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
    isMilestone: false, priority: 500, parentId: null, childIds: [], time: createDefaultTaskTime('2026-06-01', dur), resourceIds: [],
    ...(alap ? { constraint: { type: 'ALAP' } } : {}),
  } as Task;
}
const fs = (p: string, s: string): Sequence => ({ id: `${p}-${s}`, predecessorId: p, successorId: s, type: 'FINISH_START', lagDays: 0 });
const day = (v: unknown) => String(v).slice(0, 10);

for (const base of ['ops', 'p6', 'msproject'] as const) {
  const opts = { schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: { base } } as unknown as Project) };

  // Keten van twee: X (10 dagen, 1–12 juni) drijft EINDE; A→B→EINDE zijn beide ALAP.
  {
    const r = new CPMSolver(
      [mk('A', 2, true), mk('B', 2, true), mk('X', 10), mk('END', 1)],
      [fs('A', 'B'), fs('B', 'END'), fs('X', 'END')], CAL, [], opts,
    ).solve();
    const t = (id: string) => r.tasks.get(id)!;
    eq(`${base} keten2: B laat`, [day(t('B').earlyStart), day(t('B').earlyFinish)], ['2026-06-11', '2026-06-12']);
    eq(`${base} keten2: A sluit aan op B`, [day(t('A').earlyStart), day(t('A').earlyFinish)], ['2026-06-09', '2026-06-10']);
    eq(`${base} keten2: vrije speling A en B`, [t('A').freeFloat, t('B').freeFloat], [0, 0]);
    eq(`${base} keten2: EINDE beweegt niet`, day(t('END').earlyStart), '2026-06-15');
  }

  // Keten van drie: C→D→E→EINDE sluit schakel voor schakel aan tegen EINDE.
  {
    const r = new CPMSolver(
      [mk('C', 1, true), mk('D', 1, true), mk('E', 1, true), mk('X', 10), mk('END', 1)],
      [fs('C', 'D'), fs('D', 'E'), fs('E', 'END'), fs('X', 'END')], CAL, [], opts,
    ).solve();
    const t = (id: string) => r.tasks.get(id)!;
    eq(`${base} keten3: E, D, C`, ['E', 'D', 'C'].map((id) => day(t(id).earlyStart)), ['2026-06-12', '2026-06-11', '2026-06-10']);
  }

  // Een gewone (niet-ALAP) opvolger S van D blijft vroeg staan; D heeft dan geen vrije speling en
  // blijft staan, en C dus ook (zero free float, geen totale speling).
  {
    const r = new CPMSolver(
      [mk('C', 1, true), mk('D', 1, true), mk('S', 1), mk('X', 10), mk('END', 1)],
      [fs('C', 'D'), fs('D', 'S'), fs('S', 'END'), fs('X', 'END')], CAL, [], opts,
    ).solve();
    const t = (id: string) => r.tasks.get(id)!;
    eq(`${base} vaste opvolger: S, D, C`, ['S', 'D', 'C'].map((id) => day(t(id).earlyStart)), ['2026-06-03', '2026-06-02', '2026-06-01']);
  }
}

if (diffs.length === 0) {
  console.log(`OK  alap-chain: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  alap-chain: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
