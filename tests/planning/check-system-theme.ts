import './domStub';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { UI_THEMES } from '@/state/slices/types';
import type { UITheme } from '@/state/slices/types';
import { initTheme, peekTheme } from '@/utils/settingsStore';
import {
  OA_THEME_FOR,
  SYSTEM_DARK_QUERY,
  detectSystemPrefersDark,
  resolveUITheme,
  subscribeSystemPrefersDark,
} from '@/utils/theme';

let failures = 0;
const ok = (condition: boolean, message: string) => {
  if (!condition) {
    console.log(`XX  ${message}`);
    failures++;
  }
};

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

const g = globalThis as unknown as Record<string, unknown>;
const originalWindow = g.window;

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

g.window = { matchMedia: () => ({ matches: false }) };
let apiloosThrew = false;
try {
  subscribeSystemPrefersDark(() => { failures++; })();
} catch {
  apiloosThrew = true;
}
ok(!apiloosThrew, 'een matchMedia zonder listener-API levert een stille no-op');

if (originalWindow === undefined) delete g.window; else g.window = originalWindow;

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

const repoFile = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8');
const indexHtml = repoFile('public/theme-prepaint.js');
ok(/'system':\s*'system'/.test(indexHtml), 'het pre-paint-script kent de systeemvoorkeur');
ok(
  indexHtml.includes(`matchMedia('${SYSTEM_DARK_QUERY}')`),
  'het pre-paint-script gebruikt exact dezelfde prefers-color-scheme-query als resolveUITheme',
);
ok(
  /theme\s*=\s*dark\s*\?\s*'dark'\s*:\s*'light'/.test(indexHtml),
  'het pre-paint-script lost systeem op zoals resolveUITheme (donker⇒dark, anders light)',
);

const globalsCss = repoFile('src/styles/globals.css');
for (const { id } of UI_THEMES) {
  const resolved = resolveUITheme(id as UITheme, false);
  const oa = OA_THEME_FOR[resolved];
  ok(
    globalsCss.includes(`[data-oa-theme="${oa}"] {`) || globalsCss.includes(`[data-theme="${resolved}"] {`),
    `themakeuze ${id} lost op naar een bestaand [data-oa-theme="${oa}"]- of [data-theme="${resolved}"]-blok`,
  );
}

{
  const hostWindow: Record<string, unknown> = { matchMedia: () => ({ matches: false }) };
  hostWindow.parent = hostWindow;
  g.window = hostWindow;
  const { useAppStore } = await import('@/state/appStore');
  const { applyTheme } = await import('@/components/settings/applySetting');
  const { hostThemeWinsNextStart } = await import('@/utils/settingsStore');
  const notices = () => useAppStore.getState().ui.notifications
    .filter(n => n.messageKey === 'notifications.hostThemeUntilRestart');
  useAppStore.getState().setUI({ uiTheme: 'dark' });

  ok(hostThemeWinsNextStart(null, 'light'), 'hostthema zonder dev-link ⇒ de host wint bij de volgende start');
  ok(!hostThemeWinsNextStart('dark', 'light'), 'dev-link-thema ⇒ de host wint niet, dus geen melding');
  ok(!hostThemeWinsNextStart(null, null), 'geen hostthema ⇒ geen melding');

  applyTheme('light');
  ok(notices().length === 0, 'zonder host: geen melding');
  ok(localStorage.getItem('ops-theme') === 'light', 'zonder host: de keuze wordt bewaard zoals altijd');

  hostWindow.openaecHost = { taal: 'nl' };
  applyTheme('dark');
  ok(notices().length === 0, 'host zonder thema: geen melding');
  hostWindow.openaecHost = { thema: 'blauw' };
  applyTheme('light');
  ok(notices().length === 0, 'host met een ongeldig thema: geen melding');

  hostWindow.openaecHost = { thema: 'dark' };
  useAppStore.getState().setUI({ uiTheme: 'dark' });
  ok(notices().length === 0, 'een wissel van de host (setUI): geen melding');
  applyTheme('dark');
  ok(notices().length === 0, 'het actieve thema opnieuw kiezen is geen wissel: geen melding');

  applyTheme('high-contrast');
  const first = notices();
  ok(first.length === 1 && first[0].severity === 'info' && first[0].count === 1,
    'eerste themawissel door de gebruiker met hostthema: één infomelding');
  ok(useAppStore.getState().ui.uiTheme === 'high-contrast' && localStorage.getItem('ops-theme') === 'high-contrast',
    'met hostthema: de keuze geldt nu en wordt bewaard zoals altijd');

  applyTheme('light');
  applyTheme('system');
  const after = notices();
  ok(after.length === 1 && after[0].count === 1, 'een volgende wissel geeft geen tweede melding');

  localStorage.clear();
  if (originalWindow === undefined) delete g.window; else g.window = originalWindow;
}

if (failures > 0) {
  console.log(`system-theme: ${failures} faalregels`);
  process.exit(1);
}
console.log('system-theme: alles groen');
