import type { Task, TaskTime } from '@/types/task';
import { sameValue } from '@/utils/sameValue';
import {
  applyActualDateEdit, applyCompletionEdit, applyProgressInvariants, isActualFinishBeforeStart,
  isActualPastStatusDate,
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
 *  (`applyActualDateEdit`). `actualStart` (Z1b): de werkelijke start die de gebruiker op de vraag
 *  opgaf — vóór de bewerking gezet, zodat de afleiding hem als vastgelegd ziet en niets verzint. */
export function applyProgressEdit(
  task: Task,
  edit: ProgressEdit,
  statusDate: string | undefined,
  actualStart?: string,
): void {
  if (actualStart) task.time.actualStart = actualStart;
  if (edit.field === 'completion') {
    applyCompletionEdit(task.time, Math.max(0, Math.min(1, edit.value)), statusDate);
    applyProgressInvariants(task, statusDate);
  } else {
    applyActualDateEdit(task, edit.field, edit.value, statusDate);
  }
}

/**
 * Z1b (besluit eigenaar): de vraag naar de werkelijke start. Voortgang op een taak zonder
 * vastgelegde werkelijke start, waarvan de geplande start (de getoonde: `earlyStart`, anders
 * `scheduleStart` — dezelfde keuze als `fillMissingActualStart`) NA de statusdatum ligt, laat de app
 * NIET de werkelijke start verzinnen: ze vraagt ernaar vóór de voortgang wordt toegepast.
 */
export interface ActualStartQuestion {
  taskId: string;
  /** De statusdatum waartegen gevraagd wordt (bij Z1 net op vandaag gezet). */
  statusDate: string;
  /** De laatst mogelijke werkelijke start: het opgegeven werkelijke einde, anders de statusdatum.
   *  Ook het voorstel in het veld — de gebruiker bevestigt zelf. */
  latest: string;
}

/**
 * Stelt de bewerking `before` → `after` de vraag naar de werkelijke start (Z1b)? Het ene criterium
 * voor alle routes (paneel, contextmenu, raster, dialoog) en voor de weigering van de AI-koppeling
 * (`mcpValidation.ts`):
 *  - er is een statusdatum (bij UI-invoer zonder statusdatum: vandaag, Z1);
 *  - de taak had geen werkelijke start en deze bewerking geeft er ook geen op (`supplied.actualStart`);
 *  - na de bewerking heeft de taak er wél een — die is dus AFGELEID (% > 0, status gestart/voltooid,
 *    werkelijke/resterende duur, of een werkelijk einde zonder start);
 *  - de geplande start ligt na de statusdatum (dezelfde vergelijking als een werkelijke datum:
 *    `isActualPastStatusDate`, een datum zonder tijd telt de hele dag mee).
 * Uitzondering: een MIJLPAAL met een opgegeven werkelijke datum (zijn enige datumveld is het
 * werkelijke einde) — bij een mijlpaal zijn start en einde dezelfde datum, er valt niets te vragen.
 */
export function actualStartQuestionFor(
  before: Pick<Task, 'time'>,
  after: Pick<Task, 'id' | 'isMilestone' | 'time'>,
  statusDate: string | undefined,
  supplied: { actualStart?: boolean; actualFinish?: boolean },
): ActualStartQuestion | null {
  if (!statusDate || before.time.actualStart || supplied.actualStart || !after.time.actualStart) return null;
  if (after.isMilestone && supplied.actualFinish) return null;
  const planned = after.time.earlyStart || after.time.scheduleStart;
  if (!planned || !isActualPastStatusDate(planned, statusDate)) return null;
  const latest = supplied.actualFinish && after.time.actualFinish ? after.time.actualFinish : statusDate;
  return { taskId: after.id, statusDate, latest };
}

/** Een opgegeven werkelijke start (antwoord op Z1b) toetsen: nooit ná de statusdatum (§3.2) en nooit
 *  ná het werkelijke einde. `null` = in orde. Dezelfde vergelijkingen als de setters en het raster. */
export function actualStartAnswerIssue(
  answer: string,
  question: Pick<ActualStartQuestion, 'statusDate' | 'latest'>,
): 'afterStatusDate' | 'actualFinishBeforeStart' | null {
  if (isActualPastStatusDate(answer, question.statusDate)) return 'afterStatusDate';
  if (isActualFinishBeforeStart({ actualStart: answer, actualFinish: question.latest })) return 'actualFinishBeforeStart';
  return null;
}

export interface ProgressEntryContext {
  /** De statusdatum van het project zoals hij nu staat. */
  statusDate: string | undefined;
  /** UI-invoer: vandaag (`localTodayIso`). Afwezig = headless vangnet, zonder Z1/Z1b. */
  today?: string;
  /** Z1b: de werkelijke start die de gebruiker op de vraag opgaf. */
  actualStart?: string;
}

/** Waarom voortgang invullen geweigerd wordt, in de vorm die de UI toont of beantwoordt. */
export type ProgressEntryRefusal =
  /** Een opgegeven werkelijke datum ligt ná de (effectieve) statusdatum (§3.2). */
  | { ok: false; reason: 'afterStatusDate' }
  /** De opgegeven werkelijke start ligt ná het werkelijke einde. */
  | { ok: false; reason: 'actualFinishBeforeStart' }
  /** Z1b: eerst de werkelijke start vragen; er is niets veranderd. */
  | { ok: false; reason: 'needsActualStart'; question: ActualStartQuestion };

/** Uitkomst van voortgang invullen via de UI (`enterTaskProgress`, dialoog-concept): toegepast (of
 *  een no-op), of geweigerd met een reden die de UI toont of beantwoordt. */
export type ProgressEntryResult = { ok: true } | ProgressEntryRefusal;

/** Wat een voortgangsbewerking op één taak zou doen. */
export type ProgressEntryPlan =
  /** Per saldo niets gewijzigd: een no-op (geen undo-stap, geen `isDirty`, geen statusdatum). */
  | { ok: true; change: null }
  /** De taak zoals ze na de bewerking is; `statusDateToday` gezet ⇒ de statusdatum gaat in dezelfde
   *  stap op die datum (Z1). */
  | { ok: true; change: { task: Task; statusDateToday?: string } }
  | ProgressEntryRefusal;

/**
 * Plant één voortgangsbewerking op `task` zonder iets te muteren — de ene beslissing achter de
 * store-setters, de UI-invoer en de concepttaak in "Taak bewerken":
 *  1. de effectieve statusdatum (Z1: zonder statusdatum en vanuit de UI ⇒ vandaag);
 *  2. een opgegeven werkelijke datum (ook het antwoord op Z1b) ná die statusdatum ⇒ geweigerd: een
 *     feit ligt nooit in de toekomst van de peildatum — dus zonder statusdatum ook niet ná vandaag;
 *  3. per saldo geen wijziging ⇒ no-op, beslist op de UITKOMST (zie `commitProgressEdit`);
 *  4. het antwoord op Z1b ná het werkelijke einde ⇒ geweigerd (melden, niet raden);
 *  5. Z1b (alleen UI): zou de bewerking de werkelijke start afleiden uit een geplande start ná de
 *     statusdatum ⇒ eerst vragen, er verandert niets;
 *  6. Z1: heeft de taak na de bewerking vastgelegde voortgang en was er geen statusdatum, dan gaat
 *     de statusdatum op vandaag. Blijft er geen voortgang over (0 %, datums gewist), dan rekent de
 *     bewerking zonder statusdatum, precies zoals voorheen — de statusdatum doet dan niets.
 * Zonder `today` (headless vangnet) gelden alleen 2 en 3: de oude regels, onveranderd.
 */
export function planProgressEntry(task: Task, edit: ProgressEdit, ctx: ProgressEntryContext): ProgressEntryPlan {
  const statusDate = progressEntryStatusDate(ctx.statusDate, ctx.today);
  const answer = ctx.today ? ctx.actualStart : undefined;
  for (const date of [edit.field !== 'completion' ? edit.value : undefined, answer]) {
    if (date && statusDate && isActualPastStatusDate(date, statusDate)) return { ok: false, reason: 'afterStatusDate' };
  }
  const run = (date: string | undefined): Task => {
    const next: Task = { ...task, time: { ...task.time } };
    applyProgressEdit(next, edit, date, answer);
    return next;
  };
  let next = run(statusDate);
  if (sameValue(task, next)) return { ok: true, change: null };
  if (answer && isActualFinishBeforeStart(next.time)) return { ok: false, reason: 'actualFinishBeforeStart' };
  if (ctx.today) {
    const question = actualStartQuestionFor(task, next, statusDate, {
      actualStart: !!answer || (edit.field === 'actualStart' && !!edit.value),
      actualFinish: edit.field === 'actualFinish' && !!edit.value,
    });
    if (question) return { ok: false, reason: 'needsActualStart', question };
  }
  const statusDateToday = !ctx.statusDate && ctx.today && hasRecordedProgress(next.time) ? ctx.today : undefined;
  if (!ctx.statusDate && !statusDateToday && statusDate) {
    // Geen voortgang over: zonder statusdatum rekenen, zoals het vangnet altijd deed.
    next = run(undefined);
    if (sameValue(task, next)) return { ok: true, change: null };
  }
  return { ok: true, change: statusDateToday ? { task: next, statusDateToday } : { task: next } };
}
