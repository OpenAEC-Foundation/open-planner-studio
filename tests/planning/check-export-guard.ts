// Export-guard-checks (bevinding K7) — headless tegen de ECHTE Zustand-store.
//
// Waarom deze batterij bestaat: exports schrijven `task.time.earlyStart` — de CPM-uitvoer — naar
// derden die datums contractueel lezen. `autoCalcCPM` staat standaard UIT, dus zonder guard ging
// een verouderde planning het bestand in. Bij een cyclus houdt `runCPM` de planning nu expliciet
// verouderd: `task.time` bevat immers nog de oude waarden. De foutcontrole blijft daarnaast een
// noodzakelijke tweede vangrail voor een directe, duidelijke exportfout.
//
// `exportAs` breekt bij een cyclus af VÓÓR de eerste await (en dus vóór `saveFileDialog`), zodat
// dit pad headless te draaien is zonder bestandsdialoog.
//
// Draait via run.sh. Exit 0 = alles groen.
import { useAppStore } from '@/state/appStore';

const S = () => useAppStore.getState();
const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const truthy = (label: string, got: boolean) => {
  checks++;
  if (!got) diffs.push(`${label}: verwacht waar, kreeg onwaar`);
};

// ── 1. Stale planning wordt vóór de export doorgerekend ──────────────────────
S().newProject();
S().setProject({ name: 'K7', startDate: '2031-05-05' });
const a = S().addTask({ name: 'A' });
const b = S().addTask({ name: 'B' });
const setDur = (id: string, d: number) => {
  const t = S().tasks.find(x => x.id === id)!;
  S().updateTask(id, { time: { ...t.time, scheduleDuration: d } });
};
setDur(a, 5); setDur(b, 5);
S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
S().runCPM();
const bNa1 = S().tasks.find(t => t.id === b)?.time.earlyStart;
truthy('1 opzet: B heeft een berekende startdatum', !!bNa1);

// Muteer zonder door te rekenen: de planning is nu verouderd.
setDur(a, 20);
truthy('2 mutatie zet scheduleStale', S().scheduleStale === true);
const bVoorExport = S().tasks.find(t => t.id === b)?.time.earlyStart;
eq('3 B draagt nog de OUDE datum zolang er niet gerekend is', bVoorExport, bNa1);

// De guard in exportAs moet nu zelf runCPM draaien.
await S().exportAs('csv').catch(() => undefined); // dialoog faalt headless; de guard draait ervóór
truthy('4 export heeft de planning doorgerekend (scheduleStale weg)', S().scheduleStale === false);
const bNaExport = S().tasks.find(t => t.id === b)?.time.earlyStart;
truthy('5 B is opgeschoven door de langere voorganger', bNaExport !== bVoorExport);

// ── 2. Cyclus: export weigert, en meldt waaróm ───────────────────────────────
S().newProject();
const c1 = S().addTask({ name: 'C1' });
const c2 = S().addTask({ name: 'C2' });
S().addSequence({ predecessorId: c1, successorId: c2, type: 'FINISH_START', lagDays: 0 });
S().addSequence({ predecessorId: c2, successorId: c1, type: 'FINISH_START', lagDays: 0 });
S().runCPM();
truthy('6 opzet: de solver meldt een cyclus', !!S().cpmResult?.error);
// De mislukte solve houdt de planning verouderd: geen oude datums als actuele uitkomst tonen.
eq('7 scheduleStale blijft na de cyclus true', S().scheduleStale, true);

// Bewust met try/catch: ZONDER de guard loopt `exportAs` door naar `saveFileDialog`, en die
// klapt headless op `window is not defined`. Dat is precies de regressie die we willen zien —
// maar dan als leesbare afwijking in plaats van een stacktrace die de rest van de batterij meesleurt.
let res: { ok: boolean; error?: string };
try {
  res = await S().exportAs('csv');
} catch (err) {
  res = { ok: true, error: `exportAs liep DOOR tot de bestandsdialoog (guard weg?): ${String(err)}` };
}
eq('8 export geweigerd bij een cyclus', res.ok, false);
truthy('9 de weigering draagt de cyclus-melding',
  res.ok === false && typeof res.error === 'string' && res.error.length > 0);

// ── 3. Schone planning: export gaat gewoon door ──────────────────────────────
S().newProject();
const d1 = S().addTask({ name: 'D1' });
S().addTask({ name: 'D2' });
S().runCPM();
truthy('10 opzet: geen cyclus', !S().cpmResult?.error);
const okRes = await S().exportAs('csv').catch(() => ({ ok: true as const }));
truthy('11 schone planning wordt niet geweigerd', okRes.ok === true);
truthy('12 taak bestaat nog (guard muteert niets onnodigs)', !!S().tasks.find(t => t.id === d1));

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  export-guard-check: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  export-guard-check: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
