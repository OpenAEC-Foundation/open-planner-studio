import type { Task, TaskTime } from '@/types/task';
import { sameValue } from '@/utils/sameValue';
import {
  applyActualDateEdit, applyCompletionEdit, applyProgressInvariants, isActualPastStatusDate,
} from '@/engine/taskMutationRules';

/**
 * Voortgang INVULLEN via de gebruikersinterface: de regels die bovenop de voortgangsinvarianten
 * (`taskMutationRules.ts`) gelden zodra een MENS voortgang invoert — eigenschappenpaneel,
 * contextmenu, "Taak bewerken" en het taakraster. Eén plek, zodat die routes niet elk een eigen
 * variant krijgen.
 *
 * Z1 (besluit eigenaar): voortgang invullen terwijl er geen statusdatum is ⇒ de app zet de
 * statusdatum op VANDAAG en meldt dat. Zonder statusdatum rekende de solver een lopende taak vooruit
 * met haar restduur maar achteruit met de volle duur: speling −1 en onterecht kritiek
 * (audit/weergaven z1). "Vandaag" is wat het statusdatumveld oplevert als de gebruiker daar de datum
 * van vandaag intypt (`localTodayIso`): een datum zonder tijd.
 *
 * Alleen UI-routes geven `today` mee. Zonder `today` (headless code, generatoren, testharnassen,
 * extensies) blijven de oude regels gelden — het vangnet van de store, onveranderd. De AI-koppeling
 * doet bewust NIETS automatisch: die weigert voortgang zonder statusdatum (`mcpValidation.ts`).
 */

/** Eén voortgangsbewerking zoals de setters (`setTaskProgress`/`setActualStart`/`setActualFinish`)
 *  en de voortgangsvelden van paneel en dialoog die kennen. `undefined` bij een datum = wissen. */
export type ProgressEdit =
  | { field: 'completion'; value: number }
  | { field: 'actualStart' | 'actualFinish'; value: string | undefined };

/** Heeft deze taak vastgelegde voortgang: een percentage boven 0 of een werkelijke datum? */
export function hasRecordedProgress(time: Pick<TaskTime, 'completion' | 'actualStart' | 'actualFinish'>): boolean {
  return time.completion > 0 || !!time.actualStart || !!time.actualFinish;
}

/**
 * De statusdatum waarmee een voortgangsinvoer rekent (Z1): de ingestelde, of — ontbreekt die en komt
 * de invoer uit de UI (`today` gezet) — vandaag. `undefined` alleen voor het headless vangnet.
 */
export function progressEntryStatusDate(statusDate: string | undefined, today: string | undefined): string | undefined {
  return statusDate || today || undefined;
}

/** Past `edit` toe op `task` (muteert), met de setter-semantiek: dezelfde functies als
 *  `setTaskProgress` (`applyCompletionEdit` + invarianten) en `setActualStart`/`setActualFinish`
 *  (`applyActualDateEdit`). */
export function applyProgressEdit(task: Task, edit: ProgressEdit, statusDate: string | undefined): void {
  if (edit.field === 'completion') {
    applyCompletionEdit(task.time, Math.max(0, Math.min(1, edit.value)), statusDate);
    applyProgressInvariants(task, statusDate);
  } else {
    applyActualDateEdit(task, edit.field, edit.value, statusDate);
  }
}

export interface ProgressEntryContext {
  /** De statusdatum van het project zoals hij nu staat. */
  statusDate: string | undefined;
  /** UI-invoer: vandaag (`localTodayIso`). Afwezig = headless vangnet, zonder Z1. */
  today?: string;
}

/** Uitkomst van voortgang invullen via de UI (`enterTaskProgress`, dialoog-concept): toegepast (of
 *  een no-op), of geweigerd met een reden die de UI toont. */
export type ProgressEntryResult =
  | { ok: true }
  | { ok: false; reason: 'afterStatusDate' }
  /** Een verzameltaak draagt geen eigen voortgang (#203): de rollup leidt haar af uit de bladen. */
  | { ok: false; reason: 'summaryTask' };

/** Wat een voortgangsbewerking op één taak zou doen. */
export type ProgressEntryPlan =
  /** Per saldo niets gewijzigd: een no-op (geen undo-stap, geen `isDirty`, geen statusdatum). */
  | { ok: true; change: null }
  /** De taak zoals ze na de bewerking is; `statusDateToday` gezet ⇒ de statusdatum gaat in dezelfde
   *  stap op die datum (Z1). */
  | { ok: true; change: { task: Task; statusDateToday?: string } }
  /** Geweigerd: een opgegeven werkelijke datum ligt ná de (effectieve) statusdatum (§3.2). */
  | { ok: false; reason: 'afterStatusDate' };

/**
 * Plant één voortgangsbewerking op `task` zonder iets te muteren — de ene beslissing achter de
 * store-setters en de UI-invoer:
 *  1. de effectieve statusdatum (Z1: zonder statusdatum en vanuit de UI ⇒ vandaag);
 *  2. een opgegeven werkelijke datum ná die statusdatum ⇒ geweigerd (een feit ligt nooit in de
 *     toekomst van de peildatum) — dus zonder statusdatum ook een datum ná vandaag;
 *  3. per saldo geen wijziging ⇒ no-op, beslist op de UITKOMST (zie `commitProgressEdit`);
 *  4. Z1: heeft de taak na de bewerking vastgelegde voortgang en was er geen statusdatum, dan gaat
 *     de statusdatum op vandaag. Blijft er geen voortgang over (0 %, datums gewist), dan rekent de
 *     bewerking zonder statusdatum, precies zoals voorheen — de statusdatum doet dan niets.
 */
export function planProgressEntry(task: Task, edit: ProgressEdit, ctx: ProgressEntryContext): ProgressEntryPlan {
  const statusDate = progressEntryStatusDate(ctx.statusDate, ctx.today);
  if (edit.field !== 'completion' && edit.value && statusDate && isActualPastStatusDate(edit.value, statusDate)) {
    return { ok: false, reason: 'afterStatusDate' };
  }
  const run = (date: string | undefined): Task => {
    const next: Task = { ...task, time: { ...task.time } };
    applyProgressEdit(next, edit, date);
    return next;
  };
  let next = run(statusDate);
  if (sameValue(task, next)) return { ok: true, change: null };
  const statusDateToday = !ctx.statusDate && ctx.today && hasRecordedProgress(next.time) ? ctx.today : undefined;
  if (!ctx.statusDate && !statusDateToday && statusDate) {
    // Geen voortgang over: zonder statusdatum rekenen, zoals het vangnet altijd deed.
    next = run(undefined);
    if (sameValue(task, next)) return { ok: true, change: null };
  }
  return { ok: true, change: statusDateToday ? { task: next, statusDateToday } : { task: next } };
}
