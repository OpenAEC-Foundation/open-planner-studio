// applyDistribution.ts — B1c-plan3 taak 6 (spec §5, "Toepassen: schrijven in meerdere documenten").
// Puur: geen store, geen I/O. Bepaalt WAT er per document geschreven moet worden, afgeleid uit een
// `DistributionProposal` — zodat de store-actie geen eigen interpretatie van `DistributionDocResult`
// heeft (en deze afleiding zelf los getest kan worden, zonder een store aan te raken).
import type { TaskSplitGap } from '@/types/task';
import type { DistributionProposal } from './distribute';

/** Wat er per document geschreven moet worden. */
export interface DistributionWrite {
  docId: string;
  scopeTaskIds: string[];
  write: { delays: Record<string, number>; gaps: Record<string, TaskSplitGap[]> };
}

/** `ok: false` ⇒ dit voorstel mag NIET geschreven worden, met de reden erbij. Spec §3.1 (geblokkeerd),
 *  §4 stap 3 (een voorstel mét tekorten is een geldige preview maar blokkeert Toepassen) en het
 *  triviale geval dat er — na de twee poorten hierboven — simpelweg niets te schrijven valt (alle
 *  deelnemers gepind/#63/`cannotMove`, of niemand `participated`). */
export type DistributionWritePlan =
  | { ok: true; writes: DistributionWrite[] }
  | { ok: false; reason: 'blocked' | 'shortfall' | 'nothing-to-write' };

/** Wat `applyDistribution` teruggeeft ná een geslaagd Toepassen — de bouwstenen voor de
 *  "toegepast"-strook, inclusief "alles terugdraaien" (`undoDistribution`).
 *
 *  AANGEPAST NA MERGE MET MAIN (sessiehistorie, 2026-09-04). De eerste opzet bewaarde per document
 *  `undoDepthAfterApply` — de diepte van de toenmalige per-document `undoStack`. Dat model bestaat
 *  niet meer: undo/redo is één app-globale sessiechronologie (`state.historyEvents`), waarin een
 *  bewerking op een ANDER document ook nieuwe events oplevert en `pruneSessionHistory` van onderaf
 *  trimt. Een diepte is daarmee geen identiteit meer. We bewaren nu het EVENT zelf. */
export interface DistributionApplyRecord {
  libraryItemId: string;
  /** ISO — puur voor de strooktekst. */
  appliedAt: string;
  docs: Array<{
    docId: string;
    title: string;
    /** Het `SessionHistoryEvent` dat het toepassen voor DIT document heeft achtergelaten.
     *  "Alles terugdraaien" draait alleen een document terug waarvan dit event er nog is, nog op
     *  `applied` staat, én nog het event is dat een gewone Ctrl+Z voor dat document zou kiezen —
     *  anders heeft de gebruiker er intussen zelf in gewerkt en zou terugdraaien de VERKEERDE stap
     *  ongedaan maken (zie `DistributionUndoReport.skippedDocIds`). */
    historyEventId: string;
    /** De `sequence` van datzelfde event; puur diagnostisch/voor sorteren, de identiteit is `id`. */
    historySequence: number;
  }>;
}

/**
 * Wat `librarySlice.applyDistribution` teruggeeft (fixronde B1c-etappe-3, bevinding B5).
 *
 * Was: `DistributionApplyRecord | null`. Een `null` betekende zes verschillende dingen tegelijk
 * (geblokkeerd, tekort, niets te schrijven, een tussentijds gesloten document, een gegooide
 * scratch-run, een document met een onberekenbare planning) en de dialoog kon er dus niets zinnigs
 * over zeggen — de knop deed geruisloos niets. De discriminated union hieronder maakt de reden
 * onderdeel van het contract, zodat de aanroeper hem als melding kan tonen.
 *
 * De eerste drie redenen komen rechtstreeks uit `DistributionWritePlan` (de poorten hierboven);
 * `'scratch-failed'` is de schrijfronde zelf: de bewerking van een SLAPEND document liep vast. Dat
 * is één van twee dingen, allebei blokkerend en allebei vóór de eerste echte write:
 *  - `fn` gooide in de scratch-context (`ScratchRunResult.ok === false`), of
 *  - de aansluitende `runCPM` in die context leverde een `cpmResult.error` (een relatiecyclus is het
 *    normale geval). BESLIST in deze fixronde: dát telt óók als mislukking. Een gooiende actie is
 *    niet de enige manier om te falen — een document waarvan de planning niet te berekenen is, zou
 *    anders de nivelleervertraging wél geschreven krijgen maar de bijbehorende datums niet, en
 *    precies die halve staat is wat de fase-1/fase-2-opzet moet uitsluiten.
 * `docId` benoemt in dat geval het document dat vastliep; `error` draagt de rauwe technische tekst
 * (cyclusmelding of exception) voor het `detail`-veld van de melding.
 */
export type DistributionApplyResult =
  | { ok: true; record: DistributionApplyRecord }
  | {
      ok: false;
      reason: 'blocked' | 'shortfall' | 'nothing-to-write' | 'scratch-failed';
      docId?: string;
      error?: string;
    };

/** Resultaat van `undoDistribution`: welke documenten daadwerkelijk zijn teruggedraaid en welke zijn
 *  overgeslagen omdat hun undo-stack intussen is verschoven. */
export interface DistributionUndoReport {
  undoneDocIds: string[];
  skippedDocIds: string[];
}

/**
 * Leid uit een voorstel af WAT er geschreven moet worden, per deelnemend document.
 *
 * Regels (letterlijk uit spec §3.1/§4 stap 3/§3.3a/§6):
 *  - `proposal.blocked !== null` ⇒ geblokkeerd (§3.1: nooit een stille uitsluiting, dus ook nooit
 *    een gedeeltelijk Toepassen van een geblokkeerd voorstel).
 *  - `proposal.hasShortfall` ⇒ een tekort blokkeert Toepassen (§4 stap 3) — het voorstel blijft een
 *    geldige PREVIEW, maar schrijven zou taken onopgelost achterlaten zonder dat de gebruiker dat op
 *    dat moment nog kan corrigeren.
 *  - Alleen documenten met `participated === true && cannotMove === false` leveren een write:
 *    gepinde, #63- en `cannotMove`-documenten worden per definitie NOOIT beschreven (§3.3a/§6) — hun
 *    `delays`/`gaps` in het voorstel zijn toch al leeg, maar deze poort maakt dat een invariant in
 *    plaats van toeval.
 *  - Blijft er na die twee poorten niets over om te schrijven, dan is Toepassen zinloos maar niet
 *    fout: `'nothing-to-write'`.
 */
export function planDistributionWrites(
  proposal: DistributionProposal,
  scopeTaskIdsByDoc: Record<string, string[]>,
): DistributionWritePlan {
  if (proposal.blocked !== null) return { ok: false, reason: 'blocked' };
  if (proposal.hasShortfall) return { ok: false, reason: 'shortfall' };

  const writes: DistributionWrite[] = [];
  for (const doc of proposal.docs) {
    if (!doc.participated || doc.cannotMove) continue;
    writes.push({
      docId: doc.docId,
      scopeTaskIds: scopeTaskIdsByDoc[doc.docId] ?? [],
      write: { delays: doc.delays, gaps: doc.gaps },
    });
  }
  if (writes.length === 0) return { ok: false, reason: 'nothing-to-write' };
  return { ok: true, writes };
}
