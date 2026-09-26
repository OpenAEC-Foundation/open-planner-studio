import type { Task } from '@/types/task';

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
 *  - Een taak met resource-toewijzingen ook niet: een mijlpaal draagt geen toewijzingen, dus die
 *    zouden onzichtbaar en zonder belasting achterblijven. Eerst de toewijzingen weghalen.
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
