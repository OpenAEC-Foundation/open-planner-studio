import type { Task } from '@/types/task';
import { formatDate } from '@/utils/dateUtils';

/**
 * Fase 2.6 — voortgang-invarianten toepassen op RAUW ingelezen taken (IFC/MSPDI/P6/CSV).
 *
 * Externe bestanden kunnen inconsistente combinaties bevatten (bv. een `actualFinish` zonder
 * `completion === 1`, of een `RemainingDuration` die niet strookt met het percentage). De store
 * dwingt deze invarianten normaal af in de progress-acties (§3.2), maar de reader zet de velden
 * rauw. Deze helper normaliseert daarom bij het INLEZEN — één plek die álle load-paden dekt
 * (openFile, voorbeelden, recovery, IFC-panel-plak, extensie-API), omdat elke route door een
 * reader loopt.
 *
 * Golden rule: een taak ZONDER enig voortgangssignaal (geen actuals, completion 0) blijft
 * volledig ongemoeid — status NOT_STARTED, geen `remainingTime` gezet — zodat bestaande
 * bestanden byte-identiek round-trippen. `remainingTime` is in 2.6 altijd afgeleid uit
 * `completion` (§9.4-noot): een afwijkende geïmporteerde waarde wordt naar de afgeleide
 * genormaliseerd (gedocumenteerd verlies).
 */
export function normalizeImportedProgress(tasks: Task[], statusDate?: string): void {
  for (const task of tasks) {
    const t = task.time;

    // Completion klemmen op 0..1 (rauwe import kan buiten bereik liggen).
    if (!Number.isFinite(t.completion)) t.completion = 0;
    t.completion = Math.min(1, Math.max(0, t.completion));

    const hasProgress = !!(t.actualStart || t.actualFinish || t.completion > 0);
    if (!hasProgress) {
      // Geen voortgang: laat alle tracking-velden ongemoeid (byte-stabiliteit) en zet status.
      task.status = 'NOT_STARTED';
      continue;
    }

    // §3.2-invarianten (spiegel van applyProgressInvariants in taskSlice).
    if (t.actualFinish) {
      t.completion = 1;
      if (!t.actualStart) t.actualStart = t.actualFinish;
      task.status = 'COMPLETED';
    } else if (t.completion >= 1) {
      t.completion = 1;
      t.actualFinish = statusDate || formatDate(new Date());
      if (!t.actualStart) t.actualStart = t.actualFinish;
      task.status = 'COMPLETED';
    } else {
      // In progress: actualStart gezet óf completion > 0 (impliciete start dekt het
      // solver-vangnet §4.2 tak 2b — hier NIET een actualStart verzinnen).
      task.status = 'STARTED';
    }

    // RemainingTime altijd afgeleid (§9.4-noot): overschrijf een eventueel geïmporteerde waarde.
    t.remainingTime = Math.round(t.scheduleDuration * (1 - t.completion));
  }
}

/**
 * Herbouw de parent-child-hiërarchie uit gepunte WBS-codes (F5-f) — gedeeld door de MSPDI- en
 * CSV-readers, die hier eerder identieke code hadden. Een taak met een punt in zijn `wbsCode` (bv.
 * `1.2.3`) hangt onder de taak met de code één niveau hoger (`1.2`), als die bestaat. Bouwt zijn
 * eigen `wbsCode → id`-map, muteert `parentId`/`childIds` in-place en dupliceert nooit een childId.
 */
export function rebuildWbsHierarchy(tasks: Task[]): void {
  const wbsToId = new Map<string, string>();
  for (const task of tasks) wbsToId.set(task.wbsCode, task.id);

  for (const task of tasks) {
    if (!task.wbsCode || !task.wbsCode.includes('.')) continue;
    const parts = task.wbsCode.split('.');
    parts.pop();
    const parentWbs = parts.join('.');
    const parentId = wbsToId.get(parentWbs);
    if (parentId) {
      task.parentId = parentId;
      const parent = tasks.find(t => t.id === parentId);
      if (parent && !parent.childIds.includes(task.id)) {
        parent.childIds.push(task.id);
      }
    }
  }
}
