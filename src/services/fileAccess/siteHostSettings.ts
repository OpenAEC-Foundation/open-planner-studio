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
 * **Alleen bij de start, nooit later** (besluit van de orkestrator in review #827, ronde 3). Drie
 * reviewrondes vonden telkens een nieuw geval waarin een late lezing een keuze of lijst van de
 * gebruiker terugdraaide. Daarom:
 *
 * 1. `main.tsx` wacht vóór hij de app laadt op `hydrateSiteHostSettings` (hoogstens
 *    `HYDRATE_TIMEOUT_MS`): één `get` per sleutel. Een waarde moet tekst zijn (of `null`/`undefined`:
 *    niet bewaard). Alles goed: de waarden gaan in `localStorage`, en daarna gaat elke schrijf- of
 *    wisactie op een blijvende sleutel (`noteSiteHostSettingChanged`) gebundeld naar de host: na
 *    `FLUSH_DELAY_MS` rust, en bij `pagehide` en een verborgen tabblad.
 * 2. Antwoordt de host niet op tijd, of faalt het lezen, valideren of neerzetten, dan draait de sessie
 *    zonder de instellingen van de host en schrijft hij **niets** naar de host, ook niet als het
 *    antwoord later toch komt. Een host die pas na de start verschijnt (`openaec-host-ready`), krijgt
 *    deze sessie evenmin iets (`disableSiteHostSettings`). `siteHostSettingsUnavailable()` zegt of
 *    dat zo is; de app meldt het één keer (`useSiteHostPreferences`).
 * 3. Een fout bij het teruglezen in `localStorage` tijdens het bewaren zet het bewaren ook uit; een
 *    mislukte `set`/`delete` bij de host probeert de volgende ronde opnieuw.
 *
 * Een fout is nooit een crash: alleen een melding. Zonder host of zonder `settings` doet deze module
 * niets.
 */
import { siteHostSettings, type SiteHostSettings } from './siteHostPreferences';
import { HOST_PERSISTED_KEYS, isHostPersistedKey } from './siteHostSettingKeys';

export { isHostPersistedKey };

/**
 * Zo lang wacht de start hoogstens op de host: 5 s. De host is een brug in de pagina eromheen, dus een
 * gewoon antwoord duurt milliseconden, ook met ~60 sleutels. Een koude site of een traag netwerk kan
 * seconden kosten; 5 s vangt dat op zonder dat de gebruiker lang naar een leeg venster kijkt. Daarboven
 * start de tool zonder de instellingen van de host (en zegt dat).
 */
export const HYDRATE_TIMEOUT_MS = 5000;

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
}

export type HydrateOutcome = 'geen-host' | 'geladen' | 'time-out' | 'fout' | 'al-geladen';

export interface HostSettingsSync {
  hydrate(timeoutMs?: number): Promise<HydrateOutcome>;
  noteChanged(key: string): void;
  flush(): Promise<void>;
  /** Een host met `settings` die de tool deze sessie niet gebruikt (te laat, fout, of na de start). */
  unavailable(): boolean;
  /** Zet het bewaren uit voor deze sessie (een host die pas na de start kwam). */
  disable(reason: string): void;
}

export function createHostSettingsSync(deps: HostSettingsSyncDeps): HostSettingsSync {
  const keys = [...(deps.keys ?? HOST_PERSISTED_KEYS)].sort();
  const persisted = new Set(keys);
  /** `idle`: nog geen lezing; `reading`: de start wacht; `synced`: bewaren staat aan; `off`: uit voor deze sessie. */
  let phase: 'idle' | 'reading' | 'synced' | 'off' = 'idle';
  let activeHost: SiteHostSettings | null = null;
  /** Wat de host heeft, per sleutel (`null` = niet bewaard), na de lezing en elke geslaagde schrijfactie. */
  const hostValues = new Map<string, string | null>();
  const dirty = new Set<string>();
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
      stop('Geen lokale opslag; de instellingen worden deze sessie niet bij de host bewaard');
      return false;
    }
    try {
      for (const [key, value] of values) if (value !== null) storage.setItem(key, value);
      hostValues.clear();
      for (const [key, value] of values) hostValues.set(key, value);
      dirty.clear();
      for (const key of keys) if (storage.getItem(key) !== hostValues.get(key)) dirty.add(key);
    } catch (error) {
      stop('Instellingen van de host niet neergezet; ze worden deze sessie niet bij de host bewaard', error);
      return false;
    }
    activeHost = host;
    phase = 'synced';
    if (dirty.size > 0) schedule();
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
    if (phase !== 'idle') return 'al-geladen';
    phase = 'reading';
    const settled = readHost(host).then(
      values => {
        // Na de time-out telt een antwoord niet meer (`phase` is dan `off`).
        if (phase !== 'reading') return 'time-out' as const;
        return apply(host, values) ? 'geladen' as const : 'fout' as const;
      },
      error => {
        if (phase === 'reading') stop('Instellingen van de host niet gelezen; ze worden deze sessie niet bij de host bewaard', error);
        return 'fout' as const;
      },
    );
    let handle: unknown = null;
    const timeout = new Promise<'time-out'>(resolve => {
      handle = deps.setTimer(() => resolve('time-out'), timeoutMs);
    });
    const outcome = await Promise.race([settled, timeout]);
    deps.clearTimer(handle);
    if (outcome === 'time-out' && phase === 'reading') {
      stop('De host antwoordde niet op tijd; de instellingen worden deze sessie niet bij de host bewaard');
    }
    return outcome;
  };

  const noteChanged = (key: string) => {
    if (phase !== 'synced' || !persisted.has(key)) return;
    dirty.add(key);
    schedule();
  };

  const disable = (reason: string) => {
    if (phase === 'synced' || phase === 'off') return;
    stop(reason);
  };

  return { hydrate, noteChanged, flush, unavailable: () => phase === 'off', disable };
}

function browserStorage(): SettingsStorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const sync = createHostSettingsSync({
  storage: browserStorage,
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

/** Lees de instellingen van de host in `localStorage`. Alleen bij de start (`main.tsx`), vóór de app;
 *  wacht hoogstens `timeoutMs` en geeft nooit een fout. */
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

/** Een `ops-`-sleutel is geschreven of gewist; doet alleen iets na een geslaagde lezing bij de start. */
export function noteSiteHostSettingChanged(key: string): void {
  sync.noteChanged(key);
}

/** Bewaar de openstaande wijzigingen nu bij de host. */
export function flushSiteHostSettings(): Promise<void> {
  return sync.flush();
}

/** Heeft de host `settings` die de tool deze sessie niet gebruikt? Dan meldt de app dat één keer. */
export function siteHostSettingsUnavailable(): boolean {
  return sync.unavailable();
}

/** Een host met `settings` die pas na de start kwam: deze sessie niets bij de host bewaren. */
export function disableSiteHostSettings(): void {
  if (siteHostSettings()) sync.disable('De host kwam pas na de start; de instellingen worden deze sessie niet bij de host bewaard');
}
