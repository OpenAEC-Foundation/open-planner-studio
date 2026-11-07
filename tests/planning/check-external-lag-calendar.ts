// Keuze 9 (Ethan, 2026-11-03; voorstel 6 uit #792): een externe lag telt in de lagkalender van het
// project (`schedulingOptions.lagCalendar`), net als een interne lag. Staat de gekozen kalender in het
// andere project (lagkalender `predecessor` bij een externe voorganger, `successor` bij een externe
// opvolger), dan telt de lag in de kalender van de eigen taak en meldt de solver dat
// (`externalLagCalendarFallbackTaskIds`, in het paneel Waarschuwingen `externalLagCalendar`).
//
// Bewijs per geval: dezelfde planning met een INTERNE relatie naar een taak op de plek van het anker
// geeft dezelfde datums als de externe koppeling. Zo meet de check de regel "telt zoals een interne lag"
// rechtstreeks, zonder de datums uit de solver over te schrijven.
//
// - `24hour` en `projectDefault`: de interne tegenhanger staat op een andere kalender dan de eigen taak.
//   Niet bij een externe SF-voorganger: een interne SF-relatie legt daarnaast een ondergrens op de
//   finish (`forwardFinishFloor`), die een externe koppeling niet kent (knownbug 846).
// - `predecessor`/`successor`: de eigen kalender. Wijst de keuze naar de andere kant, dan is dat de
//   terugval en staat de taak in de lijst; anders niet. Beide geven dezelfde datums, want beide rekenen
//   met de eigen kalender. Ook hier rekent de koppeling zoals een interne relatie met die kalender: de lag
//   loopt altijd via dezelfde loper als intern (`shiftLagPred`, review #808; dat loste knownbug 847 op).
//   Niet bij een externe SF-voorganger (knownbug 846).
// - Lag 0: nooit een melding, en elke lagkalender geeft dezelfde datums.
import { CPMSolver } from '@/engine/scheduler/CPMSolver';
import { effectiveSchedulingOptions } from '@/engine/scheduler/conventions/registry';
import { collectScheduleWarnings } from '@/engine/scheduler/scheduleWarnings';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task, ExternalLink, TaskConstraint } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { SchedulingOptions } from '@/types/project';

let checks = 0;
const failures: string[] = [];
const eq = (label: string, actual: unknown, expected: unknown) => {
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
  }
};

// Projectkalender 8 uur (ma–vr 08–16) en een taakkalender van 6 uur (ma–vr 08–14).
const project: WorkCalendar = {
  id: 'project', name: 'Project', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};
const short: WorkCalendar = {
  id: 'short', name: 'Kort', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 14, hoursPerDay: 6, holidays: [],
};
type CalId = 'project' | 'short';

const task = (id: string, start: string, days: number, calendarId: CalId, extra: Partial<Task> = {}): Task => ({
  id, name: id, description: '', wbsCode: '', taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  isMilestone: false, priority: 500, parentId: null, childIds: [], resourceIds: [],
  time: createDefaultTaskTime(start, days, 'days'),
  ...(calendarId === 'project' ? {} : { calendarId }),
  ...extra,
});
const SEQ_TYPE = { FS: 'FINISH_START', SS: 'START_START', FF: 'FINISH_FINISH', SF: 'START_FINISH' } as const;
type Rel = keyof typeof SEQ_TYPE;
type LagCal = NonNullable<SchedulingOptions['lagCalendar']>;

const solve = (tasks: Task[], sequences: Sequence[], base: 'ops' | 'p6' | 'msproject', lagCalendar: LagCal) => {
  const schedulingOptions = {
    ...effectiveSchedulingOptions({ schedulingProfile: { baseId: base, id: base, name: '', overrides: {} } }),
    lagCalendar,
  };
  const result = new CPMSolver(tasks, sequences, project, [short], { schedulingOptions }).solve();
  if (result.error) throw new Error(result.error);
  return result;
};
const dates = (r: ReturnType<typeof solve>, id: string) => {
  const t = r.tasks.get(id);
  return t ? [t.earlyStart, t.earlyFinish, t.lateStart, t.lateFinish] : null;
};
// Een losse taak ver achteraan houdt het projecteinde in beide varianten gelijk, zodat de late datums
// van de eigen taak uit de koppeling komen en niet uit het projecteinde.
const tail = (): Task => task('D', '2026-08-03', 5, 'project');
// Een losse taak vooraan houdt de projectstart in beide varianten op ma 1 juni.
const head = (): Task => task('R', '2026-06-01', 1, 'project');

const LAGS = [{ lagDays: 2 }, { lagDays: 1.5 }, { lagDays: -0.5 }, { lagMinutes: 150 }] as const;
const LAG_CALENDARS: LagCal[] = ['24hour', 'projectDefault', 'predecessor', 'successor'];
/** Lagkalenders die niet de kalender van de eigen taak zijn. */
const FOREIGN: LagCal[] = ['24hour', 'projectDefault'];

for (const base of ['ops', 'p6', 'msproject'] as const) {
  for (const lagCalendar of LAG_CALENDARS) {
    for (const rel of ['FS', 'SS', 'FF', 'SF'] as Rel[]) {
      for (const lag of LAGS) {
        const tag = `${base}/${lagCalendar}/${rel}/${JSON.stringify(lag)}`;

        // ── Externe VOORGANGER: de andere kant (de voorganger) staat in het andere project. ──────────
        {
          // Valt de lagkalender terug, dan rekent de solver met de eigen kalender; de interne
          // tegenhanger krijgt dan die kalender, zodat de vergelijking dezelfde regel meet.
          const fallback = lagCalendar === 'predecessor';
          const predCal: CalId = fallback ? 'short' : 'project';
          const P = task('P', '2026-06-08', 5, predCal);
          const internal = solve(
            [head(), P, task('L', '2026-06-01', 3, 'short'), tail()],
            [{ id: 's', predecessorId: 'P', successorId: 'L', type: SEQ_TYPE[rel], ...lag } as Sequence],
            base, lagCalendar,
          );
          const p = internal.tasks.get('P')!;
          const anchorDate = rel === 'FS' || rel === 'FF' ? p.earlyFinish : p.earlyStart;
          const link: ExternalLink = {
            id: 'x', direction: 'predecessor', relType: rel, anchorDate, sourceMissing: false, ...lag,
            sourceRef: { projectId: 'ander', taskId: 'P' },
          };
          const external = solve([head(), task('L', '2026-06-01', 3, 'short', { externalLinks: [link] }), tail()], [], base, lagCalendar);
          if (FOREIGN.includes(lagCalendar) && rel !== 'SF') {
            eq(`voorganger ${tag}: vroege datums zoals een interne relatie`,
              dates(external, 'L')?.slice(0, 2), dates(internal, 'L')?.slice(0, 2));
          }
          if (!FOREIGN.includes(lagCalendar) && rel !== 'SF') {
            eq(`voorganger ${tag}: eigen kalender, vroege datums zoals een interne relatie`,
              dates(external, 'L')?.slice(0, 2), dates(internal, 'L')?.slice(0, 2));
          }
          if (!FOREIGN.includes(lagCalendar)) {
            const other: LagCal = lagCalendar === 'predecessor' ? 'successor' : 'predecessor';
            eq(`voorganger ${tag}: eigen kalender, dezelfde datums als met ${other}`, dates(external, 'L'),
              dates(solve([head(), task('L', '2026-06-01', 3, 'short', { externalLinks: [link] }), tail()], [], base, other), 'L'));
          }
          eq(`voorganger ${tag}: melding bij terugval`,
            external.externalLagCalendarFallbackTaskIds ?? [], fallback ? ['L'] : []);
        }

        // ── Externe OPVOLGER: de andere kant (de opvolger) staat in het andere project. ─────────────
        {
          const fallback = lagCalendar === 'successor';
          const succCal: CalId = fallback ? 'short' : 'project';
          const snet: TaskConstraint = { type: 'SNET', date: '2026-06-22' };
          const S = task('S', '2026-06-22', 4, succCal, { constraint: snet });
          const internal = solve(
            [task('L', '2026-06-01', 3, 'short'), S, tail()],
            [{ id: 's', predecessorId: 'L', successorId: 'S', type: SEQ_TYPE[rel], ...lag } as Sequence],
            base, lagCalendar,
          );
          const s = internal.tasks.get('S')!;
          const anchorDate = rel === 'FS' || rel === 'SS' ? s.lateStart : s.lateFinish;
          const link: ExternalLink = {
            id: 'x', direction: 'successor', relType: rel, anchorDate, sourceMissing: false, ...lag,
            sourceRef: { projectId: 'ander', taskId: 'S' },
          };
          const external = solve([task('L', '2026-06-01', 3, 'short', { externalLinks: [link] }), tail()], [], base, lagCalendar);
          if (FOREIGN.includes(lagCalendar)) {
            eq(`opvolger ${tag}: late datums zoals een interne relatie`,
              dates(external, 'L')?.slice(2), dates(internal, 'L')?.slice(2));
          } else {
            eq(`opvolger ${tag}: eigen kalender, late datums zoals een interne relatie`,
              dates(external, 'L')?.slice(2), dates(internal, 'L')?.slice(2));
            const other: LagCal = lagCalendar === 'predecessor' ? 'successor' : 'predecessor';
            eq(`opvolger ${tag}: eigen kalender, dezelfde datums als met ${other}`, dates(external, 'L'),
              dates(solve([task('L', '2026-06-01', 3, 'short', { externalLinks: [link] }), tail()], [], base, other), 'L'));
          }
          eq(`opvolger ${tag}: melding bij terugval`,
            external.externalLagCalendarFallbackTaskIds ?? [], fallback ? ['L'] : []);
        }
      }

      // ── Lag 0: geen melding, en elke lagkalender rekent hetzelfde. ─────────────────────────────
      for (const direction of ['predecessor', 'successor'] as const) {
        const link: ExternalLink = {
          id: 'x', direction, relType: rel, lagDays: 0, sourceMissing: false,
          anchorDate: direction === 'predecessor' ? '2026-06-12T16:00' : '2026-06-24T08:00',
          sourceRef: { projectId: 'ander', taskId: 'X' },
        };
        const tasks = [task('L', '2026-06-01', 3, 'short', { externalLinks: [link] }), tail()];
        const r = solve(tasks, [], base, lagCalendar);
        eq(`${base}/${lagCalendar}/${rel}/${direction} lag 0: geen melding`, r.externalLagCalendarFallbackTaskIds ?? [], []);
        eq(`${base}/${lagCalendar}/${rel}/${direction} lag 0: zelfde datums als met de standaard`,
          dates(r, 'L'), dates(solve(tasks, [], base, 'predecessor'), 'L'));
      }
    }
  }
}

// ── Een vast voorbeeld met de hand nagerekend (geen vergelijking met de solver zelf). ────────────────
// Anker vr 12 juni 2026 16:00 (einde van de externe voorganger), FS, lag 2 dagen, eigen taak op de
// kalender van 6 uur. 24-uurs: 48 klokuren ⇒ zo 14 juni 16:00 ⇒ eerste werkmoment ma 15 juni 08:00.
// Kalender van de eigen taak (terugval): 2 × 6 uur werktijd vanaf ma 08:00 ⇒ di 16 juni 14:00, het einde
// van de werkdag ⇒ de taak begint wo 17 juni 08:00.
{
  const link: ExternalLink = {
    id: 'x', direction: 'predecessor', relType: 'FS', lagDays: 2, sourceMissing: false,
    anchorDate: '2026-06-12T16:00', sourceRef: { projectId: 'ander', taskId: 'P' },
  };
  const tasks = [task('L', '2026-06-01', 3, 'short', { externalLinks: [link] })];
  eq('voorbeeld 24-uurs: start ma 15 juni 08:00', solve(tasks, [], 'ops', '24hour').tasks.get('L')?.earlyStart,
    '2026-06-15T08:00');
  const own = solve(tasks, [], 'ops', 'predecessor');
  eq('voorbeeld terugval: start wo 17 juni 08:00', own.tasks.get('L')?.earlyStart, '2026-06-17T08:00');

  // De melding staat in het paneel Waarschuwingen, bij de taak.
  const warnings = collectScheduleWarnings({ tasks, sequences: [], resources: [], cpmResult: own, resourceLoadResult: null });
  eq('paneel Waarschuwingen: één regel externalLagCalendar bij L',
    warnings.map(w => [w.kind, w.target.type === 'task' ? w.target.taskId : '']), [['externalLagCalendar', 'L']]);
  const none = collectScheduleWarnings({
    tasks, sequences: [], resources: [], cpmResult: solve(tasks, [], 'ops', '24hour'), resourceLoadResult: null,
  });
  eq('paneel Waarschuwingen: geen regel bij 24-uurs', none.map(w => w.kind), []);
}

// ── Review #808, scenario 1 letterlijk: een externe FS met 6 uur lag naar een eindmijlpaal. ─────────────
// Projectkalender ma–vr 08–16, eigen kalender 08–14, lagkalender *Projectkalender*. De externe voorganger
// eindigt vr 12 juni 16:00; FS met 6 uur lag. Intern geeft dat ma 15 juni 14:00: een geldig eindmoment van
// de mijlpaal. Extern gaf het di 16 juni 08:00 (P6/MS Project). Een mijlpaal zonder soort volgt bij FS de
// gewone regel; ook die vergelijken we met intern, behalve onder OPS: daar zet regel B6 een mijlpaal zonder
// interne voorganger op het einde van de dag, ook als een externe voorganger haar plaatst (knownbug 873).
for (const base of ['ops', 'p6', 'msproject'] as const) {
  for (const kind of ['FINISH', undefined] as const) {
    const tag = `${base}/eindmijlpaal ${kind ?? 'zonder soort'}`;
    const milestone = (extra: Partial<Task> = {}) => task('M', '2026-06-01', 0, 'short', {
      isMilestone: true, ...(kind ? { milestoneKind: kind } : {}), ...extra,
    });
    const P = task('P', '2026-06-08', 5, 'project');
    const internal = solve([head(), P, milestone(), tail()],
      [{ id: 's', predecessorId: 'P', successorId: 'M', type: 'FINISH_START', lagDays: 0, lagMinutes: 360 } as Sequence],
      base, 'projectDefault');
    eq(`${tag}: opzet, de voorganger eindigt vr 12 juni 16:00`, internal.tasks.get('P')?.earlyFinish, '2026-06-12T16:00');
    const link: ExternalLink = {
      id: 'x', direction: 'predecessor', relType: 'FS', lagMinutes: 360, sourceMissing: false,
      anchorDate: '2026-06-12T16:00', sourceRef: { projectId: 'ander', taskId: 'P' },
    };
    const external = solve([head(), milestone({ externalLinks: [link] }), tail()], [], base, 'projectDefault');
    if (kind === 'FINISH' || base !== 'ops') {
      eq(`${tag}: zoals een interne relatie`, dates(external, 'M')?.slice(0, 2), dates(internal, 'M')?.slice(0, 2));
    }
    if (kind === 'FINISH') {
      eq(`${tag}: ma 15 juni 14:00`, external.tasks.get('M')?.earlyFinish, '2026-06-15T14:00');
    }
  }
}

// ── Review #808, scenario 2 letterlijk: met dezelfde kalender telt een dagenlag zoals intern. ───────────
// OPS-profiel, ma–do 08–16 en vrijdag 08–12, lagkalender *Projectkalender*, de taak op de projectkalender
// (dus dezelfde kalender). Anker do 11 juni 16:00, FS met 1 dag lag. Intern start de taak ma 15 juni 08:00;
// extern gaf het 12:00, met een inhoudelijk gelijke kopie van de kalender wel 08:00. Nu geven alle drie
// hetzelfde, ook met de lagkalender van de eigen taak (`predecessor`, de terugval).
{
  const FULL = [{ start: 480, end: 960 }];
  const shortFriday: WorkCalendar = {
    id: 'project', name: 'Project', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
    workTime: { byWeekday: { 1: FULL, 2: FULL, 3: FULL, 4: FULL, 5: [{ start: 480, end: 720 }], 6: [], 7: [] } },
  };
  const copy: WorkCalendar = { ...shortFriday, id: 'kopie', name: 'Kopie' };
  const schedulingOptions = (lagCalendar: LagCal) => ({
    ...effectiveSchedulingOptions({ schedulingProfile: { baseId: 'ops', id: 'ops', name: '', overrides: {} } }),
    lagCalendar,
  });
  const run = (tasks: Task[], sequences: Sequence[], lagCalendar: LagCal) => {
    const r = new CPMSolver(tasks, sequences, shortFriday, [copy], { schedulingOptions: schedulingOptions(lagCalendar) }).solve();
    if (r.error) throw new Error(r.error);
    return r;
  };
  const own = (calendarId?: string, extra: Partial<Task> = {}): Task => ({
    ...task('L', '2026-06-01', 2, 'project'), ...(calendarId ? { calendarId } : {}), ...extra,
  });
  const first = (): Task => task('R', '2026-06-08', 1, 'project');
  const P = task('P', '2026-06-08', 4, 'project');
  const link: ExternalLink = {
    id: 'x', direction: 'predecessor', relType: 'FS', lagDays: 1, sourceMissing: false,
    anchorDate: '2026-06-11T16:00', sourceRef: { projectId: 'ander', taskId: 'P' },
  };
  for (const lagCalendar of ['projectDefault', 'predecessor'] as LagCal[]) {
    const internal = run([first(), P, own()],
      [{ id: 's', predecessorId: 'P', successorId: 'L', type: 'FINISH_START', lagDays: 1 } as Sequence], lagCalendar);
    eq(`ops/korte vrijdag/${lagCalendar}: opzet, P eindigt do 11 juni 16:00`, internal.tasks.get('P')?.earlyFinish, '2026-06-11T16:00');
    eq(`ops/korte vrijdag/${lagCalendar}: intern start L ma 15 juni 08:00`, internal.tasks.get('L')?.earlyStart, '2026-06-15T08:00');
    const same = run([first(), own(undefined, { externalLinks: [link] })], [], lagCalendar);
    eq(`ops/korte vrijdag/${lagCalendar}: extern, dezelfde kalender ⇒ ma 15 juni 08:00`, same.tasks.get('L')?.earlyStart, '2026-06-15T08:00');
    const viaCopy = run([first(), own('kopie', { externalLinks: [link] })], [], lagCalendar);
    eq(`ops/korte vrijdag/${lagCalendar}: extern, een gelijke kopie ⇒ dezelfde datum`, viaCopy.tasks.get('L')?.earlyStart, '2026-06-15T08:00');
  }
}

// ── Harde pin met een externe lag in een andere kalender (review #808 na de merge met #807) ─────────────
// Een harde MSO-pin houdt zijn plaats, maar een geschonden externe koppeling blijft een schending. Ligt de
// grens (anker min lag) buiten de werktijd van de taak, terwijl de lagkalender daar nog doortelt, dan
// mocht de omzetting naar de kalender van de taak die grens niet op de pin laten vallen. Letterlijk uit
// de review: ma–vr 08–16, taak van twee dagen, pin ma 8 juni 08:00, externe SS-opvolger met anker ma
// 8 juni 08:00 en 1 dag lag in 24 uur. De opvolger mag dan pas di 9 juni 08:00 starten: een schending.
// Elk geval heeft een tegenproef één stap verder (anker op de vroegst toegestane datum): geen schending.
{
  const pinAt = (date: string): TaskConstraint => ({ type: 'MSO', date, hard: true });
  const succ = (id: string, relType: Rel, anchorDate: string, lag: Partial<ExternalLink> = {}): ExternalLink => ({
    id, direction: 'successor', relType, anchorDate, sourceMissing: false, sourceRef: { projectId: 'ander', taskId: id }, ...lag,
  });
  const pred = (id: string, relType: Rel, anchorDate: string, lag: Partial<ExternalLink> = {}): ExternalLink => ({
    ...succ(id, relType, anchorDate, lag), direction: 'predecessor',
  });
  const verdict = (t: Task, base: 'ops' | 'p6' | 'msproject', lagCalendar: LagCal) => {
    const r = solve([t], [], base, lagCalendar);
    const kinds = collectScheduleWarnings({ tasks: [t], sequences: [], resources: [], cpmResult: r, resourceLoadResult: null })
      .map(w => w.kind);
    return { violated: r.violatedConstraintTaskIds ?? [], panel: kinds.includes('violatedConstraint'), fallback: r.externalLagCalendarFallbackTaskIds ?? [] };
  };
  for (const base of ['ops', 'p6', 'msproject'] as const) {
    // SS-opvolger, lag 1 dag in 24 uur.
    const ss = (anchor: string, extra: Partial<Task> = {}) => task('L', '2026-06-01', 2, 'project', {
      constraint: pinAt('2026-06-08T08:00'), externalLinks: [succ('s', 'SS', anchor, { lagDays: 1 })], ...extra,
    });
    const a = verdict(ss('2026-06-08T08:00'), base, '24hour');
    eq(`${base}/pin/SS 24 uur: schending`, a.violated, ['L']);
    eq(`${base}/pin/SS 24 uur: in het paneel Waarschuwingen`, a.panel, true);
    eq(`${base}/pin/SS 24 uur: tegenproef anker di 9 juni 08:00`, verdict(ss('2026-06-09T08:00'), base, '24hour').violated, []);
    // Kalendertijd hield de schending al; dat blijft zo.
    const elapsed = ss('2026-06-08T08:00');
    elapsed.time = { ...elapsed.time, durationType: 'ELAPSEDTIME' };
    eq(`${base}/pin/SS 24 uur, ELAPSEDTIME: schending`, verdict(elapsed, base, '24hour').violated, ['L']);
    // Kalendertijd met lag 0: het echte ankermoment telt, ook buiten de werktijd (review #808 ronde 2 na de
    // merge). Taak van 24 uur kalendertijd. MSO-pin ma 8 juni 08:00 ⇒ finish di 9 juni 08:00; een FS/FF-
    // opvolger met anker ma 20:00 is 12 uur te vroeg. MFO-pin ma 8 juni 16:00 ⇒ start zo 7 juni 16:00; een
    // SS/SF-opvolger met anker zo 12:00 is 4 uur te vroeg. Tegenproef: het anker precies op de taakgrens.
    const day24 = (constraint: TaskConstraint, link: ExternalLink) => task('L', '2026-06-01', 1, 'project', {
      time: { ...createDefaultTaskTime('2026-06-01', 24, 'hours'), durationType: 'ELAPSEDTIME' },
      constraint, externalLinks: [link],
    });
    const mfo: TaskConstraint = { type: 'MFO', date: '2026-06-08T16:00', hard: true };
    for (const lagCalendar of LAG_CALENDARS) {
      for (const rel of ['FS', 'FF'] as const) {
        eq(`${base}/${lagCalendar}/pin/ELAPSEDTIME ${rel} lag 0, anker ma 20:00: schending`,
          verdict(day24(pinAt('2026-06-08T08:00'), succ('s', rel, '2026-06-08T20:00')), base, lagCalendar).violated, ['L']);
        eq(`${base}/${lagCalendar}/pin/ELAPSEDTIME ${rel} lag 0, tegenproef anker di 08:00`,
          verdict(day24(pinAt('2026-06-08T08:00'), succ('s', rel, '2026-06-09T08:00')), base, lagCalendar).violated, []);
      }
      for (const rel of ['SS', 'SF'] as const) {
        eq(`${base}/${lagCalendar}/pin/ELAPSEDTIME MFO ${rel} lag 0, anker zo 12:00: schending`,
          verdict(day24(mfo, succ('s', rel, '2026-06-07T12:00')), base, lagCalendar).violated, ['L']);
        eq(`${base}/${lagCalendar}/pin/ELAPSEDTIME MFO ${rel} lag 0, tegenproef anker zo 16:00`,
          verdict(day24(mfo, succ('s', rel, '2026-06-07T16:00')), base, lagCalendar).violated, []);
      }
    }
    // Startmijlpaal met een externe FS-opvolger, lag 1 dag in 24 uur.
    const ms = (anchor: string) => task('L', '2026-06-01', 0, 'project', {
      isMilestone: true, milestoneKind: 'START', constraint: pinAt('2026-06-08T08:00'),
      externalLinks: [succ('s', 'FS', anchor, { lagDays: 1 })],
    });
    eq(`${base}/pin/startmijlpaal FS 24 uur: schending`, verdict(ms('2026-06-08T08:00'), base, '24hour').violated, ['L']);
    eq(`${base}/pin/startmijlpaal FS 24 uur: tegenproef anker di 9 juni 08:00`, verdict(ms('2026-06-09T08:00'), base, '24hour').violated, []);
    // Taakkalender 08–14, lagkalender de projectkalender (08–16), SS met 2 uur lag, pin di 9 juni 08:00.
    const shortSs = (anchor: string) => task('L', '2026-06-01', 2, 'short', {
      constraint: pinAt('2026-06-09T08:00'), externalLinks: [succ('s', 'SS', anchor, { lagMinutes: 120 })],
    });
    eq(`${base}/pin/SS projectkalender, taak 08–14: schending`, verdict(shortSs('2026-06-09T08:00'), base, 'projectDefault').violated, ['L']);
    eq(`${base}/pin/SS projectkalender, taak 08–14: tegenproef anker di 9 juni 10:00`, verdict(shortSs('2026-06-09T10:00'), base, 'projectDefault').violated, []);
    // De volgorde van de koppelingen telt niet: de melding van de lagkalender staat er ook als een eerdere
    // koppeling al een schending gaf (review #808 na de merge met #807, VERVOLG).
    const late = succ('a', 'FS', '2026-06-08T16:00');
    const withLag = succ('b', 'FS', '2026-07-01T08:00', { lagDays: 1 });
    for (const [label, links] of [['eerst de schending', [late, withLag]], ['eerst de lag', [withLag, late]]] as const) {
      const r = verdict(task('L', '2026-06-01', 2, 'project', { constraint: pinAt('2026-06-08T08:00'), externalLinks: [...links] }), base, 'successor');
      eq(`${base}/pin/opvolgers, ${label}: schending en melding`, [r.violated, r.fallback], [['L'], ['L']]);
    }
    const early = pred('a', 'FS', '2026-06-08T12:00');
    const predLag = pred('b', 'FS', '2026-05-20T16:00', { lagDays: 1 });
    for (const [label, links] of [['eerst de schending', [early, predLag]], ['eerst de lag', [predLag, early]]] as const) {
      const r = verdict(task('L', '2026-06-01', 2, 'project', { constraint: pinAt('2026-06-08T08:00'), externalLinks: [...links] }), base, 'predecessor');
      eq(`${base}/pin/voorgangers, ${label}: schending en melding`, [r.violated, r.fallback], [['L'], ['L']]);
    }
  }
}

if (failures.length) {
  console.error(`XX external-lag-calendar: ${failures.length}/${checks}\n${failures.slice(0, 40).join('\n')}`);
  process.exit(1);
}
console.log(`OK external-lag-calendar: ${checks} checks`);
