import { useAppStore } from './appStore';
import { createSnapshot } from './snapshot';
import {
  enterBatch,
  exitBatch,
  isBatchActive,
  recordDocumentDataHistory,
  resetUndoCoalescing,
} from './transaction';

/**
 * Voer een reeks mutaties uit als ÉÉN ongedaan-maakbare stap (K-item 32).
 *
 * Het probleem. Elke mutator registreert normaal zijn eigen history-event. Een lus van n toevoegingen
 * kloont daardoor 1 + 2 + … + n taken — zuiver kwadratisch. Dat is geen theorie: `api.data.addTask`
 * is de enige manier waarop een extensie taken kan aanmaken, dus een importer die duizend taken
 * toevoegt betaalt duizend snapshots én laat duizend undo-stappen achter voor wat de gebruiker als
 * één handeling ziet. Historisch werd daarbij ook telkens een volledige snapshot gekloond.
 *
 * Deze functie neemt de snapshot één keer vooraf en onderdrukt die van de mutators. Kosten worden
 * lineair, en één bulk = één undo-stap.
 *
 * Bewust GEEN rollback bij een fout — dat is wat `runInMcpTransaction` doet, en dat vraagt om een
 * herintreedbaarheids-guard plus exact herstel van de sessiehistorie. Hier is de belofte smaller en
 * eerlijker: één undo-stap en lineaire kosten. Gooit `fn`, dan blijft wat er al gemuteerd is staan
 * en dekt de ene snapshot precies de begintoestand — de gebruiker kan het in één keer terugdraaien.
 *
 * Genest aanroepen is veilig: de binnenste doet niets extra's, want de buitenste begintoestand dekt de
 * hele reeks al. Vandaar een diepteteller in plaats van een vlag.
 */
export function withTransaction<T>(fn: () => T): T {
  if (isBatchActive()) return fn(); // genest: de buitenste transactie dekt dit al

  // Een bulk breekt een lopende coalescing-reeks af — anders zou de eerstvolgende toetsaanslag in
  // een datumveld op déze snapshot willen doorbouwen.
  resetUndoCoalescing();

  const base = useAppStore.getState();
  const before = createSnapshot(base);
  const documentId = base.activeDocumentId;

  enterBatch();
  let result!: T;
  let thrown: unknown;
  let didThrow = false;
  try {
    result = fn();
  } catch (error) {
    didThrow = true;
    thrown = error;
  } finally {
    // `finally`, zodat een throw in `fn` de suppressie niet laat hangen: elke volgende mutatie in
    // de app zou dan stilzwijgend geen undo-stap meer opleveren.
    exitBatch();
    useAppStore.setState((state) => {
      recordDocumentDataHistory(state, before, documentId, 'Bulkbewerking');
    });
  }
  if (didThrow) throw thrown;
  return result;
}
