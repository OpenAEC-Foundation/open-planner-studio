import type { AppState, AppStore, AppStoreContext } from '../appStore';
import { hydratePayload, capturePayload, type DocumentPayload } from '../documentContract';
import type { StoreRuntimeOptions } from './storeRuntime';
import type { NotifyInput } from '../slices/types';

type AppStoreContextFactory = (opts?: StoreRuntimeOptions) => AppStoreContext;
let contextFactory: AppStoreContextFactory | null = null;

export function bindScratchDocumentContextFactory(factory: AppStoreContextFactory): void {
  contextFactory = factory;
}

export function createScratchDocumentContext(): AppStoreContext {
  if (!contextFactory) throw new Error('De scratch-documentcontextfabriek is nog niet gekoppeld');
  return contextFactory({ emitHostEvents: false });
}

export interface ScratchRunResult<T> {
  payload: DocumentPayload;
  result: T | undefined;
  notifications: NotifyInput[];
  ok: boolean;
  error?: string;
}

function harvestNotifications(store: AppStore): NotifyInput[] {
  const raw = store.getState().ui.notifications;
  const out: NotifyInput[] = raw.map((n) => ({
    severity: n.severity,
    messageKey: n.messageKey,
    params: n.params,
    numberParams: n.numberParams,
    detail: n.detail,
    dedupeKey: n.dedupeKey,
    helpArticleId: n.helpArticleId,
    ...(n.refusal ? { refusal: true } : {}),
  }));
  if (raw.length > 0) store.setState((s) => { s.ui.notifications = []; });
  return out;
}

export function runInScratchDocument<T>(
  payload: DocumentPayload,
  fn: (state: AppState) => T,
  docId?: string,
): ScratchRunResult<T> {
  const ctx = createScratchDocumentContext();
  ctx.store.setState((s) => {
    hydratePayload(s, payload);
    if (docId !== undefined) {
      s.documents = [{ id: docId, payload: null }];
      s.activeDocumentId = docId;
    }
  });
  let result: T | undefined;
  let ok = true;
  let error: string | undefined;
  try {
    result = fn(ctx.store.getState());
  } catch (e) {
    ok = false;
    error = String(e);
  }
  const notifications = harvestNotifications(ctx.store);
  return {
    payload: ok ? capturePayload(ctx.store.getState()) : payload,
    result,
    notifications,
    ok,
    error,
  };
}
