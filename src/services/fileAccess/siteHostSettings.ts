/**
 * Instellingen bewaren bij de host (#818).
 *
 * In de SuperCloud draait de tool in een frame met een opaque origin. `localStorage` is daar een
 * vervanger in het geheugen: hij is weg na herladen. Geeft de host `settings` (zie
 * `siteHostPreferences.ts`), dan bewaart de tool zijn blijvende `ops-`-instellingen daar.
 *
 * **Eén hostsleutel per `ops-`-sleutel**, met dezelfde naam en de tekst uit `localStorage` als waarde.
 * Twee frames die elk een andere instelling wijzigen, draaien elkaar zo niet terug: elk schrijft alleen
 * de sleutels die het zelf veranderde (`set`, of `delete` voor een gewiste sleutel). Wijzigen ze
 * dezelfde sleutel, dan wint de laatste, zoals bij `localStorage` tussen twee tabbladen. Het contract
 * heeft geen `list`; de tool vraagt bij de start de vaste lijst `HOST_PERSISTED_KEYS` op
 * (`siteHostSettingKeys.ts`, bewaakt door `check-site-host-preferences.ts`).
 *
 * 1. **Bij de start** (`hydrateSiteHostSettings`, in `main.tsx` vóór de store en `initLocale`): één
 *    `get` per sleutel. Een waarde moet tekst zijn (of `null`/`undefined`: niet bewaard). Alles goed?
 *    Dan zet de tool de waarden in `localStorage`. Wacht hoogstens `HYDRATE_TIMEOUT_MS`; daarna start
 *    de app gewoon.
 * 2. **Zolang de lezing loopt**, schrijft de tool niets naar de host, maar onthoudt hij per sleutel
 *    wie er schreef (`SettingWriteOrigin`). Een start-write (`'start'`: een migratie, of een
 *    standaardwaarde die een ontbrekende sleutel vult) verliest van de host. Een gewone schrijf- of
 *    wisactie (`'user'`, de standaard) wint van de host en gaat daarna naar de host. Een nieuwe
 *    start-write moet dus expliciet `'start'` meegeven; vergeten maakt hem een gebruikerswijziging,
 *    nooit een verlies van wat de gebruiker deed.
 *    Elke sleutel die de lezing lokaal veranderde, krijgt een `StorageEvent` op `window` (zoals een
 *    ander tabblad dat zou geven), zodat caches in het geheugen verversen vóór een volgende bewerking
 *    kan schrijven (`personalTaskTypes.ts`, `useStoredSettingRefresh`). Na een late lezing meldt de
 *    tool dat ook aan `onSiteHostSettingsHydrated`, zodat de app de instellingen in de store toepast.
 * 3. **Daarna** gaat elke schrijf- of wisactie op een blijvende sleutel (`noteSiteHostSettingChanged`)
 *    gebundeld naar de host: na `FLUSH_DELAY_MS` rust, en bij `pagehide` en een verborgen tabblad.
 *    Een lokale sleutel die de host nog niet had, gaat na de lezing één keer mee.
 *
 * **Fouten.** Eén fout bij lezen, een ongeldige waarde van de host, of een fout bij het neerzetten of
 * teruglezen in `localStorage` zet het bewaren uit voor de rest van de sessie. Zo wordt een fout nooit
 * een wisactie, en overschrijft de tool geen inhoud van de host die hij niet begreep. Een mislukte
 * `set`/`delete` bij de host probeert de volgende ronde opnieuw. Een fout is nooit een crash: alleen een
 * melding in de console. Zonder host of zonder `settings` doet deze module niets.
 */
import { siteHostSettings, type SiteHostSettings } from './siteHostPreferences';
import { HOST_PERSISTED_KEYS, isHostPersistedKey } from './siteHostSettingKeys';

export { isHostPersistedKey };

/** Zo lang wacht de start hoogstens op de host. */
export const HYDRATE_TIMEOUT_MS = 1000;

/** Bundelt schrijfacties: één ronde na zoveel ms zonder nieuwe wijziging. */
export const FLUSH_DELAY_MS = 400;

/** Het deel van `Storage` dat de synchronisatie gebruikt. */
export interface SettingsStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface HostSettingsSyncDeps {
  /** De lokale opslag, of `null` als die er niet is (of gooit). */
  storage(): SettingsStorageLike | null;
  /** De instellingenopslag van de host, of `null`. */
  host(): SiteHostSettings | null;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** Een melding voor de console. */
  warn(message: string, error?: unknown): void;
  /** De sleutels die bij de host horen; standaard `HOST_PERSISTED_KEYS`. */
  keys?: readonly string[];
  /** Meld dat de lezing deze sleutels lokaal veranderde (standaard: een `StorageEvent` per sleutel). */
  changed?(changes: readonly { key: string; oldValue: string | null; newValue: string | null }[]): void;
}

/** Wie een instelling schreef: de gebruiker (standaard) of de startroute. Zie de kop van deze module. */
export type SettingWriteOrigin = 'user' | 'start';

export type HydrateOutcome = 'geen-host' | 'geladen' | 'time-out' | 'fout' | 'al-geladen';

export interface HostSettingsSync {
  hydrate(timeoutMs?: number): Promise<HydrateOutcome>;
  noteChanged(key?: string, origin?: SettingWriteOrigin): void;
  flush(): Promise<void>;
  onHydrated(listener: () => void): () => void;
}

export function createHostSettingsSync(deps: HostSettingsSyncDeps): HostSettingsSync {
  const keys = [...(deps.keys ?? HOST_PERSISTED_KEYS)].sort();
  const persisted = new Set(keys);
  /** `idle`: nog geen host; `pending`: de lezing loopt; `synced`: bewaren staat aan; `off`: uit voor deze sessie. */
  let phase: 'idle' | 'pending' | 'synced' | 'off' = 'idle';
  let activeHost: SiteHostSettings | null = null;
  /** Wat de host heeft, per sleutel (`null` = niet bewaard), na de lezing en elke geslaagde schrijfactie. */
  const hostValues = new Map<string, string | null>();
  const dirty = new Set<string>();
  /** Tijdens de lezing: sleutels die de gebruiker schreef of wiste (die winnen van de host). */
  const userDuringRead = new Set<string>();
  const listeners = new Set<() => void>();
  let timer: unknown = null;
  let chain: Promise<void> = Promise.resolve();

  const stop = (message: string, error?: unknown) => {
    phase = 'off';
    dirty.clear();
    if (timer !== null) { deps.clearTimer(timer); timer = null; }
    deps.warn(message, error);
  };

  const schedule = () => {
    if (timer !== null) deps.clearTimer(timer);
    timer = deps.setTimer(() => { timer = null; void flush(); }, FLUSH_DELAY_MS);
  };

  /** Lees alle sleutels van de host. Gooit bij één fout of één ongeldige waarde. */
  const readHost = async (host: SiteHostSettings): Promise<Map<string, string | null>> => {
    const values = await Promise.all(keys.map(key => Promise.resolve().then(() => host.get(key))));
    const map = new Map<string, string | null>();
    keys.forEach((key, i) => {
      const value = values[i];
      if (value === null || value === undefined) map.set(key, null);
      else if (typeof value === 'string') map.set(key, value);
      else throw new Error(`ongeldige waarde voor ${key} (${typeof value})`);
    });
    return map;
  };

  /** Zet de waarden van de host in `localStorage` en bepaal wat lokaal nog ontbreekt bij de host. */
  const apply = (host: SiteHostSettings, values: Map<string, string | null>): boolean => {
    const storage = deps.storage();
    if (!storage) {
      // Zonder lokale opslag is er niets te bewaren of neer te zetten.
      phase = 'off';
      return false;
    }
    const changes: { key: string; oldValue: string | null; newValue: string | null }[] = [];
    try {
      for (const [key, value] of values) {
        // De gebruiker schreef deze sleutel tijdens de lezing: zijn waarde wint en gaat zo naar de host.
        if (value === null || userDuringRead.has(key)) continue;
        const oldValue = storage.getItem(key);
        if (oldValue === value) continue;
        storage.setItem(key, value);
        changes.push({ key, oldValue, newValue: value });
      }
      hostValues.clear();
      for (const [key, value] of values) hostValues.set(key, value);
      dirty.clear();
      for (const key of keys) if (storage.getItem(key) !== hostValues.get(key)) dirty.add(key);
    } catch (error) {
      stop('Instellingen van de host niet neergezet; ze worden deze sessie niet bij de host bewaard', error);
      return false;
    }
    userDuringRead.clear();
    activeHost = host;
    phase = 'synced';
    if (dirty.size > 0) schedule();
    if (changes.length > 0) {
      try { deps.changed?.(changes); } catch (error) { deps.warn('Verversen na de instellingen van de host mislukt', error); }
    }
    return true;
  };

  const flush = (): Promise<void> => {
    if (timer !== null) { deps.clearTimer(timer); timer = null; }
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
          stop('Instelling niet terug te lezen; de instellingen worden deze sessie niet bij de host bewaard', error);
          return;
        }
        if (local === hostValues.get(key)) { dirty.delete(key); continue; }
        try {
          if (local === null) await host.delete(key);
          else await host.set(key, local);
        } catch (error) {
          // Blijft gemarkeerd: de volgende ronde probeert het opnieuw.
          deps.warn('Instelling niet bij de host bewaard', error);
          return;
        }
        if (phase !== 'synced') return;
        hostValues.set(key, local);
        // Veranderde de sleutel tijdens het schrijven opnieuw, dan blijft hij voor de volgende ronde.
        try {
          if (storage.getItem(key) === local) dirty.delete(key);
        } catch { /* de volgende ronde meldt het */ }
      }
    });
    return chain;
  };

  const hydrate = async (timeoutMs = HYDRATE_TIMEOUT_MS): Promise<HydrateOutcome> => {
    const host = deps.host();
    if (!host) return 'geen-host';
    if (phase === 'off') return 'fout';
    if (host === activeHost && phase === 'synced') return 'al-geladen';
    if (phase === 'pending') return 'al-geladen';
    phase = 'pending';
    userDuringRead.clear();
    let timedOut = false;
    const settled = readHost(host).then(
      values => {
        if (phase !== 'pending') return 'fout' as const;
        if (!apply(host, values)) return 'fout' as const;
        if (timedOut) for (const listener of listeners) listener();
        return 'geladen' as const;
      },
      error => {
        if (phase === 'pending') stop('Instellingen van de host niet gelezen; ze worden deze sessie niet bij de host bewaard', error);
        return 'fout' as const;
      },
    );
    let handle: unknown = null;
    const timeout = new Promise<'time-out'>(resolve => {
      handle = deps.setTimer(() => resolve('time-out'), timeoutMs);
    });
    const outcome = await Promise.race([settled, timeout]);
    deps.clearTimer(handle);
    if (outcome === 'time-out') timedOut = true;
    return outcome;
  };

  const noteChanged = (key?: string, origin: SettingWriteOrigin = 'user') => {
    if (phase === 'pending') {
      // Niets naar de host; wel onthouden wat de gebruiker deed (zie de kop van deze module).
      if (origin === 'user') {
        if (key === undefined) for (const k of keys) userDuringRead.add(k);
        else if (persisted.has(key)) userDuringRead.add(key);
      }
      return;
    }
    if (phase !== 'synced') return; // Zonder host of na een fout: niets naar de host.
    if (key === undefined) {
      for (const k of keys) dirty.add(k);
    } else {
      if (!persisted.has(key)) return;
      dirty.add(key);
    }
    schedule();
  };

  const onHydrated = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };

  return { hydrate, noteChanged, flush, onHydrated };
}

function browserStorage(): SettingsStorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Een `StorageEvent` per sleutel, zoals een ander tabblad dat zou geven: modules die op `storage`
 *  luisteren (bijv. `personalTaskTypes.ts`, `useStoredSettingRefresh`) verversen dan hun kopie. */
function dispatchStorageEvents(changes: readonly { key: string; oldValue: string | null; newValue: string | null }[]): void {
  if (typeof window === 'undefined' || typeof StorageEvent === 'undefined') return;
  for (const { key, oldValue, newValue } of changes) {
    window.dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue, url: window.location.href }));
  }
}

const sync = createHostSettingsSync({
  storage: browserStorage,
  changed: dispatchStorageEvents,
  host: siteHostSettings,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
  warn: (message, error) => console.warn(`${message}:`, error),
});

let pageHooksInstalled = false;
/** Bewaar ook bij `pagehide` en bij een verborgen tabblad, zodat een wijziging vlak voor het sluiten
 *  niet blijft hangen in de bundeltijd. */
function installPageHooks(): void {
  if (pageHooksInstalled || typeof window === 'undefined') return;
  pageHooksInstalled = true;
  window.addEventListener('pagehide', () => { void sync.flush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void sync.flush();
  });
}

/** Lees de instellingen van de host in `localStorage` (bij de start, of voor een host die later
 *  kwam). Wacht hoogstens `timeoutMs`; geeft nooit een fout. */
export async function hydrateSiteHostSettings(timeoutMs = HYDRATE_TIMEOUT_MS): Promise<HydrateOutcome> {
  try {
    const outcome = await sync.hydrate(timeoutMs);
    if (outcome !== 'geen-host') installPageHooks();
    return outcome;
  } catch (error) {
    console.warn('Instellingen van de host niet gelezen:', error);
    return 'fout';
  }
}

/** Een `ops-`-sleutel is geschreven of gewist; zonder host met `settings` doet dit niets. Zonder
 *  sleutel: kijk alle blijvende sleutels na (na een wisactie op een groep). */
export function noteSiteHostSettingChanged(key?: string, origin: SettingWriteOrigin = 'user'): void {
  sync.noteChanged(key, origin);
}

/** Bewaar de openstaande wijzigingen nu bij de host. */
export function flushSiteHostSettings(): Promise<void> {
  return sync.flush();
}

/** Luister naar een late lezing (na de time-out van de start): de app past de instellingen dan toe. */
export function onSiteHostSettingsHydrated(listener: () => void): () => void {
  return sync.onHydrated(listener);
}
