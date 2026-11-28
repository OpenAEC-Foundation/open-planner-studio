import { createAppStoreContext } from '@/state/appStore';
import { markScheduleStale } from '@/state/transaction';
import { createFailedSolveGate } from '@/state/failedSolveGate';

const store = createAppStoreContext().store;
const S = () => store.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
};

S().newProject();
S().setProject({ startDate: '2026-03-02' });
const a = S().addTask({ name: 'A' });
const b = S().addTask({ name: 'B' });
for (const id of [a, b]) {
  const cur = S().tasks.find((t) => t.id === id)!;
  S().updateTask(id, { time: { ...cur.time, scheduleStart: '2026-03-02', scheduleDuration: 5 } });
}
S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
S().runCPM();
S().setUI({ autoCalcCPM: true });

const failedSolve = createFailedSolveGate(S());
let pending = false;
const maybeScheduleRun = () => {
  const state = S();
  if (failedSolve.blocks(state) || !state.ui.autoCalcCPM || !state.scheduleStale) return;
  pending = true;
};
store.subscribe(maybeScheduleRun);
const MAX_RUNS = 25;
function drain(): number {
  let runs = 0;
  while (pending && runs < MAX_RUNS) {
    pending = false;
    const s = S();
    if (failedSolve.blocks(s) || !s.ui.autoCalcCPM || !s.scheduleStale) continue;
    s.runCPM();
    runs++;
  }
  return runs;
}
const errorCount = () => S().ui.notifications.find((n) => n.dedupeKey === 'cpm-error')?.count ?? 0;
const setDuration = (id: string, days: number) =>
  S().updateTask(id, { time: { ...S().tasks.find((t) => t.id === id)!.time, scheduleDuration: days } });

setDuration(a, 6);
eq('1a een gewone wijziging rekent precies één keer automatisch door', drain(), 1);
eq('1b de planning is vers', S().scheduleStale, false);

store.setState((s) => {
  s.sequences.push({ id: 'seq-kring', predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 });
  markScheduleStale(s);
});
eq('2a precies één automatische poging, geen lus', drain(), 1);
eq('2b de berekening faalde', typeof S().cpmResult?.error, 'string');
eq('2c de planning blijft verouderd', S().scheduleStale, true);
eq('2d de meldingsteller blijft op 1', errorCount(), 1);

setDuration(a, 7);
eq('3a na een echte invoerwijziging precies één nieuwe poging', drain(), 1);
eq('3b de meldingsteller telt die ene poging', errorCount(), 2);

S().selectTask(b);
S().setUI({ showPropertiesPanel: true });
eq('4 selectie/UI-wijziging start geen berekening', drain(), 0);

S().runCPM();
eq('5a geen automatische herhaling na de F5-fout', drain(), 0);
eq('5b alleen de F5-poging telt mee', errorCount(), 3);

S().setUI({ autoCalcCPM: false });
S().setUI({ autoCalcCPM: true });
eq('6 aanzetten bij dezelfde mislukte invoer rekent niet opnieuw', drain(), 0);

maybeScheduleRun();
eq('7 een los signaal bij dezelfde invoer rekent niet opnieuw', drain(), 0);

store.setState((s) => { s.sequences = s.sequences.filter((x) => x.id !== 'seq-kring'); markScheduleStale(s); });
eq('8a zonder kring rekent het precies één keer door', drain(), 1);
eq('8b geen fout meer', S().cpmResult?.error ?? null, null);
eq('8c de planning is weer vers', S().scheduleStale, false);
setDuration(b, 4);
eq('8d daarna rekent een gewone wijziging weer gewoon door', [drain(), S().scheduleStale], [1, false]);

if (diffs.length) {
  console.log(`XX  auto-calc-cpm: ${diffs.length} van de ${checks} checks FOUT`);
  for (const d of diffs) console.log(`    - ${d}`);
  process.exit(1);
}
console.log(`OK  auto-calc-cpm: alle checks groen (${checks})`);
