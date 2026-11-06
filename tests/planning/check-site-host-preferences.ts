// Taal, thema en instellingen van de host (#818) — headless, met een nephost en een nep-localStorage.
//
// Wat hier vastligt:
//   A. `siteHostTheme`: alleen `light`/`dark`, eigen venster vóór de parent, een gooiende getter of
//      cross-origin parent telt als niets, Tauri nooit.
//   B. `siteHostSettings`: alleen een object met `get`, `set` en `delete`.
//   C. De taalkeuze ingebed (`embeddedLocale`): een regiocode valt terug, een onbekende taal telt niet.
//   D. `createHostSettingsSync`: hydrateren (filter op `ops-` en apparaatsleutels, object of JSON-tekst),
//      bundelen (één `set` per rustpauze), wissen, geen schrijfactie zonder wijziging, opnieuw proberen
//      na een fout, NOOIT schrijven na een mislukte lezing, een late lezing na de time-out (lokale
//      wijzigingen winnen, luisteraar), een shim zonder `key()`/`length`, en een vervangen host.
//   E. De echte keten: `writeLocal`/`removeLocal` → host, en `initTheme`/`peekTheme` met het thema van
//      de host zonder `ops-theme` te schrijven.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.

type AnyRecord = Record<string, unknown>;
const g = globalThis as unknown as AnyRecord;

// ── Omgeving: eerst de globals, dan pas de app-modules ──────────────────────────────────────────────
const winListeners: Record<string, (() => void)[]> = {};
const win: AnyRecord = {
  location: { search: '', hash: '' },
  addEventListener: (type: string, fn: () => void) => { (winListeners[type] ??= []).push(fn); },
  removeEventListener: () => undefined,
};
win.parent = win;
g.window = win;
g.document = {
  documentElement: { dir: 'ltr', lang: 'en', setAttribute: () => undefined },
  addEventListener: () => undefined,
  visibilityState: 'visible',
};

/** Een Storage zoals in de browser (met `key`/`length`). */
class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  snapshot() { return Object.fromEntries([...this.map.entries()].sort()); }
}
const browserStorage = new MemoryStorage();
Object.defineProperty(g, 'localStorage', { configurable: true, writable: true, value: browserStorage });

const { siteHostTheme, siteHostSettings } = await import('@/services/fileAccess/siteHostPreferences');
const {
  createHostSettingsSync, isHostPersistedKey, HOST_SETTINGS_KEY, FLUSH_DELAY_MS,
  hydrateSiteHostSettings, flushSiteHostSettings,
} = await import('@/services/fileAccess/siteHostSettings');
const { embeddedLocale } = await import('@/i18n/config');
const { writeLocal, removeLocal, peekTheme, initTheme } = await import('@/utils/settingsStore');
type SiteHostSettings = import('@/services/fileAccess/siteHostPreferences').SiteHostSettings;

let failures = 0;
function check(name: string, cond: boolean): void {
  if (cond) console.log(`ok ${name}`);
  else { failures++; console.error(`XX ${name}`); }
}
function eq(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(`${name} (kreeg ${a}, verwacht ${e})`, a === e);
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function settle(): Promise<void> { for (let i = 0; i < 5; i++) await tick(); }

function setHosts(own?: unknown, parent?: unknown): void {
  delete win.openaecHost;
  delete win.__TAURI_INTERNALS__;
  if (own !== undefined) win.openaecHost = own;
  win.parent = parent === undefined ? win : { openaecHost: parent, addEventListener: () => undefined };
}

// ── A. Thema van de host ───────────────────────────────────────────────────────────────────────────
setHosts();
eq('A1 geen host ⇒ geen thema', siteHostTheme(), null);
setHosts({ thema: 'light' });
eq('A2 eigen host light', siteHostTheme(), 'light');
setHosts({ thema: 'dark' });
eq('A3 eigen host dark', siteHostTheme(), 'dark');
for (const bad of ['blue', 'high-contrast', 'system', 'Light', 1, null]) {
  setHosts({ thema: bad });
  eq(`A4 onbekend thema ${JSON.stringify(bad)} telt niet`, siteHostTheme(), null);
}
setHosts(undefined, { thema: 'light' });
eq('A5 host op de parent', siteHostTheme(), 'light');
setHosts({ thema: 'dark' }, { thema: 'light' });
eq('A6 eigen venster gaat voor de parent', siteHostTheme(), 'dark');
setHosts({ taal: 'de' }, { thema: 'light' });
eq('A7 eigen host zonder thema ⇒ die van de parent', siteHostTheme(), 'light');
setHosts({ get thema() { throw new Error('getter'); } });
eq('A8 een gooiende getter telt als niets', siteHostTheme(), null);
setHosts();
Object.defineProperty(win, 'parent', { configurable: true, get: () => ({ get openaecHost() { throw new Error('SecurityError'); } }) });
eq('A9 cross-origin parent ⇒ niets', siteHostTheme(), null);
Object.defineProperty(win, 'parent', { configurable: true, writable: true, value: win });
setHosts({ thema: 'light' });
win.__TAURI_INTERNALS__ = {};
eq('A10 Tauri ziet nooit een host', siteHostTheme(), null);
setHosts();

// ── B. Instellingenopslag van de host ──────────────────────────────────────────────────────────────
const okSettings = { get: async () => null, set: async () => null, delete: async () => null };
setHosts({ settings: okSettings });
check('B1 geldige settings', siteHostSettings() === okSettings);
setHosts({ settings: { get: async () => null, set: async () => null } });
eq('B2 zonder delete telt niet', siteHostSettings(), null);
setHosts({ settings: 'x' });
eq('B3 geen object telt niet', siteHostSettings(), null);
setHosts(undefined, { settings: okSettings });
check('B4 settings op de parent', siteHostSettings() === okSettings);
setHosts();
eq('B5 geen host ⇒ null', siteHostSettings(), null);

// ── C. Taal ingebed ────────────────────────────────────────────────────────────────────────────────
setHosts({ taal: 'de-AT' });
eq('C1 regiocode valt terug op de taal', embeddedLocale(), 'de');
setHosts({ taal: 'tr' });
eq('C2 tr', embeddedLocale(), 'tr');
setHosts({ taal: 'xx' });
eq('C3 een onbekende taal telt niet', embeddedLocale(), null);
setHosts();
eq('C4 zonder host geen taal van de host', embeddedLocale(), null);

// ── D. Synchronisatie met nephost en neptimers ─────────────────────────────────────────────────────
interface Timer { id: number; fn: () => void; ms: number }
function harness(options: { storage?: AnyRecord | null; host?: SiteHostSettings | null } = {}) {
  let seq = 0;
  const timers: Timer[] = [];
  const warnings: string[] = [];
  const storage = options.storage === undefined ? new MemoryStorage() : options.storage;
  let host: SiteHostSettings | null = options.host ?? null;
  const sync = createHostSettingsSync({
    storage: () => storage as never,
    host: () => host,
    setTimer: (fn, ms) => { const t = { id: ++seq, fn, ms }; timers.push(t); return t.id; },
    clearTimer: (id) => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    warn: (message) => { warnings.push(message); },
  });
  const run = async (ms: number) => {
    for (const t of timers.filter(x => x.ms === ms)) {
      timers.splice(timers.indexOf(t), 1);
      t.fn();
    }
    await settle();
  };
  return { sync, timers, warnings, storage, run, setHost: (h: SiteHostSettings | null) => { host = h; } };
}

/** Een nephost die zijn map bewaart en elke aanroep telt. */
function fakeHost(initial: unknown, opts: { failGet?: boolean; throwGet?: boolean; hold?: boolean } = {}) {
  const calls: { fn: string; key: string; value?: unknown }[] = [];
  let stored: unknown = initial;
  let failSet = false;
  let release: (() => void) | null = null;
  const settings: SiteHostSettings = {
    get: (key) => {
      calls.push({ fn: 'get', key });
      if (opts.throwGet) throw new Error('kapot');
      if (opts.failGet) return Promise.reject(new Error('netwerk'));
      if (opts.hold) return new Promise(resolve => { release = () => resolve(stored); });
      return Promise.resolve(stored);
    },
    set: (key, value) => {
      calls.push({ fn: 'set', key, value: JSON.parse(JSON.stringify(value)) });
      if (failSet) return Promise.reject(new Error('vol'));
      stored = value;
      return Promise.resolve(null);
    },
    delete: (key) => { calls.push({ fn: 'delete', key }); stored = undefined; return Promise.resolve(null); },
  };
  return {
    settings, calls,
    sets: () => calls.filter(c => c.fn === 'set'),
    stored: () => stored,
    setStored: (value: unknown) => { stored = value; },
    failSet: (on: boolean) => { failSet = on; },
    release: () => release?.(),
  };
}

eq('D0 sleutelfilter', ['ops-theme', 'ops-ext:x:y', 'ops-mcpToken', 'ops-mcpPort', 'ops-downloadStats', 'other', 'opstheme']
  .map(isHostPersistedKey), [true, true, false, false, false, false, false]);

{
  const h = harness();
  eq('D1 geen host ⇒ geen-host', await h.sync.hydrate(), 'geen-host');
  h.sync.noteChanged('ops-theme');
  eq('D1 geen host ⇒ geen timer na een wijziging', h.timers.length, 0);
}

{
  const host = fakeHost({
    'ops-theme': 'light', 'ops-locale': 'de', 'ops-mcpToken': 'geheim', 'vreemd': 'x', 'ops-getal': 5,
  });
  const h = harness({ host: host.settings });
  (h.storage as MemoryStorage).setItem('ops-lokaal', 'ja');
  eq('D2 hydrateren lukt', await h.sync.hydrate(), 'geladen');
  eq('D2 alleen ops-tekstwaarden, geen apparaatsleutels', (h.storage as MemoryStorage).snapshot(),
    { 'ops-locale': 'de', 'ops-lokaal': 'ja', 'ops-theme': 'light' });
  eq('D2 precies één get, op de ene hostsleutel', host.calls.filter(c => c.fn === 'get').map(c => c.key), [HOST_SETTINGS_KEY]);
  eq('D2 tweede hydrate voor dezelfde host doet niets', await h.sync.hydrate(), 'al-geladen');
  eq('D2 nog steeds één get', host.calls.filter(c => c.fn === 'get').length, 1);
  // Een lokale sleutel die de host nog niet had, gaat na de rustpauze mee; de apparaatsleutel van de host niet.
  await h.run(FLUSH_DELAY_MS);
  eq('D3 de samengevoegde map gaat in één set naar de host', host.sets().map(c => c.value),
    [{ 'ops-locale': 'de', 'ops-lokaal': 'ja', 'ops-theme': 'light' }]);

  // Bundelen: drie wijzigingen ⇒ één set.
  const st = h.storage as MemoryStorage;
  st.setItem('ops-a', '1'); h.sync.noteChanged('ops-a');
  st.setItem('ops-a', '2'); h.sync.noteChanged('ops-a');
  st.setItem('ops-b', 'x'); h.sync.noteChanged('ops-b');
  eq('D4 één timer voor drie wijzigingen', h.timers.filter(t => t.ms === FLUSH_DELAY_MS).length, 1);
  await h.run(FLUSH_DELAY_MS);
  eq('D4 één set met de laatste waarden', host.sets().length, 2);
  eq('D4 inhoud', host.stored(), { 'ops-a': '2', 'ops-b': 'x', 'ops-locale': 'de', 'ops-lokaal': 'ja', 'ops-theme': 'light' });

  // Een sleutel buiten de host (apparaat of zonder ops-) start geen ronde.
  st.setItem('ops-mcpToken', 't'); h.sync.noteChanged('ops-mcpToken');
  st.setItem('vreemd', 'v'); h.sync.noteChanged('vreemd');
  eq('D5 apparaatsleutel en vreemde sleutel starten geen ronde', h.timers.length, 0);
  await h.sync.flush();
  eq('D5 en komen ook bij een flush niet mee', host.sets().length, 2);

  // Wissen.
  st.removeItem('ops-a'); h.sync.noteChanged('ops-a');
  await h.run(FLUSH_DELAY_MS);
  eq('D6 een gewiste sleutel is weg uit de map', host.stored(), { 'ops-b': 'x', 'ops-locale': 'de', 'ops-lokaal': 'ja', 'ops-theme': 'light' });
  eq('D6 geen delete nodig', host.calls.filter(c => c.fn === 'delete').length, 0);

  // Geen wijziging ⇒ geen set.
  h.sync.noteChanged();
  await h.run(FLUSH_DELAY_MS);
  eq('D7 zonder wijziging geen schrijfactie', host.sets().length, 3);

  // Een mislukte schrijfactie: melding, en de volgende ronde probeert het opnieuw.
  host.failSet(true);
  st.setItem('ops-c', '1'); h.sync.noteChanged('ops-c');
  await h.run(FLUSH_DELAY_MS);
  eq('D8 mislukte set geeft een melding', h.warnings, ['Instellingen niet bij de host bewaard']);
  host.failSet(false);
  await h.sync.flush();
  eq('D8 de volgende flush probeert het opnieuw', host.sets().length, 5);
  eq('D8 en dan staat het er', (host.stored() as AnyRecord)['ops-c'], '1');

  // Een vervangen host: de oude krijgt niets meer, de nieuwe niets zonder eigen lezing.
  const other = fakeHost({});
  h.setHost(other.settings);
  st.setItem('ops-d', '1'); h.sync.noteChanged('ops-d');
  await h.run(FLUSH_DELAY_MS);
  eq('D9 vervangen host: geen schrijfactie naar oud of nieuw', [host.sets().length, other.sets().length], [5, 0]);
}

{
  const host = fakeHost(JSON.stringify({ 'ops-theme': 'dark' }));
  const h = harness({ host: host.settings });
  eq('D10 een map als JSON-tekst', await h.sync.hydrate(), 'geladen');
  eq('D10 inhoud', (h.storage as MemoryStorage).snapshot(), { 'ops-theme': 'dark' });
}

for (const [label, opts] of [['weigert', { failGet: true }], ['gooit meteen', { throwGet: true }]] as const) {
  const host = fakeHost({ 'ops-theme': 'light' }, opts);
  const h = harness({ host: host.settings });
  (h.storage as MemoryStorage).setItem('ops-lokaal', 'ja');
  eq(`D11 get ${label} ⇒ fout`, await h.sync.hydrate(), 'fout');
  (h.storage as MemoryStorage).setItem('ops-x', '1'); h.sync.noteChanged('ops-x');
  await h.run(FLUSH_DELAY_MS);
  await h.sync.flush();
  eq(`D11 get ${label} ⇒ nooit een set (geen lege map over de echte heen)`, host.sets().length, 0);
  eq(`D11 get ${label} ⇒ één melding`, h.warnings.length, 1);
}

{
  // Time-out bij de start, de host antwoordt later.
  const host = fakeHost({ 'ops-x': 'host', 'ops-y': 'host' }, { hold: true });
  const h = harness({ host: host.settings });
  let heard = 0;
  h.sync.onHydrated(() => { heard++; });
  const pending = h.sync.hydrate(1000);
  await settle();
  await h.run(1000);
  eq('D12 time-out', await pending, 'time-out');
  const st = h.storage as MemoryStorage;
  st.setItem('ops-x', 'lokaal'); h.sync.noteChanged('ops-x');
  await h.run(FLUSH_DELAY_MS);
  eq('D12 vóór de lezing geen set', host.sets().length, 0);
  host.release();
  await settle();
  eq('D12 de late lezing: lokale wijziging wint, de rest komt van de host', st.snapshot(), { 'ops-x': 'lokaal', 'ops-y': 'host' });
  eq('D12 de luisteraar hoort de late lezing', heard, 1);
  await h.run(FLUSH_DELAY_MS);
  eq('D12 daarna gaat de lokale wijziging naar de host', host.stored(), { 'ops-x': 'lokaal', 'ops-y': 'host' });
}

{
  // Een shim zoals in de werkplek: alleen getItem/setItem/removeItem, geen key() of length.
  const map = new Map<string, string>();
  const shim = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
  };
  const host = fakeHost({ 'ops-theme': 'light' });
  const h = harness({ storage: shim, host: host.settings });
  eq('D13 shim: hydrateren', await h.sync.hydrate(), 'geladen');
  eq('D13 shim: waarde staat erin', shim.getItem('ops-theme'), 'light');
  shim.setItem('ops-nieuw', '1'); h.sync.noteChanged('ops-nieuw');
  shim.removeItem('ops-theme'); h.sync.noteChanged('ops-theme');
  await h.run(FLUSH_DELAY_MS);
  eq('D13 shim: bekende sleutels gaan mee, gewiste niet', host.stored(), { 'ops-nieuw': '1' });
}

{
  const host = fakeHost({ 'ops-theme': 'light' });
  const h = harness({ storage: null, host: host.settings });
  eq('D14 zonder localStorage: lezen lukt, niets neergezet', await h.sync.hydrate(), 'geladen');
  await h.run(FLUSH_DELAY_MS);
  eq('D14 zonder localStorage schrijft hij geen lege map', host.sets().length, 0);
}

// ── E. De echte keten ──────────────────────────────────────────────────────────────────────────────
{
  browserStorage.clear();
  const host = fakeHost({ 'ops-showFloatBand': 'true' });
  setHosts({ thema: 'light', settings: host.settings });
  eq('E1 hydrateSiteHostSettings', await hydrateSiteHostSettings(200), 'geladen');
  eq('E1 de waarde van de host staat in localStorage', browserStorage.getItem('ops-showFloatBand'), 'true');
  check('E1 pagehide-haak geïnstalleerd', (winListeners.pagehide ?? []).length === 1);
  writeLocal('ops-histogramHeight', '120');
  removeLocal('ops-showFloatBand');
  writeLocal('ops-mcpToken', 'geheim');
  await new Promise(resolve => setTimeout(resolve, FLUSH_DELAY_MS + 50));
  await settle();
  eq('E2 writeLocal/removeLocal komen gebundeld bij de host, zonder apparaatsleutel', host.sets().map(c => c.value),
    [{ 'ops-histogramHeight': '120' }]);

  browserStorage.setItem('ops-theme', 'dark');
  eq('E3 peekTheme: het thema van de host wint van de bewaarde keuze', peekTheme(), 'light');
  eq('E3 initTheme: idem', await initTheme(), 'light');
  eq('E3 en ops-theme blijft de eigen keuze', browserStorage.getItem('ops-theme'), 'dark');
  setHosts({ settings: host.settings });
  eq('E4 zonder thema op de host: de bewaarde keuze', peekTheme(), 'dark');
  await flushSiteHostSettings();
  setHosts();
  eq('E5 zonder host: de bewaarde keuze', peekTheme(), 'dark');
  eq('E5 zonder host: hydrate doet niets', await hydrateSiteHostSettings(200), 'geen-host');
}

if (failures > 0) {
  console.error(`\nTOTAAL: ${failures} afwijking(en)`);
  process.exitCode = 1;
} else {
  console.log('\nTOTAAL: alles groen');
}
