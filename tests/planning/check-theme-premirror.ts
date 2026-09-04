/**
 * Contract-check voor de pre-paint-themaspiegel in `index.html` (issue #61).
 *
 * `index.html` bevat een klein inline script dat vóór de eerste React-paint alvast
 * `data-theme` op `<html>` zet, om de thema-flits te voorkomen die zou ontstaan als de eerste
 * paint op de CSS-default valt en pas ná mount naar het echte thema omklapt. Dat script is
 * bewust een HANDKOPIE van `THEME_MIGRATION`/`initTheme()` (`src/utils/settingsStore.ts`) —
 * het draait vóórdat er enige JS-module geladen is, dus het kan die functie niet importeren.
 *
 * Niets bewaakte tot nu toe dat de twee synchroon blijven: precies de duplicatieklasse die dit
 * project elders (documentContract, ifcSaveInput, RIBBON_TABS/BackstageSection-lijst versus
 * `verify:docs`, …) wél mechanisch dichtzet. Deze check parseert de `map`-object-literal uit
 * `index.html` met een regex (geen DOM/browser nodig — het is gewoon tekst) en vergelijkt hem
 * sleutel-voor-sleutel met de geëxporteerde `THEME_MIGRATION`.
 *
 * Bewuste, gedocumenteerde uitzondering: `index.html` lost een `'system'`-uitkomst ná de
 * mapping-lookup nóg één stap verder op naar een concreet `'dark'`/`'light'` via
 * `prefers-color-scheme` (het pre-paint-script kan geen React-state lezen, dus het moet meteen
 * een concreet thema neerzetten). `THEME_MIGRATION`/`peekTheme()` laten `'system'` juist
 * onopgelost staan — de resolutie gebeurt daar pas later via `resolveUITheme()`
 * (`src/utils/theme.ts`). Die extra stap verandert de MAP zelf niet (`'system': 'system'` blijft
 * in beide de brontabel), dus zit hij bewust NIET in de vergelijking hieronder — de
 * sleutel-voor-sleutel-vergelijking blijft het juiste contract.
 *
 * Draait via run.sh. Exit 0 = alles groen, exit 1 = minstens één afwijking.
 */
import fs from 'node:fs';
import path from 'node:path';
import { THEME_MIGRATION } from '@/utils/settingsStore';

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
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// Extract de object-literal na `var map = ` t/m de afsluitende `};`. Bewust een niet-gretige
// match op het EERSTE `};` ná de opening — de literal bevat zelf geen geneste `{...}` (platte
// string→string-map), dus dat is hier veilig.
const mapMatch = /var\s+map\s*=\s*(\{[\s\S]*?\});/.exec(indexHtml);
check('index.html: de pre-paint-themamap (`var map = {...}`) is gevonden', mapMatch !== null);

let indexHtmlMap: Record<string, string> = {};
if (mapMatch) {
  try {
    // De literal bestaat uitsluitend uit string-sleutels en string-waarden (geen functies, geen
    // externe referenties) — een geïsoleerde Function-evaluatie van precies dát fragment is hier
    // veilig, en veel minder broos dan een handmatige key/value-regex-parser.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- geïsoleerde literal, zie boven
    indexHtmlMap = new Function(`"use strict"; return (${mapMatch[1]});`)() as Record<string, string>;
  } catch (err) {
    check(`index.html: de gevonden themamap kon geparsed worden (${(err as Error).message})`, false);
  }
}

const indexHtmlKeys = Object.keys(indexHtmlMap).sort();
const migrationKeys = Object.keys(THEME_MIGRATION).sort();

check(
  `index.html en THEME_MIGRATION hebben dezelfde sleutels ` +
    `(index.html: [${indexHtmlKeys.join(', ')}], THEME_MIGRATION: [${migrationKeys.join(', ')}])`,
  JSON.stringify(indexHtmlKeys) === JSON.stringify(migrationKeys),
);

for (const key of migrationKeys) {
  if (!(key in indexHtmlMap)) continue; // al gemeld door de sleutel-gelijkheidscheck hierboven
  check(
    `sleutel '${key}': index.html geeft '${indexHtmlMap[key]}', THEME_MIGRATION geeft '${THEME_MIGRATION[key]}'`,
    indexHtmlMap[key] === THEME_MIGRATION[key],
  );
}

// De onbekende-sleutel-default moet in beide 'dark' zijn — dat staat niet IN de map, dus los
// vastgezet door de bronnen zelf te grepen op hun fallback-uitdrukking.
check(
  "index.html: de initiële/fallback-waarde van `theme` is 'dark'",
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

if (failures > 0) {
  console.error(`\nTOTAAL: ${failures} afwijking(en)`);
  process.exitCode = 1;
} else {
  console.log('\nTOTAAL: alles groen');
}
