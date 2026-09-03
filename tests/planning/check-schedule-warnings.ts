// Waarschuwingenpaneel (issue #53): de pure verzamelaar `collectScheduleWarnings`, de solver-
// uitbreiding `cycleTaskIds`, de navigatie `revealScheduleWarning` op een ECHTE store, en de
// `setUI`-invarianten voor het derde railpaneel.
//
// Draait via run.sh. Exit 0 = alles groen.
import './domStub';
import { createAppStoreContext } from '@/state/appStore';
import { collectScheduleWarnings, summarizeScheduleWarnings } from '@/engine/scheduler/scheduleWarnings';
import { revealScheduleWarning } from '@/state/warningNavigation';
import { COMMANDS } from '@/state/commands';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};

const ctx = createAppStoreContext();
const S = () => ctx.store.getState();

// ── 1) Echte solve: deadline + SNLT-constraint + overbezetting + gemiste deadline op een echte store
S().newProject();
S().setProject({ name: 'Waarschuwingen', startDate: '2026-09-07' });
const a = S().addTask({ name: 'A Grondwerk' });
const b = S().addTask({ name: 'B Fundering' });
const c = S().addTask({ name: 'C Ruwbouw' });
const setTime = (id: string, patch: Record<string, unknown>) => {
  const cur = S().tasks.find(t => t.id === id)!;
  S().updateTask(id, { time: { ...cur.time, ...patch } as typeof cur.time });
};
setTime(a, { scheduleStart: '2026-09-07', scheduleDuration: 10 });
setTime(b, { scheduleStart: '2026-09-07', scheduleDuration: 10 });
setTime(c, { scheduleStart: '2026-09-07', scheduleDuration: 10 });
const seqAB = S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 })!;
S().addSequence({ predecessorId: b, successorId: c, type: 'FINISH_START', lagDays: 0 });
// Deadline op B vóór zijn vroegste einde (A duurt 10 werkdagen, B start daarna).
S().updateTask(b, { deadline: '2026-09-11' });
// Constraint "start niet later dan" op C vóór wat de logica toestaat.
S().updateTask(c, { constraint: { type: 'SNLT', date: '2026-09-09' } });
// Overbezetting: één resource met capaciteit 1, twee parallelle toewijzingen van 1.
const r = S().addResource({ name: 'Kraan', type: 'EQUIPMENT', description: '', maxUnits: 1 });
S().assignResource(a, r, 1);
S().addTask({ name: 'D Parallel' });
const d = S().tasks.find(t => t.name === 'D Parallel')!.id;
setTime(d, { scheduleStart: '2026-09-07', scheduleDuration: 5 });
S().assignResource(d, r, 1);
S().runCPM();

{
  const s = S();
  eq('01 solve slaagt', s.cpmResult?.error ?? null, null);
  const w = collectScheduleWarnings({
    tasks: s.tasks, sequences: s.sequences, resources: s.resources,
    cpmResult: s.cpmResult, resourceLoadResult: s.resourceLoadResult,
  });
  const kinds = w.map(x => x.kind);
  eq('02 gemiste deadline op B aanwezig', kinds.includes('missedDeadline'), true);
  eq('03 geschonden constraint op C aanwezig', kinds.includes('violatedConstraint'), true);
  eq('04 overbezetting op de kraan aanwezig', kinds.includes('overallocation'), true);
  const dl = w.find(x => x.kind === 'missedDeadline')!;
  eq('05 deadline-rij wijst naar B', dl.target, { type: 'task', taskId: b });
  eq('06 deadline-rij draagt deadline + vroegste einde', [dl.facts.deadline, !!dl.facts.finish], ['2026-09-11', true]);
  eq('07 id is stabiel: kind:doel', dl.id, `missedDeadline:${b}`);
  const vc = w.find(x => x.kind === 'violatedConstraint')!;
  eq('08 constraint-rij draagt type + datum', [vc.facts.constraintType, vc.facts.constraintDate], ['SNLT', '2026-09-09']);
  const oa = w.find(x => x.kind === 'overallocation')!;
  eq('09 overbezettingsrij wijst naar de resource met dagtelling', [oa.target, (oa.facts.days ?? 0) > 0], [{ type: 'resource', resourceId: r }, true]);
  eq('10 volgorde: deadline vóór constraint vóór overbezetting', [
    kinds.indexOf('missedDeadline') < kinds.indexOf('violatedConstraint'),
    kinds.indexOf('violatedConstraint') < kinds.indexOf('overallocation'),
  ], [true, true]);
  eq('11 samenvatting telt alleen waarschuwingen', summarizeScheduleWarnings(w), { errors: 0, warnings: w.length, total: w.length });

  // Herhaalde aanroep op dezelfde invoer levert byte-identiek dezelfde lijst (pure functie).
  const w2 = collectScheduleWarnings({
    tasks: s.tasks, sequences: s.sequences, resources: s.resources,
    cpmResult: s.cpmResult, resourceLoadResult: s.resourceLoadResult,
  });
  eq('12 deterministisch', w2, w);
}

// ── 2) Navigatie: taak, relatie, resource ────────────────────────────────────
{
  const s = S();
  const w = collectScheduleWarnings({
    tasks: s.tasks, sequences: s.sequences, resources: s.resources,
    cpmResult: s.cpmResult, resourceLoadResult: s.resourceLoadResult,
  });
  s.deselectAll();
  revealScheduleWarning(S(), w.find(x => x.kind === 'missedDeadline')!);
  eq('20 taak: geselecteerd + actief', [S().selectedTaskIds, S().activeTaskId], [[b], b]);
  eq('21 taak: focus-signaal voor de GanttCanvas gezet', S().view.pendingFocusTaskId, b);
  S().clearPendingFocusTask();

  // Relatie-doel: gebruik een synthetische out-of-sequence-rij op A→B.
  revealScheduleWarning(S(), {
    id: `outOfSequence:${seqAB}`, kind: 'outOfSequence', severity: 'warning',
    target: { type: 'sequence', sequenceId: seqAB, predecessorId: a, successorId: b }, facts: {},
  });
  eq('22 relatie: beide taken geselecteerd, opvolger actief',
    [[...S().selectedTaskIds].sort(), S().activeTaskId], [[a, b].sort(), b]);
  eq('23 relatie: focus op de opvolger', S().view.pendingFocusTaskId, b);
  S().clearPendingFocusTask();

  eq('24 histogram staat vooraf uit', S().ui.showHistogram, false);
  revealScheduleWarning(S(), w.find(x => x.kind === 'overallocation')!);
  eq('25 resource: histogramstrook aan en op de resource gezet',
    [S().ui.showHistogram, S().view.histogramResourceId], [true, r]);
  eq('26 resource: de toegewezen taken (de veroorzakers) geselecteerd', [...S().selectedTaskIds].sort(), [a, d].sort());
  eq('27 resource: geen focus-sprong (kan om veel taken gaan)', S().view.pendingFocusTaskId ?? null, null);
}

// ── 3) Verwijderde doelen vallen weg; niets pusht een undo-stap ──────────────
{
  const before = S().historyEvents.length;
  const s = S();
  const cpm = s.cpmResult!;
  const w = collectScheduleWarnings({
    tasks: s.tasks.filter(t => t.id !== b), sequences: s.sequences, resources: s.resources,
    cpmResult: cpm, resourceLoadResult: s.resourceLoadResult,
  });
  eq('30 verwijderde taak levert geen spookrij', w.some(x => x.kind === 'missedDeadline'), false);
  const w2 = collectScheduleWarnings({
    tasks: s.tasks, sequences: s.sequences, resources: [],
    cpmResult: cpm, resourceLoadResult: s.resourceLoadResult,
  });
  eq('31 verwijderde resource levert geen spookrij', w2.some(x => x.kind === 'overallocation'), false);
  const dup: CPMResult = { ...cpm, missedDeadlineTaskIds: [b, b, b] };
  const w3 = collectScheduleWarnings({
    tasks: s.tasks, sequences: s.sequences, resources: s.resources, cpmResult: dup, resourceLoadResult: null,
  });
  eq('32 dubbele ids in de solver-uitvoer ⇒ één rij', w3.filter(x => x.kind === 'missedDeadline').length, 1);
  eq('33 geen cpmResult ⇒ lege lijst', collectScheduleWarnings({ tasks: [], sequences: [], resources: [], cpmResult: null, resourceLoadResult: null }), []);
  eq('34 navigatie/verzamelen raakt de undo-stapel niet', S().historyEvents.length, before);
}

// ── 4) Cyclus: `cycleTaskIds` op het cyclus-pad en navigatie naar de loop ────
{
  S().addSequence({ predecessorId: c, successorId: a, type: 'FINISH_START', lagDays: 0 });
  S().runCPM();
  const s = S();
  eq('40 cyclus geeft een fout', !!s.cpmResult?.error, true);
  const ids = s.cpmResult?.cycleTaskIds ?? [];
  eq('41 cycleTaskIds bevat precies de loop', [...ids].sort(), [a, b, c].sort());
  const w = collectScheduleWarnings({
    tasks: s.tasks, sequences: s.sequences, resources: s.resources,
    cpmResult: s.cpmResult, resourceLoadResult: s.resourceLoadResult,
  });
  eq('42 fout staat bovenaan als projectrij met de loop-taken',
    [w[0]?.kind, w[0]?.severity, w[0]?.target.type, (w[0]?.target as { taskIds: string[] }).taskIds.length],
    ['scheduleError', 'error', 'project', 3]);
  eq('43 samenvatting telt de fout', summarizeScheduleWarnings(w).errors, 1);
  s.deselectAll();
  revealScheduleWarning(S(), w[0]);
  eq('44 cyclus: hele loop geselecteerd, eerste actief',
    [[...S().selectedTaskIds].sort(), S().activeTaskId === ids[0]], [[a, b, c].sort(), true]);
  S().clearPendingFocusTask();
}

// ── 5) UI-invarianten van het derde railpaneel ───────────────────────────────
{
  eq('50 paneel staat standaard uit', S().ui.showWarningsPanel, false);
  S().setUI({ rightPanelCollapsed: true });
  COMMANDS.toggleWarningsPanel.run(S());
  eq('51 aanzetten klapt de ingeklapte rail uit (invariant 1b)',
    [S().ui.showWarningsPanel, S().ui.rightPanelCollapsed], [true, false]);
  COMMANDS.toggleWarningsPanel.run(S());
  eq('52 commando togglet terug', S().ui.showWarningsPanel, false);
  // Alleen het waarschuwingenpaneel aan, rail ingeklapt en dan uitgeklapt: Eigenschappen mag
  // NIET geforceerd aan (invariant 3 ziet het derde paneel).
  S().setUI({ showPropertiesPanel: false, resourcePanelDocked: false, showResourcePanel: false, showWarningsPanel: true });
  S().setUI({ rightPanelCollapsed: true });
  S().setUI({ rightPanelCollapsed: false });
  eq('53 uitklappen met alleen waarschuwingen aan forceert Eigenschappen niet',
    [S().ui.showPropertiesPanel, S().ui.showWarningsPanel], [false, true]);
  S().setUI({ showWarningsPanel: false, rightPanelCollapsed: true });
  S().setUI({ rightPanelCollapsed: false });
  eq('54 uitklappen zonder enig paneel zet Eigenschappen aan (bestaand gedrag)', S().ui.showPropertiesPanel, true);
}

if (diffs.length) {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`\n${diffs.length}/${checks} checks rood (schedule-warnings)`);
  process.exit(1);
}
console.log(`schedule-warnings: ${checks} checks groen`);
