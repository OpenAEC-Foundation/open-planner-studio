import './domStub';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { UI_THEMES } from '@/state/slices/types';
import type { UITheme } from '@/state/slices/types';
import { initTheme, peekTheme } from '@/utils/settingsStore';
import {
  SYSTEM_DARK_QUERY,
  detectSystemPrefersDark,
  resolveUITheme,
  subscribeSystemPrefersDark,
} from '@/utils/theme';

// Thema "Systeem" (volg het OS-kleurschema). Drie dingen die stil kapot kunnen gaan en die deze
// batterij daarom vastlegt:
//  1. de resolutie zelf — 'system' mag NOOIT als `data-theme` naar buiten lekken;
//  2. de opslag — 'system' is een geldige voorkeur en mag niet door de 7→3-legacymigratie naar
//     'dark' worden weggemigreerd;
//  3. de pre-paint-spiegel in index.html — die is een handmatige kopie van `resolveUITheme`, dus
//     een bronvergelijking is de enige poort die divergentie (= themaflits bij het opstarten) ziet.

let failures = 0;
const ok = (condition: boolean, message: string) => {
  if (!condition) {
    console.log(`XX  ${message}`);
    failures++;
  }
};

// --- 1. Resolutie -----------------------------------------------------------------------------
ok(resolveUITheme('system', true) === 'dark', 'systeem + donker OS ⇒ dark');
ok(resolveUITheme('system', false) === 'light', 'systeem + licht OS ⇒ light');
for (const prefersDark of [true, false]) {
  for (const fixed of ['dark', 'light', 'high-contrast'] as const) {
    ok(
      resolveUITheme(fixed, prefersDark) === fixed,
      `expliciete keuze ${fixed} negeert het systeem (prefersDark=${prefersDark})`,
    );
  }
}

// --- 2. Detectie en abonnement ----------------------------------------------------------------
const g = globalThis as unknown as Record<string, unknown>;
const originalWindow = g.window;

// Geen window/matchMedia (headless, oude webview) ⇒ false, net als "geen voorkeur" in de CSS-spec.
delete g.window;
ok(detectSystemPrefersDark() === false, 'zonder window valt detectie terug op licht');
let noWindowThrew = false;
try {
  subscribeSystemPrefersDark(() => { failures++; })();
} catch {
  noWindowThrew = true;
}
ok(!noWindowThrew, 'abonneren en opzeggen zonder window gooit niet');

type Listener = (e: { matches: boolean }) => void;
const listeners = new Set<Listener>();
let queriedWith: string | null = null;
let matches = true;
g.window = {
  matchMedia: (query: string) => {
    queriedWith = query;
    return {
      get matches() { return matches; },
      addEventListener: (_type: string, fn: Listener) => { listeners.add(fn); },
      removeEventListener: (_type: string, fn: Listener) => { listeners.delete(fn); },
    };
  },
};

ok(detectSystemPrefersDark() === true, 'detectie leest matchMedia uit');
ok(queriedWith === SYSTEM_DARK_QUERY, 'detectie gebruikt de gedeelde prefers-color-scheme-query');

const seen: boolean[] = [];
const unsubscribe = subscribeSystemPrefersDark(v => { seen.push(v); });
ok(listeners.size === 1, 'abonnement registreert één listener');
for (const fn of listeners) fn({ matches: false });
ok(seen.length === 1 && seen[0] === false, 'een systeemwissel bereikt de callback');
unsubscribe();
ok(listeners.size === 0, 'opzeggen verwijdert de listener');

matches = false;
ok(detectSystemPrefersDark() === false, 'detectie volgt de actuele matchMedia-stand');

// Oude WKWebView (macOS < 11): alleen de verouderde addListener/removeListener. Zonder terugval
// zou het thema daar alleen bij het opstarten kloppen en niet live meebewegen.
const legacyListeners = new Set<Listener>();
g.window = {
  matchMedia: () => ({
    matches: false,
    addListener: (fn: Listener) => { legacyListeners.add(fn); },
    removeListener: (fn: Listener) => { legacyListeners.delete(fn); },
  }),
};
const legacySeen: boolean[] = [];
const unsubscribeLegacy = subscribeSystemPrefersDark(v => { legacySeen.push(v); });
ok(legacyListeners.size === 1, 'oude webview: abonnement valt terug op addListener');
for (const fn of legacyListeners) fn({ matches: true });
ok(legacySeen.length === 1 && legacySeen[0] === true, 'oude webview: een systeemwissel bereikt de callback');
unsubscribeLegacy();
ok(legacyListeners.size === 0, 'oude webview: opzeggen gebruikt removeListener');

// Een MediaQueryList zonder énige listener-API mag stil zijn, niet gooien.
g.window = { matchMedia: () => ({ matches: false }) };
let apiloosThrew = false;
try {
  subscribeSystemPrefersDark(() => { failures++; })();
} catch {
  apiloosThrew = true;
}
ok(!apiloosThrew, 'een matchMedia zonder listener-API levert een stille no-op');

if (originalWindow === undefined) delete g.window; else g.window = originalWindow;

// --- 3. Opslag --------------------------------------------------------------------------------
localStorage.clear();
ok(peekTheme() === 'dark', 'zonder opgeslagen voorkeur blijft donker de default');
ok(await initTheme() === 'dark', 'initTheme houdt donker als default');

localStorage.setItem('ops-theme', 'system');
ok(peekTheme() === 'system', 'peekTheme houdt de systeemvoorkeur intact');
ok(await initTheme() === 'system', 'initTheme migreert de systeemvoorkeur niet weg');
ok(localStorage.getItem('ops-theme') === 'system', 'de systeemvoorkeur blijft ongewijzigd opgeslagen');

localStorage.setItem('ops-theme', 'warm-ember');
ok(await initTheme() === 'dark', 'een legacythema migreert nog steeds naar donker');
localStorage.clear();

// --- 4. Bronpoorten: pre-paint-spiegel en CSS-blokken -------------------------------------------
const repoFile = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8');
const indexHtml = repoFile('index.html');
ok(/'system':\s*'system'/.test(indexHtml), 'het pre-paint-script kent de systeemvoorkeur');
ok(
  indexHtml.includes(`matchMedia('${SYSTEM_DARK_QUERY}')`),
  'het pre-paint-script gebruikt exact dezelfde prefers-color-scheme-query als resolveUITheme',
);
ok(
  /theme\s*=\s*dark\s*\?\s*'dark'\s*:\s*'light'/.test(indexHtml),
  'het pre-paint-script lost systeem op zoals resolveUITheme (donker⇒dark, anders light)',
);

// Elke keuze uit UI_THEMES moet ná resolutie een echt CSS-blok hebben; anders levert de kaart een
// thema op dat niets tekent. Dat 'system' zelf nooit als data-theme naar buiten kan lekken bewaakt
// de compiler al: `ResolvedUITheme` = `Exclude<UITheme, 'system'>` (een runtime-vergelijking
// daarop is dode code, TS2367).
const globalsCss = repoFile('src/styles/globals.css');
for (const { id } of UI_THEMES) {
  const resolved = resolveUITheme(id as UITheme, false);
  ok(
    globalsCss.includes(`[data-theme="${resolved}"]`),
    `themakeuze ${id} lost op naar een bestaand [data-theme="${resolved}"]-blok`,
  );
}

if (failures > 0) {
  console.log(`system-theme: ${failures} faalregels`);
  process.exit(1);
}
console.log('system-theme: alles groen');
