// Taal, thema en instellingen van de host (#818) — headless, met een nephost en een nep-localStorage.
//
// Wat hier vastligt:
//   A. `siteHostTheme`: alleen `light`/`dark`, eigen venster vóór de parent, een gooiende getter of
//      cross-origin parent telt als niets, Tauri nooit.
//   B. `siteHostSettings`: alleen een object met `get`, `set` en `delete`.
//   C. De taalkeuze ingebed (`embeddedLocale`): een regiocode valt terug, een onbekende taal telt niet.
//   K. De sleutellijst: elke `ops-`-sleutel die de app schrijft of wist, staat in `HOST_PERSISTED_KEYS`
//      of is bewust uitgesloten; elk register-item staat erin. De scanner ziet ook hernoemde en
//      namespace-imports van de helpers (K8).
//   S. Volgorde bij de start (review #827, punt 1): de statische imports van `main.tsx` bereiken de store
//      niet, en een store die ná het hydrateren ontstaat, maakt de startkalender volgens de bouwmodus van
//      de host.
//   D. `createHostSettingsSync`: één hostsleutel per `ops-`-sleutel, bundelen, wissen met `delete`, geen
//      schrijfactie zonder wijziging, opnieuw proberen na een fout van de host, en de scenario's uit de
//      review: een fout bij lezen, valideren of neerzetten wordt nooit een wisactie (punt 3) en twee
//      frames draaien elkaars wijzigingen niet terug (punt 5). Een trage host binnen de grens laadt.
//      Late toepassing (besluit van Ethan, 7 november 2026): boven de grens of na een afwijzing wacht de
//      module verder en schrijft hij niets naar de host; een laat antwoord wint van wat de gebruiker
//      intussen wijzigde, daarna staat het bewaren aan (D17); een host die pas na de start kwam telt als
//      laat antwoord (D18); een afwijzing geeft een nieuwe poging na 30 s, nooit twee tegelijk, met een
//      plafond (D20-D22); uitgesloten sleutels blijven buiten alles (D23). Review #833 ronde 1: het
//      bewaren gaat pas aan als de app klaar is, en een oude scrolltimer zet de taakgrid niet terug
//      (D24, met de echte store, `writeLocal` en `processLateSettings`); thema en taal krijgen weer de
//      voorrang van de host, ook als de opgeslagen tekst gelijk bleef (D25); een poging is pas voorbij
//      als elk verzoek klaar is (D26).
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
  createHostSettingsSync, isHostPersistedKey, FLUSH_DELAY_MS, RETRY_DELAY_MS, MAX_RETRIES, hydrateSiteHostSettings,
  flushSiteHostSettings,
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
  let failGet = opts.failGet ?? false;
  const held: (() => void)[] = [];
  const settings: SiteHostSettings = {
    get: (key) => {
      calls.push({ fn: 'get', key });
      if (opts.throwGet) throw new Error('kapot');
      if (failGet) return Promise.reject(new Error('netwerk'));
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
    failGet: (on: boolean) => { failGet = on; },
    gets: () => calls.filter(c => c.fn === 'get').length,
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
  // VERVOLG 4 (review #827 ronde 2): hernoemde imports en namespace-imports, via `valueBindings()`.
  fs.writeFileSync(path.join(fixture, 'src', 'b.ts'), [
    "import { writeLocal as persist, removeLocal as wis } from '@/utils/settingsStore';",
    "import * as settings from '@/utils/settingsStore';",
    "import { HOST_KEY as K } from './c';",
    "export function g(): void {",
    "  persist('ops-hernoemd', '1');",
    "  wis('ops-hernoemd-wis');",
    "  settings.writeLocal('ops-namespace', '1');",
    "  settings['setSetting']('ns-haak', 1);",
    "  persist(K, '1');",
    "  const p = persist; p('ops-x', '1');",
    "  const q = settings.removeLocal; q('ops-y');",
    "  settings.other('ops-geen');",
    "}",
  ].join('\n'));
  fs.writeFileSync(path.join(fixture, 'src', 'c.ts'), "export const HOST_KEY = 'ops-uit-import';\n");
  const all = findSettingWrites(fixture);
  const found = all.filter(site => site.file === 'src/a.ts').map(site => `${site.line}:${site.key ?? '?'}`);
  const foundB = all.filter(site => site.file !== 'src/a.ts').map(site => `${site.file}:${site.line}:${site.key ?? '?'}`);
  fs.rmSync(fixture, { recursive: true, force: true });
  eq('K7 de scanner vindt elke vorm, en negeert sessionStorage en Map.clear', found,
    ['4:ops-spatie', '5:ops-haak', '6:ops-alias', '7:ops-const', '8:ops-nieuw', '9:?', '10:?', '11:?']);
  eq('K8 hernoemde en namespace-imports van de helpers', foundB, [
    'src/b.ts:5:ops-hernoemd', 'src/b.ts:6:ops-hernoemd-wis', 'src/b.ts:7:ops-namespace', 'src/b.ts:8:ops-ns-haak',
    'src/b.ts:9:ops-uit-import', 'src/b.ts:10:?', 'src/b.ts:11:?']);
}

// ── D. Synchronisatie met nephost en neptimers ─────────────────────────────────────────────────────
interface Timer { id: number; fn: () => void; ms: number }
function harness(options: { storage?: MemoryStorage | null; host?: SiteHostSettings | null; keys?: string[] } = {}) {
  let seq = 0;
  const timers: Timer[] = [];
  const warnings: string[] = [];
  const events: string[] = [];
  const changes: { key: string; oldValue: string | null; newValue: string | null }[] = [];
  const storage = options.storage === undefined ? new MemoryStorage() : options.storage;
  let host: SiteHostSettings | null = options.host ?? null;
  const sync = createHostSettingsSync({
    storage: () => storage,
    host: () => host,
    setTimer: (fn, ms) => { const t = { id: ++seq, fn, ms }; timers.push(t); return t.id; },
    clearTimer: (id) => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    warn: (message) => { warnings.push(message); },
    keys: options.keys ?? ['ops-a', 'ops-b', 'ops-c', 'ops-theme', 'ops-locale', 'ops-showFloatBand'],
    changed: (list) => { changes.push(...list); },
  });
  sync.subscribe(event => { events.push(event); });
  /** Laat de timers van `ms` aflopen. Eerst de lopende beloften, zoals de echte event loop dat doet. */
  const run = async (ms: number) => {
    await settle();
    for (const t of timers.filter(x => x.ms === ms)) {
      timers.splice(timers.indexOf(t), 1);
      t.fn();
    }
    await settle();
  };
  /** Een schrijfactie zoals `writeLocal`: lokaal schrijven en melden. */
  const write = (key: string, value: string | null, origin: 'user' | 'start' = 'user') => {
    if (value === null) storage!.removeItem(key); else storage!.setItem(key, value);
    sync.noteChanged(key, origin);
  };
  /** Wat de app doet met een laat antwoord, zonder store: ophalen en meteen vrijgeven. */
  const app = () => {
    const applied = sync.takeApplied();
    sync.release();
    return applied;
  };
  return {
    sync, timers, warnings, events, changes, storage: storage!, run, write, app,
    setHost: (h: SiteHostSettings | null) => { host = h; },
  };
}

{
  const h = harness();
  eq('D1 geen host ⇒ geen-host', await h.sync.hydrate(), 'geen-host');
  h.write('ops-theme', 'light');
  eq('D1 geen host ⇒ geen timer na een wijziging', h.timers.length, 0);
  eq('D1 geen host ⇒ geen melding nodig', h.sync.unavailable(), false);
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
  eq(`D10 get ${label} ⇒ de pop-up hoort open, geen melding over een lokale fout`, [h.sync.delayed(), h.sync.unavailable()], [true, false]);
  eq(`D10 get ${label} ⇒ een nieuwe poging over 30 s`, h.timers.filter(t => t.ms === RETRY_DELAY_MS).length, 1);
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

// Ronde 3: lezen alleen bij de start, met een grens. De time-out van de harness is een neptimer: de
// test laat hem pas aflopen met `run(1000)`.
{
  // D16: een trage host binnen de grens. De start wacht, en laadt daarna gewoon.
  const host = fakeHost({ 'ops-a': 'host', 'ops-showFloatBand': 'true' }, { hold: true });
  const h = harness({ host: host.settings });
  let done = false;
  const pending = h.sync.hydrate(1000).then(outcome => { done = true; return outcome; });
  await settle();
  check('D16 de start wacht op de host', !done);
  host.release();
  eq('D16 binnen de grens ⇒ geladen', await pending, 'geladen');
  eq('D16 de waarden van de host staan lokaal', h.storage.snapshot(), { 'ops-a': 'host', 'ops-showFloatBand': 'true' });
  eq('D16 de time-out is opgeruimd', h.timers.filter(t => t.ms === 1000).length, 0);
  h.write('ops-showFloatBand', 'false');
  await h.run(FLUSH_DELAY_MS);
  eq('D16 daarna gaat een wijziging naar de host', host.writes(), [{ fn: 'set', key: 'ops-showFloatBand', value: 'false' }]);
  eq('D16 geen melding', h.sync.unavailable(), false);
}
{
  // D17: een host boven de grens die daarna alsnog antwoordt (besluit van Ethan, 7 november 2026). Tijdens
  // het wachten niets naar de host; daarna winnen de bewaarde instellingen en staat het bewaren aan.
  const host = fakeHost({ 'ops-a': 'host', 'ops-b': 'host', 'ops-theme': 'dark' }, { hold: true });
  const h = harness({ host: host.settings });
  const pending = h.sync.hydrate(1000);
  await settle();
  await h.run(1000);
  eq('D17 boven de grens ⇒ time-out', await pending, 'time-out');
  eq('D17 de pop-up hoort open', [h.sync.delayed(), h.events], [true, ['vertraagd']]);
  eq('D17 geen melding over een lokale fout', h.sync.unavailable(), false);
  h.write('ops-a', 'sessie');
  h.write('ops-b', null);
  h.write('ops-theme', 'light');
  h.write('ops-c', 'nieuw');
  h.write('ops-locale', 'en', 'start'); // een standaardwaarde die de app zelf invult
  await h.run(FLUSH_DELAY_MS);
  await h.sync.flush();
  eq('D17 tijdens het wachten geen enkele set/delete naar de host', host.writes(), []);
  eq('D17 tijdens het wachten geen bundeltimer', h.timers.filter(t => t.ms === FLUSH_DELAY_MS).length, 0);
  eq('D17 een tweede hydrate leest niet opnieuw', [await h.sync.hydrate(1000), host.gets()], ['al-geladen', 6]);
  h.sync.adoptLateHost(1000);
  eq('D17 nooit twee lezingen tegelijk', host.gets(), 6);

  host.release();
  await settle();
  eq('D17 het late antwoord wint: waarden van de host, de eigen nieuwe sleutel terug naar de standaard',
    h.storage.snapshot(), { 'ops-a': 'host', 'ops-b': 'host', 'ops-locale': 'en', 'ops-theme': 'dark' });
  const userKeys = ['ops-a', 'ops-b', 'ops-c', 'ops-theme'];
  eq('D17 de app krijgt het te horen, met "teruggezet"', [h.events, h.sync.takeApplied()],
    [['vertraagd', 'toegepast'], { changed: userKeys, touched: userKeys, refresh: userKeys, reverted: true }]);
  eq('D17 maar één keer', h.sync.takeApplied(), null);
  eq('D17 een StorageEvent-wijziging per sleutel, met oude en nieuwe waarde', h.changes, [
    { key: 'ops-a', oldValue: 'sessie', newValue: 'host' },
    { key: 'ops-b', oldValue: null, newValue: 'host' },
    { key: 'ops-c', oldValue: 'nieuw', newValue: null },
    { key: 'ops-theme', oldValue: 'light', newValue: 'dark' },
  ]);
  eq('D17 de pop-up hoeft niet meer', h.sync.delayed(), false);
  // Punt 5 (review #833 ronde 1, punt 1): tot de app klaar is met toepassen, niets naar de host, en een
  // schrijfactie op een sleutel die nog niet is toegepast valt weg.
  eq('D17 tijdens het toepassen: de toegepaste sleutels vastgehouden, de rest niet',
    ['ops-a', 'ops-theme', 'ops-locale', 'ops-showFloatBand'].map(key => h.sync.writeHeld(key)), [true, true, false, false]);
  h.sync.settle(['ops-theme']);
  eq('D17 een vrijgegeven sleutel niet meer', [h.sync.writeHeld('ops-theme'), h.sync.writeHeld('ops-a')], [false, true]);
  await h.run(FLUSH_DELAY_MS);
  await h.sync.flush();
  eq('D17 tijdens het toepassen nog niets naar de host', [host.writes(), h.timers.filter(t => t.ms === FLUSH_DELAY_MS).length], [[], 0]);
  h.sync.release();
  eq('D17 na het vrijgeven niets meer vastgehouden', userKeys.map(key => h.sync.writeHeld(key)), [false, false, false, false]);
  await h.run(FLUSH_DELAY_MS);
  eq('D17 daarna gaat wat de app zelf invulde één keer mee, zonder delete', host.writes(),
    [{ fn: 'set', key: 'ops-locale', value: 'en' }]);
  h.write('ops-showFloatBand', 'true');
  await h.run(FLUSH_DELAY_MS);
  eq('D17 en gaat een nieuwe wijziging naar de host', host.writes().at(-1), { fn: 'set', key: 'ops-showFloatBand', value: 'true' });
  eq('D17 de host houdt zijn bewaarde waarden', host.stored(),
    { 'ops-a': 'host', 'ops-b': 'host', 'ops-locale': 'en', 'ops-showFloatBand': 'true', 'ops-theme': 'dark' });
}
{
  // D17b: een laat antwoord zonder wijziging van de gebruiker: gewoon toepassen, zonder "teruggezet".
  // Een wijziging die toevallig gelijk is aan de bewaarde waarde telt ook niet als teruggezet.
  const host = fakeHost({ 'ops-a': 'host', 'ops-theme': 'dark' }, { hold: true });
  const h = harness({ host: host.settings });
  const pending = h.sync.hydrate(1000);
  await settle();
  await h.run(1000);
  await pending;
  h.write('ops-theme', 'dark');
  h.write('ops-c', 'standaard', 'start');
  host.release();
  await settle();
  // De gelijke waarde moet wel opnieuw worden toegepast (`refresh`): bij het thema gaat de host voor
  // (review #833 ronde 1, punt 2; zie D25).
  eq('D17b geen "teruggezet", wel opnieuw toepassen', h.app(),
    { changed: ['ops-a'], touched: ['ops-theme'], refresh: ['ops-a', 'ops-theme'], reverted: false });
  eq('D17b wat de app zelf invulde, blijft staan', h.storage.snapshot(), { 'ops-a': 'host', 'ops-c': 'standaard', 'ops-theme': 'dark' });
}
{
  // D17c: een sleutel die al vóór de start lokaal stond (geen opaque frame), daarna door de gebruiker
  // gewijzigd en niet bij de host: terug naar de waarde bij de start, zoals een gewone start.
  const storage = new MemoryStorage();
  storage.setItem('ops-c', 'van-voor-de-start');
  const host = fakeHost({}, { hold: true });
  const h = harness({ storage, host: host.settings });
  const pending = h.sync.hydrate(1000);
  await settle();
  await h.run(1000);
  await pending;
  h.write('ops-c', 'sessie');
  host.release();
  await settle();
  eq('D17c terug naar de waarde bij de start', h.storage.snapshot(), { 'ops-c': 'van-voor-de-start' });
  h.app();
  await h.run(FLUSH_DELAY_MS);
  eq('D17c die gaat daarna naar de host, zoals bij een gewone start', host.writes(), [{ fn: 'set', key: 'ops-c', value: 'van-voor-de-start' }]);
}
{
  // D18: een host die pas na de start kwam (tijdens het laden van `App`, of met `openaec-host-ready`):
  // een laat antwoord. Wijzigingen van de gebruiker van vóór de host tellen mee.
  const host = fakeHost({ 'ops-a': 'host' });
  const h = harness();
  eq('D18 bij de start nog geen host', await h.sync.hydrate(), 'geen-host');
  h.write('ops-a', 'sessie');
  h.write('ops-b', 'eigen');
  h.write('ops-c', 'standaard', 'start');
  h.setHost(host.settings);
  h.sync.adoptLateHost(1000);
  await settle();
  eq('D18 gelezen en toegepast, zonder pop-up', [h.events, h.sync.delayed()], [['toegepast'], false]);
  eq('D18 de bewaarde waarde wint, de eigen sleutel gaat terug, wat de app invulde blijft',
    h.storage.snapshot(), { 'ops-a': 'host', 'ops-c': 'standaard' });
  eq('D18 met "teruggezet"', h.app(),
    { changed: ['ops-a', 'ops-b'], touched: ['ops-a', 'ops-b'], refresh: ['ops-a', 'ops-b'], reverted: true });
  await h.run(FLUSH_DELAY_MS);
  eq('D18 daarna staat het bewaren aan', host.writes(), [{ fn: 'set', key: 'ops-c', value: 'standaard' }]);
  h.sync.adoptLateHost(1000);
  await settle();
  eq('D18 een tweede ready-event leest niet opnieuw', host.gets(), 6);
}
{
  // D18b: een late host die niet binnen de grens antwoordt: dan alsnog de pop-up.
  const host = fakeHost({ 'ops-a': 'host' }, { hold: true });
  const h = harness();
  await h.sync.hydrate();
  h.setHost(host.settings);
  h.sync.adoptLateHost(1000);
  await settle();
  eq('D18b binnen de grens nog geen pop-up', h.events, []);
  await h.run(1000);
  eq('D18b daarna wel', [h.events, h.sync.delayed()], [['vertraagd'], true]);
  host.release();
  await settle();
  eq('D18b en het antwoord wordt toegepast', [h.events, h.storage.snapshot()], [['vertraagd', 'toegepast'], { 'ops-a': 'host' }]);
  h.app();
}
{
  // D19: `adoptLateHost` na een geslaagde lezing doet niets (een tweede ready-event van dezelfde host).
  const host = fakeHost({});
  const h = harness({ host: host.settings });
  eq('D19 geladen', await h.sync.hydrate(), 'geladen');
  eq('D19 bij de start geen late melding', [h.events, h.sync.takeApplied()], [[], null]);
  h.sync.adoptLateHost(1000);
  await settle();
  eq('D19 geen tweede lezing', host.gets(), 6);
  h.write('ops-a', 'x');
  await h.run(FLUSH_DELAY_MS);
  eq('D19 bewaren blijft aan', host.writes(), [{ fn: 'set', key: 'ops-a', value: 'x' }]);
}
{
  // D20: een afwijzing van de host: elke 30 s opnieuw, tot het lukt. Tijdens het wachten niets naar de host.
  const host = fakeHost({ 'ops-a': '[{"id":"bewaard"}]' }, { failGet: true });
  const h = harness({ host: host.settings });
  eq('D20 afwijzing ⇒ fout, de start wacht niet langer', await h.sync.hydrate(1000), 'fout');
  eq('D20 de pop-up hoort open', [h.sync.delayed(), h.events], [true, ['vertraagd']]);
  eq('D20 geen time-outtimer meer', h.timers.filter(t => t.ms === 1000).length, 0);
  h.write('ops-a', '[{"id":"nieuw"}]');
  await h.run(RETRY_DELAY_MS);
  eq('D20 de tweede poging leest opnieuw', host.gets(), 12);
  eq('D20 nog een poging gepland, één keer', h.timers.filter(t => t.ms === RETRY_DELAY_MS).length, 1);
  eq('D20 één pop-up, ook na de tweede afwijzing', h.events, ['vertraagd']);
  host.failGet(false);
  await h.run(RETRY_DELAY_MS);
  eq('D20 de derde poging lukt: de bewaarde lijst wint', h.storage.snapshot(), { 'ops-a': '[{"id":"bewaard"}]' });
  eq('D20 met "teruggezet"', [h.events, h.app()],
    [['vertraagd', 'toegepast'], { changed: ['ops-a'], touched: ['ops-a'], refresh: ['ops-a'], reverted: true }]);
  eq('D20 de bewaarde lijst is nooit overschreven of gewist', host.writes(), []);
  h.write('ops-b', 'x');
  await h.run(FLUSH_DELAY_MS);
  eq('D20 daarna staat het bewaren aan', host.writes(), [{ fn: 'set', key: 'ops-b', value: 'x' }]);
}
{
  // D21: nooit twee verzoeken tegelijk: een poging die blijft hangen, krijgt geen tweede ernaast.
  const host = fakeHost({ 'ops-a': 'host' }, { failGet: true });
  const h = harness({ host: host.settings });
  await h.sync.hydrate(1000);
  host.failGet(false);
  // Vanaf nu hangt `get`: houd de lezing vast.
  const held = fakeHost({ 'ops-a': 'host' }, { hold: true });
  host.settings.get = held.settings.get;
  await h.run(RETRY_DELAY_MS);
  eq('D21 de poging loopt', held.gets(), 6);
  h.sync.adoptLateHost(1000);
  eq('D21 geen tweede lezing ernaast', [held.gets(), h.timers.filter(t => t.ms === RETRY_DELAY_MS).length], [6, 0]);
  held.release();
  await settle();
  eq('D21 het antwoord komt toch aan', h.storage.snapshot(), { 'ops-a': 'host' });
  h.app();
}
{
  // D22: het plafond: na MAX_RETRIES nieuwe pogingen houdt de tool op. Geen schrijfactie, geen melding
  // over een lokale fout (de pop-up zei het al).
  const host = fakeHost({}, { failGet: true });
  const h = harness({ host: host.settings });
  await h.sync.hydrate(1000);
  for (let i = 0; i < MAX_RETRIES; i++) await h.run(RETRY_DELAY_MS);
  eq('D22 precies 1 + MAX_RETRIES lezingen', host.gets(), 6 * (1 + MAX_RETRIES));
  eq('D22 daarna geen poging meer gepland', h.timers.length, 0);
  eq('D22 uit, zonder lokale-foutmelding en zonder pop-uptoestand', [h.sync.unavailable(), h.sync.delayed(), h.events.at(-1)], [false, false, 'uit']);
  h.write('ops-a', 'x');
  await h.sync.flush();
  eq('D22 geen enkele schrijfactie', host.writes(), []);
  eq('D22 een late adopt start niets meer', (h.sync.adoptLateHost(1000), host.gets()), 6 * (1 + MAX_RETRIES));
}
{
  // D23: uitgesloten sleutels (de echte lijst): nooit gelezen, nooit teruggezet, nooit geschreven.
  const host = fakeHost({ 'ops-theme': 'dark', 'ops-mcpToken': 'van-de-host', 'ops-ext:demo:x': 'host' }, { hold: true });
  const h = harness({ host: host.settings, keys: [...HOST_PERSISTED_KEYS] });
  const pending = h.sync.hydrate(1000);
  await settle();
  await h.run(1000);
  await pending;
  for (const key of ['ops-mcpToken', 'ops-mcpPort', 'ops-downloadStats', 'ops-ext:demo:x']) h.write(key, 'lokaal');
  h.write('ops-theme', 'light');
  host.release();
  await settle();
  const asked = host.calls.filter(c => c.fn === 'get').map(c => c.key);
  check('D23 geen uitgesloten sleutel gelezen', asked.every(key => isHostPersistedKey(key)) && asked.length === HOST_PERSISTED_KEYS.length);
  eq('D23 uitgesloten sleutels blijven lokaal staan', ['ops-mcpToken', 'ops-mcpPort', 'ops-downloadStats', 'ops-ext:demo:x'].map(k => h.storage.getItem(k)),
    ['lokaal', 'lokaal', 'lokaal', 'lokaal']);
  eq('D23 alleen het thema gaat terug', h.app(),
    { changed: ['ops-theme'], touched: ['ops-theme'], refresh: ['ops-theme'], reverted: true });
  await h.run(FLUSH_DELAY_MS);
  await h.sync.flush();
  check('D23 geen uitgesloten sleutel naar de host', host.writes().every(c => isHostPersistedKey(c.key)));
}

// ── D24-D26. Review #833 ronde 1 (GPT-6.1-Sol): de late toepassing in de app ─────────────────────────
{
  // D24 (punt 1): het bewaren ging aan vóór de app klaar was. De taal werd eerst geladen (een download),
  // de taakgrid pas daarna. Een scrolltimer van vóór het antwoord liep tijdens die download af en zette
  // de oude kolombreedte terug, lokaal én bij de host. Hier met de echte store, de echte scrolltimer van
  // de taakgrid (120 ms), de echte `writeLocal` en `processLateSettings`, en een taaldownload die de
  // test vasthoudt.
  const { useAppStore } = await import('@/state/appStore');
  const { bootstrapTaskGridPreferences } = await import('@/state/taskGridBootstrap');
  const { createDefaultTaskGridPreferences } = await import('@/engine/taskGrid/preferences');
  const { processLateSettings } = await import('@/hooks/useSiteHostPreferences');
  const KEY = 'ops-taskGridPreferences';
  const state = useAppStore.getState();
  const prefs = (width: number) => {
    const p = createDefaultTaskGridPreferences({
      projectId: state.project.id,
      activityCodeTypeIds: state.activityCodeTypes.map(type => type.id),
      customFieldDefIds: state.customFieldDefs.map(def => def.id),
    });
    p.surfaces['full-task-grid'].columns[0].width = width;
    return p;
  };
  const widthOf = (text: string | null | undefined) =>
    (JSON.parse(text ?? 'null') as { surfaces: Record<string, { columns: { width: number }[] }> } | null)
      ?.surfaces['full-task-grid'].columns[0].width ?? null;
  const storeWidth = () => useAppStore.getState().taskGridSurfaces['full-task-grid'].columns[0].width;
  const lateNotices = () => useAppStore.getState().ui.notifications
    .filter(n => n.messageKey.startsWith('notifications.settingsLoadedLate')).map(n => n.messageKey);
  // Meldingen met dezelfde `dedupeKey` vouwen samen, en de stapel is begrensd: begin leeg.
  useAppStore.getState().setUI({ notifications: [] });
  const noticesBefore = lateNotices().length;
  browserStorage.setItem(KEY, JSON.stringify(prefs(60)));
  browserStorage.setItem('ops-locale', 'nl');
  useAppStore.getState().hydrateTaskGridPreferences(prefs(60));
  const host = fakeHost({ [KEY]: JSON.stringify(prefs(777)), 'ops-locale': 'nl' }, { hold: true });
  const h = harness({ storage: browserStorage, host: host.settings, keys: [KEY, 'ops-locale'] });
  const pending = h.sync.hydrate(1000);
  await settle();
  await h.run(1000);
  eq('D24 boven de grens', await pending, 'time-out');
  // Tijdens het wachten: de gebruiker kiest een taal en scrolt in de taakgrid. De scrolltimer leest de
  // store pas bij het aflopen.
  h.write('ops-locale', 'en');
  useAppStore.getState().setTaskGridScrollX('full-task-grid', 30);
  host.release();
  await settle();
  eq('D24 het antwoord staat lokaal; de store heeft nog de oude breedte', [widthOf(browserStorage.getItem(KEY)), storeWidth()], [777, 60]);
  // De echte `writeLocal`: een schrijfactie van de gebruiker op een sleutel die nog niet is toegepast,
  // valt weg; op een andere sleutel niet.
  writeLocal(KEY, JSON.stringify(prefs(61)));
  writeLocal('ops-mcpPort', '4100');
  eq('D24 writeLocal slaat de vastgehouden sleutel over, de rest niet',
    [widthOf(browserStorage.getItem(KEY)), browserStorage.getItem('ops-mcpPort')], [777, '4100']);

  let finishLocale!: () => void;
  let localeCalls = 0;
  const done = processLateSettings(useAppStore.getState().setUI, async () => { await bootstrapTaskGridPreferences(useAppStore); }, {
    take: () => h.sync.takeApplied(),
    settle: keys => h.sync.settle(keys),
    release: () => h.sync.release(),
    initLocale: () => { localeCalls++; return new Promise<void>(resolve => { finishLocale = resolve; }); },
    language: () => 'en',
  });
  await settle();
  eq('D24 de taal wordt geladen, de download loopt nog', localeCalls, 1);
  // Langer dan de scrolltimer (120 ms): in de oude volgorde liep hij hier af.
  await new Promise(resolve => setTimeout(resolve, 200));
  await settle();
  eq('D24 tijdens de download: de taakgrid staat al goed, lokaal en in de store', [widthOf(browserStorage.getItem(KEY)), storeWidth()], [777, 777]);
  eq('D24 tijdens de download: de taal is nog vastgehouden, de taakgrid niet meer', [h.sync.writeHeld('ops-locale'), h.sync.writeHeld(KEY)], [true, false]);
  await h.run(FLUSH_DELAY_MS);
  await h.sync.flush();
  eq('D24 tijdens de download: nog niets naar de host', host.writes(), []);
  eq('D24 tijdens de download: nog geen melding', lateNotices().length, noticesBefore);
  finishLocale();
  await done;
  await new Promise(resolve => setTimeout(resolve, 200));
  await h.run(FLUSH_DELAY_MS);
  await h.sync.flush();
  eq('D24 eindstand: store, lokaal en host hebben de breedte van de host',
    [storeWidth(), widthOf(browserStorage.getItem(KEY)), widthOf(host.stored()[KEY] as string)], [777, 777, 777]);
  eq('D24 geen schrijfactie naar de host met de oude waarde (de taal was al gelijk)', host.writes(), []);
  eq('D24 één melding, ná het vrijgeven, met "teruggezet" (de taal ging terug)', lateNotices().slice(noticesBefore),
    ['notifications.settingsLoadedLateReverted']);
  browserStorage.removeItem('ops-mcpPort');
}
{
  // D25 (punt 2): een laat antwoord met dezelfde opgeslagen tekst als wat de gebruiker koos. Een gewone
  // start met dit antwoord geeft het thema en de taal van de host (`thema: dark`, `taal: fr`), want
  // die gaan voor. De app moet ze dus opnieuw toepassen, ook al veranderde er lokaal niets.
  const { useAppStore } = await import('@/state/appStore');
  const { processLateSettings } = await import('@/hooks/useSiteHostPreferences');
  const host = fakeHost({ 'ops-theme': 'light', 'ops-locale': 'en' }, { hold: true });
  setHosts({ thema: 'dark', taal: 'fr', settings: host.settings });
  browserStorage.setItem('ops-theme', 'light');
  browserStorage.setItem('ops-locale', 'en');
  const h = harness({ storage: browserStorage, host: host.settings, keys: ['ops-theme', 'ops-locale'] });
  const pending = h.sync.hydrate(1000);
  await settle();
  await h.run(1000);
  eq('D25 boven de grens', await pending, 'time-out');
  const themeNotices = () => useAppStore.getState().ui.notifications.filter(n => n.messageKey === 'notifications.hostThemeUntilRestart').length;
  const lateNotices = () => useAppStore.getState().ui.notifications
    .filter(n => n.messageKey.startsWith('notifications.settingsLoadedLate')).map(n => n.messageKey);
  // De start gaf het thema van de host; de gebruiker kiest licht en Engels (gelijk aan de bewaarde waarden).
  useAppStore.getState().setUI({ uiTheme: 'dark' });
  useAppStore.getState().setUI({ uiTheme: 'light' });
  h.write('ops-theme', 'light');
  let language = 'en';
  h.write('ops-locale', 'en');
  useAppStore.getState().setUI({ notifications: [] });
  const themeNoticesBefore = themeNotices();
  const noticesBefore = lateNotices().length;
  host.release();
  await settle();
  const seen: { applied: import('@/services/fileAccess/siteHostSettings').LateSettingsApplied | null } = { applied: null };
  let localeCalls = 0;
  await processLateSettings(useAppStore.getState().setUI, undefined, {
    take: () => (seen.applied = h.sync.takeApplied()),
    settle: keys => h.sync.settle(keys),
    release: () => h.sync.release(),
    // Zoals de echte `initLocale` ingebed: de taal van de host.
    initLocale: async () => { localeCalls++; language = 'fr'; },
    language: () => language,
  });
  eq('D25 de opgeslagen waarden bleven gelijk, maar ze moeten opnieuw', [seen.applied?.changed, seen.applied?.refresh], [[], ['ops-locale', 'ops-theme']]);
  eq('D25 het thema van de host wint weer, zoals bij een gewone start', useAppStore.getState().ui.uiTheme, 'dark');
  eq('D25 de taal is opnieuw gezet (de taal van de host)', [localeCalls, language], [1, 'fr']);
  eq('D25 lokaal blijft de bewaarde keuze', [browserStorage.getItem('ops-theme'), browserStorage.getItem('ops-locale')], ['light', 'en']);
  eq('D25 de melding zegt "teruggezet": de keuze van de gebruiker ging terug', lateNotices().slice(noticesBefore),
    ['notifications.settingsLoadedLateReverted']);
  eq('D25 geen themamelding (#835): het late antwoord is geen keuze van de gebruiker', themeNotices(), themeNoticesBefore);
  await h.run(FLUSH_DELAY_MS);
  await h.sync.flush();
  eq('D25 niets naar de host: lokaal is gelijk aan de host', host.writes(), []);
  setHosts();
}
{
  // D26 (punt 3): één sleutel wijst af terwijl een andere nog hangt. Vroeger gaf `Promise.all` de poging
  // meteen vrij, en de nieuwe poging vroeg de hangende sleutel nog een keer: twee verzoeken tegelijk.
  const gets: string[] = [];
  const pendingB: (() => void)[] = [];
  let inFlightB = 0;
  let maxInFlightB = 0;
  const settings: SiteHostSettings = {
    get: (key) => {
      gets.push(key);
      if (key === 'ops-a') return Promise.reject(new Error('netwerk'));
      if (key === 'ops-b') {
        inFlightB++;
        maxInFlightB = Math.max(maxInFlightB, inFlightB);
        return new Promise(resolve => { pendingB.push(() => { inFlightB--; resolve('host-b'); }); });
      }
      return Promise.resolve(null);
    },
    set: async () => null,
    delete: async () => null,
  };
  const count = (key: string) => gets.filter(k => k === key).length;
  const h = harness({ host: settings, keys: ['ops-a', 'ops-b', 'ops-c'] });
  eq('D26 één afwijzing: de start wacht niet op het verzoek dat nog hangt', await h.sync.hydrate(1000), 'fout');
  eq('D26 de pop-up hoort open', [h.sync.delayed(), h.events], [true, ['vertraagd']]);
  eq('D26 de poging loopt nog: nog geen nieuwe gepland', h.timers.filter(t => t.ms === RETRY_DELAY_MS).length, 0);
  // 30 s later hangt `ops-b` nog steeds: geen nieuwe poging, dus geen tweede verzoek voor `ops-b`.
  await h.run(RETRY_DELAY_MS);
  h.sync.adoptLateHost(1000);
  await settle();
  eq('D26 geen tweede verzoek ernaast', [count('ops-a'), count('ops-b'), count('ops-c')], [1, 1, 1]);
  eq('D26 hoogstens één verzoek tegelijk voor de hangende sleutel', maxInFlightB, 1);
  for (const resolve of pendingB.splice(0)) resolve();
  await settle();
  eq('D26 pas als elk verzoek klaar is: een nieuwe poging over 30 s', h.timers.filter(t => t.ms === RETRY_DELAY_MS).length, 1);
  await h.run(RETRY_DELAY_MS);
  eq('D26 de nieuwe poging vraagt elke sleutel één keer', [count('ops-a'), count('ops-b'), count('ops-c')], [2, 2, 2]);
  eq('D26 nooit twee verzoeken tegelijk voor dezelfde sleutel', maxInFlightB, 1);
  for (const resolve of pendingB.splice(0)) resolve();
  await settle();
  eq('D26 één pop-up, en na de tweede afwijzing weer één poging gepland', [h.events, h.timers.filter(t => t.ms === RETRY_DELAY_MS).length], [['vertraagd'], 1]);
}

// ── E. De echte keten: writeLocal/removeLocal → de host uit S1 ─────────────────────────────────────
{
  setHosts({ thema: 'light', settings: s1Host.settings });
  // De echte instantie las de host van S1 bij de start; een tweede lezing doet niets.
  eq('E0 een tweede hydrate leest niet opnieuw', await hydrateSiteHostSettings(200), 'al-geladen');
  // Wat eerdere secties via de echte keten schreven (bijv. `loadAllSettings` in D24), eerst wegschrijven.
  await flushSiteHostSettings();
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
