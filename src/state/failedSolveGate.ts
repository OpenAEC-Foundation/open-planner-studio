// Rem voor Automatisch berekenen na een rekenfout (review taakmutaties, bijvangst A).
//
// Een mislukte `runCPM` laat `scheduleStale` bewust staan (de statusbalk houdt zo de waarschuwing
// vast) en pusht een melding. Die melding wijzigt de store, dus `useAutoCalcCPM` rekende meteen
// opnieuw — ~10 solves per seconde en een meldingsteller die in 3 s tot ×42 opliep, zolang de fout
// bestond. De regel: na een mislukte berekening rekent automatisch berekenen pas opnieuw als de
// plannings-invoer ECHT verandert. De eigen melding, de stale-vlag, selectie of UI zijn geen invoer.
//
// Een losse bladmodule (net als `editHold.ts`) zodat de hook zelf alleen de aanroep krijgt.
import type { AppState } from './appStore';
import type { SolveProjectFields } from '@/engine/scheduler/solveInput';

type GateState = Pick<AppState, 'cpmResult' | 'tasks' | 'sequences' | 'calendar' | 'calendars' | 'project'>;

/**
 * De plannings-invoer: de RUWE store-referenties waaruit `runCPM` via `solveInputFor` de solve-invoer
 * bouwt — de vier lijsten plus de projectvelden van `SolveProjectFields`. Niet de afgeleide
 * `SolveProjectInput` zelf: `solveOptionsFor` bouwt `schedulingOptions` (profiel + projectopties) bij
 * elke aanroep als NIEUW object, dus een referentievergelijking daarop zou altijd "gewijzigd" zeggen
 * en de rem nooit laten grijpen (integratie groep C: #209 × rekenprofielen).
 */
interface PlanningInput {
  tasks: GateState['tasks'];
  sequences: GateState['sequences'];
  calendar: GateState['calendar'];
  calendars: GateState['calendars'];
  statusDate: SolveProjectFields['statusDate'];
  progressMode: SolveProjectFields['progressMode'];
  schedulingOptions: SolveProjectFields['schedulingOptions'];
  schedulingProfile: SolveProjectFields['schedulingProfile'];
  startDate: SolveProjectFields['startDate'];
  endDate: SolveProjectFields['endDate'];
}

const planningInputOf = (s: GateState): PlanningInput => ({
  tasks: s.tasks,
  sequences: s.sequences,
  calendar: s.calendar,
  calendars: s.calendars,
  statusDate: s.project.statusDate,
  progressMode: s.project.progressMode,
  schedulingOptions: s.project.schedulingOptions,
  schedulingProfile: s.project.schedulingProfile,
  startDate: s.project.startDate,
  endDate: s.project.endDate,
});

/** Zelfde invoer per referentie (Immer levert bij elke echte wijziging een nieuw object op). */
function samePlanningInput(a: PlanningInput, b: PlanningInput): boolean {
  const keys = Object.keys(a) as (keyof PlanningInput)[];
  return keys.length === Object.keys(b).length && keys.every((k) => Object.is(a[k], b[k]));
}

export interface FailedSolveGate {
  /** `true` zolang de laatste berekening faalde en de plannings-invoer sindsdien niet veranderde.
   *  Roep hem bij ELKE storewijziging aan, vóór de andere voorwaarden: hij onthoudt tegen welke
   *  invoer een nieuw rekenresultaat hoort, ongeacht wie rekende (de hook, F5, MCP, een
   *  documentwissel of undo). Een geslaagde berekening heft de rem op. */
  blocks(state: GateState): boolean;
}

export function createFailedSolveGate(initial: GateState): FailedSolveGate {
  let seen = initial.cpmResult;
  let failedInput = initial.cpmResult?.error ? planningInputOf(initial) : null;
  return {
    blocks(state) {
      // Een nieuw rekenresultaat hoort bij de invoer van dát moment: `runCPM` zet het in dezelfde
      // producer als zijn eigen invoer, en een fout schrijft niets terug op de taken.
      if (state.cpmResult !== seen) {
        seen = state.cpmResult;
        failedInput = state.cpmResult?.error ? planningInputOf(state) : null;
      }
      return failedInput !== null && samePlanningInput(failedInput, planningInputOf(state));
    },
  };
}
