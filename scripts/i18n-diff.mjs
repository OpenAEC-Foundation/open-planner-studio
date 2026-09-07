#!/usr/bin/env node
// Vergelijkt elke locale met de bronlocale (nl) en meldt ontbrekende sleutels.
//
// Twee dingen die dit script bewust WEL doet, omdat het anders onbruikbaar is als
// poort:
//
//  1. Het eindigt met een exitcode. Tot nu toe eindigde het altijd met 0, dus het
//     kon nooit iets tegenhouden — vandaar dat het ook nooit in package.json of
//     CI stond. `--json` blijft rapportagemodus (exit 0), de gewone modus is de
//     poort.
//  2. Het rekent met CLDR-pluralcategorieën in plaats van met een letterlijke
//     sleutelvergelijking. Zonder dat meldde het 27 "ontbrekende" sleutels die
//     correct afwezig zijn: zh, ja en ko kennen geen `one`-categorie, dus een
//     `..._one`-sleutel hoort daar NIET te bestaan. Dat is de allowlist — alleen
//     dan met CLDR als bron in plaats van een handmatig bijgehouden lijst, die
//     bij elke nieuwe meervoudssleutel opnieuw aangevuld zou moeten worden.
//
// De tweede regel werkt ook de andere kant op: het Pools heeft `few` en `many`,
// categorieën die het Nederlands niet kent. Een puur nl-gedreven scan zou die
// nooit eisen. Per locale wordt daarom de eigen categorielijst opgevraagd.
import fs from 'node:fs';
import path from 'node:path';

const localesDir = path.resolve(process.cwd(), 'src/i18n/locales');
const base = 'nl';
const locales = fs.readdirSync(localesDir).filter((d) =>
  fs.statSync(path.join(localesDir, d)).isDirectory()
);
const others = locales.filter((l) => l !== base);

// i18next v25 hangt de CLDR-categorie achter de sleutel: `key_one`, `key_other`, …
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** De categorieën die deze taal volgens CLDR kent — dus welke suffixen vereist zijn. */
const categoriesFor = (locale) =>
  new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);

function collectPaths(obj, prefix = '') {
  let paths = [];
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const p = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      paths = paths.concat(collectPaths(value, p));
    } else {
      paths.push(p);
    }
  }
  return paths;
}

function getAtPath(obj, p) {
  const parts = p.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object' || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Zet de nl-sleutelpaden om in de paden die DEZE locale moet hebben.
 * Gewone sleutels gaan één-op-één mee; een meervoudssleutel wordt vervangen door
 * de stam plus elke categorie die de locale kent (`_one` verdwijnt dus voor zh,
 * `_few`/`_many` komen erbij voor pl).
 */
function expectedPathsFor(basePaths, locale) {
  const cats = categoriesFor(locale);
  const expected = new Set();
  for (const p of basePaths) {
    const m = p.match(PLURAL_SUFFIX);
    if (!m) {
      expected.add(p);
      continue;
    }
    const stem = p.slice(0, -m[0].length);
    for (const cat of cats) expected.add(`${stem}_${cat}`);
  }
  return [...expected];
}

const baseFiles = fs.readdirSync(path.join(localesDir, base)).filter((f) => f.endsWith('.json'));

let totalMissing = 0;
const report = {};
const basePluralReport = {};

for (const file of baseFiles) {
  const baseData = JSON.parse(fs.readFileSync(path.join(localesDir, base, file), 'utf8'));
  const basePaths = collectPaths(baseData);

  // De bronlocale is óók een echte locale. Zonder deze check kan iemand bijvoorbeeld nl/_other
  // verwijderen: de 13 doelvertalingen vergelijken dan nog steeds met de verminkte bron en de
  // poort blijft ten onrechte groen. Verzamel pluralen per stam, zodat alle CLDR-vormen van het
  // Nederlands precies eenmaal vereist zijn, net als verderop voor elke doelvertaling.
  const foundByStem = new Map();
  for (const p of basePaths) {
    const match = p.match(PLURAL_SUFFIX);
    if (!match) continue;
    const stem = p.slice(0, -match[0].length);
    const found = foundByStem.get(stem) || new Set();
    found.add(match[1]);
    foundByStem.set(stem, found);
  }
  const baseCategories = categoriesFor(base);
  for (const [stem, found] of foundByStem) {
    const missing = [...baseCategories].filter(category => !found.has(category));
    const extra = [...found].filter(category => !baseCategories.has(category));
    if (!missing.length && !extra.length) continue;
    const problems = [];
    if (missing.length) problems.push(`${stem}: ontbreekt ${missing.join(', ')}`);
    if (extra.length) problems.push(`${stem}: overbodig ${extra.join(', ')}`);
    basePluralReport[file] = [...(basePluralReport[file] || []), ...problems];
    totalMissing += missing.length + extra.length;
  }

  for (const locale of others) {
    const expected = expectedPathsFor(basePaths, locale);
    const filePath = path.join(localesDir, locale, file);
    if (!fs.existsSync(filePath)) {
      report[locale] = report[locale] || {};
      report[locale][file] = expected;
      totalMissing += expected.length;
      continue;
    }
    const localeData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const missing = expected.filter((p) => getAtPath(localeData, p) === undefined);
    if (missing.length) {
      report[locale] = report[locale] || {};
      report[locale][file] = missing;
      totalMissing += missing.length;
    }
  }
}

const jsonMode = process.argv.includes('--json');
if (jsonMode) {
  // Rapportagemodus: bedoeld om doorgesluisd te worden, dus geen exitcode-poort.
  console.log(JSON.stringify({ ...(Object.keys(basePluralReport).length ? { [base]: basePluralReport } : {}), ...report }, null, 2));
  process.exit(0);
}

if (Object.keys(basePluralReport).length) {
  const count = Object.values(basePluralReport).reduce((total, paths) => total + paths.length, 0);
  console.log(`\n=== ${base}: ${count} ongeldige CLDR-pluralvorm(en) ===`);
  for (const [file, paths] of Object.entries(basePluralReport)) {
    console.log(`  ${file}:`);
    for (const problem of paths) console.log(`    - ${problem}`);
  }
}

for (const locale of others) {
  const files = report[locale];
  const count = files ? Object.values(files).reduce((a, b) => a + b.length, 0) : 0;
  console.log(`\n=== ${locale}: ${count} ontbrekende sleutels ===`);
  if (files) {
    for (const [file, paths] of Object.entries(files)) {
      console.log(`  ${file}:`);
      for (const p of paths) console.log(`    - ${p}`);
    }
  }
}

if (totalMissing > 0) {
  console.log(`\nXX ${totalMissing} ontbrekende sleutel(s) over alle locales — vul ze aan of pas nl aan.`);
  process.exit(1);
}
console.log(`\nOK — alle ${others.length} locales compleet t.o.v. ${base} (CLDR-pluralcategorieën meegerekend).`);
