import type { Sequence } from '@/types/sequence';
import type { Task, TaskConstraint } from '@/types/task';
import { expandSummaryRelations } from '@/engine/scheduler/expandSummaryRelations';
import { shownStart } from '@/utils/taskDates';
import { isManuallyScheduled } from '@/utils/manualScheduling';

/**
 * Een getypte startdatum op een taak MET voorganger wordt een beperking "Start niet eerder dan"
 * (SNET) — het MS Project-gedrag. De solver leest het startanker `scheduleStart` alleen voor een
 * taak zónder voorganger (`CPMSolver.forwardPass`, de `noPreds`-tak); bij een taak mét voorganger
 * zou een getypte start anders stil terugspringen achter die voorganger. Een SNET is een ondergrens
 * in de forward pass: een datum ná wat de voorganger toelaat verschuift de taak, een datum ervóór
 * doet niets — de voorganger wint vanzelf.
 *
 * Heeft de taak een ANDERE constraint (ALAP, SNLT, FNET, FNLT, MSO, MFO, ook hard), dan heeft een
 * nieuwe start geen enkel effect: het anker telt bij een voorganger niet, en die constraint bepaalt
 * samen met de voorganger de start (per type gemeten in `check-start-snet.ts`). Regel:
 * "melden, beperking laten staan" — de start wordt dan niet toegepast (`constraintBlockingStart`).
 *
 * Eén regel voor elke UI-route waar je een start zet: de Tabel-kolommen Start en Geplande start
 * (`taskEditPlan.ts`), het eigenschappenpaneel (`TaskTimeFields`), Taak bewerken (`TaskDialog`) en
 * de Gantt-balk (body verschuiven, linkerrand slepen; `useBarDrag`). De meldingen bouwt
 * `state/startConstraintNotice.ts`. Bewust NIET: de MCP-tools.
 */

/**
 * De taken waarvan de start door een voorganger wordt bepaald — precies de taken die in de solver
 * minstens één inkomende relatie hebben. Dezelfde bron als `solveProject`: een relatie op een
 * samenvatting geldt voor elk bladkind (`expandSummaryRelations`), dus een kind van een fase mét
 * voorganger telt mee. Een externe koppeling telt niet: die is een extra ondergrens naast het eigen
 * anker, geen vervanging ervan.
 */
export function predecessorDrivenTaskIds(
  tasks: readonly Task[],
  sequences: readonly Sequence[],
): Set<string> {
  const driven = new Set<string>();
  for (const sequence of expandSummaryRelations(tasks, sequences).sequences) {
    driven.add(sequence.successorId);
  }
  return driven;
}

/** Wat de regel met de beperking deed: een nieuwe SNET, of de datum van de bestaande bijgewerkt. */
export type StartConstraintChange = 'created' | 'updated';

export interface StartConstraintEdit {
  constraint: TaskConstraint;
  change: StartConstraintChange;
}

/**
 * Geldt de startregel voor deze taak? Alleen als een voorganger de start bepaalt én een constraint
 * daar iets aan kan veranderen:
 *  - geen samenvatting (de solver rekent op bladtaken; een beperking op een fase telt niet),
 *  - niet handmatig gepland (daar IS het anker de planning, ook met voorganger),
 *  - geen hangmat (die start op zijn start-driver),
 *  - niet gestart (de werkelijke start pint de taak; een SNET zou niets doen).
 */
function startRuleApplies(task: Task, drivenByPredecessor: boolean): boolean {
  if (!drivenByPredecessor) return false;
  // `isManuallyScheduled` (utils): bewerksemantiek, geen motorlezing van de datagate `manuallyScheduled`
  // (integratie groep C × rekenprofielen, `verify:conventions`).
  if (task.childIds.length > 0 || isManuallyScheduled(task) || task.isHammock === true) return false;
  return !task.time.actualStart && !(task.time.completion > 0);
}

/**
 * De beperking na een nieuwe start `start` (het nieuwe anker, dus alleen bij een ECHTE wijziging —
 * zie `startAnchorAfterEdit`). `undefined` ⇒ de beperking blijft zoals ze is. Alleen waar de
 * startregel geldt (`startRuleApplies`). Primaire beperking ASAP (of geen) ⇒ SNET op `start`. Al een
 * SNET ⇒ alleen de datum. Elk ander type houdt de start tegen: zie `constraintBlockingStart`.
 */
export function startConstraintAfterEdit(
  task: Task,
  start: string,
  drivenByPredecessor: boolean,
): StartConstraintEdit | undefined {
  if (!start || !startRuleApplies(task, drivenByPredecessor)) return undefined;
  const current = task.constraint;
  if (!current || current.type === 'ASAP') {
    return { constraint: { type: 'SNET', date: start }, change: 'created' };
  }
  if (current.type === 'SNET' && current.date !== start) {
    return { constraint: { ...current, date: start }, change: 'updated' };
  }
  return undefined;
}

/**
 * De constraint die een nieuwe start tegenhoudt, of `undefined`. Waar de startregel geldt en de
 * primaire constraint iets anders is dan ASAP of SNET, verandert een ander anker niets (het
 * anker telt bij een voorganger niet; per type gemeten in `check-start-snet.ts`). De aanroeper past
 * de start dan NIET toe — ook niet als dood anker — en meldt deze constraint ("melden, beperking
 * laten staan").
 */
export function constraintBlockingStart(task: Task, drivenByPredecessor: boolean): TaskConstraint | undefined {
  if (!startRuleApplies(task, drivenByPredecessor)) return undefined;
  const current = task.constraint;
  return current && current.type !== 'ASAP' && current.type !== 'SNET' ? current : undefined;
}

/**
 * De beperking bij een GESLEEPTE start (Gantt-balk: body verschuiven of linkerrand slepen), altijd
 * gerekend vanaf `original`, de taak zoals ze bij het begin van het gebaar was: elke muisbeweging
 * geeft dan dezelfde uitkomst als één keer typen, en terug op de oorspronkelijke start ⇒ weer de
 * oorspronkelijke constraint (`undefined`).
 */
export function constraintForDraggedStart(
  original: Task,
  start: string,
  drivenByPredecessor: boolean,
): StartConstraintEdit | undefined {
  if (start === shownStart(original)) return undefined;
  return startConstraintAfterEdit(original, start, drivenByPredecessor);
}
