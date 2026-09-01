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
 *  "toegepast"-strook, inclusief "alles terugdraaien" (`undoDistribution`). */
export interface DistributionApplyRecord {
  libraryItemId: string;
  /** ISO — puur voor de strooktekst. */
  appliedAt: string;
  docs: Array<{
    docId: string;
    title: string;
    /** `undoStack.length` NÁ het toepassen. "Alles terugdraaien" pakt alleen een document waarvan
     *  de stack nog op precies deze diepte staat — heeft de gebruiker er intussen zelf in gewerkt,
     *  dan zou blind terugpoppen de VERKEERDE stap ongedaan maken; dat document wordt dan
     *  overgeslagen (zie `DistributionUndoReport.skippedDocIds`). */
    undoDepthAfterApply: number;
  }>;
}

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
