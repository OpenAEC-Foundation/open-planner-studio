/**
 * Bedrading voor "showcase-voorbeelden delen één demo-resourcebibliotheek" (issue #19, user-verzoek).
 * Gedeelde helper voor de twee aanroeppunten die een showcase-voorbeeld openen — Backstage
 * (`ExamplesSection.handleOpen`) en `HelpPanel` (`handleOpenExample`) — zodat de logica niet
 * dupliceert.
 *
 * Roep dit NA `openExampleFromString`/`applyLoadedProject` (het document moet al volledig geladen
 * en berekend zijn — `openExampleFromString` laadt bewust LOS, herkomststempels/binding zijn dus al
 * gestript). De helper koppelt alleen resources; `linkRecognizedItems` herleidt daarna zelf de
 * resourcebelasting en hoeft de planning niet opnieuw te draaien.
 *
 * Seedt de demo-pool idempotent, koppelt het net-geladen project eraan, en linkt automatisch elke
 * ONDUBBELZINNIGE naam-match (`computeRecognition`/`linkRecognizedItems`) — zonder het
 * afwijkingenscherm aan de gebruiker te tonen: dit is een demo, geen vraag.
 *
 * F2 (critreview, issue #19): UITSLUITEND resources worden zo gekoppeld — kalenders NIET, ook al
 * matcht `computeRecognition` ze net zo goed op naam. Grond: showcase-kalenders zijn bewust
 * gemodelleerd (bijv. "Construction calendar NL" met een eigen `hoursPerDay` en een specifieke
 * "Frost delay, foundations"-vakantie in "6 New Terraced Houses, De Akkers") en voeden de CPM-berekening
 * rechtstreeks — een stille naam-match zou die inhoud vervangen door de demo-kalenderversie en zo
 * het eigen punt van de showcase (en zijn CPM-uitkomst) ondermijnen. Resources hebben dat risico niet
 * (alleen belasting/overallocatie, geen CPM-invoer) en zijn juist de bedoelde demonstratie ("dezelfde
 * ploeg in twee projecten"). De demo-pool behoudt haar eigen kalenders (zichtbaar in de
 * Bibliotheekweergave); ze worden alleen niet automatisch aan showcase-kalenders gekoppeld.
 */
import { useAppStore } from './appStore';

export function applyDemoLibraryToShowcaseProject(): void {
  const store = useAppStore.getState();
  const companyId = store.seedDemoLibrary();
  store.bindProjectToCompany(companyId);
  const links = store.computeRecognition()
    .filter((c) => c.kind === 'resource' && c.suggestedPoolId !== null)
    .map((c) => ({ kind: c.kind, projectId: c.projectId, poolId: c.suggestedPoolId as string }));
  if (links.length > 0) store.linkRecognizedItems(links);
}
