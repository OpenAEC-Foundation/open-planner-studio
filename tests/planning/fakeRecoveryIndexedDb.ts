// Gedeelde headless IndexedDB-dubbel voor `recoveryStore` (web-backend). Eén bron i.p.v. zeven kopieën:
// sinds 2026-10-07 gebruikt crashherstel twee object-stores in één transactie (`records` voor snapshots
// en manifesten, `xer-archives` voor de content-adressed XER-archiefblobs), plus `getAllKeys` en `get`.
//
// Bewust minimaal en met dezelfde eigenaardigheid als de oude dubbels: `oncomplete` volgt in een
// microtask na de eerste put/delete. Alle writes van één ronde gebeuren synchroon in dezelfde callback,
// dus de inhoud is compleet vóór die microtask. Waarden worden met `structuredClone` opgeslagen, zoals
// een echte IndexedDB doet (een `Uint8Array` blijft een `Uint8Array`).

export interface FakeRecoveryIdbHooks {
  /** Per geopende transactie (`readonly` of `readwrite`). */
  onTransaction?(mode: string): void;
  /** Per put: de store, de nieuwe waarde en de vorige waarde onder dezelfde sleutel. */
  onPut?(store: string, value: { id: string }, previous: unknown): void;
  /** Per leesverzoek (`getAll`, `getAllKeys`, `get`): de store, de methode en wat er terugkomt. */
  onRead?(store: string, method: string, result: unknown): void;
}

export interface FakeRecoveryIdb {
  /** De records per object-store (wordt lui aangemaakt). */
  store(name: string): Map<string, unknown>;
}

interface FakeRequest<T> {
  result: T;
  error: null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

function request<T>(initial: T, compute: () => T, observe?: (result: T) => void): FakeRequest<T> {
  const req: FakeRequest<T> = { result: initial, error: null, onsuccess: null, onerror: null };
  queueMicrotask(() => { req.result = compute(); observe?.(req.result); req.onsuccess?.(); });
  return req;
}

export function installFakeRecoveryIndexedDb(hooks: FakeRecoveryIdbHooks = {}): FakeRecoveryIdb {
  const stores = new Map<string, Map<string, unknown>>();
  const store = (name: string): Map<string, unknown> => {
    let map = stores.get(name);
    if (!map) { map = new Map(); stores.set(name, map); }
    return map;
  };
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    close: () => undefined,
    onversionchange: null as (() => void) | null,
    transaction: (_stores: string | string[], mode: string) => {
      hooks.onTransaction?.(mode);
      const tx = {
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onabort: null as (() => void) | null,
        error: null,
        abort: () => tx.onabort?.(),
        objectStore: (name: string) => ({
          getAll: () => request<unknown[]>([], () => [...store(name).values()], (r) => hooks.onRead?.(name, 'getAll', r)),
          getAllKeys: () => request<string[]>([], () => [...store(name).keys()], (r) => hooks.onRead?.(name, 'getAllKeys', r)),
          get: (key: string) => request<unknown>(undefined, () => store(name).get(key), (r) => hooks.onRead?.(name, 'get', r)),
          put: (value: { id: string }) => {
            hooks.onPut?.(name, value, store(name).get(value.id));
            store(name).set(value.id, structuredClone(value));
            queueMicrotask(() => tx.oncomplete?.());
          },
          delete: (key: string) => {
            store(name).delete(key);
            queueMicrotask(() => tx.oncomplete?.());
          },
        }),
      };
      // Een readonly-transactie zonder writes: de echte IndexedDB voltooit hem ook.
      if (mode === 'readonly') queueMicrotask(() => queueMicrotask(() => tx.oncomplete?.()));
      return tx;
    },
  };
  (globalThis as unknown as { window: object }).window = (globalThis as unknown as { window?: object }).window ?? {};
  (globalThis as unknown as { indexedDB: unknown }).indexedDB = {
    open: () => {
      const req = {
        result: fakeDb,
        error: null,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      queueMicrotask(() => { req.onupgradeneeded?.(); req.onsuccess?.(); });
      return req;
    },
  };
  return { store };
}
