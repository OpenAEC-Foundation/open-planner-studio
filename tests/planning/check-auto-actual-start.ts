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

function setup(kind: Kind, statusDate: string | undefined, rows = 1, standaloneStart?: string) {
  const store = createAppStore();
  const S = () => store.getState();
  S().setProject({ startDate: '2026-06-01', ...(statusDate ? { statusDate } : {}) });
  if (kind === 'uur') {
    S().setCalendar({
      ...S().calendar,
      workTime: { byWeekday: { 1: BAND, 2: BAND, 3: BAND, 4: BAND, 5: BAND, 6: [], 7: [] } },
    } as WorkCalendar);
  }
  const plannedStart = standaloneStart ?? '2026-06-01';
  const time = (days: number) => kind === 'uur'
    ? createDefaultTaskTime(plannedStart, days * 8, 'hours')
    : createDefaultTaskTime(plannedStart, days);
  const pre = standaloneStart ? undefined : S().addTask({ name: 'Voorganger', time: time(20) });
  const ids = Array.from({ length: rows }, (_, i) => S().addTask({ name: `T${i + 1}`, time: time(5) }));
  if (pre) {
    for (const id of ids) S().addSequence({ predecessorId: pre, successorId: id, type: 'FINISH_START', lagDays: 0 });
  }
  S().runCPM();
  const time$ = (id: string): TaskTime => S().tasks.find(t => t.id === id)!.time;
  const status$ = (id: string) => S().tasks.find(t => t.id === id)!.status;
  return { S, ids, time$, status$ };
}

function expectClamped(label: string, time: TaskTime, status: string | undefined, finish: string, start?: string): void {
  const finishInstant = finish.includes('T') ? finish : `${finish}T16:00`;
  eq(`${label}: werkelijke datums blijven op hun precieze momenten`,
    { as: time.actualStart, af: time.actualFinish }, { as: start ?? finishInstant, af: finishInstant });
  eq(`${label}: geen einde vóór start`, isActualFinishBeforeStart(time), false);
  eq(`${label}: voltooid`, { completion: time.completion, status }, { completion: 1, status: 'COMPLETED' });
}

const SCENARIOS: readonly { kind: Kind; statusDate: string }[] = [
  { kind: 'dag', statusDate: '2026-06-10' },
  { kind: 'uur', statusDate: '2026-06-10T12:00' },
];

for (const { kind, statusDate } of SCENARIOS) {
  const tag = `${kind} (statusdatum ${statusDate})`;

  {
    const { ids, time$ } = setup(kind, statusDate);
    eq(`${tag} voorwaarde: vroege start ná de statusdatum`,
      isActualFinishBeforeStart({ actualStart: time$(ids[0]!).earlyStart, actualFinish: statusDate }), true);
  }

  {
    const { S, ids, time$, status$ } = setup(kind, statusDate);
    const t = ids[0]!;
    const res = S().runGridMutation([cell(t, 'task.time.completion', 'task-progress', 1)]);
    eq(`${tag} raster enkel 100%: geaccepteerd`, res.ok, true);
    expectClamped(`${tag} raster enkel 100%`, time$(t), status$(t), statusDate);
  }

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

  {
    const { S, ids, time$, status$ } = setup(kind, statusDate);
    const t = ids[0]!;
    const finish = kind === 'uur' ? '2026-06-09T11:00' : '2026-06-09';
    const res = S().runGridMutation([cell(t, 'task.time.actualFinish', 'task-progress', finish)]);
    eq(`${tag} raster enkel Actual Finish: geaccepteerd`, res.ok, true);
    expectClamped(`${tag} raster enkel Actual Finish`, time$(t), status$(t), finish);
  }

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

  {
    const { S, ids, time$, status$ } = setup(kind, statusDate);
    const t = ids[0]!;
    const res = S().runGridMutation([cell(t, 'task.time.actualDuration', 'task-progress', 5 * 8 * 60)]);
    eq(`${tag} raster enkel Werkelijke duur = volle duur: geaccepteerd`, res.ok, true);
    expectClamped(`${tag} raster enkel Werkelijke duur = volle duur`, time$(t), status$(t), statusDate);
  }

  {
    const { S, ids, time$, status$ } = setup(kind, statusDate);
    const t = ids[0]!;
    S().setTaskProgress(t, 1);
    expectClamped(`${tag} store setTaskProgress(1)`, time$(t), status$(t), statusDate);
  }

  {
    const { S, ids, time$ } = setup(kind, statusDate);
    const draft = { ...S().tasks.find(t => t.id === ids[0])!, time: { ...time$(ids[0]!) } };
    applyCompletionEdit(draft, 1, statusDate);
    eq(`${tag} dialoog-draft 100%: afgeleide start = het einde dat de invariant straks zet`,
      draft.time.actualStart, statusDate);
  }

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
    const c = S().runGridMutation([blok()]);
    eq(`${tag} blok (c) dezelfde plak nogmaals: geaccepteerd`, c.ok ? true : c.errors.map(e => e.code), true);
  }
  {
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

  const explicitStart = kind === 'uur' ? '2026-06-03T09:00' : '2026-06-03';
  const explicitStartInstant = kind === 'uur' ? explicitStart : `${explicitStart}T07:00`;
  const statusFinishInstant = kind === 'uur' ? statusDate : `${statusDate}T16:00`;
  {
    const { S, ids, time$ } = setup(kind, statusDate);
    const t = ids[0]!;
    eq(`${tag} expliciet: Actual Start-cel geaccepteerd`,
      S().runGridMutation([cell(t, 'task.time.actualStart', 'task-progress', explicitStart)]).ok, true);
    eq(`${tag} expliciet: daarna 100% (enkele cel) geaccepteerd`,
      S().runGridMutation([cell(t, 'task.time.completion', 'task-progress', 1)]).ok, true);
    eq(`${tag} expliciet + raster enkel 100%: start blijft de opgegeven start`,
      { as: time$(t).actualStart, af: time$(t).actualFinish }, { as: explicitStartInstant, af: statusFinishInstant });
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
      { as: time$(t).actualStart, af: time$(t).actualFinish }, { as: explicitStartInstant, af: statusFinishInstant });
  }
  {
    const { S, ids, time$ } = setup(kind, statusDate);
    const t = ids[0]!;
    S().setActualStart(t, explicitStart);
    S().setTaskProgress(t, 1);
    eq(`${tag} expliciet + store setTaskProgress(1): start blijft de opgegeven start`,
      { as: time$(t).actualStart, af: time$(t).actualFinish }, { as: explicitStartInstant, af: statusFinishInstant });
  }
  {
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
    const { S, ids } = setup(kind, statusDate);
    const time = { ...createDefaultTaskTime('2026-07-08', 5), actualStart: '2026-07-01' };
    applyCompletionEdit({ ...S().tasks.find(t => t.id === ids[0])!, time }, 1, '2026-06-10');
    eq(`${tag} helper: aanwezige start blijft staan`, time.actualStart, '2026-07-01');
  }
}

{
  const { S, ids, time$, status$ } = setup('uur', '2026-06-10', 1, '2026-06-10');
  const t = ids[0]!;
  eq('uur zelfde dag: voorwaarde vroege start op de statusdag, ná middernacht', time$(t).earlyStart, '2026-06-10T08:00');
  eq('uur zelfde dag: raster enkel 100% geaccepteerd',
    S().runGridMutation([cell(t, 'task.time.completion', 'task-progress', 1)]).ok, true);
  eq('uur zelfde dag: D1/D6 behouden het werkdagpaar',
    { as: time$(t).actualStart, af: time$(t).actualFinish },
    { as: '2026-06-10T08:00', af: '2026-06-10T17:00' });
  eq('uur zelfde dag: voltooid', status$(t), 'COMPLETED');
  eq('uur zelfde dag: percentage 100%', time$(t).completion, 1);
}
{
  const { S, ids, time$, status$ } = setup('dag', '2026-06-10', 1, '2026-06-10');
  const t = ids[0]!;
  eq('dag zelfde dag: vroege start volgt D1 van de statusdag', time$(t).earlyStart, '2026-06-10T07:00');
  S().setTaskProgress(t, 1);
  expectClamped('dag zelfde dag: store setTaskProgress(1)', time$(t), status$(t), '2026-06-10', '2026-06-10T07:00');
}

for (const { kind, start, finish } of [
  { kind: 'uur', start: '2026-06-01T08:00', finish: '2026-06-05T12:00' },
  { kind: 'dag', start: '2026-06-01T07:00', finish: '2026-06-05T16:00' },
] as const) {
  const { S, ids, time$ } = setup(kind, '2026-06-10', 1, '2026-06-01');
  const t = ids[0]!;
  eq(`${kind} #998: geplande taak is opgeschoven`, time$(t).earlyStart.slice(0, 10), '2026-06-10');
  const result = S().runGridMutation([cell(t, 'task.time.completion', 'task-progress', 1)]);
  eq(`${kind} #998: 100% houdt oorspronkelijk begin en einde`,
    { accepted: result.ok, start: time$(t).actualStart, finish: time$(t).actualFinish },
    { accepted: true, start, finish });
}

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
