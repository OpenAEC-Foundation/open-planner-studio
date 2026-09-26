// =================================================================================================
// MCP-bridge — validatielaag (taak T4, spec §Werkpakket 7 "Guards & validaties" + §Werkpakket 3
// "Relatie-validatie").
//
// Deze module levert PURE helpers (behalve `progress.applyProgressUpdate`, dat op een Immer-DRAFT
// werkt) die de tool-laag combineert met de draft-primitieven uit `mcpTransaction.ts` binnen een
// `runInMcpTransaction`. Ze muteren de LIVE store niet: `validate.*` leest alleen, en
// `progress.applyProgressUpdate` schrijft uitsluitend naar de meegegeven draft — en dan nog alleen
// bij `applied:true` (een geweigerd item laat de draft ONGEMOEID, zodat een zachte per-item-weigering
// binnen een bulk nooit een halve mutatie achterlaat; spec §"Stap-fouten vs item-weigeringen").
//
// ROLVERDELING t.o.v. de draft-primitieven: de drafts (T2/T3) GOOIEN op een structurele fout
// (onbekende parentId, kring via de eind-runCPM) — dat is de laatste vangrail die de hele transactie
// terugrolt. Deze validatielaag doet de RIJKERE, ZACHTE pre-checks vóór de mutatie, met per-item-
// rapportage: onbekende task-id's, cyclus-detectie in een voorgestelde batch, en de vijf assignment-/
// voortgangs-invarianten. De DUBBELE-TOEWIJZING-guard geeft de tool-laag een gerichte reden vóór de
// mutatie en bewaakt ook een meegroeiende bulk-simulatie. De store houdt dezelfde invariant als
// laatste vangrail vast, zodat geen andere aanroeper dubbeltelling in load of leveler kan invoeren.
// =================================================================================================

import type { AppState } from './appStore';
import type { Task } from '@/types/task';
import {
  applyProgressInvariants, fillMissingActualStart, isActualFinishBeforeStart, isActualPastStatusDate,
} from '@/engine/taskMutationRules';
import { captureProgressWork, settleProgressWork } from '@/engine/work/workRuleApply';
import { actualStartQuestionFor } from '@/engine/progressEntry';
import { clearLevelingGaps } from '@/utils/taskDefaults';
import { sameValue } from '@/utils/sameValue';
import { introducedCycle } from '@/engine/scheduler/relationRules';
import type { Sequence } from '@/types/sequence';
import { isValidUnits } from '@/types/resource';
import { isSummaryTask } from '@/utils/taskHierarchy';

/** Per-item-fout: het aangesproken id + een leesbare reden (voor de per-item-rapportage van de
 *  tool-laag). */
export interface ItemError {
  id: string;
  reason: string;
}

/** Uitkomst van een guard die niet aan een enkel id hangt (toestaan of weigeren-met-reden). */
export type GuardResult = { ok: true } | { ok: false; reason: string };

/** Uitkomst van één voortgangs-update (spec §Werkpakket 7 voortgangspad). Zacht per item: een
 *  geweigerd item rolt de transactie NIET terug — de tool-laag rapporteert het prominent. */
export type ProgressResult = { applied: true } | { applied: false; reason: string };

/** Minimale vorm die de validatiehelpers uit de (draft-)state lezen. `AppState` voldoet hieraan; een
 *  Immer-draft van `AppState` structureel ook. */
type ReadableState = Pick<AppState, 'tasks' | 'sequences' | 'assignments'>;
/** Wat `applyProgressUpdate` extra leest: slot (kalenders) en de regelcontext voor `captureProgressWork`. */
type ProgressState = ReadableState & Pick<AppState, 'calendars' | 'calendar' | 'project' | 'resources'>;

export const validate = {
  /**
   * Bestaat de taak? Retourneert `null` wanneer het id een bestaande taak aanwijst, anders een
   * `{ id, reason }`-fout (voor de per-item-rapportage). De store-drafts `updateTaskFields`/`deleteTask`
   * GOOIEN NIET op een onbekend id (stille no-op, spiegelt de store) — deze pre-check maakt het gat
   * zichtbaar per item vóórdat de tool-laag muteert.
   */
  taskExists(state: ReadableState, id: string): ItemError | null {
    return state.tasks.some((t) => t.id === id)
      ? null
      : { id, reason: `taak '${id}' bestaat niet` };
  },

  /**
   * Bulk-variant: rapporteert per ONBEKEND id een aparte `{ id, reason }`-fout (bestaande id's leveren
   * geen fout). Volgorde volgt de invoer; duplicaten in `ids` leveren duplicaat-fouten (de tool-laag
   * dedupt desgewenst). Bedoeld om vóór een `updateTasks`/`deleteTasks`-bulk te draaien.
   */
  tasksExist(state: ReadableState, ids: string[]): ItemError[] {
    const existing = new Set(state.tasks.map((t) => t.id));
    const errors: ItemError[] = [];
    for (const id of ids) {
      if (!existing.has(id)) errors.push({ id, reason: `taak '${id}' bestaat niet` });
    }
    return errors;
  },

  /**
   * Cyclus-precheck (WP3): toetst de BESTAANDE relaties (`state.sequences`) plus de VOORGESTELDE
   * batch (`newSequences`, alleen `predecessor/successor` telt mee) en retourneert de kring als
   * taak-id-lijst bij detectie, anders `null`. PUUR — muteert niets.
   *
   * Getoetst zoals de solver rekent en zoals de UI weigert (`introducedCycle`, dezelfde regel als
   * `relationAddVerdict` en het verhangen): over de bladgraaf na `expandSummaryRelations` — een
   * relatie naar een samenvattingstaak kan via een van haar subtaken rondlopen (audit taakmutaties,
   * S5) — en alleen een kring die de batch TOEVOEGT; een al bestaande kring noemt deze toets dus niet
   * als schuld van de batch. De transactie-rollback (via `cpmResult.error` in de eind-runCPM) blijft
   * het vangnet voor wat hier onverhoopt doorheen glipt, of voor een kring die er al was; deze
   * pre-check maakt de fout goedkoop en de melding precies (noemt de betrokken taken, begint bij de
   * nieuwe relatie).
   */
  noCycle(
    state: ReadableState,
    newSequences: { predecessorId: string; successorId: string }[],
  ): string[] | null {
    const proposed: Sequence[] = newSequences.map((s, index) => ({
      id: `__proposed-${index}`,
      predecessorId: s.predecessorId,
      successorId: s.successorId,
      type: 'FINISH_START', // type en lag doen voor een kring niet mee
      lagDays: 0,
    }));
    return introducedCycle(state, { tasks: state.tasks, sequences: [...state.sequences, ...proposed] });
  },

  /**
   * Assignment-invarianten (spec §Werkpakket 7): een toewijzing mag alleen op een BLAD-taak
   * (`childIds` leeg), niet op een mijlpaal of verzameltaak, met `units > 0`, en — de belangrijkste —
   * er mag nog GEEN toewijzing van DEZELFDE resource op DEZELFDE taak bestaan. Die laatste is de
   * dubbeltelling-guard: de tool-laag kan zo vóór de mutatie een bruikbare per-itemreden geven en
   * duplicaten binnen één gesimuleerde bulk herkennen. De store bewaakt dezelfde invariant opnieuw.
   */
  assignmentAllowed(state: ReadableState, taskId: string, resourceId: string, units: number): GuardResult {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, reason: `taak '${taskId}' bestaat niet` };
    if (task.isMilestone) return { ok: false, reason: `taak '${taskId}' is een mijlpaal; een mijlpaal draagt geen resources` };
    if (isSummaryTask(task)) return { ok: false, reason: `taak '${taskId}' is een verzameltaak (summary); wijs resources toe aan de bladtaken` };
    if (!isValidUnits(units)) return { ok: false, reason: `ongeldige eenheden/dag ${String(units)} (strikt positief vereist)` };
    if (state.assignments.some((a) => a.taskId === taskId && a.resourceId === resourceId)) {
      return { ok: false, reason: `resource '${resourceId}' is al toegewezen aan taak '${taskId}' (een tweede toewijzing zou de last dubbel tellen)` };
    }
    return { ok: true };
  },
};

export const progress = {
  /**
   * Het VOLLEDIGE voortgangspad uit spec §Werkpakket 7 (regel 60), in exact de voorgeschreven volgorde.
   * Past een voortgangs-update toe op een taak BINNEN de meegegeven Immer-draft — maar ALLEEN bij
   * `applied:true`; een geweigerd item laat de draft ongemoeid (zachte per-item-weigering). `statusDate`
   * wordt expliciet meegegeven (de tool-laag reikt `project.statusDate` aan), zodat de helper puur op
   * zijn argumenten werkt.
   *
   * Volgorde (elke `⇒ weigering` retourneert `{ applied:false, reason }` ZONDER de draft te muteren):
   *   1. range-validatie `completion` 0–100 — buiten bereik ⇒ weigering, GEEN klem (i.t.t. de
   *      store-`setTaskProgress`, die naar [0,1] klemt);
   *   2. conversie 0–100 ⇒ 0–1;
   *   3. `completion < 1` ⇒ een verouderd `actualFinish` wissen;
   *   4. `completion > 0` zonder `actualStart` ⇒ `actualStart` afleiden (`earlyStart || scheduleStart`,
   *      maar nooit ná het werkelijke einde — `fillMissingActualStart`, dezelfde regel als grid en store);
   *   5. een OPGEGEVEN `actualStart`/`actualFinish` ná de statusdatum ⇒ weigering (spiegel van het
   *      bestaande `accepted=false`-gedrag van de setters);
   *   6. `actualFinish` wissen op een 100%-taak reset óók `completion` (anders re-defaultt de invariant
   *      meteen een nieuw `actualFinish`);
   *   7. `actualFinish >= actualStart`-check;
   *   8. GEEN statusdatum maar wél actuals/voortgang ⇒ weigering met uitleg (MCP-specifieke guard:
   *      voortgang registreren vereist een projectstatusdatum). Besluit eigenaar: de AI-koppeling
   *      doet hier NIETS automatisch — anders dan de UI, die de statusdatum op vandaag zet (Z1,
   *      `engine/progressEntry.ts`); de reden zegt wat de AI moet doen;
   *   9. voortgang op een taak met kinderen (verzameltaak) ⇒ weigering;
   *  10. dán `applyProgressInvariants` (de invariant-functie alléén is een deelverzameling en zou een
   *      40%-taak als NOT_STARTED zonder gepinde `actualStart` achterlaten);
   *  11. Z1b (besluit eigenaar): zou de update de werkelijke start AFLEIDEN uit een geplande start ná
   *      de statusdatum (`actualStartQuestionFor`, hetzelfde criterium als de vraag in de UI) ⇒
   *      weigering met uitleg: de AI moet `actualStart` meegeven. Niets automatisch, zoals bij 8;
   *  12. COMMIT naar de draft.
   */
  applyProgressUpdate(
    draftState: ProgressState,
    taskId: string,
    update: { completion?: number; actualStart?: string; actualFinish?: string },
    statusDate: string | undefined,
  ): ProgressResult {
    const task = draftState.tasks.find((t) => t.id === taskId) as Task | undefined;
    if (!task) return { applied: false, reason: `taak '${taskId}' bestaat niet` };

    // Scratch: alle stappen werken op een KOPIE; commit gebeurt pas bij succes (stap 10).
    const time = { ...task.time };
    const scratch = { ...task, time, status: task.status } as Task;

    // (1) range-validatie completion 0–100 (GEEN klem).
    if (update.completion !== undefined) {
      if (!Number.isFinite(update.completion) || update.completion < 0 || update.completion > 100) {
        return { applied: false, reason: `completion ${update.completion} valt buiten het bereik 0–100` };
      }
      // (2) conversie 0–100 ⇒ 0–1.
      time.completion = update.completion / 100;
    }

    // Opgegeven actuals overnemen op de scratch (key aanwezig ⇒ zetten; expliciete undefined ⇒ wissen).
    if ('actualStart' in update) time.actualStart = update.actualStart || undefined;
    if ('actualFinish' in update) time.actualFinish = update.actualFinish || undefined;

    // (3) completion < 1 ⇒ een verouderd actualFinish wissen — maar ALLEEN wanneer completion
    //     expliciet in DEZE update meekomt (spiegelt setTaskProgress, waar deze clausule bij de
    //     NIEUW gezette completion hoort). Anders zou het zetten van alléén een actualFinish (op een
    //     taak die nog op 0% staat) die finish meteen weer wissen — terwijl een opgegeven finish juist
    //     completion=1 hoort af te dwingen via de invarianten.
    if (update.completion !== undefined && time.completion < 1) time.actualFinish = undefined;

    // (4) completion > 0 zonder actualStart ⇒ actualStart afleiden (MSP-conventie: % ⇒ gestart).
    //     Ná (3), zodat de klem het einde ziet dat overblijft: een afgeleide start valt nooit ná het
    //     (opgegeven of door de invarianten afgeleide) werkelijke einde. Een OPGEGEVEN actualStart
    //     staat er dan al en blijft ongemoeid — die toetst (7) gewoon.
    if (time.completion > 0) fillMissingActualStart(time, statusDate);

    // (5) OPGEGEVEN actual ná de statusdatum ⇒ weigering (spiegel van setActualStart/Finish accepted=false),
    //     met dezelfde vergelijking als store en grid: een date-only statusdatum laat de hele dag toe.
    if (statusDate) {
      if (update.actualStart && isActualPastStatusDate(update.actualStart, statusDate)) {
        return { applied: false, reason: `actualStart ${update.actualStart} ligt ná de statusdatum ${statusDate}` };
      }
      if (update.actualFinish && isActualPastStatusDate(update.actualFinish, statusDate)) {
        return { applied: false, reason: `actualFinish ${update.actualFinish} ligt ná de statusdatum ${statusDate}` };
      }
    }

    // (6) actualFinish wissen op een 100%-taak reset óók completion (alleen wanneer completion NIET
    //     expliciet in deze update meekomt — dan wint de opgegeven completion).
    if ('actualFinish' in update && !update.actualFinish && update.completion === undefined && time.completion >= 1) {
      time.completion = 0;
    }

    // (7) actualFinish >= actualStart (op instantprecisie, zoals het grid).
    if (isActualFinishBeforeStart(time)) {
      return { applied: false, reason: `actualFinish ${time.actualFinish} ligt vóór actualStart ${time.actualStart}` };
    }

    // (8) geen statusdatum maar wél actuals/voortgang ⇒ weigering met uitleg.
    const touchesProgress =
      update.completion !== undefined || 'actualStart' in update || 'actualFinish' in update;
    if (!statusDate && touchesProgress) {
      return {
        applied: false,
        reason: 'geen statusdatum ingesteld: voortgang/actuals worden gemeten tot de statusdatum en kunnen zonder '
          + 'niet worden geregistreerd. Zet eerst de statusdatum (de peildatum van deze voortgang) met '
          + 'planner_update_project → `statusDate` en herhaal dan deze update; de AI-koppeling kiest die datum '
          + 'niet zelf',
      };
    }

    // (9) voortgang op een verzameltaak (heeft kinderen) ⇒ weigering.
    if (isSummaryTask(task)) {
      return { applied: false, reason: `taak '${taskId}' is een verzameltaak (heeft kinderen); voortgang, status en werkelijke datums worden afgeleid uit de bladtaken eronder, niet direct gezet — zet de voortgang op die bladtaken` };
    }

    // (10) invarianten.
    applyProgressInvariants(scratch, statusDate);
    // (11) Z1b: geen verzonnen werkelijke start — de AI geeft hem zelf op.
    const question = actualStartQuestionFor(task, scratch, statusDate, {
      actualStart: !!update.actualStart,
      actualFinish: !!update.actualFinish,
    });
    if (question) {
      const planned = scratch.time.earlyStart || scratch.time.scheduleStart;
      return {
        applied: false,
        reason: `taak '${taskId}' heeft nog geen werkelijke start en stond gepland om pas ná de statusdatum `
          + `(${question.statusDate}) te beginnen (geplande start ${planned}): voortgang betekent dat hij al begonnen `
          + `is, maar wanneer weet alleen de gebruiker. Geef de werkelijke start mee in \`progress.actualStart\` `
          + `(uiterlijk ${question.latest}); de AI-koppeling leidt hem niet af`,
      };
    }
    // (12) COMMIT naar de draft.
    // Per saldo niets gewijzigd (bv. dezelfde completion nog eens) ⇒ niets committen en vooral de
    // nivelleergaten NIET wissen — dezelfde no-op-regel als taskSlice.ts's voortgangssetters
    // (`commitProgressEdit`). Het item is wél verwerkt: het staat al zoals gevraagd.
    if (sameValue(task, scratch)) return { applied: true };
    // Fable-critreview #170, bevinding 1: de voortgang verplaatst opgeslagen werk van rest naar
    // verricht — momentopname op de ONGEWIJZIGDE taak, settle ná de commit (zelfde als de store).
    // Integratie groep B (besluit 5): ná de no-op-check, zodat een no-op ook het werk niet raakt.
    const progressWork = captureProgressWork(task, draftState);
    Object.assign(task.time, scratch.time);
    task.status = scratch.status;
    settleProgressWork(task, draftState.assignments, progressWork);
    // B1c-plan-2 spec §4 "Invalidatie", vierde klasse (voortgang) — bedraad in de fixronde op
    // etappe 3, bevinding B7. Dit is het MCP-equivalent van `taskSlice`'s `setTaskProgress`/
    // `setActualStart`/`setActualFinish`: voortgang verzet de werkminuten-as waarop een
    // leveling-gat ligt, dus dat gat moet weg. Pas ná de commit (stap 10), zodat een geweigerd item
    // de draft ONGEMOEID laat — dezelfde regel als de rest van deze functie.
    clearLevelingGaps(task);
    return { applied: true };
  },
};
