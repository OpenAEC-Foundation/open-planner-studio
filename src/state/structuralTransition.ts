import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import { taskMilestoneTransition, type MilestoneRefusal } from '@/engine/taskMilestoneTransition';
import { relocateAssignment, removeAssignment } from './assignmentMutations';
import type { NotifyInput, PhaseAssignmentQuestion, PhaseAssignmentQuestionItem } from './slices/types';
import { STRUCTURE_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { refusalNotice, refusedNamesLine, refusedSetKey } from './refusalNotice';

const MAX_NAME = 40;
const shortName = (name: string | undefined) =>
  !name ? '?' : name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name;

export interface PhaseGain {
  phaseId: string;
  childIds: readonly string[];
}

export interface PendingChild {
  name: string;
  isMilestone: boolean;
  hasChildren: boolean;
}

export type PhaseAssignmentChoice = 'move' | 'remove';
export type PhaseAssignmentMode = 'ask' | PhaseAssignmentChoice;

export interface PhaseTransition {
  phaseId: string;
  clearMilestone: boolean;
  assignmentIds: string[];
  disposition: PhaseAssignmentChoice;
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

interface DescribeState {
  tasks: readonly Task[];
  resources: readonly Resource[];
  assignments: readonly ResourceAssignment[];
}

const taskName = (s: DescribeState, id: string | null, pending?: ReadonlyMap<string, PendingChild>) =>
  (id && (pending?.get(id)?.name ?? s.tasks.find(t => t.id === id)?.name)) || '?';
const resourceName = (s: DescribeState, id: string) => s.resources.find(r => r.id === id)?.name ?? id;

type ChildShape = (id: string) => { isMilestone: boolean; hasChildren: boolean } | undefined;

function childShape(s: PlanState, pending?: ReadonlyMap<string, PendingChild>): ChildShape {
  return (id) => {
    const fresh = pending?.get(id);
    if (fresh) return fresh;
    const task = s.tasks.find(t => t.id === id);
    return task ? { isMilestone: task.isMilestone, hasChildren: task.childIds.length > 0 } : undefined;
  };
}

function firstAssignableChild(gain: PhaseGain, shape: ChildShape): string | null {
  return gain.childIds.find((id) => {
    const child = shape(id);
    return !!child && !child.isMilestone && !child.hasChildren;
  }) ?? null;
}

export function planPhaseTransitions(
  s: PlanState,
  gains: readonly PhaseGain[],
  pending?: ReadonlyMap<string, PendingChild>,
  choice: PhaseAssignmentChoice = 'move',
): PhasePlan {
  const shape = childShape(s, pending);
  const transitions: PhaseTransition[] = [];
  for (const gain of gains) {
    const phase = s.tasks.find(t => t.id === gain.phaseId);
    if (!phase) continue;
    const assignments = s.assignments.filter(a => a.taskId === phase.id);
    if (!phase.isMilestone && assignments.length === 0) continue;
    let targetTaskId: string | null = null;
    if (assignments.length > 0 && choice === 'move') {
      targetTaskId = firstAssignableChild(gain, shape);
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
      disposition: choice,
      targetTaskId,
    });
  }
  return { ok: true, transitions };
}

export function phaseAssignmentQuestion(
  s: DescribeState,
  gains: readonly PhaseGain[],
  pending?: ReadonlyMap<string, PendingChild>,
): PhaseAssignmentQuestion | null {
  const shape = childShape(s, pending);
  const items: PhaseAssignmentQuestionItem[] = [];
  for (const gain of gains) {
    const phase = s.tasks.find(t => t.id === gain.phaseId);
    if (!phase) continue;
    const assignments = s.assignments.filter(a => a.taskId === phase.id);
    if (assignments.length === 0) continue;
    const targetId = firstAssignableChild(gain, shape);
    const duplicates = targetId === null ? [] : assignments
      .filter(assignment => s.assignments.some(a => a.taskId === targetId && a.resourceId === assignment.resourceId))
      .map(a => resourceName(s, a.resourceId));
    items.push({
      phaseId: phase.id,
      phaseName: taskName(s, phase.id),
      childCount: gain.childIds.length,
      firstChildName: taskName(s, gain.childIds[0] ?? null, pending),
      targetId,
      targetName: targetId === null ? null : taskName(s, targetId, pending),
      resourceNames: assignments.map(a => resourceName(s, a.resourceId)),
      actualWork: assignments
        .filter(a => (a.actualWorkMinutes ?? 0) > 0)
        .map(a => ({ resourceName: resourceName(s, a.resourceId), minutes: a.actualWorkMinutes! })),
      blocked: targetId === null
        ? { kind: 'noAssignableChild' }
        : duplicates.length > 0 ? { kind: 'duplicateResource', resourceNames: duplicates } : null,
    });
  }
  return items.length > 0 ? { items } : null;
}

export function applyPhaseTransitions(
  s: Parameters<typeof relocateAssignment>[0],
  transitions: readonly PhaseTransition[],
): string[] {
  const lost: string[] = [];
  for (const transition of transitions) {
    const phase = s.tasks.find(t => t.id === transition.phaseId);
    if (!phase) continue;
    if (transition.clearMilestone) Object.assign(phase, taskMilestoneTransition(phase, false));
    if (transition.disposition === 'remove') {
      for (const id of transition.assignmentIds) {
        const assignment = s.assignments.find(a => a.id === id);
        if (assignment) lost.push(...removeAssignment(s, assignment).lostTaskIds);
      }
      continue;
    }
    const target = transition.targetTaskId ? s.tasks.find(t => t.id === transition.targetTaskId) : undefined;
    if (!target) continue;
    for (const id of transition.assignmentIds) {
      const assignment = s.assignments.find(a => a.id === id);
      if (assignment) lost.push(...relocateAssignment(s, assignment, target).lostTaskIds);
    }
  }
  return [...new Set(lost)];
}


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

export function describePhaseRefusal(
  s: DescribeState,
  refusal: PhaseRefusal,
  pending?: ReadonlyMap<string, PendingChild>,
): string {
  const phase = `'${taskName(s, refusal.phaseId)}' (${refusal.phaseId})`;
  if (refusal.kind === 'noAssignableChild') {
    return `task ${phase} has resource assignments and would become a phase as a result, but none of the new ` +
      'subtasks may carry assignments (only milestones or phases); a phase itself carries no assignments. ' +
      'Move or remove the assignments first (planner_manage_assignments) — nothing was changed';
  }
  return `task ${phase} would become a phase as a result; its assignment of resource '` +
    `${resourceName(s, refusal.resourceId)}' cannot move to the first new subtask '` +
    `${taskName(s, refusal.childId, pending)}', because that one already has that resource (one assignment ` +
    'per resource per task). Adjust the assignments first (planner_manage_assignments) — nothing was changed';
}

export function phaseTransitionNotices(
  s: DescribeState,
  transitions: readonly PhaseTransition[],
  opts: { announceMoves?: boolean } = {},
): NotifyInput[] {
  const notices: NotifyInput[] = [];
  const moved = opts.announceMoves === false
    ? []
    : transitions.filter(t => t.targetTaskId && t.assignmentIds.length > 0);
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
      helpArticleId: STRUCTURE_HELP_ARTICLE_ID,
    });
  } else if (moved.length > 1) {
    notices.push({
      severity: 'info',
      messageKey: 'notifications.assignmentsMovedToSubtasks',
      params: { count: moved.length },
      helpArticleId: STRUCTURE_HELP_ARTICLE_ID,
    });
  }
  const cleared = transitions.filter(t => t.clearMilestone);
  if (cleared.length > 0) {
    notices.push({
      severity: 'info',
      messageKey: cleared.length === 1
        ? 'notifications.milestoneClearedOnPhase'
        : 'notifications.milestoneClearedOnPhaseMany',
      params: cleared.length === 1
        ? { phase: shortName(taskName(s, cleared[0].phaseId)) }
        : { count: cleared.length },
      helpArticleId: STRUCTURE_HELP_ARTICLE_ID,
    });
  }
  return notices;
}

export function phaseRefusalNotice(
  s: DescribeState,
  refusal: PhaseRefusal,
  pending?: ReadonlyMap<string, PendingChild>,
): NotifyInput {
  const phase = shortName(taskName(s, refusal.phaseId));
  if (refusal.kind === 'noAssignableChild') {
    return refusalNotice({
      messageKey: 'notifications.phaseRefusedNoAssignableChild',
      params: { phase },
      dedupeKey: `phase-refused-${refusal.phaseId}`,
    });
  }
  return refusalNotice({
    messageKey: 'notifications.phaseRefusedDuplicateResource',
    params: {
      phase,
      child: shortName(taskName(s, refusal.childId, pending)),
      resource: shortName(resourceName(s, refusal.resourceId)),
    },
    dedupeKey: `phase-refused-${refusal.phaseId}`,
  });
}

export function milestoneRefusalNotices(
  refused: readonly { id: string; name: string; refusal: MilestoneRefusal }[],
): NotifyInput[] {
  const notices: NotifyInput[] = [];
  for (const reason of ['assignments', 'summary'] as const) {
    const group = refused.filter(r => r.refusal === reason);
    if (group.length === 0) continue;
    notices.push(refusalNotice({
      messageKey: group.length === 1
        ? (reason === 'assignments' ? 'notifications.milestoneRefusedAssignments' : 'notifications.milestoneRefusedSummary')
        : (reason === 'assignments' ? 'notifications.milestoneRefusedAssignmentsMany' : 'notifications.milestoneRefusedSummaryMany'),
      params: group.length === 1 ? { task: shortName(group[0].name) } : { count: group.length },
      ...(group.length > 1 ? { detailLines: refusedNamesLine(group.map(r => shortName(r.name)), 'untouched') } : {}),
      dedupeKey: refusedSetKey(`milestone-refused-${reason}`, group.map(r => r.id)),
    }));
  }
  return notices;
}
