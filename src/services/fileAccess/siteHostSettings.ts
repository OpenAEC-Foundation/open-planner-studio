/**
 * Instellingen bewaren bij de host (#818).
 *
 * In de SuperCloud draait de tool in een frame met een opaque origin. `localStorage` is daar een
 * vervanger in het geheugen: hij is weg na herladen. Geeft de host `settings` (zie
 * `siteHostPreferences.ts`), dan bewaart de tool zijn `ops-`-instellingen daar:
 *
 * 1. **Bij de start** (`hydrateSiteHostSettings`, in `main.tsx` vóór `initLocale` en vóór de
 *    instellingen laden): één `settings.get(HOST_SETTINGS_KEY)` en de waarden in `localStorage`
 *    zetten. Wacht hoogstens `HYDRATE_TIMEOUT_MS`; daarna start de tool gewoon. Komt het antwoord
 *    later, dan zet de tool de waarden alsnog neer (behalve sleutels die intussen veranderden) en
 *    meldt dat aan `onSiteHostSettingsHydrated`, zodat de app ze toepast.
 * 2. **Bij elke schrijf- of wisactie** op een `ops-`-sleutel (`noteSiteHostSettingChanged`, vanuit
 *    `writeLocal`/`removeLocal` en de paar modules die zelf `localStorage` schrijven): na
 *    `FLUSH_DELAY_MS` rust één `settings.set` met de hele map. Ook bij `pagehide` en als het tabblad
 *    verborgen wordt.
 *
 * Keuze: ÉÉN hostsleutel met een map van alle `ops-`-waarden, niet één hostsleutel per `ops-`-sleutel.
 * Het contract heeft geen `list`; met losse sleutels zou de tool bij de start niet weten welke hij
 * moet vragen (of hij moet een index bijhouden, met twee schrijfacties die uit elkaar kunnen lopen).
 * Eén map is één vraag bij de start en één schrijfactie per bundel, en een gewiste sleutel is
 * gewoon weg uit de map (geen `settings.delete` nodig). De instellingen zijn klein (tekst en kleine
 * JSON). Nadeel: twee frames van dezelfde gebruiker tegelijk overschrijven elkaars map; de laatste
 * wint. Dat is ook zo voor `localStorage` tussen twee tabbladen.
 *
 * Niet bij de host (`isHostPersistedKey`): sleutels van één apparaat of één instantie. `ops-mcpPort`
 * en `ops-mcpToken` (de MCP-brug van de desktop-app; het token is geheim) en `ops-downloadStats`
 * (een cache). Crashherstel en sessie-ids staan niet in `localStorage` (IndexedDB en
 * `sessionStorage`), dus die komen hier niet langs.
 *
 * Een fout van de host is nooit een crash: lezen dat mislukt zet het bewaren uit voor deze sessie
 * (anders zou de tool een lege map over de echte heen schrijven); schrijven dat mislukt probeert de
 * volgende wijziging opnieuw. Zonder host of zonder `settings` doet deze module niets.
 */
import { siteHostSettings, type SiteHostSettings } from './siteHostPreferences';

/** De ene hostsleutel met de map van alle `ops-`-instellingen. */
export const HOST_SETTINGS_KEY = 'open-planner-studio:instellingen';

/** Zo lang wacht de start hoogstens op de host. */
export const HYDRATE_TIMEOUT_MS = 1000;

/** Bundelt schrijfacties: één `set` na zoveel ms zonder nieuwe wijziging. */
export const FLUSH_DELAY_MS = 400;

/** Sleutels van één apparaat of instantie; die gaan nooit naar de host. */
const DEVICE_KEYS = new Set(['ops-mcpPort', 'ops-mcpToken', 'ops-downloadStats']);

/** Hoort deze `localStorage`-sleutel bij de host? */
export function isHostPersistedKey(key: string): boolean {
  return key.startsWith('ops-') && !DEVICE_KEYS.has(key);
}

/** Het deel van `Storage` dat de synchronisatie gebruikt. `key`/`length` mogen ontbreken (een shim). */
export interface SettingsStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
  key?(index: number): string | null;
  readonly length?: number;
}

export interface HostSettingsSyncDeps {
  /** De lokale opslag, of `null` als die er niet is (of gooit). */
  storage(): SettingsStorageLike | null;
  /** De instellingenopslag van de host, of `null`. */
  host(): SiteHostSettings | null;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** Een melding voor de console (eenmalig per soort). */
  warn(message: string, error?: unknown): void;
}

export type HydrateOutcome = 'geen-host' | 'geladen' | 'time-out' | 'fout' | 'al-geladen';

export interface HostSettingsSync {
  hydrate(timeoutMs?: number): Promise<HydrateOutcome>;
  noteChanged(key?: string): void;
  flush(): Promise<void>;
  onHydrated(listener: () => void): () => void;
}

/** Een map uit de host: een object, of de JSON-tekst ervan. Alleen tekstwaarden onder `ops-`. */
function parseHostMap(value: unknown): Record<string, string> {
  let raw = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return {}; }
  }
  const map: Record<string, string> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return map;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (isHostPersistedKey(key) && typeof val === 'string') map[key] = val;
  }
  return map;
}

/** Vaste volgorde, zodat dezelfde inhoud altijd dezelfde tekst geeft (vergelijken zonder diepe diff). */
function canonical(map: Record<string, string>): string {
  return JSON.stringify(Object.keys(map).sort().map(key => [key, map[key]]));
}

export function createHostSettingsSync(deps: HostSettingsSyncDeps): HostSettingsSync {
  /** De host waarvoor het bewaren aan staat (na een geslaagde lezing). */
  let syncedHost: SiteHostSettings | null = null;
  /** De host waarvan een lezing loopt. */
  let pendingHost: SiteHostSettings | null = null;
  /** Wat de host nu heeft (de laatst gelezen of geschreven map), als vaste tekst. */
  let lastSynced: string | null = null;
  /** Sleutels die de tool kent, ook als de lokale opslag geen `key()`/`length` heeft. */
  const knownKeys = new Set<string>();
  /** Sleutels die veranderden terwijl een lezing liep: een late lezing overschrijft ze niet. */
  const changedWhilePending = new Set<string>();
  const listeners = new Set<() => void>();
  let timer: unknown = null;
  let chain: Promise<void> = Promise.resolve();

  const localMap = (): Record<string, string> => {
    const storage = deps.storage();
    const map: Record<string, string> = {};
    if (!storage) return map;
    const keys = new Set(knownKeys);
    try {
      const length = storage.length;
      if (typeof length === 'number' && typeof storage.key === 'function') {
        for (let i = 0; i < length; i++) {
          const key = storage.key(i);
          if (key) keys.add(key);
        }
      }
    } catch { /* geen opsomming: alleen de bekende sleutels */ }
    // Gesorteerd: dezelfde inhoud geeft voor de host altijd dezelfde map.
    for (const key of [...keys].sort()) {
      if (!isHostPersistedKey(key)) continue;
      try {
        const value = storage.getItem(key);
        if (value !== null) map[key] = value;
      } catch { /* één sleutel onleesbaar: overslaan */ }
    }
    return map;
  };

  const apply = (map: Record<string, string>, skip: ReadonlySet<string>) => {
    const storage = deps.storage();
    if (!storage) return;
    for (const [key, value] of Object.entries(map)) {
      knownKeys.add(key);
      if (skip.has(key)) continue;
      try { storage.setItem(key, value); } catch (error) { deps.warn('Instelling van de host niet neergezet', error); }
    }
  };

  const schedule = () => {
    if (timer !== null) deps.clearTimer(timer);
    timer = deps.setTimer(() => { timer = null; void flush(); }, FLUSH_DELAY_MS);
  };

  const flush = (): Promise<void> => {
    if (timer !== null) { deps.clearTimer(timer); timer = null; }
    chain = chain.then(async () => {
      const host = syncedHost;
      if (!host || deps.host() !== host) return;
      // Zonder lokale opslag is er niets te bewaren; een lege map zou de echte bij de host wissen.
      if (!deps.storage()) return;
      const map = localMap();
      const text = canonical(map);
      if (text === lastSynced) return;
      try {
        await host.set(HOST_SETTINGS_KEY, map);
        lastSynced = text;
      } catch (error) {
        // `lastSynced` blijft staan: de volgende wijziging (of flush) probeert het opnieuw.
        deps.warn('Instellingen niet bij de host bewaard', error);
      }
    });
    return chain;
  };

  const finish = (host: SiteHostSettings, value: unknown, skip: ReadonlySet<string>) => {
    const hostMap = parseHostMap(value);
    apply(hostMap, skip);
    syncedHost = host;
    lastSynced = canonical(hostMap);
    // Lokale sleutels die de host nog niet heeft (of die intussen veranderden) gaan in één keer mee.
    schedule();
  };

  const hydrate = async (timeoutMs = HYDRATE_TIMEOUT_MS): Promise<HydrateOutcome> => {
    const host = deps.host();
    if (!host) return 'geen-host';
    if (host === syncedHost || host === pendingHost) return 'al-geladen';
    pendingHost = host;
    changedWhilePending.clear();
    let read: Promise<unknown>;
    try {
      read = Promise.resolve(host.get(HOST_SETTINGS_KEY));
    } catch (error) {
      read = Promise.reject(error);
    }
    let timedOut = false;
    const settled = read.then(
      value => {
        if (pendingHost !== host) return 'al-geladen' as const;
        pendingHost = null;
        finish(host, value, timedOut ? changedWhilePending : new Set());
        if (timedOut) for (const listener of listeners) listener();
        return 'geladen' as const;
      },
      error => {
        if (pendingHost === host) pendingHost = null;
        deps.warn('Instellingen van de host niet gelezen; ze worden deze sessie niet bij de host bewaard', error);
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

  const noteChanged = (key?: string) => {
    if (key !== undefined) {
      if (!isHostPersistedKey(key)) return;
      knownKeys.add(key);
      if (pendingHost) changedWhilePending.add(key);
    }
    if (syncedHost) schedule();
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

const warned = new Set<string>();
const sync = createHostSettingsSync({
  storage: browserStorage,
  host: siteHostSettings,
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
  warn: (message, error) => {
    if (warned.has(message)) return;
    warned.add(message);
    console.warn(`${message}:`, error);
  },
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

/** Een `ops-`-sleutel is geschreven of gewist; zonder host met `settings` doet dit niets. */
export function noteSiteHostSettingChanged(key?: string): void {
  sync.noteChanged(key);
}

/** Bewaar de openstaande wijzigingen nu bij de host. */
export function flushSiteHostSettings(): Promise<void> {
  return sync.flush();
}

/** Luister naar een late lezing (na de time-out van de start): de app past de instellingen dan toe. */
export function onSiteHostSettingsHydrated(listener: () => void): () => void {
  return sync.onHydrated(listener);
}
