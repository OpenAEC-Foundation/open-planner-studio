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
  // Het profiel sleutelt op `baseId` (review 2026-09-28: met `base` draaiden alle drie de rondes als ops).
  const opts = { schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: { baseId: base, id: base, name: '', overrides: {} } }) };

  checks++;
  if (base === 'p6' && opts.schedulingOptions.p6AlapPositionedFromSuccessors !== true) diffs.push('p6-profiel niet actief (C14 uit)');
  if (base !== 'p6' && opts.schedulingOptions.p6AlapPositionedFromSuccessors === true) diffs.push(`${base}-profiel heeft C14 aan`);

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

// Gemengd (review 2026-09-28): een gewone ALAP-voorganger (dagkalender) vóór een ALAP-taak op een
// uurkalender. Onder P6 valt die tweede onder C14 (`positionAlapFromSuccessors`); in één
// achterwaartse doorloop meet de voorganger al tegen de verschoven C14-taak.
{
  const BAND = [{ start: 480, end: 960 }];
  const HOURS = { ...CAL, id: 'uren', workTime: { byWeekday: { 1: BAND, 2: BAND, 3: BAND, 4: BAND, 5: BAND, 6: [], 7: [] } } } as WorkCalendar;
  const p6 = { schedulingOptions: effectiveSchedulingOptions({ schedulingProfile: { baseId: 'p6', id: 'p6', name: '', overrides: {} } }) };
  const b = { ...mk('B', 2, true), calendarId: 'uren' };
  const r = new CPMSolver([mk('A', 2, true), b, mk('X', 10), mk('END', 1)], [fs('A', 'B'), fs('B', 'END'), fs('X', 'END')], CAL, [CAL, HOURS], p6).solve();
  const t = (id: string) => r.tasks.get(id)!;
  checks++;
  if (!(new Date(t('A').earlyFinish) < new Date(t('B').earlyStart))) diffs.push('gemengd: A eindigt niet vóór B');
  const bStart = day(t('B').earlyStart);
  eq('gemengd p6: B (C14) komt laat', bStart >= '2026-06-11', true);
  eq('gemengd p6: A schuift mee (niet meer vooraan)', day(t('A').earlyStart) > '2026-06-05', true);
}

if (diffs.length === 0) {
  console.log(`OK  alap-chain: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  alap-chain: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
