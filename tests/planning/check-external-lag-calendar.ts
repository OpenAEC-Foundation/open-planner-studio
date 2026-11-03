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
//   met de eigen kalender, zoals vóór keuze 9. (Een vergelijking met een interne relatie hoort hier niet:
//   bij een anker buiten de werktijd van de eigen kalender rekende een externe koppeling al anders,
//   knownbug 847.)
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

if (failures.length) {
  console.error(`XX external-lag-calendar: ${failures.length}/${checks}\n${failures.slice(0, 40).join('\n')}`);
  process.exit(1);
}
console.log(`OK external-lag-calendar: ${checks} checks`);
