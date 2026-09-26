// Een AUTOMATISCH ingevulde werkelijke start valt nooit ná het werkelijke einde (critreview claim 9,
// eigenaarsregel). Vóór de fix kon de app een onmogelijk paar opslaan:
//   - 100% zetten terwijl de statusdatum vóór de geplande start ligt ⇒ werkelijk einde = statusdatum,
//     werkelijke start = de (latere) vroege/geplande start (bv. start 2026-07-08, einde 2026-06-10) —
//     via het taakraster (enkele cel), de store (`setTaskProgress`) én MCP (zie tests/mcp/);
//   - in het taakraster met MEERDERE cellen tegelijk (naam + Actual Finish) vulde de regel de start
//     met de vroege start in, terwijl het enkele-celpad al start = einde gaf;
//   - daarna weigerde een meer-cellen-plak met voortgang over meerdere rijen het HELE blok zodra één
//     rij zo'n kapot paar had (`actualFinishBeforeStart`).
// De regel: ligt de in te vullen start later dan het werkelijke einde, dan wordt de werkelijke start
// gelijk aan het einde — dagtaken op de dag, uurtaken exact op het einde-instant. Een expliciet
// opgegeven werkelijke start wordt nooit stil aangepast. Eén gedeelde helper in
// `taskMutationRules.ts` (`fillMissingActualStart`), gebruikt door raster, store, dialoog en MCP.
//
// Draait via run.sh (ook in de tijdzone-matrix). Exit 0 = alles groen.
import './domStub';
import { createAppStore } from '@/state/appStore';
import { applyCompletionEdit, isActualFinishBeforeStart } from '@/engine/taskMutationRules';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { WorkCalendar } from '@/types/calendar';
import type { CellEditIntent, GridIntent } from '@/types/taskGrid';
import type { TaskTime } from '@/types/task';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
}

function cell(taskId: string, columnId: string, route: CellEditIntent['route'], value: unknown): CellEditIntent {
  return { kind: 'cell-edit', taskId, columnId: columnId as CellEditIntent['columnId'], route, value };
}
function paste(writes: CellEditIntent[]): GridIntent {
  return { kind: 'paste', allowSkippingReadOnlyCells: true, writes };
}

type Kind = 'dag' | 'uur';
const BAND = [{ start: 480, end: 1020 }];

/**
 * Een voorganger van 20 werkdagen (of 160 uur) met daarachter `rows` taken van 5 werkdagen (of 16 uur)
 * via FS. Met een statusdatum op 10 juni liggen die opvolgers dus ruim ná de statusdatum: precies de
 * situatie waarin "100%" een einde (= statusdatum) vóór de geplande start oplevert. `statusDate`
 * `undefined` ⇒ geen statusdatum.
 */
function setup(kind: Kind, statusDate: string | undefined, rows = 1, withPredecessor = true) {
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01', ...(statusDate ? { statusDate } : {}) });
  if (kind === 'uur') {
    S().setCalendar({
      ...S().calendar,
      workTime: { byWeekday: { 1: BAND, 2: BAND, 3: BAND, 4: BAND, 5: BAND, 6: [], 7: [] } },
    } as WorkCalendar);
  }
  const time = (days: number) => kind === 'uur'
    ? createDefaultTaskTime('2026-06-01', days * 8, 'hours')
    : createDefaultTaskTime('2026-06-01', days);
  const pre = withPredecessor ? S().addTask({ name: 'Voorganger', time: time(20) }) : undefined;
  const ids = Array.from({ length: rows }, (_, i) => S().addTask({ name: `T${i + 1}`, time: time(5) }));
  if (pre) {
    for (const id of ids) S().addSequence({ predecessorId: pre, successorId: id, type: 'FINISH_START', lagDays: 0 });
  }
  S().runCPM();
  const time$ = (id: string): TaskTime => S().tasks.find(t => t.id === id)!.time;
  const status$ = (id: string) => S().tasks.find(t => t.id === id)!.status;
  return { S, ids, time$, status$ };
}

/** Voltooid, met werkelijke start = werkelijk einde = `finish`, en geen omgekeerd paar. */
function expectClamped(label: string, time: TaskTime, status: string | undefined, finish: string): void {
  eq(`${label}: werkelijke start = werkelijk einde`, { as: time.actualStart, af: time.actualFinish }, { as: finish, af: finish });
  eq(`${label}: geen einde vóór start`, isActualFinishBeforeStart(time), false);
  eq(`${label}: voltooid`, { completion: time.completion, status }, { completion: 1, status: 'COMPLETED' });
}

// Dagtaak met een date-only statusdatum; uurtaak met een statusdatum mét tijd (het einde-instant).
const SCENARIOS: readonly { kind: Kind; statusDate: string }[] = [
  { kind: 'dag', statusDate: '2026-06-10' },
  { kind: 'uur', statusDate: '2026-06-10T12:00' },
];

for (const { kind, statusDate } of SCENARIOS) {
  const tag = `${kind} (statusdatum ${statusDate})`;

  // Voorwaarde: de geplande start ligt echt ná de statusdatum, anders bewijst dit niets.
  {
    const { ids, time$ } = setup(kind, statusDate);
    eq(`${tag} voorwaarde: vroege start ná de statusdatum`,
      isActualFinishBeforeStart({ actualStart: time$(ids[0]!).earlyStart, actualFinish: statusDate }), true);
  }

  // 1. Taakraster, enkele cel: % voltooid = 100%.
  {
    const { S, ids, time$, status$ } = setup(kind, statusDate);
    const t = ids[0]!;
    const res = S().runGridMutation([cell(t, 'task.time.completion', 'task-progress', 1)]);
    eq(`${tag} raster enkel 100%: geaccepteerd`, res.ok, true);
    expectClamped(`${tag} raster enkel 100%`, time$(t), status$(t), statusDate);
  }

  // 2. Taakraster, meerdere cellen tegelijk: naam + Actual Finish (taak zonder Actual Start).
  //    Het enkele-celpad gaf hier al start = einde; het meer-cellenpad vulde de vroege start in.
  {
    const { S, ids, time$, status$ } = setup(kind, statusDate);
    const t = ids[0]!;
    const finish = kind === 'uur' ? '2026-06-09T11:00' : '2026-06-09';
    const res = S().runGridMutation([paste([
      cell(t, 'task.name', 'task-field', 'T (geplakt)'),
      cell(t, 'task.time.actualFinish', 'task-progress', finish),
    ])]);
    eq(`${tag} raster meer (naam + Actual Finish): geaccepteerd`, res.ok, true);
    expectClamped(`${tag} raster meer (naam + Actual Finish)`, time$(t), status$(t), finish);
    eq(`${tag} raster meer (naam + Actual Finish): naam geschreven`, S().tasks.find(x => x.id === t)!.name, 'T (geplakt)');
  }

  // 2b. Zelfde, maar het enkele-celpad met Actual Finish — dat was al goed en moet zo blijven.
  {
    const { S, ids, time$, status$ } = setup(kind, statusDate);
    const t = ids[0]!;
    const finish = kind === 'uur' ? '2026-06-09T11:00' : '2026-06-09';
    const res = S().runGridMutation([cell(t, 'task.time.actualFinish', 'task-progress', finish)]);
    eq(`${tag} raster enkel Actual Finish: geaccepteerd`, res.ok, true);
    expectClamped(`${tag} raster enkel Actual Finish`, time$(t), status$(t), finish);
  }

  // 3. Taakraster, meerdere cellen: naam + 100%.
  {
    const { S, ids, time$, status$ } = setup(kind, statusDate);
    const t = ids[0]!;
    const res = S().runGridMutation([paste([
      cell(t, 'task.name', 'task-field', 'T (geplakt)'),
      cell(t, 'task.time.completion', 'task-progress', 1),
    ])]);
    eq(`${tag} raster meer (naam + 100%): geaccepteerd`, res.ok, true);
    expectClamped(`${tag} raster meer (naam + 100%)`, time$(t), status$(t), statusDate);
  }

  // 4. Taakraster, enkele cel Werkelijke duur = de volle duur ⇒ 100% (zelfde afleiding).
  {
    const { S, ids, time$, status$ } = setup(kind, statusDate);
    const t = ids[0]!;
    const res = S().runGridMutation([cell(t, 'task.time.actualDuration', 'task-progress', 5 * 8 * 60)]);
    eq(`${tag} raster enkel Werkelijke duur = volle duur: geaccepteerd`, res.ok, true);
    expectClamped(`${tag} raster enkel Werkelijke duur = volle duur`, time$(t), status$(t), statusDate);
  }

  // 5. Store: setTaskProgress(1) (eigenschappenpaneel, schuif, contextmenu).
  {
    const { S, ids, time$, status$ } = setup(kind, statusDate);
    const t = ids[0]!;
    S().setTaskProgress(t, 1);
    expectClamped(`${tag} store setTaskProgress(1)`, time$(t), status$(t), statusDate);
  }

  // 6. Taakdialoog-draft: dezelfde `applyCompletionEdit` als de store, op een losse kopie.
  {
    const { ids, time$ } = setup(kind, statusDate);
    const draft = { ...time$(ids[0]!) };
    applyCompletionEdit(draft, 1, statusDate);
    eq(`${tag} dialoog-draft 100%: afgeleide start = het einde dat de invariant straks zet`,
      draft.actualStart, statusDate);
  }

  // 7. Het blok van 3 rijen × (naam, 100%). Vóór de fix liet stap (a) een omgekeerd paar achter en
  //    weigerde stap (b) daarom het HELE blok (`actualFinishBeforeStart`).
  {
    const { S, ids, time$, status$ } = setup(kind, statusDate, 3);
    const a = S().runGridMutation([cell(ids[1]!, 'task.time.completion', 'task-progress', 1)]);
    eq(`${tag} blok (a) rij 2 op 100%: geaccepteerd`, a.ok, true);
    const blok = () => paste(ids.flatMap((id, i) => [
      cell(id, 'task.name', 'task-field', `T${i + 1}*`),
      cell(id, 'task.time.completion', 'task-progress', 1),
    ]));
    const b = S().runGridMutation([blok()]);
    eq(`${tag} blok (b) 3 rijen × (naam, 100%): geaccepteerd`,
      b.ok ? true : b.errors.map(e => e.code), true);
    eq(`${tag} blok (b) alle namen geschreven`, ids.map(id => S().tasks.find(x => x.id === id)!.name), ['T1*', 'T2*', 'T3*']);
    ids.forEach((id, i) => expectClamped(`${tag} blok (b) rij ${i + 1}`, time$(id), status$(id), statusDate));
    // En nog eens: een tweede plak over dezelfde (inmiddels voltooide) rijen blijft slagen.
    const c = S().runGridMutation([blok()]);
    eq(`${tag} blok (c) dezelfde plak nogmaals: geaccepteerd`, c.ok ? true : c.errors.map(e => e.code), true);
  }
  {
    // Variant zonder voorafgaande enkele cel: de eerste plak zelf mag geen kapot paar achterlaten,
    // anders weigert de volgende plak.
    const { S, ids, time$, status$ } = setup(kind, statusDate, 3);
    const blok = () => paste(ids.flatMap((id, i) => [
      cell(id, 'task.name', 'task-field', `T${i + 1}*`),
      cell(id, 'task.time.completion', 'task-progress', 1),
    ]));
    eq(`${tag} dubbele plak (1e): geaccepteerd`, S().runGridMutation([blok()]).ok, true);
    ids.forEach((id, i) => expectClamped(`${tag} dubbele plak (1e) rij ${i + 1}`, time$(id), status$(id), statusDate));
    const tweede = S().runGridMutation([blok()]);
    eq(`${tag} dubbele plak (2e): geaccepteerd`, tweede.ok ? true : tweede.errors.map(e => e.code), true);
  }

  // 8. Een EXPLICIET opgegeven werkelijke start blijft onaangeroerd.
  const explicitStart = kind === 'uur' ? '2026-06-03T09:00' : '2026-06-03';
  {
    const { S, ids, time$ } = setup(kind, statusDate);
    const t = ids[0]!;
    eq(`${tag} expliciet: Actual Start-cel geaccepteerd`,
      S().runGridMutation([cell(t, 'task.time.actualStart', 'task-progress', explicitStart)]).ok, true);
    eq(`${tag} expliciet: daarna 100% (enkele cel) geaccepteerd`,
      S().runGridMutation([cell(t, 'task.time.completion', 'task-progress', 1)]).ok, true);
    eq(`${tag} expliciet + raster enkel 100%: start blijft de opgegeven start`,
      { as: time$(t).actualStart, af: time$(t).actualFinish }, { as: explicitStart, af: statusDate });
  }
  {
    const { S, ids, time$ } = setup(kind, statusDate);
    const t = ids[0]!;
    const res = S().runGridMutation([paste([
      cell(t, 'task.time.actualStart', 'task-progress', explicitStart),
      cell(t, 'task.time.completion', 'task-progress', 1),
    ])]);
    eq(`${tag} expliciet + raster meer (Actual Start + 100%): geaccepteerd`, res.ok, true);
    eq(`${tag} expliciet + raster meer (Actual Start + 100%): start blijft de opgegeven start`,
      { as: time$(t).actualStart, af: time$(t).actualFinish }, { as: explicitStart, af: statusDate });
  }
  {
    const { S, ids, time$ } = setup(kind, statusDate);
    const t = ids[0]!;
    S().setActualStart(t, explicitStart);
    S().setTaskProgress(t, 1);
    eq(`${tag} expliciet + store setTaskProgress(1): start blijft de opgegeven start`,
      { as: time$(t).actualStart, af: time$(t).actualFinish }, { as: explicitStart, af: statusDate });
  }
  {
    // Een opgegeven paar met einde vóór start blijft geweigerd — niet stil geklemd.
    const { S, ids, time$ } = setup(kind, statusDate);
    const t = ids[0]!;
    const before = JSON.stringify(time$(t));
    const late = kind === 'uur' ? '2026-06-09T09:00' : '2026-06-09';
    const early = kind === 'uur' ? '2026-06-05T09:00' : '2026-06-05';
    const res = S().runGridMutation([paste([
      cell(t, 'task.name', 'task-field', 'mag niet landen'),
      cell(t, 'task.time.actualStart', 'task-progress', late),
      cell(t, 'task.time.actualFinish', 'task-progress', early),
    ])]);
    eq(`${tag} expliciet omgekeerd paar: geweigerd`, res.ok ? 'ok' : res.errors.map(e => e.code), ['actualFinishBeforeStart']);
    eq(`${tag} expliciet omgekeerd paar: taak ongemoeid`, JSON.stringify(time$(t)), before);
  }
  {
    // Op helperniveau: een aanwezige start, zelfs een die ná het (afgeleide) einde ligt, wordt
    // nooit stil verplaatst — alleen een ONTBREKENDE start wordt ingevuld.
    const time = { ...createDefaultTaskTime('2026-07-08', 5), actualStart: '2026-07-01' };
    applyCompletionEdit(time, 1, '2026-06-10');
    eq(`${tag} helper: aanwezige start blijft staan`, time.actualStart, '2026-07-01');
  }
}

// 9. Uurtaak met een date-only statusdatum op dezelfde dag als de vroege start: op dagniveau
//    "gelijk", maar als instant ligt de start (08:00) ná het einde (middernacht) — het bestaande
//    `isActualFinishBeforeStart` noemt dat een omgekeerd paar. De klem vergelijkt daarom als instant
//    en de start wordt exact het einde-instant.
{
  const { S, ids, time$, status$ } = setup('uur', '2026-06-10', 1, false);
  const t = ids[0]!;
  eq('uur zelfde dag: voorwaarde vroege start op de statusdag, ná middernacht', time$(t).earlyStart, '2026-06-10T08:00');
  eq('uur zelfde dag: raster enkel 100% geaccepteerd',
    S().runGridMutation([cell(t, 'task.time.completion', 'task-progress', 1)]).ok, true);
  expectClamped('uur zelfde dag: raster enkel 100%', time$(t), status$(t), '2026-06-10');
}
{
  // Dagtaak op dezelfde dag: start = einde was al zo, er valt niets te klemmen.
  const { S, ids, time$, status$ } = setup('dag', '2026-06-10', 1, false);
  const t = ids[0]!;
  eq('dag zelfde dag: voorwaarde vroege start = statusdatum', time$(t).earlyStart, '2026-06-10');
  S().setTaskProgress(t, 1);
  expectClamped('dag zelfde dag: store setTaskProgress(1)', time$(t), status$(t), '2026-06-10');
}

// 10. Geen onnodige klem: zonder statusdatum is het afgeleide einde de eigen geplande finish, die ná
//     de geplande start ligt — de start blijft dan de geplande start (ongewijzigd gedrag).
for (const kind of ['dag', 'uur'] as const) {
  const { S, ids, time$ } = setup(kind, undefined);
  const t = ids[0]!;
  const { earlyStart, earlyFinish } = time$(t);
  S().setTaskProgress(t, 1);
  eq(`${kind} zonder statusdatum: start = geplande start, einde = geplande finish`,
    { as: time$(t).actualStart, af: time$(t).actualFinish }, { as: earlyStart, af: earlyFinish });
  const { S: S2, ids: ids2, time$: time2$ } = setup(kind, undefined);
  const t2 = ids2[0]!;
  const es2 = time2$(t2).earlyStart;
  eq(`${kind} zonder statusdatum: raster meer (naam + 100%) geaccepteerd`, S2().runGridMutation([paste([
    cell(t2, 'task.name', 'task-field', 'x'),
    cell(t2, 'task.time.completion', 'task-progress', 1),
  ])]).ok, true);
  eq(`${kind} zonder statusdatum: raster meer start = geplande start`, time2$(t2).actualStart, es2);
}

// 11. Status "Gestart" vult de start nog steeds met de geplande start (er is dan geen einde).
{
  const { S, ids, time$, status$ } = setup('dag', '2026-06-10');
  const t = ids[0]!;
  const es = time$(t).earlyStart;
  eq('status Gestart: geaccepteerd', S().runGridMutation([cell(t, 'task.status', 'task-progress', 'STARTED')]).ok, true);
  eq('status Gestart: start = geplande start, geen einde',
    { as: time$(t).actualStart, af: time$(t).actualFinish, status: status$(t) },
    { as: es, af: undefined, status: 'STARTED' });
}

if (diffs.length > 0) {
  console.error(`FAIL auto-actual-start: ${diffs.length}/${checks} afwijkingen`);
  for (const diff of diffs) console.error(`  - ${diff}`);
  process.exitCode = 1;
} else {
  console.log(`OK  auto-actual-start: ${checks}/${checks}`);
}
