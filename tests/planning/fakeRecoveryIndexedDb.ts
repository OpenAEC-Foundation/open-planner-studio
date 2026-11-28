export interface FakeRecoveryIdbHooks {
  onTransaction?(mode: string): void;
  onOpen?(database: string, version: number | undefined): void;
  onPut?(store: string, value: { id: string }, previous: unknown): void;
  onRead?(store: string, method: string, result: unknown): void;
}

export interface FakeRecoveryIdb {
  store(name: string, database?: string): Map<string, unknown>;
  databases: Map<string, { version: number; stores: Set<string> }>;
}

interface FakeRequest<T> {
  result: T;
  error: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

function request<T>(initial: T, compute: () => T, observe?: (result: T) => void): FakeRequest<T> {
  const req: FakeRequest<T> = { result: initial, error: null, onsuccess: null, onerror: null };
  queueMicrotask(() => {
    try { req.result = compute(); observe?.(req.result); }
    catch (error) { req.error = error; req.onerror?.(); return; }
    req.onsuccess?.();
  });
  return req;
}

export function installFakeRecoveryIndexedDb(hooks: FakeRecoveryIdbHooks = {}): FakeRecoveryIdb {
  const databases = new Map<string, { version: number; stores: Set<string> }>();
  const stores = new Map<string, Map<string, unknown>>();
  const indexes = new Map<string, Map<string, string>>();
  const store = (name: string, database = 'ops-recovery'): Map<string, unknown> => {
    const key = `${database}::${name}`;
    let map = stores.get(key);
    if (!map) { map = new Map(); stores.set(key, map); }
    return map;
  };
  const database = (dbName: string, version: number) => {
    const schema = databases.get(dbName) ?? { version, stores: new Set<string>() };
    const scoped = (name: string) => store(name, dbName);
    const fakeDb = {
      version: schema.version,
      objectStoreNames: { contains: (name: string) => schema.stores.has(name) },
      createObjectStore: (name: string) => { schema.stores.add(name); databases.set(dbName, schema); },
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
            indexNames: { contains: (indexName: string) => indexes.get(`${dbName}::${name}`)?.has(indexName) ?? false },
            createIndex: (indexName: string, keyPath: string) => {
              if (!indexes.has(`${dbName}::${name}`)) indexes.set(`${dbName}::${name}`, new Map());
              indexes.get(`${dbName}::${name}`)!.set(indexName, keyPath);
            },
            index: (indexName: string) => {
              const keyPath = indexes.get(`${dbName}::${name}`)?.get(indexName);
              if (!keyPath) throw new Error(`Ontbrekende testindex ${name}.${indexName}`);
              return { keyPath, unique: false, getAll: (query: unknown) => request<unknown[]>([], () => [...scoped(name).values()]
                .filter(value => value !== null && typeof value === 'object' && Reflect.get(value, keyPath) === query),
                result => hooks.onRead?.(name, `index:${indexName}.getAll`, result)) };
            },
            getAll: () => request<unknown[]>([], () => [...scoped(name).values()], (r) => hooks.onRead?.(name, 'getAll', r)),
            getAllKeys: () => request<string[]>([], () => [...scoped(name).keys()], (r) => hooks.onRead?.(name, 'getAllKeys', r)),
            get: (key: string) => request<unknown>(undefined, () => scoped(name).get(key), (r) => hooks.onRead?.(name, 'get', r)),
            put: (value: { id: string }) => {
              hooks.onPut?.(name, value, scoped(name).get(value.id));
              scoped(name).set(value.id, structuredClone(value));
              queueMicrotask(() => tx.oncomplete?.());
            },
            delete: (key: string) => {
              scoped(name).delete(key);
              queueMicrotask(() => tx.oncomplete?.());
            },
          }),
        };
        if (mode === 'readonly') queueMicrotask(() => queueMicrotask(() => tx.oncomplete?.()));
        return tx;
      },
    };
    return fakeDb;
  };
  (globalThis as unknown as { window: object }).window = (globalThis as unknown as { window?: object }).window ?? {};
  (globalThis as unknown as { indexedDB: unknown }).indexedDB = {
    databases: async () => [...databases].map(([name, schema]) => ({ name, version: schema.version })),
    open: (dbName: string, version?: number) => {
      hooks.onOpen?.(dbName, version);
      const fakeDb = database(dbName, version ?? 1);
      const req = {
        result: fakeDb,
        transaction: fakeDb.transaction([], 'versionchange'),
        error: null as unknown,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      let aborted = false;
      req.transaction.abort = () => { aborted = true; req.error = new Error('AbortError'); };
      queueMicrotask(() => {
        if (!databases.has(dbName)) req.onupgradeneeded?.();
        else if (version !== undefined) req.onupgradeneeded?.();
        if (aborted) req.onerror?.(); else req.onsuccess?.();
      });
      return req;
    },
  };
  return { store, databases };
}
