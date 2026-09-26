// Toepassen van een verdelingsvoorstel over meerdere documenten. Puur: geen store, geen I/O. Bepaalt
// WAT er per document geschreven moet worden, afgeleid uit een `DistributionProposal` — zodat de
// store-actie geen eigen interpretatie van `DistributionDocResult` heeft (en deze afleiding zelf los
// getest kan worden, zonder een store aan te raken).
import type { TaskSplitGap } from '@/types/task';
import type { DistributionProposal } from './distribute';

/** Wat er per document geschreven moet worden. */
export interface DistributionWrite {
  docId: string;
  scopeTaskIds: string[];
  write: { delays: Record<string, number>; gaps: Record<string, TaskSplitGap[]> };
}

/** `ok: false` ⇒ dit voorstel mag NIET geschreven worden: geblokkeerd, een tekort (geldige preview,
 *  maar blokkeert Toepassen) of niets te schrijven (alle deelnemers gepind/"datums zoals
 *  opgeslagen"/`cannotMove`, of niemand `participated`). */
export type DistributionWritePlan =
  | { ok: true; writes: DistributionWrite[] }
  | { ok: false; reason: 'blocked' | 'shortfall' | 'nothing-to-write' };

/** Wat `applyDistribution` teruggeeft ná een geslaagd Toepassen — de bouwstenen voor de
 *  "toegepast"-strook, inclusief "alles terugdraaien" (`undoDistribution`).
 *
 *  Per document wordt het history-EVENT bewaard, geen stapeldiepte: undo/redo is één app-globale
 *  sessiechronologie (`state.historyEvents`), waarin een bewerking op een ANDER document ook events
 *  oplevert en `pruneSessionHistory` van onderaf trimt — een diepte is dus geen identiteit. */
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
 * Wat `librarySlice.applyDistribution` teruggeeft. De reden bij `ok: false` hoort bij het contract,
 * zodat de aanroeper hem als melding kan tonen.
 *
 * De eerste drie redenen komen rechtstreeks uit `DistributionWritePlan`; `'scratch-failed'` is de
 * schrijfronde zelf: de bewerking van een SLAPEND document liep vast, vóór de eerste echte write:
 *  - `fn` gooide in de scratch-context (`ScratchRunResult.ok === false`), of
 *  - de aansluitende `runCPM` in die context leverde een `cpmResult.error` (meestal een
 *    relatiecyclus). Anders kreeg dat document wél de nivelleervertraging maar niet de bijbehorende
 *    datums — precies de halve staat die de twee-fasenopzet moet uitsluiten.
 * `docId` benoemt dan het document dat vastliep; `error` draagt de rauwe technische tekst
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
 * Regels:
 *  - `proposal.blocked !== null` ⇒ geblokkeerd (nooit een stille uitsluiting, dus ook nooit een
 *    gedeeltelijk Toepassen van een geblokkeerd voorstel).
 *  - `proposal.hasShortfall` ⇒ een tekort blokkeert Toepassen — het voorstel blijft een
 *    geldige PREVIEW, maar schrijven zou taken onopgelost achterlaten zonder dat de gebruiker dat op
 *    dat moment nog kan corrigeren.
 *  - Alleen documenten met `participated === true && cannotMove === false` leveren een write:
 *    gepinde, "datums zoals opgeslagen"- en `cannotMove`-documenten worden NOOIT beschreven — hun
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
