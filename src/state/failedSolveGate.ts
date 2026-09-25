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
import { solveInputOf, type SolveProjectInput } from '@/engine/scheduler/solveProject';

type GateState = Pick<AppState, 'cpmResult' | 'tasks' | 'sequences' | 'calendar' | 'calendars' | 'project'>;

/** De plannings-invoer: precies wat `runCPM` aan `solveProject` geeft. */
const planningInputOf = (s: GateState): SolveProjectInput => solveInputOf(s, s.tasks);

/** Zelfde invoer per referentie (Immer levert bij elke echte wijziging een nieuw object op). */
function samePlanningInput(a: SolveProjectInput, b: SolveProjectInput): boolean {
  const keys = Object.keys(a) as (keyof SolveProjectInput)[];
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
