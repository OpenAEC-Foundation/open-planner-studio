import './domStub';
// De pijlen in het relatiepaneel (issue #888, eigenaarsbesluit 2026-11-14 "1"): links naar de
// voorganger, rechts naar de opvolger, altijd beschikbaar zolang er een relatie is. Bij meerdere
// voorgangers gaat links naar de sturende; rechts naar de opvolger die deze taak stuurt.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';
import { relationStepTarget } from '@/state/relationStep';
import type { TaskTime } from '@/types/task';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

const name = (id: string | null) => (id === null ? null : S().tasks.find(t => t.id === id)?.name ?? '?');
const step = (id: string, direction: 'predecessor' | 'successor') => name(relationStepTarget(S(), id, direction));
const task = (n: string, days: number) => S().addTask({ name: n, time: { scheduleDuration: days } as TaskTime });
const link = (p: string, s: string) => S().addSequence({ predecessorId: p, successorId: s, type: 'FINISH_START', lagDays: 0 });

S().newProject();
S().setProject({ startDate: '2026-03-02' });
// Grondwerk (5 d) en Bouwrijp (2 d) gaan vooraf aan Fundering: Grondwerk is sturend.
// Grondwerk gaat ook vooraf aan Riolering, maar die wordt gestuurd door Leidingplan (10 d).
const grondwerk = task('Grondwerk', 5);
const bouwrijp = task('Bouwrijp', 2);
const fundering = task('Fundering', 5);
const leidingplan = task('Leidingplan', 10);
const riolering = task('Riolering', 3);
const los = task('Los', 1);
link(grondwerk, fundering);
link(bouwrijp, fundering);
link(grondwerk, riolering);
link(leidingplan, riolering);
S().runCPM();
eq('0 opzet rekent', S().cpmResult?.error, undefined);

// ── 1. Zonder relatie: niets ─────────────────────────────────────────────────────────────────
eq('1.1 los: geen voorganger', step(los, 'predecessor'), null);
eq('1.2 los: geen opvolger', step(los, 'successor'), null);
eq('1.3 Grondwerk heeft geen voorganger', step(grondwerk, 'predecessor'), null);

// ── 2. Precies één: daarheen, sturend of niet ────────────────────────────────────────────────
eq('2.1 Bouwrijp → zijn enige opvolger, ook al stuurt hij die niet', step(bouwrijp, 'successor'), 'Fundering');
eq('2.2 Leidingplan → Riolering', step(leidingplan, 'successor'), 'Riolering');

// ── 3. Meerdere: de sturende ─────────────────────────────────────────────────────────────────
eq('3.1 Fundering ← sturende voorganger Grondwerk', step(fundering, 'predecessor'), 'Grondwerk');
eq('3.2 Riolering ← sturende voorganger Leidingplan', step(riolering, 'predecessor'), 'Leidingplan');
eq('3.3 Grondwerk → de opvolger die hij stuurt (Fundering)', step(grondwerk, 'successor'), 'Fundering');

// ── 4. Een relatie naar een taak die niet (meer) bestaat telt niet mee ───────────────────────
useAppStore.setState(state => {
  state.sequences.push({ id: 'wees', predecessorId: 'bestaat-niet', successorId: bouwrijp, type: 'FINISH_START', lagDays: 0 });
});
eq('4.1 een wees-relatie geeft geen doel', step(bouwrijp, 'predecessor'), null);

// ── 5. Voorbeeld 1 uit het besluit: Fundering stuurt drie opvolgers ─────────────────────────
// Alle drie hebben vrije speling 0; dan wint de kleinste totale speling (het kritieke pad), niet de
// laagste WBS-code (Kozijnen).
{
  S().newProject();
  S().setProject({ startDate: '2026-03-02' });
  const fund = task('Fundering', 5);
  task('Kozijnen', 8);
  task('Leidingen', 15);
  task('Metselwerk', 20);
  const [koz, leid, mets] = S().tasks.filter(t => t.id !== fund).map(t => t.id);
  for (const id of [koz, leid, mets]) link(fund, id);
  S().runCPM();
  const tf = (id: string) => S().tasks.find(t => t.id === id)?.time.totalFloat;
  eq('5.0 opzet: totale speling 12/5/0', [tf(koz), tf(leid), tf(mets)], [12, 5, 0]);
  eq('5.1 rechts gaat naar het kritieke Metselwerk', step(fund, 'successor'), 'Metselwerk');
  eq('5.2 en vanaf Metselwerk brengt links je terug', step(mets, 'predecessor'), 'Fundering');
}

// ── 6. Voorbeeld 2: geen sturende voorganger (een vaste startdatum bepaalt de taak) ────────────
// Links gaat naar de voorganger met de kleinste vrije speling, ook als de andere kritieker is.
{
  S().newProject();
  S().setProject({ startDate: '2026-03-02' });
  const kort = task('Kort', 5);
  const lang = task('Lang', 10);
  const afbouw = task('Afbouw', 2);
  const staart = task('Staart', 30);
  link(kort, afbouw);
  link(lang, afbouw);
  link(kort, staart); // maakt Kort kritiek: de totale speling zou voor Kort kiezen
  S().updateTask(afbouw, { constraint: { type: 'SNET', date: '2026-03-20' } });
  S().runCPM();
  const ff = (p: string) => {
    const seq = S().sequences.find(q => q.predecessorId === p && q.successorId === afbouw)!;
    return S().cpmResult?.sequenceFreeFloat[seq.id];
  };
  eq('6.0 opzet: geen van beide sturend, Lang dichterbij', [ff(kort)! > ff(lang)!, ff(lang)! > 0], [true, true]);
  eq('6.1 links naar de kleinste vrije speling (Lang)', step(afbouw, 'predecessor'), 'Lang');

  // ── 7. De app weet niets over vrije speling (zoals bij "Datums zoals opgeslagen"): totale speling ──
  useAppStore.setState(state => { if (state.cpmResult) state.cpmResult.drivingUnknown = true; });
  eq('7.1 dan beslist de totale speling (Kort is kritiek)', step(afbouw, 'predecessor'), 'Kort');
}

// ── 8. Nog niet berekend: totale speling en daarna de laagste WBS-code ─────────────────────────
{
  S().newProject();
  const b = task('B', 3);
  const a = task('A', 3);
  const c = task('C', 3);
  link(a, c);
  link(b, c);
  eq('8.0 opzet: geen berekening', S().cpmResult, null);
  eq('8.1 gelijke speling: de laagste WBS-code (B, eerst aangemaakt)', step(c, 'predecessor'), 'B');
  S().updateTask(b, { time: { ...S().tasks.find(t => t.id === b)!.time, totalFloat: 4 } });
  eq('8.2 met een bekende totale speling wint de kleinste (A)', step(c, 'predecessor'), 'A');
  // WBS-codes vergelijken als getallen: 2.10 komt na 2.9.
  useAppStore.setState(state => {
    for (const t of state.tasks) { t.time.totalFloat = 0; }
    state.tasks.find(t => t.id === a)!.wbsCode = '2.9';
    state.tasks.find(t => t.id === b)!.wbsCode = '2.10';
  });
  eq('8.3 2.9 gaat voor 2.10', step(c, 'predecessor'), 'A');
}

if (diffs.length > 0) {
  console.log(`XX  relation-step: ${diffs.length} afwijking(en) van ${checks}`);
  for (const diff of diffs) console.log(`   - ${diff}`);
  process.exit(1);
}
console.log(`OK  relation-step: alle checks groen (${checks})`);
