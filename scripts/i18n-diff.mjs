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
//
// Besluit B5 (2026-10-10): een nieuwe of gewijzigde tekst vraagt alleen nl + en; de andere talen vult
// de vertaalstraat. Daarom drie soorten uitkomst:
//  - `en` mist een sleutel (of een meervoudsvorm): FOUT — en is de terugvaltaal van de app.
//  - een andere taal mist een sleutel of een hele meervoudsfamilie: RAPPORT (exit 0). De app valt daar
//    terug op en; de releasepoort `npm run verify:translations` eist dat de straat hem aanvult.
//  - een andere taal heeft een HALVE meervoudsfamilie (een deel van haar CLDR-categorieën): FOUT —
//    i18next valt voor de ontbrekende getallen terug op en, midden in een vertaalde zin.
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
 * De eenheden van de nl-paden: een gewone sleutel (`plural: false`, één pad) of een meervoudsfamilie
 * (`plural: true`, per CLDR-categorie van DEZE locale één pad; `_one` verdwijnt dus voor zh,
 * `_few`/`_many` komen erbij voor pl).
 */
function expectedUnitsFor(basePaths, locale) {
  const cats = categoriesFor(locale);
  const units = [];
  const seenStems = new Set();
  for (const p of basePaths) {
    const m = p.match(PLURAL_SUFFIX);
    if (!m) {
      units.push({ key: p, plural: false, paths: [p] });
      continue;
    }
    const stem = p.slice(0, -m[0].length);
    if (seenStems.has(stem)) continue;
    seenStems.add(stem);
    units.push({ key: stem, plural: true, paths: [...cats].map((cat) => `${stem}_${cat}`) });
  }
  return units;
}

const baseFiles = fs.readdirSync(path.join(localesDir, base)).filter((f) => f.endsWith('.json'));

let totalErrors = 0;
/** Fouten per locale en bestand: ontbrekende paden (en) en halve families (alle talen). */
const errors = {};
/** Rapport per locale en bestand: helemaal ontbrekende sleutels/families (niet-en; B5). */
const absent = {};
const basePluralReport = {};
const push = (bucket, locale, file, item) => {
  bucket[locale] = bucket[locale] || {};
  bucket[locale][file] = [...(bucket[locale][file] || []), item];
};

for (const file of baseFiles) {
  const baseData = JSON.parse(fs.readFileSync(path.join(localesDir, base, file), 'utf8'));
  const basePaths = collectPaths(baseData);

  // De bronlocale is óók een echte locale. Zonder deze check kan iemand bijvoorbeeld nl/_other
  // verwijderen: de doelvertalingen vergelijken dan nog steeds met de verminkte bron en de
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
    totalErrors += missing.length + extra.length;
  }

  for (const locale of others) {
    const filePath = path.join(localesDir, locale, file);
    const localeData = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
    for (const unit of expectedUnitsFor(basePaths, locale)) {
      const missing = unit.paths.filter((p) => getAtPath(localeData, p) === undefined);
      if (missing.length === 0) continue;
      if (locale === 'en') {
        for (const p of missing) push(errors, locale, file, p);
        totalErrors += missing.length;
      } else if (missing.length === unit.paths.length) {
        push(absent, locale, file, unit.key);
      } else {
        const cats = missing.map((p) => p.slice(unit.key.length + 1));
        push(errors, locale, file, `${unit.key}: halve meervoudsfamilie, ontbreekt ${cats.join(', ')}`);
        totalErrors += 1;
      }
    }
  }
}

const count = (files) => (files ? Object.values(files).reduce((a, b) => a + b.length, 0) : 0);

const jsonMode = process.argv.includes('--json');
if (jsonMode) {
  // Rapportagemodus: bedoeld om doorgesluisd te worden, dus geen exitcode-poort.
  console.log(JSON.stringify({
    errors: { ...(Object.keys(basePluralReport).length ? { [base]: basePluralReport } : {}), ...errors },
    absent,
  }, null, 2));
  process.exit(0);
}
const verbose = process.argv.includes('--verbose');

if (Object.keys(basePluralReport).length) {
  const n = Object.values(basePluralReport).reduce((total, paths) => total + paths.length, 0);
  console.log(`\nXX ${base}: ${n} ongeldige CLDR-pluralvorm(en)`);
  for (const [file, paths] of Object.entries(basePluralReport)) {
    console.log(`  ${file}:`);
    for (const problem of paths) console.log(`    - ${problem}`);
  }
}

for (const locale of others) {
  const files = errors[locale];
  if (!files) continue;
  console.log(`\nXX ${locale}: ${count(files)} fout(en)${locale === 'en' ? ' — en is de terugvaltaal en moet compleet zijn' : ''}`);
  for (const [file, paths] of Object.entries(files)) {
    console.log(`  ${file}:`);
    for (const p of paths) console.log(`    - ${p}`);
  }
}

// Rapport (B5): één regel per taal; de sleutels zelf met --verbose of via `npm run translate -- status <taal>`.
const reported = others.filter((l) => absent[l]);
if (reported.length) {
  console.log('\n.. Rapport (geen fout): sleutels die in een taal nog helemaal ontbreken. De app valt daar terug op en;');
  console.log('   de vertaalstraat vult ze aan, en een release eist ze (`npm run verify:translations`).');
  for (const locale of reported) {
    const files = absent[locale];
    const perFile = Object.entries(files).map(([f, keys]) => `${f.replace(/\.json$/, '')} ${keys.length}`).join(', ');
    console.log(`.. ${locale}: ${count(files)} sleutel(s) ontbreken (${perFile})`);
    if (verbose) for (const [file, keys] of Object.entries(files)) for (const k of keys) console.log(`     ${file}: ${k}`);
  }
}

if (totalErrors > 0) {
  console.log(`\nXX ${totalErrors} fout(en) — vul en aan, maak halve meervoudsfamilies compleet, of pas nl aan.`);
  process.exit(1);
}
const complete = others.length - reported.length;
console.log(`\nOK — en compleet t.o.v. ${base}; ${complete} van ${others.length} locales compleet`
  + `${reported.length ? `, ${reported.length} met ontbrekende sleutels (rapport)` : ''} (CLDR-pluralcategorieën meegerekend).`);
