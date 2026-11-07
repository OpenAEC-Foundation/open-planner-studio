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
// 5. Review #810: bij SS en SF beslist de start, ook met voortgang (de echte voortgangsacties in de store).
//    Te laat begonnen maar snel klaar ⇒ melding; op tijd begonnen maar lang bezig ⇒ geen melding.
// 6. Review #810: een externe opvolger op een fase geeft een regel in het paneel bij de bladtaak.
import './domStub';
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { builtInProfile, effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { createAppStoreContext } from '@/state/appStore';
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

// Een store met de projectkalender ma–vr 08–16 en het gekozen profiel.
const storeFor = (base: 'ops' | 'p6' | 'msproject', statusDate?: string) => {
  const { store } = createAppStoreContext();
  const S = () => store.getState();
  S().newProject();
  S().setProject({ startDate: '2026-06-01', ...(statusDate ? { statusDate } : {}), schedulingProfile: builtInProfile(base) });
  S().setCalendar({ ...calendar, id: S().calendar.id });
  return S;
};
const linkFields = (link: ExternalLink) => { const { id: _id, ...fields } = link; return fields; };
const rows = (S: ReturnType<typeof storeFor>) => collectScheduleWarnings({
  tasks: S().tasks, sequences: S().sequences, resources: S().resources, cpmResult: S().cpmResult,
  resourceLoadResult: null,
}).filter(w => w.kind === 'externalSuccessorViolated');

// (5) SS/SF met voortgang, het scenario van de review letterlijk: anker di 2 juni 08:00, taakduur 5 dagen.
for (const base of ['ops', 'p6', 'msproject'] as const) {
  for (const rel of ['SS', 'SF'] as const) {
    const tag = `5 ${base}/${rel}`;
    const run = (statusDate: string, progress: (S: ReturnType<typeof storeFor>, id: string) => void) => {
      const S = storeFor(base, statusDate);
      const a = S().addTask({ name: 'A', time: createDefaultTaskTime('2026-06-01', 5, 'days') });
      const linkId = S().addExternalLink(a, linkFields(successor('x', rel, '2026-06-02T08:00')));
      progress(S, a);
      S().runCPM();
      return { S, a, linkId, found: (S().cpmResult?.externalSuccessorViolations ?? []).map(v => v.linkId === linkId) };
    };
    // Werkelijk gestart wo 3 juni 08:00, klaar wo 3 juni 16:00: te laat begonnen ⇒ melding.
    const lateQuick = run('2026-06-30', (S, a) => {
      eq(`${tag} opzet: start gezet`, S().setActualStart(a, '2026-06-03T08:00'), true);
      eq(`${tag} opzet: einde gezet`, S().setActualFinish(a, '2026-06-03T16:00'), true);
    });
    eq(`${tag}: te laat begonnen, snel klaar ⇒ melding`, lateQuick.found, [true]);
    eq(`${tag}: en een regel in het paneel`, rows(lateQuick.S).length, 1);
    // Werkelijk gestart ma 1 juni 08:00, klaar ma 15 juni 16:00: op tijd begonnen ⇒ geen melding.
    const earlyLong = run('2026-06-30', (S, a) => {
      S().setActualStart(a, '2026-06-01T08:00');
      S().setActualFinish(a, '2026-06-15T16:00');
    });
    eq(`${tag}: op tijd begonnen, lang bezig ⇒ geen melding`, earlyLong.found, []);
    // Lopend: gestart ma 1 juni 08:00, 20 % klaar op statusdatum wo 10 juni: het einde schuift op, de start
    // was op tijd ⇒ geen melding.
    const running = run('2026-06-10', (S, a) => {
      S().setActualStart(a, '2026-06-01T08:00');
      S().setTaskProgress(a, 0.2);
    });
    eq(`${tag}: lopend, op tijd begonnen ⇒ geen melding`, running.found, []);
  }
}

// (6) Een externe opvolger op een fase: de fase heeft een FS-opvolger met anker wo 3 juni 16:00, de bladtaak
// is klaar vr 5 juni 16:00. De solver meldt het bij de bladtaak; het paneel toont dan ook een regel. Zonder
// statusdatum: de taak is niet gestart.
for (const base of ['ops', 'p6', 'msproject'] as const) {
  const S = storeFor(base);
  const phase = S().addTask({ name: 'Fase', time: createDefaultTaskTime('2026-06-01', 5, 'days') });
  const leaf = S().addTask({ name: 'Blad', parentId: phase, time: createDefaultTaskTime('2026-06-01', 5, 'days') });
  const linkId = S().addExternalLink(phase, linkFields(successor('x', 'FS', '2026-06-03T16:00')));
  S().runCPM();
  eq(`6 ${base}: opzet, de bladtaak is klaar vr 5 juni 16:00`, S().tasks.find(t => t.id === leaf)?.time.earlyFinish, '2026-06-05T16:00');
  eq(`6 ${base}: de solver meldt de koppeling van de fase bij de bladtaak`,
    S().cpmResult?.externalSuccessorViolations, [{ taskId: leaf, linkId }]);
  const phaseRows = rows(S);
  eq(`6 ${base}: één regel in het paneel, bij de bladtaak, met de feiten van de koppeling`,
    phaseRows.map(w => [w.target, w.facts.externalLinkId, w.facts.externalTaskName, w.facts.relType]),
    [[{ type: 'task', taskId: leaf }, linkId, 'Installatie', 'FS']]);
}

// (7) Review #810 ronde 2: kalendertijd (`ELAPSEDTIME`) buiten werktijd. Een anker buiten werktijd met lag nul
// mag niet naar het volgende werkblok (ma 8 juni 08:00) schuiven: dan verdween een conflict van een uur.
// - Het scenario van de review letterlijk: *Beton uitharden* duurt twee kalenderdagen, werkelijk van vr 5 juni
//   16:00 tot zo 7 juni 16:00. FS/FF: anker zo 7 juni 15:00 ⇒ melding; zo 7 juni 16:00 ⇒ geen. SS/SF: werkelijke
//   start zo 7 juni 09:00; anker zo 7 juni 08:00 ⇒ melding; zo 7 juni 09:00 ⇒ geen.
// - Zonder voortgang: *Beton storten* ma 1 t/m do 4 juni, dan uitharden van vr 5 juni 08:00 tot zo 7 juni
//   08:00. FS/FF: anker zo 7 juni 07:00 ⇒ melding; zo 7 juni 08:00 ⇒ geen. De late finish is het anker zelf
//   (dezelfde grens in de backward pass).
for (const base of ['ops', 'p6', 'msproject'] as const) {
  const curing = (S: ReturnType<typeof storeFor>, pourDays: number) => {
    const pour = S().addTask({ name: 'Beton storten', time: createDefaultTaskTime('2026-06-01', pourDays, 'days') });
    const cure = S().addTask({
      name: 'Beton uitharden',
      time: { ...createDefaultTaskTime('2026-06-01', 2, 'days'), durationType: 'ELAPSEDTIME' },
    });
    S().addSequence({ predecessorId: pour, successorId: cure, type: 'FINISH_START', lagDays: 0 });
    return cure;
  };
  const time = (S: ReturnType<typeof storeFor>, id: string) => {
    const t = S().tasks.find(x => x.id === id)!.time;
    return [t.earlyStart, t.earlyFinish];
  };
  const verdict = (tag: string, S: ReturnType<typeof storeFor>, cure: string, linkId: string, anchor: string, late: boolean) => {
    eq(`${tag}: anker ${anchor} ⇒ ${late ? 'melding' : 'geen melding'}`,
      S().cpmResult?.externalSuccessorViolations ?? [], late ? [{ taskId: cure, linkId }] : []);
    eq(`${tag}: anker ${anchor} ⇒ ${late ? 'een' : 'geen'} regel in het paneel`, rows(S).length, late ? 1 : 0);
  };
  const CURE_CASES: { rel: ExternalRelationType; late: string; onTime: string }[] = [
    { rel: 'FS', late: '2026-06-07T15:00', onTime: '2026-06-07T16:00' },
    { rel: 'FF', late: '2026-06-07T15:00', onTime: '2026-06-07T16:00' },
    { rel: 'SS', late: '2026-06-07T08:00', onTime: '2026-06-07T09:00' },
    { rel: 'SF', late: '2026-06-07T08:00', onTime: '2026-06-07T09:00' },
  ];
  // Het scenario van de review, met de echte voortgangsacties.
  for (const c of CURE_CASES) {
    const tag = `7 ${base}/${c.rel}`;
    const startSide = c.rel === 'SS' || c.rel === 'SF';
    for (const [anchor, late] of [[c.late, true], [c.onTime, false]] as const) {
      const S = storeFor(base, '2026-06-30');
      const cure = curing(S, 5);
      const linkId = S().addExternalLink(cure, linkFields(successor('x', c.rel, anchor)));
      const [start, finish] = startSide ? ['2026-06-07T09:00', '2026-06-09T09:00'] : ['2026-06-05T16:00', '2026-06-07T16:00'];
      eq(`${tag} opzet: werkelijke start`, S().setActualStart(cure, start), true);
      eq(`${tag} opzet: werkelijk einde`, S().setActualFinish(cure, finish), true);
      S().runCPM();
      eq(`${tag} opzet: uitharden van ${start} tot ${finish}`, time(S, cure), [start, finish]);
      verdict(tag, S, cure, linkId, anchor, late);
    }
  }
  // Zonder voortgang: de vroege datums van de planning.
  for (const rel of ['FS', 'FF'] as const) {
    const tag = `7 ${base}/${rel} gepland`;
    for (const [anchor, late] of [['2026-06-07T07:00', true], ['2026-06-07T08:00', false]] as const) {
      const S = storeFor(base);
      const cure = curing(S, 4);
      const linkId = S().addExternalLink(cure, linkFields(successor('x', rel, anchor)));
      S().runCPM();
      eq(`${tag} opzet: uitharden van vr 5 juni 08:00 tot zo 7 juni 08:00`, time(S, cure),
        ['2026-06-05T08:00', '2026-06-07T08:00']);
      verdict(tag, S, cure, linkId, anchor, late);
      // De backward pass rekent met hetzelfde ankermoment: de late finish is het anker zelf, niet ma 08:00.
      eq(`${tag}: anker ${anchor} ⇒ late finish op het anker`, S().tasks.find(x => x.id === cure)?.time.lateFinish, anchor);
    }
  }
}

if (failures.length) {
  console.error(`XX external-successor-violation: ${failures.length}/${checks}\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`OK external-successor-violation: ${checks} checks`);
