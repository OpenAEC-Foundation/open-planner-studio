import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { THEME_MIGRATION, peekTheme } from '@/utils/settingsStore';
import { OA_THEME_FOR, resolveUITheme } from '@/utils/theme';
import { SITE_HOST_THEMES } from '@/services/fileAccess/siteHostPreferences';

let failures = 0;
function check(name: string, cond: boolean): void {
  if (!cond) {
    failures++;
    console.error(`XX ${name}`);
  } else {
    console.log(`ok ${name}`);
  }
}

const indexHtmlPath = path.join(process.cwd(), 'index.html');
const indexHtmlSource = fs.readFileSync(indexHtmlPath, 'utf8');
const prepaintPath = path.join(process.cwd(), 'public/theme-prepaint.js');
const indexHtml = fs.readFileSync(prepaintPath, 'utf8');

function withoutComments(html: string): string {
  let previous: string;
  let current = html;
  do {
    previous = current;
    current = current.replace(/<!--[\s\S]*?-->/g, '');
  } while (current !== previous);
  return current;
}
const htmlNoComments = withoutComments(indexHtmlSource);
const scriptTags = [...htmlNoComments.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)];
check('index.html heeft scripttags', scriptTags.length > 0);
for (const [, attrs, body] of scriptTags) {
  check(`index.html: script met src en zonder inline code (${attrs.trim()})`, /\ssrc="[^"]+"/.test(attrs) && body.trim() === '');
}
const head = /<head>([\s\S]*?)<\/head\s*>/i.exec(htmlNoComments)?.[1] ?? '';
const prepaintTag = /<script\b([^>]*)\ssrc="\/theme-prepaint\.js"([^>]*)>/i.exec(head);
check('index.html laadt /theme-prepaint.js in <head>', prepaintTag !== null);
check(
  'het pre-paint-script is klassiek en blokkerend (geen type="module", async of defer)',
  prepaintTag !== null && !/\b(type|async|defer)\b/.test(prepaintTag[1] + prepaintTag[2]),
);
check(
  'geen inline script meer in index.html (de oude `var map = {...}` staat er niet meer)',
  !/var\s+map\s*=/.test(indexHtmlSource),
);

const mapMatch = /var\s+map\s*=\s*(\{[\s\S]*?\});/.exec(indexHtml);
check('theme-prepaint.js: de pre-paint-themamap (`var map = {...}`) is gevonden', mapMatch !== null);

let indexHtmlMap: Record<string, string> = {};
if (mapMatch) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- geïsoleerde literal, zie boven
    indexHtmlMap = new Function(`"use strict"; return (${mapMatch[1]});`)() as Record<string, string>;
  } catch (err) {
    check(`theme-prepaint.js: de gevonden themamap kon geparsed worden (${(err as Error).message})`, false);
  }
}

const indexHtmlKeys = Object.keys(indexHtmlMap).sort();
const migrationKeys = Object.keys(THEME_MIGRATION).sort();

check(
  `theme-prepaint.js en THEME_MIGRATION hebben dezelfde sleutels ` +
    `(theme-prepaint.js: [${indexHtmlKeys.join(', ')}], THEME_MIGRATION: [${migrationKeys.join(', ')}])`,
  JSON.stringify(indexHtmlKeys) === JSON.stringify(migrationKeys),
);

for (const key of migrationKeys) {
  if (!(key in indexHtmlMap)) continue;
  check(
    `sleutel '${key}': theme-prepaint.js geeft '${indexHtmlMap[key]}', THEME_MIGRATION geeft '${THEME_MIGRATION[key]}'`,
    indexHtmlMap[key] === THEME_MIGRATION[key],
  );
}

const oaMatch = /var\s+oaTheme\s*=\s*(\{[^}]*\});/.exec(indexHtml);
check('theme-prepaint.js: de pre-paint-map naar data-oa-theme (`var oaTheme = {...}`) is gevonden', oaMatch !== null);
if (oaMatch) {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- geïsoleerde literal, zie boven
  const oaMap = new Function(`"use strict"; return (${oaMatch[1]});`)() as Record<string, string>;
  check(
    `theme-prepaint.js oaTheme gelijk aan OA_THEME_FOR (theme-prepaint.js: ${JSON.stringify(oaMap)}, ` +
      `OA_THEME_FOR: ${JSON.stringify(OA_THEME_FOR)})`,
    JSON.stringify(Object.entries(oaMap).sort()) === JSON.stringify(Object.entries(OA_THEME_FOR).sort()),
  );
}
check(
  'theme-prepaint.js zet data-oa-theme naast data-theme vóór de eerste paint',
  /setAttribute\('data-oa-theme'/.test(indexHtml),
);

check(
  "theme-prepaint.js: de initiële/fallback-waarde van `theme` is 'dark'",
  /var\s+theme\s*=\s*'dark'/.test(indexHtml),
);
check(
  "settingsStore.ts: initTheme()/peekTheme() vallen terug op 'dark' via `?? 'dark'`",
  (() => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/utils/settingsStore.ts'),
      'utf8',
    );
    const occurrences = (src.match(/THEME_MIGRATION\[saved\]\s*\?\?\s*'dark'/g) ?? []).length;
    return occurrences === 2;
  })(),
);

const hostMatch = /var\s+hostThemes\s*=\s*(\[[^\]]*\]);/.exec(indexHtml);
check('theme-prepaint.js: de lijst `var hostThemes = [...]` is gevonden', hostMatch !== null);
if (hostMatch) {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- geïsoleerde literal, zie boven
  const list = new Function(`"use strict"; return (${hostMatch[1]});`)() as string[];
  check(
    `theme-prepaint.js hostThemes gelijk aan SITE_HOST_THEMES (${JSON.stringify(list)} / ${JSON.stringify(SITE_HOST_THEMES)})`,
    JSON.stringify(list) === JSON.stringify([...SITE_HOST_THEMES]),
  );
}

interface Scenario {
  name: string;
  saved?: string;
  own?: unknown;
  parent?: unknown;
  parentThrows?: boolean;
  tauri?: boolean;
  storageThrows?: boolean;
  prefersDark?: boolean;
}
const SCENARIOS: Scenario[] = [
  { name: 'geen host, niets bewaard' },
  { name: 'geen host, bewaard light', saved: 'light' },
  { name: 'geen host, legacy highContrast', saved: 'highContrast' },
  { name: 'geen host, system en donker OS', saved: 'system', prefersDark: true },
  { name: 'geen host, system en licht OS', saved: 'system', prefersDark: false },
  { name: 'host light wint van bewaard dark', saved: 'dark', own: { thema: 'light' } },
  { name: 'host dark wint van bewaard light', saved: 'light', own: { thema: 'dark' } },
  { name: 'host zonder thema: bewaarde keuze', saved: 'light', own: { taal: 'de' } },
  { name: 'host met onbekend thema: bewaarde keuze', saved: 'light', own: { thema: 'blue' } },
  { name: 'host high-contrast telt niet', saved: 'light', own: { thema: 'high-contrast' } },
  { name: 'host op de parent', saved: 'dark', parent: { thema: 'light' } },
  { name: 'eigen host gaat voor de parent', parent: { thema: 'dark' }, own: { thema: 'light' } },
  { name: 'eigen host zonder thema, parent met thema', own: {}, parent: { thema: 'light' } },
  { name: 'cross-origin parent gooit', saved: 'light', parentThrows: true },
  { name: 'Tauri negeert een host', saved: 'light', own: { thema: 'dark' }, tauri: true },
  { name: 'opaque origin zonder opslag, host light', storageThrows: true, own: { thema: 'light' } },
  { name: 'opaque origin zonder opslag, geen host', storageThrows: true },
];

function fakeStorage(saved: string | undefined, throws: boolean) {
  if (throws) return undefined;
  return {
    getItem: (key: string) => (key === 'ops-theme' && saved !== undefined ? saved : null),
    setItem: () => { },
    removeItem: () => { },
  };
}

function fakeWindow(sc: Scenario): Record<string, unknown> {
  const win: Record<string, unknown> = {
    location: { search: '', hash: '' },
    matchMedia: (q: string) => ({ matches: q.includes('dark') ? sc.prefersDark === true : false }),
  };
  if (sc.own !== undefined) win.openaecHost = sc.own;
  if (sc.tauri) win.__TAURI_INTERNALS__ = {};
  if (sc.parentThrows) {
    Object.defineProperty(win, 'parent', { get: () => ({ get openaecHost() { throw new Error('SecurityError'); } }) });
  } else if (sc.parent !== undefined) {
    win.parent = { openaecHost: sc.parent };
  } else {
    win.parent = win;
  }
  return win;
}

function runPrepaint(sc: Scenario): string | null {
  const attrs: Record<string, string> = {};
  const win = fakeWindow(sc);
  const context: Record<string, unknown> = {
    window: win,
    document: { documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } } },
  };
  if (sc.storageThrows) {
    Object.defineProperty(context, 'localStorage', { get: () => { throw new Error('SecurityError'); } });
  } else {
    context.localStorage = fakeStorage(sc.saved, false);
  }
  vm.runInNewContext(indexHtml, context);
  return attrs['data-theme'] ?? null;
}

function runPeek(sc: Scenario): string {
  const g = globalThis as Record<string, unknown>;
  const win = fakeWindow(sc);
  g.window = win;
  if (sc.storageThrows) {
    Object.defineProperty(g, 'localStorage', { configurable: true, get: () => { throw new Error('SecurityError'); } });
  } else {
    Object.defineProperty(g, 'localStorage', { configurable: true, writable: true, value: fakeStorage(sc.saved, false) });
  }
  try {
    return resolveUITheme(peekTheme(), sc.prefersDark === true);
  } finally {
    delete g.window;
    delete g.localStorage;
  }
}

for (const sc of SCENARIOS) {
  const fromScript = runPrepaint(sc);
  const fromTs = runPeek(sc);
  check(`gedrag '${sc.name}': theme-prepaint.js geeft '${fromScript}', peekTheme() geeft '${fromTs}'`, fromScript === fromTs);
}

if (failures > 0) {
  console.error(`\nTOTAAL: ${failures} afwijking(en)`);
  process.exitCode = 1;
} else {
  console.log('\nTOTAAL: alles groen');
}
