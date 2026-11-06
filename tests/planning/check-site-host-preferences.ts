// Taal, thema en instellingen van de host (#818) — headless, met een nephost en een nep-localStorage.
//
// Wat hier vastligt:
//   A. `siteHostTheme`: alleen `light`/`dark`, eigen venster vóór de parent, een gooiende getter of
//      cross-origin parent telt als niets, Tauri nooit.
//   B. `siteHostSettings`: alleen een object met `get`, `set` en `delete`.
//   C. De taalkeuze ingebed (`embeddedLocale`): een regiocode valt terug, een onbekende taal telt niet.
//   K. De sleutellijst: elke `ops-`-sleutel die de app schrijft of wist, staat in `HOST_PERSISTED_KEYS`
//      of is bewust uitgesloten; elk register-item staat erin.
//   S. Volgorde bij de start (review #827, punt 1): de statische imports van `main.tsx` bereiken de store
//      niet, en een store die ná het hydrateren ontstaat, maakt de startkalender volgens de bouwmodus van
//      de host.
//   D. `createHostSettingsSync`: één hostsleutel per `ops-`-sleutel, bundelen, wissen met `delete`, geen
//      schrijfactie zonder wijziging, opnieuw proberen na een fout van de host, en de scenario's uit de
//      review: een fout bij lezen, valideren of neerzetten wordt nooit een wisactie (punt 3), een trage
//      host verliest de kolomindeling niet aan een startwrite (punt 2, met de echte taakgridbootstrap) en
//      twee frames draaien elkaars wijzigingen niet terug (punt 5).
//   E. De echte keten: `writeLocal`/`removeLocal` → host, en `initTheme`/`peekTheme` met het thema van
//      de host zonder `ops-theme` te schrijven.
//
// Draait via run.sh (esbuild-bundel). Exit 0 = alles groen — alleen de exitcode telt.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

type AnyRecord = Record<string, unknown>;
const g = globalThis as unknown as AnyRecord;

// ── Omgeving: eerst de globals, dan pas de app-modules ──────────────────────────────────────────────
const winListeners: Record<string, (() => void)[]> = {};
const win: AnyRecord = {
  location: { search: '', hash: '' },
  addEventListener: (type: string, fn: () => void) => { (winListeners[type] ??= []).push(fn); },
  removeEventListener: () => undefined,
  dispatchEvent: (event: { type: string }) => { for (const fn of winListeners[event.type] ?? []) (fn as (e: unknown) => void)(event); return true; },
  matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
};
win.parent = win;
g.window = win;
/** Genoeg van `StorageEvent` voor `siteHostSettings.ts` en de luisteraars. */
g.StorageEvent = class {
  readonly type: string; readonly key: string | null; readonly oldValue: string | null; readonly newValue: string | null;
  constructor(type: string, init: { key?: string; oldValue?: string | null; newValue?: string | null }) {
    this.type = type; this.key = init.key ?? null; this.oldValue = init.oldValue ?? null; this.newValue = init.newValue ?? null;
  }
};
g.document = {
  documentElement: { dir: 'ltr', lang: 'en', setAttribute: () => undefined },
  addEventListener: () => undefined,
  visibilityState: 'visible',
};

/** Een Storage zoals in de browser. `failSet`/`failGet`: gooi bij die sleutel. */
class MemoryStorage {
  private map = new Map<string, string>();
  failSet = new Set<string>();
  failGet = new Set<string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { if (this.failGet.has(k)) throw new Error('lezen geweigerd'); return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { if (this.failSet.has(k)) throw new Error('vol'); this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  snapshot() { return Object.fromEntries([...this.map.entries()].sort()); }
}
const browserStorage = new MemoryStorage();
Object.defineProperty(g, 'localStorage', { configurable: true, writable: true, value: browserStorage });

const { siteHostTheme, siteHostSettings } = await import('@/services/fileAccess/siteHostPreferences');
const {
  createHostSettingsSync, isHostPersistedKey, FLUSH_DELAY_MS, hydrateSiteHostSettings, flushSiteHostSettings,
  onSiteHostSettingsHydrated,
} = await import('@/services/fileAccess/siteHostSettings');
const { HOST_PERSISTED_KEYS, HOST_EXCLUDED_KEYS, HOST_EXCLUDED_PREFIXES } = await import('@/services/fileAccess/siteHostSettingKeys');
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
async function settle(): Promise<void> { for (let i = 0; i < 8; i++) await tick(); }

function setHosts(own?: unknown, parent?: unknown): void {
  delete win.openaecHost;
  delete win.__TAURI_INTERNALS__;
  if (own !== undefined) win.openaecHost = own;
  win.parent = parent === undefined ? win : { openaecHost: parent, addEventListener: () => undefined };
}

/** Een nephost met één waarde per sleutel. Telt elke aanroep; `hold` houdt `get` vast tot `release`. */
function fakeHost(initial: Record<string, unknown> = {}, opts: { failGet?: boolean; throwGet?: boolean; hold?: boolean } = {}) {
  const calls: { fn: string; key: string; value?: unknown }[] = [];
  const stored = new Map<string, unknown>(Object.entries(initial));
  let failWrites = false;
  const held: (() => void)[] = [];
  const settings: SiteHostSettings = {
    get: (key) => {
      calls.push({ fn: 'get', key });
      if (opts.throwGet) throw new Error('kapot');
      if (opts.failGet) return Promise.reject(new Error('netwerk'));
      if (opts.hold) return new Promise(resolve => { held.push(() => resolve(stored.get(key) ?? null)); });
      return Promise.resolve(stored.get(key) ?? null);
    },
    set: (key, value) => {
      calls.push({ fn: 'set', key, value });
      if (failWrites) return Promise.reject(new Error('vol'));
      stored.set(key, value);
      return Promise.resolve(null);
    },
    delete: (key) => {
      calls.push({ fn: 'delete', key });
      if (failWrites) return Promise.reject(new Error('vol'));
      stored.delete(key);
      return Promise.resolve(null);
    },
  };
  return {
    settings, calls,
    writes: () => calls.filter(c => c.fn !== 'get'),
    stored: () => Object.fromEntries([...stored.entries()].sort()),
    failWrites: (on: boolean) => { failWrites = on; },
    release: () => { for (const r of held.splice(0)) r(); },
  };
}

// ── S1. Volgorde bij de start: hydrateren vóór de store (review #827, punt 1) ──────────────────────
// Deze sectie staat bewust eerst: de store mag in dit proces pas ná het hydrateren ontstaan.
const s1Host = fakeHost({ 'ops-constructionMode': 'false', 'ops-showFloatBand': 'true' });
{
  browserStorage.clear();
  setHosts({ thema: 'light', settings: s1Host.settings });
  eq('S1 hydrateSiteHostSettings', await hydrateSiteHostSettings(200), 'geladen');
  eq('S1 bouwmodus van de host staat in localStorage', browserStorage.getItem('ops-constructionMode'), 'false');
  check('S1 pagehide-haak geïnstalleerd', (winListeners.pagehide ?? []).length === 1);
  const { useAppStore } = await import('@/state/appStore');
  const calendar = useAppStore.getState().calendar;
  eq('S1 de startkalender volgt de bouwmodus van de host', [calendar.name, calendar.holidays.length], ['Standaardkalender', 0]);
  eq('S1 en het thema van de host', useAppStore.getState().ui.uiTheme, 'light');
}

// ── S2. De statische imports van main.tsx bereiken de store niet ───────────────────────────────────
{
  const require = createRequire(path.join(process.cwd(), 'package.json'));
  const esbuild = require('esbuild') as typeof import('esbuild');
  const result = await esbuild.build({
    entryPoints: ['src/main.tsx'],
    bundle: true, write: false, metafile: true, platform: 'browser', format: 'esm', outdir: 'node_modules/.cache/ops-check-main',
    alias: { '@': path.join(process.cwd(), 'src') }, logLevel: 'silent', packages: 'external',
    loader: { '.css': 'empty', '.png': 'empty', '.svg': 'empty', '.woff': 'empty', '.woff2': 'empty', '.ttf': 'empty', '.wasm': 'empty' },
    plugins: [{
      name: 'ops-asset-urls',
      setup(build) {
        build.onResolve({ filter: /\?url$/ }, (args) => ({ path: args.path, external: true }));
        build.onResolve({ filter: /^ops:/ }, (args) => ({ path: args.path, external: true }));
      },
    }],
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"production"', '__APP_VERSION__': '"0.0.0"', '__OPS_DEV_INSTANCE__': '""' },
  });
  const inputs = result.metafile.inputs;
  const reached = new Set<string>();
  const todo = ['src/main.tsx'];
  while (todo.length > 0) {
    const file = todo.pop()!;
    if (reached.has(file) || !inputs[file]) continue;
    reached.add(file);
    for (const imp of inputs[file].imports) if (imp.kind === 'import-statement' && !imp.external) todo.push(imp.path);
  }
  check('S2 main.tsx is gevonden in de graaf', reached.has('src/main.tsx') && reached.size > 1);
  for (const forbidden of ['src/state/appStore.ts', 'src/state/slices/projectSlice.ts', 'src/App.tsx']) {
    check(`S2 de statische imports van main.tsx bereiken ${forbidden} niet`, !reached.has(forbidden));
  }
  const mainSource = fs.readFileSync('src/main.tsx', 'utf8');
  const hydrateAt = mainSource.indexOf('hydrateSiteHostSettings()');
  const appAt = mainSource.indexOf("import('./App')");
  check('S2 main.tsx hydrateert vóór de dynamische import van App', hydrateAt > 0 && appAt > hydrateAt);
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

// ── K. De sleutellijst tegen de code ───────────────────────────────────────────────────────────────
{
  const { SETTINGS } = await import('@/utils/settingsRegistry');
  for (const d of SETTINGS) check(`K1 register-sleutel ops-${d.key} staat in HOST_PERSISTED_KEYS`, isHostPersistedKey(`ops-${d.key}`));
  eq('K2 geen dubbele sleutels', HOST_PERSISTED_KEYS.length, new Set(HOST_PERSISTED_KEYS).size);
  check('K3 uitgesloten en blijvend overlappen niet', HOST_EXCLUDED_KEYS.every(k => !isHostPersistedKey(k)));

  // Alle schrijf- en wisplekken in src/, op de TypeScript-AST (`scripts/lib/host-setting-writes.mjs`).
  // Het pad is een variabele, zodat esbuild de module niet meebundelt: hij laadt `typescript` zelf.
  const scannerUrl = pathToFileURL(path.join(process.cwd(), 'scripts/lib/host-setting-writes.mjs')).href;
  const { findSettingWrites } = await import(scannerUrl) as {
    findSettingWrites(root: string): { file: string; line: number; func: string; call: string; key: string | null }[];
  };
  // Plekken met een sleutel die pas bij het uitvoeren vastligt: de generieke helpers zelf, het
  // neerzetten van de host, en de extensies (`ops-ext:`, uitgesloten). Bestand + functie; een nieuwe
  // plek met een onbekende sleutel buiten deze lijst is rood.
  const DYNAMIC = new Set([
    'src/utils/settingsStore.ts|writeLocal', 'src/utils/settingsStore.ts|removeLocal',
    'src/utils/settingsStore.ts|setSetting', 'src/utils/settingsStore.ts|syncSettingToLocalStorage',
    'src/services/fileAccess/siteHostSettings.ts|apply',
    'src/extensions/extensionApi.ts|set', 'src/extensions/extensionService.ts|removeExtension',
  ]);
  const allowed = (key: string) => !key.startsWith('ops-') // geen instelling van de tool (bijv. de oude recentlijst)
    || isHostPersistedKey(key) || HOST_EXCLUDED_KEYS.includes(key) || HOST_EXCLUDED_PREFIXES.some(p => key.startsWith(p));
  const sites = findSettingWrites(process.cwd());
  const unknown = sites
    .filter(site => site.key === null ? !DYNAMIC.has(`${site.file}|${site.func}`) : !allowed(site.key))
    .map(site => `${site.file}:${site.line} ${site.call} ${site.key ?? '(onbekende sleutel)'}`);
  check(`K4 schrijfplekken gevonden (${sites.length})`, sites.length > 50);
  eq('K5 elke geschreven ops-sleutel staat in de lijst of is bewust uitgesloten', unknown, []);
  eq('K6 elke toegestane plek met een onbekende sleutel bestaat nog',
    [...DYNAMIC].filter(entry => !sites.some(site => site.key === null && `${site.file}|${site.func}` === entry)), []);

  // De vormen die een regex mist (review #827 ronde 2): spatie vóór de haak, `x['setItem']`, een
  // opslagalias, `.bind`, een helperalias. Een fixture in een tijdelijke map.
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-host-keys-'));
  fs.mkdirSync(path.join(fixture, 'src'));
  fs.writeFileSync(path.join(fixture, 'src', 'a.ts'), [
    "import { writeLocal, setSetting } from '@/utils/settingsStore';",
    "const KEY = 'ops-const';",
    "export function f(): void {",
    "  writeLocal ('ops-spatie', 'x');",
    "  localStorage['setItem']('ops-haak', '1');",
    "  const s = localStorage; s.setItem('ops-alias', '1');",
    "  window.localStorage.removeItem(KEY);",
    "  void setSetting /* commentaar */ ('nieuw', 1);",
    "  const set = localStorage.setItem.bind(localStorage); set('ops-bind', '1');",
    "  const w = writeLocal; w('ops-helperalias', '1');",
    "  localStorage.clear();",
    "  sessionStorage.setItem('ops-sessie', '1');",
    "  new Map().clear();",
    "}",
  ].join('\n'));
  const found = findSettingWrites(fixture).map(site => `${site.line}:${site.key ?? '?'}`);
  fs.rmSync(fixture, { recursive: true, force: true });
  eq('K7 de scanner vindt elke vorm, en negeert sessionStorage en Map.clear', found,
    ['4:ops-spatie', '5:ops-haak', '6:ops-alias', '7:ops-const', '8:ops-nieuw', '9:?', '10:?', '11:?']);
}

// ── D. Synchronisatie met nephost en neptimers ─────────────────────────────────────────────────────
interface Timer { id: number; fn: () => void; ms: number }
function harness(options: { storage?: MemoryStorage | null; host?: SiteHostSettings | null; keys?: string[] } = {}) {
  let seq = 0;
  const timers: Timer[] = [];
  const warnings: string[] = [];
  const storage = options.storage === undefined ? new MemoryStorage() : options.storage;
  let host: SiteHostSettings | null = options.host ?? null;
  const sync = createHostSettingsSync({
    storage: () => storage,
    host: () => host,
    setTimer: (fn, ms) => { const t = { id: ++seq, fn, ms }; timers.push(t); return t.id; },
    clearTimer: (id) => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    warn: (message) => { warnings.push(message); },
    keys: options.keys ?? ['ops-a', 'ops-b', 'ops-c', 'ops-theme', 'ops-locale', 'ops-showFloatBand'],
  });
  const run = async (ms: number) => {
    for (const t of timers.filter(x => x.ms === ms)) {
      timers.splice(timers.indexOf(t), 1);
      t.fn();
    }
    await settle();
  };
  /** Een schrijfactie zoals `writeLocal`: lokaal schrijven en melden (standaard van de gebruiker). */
  const write = (key: string, value: string | null, origin: 'user' | 'start' = 'user') => {
    if (value === null) storage!.removeItem(key); else storage!.setItem(key, value);
    sync.noteChanged(key, origin);
  };
  return { sync, timers, warnings, storage: storage!, run, write, setHost: (h: SiteHostSettings | null) => { host = h; } };
}

{
  const h = harness();
  eq('D1 geen host ⇒ geen-host', await h.sync.hydrate(), 'geen-host');
  h.write('ops-theme', 'light');
  eq('D1 geen host ⇒ geen timer na een wijziging', h.timers.length, 0);
}

{
  const host = fakeHost({ 'ops-theme': 'light', 'ops-locale': 'de', 'ops-mcpToken': 'geheim' });
  const h = harness({ host: host.settings });
  h.storage.setItem('ops-a', 'lokaal');
  eq('D2 hydrateren lukt', await h.sync.hydrate(), 'geladen');
  eq('D2 alleen sleutels uit de lijst, één get per sleutel', host.calls.filter(c => c.fn === 'get').map(c => c.key).sort(),
    ['ops-a', 'ops-b', 'ops-c', 'ops-locale', 'ops-showFloatBand', 'ops-theme']);
  eq('D2 de waarden van de host staan lokaal', h.storage.snapshot(), { 'ops-a': 'lokaal', 'ops-locale': 'de', 'ops-theme': 'light' });
  eq('D2 tweede hydrate voor dezelfde host doet niets', await h.sync.hydrate(), 'al-geladen');
  await h.run(FLUSH_DELAY_MS);
  eq('D3 een lokale sleutel die de host niet had, gaat één keer mee', host.writes(), [{ fn: 'set', key: 'ops-a', value: 'lokaal' }]);

  h.write('ops-b', '1'); h.write('ops-b', '2'); h.write('ops-c', 'x');
  eq('D4 één timer voor drie wijzigingen', h.timers.filter(t => t.ms === FLUSH_DELAY_MS).length, 1);
  await h.run(FLUSH_DELAY_MS);
  eq('D4 alleen de gewijzigde sleutels, met de laatste waarde', host.writes().slice(1), [
    { fn: 'set', key: 'ops-b', value: '2' }, { fn: 'set', key: 'ops-c', value: 'x' }]);

  h.write('ops-mcpToken', 't'); h.write('vreemd', 'v');
  eq('D5 een sleutel buiten de lijst start geen ronde', h.timers.length, 0);

  h.write('ops-b', null);
  await h.run(FLUSH_DELAY_MS);
  eq('D6 een gewiste sleutel wordt een delete', host.writes().at(-1), { fn: 'delete', key: 'ops-b' });

  const before = host.writes().length;
  h.sync.noteChanged('ops-theme');
  await h.run(FLUSH_DELAY_MS);
  eq('D7 zonder echte wijziging geen schrijfactie', host.writes().length, before);

  host.failWrites(true);
  h.write('ops-c', 'y');
  await h.run(FLUSH_DELAY_MS);
  eq('D8 mislukte set geeft een melding', h.warnings, ['Instelling niet bij de host bewaard']);
  host.failWrites(false);
  await h.sync.flush();
  eq('D8 de volgende ronde probeert het opnieuw', host.stored()['ops-c'], 'y');

  const other = fakeHost({});
  h.setHost(other.settings);
  const count = host.writes().length;
  h.write('ops-a', 'nieuw');
  await h.run(FLUSH_DELAY_MS);
  eq('D9 vervangen host: geen schrijfactie naar oud of nieuw', [host.writes().length - count, other.writes().length], [0, 0]);
}

// Punt 3: een fout wordt nooit een wisactie, en ongeldige inhoud van de host wordt nooit overschreven.
for (const [label, opts] of [['weigert', { failGet: true }], ['gooit meteen', { throwGet: true }]] as const) {
  const host = fakeHost({ 'ops-theme': 'light' }, opts);
  const h = harness({ host: host.settings });
  h.storage.setItem('ops-a', 'lokaal');
  eq(`D10 get ${label} ⇒ fout`, await h.sync.hydrate(), 'fout');
  h.write('ops-a', 'nieuw');
  await h.run(FLUSH_DELAY_MS);
  await h.sync.flush();
  eq(`D10 get ${label} ⇒ nooit een schrijfactie`, host.writes(), []);
}
for (const bad of [{ kapot: true }, 42, ['x']]) {
  const host = fakeHost({ 'ops-theme': 'light', 'ops-showFloatBand': bad });
  const h = harness({ host: host.settings });
  eq(`D11 ongeldige waarde ${JSON.stringify(bad)} ⇒ fout`, await h.sync.hydrate(), 'fout');
  eq(`D11 ongeldige waarde ${JSON.stringify(bad)} ⇒ niets neergezet`, h.storage.snapshot(), {});
  h.write('ops-showFloatBand', 'true');
  h.write('ops-theme', 'dark');
  await h.sync.flush();
  eq(`D11 ongeldige waarde ${JSON.stringify(bad)} ⇒ de host blijft onaangeroerd`, [host.writes(), host.stored()],
    [[], { 'ops-showFloatBand': bad, 'ops-theme': 'light' }]);
}
{
  // De review: één mislukte lokale write bij het neerzetten wiste `ops-personalTaskTypes` bij de host.
  const host = fakeHost({ 'ops-theme': 'light', 'ops-a': '[1]' });
  const storage = new MemoryStorage();
  storage.failSet.add('ops-a');
  const h = harness({ storage, host: host.settings });
  eq('D12 neerzetten mislukt ⇒ fout', await h.sync.hydrate(), 'fout');
  storage.failSet.clear();
  h.write('ops-b', 'x');
  await h.sync.flush();
  eq('D12 neerzetten mislukt ⇒ geen enkele schrijfactie, de host houdt alles', [host.writes(), host.stored()],
    [[], { 'ops-a': '[1]', 'ops-theme': 'light' }]);
}
{
  // De review: falende lokale reads vervingen een gezonde map door `{}`.
  const host = fakeHost({ 'ops-theme': 'light', 'ops-a': '1' });
  const h = harness({ host: host.settings });
  eq('D13 hydrateren', await h.sync.hydrate(), 'geladen');
  h.storage.failGet.add('ops-theme');
  h.storage.failGet.add('ops-a');
  h.sync.noteChanged('ops-theme');
  h.sync.noteChanged('ops-a');
  await h.run(FLUSH_DELAY_MS);
  h.storage.failGet.clear();
  h.write('ops-b', 'x');
  await h.sync.flush();
  eq('D13 onleesbare lokale sleutels ⇒ geen delete, en bewaren staat uit', [host.writes(), host.stored()],
    [[], { 'ops-a': '1', 'ops-theme': 'light' }]);
  eq('D13 één melding', h.warnings.length, 1);
}
{
  const host = fakeHost({ 'ops-theme': 'light' });
  const h = harness({ storage: null, host: host.settings });
  eq('D14 zonder localStorage ⇒ fout, niets geschreven', await h.sync.hydrate(), 'fout');
  await h.sync.flush();
  eq('D14 zonder localStorage geen schrijfactie', host.writes(), []);
}

// Punt 5: twee frames draaien elkaars onafhankelijke wijzigingen niet terug.
{
  const host = fakeHost({ 'ops-theme': 'dark', 'ops-showFloatBand': 'false' });
  const a = harness({ host: host.settings });
  const b = harness({ host: host.settings });
  await a.sync.hydrate();
  await b.sync.hydrate();
  a.write('ops-theme', 'light');
  await a.run(FLUSH_DELAY_MS);
  b.write('ops-showFloatBand', 'true');
  await b.run(FLUSH_DELAY_MS);
  eq('D15 frame A (thema) en frame B (spelingsband) houden allebei hun wijziging', host.stored(),
    { 'ops-showFloatBand': 'true', 'ops-theme': 'light' });
}

// Punt 2 (ronde 1 en 2) en punt 1 (ronde 2), op de ECHTE module-instantie en via de echte schrijfroutes:
// - D16: de standaardindeling van de taakgridbootstrap is een start-write; de late host wint ervan.
// - D17: een gewone schrijfactie tijdens de lezing (een klik op Spelingsband) wint van de late host en
//   gaat daarna naar de host.
// - D18: de modulecache van de persoonlijke werksoorten ververst na de late lezing, zodat een nieuwe
//   werksoort de bewaarde niet wist.
{
  const { useAppStore } = await import('@/state/appStore');
  const { bootstrapTaskGridPreferences } = await import('@/state/taskGridBootstrap');
  const { saveShowFloatBand } = await import('@/utils/settingsStore');
  const { getPersonalTaskTypes, addPersonalTaskType } = await import('@/services/taskTypes/personalTaskTypes');
  // Een geldige, bewaarde indeling die van de standaard afwijkt.
  setHosts();
  browserStorage.removeItem('ops-taskGridPreferences');
  await bootstrapTaskGridPreferences(useAppStore);
  const saved = JSON.parse(browserStorage.getItem('ops-taskGridPreferences')!) as { surfaces: Record<string, { columns: { id: string }[] }> };
  saved.surfaces['full-task-grid'].columns.reverse();
  const savedText = JSON.stringify(saved);
  const savedFirst = saved.surfaces['full-task-grid'].columns[0].id;
  const kept = JSON.stringify([{ id: 'bewaard', name: 'Bewaard type' }]);

  // Het frame herlaadt: lokaal is alles weg; de host heeft de indeling, Spelingsband aan en een
  // bewaarde werksoort, en antwoordt traag.
  browserStorage.clear();
  const slow = fakeHost({ 'ops-taskGridPreferences': savedText, 'ops-showFloatBand': 'true', 'ops-personalTaskTypes': kept }, { hold: true });
  setHosts({ settings: slow.settings });
  let heard = 0;
  const off = onSiteHostSettingsHydrated(() => { heard++; });
  eq('D16 time-out bij de start', await hydrateSiteHostSettings(50), 'time-out');
  eq('D16 de echte bootstrap migreert naar de standaard (een start-write)', await bootstrapTaskGridPreferences(useAppStore), 'migrated');
  eq('D18 de werksoorten worden geladen vóór de host antwoordt', getPersonalTaskTypes(), []);
  await saveShowFloatBand(false); // wat een klik op Spelingsband doet
  await new Promise(resolve => setTimeout(resolve, FLUSH_DELAY_MS + 50));
  eq('D16 zolang de lezing loopt: niets naar de host', slow.writes(), []);

  slow.release();
  await settle();
  await new Promise(resolve => setTimeout(resolve, FLUSH_DELAY_MS + 50));
  await settle();
  off();
  eq('D16 de late lezing wint van de startwrite', browserStorage.getItem('ops-taskGridPreferences'), savedText);
  eq('D17 de klik wint van de late host', browserStorage.getItem('ops-showFloatBand'), 'false');
  eq('D16/D17 naar de host gaat alleen de klik', slow.writes(), [{ fn: 'set', key: 'ops-showFloatBand', value: 'false' }]);
  eq('D16 de luisteraar hoort de late lezing', heard, 1);
  eq('D16 opnieuw bootstrappen geeft de bewaarde indeling', await bootstrapTaskGridPreferences(useAppStore), 'valid');
  const firstColumn = (useAppStore.getState().taskGridSurfaces as unknown as Record<string, { columns: { id: string }[] }>)['full-task-grid'].columns[0].id;
  eq('D16 eerste kolom is die van de host', firstColumn, savedFirst);
  eq('D18 na de late lezing kent de cache de bewaarde werksoort', getPersonalTaskTypes().map(t => t.name), ['Bewaard type']);
  addPersonalTaskType('Nieuw type');
  await new Promise(resolve => setTimeout(resolve, FLUSH_DELAY_MS + 50));
  await settle();
  eq('D18 een nieuwe werksoort wist de bewaarde niet, ook niet bij de host',
    (JSON.parse(String(slow.stored()['ops-personalTaskTypes'])) as { name: string }[]).map(t => t.name).sort(), ['Bewaard type', 'Nieuw type']);
}

// Punt 2 (ronde 2) in de losse synchronisatie: start-writes verliezen, gebruikerswrites winnen, ook wissen.
{
  const host = fakeHost({ 'ops-a': 'host', 'ops-b': 'host', 'ops-c': 'host' }, { hold: true });
  const h = harness({ host: host.settings });
  const pending = h.sync.hydrate(1000);
  await settle();
  await h.run(1000);
  eq('D19 time-out', await pending, 'time-out');
  h.write('ops-a', 'start', 'start');
  h.write('ops-b', 'klik');
  h.write('ops-c', null); // de gebruiker wist
  h.write('ops-theme', 'start', 'start'); // de host heeft hem niet
  host.release();
  await settle();
  await h.run(FLUSH_DELAY_MS);
  eq('D19 start verliest, de gebruiker wint (ook wissen)', h.storage.snapshot(), { 'ops-a': 'host', 'ops-b': 'klik', 'ops-theme': 'start' });
  eq('D19 naar de host: de klik, de wisactie en de sleutel die de host niet had',
    [...host.writes()].sort((x, y) => x.key.localeCompare(y.key)),
    [{ fn: 'set', key: 'ops-b', value: 'klik' }, { fn: 'delete', key: 'ops-c' }, { fn: 'set', key: 'ops-theme', value: 'start' }]);
}

// ── E. De echte keten: writeLocal/removeLocal → de host uit S1 ─────────────────────────────────────
{
  setHosts({ thema: 'light', settings: s1Host.settings });
  // De echte instantie hoort nu bij de trage host van D16; lees de host van S1 opnieuw.
  eq('E0 opnieuw hydrateren voor de host van S1', await hydrateSiteHostSettings(200), 'geladen');
  await new Promise(resolve => setTimeout(resolve, FLUSH_DELAY_MS + 50));
  await settle();
  const before = s1Host.writes().length;
  writeLocal('ops-histogramHeight', '120');
  removeLocal('ops-showFloatBand');
  writeLocal('ops-mcpToken', 'geheim');
  writeLocal('ops-ext:demo:x', '1');
  await new Promise(resolve => setTimeout(resolve, FLUSH_DELAY_MS + 50));
  await settle();
  eq('E1 writeLocal/removeLocal komen gebundeld en per sleutel bij de host, zonder uitgesloten sleutels',
    s1Host.writes().slice(before), [{ fn: 'set', key: 'ops-histogramHeight', value: '120' }, { fn: 'delete', key: 'ops-showFloatBand' }]);

  browserStorage.setItem('ops-theme', 'dark');
  eq('E2 peekTheme: het thema van de host wint van de bewaarde keuze', peekTheme(), 'light');
  eq('E2 initTheme: idem', await initTheme(), 'light');
  eq('E2 en ops-theme blijft de eigen keuze', browserStorage.getItem('ops-theme'), 'dark');
  setHosts({ settings: s1Host.settings });
  eq('E3 zonder thema op de host: de bewaarde keuze', peekTheme(), 'dark');
  await flushSiteHostSettings();
  setHosts();
  eq('E4 zonder host: de bewaarde keuze', peekTheme(), 'dark');
  eq('E4 zonder host: hydrate doet niets', await hydrateSiteHostSettings(200), 'geen-host');
}

if (failures > 0) {
  console.error(`\nTOTAAL: ${failures} afwijking(en)`);
  process.exitCode = 1;
} else {
  console.log('\nTOTAAL: alles groen');
}
