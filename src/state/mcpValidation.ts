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
  applyProgressInvariants, isActualFinishBeforeStart, isActualPastStatusDate,
} from '@/engine/taskMutationRules';
import { clearLevelingGaps } from '@/utils/taskDefaults';
import { detectCycleInEdges } from '@/engine/scheduler/graphWalk';
import { isValidUnits } from '@/types/resource';

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
   * Cyclus-precheck (WP3): draait een DFS over de BESTAANDE relaties (`state.sequences`) plus de
   * VOORGESTELDE batch (`newSequences`, alleen `predecessor/successor` telt mee) en retourneert de
   * kring als taak-id-lijst bij detectie, anders `null`. PUUR — muteert niets. De transactie-rollback
   * (via `cpmResult.error` in de eind-runCPM) is het vangnet voor wat hier onverhoopt doorheen glipt;
   * deze pre-check maakt de fout goedkoop en de melding precies (noemt de betrokken taken).
   */
  noCycle(
    state: ReadableState,
    newSequences: { predecessorId: string; successorId: string }[],
  ): string[] | null {
    const edges: { predecessorId: string; successorId: string }[] = [
      ...state.sequences.map((s) => ({ predecessorId: s.predecessorId, successorId: s.successorId })),
      ...newSequences.map((s) => ({ predecessorId: s.predecessorId, successorId: s.successorId })),
    ];
    return detectCycleInEdges(edges);
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
    if (task.childIds.length > 0) return { ok: false, reason: `taak '${taskId}' is een verzameltaak (summary); wijs resources toe aan de bladtaken` };
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
   *   3. `completion > 0` zonder `actualStart` ⇒ `actualStart` afleiden (`earlyStart || scheduleStart`);
   *   4. `completion < 1` ⇒ een verouderd `actualFinish` wissen;
   *   5. een OPGEGEVEN `actualStart`/`actualFinish` ná de statusdatum ⇒ weigering (spiegel van het
   *      bestaande `accepted=false`-gedrag van de setters);
   *   6. `actualFinish` wissen op een 100%-taak reset óók `completion` (anders re-defaultt de invariant
   *      meteen een nieuw `actualFinish`);
   *   7. `actualFinish >= actualStart`-check;
   *   8. GEEN statusdatum maar wél actuals/voortgang ⇒ weigering met uitleg (MCP-specifieke guard:
   *      voortgang registreren vereist een projectstatusdatum);
   *   9. voortgang op een taak met kinderen (verzameltaak) ⇒ weigering;
   *  10. dán `applyProgressInvariants` (de invariant-functie alléén is een deelverzameling en zou een
   *      40%-taak als NOT_STARTED zonder gepinde `actualStart` achterlaten) en COMMIT naar de draft.
   */
  applyProgressUpdate(
    draftState: ReadableState,
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

    // (3) completion > 0 zonder actualStart ⇒ actualStart afleiden (MSP-conventie: % ⇒ gestart).
    if (time.completion > 0 && !time.actualStart) {
      time.actualStart = time.earlyStart || time.scheduleStart;
    }

    // (4) completion < 1 ⇒ een verouderd actualFinish wissen — maar ALLEEN wanneer completion
    //     expliciet in DEZE update meekomt (spiegelt setTaskProgress, waar deze clausule bij de
    //     NIEUW gezette completion hoort). Anders zou het zetten van alléén een actualFinish (op een
    //     taak die nog op 0% staat) die finish meteen weer wissen — terwijl een opgegeven finish juist
    //     completion=1 hoort af te dwingen via de invarianten.
    if (update.completion !== undefined && time.completion < 1) time.actualFinish = undefined;

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
        reason: `geen statusdatum ingesteld: voortgang/actuals kunnen niet worden geregistreerd zonder een projectstatusdatum (zet die eerst via update_project → statusDate)`,
      };
    }

    // (9) voortgang op een verzameltaak (heeft kinderen) ⇒ weigering.
    if (task.childIds.length > 0) {
      return { applied: false, reason: `taak '${taskId}' is een verzameltaak (heeft kinderen); voortgang wordt afgeleid uit de kinderen, niet direct gezet` };
    }

    // (10) invarianten + COMMIT naar de draft.
    applyProgressInvariants(scratch, statusDate);
    Object.assign(task.time, scratch.time);
    task.status = scratch.status;
    // B1c-plan-2 spec §4 "Invalidatie", vierde klasse (voortgang) — bedraad in de fixronde op
    // etappe 3, bevinding B7. Dit is het MCP-equivalent van `taskSlice`'s `setTaskProgress`/
    // `setActualStart`/`setActualFinish`: voortgang verzet de werkminuten-as waarop een
    // leveling-gat ligt, dus dat gat moet weg. Pas ná de commit (stap 10), zodat een geweigerd item
    // de draft ONGEMOEID laat — dezelfde regel als de rest van deze functie.
    clearLevelingGaps(task);
    return { applied: true };
  },
};
