import type { Task } from '@/types/task';
import { isCostResource, type Resource, type ResourceAssignment } from '@/types/resource';

/**
 * Mag een toewijzing aan `resource` op een mijlpaal staan? Alleen een kostenresource (issue #815,
 * besluit Ethan 2026-11-07: bv. "Leges € 1.200" op "Vergunning aangevraagd"). Werk- en
 * materiaaltoewijzingen blijven op een mijlpaal geweigerd; samenvattingstaken weigeren alle types.
 */
export function resourceAllowedOnMilestone(resource: Pick<Resource, 'type'> | undefined | null): boolean {
  return isCostResource(resource);
}

/**
 * Heeft de taak toewijzingen die een mijlpaal NIET mag dragen (alles behalve kosten)? De invoer
 * `hasAssignments` van {@link milestoneRefusal}. Een toewijzing aan een onbekende resource telt
 * mee (het oude, strengere gedrag).
 */
export function hasMilestoneBlockingAssignments(
  taskId: string,
  assignments: readonly Pick<ResourceAssignment, 'taskId' | 'resourceId'>[],
  resources: readonly Pick<Resource, 'id' | 'type'>[],
): boolean {
  let costIds: Set<string> | null = null;
  for (const a of assignments) {
    if (a.taskId !== taskId) continue;
    costIds ??= new Set(resources.filter(r => isCostResource(r)).map(r => r.id));
    if (!costIds.has(a.resourceId)) return true;
  }
  return false;
}

/**
 * Eén gebruikersgestuurde mijlpaalovergang voor grid, eigenschappenpaneel, dialoog en contextmenu.
 * Of de overgang naar AAN mag, beslist `milestoneRefusal` hieronder — deze functie bouwt alleen de patch.
 * Aanzetten volgt de P6-regel en maakt de taak duurloos. Uitzetten verzint geen vervangingsduur;
 * een bestaande geïmporteerde mijlpaal-met-duur blijft bovendien inhoudelijk ongemoeid zolang de
 * gebruiker de vlag niet werkelijk omzet.
 */
export function taskMilestoneTransition(task: Task, isMilestone: boolean): Partial<Task> {
  if (task.isMilestone === isMilestone) return {};
  if (isMilestone) {
    return {
      isMilestone: true,
      time: {
        ...task.time,
        scheduleDuration: 0,
        durationMinutes: undefined,
      },
    };
  }
  return {
    isMilestone: false,
    milestoneKind: undefined,
    mandatory: undefined,
  };
}

/** Waarom een taak geen mijlpaal mag WORDEN: een fase (heeft kinderen) of een taak met toewijzingen. */
export type MilestoneRefusal = 'summary' | 'assignments';

/**
 * De ene regel voor "wordt mijlpaal", gedeeld door eigenschappenpaneel,
 * dialoog, contextmenu, store-`updateTask`, raster en MCP. Alleen toetsen bij de overgang UIT → AAN.
 *  - Een fase met kinderen kan geen mijlpaal worden: de Gantt tekent haar anders als ruit.
 *  - Een taak met werk- of materiaaltoewijzingen ook niet: een mijlpaal draagt die niet, dus ze
 *    zouden onzichtbaar en zonder belasting achterblijven. Eerst de toewijzingen weghalen. Een
 *    kostentoewijzing mag wel blijven ({@link hasMilestoneBlockingAssignments}, issue #815).
 * Het raster geeft `hasAssignments: false` mee en toetst toewijzingen na afloop over de hele
 * transactie (`planTaskAssignmentSet`), omdat één plak in dezelfde handeling ook de toewijzingen
 * kan wissen.
 */
export function milestoneRefusal(
  target: { hasChildren: boolean; hasAssignments: boolean },
): MilestoneRefusal | null {
  if (target.hasChildren) return 'summary';
  if (target.hasAssignments) return 'assignments';
  return null;
}
