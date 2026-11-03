// Voorstel 2 uit #792 (knownbug 6): een externe opvolger met een te krap anker gaf alleen negatieve
// speling. Nu meldt de solver na F5 per koppeling dat de eigen taak het anker niet haalt
// (`externalSuccessorViolations`); het paneel Waarschuwingen toont een regel `externalSuccessorViolated`
// op de eigen taak, en de statusbalk telt ze.
//
// Wat deze check vastlegt, voor elk relatietype en elk rekenprofiel:
// 1. Te krap ⇒ een melding met de taak en de koppeling. Ruim genoeg ⇒ geen melding.
// 2. Een anker op een gelijkwaardig grenspunt (vrijdag 16:00 tegenover maandag 08:00, zonder werktijd
//    ertussen) geeft geen melding. Een lag telt mee.
// 3. Een externe voorganger geeft nooit deze melding; een taak met twee externe opvolgers krijgt alleen
//    een regel voor de koppeling die te krap is.
// 4. De regel in het paneel: soort, doel, ernst, de feiten en de volgorde ná de constraints.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { collectScheduleWarnings } from '@/engine/scheduler/scheduleWarnings';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task, ExternalLink } from '@/types/task';
type ExternalRelationType = ExternalLink['relType'];
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';

let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
};

// Projectkalender ma–vr 08–16.
const calendar: WorkCalendar = {
  id: 'project', name: 'Project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

const task = (id: string, start: string, days: number, extra: Partial<Task> = {}): Task => ({
  id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime(start, days, 'days'),
  ...extra,
});
const successor = (id: string, relType: ExternalRelationType, anchorDate: string, lag: Partial<ExternalLink> = {}): ExternalLink => ({
  id, direction: 'successor', relType, lagDays: 0, anchorDate, sourceMissing: false,
  sourceRef: { projectId: 'installateur', taskId: `ext-${id}`, taskName: 'Installatie', projectName: 'Installateur' },
  ...lag,
});

// R (ma 1 juni, 1 dag) gaat vóór A; A loopt van di 2 juni 08:00 tot ma 8 juni 16:00 (5 werkdagen).
const plan = (links: ExternalLink[]) => {
  const tasks = [task('R', '2026-06-01', 1), task('A', '2026-06-01', 5, { externalLinks: links })];
  const sequences: Sequence[] = [{ id: 'ra', predecessorId: 'R', successorId: 'A', type: 'FINISH_START', lagDays: 0 } as Sequence];
  return { tasks, sequences };
};
const solve = (links: ExternalLink[], base: 'ops' | 'p6' | 'msproject') => {
  const { tasks, sequences } = plan(links);
  const schedulingOptions = effectiveSchedulingOptions({ schedulingProfile: { baseId: base, id: base, name: '', overrides: {} } });
  const result = new CPMSolver(tasks, sequences, calendar, [], { schedulingOptions }).solve();
  if (result.error) throw new Error(result.error);
  return { result, tasks, sequences };
};

// Per relatietype: een anker dat te krap is, een anker precies op de grens, en een gelijkwaardig
// grenspunt aan de andere kant van de nacht of het weekend. A begint di 2 juni 08:00 en is klaar ma
// 8 juni 16:00.
const CASES: { rel: ExternalRelationType; tight: string; exact: string; equivalent: string }[] = [
  // FS: de opvolger begint uiterlijk op het anker; A moet dan klaar zijn.
  { rel: 'FS', tight: '2026-06-08T15:00', exact: '2026-06-08T16:00', equivalent: '2026-06-09T08:00' },
  // SS: de opvolger begint uiterlijk op het anker; A moet dan begonnen zijn.
  { rel: 'SS', tight: '2026-06-01T15:00', exact: '2026-06-02T08:00', equivalent: '2026-06-01T16:00' },
  // FF: de opvolger is uiterlijk klaar op het anker; A moet dan klaar zijn.
  { rel: 'FF', tight: '2026-06-08T12:00', exact: '2026-06-08T16:00', equivalent: '2026-06-09T08:00' },
  // SF: de opvolger is uiterlijk klaar op het anker; A moet dan begonnen zijn.
  { rel: 'SF', tight: '2026-06-01T12:00', exact: '2026-06-02T08:00', equivalent: '2026-06-01T16:00' },
];

for (const base of ['ops', 'p6', 'msproject'] as const) {
  for (const c of CASES) {
    const tag = `${base}/${c.rel}`;
    // (1) Te krap ⇒ melding.
    eq(`1 ${tag}: te krap ⇒ melding`, solve([successor('x', c.rel, c.tight)], base).result.externalSuccessorViolations,
      [{ taskId: 'A', linkId: 'x' }]);
    // (1) Precies op de grens ⇒ geen melding.
    eq(`1 ${tag}: precies op de grens ⇒ geen melding`,
      solve([successor('x', c.rel, c.exact)], base).result.externalSuccessorViolations, undefined);
    // (2) Een gelijkwaardig grenspunt ⇒ geen melding.
    eq(`2 ${tag}: gelijkwaardig grenspunt ⇒ geen melding`,
      solve([successor('x', c.rel, c.equivalent)], base).result.externalSuccessorViolations, undefined);
    // (1) Ruim ⇒ geen melding.
    eq(`1 ${tag}: ruim ⇒ geen melding`,
      solve([successor('x', c.rel, '2026-06-15T08:00')], base).result.externalSuccessorViolations, undefined);
  }

  // (2) Een lag telt mee. FS +2d: de opvolger begint uiterlijk do 11 juni 08:00 ⇒ A uiterlijk klaar op
  // ma 8 juni 16:00 (precies op tijd); bij wo 10 juni 08:00 is A een dag te laat.
  eq(`2 ${base}: FS +2d op tijd`,
    solve([successor('x', 'FS', '2026-06-11T08:00', { lagDays: 2 })], base).result.externalSuccessorViolations, undefined);
  eq(`2 ${base}: FS +2d te krap`,
    solve([successor('x', 'FS', '2026-06-10T08:00', { lagDays: 2 })], base).result.externalSuccessorViolations,
    [{ taskId: 'A', linkId: 'x' }]);
  // Een negatieve lag (overlap): FS −1d met de opvolger op ma 8 juni 08:00 ⇒ A uiterlijk klaar op
  // ma 8 juni 16:00 (op tijd).
  eq(`2 ${base}: FS −1d op tijd`,
    solve([successor('x', 'FS', '2026-06-08T08:00', { lagDays: -1 })], base).result.externalSuccessorViolations, undefined);

  // (3) Een externe voorganger geeft nooit deze melding, ook niet als hij A verschuift.
  const pred: ExternalLink = { ...successor('p', 'FS', '2026-06-03T16:00'), direction: 'predecessor' };
  eq(`3 ${base}: externe voorganger ⇒ geen melding`, solve([pred], base).result.externalSuccessorViolations, undefined);
  // (3) Twee externe opvolgers: alleen de krappe telt.
  eq(`3 ${base}: alleen de krappe koppeling`,
    solve([successor('ruim', 'FS', '2026-06-15T08:00'), successor('krap', 'FF', '2026-06-05T16:00')], base)
      .result.externalSuccessorViolations,
    [{ taskId: 'A', linkId: 'krap' }]);
}

// (4) De regel in het paneel.
{
  const { result, tasks, sequences } = solve([successor('x', 'FS', '2026-06-05T16:00', { lagDays: 1 })], 'ops');
  // Het paneel leest de datums van de taak; zet ze zoals `applyCpmResult` dat doet.
  const withDates = tasks.map(t => {
    const r = result.tasks.get(t.id);
    return r ? { ...t, time: { ...t.time, earlyStart: r.earlyStart, earlyFinish: r.earlyFinish } } : t;
  });
  // Een geschonden constraint op R ernaast, om de volgorde te zien.
  const warnings = collectScheduleWarnings({
    tasks: withDates, sequences, resources: [], resourceLoadResult: null,
    cpmResult: { ...result, violatedConstraintTaskIds: ['R'] },
  });
  const row = warnings.find(w => w.kind === 'externalSuccessorViolated');
  eq('4a één regel', warnings.filter(w => w.kind === 'externalSuccessorViolated').length, 1);
  eq('4b doel, id en ernst', row && [row.id, row.target, row.severity],
    ['externalSuccessorViolated:A:x', { type: 'task', taskId: 'A' }, 'warning']);
  eq('4c de feiten', row?.facts, {
    externalTaskName: 'Installatie', externalProjectName: 'Installateur', externalLinkId: 'x',
    relType: 'FS', anchor: '2026-06-05T16:00', finish: result.tasks.get('A')!.earlyFinish,
  });
  const kinds = warnings.map(w => w.kind);
  eq('4d na de geschonden constraint', kinds.indexOf('violatedConstraint') < kinds.indexOf('externalSuccessorViolated'), true);

  // SS/SF: het feit is de start van de eigen taak.
  const ss = solve([successor('s', 'SF', '2026-06-01T12:00')], 'ops');
  const ssRow = collectScheduleWarnings({
    tasks: ss.tasks.map(t => ({ ...t, time: { ...t.time, earlyStart: ss.result.tasks.get(t.id)!.earlyStart } })),
    sequences: ss.sequences, resources: [], resourceLoadResult: null, cpmResult: ss.result,
  }).find(w => w.kind === 'externalSuccessorViolated');
  eq('4e SF: de start van de eigen taak, geen einde', ssRow && [ssRow.facts.start, 'finish' in ssRow.facts],
    [ss.result.tasks.get('A')!.earlyStart, false]);

  // Zonder schending: geen regel, ook niet als de taak externe opvolgers heeft.
  const ok = solve([successor('x', 'FS', '2026-06-15T08:00')], 'ops');
  eq('4f geen schending ⇒ geen regel', collectScheduleWarnings({
    tasks: ok.tasks, sequences: ok.sequences, resources: [], resourceLoadResult: null, cpmResult: ok.result,
  }).some(w => w.kind === 'externalSuccessorViolated'), false);
}

if (failures.length) {
  console.error(`XX external-successor-violation: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK external-successor-violation: ${checks} checks`);
