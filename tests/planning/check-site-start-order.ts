import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

type AnyRecord = Record<string, unknown>;
const g = globalThis as unknown as AnyRecord;

let failures = 0;
function check(name: string, cond: boolean): void {
  if (cond) console.log(`ok ${name}`);
  else { failures++; console.log(`XX ${name}`); }
}
function eq(name: string, actual: unknown, expected: unknown): void {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  check(same ? name : `${name}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`, same);
}
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
async function waitFor(cond: () => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (cond()) return true; await new Promise((r) => setTimeout(r, 10)); }
  return cond();
}

const root = process.cwd();
const work = path.join(root, 'node_modules', '.cache', 'ops-check-site-start-order');
fs.mkdirSync(work, { recursive: true });
const stubApp = path.join(work, 'App.tsx');
fs.writeFileSync(stubApp, [
  "import { useAppStore } from '@/state/appStore';",
  '(globalThis as Record<string, unknown>).__startOrderStore = useAppStore;',
  'export default function App() { return null; }',
  '',
].join('\n'));
const stubReactDom = path.join(work, 'react-dom-client.ts');
fs.writeFileSync(stubReactDom, [
  'export function createRoot() { return { render() { (globalThis as Record<string, unknown>).__startOrderRendered = true; } }; }',
  'export default { createRoot };',
  '',
].join('\n'));
const outfile = path.join(work, 'main.mjs');

const require = createRequire(path.join(root, 'package.json'));
const esbuild = require('esbuild') as typeof import('esbuild');
await esbuild.build({
  entryPoints: [path.join(root, 'src/main.tsx')],
  outfile,
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent', jsx: 'automatic',
  alias: { '@': path.join(root, 'src') },
  loader: { '.css': 'empty', '.png': 'empty', '.svg': 'empty', '.woff': 'empty', '.woff2': 'empty', '.ttf': 'empty', '.wasm': 'empty' },
  define: {
    'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'platform', BASE_URL: '/', VITE_OPS_PLATFORM: '1' }),
    '__APP_VERSION__': '"0.0.0"',
    '__OPS_DEV_INSTANCE__': '""',
    'process.env.NODE_ENV': '"production"',
  },
  plugins: [{
    name: 'ops-start-order-stubs',
    setup(build) {
      build.onResolve({ filter: /^\.\/App$/ }, (args) => (args.importer.endsWith(path.join('src', 'main.tsx')) ? { path: stubApp } : undefined));
      build.onResolve({ filter: /^react-dom\/client$/ }, () => ({ path: stubReactDom }));
      build.onResolve({ filter: /\?url$/ }, () => ({ path: 'data:text/plain,', external: true }));
    },
  }],
});

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
const storage = new MemoryStorage();
const listeners: Record<string, ((event: unknown) => void)[]> = {};
const held: (() => void)[] = [];
const hostValues: Record<string, string> = { 'ops-constructionMode': 'false' };
const hostCalls: string[] = [];
const win: AnyRecord = {
  location: { search: '', hash: '', href: 'http://localhost/tools/planner/', origin: 'http://localhost', pathname: '/tools/planner/' },
  addEventListener: (type: string, fn: (event: unknown) => void) => { (listeners[type] ??= []).push(fn); },
  removeEventListener: () => undefined,
  dispatchEvent: (event: { type: string }) => { for (const fn of listeners[event.type] ?? []) fn(event); return true; },
  matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
  localStorage: storage,
  sessionStorage: new MemoryStorage(),
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  openaecHost: {
    taal: 'nl',
    thema: 'light',
    settings: {
      get: (key: string) => {
        hostCalls.push(`get ${key}`);
        return new Promise((resolve) => { held.push(() => resolve(hostValues[key] ?? null)); });
      },
      set: (key: string) => { hostCalls.push(`set ${key}`); return Promise.resolve(null); },
      delete: (key: string) => { hostCalls.push(`delete ${key}`); return Promise.resolve(null); },
    },
  },
};
win.window = win;
win.self = win;
win.parent = win;
win.top = win;
g.window = win;
Object.defineProperty(g, 'localStorage', { configurable: true, writable: true, value: storage });
Object.defineProperty(g, 'sessionStorage', { configurable: true, writable: true, value: win.sessionStorage });
g.document = {
  documentElement: { dir: 'ltr', lang: 'nl', setAttribute: () => undefined, removeAttribute: () => undefined, style: {} },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  getElementById: () => ({}),
  visibilityState: 'visible',
};
g.addEventListener = win.addEventListener;
g.removeEventListener = win.removeEventListener;
g.dispatchEvent = win.dispatchEvent;
g.matchMedia = win.matchMedia;

type SiteApp = { definitions(): Promise<{ name: string }[]> };
const siteApp = () => win.__OPDS_APP__ as SiteApp | undefined;
const store = () => g.__startOrderStore as { getState(): { calendar: { name: string; holidays: unknown[] } } } | undefined;

await import(pathToFileURL(outfile).href);
check('1a de start vraagt de instellingen bij de host op', await waitFor(() => held.length > 0, 2_000));
for (let i = 0; i < 20; i++) await tick();
check('1b tijdens de hostlezing staat window.__OPDS_APP__ er nog niet', siteApp() === undefined);
check('1c tijdens de hostlezing is de app er nog niet', store() === undefined && g.__startOrderRendered === undefined);
const early = siteApp();
if (early) {
  try { await early.definitions(); } catch { }
}

for (const release of held.splice(0)) release();
check('2a de app start na het antwoord van de host', await waitFor(() => store() !== undefined && g.__startOrderRendered === true, 5_000));
check('2b window.__OPDS_APP__ staat er na de hostlezing', siteApp() !== undefined);
const names = siteApp() ? (await siteApp()!.definitions()).map((definition) => definition.name) : [];
check('2c definitions() geeft de planner-tools', names.includes('planner_list_tasks'));
eq('2d de bouwmodus van de host staat in localStorage', storage.getItem('ops-constructionMode'), 'false');
const calendar = store()?.getState().calendar;
eq('2e de startkalender volgt de bouwmodus van de host', [calendar?.name, calendar?.holidays.length], ['Standaardkalender', 0]);
check('2f de start schreef niets naar de host', !hostCalls.some((call) => !call.startsWith('get ')));

if (failures === 0) console.log('OK: startvolgorde van de platformbouw met een host — alles groen');
else console.log(`XX startvolgorde van de platformbouw met een host — ${failures} rood`);
process.exit(failures === 0 ? 0 : 1);
