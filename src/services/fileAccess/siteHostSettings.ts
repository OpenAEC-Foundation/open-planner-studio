import { siteHostSettings, type SiteHostSettings } from './siteHostPreferences';
import { HOST_PERSISTED_KEYS, isHostPersistedKey } from './siteHostSettingKeys';

export { isHostPersistedKey };

export const HYDRATE_TIMEOUT_MS = 5000;

export const FLUSH_DELAY_MS = 400;

export const RETRY_DELAY_MS = 30_000;

export const MAX_RETRIES = 10;

export type SettingWriteOrigin = 'user' | 'start';

export interface SettingsStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SettingChange {
  key: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface HostSettingsSyncDeps {
  storage(): SettingsStorageLike | null;
  host(): SiteHostSettings | null;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  warn(message: string, error?: unknown): void;
  keys?: readonly string[];
  changed?(changes: readonly SettingChange[]): void;
}

export type HydrateOutcome = 'geen-host' | 'geladen' | 'time-out' | 'fout' | 'al-geladen';

export interface LateSettingsApplied {
  changed: readonly string[];
  touched: readonly string[];
  refresh: readonly string[];
  reverted: boolean;
}

export type HostSettingsEvent = 'vertraagd' | 'toegepast' | 'uit';

export interface HostSettingsSync {
  hydrate(timeoutMs?: number): Promise<HydrateOutcome>;
  adoptLateHost(timeoutMs?: number): void;
  noteChanged(key: string, origin?: SettingWriteOrigin): void;
  flush(): Promise<void>;
  delayed(): boolean;
  takeApplied(): LateSettingsApplied | null;
  writeHeld(key: string): boolean;
  settle(keys: Iterable<string>): void;
  release(): void;
  subscribe(listener: (event: HostSettingsEvent) => void): () => void;
  unavailable(): boolean;
}

const heldWrites = new Set<ReadonlySet<string>>();

export function createHostSettingsSync(deps: HostSettingsSyncDeps): HostSettingsSync {
  const keys = [...(deps.keys ?? HOST_PERSISTED_KEYS)].sort();
  const persisted = new Set(keys);
  let phase: 'idle' | 'reading' | 'applying' | 'synced' | 'off' = 'idle';
  const held = new Set<string>();
  let offLocally = false;
  let activeHost: SiteHostSettings | null = null;
  const hostValues = new Map<string, string | null>();
  const dirty = new Set<string>();
  let baseline: Map<string, string | null> | null = null;
  const touched = new Set<string>();
  const listeners = new Set<(event: HostSettingsEvent) => void>();
  let isDelayed = false;
  let inFlight = false;
  let retries = 0;
  let flushTimer: unknown = null;
  let delayTimer: unknown = null;
  let retryTimer: unknown = null;
  let pendingApplied: LateSettingsApplied | null = null;
  let settleStart: ((outcome: HydrateOutcome) => void) | null = null;
  let chain: Promise<void> = Promise.resolve();

  const emit = (event: HostSettingsEvent) => {
    for (const listener of [...listeners]) {
      try { listener(event); } catch (error) { deps.warn('Luisteraar van de instellingen faalde', error); }
    }
  };

  const clear = (handle: unknown) => { if (handle !== null) deps.clearTimer(handle); };

  const finishStart = (outcome: HydrateOutcome) => {
    const resolve = settleStart;
    settleStart = null;
    resolve?.(outcome);
  };

  const unhold = () => {
    held.clear();
    heldWrites.delete(held);
  };

  const stop = (locally: boolean, message: string, error?: unknown) => {
    phase = 'off';
    offLocally = locally;
    unhold();
    dirty.clear();
    touched.clear();
    clear(flushTimer); flushTimer = null;
    clear(delayTimer); delayTimer = null;
    clear(retryTimer); retryTimer = null;
    deps.warn(message, error);
    finishStart('fout');
    emit('uit');
  };

  const schedule = () => {
    clear(flushTimer);
    flushTimer = deps.setTimer(() => { flushTimer = null; void flush(); }, FLUSH_DELAY_MS);
  };

  const snapshotLocal = (): Map<string, string | null> => {
    const map = new Map<string, string | null>();
    const storage = deps.storage();
    for (const key of keys) {
      let value: string | null = null;
      try { value = storage ? storage.getItem(key) : null; } catch { }
      map.set(key, value);
    }
    return map;
  };

  const toValues = (results: readonly PromiseSettledResult<unknown>[]): Map<string, string | null> => {
    const map = new Map<string, string | null>();
    keys.forEach((key, i) => {
      const result = results[i];
      if (result.status === 'rejected') throw result.reason;
      const value = result.value;
      if (value === null || value === undefined) map.set(key, null);
      else if (typeof value === 'string') map.set(key, value);
      else throw new Error(`ongeldige waarde voor ${key} (${typeof value})`);
    });
    return map;
  };

  const markDirty = (storage: SettingsStorageLike) => {
    dirty.clear();
    for (const key of keys) if (storage.getItem(key) !== (hostValues.get(key) ?? null)) dirty.add(key);
  };

  const apply = (host: SiteHostSettings, values: Map<string, string | null>, late: boolean): LateSettingsApplied | null => {
    const storage = deps.storage();
    if (!storage) {
      stop(true, 'Geen lokale opslag; de instellingen worden deze sessie niet bij de host bewaard');
      return null;
    }
    const changes: SettingChange[] = [];
    let reverted = false;
    try {
      for (const key of keys) {
        const answer = values.get(key) ?? null;
        let target: string | null;
        if (answer !== null) target = answer;
        else if (touched.has(key)) target = baseline?.get(key) ?? null;
        else continue;
        const current = storage.getItem(key);
        if (current === target) continue;
        if (target === null) storage.removeItem(key);
        else storage.setItem(key, target);
        changes.push({ key, oldValue: current, newValue: target });
        if (touched.has(key)) reverted = true;
      }
      hostValues.clear();
      for (const [key, value] of values) hostValues.set(key, value);
      if (!late) markDirty(storage);
    } catch (error) {
      stop(true, 'Instellingen van de host niet neergezet; ze worden deze sessie niet bij de host bewaard', error);
      return null;
    }
    const changed = changes.map(change => change.key);
    const touchedKeys = [...touched].sort();
    const refresh = [...new Set([...changed, ...touchedKeys])].sort();
    touched.clear();
    activeHost = host;
    isDelayed = false;
    if (late) {
      phase = 'applying';
      for (const key of refresh) held.add(key);
      heldWrites.add(held);
    } else {
      phase = 'synced';
      if (dirty.size > 0) schedule();
    }
    if (changes.length > 0) {
      try { deps.changed?.(changes); } catch (error) { deps.warn('Verversen na de instellingen van de host mislukt', error); }
    }
    return { changed, touched: touchedKeys, refresh, reverted };
  };

  const settle = (settled: Iterable<string>) => {
    if (phase !== 'applying') return;
    for (const key of settled) held.delete(key);
  };

  const release = () => {
    if (phase !== 'applying') return;
    unhold();
    const storage = deps.storage();
    if (!storage) {
      stop(true, 'Geen lokale opslag; de instellingen worden deze sessie niet bij de host bewaard');
      return;
    }
    try {
      markDirty(storage);
    } catch (error) {
      stop(true, 'Instelling niet terug te lezen; de instellingen worden deze sessie niet bij de host bewaard', error);
      return;
    }
    phase = 'synced';
    if (dirty.size > 0) schedule();
  };

  const markDelayed = (outcome: 'time-out' | 'fout') => {
    clear(delayTimer); delayTimer = null;
    finishStart(outcome);
    if (isDelayed) return;
    isDelayed = true;
    emit('vertraagd');
  };

  const onAnswer = (host: SiteHostSettings, values: Map<string, string | null>) => {
    if (phase !== 'reading') return;
    clear(delayTimer); delayTimer = null;
    clear(retryTimer); retryTimer = null;
    const late = settleStart === null;
    const applied = apply(host, values, late);
    if (!applied) return;
    if (late) {
      pendingApplied = applied;
      emit('toegepast');
    }
    finishStart('geladen');
  };

  const onFailure = (error: unknown) => {
    if (phase !== 'reading') return;
    if (retries >= MAX_RETRIES) {
      stop(false, 'Instellingen van de host niet gelezen, ook niet na herhalen; ze worden deze sessie niet bij de host bewaard', error);
      return;
    }
    deps.warn('Instellingen van de host niet gelezen; de tool probeert het later opnieuw', error);
    markDelayed('fout');
    retries++;
    retryTimer = deps.setTimer(() => { retryTimer = null; attempt(); }, RETRY_DELAY_MS);
  };

  const attempt = () => {
    const host = activeHost;
    if (phase !== 'reading' || inFlight || !host) return;
    inFlight = true;
    const requests = keys.map(key => Promise.resolve().then(() => host.get(key)));
    for (const request of requests) {
      request.catch(() => { if (phase === 'reading') markDelayed('fout'); });
    }
    void Promise.allSettled(requests).then(results => {
      inFlight = false;
      let values: Map<string, string | null>;
      try {
        values = toValues(results);
      } catch (error) {
        onFailure(error);
        return;
      }
      onAnswer(host, values);
    });
  };

  const begin = (host: SiteHostSettings, timeoutMs: number) => {
    phase = 'reading';
    activeHost = host;
    delayTimer = deps.setTimer(() => {
      delayTimer = null;
      if (phase !== 'reading') return;
      deps.warn('De host antwoordde niet op tijd; de tool wacht op de achtergrond verder');
      markDelayed('time-out');
    }, timeoutMs);
    attempt();
  };

  const flush = (): Promise<void> => {
    clear(flushTimer); flushTimer = null;
    chain = chain.then(async () => {
      const host = activeHost;
      if (phase !== 'synced' || !host || deps.host() !== host) return;
      const storage = deps.storage();
      if (!storage) return;
      for (const key of [...dirty].sort()) {
        let local: string | null;
        try {
          local = storage.getItem(key);
        } catch (error) {
          stop(true, 'Instelling niet terug te lezen; de instellingen worden deze sessie niet bij de host bewaard', error);
          return;
        }
        if (local === hostValues.get(key)) { dirty.delete(key); continue; }
        try {
          if (local === null) await host.delete(key);
          else await host.set(key, local);
        } catch (error) {
          deps.warn('Instelling niet bij de host bewaard', error);
          return;
        }
        if (phase !== 'synced') return;
        hostValues.set(key, local);
        try {
          if (storage.getItem(key) === local) dirty.delete(key);
        } catch { }
      }
    });
    return chain;
  };

  const hydrate = (timeoutMs = HYDRATE_TIMEOUT_MS): Promise<HydrateOutcome> => {
    if (baseline === null) baseline = snapshotLocal();
    const host = deps.host();
    if (!host) return Promise.resolve('geen-host');
    if (phase === 'off') return Promise.resolve('fout');
    if (phase !== 'idle') return Promise.resolve('al-geladen');
    const outcome = new Promise<HydrateOutcome>(resolve => { settleStart = resolve; });
    begin(host, timeoutMs);
    return outcome;
  };

  const adoptLateHost = (timeoutMs = HYDRATE_TIMEOUT_MS) => {
    if (phase !== 'idle') return;
    const host = deps.host();
    if (!host) return;
    if (baseline === null) baseline = snapshotLocal();
    begin(host, timeoutMs);
  };

  const noteChanged = (key: string, origin: SettingWriteOrigin = 'user') => {
    if (!persisted.has(key)) return;
    if (phase === 'synced') {
      dirty.add(key);
      schedule();
    } else if ((phase === 'idle' || phase === 'reading') && origin === 'user') {
      touched.add(key);
    }
  };

  const takeApplied = () => {
    const applied = pendingApplied;
    pendingApplied = null;
    return applied;
  };

  const subscribe = (listener: (event: HostSettingsEvent) => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };

  return {
    hydrate, adoptLateHost, noteChanged, flush, takeApplied, subscribe, settle, release,
    writeHeld: (key: string) => phase === 'applying' && held.has(key),
    delayed: () => phase === 'reading' && isDelayed,
    unavailable: () => phase === 'off' && offLocally,
  };
}

function browserStorage(): SettingsStorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function dispatchStorageEvents(changes: readonly SettingChange[]): void {
  if (typeof window === 'undefined' || typeof StorageEvent === 'undefined') return;
  for (const { key, oldValue, newValue } of changes) {
    window.dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue, url: window.location.href }));
  }
}

const sync = createHostSettingsSync({
  storage: browserStorage,
  host: siteHostSettings,
  changed: dispatchStorageEvents,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
  warn: (message, error) => console.warn(`${message}:`, error),
});

let pageHooksInstalled = false;
function installPageHooks(): void {
  if (pageHooksInstalled || typeof window === 'undefined') return;
  pageHooksInstalled = true;
  window.addEventListener('pagehide', () => { void sync.flush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void sync.flush();
  });
}
sync.subscribe(event => { if (event === 'toegepast') installPageHooks(); });

export async function hydrateSiteHostSettings(timeoutMs = HYDRATE_TIMEOUT_MS): Promise<HydrateOutcome> {
  try {
    const outcome = await sync.hydrate(timeoutMs);
    if (outcome === 'geladen') installPageHooks();
    return outcome;
  } catch (error) {
    console.warn('Instellingen van de host niet gelezen:', error);
    return 'fout';
  }
}

export function adoptLateSiteHostSettings(): void {
  sync.adoptLateHost();
}

export function noteSiteHostSettingChanged(key: string, origin: SettingWriteOrigin = 'user'): void {
  sync.noteChanged(key, origin);
}

export function flushSiteHostSettings(): Promise<void> {
  return sync.flush();
}

export function siteHostSettingsUnavailable(): boolean {
  return sync.unavailable();
}

export function siteHostSettingsDelayed(): boolean {
  return sync.delayed();
}

export function takeLateSiteHostSettings(): LateSettingsApplied | null {
  return sync.takeApplied();
}

export function siteHostSettingWriteHeld(key: string): boolean {
  for (const keys of heldWrites) if (keys.has(key)) return true;
  return false;
}

export function settleLateSiteHostSettings(keys: Iterable<string>): void {
  sync.settle(keys);
}

export function releaseLateSiteHostSettings(): void {
  sync.release();
}

export function onSiteHostSettingsEvent(listener: (event: HostSettingsEvent) => void): () => void {
  return sync.subscribe(listener);
}
