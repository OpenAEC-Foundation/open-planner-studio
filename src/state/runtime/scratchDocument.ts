// scratchDocument.ts — B1c-plan3 taak 5 (spec §5, "Toepassen: schrijven in meerdere documenten").
/**
 * Draai een bewerking op een SLAPENDE documentpayload in een eigen, headless storecontext.
 *
 * Waarom niet gewoon de payload spreaden zoals `recalculateStaleSleepingDocuments` doet: die route
 * omzeilt `beginUndoable` en moet `MAX_UNDO`-trimming en coalescing zelf naborgen. Hier draaien de
 * ECHTE acties op een echte context, dus het documentcontract, de undo-semantiek en de
 * transactie-runtime gelden vanzelf — en dat is precies wat "alles terugdraaien" (taak 6) nodig
 * heeft: een échte undo-stap op de eigen stack van dat document.
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
import { createAppStoreContext, type AppState, type AppStore } from '../appStore';
import { hydratePayload, capturePayload, type DocumentPayload } from '../documentContract';
import type { NotifyInput } from '../slices/types';

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
): ScratchRunResult<T> {
  const ctx = createAppStoreContext({ emitHostEvents: false });
  // 1. Hydrateren via het documentcontract — dezelfde functie die `switchDocument` gebruikt, dus
  //    élk (ook toekomstig) documentveld rijdt automatisch mee.
  ctx.store.setState((s) => { hydratePayload(s, payload); });
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
