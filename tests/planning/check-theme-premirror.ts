/**
 * Contract-check voor de pre-paint-themaspiegel (issue #61, #818).
 *
 * `public/theme-prepaint.js` is een klein klassiek script dat `index.html` blokkerend in `<head>` laadt.
 * Het zet vóór de eerste React-paint alvast `data-theme` op `<html>`, om de thema-flits te voorkomen die
 * zou ontstaan als de eerste paint op de CSS-default valt en pas ná mount naar het echte thema omklapt.
 * Tot #818 stond het inline in `index.html`; de Content-Security-Policy van de SuperCloud laat geen
 * inline script toe, dus het staat nu in `public/` (Vite kopieert het en zet het pad op de `base`).
 * Het script is bewust een HANDKOPIE van `THEME_MIGRATION`/`initTheme()` (`src/utils/settingsStore.ts`)
 * en van `siteHostTheme()` (`src/services/fileAccess/siteHostPreferences.ts`): het draait vóórdat er
 * enige JS-module geladen is, dus het kan die functies niet importeren.
 *
 * Deze check bewaakt:
 * - `index.html` heeft geen inline script en laadt `/theme-prepaint.js` als klassiek script in `<head>`;
 * - de `map`-literal in het script is sleutel-voor-sleutel gelijk aan `THEME_MIGRATION`, de `oaTheme`-map
 *   aan `OA_THEME_FOR`, de `hostThemes`-lijst aan `SITE_HOST_THEMES`;
 * - het GEDRAG: het script draait in een `vm`-context met een nepvenster (host, parent, Tauri,
 *   localStorage) en geeft per geval hetzelfde thema als `peekTheme()` in TS.
 *
 * Bewuste, gedocumenteerde uitzondering: het script lost een `'system'`-uitkomst ná de mapping-lookup
 * nóg één stap verder op naar een concreet `'dark'`/`'light'` via `prefers-color-scheme` (het kan geen
 * React-state lezen, dus het moet meteen een concreet thema neerzetten). `peekTheme()` laat `'system'`
 * juist onopgelost staan — de resolutie gebeurt daar pas later via `resolveUITheme()`
 * (`src/utils/theme.ts`). De gedragsvergelijking hieronder past daarom `resolveUITheme` toe op de
 * TS-kant.
 *
 * Draait via run.sh. Exit 0 = alles groen, exit 1 = minstens één afwijking.
 */
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
// De variabelenaam `indexHtml` blijft voor de bestaande regexen hieronder; de inhoud is nu het script.
const indexHtml = fs.readFileSync(prepaintPath, 'utf8');

// --- index.html: geen inline script, wel het externe pre-paint-script in <head> ---------------------
// Commentaar weg tot er niets meer verandert (één ronde kan een nieuw `<!--` overlaten), dan elk
// scripttag, ongeacht hoofdletters of spaties in de sluittag.
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
const scriptTags = [...htmlNoComments.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
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

// Extract de object-literal na `var map = ` t/m de afsluitende `};`. Bewust een niet-gretige
// match op het EERSTE `};` ná de opening — de literal bevat zelf geen geneste `{...}` (platte
// string→string-map), dus dat is hier veilig.
const mapMatch = /var\s+map\s*=\s*(\{[\s\S]*?\});/.exec(indexHtml);
check('theme-prepaint.js: de pre-paint-themamap (`var map = {...}`) is gevonden', mapMatch !== null);

let indexHtmlMap: Record<string, string> = {};
if (mapMatch) {
  try {
    // De literal bestaat uitsluitend uit string-sleutels en string-waarden (geen functies, geen
    // externe referenties) — een geïsoleerde Function-evaluatie van precies dát fragment is hier
    // veilig, en veel minder broos dan een handmatige key/value-regex-parser.
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
  if (!(key in indexHtmlMap)) continue; // al gemeld door de sleutel-gelijkheidscheck hierboven
  check(
    `sleutel '${key}': theme-prepaint.js geeft '${indexHtmlMap[key]}', THEME_MIGRATION geeft '${THEME_MIGRATION[key]}'`,
    indexHtmlMap[key] === THEME_MIGRATION[key],
  );
}

// De tweede spiegel: OPS-thema → `data-oa-theme` (OpenAEC-tokens 0.4). Zonder dit attribuut
// tekenen de brugblokken in globals.css bij de eerste paint met de verkeerde tokens (een flits).
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

// De onbekende-sleutel-default moet in beide 'dark' zijn — dat staat niet IN de map, dus los
// vastgezet door de bronnen zelf te grepen op hun fallback-uitdrukking.
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
    return occurrences === 2; // initTheme() én peekTheme()
  })(),
);

// --- De themalijst van de host -----------------------------------------------------------------------
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

// --- Gedrag: het script in een vm-context tegen peekTheme() --------------------------------------------
interface Scenario {
  name: string;
  saved?: string;
  own?: unknown;
  parent?: unknown;
  /** De parent gooit bij het lezen (cross-origin). */
  parentThrows?: boolean;
  tauri?: boolean;
  /** localStorage gooit bij elke toegang (opaque origin zonder shim). */
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
    setItem: () => { /* niet nodig */ },
    removeItem: () => { /* niet nodig */ },
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
