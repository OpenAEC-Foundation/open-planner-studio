import type { Task } from '@/types/task';

/**
 * Eén gebruikersgestuurde mijlpaalovergang voor grid, eigenschappenpaneel, dialoog en contextmenu.
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
