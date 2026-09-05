// scratchDocument.ts — B1c-plan3 taak 5 (spec §5, "Toepassen: schrijven in meerdere documenten").
/**
 * Draai een bewerking op een SLAPENDE documentpayload in een eigen, headless storecontext.
 *
 * Waarom niet gewoon de payload spreaden zoals `recalculateStaleSleepingDocuments` doet: die route
 * doet de bewerking na in plaats van hem uit te voeren. Hier draait de ECHTE actie op een echte
 * context — `applyLeveling` met zijn M10-strip, `finishMutation({ stale: true })`, de aansluitende
 * `runCPM` en de meldingen die daaruit komen — dus het documentcontract en de transactie-runtime
 * gelden vanzelf, en de uitkomst is per constructie dezelfde als wanneer de gebruiker het document
 * eerst had geactiveerd.
 *
 * WAT DEZE CONTEXT NIET LEVERT (aangepast na de merge met main — sessiehistorie, 2026-09-04). In de
 * eerste opzet was de undo-stap zélf de opbrengst: undo/redo was toen een `undoStack` PER document,
 * dus de scratch-context liet de terug-te-draaien stap gewoon in de payload achter. Undo/redo is nu
 * één app-globale sessiechronologie (`AppState.historyEvents`), en die van een scratch-context wordt
 * met de context weggegooid. De aanroeper registreert het history-event daarom zelf in de ECHTE
 * store — zie `librarySlice`'s `applyDistribution`, dat de payload van vóór en ná deze run met
 * `snapshotOfPayload` tot één `document-data`-delta maakt. Deze functie levert dus uitsluitend de
 * nieuwe payload en de meldingen; de historie is de verantwoordelijkheid van de aanroeper.
 *
 * Twee singleton-randen staan dicht (spec §5):
 *  (a) host-events — de context wordt met `emitHostEvents: false` gebouwd, zodat extensies geen
 *      cijfers krijgen van een document waar de gebruiker niet naar kijkt;
 *  (b) meldingen — `ui.notifications` van deze context rendert niemand. Ze worden na afloop
 *      LEEGGEHAALD en aan de aanroeper teruggegeven, zodat een fout (cyclus, lege kalender) als
 *      blokkerende reden zichtbaar wordt in plaats van geruisloos te verdwijnen.
 *
 * De context is puur lokaal: hij wordt niet bewaard, niet geregistreerd en niet hergebruikt. App-
 * globale registers (extensie-instanties, MCP, bibliotheek-persistentie) worden niet aangeraakt —
 * die leven buiten de Zustand-factory.
 */
import type { AppState, AppStore, AppStoreContext } from '../appStore';
import { hydratePayload, capturePayload, type DocumentPayload } from '../documentContract';
import type { StoreRuntimeOptions } from './storeRuntime';
import type { NotifyInput } from '../slices/types';

/**
 * De contextfabriek wordt LAAT gekoppeld in plaats van rechtstreeks geïmporteerd — zelfde patroon
 * als `bindDefaultGridTransactionStore` (`state/gridTransaction.ts`), en om dezelfde reden.
 * `appStore.ts` importeert `librarySlice`, die deze module importeert; een gewone waarde-import van
 * `createAppStoreContext` hier maakt daar een echte importcyclus van
 * (`appStore → librarySlice → scratchDocument → appStore`), en `npm run verify:cycles` vangt die —
 * terecht: zo'n cyclus werkt alleen zolang de betrokken bindingen gehoist zijn. Typen mogen wél
 * rechtstreeks: `import type` wordt geërase en telt niet mee in de importgraaf.
 */
type AppStoreContextFactory = (opts?: StoreRuntimeOptions) => AppStoreContext;
let contextFactory: AppStoreContextFactory | null = null;

/** Koppel de echte fabriek. Wordt één keer aangeroepen vanuit `appStore.ts`, naast
 *  `bindDefaultGridTransactionStore`. */
export function bindScratchDocumentContextFactory(factory: AppStoreContextFactory): void {
  contextFactory = factory;
}

export interface ScratchRunResult<T> {
  /** De payload ná de bewerking — klaar om in `documents[i].payload` gezet te worden. Bij een
   *  mislukking (`ok: false`) is dit de ONGEWIJZIGDE invoerpayload. */
  payload: DocumentPayload;
  result: T | undefined;
  /** Wat de scratch-context in zijn onzichtbare meldingenkanaal zou hebben gezet — vorm van
   *  `NotifyInput` (zonder `id`/`count`) zodat de aanroeper ze rechtstreeks aan een echte `notify()`
   *  kan doorgeven. */
  notifications: NotifyInput[];
  /** `false` wanneer `fn` een exception gooide. */
  ok: boolean;
  error?: string;
}

/** Lees en leeg `ui.notifications` van de scratch-context, in `NotifyInput`-vorm (rand (b) hierboven:
 *  niemand rendert dit kanaal, dus de inhoud gaat terug naar de aanroeper in plaats van te verdwijnen). */
function harvestNotifications(store: AppStore): NotifyInput[] {
  const raw = store.getState().ui.notifications;
  const out: NotifyInput[] = raw.map((n) => ({
    severity: n.severity,
    messageKey: n.messageKey,
    params: n.params,
    detail: n.detail,
    dedupeKey: n.dedupeKey,
    helpArticleId: n.helpArticleId,
  }));
  if (raw.length > 0) store.setState((s) => { s.ui.notifications = []; });
  return out;
}

export function runInScratchDocument<T>(
  payload: DocumentPayload,
  fn: (state: AppState) => T,
  docId?: string,
): ScratchRunResult<T> {
  if (!contextFactory) throw new Error('De scratch-documentcontextfabriek is nog niet gekoppeld');
  const ctx = contextFactory({ emitHostEvents: false });
  // 1. Hydrateren via het documentcontract — dezelfde functie die `switchDocument` gebruikt, dus
  //    élk (ook toekomstig) documentveld rijdt automatisch mee.
  //
  //    `docId` is de DERDE singleton-rand (naast host-events en meldingen): het document-id is geen
  //    documentVELD (het staat niet in `DOCUMENT_FIELDS`, het is registry-state), dus zonder deze
  //    stap draait de bewerking onder het VERSE id van de scratch-context. Twee dingen gaan daar mis:
  //    (a) sessie-permanente, app-globale registraties die op docId sleutelen — de M10-gate in
  //    `state/timephasedLossNotice.ts` — zouden op een fantoom-id landen (en, tot de per-context-fix
  //    in `documentSlice`, zelfs op het id van het ECHTE eerste document); (b) een melding die de
  //    aanroeper doorgeeft aan de gebruiker zou over een ander document gaan dan het document dat
  //    werkelijk beschreven is. Meegeven van het echte id maakt de scratch-run per constructie
  //    dezelfde bewerking als wanneer de gebruiker dat document eerst had geactiveerd.
  ctx.store.setState((s) => {
    hydratePayload(s, payload);
    if (docId !== undefined) {
      s.documents = [{ id: docId, payload: null }];
      s.activeDocumentId = docId;
    }
  });
  // 2. De ECHTE acties draaien. `fn` krijgt de state (met alle acties erop) en mag alles doen wat een
  //    gewone gebruiker zou doen — inclusief `applyLeveling`, dat zelf zijn snapshot pusht en
  //    `runCPM` draait.
  let result: T | undefined;
  let ok = true;
  let error: string | undefined;
  try {
    result = fn(ctx.store.getState());
  } catch (e) {
    ok = false;
    error = String(e);
  }
  // 3. Meldingen oogsten en het kanaal legen (rand (b)).
  const notifications = harvestNotifications(ctx.store);
  // 4. Terug capturen. Bij een mislukking geven we de ONGEWIJZIGDE invoerpayload terug: net als
  //    `recalculateStaleSleepingDocuments` mag een halve mutatie nooit terug de registry in.
  return {
    payload: ok ? capturePayload(ctx.store.getState()) : payload,
    result,
    notifications,
    ok,
    error,
  };
}
