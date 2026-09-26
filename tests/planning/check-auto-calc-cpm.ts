// Automatisch berekenen + rekenfout (review taakmutaties, bijvangst A) — headless tegen een ECHTE,
// geïsoleerde storecontext met de echte rem (`createFailedSolveGate`).
//
// De fout: een mislukte `runCPM` laat `scheduleStale` staan en pusht een melding; die melding wijzigt
// de store, waarop automatisch berekenen meteen opnieuw rekende — ~10 solves per seconde en een
// meldingsteller die in 3 s tot ×42 opliep. De regel die deze batterij vastpint: na een mislukte
// berekening rekent automatisch berekenen pas opnieuw bij een ECHTE wijziging van de plannings-
// invoer, en dan precies één keer. Een geslaagde berekening heft de rem op.
//
// `maybeScheduleRun` hieronder volgt de voorwaarde van `useAutoCalcCPM` regel voor regel (rem eerst,
// dan instelling en stale-vlag), maar synchroon: in plaats van de 100 ms-debounce draait `drain()`
// de geplande runs tot het stil is, met een plafond. Zonder rem loopt hij dus tegen dat plafond. De
// echte hook met echte timers en events zit in tests/browser/auto-calc-stale.spec.ts.
//
// De kring komt hier als ruwe data binnen (zoals uit een geopend bestand): de invoerroutes die een
// kring zouden kunnen weigeren zijn niet wat hier getest wordt.
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

// ── De hook, synchroon ────────────────────────────────────────────────────────────────────────
const failedSolve = createFailedSolveGate(S());
let pending = false;
const maybeScheduleRun = () => {
  const state = S();
  if (failedSolve.blocks(state) || !state.ui.autoCalcCPM || !state.scheduleStale) return;
  pending = true;
};
store.subscribe(maybeScheduleRun);
/** Draai de geplande runs tot het stil is; geeft het aantal automatische berekeningen terug. */
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

// 1. Het gewone pad blijft werken: een wijziging wordt precies één keer automatisch doorgerekend.
setDuration(a, 6);
eq('1a een gewone wijziging rekent precies één keer automatisch door', drain(), 1);
eq('1b de planning is vers', S().scheduleStale, false);

// 2. Een kring (ruwe data, zoals uit een bestand) ⇒ één mislukte berekening en dan stilte.
store.setState((s) => {
  s.sequences.push({ id: 'seq-kring', predecessorId: b, successorId: a, type: 'FINISH_START', lagDays: 0 });
  markScheduleStale(s);
});
eq('2a precies één automatische poging, geen lus', drain(), 1);
eq('2b de berekening faalde', typeof S().cpmResult?.error, 'string');
eq('2c de planning blijft verouderd', S().scheduleStale, true);
eq('2d de meldingsteller blijft op 1', errorCount(), 1);

// 3. Een echte wijziging van de plannings-invoer ⇒ precies één nieuwe poging, daarna weer stil.
setDuration(a, 7);
eq('3a na een echte invoerwijziging precies één nieuwe poging', drain(), 1);
eq('3b de meldingsteller telt die ene poging', errorCount(), 2);

// 4. Iets wat geen plannings-invoer is (selectie, UI) start geen berekening.
S().selectTask(b);
S().setUI({ showPropertiesPanel: true });
eq('4 selectie/UI-wijziging start geen berekening', drain(), 0);

// 5. Handmatig F5 terwijl het faalt: die ene berekening, geen automatische herhaling erachteraan.
S().runCPM();
eq('5a geen automatische herhaling na de F5-fout', drain(), 0);
eq('5b alleen de F5-poging telt mee', errorCount(), 3);

// 6. Automatisch berekenen uit en weer aan bij ongewijzigde invoer: geen nieuwe poging.
S().setUI({ autoCalcCPM: false });
S().setUI({ autoCalcCPM: true });
eq('6 aanzetten bij dezelfde mislukte invoer rekent niet opnieuw', drain(), 0);

// 7. Een los signaal zonder storewijziging — zoals het loslaten van een bewerking, dat de hook
//    rechtstreeks aanroept (#204, `onAutoCalcReleased`) — herstart de mislukte berekening niet.
maybeScheduleRun();
eq('7 een los signaal bij dezelfde invoer rekent niet opnieuw', drain(), 0);

// 8. De kring opheffen ⇒ automatisch doorgerekend en weer vers; de rem is daarna weg.
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
