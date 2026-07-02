import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import { generateId } from '@/utils/id';

/**
 * WBS-templates (fase 2.2, Asta "task pools"-model): een herbruikbare tak —
 * taken (naam/duur/mijlpaal/taaktype/omschrijving, met template-lokale ids)
 * plus de interne relaties (incl. lag-velden). Bewust ZONDER datums/voortgang
 * (die zijn projectspecifiek) en zonder activity-codes/custom-field-waarden
 * (die verwijzen naar projectgebonden definities die in een ander project
 * niet bestaan). App-niveau data in localStorage — geen IFC-round-trip,
 * zelfde categorie als het taakklembord.
 */
export interface WbsTemplateTask {
  id: string; // template-lokaal
  parentId: string | null; // template-lokaal; null = wortel van de tak
  name: string;
  description: string;
  taskType: Task['taskType'];
  isMilestone: boolean;
  durationDays: number;
}

export interface WbsTemplateSequence {
  predecessorId: string; // template-lokaal
  successorId: string;
  type: Sequence['type'];
  lagDays: number;
  lagUnit?: Sequence['lagUnit'];
  lagPercent?: number;
}

export interface WbsTemplate {
  id: string;
  name: string;
  createdAt: string;
  tasks: WbsTemplateTask[];
  sequences: WbsTemplateSequence[];
}

const STORAGE_KEY = 'ops-wbs-templates';

export function listWbsTemplates(): WbsTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(templates: WbsTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch { /* quota/privémodus — sjabloon gaat dan niet verloren uit de UI-flow, alleen niet bewaard */ }
}

export function deleteWbsTemplate(id: string): void {
  persist(listWbsTemplates().filter(t => t.id !== id));
}

/**
 * Serialiseer een tak (taak + alle nakomelingen) tot een sjabloon en bewaar het.
 * Interne relaties (beide eindpunten binnen de tak) gaan mee; externe niet
 * (P6-conform default). Geeft het bewaarde sjabloon terug.
 */
export function saveBranchAsWbsTemplate(
  name: string,
  rootId: string,
  allTasks: Task[],
  allSequences: Sequence[],
): WbsTemplate {
  const byId = new Map(allTasks.map(t => [t.id, t]));
  const branchIds: string[] = [];
  const collect = (id: string) => {
    const task = byId.get(id);
    if (!task) return;
    branchIds.push(id);
    for (const childId of task.childIds) collect(childId);
  };
  collect(rootId);
  const branchSet = new Set(branchIds);

  const localId = new Map(branchIds.map((id, i) => [id, `t${i + 1}`]));
  const tasks: WbsTemplateTask[] = branchIds.map(id => {
    const task = byId.get(id)!;
    const parentLocal = id === rootId ? null : localId.get(task.parentId ?? '') ?? null;
    return {
      id: localId.get(id)!,
      parentId: parentLocal,
      name: task.name,
      description: task.description,
      taskType: task.taskType,
      isMilestone: task.isMilestone,
      durationDays: task.isMilestone ? 0 : task.time.scheduleDuration,
    };
  });
  const sequences: WbsTemplateSequence[] = allSequences
    .filter(q => branchSet.has(q.predecessorId) && branchSet.has(q.successorId))
    .map(q => ({
      predecessorId: localId.get(q.predecessorId)!,
      successorId: localId.get(q.successorId)!,
      type: q.type,
      lagDays: q.lagDays,
      ...(q.lagUnit !== undefined ? { lagUnit: q.lagUnit } : {}),
      ...(q.lagPercent !== undefined ? { lagPercent: q.lagPercent } : {}),
    }));

  const template: WbsTemplate = {
    id: generateId('wtpl'),
    name,
    createdAt: new Date().toISOString(),
    tasks,
    sequences,
  };
  persist([...listWbsTemplates(), template]);
  return template;
}
