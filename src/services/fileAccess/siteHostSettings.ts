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
 * heeft geen `list`; de tool vraagt de vaste lijst `HOST_PERSISTED_KEYS` op (`siteHostSettingKeys.ts`,
 * bewaakt door `check-site-host-preferences.ts`).
 *
 * **De start** (`main.tsx`, vóór de app): `hydrateSiteHostSettings` doet één `get` per sleutel. Een
 * waarde moet tekst zijn (of `null`/`undefined`: niet bewaard). De start wacht hoogstens
 * `HYDRATE_TIMEOUT_MS`. Antwoordt de host op tijd, dan gaan de waarden in `localStorage`, en daarna gaat
 * elke schrijf- of wisactie op een blijvende sleutel (`noteSiteHostSettingChanged`) gebundeld naar de
 * host: na `FLUSH_DELAY_MS` rust, en bij `pagehide` en een verborgen tabblad.
 *
 * **Te laat of een fout** (besluit van Ethan, 7 november 2026): de app start met standaardinstellingen
 * en toont een pop-up (`useSiteHostPreferences`). Deze module blijft op de achtergrond wachten:
 *
 * 1. Antwoordt de host niet, dan blijft de lezing lopen; er komt geen tweede verzoek.
 * 2. Wijst de host af (of geeft hij een ongeldige waarde), dan probeert de module het opnieuw na
 *    `RETRY_DELAY_MS`, hoogstens `MAX_RETRIES` keer. Steeds één lopend verzoek per sleutel: een poging
 *    is pas voorbij als elk verzoek ervan klaar is, ook als een ander verzoek al afwees (de start wacht
 *    dan wel niet langer). Lukt het nooit, dan blijft de sessie zonder bewaren; de pop-up zei dat al.
 * 3. Tijdens het wachten schrijft de module **niets** naar de host: geen `set` en geen `delete`. Zo kan
 *    een lijst die de gebruiker intussen maakte (bijv. persoonlijke werksoorten) de bewaarde lijst nooit
 *    wissen. Wel onthoudt hij welke sleutels de gebruiker wijzigde (`SettingWriteOrigin` `'user'`).
 * 4. Komt het antwoord alsnog, dan **winnen de bewaarde instellingen**: de toestand wordt die van een
 *    gewone start met dat antwoord. Een sleutel uit het antwoord krijgt die waarde. Een sleutel die de
 *    gebruiker wijzigde en die niet in het antwoord staat, gaat terug naar zijn waarde bij de start (in
 *    de SuperCloud is dat de standaard: de opslag van het frame is dan leeg). Wat de app zelf bij de
 *    start invulde (`'start'`, bijv. een standaardindeling), blijft staan, net als bij een gewone start.
 *    De module meldt het aan de app (`takeLateSiteHostSettings`). Die past de instellingen live toe:
 *    elke sleutel die veranderde én elke sleutel die de gebruiker wijzigde (`refresh`), ook als de
 *    opgeslagen tekst gelijk bleef. Zo krijgen thema en taal weer de voorrang van host en devlink, net
 *    als bij een gewone start.
 *    Grens: dit gaat alleen over instellingen, nooit over het document. Een werksoort die de gebruiker
 *    tijdens het wachten maakte en aan een taak gaf, gaat uit de persoonlijke lijst, maar blijft in het
 *    document (de werksoorten "Uit dit project"); de taak houdt hem.
 * 5. Zolang de app toepast (`applying`), schrijft de module nog niets naar de host, en slaat `writeLocal`
 *    een schrijfactie van de gebruiker over op een sleutel die nog niet is toegepast
 *    (`siteHostSettingWriteHeld`). Een oude timer met een oude kopie (bijv. de scrolltimer van de
 *    taakgrid) zet de bewaarde waarde zo niet terug, lokaal noch bij de host. De app geeft elke sleutel
 *    vrij zodra zijn kopie bijgewerkt is (`settleLateSiteHostSettings`), en daarna alles
 *    (`releaseLateSiteHostSettings`). Pas dan staat het bewaren aan: wat lokaal anders is dan bij de
 *    host, gaat één keer mee.
 *
 * Een host die pas na de start verschijnt (tijdens het laden van `App`, of met `openaec-host-ready`),
 * telt als een laat antwoord: `adoptLateSiteHostSettings` begint dan de lezing, met dezelfde regels.
 *
 * **Lokale fouten.** Een fout bij het neerzetten of teruglezen in `localStorage`, of geen
 * `localStorage`, zet het bewaren uit voor de sessie (`siteHostSettingsUnavailable`; de app meldt dat
 * één keer). Een fout wordt zo nooit een wisactie. Een mislukte `set`/`delete` bij de host probeert de
 * volgende ronde opnieuw. Een fout is nooit een crash. Zonder host of zonder `settings` doet deze module
 * niets naar buiten.
 */
import { siteHostSettings, type SiteHostSettings } from './siteHostPreferences';
import { HOST_PERSISTED_KEYS, isHostPersistedKey } from './siteHostSettingKeys';

export { isHostPersistedKey };

/**
 * Zo lang wacht de start hoogstens op de host: 5 s. De host is een brug in de pagina eromheen, dus een
 * gewoon antwoord duurt milliseconden, ook met ~60 sleutels. Een koude site of een traag netwerk kan
 * seconden kosten; 5 s vangt dat op zonder dat de gebruiker lang naar een leeg venster kijkt. Daarboven
 * start de tool met standaardinstellingen en wacht hij op de achtergrond verder.
 */
export const HYDRATE_TIMEOUT_MS = 5000;

/** Bundelt schrijfacties: één ronde na zoveel ms zonder nieuwe wijziging. */
export const FLUSH_DELAY_MS = 400;

/** Na een afwijzing van de host: zo lang wachten vóór de volgende poging (30 s). */
export const RETRY_DELAY_MS = 30_000;

/** Zoveel nieuwe pogingen na de eerste afwijzing; daarna geeft de tool het op voor deze sessie. Met
 *  `RETRY_DELAY_MS` is dat ruim 5 minuten. */
export const MAX_RETRIES = 10;

/**
 * Wie een instelling schreef: de gebruiker (`'user'`, de standaard) of de app zelf zonder keuze van de
 * gebruiker (`'start'`: een migratie, of een standaardwaarde die een ontbrekende sleutel vult). Telt
 * alleen tijdens het wachten op een laat antwoord: een `'user'`-sleutel buiten het antwoord gaat dan
 * terug, en alleen een `'user'`-sleutel geeft de zin "teruggezet" in de melding. Vergeten `'start'` mee
 * te geven geeft dus hoogstens een te ruime melding, nooit verlies van een bewaarde instelling.
 */
export type SettingWriteOrigin = 'user' | 'start';

/** Het deel van `Storage` dat de synchronisatie gebruikt. */
export interface SettingsStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Eén sleutel die een (late) lezing lokaal veranderde. */
export interface SettingChange {
  key: string;
  oldValue: string | null;
  newValue: string | null;
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
  /** Meld dat een lezing deze sleutels lokaal veranderde (in de browser: een `StorageEvent` per sleutel). */
  changed?(changes: readonly SettingChange[]): void;
}

export type HydrateOutcome = 'geen-host' | 'geladen' | 'time-out' | 'fout' | 'al-geladen';

/** Een laat antwoord dat in `localStorage` staat en dat de app nog live moet toepassen. */
export interface LateSettingsApplied {
  /** De sleutels waarvan de lokale waarde veranderde (elk kreeg een `StorageEvent`). */
  changed: readonly string[];
  /** De sleutels die de gebruiker tijdens het wachten wijzigde, ook als de waarde nu gelijk bleef. */
  touched: readonly string[];
  /** Wat de app live opnieuw moet toepassen: `changed` en `touched` samen, gesorteerd. Een gelijke
   *  opgeslagen waarde kan toch een andere uitkomst geven: bij thema en taal gaan host en devlink voor. */
  refresh: readonly string[];
  /** De opgeslagen waarde van een sleutel die de gebruiker wijzigde, is teruggezet. */
  reverted: boolean;
}

/** `vertraagd`: de start wachtte vergeefs (pop-up). `toegepast`: een laat antwoord staat klaar
 *  (`takeApplied`). `uit`: het bewaren staat deze sessie uit. */
export type HostSettingsEvent = 'vertraagd' | 'toegepast' | 'uit';

export interface HostSettingsSync {
  hydrate(timeoutMs?: number): Promise<HydrateOutcome>;
  /** Een host die pas na de start kwam: lees hem nu, als een laat antwoord. */
  adoptLateHost(timeoutMs?: number): void;
  noteChanged(key: string, origin?: SettingWriteOrigin): void;
  flush(): Promise<void>;
  /** De lezing liep over de grens of faalde, en de module wacht nog: de pop-up hoort bij deze toestand. */
  delayed(): boolean;
  /** Een laat antwoord dat de app nog niet toepaste; wist het. */
  takeApplied(): LateSettingsApplied | null;
  /** Slaat `writeLocal` een schrijfactie van de gebruiker op deze sleutel over? Waar zolang de app een
   *  laat antwoord toepast en de sleutel nog niet heeft vrijgegeven (zie de kop, punt 5). */
  writeHeld(key: string): boolean;
  /** De app heeft de kopieën van deze sleutels bijgewerkt: schrijfacties tellen weer. */
  settle(keys: Iterable<string>): void;
  /** De app is klaar met toepassen: het bewaren gaat aan. */
  release(): void;
  subscribe(listener: (event: HostSettingsEvent) => void): () => void;
  /** Bewaren staat deze sessie uit door een lokale fout (geen opslag, neerzetten of teruglezen faalde). */
  unavailable(): boolean;
}

/**
 * De sleutels die nu worden toegepast, over alle instanties (zie `siteHostSettingWriteHeld`). In de
 * browser is er één instantie; de headless check maakt er meer en toetst zo de echte `writeLocal`.
 */
const heldWrites = new Set<ReadonlySet<string>>();

export function createHostSettingsSync(deps: HostSettingsSyncDeps): HostSettingsSync {
  const keys = [...(deps.keys ?? HOST_PERSISTED_KEYS)].sort();
  const persisted = new Set(keys);
  /** `idle`: nog geen lezing; `reading`: de lezing loopt (de start of de app wacht); `applying`: een
   *  laat antwoord staat lokaal en de app past het toe (zie de kop, punt 5); `synced`: bewaren staat
   *  aan; `off`: uit voor deze sessie. */
  let phase: 'idle' | 'reading' | 'applying' | 'synced' | 'off' = 'idle';
  /** Tijdens `applying`: de sleutels die de app nog niet heeft vrijgegeven. */
  const held = new Set<string>();
  let offLocally = false;
  /** De host die gelezen wordt, en na een geslaagde lezing de host waarnaar de tool schrijft. */
  let activeHost: SiteHostSettings | null = null;
  /** Wat de host heeft, per sleutel (`null` = niet bewaard), na de lezing en elke geslaagde schrijfactie. */
  const hostValues = new Map<string, string | null>();
  const dirty = new Set<string>();
  /** De lokale waarden bij de start, vóór de app schreef: de basis voor een sleutel die teruggaat. */
  let baseline: Map<string, string | null> | null = null;
  /** Sleutels die de gebruiker wijzigde zolang er nog geen antwoord is. */
  const touched = new Set<string>();
  const listeners = new Set<(event: HostSettingsEvent) => void>();
  let isDelayed = false;
  let inFlight = false;
  let retries = 0;
  let flushTimer: unknown = null;
  let delayTimer: unknown = null;
  let retryTimer: unknown = null;
  let pendingApplied: LateSettingsApplied | null = null;
  /** De start wacht nog op de lezing (`hydrate`); `null` ⇒ een antwoord is een laat antwoord. */
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

  /** De lokale waarden van alle sleutels; een sleutel die niet te lezen is, telt als niet bewaard. */
  const snapshotLocal = (): Map<string, string | null> => {
    const map = new Map<string, string | null>();
    const storage = deps.storage();
    for (const key of keys) {
      let value: string | null = null;
      try { value = storage ? storage.getItem(key) : null; } catch { /* telt als niet bewaard */ }
      map.set(key, value);
    }
    return map;
  };

  /** De antwoorden van één poging als waarden. Gooit bij één afwijzing of één ongeldige waarde. */
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

  /** Wat lokaal anders is dan bij de host, gaat bij de volgende ronde mee. */
  const markDirty = (storage: SettingsStorageLike) => {
    dirty.clear();
    for (const key of keys) if (storage.getItem(key) !== (hostValues.get(key) ?? null)) dirty.add(key);
  };

  /**
   * Zet de waarden van de host in `localStorage` (zie de kop, punt 4). Op tijd (`late` onwaar): daarna
   * staat het bewaren meteen aan, want de app is nog niet gestart. Laat: de app past eerst toe
   * (`applying`, punt 5). Zonder wijziging van de gebruiker is dit precies de gewone start: alleen de
   * sleutels uit het antwoord veranderen.
   */
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
        else continue; // niet bij de host en niet door de gebruiker gewijzigd: blijft staan
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
      // Eerst toepassen (punt 5); `release` zet het bewaren aan.
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

  /** De pop-up hoort open: de start wacht niet langer (`outcome`), de module wel. */
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

  /**
   * Eén lezing; nooit twee tegelijk. De poging is pas voorbij als elk verzoek klaar is: wijst één
   * sleutel af terwijl een andere nog hangt, dan krijgt die andere geen tweede verzoek ernaast. De start
   * wacht dan wel niet langer: de eerste afwijzing geeft meteen de pop-up.
   */
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

  const hydrate = (timeoutMs = HYDRATE_TIMEOUT_MS): Promise<HydrateOutcome> => {
    // Ook zonder host: komt er later een host, dan is dit de toestand van een gewone start.
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
      // Nog geen antwoord: niets naar de host, wel onthouden (zie de kop, punt 3 en 4).
      touched.add(key);
    }
    // `applying`: niets; `release` vergelijkt alle sleutels met de host (punt 5).
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

/** Een `StorageEvent` per sleutel, zoals een ander tabblad dat zou geven: modules en componenten die
 *  op `storage` luisteren (`personalTaskTypes.ts`, `useStoredSettingRefresh`) verversen dan hun kopie,
 *  vóór een volgende bewerking die kopie naar de host kan schrijven. */
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
sync.subscribe(event => { if (event === 'toegepast') installPageHooks(); });

/** Lees de instellingen van de host in `localStorage`. Alleen bij de start (`main.tsx`), vóór de app;
 *  wacht hoogstens `timeoutMs` en geeft nooit een fout. Bij `time-out` of `fout` wacht de module op de
 *  achtergrond verder (zie de kop). */
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

/** Een host met `settings` die pas na de start kwam: lees hem nu, als een laat antwoord. Doet niets
 *  voor een host die bij de start al gelezen werd (of nog gelezen wordt), of zonder `settings`. */
export function adoptLateSiteHostSettings(): void {
  sync.adoptLateHost();
}

/** Een `ops-`-sleutel is geschreven of gewist. `origin`: zie `SettingWriteOrigin`. */
export function noteSiteHostSettingChanged(key: string, origin: SettingWriteOrigin = 'user'): void {
  sync.noteChanged(key, origin);
}

/** Bewaar de openstaande wijzigingen nu bij de host. */
export function flushSiteHostSettings(): Promise<void> {
  return sync.flush();
}

/** Bewaren staat deze sessie uit door een lokale fout? Dan meldt de app dat één keer. */
export function siteHostSettingsUnavailable(): boolean {
  return sync.unavailable();
}

/** Wacht de tool na een te late of mislukte lezing nog op de host? Dan hoort de pop-up open. */
export function siteHostSettingsDelayed(): boolean {
  return sync.delayed();
}

/** Een laat antwoord dat al in `localStorage` staat en dat de app nog live moet toepassen; wist het. */
export function takeLateSiteHostSettings(): LateSettingsApplied | null {
  return sync.takeApplied();
}

/** Slaat `writeLocal` een schrijfactie van de gebruiker op deze sleutel nu over? Zolang de app een laat
 *  antwoord toepast en die sleutel nog niet vrijgaf (zie de kop, punt 5). */
export function siteHostSettingWriteHeld(key: string): boolean {
  for (const keys of heldWrites) if (keys.has(key)) return true;
  return false;
}

/** De app werkte de kopieën van deze sleutels bij (store, taal, taakgrid). */
export function settleLateSiteHostSettings(keys: Iterable<string>): void {
  sync.settle(keys);
}

/** De app is klaar met het toepassen van een laat antwoord: het bewaren gaat aan. */
export function releaseLateSiteHostSettings(): void {
  sync.release();
}

/** Luister naar `vertraagd`, `toegepast` en `uit`; geeft de afmelding terug. */
export function onSiteHostSettingsEvent(listener: (event: HostSettingsEvent) => void): () => void {
  return sync.subscribe(listener);
}
