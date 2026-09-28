// Audit 2026-09-26 — geheugenplafond voor Ongedaan maken (eigenaarsbesluit 2026-09-28).
//
// Elke undo-stap houdt de objecten vast die hij veranderde. Een bewerking met herberekening
// vervangt alle taakdatums en het hele `cpmResult`: gemeten ≈ 3 MB per stap op 2000 taken, dus tot
// honderden MB bij honderd stappen. Nu vallen boven een geschatte 200 MB de oudste stappen weg, met
// altijd de nieuwste tien per scope. Kleine projecten merken niets.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { createBatchTransactions } from '@/state/runtime/createBatchTransactions';
import {
  MAX_SESSION_HISTORY_BYTES,
  MAX_SESSION_HISTORY_EVENTS_PER_SCOPE,
  MIN_SESSION_HISTORY_EVENTS_PER_SCOPE,
  appendSessionHistoryEvent,
  estimateSessionHistoryEventBytes,
  pruneSessionHistory,
  type SessionHistoryEvent,
} from '@/state/sessionHistory';

const diffs: string[] = [];
let checks = 0;
const ok = (label: string, cond: boolean, detail = '') => { checks++; if (!cond) diffs.push(`${label}${detail ? `: ${detail}` : ''}`); };

function chain(n: number) {
  const context = createAppStoreContext();
  const S = () => context.store.getState();
  S().newProject();
  const ids: string[] = [];
  createBatchTransactions(context).withTransaction(() => {
    for (let i = 0; i < n; i++) ids.push(S().addTask({ name: `T${i}` }));
    for (let i = 1; i < n; i++) S().addSequence({ predecessorId: ids[i - 1], successorId: ids[i], type: 'FS', lag: 0 } as never);
  });
  S().runCPM();
  const setDuration = (d: number) =>
    S().updateTask(ids[0], { time: { ...S().tasks[0].time, scheduleDuration: d } } as never);
  return { S, ids, setDuration };
}
const newestFirst = (events: readonly SessionHistoryEvent[]) => [...events].sort((l, r) => r.sequence - l.sequence);

// 1. Klein project: honderd stappen blijven er honderd (het plafond raakt niets).
{
  const { S, ids } = chain(50);
  for (let k = 0; k < 120; k++) S().updateTask(ids[1], { name: `n${k}` } as never);
  ok('klein project houdt honderd stappen', S().historyEvents.length === MAX_SESSION_HISTORY_EVENTS_PER_SCOPE,
    `kreeg ${S().historyEvents.length}`);
}

// 2. Het standaardplafond op de echte registratiegrens (`appendSessionHistoryEvent`), met stappen
//    van elk ~5 MB geschat (een `cpmResult` van 4000 taken). Echte stappen van die omvang kosten
//    per stuk een herberekening (~0,3 s op 2000 taken); de snoei leest alleen de omvang.
{
  const heavy = { tasks: [], cpmResult: { tasks: { size: 4000 } } };
  const light = { tasks: [], cpmResult: null };
  let events: SessionHistoryEvent[] = [];
  for (let seq = 1; seq <= 60; seq++) {
    events = appendSessionHistoryEvent(events, {
      id: `h${seq}`, sequence: seq, label: 'x', state: 'applied',
      deltas: [{ kind: 'document-data', documentId: 'doc', before: light as never, after: heavy as never }],
    });
  }
  const perEvent = estimateSessionHistoryEventBytes(events[0]);
  const expected = Math.floor(MAX_SESSION_HISTORY_BYTES / perEvent);
  ok('standaardplafond: zoveel stappen als in 200 MB passen', events.length === expected,
    `verwacht ${expected}, kreeg ${events.length} (${(perEvent / 1048576).toFixed(1)} MB per stap)`);
  ok('standaardplafond: de nieuwste stappen blijven', events.at(-1)!.sequence === 60 && events[0].sequence === 61 - expected);
}

// 3. De snoei zelf: een snede in de tijd, met de ondergrens per scope.
{
  const { S, setDuration } = chain(300);
  for (let k = 0; k < 30; k++) { setDuration(k + 2); S().runCPM(); }
  const events = S().historyEvents;
  const ranked = newestFirst(events);
  const budget15 = ranked.slice(0, 15).reduce((sum, e) => sum + estimateSessionHistoryEventBytes(e), 0);
  const kept15 = pruneSessionHistory(events, budget15);
  ok('budget voor vijftien: de nieuwste vijftien', kept15.length === 15
    && newestFirst(kept15).every((e, i) => e === ranked[i]), `kreeg ${kept15.length}`);
  const keptMin = pruneSessionHistory(events, 1);
  ok('budget bijna nul: de nieuwste tien blijven', keptMin.length === MIN_SESSION_HISTORY_EVENTS_PER_SCOPE
    && newestFirst(keptMin).every((e, i) => e === ranked[i]), `kreeg ${keptMin.length}`);
  ok('opslagvolgorde blijft behouden', keptMin.every((e, i, a) => i === 0 || events.indexOf(a[i - 1]) < events.indexOf(e)));
}

if (diffs.length === 0) {
  console.log(`OK  undo-memory-cap: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  undo-memory-cap: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
