// De structuurovergangen van een taak die iets met haar TOEWIJZINGEN doen (audit taakmutaties §6).
//
// Een toewijzing hoort alleen op een BLADTAAK die geen mijlpaal is: elke toewijsroute weigert een
// mijlpaal of fase als doel (`assignResource`, `moveAssignment`, raster, MCP), en belasting en
// nivelleren negeren toewijzingen op zulke taken. Twee overgangen konden een bestaande toewijzing
// daar toch laten stranden — onzichtbaar in paneel en raster, zonder belasting, maar wel in de data
// en elke export:
//  1. WORDT MIJLPAAL — de regel staat bij de overgang zelf (`milestoneRefusal` in
//     `engine/taskMilestoneTransition.ts`); deze module levert alleen de melding.
//  2. WORDT FASE — een taak krijgt haar eerste kind(eren) via inspringen, verhangen, slepen, een
//     subtaak toevoegen of een sjabloon invoegen. Eigenaarsbesluit "B met melding": de toewijzingen
//     VERHUIZEN naar de eerste nieuwe subtaak die ze mag dragen, in dezelfde undo-stap, met een
//     melding. Kan dat niet schoon (geen geschikte subtaak, of die subtaak heeft dezelfde resource
//     al — één resource per taak is een P6/MSP-invariant, zie `moveAssignment`), dan WEIGERT de hele
//     structuurwijziging: nooit stil verlies. Een MIJLPAAL die kinderen krijgt verliest zijn
//     mijlpaalvlag (anders tekent de Gantt de fase als ruit).
//
// VORM. `planPhaseTransitions` is PUUR en draait VÓÓR de mutatie, zodat een weigering geen halve
// state of undo-stap achterlaat; `applyPhaseTransitions` voert het plan daarna op de Immer-draft
// uit, binnen de producer en de undo-stap van de aanroepende actie. Store-acties melden via het ene
// meldingskanaal (`phaseTransitionNotices`/`phaseRefusalNotice`, BUITEN de producer); de MCP-draft
// meldt niets in de UI maar geeft `describePhaseTransitions` terug in het tool-antwoord.
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import { taskMilestoneTransition, type MilestoneRefusal } from '@/engine/taskMilestoneTransition';
import { relocateAssignment } from './assignmentMutations';
import type { NotifyInput } from './slices/types';

/** Namen in een melding blijven leesbaar (zelfde grens als `relationActions.ts`). */
const MAX_NAME = 40;
const shortName = (name: string | undefined) =>
  !name ? '?' : name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name;

/** Eén taak die in deze handeling haar EERSTE kind(eren) krijgt, met die kinderen in eindvolgorde. */
export interface PhaseGain {
  phaseId: string;
  childIds: readonly string[];
}

/** Vorm van een nieuw kind dat nog niet in `tasks` staat (nieuwe taak, sjabloonwortel). */
export interface PendingChild {
  name: string;
  isMilestone: boolean;
  hasChildren: boolean;
}

export interface PhaseTransition {
  phaseId: string;
  /** Mijlpaal kreeg kinderen ⇒ de mijlpaalvlag gaat eraf (via `taskMilestoneTransition`). */
  clearMilestone: boolean;
  /** Toewijzingen die naar `targetTaskId` verhuizen; leeg ⇒ er verhuist niets. */
  assignmentIds: string[];
  targetTaskId: string | null;
}

export type PhaseRefusal =
  | { kind: 'noAssignableChild'; phaseId: string }
  | { kind: 'duplicateResource'; phaseId: string; childId: string; resourceId: string };

export type PhasePlan =
  | { ok: true; transitions: PhaseTransition[] }
  | { ok: false; refusal: PhaseRefusal };

interface PlanState {
  tasks: readonly Task[];
  assignments: readonly ResourceAssignment[];
}

/**
 * Welke taken worden door deze verhangingen FASE? Alleen ouders die nu (VÓÓR de handeling) geen
 * kinderen hebben; hun nieuwe kinderen in de volgorde van `moves`, en dat is ook hun eindvolgorde:
 * een ouder zonder kinderen krijgt ze allemaal achter elkaar. `parentId: null` (wortel) telt niet.
 */
export function firstChildGains(
  tasks: readonly Task[],
  moves: Iterable<{ childId: string; parentId: string | null }>,
): PhaseGain[] {
  const byParent = new Map<string, string[]>();
  for (const { childId, parentId } of moves) {
    if (parentId === null) continue;
    const parent = tasks.find(t => t.id === parentId);
    if (!parent || parent.childIds.length > 0) continue;
    const list = byParent.get(parentId) ?? [];
    if (!list.includes(childId)) list.push(childId);
    byParent.set(parentId, list);
  }
  return [...byParent].map(([phaseId, childIds]) => ({ phaseId, childIds }));
}

/**
 * Het plan per nieuwe fase. "Eerste nieuwe subtaak" = het eerste nieuwe kind dat toewijzingen mag
 * dragen: een bladtaak die geen mijlpaal is. Elke nieuwe fase apart (inspringen van een selectie).
 * `pending` beschrijft kinderen die nog niet in `s.tasks` staan.
 */
export function planPhaseTransitions(
  s: PlanState,
  gains: readonly PhaseGain[],
  pending?: ReadonlyMap<string, PendingChild>,
): PhasePlan {
  const shape = (id: string): { isMilestone: boolean; hasChildren: boolean } | undefined => {
    const fresh = pending?.get(id);
    if (fresh) return fresh;
    const task = s.tasks.find(t => t.id === id);
    return task ? { isMilestone: task.isMilestone, hasChildren: task.childIds.length > 0 } : undefined;
  };
  const transitions: PhaseTransition[] = [];
  for (const gain of gains) {
    const phase = s.tasks.find(t => t.id === gain.phaseId);
    if (!phase) continue;
    const assignments = s.assignments.filter(a => a.taskId === phase.id);
    if (!phase.isMilestone && assignments.length === 0) continue;
    let targetTaskId: string | null = null;
    if (assignments.length > 0) {
      targetTaskId = gain.childIds.find((id) => {
        const child = shape(id);
        return !!child && !child.isMilestone && !child.hasChildren;
      }) ?? null;
      if (targetTaskId === null) return { ok: false, refusal: { kind: 'noAssignableChild', phaseId: phase.id } };
      for (const assignment of assignments) {
        if (s.assignments.some(a => a.taskId === targetTaskId && a.resourceId === assignment.resourceId)) {
          return {
            ok: false,
            refusal: { kind: 'duplicateResource', phaseId: phase.id, childId: targetTaskId, resourceId: assignment.resourceId },
          };
        }
      }
    }
    transitions.push({
      phaseId: phase.id,
      clearMilestone: phase.isMilestone,
      assignmentIds: assignments.map(a => a.id),
      targetTaskId,
    });
  }
  return { ok: true, transitions };
}

/**
 * Voert het plan uit op de draft, NA de structuurmutatie (het doelkind moet bestaan). Toewijzingen
 * verhuizen met behoud van al hun velden (eenheden, curve, …) via `relocateAssignment`, dezelfde
 * route als `moveAssignment`. Retourneert de taak-ids die daarbij MSP-sturing verloren.
 */
export function applyPhaseTransitions(
  // De volledige toewijzingsstate van `relocateAssignment` (werkregel + kalenders, groep B/#170).
  s: Parameters<typeof relocateAssignment>[0],
  transitions: readonly PhaseTransition[],
): string[] {
  const lost: string[] = [];
  for (const transition of transitions) {
    const phase = s.tasks.find(t => t.id === transition.phaseId);
    if (!phase) continue;
    if (transition.clearMilestone) Object.assign(phase, taskMilestoneTransition(phase, false));
    const target = transition.targetTaskId ? s.tasks.find(t => t.id === transition.targetTaskId) : undefined;
    if (!target) continue;
    for (const id of transition.assignmentIds) {
      const assignment = s.assignments.find(a => a.id === id);
      if (assignment) lost.push(...relocateAssignment(s, assignment, target).lostTaskIds);
    }
  }
  return [...new Set(lost)];
}

interface DescribeState {
  tasks: readonly Task[];
  resources: readonly Resource[];
  assignments: readonly ResourceAssignment[];
}

const taskName = (s: DescribeState, id: string | null, pending?: ReadonlyMap<string, PendingChild>) =>
  (id && (s.tasks.find(t => t.id === id)?.name ?? pending?.get(id)?.name)) || '?';
const resourceName = (s: DescribeState, id: string) => s.resources.find(r => r.id === id)?.name ?? id;

/** Wat er gebeurd is, per nieuwe fase — voor het MCP-tool-antwoord (lees NA `applyPhaseTransitions`). */
export interface PhaseTransitionReport {
  phaseId: string;
  phaseName: string;
  milestoneCleared: boolean;
  assignmentsMovedTo?: { taskId: string; taskName: string; resourceIds: string[]; resourceNames: string[] };
}

export function describePhaseTransitions(
  s: DescribeState,
  transitions: readonly PhaseTransition[],
): PhaseTransitionReport[] {
  return transitions.map((transition) => {
    const moved = s.assignments.filter(a => transition.assignmentIds.includes(a.id));
    return {
      phaseId: transition.phaseId,
      phaseName: taskName(s, transition.phaseId),
      milestoneCleared: transition.clearMilestone,
      ...(transition.targetTaskId && moved.length > 0 ? {
        assignmentsMovedTo: {
          taskId: transition.targetTaskId,
          taskName: taskName(s, transition.targetTaskId),
          resourceIds: moved.map(a => a.resourceId),
          resourceNames: moved.map(a => resourceName(s, a.resourceId)),
        },
      } : {}),
    };
  });
}

/** De weigering als agent-leesbare zin (MCP). Lees VÓÓR de mutatie. */
export function describePhaseRefusal(
  s: DescribeState,
  refusal: PhaseRefusal,
  pending?: ReadonlyMap<string, PendingChild>,
): string {
  const phase = `'${taskName(s, refusal.phaseId)}' (${refusal.phaseId})`;
  if (refusal.kind === 'noAssignableChild') {
    return `taak ${phase} heeft resource-toewijzingen en zou hierdoor een fase worden, maar geen van de nieuwe `
      + 'subtaken mag toewijzingen dragen (alleen mijlpalen of fasen); een fase draagt zelf geen toewijzingen. '
      + 'Verplaats of verwijder eerst de toewijzingen (planner_manage_assignments) — er is niets gewijzigd';
  }
  return `taak ${phase} zou hierdoor een fase worden; haar toewijzing van resource '${resourceName(s, refusal.resourceId)}' `
    + `kan niet naar de eerste nieuwe subtaak '${taskName(s, refusal.childId, pending)}' verhuizen, want die heeft die `
    + 'resource al (één toewijzing per resource per taak). Pas eerst de toewijzingen aan (planner_manage_assignments) '
    + '— er is niets gewijzigd';
}

/** De meldingen na een geslaagde overgang (lees NA `applyPhaseTransitions`, roep `notify` buiten de producer). */
export function phaseTransitionNotices(s: DescribeState, transitions: readonly PhaseTransition[]): NotifyInput[] {
  const notices: NotifyInput[] = [];
  const moved = transitions.filter(t => t.targetTaskId && t.assignmentIds.length > 0);
  if (moved.length === 1) {
    const [only] = moved;
    const resources = s.assignments.filter(a => only.assignmentIds.includes(a.id)).map(a => resourceName(s, a.resourceId));
    notices.push({
      severity: 'info',
      messageKey: 'notifications.assignmentsMovedToSubtask',
      params: {
        count: only.assignmentIds.length,
        resources: resources.join(', '),
        phase: shortName(taskName(s, only.phaseId)),
        child: shortName(taskName(s, only.targetTaskId)),
      },
    });
  } else if (moved.length > 1) {
    notices.push({ severity: 'info', messageKey: 'notifications.assignmentsMovedToSubtasks', params: { count: moved.length } });
  }
  const cleared = transitions.filter(t => t.clearMilestone);
  if (cleared.length > 0) {
    notices.push({
      severity: 'info',
      messageKey: 'notifications.milestoneClearedOnPhase',
      params: { count: cleared.length, phase: shortName(taskName(s, cleared[0].phaseId)) },
    });
  }
  return notices;
}

/** De melding bij een geweigerde structuurwijziging (lees VÓÓR de mutatie). */
export function phaseRefusalNotice(
  s: DescribeState,
  refusal: PhaseRefusal,
  pending?: ReadonlyMap<string, PendingChild>,
): NotifyInput {
  const phase = shortName(taskName(s, refusal.phaseId));
  if (refusal.kind === 'noAssignableChild') {
    return {
      severity: 'info',
      messageKey: 'notifications.phaseRefusedNoAssignableChild',
      params: { phase },
      dedupeKey: `phase-refused-${refusal.phaseId}`,
    };
  }
  return {
    severity: 'info',
    messageKey: 'notifications.phaseRefusedDuplicateResource',
    params: {
      phase,
      child: shortName(taskName(s, refusal.childId, pending)),
      resource: shortName(resourceName(s, refusal.resourceId)),
    },
    dedupeKey: `phase-refused-${refusal.phaseId}`,
  };
}

/** De melding bij een geweigerde omzetting naar mijlpaal; `refused` in volgorde, gegroepeerd per reden. */
export function milestoneRefusalNotices(
  refused: readonly { name: string; refusal: MilestoneRefusal }[],
): NotifyInput[] {
  const notices: NotifyInput[] = [];
  for (const reason of ['assignments', 'summary'] as const) {
    const group = refused.filter(r => r.refusal === reason);
    if (group.length === 0) continue;
    notices.push({
      severity: 'info',
      messageKey: reason === 'assignments'
        ? 'notifications.milestoneRefusedAssignments'
        : 'notifications.milestoneRefusedSummary',
      params: { count: group.length, task: shortName(group[0].name) },
      dedupeKey: `milestone-refused-${reason}`,
    });
  }
  return notices;
}
